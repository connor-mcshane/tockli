import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";

const DATABASE_URL =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const ownerId = "00000000-0000-4000-8000-00000000a001";
const collaboratorId = "00000000-0000-4000-8000-00000000a002";
const outsiderId = "00000000-0000-4000-8000-00000000a003";
const marketingEmail = "early-access@tockli.test";

const sql = postgres(DATABASE_URL, {
  idle_timeout: 1,
  max: 1,
});

async function requireLocalDatabase() {
  try {
    await sql`select 1`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        "Local Supabase database is not reachable.",
        "Start Docker Desktop, then run `pnpm run db:start` and `pnpm run db:reset` before `pnpm run test:db`.",
        `Connection error: ${message}`,
      ].join(" "),
    );
  }
}

async function resetTestData() {
  await sql.begin(async (tx) => {
    await tx`delete from public.marketing_signups where lower(email) = lower(${marketingEmail})`;
    await tx`delete from public.pomodoro_cancellations where user_id in (${ownerId}, ${collaboratorId}, ${outsiderId})`;
    await tx`delete from public.focus_sessions where user_id in (${ownerId}, ${collaboratorId}, ${outsiderId})`;
    await tx`delete from public.task_comments where author_id in (${ownerId}, ${collaboratorId}, ${outsiderId})`;
    await tx`delete from public.task_subtasks where task_id in (select id from public.tasks where created_by in (${ownerId}, ${collaboratorId}, ${outsiderId}))`;
    await tx`delete from public.task_tags where task_id in (select id from public.tasks where created_by in (${ownerId}, ${collaboratorId}, ${outsiderId}))`;
    await tx`delete from public.tasks where created_by in (${ownerId}, ${collaboratorId}, ${outsiderId})`;
    await tx`delete from public.task_categories where created_by in (${ownerId}, ${collaboratorId}, ${outsiderId})`;
    await tx`delete from public.project_invitations where invited_by in (${ownerId}, ${collaboratorId}, ${outsiderId}) or accepted_by in (${ownerId}, ${collaboratorId}, ${outsiderId}) or project_id in (select id from public.projects where owner_id in (${ownerId}, ${collaboratorId}, ${outsiderId}))`;
    await tx`delete from public.project_members where user_id in (${ownerId}, ${collaboratorId}, ${outsiderId}) or project_id in (select id from public.projects where owner_id in (${ownerId}, ${collaboratorId}, ${outsiderId}))`;
    await tx`delete from public.projects where owner_id in (${ownerId}, ${collaboratorId}, ${outsiderId})`;
    await tx`delete from public.user_settings where user_id in (${ownerId}, ${collaboratorId}, ${outsiderId})`;
    await tx`delete from public.profiles where id in (${ownerId}, ${collaboratorId}, ${outsiderId})`;
    await tx`delete from auth.users where id in (${ownerId}, ${collaboratorId}, ${outsiderId})`;
  });
}

async function insertAuthUser(tx, id, email, name, plan = "free") {
  await tx`
    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      ${id}::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated',
      'authenticated',
      ${email}::text,
      crypt('tockli-test', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', ${name}::text),
      now(),
      now()
    )
  `;

  await tx`
    update public.profiles
    set plan = ${plan}::public.plan_tier
    where id = ${id}::uuid
  `;
}

async function withAuthenticatedUser(userId, callback) {
  return sql.begin(async (tx) => {
    await tx`set local role authenticated`;
    await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
    await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`;
    return callback(tx);
  });
}

async function withAnon(callback) {
  return sql.begin(async (tx) => {
    await tx`set local role anon`;
    await tx`select set_config('request.jwt.claim.role', 'anon', true)`;
    return callback(tx);
  });
}

test("local Supabase schema supports Tockli tasks, comments, sessions, and RLS behavior", async () => {
  await requireLocalDatabase();
  await resetTestData();

  await withAnon(
    async (tx) => tx`
      insert into public.marketing_signups (
        email,
        role,
        intent,
        source,
        experiment_id,
        experiment_variant
      )
      values (
        ${marketingEmail},
        'Engineer',
        'personal-focus',
        'test',
        'landing-hero-2026-07',
        'task-first'
      )
    `,
  );
  const [marketingSignup] = await sql`
    select email, intent
    from public.marketing_signups
    where lower(email) = lower(${marketingEmail})
  `;
  assert.equal(marketingSignup.email, marketingEmail);
  assert.equal(marketingSignup.intent, "personal-focus");

  await assert.rejects(
    withAnon(async (tx) => tx`select email from public.marketing_signups`),
    /permission denied/,
  );

  await sql.begin(async (tx) => {
    await insertAuthUser(tx, ownerId, "owner@tockli.test", "Owner User");
    await insertAuthUser(
      tx,
      collaboratorId,
      "collaborator@tockli.test",
      "Collaborator User",
    );
    await insertAuthUser(tx, outsiderId, "outsider@tockli.test", "Outsider User");
  });

  const bootstrappedProfiles = await sql`
    select email, display_name
    from public.profiles
    where id in (${ownerId}, ${collaboratorId}, ${outsiderId})
    order by email
  `;
  assert.deepEqual(
    bootstrappedProfiles.map((profile) => profile.display_name),
    ["Collaborator User", "Outsider User", "Owner User"],
  );

  const bootstrappedSettings = await sql`
    select user_id, sound_enabled
    from public.user_settings
    where user_id in (${ownerId}, ${collaboratorId}, ${outsiderId})
  `;
  assert.equal(bootstrappedSettings.length, 3);
  assert.ok(
    bootstrappedSettings.every((settings) => settings.sound_enabled === true),
  );

  const [ownerSettings] = await withAuthenticatedUser(ownerId, async (tx) => {
    return tx`
      update public.user_settings
      set
        focus_minutes = 5,
        daily_pomodoro_goal = 6,
        sound_enabled = true,
        focus_sound = 'ocean_waves'
      where user_id = ${ownerId}
      returning focus_minutes, daily_pomodoro_goal, focus_sound
    `;
  });
  assert.equal(ownerSettings.focus_minutes, 5);
  assert.equal(ownerSettings.daily_pomodoro_goal, 6);
  assert.equal(ownerSettings.focus_sound, "ocean_waves");

  const collaboratorVisibleOwnerSettings = await withAuthenticatedUser(
    collaboratorId,
    async (tx) =>
      tx`select user_id from public.user_settings where user_id = ${ownerId}`,
  );
  assert.equal(collaboratorVisibleOwnerSettings.length, 0);

  const projectGoalColumns = await sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'daily_goal'
  `;
  assert.equal(projectGoalColumns.length, 0);

  const [personalProject] = await sql`
    insert into public.projects (owner_id, name, kind)
    values (${ownerId}, 'Personal Focus', 'personal')
    returning id, description, board_columns
  `;
  assert.equal(personalProject.description, "");
  assert.deepEqual(
    personalProject.board_columns.map((column) => column.title),
    ["To do", "Doing", "Done"],
  );

  const [teamProject] = await sql`
    insert into public.projects (owner_id, name, kind)
    values (${ownerId}, 'Shared Sprint', 'team')
    returning id
  `;
  const customColumns = [
    { id: "todo", title: "Inbox" },
    { id: "active", title: "Doing" },
    { id: "waiting", title: "Waiting" },
    { id: "done", title: "Done", isDone: true },
  ];
  const [customizedProject] = await sql`
    update public.projects
    set board_columns = ${sql.json(customColumns)}
    where id = ${teamProject.id}
    returning board_columns
  `;
  assert.equal(customizedProject.board_columns[2].id, "waiting");

  const ownerMemberships = await sql`
    select role from public.project_members
    where user_id = ${ownerId}
    order by role
  `;
  assert.equal(ownerMemberships.length, 2);
  assert.ok(ownerMemberships.every((membership) => membership.role === "owner"));

  await assert.rejects(
    sql`
      insert into public.projects (owner_id, name, kind)
      values (${ownerId}, 'Second Shared Sprint', 'team')
    `,
    /Free accounts can own one shared project/,
  );

  await sql`update public.profiles set plan = 'pro' where id = ${ownerId}`;
  const [secondTeamProject] = await sql`
    insert into public.projects (owner_id, name, kind)
    values (${ownerId}, 'Second Shared Sprint', 'team')
    returning id
  `;
  assert.ok(secondTeamProject.id);

  await assert.rejects(
    sql`
      insert into public.project_members (project_id, user_id, role)
      values (${teamProject.id}, ${collaboratorId}, 'editor')
    `,
    /Project collaborators are read-only users/,
  );

  const [invite] = await withAuthenticatedUser(ownerId, async (tx) =>
    tx`
      insert into public.project_invitations (
        project_id,
        invited_email,
        invited_by
      )
      values (
        ${teamProject.id},
        'collaborator@tockli.test',
        ${ownerId}
      )
      returning token, role, status
    `,
  );
  assert.equal(invite.role, "viewer");
  assert.equal(invite.status, "pending");

  await assert.rejects(
    withAuthenticatedUser(outsiderId, async (tx) =>
      tx`select * from public.accept_project_invite(${invite.token})`,
    ),
    /Project invite is invalid, expired, or belongs to another email/,
  );

  const [acceptedInvite] = await withAuthenticatedUser(collaboratorId, async (tx) =>
    tx`select * from public.accept_project_invite(${invite.token})`,
  );
  assert.equal(acceptedInvite.project_id, teamProject.id);
  assert.equal(acceptedInvite.project_name, "Shared Sprint");
  assert.equal(acceptedInvite.role, "viewer");

  const [collaboratorMembership] = await sql`
    select role from public.project_members
    where project_id = ${teamProject.id}
      and user_id = ${collaboratorId}
  `;
  assert.equal(collaboratorMembership.role, "viewer");

  const [acceptedInviteRecord] = await sql`
    select status, accepted_by from public.project_invitations
    where token = ${invite.token}
  `;
  assert.equal(acceptedInviteRecord.status, "accepted");
  assert.equal(acceptedInviteRecord.accepted_by, collaboratorId);

  const [category] = await withAuthenticatedUser(ownerId, async (tx) => {
    const [createdCategory] = await tx`
      insert into public.task_categories (
        project_id,
        name,
        color,
        created_by
      )
      values (
        ${teamProject.id},
        'Research',
        '#2f6fed',
        ${ownerId}
      )
      returning id, name, color
    `;

    return [createdCategory];
  });
  assert.equal(category.name, "Research");

  const [task] = await withAuthenticatedUser(ownerId, async (tx) => {
    const [createdTask] = await tx`
      insert into public.tasks (
        project_id,
        category_id,
        title,
        note,
        status,
        priority,
        estimate_minutes,
        spent_minutes,
        created_by
      )
      values (
        ${teamProject.id},
        ${category.id},
        'Draft shared checklist',
        'Test task created through authenticated role.',
        'todo',
        'high',
        25,
        0,
        ${ownerId}
      )
      returning id, status, category_id
    `;

    return [createdTask];
  });
  assert.equal(task.status, "todo");
  assert.equal(task.category_id, category.id);
  const [movedTask] = await withAuthenticatedUser(ownerId, async (tx) =>
    tx`
      update public.tasks
      set status = 'waiting'
      where id = ${task.id}
      returning status
    `,
  );
  assert.equal(movedTask.status, "waiting");

  const viewerTaskUpdates = await withAuthenticatedUser(collaboratorId, async (tx) =>
    tx`
        update public.tasks
        set title = 'Viewer should not edit this'
        where id = ${task.id}
        returning id
      `,
  );
  assert.equal(viewerTaskUpdates.length, 0);

  await withAuthenticatedUser(ownerId, async (tx) => {
    const [subtask] = await tx`
      insert into public.task_subtasks (
        task_id,
        title,
        is_done,
        sort_order
      )
      values (
        ${task.id},
        'Confirm card drawer fields',
        false,
        1
      )
      returning title, is_done
    `;

    assert.equal(subtask.title, "Confirm card drawer fields");
    assert.equal(subtask.is_done, false);
  });

  await withAuthenticatedUser(ownerId, async (tx) => {
    const [comment] = await tx`
      insert into public.task_comments (task_id, author_id, body)
      values (
        ${task.id},
        ${ownerId},
        'Owner comment on the shared task.'
      )
      returning id, body
    `;

    assert.equal(comment.body, "Owner comment on the shared task.");
  });

  await assert.rejects(
    withAuthenticatedUser(collaboratorId, async (tx) => {
      await tx`
        insert into public.task_comments (task_id, author_id, body)
        values (
          ${task.id},
          ${collaboratorId},
          'Collaborator reply on the shared task.'
        )
      `;
    }),
  );

  const collaboratorVisibleTasks = await withAuthenticatedUser(
    collaboratorId,
    async (tx) => tx`select id from public.tasks where project_id = ${teamProject.id}`,
  );
  assert.equal(collaboratorVisibleTasks.length, 1);

  const collaboratorVisibleCategories = await withAuthenticatedUser(
    collaboratorId,
    async (tx) =>
      tx`select id from public.task_categories where project_id = ${teamProject.id}`,
  );
  assert.equal(collaboratorVisibleCategories.length, 1);

  const collaboratorVisibleSubtasks = await withAuthenticatedUser(
    collaboratorId,
    async (tx) =>
      tx`
        select st.id
        from public.task_subtasks st
        join public.tasks t on t.id = st.task_id
        where t.project_id = ${teamProject.id}
      `,
  );
  assert.equal(collaboratorVisibleSubtasks.length, 1);

  const collaboratorVisibleComments = await withAuthenticatedUser(
    collaboratorId,
    async (tx) =>
      tx`
        select id, author_id
        from public.task_comments
        where task_id = ${task.id}
        order by created_at
      `,
  );
  assert.equal(collaboratorVisibleComments.length, 1);

  const collaboratorVisibleProfiles = await withAuthenticatedUser(
    collaboratorId,
    async (tx) =>
      tx`
        select id
        from public.profiles
        where id in (${ownerId}, ${collaboratorId})
      `,
  );
  assert.equal(collaboratorVisibleProfiles.length, 2);

  const outsiderVisibleProjects = await withAuthenticatedUser(
    outsiderId,
    async (tx) => tx`select id from public.projects where id = ${teamProject.id}`,
  );
  assert.equal(outsiderVisibleProjects.length, 0);

  const outsiderVisibleCategories = await withAuthenticatedUser(
    outsiderId,
    async (tx) =>
      tx`select id from public.task_categories where project_id = ${teamProject.id}`,
  );
  assert.equal(outsiderVisibleCategories.length, 0);

  const outsiderVisibleComments = await withAuthenticatedUser(
    outsiderId,
    async (tx) =>
      tx`select id from public.task_comments where task_id = ${task.id}`,
  );
  assert.equal(outsiderVisibleComments.length, 0);

  await assert.rejects(
    withAuthenticatedUser(outsiderId, async (tx) => {
      await tx`
        insert into public.task_comments (task_id, author_id, body)
        values (
          ${task.id},
          ${outsiderId},
          'This comment should not be allowed.'
        )
      `;
    }),
  );

  await withAuthenticatedUser(collaboratorId, async (tx) => {
    const [session] = await tx`
      insert into public.focus_sessions (
        user_id,
        project_id,
        task_id,
        minutes,
        note
      )
      values (
        ${collaboratorId},
        ${teamProject.id},
        ${task.id},
        25,
        'Collaborator focus session.'
      )
      returning id, minutes
    `;

    assert.equal(session.minutes, 25);
  });

  await withAuthenticatedUser(collaboratorId, async (tx) => {
    const [cancellation] = await tx`
      insert into public.pomodoro_cancellations (
        user_id,
        project_id,
        task_id,
        duration_minutes,
        elapsed_minutes,
        reason,
        note
      )
      values (
        ${collaboratorId},
        ${teamProject.id},
        ${task.id},
        25,
        4,
        'interrupted',
        'Cancelled during a local test.'
      )
      returning reason, elapsed_minutes
    `;

    assert.equal(cancellation.reason, "interrupted");
    assert.equal(cancellation.elapsed_minutes, 4);
  });

  const ownerVisibleCollaboratorCancellations = await withAuthenticatedUser(
    ownerId,
    async (tx) =>
      tx`
        select id
        from public.pomodoro_cancellations
        where user_id = ${collaboratorId}
      `,
  );
  assert.equal(ownerVisibleCollaboratorCancellations.length, 0);

  await assert.rejects(
    withAuthenticatedUser(outsiderId, async (tx) => {
      await tx`
        insert into public.focus_sessions (
          user_id,
          project_id,
          task_id,
          minutes,
          note
        )
        values (
          ${outsiderId},
          ${teamProject.id},
          ${task.id},
          25,
          'This should not be allowed.'
        )
      `;
    }),
  );

  const projectSessions = await sql`
    select minutes from public.focus_sessions
    where project_id in (${personalProject.id}, ${teamProject.id})
  `;
  assert.equal(projectSessions.length, 1);
  assert.equal(projectSessions[0].minutes, 25);
});

test.after(async () => {
  await resetTestData().catch(() => {});
  await sql.end();
});

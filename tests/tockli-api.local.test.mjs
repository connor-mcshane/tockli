import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

import { createTockliApi } from "../lib/tockli-api.mjs";
import {
  assertLocalIntegrationEndpoints,
  createBoundedFetch,
  runCleanupSteps,
  withTimeout,
} from "./local-integration-safety.mjs";

const API_URL = process.env.TOCKLI_SUPABASE_URL ?? "http://127.0.0.1:54321";
const PUBLIC_KEY =
  process.env.TOCKLI_SUPABASE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DATABASE_URL =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const OWNER_EMAIL = "api-owner@tockli.test";
const VIEWER_EMAIL = "api-viewer@tockli.test";
const EDITOR_EMAIL = "api-editor@tockli.test";
const PASSWORD = "tockli-demo";
const OWNER_ID = "00000000-0000-4000-8000-00000000b001";
const EDITOR_ID = "00000000-0000-4000-8000-00000000b002";
const VIEWER_ID = "00000000-0000-4000-8000-00000000b003";
const TEAM_PROJECT_ID = "10000000-0000-4000-8000-00000000b001";
const TEST_USER_IDS = [OWNER_ID, EDITOR_ID, VIEWER_ID];
const REQUEST_TIMEOUT_MS = 5_000;
const DATABASE_OPERATION_TIMEOUT_MS = 15_000;
const INTEGRATION_TEST_TIMEOUT_MS = 45_000;

assertLocalIntegrationEndpoints({ apiUrl: API_URL, databaseUrl: DATABASE_URL });

const boundedFetch = createBoundedFetch(globalThis.fetch, REQUEST_TIMEOUT_MS);
const sql = postgres(DATABASE_URL, {
  connect_timeout: 3,
  connection: {
    lock_timeout: REQUEST_TIMEOUT_MS,
    statement_timeout: REQUEST_TIMEOUT_MS,
  },
  idle_timeout: 1,
  max: 1,
});

async function requireLocalStack() {
  try {
    await withTimeout(
      sql`select 1`,
      DATABASE_OPERATION_TIMEOUT_MS,
      "Local database health check",
    );
    const response = await boundedFetch(`${API_URL}/auth/v1/health`);
    assert.equal(response.ok, true);
  } catch (error) {
    throw new Error(
      "Local Supabase is unavailable. Run `pnpm run db:start` and `pnpm run db:reset` before `pnpm run test:tockli:integration`.",
      { cause: error },
    );
  }
}

async function prepareUsers() {
  await withTimeout(
    sql.begin(async (tx) => {
      await tx`delete from auth.users where id in ${tx(TEST_USER_IDS)} `;
      for (const [id, email, displayName] of [
        [OWNER_ID, OWNER_EMAIL, "API Owner"],
        [EDITOR_ID, EDITOR_EMAIL, "API Editor"],
        [VIEWER_ID, VIEWER_EMAIL, "API Viewer"],
      ]) {
        await tx`
        insert into auth.users (
          id,
          instance_id,
          aud,
          role,
          email,
          encrypted_password,
          email_confirmed_at,
          confirmation_token,
          recovery_token,
          email_change_token_new,
          email_change,
          raw_app_meta_data,
          raw_user_meta_data,
          created_at,
          updated_at
        ) values (
          ${id}::uuid,
          '00000000-0000-0000-0000-000000000000'::uuid,
          'authenticated',
          'authenticated',
          ${email},
          crypt(${PASSWORD}, gen_salt('bf')),
          now(),
          '',
          '',
          '',
          '',
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('display_name', ${displayName}::text),
          now(),
          now()
        )
      `;
      }
      await tx`
      insert into public.projects (
        id,
        owner_id,
        name,
        kind,
        board_columns
      ) values (
        ${TEAM_PROJECT_ID}::uuid,
        ${OWNER_ID}::uuid,
        'Shared API Integration',
        'team',
        '[
          {"id":"old","title":"Old","archived":true},
          {"id":"backlog","title":"Backlog"},
          {"id":"working","title":"Working"},
          {"id":"shipped","title":"Shipped","isDone":true}
        ]'::jsonb
      )
    `;
      await tx`
      insert into public.project_members (project_id, user_id, role)
      values (${TEAM_PROJECT_ID}::uuid, ${EDITOR_ID}::uuid, 'editor')
    `;
      await tx`
      insert into public.project_members (project_id, user_id, role)
      values (${TEAM_PROJECT_ID}::uuid, ${VIEWER_ID}::uuid, 'viewer')
    `;
    }),
    DATABASE_OPERATION_TIMEOUT_MS,
    "Local database fixture setup",
  );
}

async function makeApi(configDir) {
  const api = createTockliApi({
    configDir,
    env: {
      TOCKLI_CONFIG_DIR: configDir,
      TOCKLI_SUPABASE_KEY: PUBLIC_KEY,
      TOCKLI_SUPABASE_URL: API_URL,
    },
    clientFactory(url, key, options) {
      return createClient(url, key, {
        ...options,
        global: { ...options.global, fetch: boundedFetch },
      });
    },
  });
  return api;
}

test("shared API works through local Auth/PostgREST as owner, editor, and viewer", {
  timeout: INTEGRATION_TEST_TIMEOUT_MS,
}, async (t) => {
  await requireLocalStack();
  const configRoot = await mkdtemp(path.join(tmpdir(), "tockli-api-local-"));

  t.after(async () => {
    await runCleanupSteps(
      [
        {
          label: "API database fixture cleanup",
          run: () => sql`delete from auth.users where id in ${sql(TEST_USER_IDS)}`,
        },
        {
          label: "API temporary directory cleanup",
          run: () => rm(configRoot, { force: true, recursive: true }),
        },
      ],
      {
        message: "API integration cleanup failed.",
        timeoutMs: DATABASE_OPERATION_TIMEOUT_MS,
      },
    );
  });
  await prepareUsers();

  const owner = await makeApi(path.join(configRoot, "owner"));
  assert.equal(
    (await owner.loginWithPassword({ email: OWNER_EMAIL, password: PASSWORD })).email,
    OWNER_EMAIL,
  );
  assert.equal((await owner.restoreSession()).email, OWNER_EMAIL);
  assert.ok((await owner.listProjects()).some(({ id }) => id === TEAM_PROJECT_ID));

  const ownerTask = await owner.createTask({
    estimateMinutes: 30,
    projectId: TEAM_PROJECT_ID,
    title: `API owner ${Date.now()}`,
  });
  assert.equal(ownerTask.status, "backlog");
  assert.equal(ownerTask.revision, 1);

  const ownerUpdate = await owner.updateTask({
    expectedRevision: ownerTask.revision,
    patch: { note: "Updated by owner", spentMinutes: 10 },
    taskId: ownerTask.id,
  });
  assert.equal(ownerUpdate.revision, 2);
  await assert.rejects(
    owner.updateTask({
      expectedRevision: ownerTask.revision,
      patch: { note: "Stale overwrite" },
      taskId: ownerTask.id,
    }),
    (error) => {
      assert.equal(error.code, "TOCKLI_CONFLICT");
      assert.equal(error.currentRevision, 2);
      return true;
    },
  );
  const completed = await owner.completeTask({
    expectedRevision: ownerUpdate.revision,
    taskId: ownerTask.id,
  });
  assert.equal(completed.status, "shipped");
  assert.equal(completed.revision, 3);
  assert.ok(completed.completedAt);

  const editor = await makeApi(path.join(configRoot, "editor"));
  await editor.loginWithPassword({ email: EDITOR_EMAIL, password: PASSWORD });
  const editorTask = await editor.createTask({
    projectId: TEAM_PROJECT_ID,
    status: "active",
    title: `API editor ${Date.now()}`,
  });
  const editorUpdate = await editor.updateTask({
    expectedRevision: editorTask.revision,
    patch: { priority: "high" },
    taskId: editorTask.id,
  });
  assert.equal(editorUpdate.priority, "high");
  assert.equal(editorUpdate.revision, 2);

  const viewer = await makeApi(path.join(configRoot, "viewer"));
  await viewer.loginWithPassword({ email: VIEWER_EMAIL, password: PASSWORD });
  assert.ok(
    (await viewer.listTasks({ limit: 25, projectId: TEAM_PROJECT_ID })).some(
      ({ id }) => id === editorTask.id,
    ),
  );
  await assert.rejects(
    viewer.createTask({
      projectId: TEAM_PROJECT_ID,
      title: "Viewer may not create this",
    }),
    (error) => {
      assert.equal(error.code, "TOCKLI_FORBIDDEN");
      return true;
    },
  );

  const focusSession = await viewer.logFocusSession({
    minutes: 15,
    note: "Viewer focus session through shared API",
    projectId: TEAM_PROJECT_ID,
    taskId: editorTask.id,
  });
  assert.equal(focusSession.minutes, 15);
  assert.equal(focusSession.userId, VIEWER_ID);
  assert.equal(focusSession.taskId, editorTask.id);
});

test.after(async () => {
  await withTimeout(sql.end({ timeout: 5 }), 6_000, "Database client shutdown");
});

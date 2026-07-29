create extension if not exists "pgcrypto";

create type public.plan_tier as enum ('free', 'pro');
create type public.project_kind as enum ('personal', 'team');
create type public.project_role as enum ('owner', 'editor', 'viewer');
create type public.project_invite_status as enum ('pending', 'accepted', 'revoked');
create type public.task_priority as enum ('low', 'medium', 'high');
create type public.focus_sound as enum (
  'brown_noise',
  'rain',
  'heavy_rain',
  'ocean_waves',
  'thunderstorm',
  'pulse',
  'clock_tick'
);
create type public.cancellation_reason as enum (
  'interrupted',
  'wrong_task',
  'need_break',
  'other'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  plan public.plan_tier not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketing_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null check (
    length(email) between 3 and 254
    and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  role text not null default 'Unknown' check (length(role) <= 80),
  intent text not null default 'personal-focus' check (length(intent) <= 80),
  source text not null default 'direct' check (length(source) <= 120),
  experiment_id text check (experiment_id is null or length(experiment_id) <= 120),
  experiment_variant text check (experiment_variant is null or length(experiment_variant) <= 80),
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text not null default '',
  kind public.project_kind not null default 'personal',
  color text not null default '#ff005e',
  board_columns jsonb not null default '[
    {"id": "todo", "title": "To do"},
    {"id": "active", "title": "Doing"},
    {"id": "done", "title": "Done", "isDone": true}
  ]'::jsonb check (
    jsonb_typeof(board_columns) = 'array'
    and jsonb_array_length(board_columns) > 0
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.project_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.project_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  invited_email text not null check (
    invited_email = lower(invited_email)
    and length(invited_email) between 3 and 254
    and invited_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  role public.project_role not null default 'viewer' check (role = 'viewer'),
  token text not null default encode(gen_random_bytes(32), 'hex') unique,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  accepted_by uuid references public.profiles(id) on delete set null,
  status public.project_invite_status not null default 'pending',
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'pending' and accepted_at is null and revoked_at is null)
    or (status = 'accepted' and accepted_at is not null and accepted_by is not null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

create table public.task_categories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  color text not null default '#ff005e',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category_id uuid references public.task_categories(id) on delete set null,
  title text not null,
  note text not null default '',
  status text not null default 'todo' check (length(status) between 1 and 120),
  priority public.task_priority not null default 'medium',
  estimate_minutes integer not null default 25 check (estimate_minutes between 1 and 480),
  spent_minutes integer not null default 0 check (spent_minutes >= 0),
  due_label text,
  sort_order integer not null default 0,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_tags (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label text not null,
  primary key (task_id, label)
);

create table public.task_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  minutes integer not null check (minutes between 1 and 480),
  note text not null default '',
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.pomodoro_cancellations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  duration_minutes integer not null check (duration_minutes between 5 and 180),
  elapsed_minutes integer not null check (
    elapsed_minutes between 0 and duration_minutes
  ),
  reason public.cancellation_reason not null,
  note text not null default '',
  cancelled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  focus_minutes integer not null default 25 check (focus_minutes between 5 and 90),
  break_minutes integer not null default 5 check (break_minutes between 3 and 30),
  daily_pomodoro_goal integer not null default 6 check (daily_pomodoro_goal between 1 and 16),
  working_days text[] not null default array['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  strict_mode boolean not null default false,
  sound_enabled boolean not null default true,
  focus_sound public.focus_sound not null default 'brown_noise',
  show_next_up boolean not null default false,
  updated_at timestamptz not null default now()
);

create index projects_owner_id_idx on public.projects(owner_id);
create unique index marketing_signups_email_lower_idx on public.marketing_signups (lower(email));
create index project_members_user_id_idx on public.project_members(user_id);
create index project_invitations_project_id_idx on public.project_invitations(project_id);
create unique index project_invitations_open_email_idx
on public.project_invitations(project_id, lower(invited_email))
where status = 'pending';
create index task_categories_project_id_idx on public.task_categories(project_id);
create index tasks_project_id_status_idx on public.tasks(project_id, status);
create index task_subtasks_task_id_idx on public.task_subtasks(task_id);
create index task_comments_task_created_idx on public.task_comments(task_id, created_at);
create index focus_sessions_user_completed_idx on public.focus_sessions(user_id, completed_at desc);
create index focus_sessions_project_completed_idx on public.focus_sessions(project_id, completed_at desc);
create index pomodoro_cancellations_user_cancelled_idx
on public.pomodoro_cancellations(user_id, cancelled_at desc);

create or replace function public.is_project_member(project_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    left join public.project_members pm
      on pm.project_id = p.id
     and pm.user_id = auth.uid()
    where p.id = is_project_member.project_id
      and (p.owner_id = auth.uid() or pm.user_id = auth.uid())
  );
$$;

create or replace function public.current_user_project_role(project_id uuid)
returns public.project_role
language sql
security definer
set search_path = public
as $$
  select case
    when p.owner_id = auth.uid() then 'owner'::public.project_role
    else pm.role
  end
  from public.projects p
  left join public.project_members pm
    on pm.project_id = p.id
   and pm.user_id = auth.uid()
  where p.id = current_user_project_role.project_id
  limit 1;
$$;

create or replace function public.shares_project_with(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members mine
    join public.project_members theirs
      on theirs.project_id = mine.project_id
    where mine.user_id = auth.uid()
      and theirs.user_id = shares_project_with.user_id
  );
$$;

create or replace function public.enforce_free_team_project_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_plan public.plan_tier;
  existing_team_projects integer;
begin
  if new.kind <> 'team' then
    return new;
  end if;

  select plan into owner_plan
  from public.profiles
  where id = new.owner_id;

  if coalesce(owner_plan, 'free') = 'pro' then
    return new;
  end if;

  select count(*) into existing_team_projects
  from public.projects
  where owner_id = new.owner_id
    and kind = 'team'
    and id <> coalesce(new.id, gen_random_uuid());

  if existing_team_projects >= 1 then
    raise exception 'Free accounts can own one shared project';
  end if;

  return new;
end;
$$;

create trigger projects_free_team_limit
before insert or update of kind, owner_id on public.projects
for each row execute function public.enforce_free_team_project_limit();

create or replace function public.add_project_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (project_id, user_id) do update set role = 'owner';

  return new;
end;
$$;

create trigger projects_add_owner_member
after insert on public.projects
for each row execute function public.add_project_owner_member();

create or replace function public.enforce_project_member_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_owner uuid;
begin
  select owner_id into project_owner
  from public.projects
  where id = new.project_id;

  if project_owner is null then
    raise exception 'Project does not exist';
  end if;

  if new.user_id = project_owner then
    new.role := 'owner';
    return new;
  end if;

  if new.role <> 'viewer' then
    raise exception 'Project collaborators are read-only users';
  end if;

  return new;
end;
$$;

create trigger project_members_enforce_roles
before insert or update of user_id, role on public.project_members
for each row execute function public.enforce_project_member_roles();

create or replace function public.accept_project_invite(invite_token text)
returns table (
  project_id uuid,
  project_name text,
  role public.project_role
)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record public.project_invitations%rowtype;
  invitee_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select lower(email) into invitee_email
  from public.profiles
  where id = auth.uid();

  if invitee_email is null then
    raise exception 'Invitee profile is missing an email address';
  end if;

  select * into invite_record
  from public.project_invitations
  where token = invite_token
    and status = 'pending'
    and expires_at > now()
    and invited_email = invitee_email
  limit 1;

  if invite_record.id is null then
    raise exception 'Project invite is invalid, expired, or belongs to another email';
  end if;

  insert into public.project_members (project_id, user_id, role)
  values (invite_record.project_id, auth.uid(), invite_record.role)
  on conflict on constraint project_members_pkey do update
  set role = excluded.role;

  update public.project_invitations
  set
    status = 'accepted',
    accepted_by = auth.uid(),
    accepted_at = now(),
    updated_at = now()
  where id = invite_record.id;

  return query
  select p.id, p.name, invite_record.role
  from public.projects p
  where p.id = invite_record.project_id;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.marketing_signups enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_invitations enable row level security;
alter table public.task_categories enable row level security;
alter table public.tasks enable row level security;
alter table public.task_tags enable row level security;
alter table public.task_subtasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.pomodoro_cancellations enable row level security;
alter table public.user_settings enable row level security;

create policy "Users read own profile"
on public.profiles for select
using (id = auth.uid());

create policy "Users update own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "Users insert own profile"
on public.profiles for insert
with check (id = auth.uid());

create policy "Anyone can join marketing signups"
on public.marketing_signups for insert
to anon, authenticated
with check (
  length(email) between 3 and 254
  and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
);

create policy "Project members read collaborator profiles"
on public.profiles for select
using (public.shares_project_with(id));

create policy "Project members read projects"
on public.projects for select
using (public.is_project_member(id));

create policy "Owners read owned projects"
on public.projects for select
using (owner_id = auth.uid());

create policy "Users create owned projects"
on public.projects for insert
with check (owner_id = auth.uid());

create policy "Owners update projects"
on public.projects for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Owners delete projects"
on public.projects for delete
using (owner_id = auth.uid());

create policy "Members read memberships"
on public.project_members for select
using (public.is_project_member(project_id));

create policy "Owners manage memberships"
on public.project_members for all
using (public.current_user_project_role(project_id) = 'owner')
with check (public.current_user_project_role(project_id) = 'owner');

create policy "Members read categories"
on public.task_categories for select
using (public.is_project_member(project_id));

create policy "Owners manage categories"
on public.task_categories for all
using (public.current_user_project_role(project_id) = 'owner')
with check (public.current_user_project_role(project_id) = 'owner');

create policy "Members read tasks"
on public.tasks for select
using (public.is_project_member(project_id));

create policy "Owners create tasks"
on public.tasks for insert
with check (
  created_by = auth.uid()
  and public.current_user_project_role(project_id) = 'owner'
);

create policy "Owners update tasks"
on public.tasks for update
using (public.current_user_project_role(project_id) = 'owner')
with check (public.current_user_project_role(project_id) = 'owner');

create policy "Owners delete tasks"
on public.tasks for delete
using (public.current_user_project_role(project_id) = 'owner');

create policy "Members read tags"
on public.task_tags for select
using (
  exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.is_project_member(t.project_id)
  )
);

create policy "Owners manage tags"
on public.task_tags for all
using (
  exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.current_user_project_role(t.project_id) = 'owner'
  )
)
with check (
  exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.current_user_project_role(t.project_id) = 'owner'
  )
);

create policy "Members read subtasks"
on public.task_subtasks for select
using (
  exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.is_project_member(t.project_id)
  )
);

create policy "Owners manage subtasks"
on public.task_subtasks for all
using (
  exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.current_user_project_role(t.project_id) = 'owner'
  )
)
with check (
  exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.current_user_project_role(t.project_id) = 'owner'
  )
);

create policy "Members read task comments"
on public.task_comments for select
using (
  exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.is_project_member(t.project_id)
  )
);

create policy "Owners create task comments"
on public.task_comments for insert
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.current_user_project_role(t.project_id) = 'owner'
  )
);

create policy "Owners update own task comments"
on public.task_comments for update
using (
  author_id = auth.uid()
  and exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.current_user_project_role(t.project_id) = 'owner'
  )
)
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.current_user_project_role(t.project_id) = 'owner'
  )
);

create policy "Owners delete own task comments"
on public.task_comments for delete
using (
  author_id = auth.uid()
  and exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.current_user_project_role(t.project_id) = 'owner'
  )
);

create policy "Project owners manage invitations"
on public.project_invitations for all
using (public.current_user_project_role(project_id) = 'owner')
with check (
  public.current_user_project_role(project_id) = 'owner'
  and invited_by = auth.uid()
  and role = 'viewer'
);

create policy "Invitees read own pending invitations"
on public.project_invitations for select
using (
  status = 'pending'
  and expires_at > now()
  and invited_email = (
    select lower(email)
    from public.profiles
    where id = auth.uid()
  )
);

create policy "Users read own sessions"
on public.focus_sessions for select
using (user_id = auth.uid() or public.is_project_member(project_id));

create policy "Users create own sessions"
on public.focus_sessions for insert
with check (user_id = auth.uid() and public.is_project_member(project_id));

create policy "Users update own sessions"
on public.focus_sessions for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users delete own sessions"
on public.focus_sessions for delete
using (user_id = auth.uid());

create policy "Users manage own Pomodoro cancellations"
on public.pomodoro_cancellations for all
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and public.is_project_member(project_id)
);

create policy "Users manage own settings"
on public.user_settings for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant usage
on type
  public.cancellation_reason,
  public.focus_sound,
  public.plan_tier,
  public.project_invite_status,
  public.project_kind,
  public.project_role,
  public.task_priority
to authenticated;

grant select, insert, update, delete
on
  public.focus_sessions,
  public.pomodoro_cancellations,
  public.profiles,
  public.project_invitations,
  public.project_members,
  public.projects,
  public.task_categories,
  public.task_comments,
  public.task_subtasks,
  public.task_tags,
  public.tasks,
  public.user_settings
to authenticated;

grant insert on public.marketing_signups to anon, authenticated;
grant execute on function public.accept_project_invite(text) to authenticated;

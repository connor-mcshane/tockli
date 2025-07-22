create type public.project_invite_status as enum ('pending', 'accepted', 'revoked');

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

create index project_invitations_project_id_idx
on public.project_invitations(project_id);

create unique index project_invitations_open_email_idx
on public.project_invitations(project_id, lower(invited_email))
where status = 'pending';

update public.project_members pm
set role = 'viewer'
from public.projects p
where p.id = pm.project_id
  and pm.user_id <> p.owner_id
  and pm.role <> 'viewer';

alter table public.project_members
alter column role set default 'viewer';

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

drop policy if exists "Editors manage categories" on public.task_categories;
create policy "Owners manage categories"
on public.task_categories for all
using (public.current_user_project_role(project_id) = 'owner')
with check (public.current_user_project_role(project_id) = 'owner');

drop policy if exists "Editors create tasks" on public.tasks;
create policy "Owners create tasks"
on public.tasks for insert
with check (
  created_by = auth.uid()
  and public.current_user_project_role(project_id) = 'owner'
);

drop policy if exists "Editors update tasks" on public.tasks;
create policy "Owners update tasks"
on public.tasks for update
using (public.current_user_project_role(project_id) = 'owner')
with check (public.current_user_project_role(project_id) = 'owner');

drop policy if exists "Editors delete tasks" on public.tasks;
create policy "Owners delete tasks"
on public.tasks for delete
using (public.current_user_project_role(project_id) = 'owner');

drop policy if exists "Editors manage tags" on public.task_tags;
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

drop policy if exists "Editors manage subtasks" on public.task_subtasks;
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

drop policy if exists "Members create own task comments" on public.task_comments;
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

drop policy if exists "Authors update own task comments" on public.task_comments;
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

drop policy if exists "Authors delete own task comments" on public.task_comments;
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

alter table public.project_invitations enable row level security;

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

grant usage on type public.project_invite_status to authenticated;

grant select, insert, update, delete
on public.project_invitations
to authenticated;

grant execute on function public.accept_project_invite(text) to authenticated;

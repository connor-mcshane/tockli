alter table public.project_members
alter column role set default 'editor';

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.project_invitations'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
      and pg_get_constraintdef(oid) ilike '%viewer%'
  loop
    execute format(
      'alter table public.project_invitations drop constraint %I',
      constraint_record.conname
    );
  end loop;
end $$;

alter table public.project_invitations
alter column role set default 'editor';

alter table public.project_invitations
add constraint project_invitations_role_access_check
check (role in ('editor', 'viewer'));

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

  if new.role = 'owner' then
    raise exception 'Only the project owner can be the project admin';
  end if;

  if new.role not in ('editor', 'viewer') then
    raise exception 'Project collaborators must be editors or read-only users';
  end if;

  return new;
end;
$$;

drop policy if exists "Owners manage categories" on public.task_categories;
drop policy if exists "Editors manage categories" on public.task_categories;
create policy "Editors manage categories"
on public.task_categories for all
using (public.current_user_project_role(project_id) in ('owner', 'editor'))
with check (public.current_user_project_role(project_id) in ('owner', 'editor'));

drop policy if exists "Owners create tasks" on public.tasks;
drop policy if exists "Editors create tasks" on public.tasks;
create policy "Editors create tasks"
on public.tasks for insert
with check (
  created_by = auth.uid()
  and public.current_user_project_role(project_id) in ('owner', 'editor')
);

drop policy if exists "Owners update tasks" on public.tasks;
drop policy if exists "Editors update tasks" on public.tasks;
create policy "Editors update tasks"
on public.tasks for update
using (public.current_user_project_role(project_id) in ('owner', 'editor'))
with check (public.current_user_project_role(project_id) in ('owner', 'editor'));

drop policy if exists "Owners delete tasks" on public.tasks;
drop policy if exists "Editors delete tasks" on public.tasks;
create policy "Editors delete tasks"
on public.tasks for delete
using (public.current_user_project_role(project_id) in ('owner', 'editor'));

drop policy if exists "Owners manage tags" on public.task_tags;
drop policy if exists "Editors manage tags" on public.task_tags;
create policy "Editors manage tags"
on public.task_tags for all
using (
  exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.current_user_project_role(t.project_id) in ('owner', 'editor')
  )
)
with check (
  exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.current_user_project_role(t.project_id) in ('owner', 'editor')
  )
);

drop policy if exists "Owners manage subtasks" on public.task_subtasks;
drop policy if exists "Editors manage subtasks" on public.task_subtasks;
create policy "Editors manage subtasks"
on public.task_subtasks for all
using (
  exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.current_user_project_role(t.project_id) in ('owner', 'editor')
  )
)
with check (
  exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.current_user_project_role(t.project_id) in ('owner', 'editor')
  )
);

drop policy if exists "Owners create task comments" on public.task_comments;
drop policy if exists "Editors create task comments" on public.task_comments;
create policy "Editors create task comments"
on public.task_comments for insert
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.current_user_project_role(t.project_id) in ('owner', 'editor')
  )
);

drop policy if exists "Owners update own task comments" on public.task_comments;
drop policy if exists "Editors update own task comments" on public.task_comments;
create policy "Editors update own task comments"
on public.task_comments for update
using (
  author_id = auth.uid()
  and exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.current_user_project_role(t.project_id) in ('owner', 'editor')
  )
)
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.current_user_project_role(t.project_id) in ('owner', 'editor')
  )
);

drop policy if exists "Owners delete own task comments" on public.task_comments;
drop policy if exists "Editors delete own task comments" on public.task_comments;
create policy "Editors delete own task comments"
on public.task_comments for delete
using (
  author_id = auth.uid()
  and exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.current_user_project_role(t.project_id) in ('owner', 'editor')
  )
);

drop policy if exists "Project owners manage invitations" on public.project_invitations;
create policy "Project owners manage invitations"
on public.project_invitations for all
using (public.current_user_project_role(project_id) = 'owner')
with check (
  public.current_user_project_role(project_id) = 'owner'
  and invited_by = auth.uid()
  and role in ('editor', 'viewer')
);

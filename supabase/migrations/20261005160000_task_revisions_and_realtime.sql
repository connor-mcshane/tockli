alter table public.tasks
add column revision bigint not null default 1;

create or replace function public.bump_task_revision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (to_jsonb(new) - 'revision') is distinct from (to_jsonb(old) - 'revision') then
    new.revision := old.revision + 1;
  else
    new.revision := old.revision;
  end if;

  return new;
end;
$$;

create trigger tasks_bump_revision
before update on public.tasks
for each row execute function public.bump_task_revision();

do $$
declare
  workspace_table text;
begin
  foreach workspace_table in array array[
    'projects',
    'project_members',
    'project_invitations',
    'task_categories',
    'tasks',
    'task_tags',
    'task_subtasks',
    'task_comments',
    'focus_sessions',
    'pomodoro_cancellations',
    'user_settings'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = workspace_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        workspace_table
      );
    end if;
  end loop;
end;
$$;

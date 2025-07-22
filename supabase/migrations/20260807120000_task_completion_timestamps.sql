alter table public.tasks
add column completed_at timestamptz;

update public.tasks t
set completed_at = t.updated_at
where t.status = 'done'
   or exists (
     select 1
     from public.projects p
     cross join lateral jsonb_array_elements(p.board_columns) board_column
     where p.id = t.project_id
       and board_column ->> 'id' = t.status
       and board_column ->> 'isDone' = 'true'
   );

create index tasks_project_completed_idx on public.tasks(project_id, completed_at desc)
where completed_at is not null;

create or replace function public.sync_task_completed_at()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  status_is_done boolean;
begin
  select coalesce(
    bool_or(
      board_column ->> 'id' = new.status
      and board_column ->> 'isDone' = 'true'
    ),
    false
  ) or new.status = 'done'
  into status_is_done
  from public.projects p
  left join lateral jsonb_array_elements(p.board_columns) board_column on true
  where p.id = new.project_id;

  if status_is_done then
    if new.completed_at is null then
      if tg_op = 'UPDATE' then
        new.completed_at := coalesce(old.completed_at, now());
      else
        new.completed_at := now();
      end if;
    end if;
  else
    new.completed_at := null;
  end if;

  return new;
end;
$$;

create trigger tasks_sync_completed_at
before insert or update of project_id, status, completed_at on public.tasks
for each row execute function public.sync_task_completed_at();

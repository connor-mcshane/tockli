alter table public.projects
add column board_columns jsonb not null default '[
  {"id": "todo", "title": "To do"},
  {"id": "active", "title": "Doing"},
  {"id": "done", "title": "Done", "isDone": true}
]'::jsonb;

alter table public.projects
add constraint projects_board_columns_valid check (
  jsonb_typeof(board_columns) = 'array'
  and jsonb_array_length(board_columns) > 0
);

alter table public.tasks
alter column status drop default;

alter table public.tasks
alter column status type text using status::text;

alter table public.tasks
alter column status set default 'todo';

alter table public.tasks
add constraint tasks_status_length check (length(status) between 1 and 120);

drop type public.task_status;

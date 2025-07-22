create type public.cancellation_reason as enum (
  'interrupted',
  'wrong_task',
  'need_break',
  'other'
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

create index pomodoro_cancellations_user_cancelled_idx
on public.pomodoro_cancellations(user_id, cancelled_at desc);

alter table public.pomodoro_cancellations enable row level security;

create policy "Users manage own Pomodoro cancellations"
on public.pomodoro_cancellations for all
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and public.is_project_member(project_id)
);

grant usage on type public.cancellation_reason to authenticated;

grant select, insert, update, delete
on public.pomodoro_cancellations
to authenticated;

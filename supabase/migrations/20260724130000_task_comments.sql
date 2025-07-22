create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index task_comments_task_created_idx
on public.task_comments(task_id, created_at);

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

alter table public.task_comments enable row level security;

create policy "Project members read collaborator profiles"
on public.profiles for select
using (public.shares_project_with(id));

create policy "Members read task comments"
on public.task_comments for select
using (
  exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.is_project_member(t.project_id)
  )
);

create policy "Members create own task comments"
on public.task_comments for insert
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.is_project_member(t.project_id)
  )
);

create policy "Authors update own task comments"
on public.task_comments for update
using (
  author_id = auth.uid()
  and exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.is_project_member(t.project_id)
  )
)
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.is_project_member(t.project_id)
  )
);

create policy "Authors delete own task comments"
on public.task_comments for delete
using (
  author_id = auth.uid()
  and exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.is_project_member(t.project_id)
  )
);

grant select, insert, update, delete
on public.task_comments
to authenticated;

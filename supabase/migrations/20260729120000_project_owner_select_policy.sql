drop policy if exists "Owners read owned projects" on public.projects;

create policy "Owners read owned projects"
on public.projects for select
using (owner_id = auth.uid());

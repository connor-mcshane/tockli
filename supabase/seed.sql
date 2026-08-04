insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'demo@tockli.test',
    crypt('tockli-demo', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Demo User"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'friend@tockli.test',
    crypt('tockli-demo', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Focus Friend"}'::jsonb,
    now(),
    now()
  )
on conflict (id) do update
set
  email = excluded.email,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into public.profiles (id, email, display_name, plan)
values
  (
    '00000000-0000-4000-8000-000000000001',
    'demo@tockli.test',
    'Demo User',
    'free'
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'friend@tockli.test',
    'Focus Friend',
    'free'
  )
on conflict (id) do update
set
  email = excluded.email,
  display_name = excluded.display_name,
  plan = excluded.plan,
  updated_at = now();

insert into public.projects (id, owner_id, name, description, kind, color)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'Deep Work',
    'A personal space for focused work.',
    'personal',
    '#ff005e'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    'Launch Crew',
    'A shared board for lightweight collaboration.',
    'team',
    '#25a565'
  )
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  color = excluded.color,
  updated_at = now();

insert into public.project_members (project_id, user_id, role)
values
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    'viewer'
  )
on conflict (project_id, user_id) do update
set role = excluded.role;

insert into public.task_categories (
  id,
  project_id,
  name,
  color,
  created_by
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'Writing',
    '#ff005e',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'Launch',
    '#25a565',
    '00000000-0000-4000-8000-000000000001'
  )
on conflict (id) do update
set
  name = excluded.name,
  color = excluded.color,
  updated_at = now();

insert into public.tasks (
  id,
  project_id,
  category_id,
  title,
  note,
  status,
  priority,
  estimate_minutes,
  spent_minutes,
  due_label,
  created_by
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'Draft product positioning notes',
    'Clarify the promise for casual focus users.',
    'todo',
    'high',
    50,
    10,
    'Today',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    'Plan the shared launch checklist',
    'One team project is included on the free plan.',
    'active',
    'high',
    50,
    20,
    'Today',
    '00000000-0000-4000-8000-000000000001'
  )
on conflict (id) do update
set
  category_id = excluded.category_id,
  title = excluded.title,
  note = excluded.note,
  status = excluded.status,
  priority = excluded.priority,
  estimate_minutes = excluded.estimate_minutes,
  spent_minutes = excluded.spent_minutes,
  due_label = excluded.due_label,
  updated_at = now();

insert into public.task_tags (task_id, label)
values
  ('20000000-0000-4000-8000-000000000001', 'strategy'),
  ('20000000-0000-4000-8000-000000000001', 'writing'),
  ('20000000-0000-4000-8000-000000000002', 'shared'),
  ('20000000-0000-4000-8000-000000000002', 'launch')
on conflict (task_id, label) do nothing;

insert into public.task_subtasks (
  id,
  task_id,
  title,
  is_done,
  sort_order
)
values
  (
    '50000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'Draft opening promise',
    true,
    1
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    'Trim value props',
    false,
    2
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    'Outline milestones',
    true,
    1
  )
on conflict (id) do update
set
  title = excluded.title,
  is_done = excluded.is_done,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.task_comments (
  id,
  task_id,
  author_id,
  body,
  created_at
)
values
  (
    '60000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    'I added the launch milestones. The invite copy can follow next.',
    now() - interval '35 minutes'
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    'Great, I will review the owner assignments this afternoon.',
    now() - interval '10 minutes'
  )
on conflict (id) do update
set
  body = excluded.body,
  created_at = excluded.created_at,
  updated_at = now();

insert into public.focus_sessions (
  id,
  user_id,
  project_id,
  task_id,
  minutes,
  note,
  completed_at
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    25,
    'Seeded local focus session.',
    now()
  )
on conflict (id) do update
set
  minutes = excluded.minutes,
  note = excluded.note,
  completed_at = excluded.completed_at;

insert into public.user_settings (
  user_id,
  focus_minutes,
  break_minutes,
  daily_pomodoro_goal,
  working_days,
  strict_mode,
  sound_enabled,
  focus_sound,
  focus_volume,
  show_next_up,
  theme_mode
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    25,
    5,
    6,
    array['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    false,
    true,
    'brown_noise',
    50,
    false,
    'light'
  )
on conflict (user_id) do update
set
  focus_minutes = excluded.focus_minutes,
  break_minutes = excluded.break_minutes,
  daily_pomodoro_goal = excluded.daily_pomodoro_goal,
  working_days = excluded.working_days,
  strict_mode = excluded.strict_mode,
  sound_enabled = excluded.sound_enabled,
  focus_sound = excluded.focus_sound,
  focus_volume = excluded.focus_volume,
  show_next_up = excluded.show_next_up,
  theme_mode = excluded.theme_mode,
  updated_at = now();

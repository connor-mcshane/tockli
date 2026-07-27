alter type public.focus_sound add value if not exists 'clock_tick';

alter table public.projects
drop column if exists daily_goal;

alter table public.user_settings
drop constraint if exists user_settings_focus_minutes_check;

alter table public.user_settings
add constraint user_settings_focus_minutes_check
check (focus_minutes between 5 and 90);

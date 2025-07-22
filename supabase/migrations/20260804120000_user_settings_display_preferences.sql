alter table public.user_settings
add column if not exists focus_volume integer not null default 50 check (focus_volume between 0 and 100),
add column if not exists theme_mode text not null default 'light' check (theme_mode in ('light', 'dark'));

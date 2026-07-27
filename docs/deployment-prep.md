# Tockli Deployment Prep

This app is ready to validate as a deployable beta once the hosted runtime
values are configured. The current build puts the public marketing funnel at
`/` and keeps the working app behind `/app`:

- `/` - SEO landing page with the product screenshot and CTA tracking
- `/landing` - legacy landing-page alias
- `/signup` - account signup with Supabase Auth and beta-intent capture
- `/login` - Supabase email/password and Google login
- `/auth/callback` - OAuth callback route
- `/app` - working local-first product app
- `/blog` - article index
- `/blog/focus-timer-with-a-task-board`
- `/blog/lightweight-sharing-for-small-teams`
- `/blog/analytics-that-help-you-focus`
- `/sitemap.xml` and `/robots.txt`

## Required Runtime Values

Set these in the hosting environment before a public launch:

```bash
NEXT_PUBLIC_SITE_URL=https://your-production-domain.example
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_ANALYTICS_ENDPOINT=
NEXT_PUBLIC_ANALYTICS_DEBUG=false
NEXT_PUBLIC_EXPERIMENT_SALT=tockli-2026-launch
NEXT_PUBLIC_SIGNUP_ENDPOINT=
```

`NEXT_PUBLIC_SIGNUP_ENDPOINT` is optional when Supabase is configured because
the signup page inserts into `public.marketing_signups`. Keep it for a separate
email or CRM collector later.

## Backend Checklist

- Apply `supabase/migrations/20260722210000_initial_schema.sql` to the hosted
  Supabase project, then apply later migrations in timestamp order.
- Enable email/password signups in Supabase Auth.
- Enable Google as a Supabase Auth provider before promoting the Google auth
  buttons.
- Set the Supabase production site URL to `https://tockli.netlify.app`.
- Add Supabase redirect URLs:
  `https://tockli.netlify.app/auth/callback` and
  `http://localhost:3000/auth/callback`.
- Confirm `public.marketing_signups` allows anonymous inserts and does not allow
  anonymous reads.
- Confirm `public.handle_new_auth_user()` creates `profiles` and
  `user_settings` rows for new Auth users.
- Keep `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  aligned between local, preview, and production environments.

## Netlify and GitHub Actions

The repo includes `netlify.toml` with Netlify's typical Next.js settings:

```toml
[build]
  command = "pnpm run build:netlify"
  publish = ".next"
```

Node is pinned to `22.16.0` in `.node-version` and `netlify.toml`. Keep that
pin unless `pnpm@11.9.0` is changed, because older bundled Corepack versions can
fail before dependency installation.

GitHub Actions deploys production on pushes to `main` using Netlify CLI.

Required GitHub repository secrets:

```bash
NETLIFY_AUTH_TOKEN=
NETLIFY_SITE_ID=
```

Required GitHub repository variables:

```bash
NEXT_PUBLIC_SITE_URL=https://your-netlify-site-or-domain.example
NEXT_PUBLIC_SUPABASE_URL=https://kebqumcvfncgrypoilcw.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_ANALYTICS_ENDPOINT=
NEXT_PUBLIC_ANALYTICS_DEBUG=false
NEXT_PUBLIC_EXPERIMENT_SALT=tockli-2026-launch
NEXT_PUBLIC_SIGNUP_ENDPOINT=
```

## Analytics Events

The client helper in `lib/analytics.ts` sends to:

- `window.dataLayer` for tag manager style integrations
- `window.plausible` when Plausible is present
- `NEXT_PUBLIC_ANALYTICS_ENDPOINT` with `sendBeacon` or `fetch`
- `window.tockliEvents` for local QA

Current event names:

- `page_view`
- `cta_clicked`
- `experiment_viewed`
- `signup_started`
- `signup_submitted`
- `signup_failed`
- `google_signup_clicked`
- `auth_signup_started`
- `auth_signup_succeeded`
- `auth_signup_failed`
- `login_started`
- `login_succeeded`
- `login_failed`
- `oauth_started`
- `password_reset_requested`
- `task_created`
- `task_status_changed`
- `board_column_created`
- `board_column_deleted`
- `focus_task_changed`
- `timer_started`
- `timer_paused`
- `timer_cancelled`
- `session_completed`
- `project_created`
- `settings_updated`

## A/B Test Framework

`lib/experiments.ts` assigns variants deterministically from a local anonymous
seed and `NEXT_PUBLIC_EXPERIMENT_SALT`. The first experiment is
`landing-hero-2026-07`, which changes the landing page hero message and CTA.

Before interpreting results, pick one primary metric:

- Signup conversion from `/` to `/signup`
- Email signup completion
- Open-app click-through

Keep one active landing experiment at a time until traffic is large enough to
support more.

## Pre-Deploy Validation

Run:

```bash
pnpm run build
pnpm run build:netlify
pnpm test
pnpm run lint
```

Run the local Supabase test only after Docker Desktop and Supabase are running:

```bash
pnpm run db:start
pnpm run db:reset
pnpm run test:db
```

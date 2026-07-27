# Tockli

Tockli is a casual personal productivity app for projects, tasks, focus
sessions, and lightweight sharing. The first build runs locally with browser
storage so the product can be shaped quickly, while the Supabase schema is
already drafted for the backend pass.

## Stack

- Next-style app running on `vinext`
- TypeScript
- Tailwind CSS
- Supabase client scaffold
- Supabase local config, migration, seed data, and DB tests
- Landing, signup, blog, SEO, analytics, and A/B test scaffolding

## Local Development

```bash
pnpm install
pnpm run dev
```

The local app runs at `http://localhost:3000/`.

## Launch Routes

- `/` - working Tockli app
- `/landing` - acquisition landing page
- `/signup` - early access signup
- `/blog` - launch article index
- `/sitemap.xml` and `/robots.txt` - SEO discovery routes

## Useful Commands

```bash
pnpm run build
pnpm run build:netlify
pnpm test
pnpm run test:db
pnpm run lint
```

## Supabase Setup

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Optional launch/runtime keys:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_ANALYTICS_ENDPOINT=
NEXT_PUBLIC_ANALYTICS_DEBUG=false
NEXT_PUBLIC_EXPERIMENT_SALT=tockli-2026-launch
NEXT_PUBLIC_SIGNUP_ENDPOINT=
```

For local development, install/start Docker Desktop first, then run:

```bash
pnpm run db:start
pnpm run db:reset
pnpm run db:status
pnpm run test:db
```

`pnpm run db:status` prints the local Supabase URL and anon key to copy into
`.env.local`. The local database uses `supabase/config.toml`, applies
`supabase/migrations/20260722210000_initial_schema.sql`, and loads
`supabase/seed.sql` on reset.

For a hosted Supabase project, apply the migration in `supabase/migrations/`.
The schema includes:

- profiles tied to Supabase Auth users
- personal and shared projects
- project members and roles
- tasks and tags
- focus sessions
- user settings
- row-level security policies
- a free-plan guard allowing one owner-created shared project
- anonymous insert-only marketing signups

Google sign-in should be enabled through Supabase Auth providers when auth is
wired into the app.

## Netlify Deployment

This repo includes `netlify.toml` and `.github/workflows/netlify.yml`.
Node is pinned to `22.16.0` in `.node-version` and `netlify.toml` so Netlify's
Corepack can verify `pnpm@11.9.0`.

GitHub Actions expects these repository secrets:

```bash
NETLIFY_AUTH_TOKEN=
NETLIFY_SITE_ID=
```

GitHub Actions expects these repository variables:

```bash
NEXT_PUBLIC_SITE_URL=https://your-netlify-site-or-domain.example
NEXT_PUBLIC_SUPABASE_URL=https://kebqumcvfncgrypoilcw.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_ANALYTICS_ENDPOINT=
NEXT_PUBLIC_ANALYTICS_DEBUG=false
NEXT_PUBLIC_EXPERIMENT_SALT=tockli-2026-launch
NEXT_PUBLIC_SIGNUP_ENDPOINT=
```

Production deploys run automatically on pushes to `main` after lint, the
Cloudflare/Sites render smoke test, and the Netlify `next build` all pass.

## Deployment Prep

See `docs/deployment-prep.md` for the deploy checklist, analytics event
dictionary, A/B test notes, and runtime env requirements.

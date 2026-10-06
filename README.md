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

The local site runs at `http://localhost:3000/`.

### Choose a Supabase environment

The app reads only `.env.local`. Two ignored configuration files make the
intended target explicit:

- `.env.localdb` - local Supabase stack, including the seeded demo accounts
- `.env.localsupabase` - hosted Supabase project

Switch the active configuration, then restart `pnpm run dev`:

```bash
pnpm run env:local
pnpm run env:hosted
```

The first command is the right choice for local product testing. After
`pnpm run db:start` and `pnpm run db:reset`, sign in with
`demo@tockli.test` and password `tockli-demo`.

The repository also includes a revision-safe `tockli` CLI and local stdio MCP
server. See [Local CLI, MCP, and cross-client workflow](docs/local-cli-mcp.md)
for password-stdin login, examples, MCP client configuration, the complete
local integration command, and security boundaries.

## Launch Routes

- `/` - acquisition landing page
- `/landing` - legacy landing-page alias
- `/signup` - account signup and beta-intent capture
- `/login` - Supabase email/password and Google login
- `/auth/callback` - Supabase OAuth callback route
- `/app` - working local-first Tockli app
- `/blog` - launch article index
- `/sitemap.xml` and `/robots.txt` - SEO discovery routes

## Useful Commands

```bash
pnpm run build
pnpm run build:netlify
pnpm test
pnpm run test:prod
pnpm run test:db
pnpm run test:tockli:local
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
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
NEXT_PUBLIC_EXPERIMENT_SALT=tockli-2026-launch
NEXT_PUBLIC_SIGNUP_ENDPOINT=
```

For local database development, install/start Docker Desktop first, then run:

```bash
pnpm run db:start
pnpm run db:reset
pnpm run db:status
pnpm run test:db
```

`pnpm run db:status` prints the local Supabase URL and anon key for
`.env.localdb`. Run `pnpm run env:local` afterwards to make it active. The
local database uses `supabase/config.toml`, applies
`supabase/migrations/20260722210000_initial_schema.sql`, and loads
`supabase/seed.sql` on reset.

For a deployment-shaped local check, run `pnpm run test:prod` after the local
Supabase stack is running. It builds the Netlify production output, starts it on
localhost, and smoke-tests the public pages, auth callback, protected app gate,
and sitemap.

For a hosted Supabase project, apply the migration in `supabase/migrations/`.
The schema includes:

- profiles tied to Supabase Auth users
- personal and shared projects
- project members and roles
- tasks and tags
- focus sessions
- user settings
- row-level security policies
- auth-user profile and settings bootstrap trigger
- a free-plan guard allowing one owner-created shared project
- anonymous insert-only marketing signups

For hosted auth, enable email/password signups and add Google in Supabase Auth
providers. Add these redirect URLs in Supabase Auth URL configuration:

```bash
https://tockli.netlify.app/auth/callback
http://localhost:3000/auth/callback
```

Set the Supabase site URL to `https://tockli.netlify.app` for production.

## Netlify Deployment

This repo includes `netlify.toml` and `.github/workflows/netlify.yml`.
Node is pinned to `22.16.0` in `.node-version` and `netlify.toml` so Netlify's
Corepack can verify `pnpm@11.9.0`.

GitHub Actions expects these repository secrets:

```bash
NETLIFY_AUTH_TOKEN=
NETLIFY_SITE_ID=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
```

GitHub Actions expects these repository variables:

```bash
NEXT_PUBLIC_SITE_URL=https://your-netlify-site-or-domain.example
NEXT_PUBLIC_SUPABASE_URL=https://kebqumcvfncgrypoilcw.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
INVITE_FROM_EMAIL=
NEXT_PUBLIC_ANALYTICS_ENDPOINT=
NEXT_PUBLIC_ANALYTICS_DEBUG=false
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
NEXT_PUBLIC_EXPERIMENT_SALT=tockli-2026-launch
NEXT_PUBLIC_SIGNUP_ENDPOINT=
```

The `NEXT_PUBLIC_*` values are browser-visible by design, so keep them as
GitHub variables and let the workflow sync them into Netlify as non-secret
production environment variables. Keep `SUPABASE_SERVICE_ROLE_KEY` and
`RESEND_API_KEY` as secrets.

The PostHog project key is intentionally public. Create the project in PostHog's
EU region and copy its project API key into `NEXT_PUBLIC_POSTHOG_KEY`. Analytics
is disabled until a visitor explicitly opts in through the in-app preferences.

Netlify production also needs the server-only `SUPABASE_SERVICE_ROLE_KEY` for
project invite creation and delivery. Add `RESEND_API_KEY` and
`INVITE_FROM_EMAIL` if you want branded project invite emails to existing users;
without those, Tockli uses Supabase's built-in invite email template.

Production deploys run automatically on pushes to `main` after lint, the
Cloudflare/Sites render smoke test, and the Netlify `next build` all pass.

## Deployment Prep

See `docs/deployment-prep.md` for the deploy checklist, analytics event
dictionary, A/B test notes, and runtime env requirements. See
`docs/auth-setup.md` for the exact Supabase and Google SSO settings.

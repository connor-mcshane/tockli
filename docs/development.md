# Development

## Requirements

- Node `22.16.0` (pinned in `.node-version`)
- pnpm `11.9.0`
- Docker, for the local Supabase database

## Run the app

```bash
pnpm install
pnpm run dev
```

The site runs at `http://localhost:3000/`.

## Environment

The app reads `.env.local` only. `.env.example` lists every variable. Keep real keys out of git.

Two ignored files hold the local and hosted targets:

- `.env.localdb`: the local Supabase stack, including the seeded demo account
- `.env.localsupabase`: your hosted Supabase project

Switch between them, then restart `pnpm run dev`:

```bash
pnpm run env:local
pnpm run env:hosted
```

## Local database

```bash
pnpm run db:start
pnpm run db:reset
pnpm run db:status
```

`pnpm run db:reset` replaces this repository's local database only. It applies `supabase/migrations/` and loads `supabase/seed.sql`, which creates `demo@tockli.test` with password `tockli-demo`.

Copy the local URL and publishable key from `pnpm run db:status` into `.env.localdb`, then run `pnpm run env:local`.

## Hosted Supabase

1. Put your project's URL and publishable key in `.env.localsupabase`.
2. Apply `supabase/migrations/` in timestamp order.
3. Enable email/password and Google in Supabase Auth.
4. Add the redirect URLs for your site and `http://localhost:3000/auth/callback`.

[docs/auth-setup.md](auth-setup.md) has the full Supabase and Google OAuth settings.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm run build` | Builds with `vinext` |
| `pnpm run build:netlify` | Builds the Netlify (`next build`) output |
| `pnpm test` | Builds and runs the render, UI, focus score, and analytics tests |
| `pnpm run test:prod` | Serves the Netlify build locally and smoke-tests public pages, the auth callback, the app gate, and the sitemap |
| `pnpm run test:db` | Runs the local Supabase tests |
| `pnpm run test:tockli:local` | Runs the full local CLI, MCP, sync, and database suite |
| `pnpm run lint` | Runs ESLint |

## Local CLI and MCP

The repo includes a local `tockli` CLI and stdio MCP server. They talk to the local Supabase stack as a signed-in user. See [docs/local-cli-mcp.md](local-cli-mcp.md).

## Deployment

Pushes to `main` run lint, the render smoke test, and the Netlify build, then deploy to Netlify if those pass. [docs/deployment-prep.md](deployment-prep.md) has the full checklist, analytics events, and A/B test notes.

Put browser-visible `NEXT_PUBLIC_*` values in GitHub Actions variables. Keep `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`, `SUPABASE_SERVICE_ROLE_KEY`, and `RESEND_API_KEY` in GitHub Actions secrets.

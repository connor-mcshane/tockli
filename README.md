# FlowTimer

FlowTimer is a casual personal productivity app for projects, tasks, focus
sessions, and lightweight sharing. The first build runs locally with browser
storage so the product can be shaped quickly, while the Supabase schema is
already drafted for the backend pass.

## Stack

- Next-style app running on `vinext`
- TypeScript
- Tailwind CSS
- Supabase client scaffold
- Supabase SQL schema in `supabase/schema.sql`

## Local Development

```bash
pnpm install
pnpm run dev
```

The local app runs at `http://localhost:3000/`.

## Useful Commands

```bash
pnpm run build
pnpm test
pnpm run lint
```

## Supabase Setup

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Then apply `supabase/schema.sql` in a Supabase project. The schema includes:

- profiles tied to Supabase Auth users
- personal and shared projects
- project members and roles
- tasks and tags
- focus sessions
- user settings
- row-level security policies
- a free-plan guard allowing one owner-created shared project

Google sign-in should be enabled through Supabase Auth providers when auth is
wired into the app.

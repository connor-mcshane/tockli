# Local CLI, MCP, and cross-client workflow

This workflow is intentionally local-first. It uses the repository's Supabase
stack, the public local key, and a signed-in user's row-level-security context.
It does not deploy or modify a hosted Supabase project.

## 1. Start and reset local Supabase

Docker Desktop must be running. Install dependencies, start the stack, and
reset it so every migration and `supabase/seed.sql` is applied:

```bash
pnpm install
pnpm run db:start
pnpm run db:reset
pnpm run db:status
```

`db:reset` replaces data in this repository's local database. It seeds
`demo@tockli.test` with the demo password shown below, two projects, and sample
tasks. It does not touch hosted data.

## 2. Activate local environment values

`pnpm exec supabase status -o env` prints the current local URL, database URL,
and public keys. Put the browser values in an ignored `.env.localdb` file:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY or ANON_KEY from local status>
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Activate that file for the browser and export the equivalent CLI/MCP values in
the shell where commands will run:

```bash
pnpm run env:local
export TOCKLI_SUPABASE_URL=http://127.0.0.1:54321
export TOCKLI_SUPABASE_KEY='<local PUBLISHABLE_KEY or ANON_KEY>'
export SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

The CLI also accepts the `NEXT_PUBLIC_*` names as fallbacks. Restart
`pnpm run dev` after changing `.env.local`.

## 3. Sign in with password stdin

Keep passwords out of process arguments and shell history. This prompt stores
the value only in a temporary shell variable and pipes one line to the CLI:

```bash
read -s TOCKLI_PASSWORD
printf '\n'
printf '%s\n' "$TOCKLI_PASSWORD" | node cli/tockli.mjs auth login \
  --email demo@tockli.test --password-stdin
unset TOCKLI_PASSWORD
node cli/tockli.mjs auth status
```

For the reset local seed, enter `tockli-demo` at the silent prompt. The CLI
persists only the returned session, with user-only file permissions where the
platform supports them. Set `TOCKLI_CONFIG_DIR` before login only if a separate
local profile is useful; the MCP process must receive the same value.

## 4. Exercise the CLI

The seeded personal project ID is safe to use in local examples:

```bash
node cli/tockli.mjs projects list
node cli/tockli.mjs tasks list \
  --project 10000000-0000-4000-8000-000000000001 --json
node cli/tockli.mjs tasks create \
  --project 10000000-0000-4000-8000-000000000001 \
  --title 'Created from the CLI' --estimate-minutes 25 --json
```

Creation returns a task ID and `revision`. Supply both explicitly for later
writes; a stale revision exits with code 3 and `TOCKLI_CONFLICT` instead of
overwriting a newer browser or MCP change:

```bash
TASK_ID='<task UUID returned by create>'
REVISION='<revision returned by the preceding read or write>'
node cli/tockli.mjs tasks update "$TASK_ID" --revision "$REVISION" \
  --note 'Updated from the CLI' --json
REVISION='<revision returned by update>'
node cli/tockli.mjs tasks complete "$TASK_ID" --revision "$REVISION" --json
node cli/tockli.mjs focus log \
  --project 10000000-0000-4000-8000-000000000001 \
  --task "$TASK_ID" --minutes 25 --note 'Local focus block'
```

An authenticated browser tab refetches after Realtime invalidation, reconnect,
focus, or returning to visibility. Realtime events trigger authoritative
refetches; they are not merged directly into browser state.

## 5. Configure a local MCP client

Sign in with the CLI first. Then configure the client to launch the repository's
stdio server with an absolute path and the same local public configuration:

```json
{
  "mcpServers": {
    "tockli": {
      "command": "node",
      "args": [
        "/absolute/path/to/FlowTimer-mcp-cli/mcp/server.mjs"
      ],
      "env": {
        "TOCKLI_SUPABASE_URL": "http://127.0.0.1:54321",
        "TOCKLI_SUPABASE_KEY": "<local PUBLISHABLE_KEY or ANON_KEY>"
      }
    }
  }
}
```

If CLI login used `TOCKLI_CONFIG_DIR`, add that exact directory to the MCP
environment. The server restores the CLI session and intentionally exposes no
login or password tool. Its stdout is reserved for MCP protocol traffic.

## 6. Run tests

Focused unit/scheduling and tool-surface commands are available while
developing:

```bash
pnpm run test:tockli
pnpm run test:tockli:sync
pnpm run test:tockli:tools
pnpm run test:tockli:realtime
```

After `db:start` and `db:reset`, one command runs the unit, database, shared
API, CLI child-process, MCP protocol, seeded-login, and Realtime suites:

```bash
pnpm run test:tockli:local
```

The local integration tests reject non-loopback API and database endpoints,
use temporary CLI configuration directories, bound network waits, and clean up
their task/user/project fixtures. The regular product checks remain:

```bash
pnpm test
pnpm run lint
pnpm run test:prod
```

## Security boundaries and current non-goals

- CLI and MCP accept only a public publishable/anon key plus the signed-in
  user's session. Never provide `SUPABASE_SERVICE_ROLE_KEY` or an `sb_secret_`
  key.
- Supabase row-level security remains authoritative for every CLI/MCP request.
- Passwords belong on stdin only; do not put them in arguments, MCP settings,
  reports, or committed files.
- Keep `.env.local*` and any custom session directory out of version control.
- This milestone does not host a remote MCP endpoint, add MCP OAuth, deploy
  production schema/app changes, synchronize timer ticks, build an offline
  mutation outbox or field-level merge, or expose project/task deletion,
  invites, memberships, comments, tags, and subtasks through CLI/MCP.

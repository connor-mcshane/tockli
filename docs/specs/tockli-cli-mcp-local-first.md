# Tockli CLI, MCP, and Cross-Client Sync Specification

Status: implementation-ready  
Date: 2026-10-05  
Target: local-first developer release

## Purpose

Add a supported command-line interface and a local stdio MCP server to Tockli
without creating a second business-logic stack. Both surfaces must operate as
the signed-in user against Supabase, respect existing row-level security, and
coexist safely with an open Tockli browser tab.

The first release is deliberately local-first: it must be exercised against
the repository's local Supabase stack before it is considered ready for a
hosted environment. No production deployment, remote MCP hosting, or hosted
credential migration is part of this milestone.

## Outcomes

1. A shared Node-compatible Tockli API module owns authentication restoration,
   project/task queries, conflict-safe task mutations, and focus-session writes.
2. A `tockli` CLI exposes those operations to people and scripts.
3. A local stdio MCP server exposes the same operations to MCP clients.
4. Task writes use optimistic concurrency so a stale CLI, MCP, or browser
   update cannot silently overwrite a newer task revision.
5. The browser notices remote changes through foreground/reconnect refresh and
   Supabase Realtime invalidation.
6. Automated unit, database, CLI-contract, MCP-protocol, and Realtime
   integration tests run against local Supabase.

## Non-goals

- Hosting a remote, multi-tenant MCP endpoint.
- Adding OAuth specifically for a hosted MCP endpoint.
- Synchronising a running timer tick-by-tick between devices.
- Implementing a general offline mutation outbox or field-level conflict merge.
- Exposing project deletion, task deletion, invitations, membership changes,
  comments, tags, or subtasks through the first CLI/MCP release.
- Deploying schema or application changes to hosted Supabase or Netlify.
- Adding an LLM call to Tockli. The MCP server exposes tools only.

## Architecture

```text
CLI --------------------+
                        |
local stdio MCP --------+--> shared Tockli API --> Supabase Auth/PostgREST
                        |                              |
browser app ------------+------------------------------+
                                                       |
                              Realtime invalidation <--+
```

Supabase is authoritative. Browser local storage remains a startup/offline
cache, not a source allowed to overwrite a task whose revision has advanced.

The shared API must be runtime-neutral Node ESM (`.mjs`) and must not import
React, Next.js, browser globals, or the Supabase service-role key.

## Authentication and credential handling

- CLI login uses Supabase email/password authentication.
- The session is stored under `TOCKLI_CONFIG_DIR` when set; otherwise use the
  platform-appropriate user configuration directory in a `tockli` folder.
- The session file must be created with user-only permissions (`0600`) on
  platforms that support POSIX modes.
- Tests must always set `TOCKLI_CONFIG_DIR` to a temporary directory.
- The shared API restores the session, refreshes it through Supabase when
  necessary, and persists refreshed tokens.
- CLI and MCP processes use only the public/publishable Supabase key plus the
  signed-in user's session. They must never accept or read
  `SUPABASE_SERVICE_ROLE_KEY`.
- Configuration uses `TOCKLI_SUPABASE_URL` and `TOCKLI_SUPABASE_KEY`, falling
  back to `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Login passwords must never be written to disk, stdout, stderr, or reports.

## Shared API contract

The shared API exposes these operations:

- `loginWithPassword({ email, password })`
- `restoreSession()`
- `getCurrentUser()`
- `logout()`
- `listProjects()`
- `listTasks({ projectId?, status?, limit? })`
- `createTask({ projectId, title, note?, status?, priority?, estimateMinutes?, dueLabel? })`
- `updateTask({ taskId, expectedRevision, patch })`
- `completeTask({ taskId, expectedRevision })`
- `logFocusSession({ projectId, taskId?, minutes, note? })`

All returned task objects include `revision`. Update and completion require an
explicit expected revision. A stale revision produces a structured
`TOCKLI_CONFLICT` error containing the current revision when the row remains
visible. Missing or inaccessible rows produce `TOCKLI_NOT_FOUND` without
revealing which case applies.

Input validation happens before network calls. Database constraints and RLS
remain the final authority.

## Database and concurrency

- Add `tasks.revision bigint not null default 1`.
- A database trigger increments the revision on every actual task update.
- CLI/MCP/browser updates constrain both task ID and expected revision.
- A zero-row update must be distinguished as conflict versus not-found by a
  follow-up RLS-scoped read.
- Existing inserts and seed data begin at revision 1.
- `supabase/schema.sql` must remain aligned with migration history.
- Mutable application tables needed for workspace invalidation must be added
  idempotently to the `supabase_realtime` publication.

This milestone does not attempt automatic field-level merging. On conflict,
the current authoritative task is reloaded and the caller receives a clear
conflict error.

## CLI contract

Entry point: `cli/tockli.mjs`.

Commands:

```text
tockli auth login --email <email> --password-stdin
tockli auth status
tockli auth logout
tockli projects list
tockli tasks list [--project <uuid>] [--status <column>] [--limit <n>]
tockli tasks create --project <uuid> --title <text> [options]
tockli tasks update <uuid> --revision <n> [patch options]
tockli tasks complete <uuid> --revision <n>
tockli focus log --project <uuid> [--task <uuid>] --minutes <n> [--note <text>]
```

Login accepts the password only from stdin so it does not appear in shell
history or process arguments.

Every command supports `--json`. JSON mode writes exactly one JSON document to
stdout:

```json
{"ok":true,"data":{}}
```

or:

```json
{"ok":false,"error":{"code":"TOCKLI_CODE","message":"Human-readable message"}}
```

Diagnostics never contaminate JSON stdout. Success exits 0, validation/auth
failure exits 2, conflict exits 3, and unexpected failure exits 1. Human mode
may use concise tables or lines but must never print tokens.

## MCP contract

Entry point: `mcp/server.mjs`, stdio transport only.

Tools:

- `get_current_user`
- `list_projects`
- `list_tasks`
- `create_task`
- `update_task`
- `complete_task`
- `log_focus_session`

Tool schemas require explicit UUIDs for mutations and explicit revision values
for updates/completion. Tool results include concise human-readable content and
machine-readable structured data where supported by the SDK. Errors are
structured and must not expose session tokens, environment values, SQL, or
records hidden by RLS.

The MCP process writes protocol traffic only to stdout. Logs and diagnostics
go to stderr. Authentication commands are intentionally absent; users sign in
with the CLI first and the MCP server restores that session.

## Browser synchronisation

- The browser task model and remote mapping include `revision`.
- Browser task updates use the expected revision. A conflict shows a concise
  notice and reloads authoritative remote state.
- The authenticated app refreshes remote state when the document becomes
  visible, the window gains focus, or the browser reconnects.
- The app subscribes to relevant Supabase Postgres Changes only while an
  authenticated workspace is mounted.
- Realtime events are invalidation signals; they trigger a debounced remote
  refetch rather than being manually merged into nested React state.
- A remote refresh must not run during an in-flight remote write or while
  dirty project/category/task sets are pending. It is queued and runs after
  the workspace becomes clean.
- A refetch preserves an actively running timer and its selected focus task.
- Realtime cleanup removes channels/listeners on logout and unmount.
- Reconnect/foreground refetch remains mandatory because Realtime delivery is
  not treated as durable.

## Automated test requirements

### Unit tests

- Input validation and error mapping.
- Credential path selection, `0600` persistence, restore, refresh persistence,
  and logout deletion using temporary directories.
- Revision-conflict classification.
- Sync invalidation debouncing/queue behaviour as isolated helpers.

### Local database tests

- Revision begins at 1 and increments on update.
- An update constrained by a stale revision affects zero rows.
- Owner/editor writes and viewer/outsider denial remain enforced by RLS.
- Required tables are present in the Realtime publication.

### CLI contract tests

- Execute the real CLI as a child process.
- Verify login via password stdin, status, project/task listing, task creation,
  update, completion, focus logging, logout, exit codes, and exact JSON envelope.
- Verify stale revision returns exit 3 and `TOCKLI_CONFLICT`.
- Verify stdout contains no diagnostic noise and credentials are not printed.

### MCP protocol tests

- Launch the real stdio server through the SDK client transport.
- Verify advertised tools and input schemas.
- Call list/create/update/complete/focus tools against local Supabase.
- Verify stale revisions and invalid input produce safe structured errors.
- Verify no non-protocol stdout output.

### Realtime integration test

- Authenticate a local seeded user.
- Subscribe to task changes.
- Create or update through the shared API.
- Assert the event arrives and a subsequent targeted read returns the new
  revision/state.
- Use bounded timeouts and always clean up the channel and test records.

Tests must fail with an actionable message when local Supabase is unavailable.
They must use seeded test users or uniquely identified records and leave the
local database reusable.

## Local commands and documentation

Package scripts must provide focused commands for unit/tool tests and a single
local integration command. Documentation must explain:

1. Start/reset local Supabase.
2. Activate local environment variables.
3. Log in as `demo@tockli.test` using password stdin.
4. Exercise CLI JSON and human output.
5. Configure an MCP client with the stdio server command and environment.
6. Run the complete local integration suite.

## Acceptance criteria

- All new automated tests pass against a reset local Supabase stack.
- Existing `pnpm test`, lint, and build checks pass.
- A CLI-created task is visible through the shared API and emits a Realtime
  invalidation event.
- MCP can create and complete a task through the same shared API.
- A stale task update is rejected rather than silently overwriting data.
- Viewer and outsider permissions remain enforced.
- No service-role secret is used by CLI/MCP code.
- No production infrastructure or data is modified.


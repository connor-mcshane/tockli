# Tockli CLI, MCP, and Cross-Client Sync Implementation Plan

Spec: `docs/specs/tockli-cli-mcp-local-first.md`

## Context

Tockli already has a normalized Supabase schema and RLS, but browser loading,
mapping, and persistence are embedded in `app/app/page.tsx`. This plan adds a
Node-compatible shared API, CLI, and local MCP server while making task writes
conflict-safe and browser refreshes aware of external changes. Work must be
verified against local Supabase before any hosted use.

## Global Constraints

- Supabase is authoritative; local storage is a cache and may not silently
  overwrite a task whose revision advanced remotely.
- CLI/MCP use only a publishable/anon key plus the signed-in user's session.
  They must never read or accept `SUPABASE_SERVICE_ROLE_KEY`.
- Login passwords enter through stdin and must never be persisted or printed.
- Task updates and completion require an explicit expected revision and stale
  writes return `TOCKLI_CONFLICT`.
- MCP is local stdio only; stdout is protocol-only.
- New runtime modules are Node ESM `.mjs` and must not import React, Next.js,
  or browser globals.
- All implementation tasks use test-first development and record RED/GREEN
  evidence in their report.
- Local Supabase tests must use temporary credentials/config paths, bounded
  timeouts, and clean up records/channels.
- Keep `supabase/schema.sql` aligned with migrations.
- Do not deploy, push, publish, or modify hosted Supabase/Netlify resources.

## Task 1: Add task revisions and Realtime publication coverage

Implement the database concurrency foundation.

Files:

- Add a timestamped migration under `supabase/migrations/`.
- Update `supabase/schema.sql`.
- Extend `tests/local-supabase.test.mjs` or add a focused database test.

Requirements:

1. Add `public.tasks.revision bigint not null default 1`.
2. Add a trigger that increments revision on every actual task update. An
   insert remains revision 1. Callers must not be able to force a chosen next
   revision.
3. Demonstrate an optimistic update constrained by ID and expected revision:
   the first update succeeds and increments the revision; repeating the stale
   expected revision updates zero rows.
4. Verify owner and editor can perform valid updates while viewer and outsider
   cannot bypass RLS.
5. Idempotently add the mutable workspace tables named in the spec to the
   `supabase_realtime` publication and test publication membership.
6. Preserve all existing schema behavior, including task completion timestamps.
7. Run the focused database test and the existing local database suite.

Commit the task and write the required implementation report.

## Task 2: Build the shared authenticated Tockli API

Create the Node-compatible API used by both CLI and MCP.

Depends on Task 1's `tasks.revision` contract.

Files:

- `lib/tockli-api.mjs`
- `lib/tockli-auth.mjs`
- Focused unit tests under `tests/`.
- Focused local integration tests under `tests/`.
- Minimal package-script additions needed to run the focused tests.

Requirements:

1. Implement every shared API operation and error contract in the spec.
2. Accept injectable Supabase clients or equivalent narrow dependencies so
   validation, error mapping, and conflict classification are unit-testable.
3. Use explicit selected columns and bounded task limits; default task limit is
   100 and maximum is 500.
4. `createTask` validates membership through the operation/RLS and defaults to
   the project's first active board column when status is omitted.
5. `updateTask` accepts only title, note, status, priority, estimateMinutes,
   spentMinutes, dueLabel, and categoryId. Reject empty patches.
6. `completeTask` resolves the project's configured done column, falling back
   to `done`, then performs the same revision-constrained update.
7. On a zero-row revision update, make an RLS-scoped follow-up read and throw
   `TOCKLI_CONFLICT` with current revision or `TOCKLI_NOT_FOUND`.
8. Implement credential/config resolution, password login, secure session-file
   persistence, restore/refresh persistence, current-user lookup, and logout.
9. Never import or inspect the service-role environment variable.
10. Unit tests cover validation, mapping, error codes, paths, file mode, token
    refresh persistence, and logout. Local integration tests cover the real
    local API as owner/editor/viewer and focus-session creation.
11. Run focused unit/integration tests and the existing non-database suite.

Commit the task and write the required implementation report.

## Task 3: Implement and contract-test the CLI

Build the human/script interface on Task 2's shared API.

Files:

- `cli/tockli.mjs` plus small focused CLI modules if needed.
- CLI unit/contract tests under `tests/`.
- `package.json` script/bin changes required for local execution.
- Any lockfile changes caused by declared dependencies.

Requirements:

1. Implement exactly the commands and options in the spec.
2. `auth login` reads one password line from stdin via `--password-stdin`; no
   password command-line option is allowed.
3. Every command supports `--json` and emits exactly one success or error
   envelope to stdout in JSON mode.
4. Implement exit codes 0 success, 2 validation/auth, 3 conflict, and 1
   unexpected failure.
5. Human output is concise and never prints access/refresh tokens.
6. IDs used for mutations are explicit UUIDs; do not add fuzzy name matching.
7. Unit tests cover parsing, envelopes, exit-code mapping, and secret redaction.
8. Local child-process contract tests exercise login, status, projects, task
   create/list/update/complete, focus logging, conflict, and logout against the
   reset local Supabase stack using a temporary `TOCKLI_CONFIG_DIR`.
9. Run the focused CLI tests, shared API tests, and lint.

Commit the task and write the required implementation report.

## Task 4: Implement and protocol-test the local MCP server

Expose Task 2's shared API through MCP without duplicating business rules.

Files:

- `mcp/server.mjs` plus small focused schema/adapter modules if needed.
- MCP protocol tests under `tests/`.
- `package.json` and lockfile dependency/script changes.

Requirements:

1. Use the current official `@modelcontextprotocol/sdk` package and stdio
   transport.
2. Implement exactly the seven tools and schemas in the spec.
3. Restore the CLI-created session; do not add an MCP login/password tool.
4. Delegate all operations to the shared API. Do not duplicate Supabase query
   or mutation logic in MCP handlers.
5. Return concise text plus structured data supported by the SDK. Map expected
   validation/auth/conflict/not-found errors into safe tool errors.
6. Never write logs or diagnostics to stdout.
7. Protocol tests launch the real server with the SDK stdio client, list tools,
   call list/create/update/complete/focus tools against local Supabase, verify
   stale revision handling, and verify stdout remains valid protocol traffic.
8. Run focused MCP tests, CLI/shared API tests, and lint.

Commit the task and write the required implementation report.

## Task 5: Integrate browser invalidation sync and the complete local harness

Make the existing browser safely observe CLI/MCP changes and finish the local
developer workflow.

Files:

- `app/app/page.tsx`
- `lib/workspace-sync.mjs` if needed for isolated scheduling logic.
- Unit and local Realtime integration tests under `tests/`.
- `package.json`, `README.md`, and focused documentation under `docs/`.

Requirements:

1. Add revision to the browser task model, remote row mapping, inserts, and
   remote task selects.
2. Make browser updates revision-constrained. A zero-row stale update shows a
   concise conflict notice, discards the stale dirty task, and reloads the
   authoritative workspace without losing an active timer.
3. Add authenticated foreground, visibility, and online refetch triggers.
4. Add Supabase Postgres Changes subscriptions for the mutable workspace tables
   in the spec. Treat events as debounced invalidations, not manual state merges.
5. Queue invalidation while remote sync is in flight or dirty sets are nonempty;
   execute it when clean. Clean up browser listeners/channels on logout/unmount.
6. Extract scheduling/queue logic into a testable helper if direct component
   testing would otherwise require a browser.
7. Add a bounded local Realtime integration test that authenticates a seeded
   user, subscribes, mutates through the shared API, observes an event, refetches
   the authoritative task, and cleans up.
8. Add scripts for focused tool tests and one complete local integration run.
9. Document local Supabase setup, password-stdin login, CLI examples, MCP client
   configuration, test commands, security boundaries, and current non-goals.
10. Run the complete local integration command, `pnpm test`, lint, and the
    production-shaped build. Record any environment-only limitation precisely.

Commit the task and write the required implementation report.


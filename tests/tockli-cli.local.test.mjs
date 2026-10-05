import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import postgres from "postgres";

import {
  assertLocalIntegrationEndpoints,
  createBoundedFetch,
  withTimeout,
} from "./local-integration-safety.mjs";

const API_URL = process.env.TOCKLI_SUPABASE_URL ?? "http://127.0.0.1:54321";
const PUBLIC_KEY =
  process.env.TOCKLI_SUPABASE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYXNlLWRlbW8iLCJyb2xlIjoiYW5vbiIsImV4cCI6MTk4MzgxMjk5Nn0.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DATABASE_URL =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const USER_ID = "00000000-0000-4000-8000-00000000c101";
const PROJECT_ID = "10000000-0000-4000-8000-00000000c101";
const EMAIL = "cli-contract@tockli.test";
const PASSWORD = "tockli-demo";
const REQUEST_TIMEOUT_MS = 5_000;
const PROCESS_TIMEOUT_MS = 10_000;
const TEST_TIMEOUT_MS = 45_000;

assertLocalIntegrationEndpoints({ apiUrl: API_URL, databaseUrl: DATABASE_URL });

const boundedFetch = createBoundedFetch(globalThis.fetch, REQUEST_TIMEOUT_MS);
const sql = postgres(DATABASE_URL, {
  connect_timeout: 3,
  connection: {
    lock_timeout: REQUEST_TIMEOUT_MS,
    statement_timeout: REQUEST_TIMEOUT_MS,
  },
  idle_timeout: 1,
  max: 1,
});

async function requireLocalStack() {
  try {
    await withTimeout(sql`select 1`, REQUEST_TIMEOUT_MS, "Local database health check");
    const response = await boundedFetch(`${API_URL}/auth/v1/health`);
    assert.equal(response.ok, true);
  } catch (error) {
    throw new Error(
      "Local Supabase is unavailable. Run `pnpm run db:start` and `pnpm run db:reset` before `pnpm run test:tockli:cli:integration`.",
      { cause: error },
    );
  }
}

async function prepareFixture() {
  await withTimeout(
    sql.begin(async (tx) => {
      await tx`delete from auth.users where id = ${USER_ID}::uuid`;
      await tx`
        insert into auth.users (
          id,
          instance_id,
          aud,
          role,
          email,
          encrypted_password,
          email_confirmed_at,
          confirmation_token,
          recovery_token,
          email_change_token_new,
          email_change,
          raw_app_meta_data,
          raw_user_meta_data,
          created_at,
          updated_at
        ) values (
          ${USER_ID}::uuid,
          '00000000-0000-0000-0000-000000000000'::uuid,
          'authenticated',
          'authenticated',
          ${EMAIL},
          crypt(${PASSWORD}, gen_salt('bf')),
          now(),
          '',
          '',
          '',
          '',
          '{"provider":"email","providers":["email"]}'::jsonb,
          '{"display_name":"CLI Contract"}'::jsonb,
          now(),
          now()
        )
      `;
      await tx`
        insert into public.projects (id, owner_id, name, kind)
        values (${PROJECT_ID}::uuid, ${USER_ID}::uuid, 'CLI Contract', 'personal')
      `;
    }),
    REQUEST_TIMEOUT_MS,
    "CLI fixture setup",
  );
}

function runTockli(args, { configDir, input = "" } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["cli/tockli.mjs", ...args], {
      cwd: path.resolve(import.meta.dirname, ".."),
      env: {
        ...process.env,
        TOCKLI_CONFIG_DIR: configDir,
        TOCKLI_SUPABASE_KEY: PUBLIC_KEY,
        TOCKLI_SUPABASE_URL: API_URL,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timeoutId = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`CLI process timed out: ${args.join(" ")}`));
    }, PROCESS_TIMEOUT_MS);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeoutId);
      resolve({ code, signal, stderr, stdout });
    });
    child.stdin.end(input);
  });
}

function assertJsonResult(result, { exitCode = 0, ok = true } = {}) {
  assert.equal(result.code, exitCode, result.stderr);
  assert.equal(result.signal, null);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout.split("\n").filter(Boolean).length, 1);
  const envelope = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(envelope), ok ? ["ok", "data"] : ["ok", "error"]);
  assert.equal(envelope.ok, ok);
  return envelope;
}

test("real CLI child processes satisfy the local JSON contract", {
  timeout: TEST_TIMEOUT_MS,
}, async (t) => {
  await requireLocalStack();
  const configDir = await mkdtemp(path.join(tmpdir(), "tockli-cli-local-"));

  t.after(async () => {
    await withTimeout(
      sql`delete from auth.users where id = ${USER_ID}::uuid`,
      REQUEST_TIMEOUT_MS,
      "CLI fixture cleanup",
    );
    await rm(configDir, { force: true, recursive: true });
  });
  await prepareFixture();

  const login = await runTockli(
    ["auth", "login", "--email", EMAIL, "--password-stdin", "--json"],
    { configDir, input: `${PASSWORD}\nignored-second-line\n` },
  );
  const loginEnvelope = assertJsonResult(login);
  assert.equal(loginEnvelope.data.email, EMAIL);
  assert.doesNotMatch(login.stdout + login.stderr, /tockli-demo|access_token|refresh_token/);

  const status = assertJsonResult(
    await runTockli(["auth", "status", "--json"], { configDir }),
  );
  assert.equal(status.data.email, EMAIL);

  const projects = assertJsonResult(
    await runTockli(["projects", "list", "--json"], { configDir }),
  );
  assert.ok(projects.data.some((project) => project.id === PROJECT_ID));

  const title = `CLI contract ${Date.now()}`;
  const created = assertJsonResult(
    await runTockli(
      [
        "tasks",
        "create",
        "--project",
        PROJECT_ID,
        "--title",
        title,
        "--estimate-minutes",
        "35",
        "--json",
      ],
      { configDir },
    ),
  ).data;
  const taskId = created.id;
  assert.equal(created.revision, 1);
  assert.equal(created.title, title);

  const listed = assertJsonResult(
    await runTockli(
      ["tasks", "list", "--project", PROJECT_ID, "--status", created.status, "--limit", "25", "--json"],
      { configDir },
    ),
  ).data;
  assert.ok(listed.some((task) => task.id === taskId));

  const updated = assertJsonResult(
    await runTockli(
      ["tasks", "update", taskId, "--revision", "1", "--note", "Updated through CLI", "--priority", "high", "--json"],
      { configDir },
    ),
  ).data;
  assert.equal(updated.revision, 2);
  assert.equal(updated.priority, "high");

  const conflict = assertJsonResult(
    await runTockli(
      ["tasks", "update", taskId, "--revision", "1", "--title", "Stale overwrite", "--json"],
      { configDir },
    ),
    { exitCode: 3, ok: false },
  );
  assert.equal(conflict.error.code, "TOCKLI_CONFLICT");

  const completed = assertJsonResult(
    await runTockli(
      ["tasks", "complete", taskId, "--revision", "2", "--json"],
      { configDir },
    ),
  ).data;
  assert.equal(completed.revision, 3);
  assert.ok(completed.completedAt);

  const focus = assertJsonResult(
    await runTockli(
      ["focus", "log", "--project", PROJECT_ID, "--task", taskId, "--minutes", "15", "--note", "CLI focus", "--json"],
      { configDir },
    ),
  ).data;
  assert.equal(focus.minutes, 15);
  assert.equal(focus.taskId, taskId);

  const validation = assertJsonResult(
    await runTockli(
      ["tasks", "complete", "not-a-uuid", "--revision", "1", "--json"],
      { configDir },
    ),
    { exitCode: 2, ok: false },
  );
  assert.equal(validation.error.code, "TOCKLI_VALIDATION");

  const logout = assertJsonResult(
    await runTockli(["auth", "logout", "--json"], { configDir }),
  );
  assert.deepEqual(logout.data, { loggedOut: true });

  const loggedOutStatus = assertJsonResult(
    await runTockli(["auth", "status", "--json"], { configDir }),
    { exitCode: 2, ok: false },
  );
  assert.equal(loggedOutStatus.error.code, "TOCKLI_AUTH_REQUIRED");
});

test.after(async () => {
  await withTimeout(sql.end({ timeout: 5 }), 6_000, "Database client shutdown");
});

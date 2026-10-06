import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

import { createTockliApi } from "../lib/tockli-api.mjs";
import {
  assertLocalIntegrationEndpoints,
  createBoundedFetch,
  withTimeout,
} from "./local-integration-safety.mjs";

const API_URL = process.env.TOCKLI_SUPABASE_URL ?? "http://127.0.0.1:54321";
const PUBLIC_KEY =
  process.env.TOCKLI_SUPABASE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DATABASE_URL =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const DEMO_EMAIL = "demo@tockli.test";
const DEMO_PASSWORD = "tockli-demo";
const DEMO_PROJECT_ID = "10000000-0000-4000-8000-000000000001";
const REQUEST_TIMEOUT_MS = 5_000;
const REALTIME_TIMEOUT_MS = 10_000;
const TEST_TIMEOUT_MS = 35_000;
const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..");

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
      "Local Supabase is unavailable. Run `pnpm run db:start` and `pnpm run db:reset` before `pnpm run test:tockli:realtime`.",
      { cause: error },
    );
  }
}

function runDemoLogin(configDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "cli/tockli.mjs",
        "auth",
        "login",
        "--email",
        DEMO_EMAIL,
        "--password-stdin",
        "--json",
      ],
      {
        cwd: REPOSITORY_ROOT,
        env: {
          ...process.env,
          TOCKLI_CONFIG_DIR: configDir,
          TOCKLI_SUPABASE_KEY: PUBLIC_KEY,
          TOCKLI_SUPABASE_URL: API_URL,
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    const timeoutId = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Seeded demo CLI login timed out."));
    }, REALTIME_TIMEOUT_MS);

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
    child.stdin.end(`${DEMO_PASSWORD}\n`);
  });
}

function makeApi(configDir) {
  return createTockliApi({
    configDir,
    env: {
      TOCKLI_CONFIG_DIR: configDir,
      TOCKLI_SUPABASE_KEY: PUBLIC_KEY,
      TOCKLI_SUPABASE_URL: API_URL,
    },
    clientFactory(url, key, options) {
      return createClient(url, key, {
        ...options,
        global: { ...options.global, fetch: boundedFetch },
      });
    },
  });
}

function waitForSubscription(channel) {
  return withTimeout(
    new Promise((resolve, reject) => {
      channel.subscribe((status, error) => {
        if (status === "SUBSCRIBED") {
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reject(error ?? new Error(`Realtime subscription ended with ${status}.`));
        }
      });
    }),
    REALTIME_TIMEOUT_MS,
    "Realtime subscription",
  );
}

test("seeded demo login receives a task event and refetches authoritative state", {
  timeout: TEST_TIMEOUT_MS,
}, async (t) => {
  await requireLocalStack();
  const configDir = await mkdtemp(path.join(tmpdir(), "tockli-realtime-local-"));
  const api = makeApi(configDir);
  const title = `Realtime integration ${randomUUID()}`;
  let channel;
  let createdTaskId;

  t.after(async () => {
    const cleanupErrors = [];
    if (channel) {
      try {
        await withTimeout(
          api.client.removeChannel(channel),
          REQUEST_TIMEOUT_MS,
          "Realtime channel cleanup",
        );
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    api.client.realtime.disconnect();
    if (createdTaskId) {
      try {
        await withTimeout(
          sql`delete from public.tasks where id = ${createdTaskId}::uuid`,
          REQUEST_TIMEOUT_MS,
          "Realtime task cleanup",
        );
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    try {
      await api.logout();
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      await rm(configDir, { force: true, recursive: true });
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (cleanupErrors.length) {
      throw new AggregateError(cleanupErrors, "Realtime integration cleanup failed.");
    }
  });

  const login = await runDemoLogin(configDir);
  assert.equal(
    login.code,
    0,
    `Seeded demo password-stdin login failed. Run \`pnpm run db:reset\`. ${login.stderr || login.stdout}`,
  );
  assert.equal(login.signal, null);
  assert.equal(login.stderr, "");
  assert.doesNotMatch(login.stdout, /tockli-demo|access_token|refresh_token/);
  const loginEnvelope = JSON.parse(login.stdout);
  assert.equal(loginEnvelope.ok, true);
  assert.equal(loginEnvelope.data.email, DEMO_EMAIL);

  const restoredUser = await api.restoreSession();
  assert.equal(restoredUser.email, DEMO_EMAIL);
  const {
    data: { session },
  } = await api.client.auth.getSession();
  assert.ok(session, "restored CLI session should remain available to Realtime");
  await api.client.realtime.setAuth(session.access_token);

  let receiveEvent;
  const eventPromise = new Promise((resolve) => {
    receiveEvent = resolve;
  });
  channel = api.client
    .channel(`tockli-realtime-${randomUUID()}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        filter: `project_id=eq.${DEMO_PROJECT_ID}`,
        schema: "public",
        table: "tasks",
      },
      (payload) => {
        if (payload.new?.title === title) {
          receiveEvent(payload);
        }
      },
    );
  await waitForSubscription(channel);

  const created = await api.createTask({
    projectId: DEMO_PROJECT_ID,
    title,
  });
  createdTaskId = created.id;

  const event = await withTimeout(
    eventPromise,
    REALTIME_TIMEOUT_MS,
    "Task Realtime event",
  );
  assert.equal(event.eventType, "INSERT");
  assert.equal(event.new.id, created.id);
  assert.equal(Number(event.new.revision), 1);

  const authoritative = (await api.listTasks({
    limit: 500,
    projectId: DEMO_PROJECT_ID,
  })).find((task) => task.id === created.id);
  assert.ok(authoritative, "created task should be visible in the authoritative refetch");
  assert.equal(authoritative.title, title);
  assert.equal(authoritative.revision, 1);
});

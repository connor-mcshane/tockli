import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import postgres from "postgres";

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
const USER_ID = "00000000-0000-4000-8000-00000000c104";
const PROJECT_ID = "10000000-0000-4000-8000-00000000c104";
const EMAIL = "mcp-contract@tockli.test";
const PASSWORD = "tockli-demo";
const REQUEST_TIMEOUT_MS = 5_000;
const PROCESS_TIMEOUT_MS = 10_000;
const TEST_TIMEOUT_MS = 45_000;
const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..");

const EXPECTED_TOOLS = [
  "complete_task",
  "create_task",
  "get_current_user",
  "list_projects",
  "list_tasks",
  "log_focus_session",
  "update_task",
];

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
      "Local Supabase is unavailable. Run `pnpm run db:start` and `pnpm run db:reset` before `pnpm run test:tockli:mcp`.",
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
          '{"display_name":"MCP Contract"}'::jsonb,
          now(),
          now()
        )
      `;
      await tx`
        insert into public.projects (id, owner_id, name, kind)
        values (${PROJECT_ID}::uuid, ${USER_ID}::uuid, 'MCP Contract', 'personal')
      `;
    }),
    REQUEST_TIMEOUT_MS,
    "MCP fixture setup",
  );
}

function runCliLogin(configDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "cli/tockli.mjs",
        "auth",
        "login",
        "--email",
        EMAIL,
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
      reject(new Error("CLI login timed out."));
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
    child.on("close", (code) => {
      clearTimeout(timeoutId);
      if (code !== 0) {
        reject(new Error(`CLI login failed (${code}): ${stderr || stdout}`));
        return;
      }
      resolve();
    });
    child.stdin.end(`${PASSWORD}\n`);
  });
}

function assertToolSchema(tool, required, properties) {
  assert.equal(tool.inputSchema.type, "object", `${tool.name} input must be an object`);
  assert.deepEqual((tool.inputSchema.required ?? []).toSorted(), required.toSorted());
  assert.deepEqual(Object.keys(tool.inputSchema.properties ?? {}).sort(), properties.sort());
  assert.equal(tool.inputSchema.additionalProperties, false);
}

function textOf(result) {
  assert.equal(result.content.length, 1);
  assert.equal(result.content[0].type, "text");
  return result.content[0].text;
}

function assertStructuredValidation(result, toolName) {
  assert.equal(result.isError, true);
  assert.deepEqual(result.structuredContent?.error, {
    code: "TOCKLI_VALIDATION",
    message: `Invalid arguments for tool '${toolName}'.`,
  });
  assert.match(textOf(result), /^TOCKLI_VALIDATION:/);
}

test("real MCP SDK client exercises the local stdio server protocol", {
  timeout: TEST_TIMEOUT_MS,
}, async (t) => {
  await requireLocalStack();
  const configDir = await mkdtemp(path.join(tmpdir(), "tockli-mcp-local-"));
  let client;
  let stderr = "";
  const protocolErrors = [];

  t.after(async () => {
    await client?.close();
    await withTimeout(
      sql`delete from auth.users where id = ${USER_ID}::uuid`,
      REQUEST_TIMEOUT_MS,
      "MCP fixture cleanup",
    );
    await rm(configDir, { force: true, recursive: true });
  });

  await prepareFixture();
  await runCliLogin(configDir);

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["mcp/server.mjs"],
    cwd: REPOSITORY_ROOT,
    env: {
      ...process.env,
      TOCKLI_CONFIG_DIR: configDir,
      TOCKLI_SUPABASE_KEY: PUBLIC_KEY,
      TOCKLI_SUPABASE_URL: API_URL,
    },
    stderr: "pipe",
  });
  transport.onerror = (error) => {
    protocolErrors.push(error);
  };
  transport.stderr.setEncoding("utf8");
  transport.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  client = new Client({ name: "tockli-mcp-protocol-test", version: "1.0.0" });
  await client.connect(transport);

  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), EXPECTED_TOOLS);
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  assertToolSchema(byName.get("get_current_user"), [], []);
  assertToolSchema(byName.get("list_projects"), [], []);
  assertToolSchema(byName.get("list_tasks"), [], ["limit", "projectId", "status"]);
  assertToolSchema(byName.get("create_task"), ["projectId", "title"], [
    "dueLabel",
    "estimateMinutes",
    "note",
    "priority",
    "projectId",
    "status",
    "title",
  ]);
  assertToolSchema(byName.get("update_task"), ["taskId", "expectedRevision", "patch"], [
    "expectedRevision",
    "patch",
    "taskId",
  ]);
  assertToolSchema(byName.get("complete_task"), ["taskId", "expectedRevision"], [
    "expectedRevision",
    "taskId",
  ]);
  assertToolSchema(byName.get("log_focus_session"), ["projectId", "minutes"], [
    "minutes",
    "note",
    "projectId",
    "taskId",
  ]);
  assert.equal(byName.get("create_task").inputSchema.properties.projectId.format, "uuid");
  assert.equal(byName.get("update_task").inputSchema.properties.taskId.format, "uuid");

  assertStructuredValidation(
    await client.callTool({
      name: "list_tasks",
      arguments: { projectId: "not-a-uuid" },
    }),
    "list_tasks",
  );
  assertStructuredValidation(
    await client.callTool({
      name: "create_task",
      arguments: { projectId: PROJECT_ID },
    }),
    "create_task",
  );
  assertStructuredValidation(
    await client.callTool({
      name: "get_current_user",
      arguments: { unexpected: true },
    }),
    "get_current_user",
  );
  assertStructuredValidation(
    await client.callTool({
      name: "complete_task",
      arguments: {
        taskId: "20000000-0000-4000-8000-00000000c104",
        expectedRevision: 0,
      },
    }),
    "complete_task",
  );

  const currentUser = await client.callTool({ name: "get_current_user", arguments: {} });
  assert.equal(currentUser.isError, undefined, JSON.stringify(currentUser));
  assert.equal(currentUser.structuredContent.user.email, EMAIL);
  assert.match(textOf(currentUser), /mcp-contract@tockli\.test/i);

  const projects = await client.callTool({ name: "list_projects", arguments: {} });
  assert.ok(projects.structuredContent.projects.some((project) => project.id === PROJECT_ID));

  const title = `MCP contract ${Date.now()}`;
  const created = await client.callTool({
    name: "create_task",
    arguments: {
      projectId: PROJECT_ID,
      title,
      estimateMinutes: 35,
      priority: "high",
    },
  });
  const task = created.structuredContent.task;
  assert.equal(task.title, title);
  assert.equal(task.revision, 1);
  assert.match(textOf(created), /created/i);

  const listed = await client.callTool({
    name: "list_tasks",
    arguments: { projectId: PROJECT_ID, status: task.status, limit: 25 },
  });
  assert.ok(listed.structuredContent.tasks.some((item) => item.id === task.id));

  const updated = await client.callTool({
    name: "update_task",
    arguments: {
      taskId: task.id,
      expectedRevision: 1,
      patch: { note: "Updated through MCP", priority: "low" },
    },
  });
  assert.equal(updated.structuredContent.task.revision, 2);
  assert.equal(updated.structuredContent.task.note, "Updated through MCP");

  const conflict = await client.callTool({
    name: "update_task",
    arguments: {
      taskId: task.id,
      expectedRevision: 1,
      patch: { title: "Stale overwrite" },
    },
  });
  assert.equal(conflict.isError, true);
  assert.deepEqual(conflict.structuredContent.error, {
    code: "TOCKLI_CONFLICT",
    currentRevision: 2,
    message: "The task changed since revision 2. Reload it and try again.",
  });
  assert.doesNotMatch(textOf(conflict), /access_token|refresh_token|postgres|select /i);

  const notFound = await client.callTool({
    name: "complete_task",
    arguments: {
      taskId: "20000000-0000-4000-8000-00000000c104",
      expectedRevision: 1,
    },
  });
  assert.equal(notFound.isError, true);
  assert.deepEqual(notFound.structuredContent.error, {
    code: "TOCKLI_NOT_FOUND",
    message: "The requested resource was not found or is not accessible.",
  });

  const completed = await client.callTool({
    name: "complete_task",
    arguments: { taskId: task.id, expectedRevision: 2 },
  });
  assert.equal(completed.structuredContent.task.revision, 3);
  assert.ok(completed.structuredContent.task.completedAt);

  const focus = await client.callTool({
    name: "log_focus_session",
    arguments: {
      projectId: PROJECT_ID,
      taskId: task.id,
      minutes: 15,
      note: "MCP focus",
    },
  });
  assert.equal(focus.structuredContent.focusSession.minutes, 15);
  assert.equal(focus.structuredContent.focusSession.taskId, task.id);

  const validation = await client.callTool({
    name: "create_task",
    arguments: { projectId: PROJECT_ID, title: " " },
  });
  assert.equal(validation.isError, true);
  assert.equal(validation.structuredContent.error.code, "TOCKLI_VALIDATION");
  assert.doesNotMatch(
    JSON.stringify(validation),
    /access_token|refresh_token|service_role|tockli-demo/i,
  );

  assert.deepEqual(protocolErrors, [], "stdout must contain valid MCP protocol traffic only");
  assert.doesNotMatch(stderr, /access_token|refresh_token|tockli-demo/i);
});

test.after(async () => {
  await withTimeout(sql.end({ timeout: 5 }), 6_000, "Database client shutdown");
});

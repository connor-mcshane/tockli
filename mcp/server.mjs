#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pathToFileURL } from "node:url";
import * as z from "zod/v4";

import { TockliError, createTockliApi } from "../lib/tockli-api.mjs";

const uuid = z.uuid();
const positiveRevision = z.int().min(1);
const priority = z.enum(["low", "medium", "high"]);

const patchSchema = z
  .strictObject({
    categoryId: uuid.nullable().optional(),
    dueLabel: z.string().nullable().optional(),
    estimateMinutes: z.int().min(1).max(480).optional(),
    note: z.string().optional(),
    priority: priority.optional(),
    spentMinutes: z.int().min(0).optional(),
    status: z.string().min(1).max(120).optional(),
    title: z.string().min(1).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "patch must include at least one supported field.",
  });

const SAFE_ERROR_CODES = new Set([
  "TOCKLI_API_ERROR",
  "TOCKLI_AUTH_FAILED",
  "TOCKLI_AUTH_REQUIRED",
  "TOCKLI_CONFIG",
  "TOCKLI_CONFLICT",
  "TOCKLI_FORBIDDEN",
  "TOCKLI_NOT_FOUND",
  "TOCKLI_VALIDATION",
]);

function publicError(error) {
  if (error instanceof TockliError && SAFE_ERROR_CODES.has(error.code)) {
    const output = { code: error.code, message: error.message };
    if (
      error.code === "TOCKLI_CONFLICT" &&
      Number.isSafeInteger(error.currentRevision) &&
      error.currentRevision >= 1
    ) {
      output.currentRevision = error.currentRevision;
    }
    return output;
  }
  return {
    code: "TOCKLI_UNEXPECTED",
    message: "Tockli could not complete the request.",
  };
}

function result(text, structuredContent) {
  return {
    content: [{ type: "text", text }],
    structuredContent,
  };
}

function failure(error) {
  const safeError = publicError(error);
  return {
    ...result(`${safeError.code}: ${safeError.message}`, { error: safeError }),
    isError: true,
  };
}

function registerApiTool(server, api, name, config, operation, summarize) {
  server.registerTool(name, config, async (input) => {
    try {
      const data = await operation(api, input);
      return result(summarize(data), data);
    } catch (error) {
      return failure(error);
    }
  });
}

export function createTockliMcpServer({ api = createTockliApi() } = {}) {
  const server = new McpServer({ name: "tockli", version: "0.1.0" });

  registerApiTool(
    server,
    api,
    "get_current_user",
    {
      description: "Return the currently authenticated Tockli user.",
      inputSchema: z.strictObject({}),
    },
    async (tockli) => ({ user: await tockli.getCurrentUser() }),
    ({ user }) => `Signed in as ${user.email ?? user.displayName ?? user.id}.`,
  );

  registerApiTool(
    server,
    api,
    "list_projects",
    {
      description: "List Tockli projects visible to the authenticated user.",
      inputSchema: z.strictObject({}),
    },
    async (tockli) => ({ projects: await tockli.listProjects() }),
    ({ projects }) => `Found ${projects.length} project${projects.length === 1 ? "" : "s"}.`,
  );

  registerApiTool(
    server,
    api,
    "list_tasks",
    {
      description: "List visible Tockli tasks, optionally filtered by project and status.",
      inputSchema: z.strictObject({
        limit: z.int().min(1).max(500).optional(),
        projectId: uuid.optional(),
        status: z.string().min(1).max(120).optional(),
      }),
    },
    async (tockli, input) => ({ tasks: await tockli.listTasks(input) }),
    ({ tasks }) => `Found ${tasks.length} task${tasks.length === 1 ? "" : "s"}.`,
  );

  registerApiTool(
    server,
    api,
    "create_task",
    {
      description: "Create a task in a Tockli project.",
      inputSchema: z.strictObject({
        dueLabel: z.string().nullable().optional(),
        estimateMinutes: z.int().min(1).max(480).optional(),
        note: z.string().optional(),
        priority: priority.optional(),
        projectId: uuid,
        status: z.string().min(1).max(120).optional(),
        title: z.string().min(1),
      }),
    },
    async (tockli, input) => ({ task: await tockli.createTask(input) }),
    ({ task }) => `Created task "${task.title}" at revision ${task.revision}.`,
  );

  registerApiTool(
    server,
    api,
    "update_task",
    {
      description: "Update a task if its revision still matches the expected revision.",
      inputSchema: z.strictObject({
        expectedRevision: positiveRevision,
        patch: patchSchema,
        taskId: uuid,
      }),
    },
    async (tockli, input) => ({ task: await tockli.updateTask(input) }),
    ({ task }) => `Updated task "${task.title}" to revision ${task.revision}.`,
  );

  registerApiTool(
    server,
    api,
    "complete_task",
    {
      description: "Complete a task if its revision still matches the expected revision.",
      inputSchema: z.strictObject({
        expectedRevision: positiveRevision,
        taskId: uuid,
      }),
    },
    async (tockli, input) => ({ task: await tockli.completeTask(input) }),
    ({ task }) => `Completed task "${task.title}" at revision ${task.revision}.`,
  );

  registerApiTool(
    server,
    api,
    "log_focus_session",
    {
      description: "Log completed focus time for a project and optional task.",
      inputSchema: z.strictObject({
        minutes: z.int().min(1).max(480),
        note: z.string().optional(),
        projectId: uuid,
        taskId: uuid.nullable().optional(),
      }),
    },
    async (tockli, input) => ({
      focusSession: await tockli.logFocusSession(input),
    }),
    ({ focusSession }) => `Logged ${focusSession.minutes} focus minutes.`,
  );

  return server;
}

export async function runTockliMcpServer() {
  const api = createTockliApi();
  await api.restoreSession();
  const server = createTockliMcpServer({ api });
  await server.connect(new StdioServerTransport());
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runTockliMcpServer().catch(() => {
    console.error("Tockli MCP server failed to start.");
    process.exitCode = 1;
  });
}

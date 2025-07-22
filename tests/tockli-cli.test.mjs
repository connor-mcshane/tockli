import assert from "node:assert/strict";
import test from "node:test";

import { TockliError } from "../lib/tockli-api.mjs";
import {
  errorEnvelope,
  exitCodeForError,
  parseCliArgs,
  runCli,
  successEnvelope,
} from "../cli/tockli-cli.mjs";

function captureStream() {
  let value = "";
  return {
    stream: {
      write(chunk) {
        value += chunk;
        return true;
      },
    },
    value: () => value,
  };
}

function mockApi(overrides = {}) {
  return {
    async completeTask(input) {
      return { ...input, revision: input.expectedRevision + 1 };
    },
    async createTask(input) {
      return { id: "task-id", ...input, revision: 1 };
    },
    async listProjects() {
      return [];
    },
    async listTasks(input) {
      return [input];
    },
    async loginWithPassword({ email }) {
      return { email, id: "user-id" };
    },
    async logFocusSession(input) {
      return { id: "session-id", ...input };
    },
    async logout() {
      return { loggedOut: true };
    },
    async restoreSession() {
      return { email: "demo@tockli.test", id: "user-id" };
    },
    async updateTask(input) {
      return { ...input.patch, id: input.taskId, revision: input.expectedRevision + 1 };
    },
    ...overrides,
  };
}

test("parses the specified command surface into shared API inputs", () => {
  assert.deepEqual(
    parseCliArgs([
      "auth",
      "login",
      "--email",
      "person@example.com",
      "--password-stdin",
      "--json",
    ]),
    {
      command: "auth.login",
      input: { email: "person@example.com" },
      json: true,
    },
  );
  assert.deepEqual(parseCliArgs(["auth", "status"]), {
    command: "auth.status",
    input: {},
    json: false,
  });
  assert.deepEqual(parseCliArgs(["auth", "logout"]), {
    command: "auth.logout",
    input: {},
    json: false,
  });
  assert.deepEqual(parseCliArgs(["projects", "list"]), {
    command: "projects.list",
    input: {},
    json: false,
  });
  assert.deepEqual(
    parseCliArgs([
      "tasks",
      "list",
      "--project",
      "10000000-0000-4000-8000-000000000001",
      "--status",
      "active",
      "--limit",
      "25",
    ]),
    {
      command: "tasks.list",
      input: {
        limit: 25,
        projectId: "10000000-0000-4000-8000-000000000001",
        status: "active",
      },
      json: false,
    },
  );
  assert.deepEqual(
    parseCliArgs([
      "tasks",
      "create",
      "--project",
      "10000000-0000-4000-8000-000000000001",
      "--title",
      "Ship CLI",
      "--note",
      "Contract first",
      "--status",
      "active",
      "--priority",
      "high",
      "--estimate-minutes",
      "45",
      "--due-label",
      "Today",
      "--json",
    ]),
    {
      command: "tasks.create",
      input: {
        dueLabel: "Today",
        estimateMinutes: 45,
        note: "Contract first",
        priority: "high",
        projectId: "10000000-0000-4000-8000-000000000001",
        status: "active",
        title: "Ship CLI",
      },
      json: true,
    },
  );

  assert.deepEqual(
    parseCliArgs([
      "tasks",
      "update",
      "20000000-0000-4000-8000-000000000001",
      "--revision",
      "3",
      "--title",
      "Updated",
      "--spent-minutes",
      "20",
      "--category",
      "40000000-0000-4000-8000-000000000001",
    ]),
    {
      command: "tasks.update",
      input: {
        expectedRevision: 3,
        patch: {
          categoryId: "40000000-0000-4000-8000-000000000001",
          spentMinutes: 20,
          title: "Updated",
        },
        taskId: "20000000-0000-4000-8000-000000000001",
      },
      json: false,
    },
  );

  assert.deepEqual(
    parseCliArgs([
      "focus",
      "log",
      "--project",
      "10000000-0000-4000-8000-000000000001",
      "--task",
      "20000000-0000-4000-8000-000000000001",
      "--minutes",
      "25",
      "--note",
      "Focused",
    ]),
    {
      command: "focus.log",
      input: {
        minutes: 25,
        note: "Focused",
        projectId: "10000000-0000-4000-8000-000000000001",
        taskId: "20000000-0000-4000-8000-000000000001",
      },
      json: false,
    },
  );

  assert.deepEqual(
    parseCliArgs([
      "tasks",
      "complete",
      "20000000-0000-4000-8000-000000000001",
      "--revision",
      "4",
    ]),
    {
      command: "tasks.complete",
      input: {
        expectedRevision: 4,
        taskId: "20000000-0000-4000-8000-000000000001",
      },
      json: false,
    },
  );
});

test("requires password stdin and rejects password command arguments", () => {
  assert.throws(
    () => parseCliArgs(["auth", "login", "--email", "person@example.com"]),
    (error) => error.code === "TOCKLI_VALIDATION",
  );
  assert.throws(
    () =>
      parseCliArgs([
        "auth",
        "login",
        "--email",
        "person@example.com",
        "--password",
        "do-not-accept-this",
      ]),
    (error) =>
      error.code === "TOCKLI_VALIDATION" &&
      !error.message.includes("do-not-accept-this"),
  );
});

test("rejects unknown commands, irrelevant options, and malformed integers", () => {
  for (const argv of [
    ["projects", "find", "Deep Work"],
    ["projects", "list", "--project", "name"],
    ["tasks", "list", "--limit", "1.5"],
    ["tasks", "complete", "task-id", "--revision", "nope"],
  ]) {
    assert.throws(
      () => parseCliArgs(argv),
      (error) => error.code === "TOCKLI_VALIDATION",
    );
  }
});

test("builds exact success and error envelopes", () => {
  assert.equal(successEnvelope({ answer: 42 }), '{"ok":true,"data":{"answer":42}}');
  assert.equal(
    errorEnvelope(new TockliError("TOCKLI_VALIDATION", "Invalid input.")),
    '{"ok":false,"error":{"code":"TOCKLI_VALIDATION","message":"Invalid input."}}',
  );
  assert.equal(
    errorEnvelope(new Error("access_token=secret-value")),
    '{"ok":false,"error":{"code":"TOCKLI_UNEXPECTED","message":"Tockli could not complete the request."}}',
  );
});

test("maps validation and auth to 2, conflicts to 3, and unexpected failures to 1", () => {
  for (const code of [
    "TOCKLI_VALIDATION",
    "TOCKLI_CONFIG",
    "TOCKLI_AUTH_REQUIRED",
    "TOCKLI_AUTH_FAILED",
    "TOCKLI_FORBIDDEN",
    "TOCKLI_NOT_FOUND",
  ]) {
    assert.equal(exitCodeForError(new TockliError(code, "Expected failure.")), 2);
  }
  assert.equal(
    exitCodeForError(new TockliError("TOCKLI_CONFLICT", "Conflict.")),
    3,
  );
  assert.equal(
    exitCodeForError(new TockliError("TOCKLI_API_ERROR", "Request failed.")),
    1,
  );
  assert.equal(exitCodeForError(new Error("boom")), 1);
});

test("JSON mode emits one success document and redacts secret-shaped fields", async () => {
  const stdout = captureStream();
  const stderr = captureStream();
  const exitCode = await runCli({
    apiFactory: () =>
      mockApi({
        async restoreSession() {
          return {
            access_token: "access-secret",
            email: "demo@tockli.test",
            id: "user-id",
            password: "password-secret",
            refreshToken: "refresh-secret",
          };
        },
      }),
    argv: ["auth", "status", "--json"],
    stderr: stderr.stream,
    stdout: stdout.stream,
  });

  assert.equal(exitCode, 0);
  assert.equal(
    stdout.value(),
    '{"ok":true,"data":{"email":"demo@tockli.test","id":"user-id"}}\n',
  );
  assert.equal(stderr.value(), "");
  assert.doesNotMatch(stdout.value(), /access-secret|password-secret|refresh-secret/);
});

test("human success output uses only public user fields", async () => {
  const stdout = captureStream();
  const stderr = captureStream();
  const exitCode = await runCli({
    apiFactory: () =>
      mockApi({
        async restoreSession() {
          return {
            access_token: "access-secret",
            email: "demo@tockli.test",
            refresh_token: "refresh-secret",
          };
        },
      }),
    argv: ["auth", "status"],
    stderr: stderr.stream,
    stdout: stdout.stream,
  });

  assert.equal(exitCode, 0);
  assert.equal(stdout.value(), "Signed in as demo@tockli.test.\n");
  assert.equal(stderr.value(), "");
  assert.doesNotMatch(stdout.value(), /access-secret|refresh-secret/);
});

test("JSON errors stay on stdout while human errors are concise and redacted", async () => {
  const jsonStdout = captureStream();
  const jsonStderr = captureStream();
  const jsonExitCode = await runCli({
    apiFactory: () => {
      throw new Error("refresh_token=top-secret");
    },
    argv: ["projects", "list", "--json"],
    stderr: jsonStderr.stream,
    stdout: jsonStdout.stream,
  });
  assert.equal(jsonExitCode, 1);
  assert.equal(
    jsonStdout.value(),
    '{"ok":false,"error":{"code":"TOCKLI_UNEXPECTED","message":"Tockli could not complete the request."}}\n',
  );
  assert.equal(jsonStderr.value(), "");
  assert.doesNotMatch(jsonStdout.value(), /top-secret/);

  const humanStdout = captureStream();
  const humanStderr = captureStream();
  const humanExitCode = await runCli({
    apiFactory: () => {
      throw new Error("access_token=another-secret");
    },
    argv: ["projects", "list"],
    stderr: humanStderr.stream,
    stdout: humanStdout.stream,
  });
  assert.equal(humanExitCode, 1);
  assert.equal(humanStdout.value(), "");
  assert.equal(
    humanStderr.value(),
    "TOCKLI_UNEXPECTED: Tockli could not complete the request.\n",
  );
  assert.doesNotMatch(humanStderr.value(), /another-secret/);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  TockliError,
  createTockliApi,
  mapProjectRow,
  mapTaskRow,
} from "../lib/tockli-api.mjs";

const PROJECT_ID = "10000000-0000-4000-8000-000000000001";
const TASK_ID = "20000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000001";

function scriptedClient(responses = []) {
  const calls = [];
  const queue = [...responses];

  function response() {
    assert.ok(queue.length, "Unexpected Supabase query");
    return Promise.resolve(queue.shift());
  }

  function query(table) {
    const chain = { table, operations: [] };
    calls.push(chain);
    const builder = {
      delete(...args) {
        chain.operations.push(["delete", ...args]);
        return builder;
      },
      eq(...args) {
        chain.operations.push(["eq", ...args]);
        return builder;
      },
      insert(...args) {
        chain.operations.push(["insert", ...args]);
        return builder;
      },
      limit(...args) {
        chain.operations.push(["limit", ...args]);
        return builder;
      },
      maybeSingle(...args) {
        chain.operations.push(["maybeSingle", ...args]);
        return response();
      },
      order(...args) {
        chain.operations.push(["order", ...args]);
        return builder;
      },
      select(...args) {
        chain.operations.push(["select", ...args]);
        return builder;
      },
      single(...args) {
        chain.operations.push(["single", ...args]);
        return response();
      },
      update(...args) {
        chain.operations.push(["update", ...args]);
        return builder;
      },
      then(resolve, reject) {
        return response().then(resolve, reject);
      },
    };
    return builder;
  }

  return {
    auth: {
      async getUser() {
        return {
          data: { user: { id: USER_ID, email: "demo@tockli.test" } },
          error: null,
        };
      },
    },
    calls,
    from: query,
  };
}

test("row mappers expose camel-cased data and preserve task revision", () => {
  assert.deepEqual(
    mapProjectRow({
      board_columns: [{ id: "queue", title: "Queue" }],
      color: "#123456",
      created_at: "2026-10-01T00:00:00Z",
      description: "Notes",
      id: PROJECT_ID,
      kind: "team",
      name: "Launch",
      owner_id: USER_ID,
      updated_at: "2026-10-02T00:00:00Z",
    }),
    {
      boardColumns: [{ id: "queue", title: "Queue" }],
      color: "#123456",
      createdAt: "2026-10-01T00:00:00Z",
      description: "Notes",
      id: PROJECT_ID,
      kind: "team",
      name: "Launch",
      ownerId: USER_ID,
      updatedAt: "2026-10-02T00:00:00Z",
    },
  );

  assert.deepEqual(
    mapTaskRow({
      category_id: null,
      completed_at: null,
      created_at: "2026-10-01T00:00:00Z",
      created_by: USER_ID,
      due_label: null,
      estimate_minutes: 25,
      id: TASK_ID,
      note: "Keep it small",
      priority: "high",
      project_id: PROJECT_ID,
      revision: 4,
      sort_order: 3,
      spent_minutes: 5,
      status: "active",
      title: "Ship CLI",
      updated_at: "2026-10-02T00:00:00Z",
    }),
    {
      categoryId: null,
      completedAt: null,
      createdAt: "2026-10-01T00:00:00Z",
      createdBy: USER_ID,
      dueLabel: null,
      estimateMinutes: 25,
      id: TASK_ID,
      note: "Keep it small",
      priority: "high",
      projectId: PROJECT_ID,
      revision: 4,
      sortOrder: 3,
      spentMinutes: 5,
      status: "active",
      title: "Ship CLI",
      updatedAt: "2026-10-02T00:00:00Z",
    },
  );
});

test("listTasks validates filters before a network call", async () => {
  const client = scriptedClient();
  const api = createTockliApi({ client });

  for (const input of [
    { projectId: "not-a-uuid" },
    { limit: 0 },
    { limit: 501 },
    { limit: 1.5 },
    { status: "" },
  ]) {
    await assert.rejects(api.listTasks(input), (error) => {
      assert.equal(error.code, "TOCKLI_VALIDATION");
      return true;
    });
  }
  assert.equal(client.calls.length, 0);
});

test("listTasks uses explicit columns and the bounded default limit", async () => {
  const client = scriptedClient([{ data: [], error: null }]);
  const api = createTockliApi({ client });
  assert.deepEqual(await api.listTasks({ projectId: PROJECT_ID }), []);

  const operations = client.calls[0].operations;
  const selection = operations.find(([name]) => name === "select")[1];
  assert.ok(selection.includes("revision"));
  assert.notEqual(selection, "*");
  assert.deepEqual(
    operations.find(([name]) => name === "limit"),
    ["limit", 100],
  );
});

test("createTask defaults to the first active board column", async () => {
  const projectRow = {
    board_columns: [
      { id: "archive", title: "Archive", archived: true },
      { id: "queue", title: "Queue" },
      { id: "finished", title: "Finished", isDone: true },
    ],
    id: PROJECT_ID,
  };
  const taskRow = {
    category_id: null,
    completed_at: null,
    created_at: "2026-10-01T00:00:00Z",
    created_by: USER_ID,
    due_label: null,
    estimate_minutes: 25,
    id: TASK_ID,
    note: "",
    priority: "medium",
    project_id: PROJECT_ID,
    revision: 1,
    sort_order: 0,
    spent_minutes: 0,
    status: "queue",
    title: "First task",
    updated_at: "2026-10-01T00:00:00Z",
  };
  const client = scriptedClient([
    { data: projectRow, error: null },
    { data: taskRow, error: null },
  ]);
  const api = createTockliApi({ client });

  const result = await api.createTask({ projectId: PROJECT_ID, title: " First task " });
  assert.equal(result.status, "queue");
  assert.equal(result.revision, 1);
  const insert = client.calls[1].operations.find(([name]) => name === "insert");
  assert.equal(insert[1].status, "queue");
  assert.equal(insert[1].title, "First task");
  assert.equal(insert[1].created_by, USER_ID);
});

test("updateTask rejects unknown and empty patches before a network call", async () => {
  const client = scriptedClient();
  const api = createTockliApi({ client });

  await assert.rejects(
    api.updateTask({ taskId: TASK_ID, expectedRevision: 1, patch: {} }),
    { code: "TOCKLI_VALIDATION" },
  );
  await assert.rejects(
    api.updateTask({
      taskId: TASK_ID,
      expectedRevision: 1,
      patch: { projectId: PROJECT_ID },
    }),
    { code: "TOCKLI_VALIDATION" },
  );
  assert.equal(client.calls.length, 0);
});

test("a zero-row revision update is classified using an RLS-scoped read", async () => {
  const client = scriptedClient([
    { data: null, error: null },
    { data: { id: TASK_ID, revision: 7 }, error: null },
  ]);
  const api = createTockliApi({ client });

  await assert.rejects(
    api.updateTask({
      taskId: TASK_ID,
      expectedRevision: 6,
      patch: { spentMinutes: 25 },
    }),
    (error) => {
      assert.ok(error instanceof TockliError);
      assert.equal(error.code, "TOCKLI_CONFLICT");
      assert.equal(error.currentRevision, 7);
      assert.deepEqual(error.details, { currentRevision: 7 });
      return true;
    },
  );
  assert.deepEqual(
    client.calls[0].operations.filter(([name]) => name === "eq"),
    [
      ["eq", "id", TASK_ID],
      ["eq", "revision", 6],
    ],
  );
  assert.equal(client.calls[1].table, "tasks");
});

test("an invisible zero-row update is TOCKLI_NOT_FOUND", async () => {
  const client = scriptedClient([
    { data: null, error: null },
    { data: null, error: null },
  ]);
  const api = createTockliApi({ client });

  await assert.rejects(
    api.updateTask({
      taskId: TASK_ID,
      expectedRevision: 1,
      patch: { title: "Gone" },
    }),
    { code: "TOCKLI_NOT_FOUND" },
  );
});

test("completeTask uses the configured done column and falls back to done", async () => {
  for (const [boardColumns, expectedStatus] of [
    [[{ id: "shipped", title: "Shipped", isDone: true }], "shipped"],
    [[{ id: "todo", title: "To do" }], "done"],
  ]) {
    const completedRow = {
      category_id: null,
      completed_at: "2026-10-02T00:00:00Z",
      created_at: "2026-10-01T00:00:00Z",
      created_by: USER_ID,
      due_label: null,
      estimate_minutes: 25,
      id: TASK_ID,
      note: "",
      priority: "medium",
      project_id: PROJECT_ID,
      revision: 2,
      sort_order: 0,
      spent_minutes: 0,
      status: expectedStatus,
      title: "Complete me",
      updated_at: "2026-10-02T00:00:00Z",
    };
    const client = scriptedClient([
      { data: { id: TASK_ID, project_id: PROJECT_ID }, error: null },
      { data: { board_columns: boardColumns, id: PROJECT_ID }, error: null },
      { data: completedRow, error: null },
    ]);
    const api = createTockliApi({ client });

    assert.equal(
      (await api.completeTask({ taskId: TASK_ID, expectedRevision: 1 })).status,
      expectedStatus,
    );
    const update = client.calls[2].operations.find(([name]) => name === "update");
    assert.deepEqual(update, ["update", { status: expectedStatus }]);
  }
});

test("mutation validation rejects bad values without querying Supabase", async () => {
  const client = scriptedClient();
  const api = createTockliApi({ client });
  const invalidCalls = [
    () => api.createTask({ projectId: PROJECT_ID, title: "  " }),
    () => api.createTask({ projectId: PROJECT_ID, title: "Task", priority: "urgent" }),
    () => api.createTask({ projectId: PROJECT_ID, title: "Task", status: "" }),
    () => api.completeTask({ taskId: TASK_ID, expectedRevision: 0 }),
    () => api.logFocusSession({ projectId: PROJECT_ID, minutes: 481 }),
    () => api.logFocusSession({ projectId: PROJECT_ID, minutes: 25, taskId: "bad-id" }),
  ];
  for (const invoke of invalidCalls) {
    await assert.rejects(invoke(), { code: "TOCKLI_VALIDATION" });
  }
  assert.equal(client.calls.length, 0);
});

test("known Supabase authorization errors map to safe Tockli errors", async () => {
  const client = scriptedClient([
    { data: null, error: { code: "42501", message: "new row violates policy" } },
  ]);
  const api = createTockliApi({ client });

  await assert.rejects(
    api.listProjects(),
    (error) => {
      assert.equal(error.code, "TOCKLI_FORBIDDEN");
      assert.equal(error.message, "You do not have permission to perform this operation.");
      assert.ok(!error.message.includes("policy"));
      return true;
    },
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSPACE_REALTIME_TABLES,
  acknowledgeTaskWrite,
  clearAcknowledgedDirtyWrite,
  createWorkspaceInvalidationScheduler,
  deleteTaskWithRevision,
  executeIdempotentTaskInsert,
  hasPendingWorkspaceWrites,
  mergeRemoteTasksPreservingTimer,
  nextWorkspaceSyncRetryDelay,
  scheduleWorkspaceSyncRetry,
  taskIdForTimerRecord,
} from "../lib/workspace-sync.mjs";

function createFakeClock() {
  let nextId = 1;
  const timers = new Map();

  return {
    clearTimeoutFn(id) {
      timers.delete(id);
    },
    pendingCount() {
      return timers.size;
    },
    async runNext() {
      const next = [...timers.entries()].sort(
        ([leftId, left], [rightId, right]) =>
          left.delay - right.delay || leftId - rightId,
      )[0];
      assert.ok(next, "expected a scheduled invalidation callback");
      const [id, timer] = next;
      timers.delete(id);
      timer.callback();
      await Promise.resolve();
      await Promise.resolve();
    },
    setTimeoutFn(callback, delay) {
      const id = nextId++;
      timers.set(id, { callback, delay });
      return id;
    },
  };
}

test("workspace Realtime subscriptions cover the ruled mutable tables", () => {
  assert.deepEqual(WORKSPACE_REALTIME_TABLES, [
    "projects",
    "project_members",
    "project_invitations",
    "task_categories",
    "tasks",
    "task_tags",
    "task_subtasks",
    "task_comments",
    "focus_sessions",
    "pomodoro_cancellations",
    "user_settings",
  ]);
});

test("Realtime invalidations are debounced into one authoritative refresh", async () => {
  const clock = createFakeClock();
  let refreshCount = 0;
  const scheduler = createWorkspaceInvalidationScheduler({
    ...clock,
    debounceMs: 75,
    isBlocked: () => false,
    refresh: async () => {
      refreshCount += 1;
    },
  });

  scheduler.requestInvalidation();
  scheduler.requestInvalidation();
  scheduler.requestInvalidation();

  assert.equal(clock.pendingCount(), 1);
  assert.equal(refreshCount, 0);
  await clock.runNext();
  assert.equal(refreshCount, 1);
  assert.deepEqual(scheduler.getState(), {
    disposed: false,
    queued: false,
    refreshing: false,
    timerScheduled: false,
  });
});

test("an invalidation waits for remote writes and dirty sets to become clean", async () => {
  const clock = createFakeClock();
  let blocked = true;
  let refreshCount = 0;
  const scheduler = createWorkspaceInvalidationScheduler({
    ...clock,
    debounceMs: 75,
    isBlocked: () => blocked,
    refresh: async () => {
      refreshCount += 1;
    },
  });

  scheduler.requestInvalidation();
  await clock.runNext();

  assert.equal(refreshCount, 0);
  assert.equal(scheduler.getState().queued, true);
  assert.equal(clock.pendingCount(), 0);

  blocked = false;
  scheduler.notifyWorkspaceClean();
  assert.equal(clock.pendingCount(), 1);
  await clock.runNext();

  assert.equal(refreshCount, 1);
  assert.equal(scheduler.getState().queued, false);
});

test("an event arriving during refresh is queued for one follow-up refresh", async () => {
  const clock = createFakeClock();
  let finishFirstRefresh;
  let refreshCount = 0;
  const scheduler = createWorkspaceInvalidationScheduler({
    ...clock,
    debounceMs: 75,
    isBlocked: () => false,
    refresh: () => {
      refreshCount += 1;
      if (refreshCount === 1) {
        return new Promise((resolve) => {
          finishFirstRefresh = resolve;
        });
      }
      return Promise.resolve();
    },
  });

  scheduler.requestInvalidation();
  await clock.runNext();
  assert.equal(scheduler.getState().refreshing, true);

  scheduler.requestInvalidation();
  assert.equal(clock.pendingCount(), 0);
  finishFirstRefresh();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(clock.pendingCount(), 1);
  await clock.runNext();
  assert.equal(refreshCount, 2);
});

test("disposing the scheduler cancels timers and ignores later events", async () => {
  const clock = createFakeClock();
  let refreshCount = 0;
  const scheduler = createWorkspaceInvalidationScheduler({
    ...clock,
    isBlocked: () => false,
    refresh: async () => {
      refreshCount += 1;
    },
  });

  scheduler.requestInvalidation();
  scheduler.dispose();
  scheduler.requestInvalidation();
  scheduler.notifyWorkspaceClean();

  assert.equal(clock.pendingCount(), 0);
  assert.equal(refreshCount, 0);
  assert.equal(scheduler.getState().disposed, true);
});

test("task deletion is revision constrained and treats a zero-row result as a conflict", async () => {
  const operations = [];
  const client = {
    from(table) {
      operations.push(["from", table]);
      return {
        delete() {
          operations.push(["delete"]);
          return this;
        },
        eq(column, value) {
          operations.push(["eq", column, value]);
          return this;
        },
        select(columns) {
          operations.push(["select", columns]);
          return this;
        },
        async maybeSingle() {
          operations.push(["maybeSingle"]);
          return { data: null, error: null };
        },
      };
    },
  };

  const result = await deleteTaskWithRevision({
    client,
    expectedRevision: 9,
    taskId: "0d911357-5e4d-45ef-a079-1cd407dfd531",
  });

  assert.deepEqual(result, { conflict: true, deleted: false });
  assert.deepEqual(operations, [
    ["from", "tasks"],
    ["delete"],
    ["eq", "id", "0d911357-5e4d-45ef-a079-1cd407dfd531"],
    ["eq", "revision", 9],
    ["select", "id"],
    ["maybeSingle"],
  ]);
});

test("task acknowledgement advances revision without overwriting a later local edit", () => {
  const currentTasks = [
    {
      id: "draft-1",
      revision: 0,
      title: "edited while the request was in flight",
      note: "keep me",
      remoteDetached: true,
    },
  ];

  const acknowledged = acknowledgeTaskWrite(currentTasks, {
    localTaskId: "draft-1",
    remoteTaskId: "0d911357-5e4d-45ef-a079-1cd407dfd531",
    revision: 1,
  });

  assert.deepEqual(acknowledged, [
    {
      id: "0d911357-5e4d-45ef-a079-1cd407dfd531",
      revision: 1,
      title: "edited while the request was in flight",
      note: "keep me",
      remoteDetached: false,
    },
  ]);
});

test("a durable task acknowledgement survives a later dependent-write failure", async () => {
  let currentTasks = [{ id: "task-1", revision: 3, title: "Current title" }];
  currentTasks = acknowledgeTaskWrite(currentTasks, {
    localTaskId: "task-1",
    remoteTaskId: "task-1",
    revision: 4,
  });

  await assert.rejects(
    async () => {
      throw new Error("tag replacement failed");
    },
    /tag replacement failed/,
  );
  assert.equal(currentTasks[0].revision, 4);
  assert.equal(currentTasks[0].title, "Current title");
});

test("a task acknowledgement only clears the exact captured dirty generation", () => {
  const dirtyWrites = new Map([["task-1", 7]]);

  dirtyWrites.set("task-1", 8);
  assert.equal(
    clearAcknowledgedDirtyWrite(dirtyWrites, "task-1", 7),
    false,
  );
  assert.equal(dirtyWrites.get("task-1"), 8);

  assert.equal(
    clearAcknowledgedDirtyWrite(dirtyWrites, "task-1", 8),
    true,
  );
  assert.equal(dirtyWrites.has("task-1"), false);
});

test("an ambiguous task insert is recovered by its stable id", async () => {
  const committedRow = {
    id: "0d911357-5e4d-45ef-a079-1cd407dfd531",
    revision: 1,
  };
  let insertCount = 0;
  let lookupCount = 0;

  const result = await executeIdempotentTaskInsert({
    insert: async () => {
      insertCount += 1;
      throw new Error("response was lost after commit");
    },
    lookup: async () => {
      lookupCount += 1;
      return { data: committedRow, error: null };
    },
  });

  assert.equal(insertCount, 1);
  assert.equal(lookupCount, 1);
  assert.deepEqual(result, committedRow);
});

test("workspace write retry delays are exponential and bounded", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5].map((attempt) =>
      nextWorkspaceSyncRetryDelay(attempt, {
        baseDelay: 500,
        maxDelay: 5_000,
      }),
    ),
    [500, 1_000, 2_000, 4_000, 5_000, 5_000],
  );
});

test("a failed workspace write schedules a retry transition", async () => {
  const clock = createFakeClock();
  let retryCount = 0;
  const scheduled = scheduleWorkspaceSyncRetry({
    attempt: 2,
    baseDelay: 125,
    maxDelay: 1_000,
    onRetry: () => {
      retryCount += 1;
    },
    setTimeoutFn: clock.setTimeoutFn,
  });

  assert.equal(scheduled.delay, 500);
  assert.equal(clock.pendingCount(), 1);
  assert.equal(retryCount, 0);
  await clock.runNext();
  assert.equal(retryCount, 1);
});

test("pending-write detection includes settings, sessions, and cancellations", () => {
  const clean = {
    dirtyCancellationIds: new Map(),
    dirtyCategoryIds: new Map(),
    dirtyProjectIds: new Map(),
    dirtySessionIds: new Map(),
    dirtySettings: new Map(),
    dirtyTaskIds: new Map(),
    fullRemoteSyncNeeded: false,
    remoteSyncInFlight: false,
    remoteSyncQueued: false,
  };

  assert.equal(hasPendingWorkspaceWrites(clean), false);
  for (const field of [
    "dirtySettings",
    "dirtySessionIds",
    "dirtyCancellationIds",
  ]) {
    assert.equal(
      hasPendingWorkspaceWrites({
        ...clean,
        [field]: new Map([["write", 1]]),
      }),
      true,
      `${field} must block an authoritative refresh`,
    );
  }
});

test("a running task missing remotely is retained as detached from future timer records", () => {
  const runningTask = {
    id: "0d911357-5e4d-45ef-a079-1cd407dfd531",
    revision: 4,
    title: "Still timing locally",
  };

  const retained = mergeRemoteTasksPreservingTimer(
    [],
    [runningTask],
    runningTask.id,
    true,
  );
  assert.deepEqual(retained, [{ ...runningTask, remoteDetached: true }]);
  assert.equal(taskIdForTimerRecord(retained[0]), null);

  const remoteTask = { ...runningTask, revision: 5 };
  const refreshed = mergeRemoteTasksPreservingTimer(
    [remoteTask],
    retained,
    runningTask.id,
    true,
  );
  assert.deepEqual(refreshed, [{ ...remoteTask, remoteDetached: false }]);
  assert.equal(taskIdForTimerRecord(refreshed[0]), runningTask.id);
});

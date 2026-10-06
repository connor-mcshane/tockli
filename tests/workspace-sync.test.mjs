import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSPACE_REALTIME_TABLES,
  acknowledgeTaskWrite,
  clearPermanentDependentWrite,
  clearAcknowledgedDirtyWrite,
  createWorkspaceInvalidationScheduler,
  deleteTaskWithRevision,
  detachMissingTaskReferences,
  executeIdempotentTaskInsert,
  hasPendingWorkspaceWrites,
  insertLegacyUnsyncedTask,
  isPermanentWorkspaceWriteError,
  mergeRemoteTasksPreservingTimer,
  nextWorkspaceSyncRetryDelay,
  normalizeStoredTaskRevision,
  runGuardedWorkspaceRefresh,
  scheduleWorkspaceSyncRetry,
  taskIdForTimerRecord,
  writeTaskWithRevision,
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

test("an authoritative refresh is requeued when a local edit begins during its fetch", async () => {
  let authUserId = "user-a";
  let workspaceWriteVersion = 4;
  let resolveFetch;
  let markFetchStarted;
  let appliedSnapshot = null;
  let requeueCount = 0;
  const fetchStarted = new Promise((resolve) => {
    markFetchStarted = resolve;
  });
  const fetched = new Promise((resolve) => {
    resolveFetch = resolve;
  });

  const refresh = runGuardedWorkspaceRefresh({
    apply: async ({ snapshot }) => {
      appliedSnapshot = snapshot;
    },
    captureContext: () => ({ authUserId, workspaceWriteVersion }),
    isContextCurrent: (started) =>
      started.authUserId === authUserId &&
      started.workspaceWriteVersion === workspaceWriteVersion,
    load: async () => {
      markFetchStarted();
      return fetched;
    },
    onStale: () => {
      requeueCount += 1;
    },
  });

  await fetchStarted;
  workspaceWriteVersion += 1;
  resolveFetch({ snapshot: { tasks: [{ id: "remote-old" }] } });

  assert.deepEqual(await refresh, {
    applied: false,
    result: { snapshot: { tasks: [{ id: "remote-old" }] } },
  });
  assert.equal(appliedSnapshot, null, "a stale snapshot must not clear newer dirty state");
  assert.equal(requeueCount, 1);

  authUserId = "user-b";
  const currentResult = await runGuardedWorkspaceRefresh({
    apply: async ({ snapshot }) => {
      appliedSnapshot = snapshot;
    },
    captureContext: () => ({ authUserId, workspaceWriteVersion }),
    isContextCurrent: (started) =>
      started.authUserId === authUserId &&
      started.workspaceWriteVersion === workspaceWriteVersion,
    load: async () => ({ snapshot: { tasks: [{ id: "remote-current" }] } }),
    onStale: () => {
      requeueCount += 1;
    },
  });
  assert.equal(currentResult.applied, true);
  assert.deepEqual(appliedSnapshot, { tasks: [{ id: "remote-current" }] });

  let resolveIdentityFetch;
  const identityFetch = new Promise((resolve) => {
    resolveIdentityFetch = resolve;
  });
  const identityRefresh = runGuardedWorkspaceRefresh({
    apply: async () => {
      assert.fail("a snapshot fetched for the prior identity must not apply");
    },
    captureContext: () => ({ authUserId, workspaceWriteVersion }),
    isContextCurrent: (started) =>
      started.authUserId === authUserId &&
      started.workspaceWriteVersion === workspaceWriteVersion,
    load: async () => identityFetch,
    onStale: () => {
      requeueCount += 1;
    },
  });
  authUserId = "user-c";
  resolveIdentityFetch({ snapshot: { tasks: [{ id: "wrong-user" }] } });
  assert.equal((await identityRefresh).applied, false);
  assert.equal(requeueCount, 2);
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

test("a legacy UUID task without a revision stays unsynced and inserts during migration", async () => {
  const legacyTaskId = "0d911357-5e4d-45ef-a079-1cd407dfd531";
  assert.equal(normalizeStoredTaskRevision(undefined), 0);
  assert.equal(normalizeStoredTaskRevision(null), 0);
  assert.equal(normalizeStoredTaskRevision(7), 7);

  let insertCount = 0;
  const result = await insertLegacyUnsyncedTask({
    findExisting: async () => ({ data: null, error: null }),
    insert: async () => {
      insertCount += 1;
      return { data: { id: legacyTaskId, revision: 1 }, error: null };
    },
    lookup: async () => ({ data: null, error: null }),
  });

  assert.equal(insertCount, 1);
  assert.deepEqual(result, {
    status: "inserted",
    task: { id: legacyTaskId, revision: 1 },
  });

  let unsafeInsertCount = 0;
  const existing = await insertLegacyUnsyncedTask({
    findExisting: async () => ({
      data: { id: legacyTaskId, revision: 9 },
      error: null,
    }),
    insert: async () => {
      unsafeInsertCount += 1;
      return { data: null, error: null };
    },
    lookup: async () => ({ data: null, error: null }),
  });
  assert.equal(unsafeInsertCount, 0, "an unknown remote row must not be overwritten");
  assert.equal(existing.status, "conflict");
  assert.equal(existing.task.revision, 9);
});

test("timer completion detaches from a remotely deleted task and releases dirty writes", async () => {
  const taskId = "0d911357-5e4d-45ef-a079-1cd407dfd531";
  const sessionId = "10e7af34-705d-4ada-9d1d-6f3e48f8c16e";
  const cancellationId = "8835ef99-ec68-48a4-8806-8c6d8b441942";
  const taskWrite = await writeTaskWithRevision({
    readCurrent: async () => ({ data: null, error: null }),
    update: async () => ({ data: null, error: null }),
  });
  assert.deepEqual(taskWrite, { status: "missing", task: null });

  const detached = detachMissingTaskReferences(
    [{ id: sessionId, taskId, minutes: 25 }],
    new Set([taskId]),
  );
  assert.deepEqual(detached, {
    detachedRecordIds: [sessionId],
    records: [{ id: sessionId, taskId: null, minutes: 25 }],
  });
  const detachedCancellations = detachMissingTaskReferences(
    [{ id: cancellationId, taskId, reason: "interrupted" }],
    new Set([taskId]),
  );
  assert.deepEqual(detachedCancellations, {
    detachedRecordIds: [cancellationId],
    records: [{ id: cancellationId, taskId: null, reason: "interrupted" }],
  });

  const dirtyTaskIds = new Map([[taskId, 11]]);
  const dirtySessionIds = new Map([[sessionId, 12]]);
  const dirtyCancellationIds = new Map([[cancellationId, 13]]);
  assert.equal(clearAcknowledgedDirtyWrite(dirtyTaskIds, taskId, 11), true);
  assert.equal(clearAcknowledgedDirtyWrite(dirtySessionIds, sessionId, 12), true);
  assert.equal(
    clearAcknowledgedDirtyWrite(dirtyCancellationIds, cancellationId, 13),
    true,
  );
  assert.equal(
    hasPendingWorkspaceWrites({
      dirtyCancellationIds,
      dirtyCategoryIds: new Map(),
      dirtyProjectIds: new Map(),
      dirtySessionIds,
      dirtySettings: new Map(),
      dirtyTaskIds,
      fullRemoteSyncNeeded: false,
      remoteSyncInFlight: false,
      remoteSyncQueued: false,
    }),
    false,
    "the queued authoritative reload must no longer be deadlocked",
  );
});

test("permanent FK and RLS dependent failures are quarantined without clearing newer edits", () => {
  assert.equal(isPermanentWorkspaceWriteError({ code: "23503" }), true);
  assert.equal(isPermanentWorkspaceWriteError({ code: "42501" }), true);
  assert.equal(isPermanentWorkspaceWriteError({ status: 403 }), true);
  assert.equal(isPermanentWorkspaceWriteError({ code: "57014" }), false);

  const dirtyWrites = new Map([["session-1", 8]]);
  assert.equal(
    clearPermanentDependentWrite({
      capturedVersion: 7,
      dirtyWrites,
      error: { code: "23503" },
      recordId: "session-1",
    }),
    true,
  );
  assert.equal(dirtyWrites.get("session-1"), 8);
  assert.equal(
    clearPermanentDependentWrite({
      capturedVersion: 8,
      dirtyWrites,
      error: { code: "42501" },
      recordId: "session-1",
    }),
    true,
  );
  assert.equal(dirtyWrites.has("session-1"), false);
  assert.equal(
    clearPermanentDependentWrite({
      capturedVersion: 1,
      dirtyWrites: new Map([["session-2", 1]]),
      error: { code: "57014" },
      recordId: "session-2",
    }),
    false,
  );
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

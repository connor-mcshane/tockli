import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSPACE_REALTIME_TABLES,
  createWorkspaceInvalidationScheduler,
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

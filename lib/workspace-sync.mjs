export const WORKSPACE_REALTIME_TABLES = Object.freeze([
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

export function createWorkspaceInvalidationScheduler({
  clearTimeoutFn = clearTimeout,
  debounceMs = 250,
  isBlocked,
  refresh,
  setTimeoutFn = setTimeout,
}) {
  if (typeof isBlocked !== "function" || typeof refresh !== "function") {
    throw new TypeError("isBlocked and refresh must be functions");
  }
  if (!Number.isFinite(debounceMs) || debounceMs < 0) {
    throw new TypeError("debounceMs must be a non-negative number");
  }

  let disposed = false;
  let queued = false;
  let refreshing = false;
  let timerId = null;

  function cancelTimer() {
    if (timerId !== null) {
      clearTimeoutFn(timerId);
      timerId = null;
    }
  }

  function schedule(delay) {
    cancelTimer();
    timerId = setTimeoutFn(() => {
      timerId = null;
      void flush();
    }, delay);
  }

  async function flush() {
    if (disposed || !queued || refreshing || isBlocked()) {
      return;
    }

    queued = false;
    refreshing = true;
    try {
      await refresh();
    } finally {
      refreshing = false;
      if (!disposed && queued && !isBlocked()) {
        schedule(0);
      }
    }
  }

  return {
    dispose() {
      disposed = true;
      queued = false;
      cancelTimer();
    },
    getState() {
      return {
        disposed,
        queued,
        refreshing,
        timerScheduled: timerId !== null,
      };
    },
    notifyWorkspaceClean() {
      if (!disposed && queued && !refreshing && !isBlocked()) {
        schedule(0);
      }
    },
    requestInvalidation() {
      if (disposed) {
        return;
      }
      queued = true;
      if (!refreshing) {
        schedule(debounceMs);
      }
    },
  };
}

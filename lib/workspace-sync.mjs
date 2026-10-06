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

export function acknowledgeTaskWrite(
  tasks,
  { localTaskId, remoteTaskId, revision },
) {
  return tasks.map((task) => {
    if (task.id !== localTaskId) {
      return task;
    }

    return {
      ...task,
      id: remoteTaskId,
      revision: Math.max(Number(task.revision) || 0, Number(revision) || 0),
      remoteDetached: false,
    };
  });
}

export function clearAcknowledgedDirtyWrite(
  dirtyWrites,
  recordId,
  capturedVersion,
) {
  if (dirtyWrites.get(recordId) !== capturedVersion) {
    return false;
  }
  dirtyWrites.delete(recordId);
  return true;
}

function collectionHasEntries(collection) {
  return Boolean(collection && collection.size > 0);
}

export function hasPendingWorkspaceWrites({
  dirtyCancellationIds,
  dirtyCategoryIds,
  dirtyProjectIds,
  dirtySessionIds,
  dirtySettings,
  dirtyTaskIds,
  fullRemoteSyncNeeded,
  remoteSyncInFlight,
  remoteSyncQueued,
}) {
  return Boolean(
    remoteSyncInFlight ||
      remoteSyncQueued ||
      fullRemoteSyncNeeded ||
      collectionHasEntries(dirtyProjectIds) ||
      collectionHasEntries(dirtyCategoryIds) ||
      collectionHasEntries(dirtyTaskIds) ||
      collectionHasEntries(dirtySettings) ||
      collectionHasEntries(dirtySessionIds) ||
      collectionHasEntries(dirtyCancellationIds),
  );
}

export function mergeRemoteTasksPreservingTimer(
  remoteTasks,
  currentTasks,
  focusTaskId,
  preserveTimer,
) {
  const authoritativeTasks = remoteTasks.map((task) => ({
    ...task,
    remoteDetached: false,
  }));
  if (
    !preserveTimer ||
    !focusTaskId ||
    authoritativeTasks.some((task) => task.id === focusTaskId)
  ) {
    return authoritativeTasks;
  }

  const runningTask = currentTasks.find((task) => task.id === focusTaskId);
  return runningTask
    ? [...authoritativeTasks, { ...runningTask, remoteDetached: true }]
    : authoritativeTasks;
}

export function taskIdForTimerRecord(task) {
  return task && !task.remoteDetached ? task.id : null;
}

export function nextWorkspaceSyncRetryDelay(
  attempt,
  { baseDelay = 500, maxDelay = 5_000 } = {},
) {
  if (!Number.isInteger(attempt) || attempt < 0) {
    throw new TypeError("attempt must be a non-negative integer");
  }
  if (
    !Number.isFinite(baseDelay) ||
    baseDelay < 0 ||
    !Number.isFinite(maxDelay) ||
    maxDelay < baseDelay
  ) {
    throw new TypeError("retry delays must be finite and non-negative");
  }
  return Math.min(maxDelay, baseDelay * 2 ** attempt);
}

export function scheduleWorkspaceSyncRetry({
  attempt,
  baseDelay = undefined,
  maxDelay = undefined,
  onRetry,
  setTimeoutFn = setTimeout,
}) {
  if (typeof onRetry !== "function" || typeof setTimeoutFn !== "function") {
    throw new TypeError("onRetry and setTimeoutFn must be functions");
  }
  const delay = nextWorkspaceSyncRetryDelay(attempt, {
    ...(baseDelay === undefined ? {} : { baseDelay }),
    ...(maxDelay === undefined ? {} : { maxDelay }),
  });
  return {
    delay,
    timerId: setTimeoutFn(onRetry, delay),
  };
}

export async function executeIdempotentTaskInsert({ insert, lookup }) {
  if (typeof insert !== "function" || typeof lookup !== "function") {
    throw new TypeError("insert and lookup must be functions");
  }

  let insertFailure;
  try {
    const result = await insert();
    if (result?.error) {
      throw result.error;
    }
    const row = result?.data ?? result;
    if (!row) {
      throw new Error("Task insert returned no row");
    }
    return row;
  } catch (error) {
    insertFailure = error;
  }

  try {
    const result = await lookup();
    if (!result?.error && result?.data) {
      return result.data;
    }
  } catch {
    // Preserve the insert failure: it is the operation the caller must retry.
  }
  throw insertFailure;
}

export async function deleteTaskWithRevision({
  client,
  expectedRevision,
  taskId,
}) {
  const { data, error } = await client
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("revision", expectedRevision)
    .select("id")
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data
    ? { conflict: false, deleted: true }
    : { conflict: true, deleted: false };
}

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

/**
 * Pick a project without discarding a user's locally persisted selection when
 * fresh remote data arrives.
 *
 * @param {Array<{ id: string }>} projects
 * @param {string | undefined} preferredProjectId
 */
export function resolveActiveProjectId(projects, preferredProjectId) {
  if (
    preferredProjectId &&
    projects.some((project) => project.id === preferredProjectId)
  ) {
    return preferredProjectId;
  }

  return projects[0]?.id ?? "";
}

/**
 * Keep the user's selected card when it still belongs to the active project.
 * Fall back to the first unfinished card only when that selection disappeared.
 *
 * @param {Array<{ id: string, projectId: string, status: string }>} tasks
 * @param {string} activeProjectId
 * @param {string | undefined} preferredTaskId
 * @param {string} [doneColumnId]
 */
export function resolveSelectedTaskId(
  tasks,
  activeProjectId,
  preferredTaskId,
  doneColumnId = "done",
) {
  const projectTasks = tasks.filter(
    (task) => task.projectId === activeProjectId,
  );

  if (
    preferredTaskId &&
    projectTasks.some((task) => task.id === preferredTaskId)
  ) {
    return preferredTaskId;
  }

  return (
    projectTasks.find((task) => task.status !== doneColumnId)?.id ??
    projectTasks[0]?.id ??
    ""
  );
}

/**
 * Move a task to a precise position in a board stack without disturbing the
 * relative order of the remaining cards.
 *
 * @template {{ id: string, projectId: string, status: string, completedAt?: string | null }} T
 * @param {T[]} tasks
 * @param {string} taskId
 * @param {string} status
 * @param {Array<{ id: string, isDone?: boolean }>} columns
 * @param {string | null} [targetTaskId]
 * @param {"before" | "after"} [placement]
 * @param {string} [completedAt]
 * @returns {T[]}
 */
export function reorderTaskInList(
  tasks,
  taskId,
  status,
  columns,
  targetTaskId = null,
  placement = "before",
  completedAt = new Date().toISOString(),
) {
  const sourceIndex = tasks.findIndex((task) => task.id === taskId);
  if (sourceIndex === -1) {
    return tasks;
  }

  const sourceTask = tasks[sourceIndex];
  if (targetTaskId === taskId && sourceTask.status === status) {
    return tasks;
  }

  const targetTask = targetTaskId
    ? tasks.find(
        (task) =>
          task.id === targetTaskId && task.projectId === sourceTask.projectId,
      )
    : null;
  const reordered = tasks.filter((task) => task.id !== taskId);
  const movedTask = moveTaskWithCompletion(
    sourceTask,
    status,
    columns,
    completedAt,
  );
  let insertionIndex = reordered.length;

  if (targetTask) {
    const targetIndex = reordered.findIndex((task) => task.id === targetTask.id);
    insertionIndex = targetIndex + (placement === "after" ? 1 : 0);
  } else {
    const lastTargetIndex = reordered.reduce(
      (lastIndex, task, index) =>
        task.projectId === sourceTask.projectId && task.status === status
          ? index
          : lastIndex,
      -1,
    );

    if (lastTargetIndex >= 0) {
      insertionIndex = lastTargetIndex + 1;
    }
  }

  reordered.splice(insertionIndex, 0, movedTask);
  return reordered;
}

/**
 * Match all words in a task query across the useful board-card fields.
 *
 * @param {{ title: string, description?: string, due?: string, tags?: string[] }} task
 * @param {string} query
 * @param {string} [categoryName]
 */
export function taskMatchesSearch(task, query, categoryName = "") {
  const terms = query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (!terms.length) {
    return true;
  }

  const searchableText = [
    task.title,
    task.description,
    task.due,
    ...(task.tags ?? []),
    categoryName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();

  return terms.every((term) => searchableText.includes(term));
}

/**
 * Build a Monday-aligned activity range that finishes today, rather than
 * padding the final week with future dates.
 *
 * @param {Date} currentDate
 * @param {number} [weekCount]
 */
export function buildRecentActivityDates(currentDate, weekCount = 26) {
  const today = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
  );
  const mondayOffset = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(start.getDate() - ((weekCount - 1) * 7 + mondayOffset));

  const dayCount = (weekCount - 1) * 7 + mondayOffset + 1;

  return Array.from({ length: dayCount }, (_, index) => {
    const day = new Date(start);
    day.setDate(day.getDate() + index);
    return day;
  });
}

/**
 * Apply a board status change while keeping the task completion timestamp in
 * sync with whichever custom column is marked as done.
 *
 * @template {object} T
 * @param {T & { status: string, completedAt?: string | null }} task
 * @param {string} status
 * @param {Array<{ id: string, isDone?: boolean }>} columns
 * @param {string} [completedAt]
 * @returns {T & { status: string, completedAt: string | null }}
 */
export function moveTaskWithCompletion(
  task,
  status,
  columns,
  completedAt = new Date().toISOString(),
) {
  const isDone = columns.some(
    (column) => column.id === status && Boolean(column.isDone),
  );

  return {
    ...task,
    status,
    completedAt: isDone ? task.completedAt ?? completedAt : null,
  };
}

/**
 * Find tasks whose persisted status/completion fields change when a column is
 * removed. The move destination and a newly promoted done column can differ
 * when the deleted done column was reordered away from the end of the board.
 *
 * @param {Array<{ id: string, projectId: string, status: string }>} tasks
 * @param {string} projectId
 * @param {string} deletedColumnId
 * @param {string | null} promotedDoneColumnId
 */
export function taskIdsAffectedByColumnDeletion(
  tasks,
  projectId,
  deletedColumnId,
  promotedDoneColumnId,
) {
  return tasks
    .filter(
      (task) =>
        task.projectId === projectId &&
        (task.status === deletedColumnId ||
          task.status === promotedDoneColumnId),
    )
    .map((task) => task.id);
}

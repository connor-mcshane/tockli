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

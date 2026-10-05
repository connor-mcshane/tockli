import {
  TockliError,
  createTockliAuth,
  mapSupabaseError,
} from "./tockli-auth.mjs";

export { TockliError } from "./tockli-auth.mjs";

export const DEFAULT_TASK_LIMIT = 100;
export const MAX_TASK_LIMIT = 500;

const PROJECT_COLUMNS =
  "id,owner_id,name,description,kind,color,board_columns,created_at,updated_at";
const TASK_COLUMNS =
  "id,project_id,category_id,title,note,status,priority,estimate_minutes,spent_minutes,due_label,sort_order,created_by,completed_at,revision,created_at,updated_at";
const FOCUS_SESSION_COLUMNS =
  "id,user_id,project_id,task_id,minutes,note,completed_at,created_at";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIORITIES = new Set(["low", "medium", "high"]);
const UPDATE_FIELDS = new Set([
  "categoryId",
  "dueLabel",
  "estimateMinutes",
  "note",
  "priority",
  "spentMinutes",
  "status",
  "title",
]);

function validation(message) {
  return new TockliError("TOCKLI_VALIDATION", message);
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw validation(`${label} must be an object.`);
  }
  return value;
}

function requireUuid(value, label) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw validation(`${label} must be a UUID.`);
  }
  return value;
}

function optionalText(value, label, { nullable = false } = {}) {
  if (nullable && value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw validation(`${label} must be a string${nullable ? " or null" : ""}.`);
  }
  return value;
}

function nonEmptyText(value, label, maximum = Infinity) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw validation(`${label} must be a non-empty string.`);
  }
  const normalized = value.trim();
  if (normalized.length > maximum) {
    throw validation(`${label} must be at most ${maximum} characters.`);
  }
  return normalized;
}

function integerInRange(value, label, minimum, maximum = Infinity) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    const range = Number.isFinite(maximum)
      ? `between ${minimum} and ${maximum}`
      : `at least ${minimum}`;
    throw validation(`${label} must be an integer ${range}.`);
  }
  return value;
}

function throwQueryError(error) {
  if (error) {
    throw mapSupabaseError(error);
  }
}

export function mapProjectRow(row) {
  return {
    boardColumns: Array.isArray(row.board_columns) ? row.board_columns : [],
    color: row.color,
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    kind: row.kind,
    name: row.name,
    ownerId: row.owner_id,
    updatedAt: row.updated_at,
  };
}

export function mapTaskRow(row) {
  return {
    categoryId: row.category_id ?? null,
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
    createdBy: row.created_by,
    dueLabel: row.due_label ?? null,
    estimateMinutes: row.estimate_minutes,
    id: row.id,
    note: row.note ?? "",
    priority: row.priority,
    projectId: row.project_id,
    revision: Number(row.revision),
    sortOrder: row.sort_order,
    spentMinutes: row.spent_minutes,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

export function mapFocusSessionRow(row) {
  return {
    completedAt: row.completed_at,
    createdAt: row.created_at,
    id: row.id,
    minutes: row.minutes,
    note: row.note ?? "",
    projectId: row.project_id,
    taskId: row.task_id ?? null,
    userId: row.user_id,
  };
}

function firstActiveColumn(boardColumns) {
  if (!Array.isArray(boardColumns)) {
    return null;
  }
  return (
    boardColumns.find(
      (column) =>
        column &&
        typeof column.id === "string" &&
        column.id.trim() &&
        !column.archived &&
        !column.isDone,
    )?.id ?? null
  );
}

function doneColumn(boardColumns) {
  if (!Array.isArray(boardColumns)) {
    return "done";
  }
  return (
    boardColumns.find(
      (column) =>
        column && typeof column.id === "string" && column.id.trim() && column.isDone,
    )?.id ?? "done"
  );
}

function validatePatch(patch) {
  requireObject(patch, "patch");
  const entries = Object.entries(patch);
  if (entries.length === 0) {
    throw validation("patch must include at least one supported field.");
  }
  for (const [field] of entries) {
    if (!UPDATE_FIELDS.has(field)) {
      throw validation(`patch field '${field}' is not supported.`);
    }
  }

  const databasePatch = {};
  if (Object.hasOwn(patch, "title")) {
    databasePatch.title = nonEmptyText(patch.title, "patch.title");
  }
  if (Object.hasOwn(patch, "note")) {
    databasePatch.note = optionalText(patch.note, "patch.note");
  }
  if (Object.hasOwn(patch, "status")) {
    databasePatch.status = nonEmptyText(patch.status, "patch.status", 120);
  }
  if (Object.hasOwn(patch, "priority")) {
    if (!PRIORITIES.has(patch.priority)) {
      throw validation("patch.priority must be low, medium, or high.");
    }
    databasePatch.priority = patch.priority;
  }
  if (Object.hasOwn(patch, "estimateMinutes")) {
    databasePatch.estimate_minutes = integerInRange(
      patch.estimateMinutes,
      "patch.estimateMinutes",
      1,
      480,
    );
  }
  if (Object.hasOwn(patch, "spentMinutes")) {
    databasePatch.spent_minutes = integerInRange(
      patch.spentMinutes,
      "patch.spentMinutes",
      0,
    );
  }
  if (Object.hasOwn(patch, "dueLabel")) {
    databasePatch.due_label = optionalText(patch.dueLabel, "patch.dueLabel", {
      nullable: true,
    });
  }
  if (Object.hasOwn(patch, "categoryId")) {
    databasePatch.category_id =
      patch.categoryId === null
        ? null
        : requireUuid(patch.categoryId, "patch.categoryId");
  }
  return databasePatch;
}

export function createTockliApi(options = {}) {
  const auth =
    options.auth ??
    createTockliAuth({
      client: options.client,
      clientFactory: options.clientFactory,
      configDir: options.configDir,
      env: options.env,
      homeDir: options.homeDir,
      platform: options.platform,
    });
  const client = options.client ?? auth.client;

  async function listProjects() {
    const { data, error } = await client
      .from("projects")
      .select(PROJECT_COLUMNS)
      .order("created_at", { ascending: true });
    throwQueryError(error);
    return (data ?? []).map(mapProjectRow);
  }

  async function listTasks(input = {}) {
    requireObject(input, "input");
    const projectId =
      input.projectId === undefined
        ? undefined
        : requireUuid(input.projectId, "projectId");
    const status =
      input.status === undefined
        ? undefined
        : nonEmptyText(input.status, "status", 120);
    const limit =
      input.limit === undefined
        ? DEFAULT_TASK_LIMIT
        : integerInRange(input.limit, "limit", 1, MAX_TASK_LIMIT);

    let query = client
      .from("tasks")
      .select(TASK_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (projectId) {
      query = query.eq("project_id", projectId);
    }
    if (status) {
      query = query.eq("status", status);
    }
    const { data, error } = await query.limit(limit);
    throwQueryError(error);
    return (data ?? []).map(mapTaskRow);
  }

  async function readProjectBoard(projectId) {
    const { data, error } = await client
      .from("projects")
      .select("id,board_columns")
      .eq("id", projectId)
      .maybeSingle();
    throwQueryError(error);
    if (!data) {
      throw new TockliError(
        "TOCKLI_NOT_FOUND",
        "The requested resource was not found or is not accessible.",
      );
    }
    return data.board_columns;
  }

  async function createTask(input) {
    requireObject(input, "input");
    const projectId = requireUuid(input.projectId, "projectId");
    const title = nonEmptyText(input.title, "title");
    const note =
      input.note === undefined ? "" : optionalText(input.note, "note");
    const priority = input.priority ?? "medium";
    if (!PRIORITIES.has(priority)) {
      throw validation("priority must be low, medium, or high.");
    }
    const estimateMinutes =
      input.estimateMinutes === undefined
        ? 25
        : integerInRange(input.estimateMinutes, "estimateMinutes", 1, 480);
    const dueLabel =
      input.dueLabel === undefined
        ? null
        : optionalText(input.dueLabel, "dueLabel", { nullable: true });
    const requestedStatus =
      input.status === undefined
        ? undefined
        : nonEmptyText(input.status, "status", 120);

    const boardColumns = await readProjectBoard(projectId);
    const status =
      requestedStatus === undefined ? firstActiveColumn(boardColumns) : requestedStatus;
    if (!status) {
      throw validation("The project does not have an active board column.");
    }
    const user = await auth.getCurrentUser();
    const { data, error } = await client
      .from("tasks")
      .insert({
        created_by: user.id,
        due_label: dueLabel,
        estimate_minutes: estimateMinutes,
        note,
        priority,
        project_id: projectId,
        status,
        title,
      })
      .select(TASK_COLUMNS)
      .single();
    throwQueryError(error);
    return mapTaskRow(data);
  }

  async function classifyMissingRevisionUpdate(taskId) {
    const { data, error } = await client
      .from("tasks")
      .select("id,revision")
      .eq("id", taskId)
      .maybeSingle();
    throwQueryError(error);
    if (!data) {
      throw new TockliError(
        "TOCKLI_NOT_FOUND",
        "The requested resource was not found or is not accessible.",
      );
    }
    const currentRevision = Number(data.revision);
    throw new TockliError(
      "TOCKLI_CONFLICT",
      `The task changed since revision ${currentRevision}. Reload it and try again.`,
      { details: { currentRevision }, currentRevision },
    );
  }

  async function revisionUpdate(taskId, expectedRevision, databasePatch) {
    const { data, error } = await client
      .from("tasks")
      .update(databasePatch)
      .eq("id", taskId)
      .eq("revision", expectedRevision)
      .select(TASK_COLUMNS)
      .maybeSingle();
    throwQueryError(error);
    if (!data) {
      return classifyMissingRevisionUpdate(taskId);
    }
    return mapTaskRow(data);
  }

  async function updateTask(input) {
    requireObject(input, "input");
    const taskId = requireUuid(input.taskId, "taskId");
    const expectedRevision = integerInRange(
      input.expectedRevision,
      "expectedRevision",
      1,
    );
    const databasePatch = validatePatch(input.patch);
    return revisionUpdate(taskId, expectedRevision, databasePatch);
  }

  async function completeTask(input) {
    requireObject(input, "input");
    const taskId = requireUuid(input.taskId, "taskId");
    const expectedRevision = integerInRange(
      input.expectedRevision,
      "expectedRevision",
      1,
    );
    const { data: task, error: taskError } = await client
      .from("tasks")
      .select("id,project_id")
      .eq("id", taskId)
      .maybeSingle();
    throwQueryError(taskError);
    if (!task) {
      throw new TockliError(
        "TOCKLI_NOT_FOUND",
        "The requested resource was not found or is not accessible.",
      );
    }
    const boardColumns = await readProjectBoard(task.project_id);
    return revisionUpdate(taskId, expectedRevision, {
      status: doneColumn(boardColumns),
    });
  }

  async function logFocusSession(input) {
    requireObject(input, "input");
    const projectId = requireUuid(input.projectId, "projectId");
    const taskId =
      input.taskId === undefined || input.taskId === null
        ? null
        : requireUuid(input.taskId, "taskId");
    const minutes = integerInRange(input.minutes, "minutes", 1, 480);
    const note =
      input.note === undefined ? "" : optionalText(input.note, "note");
    const user = await auth.getCurrentUser();
    const { data, error } = await client
      .from("focus_sessions")
      .insert({
        minutes,
        note,
        project_id: projectId,
        task_id: taskId,
        user_id: user.id,
      })
      .select(FOCUS_SESSION_COLUMNS)
      .single();
    throwQueryError(error);
    return mapFocusSessionRow(data);
  }

  return {
    client,
    completeTask,
    createTask,
    getCurrentUser: auth.getCurrentUser,
    listProjects,
    listTasks,
    loginWithPassword: auth.loginWithPassword,
    logFocusSession,
    logout: auth.logout,
    restoreSession: auth.restoreSession,
    updateTask,
  };
}

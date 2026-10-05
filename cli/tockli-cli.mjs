import { createInterface } from "node:readline";
import { parseArgs } from "node:util";

import { TockliError, createTockliApi } from "../lib/tockli-api.mjs";

const OPTION_DEFINITIONS = {
  category: { type: "string" },
  "due-label": { type: "string" },
  email: { type: "string" },
  "estimate-minutes": { type: "string" },
  json: { type: "boolean" },
  limit: { type: "string" },
  minutes: { type: "string" },
  note: { type: "string" },
  "password-stdin": { type: "boolean" },
  priority: { type: "string" },
  project: { type: "string" },
  revision: { type: "string" },
  "spent-minutes": { type: "string" },
  status: { type: "string" },
  task: { type: "string" },
  title: { type: "string" },
};

const COMMANDS = new Map([
  ["auth login", new Set(["email", "password-stdin", "json"])],
  ["auth status", new Set(["json"])],
  ["auth logout", new Set(["json"])],
  ["projects list", new Set(["json"])],
  ["tasks list", new Set(["project", "status", "limit", "json"])],
  [
    "tasks create",
    new Set([
      "project",
      "title",
      "note",
      "status",
      "priority",
      "estimate-minutes",
      "due-label",
      "json",
    ]),
  ],
  [
    "tasks update",
    new Set([
      "revision",
      "title",
      "note",
      "status",
      "priority",
      "estimate-minutes",
      "spent-minutes",
      "due-label",
      "category",
      "json",
    ]),
  ],
  ["tasks complete", new Set(["revision", "json"])],
  ["focus log", new Set(["project", "task", "minutes", "note", "json"])],
]);

const USER_ERROR_CODES = new Set([
  "TOCKLI_AUTH_FAILED",
  "TOCKLI_AUTH_REQUIRED",
  "TOCKLI_CONFIG",
  "TOCKLI_FORBIDDEN",
  "TOCKLI_NOT_FOUND",
  "TOCKLI_VALIDATION",
]);

const SECRET_KEYS = new Set([
  "accesstoken",
  "authorization",
  "password",
  "refreshtoken",
  "token",
]);

function validation(message) {
  return new TockliError("TOCKLI_VALIDATION", message);
}

function optionPresent(values, name) {
  return Object.hasOwn(values, name);
}

function requireOption(values, name) {
  if (!optionPresent(values, name)) {
    throw validation(`--${name} is required.`);
  }
  return values[name];
}

function optionalInteger(values, name) {
  if (!optionPresent(values, name)) {
    return undefined;
  }
  const value = values[name];
  if (!/^(?:0|[1-9]\d*)$/.test(value)) {
    throw validation(`--${name} must be an integer.`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw validation(`--${name} must be a safe integer.`);
  }
  return number;
}

function setOptional(target, key, values, optionName = key) {
  if (optionPresent(values, optionName)) {
    target[key] = values[optionName];
  }
}

function parseOptions(argv) {
  try {
    return parseArgs({
      allowPositionals: true,
      args: argv,
      options: OPTION_DEFINITIONS,
      strict: true,
      tokens: true,
    });
  } catch {
    throw validation("Invalid command options.");
  }
}

function validateOptionUse(commandName, values, tokens) {
  const allowed = COMMANDS.get(commandName);
  if (!allowed) {
    throw validation("Unknown command.");
  }
  const counts = new Map();
  for (const token of tokens) {
    if (token.kind !== "option") {
      continue;
    }
    if (!allowed.has(token.name)) {
      throw validation(`--${token.name} is not valid for ${commandName}.`);
    }
    counts.set(token.name, (counts.get(token.name) ?? 0) + 1);
    if (counts.get(token.name) > 1) {
      throw validation(`--${token.name} may only be supplied once.`);
    }
  }
  if (values.json !== undefined && values.json !== true) {
    throw validation("--json does not accept a value.");
  }
}

export function parseCliArgs(argv) {
  if (!Array.isArray(argv)) {
    throw validation("CLI arguments must be an array.");
  }
  const { positionals, tokens, values } = parseOptions(argv);
  const [group, action, identifier, ...extraPositionals] = positionals;
  const commandName = `${group ?? ""} ${action ?? ""}`.trim();
  validateOptionUse(commandName, values, tokens);

  const expectsIdentifier =
    commandName === "tasks update" || commandName === "tasks complete";
  if (expectsIdentifier) {
    if (!identifier || extraPositionals.length > 0) {
      throw validation(`${commandName} requires exactly one task UUID.`);
    }
  } else if (identifier !== undefined || extraPositionals.length > 0) {
    throw validation(`${commandName} does not accept positional arguments.`);
  }

  const parsed = {
    command: commandName.replace(" ", "."),
    input: {},
    json: values.json === true,
  };

  switch (commandName) {
    case "auth login":
      parsed.input.email = requireOption(values, "email");
      if (values["password-stdin"] !== true) {
        throw validation("auth login requires --password-stdin.");
      }
      break;
    case "auth status":
    case "auth logout":
    case "projects list":
      break;
    case "tasks list":
      setOptional(parsed.input, "projectId", values, "project");
      setOptional(parsed.input, "status", values);
      if (optionPresent(values, "limit")) {
        parsed.input.limit = optionalInteger(values, "limit");
      }
      break;
    case "tasks create":
      parsed.input.projectId = requireOption(values, "project");
      parsed.input.title = requireOption(values, "title");
      setOptional(parsed.input, "note", values);
      setOptional(parsed.input, "status", values);
      setOptional(parsed.input, "priority", values);
      setOptional(parsed.input, "dueLabel", values, "due-label");
      if (optionPresent(values, "estimate-minutes")) {
        parsed.input.estimateMinutes = optionalInteger(values, "estimate-minutes");
      }
      break;
    case "tasks update": {
      parsed.input.taskId = identifier;
      parsed.input.expectedRevision = optionalInteger(values, "revision");
      if (parsed.input.expectedRevision === undefined) {
        throw validation("--revision is required.");
      }
      const patch = {};
      setOptional(patch, "title", values);
      setOptional(patch, "note", values);
      setOptional(patch, "status", values);
      setOptional(patch, "priority", values);
      setOptional(patch, "dueLabel", values, "due-label");
      setOptional(patch, "categoryId", values, "category");
      if (optionPresent(values, "estimate-minutes")) {
        patch.estimateMinutes = optionalInteger(values, "estimate-minutes");
      }
      if (optionPresent(values, "spent-minutes")) {
        patch.spentMinutes = optionalInteger(values, "spent-minutes");
      }
      if (Object.keys(patch).length === 0) {
        throw validation("tasks update requires at least one patch option.");
      }
      parsed.input.patch = patch;
      break;
    }
    case "tasks complete":
      parsed.input.taskId = identifier;
      parsed.input.expectedRevision = optionalInteger(values, "revision");
      if (parsed.input.expectedRevision === undefined) {
        throw validation("--revision is required.");
      }
      break;
    case "focus log":
      parsed.input.projectId = requireOption(values, "project");
      parsed.input.minutes = optionalInteger(values, "minutes");
      if (parsed.input.minutes === undefined) {
        throw validation("--minutes is required.");
      }
      setOptional(parsed.input, "taskId", values, "task");
      setOptional(parsed.input, "note", values);
      break;
    default:
      throw validation("Unknown command.");
  }
  return parsed;
}

function publicData(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object") {
    return value;
  }
  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => publicData(item, seen));
  }
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
    if (!SECRET_KEYS.has(normalizedKey)) {
      output[key] = publicData(item, seen);
    }
  }
  return output;
}

function publicError(error) {
  if (error instanceof TockliError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: "TOCKLI_UNEXPECTED",
    message: "Tockli could not complete the request.",
  };
}

export function successEnvelope(data) {
  return JSON.stringify({ ok: true, data: publicData(data) });
}

export function errorEnvelope(error) {
  return JSON.stringify({ ok: false, error: publicError(error) });
}

export function exitCodeForError(error) {
  if (!(error instanceof TockliError)) {
    return 1;
  }
  if (error.code === "TOCKLI_CONFLICT") {
    return 3;
  }
  return USER_ERROR_CODES.has(error.code) ? 2 : 1;
}

async function readPasswordLine(input) {
  const lines = createInterface({ crlfDelay: Infinity, input, terminal: false });
  try {
    for await (const line of lines) {
      return line;
    }
    return "";
  } finally {
    lines.close();
  }
}

async function executeCommand(parsed, api, stdin) {
  switch (parsed.command) {
    case "auth.login":
      return api.loginWithPassword({
        email: parsed.input.email,
        password: await readPasswordLine(stdin),
      });
    case "auth.status":
      return api.restoreSession();
    case "auth.logout": {
      try {
        await api.restoreSession();
      } catch (error) {
        if (
          !(error instanceof TockliError) ||
          !["TOCKLI_AUTH_FAILED", "TOCKLI_AUTH_REQUIRED"].includes(error.code)
        ) {
          throw error;
        }
      }
      return api.logout();
    }
    case "projects.list":
      await api.restoreSession();
      return api.listProjects();
    case "tasks.list":
      await api.restoreSession();
      return api.listTasks(parsed.input);
    case "tasks.create":
      await api.restoreSession();
      return api.createTask(parsed.input);
    case "tasks.update":
      await api.restoreSession();
      return api.updateTask(parsed.input);
    case "tasks.complete":
      await api.restoreSession();
      return api.completeTask(parsed.input);
    case "focus.log":
      await api.restoreSession();
      return api.logFocusSession(parsed.input);
    default:
      throw validation("Unknown command.");
  }
}

function humanOutput(command, rawData) {
  const data = publicData(rawData);
  switch (command) {
    case "auth.login":
      return `Logged in as ${data.email ?? data.id}.`;
    case "auth.status":
      return `Signed in as ${data.email ?? data.id}.`;
    case "auth.logout":
      return "Logged out.";
    case "projects.list":
      return data.length === 0
        ? "No projects."
        : data.map((project) => `${project.id}\t${project.name}\t${project.kind}`).join("\n");
    case "tasks.list":
      return data.length === 0
        ? "No tasks."
        : data
            .map(
              (task) =>
                `${task.id}\tr${task.revision}\t${task.status}\t${task.title}`,
            )
            .join("\n");
    case "tasks.create":
    case "tasks.update":
    case "tasks.complete":
      return `${data.id}\tr${data.revision}\t${data.status}\t${data.title}`;
    case "focus.log":
      return `Logged ${data.minutes} minutes${data.taskId ? ` for ${data.taskId}` : ""}.`;
    default:
      return "Done.";
  }
}

export async function runCli({
  apiFactory = createTockliApi,
  argv = process.argv.slice(2),
  stderr = process.stderr,
  stdin = process.stdin,
  stdout = process.stdout,
} = {}) {
  let parsed;
  const requestedJson = Array.isArray(argv) && argv.includes("--json");
  try {
    parsed = parseCliArgs(argv);
    const api = apiFactory();
    const data = await executeCommand(parsed, api, stdin);
    stdout.write(
      parsed.json
        ? `${successEnvelope(data)}\n`
        : `${humanOutput(parsed.command, data)}\n`,
    );
    return 0;
  } catch (error) {
    if (parsed?.json || requestedJson) {
      stdout.write(`${errorEnvelope(error)}\n`);
    } else {
      const safe = publicError(error);
      stderr.write(`${safe.code}: ${safe.message}\n`);
    }
    return exitCodeForError(error);
  }
}

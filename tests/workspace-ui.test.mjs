import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRecentActivityDates,
  moveTaskWithCompletion,
  resolveActiveProjectId,
  taskIdsAffectedByColumnDeletion,
  taskMatchesSearch,
} from "../lib/workspace-ui.mjs";

test("keeps a persisted project when it still exists remotely", () => {
  const projects = [{ id: "first" }, { id: "remembered" }];

  assert.equal(resolveActiveProjectId(projects, "remembered"), "remembered");
  assert.equal(resolveActiveProjectId(projects, "removed"), "first");
  assert.equal(resolveActiveProjectId([], "remembered"), "");
});

test("task search matches useful card fields and rejects unrelated queries", () => {
  const task = {
    description: "Prepare the release notes",
    due: "Friday",
    tags: ["launch", "writing"],
    title: "Publish Tockli",
  };

  assert.equal(taskMatchesSearch(task, "publish"), true);
  assert.equal(taskMatchesSearch(task, "release launch"), true);
  assert.equal(taskMatchesSearch(task, "design", "Product Design"), true);
  assert.equal(taskMatchesSearch(task, "zzz"), false);
  assert.equal(taskMatchesSearch(task, "  "), true);
});

test("activity dates are Monday-aligned and never include future days", () => {
  const today = new Date(2026, 7, 5, 18, 30);
  const dates = buildRecentActivityDates(today);

  assert.equal(dates[0].getDay(), 1);
  assert.deepEqual(dates.at(-1), new Date(2026, 7, 5));
  assert.equal(dates.some((date) => date > today), false);
  assert.equal(dates.length, 178);
});

test("task completion timestamps follow the project's done column", () => {
  const completedAt = "2026-08-07T12:00:00.000Z";
  const columns = [
    { id: "todo" },
    { id: "shipped", isDone: true },
  ];
  const task = { id: "task-1", status: "todo", completedAt: null };

  const completed = moveTaskWithCompletion(task, "shipped", columns, completedAt);
  assert.equal(completed.completedAt, completedAt);

  const stillCompleted = moveTaskWithCompletion(
    completed,
    "shipped",
    columns,
    "2026-08-08T12:00:00.000Z",
  );
  assert.equal(stillCompleted.completedAt, completedAt);

  const reopened = moveTaskWithCompletion(completed, "todo", columns);
  assert.equal(reopened.completedAt, null);
});

test("deleting a reordered done column dirties moved and newly completed tasks", () => {
  const tasks = [
    { id: "moved", projectId: "project-1", status: "done" },
    { id: "fallback", projectId: "project-1", status: "active" },
    { id: "newly-done", projectId: "project-1", status: "backlog" },
    { id: "other-project", projectId: "project-2", status: "backlog" },
  ];

  assert.deepEqual(
    taskIdsAffectedByColumnDeletion(
      tasks,
      "project-1",
      "done",
      "backlog",
    ),
    ["moved", "newly-done"],
  );
});

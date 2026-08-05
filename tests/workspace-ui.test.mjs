import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRecentActivityDates,
  resolveActiveProjectId,
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

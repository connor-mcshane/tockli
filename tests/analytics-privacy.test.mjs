import assert from "node:assert/strict";
import test from "node:test";

import {
  privacySignalsAllowAnalytics,
  sanitizeAnalyticsProperties,
  sanitizeAnalyticsReferrer,
} from "../lib/analytics-privacy.mjs";

test("analytics properties drop direct identifiers and user-authored content", () => {
  const properties = sanitizeAnalyticsProperties({
    destination: "/signup",
    display_name: "Ada",
    email: "ada@example.com",
    experiment_id: "landing-focus-score",
    project_id: "private-project-id",
    session_note: "Personal session note",
    surface: "landing",
    task_title: "Confidential task",
    undefined_value: undefined,
  });

  assert.deepEqual(properties, {
    destination: "/signup",
    experiment_id: "landing-focus-score",
    surface: "landing",
  });
});

test("analytics string properties are bounded", () => {
  const properties = sanitizeAnalyticsProperties({ value: "x".repeat(250) });

  assert.equal(properties.value.length, 200);
});

test("analytics honors Do Not Track and Global Privacy Control", () => {
  assert.equal(privacySignalsAllowAnalytics({}), true);
  assert.equal(privacySignalsAllowAnalytics({ doNotTrack: "1" }), false);
  assert.equal(privacySignalsAllowAnalytics({ doNotTrack: "yes" }), false);
  assert.equal(privacySignalsAllowAnalytics({ globalPrivacyControl: true }), false);
});

test("analytics referrers never retain query strings or fragments", () => {
  assert.equal(
    sanitizeAnalyticsReferrer("https://example.com/invite?token=secret#join"),
    "https://example.com/invite",
  );
  assert.equal(sanitizeAnalyticsReferrer("not a URL"), "");
});

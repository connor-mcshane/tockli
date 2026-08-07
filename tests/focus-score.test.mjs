import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_WORKING_DAYS,
  calculateFocusScore,
  calculateFocusScoreTrend,
  focusScoreBand,
} from "../lib/focus-score.mjs";

// Sunday 2026-08-02 through Saturday 2026-08-08. "Now" is the Friday, so the
// seven-day window is Sat 1st through Fri 7th and contains five working days.
const NOW = new Date(2026, 7, 7, 18, 0, 0);

function at(day, hour = 10) {
  return new Date(2026, 7, day, hour, 0, 0).toISOString();
}

function sessionsOn(days, perDay) {
  return days.flatMap((day) =>
    Array.from({ length: perDay }, (_, index) => ({
      completedAt: at(day, 9 + index),
    })),
  );
}

const settings = { workingDays: DEFAULT_WORKING_DAYS, dailyPomodoroGoal: 4 };

test("a full week on plan scores 100", () => {
  const workdays = [3, 4, 5, 6, 7];

  const result = calculateFocusScore({
    now: NOW,
    settings,
    sessions: sessionsOn(workdays, 4),
    cancellations: [],
    completedTasks: workdays.map((day) => ({ completedAt: at(day, 17) })),
  });

  assert.equal(result.unlocked, true);
  assert.equal(result.score, 100);
  assert.equal(result.band.label, "Deep flow");
  assert.equal(result.biggestOpportunity, null);
  assert.deepEqual(result.window, { from: "2026-08-01", to: "2026-08-07" });
});

test("a week with no activity at all stays locked rather than scoring zero", () => {
  const result = calculateFocusScore({ now: NOW, settings });

  assert.equal(result.unlocked, false);
  assert.equal(result.score, null);
  assert.equal(result.band, null);
  assert.equal(result.daysUntilUnlock, 3);
  assert.equal(result.provisionalScore, 0);
});

test("the score unlocks on the third active day", () => {
  const twoDays = calculateFocusScore({
    now: NOW,
    settings,
    sessions: sessionsOn([6, 7], 1),
  });
  assert.equal(twoDays.unlocked, false);
  assert.equal(twoDays.daysUntilUnlock, 1);

  const threeDays = calculateFocusScore({
    now: NOW,
    settings,
    sessions: sessionsOn([5, 6, 7], 1),
  });
  assert.equal(threeDays.unlocked, true);
  assert.equal(typeof threeDays.score, "number");
});

test("showing up every working day but missing the goal keeps consistency full", () => {
  const result = calculateFocusScore({
    now: NOW,
    settings,
    sessions: sessionsOn([3, 4, 5, 6, 7], 1),
    completedTasks: null,
  });

  const byId = Object.fromEntries(
    result.components.map((component) => [component.id, component]),
  );

  assert.equal(byId.consistency.ratio, 1);
  assert.equal(byId.goal.ratio, 0.25);
  assert.equal(byId.followThrough.ratio, 1);
  assert.equal(byId.completion, undefined);
});

test("one heroic day cannot pay for four empty ones", () => {
  const crammed = calculateFocusScore({
    now: NOW,
    settings,
    sessions: sessionsOn([7], 20),
    completedTasks: [],
  });
  const spread = calculateFocusScore({
    now: NOW,
    settings,
    sessions: sessionsOn([3, 4, 5, 6, 7], 4),
    completedTasks: [],
  });

  assert.ok(spread.provisionalScore > crammed.provisionalScore * 2);
});

test("a rest-day session covers exactly one missed working day", () => {
  const withWeekend = calculateFocusScore({
    now: NOW,
    settings,
    sessions: sessionsOn([1, 4, 5, 6, 7], 4),
    completedTasks: null,
  });
  const withoutWeekend = calculateFocusScore({
    now: NOW,
    settings,
    sessions: sessionsOn([4, 5, 6, 7], 4),
    completedTasks: null,
  });

  const consistencyOf = (result) =>
    result.components.find((component) => component.id === "consistency").ratio;

  assert.equal(consistencyOf(withWeekend), 1);
  assert.equal(consistencyOf(withoutWeekend), 0.8);
});

test("rest-day credit never pushes consistency past full marks", () => {
  const result = calculateFocusScore({
    now: NOW,
    settings,
    sessions: sessionsOn([1, 2, 3, 4, 5, 6, 7], 4),
  });

  const consistency = result.components.find(
    (component) => component.id === "consistency",
  );
  assert.equal(consistency.ratio, 1);
});

test("abandoned sessions only cost the follow-through component", () => {
  const result = calculateFocusScore({
    now: NOW,
    settings,
    sessions: sessionsOn([3, 4, 5, 6, 7], 4),
    cancellations: [{ cancelledAt: at(4, 15) }, { cancelledAt: at(6, 15) }],
    completedTasks: null,
  });

  const followThrough = result.components.find(
    (component) => component.id === "followThrough",
  );

  assert.equal(followThrough.ratio, 20 / 22);
  assert.equal(result.biggestOpportunity.id, "followThrough");
});

test("dropping the task component redistributes its weight instead of scoring zero", () => {
  const shared = {
    now: NOW,
    settings,
    sessions: sessionsOn([3, 4, 5, 6, 7], 4),
  };

  const unavailable = calculateFocusScore({ ...shared, completedTasks: null });
  const noneFinished = calculateFocusScore({ ...shared, completedTasks: [] });

  assert.equal(unavailable.score, 100);
  assert.equal(unavailable.components.length, 3);
  assert.equal(unavailable.totals.completedTasks, null);

  assert.equal(noneFinished.score, 80);
  assert.equal(noneFinished.components.length, 4);
  assert.equal(noneFinished.biggestOpportunity.id, "completion");
});

test("finishing one card per working day earns full completion marks", () => {
  const result = calculateFocusScore({
    now: NOW,
    settings,
    sessions: sessionsOn([3, 4, 5, 6, 7], 4),
    completedTasks: [3, 4, 5, 6, 7].map((day) => ({ completedAt: at(day, 17) })),
  });

  const completion = result.components.find(
    (component) => component.id === "completion",
  );
  assert.equal(completion.ratio, 1);
  assert.equal(completion.possible, 20);
});

test("work outside the window is ignored", () => {
  const result = calculateFocusScore({
    now: NOW,
    settings,
    sessions: [
      ...sessionsOn([3, 4, 5], 4),
      { completedAt: new Date(2026, 6, 20, 10).toISOString() },
    ],
    completedTasks: null,
  });

  assert.equal(result.totals.sessions, 12);
});

test("malformed timestamps are ignored rather than throwing", () => {
  const result = calculateFocusScore({
    now: NOW,
    settings,
    sessions: [
      ...sessionsOn([3, 4, 5], 1),
      { completedAt: "not-a-date" },
      { completedAt: null },
      {},
    ],
    completedTasks: null,
  });

  assert.equal(result.totals.sessions, 3);
  assert.equal(result.unlocked, true);
});

test("someone with no working days set is scored across the whole week", () => {
  const result = calculateFocusScore({
    now: NOW,
    settings: { workingDays: [], dailyPomodoroGoal: 4 },
    sessions: sessionsOn([1, 2, 3, 4, 5, 6, 7], 4),
    completedTasks: null,
  });

  assert.equal(result.totals.workingDays, 7);
  assert.equal(result.score, 100);
});

test("a custom working-day set only counts those days", () => {
  const result = calculateFocusScore({
    now: NOW,
    settings: { workingDays: ["Mon", "Wed"], dailyPomodoroGoal: 2 },
    sessions: sessionsOn([3, 5], 2),
    completedTasks: null,
    restDayCredit: false,
  });

  assert.equal(result.totals.workingDays, 2);
  assert.equal(result.score, 100);
});

test("a part-time week unlocks on its own working days, not a flat three", () => {
  const partTime = {
    now: NOW,
    settings: { workingDays: ["Mon", "Wed"], dailyPomodoroGoal: 2 },
    completedTasks: null,
  };

  const oneDay = calculateFocusScore({ ...partTime, sessions: sessionsOn([5], 2) });
  assert.equal(oneDay.unlocked, false);
  assert.equal(oneDay.daysUntilUnlock, 1);

  const bothDays = calculateFocusScore({
    ...partTime,
    sessions: sessionsOn([3, 5], 2),
  });
  assert.equal(bothDays.unlocked, true);
});

test("the trend compares against the previous window", () => {
  const sessions = [...sessionsOn([3, 4, 5, 6, 7], 4), ...sessionsOn([1], 1)];
  const previousWeek = [
    { completedAt: new Date(2026, 6, 27, 10).toISOString() },
    { completedAt: new Date(2026, 6, 28, 10).toISOString() },
    { completedAt: new Date(2026, 6, 29, 10).toISOString() },
  ];

  const trend = calculateFocusScoreTrend({
    now: NOW,
    settings,
    sessions: [...sessions, ...previousWeek],
    completedTasks: null,
  });

  assert.equal(trend.current.unlocked, true);
  assert.equal(trend.previous.unlocked, true);
  assert.ok(trend.delta > 0);
});

test("bands cover the whole range", () => {
  assert.equal(focusScoreBand(100).label, "Deep flow");
  assert.equal(focusScoreBand(90).label, "Deep flow");
  assert.equal(focusScoreBand(89).label, "Locked in");
  assert.equal(focusScoreBand(75).label, "Locked in");
  assert.equal(focusScoreBand(74).label, "In the groove");
  assert.equal(focusScoreBand(60).label, "In the groove");
  assert.equal(focusScoreBand(59).label, "Finding rhythm");
  assert.equal(focusScoreBand(40).label, "Finding rhythm");
  assert.equal(focusScoreBand(39).label, "Warming up");
  assert.equal(focusScoreBand(0).label, "Warming up");
});

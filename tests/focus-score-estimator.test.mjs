import assert from "node:assert/strict";
import test from "node:test";

import {
  ESTIMATOR_DAILY_GOAL,
  buildFocusScoreEstimateInput,
  estimateFocusScore,
  normalizeFocusScoreEstimate,
} from "../lib/focus-score-estimator.mjs";

const NOW = new Date(2026, 7, 7, 18, 0, 0);

test("a week that hits every target estimates a score of 100", () => {
  const result = estimateFocusScore(
    {
      workDays: 5,
      activeDays: 5,
      goalDays: 5,
      completedTasks: 5,
      abandonedSessions: 0,
    },
    NOW,
  );

  assert.equal(result.score, 100);
  assert.equal(result.band.label, "Deep flow");
  assert.equal(result.biggestOpportunity, null);
});

test("the estimate uses goal days without asking visitors to count every session", () => {
  const { scoreInput } = buildFocusScoreEstimateInput(
    {
      workDays: 5,
      activeDays: 4,
      goalDays: 3,
      completedTasks: 4,
      abandonedSessions: 1,
    },
    NOW,
  );

  assert.equal(
    scoreInput.sessions.length,
    3 * ESTIMATOR_DAILY_GOAL + 1,
  );
  assert.equal(scoreInput.settings.dailyPomodoroGoal, ESTIMATOR_DAILY_GOAL);
  assert.equal(scoreInput.cancellations.length, 1);
  assert.equal(scoreInput.completedTasks.length, 4);
});

test("dependent answers are clamped so goal days cannot exceed active workdays", () => {
  assert.deepEqual(
    normalizeFocusScoreEstimate({
      workDays: 3,
      activeDays: 9,
      goalDays: 8,
      completedTasks: -2,
      abandonedSessions: 99,
    }),
    {
      workDays: 3,
      activeDays: 3,
      goalDays: 3,
      completedTasks: 0,
      abandonedSessions: 12,
    },
  );
});

test("a shorter chosen workweek can still earn a full score", () => {
  const result = estimateFocusScore(
    {
      workDays: 2,
      activeDays: 2,
      goalDays: 2,
      completedTasks: 2,
      abandonedSessions: 0,
    },
    NOW,
  );

  assert.equal(result.score, 100);
  assert.equal(result.totals.workingDays, 2);
});

test("showing up and finishing cards materially outweigh follow-through", () => {
  const strongWeekWithBails = estimateFocusScore(
    {
      workDays: 5,
      activeDays: 5,
      goalDays: 5,
      completedTasks: 5,
      abandonedSessions: 12,
    },
    NOW,
  );
  const littleWorkWithNoBails = estimateFocusScore(
    {
      workDays: 5,
      activeDays: 1,
      goalDays: 0,
      completedTasks: 0,
      abandonedSessions: 0,
    },
    NOW,
  );

  assert.ok(strongWeekWithBails.score > littleWorkWithNoBails.score * 2);
});

test("no activity produces a zero preview instead of throwing", () => {
  const result = estimateFocusScore(
    {
      workDays: 5,
      activeDays: 0,
      goalDays: 0,
      completedTasks: 0,
      abandonedSessions: 0,
    },
    NOW,
  );

  assert.equal(result.score, 0);
  assert.equal(result.band.label, "Warming up");
});

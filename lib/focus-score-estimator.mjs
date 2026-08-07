import {
  calculateFocusScore,
  focusScoreBand,
} from "./focus-score.mjs";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WORKDAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const DEFAULT_FOCUS_SCORE_ESTIMATE = {
  workDays: 5,
  activeDays: 4,
  goalDays: 3,
  completedTasks: 4,
  abandonedSessions: 1,
};

export const ESTIMATOR_DAILY_GOAL = 4;

function wholeNumber(value, min, max) {
  const number = Number.isFinite(Number(value)) ? Math.round(Number(value)) : min;
  return Math.min(max, Math.max(min, number));
}

/** Keep dependent answers honest when a range is moved out of order. */
export function normalizeFocusScoreEstimate(input = {}) {
  const workDays = wholeNumber(input.workDays, 1, 7);
  const activeDays = wholeNumber(input.activeDays, 0, workDays);

  return {
    workDays,
    activeDays,
    goalDays: wholeNumber(input.goalDays, 0, activeDays),
    completedTasks: wholeNumber(input.completedTasks, 0, 14),
    abandonedSessions: wholeNumber(input.abandonedSessions, 0, 12),
  };
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function dateForWeekday(now, weekday) {
  const end = startOfDay(now);

  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(end);
    date.setDate(date.getDate() - offset);

    if (WEEKDAY_LABELS[date.getDay()] === weekday) {
      date.setHours(10, 0, 0, 0);
      return date;
    }
  }

  return end;
}

function timestamp(date, offsetMinutes = 0) {
  const value = new Date(date);
  value.setMinutes(value.getMinutes() + offsetMinutes);
  return value.toISOString();
}

/**
 * Turn the landing-page answers into the same event shape used by the app.
 * A hit day gets the assumed four sessions; another active day gets one. That
 * preserves the engine's deliberate distinction between showing up and hitting
 * the daily goal without making the visitor count every pomodoro they ran.
 */
export function buildFocusScoreEstimateInput(input = {}, now = new Date()) {
  const answers = normalizeFocusScoreEstimate(input);
  const workingDays = WORKDAY_ORDER.slice(0, answers.workDays);
  const activeDates = workingDays
    .slice(0, answers.activeDays)
    .map((day) => dateForWeekday(now, day));

  const sessions = activeDates.flatMap((date, activeIndex) => {
    const sessionCount = activeIndex < answers.goalDays ? ESTIMATOR_DAILY_GOAL : 1;

    return Array.from({ length: sessionCount }, (_, sessionIndex) => ({
      completedAt: timestamp(date, sessionIndex * 30),
    }));
  });

  const fallbackDate = dateForWeekday(now, workingDays[0]);
  const activityDates = activeDates.length ? activeDates : [fallbackDate];
  const completedTasks = Array.from({ length: answers.completedTasks }, (_, index) => ({
    completedAt: timestamp(activityDates[index % activityDates.length], 8 * 60 + index),
  }));
  const cancellations = Array.from(
    { length: answers.abandonedSessions },
    (_, index) => ({
      cancelledAt: timestamp(activityDates[index % activityDates.length], 12 * 60 + index),
    }),
  );

  return {
    answers,
    scoreInput: {
      now,
      sessions,
      cancellations,
      completedTasks,
      restDayCredit: false,
      settings: {
        workingDays,
        dailyPomodoroGoal: ESTIMATOR_DAILY_GOAL,
      },
    },
  };
}

/** Calculate a useful preview immediately; app scores still use unlock rules. */
export function estimateFocusScore(input = {}, now = new Date()) {
  const { answers, scoreInput } = buildFocusScoreEstimateInput(input, now);
  const result = calculateFocusScore(scoreInput);
  const score = result.provisionalScore;

  return {
    ...result,
    score,
    band: focusScoreBand(score),
    answers,
  };
}

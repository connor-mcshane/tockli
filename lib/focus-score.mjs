/**
 * Focus Score
 *
 * A single 0-100 number that answers "did I actually do the work I said I would
 * this week?". It is deliberately built from four things a person can picture
 * and change, rather than from raw minutes, because minutes reward long messy
 * days and punish efficient ones.
 *
 *   Consistency   (35) - did you show up at all on your working days?
 *   Goal          (30) - did you hit your daily session goal on those days?
 *   Completion    (20) - did cards actually finish, or just get worked on?
 *   Follow-through(15) - did the sessions you started survive to the end?
 *
 * Consistency and Goal are scoped to working days only, so a rest day never
 * costs points. Completion and Follow-through count every day in the window,
 * so weekend work is credited but never required.
 *
 * Components can be reported as unavailable (see `completedTasks: null`), in
 * which case their weight is redistributed across the rest instead of scoring
 * a silent zero.
 */

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const DEFAULT_WORKING_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
export const DEFAULT_DAILY_GOAL = 6;
export const DEFAULT_WINDOW_DAYS = 7;

/** Days of recorded activity before a score is shown at all. */
export const UNLOCK_ACTIVE_DAYS = 3;

export const FOCUS_SCORE_WEIGHTS = {
  consistency: 35,
  goal: 30,
  completion: 20,
  followThrough: 15,
};

export const FOCUS_SCORE_BANDS = [
  { min: 90, label: "Deep flow", tone: "green" },
  { min: 75, label: "Locked in", tone: "green" },
  { min: 60, label: "In the groove", tone: "amber" },
  { min: 40, label: "Finding rhythm", tone: "amber" },
  { min: 0, label: "Warming up", tone: "crimson" },
];

const COMPONENT_COPY = {
  consistency: {
    label: "Consistency",
    hint: "Start at least one session on each of your working days.",
  },
  goal: {
    label: "Daily goal",
    hint: "Get closer to your daily session goal on the days you work.",
  },
  completion: {
    label: "Cards finished",
    hint: "Finish cards, not just sessions. One a working day scores full marks.",
  },
  followThrough: {
    label: "Follow-through",
    hint: "Fewer abandoned sessions. Try a shorter block if you keep bailing.",
  },
};

/** Local-time YYYY-MM-DD, so a session at 23:50 counts for the day you felt it. */
export function dayKey(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * The days in the window, oldest first, each tagged with whether it is a
 * working day for this person.
 */
function buildWindow(now, windowDays, workingDays) {
  const normalizedWorkingDays = Array.isArray(workingDays)
    ? workingDays.filter((day) => WEEKDAY_LABELS.includes(day))
    : [];

  // Someone with no working days set still deserves a score, so treat every
  // day as fair game rather than dividing by zero.
  const effectiveWorkingDays = normalizedWorkingDays.length
    ? normalizedWorkingDays
    : WEEKDAY_LABELS;

  const end = startOfDay(now);
  const days = [];

  for (let offset = windowDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(end);
    date.setDate(date.getDate() - offset);

    days.push({
      key: dayKey(date),
      weekday: WEEKDAY_LABELS[date.getDay()],
      isWorkingDay: effectiveWorkingDays.includes(WEEKDAY_LABELS[date.getDay()]),
    });
  }

  return days;
}

function countByDay(entries, timestampKey, windowKeys) {
  const counts = new Map();

  for (const entry of entries ?? []) {
    const key = dayKey(entry?.[timestampKey]);

    if (key && windowKeys.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return counts;
}

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function allocateWholePoints(available, totalWeight) {
  const allocations = available.map(([name], index) => {
    const exact = (FOCUS_SCORE_WEIGHTS[name] / totalWeight) * 100;

    return {
      exact,
      index,
      name,
      possible: Math.floor(exact),
    };
  });
  const remainder = 100 - allocations.reduce(
    (total, allocation) => total + allocation.possible,
    0,
  );

  const byRemainder = [...allocations].sort(
    (left, right) =>
      (right.exact - right.possible) - (left.exact - left.possible) ||
      left.index - right.index,
  );

  for (let index = 0; index < remainder; index += 1) {
    byRemainder[index].possible += 1;
  }

  return new Map(allocations.map(({ name, possible }) => [name, possible]));
}

export function focusScoreBand(score) {
  return (
    FOCUS_SCORE_BANDS.find((band) => score >= band.min) ??
    FOCUS_SCORE_BANDS[FOCUS_SCORE_BANDS.length - 1]
  );
}

/**
 * @param {object} input
 * @param {Array<{ completedAt: string }>} input.sessions            completed focus sessions
 * @param {Array<{ cancelledAt: string }>} [input.cancellations]     abandoned sessions
 * @param {Array<{ completedAt: string }> | null} [input.completedTasks]
 *        Cards finished, with the time they were finished. Pass `null` when the
 *        data is not available yet; the component is dropped and its weight is
 *        shared out rather than scored as zero.
 * @param {object} [input.settings]  { workingDays, dailyPomodoroGoal }
 * @param {Date | string} [input.now]
 * @param {number} [input.windowDays]
 * @param {boolean} [input.restDayCredit]
 *        When true (default) a session on a non-working day can cover exactly
 *        one missed working day, so catching up at the weekend is rewarded.
 */
export function calculateFocusScore({
  sessions = [],
  cancellations = [],
  completedTasks = [],
  settings = {},
  now = new Date(),
  windowDays = DEFAULT_WINDOW_DAYS,
  restDayCredit = true,
} = {}) {
  const workingDays = settings.workingDays ?? DEFAULT_WORKING_DAYS;
  const dailyGoal = Math.max(1, Math.round(settings.dailyPomodoroGoal ?? DEFAULT_DAILY_GOAL));

  const days = buildWindow(now, Math.max(1, Math.round(windowDays)), workingDays);
  const windowKeys = new Set(days.map((day) => day.key));
  const workingDayList = days.filter((day) => day.isWorkingDay);

  const sessionsByDay = countByDay(sessions, "completedAt", windowKeys);
  const cancellationsByDay = countByDay(cancellations, "cancelledAt", windowKeys);
  const tasksByDay =
    completedTasks === null
      ? null
      : countByDay(completedTasks, "completedAt", windowKeys);

  const sessionCount = [...sessionsByDay.values()].reduce((a, b) => a + b, 0);
  const cancellationCount = [...cancellationsByDay.values()].reduce((a, b) => a + b, 0);
  const taskCount = tasksByDay
    ? [...tasksByDay.values()].reduce((a, b) => a + b, 0)
    : 0;

  const activeDays = sessionsByDay.size;

  // --- Consistency -------------------------------------------------------
  const workedWorkingDays = workingDayList.filter((day) =>
    sessionsByDay.has(day.key),
  ).length;
  const restDayBonus =
    restDayCredit &&
    days.some((day) => !day.isWorkingDay && sessionsByDay.has(day.key))
      ? 1
      : 0;
  const consistency = workingDayList.length
    ? clamp01((workedWorkingDays + restDayBonus) / workingDayList.length)
    : 0;

  // --- Daily goal --------------------------------------------------------
  // Averaged per day rather than summed, so one enormous day cannot pay for
  // four empty ones.
  const goal = workingDayList.length
    ? workingDayList.reduce(
        (total, day) => total + clamp01((sessionsByDay.get(day.key) ?? 0) / dailyGoal),
        0,
      ) / workingDayList.length
    : 0;

  // --- Cards finished ----------------------------------------------------
  const taskTarget = Math.max(1, workingDayList.length);
  const completion = tasksByDay ? clamp01(taskCount / taskTarget) : null;

  // --- Follow-through ----------------------------------------------------
  const attempts = sessionCount + cancellationCount;
  const followThrough = attempts ? clamp01(sessionCount / attempts) : 0;

  const ratios = { consistency, goal, completion, followThrough };
  const available = Object.entries(ratios).filter(([, ratio]) => ratio !== null);
  const totalWeight = available.reduce(
    (total, [name]) => total + FOCUS_SCORE_WEIGHTS[name],
    0,
  );
  const possibleByComponent = allocateWholePoints(available, totalWeight);

  const components = available.map(([name, ratio]) => {
    // Redistribute the weight of any dropped component across the rest.
    const possible = possibleByComponent.get(name);
    const earned = Math.round(possible * ratio);

    return {
      id: name,
      label: COMPONENT_COPY[name].label,
      hint: COMPONENT_COPY[name].hint,
      ratio,
      earned,
      possible,
      lost: possible - earned,
    };
  });

  const score = components.reduce((total, component) => total + component.earned, 0);

  // Everyone starts at zero, and a zero on day one reads as a verdict rather
  // than a starting point. Hold the number back until there is a real week.
  // Someone who only works two days a week can never reach the flat threshold,
  // so scale it down to their week rather than locking them out forever.
  const requiredActiveDays = Math.min(UNLOCK_ACTIVE_DAYS, workingDayList.length || UNLOCK_ACTIVE_DAYS);
  const unlocked = activeDays >= requiredActiveDays;

  const biggestOpportunity = components
    .filter((component) => component.lost > 0)
    .sort((left, right) => right.lost - left.lost)[0] ?? null;

  return {
    score: unlocked ? score : null,
    provisionalScore: score,
    unlocked,
    activeDays,
    daysUntilUnlock: Math.max(0, requiredActiveDays - activeDays),
    band: unlocked ? focusScoreBand(score) : null,
    components,
    biggestOpportunity,
    totals: {
      sessions: sessionCount,
      cancellations: cancellationCount,
      completedTasks: tasksByDay ? taskCount : null,
      workingDays: workingDayList.length,
      windowDays: days.length,
      dailyGoal,
    },
    window: {
      from: days[0]?.key ?? null,
      to: days[days.length - 1]?.key ?? null,
    },
  };
}

/**
 * The same score for the window immediately before this one, so the UI can show
 * a trend. Returns `null` when the earlier window has not unlocked, because a
 * delta against a hidden score is meaningless.
 */
export function calculateFocusScoreTrend(input = {}) {
  const windowDays = Math.max(1, Math.round(input.windowDays ?? DEFAULT_WINDOW_DAYS));
  const current = calculateFocusScore(input);

  const previousNow = startOfDay(input.now ?? new Date());
  previousNow.setDate(previousNow.getDate() - windowDays);

  const previous = calculateFocusScore({ ...input, now: previousNow });

  return {
    current,
    previous,
    delta:
      current.score !== null && previous.score !== null
        ? current.score - previous.score
        : null,
  };
}

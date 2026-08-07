"use client";

export type TockliEventName =
  | "page_view"
  | "cta_clicked"
  | "experiment_viewed"
  | "signup_started"
  | "signup_submitted"
  | "signup_failed"
  | "google_signup_clicked"
  | "auth_signup_started"
  | "auth_signup_succeeded"
  | "auth_signup_failed"
  | "login_started"
  | "login_succeeded"
  | "login_failed"
  | "oauth_started"
  | "password_reset_requested"
  | "task_created"
  | "task_status_changed"
  | "board_column_created"
  | "board_column_deleted"
  | "focus_task_changed"
  | "timer_started"
  | "timer_paused"
  | "timer_cancelled"
  | "session_completed"
  | "project_created"
  | "project_updated"
  | "project_deleted"
  | "onboarding_completed"
  | "project_invite_accepted"
  | "settings_updated"
  | "session_goal_set"
  | "focus_score_viewed"
  | "focus_score_unlocked"
  | "focus_score_estimated"
  | "streak_extended"
  | "streak_broken"
  | "streak_freeze_used"
  | "daily_goal_met"
  | "nudge_shown"
  | "nudge_clicked"
  | "weekly_recap_opened"
  | "paywall_viewed"
  | "upgrade_clicked"
  | "checkout_started"
  | "checkout_completed"
  | "ai_insight_generated"
  | "ai_insight_viewed"
  | "ai_insight_rated";

export type AnalyticsProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

type AnalyticsPayload = {
  name: TockliEventName;
  properties: AnalyticsProperties;
  anonymousId: string;
  path: string;
  title: string;
  referrer: string;
  timestamp: string;
};

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    tockliEvents?: AnalyticsPayload[];
    plausible?: (eventName: string, options?: { props?: AnalyticsProperties }) => void;
  }
}

export const ANONYMOUS_ID_KEY = "tockli.analytics.anonymousId";
export const LEGACY_ANONYMOUS_ID_KEY = "flowtimer.analytics.anonymousId";

function createAnonymousId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getAnonymousId() {
  if (typeof window === "undefined") {
    return "server";
  }

  try {
    const stored =
      window.localStorage.getItem(ANONYMOUS_ID_KEY) ??
      window.localStorage.getItem(LEGACY_ANONYMOUS_ID_KEY);
    if (stored) {
      window.localStorage.setItem(ANONYMOUS_ID_KEY, stored);
      window.localStorage.removeItem(LEGACY_ANONYMOUS_ID_KEY);
      return stored;
    }

    const anonymousId = createAnonymousId();
    window.localStorage.setItem(ANONYMOUS_ID_KEY, anonymousId);
    return anonymousId;
  } catch {
    return createAnonymousId();
  }
}

function compactProperties(properties: AnalyticsProperties) {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  ) as AnalyticsProperties;
}

export function trackEvent(
  name: TockliEventName,
  properties: AnalyticsProperties = {},
) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: AnalyticsPayload = {
    name,
    properties: compactProperties(properties),
    anonymousId: getAnonymousId(),
    path: window.location.pathname,
    title: document.title,
    referrer: document.referrer,
    timestamp: new Date().toISOString(),
  };

  window.tockliEvents = [...(window.tockliEvents ?? []), payload].slice(-100);
  window.dataLayer?.push({ event: name, ...payload });
  window.plausible?.(name, { props: payload.properties });

  const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
  if (endpoint) {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
    } else {
      void fetch(endpoint, {
        body,
        headers: { "content-type": "application/json" },
        keepalive: true,
        method: "POST",
      });
    }
  }

  if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true") {
    console.info("[Tockli analytics]", payload);
  }
}

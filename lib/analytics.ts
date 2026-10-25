"use client";

import posthog, { type CaptureResult } from "posthog-js";
import {
  getAnalyticsCampaignProperties,
  getPostHogEventName,
  privacySignalsAllowAnalytics,
  sanitizeAnalyticsProperties,
  sanitizeAnalyticsReferrer,
} from "@/lib/analytics-privacy.mjs";

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

export type AnalyticsConsent = "pending" | "granted" | "denied";

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
  interface Navigator {
    globalPrivacyControl?: boolean;
  }

  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    tockliEvents?: AnalyticsPayload[];
    plausible?: (eventName: string, options?: { props?: AnalyticsProperties }) => void;
  }
}

export const ANALYTICS_CONSENT_CHANGE_EVENT = "tockli:analytics-consent-changed";
export const ANALYTICS_CONSENT_KEY = "tockli.analytics.consent";
export const ANONYMOUS_ID_KEY = "tockli.analytics.anonymousId";
export const LEGACY_ANONYMOUS_ID_KEY = "flowtimer.analytics.anonymousId";

const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";

let anonymousId: string | undefined;
let identifiedUserId: string | undefined;
let postHogInitializationAttempted = false;
let postHogInitialized = false;

function cleanEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function createAnonymousId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getAnonymousId() {
  anonymousId ??= createAnonymousId();
  return anonymousId;
}

function removeLegacyPersistentIdentifiers() {
  try {
    window.localStorage.removeItem(ANONYMOUS_ID_KEY);
    window.localStorage.removeItem(LEGACY_ANONYMOUS_ID_KEY);
  } catch {
    // Storage may be blocked. Analytics remains memory-only either way.
  }
}

function hasBlockingPrivacySignal() {
  if (typeof window === "undefined") {
    return true;
  }

  return !privacySignalsAllowAnalytics({
    doNotTrack: navigator.doNotTrack,
    globalPrivacyControl: navigator.globalPrivacyControl,
  });
}

function readStoredConsent(): AnalyticsConsent {
  if (typeof window === "undefined") {
    return "pending";
  }

  try {
    const consent = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return consent === "granted" || consent === "denied" ? consent : "pending";
  } catch {
    return "pending";
  }
}

function writeStoredConsent(consent: Exclude<AnalyticsConsent, "pending">) {
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, consent);
  } catch {
    // If a preference cannot be persisted, default back to no collection next load.
  }
}

function dispatchConsentChange() {
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGE_EVENT));
}

export function getAnalyticsConsent(): AnalyticsConsent {
  if (hasBlockingPrivacySignal()) {
    return "denied";
  }

  return readStoredConsent();
}

export function isAnalyticsConfigured() {
  return Boolean(
    cleanEnv(process.env.NEXT_PUBLIC_POSTHOG_KEY) ||
      cleanEnv(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT),
  );
}

function isAnalyticsAllowed() {
  return getAnalyticsConsent() === "granted";
}

function getPostHogHost() {
  const configuredHost = cleanEnv(process.env.NEXT_PUBLIC_POSTHOG_HOST);

  if (!configuredHost) {
    return DEFAULT_POSTHOG_HOST;
  }

  try {
    const parsed = new URL(configuredHost);
    return ["http:", "https:"].includes(parsed.protocol)
      ? configuredHost.replace(/\/$/, "")
      : DEFAULT_POSTHOG_HOST;
  } catch {
    return DEFAULT_POSTHOG_HOST;
  }
}

function sanitizePostHogUrlProperties(captureResult: CaptureResult | null) {
  if (!captureResult) {
    return null;
  }

  const currentUrl = `${window.location.origin}${window.location.pathname}`;
  const referrer = sanitizeAnalyticsReferrer(document.referrer);

  return {
    ...captureResult,
    properties: {
      ...captureResult.properties,
      $current_url: currentUrl,
      $initial_current_url: currentUrl,
      $initial_referrer: referrer,
      $referrer: referrer,
    },
  };
}

export function initializeAnalytics() {
  if (typeof window === "undefined") {
    return false;
  }

  removeLegacyPersistentIdentifiers();

  if (!isAnalyticsAllowed()) {
    return false;
  }

  if (postHogInitializationAttempted) {
    return postHogInitialized;
  }

  const key = cleanEnv(process.env.NEXT_PUBLIC_POSTHOG_KEY);
  if (!key) {
    return false;
  }

  postHogInitializationAttempted = true;

  try {
    posthog.init(key, {
      api_host: getPostHogHost(),
      autocapture: false,
      before_send: sanitizePostHogUrlProperties,
      capture_exceptions: false,
      capture_heatmaps: false,
      capture_pageleave: true,
      capture_pageview: false,
      capture_performance: false,
      defaults: "2026-08-30",
      disable_persistence: true,
      disable_session_recording: true,
      opt_out_capturing_by_default: true,
      opt_out_capturing_persistence_type: "localStorage",
      persistence: "memory",
      person_profiles: "identified_only",
      property_denylist: [
        "email",
        "display_name",
        "session_note",
        "task_title",
        "project_id",
      ],
      respect_dnt: true,
    });
    posthog.register({ $geoip_disable: true });
    posthog.opt_in_capturing();
    postHogInitialized = true;
  } catch (error) {
    if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true") {
      console.warn("[Tockli analytics] PostHog initialization failed", error);
    }
  }

  return postHogInitialized;
}

export function grantAnalyticsConsent() {
  if (typeof window === "undefined" || hasBlockingPrivacySignal()) {
    return false;
  }

  writeStoredConsent("granted");
  const initialized = initializeAnalytics();
  if (initialized) {
    posthog.opt_in_capturing();
  }
  dispatchConsentChange();
  return initialized || Boolean(cleanEnv(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT));
}

export function denyAnalyticsConsent() {
  if (typeof window === "undefined") {
    return;
  }

  writeStoredConsent("denied");
  if (postHogInitialized) {
    posthog.opt_out_capturing();
    posthog.reset();
  }
  identifiedUserId = undefined;
  anonymousId = undefined;
  window.tockliEvents = [];
  dispatchConsentChange();
}

export const optInAnalytics = grantAnalyticsConsent;
export const optOutAnalytics = denyAnalyticsConsent;

export function hasOptedOutAnalytics() {
  return getAnalyticsConsent() === "denied";
}

export function identifyAnalyticsUser(userId: string) {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId || identifiedUserId === normalizedUserId || !initializeAnalytics()) {
    return;
  }

  try {
    // Supabase's opaque UUID is sufficient for cross-device product funnels.
    // Do not add email, display name, notes, task text, or other direct PII here.
    posthog.identify(normalizedUserId);
    identifiedUserId = normalizedUserId;
  } catch (error) {
    if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true") {
      console.warn("[Tockli analytics] PostHog identify failed", error);
    }
  }
}

export function resetAnalyticsUser() {
  identifiedUserId = undefined;
  anonymousId = undefined;

  if (postHogInitialized) {
    posthog.reset();
  }
}

export function trackEvent(
  name: TockliEventName,
  properties: AnalyticsProperties = {},
) {
  if (typeof window === "undefined" || !isAnalyticsAllowed()) {
    return;
  }

  const campaignProperties =
    name === "page_view"
      ? getAnalyticsCampaignProperties(window.location.href)
      : {};
  const safeProperties = sanitizeAnalyticsProperties({
    ...campaignProperties,
    ...properties,
  }) as AnalyticsProperties;
  const payload: AnalyticsPayload = {
    name,
    properties: safeProperties,
    anonymousId: getAnonymousId(),
    path: window.location.pathname,
    title: document.title,
    referrer: sanitizeAnalyticsReferrer(document.referrer),
    timestamp: new Date().toISOString(),
  };

  window.tockliEvents = [...(window.tockliEvents ?? []), payload].slice(-100);
  window.dataLayer?.push({ event: name, ...payload });
  window.plausible?.(name, { props: safeProperties });

  if (initializeAnalytics()) {
    try {
      posthog.capture(getPostHogEventName(name), {
        ...safeProperties,
        $current_url: `${window.location.origin}${window.location.pathname}`,
        path: payload.path,
        referrer: payload.referrer,
      });
    } catch (error) {
      if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true") {
        console.warn("[Tockli analytics] PostHog capture failed", error);
      }
    }
  }

  const endpoint = cleanEnv(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT);
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

"use client";

import { BarChart3, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import {
  ANALYTICS_CONSENT_CHANGE_EVENT,
  type AnalyticsConsent,
  denyAnalyticsConsent,
  getAnalyticsConsent,
  grantAnalyticsConsent,
  isAnalyticsConfigured,
} from "@/lib/analytics";

function subscribeToConsent(onStoreChange: () => void) {
  window.addEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, onStoreChange);
  };
}

function getServerConsent(): AnalyticsConsent {
  return "pending";
}

function getPrivacySignalBlocked() {
  return (
    navigator.globalPrivacyControl === true ||
    navigator.doNotTrack === "1" ||
    navigator.doNotTrack?.toLocaleLowerCase() === "yes"
  );
}

function subscribeToStaticBrowserSignals() {
  return () => undefined;
}

export default function AnalyticsConsentControl() {
  const configured = isAnalyticsConfigured();
  const consent = useSyncExternalStore(
    subscribeToConsent,
    getAnalyticsConsent,
    getServerConsent,
  );
  const privacySignalBlocked = useSyncExternalStore(
    subscribeToStaticBrowserSignals,
    getPrivacySignalBlocked,
    () => false,
  );
  const [preferencesOpened, setPreferencesOpened] = useState(false);
  const open = preferencesOpened || consent === "pending";

  if (!configured) {
    return null;
  }

  if (!open) {
    return (
      <button
        aria-label="Open analytics preferences"
        className="fixed bottom-3 left-3 z-[100] inline-flex items-center gap-2 rounded-full border border-[#d8d7d3] bg-white px-3 py-2 text-xs font-semibold text-[#62605b] shadow-[0_8px_24px_rgba(26,28,27,0.12)] transition hover:border-[#ff005e] hover:text-[#b90042]"
        type="button"
        onClick={() => setPreferencesOpened(true)}
      >
        <BarChart3 size={14} aria-hidden="true" />
        Analytics settings
      </button>
    );
  }

  return (
    <section
      aria-label="Analytics preferences"
      aria-live="polite"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-2xl rounded-lg border border-[#d8d7d3] bg-white p-4 text-[#1a1c1b] shadow-[0_18px_60px_rgba(26,28,27,0.18)] sm:p-5"
      role="dialog"
    >
      {consent === "pending" ? null : (
        <button
          aria-label="Close analytics preferences"
          className="absolute right-3 top-3 rounded-md p-1 text-[#62605b] transition hover:bg-[#f4f4f2] hover:text-[#1a1c1b]"
          type="button"
          onClick={() => setPreferencesOpened(false)}
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}

      <div className="pr-7">
        <h2 className="text-base font-semibold">Help improve Tockli?</h2>
        <p className="mt-2 text-sm leading-6 text-[#62605b]">
          Optional PostHog analytics tell us which product steps work. We record
          named actions, route and basic browser details and, after sign-in, an
          account ID so funnels work across devices. We do not send your email,
          task text, goals, or session notes, and we disable cookies, automatic
          click tracking, and session recordings.
        </p>
        <p className="mt-2 text-xs leading-5 text-[#77756f]">
          Current choice: {consent}. You can change it here at any time. Browser
          Do Not Track and Global Privacy Control signals always take priority.
          {privacySignalBlocked
            ? " Your browser is currently blocking analytics."
            : ""}
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          className="h-10 rounded-md border border-[#d8d7d3] bg-white px-4 text-sm font-semibold text-[#4f4d49] transition hover:border-[#8b8984]"
          type="button"
          onClick={() => {
            denyAnalyticsConsent();
            setPreferencesOpened(false);
          }}
        >
          Decline analytics
        </button>
        <button
          className="h-10 rounded-md bg-[#ff005e] px-4 text-sm font-semibold text-white transition hover:bg-[#e00054] disabled:cursor-not-allowed disabled:bg-[#d8d7d3]"
          disabled={privacySignalBlocked}
          type="button"
          onClick={() => {
            grantAnalyticsConsent();
            setPreferencesOpened(false);
          }}
        >
          Allow analytics
        </button>
      </div>
    </section>
  );
}

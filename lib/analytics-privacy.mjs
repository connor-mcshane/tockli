const SENSITIVE_PROPERTY_PARTS = new Set([
  "authorization",
  "description",
  "email",
  "goal",
  "name",
  "note",
  "password",
  "project_id",
  "refresh_token",
  "secret",
  "session_id",
  "task_id",
  "title",
  "token",
  "user_id",
]);

const CAMPAIGN_PROPERTY_MAP = new Map([
  ["utm_source", "$utm_source"],
  ["utm_medium", "$utm_medium"],
  ["utm_campaign", "$utm_campaign"],
  ["utm_term", "$utm_term"],
  ["utm_content", "$utm_content"],
]);

/**
 * Keep user-authored content and direct identifiers out of every analytics sink.
 * Event call sites should still prefer aggregate properties over relying on this
 * final safety net.
 *
 * @param {Record<string, string | number | boolean | null | undefined>} properties
 */
export function sanitizeAnalyticsProperties(properties) {
  return Object.fromEntries(
    Object.entries(properties).flatMap(([key, value]) => {
      if (value === undefined || isSensitivePropertyKey(key)) {
        return [];
      }

      return [[key, typeof value === "string" ? value.slice(0, 200) : value]];
    }),
  );
}

/**
 * @param {string} key
 */
function isSensitivePropertyKey(key) {
  const normalizedKey = key.trim().toLocaleLowerCase();

  return Array.from(SENSITIVE_PROPERTY_PARTS).some(
    (part) =>
      normalizedKey === part ||
      normalizedKey.startsWith(`${part}_`) ||
      normalizedKey.endsWith(`_${part}`),
  );
}

/**
 * @param {{ doNotTrack?: string | null, globalPrivacyControl?: boolean }} signals
 */
export function privacySignalsAllowAnalytics(signals) {
  const doNotTrack = signals.doNotTrack?.trim().toLocaleLowerCase();

  return signals.globalPrivacyControl !== true && doNotTrack !== "1" && doNotTrack !== "yes";
}

/**
 * Preserve useful attribution while never forwarding query strings or hashes,
 * which can contain invite codes, auth state, or campaign-entered PII.
 *
 * @param {string} referrer
 */
export function sanitizeAnalyticsReferrer(referrer) {
  if (!referrer) {
    return "";
  }

  try {
    const parsed = new URL(referrer);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "";
  }
}

/**
 * Keep useful campaign attribution without forwarding arbitrary query-string
 * values such as invite tokens, OAuth state, or user-entered data.
 *
 * @param {string} url
 */
export function getAnalyticsCampaignProperties(url) {
  try {
    const parsed = new URL(url);

    return Object.fromEntries(
      Array.from(CAMPAIGN_PROPERTY_MAP.entries()).flatMap(
        ([parameter, property]) => {
          const value = parsed.searchParams.get(parameter)?.trim();
          return value ? [[property, value.slice(0, 100)]] : [];
        },
      ),
    );
  } catch {
    return {};
  }
}

/**
 * Tockli keeps vendor-neutral event names internally. PostHog reserves
 * `$pageview` for Web Analytics, paths, bounce rate, and installation checks.
 *
 * @param {string} eventName
 */
export function getPostHogEventName(eventName) {
  return eventName === "page_view" ? "$pageview" : eventName;
}

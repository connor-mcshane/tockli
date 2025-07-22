import { isIP } from "node:net";

function integrationSafetyError() {
  return new Error(
    "Refusing to run local integration tests: API and database endpoints must use loopback hosts.",
  );
}

function isLoopbackHostname(hostname) {
  const normalized = hostname.toLowerCase();
  const unwrapped =
    normalized.startsWith("[") && normalized.endsWith("]")
      ? normalized.slice(1, -1)
      : normalized;
  if (unwrapped === "localhost" || unwrapped === "::1") {
    return true;
  }
  if (isIP(unwrapped) !== 4) {
    return false;
  }
  return Number(unwrapped.split(".")[0]) === 127;
}

function requireLoopbackUrl(value, protocols) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw integrationSafetyError();
  }
  const endpointOverride = [...url.searchParams.keys()].some((key) =>
    ["host", "hostaddr", "hostname"].includes(key.toLowerCase()),
  );
  if (
    !protocols.has(url.protocol) ||
    !isLoopbackHostname(url.hostname) ||
    endpointOverride
  ) {
    throw integrationSafetyError();
  }
}

export function assertLocalDatabaseEndpoint(databaseUrl) {
  requireLoopbackUrl(databaseUrl, new Set(["postgres:", "postgresql:"]));
}

export function assertLocalIntegrationEndpoints({ apiUrl, databaseUrl }) {
  requireLoopbackUrl(apiUrl, new Set(["http:", "https:"]));
  assertLocalDatabaseEndpoint(databaseUrl);
}

export async function withTimeout(work, timeoutMs, label) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("timeoutMs must be a positive number");
  }
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([Promise.resolve(work), timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function runCleanupSteps(
  steps,
  { message = "Integration cleanup failed.", timeoutMs = 5_000 } = {},
) {
  if (!Array.isArray(steps)) {
    throw new TypeError("steps must be an array");
  }

  const errors = [];
  for (const step of steps) {
    const label = step?.label || "Cleanup step";
    try {
      await withTimeout(
        Promise.resolve().then(() => step.run()),
        step.timeoutMs ?? timeoutMs,
        label,
      );
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length) {
    throw new AggregateError(errors, message);
  }
}

export function createBoundedFetch(fetchImplementation, timeoutMs) {
  return async function boundedFetch(input, init = {}) {
    const controller = new AbortController();
    const signal = init.signal
      ? AbortSignal.any([init.signal, controller.signal])
      : controller.signal;
    try {
      return await withTimeout(
        Promise.resolve().then(() =>
          fetchImplementation(input, { ...init, signal }),
        ),
        timeoutMs,
        "Supabase request",
      );
    } catch (error) {
      if (error?.message === `Supabase request timed out after ${timeoutMs}ms`) {
        controller.abort();
      }
      throw error;
    }
  };
}

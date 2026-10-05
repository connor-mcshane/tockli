function integrationSafetyError() {
  return new Error(
    "Refusing to run local integration tests: API and database endpoints must use loopback hosts.",
  );
}

function isLoopbackHostname(hostname) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized.startsWith("127.")
  );
}

function requireLoopbackUrl(value, protocols) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw integrationSafetyError();
  }
  if (!protocols.has(url.protocol) || !isLoopbackHostname(url.hostname)) {
    throw integrationSafetyError();
  }
}

export function assertLocalIntegrationEndpoints({ apiUrl, databaseUrl }) {
  requireLoopbackUrl(apiUrl, new Set(["http:", "https:"]));
  requireLoopbackUrl(databaseUrl, new Set(["postgres:", "postgresql:"]));
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


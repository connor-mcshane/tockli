import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { open, mkdir, readFile, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export const SESSION_FILE_NAME = "session.json";

export class TockliError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "TockliError";
    this.code = code;
    if (options.details !== undefined) {
      this.details = options.details;
    }
    if (options.currentRevision !== undefined) {
      this.currentRevision = options.currentRevision;
    }
  }
}

function present(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isServiceRoleKey(key) {
  if (/^sb_secret_/i.test(key)) {
    return true;
  }
  const parts = key.split(".");
  if (parts.length !== 3) {
    return false;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

export function resolveSupabaseConfig(env = process.env) {
  const url = present(env.TOCKLI_SUPABASE_URL)
    ? env.TOCKLI_SUPABASE_URL.trim()
    : present(env.NEXT_PUBLIC_SUPABASE_URL)
      ? env.NEXT_PUBLIC_SUPABASE_URL.trim()
      : null;
  const key = present(env.TOCKLI_SUPABASE_KEY)
    ? env.TOCKLI_SUPABASE_KEY.trim()
    : present(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
      ? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.trim()
      : present(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        ? env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim()
        : null;

  if (!url || !key) {
    throw new TockliError(
      "TOCKLI_CONFIG",
      "Supabase configuration is missing. Set TOCKLI_SUPABASE_URL and TOCKLI_SUPABASE_KEY.",
    );
  }
  if (isServiceRoleKey(key)) {
    throw new TockliError(
      "TOCKLI_CONFIG",
      "Tockli requires a Supabase publishable or anon key; secret and service-role keys are not allowed.",
    );
  }
  return { key, url };
}

export function resolveTockliConfigDir({
  env = process.env,
  homeDir = homedir(),
  platform = process.platform,
} = {}) {
  if (present(env.TOCKLI_CONFIG_DIR)) {
    return path.resolve(env.TOCKLI_CONFIG_DIR);
  }
  if (platform === "darwin") {
    return path.join(homeDir, "Library", "Application Support", "tockli");
  }
  if (platform === "win32") {
    const base = present(env.APPDATA)
      ? env.APPDATA
      : path.join(homeDir, "AppData", "Roaming");
    return path.join(base, "tockli");
  }
  const base = present(env.XDG_CONFIG_HOME)
    ? env.XDG_CONFIG_HOME
    : path.join(homeDir, ".config");
  return path.join(base, "tockli");
}

export function mapAuthUser(user) {
  if (!user) {
    return null;
  }
  const metadata = user.user_metadata ?? {};
  const displayName =
    metadata.display_name ?? metadata.full_name ?? metadata.name ?? null;
  return {
    displayName: present(displayName) ? displayName.trim() : null,
    email: user.email ?? null,
    id: user.id,
  };
}

export function mapSupabaseError(error, fallbackCode = "TOCKLI_API_ERROR") {
  if (error instanceof TockliError) {
    return error;
  }
  const status = Number(error?.status);
  const code = error?.code;
  if (status === 401 || code === "PGRST301") {
    return new TockliError("TOCKLI_AUTH_REQUIRED", "Authentication required.", {
      cause: error,
    });
  }
  if (status === 403 || code === "42501") {
    return new TockliError(
      "TOCKLI_FORBIDDEN",
      "You do not have permission to perform this operation.",
      { cause: error },
    );
  }
  return new TockliError(
    fallbackCode,
    fallbackCode === "TOCKLI_AUTH_FAILED"
      ? "Authentication failed. Check your credentials and try again."
      : "Tockli could not complete the request.",
    { cause: error },
  );
}

function sessionForDisk(session) {
  return {
    access_token: session.access_token,
    expires_at: session.expires_at ?? null,
    expires_in: session.expires_in ?? null,
    refresh_token: session.refresh_token,
    token_type: session.token_type ?? "bearer",
  };
}

function validStoredSession(value) {
  return (
    value &&
    typeof value === "object" &&
    present(value.access_token) &&
    present(value.refresh_token)
  );
}

async function persistSession(sessionPath, session) {
  if (!validStoredSession(session)) {
    throw new TockliError(
      "TOCKLI_AUTH_FAILED",
      "Authentication did not return a usable session.",
    );
  }
  await mkdir(path.dirname(sessionPath), { mode: 0o700, recursive: true });
  const temporaryPath = path.join(
    path.dirname(sessionPath),
    `.${path.basename(sessionPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let handle;
  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.chmod(0o600);
    await handle.writeFile(`${JSON.stringify(sessionForDisk(session), null, 2)}\n`, {
      encoding: "utf8",
    });
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporaryPath, sessionPath);
  } finally {
    await handle?.close().catch(() => {});
    await rm(temporaryPath, { force: true }).catch(() => {});
  }
}

function createClient(env, clientFactory) {
  const { key, url } = resolveSupabaseConfig(env);
  return clientFactory(url, key, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export function createTockliAuth({
  client,
  clientFactory = createSupabaseClient,
  configDir,
  env = process.env,
  homeDir = homedir(),
  platform = process.platform,
} = {}) {
  const supabase = client ?? createClient(env, clientFactory);
  const resolvedConfigDir =
    configDir ?? resolveTockliConfigDir({ env, homeDir, platform });
  const sessionPath = path.join(resolvedConfigDir, SESSION_FILE_NAME);
  let sessionPersistenceEnabled = true;
  let sessionPersistenceError = null;
  let sessionPersistenceQueue = Promise.resolve();

  function queueSessionPersistence(session) {
    const write = sessionPersistenceQueue.then(() =>
      persistSession(sessionPath, session),
    );
    sessionPersistenceQueue = write.then(
      () => {
        sessionPersistenceError = null;
      },
      (error) => {
        sessionPersistenceError = error;
      },
    );
    return write;
  }

  async function flushSessionPersistence() {
    await sessionPersistenceQueue;
    if (sessionPersistenceError) {
      throw sessionPersistenceError;
    }
  }

  supabase.auth.onAuthStateChange?.((event, session) => {
    if (
      event === "TOKEN_REFRESHED" &&
      session &&
      sessionPersistenceEnabled
    ) {
      void queueSessionPersistence(session).catch(() => {
        // The serialized queue retains this error for flushSessionPersistence.
      });
    }
  });

  async function loginWithPassword({ email, password } = {}) {
    if (!present(email) || !present(password)) {
      throw new TockliError(
        "TOCKLI_VALIDATION",
        "Email and password are required.",
      );
    }
    sessionPersistenceEnabled = true;
    let result;
    try {
      result = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
    } catch (error) {
      throw mapSupabaseError(error, "TOCKLI_AUTH_FAILED");
    }
    if (result.error) {
      throw mapSupabaseError(result.error, "TOCKLI_AUTH_FAILED");
    }
    if (!result.data?.session || !result.data?.user) {
      throw new TockliError(
        "TOCKLI_AUTH_FAILED",
        "Authentication did not return a usable session.",
      );
    }
    await queueSessionPersistence(result.data.session);
    return mapAuthUser(result.data.user);
  }

  async function restoreSession() {
    sessionPersistenceEnabled = true;
    let stored;
    try {
      stored = JSON.parse(await readFile(sessionPath, "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new TockliError("TOCKLI_AUTH_REQUIRED", "Authentication required.");
      }
      if (error instanceof SyntaxError) {
        throw new TockliError(
          "TOCKLI_AUTH_REQUIRED",
          "The saved Tockli session is invalid. Sign in again.",
          { cause: error },
        );
      }
      throw error;
    }
    if (!validStoredSession(stored)) {
      throw new TockliError(
        "TOCKLI_AUTH_REQUIRED",
        "The saved Tockli session is invalid. Sign in again.",
      );
    }
    let result;
    try {
      result = await supabase.auth.setSession({
        access_token: stored.access_token,
        refresh_token: stored.refresh_token,
      });
    } catch (error) {
      throw mapSupabaseError(error, "TOCKLI_AUTH_FAILED");
    }
    if (result.error) {
      throw mapSupabaseError(result.error, "TOCKLI_AUTH_FAILED");
    }
    if (!result.data?.session || !result.data?.user) {
      throw new TockliError("TOCKLI_AUTH_REQUIRED", "Authentication required.");
    }
    await queueSessionPersistence(result.data.session);
    return mapAuthUser(result.data.user);
  }

  async function getCurrentUser() {
    let result;
    try {
      result = await supabase.auth.getUser();
    } catch (error) {
      throw mapSupabaseError(error, "TOCKLI_AUTH_FAILED");
    }
    if (result.error) {
      throw mapSupabaseError(result.error, "TOCKLI_AUTH_FAILED");
    }
    if (!result.data?.user) {
      throw new TockliError("TOCKLI_AUTH_REQUIRED", "Authentication required.");
    }
    return mapAuthUser(result.data.user);
  }

  async function logout() {
    let signOutError = null;
    const cleanupErrors = [];
    sessionPersistenceEnabled = false;
    try {
      const result = await supabase.auth.signOut({ scope: "local" });
      signOutError = result?.error ?? null;
    } catch (error) {
      signOutError = error;
    } finally {
      try {
        await flushSessionPersistence();
      } catch (error) {
        cleanupErrors.push(error);
      }
      try {
        await rm(sessionPath, { force: true });
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (signOutError) {
      throw mapSupabaseError(signOutError, "TOCKLI_AUTH_FAILED");
    }
    if (cleanupErrors.length === 1) {
      throw cleanupErrors[0];
    }
    if (cleanupErrors.length > 1) {
      throw new AggregateError(cleanupErrors, "Could not remove the saved session.");
    }
    return { loggedOut: true };
  }

  return {
    client: supabase,
    getCurrentUser,
    flushSessionPersistence,
    loginWithPassword,
    logout,
    restoreSession,
    sessionPath,
  };
}

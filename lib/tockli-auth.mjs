import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { open, mkdir, readFile, rm } from "node:fs/promises";
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
  const handle = await open(sessionPath, "w", 0o600);
  try {
    await handle.chmod(0o600);
    await handle.writeFile(`${JSON.stringify(sessionForDisk(session), null, 2)}\n`, {
      encoding: "utf8",
    });
  } finally {
    await handle.close();
  }
}

function createClient(env, clientFactory) {
  const { key, url } = resolveSupabaseConfig(env);
  return clientFactory(url, key, {
    auth: {
      autoRefreshToken: false,
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

  async function loginWithPassword({ email, password } = {}) {
    if (!present(email) || !present(password)) {
      throw new TockliError(
        "TOCKLI_VALIDATION",
        "Email and password are required.",
      );
    }
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
    await persistSession(sessionPath, result.data.session);
    return mapAuthUser(result.data.user);
  }

  async function restoreSession() {
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
    await persistSession(sessionPath, result.data.session);
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
    try {
      const result = await supabase.auth.signOut({ scope: "local" });
      signOutError = result?.error ?? null;
    } catch (error) {
      signOutError = error;
    } finally {
      await rm(sessionPath, { force: true });
    }
    if (signOutError) {
      throw mapSupabaseError(signOutError, "TOCKLI_AUTH_FAILED");
    }
    return { loggedOut: true };
  }

  return {
    client: supabase,
    getCurrentUser,
    loginWithPassword,
    logout,
    restoreSession,
    sessionPath,
  };
}


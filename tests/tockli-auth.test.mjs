import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createTockliAuth,
  resolveSupabaseConfig,
  resolveTockliConfigDir,
} from "../lib/tockli-auth.mjs";

const USER = {
  email: "demo@tockli.test",
  id: "00000000-0000-4000-8000-000000000001",
  user_metadata: { display_name: "Demo User" },
};

function session(accessToken, refreshToken = "refresh-token") {
  return {
    access_token: accessToken,
    expires_at: 2_000_000_000,
    expires_in: 3600,
    refresh_token: refreshToken,
    token_type: "bearer",
    user: USER,
  };
}

test("Supabase configuration uses documented precedence without reading service role", () => {
  const values = {
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-fallback",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-fallback",
    NEXT_PUBLIC_SUPABASE_URL: "https://fallback.example",
    TOCKLI_SUPABASE_KEY: "tockli-key",
    TOCKLI_SUPABASE_URL: "https://tockli.example",
  };
  const env = new Proxy(values, {
    get(target, property) {
      assert.notEqual(property, "SUPABASE_SERVICE_ROLE_KEY");
      return target[property];
    },
  });

  assert.deepEqual(resolveSupabaseConfig(env), {
    key: "tockli-key",
    url: "https://tockli.example",
  });
  assert.deepEqual(
    resolveSupabaseConfig({
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-fallback",
      NEXT_PUBLIC_SUPABASE_URL: "https://fallback.example",
    }),
    { key: "publishable-fallback", url: "https://fallback.example" },
  );
  assert.deepEqual(
    resolveSupabaseConfig({
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-fallback",
      NEXT_PUBLIC_SUPABASE_URL: "https://fallback.example",
    }),
    { key: "anon-fallback", url: "https://fallback.example" },
  );
  assert.throws(() => resolveSupabaseConfig({}), { code: "TOCKLI_CONFIG" });
});

test("Supabase configuration rejects modern secret keys and legacy service-role JWTs", () => {
  const serviceRolePayload = Buffer.from(
    JSON.stringify({ exp: 2_000_000_000, role: "service_role" }),
  ).toString("base64url");
  const serviceRoleJwt = `header.${serviceRolePayload}.signature`;

  for (const key of ["sb_secret_do-not-use", serviceRoleJwt]) {
    assert.throws(
      () =>
        resolveSupabaseConfig({
          TOCKLI_SUPABASE_KEY: key,
          TOCKLI_SUPABASE_URL: "https://example.supabase.co",
        }),
      (error) => {
        assert.equal(error.code, "TOCKLI_CONFIG");
        assert.equal(error.message.includes(key), false);
        return true;
      },
    );
  }

  const anonPayload = Buffer.from(
    JSON.stringify({ exp: 2_000_000_000, role: "anon" }),
  ).toString("base64url");
  assert.deepEqual(
    resolveSupabaseConfig({
      NEXT_PUBLIC_SUPABASE_ANON_KEY: `header.${anonPayload}.signature`,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    }),
    {
      key: `header.${anonPayload}.signature`,
      url: "https://example.supabase.co",
    },
  );
});

test("config path honors TOCKLI_CONFIG_DIR then platform conventions", () => {
  assert.equal(
    resolveTockliConfigDir({
      env: { TOCKLI_CONFIG_DIR: "/tmp/custom-tockli" },
      homeDir: "/home/person",
      platform: "linux",
    }),
    "/tmp/custom-tockli",
  );
  assert.equal(
    resolveTockliConfigDir({
      env: { XDG_CONFIG_HOME: "/tmp/xdg" },
      homeDir: "/home/person",
      platform: "linux",
    }),
    "/tmp/xdg/tockli",
  );
  assert.equal(
    resolveTockliConfigDir({ env: {}, homeDir: "/Users/person", platform: "darwin" }),
    "/Users/person/Library/Application Support/tockli",
  );
  assert.equal(
    resolveTockliConfigDir({
      env: { APPDATA: "C:\\Users\\person\\AppData\\Roaming" },
      homeDir: "C:\\Users\\person",
      platform: "win32",
    }),
    path.join("C:\\Users\\person\\AppData\\Roaming", "tockli"),
  );
});

test("login stores only session material with user-only file permissions", async (t) => {
  const configDir = await mkdtemp(path.join(tmpdir(), "tockli-auth-login-"));
  t.after(async () => {
    await import("node:fs/promises").then(({ rm }) => rm(configDir, { force: true, recursive: true }));
  });
  const persistedSession = session("login-access");
  const client = {
    auth: {
      async signInWithPassword(credentials) {
        assert.deepEqual(credentials, {
          email: "demo@tockli.test",
          password: "top-secret-password",
        });
        return { data: { session: persistedSession, user: USER }, error: null };
      },
    },
  };
  const auth = createTockliAuth({ client, configDir });

  assert.deepEqual(
    await auth.loginWithPassword({
      email: " demo@tockli.test ",
      password: "top-secret-password",
    }),
    { displayName: "Demo User", email: USER.email, id: USER.id },
  );
  const sessionPath = path.join(configDir, "session.json");
  const stored = JSON.parse(await readFile(sessionPath, "utf8"));
  assert.equal(stored.access_token, "login-access");
  assert.equal(stored.refresh_token, "refresh-token");
  assert.equal(JSON.stringify(stored).includes("top-secret-password"), false);
  if (process.platform !== "win32") {
    assert.equal((await stat(sessionPath)).mode & 0o777, 0o600);
  }
});

test("restoreSession persists tokens refreshed by Supabase", async (t) => {
  const configDir = await mkdtemp(path.join(tmpdir(), "tockli-auth-refresh-"));
  t.after(async () => {
    await import("node:fs/promises").then(({ rm }) => rm(configDir, { force: true, recursive: true }));
  });
  const initialClient = {
    auth: {
      async signInWithPassword() {
        return { data: { session: session("old-access", "old-refresh"), user: USER }, error: null };
      },
    },
  };
  await createTockliAuth({ client: initialClient, configDir }).loginWithPassword({
    email: USER.email,
    password: "password",
  });

  const refreshed = session("new-access", "new-refresh");
  const refreshClient = {
    auth: {
      async setSession(tokens) {
        assert.deepEqual(tokens, {
          access_token: "old-access",
          refresh_token: "old-refresh",
        });
        return { data: { session: refreshed, user: USER }, error: null };
      },
    },
  };
  const restoredUser = await createTockliAuth({
    client: refreshClient,
    configDir,
  }).restoreSession();

  assert.equal(restoredUser.id, USER.id);
  const stored = JSON.parse(await readFile(path.join(configDir, "session.json"), "utf8"));
  assert.equal(stored.access_token, "new-access");
  assert.equal(stored.refresh_token, "new-refresh");
});

test("a long-running client atomically persists rotated tokens for the next process", async (t) => {
  const configDir = await mkdtemp(path.join(tmpdir(), "tockli-auth-rotation-"));
  t.after(async () => {
    await import("node:fs/promises").then(({ rm }) =>
      rm(configDir, { force: true, recursive: true }),
    );
  });

  let authStateListener;
  let clientOptions;
  const longRunningAuth = createTockliAuth({
    clientFactory(_url, _key, options) {
      clientOptions = options;
      return {
        auth: {
          onAuthStateChange(listener) {
            authStateListener = listener;
            return {
              data: { subscription: { unsubscribe() {} } },
            };
          },
          async signInWithPassword() {
            return {
              data: {
                session: {
                  ...session("initial-access", "initial-refresh"),
                  expires_at: 1,
                  expires_in: 0,
                },
                user: USER,
              },
              error: null,
            };
          },
        },
      };
    },
    configDir,
    env: {
      TOCKLI_SUPABASE_KEY: "publishable-key",
      TOCKLI_SUPABASE_URL: "https://example.supabase.co",
    },
  });

  assert.equal(clientOptions.auth.autoRefreshToken, true);
  await longRunningAuth.loginWithPassword({
    email: USER.email,
    password: "password",
  });
  authStateListener(
    "TOKEN_REFRESHED",
    session("rotated-access-1", "rotated-refresh-1"),
  );
  authStateListener(
    "TOKEN_REFRESHED",
    session("rotated-access-2", "rotated-refresh-2"),
  );
  await longRunningAuth.flushSessionPersistence();

  const sessionPath = path.join(configDir, "session.json");
  const stored = JSON.parse(await readFile(sessionPath, "utf8"));
  assert.equal(stored.access_token, "rotated-access-2");
  assert.equal(stored.refresh_token, "rotated-refresh-2");
  assert.deepEqual(await readdir(configDir), ["session.json"]);
  if (process.platform !== "win32") {
    assert.equal((await stat(sessionPath)).mode & 0o777, 0o600);
  }

  let restoredTokens;
  const nextProcess = createTockliAuth({
    client: {
      auth: {
        async setSession(tokens) {
          restoredTokens = tokens;
          return {
            data: {
              session: session("rotated-access-2", "rotated-refresh-2"),
              user: USER,
            },
            error: null,
          };
        },
      },
    },
    configDir,
  });
  await nextProcess.restoreSession();
  assert.deepEqual(restoredTokens, {
    access_token: "rotated-access-2",
    refresh_token: "rotated-refresh-2",
  });
});

test("getCurrentUser requires an authenticated user", async () => {
  const auth = createTockliAuth({
    client: {
      auth: {
        async getUser() {
          return { data: { user: null }, error: null };
        },
      },
    },
    configDir: "/unused",
  });
  await assert.rejects(auth.getCurrentUser(), { code: "TOCKLI_AUTH_REQUIRED" });
});

test("logout removes persisted credentials", async (t) => {
  const configDir = await mkdtemp(path.join(tmpdir(), "tockli-auth-logout-"));
  t.after(async () => {
    await import("node:fs/promises").then(({ rm }) => rm(configDir, { force: true, recursive: true }));
  });
  let signedOut = false;
  const client = {
    auth: {
      async signInWithPassword() {
        return { data: { session: session("access"), user: USER }, error: null };
      },
      async signOut(options) {
        signedOut = true;
        assert.deepEqual(options, { scope: "local" });
        return { error: null };
      },
    },
  };
  const auth = createTockliAuth({ client, configDir });
  await auth.loginWithPassword({ email: USER.email, password: "password" });
  assert.deepEqual(await auth.logout(), { loggedOut: true });
  assert.equal(signedOut, true);
  await assert.rejects(readFile(path.join(configDir, "session.json")), { code: "ENOENT" });
});

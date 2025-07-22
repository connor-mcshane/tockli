import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

import {
  assertLocalIntegrationEndpoints,
  createBoundedFetch,
  runCleanupSteps,
  withTimeout,
} from "./local-integration-safety.mjs";

test("local integration endpoint guard accepts only loopback API and database URLs", () => {
  for (const endpoints of [
    {
      apiUrl: "http://127.0.0.1:54321",
      databaseUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    },
    {
      apiUrl: "http://localhost:54321",
      databaseUrl: "postgres://postgres:postgres@localhost:54322/postgres",
    },
    {
      apiUrl: "http://[::1]:54321",
      databaseUrl: "postgresql://postgres:postgres@[::1]:54322/postgres",
    },
  ]) {
    assert.doesNotThrow(() => assertLocalIntegrationEndpoints(endpoints));
  }

  for (const endpoints of [
    {
      apiUrl: "https://project.supabase.co",
      databaseUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    },
    {
      apiUrl: "http://127.0.0.1:54321",
      databaseUrl: "postgresql://postgres:password@db.project.supabase.co:5432/postgres",
    },
    {
      apiUrl: "not-a-url",
      databaseUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    },
    {
      apiUrl: "http://127.example.com:54321",
      databaseUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    },
    {
      apiUrl: "http://[::ffff:127.0.0.1]:54321",
      databaseUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    },
    {
      apiUrl: "http://localhost:54321",
      databaseUrl:
        "postgresql://postgres:postgres@127.0.0.1:54322/postgres?host=db.project.supabase.co",
    },
  ]) {
    assert.throws(
      () => assertLocalIntegrationEndpoints(endpoints),
      /refusing to run/i,
    );
  }
});

test("cleanup steps are independently bounded and report every failure", async () => {
  const completed = [];

  await assert.rejects(
    runCleanupSteps(
      [
        {
          label: "stuck client close",
          run: async () => new Promise(() => {}),
        },
        {
          label: "database cleanup",
          run: async () => {
            completed.push("database");
            throw new Error("database cleanup broke");
          },
        },
        {
          label: "temporary directory cleanup",
          run: async () => {
            completed.push("directory");
          },
        },
      ],
      { timeoutMs: 10, message: "Integration cleanup failed." },
    ),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.equal(error.message, "Integration cleanup failed.");
      assert.equal(error.errors.length, 2);
      assert.match(error.errors[0].message, /stuck client close timed out/);
      assert.match(error.errors[1].message, /database cleanup broke/);
      return true;
    },
  );

  assert.deepEqual(completed, ["database", "directory"]);
});

test("the destructive database suite refuses a hostile SUPABASE_DB_URL before setup", () => {
  const childEnvironment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key !== "NODE_TEST_CONTEXT"),
  );
  const result = spawnSync(
    process.execPath,
    ["--test", "tests/local-supabase.test.mjs"],
    {
      cwd: path.resolve(import.meta.dirname, ".."),
      encoding: "utf8",
      env: {
        ...childEnvironment,
        SUPABASE_DB_URL:
          "postgresql://postgres:postgres@127.example.com:54322/postgres",
      },
      timeout: 5_000,
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /refusing to run local integration tests/i);
  assert.doesNotMatch(result.stderr + result.stdout, /connection refused|timed out/i);
});

test("withTimeout rejects work that exceeds its bound", async () => {
  await assert.rejects(
    withTimeout(new Promise(() => {}), 10, "test work"),
    /test work timed out after 10ms/,
  );
});

test("bounded fetch supplies an abort signal and has a hard promise timeout", async () => {
  let suppliedSignal;
  const boundedFetch = createBoundedFetch(
    async (_input, init) => {
      suppliedSignal = init.signal;
      return new Promise(() => {});
    },
    10,
  );

  await assert.rejects(
    boundedFetch("http://127.0.0.1:54321/rest/v1/projects"),
    /Supabase request timed out after 10ms/,
  );
  assert.ok(suppliedSignal instanceof AbortSignal);
  assert.equal(suppliedSignal.aborted, true);
});

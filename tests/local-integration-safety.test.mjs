import assert from "node:assert/strict";
import test from "node:test";

import {
  assertLocalIntegrationEndpoints,
  createBoundedFetch,
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
  ]) {
    assert.throws(
      () => assertLocalIntegrationEndpoints(endpoints),
      /refusing to run/i,
    );
  }
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


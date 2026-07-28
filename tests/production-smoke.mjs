import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import { once } from "node:events";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

async function getOpenPort() {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Could not reserve an open port.")));
        return;
      }

      const { port } = address;
      server.close(() => resolvePort(port));
    });
  });
}

async function waitForServer(baseUrl, getOutput, isExited) {
  const deadline = Date.now() + 30_000;
  let lastError = null;

  while (Date.now() < deadline) {
    if (isExited()) {
      throw new Error(`next start exited before becoming ready.\n${getOutput()}`);
    }

    try {
      const response = await fetch(baseUrl);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Received ${response.status} from ${baseUrl}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(500);
  }

  const reason = lastError instanceof Error ? lastError.message : "unknown";
  throw new Error(`next start did not become ready: ${reason}\n${getOutput()}`);
}

async function fetchText(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();

  assert.equal(response.status, 200, `${path} should return 200:\n${text}`);

  return text;
}

async function runSmoke() {
  const port = await getOpenPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let output = "";
  let exited = false;

  const server = spawn(
    "pnpm",
    ["exec", "next", "start", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.once("exit", () => {
    exited = true;
  });

  try {
    await waitForServer(baseUrl, () => output, () => exited);

    const homeHtml = await fetchText(baseUrl, "/");
    assert.match(homeHtml, /Turn a messy task list into one protected focus block/);
    assert.match(homeHtml, /About Tockli/);

    const loginHtml = await fetchText(baseUrl, "/login?next=/app");
    assert.match(loginHtml, /Log in and pick up your next focus block/);
    assert.match(loginHtml, /Continue with Google/);

    const callbackHtml = await fetchText(baseUrl, "/auth/callback?next=/app");
    assert.match(callbackHtml, /Finishing sign in/);

    const appHtml = await fetchText(baseUrl, "/app");
    assert.match(appHtml, /Checking your session/);
    assert.match(appHtml, /open your workspace once login is confirmed/);
    assert.doesNotMatch(appHtml, /Sprint Board/);
    assert.doesNotMatch(appHtml, />Kanban</);

    const sitemapXml = await fetchText(baseUrl, "/sitemap.xml");
    assert.match(sitemapXml, /\/login/);
    assert.match(sitemapXml, /\/blog\/analytics-that-help-you-focus/);

    console.log(`Production smoke passed at ${baseUrl}`);
  } finally {
    if (!exited) {
      server.kill("SIGTERM");
      await Promise.race([once(server, "exit"), sleep(5_000)]);
    }

    if (!exited) {
      server.kill("SIGKILL");
    }
  }
}

await runSmoke();

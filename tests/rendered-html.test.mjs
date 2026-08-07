import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the protected Tockli app gate", async () => {
  const response = await render("/app");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Tockli - Focus timer and task board<\/title>/i);
  assert.match(html, /Tockli/);
  assert.match(html, /Checking your session/);
  assert.match(html, /open your workspace once login is confirmed/);
  assert.doesNotMatch(html, /Sprint Board/);
  assert.doesNotMatch(html, />Kanban</);
  assert.doesNotMatch(html, />Personal</);
  assert.doesNotMatch(html, /Your site is taking shape/);
  assert.doesNotMatch(html, /react-loading-skeleton/);
});

test("server-renders launch marketing routes", async () => {
  const home = await render("/");
  assert.equal(home.status, 200);
  const homeHtml = await home.text();
  assert.match(homeHtml, /Find out your focus score/);
  assert.match(homeHtml, /Rest days never count against you/);
  assert.match(homeHtml, /Reveal my focus score/);
  assert.match(homeHtml, /Choose/);
  assert.match(homeHtml, /Focus/);
  assert.match(homeHtml, /Bank it/);
  assert.match(homeHtml, /About/);
  assert.match(homeHtml, /Get started for free/);
  assert.match(homeHtml, /35 points/);
  assert.match(homeHtml, /Privacy/);
  assert.match(homeHtml, /Terms/);
  assert.match(homeHtml, /Show up. Focus. Finish/);

  const landing = await render("/landing");
  assert.equal(landing.status, 200);
  const landingHtml = await landing.text();
  assert.match(landingHtml, /Find out your focus score/);
  assert.doesNotMatch(landingHtml, /Open the workspace/);

  const signup = await render("/signup");
  assert.equal(signup.status, 200);
  const signupHtml = await signup.text();
  assert.match(signupHtml, /Sign up for Tockli/);
  assert.match(signupHtml, /Create account/);

  const login = await render("/login");
  assert.equal(login.status, 200);
  const loginHtml = await login.text();
  assert.match(loginHtml, /Log in and pick up your next focus block/);
  assert.match(loginHtml, /Continue with Google/);

  const account = await render("/account");
  assert.equal(account.status, 200);
  const accountHtml = await account.text();
  assert.match(accountHtml, /Account Management/);
  assert.match(accountHtml, /Loading account details/);

  const blog = await render("/blog");
  assert.equal(blog.status, 200);
  const blogHtml = await blog.text();
  assert.match(blogHtml, /Practical notes for calmer focus work/);
  assert.match(blogHtml, /Why a focus timer works better/);
  assert.match(blogHtml, /Get started for free/);
  assert.doesNotMatch(blogHtml, /Workspace/);

  const article = await render("/blog/focus-timer-with-a-task-board");
  assert.equal(article.status, 200);
  const articleHtml = await article.text();
  assert.match(articleHtml, /Start with the work, then start the clock/);
});

test("server-renders SEO discovery routes", async () => {
  const sitemap = await render("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  const sitemapXml = await sitemap.text();
  assert.match(sitemapXml, /<loc>.*\/<\/loc>/);
  assert.match(sitemapXml, /\/login/);
  assert.match(sitemapXml, /\/blog\/analytics-that-help-you-focus/);

  const robots = await render("/robots.txt");
  assert.equal(robots.status, 200);
  const robotsTxt = await robots.text();
  assert.match(robotsTxt, /Disallow: \/app/);
  assert.match(robotsTxt, /Sitemap: .*\/sitemap.xml/);
});

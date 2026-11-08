// By default intercept PostHog. POSTHOG_REAL_CAPTURE=1 attempts real ingestion.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const real = process.env.POSTHOG_REAL_CAPTURE === "1";
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
  ...(real && proxy
    ? { proxy: { server: proxy, bypass: "127.0.0.1,localhost" } }
    : {}),
});
const page = await browser.newPage({
  viewport: { width: 375, height: 812 },
  reducedMotion: "reduce",
});
const endpoint = "https://us.i.posthog.com/i/v0/e/";
const events = [],
  responses = [],
  failures = [];
page.on("request", (request) => {
  if (request.url() === endpoint && request.method() === "POST") {
    const { api_key, distinct_id, ...safe } = request.postDataJSON();
    events.push(safe);
  }
});
page.on("response", (response) => {
  if (response.url() === endpoint && response.request().method() === "POST")
    responses.push(response.status());
});
page.on("requestfailed", (request) => {
  if (request.url() === endpoint) failures.push(request.failure()?.errorText);
});
if (!real)
  await page.route(endpoint, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: '{"status":"Ok"}',
    });
  });
const base = process.env.PREVIEW_URL || "http://127.0.0.1:4180";
await page.goto(base + "/?utm_source=wechat_moments");
const finish = async () => {
  await page.getByRole("button", { name: "试一组示例" }).click();
  await page.locator('[data-thought="0"]').click();
  await page.locator('[data-thought="2"]').click();
  await page.getByRole("button", { name: "带走这一步" }).click();
};
await finish();
await expect.poll(() => events.length).toBe(3);
await page.getByRole("button", { name: "再来一组" }).click();
await finish();
await page.reload();
await page.goto(base);
await finish();
await page.waitForLoadState("networkidle");
assert.deepEqual(
  events.map((e) => e.event),
  ["puzzle_home_open", "puzzle_first_start", "puzzle_first_complete"],
);
for (const e of events)
  assert.deepEqual(e.properties, {
    site: "puzzle",
    source: "wechat_moments",
    traffic: "test",
    $process_person_profile: false,
    $geoip_disable: true,
  });
const report = {
  receiver: real
    ? "real PostHog capture attempt; dashboard count still requires verification"
    : "mock PostHog receiver; not ingestion proof",
  events,
  responses,
  failures,
  attemptCounts: { open: 1, start: 1, complete: 1 },
  dashboardVerified: false,
};
await writeFile(
  real
    ? "docs/posthog-real-attempt.json"
    : "docs/analytics-preview-result.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
await browser.close();

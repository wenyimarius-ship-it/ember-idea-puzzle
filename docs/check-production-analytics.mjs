// Production build, intercepted receiver only: never pollutes real reports.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const base = process.env.LOCAL_PRODUCTION_URL || "http://127.0.0.1:4184";
const cases = [];
for (const width of [375, 1440])
  for (const traffic of ["test", "production"]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const events = [];
    await page.route("https://us.i.posthog.com/i/v0/e/", async (route) => {
      const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      };
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers });
        return;
      }
      const { api_key, distinct_id, ...safe } = route.request().postDataJSON();
      events.push(safe);
      await route.fulfill({ status: 200, headers, body: '{"status":"Ok"}' });
    });
    await page.goto(
      base +
        "/?utm_source=wechat_moments" +
        (traffic === "test" ? "&analytics_test=1" : ""),
    );
    const finish = async () => {
      if (await page.locator("#guide").isVisible())
        await page.getByRole("button", { name: "开始拼图" }).click();
      await page
        .getByLabel("一个具体、够小的行动")
        .fill("正式构建本地测试行动");
      await page.locator("#done").uncheck();
      await page.locator("#done").check();
    };
    await finish();
    await expect.poll(() => events.length).toBe(3);

    await finish();
    await page.goto(base);
    await finish();
    await page.waitForLoadState("networkidle");
    assert.deepEqual(
      events.map((e) => e.event),
      ["puzzle_home_open", "puzzle_first_start", "puzzle_first_complete"],
    );
    for (const event of events) assert.equal(event.properties.traffic, traffic);
    const productionRows = events.filter(
      (e) =>
        e.properties.site === "puzzle" &&
        e.properties.source === "wechat_moments" &&
        e.properties.traffic === "production",
    );
    assert.equal(productionRows.length, traffic === "test" ? 0 : 3);
    cases.push({
      width,
      traffic,
      counts: { open: 1, start: 1, complete: 1 },
      productionReportRows: productionRows.length,
      receiver: "mocked; not live Production evidence",
    });
    await context.close();
  }
await browser.close();
await writeFile(
  "docs/production-analytics-local-result.json",
  JSON.stringify(
    {
      cases,
      liveDeploymentVerified: false,
      posthogProductionReceiptVerified: false,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify(cases, null, 2));

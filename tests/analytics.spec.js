import { test, expect } from "@playwright/test";
const enabled = process.env.PUZZLE_ANALYTICS_LOCAL_TEST === "1";
async function capture(page) {
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
    const { api_key, ...data } = route.request().postDataJSON();
    events.push(data);
    await route.fulfill({ status: 200, headers, body: '{"status":"Ok"}' });
  });
  return events;
}
async function finish(page) {
  await page.getByRole("button", { name: "开始拼图" }).click();
  await page.getByLabel("一个具体、够小的行动").fill("仅在本地的私密行动");
  await page.locator("#done").check();
}
test("original canvas sends only three nodes, preserves source and deduplicates repeat/reload", async ({
  page,
}) => {
  test.skip(!enabled, "Enable analytics integration tests");
  const events = await capture(page);
  await page.goto("/?utm_source=wechat_moments");
  await finish(page);
  await expect.poll(() => events.length).toBe(3);
  await page.locator("#done").uncheck();
  await page.locator("#done").check();
  await page.reload();
  await page.locator("#done").uncheck();
  await page.locator("#done").check();
  await page.goto("/");
  await page.locator("#done").uncheck();
  await page.locator("#done").check();
  expect(events.map((e) => e.event)).toEqual([
    "puzzle_home_open",
    "puzzle_first_start",
    "puzzle_first_complete",
  ]);
  expect(new Set(events.map((e) => e.distinct_id)).size).toBe(1);
  for (const e of events)
    expect(e.properties).toEqual({
      site: "puzzle",
      source: "wechat_moments",
      traffic: "test",
      $process_person_profile: false,
      $geoip_disable: true,
    });
  expect(JSON.stringify(events)).not.toContain("私密");
});
test("untagged visits do not consume the later WeChat session", async ({
  page,
}) => {
  test.skip(!enabled, "Enable analytics integration tests");
  const events = await capture(page);
  await page.goto("/");
  await page.getByRole("button", { name: "开始拼图" }).click();
  expect(events).toEqual([]);
  await page.goto("/?utm_source=wechat_moments");
  await page.getByRole("button", { name: "编辑想法 1", exact: true }).click();
  await page.locator("#done").check();
  await expect.poll(() => events.length).toBe(3);
});
test("empty action is not a completed session and saved done data does not auto-complete", async ({
  page,
}) => {
  test.skip(!enabled, "Enable analytics integration tests");
  const events = await capture(page);
  await page.goto("/?utm_source=wechat_moments");
  await page.getByRole("button", { name: "开始拼图" }).click();
  await page.getByLabel("一个具体、够小的行动").fill("");
  await page.locator("#done").check();
  await expect.poll(() => events.length).toBe(2);
  await page.reload();
  expect(events.length).toBe(2);
  await page.getByLabel("一个具体、够小的行动").fill("一个动作");
  await page.locator("#done").uncheck();
  await page.locator("#done").check();
  await expect.poll(() => events.length).toBe(3);
});

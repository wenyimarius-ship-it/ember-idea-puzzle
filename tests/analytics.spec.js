import { test, expect } from "@playwright/test";
const enabled = process.env.PUZZLE_ANALYTICS_LOCAL_TEST === "1";
async function collector(page) {
  const events = [];
  await page.route("https://us.i.posthog.com/i/v0/e/", async (route) => {
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
    const payload = route.request().postDataJSON();
    // Never write the public collection token into test output.
    const { api_key, ...safe } = payload;
    events.push(safe);
    await route.fulfill({
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: '{"status":"Ok"}',
    });
  });
  return events;
}
async function example(page) {
  await page.getByRole("button", { name: "试一组示例" }).click();
  await page.locator('[data-thought="0"]').click();
  await page.locator('[data-thought="1"]').click();
  await page.getByRole("button", { name: "带走这一步" }).click();
}
test("wechat first-touch emits exactly three events after repeat puzzles and reload", async ({
  page,
}) => {
  test.skip(
    !enabled,
    "Enable PUZZLE_ANALYTICS_LOCAL_TEST=1 for collector integration tests",
  );
  const events = await collector(page);
  await page.goto("/?utm_source=wechat_moments&private=not-for-analytics");
  await expect.poll(() => events.length).toBe(1);
  await example(page);
  await expect.poll(() => events.length).toBe(3);
  await page.getByRole("button", { name: "再来一组" }).click();
  await example(page);
  await page.reload();
  await page.goto("/");
  await example(page);
  expect(events.map((e) => e.event)).toEqual([
    "puzzle_home_open",
    "puzzle_first_start",
    "puzzle_first_complete",
  ]);
  for (const e of events) {
    expect(e.properties).toEqual({
      site: "puzzle",
      source: "wechat_moments",
      traffic: "test",
      $process_person_profile: false,
      $geoip_disable: true,
    });
    expect(e.url).toBeUndefined();
  }
  expect(JSON.stringify(events)).not.toContain("private");
  expect(new Set(events.map((e) => e.distinct_id)).size).toBe(1);
});
test("custom flow counts opening/starting/completion, never textarea content; new session counts anew", async ({
  page,
  context,
}) => {
  test.skip(!enabled, "Enable collector integration tests");
  const events = await collector(page);
  await page.goto("/?utm_source=wechat_moments");
  await page.getByRole("button", { name: "写我自己的" }).click();
  await expect.poll(() => events.length).toBe(2);
  await page.getByLabel("念头 1", { exact: true }).fill("私密念头甲");
  await page.getByLabel("念头 2", { exact: true }).fill("私密念头乙");
  await page.getByRole("button", { name: "选两个，放在一起" }).click();
  await page.locator('[data-thought="0"]').click();
  await page.locator('[data-thought="1"]').click();
  await page.getByRole("button", { name: "用这个关系继续" }).click();
  await page.getByLabel("选一个建议").fill("私密行动");
  await page.getByRole("button", { name: "带走这一步" }).click();
  await expect.poll(() => events.length).toBe(3);
  expect(JSON.stringify(events)).not.toMatch(/私密/);
  const fresh = await context.newPage();
  const next = await collector(fresh);
  await fresh.goto("/?utm_source=wechat_moments");
  await expect.poll(() => next.length).toBe(1);
  await fresh.close();
});
test("blocked session storage disables tracking without breaking puzzle", async ({
  page,
}) => {
  test.skip(!enabled, "Enable collector integration tests");
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key === "idea-puzzle-funnel-posthog-test-v1") throw Error("blocked");
      return get.call(this, key);
    };
  });
  const events = await collector(page);
  await page.goto("/?utm_source=wechat_moments");
  await example(page);
  await expect(
    page.getByRole("heading", { name: "这一组，拼好了。" }),
  ).toBeVisible();
  expect(events).toEqual([]);
});
test("untagged Preview sends nothing and does not consume the later tagged test", async ({
  page,
}) => {
  test.skip(!enabled, "Enable collector integration tests");
  const events = await collector(page);
  await page.goto("/");
  await example(page);
  expect(events).toEqual([]);
  await page.goto("/?utm_source=wechat_moments");
  await example(page);
  await expect.poll(() => events.length).toBe(3);
});

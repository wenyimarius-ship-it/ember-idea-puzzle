import { test, expect } from "@playwright/test";
const enabled = process.env.VITE_PUZZLE_ANALYTICS === "vercel";
async function collector(page) {
  const events = [];
  await page.route("**/_vercel/insights/script.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `
 let filter=event=>event;
 const handle=(command,value)=>{
  if(command==='beforeSend'){filter=value;return;}
  if(command==='event'){
   const meta=filter({type:'event',url:location.href});
   if(meta)fetch('/_vercel/insights/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...meta,name:value.name,data:value.data})});
  }
 };
 (window.vaq||[]).forEach(args=>handle(...args));window.va=handle;
 // Deliberately attempt an auto pageview; privacy filtering must discard it.
 if(filter({type:'pageview',url:location.href}))throw Error('Unexpected pageview');
 `,
    }),
  );
  await page.route("**/_vercel/insights/event", async (route) => {
    events.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, body: "{}" });
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
    "Enable VITE_PUZZLE_ANALYTICS=vercel for collector integration tests",
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
  expect(events.map((e) => e.name)).toEqual([
    "puzzle_home_open",
    "puzzle_first_start",
    "puzzle_first_complete",
  ]);
  for (const e of events) {
    expect(e.data).toEqual({ source: "wechat_moments" });
    expect(new URL(e.url).search).toBe("");
  }
  expect(JSON.stringify(events)).not.toContain("private");
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
      if (key === "idea-puzzle-funnel-v1") throw Error("blocked");
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

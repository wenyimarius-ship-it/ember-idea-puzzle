// Local production-preview acceptance with an explicitly mocked receiver.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 375, height: 812 },
  reducedMotion: "reduce",
});
const events = [];
await page.route("**/_vercel/insights/script.js", (route) =>
  route.fulfill({
    contentType: "text/javascript",
    body: `let filter=x=>x;function run(command,payload){if(command==='beforeSend')filter=payload;if(command==='event'){const meta=filter({type:'event',url:location.href});if(meta)fetch('/_vercel/insights/event',{method:'POST',body:JSON.stringify({...meta,name:payload.name,data:payload.data})});}}(window.vaq||[]).forEach(args=>run(...args));window.va=run;`,
  }),
);
await page.route("**/_vercel/insights/event", async (route) => {
  events.push(route.request().postDataJSON());
  await route.fulfill({ status: 200, body: "{}" });
});
await page.goto(
  (process.env.PREVIEW_URL || "http://127.0.0.1:4176") +
    "/?utm_source=wechat_moments",
);
const finish = async () => {
  await page.getByRole("button", { name: "试一组示例" }).click();
  await page.locator('[data-thought="0"]').click();
  await page.locator('[data-thought="2"]').click();
  await page.getByRole("button", { name: "带走这一步" }).click();
};
await finish();
await page.waitForFunction(() => document.querySelector(".result-card"));
await page.getByRole("button", { name: "再来一组" }).click();
await finish();
await page.reload();
await page.goto(process.env.PREVIEW_URL || "http://127.0.0.1:4176");
await finish();
// Flush network requests rather than assuming queued events reached the receiver.
await page.waitForLoadState("networkidle");
assert.deepEqual(
  events.map((e) => e.name),
  ["puzzle_home_open", "puzzle_first_start", "puzzle_first_complete"],
);
for (const e of events) assert.deepEqual(e.data, { source: "wechat_moments" });
const report = {
  receiver: "mocked local receiver; not Vercel ingestion proof",
  workflow:
    "homepage → example → result → repeat → reload without UTM → repeat",
  events,
  counts: { open: 1, start: 1, complete: 1 },
  rates: {
    completeOverOpen: "1/1 test session only",
    completeOverStart: "1/1 test session only",
  },
};
await writeFile(
  "docs/analytics-preview-result.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
await browser.close();

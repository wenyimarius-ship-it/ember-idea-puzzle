// Run after `npm run dev -- --port 4174`; produces stable screenshots without animation.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
await mkdir("docs/screenshots", { recursive: true });
for (const [name, width, height] of [
  ["desktop", 1440, 1000],
  ["mobile", 375, 812],
]) {
  const page = await browser.newPage({
    viewport: { width, height },
    isMobile: name === "mobile",
    hasTouch: name === "mobile",
    reducedMotion: "reduce",
  });
  await page.goto(process.env.SCREENSHOT_URL || "http://127.0.0.1:4174");
  await page.screenshot({
    path: `docs/screenshots/${name}-01-home.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "试一组示例" }).click();
  await page.locator('[data-thought="0"]').click();
  await page.locator('[data-thought="2"]').click();
  await page.screenshot({
    path: `docs/screenshots/${name}-02-connection.png`,
    fullPage: true,
  });
  await page.locator('[data-suggestion="0"]').click();
  await page.getByRole("button", { name: "带走这一步" }).click();
  await page.screenshot({
    path: `docs/screenshots/${name}-03-result.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "再来一组" }).click();
  await page.getByRole("button", { name: "写我自己的" }).click();
  await page.getByLabel("念头 1", { exact: true }).fill("想学陶艺");
  await page.getByLabel("念头 2", { exact: true }).fill("周末要加班");
  await page.getByRole("button", { name: "选两个，放在一起" }).click();
  await page.locator('[data-thought="0"]').click();
  await page.locator('[data-thought="1"]').click();
  await page.getByLabel("你觉得它们是什么关系").selectOption("1");
  await page.getByRole("button", { name: "用这个关系继续" }).click();
  await page.getByLabel("选一个建议").fill("花 5 分钟找一家附近的陶艺工作室。");
  await page.getByRole("button", { name: "带走这一步" }).click();
  await page.screenshot({
    path: `docs/screenshots/${name}-04-custom-result.png`,
    fullPage: true,
  });
  await page.close();
}
await browser.close();

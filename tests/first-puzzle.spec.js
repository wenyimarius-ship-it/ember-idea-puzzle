import { test, expect } from "@playwright/test";
import { fresh, KEY } from "../src/state.js";
import { examplePairs } from "../src/first-puzzle.js";
import { enterWorkspace } from "./helpers.js";
const tile = (page, i) => page.locator(`[data-thought="${i}"]`);
test("first screen is simple and above fold", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "脑子里有几件事打转",
  );
  await expect(
    page.getByRole("button", { name: "试一组示例" }),
  ).toBeInViewport();
  await expect(page.locator("#board,.handle,.swatches,#export")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
for (const [indices, reply] of Object.entries(examplePairs))
  test(`example ${indices} gives designed relationship and default action`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.getByRole("button", { name: "试一组示例" }).click();
    const [a, b] = indices.split("-");
    await tile(page, a).click();
    await expect(tile(page, a)).toHaveAttribute("aria-pressed", "true");
    await tile(page, a).click();
    await expect(tile(page, a)).toHaveAttribute("aria-pressed", "false");
    await tile(page, b).click();
    await tile(page, a).click();
    await expect(page.locator("#relationship-copy")).toHaveText(reply.relation);
    await page.getByRole("button", { name: "带走这一步" }).click();
    await expect(
      page.getByRole("heading", { name: "这一组，拼好了。" }),
    ).toBeVisible();
    await expect(page.locator(".result-action strong")).toHaveText(
      reply.actions[0],
    );
    await expect(page.locator(".result-thoughts span")).toHaveCount(2);
    expect(errors).toEqual([]);
  });
test("custom thoughts require two entries and explicit relation, editable action and copy", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button", { name: "写我自己的" }).click();
  await page.getByLabel("念头 1", { exact: true }).fill("想学陶艺");
  await page.getByRole("button", { name: "选两个，放在一起" }).click();
  await expect(page.getByRole("alert")).toContainText("再写一个");
  await page.getByLabel("念头 2", { exact: true }).fill("周末要加班");
  await page.getByRole("button", { name: "选两个，放在一起" }).click();
  await tile(page, 0).click();
  await tile(page, 1).click();
  await expect(page.getByLabel("关系说明")).toContainText("这两件事可能值得");
  await expect(page.locator("#finish")).toHaveCount(0);
  await page.getByLabel("你觉得它们是什么关系").selectOption("1");
  await expect(page.getByLabel("关系说明")).toContainText("我把一件事看作目标");
  await page.getByLabel("关系说明").fill("我想在可用的时间里，先试一下。");
  await page.getByRole("button", { name: "用这个关系继续" }).click();
  await page.locator('[data-suggestion="0"]').click();
  await page.getByLabel("选一个建议").fill("花 5 分钟找一家附近的陶艺工作室。");
  await page.getByRole("button", { name: "带走这一步" }).click();
  await expect(page.locator(".result-relation")).toHaveText(
    "我想在可用的时间里，先试一下。",
  );
  await page.getByRole("button", { name: "复制", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已复制");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "花 5 分钟找一家",
  );
  await page.getByRole("button", { name: "再来一组" }).click();
  await expect(page.getByRole("button", { name: "试一组示例" })).toBeVisible();
});
test("legacy data survives first experience, result, and workspace entry", async ({
  page,
}) => {
  const legacy = fresh();
  legacy.cards[0].text = "旧数据，不能覆盖";
  legacy.cards[0].x = 321;
  legacy.welcomed = true;
  await page.addInitScript(
    ({ key, data }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(data));
    },
    { key: KEY, data: legacy },
  );
  await page.goto("/");
  await enterWorkspace(page);
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY),
  ).toEqual(legacy);
  await expect(page.locator(".card").first()).toContainText("旧数据，不能覆盖");
  await page.reload();
  await expect(page.locator(".card").first()).toHaveCSS("left", "321px");
});
test("copy denied has honest manual fallback", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw Error("denied");
        },
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "试一组示例" }).click();
  await tile(page, 0).click();
  await tile(page, 2).click();
  await page.getByRole("button", { name: "带走这一步" }).click();
  await page.getByRole("button", { name: "复制", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("未能自动复制");
  await expect(page.locator("#copy-text")).toHaveValue(/想改主页.*/s);
});
test("JSON import validates, confirms, restores exported data and protects existing canvas", async ({
  page,
}) => {
  await page.goto("/");
  await enterWorkspace(page);
  const state =
    (await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) || "null"),
      KEY,
    )) || fresh();
  state.cards[0].text = "导入的旧格式卡片";
  const upload = async (data) => {
    await page.locator("#import-file").setInputFiles({
      name: "ideas.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
  };
  await upload(state);
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.locator(".card").first()).not.toContainText(
    "导入的旧格式卡片",
  );
  await upload(state);
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await page.reload();
  await expect(page.locator(".card").first()).toContainText("导入的旧格式卡片");
  await upload({ version: 99, cards: [] });
  await expect(page.getByRole("alert")).toContainText("导入失败");
  await expect(page.locator(".card").first()).toContainText("导入的旧格式卡片");
  await page.getByText("画布选项").click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON" }).click();
  const file = await download;
  const fs = await import("node:fs/promises");
  expect(JSON.parse(await fs.readFile(await file.path(), "utf8"))).toEqual(
    state,
  );
});
test("custom relationship choices stay user-authored and reduction of motion is respected", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (let i = 0; i < 4; i++) {
    await page.goto("/");
    await page.getByRole("button", { name: "写我自己的" }).click();
    await page.getByLabel("念头 1", { exact: true }).fill("工作上的一件事");
    await page.getByLabel("念头 2", { exact: true }).fill("生活里的另一件事");
    await page.getByRole("button", { name: "选两个，放在一起" }).click();
    await tile(page, 0).click();
    await tile(page, 1).click();
    await page.getByLabel("你觉得它们是什么关系").selectOption(String(i));
    expect(
      await page
        .locator(".connection-panel")
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
    await page.getByRole("button", { name: "用这个关系继续" }).click();
    await page.getByRole("button", { name: "带走这一步" }).click();
    await expect(page.locator(".result-action strong")).not.toBeEmpty();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

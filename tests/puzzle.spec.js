import { test, expect } from "@playwright/test";
import { enterWorkspace } from "./helpers.js";
import { KEY } from "../src/state.js";
async function start(page) {
  await page.goto("/");
  await enterWorkspace(page);
}
async function confirm(page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认", exact: true })
    .click();
}
test("create, multiline edit, color, category, grouping, action and refresh", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await page.getByRole("button", { name: "＋ 新想法", exact: true }).click();
  await page.getByLabel("内容", { exact: true }).fill("我的新想法\n第二行");
  await page.getByLabel("分类", { exact: true }).fill("研究");
  await page.getByRole("button", { name: "雾蓝", exact: true }).click();
  await page.getByRole("textbox", { name: "新主题名称" }).fill("新实验");
  await page.getByRole("button", { name: "创建主题并加入" }).click();
  await expect(
    page.locator(".group").filter({ hasText: "新实验" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "↗ 设为下一步", exact: true }).click();
  await confirm(page);
  await page.getByLabel("一个具体、够小的行动").fill("画出第一张草图");
  await page.getByRole("checkbox").check();
  await page.reload();
  await expect(page.locator(".card.sky")).toContainText("我的新想法\n第二行");
  await expect(page.locator(".card.sky")).toContainText("研究");
  await expect(page.getByLabel("一个具体、够小的行动")).toHaveValue(
    "画出第一张草图",
  );
  await expect(page.getByRole("checkbox")).toBeChecked();
  expect(errors).toEqual([]);
});
test("mouse drag or touch drag keeps position, editor does not move card", async ({
  page,
  browserName,
}, testInfo) => {
  await start(page);
  const handle = page.getByRole("button", { name: "移动想法 1", exact: true });
  const before = await page.locator(".card").first().boundingBox();
  if (testInfo.project.name === "mobile") {
    const client = await page.context().newCDPSession(page);
    const b = await handle.boundingBox();
    const x = b.x + b.width / 2,
      y = b.y + b.height / 2;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 35, y: y + 80 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } else {
    const b = await handle.boundingBox();
    await page.mouse.move(b.x + 15, b.y + 15);
    await page.mouse.down();
    await page.mouse.move(b.x + 115, b.y + 95, { steps: 8 });
    await page.mouse.up();
  }
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)).cards[0],
    KEY,
  );
  expect(saved.y).toBeGreaterThan(110);
  await page.reload();
  const restored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)).cards[0],
    KEY,
  );
  expect(restored.x).toBe(saved.x);
  expect(restored.y).toBe(saved.y);
  await page.getByRole("button", { name: "编辑想法 1", exact: true }).click();
  await page.getByLabel("内容", { exact: true }).fill("编辑不移动");
  const after = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)).cards[0],
    KEY,
  );
  expect(after.x).toBe(saved.x);
  expect(after.y).toBe(saved.y);
});
test("delete protection, export, clear cancel, empty and restore", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: "编辑想法 1", exact: true }).click();
  await page.getByRole("button", { name: "删除想法", exact: true }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.locator(".card")).toHaveCount(4);
  await page.getByRole("button", { name: "删除想法", exact: true }).click();
  await confirm(page);
  await expect(page.locator(".card")).toHaveCount(3);
  await expect(page.locator("#action-text")).toHaveCount(0);
  await page.getByText("画布选项", { exact: false }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON", exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/idea-puzzle-.*json/);
  const fs = await import("node:fs/promises");
  const data = JSON.parse(await fs.readFile(await file.path(), "utf8"));
  expect(data.cards).toHaveLength(3);
  await page.getByRole("button", { name: "清空画布", exact: true }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.locator(".card")).toHaveCount(3);
  await page.getByRole("button", { name: "清空画布", exact: true }).click();
  await confirm(page);
  await expect(page.getByText("留白，也是一个开始。")).toBeVisible();
  await page.reload();
  await expect(page.locator(".card")).toHaveCount(0);
  await page.getByText("画布选项", { exact: false }).click();
  await page.getByRole("button", { name: "恢复初始示例" }).click();
  await confirm(page);
  await expect(page.locator(".card")).toHaveCount(4);
});
test("storage quota failure is visible and editing still works", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await start(page);
  await page.getByRole("button", { name: "＋ 新想法", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("本地保存失败");
  await page.getByLabel("内容", { exact: true }).fill("临时想法");
  await expect(page.locator(".card").last()).toContainText("临时想法");
});
test("corrupt storage is preserved and warning shown", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "broken"), KEY);
  await page.goto("/");
  await enterWorkspace(page);
  await expect(page.getByRole("alert")).toContainText("原有数据不会被覆盖");
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(
    "broken",
  );
});
test("keyboard movement and mobile layout", async ({ page }) => {
  await start(page);
  const h = page.getByRole("button", { name: "移动想法 1", exact: true });
  await h.focus();
  await h.press("ArrowRight");
  await h.press("ArrowDown");
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).cards[0].x,
      KEY,
    ),
  ).toBe(100);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("join existing theme, rename and ungroup", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "编辑想法 3", exact: true }).click();
  await page.getByLabel("主题分组", { exact: true }).selectOption("g1");
  await expect(page.locator(".group")).toContainText("3 个想法");
  page.once("dialog", (d) => d.accept("新的主题"));
  await page.getByRole("button", { name: "重命名当前主题" }).click();
  await expect(page.locator(".group")).toContainText("新的主题");
  await page.getByLabel("主题分组", { exact: true }).selectOption("");
  await expect(page.locator(".group")).toContainText("2 个想法");
  await page.reload();
  await expect(page.locator(".group")).toContainText("新的主题");
});
test("touch on canvas scrolls without dragging cards", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Touch-specific check");
  await start(page);
  const v = await page.locator(".viewport").boundingBox();
  const client = await page.context().newCDPSession(page);
  const x = v.x + 20,
    y = v.y + 350;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 6; i++)
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y - i * 30 }],
    });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(() => page.locator(".viewport").evaluate((el) => el.scrollTop))
    .toBeGreaterThan(20);
  await expect(page.locator(".card").first()).toHaveCSS("top", "110px");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), KEY),
  ).toBeNull();
});

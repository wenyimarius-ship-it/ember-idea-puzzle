import { test, expect } from "@playwright/test";
import { KEY, fresh } from "../src/state.js";
import {
  BACKUP_KEY,
  EXPORT_SCHEMA,
  MAX_IMPORT_BYTES,
} from "../src/json-transfer.js";
async function start(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "开始拼图" }).click();
}
async function confirm(page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认", exact: true })
    .click();
}
test.describe("375px mobile canvas", () => {
  test.use({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });

  test("new card intersects the current canvas after scrolling", async ({
    page,
  }) => {
    await start(page);
    const viewport = page.locator(".viewport");
    const visible = await viewport.evaluate((el) => {
      el.scrollLeft = 1200;
      el.scrollTop = 800;
      return {
        left: el.scrollLeft,
        top: el.scrollTop,
        right: el.scrollLeft + el.clientWidth,
        bottom: el.scrollTop + el.clientHeight,
      };
    });
    expect(visible.left).toBe(1200);
    expect(visible.top).toBe(800);
    const count = await page.locator(".card").count();

    await page.getByRole("button", { name: "＋ 新想法", exact: true }).click();
    await expect(page.locator(".card")).toHaveCount(count + 1);
    const card = page.locator(".card").last();
    await expect(card).toHaveClass(/selected/);

    // Check the original scrolled region too, so scrollIntoView cannot mask
    // a card that was created back at the canvas origin.
    const position = await card.evaluate((el) => ({
      x: el.offsetLeft,
      y: el.offsetTop,
      width: el.offsetWidth,
      height: el.offsetHeight,
    }));
    expect(position.x).toBeLessThan(visible.right);
    expect(position.x + position.width).toBeGreaterThan(visible.left);
    expect(position.y).toBeLessThan(visible.bottom);
    expect(position.y + position.height).toBeGreaterThan(visible.top);

    const box = await card.boundingBox();
    const clip = await viewport.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        x: rect.left + el.clientLeft,
        y: rect.top + el.clientTop,
        width: el.clientWidth,
        height: el.clientHeight,
      };
    });
    expect(box).not.toBeNull();
    expect(Math.min(box.x + box.width, clip.x + clip.width)).toBeGreaterThan(
      Math.max(box.x, clip.x),
    );
    expect(Math.min(box.y + box.height, clip.y + clip.height)).toBeGreaterThan(
      Math.max(box.y, clip.y),
    );
  });
});
test("guide mobile hint follows the 800px breakpoint", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#guide")).toBeVisible();
  const hint = page.locator("#guide .mobile-hint");
  await expect(hint).toHaveText(
    "手机上也能用；想一次看清所有卡片，建议用电脑打开。",
  );
  for (const width of [375, 800, 801, 1440]) {
    await page.setViewportSize({ width, height: 812 });
    if (width <= 800) {
      await expect(hint).toBeVisible();
      await expect(hint).toHaveCSS("display", "block");
    } else {
      await expect(hint).toBeHidden();
      await expect(hint).toHaveCSS("display", "none");
    }
  }
});
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
  await expect(page.getByRole("alert")).toContainText("本地保存失败");
  await page.getByRole("button", { name: "＋ 新想法", exact: true }).click();
  await page.getByLabel("内容", { exact: true }).fill("临时想法");
  await expect(page.locator(".card").last()).toContainText("临时想法");
});
test("corrupt storage is preserved and warning shown", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "broken"), KEY);
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("原有数据不会被覆盖");
  await page.getByRole("button", { name: "开始拼图" }).click();
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
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).cards[0].y,
      KEY,
    ),
  ).toBe(110);
});

test("feedback appears only after explicit completion, supports keyboard and keeps layout stable", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({
    width: testInfo.project.name === "mobile" ? 375 : 1440,
    height: 812,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await start(page);
  const slot = page.locator("#action-feedback");
  await expect(slot).toBeHidden();
  const before = await page
    .locator(".side-note")
    .evaluate((el) => el.getBoundingClientRect().top + scrollY);
  await page.locator("#action-text").fill("");
  await page.locator("#done").check();
  await expect(slot).toBeHidden();
  await page.locator("#done").uncheck();
  await page.locator("#action-text").fill("仅在浏览器里的行动");
  await page.locator("#done").check();
  await expect(slot).toBeVisible();
  const readyHeight = await slot.evaluate((el) => el.offsetHeight);
  for (const button of await slot.getByRole("button").all()) {
    const size = await button.boundingBox();
    expect(size.width).toBeGreaterThanOrEqual(44);
    expect(size.height).toBeGreaterThanOrEqual(44);
    await expect(button).toHaveCSS("transition-duration", "0s");
  }
  const useful = slot.getByRole("button", { name: "有用", exact: true });
  await useful.focus();
  await useful.press("Enter");
  await expect(slot).toContainText("谢谢你的反馈");
  await expect(useful).toHaveAttribute("aria-pressed", "true");
  for (const button of await slot.getByRole("button").all())
    await expect(button).toBeDisabled();
  expect(await slot.evaluate((el) => el.offsetHeight)).toBe(readyHeight);
  // Scroll/focus can move the document, so compare document-relative positions.
  const after = await page
    .locator(".side-note")
    .evaluate((el) => el.getBoundingClientRect().top + scrollY);
  expect(after).toBe(before);
  await page.reload();
  await expect(slot).toContainText("谢谢你的反馈");
  await expect(
    slot.getByRole("button", { name: "一般", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

async function downloadJson(page) {
  if (
    !(await page
      .getByRole("button", { name: "导出 JSON", exact: true })
      .isVisible())
  )
    await page.getByText("画布选项", { exact: false }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON", exact: true }).click();
  const file = await downloaded;
  const fs = await import("node:fs/promises");
  return JSON.parse(await fs.readFile(await file.path(), "utf8"));
}
async function uploadJson(page, state) {
  await page.locator("#import-file").setInputFiles({
    name: "puzzle.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
}
async function storedCanvas(page) {
  return page.evaluate((key) => localStorage.getItem(key), KEY);
}
async function startSaved(page) {
  await start(page);
  await expect(page.locator("#save-status")).toHaveText(
    "已自动保存 · 此浏览器",
  );
}

test("JSON export-import round-trip requires confirmation and restore undoes the replacement", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({
    width: testInfo.project.name === "mobile" ? 375 : 1440,
    height: 812,
  });
  await startSaved(page);
  const exported = await downloadJson(page);
  expect(exported.schema).toBe(EXPORT_SCHEMA);
  expect(exported.version).toBe(1);
  await page.getByRole("button", { name: "＋ 新想法", exact: true }).click();
  await page.getByLabel("内容", { exact: true }).fill("导入前要保留的内容");
  const before = await storedCanvas(page);
  await expect(page.locator("#restore-backup")).toBeDisabled();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入 JSON", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "export.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await expect(page.locator("#confirm-copy")).toHaveText(
    "将用导入的内容替换当前画布：4 张卡片、1 个主题。当前画布会先在本机备份一份。",
  );
  expect(await storedCanvas(page)).toBe(before);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "取消", exact: true })
    .click();
  expect(await storedCanvas(page)).toBe(before);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), BACKUP_KEY),
  ).toBeNull();
  await uploadJson(page, exported);
  await confirm(page);
  await expect(page.locator("#import-status")).toContainText("已导入。");
  const { schema, ...canvas } = exported;
  expect(JSON.parse(await storedCanvas(page))).toEqual(canvas);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), BACKUP_KEY),
  ).toBe(before);
  expect(await downloadJson(page)).toEqual(exported);
  await page.reload();
  await page.getByRole("button", { name: "恢复上一份", exact: true }).click();
  await confirm(page);
  await expect(page.locator("#import-status")).toContainText("已恢复上一份");
  expect(await storedCanvas(page)).toBe(before);
  await expect(page.locator(".card").last()).toContainText(
    "导入前要保留的内容",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("invalid and oversized imports preserve the canvas and undo slot", async ({
  page,
}) => {
  await startSaved(page);
  const before = await storedCanvas(page);
  const backup = "previous backup must remain";
  await page.evaluate(
    ([key, text]) => localStorage.setItem(key, text),
    [BACKUP_KEY, backup],
  );
  const missing = fresh();
  delete missing.cards[0].text;
  const offCanvas = fresh();
  offCanvas.cards[0].x = 2460;
  const tooMany = fresh();
  tooMany.cards = Array.from({ length: 1001 }, (_, i) => ({
    ...tooMany.cards[0],
    id: String(i),
  }));
  const cases = [
    { text: "not JSON", message: "有效的 JSON" },
    { text: JSON.stringify(missing), message: "字段" },
    { text: JSON.stringify(offCanvas), message: "坐标" },
    { text: JSON.stringify(tooMany), message: "1000" },
    { text: " ".repeat(MAX_IMPORT_BYTES + 1), message: "1 MB" },
  ];
  for (const item of cases) {
    await page.locator("#import-file").setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from(item.text),
    });
    await expect(page.locator("#import-status")).toContainText(item.message);
    expect(await storedCanvas(page)).toBe(before);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), BACKUP_KEY),
    ).toBe(backup);
    await expect(page.locator("#confirm")).not.toBeVisible();
    await expect(page.locator(".card")).toHaveCount(4);
  }
});

test("legacy import drops unknown fields and renders HTML as text without executing it", async ({
  page,
}) => {
  await startSaved(page);
  const before = await storedCanvas(page);
  const state = fresh();
  delete state.version;
  state.cards[0].text = '<img src=x onerror="window.importExecuted=true">';
  state.cards[0].category = "<b>分类</b>";
  state.groups[0].name = "<em>主题</em>";
  state.action.text = "<script>window.importExecuted=true</script>";
  state.privateExtra = "must be discarded";
  state.cards[0].extra = "discarded";
  await uploadJson(page, state);
  await confirm(page);
  await expect(page.locator("#import-status")).toContainText("已导入。");
  await expect(page.locator(".card").first()).toContainText(
    state.cards[0].text,
  );
  await expect(page.locator("#groups")).toContainText(state.groups[0].name);
  await expect(page.locator("#action-text")).toHaveValue(state.action.text);
  await expect(
    page.locator("#cards img, #cards script, #groups em"),
  ).toHaveCount(0);
  expect(await page.evaluate(() => window.importExecuted)).toBeUndefined();
  const imported = JSON.parse(await storedCanvas(page));
  expect(imported.version).toBe(1);
  expect(imported.privateExtra).toBeUndefined();
  expect(imported.cards[0].extra).toBeUndefined();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), BACKUP_KEY),
  ).toBe(before);
});

test("failed backup or canvas writes leave existing data intact and editing/export usable", async ({
  page,
}) => {
  await startSaved(page);
  const before = await storedCanvas(page);
  await page.evaluate(
    (key) => localStorage.setItem(key, "old backup"),
    BACKUP_KEY,
  );
  for (const failedKey of [BACKUP_KEY, KEY]) {
    await page.evaluate((key) => {
      window.originalStorageWrite ??= Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name === key) throw new DOMException("Quota", "QuotaExceededError");
        return window.originalStorageWrite.call(this, name, value);
      };
    }, failedKey);
    await uploadJson(page, { ...fresh(), cards: [], groups: [], action: null });
    await confirm(page);
    await expect(page.locator("#import-status")).toContainText("存储写入失败");
    expect(await storedCanvas(page)).toBe(before);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), BACKUP_KEY),
    ).toBe("old backup");
    await expect(page.locator(".card")).toHaveCount(4);
  }
  // A failed primary-key write still allows in-memory edits and export.
  await page.getByRole("button", { name: "编辑想法 1", exact: true }).click();
  await page
    .getByLabel("内容", { exact: true })
    .fill("存储故障时仍能编辑和导出");
  await expect(page.getByRole("alert")).toContainText("本地保存失败");
  expect((await downloadJson(page)).cards[0].text).toBe(
    "存储故障时仍能编辑和导出",
  );
  expect(await storedCanvas(page)).toBe(before);
});

test("corrupt active records are never overwritten by import", async ({
  page,
}) => {
  await page.addInitScript(
    (key) => localStorage.setItem(key, "broken record"),
    KEY,
  );
  await start(page);
  await uploadJson(page, fresh());
  await confirm(page);
  await expect(page.locator("#import-status")).toContainText(
    "原记录不会被覆盖",
  );
  expect(await storedCanvas(page)).toBe("broken record");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), BACKUP_KEY),
  ).toBeNull();
});

test("a saved completed action does not automatically open the feedback prompt", async ({
  page,
}) => {
  const saved = fresh();
  saved.welcomed = true;
  saved.action.done = true;
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [KEY, JSON.stringify(saved)],
  );
  await page.goto("/");
  await expect(page.locator("#done")).toBeChecked();
  await expect(page.locator("#action-feedback")).toBeHidden();
  await page.locator("#done").uncheck();
  await page.locator("#done").check();
  await expect(page.locator("#action-feedback")).toBeVisible();
});

test("a damaged undo slot leaves the current canvas unchanged", async ({
  page,
}) => {
  await startSaved(page);
  const before = await storedCanvas(page);
  await page.evaluate(
    (key) => localStorage.setItem(key, "damaged backup"),
    BACKUP_KEY,
  );
  await page.reload();
  await page.locator("#restore-backup").click();
  await expect(page.locator("#import-status")).toContainText("恢复未完成");
  expect(await storedCanvas(page)).toBe(before);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), BACKUP_KEY),
  ).toBe("damaged backup");
});

test("feedback capture excludes user content and URL and sends once per session", async ({
  page,
}) => {
  const production = process.env.VERCEL_ENV === "production";
  const simulated = process.env.PUZZLE_ANALYTICS_LOCAL_TEST === "1";
  test.skip(
    !production && !simulated,
    "Enable the existing local analytics simulation or a local production build",
  );
  const events = [];
  await page.route("https://us.i.posthog.com/i/v0/e/", async (route) => {
    if (route.request().method() !== "OPTIONS")
      events.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: '{"status":"Ok"}',
    });
  });
  if (production) {
    // Serve the local app under its formal origin; never contact the live site.
    await page.routeWebSocket("wss://puzzle.mariustang.com/**", (socket) =>
      socket.close(),
    );
    await page.route("https://puzzle.mariustang.com/**", async (route) => {
      const url = new URL(route.request().url());
      const response = await page.request.get(
        "http://127.0.0.1:4173" + url.pathname + url.search,
      );
      await route.fulfill({ response });
    });
  }
  const url = production
    ? "https://puzzle.mariustang.com/?analytics_test=1&private=secret-url"
    : "/?analytics_test=1&private=secret-url";
  await page.goto(url);
  await page.getByRole("button", { name: "开始拼图" }).click();
  await page.getByRole("button", { name: "编辑想法 1", exact: true }).click();
  await page.getByLabel("内容", { exact: true }).fill("secret-card-text");
  await page.getByRole("textbox", { name: "新主题名称" }).fill("secret-theme");
  await page.getByRole("button", { name: "创建主题并加入" }).click();
  await page.locator("#action-text").fill("secret-action-text");
  await page.locator("#done").check();
  await page
    .locator("#action-feedback")
    .getByRole("button", { name: "一般", exact: true })
    .click();
  await expect
    .poll(() => events.filter((e) => e.event === "puzzle_feedback").length)
    .toBe(1);
  const feedback = events.find((e) => e.event === "puzzle_feedback");
  expect(feedback.properties).toEqual({
    site: "puzzle",
    rating: "neutral",
    traffic: "test",
  });
  expect(JSON.stringify(feedback)).not.toMatch(
    /secret|url|card|theme|action-text/,
  );
  expect(feedback.distinct_id).toBe(
    events.find((e) => e.event === "puzzle_home_open").distinct_id,
  );
  await page.locator("#done").uncheck();
  await page.locator("#done").check();
  await page.reload();
  await expect(page.locator("#action-feedback")).toContainText("谢谢你的反馈");
  for (const button of await page.locator("#action-feedback button").all())
    await expect(button).toBeDisabled();
  expect(events.filter((e) => e.event === "puzzle_feedback")).toHaveLength(1);
  if (production) {
    // A production-configured build on an unapproved origin must not send
    // feedback, even though the existing funnel remains unchanged.
    await page.goto("http://127.0.0.1:4173/");
    await page.getByRole("button", { name: "开始拼图" }).click();
    await page.evaluate(() => {
      window.feedbackAttempts = 0;
      const original = window.fetch;
      window.fetch = (...args) => {
        if (
          args[1]?.body &&
          JSON.parse(args[1].body).event === "puzzle_feedback"
        )
          window.feedbackAttempts++;
        return original(...args);
      };
    });
    await page.locator("#done").check();
    await page
      .locator("#action-feedback")
      .getByRole("button", { name: "有用", exact: true })
      .click();
    await expect(page.locator("#action-feedback")).toContainText(
      "谢谢你的反馈",
    );
    expect(await page.evaluate(() => window.feedbackAttempts)).toBe(0);
  }
});

import { KEY, colors, validate } from "./state.js";

export const BACKUP_KEY = "ember-idea-puzzle-backup-v1";
export const EXPORT_SCHEMA = "ember-idea-puzzle";
export const MAX_IMPORT_BYTES = 1024 * 1024;

// Keep the on-disk canvas model unchanged; schema identifies export files only.
function knownState(s) {
  return {
    version: 1,
    cards: s.cards.map((c) => ({
      id: c.id,
      text: c.text,
      category: c.category,
      color: c.color,
      x: c.x,
      y: c.y,
      group: c.group,
    })),
    groups: s.groups.map((g) => ({ id: g.id, name: g.name })),
    action: !s.action
      ? null
      : {
          cardId: s.action.cardId,
          text: s.action.text,
          done: s.action.done,
        },
    welcomed: s.welcomed,
  };
}

export function exportPuzzle(state) {
  return { schema: EXPORT_SCHEMA, ...knownState(state) };
}

export function parsePuzzleImport(text, { maxBytes = MAX_IMPORT_BYTES } = {}) {
  if (new TextEncoder().encode(text).length > maxBytes)
    throw Error("文件超过 1 MB，未导入。请使用较小的备份文件。");
  let s;
  try {
    s = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw Error("文件不是有效的 JSON，当前画布没有改变。");
  }
  if (
    !s ||
    typeof s !== "object" ||
    Array.isArray(s) ||
    (Object.hasOwn(s, "schema") && s.schema !== EXPORT_SCHEMA) ||
    (Object.hasOwn(s, "version") && s.version !== 1)
  )
    throw Error("文件格式或版本不支持，当前画布没有改变。");
  if (
    !Array.isArray(s.cards) ||
    !Array.isArray(s.groups) ||
    !Object.hasOwn(s, "action") ||
    (s.action !== null &&
      (typeof s.action !== "object" || Array.isArray(s.action))) ||
    typeof s.welcomed !== "boolean"
  )
    throw Error("文件缺少必要字段，当前画布没有改变。");
  if (s.cards.length > 1000 || s.groups.length > 1000)
    throw Error("卡片或主题超过 1000 个，当前画布没有改变。");
  const within = (value, limit) =>
    typeof value === "string" && value.length <= limit;
  if (
    s.cards.some(
      (c) =>
        !c ||
        !within(c.text, 5000) ||
        !within(c.category, 40) ||
        typeof c.color !== "string" ||
        !Object.hasOwn(colors, c.color),
    ) ||
    s.groups.some((g) => !g || !within(g.name, 40)) ||
    (s.action && !within(s.action.text, 1000))
  )
    throw Error("文字长度或卡片字段不符合限制，当前画布没有改变。");
  try {
    // Project only known fields before calling the existing state validator.
    // It checks IDs, references, counts and the existing safe canvas bounds.
    return validate(knownState(s));
  } catch {
    throw Error("卡片坐标、字段或关联无效，当前画布没有改变。");
  }
}

export function replaceWithBackup(storage, current, next) {
  const previousBackup = storage.getItem(BACKUP_KEY);
  // Serialize both before writing either key. setItem is atomic per key.
  const backup = JSON.stringify(current);
  const replacement = JSON.stringify(next);
  storage.setItem(BACKUP_KEY, backup);
  try {
    storage.setItem(KEY, replacement);
  } catch (error) {
    // Restore the previous undo slot if the second write fails. Even if storage
    // becomes entirely unavailable, the active canvas key has not been replaced.
    try {
      if (previousBackup === null) storage.removeItem(BACKUP_KEY);
      else storage.setItem(BACKUP_KEY, previousBackup);
    } catch {
      /* The current canvas and its new backup are still intact. */
    }
    throw error;
  }
}

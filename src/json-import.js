import {
  BACKUP_KEY,
  MAX_IMPORT_BYTES,
  parsePuzzleImport,
  replaceWithBackup,
} from "./json-transfer.js";

export function mountJsonImport({ getState, replace, canReplace, confirm }) {
  const section = document.createElement("section");
  section.className = "json-transfer";
  section.setAttribute("aria-label", "本机 JSON 备份与导入");
  section.innerHTML = `<h2>本机 JSON 备份</h2><p class="muted">导入会替换当前画布；替换前先在本机保留最近一份备份。文件只在此浏览器读取。</p><div class="json-transfer-actions"><button type="button" id="import-json">导入 JSON</button><button type="button" id="restore-backup">恢复上一份</button></div><input type="file" id="import-file" accept="application/json" aria-label="选择 JSON 备份文件" hidden><p id="import-status" role="status" aria-live="polite"></p>`;
  document.body.append(section);
  const input = section.querySelector("input");
  const open = section.querySelector("#import-json");
  const undo = section.querySelector("#restore-backup");
  const status = section.querySelector("#import-status");
  let busy = false;
  function controls() {
    open.disabled = busy;
    try {
      undo.disabled = busy || localStorage.getItem(BACKUP_KEY) === null;
    } catch {
      undo.disabled = true;
    }
  }
  function install(next) {
    if (!canReplace())
      throw Error(
        "现有本地记录损坏，导入已取消。请先导出当前画布，原记录不会被覆盖。",
      );
    try {
      replaceWithBackup(localStorage, getState(), next);
    } catch {
      throw Error(
        "本机存储写入失败，当前画布没有替换。仍可继续编辑和导出 JSON。",
      );
    }
    replace(next);
  }
  open.onclick = () => input.click();
  input.onchange = async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file || busy) return;
    busy = true;
    controls();
    try {
      if (file.size > MAX_IMPORT_BYTES)
        throw Error("文件超过 1 MB，未导入。当前画布没有改变。");
      let text;
      try {
        text = await file.text();
      } catch {
        throw Error("无法读取文件，当前画布没有改变。请重新选择 JSON 备份。");
      }
      const next = parsePuzzleImport(text);
      if (
        !(await confirm(
          "导入并替换当前画布？",
          `将用导入的内容替换当前画布：${next.cards.length} 张卡片、${next.groups.length} 个主题。当前画布会先在本机备份一份。`,
        ))
      )
        return;
      install(next);
      status.textContent =
        "已导入。上一份内容已备份在本机，可点击'恢复上一份'撤销。";
    } catch (error) {
      status.textContent = error.message;
    } finally {
      busy = false;
      controls();
    }
  };
  undo.onclick = async () => {
    if (busy) return;
    busy = true;
    controls();
    try {
      const text = localStorage.getItem(BACKUP_KEY);
      if (text === null) throw Error("本机还没有可恢复的上一份内容。");
      // The upload size cap must not prevent undoing a larger existing canvas.
      const previous = parsePuzzleImport(text, { maxBytes: Infinity });
      if (
        !(await confirm(
          "恢复上一份？",
          `将恢复 ${previous.cards.length} 张卡片、${previous.groups.length} 个主题。当前画布会先在本机备份一份。`,
        ))
      )
        return;
      install(previous);
      status.textContent = "已恢复上一份。恢复前的内容已备份在本机。";
    } catch (error) {
      status.textContent = "恢复未完成：" + error.message;
    } finally {
      busy = false;
      controls();
    }
  };
  controls();
  return section;
}

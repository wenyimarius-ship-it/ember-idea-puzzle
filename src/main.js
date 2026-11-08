import { mountCloudVault } from "./cloud-vault.js";
import { installCanvasAnalytics } from "./canvas-analytics.js";
import "./style.css";
import { KEY, colors, fresh, validate } from "./state.js";
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let state,
  selected = null,
  storageError = "",
  drag = null;
try {
  const saved = localStorage.getItem(KEY);
  state = saved ? validate(JSON.parse(saved)) : fresh();
} catch {
  state = fresh();
  storageError =
    "无法读取本地数据，正在使用临时示例。原有数据不会被覆盖，请先导出备份。";
}
let blocked = !!storageError;
$("#app").innerHTML =
  `<header><a class="brand" href="./"><span class="mark">✣</span><span>Idea Puzzle<small>EMBER LAB / 想法拼图</small></span></a><div class="header-right"><span id="save-status" role="status">仅保存在此浏览器</span><button id="help" class="icon" aria-label="使用指南">?</button></div></header>
<main><section class="workspace"><div class="intro"><div><p class="eyebrow">A LITTLE ROOM FOR YOUR THOUGHTS</p><h1>给想法一点空间<span>。</span></h1><p class="subtitle">把零散放下，让联系浮现。从一个小行动开始。</p></div><button class="primary" id="add">＋ 新想法</button></div>
<div class="toolbar"><div><span class="live-dot"></span><span id="count"></span><span class="divider">/</span><span class="drag-tip">拖动手柄整理 · 点击卡片编辑</span></div><details><summary>画布选项 <span>⌄</span></summary><div class="menu"><button id="export">导出 JSON</button><button id="restore">恢复初始示例</button><button id="clear" class="danger">清空画布</button></div></details></div>
<div id="storage-warning" role="alert" hidden></div><div class="viewport" aria-label="可滚动的想法画布" tabindex="0"><div id="board"><div id="groups"></div><div id="cards"></div><div id="empty" hidden><span>✣</span><h2>留白，也是一个开始。</h2><p>一个问题、一闪而过的念头，或者还没想好的计划。</p><button class="primary" id="empty-add">写下第一个想法</button></div><span class="board-note">THINK LOOSELY. CONNECT FREELY.</span></div></div><footer><span>你的思考，不必排成直线。</span><span>无账号 · 默认本地 · 可选云端</span></footer></section>
<aside><section id="editor"></section><section class="action-panel"><p class="eyebrow">ONE SMALL STEP</p><h2>把想法变成下一步 <span>↗</span></h2><div id="action"></div></section><div class="side-note"><span>✳</span><p>先收集，再连接。<br>不用一次想明白所有事情。</p></div></aside></main>
<dialog id="confirm"><form method="dialog"><p class="eyebrow">整理之前，确认一下</p><h2 id="confirm-title"></h2><p id="confirm-copy"></p><div class="dialog-actions"><button value="cancel">取消</button><button value="ok" class="primary">确认</button></div></form></dialog>
<dialog id="guide"><form method="dialog"><span class="guide-symbol">✣</span><p class="eyebrow">WELCOME TO YOUR THINKING DESK</p><h2>想法不必一开始就有答案。</h2><ol><li><b>放下来</b><span>新建卡片，记录多行文字，用颜色和分类标记。</span></li><li><b>连起来</b><span>拖动顶部手柄整理位置，在编辑栏加入同一主题。</span></li><li><b>迈一步</b><span>选中一张卡片，把它设为下一步行动。</span></li></ol><p>手机上滑动画布浏览；按住手柄拖动。选中手柄后，也可用方向键微调位置。</p><p>内容默认保存在当前浏览器。可在页面底部主动保存云端副本；清理浏览器数据前，请保管恢复码或导出 JSON。</p><button class="primary" value="ok">开始拼图 ↗</button></form></dialog>`;
function save() {
  if (blocked) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    $("#save-status").textContent = "已自动保存 · 此浏览器";
    storageError = "";
  } catch {
    storageError =
      "本地保存失败（存储被禁用或空间不足）。当前修改只在本次页面有效，请立即导出 JSON 备份。";
    $("#save-status").textContent = "尚未保存";
  }
  warning();
}
function warning() {
  $("#storage-warning").hidden = !storageError;
  $("#storage-warning").textContent = storageError;
}
function renderBoard() {
  $("#count").textContent =
    `${state.cards.length} 个想法 · ${state.groups.length} 个主题`;
  $("#empty").hidden = !!state.cards.length;
  $("#cards").innerHTML = state.cards
    .map(
      (c, i) =>
        `<article class="card ${c.color} ${selected === c.id ? "selected" : ""}" data-id="${esc(c.id)}" style="left:${c.x}px;top:${c.y}px;z-index:${selected === c.id ? 10 : 2}"><div class="card-top"><span>${esc(c.category || "未分类")}</span><button class="handle" aria-label="移动想法 ${i + 1}" title="拖动或用方向键移动">⠿</button></div><button class="card-text" aria-label="编辑想法 ${i + 1}">${esc(c.text || "还没写下的想法…")}</button><div class="card-bottom"><span>${state.action?.cardId === c.id ? (state.action.done ? "✓ 已完成" : "↗ 下一步") : "IDEA " + String(i + 1).padStart(2, "0")}</span><span>↗</span></div></article>`,
    )
    .join("");
  drawGroups();
}
function drawGroups() {
  $("#groups").innerHTML = state.groups
    .map((g) => {
      const members = state.cards.filter((c) => c.group === g.id);
      if (!members.length) return "";
      const x = Math.min(...members.map((c) => c.x)) - 18,
        y = Math.min(...members.map((c) => c.y)) - 46;
      const right = Math.max(...members.map((c) => c.x + 258)) + 18,
        bottom = Math.max(...members.map((c) => c.y + 248)) + 18;
      return `<div class="group" style="left:${x}px;top:${y}px;width:${right - x}px;height:${bottom - y}px"><span>${esc(g.name)} <small>${members.length} 个想法</small></span></div>`;
    })
    .join("");
}
function renderEditor() {
  const c = state.cards.find((c) => c.id === selected);
  $("#editor").innerHTML = c
    ? `<div class="section-heading"><p class="eyebrow">SHAPE YOUR IDEA</p><button id="close-editor" aria-label="关闭编辑">×</button></div><h2>这一刻的想法</h2><label for="text">内容</label><textarea id="text" rows="5" maxlength="5000" placeholder="写下你的想法…">${esc(c.text)}</textarea><label for="category">分类</label><input id="category" maxlength="40" list="categories" value="${esc(c.category)}" placeholder="例如：灵感、工作、生活"><datalist id="categories">${[...new Set(["灵感", "工作", "生活", ...state.cards.map((c) => c.category)])].map((s) => `<option value="${esc(s)}">`).join("")}</datalist><label>卡片颜色</label><div class="swatches">${Object.entries(
        colors,
      )
        .map(
          ([key, name]) =>
            `<button class="swatch ${key}" data-color="${key}" aria-label="${name}" aria-pressed="${c.color === key}">${c.color === key ? "✓" : ""}</button>`,
        )
        .join(
          "",
        )}</div><label for="group-select">主题分组</label><select id="group-select"><option value="">自由想法 · 不分组</option>${state.groups.map((g) => `<option value="${esc(g.id)}" ${c.group === g.id ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select><form id="new-group"><input aria-label="新主题名称" maxlength="40" placeholder="新的主题名称"><button aria-label="创建主题并加入" title="创建主题并加入">＋</button></form>${c.group ? '<button id="rename-group" class="text-button">重命名当前主题</button>' : ""}<div class="editor-actions"><button id="set-action">↗ 设为下一步</button><button id="delete" class="text-button danger">删除想法</button></div>`
    : `<p class="eyebrow">YOUR THINKING DESK</p><h2>从一个念头开始</h2><p class="muted">点击卡片，编辑它的内容、颜色与主题。<br><br>相关的想法可以归入同一主题，让联系变得清晰。</p><div class="mini-cards"><i></i><i></i><i></i></div><button id="sidebar-add" class="wide">＋ 记录一个想法</button>`;
  if (!c) {
    $("#sidebar-add").onclick = add;
    return;
  }
  $("#close-editor").onclick = () => {
    selected = null;
    render();
  };
  $("#text").oninput = (e) => {
    c.text = e.target.value;
    save();
    renderBoard();
    renderAction();
  };
  $("#category").oninput = (e) => {
    c.category = e.target.value;
    save();
    renderBoard();
  };
  document.querySelectorAll("[data-color]").forEach(
    (b) =>
      (b.onclick = () => {
        c.color = b.dataset.color;
        save();
        renderBoard();
        renderEditor();
      }),
  );
  $("#group-select").onchange = (e) => {
    c.group = e.target.value;
    pruneGroups();
    save();
    render();
  };
  $("#new-group").onsubmit = (e) => {
    e.preventDefault();
    const input = e.target.querySelector("input"),
      name = input.value.trim();
    if (!name) {
      input.reportValidity();
      return;
    }
    const existing = state.groups.find((g) => g.name === name);
    const id = existing?.id || crypto.randomUUID();
    if (!existing) state.groups.push({ id, name });
    c.group = id;
    pruneGroups();
    save();
    render();
  };
  if (c.group)
    $("#rename-group").onclick = () => {
      const g = state.groups.find((g) => g.id === c.group);
      const name = prompt("主题名称", g.name)?.trim();
      if (name) {
        g.name = name.slice(0, 40);
        save();
        render();
      }
    };
  $("#delete").onclick = async () => {
    if (
      await confirm(
        "删除这张想法？",
        "此操作无法撤销；该卡片对应的下一步行动也会移除。",
      )
    ) {
      state.cards = state.cards.filter((x) => x.id !== c.id);
      if (state.action?.cardId === c.id) state.action = null;
      selected = null;
      pruneGroups();
      save();
      render();
    }
  };
  $("#set-action").onclick = async () => {
    if (
      state.action &&
      state.action.cardId !== c.id &&
      !(await confirm("替换当前的下一步？", "现有行动及其完成状态将被替换。"))
    )
      return;
    state.action = {
      cardId: c.id,
      text: state.action?.cardId === c.id ? state.action.text : "",
      done: false,
    };
    save();
    renderBoard();
    renderAction();
    $("#action-text").focus();
  };
}
function renderAction() {
  const a = state.action,
    c = state.cards.find((c) => c.id === a?.cardId);
  $("#action").innerHTML = c
    ? `<p class="action-source">来自想法 · ${esc(c.text.slice(0, 75) || "未命名想法")}</p><label for="action-text">一个具体、够小的行动</label><textarea id="action-text" rows="3" maxlength="1000" placeholder="例如：花 10 分钟画出草图">${esc(a.text)}</textarea><label class="check"><input type="checkbox" id="done" ${a.done ? "checked" : ""}>${a.done ? "已完成，做得好。" : "我完成了这一步"}</label><button class="text-button" id="remove-action">移除行动</button>`
    : `<p class="muted">不急着做所有事情。<br>选一张卡片，设定一个现在能开始的小行动。</p><span class="action-empty">↗</span>`;
  if (c) {
    $("#action-text").oninput = (e) => {
      a.text = e.target.value;
      save();
    };
    $("#done").onchange = (e) => {
      a.done = e.target.checked;
      save();
      renderBoard();
      renderAction();
    };
    $("#remove-action").onclick = () => {
      state.action = null;
      save();
      renderBoard();
      renderAction();
    };
  }
}
function pruneGroups() {
  state.groups = state.groups.filter((g) =>
    state.cards.some((c) => c.group === g.id),
  );
}
function render() {
  renderBoard();
  renderEditor();
  renderAction();
  warning();
}
async function confirm(title, copy) {
  $("#confirm-title").textContent = title;
  $("#confirm-copy").textContent = copy;
  const d = $("#confirm");
  d.showModal();
  return new Promise((resolve) => {
    d.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      const ok = e.submitter?.value === "ok";
      d.close();
      resolve(ok);
    };
    d.oncancel = () => resolve(false);
  });
}
function add() {
  const viewport = $(".viewport");
  const c = {
    id: crypto.randomUUID(),
    text: "",
    category: "灵感",
    color: "butter",
    x: Math.min(
      2170,
      Math.max(24, viewport.scrollLeft + 50 + (state.cards.length % 3) * 24),
    ),
    y: Math.min(
      1500,
      Math.max(60, viewport.scrollTop + 90 + (state.cards.length % 3) * 24),
    ),
    group: "",
  };
  state.cards.push(c);
  selected = c.id;
  save();
  render();
  document
    .querySelector(`[data-id="${c.id}"]`)
    .scrollIntoView({ block: "nearest", inline: "nearest" });
  $("#text").focus({ preventScroll: window.innerWidth > 800 });
}
$("#add").onclick = add;
$("#empty-add").onclick = add;
$("#cards").onclick = (e) => {
  const c = e.target.closest(".card");
  if (c && !e.target.closest(".handle")) {
    selected = c.dataset.id;
    renderBoard();
    renderEditor();
    if (innerWidth <= 800)
      $("#editor").scrollIntoView({ behavior: "smooth", block: "start" });
  }
};
$("#cards").onpointerdown = (e) => {
  const handle = e.target.closest(".handle");
  if (!handle || e.button !== 0) return;
  const el = handle.closest(".card"),
    c = state.cards.find((c) => c.id === el.dataset.id);
  drag = { id: c.id, x: e.clientX, y: e.clientY, cx: c.x, cy: c.y, el, handle };
  handle.setPointerCapture(e.pointerId);
  el.classList.add("dragging");
};
$("#cards").onpointermove = (e) => {
  if (!drag) return;
  const c = state.cards.find((c) => c.id === drag.id);
  c.x = Math.round(Math.max(24, Math.min(2170, drag.cx + e.clientX - drag.x)));
  c.y = Math.round(Math.max(60, Math.min(1500, drag.cy + e.clientY - drag.y)));
  drag.el.style.left = c.x + "px";
  drag.el.style.top = c.y + "px";
  drawGroups();
};
function endDrag() {
  if (!drag) return;
  drag.el.classList.remove("dragging");
  drag = null;
  save();
}
$("#cards").onpointerup = endDrag;
$("#cards").onpointercancel = endDrag;
$("#cards").onlostpointercapture = endDrag;
$("#cards").onkeydown = (e) => {
  if (
    !e.target.closest(".handle") ||
    !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
  )
    return;
  e.preventDefault();
  const c = state.cards.find(
      (c) => c.id === e.target.closest(".card").dataset.id,
    ),
    step = e.shiftKey ? 40 : 10;
  c.x = Math.max(
    24,
    Math.min(
      2170,
      c.x + (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0),
    ),
  );
  c.y = Math.max(
    60,
    Math.min(
      1500,
      c.y + (e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0),
    ),
  );
  const el = e.target.closest(".card");
  el.style.left = c.x + "px";
  el.style.top = c.y + "px";
  drawGroups();
  save();
};
$("#export").onclick = () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `idea-puzzle-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("#clear").onclick = async () => {
  if (
    await confirm(
      "清空整个画布？",
      "所有想法、主题和行动将被删除。建议先导出 JSON 备份。",
    )
  ) {
    state = { version: 1, cards: [], groups: [], action: null, welcomed: true };
    selected = null;
    save();
    render();
  }
};
$("#restore").onclick = async () => {
  if (
    await confirm(
      "恢复初始示例？",
      "当前所有内容将被示例替换。建议先导出 JSON 备份。",
    )
  ) {
    state = fresh();
    state.welcomed = true;
    selected = null;
    save();
    render();
  }
};
$("#help").onclick = () => $("#guide").showModal();
$("#guide").addEventListener("close", () => {
  state.welcomed = true;
  save();
});
render();
if (!state.welcomed) $("#guide").showModal();

installCanvasAnalytics();

const cloudAnalytics = typeof __POSTHOG_CONFIG__ !== 'undefined' ? __POSTHOG_CONFIG__ : null;
mountCloudVault({site:'puzzle',getState:()=>({schema:1,data:state}),restore:payload=>{
  if(payload?.schema!==1)throw Error('invalid_payload');
  const next=validate(payload.data);state=next;state.welcomed=true;selected=null;save();render();
},analytics:cloudAnalytics?{enabled:cloudAnalytics.environment==='production',token:cloudAnalytics.token,apiHost:cloudAnalytics.apiHost}:null});

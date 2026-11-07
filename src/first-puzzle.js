// Deliberately separate from the saved workspace: examples never mutate v1 data.
export const exampleThoughts = ["想改主页", "不知道先改哪", "今晚只有 20 分钟"];
export const examplePairs = {
  "0-1": {
    relation: "你已经有修改目标，下一步可以先找出最需要调整的一处。",
    actions: [
      "花 10 分钟圈出首页最想改的一处。",
      "写下最想调整的三个问题。",
      "先完成一个最小的文字修改。",
    ],
  },
  "0-2": {
    relation: "你想改主页，但时间有限，可以先从一处小修改开始。",
    actions: [
      "我先花 10 分钟，圈出首页最想修改的一处。",
      "用 20 分钟改好一段首页文字。",
      "先写下今天只改哪一处。",
    ],
  },
  "1-2": {
    relation: "时间有限，不必一次决定所有事情，可以先挑一个最容易开始的部分。",
    actions: [
      "花 5 分钟列出两个能开始的小地方。",
      "挑一个最容易修改的句子，先改好它。",
      "用 10 分钟写下一个需要确认的问题。",
    ],
  },
};
export const customRelations = [
  {
    name: "暂时还看不出关系",
    text: "这两件事可能值得放在一起考虑。你想先推进哪一件？",
    actions: [
      "我先选一件，写下一个今天能开始的小步骤。",
      "用 5 分钟分别记下这两件事最需要确认的问题。",
    ],
  },
  {
    name: "一件是目标，另一件是限制",
    text: "我把一件事看作目标，另一件事看作限制；先找一个限制内能做的小步骤。",
    actions: [
      "写下哪个是目标、哪个是限制，再圈出一个可行的小步骤。",
      "把目标缩小到今天条件允许的一步。",
    ],
  },
  {
    name: "两件事可以一起推进",
    text: "我认为这两件事可以一起推进，先找一个共同的小切口。",
    actions: [
      "写下一个能同时推进这两件事的小动作。",
      "花 5 分钟列出两件事能共用的一个准备步骤。",
    ],
  },
  {
    name: "需要先完成一件，才能开始另一件",
    text: "我认为这两件事有先后顺序，先确认哪件在前，再开始它的第一步。",
    actions: [
      "写下先后顺序，再完成前一件事最小的一步。",
      "先明确前一件事做到什么程度，就能开始后一件。",
    ],
  },
];
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function mountFirstPuzzle(openWorkspace) {
  const app = document.querySelector("#app");
  let screen = "home",
    mode = "example",
    thoughts = [],
    chosen = [],
    drafts = ["", "", ""],
    relationIndex = 0,
    relation = "",
    action = "",
    relationConfirmed = false;
  const pair = () => examplePairs[[...chosen].sort((a, b) => a - b).join("-")];
  const suggestions = () =>
    mode === "example"
      ? pair().actions
      : customRelations[
          relation === customRelations[relationIndex].text ? relationIndex : 0
        ].actions;
  function focusTitle() {
    document.querySelector(".journey-title")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  function change(next) {
    screen = next;
    render();
    focusTitle();
  }
  function reset() {
    chosen = [];
    relation = "";
    action = "";
    relationIndex = 0;
    relationConfirmed = false;
  }
  function header() {
    return `<header class="journey-header"><a class="brand" href="./"><span class="mark">✣</span><span>Idea Puzzle<small>想法拼图</small></span></a><span class="journey-caption">给念头一个小小的出口</span></header>`;
  }
  function render() {
    document.body.classList.add("first-puzzle");
    let body = "";
    if (screen === "home")
      body = `<section class="welcome"><p class="eyebrow">TWO THOUGHTS. ONE SMALL STEP.</p><h1 class="journey-title" tabindex="-1">脑子里有几件事打转？<br>挑一件，看看现在能做什么。</h1><p class="welcome-copy">选两个念头，找一点联系，带走一个今天能做的小动作。</p><div class="welcome-art" aria-hidden="true"><span>一个念头</span><b>＋</b><span>一个开始</span></div><div class="welcome-buttons"><button id="examples" class="primary">试一组示例 <span aria-hidden="true">↗</span></button><button id="own" class="text-button">写我自己的</button></div></section>`;
    if (screen === "write")
      body = `<section class="write-step"><button class="text-button" id="home">← 返回</button><p class="eyebrow">YOUR OWN THOUGHTS</p><h1 class="journey-title" tabindex="-1">最近，什么事在打转？</h1><p class="step-copy">每张写一个念头，至少写两张。短短一句就好。</p><form id="thought-form"><div class="writing-cards">${drafts.map((t, i) => `<label class="writing-card">念头 ${i + 1}${i === 2 ? " · 可选" : ""}<textarea aria-label="念头 ${i + 1}" maxlength="300" rows="3" placeholder="${["我想…", "但我也在想…", "还有…"][i]}">${escape(t)}</textarea></label>`).join("")}</div><p id="input-error" role="alert"></p><button class="primary">选两个，放在一起 ↗</button></form></section>`;
    if (screen === "choose") {
      const ready = chosen.length === 2;
      body = `<section class="choose-step"><button class="text-button" id="restart">← ${mode === "example" ? "返回" : "修改念头"}</button><p class="eyebrow">01 / PUT TWO THOUGHTS TOGETHER</p><h1 class="journey-title" tabindex="-1">哪两个念头，想放在一起？</h1><p class="step-copy">点两张就好。再点一次，可以取消。</p><div class="thought-grid ${ready ? "paired" : ""}">${thoughts.map((t, i) => `<button class="thought-tile tone-${i}" data-thought="${i}" aria-pressed="${chosen.includes(i)}" ${ready && !chosen.includes(i) ? "disabled" : ""}><span class="tile-number">0${i + 1}<span>${chosen.includes(i) ? "✓ 已选" : "＋"}</span></span><strong>${escape(t)}</strong><span class="tile-foot">${chosen.includes(i) ? "再次点击取消" : "点击选择"}</span></button>`).join("")}</div><p class="selection-count" role="status">${ready ? "两个念头，放在一起了。" : chosen.length ? "选好了一个，再点一个。" : "还没选好也没关系，从一个开始。"}</p>${ready ? `<div class="connection-panel"><span class="connection-symbol" aria-hidden="true">↔</span><p class="eyebrow">A POSSIBLE CONNECTION</p>${mode === "custom" ? `<label for="relationship">你觉得它们是什么关系？</label><select id="relationship">${customRelations.map((r, i) => `<option value="${i}" ${relationIndex === i ? "selected" : ""}>${r.name}</option>`).join("")}</select><label for="relation-text">关系说明 · 可以改成你的理解</label><textarea id="relation-text" rows="3" maxlength="600" ${relationConfirmed ? "readonly" : ""}>${escape(relation)}</textarea><p class="honest-note">这是你选择的整理方式，不是系统对念头的判断。</p>${!relationConfirmed ? '<button id="confirm-relation" class="primary">用这个关系继续 ↗</button>' : '<button id="edit-relation" class="text-button">修改关系</button>'}` : `<p class="relationship-copy" id="relationship-copy">${escape(relation)}</p>`}${mode === "example" || relationConfirmed ? actionPanel() : ""}</div>` : ""}</section>`;
    }
    if (screen === "result")
      body = `<section class="result-step"><p class="eyebrow">A SMALL STEP, READY TO GO.</p><h1 class="journey-title" tabindex="-1">这一组，拼好了。</h1><p class="step-copy">今天不用做完所有事。有这一步，就够了。</p><article class="result-card" aria-label="我的结果卡"><div class="result-card-top"><span>IDEA PUZZLE</span><span aria-hidden="true">✣</span></div><div class="result-thoughts"><span>${escape(thoughts[chosen[0]])}</span><b>＋</b><span>${escape(thoughts[chosen[1]])}</span></div><p class="result-relation">${escape(relation)}</p><div class="result-action"><span>我接下来的一小步</span><strong>${escape(action)}</strong></div><p class="result-signature">不用一次想明白。先开始一点点。</p></article><div class="result-buttons"><button id="copy" class="primary">复制</button><button id="again">再来一组</button></div><p id="copy-status" role="status" aria-live="polite"></p><div id="copy-fallback" hidden><label for="copy-text">无法自动复制，请选中并复制下方文字</label><textarea id="copy-text" readonly rows="7"></textarea></div><div class="continue-line"><button id="continue" class="text-button">继续整理 ↗</button><span>可选 · 打开自由画布，不会改动原有内容</span></div></section>`;
    app.innerHTML =
      header() +
      `<main class="journey">${body}</main><footer class="journey-footer">一个想法，不需要一次走很远。</footer>`;
    bind();
  }
  function actionPanel() {
    return `<section class="small-action"><p class="eyebrow">02 / ONE SMALL STEP</p><h2>现在能做什么？</h2><div class="action-options">${suggestions()
      .map(
        (s, i) =>
          `<button class="action-option" data-suggestion="${i}" aria-pressed="${action === s}">${escape(s)}</button>`,
      )
      .join(
        "",
      )}</div><label for="small-action">选一个建议，或写自己的小动作</label><textarea id="small-action" maxlength="1000" rows="2" placeholder="${escape(suggestions()[0])}">${escape(action)}</textarea><button id="finish" class="primary">带走这一步 ↗</button></section>`;
  }
  function bind() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.onclick = fn;
    };
    on("examples", () => {
      mode = "example";
      thoughts = [...exampleThoughts];
      reset();
      change("choose");
    });
    on("own", () => {
      mode = "custom";
      reset();
      change("write");
    });
    on("home", () => change("home"));
    on("restart", () => {
      reset();
      change(mode === "example" ? "home" : "write");
    });
    const form = document.querySelector("#thought-form");
    if (form) {
      form.querySelectorAll("textarea").forEach(
        (el, i) =>
          (el.oninput = () => {
            drafts[i] = el.value;
          }),
      );
      form.onsubmit = (e) => {
        e.preventDefault();
        const entries = drafts.map((s) => s.trim()).filter(Boolean);
        if (entries.length < 2) {
          document.querySelector("#input-error").textContent =
            "再写一个念头，就能放在一起了。";
          return;
        }
        thoughts = entries;
        reset();
        change("choose");
      };
    }
    document.querySelectorAll("[data-thought]").forEach(
      (button) =>
        (button.onclick = () => {
          const i = Number(button.dataset.thought);
          chosen = chosen.includes(i)
            ? chosen.filter((x) => x !== i)
            : [...chosen, i];
          relationConfirmed = false;
          action = "";
          relationIndex = 0;
          relation =
            chosen.length === 2
              ? mode === "example"
                ? pair().relation
                : customRelations[0].text
              : "";
          render();
          document
            .querySelector(`[data-thought="${i}"]`)
            .focus({ preventScroll: true });
          if (chosen.length === 2) {
            const connection = document.querySelector(
              ".relationship-copy, #relationship",
            );
            connection.scrollIntoView({
              block: "nearest",
              behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "instant"
                : "smooth",
            });
          }
        }),
    );
    const relationship = document.querySelector("#relationship");
    if (relationship)
      relationship.onchange = () => {
        relationIndex = Number(relationship.value);
        relation = customRelations[relationIndex].text;
        relationConfirmed = false;
        action = "";
        render();
        document.querySelector("#relationship").focus({ preventScroll: true });
      };
    const rt = document.querySelector("#relation-text");
    if (rt)
      rt.oninput = () => {
        relation = rt.value;
      };
    on("edit-relation", () => {
      relationConfirmed = false;
      action = "";
      render();
      document.querySelector("#relation-text").focus();
    });
    on("confirm-relation", () => {
      relation = relation.trim() || customRelations[relationIndex].text;
      relationConfirmed = true;
      render();
      document
        .querySelector(".small-action")
        .scrollIntoView({ block: "nearest", behavior: "smooth" });
      document.querySelector("#small-action").focus({ preventScroll: true });
    });
    document.querySelectorAll("[data-suggestion]").forEach(
      (button) =>
        (button.onclick = () => {
          action = suggestions()[Number(button.dataset.suggestion)];
          document.querySelector("#small-action").value = action;
          document
            .querySelectorAll("[data-suggestion]")
            .forEach((el) =>
              el.setAttribute("aria-pressed", String(el === button)),
            );
        }),
    );
    const at = document.querySelector("#small-action");
    if (at)
      at.oninput = () => {
        action = at.value;
        document
          .querySelectorAll("[data-suggestion]")
          .forEach((el) =>
            el.setAttribute(
              "aria-pressed",
              String(suggestions()[Number(el.dataset.suggestion)] === action),
            ),
          );
      };
    on("finish", () => {
      relation =
        relation.trim() ||
        (mode === "example"
          ? pair().relation
          : customRelations[relationIndex].text);
      action = action.trim() || suggestions()[0];
      change("result");
    });
    on("copy", async () => {
      const status = document.querySelector("#copy-status");
      const text = `${thoughts[chosen[0]]} ＋ ${thoughts[chosen[1]]}\n\n${relation}\n\n我的下一步：${action}`;
      try {
        await navigator.clipboard.writeText(text);
        if (!status.isConnected) return;
        document.querySelector("#copy-status").textContent =
          "已复制，可以粘贴到你的备忘录。";
      } catch {
        if (!status.isConnected) return;
        document.querySelector("#copy-status").textContent =
          "未能自动复制，请手动复制。";
        document.querySelector("#copy-fallback").hidden = false;
        const field = document.querySelector("#copy-text");
        field.value = text;
        field.focus();
        field.select();
      }
    });
    on("again", () => {
      reset();
      change("home");
    });
    on("continue", () => {
      openWorkspace();
    });
  }
  render();
  return () => {
    render();
    focusTitle();
  };
}

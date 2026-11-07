import "./play.css";

const stage = document.querySelector("#puzzle-play");
const example = ["想改主页", "不知道先改哪里", "今晚只有 20 分钟"];
let thoughts = [];
let selected = [];
let usingExample = false;

function show(title, body, focus = true) {
  stage.innerHTML = `<h2 tabindex="-1">${title}</h2>${body}`;
  if (focus) stage.querySelector("h2").focus();
}

function intro(focus = true) {
  show("脑子里有几件事打转？", `<p>挑两条有关的念头，把它们拼成一个今天能做的小动作。</p>
    <div class="actions"><button class="primary" data-step="example">用例子试一次</button>
    <button data-step="own">写自己的想法</button></div>`, focus);
}

function own() {
  show("写下两三条念头", `<form id="thoughts">
    <label>第一个念头<input name="first" required maxlength="120"></label>
    <label>第二个念头<input name="second" required maxlength="120"></label>
    <label>第三个念头（可选）<input name="third" maxlength="120"></label>
    <button class="primary">去拼一拼</button>
    <p role="status"></p></form>`);
}

function choose() {
  show("哪两条念头有关？", `<p>点两张卡片。你可以随时取消选中。</p>
    <div class="cards">${thoughts.map((_, i) => `<button data-card="${i}" aria-pressed="false"></button>`).join("")}</div>
    <div class="actions"><button class="primary" data-step="join" disabled>把这两条拼起来</button></div>
    <p role="status"></p>`);
  stage.querySelectorAll("[data-card]").forEach((button, i) => {
    button.textContent = thoughts[i];
  });
  updateSelection();
}

function updateSelection() {
  stage.querySelectorAll("[data-card]").forEach((button) => {
    button.setAttribute("aria-pressed", String(selected.includes(Number(button.dataset.card))));
  });
  stage.querySelector('[data-step="join"]').disabled = selected.length !== 2;
  stage.querySelector('[role="status"]').textContent = `已选 ${selected.length}/2 条`;
}

function addPair() {
  stage.querySelector(".pair").textContent = selected.map((i) => thoughts[i]).join(" ＋ ");
}

function action() {
  show("从这两条念头出发，先做哪一步？", `<p class="pair"></p>
    <form id="action"><label>我可以先……<input name="action" required maxlength="160"></label>
    <button class="primary">完成我的拼图</button>
    <p role="status"></p></form>
    <button data-step="choose">重新选两条</button>`);
  addPair();
  const exampleActions = {
    "0,1": "花 10 分钟圈出首页最想改的一处",
    "0,2": "用 10 分钟写出首页的一处改动",
    "1,2": "用 10 分钟列出两个候选改动，再挑一个",
  };
  if (usingExample) stage.querySelector("input").value = exampleActions[[...selected].sort().join(",")];
}

function finish(value) {
  show("我的下一步", `<p class="pair"></p><p id="result"></p>
    <div class="actions"><button class="primary" data-step="restart">再拼一次</button></div>`);
  addPair();
  stage.querySelector("#result").textContent = `我可以先：${value}`;
}

stage.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const { card, step } = button.dataset;
  if (card !== undefined) {
    const i = Number(card);
    if (selected.includes(i)) selected = selected.filter((id) => id !== i);
    else if (selected.length < 2) selected.push(i);
    else {
      stage.querySelector('[role="status"]').textContent = "已选两条。想换一条，先取消一张。";
      return;
    }
    updateSelection();
  } else if (step === "example") {
    thoughts = example;
    selected = [];
    usingExample = true;
    choose();
  } else if (step === "own") own();
  else if (step === "join" && selected.length === 2) action();
  else if (step === "choose") choose();
  else if (step === "restart") intro();
});

stage.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  const fields = new FormData(form);
  if (form.id === "thoughts") {
    const first = fields.get("first").trim();
    const second = fields.get("second").trim();
    if (!first || !second) {
      form.querySelector('[role="status"]').textContent = "先写下前两条念头。";
      return;
    }
    thoughts = [first, second, fields.get("third").trim()].filter(Boolean);
    selected = [];
    usingExample = false;
    choose();
  } else if (form.id === "action") {
    const value = fields.get("action").trim();
    if (value) finish(value);
    else form.querySelector('[role="status"]').textContent = "写一个你现在能开始的小动作。";
  }
});

intro(false);

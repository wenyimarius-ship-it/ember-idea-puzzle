export const KEY = "ember-idea-puzzle-v1";
export const colors = {
  butter: "奶油黄",
  sage: "鼠尾草绿",
  rose: "浅蔷薇",
  sky: "雾蓝",
  lilac: "淡紫",
};
export const fresh = () => ({
  version: 1,
  cards: [
    {
      id: "a",
      text: "做一个让想法自由生长的地方。\n先记录，不急着判断。",
      category: "灵感",
      color: "butter",
      x: 90,
      y: 110,
      group: "g1",
    },
    {
      id: "b",
      text: "如果把每周的小发现，\n变成一本自己的观察手册？",
      category: "生活",
      color: "sage",
      x: 390,
      y: 150,
      group: "g1",
    },
    {
      id: "c",
      text: "约一位朋友散步，\n聊聊最近想尝试的新事情。",
      category: "生活",
      color: "rose",
      x: 760,
      y: 100,
      group: "",
    },
    {
      id: "d",
      text: "不需要完整的计划。\n一个小小的开始就够了。",
      category: "灵感",
      color: "lilac",
      x: 200,
      y: 440,
      group: "",
    },
  ],
  groups: [{ id: "g1", name: "让日常多一点可能" }],
  action: { cardId: "a", text: "用 10 分钟写下三个最近的好奇。", done: false },
  welcomed: false,
});
export function validate(s) {
  if (
    !s ||
    s.version !== 1 ||
    !Array.isArray(s.cards) ||
    !Array.isArray(s.groups) ||
    s.cards.length > 1000 ||
    s.groups.length > 1000
  )
    throw Error("无效的数据");
  const ids = new Set();
  for (const g of s.groups) {
    if (
      !g ||
      typeof g.id !== "string" ||
      typeof g.name !== "string" ||
      ids.has(g.id)
    )
      throw Error("无效分组");
    ids.add(g.id);
  }
  const cardIds = new Set();
  for (const c of s.cards) {
    if (
      !c ||
      typeof c.id !== "string" ||
      cardIds.has(c.id) ||
      typeof c.text !== "string" ||
      typeof c.category !== "string" ||
      !Object.hasOwn(colors, c.color) ||
      !Number.isFinite(c.x) ||
      !Number.isFinite(c.y) ||
      c.x < 24 ||
      c.y < 60 ||
      c.x > 2170 ||
      c.y > 1500 ||
      typeof c.group !== "string" ||
      (c.group && !ids.has(c.group))
    )
      throw Error("无效卡片");
    cardIds.add(c.id);
  }
  if (
    s.action &&
    (!cardIds.has(s.action.cardId) ||
      typeof s.action.text !== "string" ||
      typeof s.action.done !== "boolean")
  )
    throw Error("无效行动");
  return s;
}

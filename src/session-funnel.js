// Anonymous, tab-scoped first-touch funnel. Never accepts puzzle text or IDs.
export const FUNNEL_KEY = "idea-puzzle-funnel-v1";
export const FUNNEL_EVENTS = Object.freeze({
  open: "puzzle_home_open",
  start: "puzzle_first_start",
  complete: "puzzle_first_complete",
});
const sources = new Set(["wechat_moments", "direct", "other"]);
export function createSessionFunnel({ storage, url, send, key = FUNNEL_KEY }) {
  let state;
  let enabled = true;
  try {
    const saved = JSON.parse(storage.getItem(key) || "null");
    state =
      saved && sources.has(saved.source) && Array.isArray(saved.sent)
        ? {
            source: saved.source,
            sent: saved.sent.filter((key) => Object.hasOwn(FUNNEL_EVENTS, key)),
          }
        : {
            source:
              new URL(url).searchParams.get("utm_source") === "wechat_moments"
                ? "wechat_moments"
                : new URL(url).searchParams.has("utm_source")
                  ? "other"
                  : "direct",
            sent: [],
          };
    storage.setItem(key, JSON.stringify(state));
  } catch {
    enabled = false;
  }
  function record(node) {
    if (
      !enabled ||
      !Object.hasOwn(FUNNEL_EVENTS, node) ||
      state.sent.includes(node)
    )
      return;
    if (node === "start" && !state.sent.includes("open")) return;
    if (node === "complete" && !state.sent.includes("start")) return;
    try {
      // Reserve before sending: never duplicate attempts after reload or re-entry.
      state.sent.push(node);
      storage.setItem(key, JSON.stringify(state));
    } catch {
      enabled = false;
      return;
    }
    try {
      send(FUNNEL_EVENTS[node], { source: state.source });
    } catch {
      /* Analytics must never block the puzzle. */
    }
  }
  return { record, enabled };
}

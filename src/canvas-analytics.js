import { recordPuzzleNode } from "./analytics.js";
// Observe the a521819 controls; do not alter their behavior, markup or saved data.
export function installCanvasAnalytics(root = document) {
  root.addEventListener("click", (event) => {
    if (
      event.target.closest?.(
        '#guide button[value="ok"], #add, #empty-add, #sidebar-add, .card-text, #set-action',
      )
    )
      recordPuzzleNode("start");
  });
  root.addEventListener("pointerdown", (event) => {
    if (event.button === 0 && event.target.closest?.(".handle"))
      recordPuzzleNode("start");
  });
  root.addEventListener("keydown", (event) => {
    if (
      event.target.matches?.(".handle") &&
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
    )
      recordPuzzleNode("start");
  });
  root.addEventListener("input", (event) => {
    if (event.target.matches?.("#text, #category, #action-text"))
      recordPuzzleNode("start");
  });
  root.addEventListener("change", (event) => {
    if (event.target.matches?.("#group-select")) recordPuzzleNode("start");
    if (event.target.matches?.("#done")) {
      recordPuzzleNode("start");
      // Existing explicit completion, not an invented result-card interaction.
      if (
        event.target.checked &&
        root.querySelector("#action-text")?.value.trim()
      )
        recordPuzzleNode("complete");
    }
  });
  recordPuzzleNode("open");
}

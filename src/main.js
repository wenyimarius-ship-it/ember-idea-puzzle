import "./style.css";
import "./first-puzzle.css";
import { mountFirstPuzzle } from "./first-puzzle.js";
const VIEW_KEY = "idea-puzzle-view"; // Session navigation only, never workspace content.
let returnToPuzzle;
function remember(view) {
  try {
    sessionStorage.setItem(VIEW_KEY, view);
  } catch {
    /* Navigation works without browser storage. */
  }
}
async function openWorkspace() {
  const { mountWorkspace } = await import("./workspace.js");
  mountWorkspace(() => {
    remember("puzzle");
    returnToPuzzle();
  });
  document.body.classList.remove("first-puzzle");
  remember("workspace");
  window.scrollTo(0, 0);
}
returnToPuzzle = mountFirstPuzzle(openWorkspace);
try {
  if (sessionStorage.getItem(VIEW_KEY) === "workspace") openWorkspace();
} catch {
  /* Default to the first experience. */
}

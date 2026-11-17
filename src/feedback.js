import { RATINGS, recordPuzzleFeedback } from "./feedback-analytics.js";

export const FEEDBACK_KEY = "ember-idea-puzzle-feedback-v1";

export function createFeedbackSession({ storage, send }) {
  let ready = false,
    rating = null;
  try {
    const saved = JSON.parse(storage.getItem(FEEDBACK_KEY) || "null");
    ready = saved?.ready === true;
    rating = ready && RATINGS.includes(saved?.rating) ? saved.rating : null;
  } catch {
    /* Keep a usable in-memory prompt without sending duplicates. */
  }
  function persist() {
    try {
      storage.setItem(FEEDBACK_KEY, JSON.stringify({ ready, rating }));
      return true;
    } catch {
      return false;
    }
  }
  return {
    get ready() {
      return ready;
    },
    get rating() {
      return rating;
    },
    complete() {
      ready = true;
      persist();
    },
    vote(value) {
      if (!ready || rating || !RATINGS.includes(value)) return;
      rating = value;
      // Reserve the session before sending; a reload/repeat cannot count again.
      if (persist()) {
        try {
          send(value);
        } catch {
          /* Never block the action panel. */
        }
      }
    },
  };
}

export function mountFeedback(root = document) {
  const slot = root.querySelector("#action-feedback");
  let storage;
  try {
    storage = sessionStorage;
  } catch {
    storage = null;
  }
  const session = createFeedbackSession({
    storage,
    send: recordPuzzleFeedback,
  });
  slot.innerHTML = `<p id="feedback-question">这一步对你有用吗？</p><div class="feedback-options" role="group" aria-labelledby="feedback-question"><button type="button" data-rating="useful">有用</button><button type="button" data-rating="neutral">一般</button><button type="button" data-rating="not_useful">没用</button></div><p class="feedback-status" role="status" aria-live="polite"></p>`;
  function render() {
    slot.classList.toggle("feedback-ready", session.ready);
    slot.setAttribute("aria-hidden", String(!session.ready));
    for (const button of slot.querySelectorAll("button")) {
      button.disabled = !session.ready || !!session.rating;
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.rating === session.rating),
      );
    }
    slot.querySelector("[role=status]").textContent = session.rating
      ? "谢谢你的反馈"
      : "";
  }
  // Installed after the existing analytics observer: use its exact explicit
  // completion condition without changing the funnel or persisted action model.
  root.addEventListener("change", (event) => {
    if (
      event.target.matches?.("#done") &&
      event.target.checked &&
      root.querySelector("#action-text")?.value.trim()
    ) {
      session.complete();
      render();
    }
  });
  slot.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-rating]");
    if (!button || button.disabled) return;
    session.vote(button.dataset.rating);
    render();
  });
  render();
  return slot;
}

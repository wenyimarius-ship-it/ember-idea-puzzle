import { inject, track } from "@vercel/analytics";
import { createSessionFunnel } from "./session-funnel.js";

// No automatic pageviews, no query strings, no puzzle content or identity props.
export function sanitizeAnalyticsEvent(event) {
  if (event.type !== "event") return null;
  try {
    return { ...event, url: new URL(event.url).origin + "/" };
  } catch {
    return null;
  }
}
let funnel;
export function recordPuzzleNode(node) {
  if (import.meta.env.VITE_PUZZLE_ANALYTICS !== "vercel") return;
  try {
    if (!funnel) {
      funnel = createSessionFunnel({
        storage: sessionStorage,
        url: location.href,
        send: track,
      });
      if (!funnel.enabled) return;
      inject({
        mode: "production",
        debug: false,
        disableAutoTrack: true,
        beforeSend: sanitizeAnalyticsEvent,
      });
    }
    funnel.record(node);
  } catch {
    /* Optional statistics must not affect the experience. */
  }
}

import { analyticsContext } from "./analytics.js";

export const FEEDBACK_ORIGIN = "https://puzzle.mariustang.com";
export const RATINGS = Object.freeze(["useful", "neutral", "not_useful"]);

export function feedbackContext(config, storage, url) {
  if (!config) return null;
  const parsed = new URL(url);
  // Local simulation requires the existing explicit preview configuration.
  const localTest =
    config.environment === "preview" &&
    parsed.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
  if (parsed.origin !== FEEDBACK_ORIGIN && !localTest) return null;
  return analyticsContext(config.environment, storage, url);
}

export function makeFeedbackPayload(rating, traffic, distinctId, token) {
  if (!RATINGS.includes(rating) || !["test", "production"].includes(traffic))
    return null;
  return {
    api_key: token,
    event: "puzzle_feedback",
    distinct_id: distinctId,
    properties: { site: "puzzle", rating, traffic },
  };
}

export function recordPuzzleFeedback(rating) {
  const config =
    typeof __POSTHOG_CONFIG__ !== "undefined" ? __POSTHOG_CONFIG__ : null;
  try {
    const context = feedbackContext(config, sessionStorage, location.href);
    if (!context) return;
    let distinctId = sessionStorage.getItem(context.idKey);
    if (!distinctId) {
      distinctId = crypto.randomUUID();
      sessionStorage.setItem(context.idKey, distinctId);
    }
    const payload = makeFeedbackPayload(
      rating,
      context.traffic,
      distinctId,
      config.token,
    );
    if (payload)
      void fetch(config.apiHost + "/i/v0/e/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "omit",
        referrerPolicy: "no-referrer",
        keepalive: true,
      }).catch(() => {});
  } catch {
    /* Feedback and editing remain usable if storage or capture fails. */
  }
}

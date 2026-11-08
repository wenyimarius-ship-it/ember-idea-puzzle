import { createSessionFunnel, FUNNEL_EVENTS } from "./session-funnel.js";
export const POSTHOG_FUNNEL_KEY = "idea-puzzle-funnel-posthog-test-v1";
const ID_KEY = "idea-puzzle-posthog-test-anonymous-session-v1";
export function makePostHogPayload(event, source, distinctId, token) {
  if (
    !Object.values(FUNNEL_EVENTS).includes(event) ||
    source !== "wechat_moments"
  )
    return null;
  return {
    api_key: token,
    event,
    distinct_id: distinctId,
    properties: {
      site: "puzzle",
      source,
      traffic: "test",
      $process_person_profile: false,
      $geoip_disable: true,
    },
  };
}
let funnel;
export function recordPuzzleNode(node) {
  const config =
    typeof __POSTHOG_PREVIEW__ !== "undefined" ? __POSTHOG_PREVIEW__ : null;
  if (!config) return;
  try {
    // Visiting an untagged Preview must not consume the acceptance session.
    const saved = JSON.parse(
      sessionStorage.getItem(POSTHOG_FUNNEL_KEY) || "null",
    );
    if (
      new URL(location.href).searchParams.get("utm_source") !==
        "wechat_moments" &&
      saved?.source !== "wechat_moments"
    )
      return;
    if (!funnel) {
      let distinctId = sessionStorage.getItem(ID_KEY);
      if (!distinctId) {
        distinctId = crypto.randomUUID();
        sessionStorage.setItem(ID_KEY, distinctId);
      }
      funnel = createSessionFunnel({
        storage: sessionStorage,
        url: location.href,
        key: POSTHOG_FUNNEL_KEY,
        send: (event, { source }) => {
          const payload = makePostHogPayload(
            event,
            source,
            distinctId,
            config.token,
          );
          // Manual capture only. No SDK, automatic pageviews, clicks or recordings.
          if (payload)
            void fetch(config.apiHost + "/i/v0/e/", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
              credentials: "omit",
              referrerPolicy: "no-referrer",
              keepalive: true,
            }).catch(() => {});
        },
      });
    }
    funnel.record(node);
  } catch {
    /* Storage or network failure must never break the puzzle. */
  }
}

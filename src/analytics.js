import { createSessionFunnel, FUNNEL_EVENTS } from "./session-funnel.js";
export const POSTHOG_FUNNEL_KEY = "idea-puzzle-funnel-posthog-test-v1";
export function analyticsContext(environment, storage, url) {
  if (!["preview", "production"].includes(environment)) return null;
  const marker = "idea-puzzle-posthog-production-test-active-v1";
  if (
    environment === "production" &&
    new URL(url).searchParams.get("analytics_test") === "1"
  )
    storage.setItem(marker, "1");
  const traffic =
    environment === "preview" || storage.getItem(marker) === "1"
      ? "test"
      : "production";
  return {
    traffic,
    key:
      environment === "preview"
        ? POSTHOG_FUNNEL_KEY
        : `idea-puzzle-funnel-posthog-production-${traffic}-v1`,
    idKey:
      environment === "preview"
        ? "idea-puzzle-posthog-test-anonymous-session-v1"
        : `idea-puzzle-posthog-production-${traffic}-anonymous-session-v1`,
  };
}
export function makePostHogPayload(
  event,
  source,
  distinctId,
  token,
  traffic = "test",
) {
  if (
    !Object.values(FUNNEL_EVENTS).includes(event) ||
    source !== "wechat_moments" ||
    !["test", "production"].includes(traffic)
  )
    return null;
  return {
    api_key: token,
    event,
    distinct_id: distinctId,
    properties: {
      site: "puzzle",
      source,
      traffic,
      $process_person_profile: false,
      $geoip_disable: true,
    },
  };
}
let funnel, activeKey;
export function recordPuzzleNode(node) {
  const config =
    typeof __POSTHOG_CONFIG__ !== "undefined" ? __POSTHOG_CONFIG__ : null;
  if (!config) return;
  try {
    const context = analyticsContext(
      config.environment,
      sessionStorage,
      location.href,
    );
    if (!context) return;
    const saved = JSON.parse(sessionStorage.getItem(context.key) || "null");
    if (
      new URL(location.href).searchParams.get("utm_source") !==
        "wechat_moments" &&
      saved?.source !== "wechat_moments"
    )
      return;
    if (!funnel || activeKey !== context.key) {
      activeKey = context.key;
      let distinctId = sessionStorage.getItem(context.idKey);
      if (!distinctId) {
        distinctId = crypto.randomUUID();
        sessionStorage.setItem(context.idKey, distinctId);
      }
      funnel = createSessionFunnel({
        storage: sessionStorage,
        url: location.href,
        key: context.key,
        send: (event, { source }) => {
          const payload = makePostHogPayload(
            event,
            source,
            distinctId,
            config.token,
            context.traffic,
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

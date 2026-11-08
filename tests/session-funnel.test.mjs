import test from "node:test";
import assert from "node:assert/strict";
import { createSessionFunnel, FUNNEL_KEY } from "../src/session-funnel.js";
function storage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) || null,
    setItem: (key, value) => data.set(key, value),
  };
}
test("one event per node, including repeat puzzles, remount, reload and changed UTM", () => {
  const store = storage(),
    events = [];
  const send = (name, data) => events.push({ name, data });
  const a = createSessionFunnel({
    storage: store,
    url: "https://puzzle.test/?utm_source=wechat_moments&secret=never",
    send,
  });
  for (let i = 0; i < 3; i++) {
    a.record("open");
    a.record("start");
    a.record("complete");
  }
  const b = createSessionFunnel({
    storage: store,
    url: "https://puzzle.test/?utm_source=other",
    send,
  });
  b.record("open");
  b.record("start");
  b.record("complete");
  assert.deepEqual(events, [
    { name: "puzzle_home_open", data: { source: "wechat_moments" } },
    { name: "puzzle_first_start", data: { source: "wechat_moments" } },
    { name: "puzzle_first_complete", data: { source: "wechat_moments" } },
  ]);
  assert.equal(JSON.stringify(events).includes("secret"), false);
});
test("opening source survives URL removal and completion cannot precede start", () => {
  const store = storage(),
    events = [];
  const send = (...args) => events.push(args);
  const a = createSessionFunnel({
    storage: store,
    url: "https://puzzle.test/?utm_source=wechat_moments",
    send,
  });
  a.record("complete");
  a.record("open");
  const b = createSessionFunnel({
    storage: store,
    url: "https://puzzle.test/",
    send,
  });
  b.record("start");
  b.record("complete");
  assert.equal(events.length, 3);
  assert.equal(events[2][1].source, "wechat_moments");
});
test("separate tab session counts again, raw source values and arbitrary nodes are never sent", () => {
  const events = [];
  for (let i = 0; i < 2; i++) {
    const f = createSessionFunnel({
      storage: storage(),
      url: "https://puzzle.test/?utm_source=someone@example.com",
      send: (...args) => events.push(args),
    });
    f.record("open");
    f.record("not-a-node");
  }
  assert.equal(events.length, 2);
  assert.equal(events[0][1].source, "other");
});
test("storage unavailable disables analytics, sender failure never breaks gameplay", () => {
  const f = createSessionFunnel({
    storage: {
      getItem() {
        throw Error("disabled");
      },
    },
    url: "https://puzzle.test",
    send() {
      throw Error("must not send");
    },
  });
  assert.equal(f.enabled, false);
  assert.doesNotThrow(() => f.record("open"));
  const g = createSessionFunnel({
    storage: storage(),
    url: "https://puzzle.test",
    send() {
      throw Error("blocked");
    },
  });
  assert.doesNotThrow(() => g.record("open"));
});

test("PostHog payload only accepts three nodes, has no content or pageview", async () => {
  const { makePostHogPayload } = await import("../src/analytics.js");
  assert.equal(
    makePostHogPayload(
      "$pageview",
      "wechat_moments",
      "anonymous",
      "test-token",
    ),
    null,
  );
  const p = makePostHogPayload(
    "puzzle_home_open",
    "wechat_moments",
    "anonymous",
    "test-token",
  );
  assert.deepEqual(p.properties, {
    site: "puzzle",
    source: "wechat_moments",
    traffic: "test",
    $process_person_profile: false,
    $geoip_disable: true,
  });
  assert.equal("url" in p, false);
});

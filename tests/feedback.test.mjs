import test from "node:test";
import assert from "node:assert/strict";
import { createFeedbackSession } from "../src/feedback.js";
import {
  FEEDBACK_ORIGIN,
  feedbackContext,
  makeFeedbackPayload,
} from "../src/feedback-analytics.js";

function storage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}
test("feedback requires completion and reserves exactly one rating across reloads", () => {
  const st = storage(),
    sent = [];
  const options = { storage: st, send: (rating) => sent.push(rating) };
  const session = createFeedbackSession(options);
  session.vote("useful");
  assert.equal(session.ready, false);
  assert.deepEqual(sent, []);
  session.complete();
  session.vote("private user text");
  assert.equal(session.rating, null);
  session.vote("useful");
  session.vote("neutral");
  session.complete();
  const reloaded = createFeedbackSession(options);
  reloaded.vote("not_useful");
  assert.equal(reloaded.ready, true);
  assert.equal(reloaded.rating, "useful");
  assert.deepEqual(sent, ["useful"]);
});
test("storage failure never sends, sender failure never permits a duplicate", () => {
  const blocked = createFeedbackSession({
    storage: null,
    send: () => assert.fail("must not send"),
  });
  assert.doesNotThrow(() => {
    blocked.complete();
    blocked.vote("neutral");
  });
  assert.equal(blocked.rating, "neutral");
  let calls = 0;
  const options = {
    storage: storage(),
    send: () => {
      calls++;
      throw Error("offline");
    },
  };
  const session = createFeedbackSession(options);
  session.complete();
  assert.doesNotThrow(() => session.vote("useful"));
  createFeedbackSession(options).vote("useful");
  assert.equal(calls, 1);
});
test("feedback payload has exactly the three allowed properties for every rating", () => {
  for (const rating of ["useful", "neutral", "not_useful"]) {
    const payload = makeFeedbackPayload(rating, "test", "anonymous", "token");
    assert.deepEqual(payload, {
      api_key: "token",
      event: "puzzle_feedback",
      distinct_id: "anonymous",
      properties: { site: "puzzle", rating, traffic: "test" },
    });
  }
  assert.equal(
    makeFeedbackPayload("<script>private</script>", "test", "a", "t"),
    null,
  );
  assert.equal(makeFeedbackPayload("useful", "unknown", "a", "t"), null);
});
test("only the formal origin sends; local simulation requires preview configuration", () => {
  const config = { environment: "production" };
  const st = storage();
  assert.equal(
    feedbackContext(config, st, FEEDBACK_ORIGIN + "/").traffic,
    "production",
  );
  for (const url of [
    "https://other.example",
    "https://puzzle.mariustang.com.evil.test",
    "http://puzzle.mariustang.com",
    "https://puzzle.mariustang.com:8443",
    "https://preview.vercel.app",
    "http://127.0.0.1:4173",
  ])
    assert.equal(feedbackContext(config, st, url), null);
  assert.equal(feedbackContext(null, st, "http://127.0.0.1:4173"), null);
  for (const host of ["127.0.0.1", "localhost", "[::1]"])
    assert.equal(
      feedbackContext({ environment: "preview" }, st, `http://${host}:4173/`)
        .traffic,
      "test",
    );
});
test("analytics_test=1 uses the existing sticky test session without leaking its URL", () => {
  const config = { environment: "production" },
    st = storage();
  const context = feedbackContext(
    config,
    st,
    FEEDBACK_ORIGIN + "/?analytics_test=1&private=secret",
  );
  assert.equal(context.traffic, "test");
  assert.equal(
    feedbackContext(config, st, FEEDBACK_ORIGIN + "/").traffic,
    "test",
  );
  const payload = makeFeedbackPayload(
    "neutral",
    context.traffic,
    "anonymous",
    "token",
  );
  assert.equal(JSON.stringify(payload).includes("secret"), false);
  assert.equal("url" in payload.properties, false);
});

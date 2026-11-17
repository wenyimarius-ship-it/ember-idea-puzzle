import test from "node:test";
import assert from "node:assert/strict";
import { KEY, fresh } from "../src/state.js";
import {
  BACKUP_KEY,
  EXPORT_SCHEMA,
  MAX_IMPORT_BYTES,
  exportPuzzle,
  parsePuzzleImport,
  replaceWithBackup,
} from "../src/json-transfer.js";

test("new and legacy exports round-trip without changing the canvas model", () => {
  const state = fresh();
  const exported = exportPuzzle(state);
  assert.equal(exported.schema, EXPORT_SCHEMA);
  assert.equal(exported.version, 1);
  assert.deepEqual(parsePuzzleImport(JSON.stringify(exported)), state);
  assert.deepEqual(parsePuzzleImport(JSON.stringify(state)), state);
  const { version, ...legacy } = state;
  assert.deepEqual(parsePuzzleImport(JSON.stringify(legacy)), state);
  assert.deepEqual(parsePuzzleImport("\uFEFF" + JSON.stringify(state)), state);
  assert.equal("schema" in state, false);
});

test("only known fields survive, HTML remains plain text", () => {
  const state = fresh();
  state.url = "https://private.example";
  state.cards[0].unknown = { script: "never" };
  state.groups[0].unknown = "never";
  state.action.unknown = "never";
  state.cards[0].text = '<img src=x onerror="alert(1)">';
  const next = parsePuzzleImport(JSON.stringify(state));
  assert.equal(next.cards[0].text, state.cards[0].text);
  assert.equal("url" in next, false);
  for (const item of [next.cards[0], next.groups[0], next.action])
    assert.equal("unknown" in item, false);
});

const invalid = {
  "missing cards": (s) => {
    delete s.cards;
  },
  "missing groups": (s) => {
    delete s.groups;
  },
  "missing action": (s) => {
    delete s.action;
  },
  "missing card text": (s) => {
    delete s.cards[0].text;
  },
  "wrong schema": (s) => {
    s.schema = "other";
  },
  "future version": (s) => {
    s.version = 2;
  },
  "missing welcomed flag": (s) => {
    delete s.welcomed;
  },
  "too many cards": (s) => {
    s.cards = Array.from({ length: 1001 }, (_, i) => ({
      ...s.cards[0],
      id: String(i),
    }));
  },
  "too many themes": (s) => {
    s.groups = Array.from({ length: 1001 }, (_, i) => ({
      id: String(i),
      name: "x",
    }));
  },
  "card text length": (s) => {
    s.cards[0].text = "x".repeat(5001);
  },
  "category length": (s) => {
    s.cards[0].category = "x".repeat(41);
  },
  "theme length": (s) => {
    s.groups[0].name = "x".repeat(41);
  },
  "action length": (s) => {
    s.action.text = "x".repeat(1001);
  },
  "negative coordinates": (s) => {
    s.cards[0].x = -1;
  },
  "right of canvas": (s) => {
    s.cards[0].x = 2460;
  },
  "below canvas": (s) => {
    s.cards[0].y = 1800;
  },
  "coordinate type": (s) => {
    s.cards[0].x = "90";
  },
  "duplicate IDs": (s) => {
    s.cards[1].id = s.cards[0].id;
  },
  "unknown group": (s) => {
    s.cards[0].group = "missing";
  },
  "unknown action card": (s) => {
    s.action.cardId = "missing";
  },
  "prototype color": (s) => {
    s.cards[0].color = "__proto__";
  },
  "object color": (s) => {
    s.cards[0].color = { toString: "not a color" };
  },
  "null card": (s) => {
    s.cards[0] = null;
  },
};
for (const [name, mutate] of Object.entries(invalid)) {
  test(`rejects ${name} without mutating the supplied data`, () => {
    const state = fresh();
    mutate(state);
    const text = JSON.stringify(state);
    assert.throws(() => parsePuzzleImport(text));
    assert.equal(JSON.stringify(state), text);
  });
}
test("rejects non-JSON and oversized UTF-8 files", () => {
  for (const text of ["not json", "null", "[]", "{}", "{", '"hello"'])
    assert.throws(() => parsePuzzleImport(text));
  assert.throws(
    () => parsePuzzleImport(" ".repeat(MAX_IMPORT_BYTES + 1)),
    /1 MB/,
  );
  assert.throws(
    () => parsePuzzleImport("中".repeat(MAX_IMPORT_BYTES / 2)),
    /1 MB/,
  );
});
test("an existing canvas larger than the upload cap can still be restored from local backup", () => {
  const state = fresh();
  state.action = null;
  state.cards = Array.from({ length: 500 }, (_, i) => ({
    ...state.cards[0],
    id: String(i),
    text: "x".repeat(2500),
  }));
  const text = JSON.stringify(state);
  assert.throws(() => parsePuzzleImport(text), /1 MB/);
  assert.deepEqual(parsePuzzleImport(text, { maxBytes: Infinity }), state);
});

function store() {
  const data = new Map([
    [KEY, "original"],
    [BACKUP_KEY, "older backup"],
  ]);
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}
test("writes the current backup before the replacement; undo preserves the replaced content", () => {
  const storage = store();
  const original = fresh(),
    next = { ...fresh(), cards: [], groups: [], action: null };
  const writes = [];
  storage.setItem = (key, value) => {
    writes.push(key);
    storage.data.set(key, value);
  };
  replaceWithBackup(storage, original, next);
  assert.deepEqual(writes, [BACKUP_KEY, KEY]);
  assert.deepEqual(JSON.parse(storage.getItem(KEY)), next);
  assert.deepEqual(JSON.parse(storage.getItem(BACKUP_KEY)), original);
  replaceWithBackup(
    storage,
    next,
    parsePuzzleImport(storage.getItem(BACKUP_KEY)),
  );
  assert.deepEqual(JSON.parse(storage.getItem(KEY)), original);
  assert.deepEqual(JSON.parse(storage.getItem(BACKUP_KEY)), next);
});
for (const failedKey of [BACKUP_KEY, KEY]) {
  test(`a failed ${failedKey} write preserves the canvas and the previous backup`, () => {
    const storage = store();
    const before = new Map(storage.data);
    const write = storage.setItem;
    storage.setItem = (key, value) => {
      if (key === failedKey) throw Error("quota");
      write(key, value);
    };
    assert.throws(() => replaceWithBackup(storage, fresh(), fresh()), /quota/);
    assert.deepEqual(storage.data, before);
  });
}
test("unreadable storage and serialization failure cannot write either key", () => {
  const storage = store();
  const before = new Map(storage.data);
  const next = fresh();
  next.circular = next;
  assert.throws(() => replaceWithBackup(storage, fresh(), next));
  assert.deepEqual(storage.data, before);
  storage.getItem = () => {
    throw Error("denied");
  };
  assert.throws(() => replaceWithBackup(storage, fresh(), fresh()));
  assert.deepEqual(storage.data, before);
});

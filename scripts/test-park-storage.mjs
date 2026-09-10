import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";

const S = await import(moduleURL("game/simulation.ts")),
  P = await import(moduleURL("game/park-storage.ts")),
  F = await import(moduleURL("game/free-play.ts")),
  E = await import(moduleURL("game/track-edit.ts"));
const results = [];
function test(name, run) {
  try {
    run();
    results.push({ name, pass: true });
    console.log("PASS", name);
  } catch (error) {
    results.push({ name, pass: false, error: error.message.slice(0, 1500) });
    console.log("FAIL", name, error.message.slice(0, 1500));
  }
}
const encoded = (s) => JSON.stringify(s);
const copied = (s) => JSON.parse(encoded(s));
function storage(initial = {}, failWrite = 0) {
  const values = new Map(Object.entries(initial)),
    writes = [];
  let attempts = 0;
  return {
    values,
    writes,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      attempts++;
      if (attempts === failWrite) throw new DOMException("Storage is full", "QuotaExceededError");
      values.set(key, value);
      writes.push([key, value]);
    },
  };
}
function editedPark() {
  const s = S.newPark("scenario");
  s.speed = 0;
  s.open = false;
  s.guests = [];
  const coaster = s.buildings.find((b) => b.kind === "coaster");
  assert.equal(E.beginTrackEdit(s, coaster, 0, 0), null);
  s.draft.history = [0];
  s.draft.historyEnds = [null];
  assert(S.validSave(s), "Fixture is a real valid park with a live track edit and draft");
  return s;
}

test("Switch saves the latest live park including its unfinished draft before replacing the active slot", () => {
  const current = editedPark(),
    next = F.createFreePark(),
    oldDisk = encoded(S.newPark("scenario")),
    store = storage({ [P.PARK_SAVE_KEY]: oldDisk }),
    before = encoded(current),
    after = encoded(next);
  assert.notEqual(before, oldDisk, "Fixture contains unsaved live changes");
  assert.equal(P.saveParkSwitch(store, current, next), null);
  assert.deepEqual(
    store.writes.map(([key]) => key),
    [P.PREVIOUS_PARK_KEY, P.PARK_SAVE_KEY],
  );
  assert.equal(store.getItem(P.PREVIOUS_PARK_KEY), before);
  assert.equal(store.getItem(P.PARK_SAVE_KEY), after);
  assert.equal(encoded(current), before);
  assert.equal(encoded(next), after);
  const restored = P.readPreviousPark(store);
  assert(restored && S.validSave(restored));
  assert.deepEqual(restored.draft, copied(current.draft));
  assert.deepEqual(restored.trackEdit, copied(current.trackEdit));
  assert.equal(restored.mode, "scenario");
  assert.equal(restored.cash, current.cash);
  assert.equal(restored.speed, 0);
});

test("The first switch also preserves a current park that has never occupied the active save slot", () => {
  const current = editedPark(),
    next = F.createFreePark(),
    store = storage();
  assert.equal(P.saveParkSwitch(store, current, next), null);
  assert.equal(store.getItem(P.PREVIOUS_PARK_KEY), encoded(current));
  assert.equal(store.getItem(P.PARK_SAVE_KEY), encoded(next));
});

test("Restoring the previous park swaps both parks and allows the new free park to be resumed", () => {
  const current = editedPark(),
    free = F.createFreePark(),
    store = storage();
  assert.equal(P.saveParkSwitch(store, current, free), null);
  free.speed = 0;
  free.time = 17;
  const previous = P.readPreviousPark(store);
  assert(previous);
  assert.equal(P.saveParkSwitch(store, free, previous), null);
  assert.equal(store.getItem(P.PARK_SAVE_KEY), encoded(previous));
  assert.equal(store.getItem(P.PREVIOUS_PARK_KEY), encoded(free));
  const freeAgain = P.readPreviousPark(store);
  assert(freeAgain && S.validSave(freeAgain));
  assert.equal(freeAgain.mode, "sandbox");
  assert.equal(freeAgain.unlimitedBudget, true);
  assert.equal(freeAgain.cash, 0);
  assert.equal(freeAgain.time, 17);
  assert.equal(freeAgain.speed, 0);
  assert.equal(P.saveParkSwitch(store, previous, freeAgain), null);
  assert.deepEqual(P.readPreviousPark(store).draft, copied(current.draft));
});

test("Quota failure on the backup write leaves the current park and both stored slots unchanged", () => {
  const current = editedPark(),
    next = F.createFreePark(),
    oldActive = encoded(S.newPark("scenario")),
    oldBackup = encoded(S.newPark("sandbox")),
    store = storage({ [P.PARK_SAVE_KEY]: oldActive, [P.PREVIOUS_PARK_KEY]: oldBackup }, 1),
    before = encoded(current),
    after = encoded(next);
  assert(P.saveParkSwitch(store, current, next));
  assert.equal(store.getItem(P.PARK_SAVE_KEY), oldActive);
  assert.equal(store.getItem(P.PREVIOUS_PARK_KEY), oldBackup);
  assert.deepEqual(store.writes, []);
  assert.equal(encoded(current), before);
  assert.equal(encoded(next), after);
});

test("Quota failure on the active write preserves the active slot and keeps the latest live park as a rescue backup", () => {
  const current = editedPark(),
    next = F.createFreePark(),
    oldActive = encoded(S.newPark("scenario")),
    store = storage({ [P.PARK_SAVE_KEY]: oldActive }, 2),
    before = encoded(current),
    after = encoded(next);
  assert(P.saveParkSwitch(store, current, next));
  assert.equal(store.getItem(P.PARK_SAVE_KEY), oldActive);
  assert.equal(store.getItem(P.PREVIOUS_PARK_KEY), before);
  assert.deepEqual(
    store.writes.map(([key]) => key),
    [P.PREVIOUS_PARK_KEY],
  );
  assert.equal(encoded(current), before);
  assert.equal(encoded(next), after);
  assert.deepEqual(P.readPreviousPark(store).draft, copied(current.draft));
});

test("Invalid current or replacement parks are rejected before either stored slot is touched", () => {
  for (const invalidSide of ["current", "next"]) {
    const current = editedPark(),
      next = F.createFreePark(),
      store = storage({
        [P.PARK_SAVE_KEY]: encoded(current),
        [P.PREVIOUS_PARK_KEY]: encoded(next),
      });
    (invalidSide === "current" ? current : next).cash = NaN;
    const before = new Map(store.values);
    assert(P.saveParkSwitch(store, current, next));
    assert.deepEqual(store.values, before);
    assert.deepEqual(store.writes, []);
  }
});

test("Serialization and denied-storage failures report an error without changing live park state", () => {
  const current = editedPark(),
    next = F.createFreePark(),
    store = storage();
  current.unserializable = current;
  assert(P.saveParkSwitch(store, current, next));
  assert.deepEqual(store.writes, []);
  assert.equal(current.unserializable, current);
  delete current.unserializable;
  const before = encoded(current),
    after = encoded(next);
  const denied = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
  };
  assert(P.saveParkSwitch(denied, current, next));
  assert.equal(P.readPreviousPark(denied), null);
  assert.equal(encoded(current), before);
  assert.equal(encoded(next), after);
});

test("Missing, malformed and invalid backups never restore or rewrite a park", () => {
  const invalid = copied(S.newPark());
  invalid.buildings[0].queue = null;
  for (const raw of [undefined, "", "{bad json", "null", "[]", "{}", encoded(invalid)]) {
    const store = storage(raw === undefined ? {} : { [P.PREVIOUS_PARK_KEY]: raw }),
      before = new Map(store.values);
    assert.equal(P.readPreviousPark(store), null);
    assert.deepEqual(store.values, before);
    assert.deepEqual(store.writes, []);
  }
});

test("Reading a legacy finite sandbox migrates only a detached copy and does not grant unlimited funds", () => {
  const old = S.newPark("sandbox");
  delete old.unlimitedBudget;
  delete old.crewPool;
  delete old.difficulty;
  delete old.research;
  assert(S.validSave(old));
  const raw = encoded(old),
    store = storage({ [P.PREVIOUS_PARK_KEY]: raw });
  const first = P.readPreviousPark(store),
    second = P.readPreviousPark(store);
  assert(first && second && S.validSave(first) && S.validSave(second));
  assert.notEqual(first, second);
  assert.deepEqual(first, second);
  assert.equal(first.cash, old.cash);
  assert.notEqual(first.unlimitedBudget, true);
  assert(first.crewPool);
  first.buildings[0].name = "Only this detached read";
  assert.notEqual(first.buildings[0].name, second.buildings[0].name);
  assert.equal(store.getItem(P.PREVIOUS_PARK_KEY), raw);
  assert.deepEqual(store.writes, []);
});

test("Later active autosaves preserve the separately stored previous park", () => {
  const current = editedPark(),
    next = F.createFreePark(),
    store = storage();
  assert.equal(P.saveParkSwitch(store, current, next), null);
  const backup = store.getItem(P.PREVIOUS_PARK_KEY);
  next.time = 45;
  store.setItem(P.PARK_SAVE_KEY, encoded(next));
  assert.equal(store.getItem(P.PREVIOUS_PARK_KEY), backup);
  assert.deepEqual(P.readPreviousPark(store).draft, copied(current.draft));
});

console.log(
  `${results.filter((result) => result.pass).length}/${results.length} park storage tests passed`,
);
process.exitCode = results.some((result) => !result.pass) ? 1 : 0;

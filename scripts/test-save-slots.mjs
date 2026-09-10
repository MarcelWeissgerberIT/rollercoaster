import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  L = await import(moduleURL("game/save-slots.ts")),
  P = await import(moduleURL("game/park-storage.ts"));
let count = 0;
const test = (name, fn) => {
  fn();
  count++;
  console.log("PASS", name);
};
const storage = () => {
  const values = new Map();
  return {
    values,
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
};
test("Ten independent named slots leave autosave and previous park untouched", () => {
  const store = storage(),
    park = S.newPark();
  store.setItem(P.PARK_SAVE_KEY, "automatic");
  store.setItem(P.PREVIOUS_PARK_KEY, "previous");
  for (let i = 1; i <= 10; i++) {
    park.cash = 10000 + i;
    assert.equal(L.writeSaveSlot(store, i, `Park ${i}`, park), null);
  }
  const slots = L.readSaveSlots(store);
  assert.equal(slots.length, 10);
  slots.forEach((slot, i) => {
    assert.equal(slot.name, `Park ${i + 1}`);
    assert.equal(slot.park.cash, 10001 + i);
  });
  assert.equal(store.getItem(P.PARK_SAVE_KEY), "automatic");
  assert.equal(store.getItem(P.PREVIOUS_PARK_KEY), "previous");
  assert(L.writeSaveSlot(store, 11, "no", park));
  assert(L.writeSaveSlot(store, 0, "no", park));
});
test("Overwrite needs explicit confirmation and failed quota write preserves full old park", () => {
  const store = storage(),
    park = S.newPark();
  assert.equal(L.writeSaveSlot(store, 3, "Alt", park), null);
  const before = store.getItem(L.saveSlotKey(3));
  park.cash = 777;
  assert(L.writeSaveSlot(store, 3, "Neu", park));
  assert.equal(store.getItem(L.saveSlotKey(3)), before);
  const failing = {
    ...store,
    setItem() {
      throw Error("Quota");
    },
  };
  assert(L.writeSaveSlot(failing, 3, "Neu", park, true));
  assert.equal(store.getItem(L.saveSlotKey(3)), before);
  assert.equal(L.writeSaveSlot(store, 3, "Neu", park, true), null);
  assert.equal(L.loadSaveSlot(store, 3).cash, 777);
});
test("Rename preserves park data and original save time; load is an independent valid copy", () => {
  const store = storage(),
    park = S.newPark();
  L.writeSaveSlot(store, 1, "Name", park, false, new Date("2026-09-10T10:00:00Z"));
  const old = L.readSaveSlots(store)[0];
  assert.equal(L.renameSaveSlot(store, 1, "  Mein   Sommerpark  "), null);
  const next = L.readSaveSlots(store)[0];
  assert.equal(next.name, "Mein Sommerpark");
  assert.equal(next.savedAt, old.savedAt);
  assert.deepEqual(next.park, old.park);
  const loaded = L.loadSaveSlot(store, 1);
  loaded.cash = 5;
  assert.notEqual(L.loadSaveSlot(store, 1).cash, 5);
  assert(S.validSave(loaded));
});
test("Damaged slots are visible and cannot be silently overwritten or loaded", () => {
  const store = storage(),
    park = S.newPark();
  store.setItem(L.saveSlotKey(2), "{ broken");
  assert.equal(L.readSaveSlots(store)[1].status, "damaged");
  assert.equal(L.loadSaveSlot(store, 2), null);
  assert(L.writeSaveSlot(store, 2, "Repair", park));
  assert.equal(L.writeSaveSlot(store, 2, "Repair", park, true), null);
});
test("Delete removes only selected slot; empty names and invalid parks preserve stored content", () => {
  const store = storage(),
    park = S.newPark();
  L.writeSaveSlot(store, 1, "One", park);
  L.writeSaveSlot(store, 2, "Two", park);
  assert(L.writeSaveSlot(store, 1, "  ", park, true));
  assert(L.writeSaveSlot(store, 1, "Bad", {}, true));
  assert.equal(L.readSaveSlots(store)[0].name, "One");
  assert.equal(L.deleteSaveSlot(store, 2), null);
  assert.equal(L.readSaveSlots(store)[1].status, "empty");
  assert.equal(L.readSaveSlots(store)[0].name, "One");
});
test("Legacy calendar saved inside a slot migrates once without a duplicated annual reward", () => {
  const store = storage(),
    park = S.newPark();
  delete park.calendar;
  park.time = 540;
  L.writeSaveSlot(store, 1, "Legacy", park);
  const once = L.loadSaveSlot(store, 1),
    twice = L.loadSaveSlot(store, 1);
  assert.deepEqual(once, twice);
  assert(once.calendar);
  assert.equal(once.time, 540);
  assert.equal(once.research.ledger.coins, twice.research.ledger.coins);
});
const E = await import(moduleURL("game/track-edit.ts"));
test("Named slots preserve unfinished track edits and drafts across a load", () => {
  const store = storage(),
    park = S.newPark();
  park.speed = 0;
  const coaster = park.buildings.find((b) => b.kind === "coaster");
  assert.equal(E.beginTrackEdit(park, coaster, 0, 0), null);
  assert.equal(L.writeSaveSlot(store, 7, "Baustelle", park), null);
  const loaded = L.loadSaveSlot(store, 7);
  assert.deepEqual(loaded.trackEdit, JSON.parse(JSON.stringify(park.trackEdit)));
  assert.deepEqual(loaded.draft, JSON.parse(JSON.stringify(park.draft)));
  assert.equal(loaded.speed, 0);
  assert(S.validSave(loaded));
});
console.log(`${count}/${count} save-slot tests passed`);

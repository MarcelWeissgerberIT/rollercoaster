import assert from "node:assert/strict";
import fs from "node:fs";
import { moduleURL as url } from "./ts-loader.mjs";
const patched = false;
const S = await import(url("game/simulation.ts")),
  C = await import(url("game/construction.ts")),
  O = await import(url("game/operations.ts"));
Math.random = () => 0.5;
const results = [];
function test(name, fn) {
  try {
    const detail = fn();
    results.push({ name, pass: true, detail });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, pass: false, error: e.message.slice(0, 1100) });
    console.log("FAIL", name, e.message.slice(0, 1100));
  }
}
function fixture(kind = "wheel", count = 2) {
  const s = S.newPark("sandbox"),
    b = s.buildings.find((b) => b.kind === kind),
    template = structuredClone(s.guests[0]);
  assert(b);
  s.buildings = [b];
  s.open = false;
  s.staff = 0;
  s.zoo = undefined;
  s.cleanliness = undefined;
  s.transitLines = [];
  b.queue = [];
  b.riders = [];
  b.cycle = 0;
  b.open = true;
  b.testing = undefined;
  b.tested = true;
  O.resetRideOperations(b);
  const p = S.access(s, b);
  assert(p);
  s.guests = Array.from({ length: count }, () => ({
    ...structuredClone(template),
    id: s.nextId++,
    x: p.x,
    y: p.y,
    target: b.id,
    state: "walk",
    route: [],
    timer: 0,
    rides: 0,
    visited: [],
    wallet: 100,
    hunger: 0,
    thirst: 0,
    bladder: 0,
    energy: 100,
    waste: [],
    food: undefined,
  }));
  return { s, b };
}
function board(s, b, rounds) {
  assert.equal(O.setRideRounds(b, rounds), null);
  S.tick(s, 0.01);
  assert.equal(b.queue.length, s.guests.length);
  S.tick(s, 3.5);
  assert.equal(b.riders.length, s.guests.length);
  assert.equal(b.operations.remainingRounds, rounds);
  assert(S.validSave(JSON.parse(JSON.stringify(s))));
}
test("No operator: no boarding, queue debt, receipts or phantom guest rides", () => {
  const { s, b } = fixture();
  assert.equal(O.setRideStaffed(b, false), null);
  const income = s.income;
  S.tick(s, 30);
  assert.equal(b.served, 0);
  assert.equal(b.riders.length + b.queue.length, 0);
  assert.equal(s.income, income);
  assert(s.guests.every((g) => g.rides === 0));
  assert(S.validSave(s));
});
test("No operator means no admission demand when it is the only ride", () => {
  const { s, b } = fixture();
  O.setRideStaffed(b, false);
  assert.equal(S.entryDemand(s), 0, "Unstaffed ride is still advertised at the park gate");
});
for (const [kind, rounds] of [
  ["wheel", 3],
  ["coaster", 2],
])
  test(`${kind}: ${rounds} base rounds, same riders and one bill/reward only`, () => {
    const { s, b } = fixture(kind);
    const fee = b.price,
      base = S.rideDuration(b),
      income = s.income;
    board(s, b, rounds);
    const ids = [...b.riders],
      paid = s.income,
      revenue = b.revenue;
    assert.equal(paid - income, fee * 2);
    assert.equal(b.served, 2);
    const transitions = [];
    let previous = rounds,
      elapsed = 0;
    while (b.riders.length && elapsed < base * rounds + 1) {
      S.tick(s, 0.1);
      elapsed += 0.1;
      assert.equal(S.rideDuration(b), base);
      assert.equal(s.income, paid);
      assert.equal(b.revenue, revenue);
      assert.equal(b.served, 2);
      assert(s.guests.every((g) => g.wallet === 100 - fee));
      if (b.riders.length) {
        assert.deepEqual(b.riders, ids);
        assert(
          s.guests.every((g) => g.state === "ride" && g.rides === 0 && !g.visited.includes(b.id)),
        );
        if (b.operations.remainingRounds !== previous) {
          transitions.push(b.operations.remainingRounds);
          previous = b.operations.remainingRounds;
        }
        assert(b.cycle <= base + 0.00001);
      }
      assert(S.validSave(JSON.parse(JSON.stringify(s))));
    }
    assert.equal(b.riders.length, 0);
    assert.deepEqual(
      transitions,
      Array.from({ length: rounds - 1 }, (_, i) => rounds - 1 - i),
    );
    assert(
      s.guests.every((g) => g.rides === 1 && g.visited.filter((id) => id === b.id).length === 1),
    );
    assert.equal(b.operations.phase, "unloading");
    return { base, elapsed: Math.round(elapsed * 100) / 100, charged: paid - income, transitions };
  });
test("Real save/resume during checking and running retains identical guests and remaining rounds", () => {
  for (const phase of ["checking", "running"]) {
    const { s, b } = fixture();
    O.setRideRounds(b, 3);
    S.tick(s, 0.01);
    S.tick(s, phase === "checking" ? 2.75 : 4);
    assert.equal(b.operations.phase, phase);
    const resumed = JSON.parse(JSON.stringify(s));
    assert(S.validSave(resumed));
    S.migratePark(resumed);
    for (let i = 0; i < 50; i++) {
      S.tick(s, 0.1);
      S.tick(resumed, 0.1);
    }
    assert.deepEqual(JSON.parse(JSON.stringify(s)), resumed);
    assert(S.validSave(resumed));
  }
});
test("Crew-only edits produce an undo record and restore assignment", () => {
  const { s, b } = fixture("wheel", 0);
  const rec = C.recordEdit(s, "Crew", () => assert.equal(O.setRideStaffed(b, false), null));
  assert(rec, "Crew-only edit was not recorded");
  assert.equal(O.hasOperator(b), false);
  assert.equal(C.undoEdits(s, [rec]), null);
  assert.equal(O.hasOperator(b), true);
  assert(S.validSave(s));
});
test("Undo rounds restores next-program config without rewinding current riders/cycle/phase", () => {
  const { s, b } = fixture();
  board(s, b, 3);
  const rec = C.recordEdit(s, "Rounds", () => O.setRideRounds(b, 5));
  assert(rec, "Round-only edit was not recorded");
  S.tick(s, 1);
  const before = structuredClone({
    riders: b.riders,
    cycle: b.cycle,
    phase: b.operations.phase,
    remaining: b.operations.remainingRounds,
    guests: s.guests,
  });
  C.undoEdits(s, [rec]);
  assert.equal(b.operations.rounds, 3);
  assert.deepEqual(
    {
      riders: b.riders,
      cycle: b.cycle,
      phase: b.operations.phase,
      remaining: b.operations.remainingRounds,
      guests: s.guests,
    },
    before,
  );
  assert(S.validSave(s));
});
test("Undo cannot remove active crew: entire mixed batch remains identical; works after final unload", () => {
  const { s, b } = fixture();
  O.setRideStaffed(b, false);
  const crew = C.recordEdit(s, "Crew", () => O.setRideStaffed(b, true));
  assert(crew, "Crew assignment was not recorded");
  const path = C.recordEdit(s, "Path", () => S.paint(s, 1, 1, "path"));
  assert(path);
  board(s, b, 1);
  const before = structuredClone(s);
  assert(
    C.undoEdits(s, [crew, path]),
    "Undo should refuse operator removal during an occupied ride",
  );
  assert.deepEqual(s, before);
  while (b.riders.length) S.tick(s, 0.25);
  assert.equal(b.operations.phase, "unloading");
  const unloading = structuredClone(s);
  assert(C.undoEdits(s, [crew, path]), "The crew still supervises the final exit phase");
  assert.deepEqual(s, unloading);
  while (b.operations.phase === "unloading") S.tick(s, 0.25);
  assert.equal(C.undoEdits(s, [crew, path]), null);
  assert.equal(b.operations.staffed, false);
  assert.equal(s.tiles[1][1], "grass");
  assert(S.validSave(s));
});
const summary = {
  patched,
  passed: results.filter((t) => t.pass).length,
  failed: results.filter((t) => !t.pass).length,
  results,
};
fs.writeFileSync(
  `/tmp/operations-integration-${patched ? "patched" : "current"}-results.json`,
  JSON.stringify(summary, null, 2),
);
console.log(`${summary.passed}/${results.length} passed`);
process.exitCode = summary.failed ? 1 : 0;

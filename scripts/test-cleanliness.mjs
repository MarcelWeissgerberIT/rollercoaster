import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const C = await import(moduleURL("game/cleanliness.ts"));
const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, pass: true });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, pass: false, error: e.message });
    console.log("FAIL", name, e.message);
  }
}
function park() {
  const tiles = Array.from({ length: 30 }, () => Array(30).fill("grass"));
  for (let y = 1; y < 30; y++) tiles[y][15] = "path";
  return {
    tiles,
    buildings: [],
    guests: [],
    staff: 0,
    speed: 1,
    time: 0,
    cash: 10000,
    income: 42,
    expenses: 17,
  };
}
function guest(s) {
  const g = {
    id: 101,
    x: 15,
    y: 20,
    state: "walk",
    happiness: 80,
    route: [{ x: 15, y: 19 }],
    transit: { line: 77 },
    target: 35,
  };
  s.guests.push(g);
  return g;
}
function run(s, seconds) {
  for (let t = 0; t < seconds - 1e-9; t += 0.1) {
    s.time += 0.1;
    C.tickCleanliness(s, 0.1);
  }
}
test("Old saves initialize without litter or extra economic charges", () => {
  const s = park();
  s.staff = 2;
  C.initCleanliness(s);
  assert.equal(s.cleanliness.workers.length, 2);
  assert.equal(C.cleanlinessScore(s), 100);
  assert(C.validCleanliness(s));
  assert.deepEqual([s.cash, s.income, s.expenses], [10000, 42, 17]);
});
test("Pause is an exact no-op including missing optional state", () => {
  const s = park();
  s.speed = 0;
  const old = structuredClone(s);
  C.tickCleanliness(s, 10);
  assert.deepEqual(s, old);
});
test("Purchase waste is delayed and preserves all guest navigation fields", () => {
  const s = park(),
    g = guest(s);
  C.giveWaste(s, g, "wrapper");
  run(s, 5);
  assert.equal(C.cleanlinessStats(s).pieces, 0);
  assert.equal(g.waste.length, 1);
  assert.deepEqual(
    [g.route, g.transit, g.target, g.state],
    [[{ x: 15, y: 19 }], { line: 77 }, 35, "walk"],
  );
  run(s, 30);
  assert.equal(C.cleanlinessStats(s).pieces, 1);
  assert.equal(g.waste.length, 0);
  assert.deepEqual(
    [g.route, g.transit, g.target, g.state],
    [[{ x: 15, y: 19 }], { line: 77 }, 35, "walk"],
  );
  assert.deepEqual([s.cash, s.income, s.expenses], [10000, 42, 17]);
});
test("Passing bin takes one ready item exactly once", () => {
  const s = park(),
    g = guest(s);
  s.buildings.push({ id: 1, kind: "bin", x: 16, y: 20 });
  g.waste = [{ kind: "cup", remaining: 0, waited: 0 }];
  run(s, 1);
  assert.equal(s.buildings[0].binFill, 1);
  assert.equal(s.cleanliness.binned, 1);
  run(s, 10);
  assert.equal(s.buildings[0].binFill, 1);
  assert.equal(s.cleanliness.binned, 1);
  assert.equal(C.cleanlinessStats(s).pieces, 0);
});
test("Full bin cannot overflow; waiting item becomes visible litter", () => {
  const s = park(),
    g = guest(s);
  s.buildings.push({ id: 1, kind: "bin", x: 16, y: 20, binFill: 16 });
  g.waste = [{ kind: "cup", remaining: 0, waited: 0 }];
  run(s, 10);
  assert.equal(s.buildings[0].binFill, 16);
  assert.equal(C.cleanlinessStats(s).pieces, 1);
  assert(C.validCleanliness(s));
});
test("Worker walks to litter; no remote vacuum cleaning", () => {
  const s = park();
  s.staff = 1;
  C.dropWaste(s, { x: 15, y: 20 }, "wrapper", 2);
  run(s, 0.5);
  assert.equal(C.cleanlinessStats(s).pieces, 2);
  assert.equal(s.cleanliness.workers[0].mode, "walk");
  run(s, 12);
  assert.equal(C.cleanlinessStats(s).pieces, 0);
  assert.equal(s.cleanliness.cleaned, 2);
  assert(C.validCleanliness(s));
});
test("Two workers reserve distinct jobs and each pile counted once", () => {
  const s = park();
  s.staff = 2;
  C.dropWaste(s, { x: 15, y: 20 }, "wrapper");
  C.dropWaste(s, { x: 15, y: 22 }, "cup");
  run(s, 0.5);
  const targets = s.cleanliness.workers.map((w) => w.target?.id);
  assert.equal(new Set(targets).size, 2);
  run(s, 15);
  assert.equal(s.cleanliness.cleaned, 2);
  assert.equal(C.cleanlinessStats(s).pieces, 0);
});
test("A full bin is reached and emptied for free", () => {
  const s = park();
  s.staff = 1;
  s.buildings.push({ id: 1, kind: "bin", x: 16, y: 20, binFill: 16 });
  run(s, 0.5);
  assert.equal(s.buildings[0].binFill, 16);
  run(s, 12);
  assert.equal(s.buildings[0].binFill, 0);
  assert.equal(s.cleanliness.emptied, 1);
  assert.deepEqual([s.cash, s.income, s.expenses], [10000, 42, 17]);
});
test("Unreachable litter is retained, not silently removed", () => {
  const s = park();
  s.staff = 1;
  s.tiles[25][15] = "grass";
  C.dropWaste(s, { x: 15, y: 20 }, "wrapper");
  run(s, 20);
  assert.equal(C.cleanlinessStats(s).pieces, 1);
  assert.equal(s.cleanliness.cleaned, 0);
  assert.equal(s.cleanliness.workers[0].mode, "idle");
});
test("Removing an assigned bin leaves a valid save and cancels job", () => {
  const s = park();
  s.staff = 1;
  s.buildings.push({ id: 1, kind: "bin", x: 16, y: 20, binFill: 16 });
  run(s, 0.5);
  assert(s.cleanliness.workers[0].target);
  s.buildings = [];
  assert(C.validCleanliness(s));
  run(s, 0.1);
  assert.equal(s.cleanliness.workers[0].target, null);
  assert(C.validCleanliness(s));
});
test("A saved in-progress walk resumes deterministically", () => {
  const s = park();
  s.staff = 2;
  C.dropWaste(s, { x: 15, y: 16 }, "cup", 3);
  run(s, 2.3);
  const copy = JSON.parse(JSON.stringify(s));
  assert(C.validCleanliness(copy));
  run(s, 15);
  run(copy, 15);
  assert.deepEqual(copy, s);
});
test("Changing staff updates visible headcount and preserves assigned state of survivors", () => {
  const s = park();
  s.staff = 2;
  C.dropWaste(s, { x: 15, y: 16 }, "cup");
  run(s, 1);
  s.staff = 1;
  C.initCleanliness(s);
  assert.equal(s.cleanliness.workers.length, 1);
  s.staff = 0;
  C.initCleanliness(s);
  assert.equal(s.cleanliness.workers.length, 0);
  assert(C.validCleanliness(s));
});
test("Malformed state is rejected while missing state remains backward compatible", () => {
  assert(C.validCleanliness(park()));
  for (const alter of [
    (s) => s.cleanliness.workers.push({ id: 9 }),
    (s) => (s.cleanliness.litter[0].amount = -1),
    (s) => (s.cleanliness.nextId = 0),
    (s) => (s.guests[0].waste = [{ kind: "paper", remaining: 1, waited: 0 }]),
    (s) => s.buildings.push({ kind: "bin", id: 5, x: 16, y: 20, binFill: 17 }),
  ]) {
    const s = park();
    guest(s);
    C.dropWaste(s, { x: 15, y: 20 }, "cup");
    alter(s);
    assert.equal(C.validCleanliness(s), false);
  }
});
test("Hotspots and nearby mood reflect real dirt; distant visitor unaffected", () => {
  const s = park(),
    g = guest(s),
    far = { ...g, id: 102, y: 3 };
  s.guests.push(far);
  C.dropWaste(s, { x: 15, y: 20 }, "cup", 3);
  C.dropWaste(s, { x: 15, y: 20 }, "wrapper", 2);
  run(s, 5);
  const stats = C.cleanlinessStats(s);
  assert.equal(stats.dirtyTiles, 1);
  assert.equal(stats.hotspots[0].pieces, 5);
  assert(stats.score < 100);
  assert(g.happiness < 80);
  assert.equal(far.happiness, 80);
});
console.log(
  JSON.stringify(
    {
      passed: results.filter((r) => r.pass).length,
      failed: results.filter((r) => !r.pass).length,
      results,
    },
    null,
    2,
  ),
);
process.exitCode = results.some((r) => !r.pass) ? 1 : 0;

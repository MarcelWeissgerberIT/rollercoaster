import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  Z = await import(moduleURL("game/zoo.ts")),
  B = await import(moduleURL("game/construction.ts")),
  A = await import(moduleURL("game/zoo-motion.ts")),
  W = await import(moduleURL("game/scene-world.ts"));
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
  const s = S.newPark("sandbox");
  s.tiles = Array.from({ length: 36 }, () => Array(36).fill("grass"));
  for (let y = 0; y < 36; y++) s.tiles[y][15] = "path";
  s.buildings = [];
  s.guests = [];
  s.open = false;
  s.staff = 0;
  s.time = 0;
  s.cash = 100000;
  s.expenses = 0;
  s.income = 0;
  s.dayExpenses = 0;
  s.dayIncome = 0;
  s.operatingExpensesToday = 0;
  s.operatingIncomeToday = 0;
  s.zoo = undefined;
  s.cleanliness = undefined;
  return s;
}
function habitat(s, kind = "zebra", y = 18) {
  const n = Z.SPECIES[kind].size,
    id = S.build(s, kind, 15 - n, y).id;
  assert(id);
  const b = s.buildings.find((b) => b.id === id);
  assert.equal(Z.adoptAnimal(s, b), null);
  b.open = true;
  return b;
}
function visitor(s, b) {
  const g = structuredClone(S.newPark("sandbox").guests[0]),
    p = S.access(s, b);
  Object.assign(g, {
    id: s.nextId++,
    ...p,
    state: "walk",
    target: b.id,
    route: [],
    timer: 0,
    wallet: 100,
    happiness: 90,
    hunger: 0,
    thirst: 0,
    bladder: 0,
    visited: [],
  });
  s.guests.push(g);
  return g;
}
test("Zoo visitor observes without an extra ticket, stays outside and resumes the public route", () => {
  const s = park(),
    b = habitat(s),
    g = visitor(s, b),
    cash = s.cash,
    expense = s.expenses;
  S.tick(s, 0.1);
  assert.equal(g.state, "observe");
  assert.equal(g.wallet, 100);
  assert.equal(s.cash, cash);
  assert.equal(b.revenue, 0);
  assert.equal(b.queue.length + b.riders.length, 0);
  assert.equal(b.served, 1);
  assert.equal(s.expenses, expense);
  assert(S.validSave(s));
  for (let t = 0; t < 23; t += 0.1) {
    S.tick(s, 0.1);
    assert(!S.footprint(b).some((p) => Math.hypot(p.x - g.x, p.y - g.y) < 0.4));
  }
  assert.equal(b.served, 1);
  assert.equal(g.rides, 1);
  assert(["walk", "leave"].includes(g.state));
  assert(g.visited.includes(b.id));
  assert(S.validSave(s));
});
test("Zoo-only admission demand is positive, empty habitats add no attraction demand", () => {
  const s = park(),
    b = habitat(s);
  assert(S.entryDemand(s) > 0);
  b.habitat.count = 0;
  assert.equal(S.entryDemand(s), 0);
});
test("Last animal removal closes and releases observers on next tick without billing", () => {
  const s = park(),
    b = habitat(s),
    g = visitor(s, b);
  S.tick(s, 0.1);
  const cash = s.cash;
  b.habitat.count = 0;
  b.open = false;
  assert(S.validSave(s));
  S.tick(s, 0.1);
  assert(["walk", "leave"].includes(g.state));
  assert.equal(g.target, null);
  assert.equal(b.riders.length + b.queue.length, 0);
  assert.equal(s.cash, cash);
  assert(S.validSave(s));
});
test("Direct demolition and placement preview both protect an occupied habitat", () => {
  const s = park(),
    b = habitat(s),
    cash = s.cash;
  assert(B.planPlacement(s, "erase", { x: b.x, y: b.y }).error);
  S.remove(s, b.x, b.y);
  assert(s.buildings.includes(b));
  assert.equal(s.cash, cash);
});
test("Four-species campaign checks distinct healthy reachable species in the real tick", () => {
  for (const [kinds, expected] of [
    [["zebra", "zebra", "zebra", "zebra"], false],
    [["zebra", "giraffe", "flamingo", "penguin"], true],
  ]) {
    const s = park();
    for (let i = 0; i < 4; i++) {
      const b = habitat(s, kinds[i], 1 + i * 7);
      b.habitat.enrichment = true;
      b.habitat.shelter = true;
    }
    const g = visitor(s, s.buildings[0]);
    g.state = "walk";
    g.target = null;
    g.timer = 10000;
    g.happiness = 100;
    s.buildings[0].queue = [];
    s.scenario = "zoo";
    s.mode = "scenario";
    s.arrivals = 200;
    s.won = false;
    S.tick(s, 0.1);
    assert.equal(s.won, expected);
    assert(S.validSave(s));
  }
});
test("Animal poses stay within habitat bounds, with deterministic positions for fixed time", () => {
  for (const [kind, spec] of Object.entries(Z.SPECIES)) {
    const s = park(),
      b = habitat(s, kind, 2);
    b.habitat.count = spec.capacity;
    for (let i = 0; i < spec.capacity; i++)
      for (let t = 0; t <= 800; t += 0.7) {
        const p = A.animalPose(b, i, t);
        assert(p.x > b.x - 0.45 && p.x < b.x + spec.size - 0.55);
        assert(p.y > b.y - 0.45 && p.y < b.y + spec.size - 0.55);
        assert.deepEqual(p, A.animalPose(b, i, t));
      }
  }
});
test("3D repeated paused time is stable, does not mutate the live park, and disposes all scene resources once", () => {
  const s = park();
  habitat(s, "flamingo", 8);
  const hutId = S.build(s, "keeperhut", 16, 27).id;
  assert(hutId);
  Z.initZoo(s);
  s.zoo.keepers = 1;
  Z.initZoo(s);
  const before = structuredClone(s),
    world = W.createWorld(s);
  world.update(2);
  const snapshot = () => {
    const a = [];
    world.scene.traverse((o) =>
      a.push([
        o.id,
        o.position.toArray(),
        o.quaternion.toArray(),
        o.scale.toArray(),
        o.instanceMatrix ? Array.from(o.instanceMatrix.array) : null,
      ]),
    );
    return a;
  };
  const state = snapshot();
  for (let i = 0; i < 10; i++) world.update(2);
  assert.deepEqual(snapshot(), state);
  assert.deepEqual(s, before);
  const geoms = new Map(),
    mats = new Map();
  world.scene.traverse((o) => {
    if (o.geometry && !geoms.has(o.geometry)) {
      geoms.set(o.geometry, 0);
      o.geometry.addEventListener("dispose", () =>
        geoms.set(o.geometry, geoms.get(o.geometry) + 1),
      );
    }
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])
      if (!mats.has(m)) {
        mats.set(m, 0);
        m.addEventListener("dispose", () => mats.set(m, mats.get(m) + 1));
      }
  });
  world.dispose();
  assert([...geoms.values(), ...mats.values()].every((v) => v === 1));
});
test("REGRESSION: habitat daily upkeep follows SPECIES.upkeep plus one keeper wage", () => {
  const s = park(),
    b = habitat(s);
  // Check the full-cost regression; difficulty scaling has separate integration coverage.
  s.difficulty = "challenging";
  Z.initZoo(s);
  s.zoo.keepers = 1;
  s.time = 89.95;
  const expenses = s.expenses;
  S.tick(s, 0.1);
  assert.equal(
    s.expenses - expenses,
    Z.SPECIES.zebra.upkeep + 90,
    "Current generic 2.2% capital-cost formula charges zebra79 instead of declared upkeep14",
  );
});
test("REGRESSION: Undo cannot destroy animals adopted after habitat construction", () => {
  const s = park();
  let b;
  const edit = B.recordEdit(s, "build habitat", () => {
    const id = S.build(s, "zebra", 10, 18).id;
    assert(id);
    b = s.buildings.find((b) => b.id === id);
  });
  assert(edit);
  assert.equal(Z.adoptAnimal(s, b), null);
  B.undoEdits(s, [edit]);
  assert(
    s.buildings.some((x) => x.id === b.id),
    "Undo directly filters added building IDs, bypassing occupied-habitat removal guard",
  );
});
console.log(
  JSON.stringify(
    {
      passed: results.filter((x) => x.pass).length,
      failed: results.filter((x) => !x.pass).length,
      results,
    },
    null,
    2,
  ),
);
process.exitCode = results.some((x) => !x.pass) ? 1 : 0;

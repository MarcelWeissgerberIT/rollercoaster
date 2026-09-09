import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const Z = await import(moduleURL("game/zoo.ts"));
const S = await import(moduleURL("game/simulation.ts"));
const N = await import(moduleURL("game/habitat-needs.ts"));
let passed = 0;
function test(name, fn) {
  fn();
  console.log("PASS", name);
  passed++;
}
function setup(kind = "lion") {
  const s = S.newPark("sandbox");
  s.tiles = Array.from({ length: 36 }, () => Array(36).fill("grass"));
  for (let y = 0; y < 36; y++) s.tiles[y][15] = "path";
  s.buildings = [];
  s.guests = [];
  s.zoo = undefined;
  s.cash = 100000;
  s.expenses = 0;
  s.dayExpenses = 0;
  s.operatingExpensesToday = 0;
  const b = {
    id: 801,
    kind,
    x: 15 - Z.SPECIES[kind].size,
    y: 12,
    open: true,
    name: kind,
    price: 0,
    served: 0,
    revenue: 0,
    queue: [],
    riders: [],
    cycle: 0,
    tested: true,
  };
  const hut = {
    id: 802,
    kind: "keeperhut",
    x: 16,
    y: 24,
    open: true,
    name: "Tierpflege",
    price: 0,
    served: 0,
    revenue: 0,
    queue: [],
    riders: [],
    cycle: 0,
    tested: true,
  };
  s.buildings.push(b, hut);
  Z.ensureHabitat(b).count = 2;
  Z.initZoo(s);
  return { s, b, hut };
}
const tick = (s, seconds) => Z.tickZoo(s, seconds, (p, b) => S.access(p, b));
test("Every species gets suitable equipment and fixed barrier; electric is only supplementary for three savanna mammals", () => {
  for (const [kind, p] of Object.entries(N.HABITAT_PROFILES)) {
    assert(p.features.length >= 4);
    assert(new Set(p.features.map((f) => f.id)).size === p.features.length);
    const { s, b } = setup(kind),
      initial = Z.welfare(b),
      cash = s.cash;
    for (const f of p.features) assert.equal(Z.addHabitatFeature(s, b, f.id), null);
    assert(Z.welfare(b) > initial + 15);
    assert.equal(s.cash, cash - p.features.reduce((n, f) => n + f.cost, 0));
    assert(Z.validZoo(s));
  }
  assert.deepEqual(
    Object.entries(N.HABITAT_PROFILES)
      .filter(([, p]) => p.electric)
      .map(([k]) => k)
      .sort(),
    ["elephant", "giraffe", "zebra"],
  );
  assert.equal(Z.habitatBarrier(setup("lion").b), "glass");
});
test("Legacy generic purchases remain owned and cannot charge twice", () => {
  const { s, b } = setup("lion");
  b.habitat.enrichment = true;
  b.habitat.shelter = true;
  assert(Z.habitatHasFeature(b, "foraging"));
  assert(Z.habitatHasFeature(b, "shelter"));
  const before = structuredClone(s);
  assert(Z.addHabitatFeature(s, b, "shelter"));
  assert.deepEqual(s, before);
});
test("Unsupported equipment and insufficient budget leave state intact", () => {
  const { s, b } = setup("lion");
  const before = structuredClone(s);
  assert(Z.addHabitatFeature(s, b, "nesting"));
  assert.deepEqual(s, before);
  s.cash = 0;
  const broke = structuredClone(s);
  assert(Z.addHabitatFeature(s, b, "rocks"));
  assert.deepEqual(s, broke);
});
test("General keepers cannot service lions; qualified raubtierpflege walks to the habitat before care", () => {
  const { s, b } = setup();
  s.zoo.keepers = 1;
  Z.initZoo(s);
  b.habitat.food = 50;
  assert(Z.careHabitat(s, b));
  tick(s, 20);
  assert(b.habitat.food < 50);
  assert.equal(s.expenses, 0);
  assert.equal(Z.setZooSpecialists(s, "carnivore", 1), null);
  assert(Z.habitatCareStatus(s, b).staffed);
  tick(s, 0.25);
  const w = s.zoo.workers.find((w) => w.role === "carnivore");
  assert.equal(w.mode, "walk");
  assert.equal(s.expenses, 0);
  tick(s, 25);
  assert(b.habitat.food > 98);
  assert.equal(s.expenses, 16);
  assert(Z.validZoo(s));
});
test("A disconnected hut cannot provide specialist care", () => {
  const { s, b } = setup();
  Z.setZooSpecialists(s, "carnivore", 1);
  s.tiles[22][15] = "grass";
  b.habitat.food = 40;
  assert(!Z.habitatCareStatus(s, b).staffed);
  assert(Z.careHabitat(s, b));
  tick(s, 25);
  assert(b.habitat.food < 40);
  assert.equal(s.expenses, 0);
});
test("Electrical installation needs a technician, charges once and can be switched off and back on", () => {
  const { s, b } = setup("elephant");
  assert(Z.setHabitatElectric(s, b, true));
  const cash = s.cash;
  Z.setZooSpecialists(s, "technical", 1);
  assert.equal(Z.setHabitatElectric(s, b, true), null);
  assert.equal(s.cash, cash - Z.ELECTRIC_FENCE_COST);
  assert(Z.habitatHasElectric(b));
  assert.equal(Z.setHabitatElectric(s, b, false), null);
  assert(!Z.habitatHasElectric(b));
  assert.equal(Z.setHabitatElectric(s, b, true), null);
  assert.equal(s.cash, cash - Z.ELECTRIC_FENCE_COST);
  const bird = setup("penguin");
  Z.setZooSpecialists(bird.s, "technical", 1);
  const before = structuredClone(bird.s);
  assert(Z.setHabitatElectric(bird.s, bird.b, true));
  assert.deepEqual(bird.s, before);
});
test("Safety deterioration stops visitor opening, paid inspection repairs but does not silently reopen", () => {
  const { s, b } = setup();
  b.habitat.safety = { condition: 29, electric: false };
  tick(s, 0.25);
  assert(!b.open);
  assert.equal(Z.zooAppeal(b), 0);
  assert.equal(Z.zooStats(s).healthyOpen, 0);
  assert.equal(Z.inspectHabitat(s, b), null);
  assert.equal(Z.habitatSafety(b).score, 100);
  assert(!b.open);
  assert.equal(s.expenses, Z.HABITAT_INSPECTION_COST);
  const before = structuredClone(s);
  assert(Z.inspectHabitat(s, b));
  assert.deepEqual(s, before);
});
test("Safety thresholds use actual condition even when the displayed score rounds upward", () => {
  const { s, b } = setup("zebra");
  b.habitat.safety = { condition: 29.9, electric: true, electricInstalled: true };
  assert.equal(Z.habitatSafety(b).score, 30);
  assert.equal(Z.habitatSafety(b).status, "closed");
  assert.match(Z.habitatSafety(b).label, /Sicherheitsstopp/);
  assert.equal(Z.zooAppeal(b), 0);
  assert.equal(Z.zooStats(s).healthyOpen, 0);
  assert(!Z.habitatHasElectric(b));
  tick(s, 0.25);
  assert(!b.open);
  b.habitat.safety.condition = 59.9;
  assert.equal(Z.habitatSafety(b).score, 60);
  assert.equal(Z.habitatSafety(b).status, "warning");
  assert.equal(Z.zooStats(s).unsafe, 1);
  assert(
    !Z.habitatRequirements(s, b).find((r) => r.label === N.HABITAT_PROFILES.zebra.barrierLabel).met,
  );
  b.habitat.safety.condition = 60;
  assert.equal(Z.habitatSafety(b).status, "safe");
});
test("Inspection repairs minor wear even when the displayed condition rounds to 100", () => {
  const { s, b } = setup();
  b.habitat.safety = { condition: 99.9, electric: false };
  assert.equal(Z.habitatSafety(b).score, 100);
  assert.equal(Z.inspectHabitat(s, b), null);
  assert.equal(b.habitat.safety.condition, 100);
  assert.equal(s.expenses, Z.HABITAT_INSPECTION_COST);
  assert(Z.inspectHabitat(s, b));
  assert.equal(s.expenses, Z.HABITAT_INSPECTION_COST);
});
test("Technicians walk to a worn barrier and repair without refilling animal resources", () => {
  const { s, b } = setup("zebra");
  b.habitat.food = 50;
  b.habitat.safety = { condition: 60, electric: false };
  Z.setZooSpecialists(s, "technical", 1);
  tick(s, 0.25);
  assert.equal(s.zoo.workers[0].mode, "walk");
  assert.equal(s.expenses, 0);
  tick(s, 25);
  assert(Z.habitatSafety(b).score >= 99);
  assert(b.habitat.food < 50);
  assert.equal(s.expenses, Z.HABITAT_INSPECTION_COST);
});
test("Technicians maintain reachable empty habitats after the last animal leaves", () => {
  const { s, b } = setup("zebra");
  b.habitat.count = 0;
  b.habitat.safety = { condition: 60, electric: false };
  const resources = [b.habitat.food, b.habitat.water, b.habitat.clean, b.habitat.health];
  Z.setZooSpecialists(s, "technical", 1);
  tick(s, 0.25);
  assert.equal(s.zoo.workers[0].mode, "walk");
  assert.equal(s.expenses, 0);
  tick(s, 25);
  assert.equal(b.habitat.safety.condition, 100);
  assert.deepEqual([b.habitat.food, b.habitat.water, b.habitat.clean, b.habitat.health], resources);
  assert.equal(s.expenses, Z.HABITAT_INSPECTION_COST);
  tick(s, 25);
  assert.equal(s.expenses, Z.HABITAT_INSPECTION_COST);
});
test("Rosters, wages and mid-route persistence include specialist roles without duplicating IDs or fees", () => {
  const { s, b } = setup();
  s.zoo.keepers = 2;
  Z.setZooSpecialists(s, "carnivore", 2);
  Z.setZooSpecialists(s, "technical", 1);
  assert.equal(Z.zooWages(s), 2 * 90 + 3 * 150);
  assert.equal(s.zoo.workers.length, 5);
  assert.equal(new Set(s.zoo.workers.map((w) => w.id)).size, 5);
  b.habitat.food = 50;
  tick(s, 2);
  const copy = JSON.parse(JSON.stringify(s));
  assert(Z.validZoo(copy));
  tick(s, 20);
  tick(copy, 20);
  assert.deepEqual(copy, s);
  Z.setZooSpecialists(s, "carnivore", 0);
  assert(!s.zoo.workers.some((w) => w.role === "carnivore"));
  assert.equal(s.zoo.workers.length, 3);
  assert(Z.validZoo(s));
});
test("Malformed equipment, safety and specialist rosters cannot enter a saved park", () => {
  for (const mutate of [
    (s) => (s.zoo.specialists = { technical: 5 }),
    (s) => (s.zoo.specialists = { magic: 1 }),
    (s) => (s.buildings[0].habitat.features = ["nesting"]),
    (s) => (s.buildings[0].habitat.safety = { condition: NaN, electric: false }),
    (s) => (s.buildings[0].habitat.safety = { condition: 100, electric: true }),
  ]) {
    const { s } = setup();
    mutate(s);
    assert(!Z.validZoo(s));
  }
});
console.log(`${passed} zoo care regressions passed`);

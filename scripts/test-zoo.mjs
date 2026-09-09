import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const Z = await import(moduleURL("game/zoo.ts"));
const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, pass: true });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, pass: false, error: e.message });
    console.error("FAIL", name, e.message);
  }
}
function park() {
  const tiles = Array.from({ length: 30 }, () => Array(30).fill("grass"));
  for (let y = 0; y < 30; y++) tiles[y][15] = "path";
  return {
    tiles,
    buildings: [],
    guests: [],
    cash: 100000,
    expenses: 0,
    dayExpenses: 0,
    operatingExpensesToday: 0,
    time: 0,
    speed: 1,
    staff: 0,
    nextId: 1,
  };
}
function building(s, kind = "zebra", x = 10, y = 18) {
  const b = {
    id: s.nextId++,
    kind,
    x,
    y,
    open: true,
    name: kind,
    price: 4,
    served: 0,
    revenue: 0,
    queue: [],
    riders: [],
    cycle: 0,
    tested: true,
  };
  s.buildings.push(b);
  if (Z.isHabitat(kind)) Z.ensureHabitat(b);
  return b;
}
function access(s, b) {
  return { x: b.x < 15 ? b.x + (Z.SPECIES[b.kind]?.size ?? 2) : b.x - 1, y: b.y };
}
function hut(s) {
  return building(s, "keeperhut", 16, 27);
}
function occupied(s, kind = "zebra", x = 10, y = 18, count = 1) {
  const b = building(s, kind, x, y);
  b.habitat.count = count;
  return b;
}
function dirty(b) {
  Object.assign(b.habitat, { food: 65, water: 64, clean: 62, health: 90 });
}
function run(s, n) {
  for (let t = 0; t < n - 1e-8; t += 0.1) {
    s.time += 0.1;
    Z.tickZoo(s, 0.1, access);
  }
}
function team(s, n = 1) {
  hut(s);
  Z.initZoo(s);
  s.zoo.keepers = n;
  Z.initZoo(s);
}
test("Legacy fields remain optional; initialization creates empty habitats and no staff fees", () => {
  const s = park(),
    b = building(s);
  delete b.habitat;
  assert(Z.validZoo(s));
  const cash = s.cash;
  Z.initZoo(s);
  assert.equal(b.habitat.count, 0);
  assert.equal(s.zoo.keepers, 0);
  assert.deepEqual(s.zoo.workers, []);
  assert.equal(s.cash, cash);
  assert(Z.validZoo(s));
});
test("No animals means no resource decay, welfare penalty or attraction appeal", () => {
  const s = park(),
    b = building(s);
  run(s, 90);
  assert.deepEqual(b.habitat, {
    count: 0,
    food: 100,
    water: 100,
    clean: 100,
    health: 100,
    enrichment: false,
    shelter: false,
  });
  assert.equal(Z.welfare(b), 100);
  assert.equal(Z.zooAppeal(b, "family"), 0);
  assert.deepEqual(
    [Z.zooStats(s).count, Z.zooStats(s).species, Z.zooStats(s).healthyOpen],
    [0, 0, 0],
  );
});
test("Adoption charges each animal once and rejects capacity overflow atomically", () => {
  for (const [kind, spec] of Object.entries(Z.SPECIES)) {
    const s = park(),
      b = building(s, kind, 15 - spec.size, 5);
    const cash = s.cash;
    for (let i = 0; i < spec.capacity; i++) assert.equal(Z.adoptAnimal(s, b), null);
    assert.equal(b.habitat.count, spec.capacity);
    assert.equal(s.cash, cash - spec.adoption * spec.capacity);
    const before = structuredClone(s);
    assert.equal(typeof Z.adoptAnimal(s, b), "string");
    assert.deepEqual(s, before);
    assert(Z.validZoo(s));
  }
});
test("Bankrupt adoption and neglected-stock adoption cannot charge or add animals", () => {
  const s = park(),
    b = building(s);
  s.cash = 0;
  assert(Z.adoptAnimal(s, b));
  assert.equal(b.habitat.count, 0);
  s.cash = 10000;
  b.habitat.count = 1;
  b.habitat.food = 10;
  const before = structuredClone(s);
  assert(Z.adoptAnimal(s, b));
  assert.deepEqual(s, before);
});
test("Upgrades charge once, improve welfare and preserve full animal capacity", () => {
  const s = park(),
    b = occupied(s);
  const old = Z.welfare(b),
    cash = s.cash;
  assert.equal(Z.upgradeHabitat(s, b, "enrichment"), null);
  assert.equal(Z.upgradeHabitat(s, b, "shelter"), null);
  assert.equal(s.cash, cash - 850);
  assert(Z.welfare(b) > old);
  const before = structuredClone(s);
  assert(Z.upgradeHabitat(s, b, "shelter"));
  assert.deepEqual(s, before);
});
test("Resource decay is slow and bounded; care fees and wages do not accrue merely by ticking", () => {
  const s = park(),
    b = occupied(s, "zebra", 10, 18, 4),
    cash = s.cash;
  run(s, 90);
  for (const k of ["food", "water", "clean"]) assert(b.habitat[k] > 85 && b.habitat[k] < 100);
  assert.equal(b.habitat.health, 100);
  assert.equal(s.cash, cash);
  assert.equal(s.expenses, 0);
  assert(Z.validZoo(s));
});
test("Poor vital resources harm health without silently deleting animals", () => {
  const s = park(),
    b = occupied(s);
  Object.assign(b.habitat, { food: 0, water: 0, clean: 0, health: 30 });
  run(s, 60);
  assert(b.habitat.health < 30);
  assert.equal(b.habitat.count, 1);
  assert.equal(Z.zooAppeal(b), 0);
  assert(Z.validZoo(s));
});
test("Paid manual care works for closed reachable habitats without a keeper hut", () => {
  const s = park(),
    b = occupied(s, "zebra", 10, 18, 2);
  dirty(b);
  b.open = false;
  const cash = s.cash;
  assert.equal(Z.careHabitat(s, b), null);
  assert.equal(s.cash, cash - 16);
  assert.equal(s.expenses, 16);
  assert.equal(s.dayExpenses, 16);
  assert.equal(s.operatingExpensesToday, 16);
  assert.deepEqual(
    [b.habitat.food, b.habitat.water, b.habitat.clean, b.habitat.health],
    [100, 100, 100, 100],
  );
});
test("Manual care rejects unreachable entrances and interior or unrelated callback cells", () => {
  const s = park(),
    b = occupied(s);
  dirty(b);
  s.tiles[25][15] = "grass";
  const before = structuredClone(s);
  assert(Z.careHabitat(s, b, access));
  assert.deepEqual(s, before);
  s.tiles[25][15] = "path";
  s.tiles[18][10] = "path";
  assert(Z.careHabitat(s, b, () => ({ x: 10, y: 18 })));
  assert(Z.careHabitat(s, b, () => ({ x: 15, y: 29 })));
  assert(Z.careHabitat(s, b, () => undefined));
});
test("Manual care has no free resources or healing when the budget is insufficient", () => {
  const s = park(),
    b = occupied(s);
  dirty(b);
  s.cash = 7;
  const before = structuredClone(s);
  assert(Z.careHabitat(s, b, access));
  assert.deepEqual(s, before);
});
test("Legacy habitat pod does not block care from another normal fence-side path", () => {
  const s = park(),
    b = occupied(s);
  dirty(b);
  b.pods = { entry: { side: 2, offset: 0 }, exit: { side: 0, offset: 0 } };
  assert.equal(Z.careHabitat(s, b), null);
  assert.equal(b.habitat.food, 100);
  assert.equal(Z.zooStats(s).healthyOpen, 1);
});
test("Keepers require a hut connected to the park entrance", () => {
  const s = park(),
    b = occupied(s);
  dirty(b);
  Z.initZoo(s);
  s.zoo.keepers = 2;
  run(s, 10);
  assert.equal(s.zoo.workers.length, 0);
  building(s, "keeperhut", 16, 20);
  s.tiles[25][15] = "grass";
  run(s, 10);
  assert.equal(s.zoo.workers.length, 0);
  assert.equal(s.expenses, 0);
});
test("Keeper visibly walks and works at the exterior port before any charge or resource refill", () => {
  const s = park(),
    b = occupied(s);
  dirty(b);
  team(s);
  const cash = s.cash;
  run(s, 0.2);
  const w = s.zoo.workers[0];
  assert.equal(w.mode, "walk");
  assert(w.route.length > 0);
  assert(w.route.every((p) => p.x === 15));
  assert.equal(s.cash, cash);
  assert(b.habitat.food < 65);
  run(s, 5);
  assert.equal(s.cash, cash);
  run(s, 9);
  assert.equal(s.cash, cash - 8);
  assert(b.habitat.food > 99);
  assert.equal(s.operatingExpensesToday, 8);
  assert(Z.validZoo(s));
});
test("Two keepers reserve different jobs and do not duplicate service charges", () => {
  const s = park(),
    a = occupied(s),
    b = occupied(s, "giraffe", 9, 8);
  dirty(a);
  dirty(b);
  team(s, 2);
  run(s, 0.1);
  assert.equal(new Set(s.zoo.workers.map((w) => w.targetId)).size, 2);
  run(s, 24);
  assert.equal(s.expenses, 16);
  assert(a.habitat.food > 97 && b.habitat.food > 97);
  assert(Z.validZoo(s));
});
test("Bankruptcy during a keeper visit prevents service at completion", () => {
  const s = park(),
    b = occupied(s);
  dirty(b);
  team(s);
  run(s, 8);
  assert.equal(s.zoo.workers[0].mode, "care");
  s.cash = 0;
  const food = b.habitat.food;
  run(s, 6);
  assert.equal(s.expenses, 0);
  assert(b.habitat.food < food);
  assert.equal(s.cash, 0);
  assert(Z.validZoo(s));
});
test("Breaking a route during approach cancels the visit without remote care", () => {
  const s = park(),
    b = occupied(s);
  dirty(b);
  team(s);
  run(s, 1);
  s.tiles[25][15] = "grass";
  const food = b.habitat.food;
  run(s, 15);
  assert.equal(s.expenses, 0);
  assert(b.habitat.food < food);
  assert(Z.validZoo(s));
});
test("Moving a target invalidates its old route and never services the old position", () => {
  const s = park(),
    b = occupied(s);
  dirty(b);
  team(s);
  run(s, 1);
  b.x = 3;
  const food = b.habitat.food;
  run(s, 15);
  assert.equal(s.expenses, 0);
  assert(b.habitat.food < food);
  assert(Z.validZoo(s));
});
test("Deleted keeper huts/targets are saveable and stale jobs recover on tick", () => {
  const s = park(),
    b = occupied(s);
  dirty(b);
  team(s);
  run(s, 1);
  s.buildings = s.buildings.filter((x) => x.kind !== "keeperhut");
  assert(Z.validZoo(s));
  run(s, 0.1);
  assert.equal(s.zoo.workers.length, 0);
  assert.equal(s.expenses, 0);
  assert(Z.validZoo(s));
});
test("Saved mid-walk state resumes deterministically with no double charges", () => {
  const s = park(),
    b = occupied(s);
  dirty(b);
  team(s);
  run(s, 2.3);
  const copy = JSON.parse(JSON.stringify(s));
  assert(Z.validZoo(copy));
  run(s, 20);
  run(copy, 20);
  assert.deepEqual(copy, s);
  assert.equal(s.expenses, 8);
});
test("Zero/nonfinite dt is an exact no-op, including missing optional state", () => {
  const s = park();
  const before = structuredClone(s);
  for (const dt of [0, -1, NaN, Infinity]) Z.tickZoo(s, dt, access);
  assert.deepEqual(s, before);
});
test("Worker roster shrinks safely, rehiring uses monotonic private IDs", () => {
  const s = park();
  team(s, 2);
  const old = s.zoo.nextId;
  s.zoo.keepers = 1;
  Z.initZoo(s);
  assert.equal(s.zoo.workers.length, 1);
  s.zoo.keepers = 2;
  Z.initZoo(s);
  assert.equal(s.zoo.workers.length, 2);
  assert(s.zoo.nextId > old);
  assert(Z.validZoo(s));
});
test("Malformed animal state, roster, IDs and teleport routes are rejected; absent state is accepted", () => {
  assert(Z.validZoo(park()));
  for (const mutate of [
    (s) => (s.buildings[0].habitat.count = 7),
    (s) => (s.buildings[0].habitat.food = NaN),
    (s) => (s.buildings[0].habitat.enrichment = "yes"),
    (s) => (s.zoo.keepers = 9),
    (s) => (s.zoo.nextId = 1),
    (s) =>
      (s.zoo.workers[0].route = [
        { x: 15, y: 26 },
        { x: 15, y: 2 },
      ]),
    (s) => (s.zoo.workers[0].workLeft = -1),
    (s) => (s.zoo.workers[0].targetId = "ride"),
    (s) => (s.buildings[1].habitat = { ...s.buildings[0].habitat }),
  ]) {
    const s = park();
    occupied(s);
    team(s);
    mutate(s);
    assert.equal(Z.validZoo(s), false);
  }
});
test("healthyOpen counts reachable healthy species once rather than duplicate habitats", () => {
  const s = park();
  occupied(s);
  occupied(s, "zebra", 16, 18);
  occupied(s, "giraffe", 9, 8);
  const flamingo = occupied(s, "flamingo", 11, 3),
    penguin = occupied(s, "penguin", 11, 23);
  flamingo.open = false;
  penguin.habitat.health = 10;
  assert.equal(Z.zooStats(s, access).species, 4);
  assert.equal(Z.zooStats(s, access).healthyOpen, 2);
  flamingo.open = true;
  penguin.habitat.health = 100;
  assert.equal(Z.zooStats(s, access).healthyOpen, 4);
  s.tiles[25][15] = "grass";
  assert.equal(Z.zooStats(s, access).healthyOpen, 0);
});
test("Habitat simulation never changes guest routes, IDs, thoughts or billing", () => {
  const s = park(),
    b = occupied(s);
  dirty(b);
  team(s);
  s.guests = [
    {
      id: 700,
      x: 15,
      y: 22,
      route: [{ x: 15, y: 23 }],
      target: 5,
      state: "queue",
      timer: 4,
      happiness: 70,
      wallet: 50,
      thought: "waiting",
      transit: { line: 1 },
    },
  ];
  const guests = structuredClone(s.guests),
    next = s.nextId;
  run(s, 20);
  assert.deepEqual(s.guests, guests);
  assert.equal(s.nextId, next);
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

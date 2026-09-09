import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  Z = await import(moduleURL("game/zoo.ts"));
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("PASS", name);
}
function building(s, kind, y, x = 15 - (Z.SPECIES[kind]?.size ?? 2)) {
  const b = {
    id: s.nextId++,
    kind,
    x,
    y,
    name: `${kind} ${s.nextId}`,
    open: true,
    price: 0,
    served: 0,
    revenue: 0,
    queue: [],
    riders: [],
    cycle: 0,
    tested: true,
  };
  s.buildings.push(b);
  if (Z.isHabitat(kind)) Z.ensureHabitat(b).count = 1;
  return b;
}
function setup(role) {
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
  const hut = building(s, "keeperhut", 27, 16),
    near = building(s, "zebra", 21),
    far = building(s, "zebra", 4);
  Z.initZoo(s);
  if (role) Z.setZooSpecialists(s, role, 1);
  else {
    s.zoo.keepers = 1;
    Z.initZoo(s);
  }
  return { s, hut, near, far, w: s.zoo.workers[0] };
}
const tick = (s, dt) => Z.tickZoo(s, dt, (park, b) => S.access(park, b));
const lowerFood = (b, value = 50) => {
  b.habitat.food = value;
};
function freeze(value) {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

test("Legacy employees remain automatic, and compatible choices are pure qualification reads", () => {
  const { s, w, near, far } = setup();
  const lion = building(s, "lion", 12, 16);
  far.open = false;
  far.habitat.count = 0;
  const before = structuredClone(s);
  freeze(s);
  assert.equal(w.assignedHabitatId, undefined);
  assert.equal(Z.validZoo(s), true);
  assert.deepEqual(
    Z.keeperAssignments(s, w).map((b) => b.id),
    [near.id, far.id],
  );
  assert(!Z.keeperAssignments(s, w).includes(lion));
  assert.deepEqual(Z.keeperAssignments(s, { ...w, id: 999999 }), []);
  assert.deepEqual(s, before);
});

test("Assignment preserves identity, qualification, home, salary and money", () => {
  const { s, w, hut, far } = setup("savanna"),
    id = w.id,
    wages = Z.zooWages(s),
    cash = s.cash,
    count = s.zoo.specialists.savanna;
  const position = { x: w.x, y: w.y };
  assert.equal(Z.assignZooKeeperToHabitat(s, id, far.id), null);
  assert.equal(w.assignedHabitatId, far.id);
  assert.equal(w.id, id);
  assert.equal(w.role, "savanna");
  assert.equal(w.homeId, hut.id);
  assert.equal(s.zoo.specialists.savanna, count);
  assert.equal(Z.zooWages(s), wages);
  assert.equal(s.cash, cash);
  assert.equal(s.expenses, 0);
  assert.deepEqual({ x: w.x, y: w.y }, position);
  Z.initZoo(s);
  assert.equal(s.zoo.workers[0], w);
  assert.equal(Z.validZoo(s), true);
});

test("Invalid and incompatible assignments fail without changing any park state", () => {
  const { s, w, hut, far } = setup(),
    lion = building(s, "lion", 12, 16);
  for (const [workerId, buildingId] of [
    [99999, far.id],
    [w.id, 99999],
    [w.id, hut.id],
    [w.id, lion.id],
  ]) {
    const before = structuredClone(s);
    assert.equal(typeof Z.assignZooKeeperToHabitat(s, workerId, buildingId), "string");
    assert.deepEqual(s, before);
  }
  s.tiles[18][15] = "grass";
  const before = structuredClone(s);
  assert.equal(typeof Z.assignZooKeeperToHabitat(s, w.id, far.id), "string");
  assert.deepEqual(s, before);
  assert.equal(Z.assignZooKeeperToHabitat(s, w.id, null), null);
  assert.deepEqual(s, before);
});

test("An assigned keeper walks to the selected closed habitat and ignores other needy animals", () => {
  const { s, w, near, far } = setup();
  lowerFood(near, 25);
  lowerFood(far, 50);
  far.open = false;
  assert.equal(Z.assignZooKeeperToHabitat(s, w.id, far.id), null);
  tick(s, 0.25);
  assert.equal(w.targetId, far.id);
  assert.equal(w.mode, "walk");
  assert(w.route.length > 10);
  assert.equal(s.expenses, 0);
  assert.equal(Z.habitatCareStatus(s, far).staffed, true);
  assert.equal(Z.habitatCareStatus(s, near).staffed, false);
  tick(s, 30);
  assert(far.habitat.food > 98);
  assert(near.habitat.food < 25);
  assert.equal(s.expenses, Z.CARE_PER_ANIMAL);
  assert.equal(far.open, false);
  assert.equal(w.assignedHabitatId, far.id);
  assert.equal(w.targetId, null);
  assert.equal(Z.validZoo(s), true);
});

test("Changing an active assignment clears the old route without teleporting or billing", () => {
  const { s, w, near, far } = setup();
  lowerFood(near);
  lowerFood(far);
  Z.assignZooKeeperToHabitat(s, w.id, far.id);
  tick(s, 2);
  assert.equal(w.targetId, far.id);
  const position = { x: w.x, y: w.y },
    cash = s.cash;
  assert.equal(Z.assignZooKeeperToHabitat(s, w.id, near.id), null);
  assert.equal(w.targetId, null);
  assert.deepEqual(w.route, []);
  assert.equal(w.mode, "idle");
  assert.deepEqual({ x: w.x, y: w.y }, position);
  assert.equal(s.cash, cash);
  tick(s, 0.25);
  assert.equal(w.targetId, near.id);
  assert.equal(Z.validZoo(s), true);
});

test("Automatic assignment can resume and selecting the existing assignment keeps care progress", () => {
  const { s, w, near, far } = setup();
  lowerFood(near);
  Z.assignZooKeeperToHabitat(s, w.id, far.id);
  tick(s, 1);
  assert.equal(w.targetId, null);
  assert.equal(Z.assignZooKeeperToHabitat(s, w.id, null), null);
  assert.equal(w.assignedHabitatId, undefined);
  tick(s, 1.75);
  assert.equal(w.targetId, near.id);
  Z.assignZooKeeperToHabitat(s, w.id, near.id);
  const before = structuredClone(s);
  assert.equal(Z.assignZooKeeperToHabitat(s, w.id, near.id), null);
  assert.deepEqual(s, before);
});

test("Technicians restrict real barrier repairs to the assigned habitat", () => {
  const { s, w, near, far } = setup("technical");
  near.habitat.safety = { condition: 20, electric: false };
  far.habitat.safety = { condition: 25, electric: false };
  assert(Z.keeperAssignments(s, w).includes(far));
  assert.equal(Z.assignZooKeeperToHabitat(s, w.id, far.id), null);
  tick(s, 0.25);
  assert.equal(w.targetId, far.id);
  assert.equal(w.mode, "walk");
  tick(s, 30);
  assert(far.habitat.safety.condition > 99);
  assert(near.habitat.safety.condition < 20);
  assert.equal(s.expenses, Z.HABITAT_INSPECTION_COST);
  assert.equal(w.role, "technical");
});

test("Assignment survives JSON persistence; deleting its habitat restores automatic work", () => {
  const { s, w, far, near } = setup("savanna");
  Z.assignZooKeeperToHabitat(s, w.id, far.id);
  const loaded = JSON.parse(JSON.stringify(s)),
    id = w.id,
    homeId = w.homeId;
  assert.equal(Z.validZoo(loaded), true);
  Z.initZoo(loaded);
  const worker = loaded.zoo.workers.find((v) => v.id === id);
  assert.equal(worker.assignedHabitatId, far.id);
  loaded.buildings = loaded.buildings.filter((b) => b.id !== far.id);
  assert.equal(Z.validZoo(loaded), true);
  Z.initZoo(loaded);
  assert.equal(worker.assignedHabitatId, undefined);
  assert.equal(worker.id, id);
  assert.equal(worker.homeId, homeId);
  lowerFood(loaded.buildings.find((b) => b.id === near.id));
  tick(loaded, 0.25);
  assert.equal(worker.targetId, near.id);
  assert.equal(Z.validZoo(loaded), true);
});

test("Lost access suspends the job but retains the assignment until paths reconnect", () => {
  const { s, w, far } = setup();
  lowerFood(far);
  Z.assignZooKeeperToHabitat(s, w.id, far.id);
  tick(s, 0.25);
  s.tiles[18][15] = "grass";
  tick(s, 0.25);
  assert.equal(w.targetId, null);
  assert.equal(w.assignedHabitatId, far.id);
  assert.equal(s.expenses, 0);
  s.tiles[18][15] = "path";
  tick(s, 1.75);
  assert.equal(w.targetId, far.id);
  assert.equal(w.mode, "walk");
  assert.equal(Z.validZoo(s), true);
});

test("Replacing a keeper home preserves identity and assignment", () => {
  const { s, w, hut, far } = setup();
  const otherHome = building(s, "keeperhut", 25, 16),
    id = w.id;
  Z.assignZooKeeperToHabitat(s, id, far.id);
  s.buildings = s.buildings.filter((b) => b.id !== hut.id);
  Z.initZoo(s);
  assert.equal(s.zoo.workers[0].id, id);
  assert.equal(w.homeId, otherHome.id);
  assert.equal(w.assignedHabitatId, far.id);
  assert.equal(Z.validZoo(s), true);
});

test("Persisted assignment IDs reject malformed values while missing legacy fields remain valid", () => {
  const { s, w, far } = setup();
  assert.equal(Z.validZoo(s), true);
  for (const value of [null, -1, 0, 1.5, "12", Infinity]) {
    w.assignedHabitatId = value;
    assert.equal(Z.validZoo(s), false);
  }
  w.assignedHabitatId = far.id;
  assert.equal(Z.validZoo(s), true);
  delete w.assignedHabitatId;
  assert.equal(Z.validZoo(s), true);
});

test("Visitor requirements honor a selected viewpoint while staff retain another care access", () => {
  const { s, far } = setup();
  far.habitat.viewpoint = { x: far.x - 1, y: far.y };
  assert.equal(Z.habitatRequirements(s, far)[0].met, false);
  assert.equal(Z.habitatCareStatus(s, far).staffed, true);
  for (let x = far.x - 1; x <= 15; x++) s.tiles[far.y - 1][x] = "path";
  s.tiles[far.y][far.x - 1] = "path";
  assert.equal(Z.habitatRequirements(s, far)[0].met, true);
  assert.equal(Z.habitatCareStatus(s, far).staffed, true);
});

console.log(`${passed} staff assignment tests passed.`);

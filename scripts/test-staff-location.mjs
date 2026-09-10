import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  Z = await import(moduleURL("game/zoo.ts")),
  O = await import(moduleURL("game/operations.ts")),
  C = await import(moduleURL("game/cleanliness.ts")),
  F = await import(moduleURL("game/staff.ts"));
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("PASS", name);
}
function setup() {
  const s = S.newPark("sandbox");
  s.tiles = Array.from({ length: 36 }, () => Array(36).fill("grass"));
  for (let y = 0; y < 36; y++) s.tiles[y][15] = "path";
  s.guests = [];
  s.buildings = [];
  s.cleanliness = undefined;
  s.zoo = undefined;
  s.staff = 0;
  s.cash = 100000;
  s.expenses = s.dayExpenses = s.operatingExpensesToday = 0;
  const add = (kind, x, y) => {
    const b = {
      id: s.nextId++,
      kind,
      x,
      y,
      name: kind,
      open: true,
      tested: true,
      price: 0,
      served: 0,
      revenue: 0,
      queue: [],
      riders: [],
      cycle: 0,
    };
    s.buildings.push(b);
    return b;
  };
  const home = add("keeperhut", 16, 27),
    habitat = add("zebra", 10, 8);
  Z.ensureHabitat(habitat).count = 1;
  Z.initZoo(s);
  s.zoo.keepers = 1;
  Z.initZoo(s);
  return { s, home, habitat, worker: s.zoo.workers[0] };
}
const tick = (s, dt) => Z.tickZoo(s, dt, (park, b) => S.access(park, b));
const location = (s, worker) => F.staffLocation(s, { kind: "keeper", id: worker.id });
const near = (a, b) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

test("Idle keepers patrol real nearby public paths and record actual distance/direction", () => {
  const { s, worker } = setup(),
    origin = { x: worker.x, y: worker.y };
  tick(s, 0.25);
  assert.equal(worker.mode, "patrol");
  assert.equal(worker.targetId, null);
  assert(worker.route.length > 0);
  assert(worker.route.every((p) => s.tiles[p.y][p.x] === "path"));
  let measured = 0,
    previous = { x: worker.x, y: worker.y };
  for (let i = 0; i < 60; i++) {
    tick(s, 0.25);
    measured += Math.hypot(worker.x - previous.x, worker.y - previous.y);
    previous = { x: worker.x, y: worker.y };
    assert.equal(s.tiles[Math.round(worker.y)][Math.round(worker.x)], "path");
    assert(Math.hypot(worker.x - origin.x, worker.y - origin.y) <= 3.001);
    assert(Z.validZoo(s));
  }
  assert(measured > 2);
  near(worker.walked, measured);
  assert(Number.isFinite(worker.heading));
  const pose = location(s, worker);
  assert.equal(pose.x, worker.x);
  assert.equal(pose.y, worker.y);
  assert.equal(pose.distanceWalked, worker.walked);
  assert.equal(pose.name, "Mila · #1");
  assert.equal(s.expenses, 0);
});

test("A care job immediately interrupts patrol without teleporting or remote service", () => {
  const { s, worker, habitat } = setup();
  tick(s, 1);
  assert.equal(worker.mode, "patrol");
  const point = { x: worker.x, y: worker.y },
    distance = worker.walked;
  habitat.habitat.food = 50;
  tick(s, 0.25);
  assert.equal(worker.mode, "walk");
  assert.equal(worker.targetId, habitat.id);
  assert.deepEqual({ x: worker.x, y: worker.y }, point);
  assert.equal(worker.walked, distance);
  assert.equal(s.expenses, 0);
  const pose = location(s, worker);
  assert.equal(pose.activity, "walk");
  assert.equal(pose.carrying, "feed");
  assert.equal(pose.targetId, habitat.id);
});

test("Assigned idle rounds stay near the selected habitat and retain the employee's role", () => {
  const { s, worker, habitat } = setup();
  assert.equal(Z.assignZooKeeperToHabitat(s, worker.id, habitat.id), null);
  tick(s, 35);
  assert.equal(worker.assignedHabitatId, habitat.id);
  assert.equal(worker.role, undefined);
  assert.equal(worker.targetId, null);
  assert(Math.abs(worker.x - 15) + Math.abs(worker.y - habitat.y) <= 3.001);
  assert.equal(s.expenses, 0);
  assert(Z.validZoo(s));
});

test("Keeper care exposes actual timed feeding, watering and cleaning before one service bill", () => {
  const { s, worker, habitat } = setup();
  habitat.habitat.food = 50;
  const actions = new Set();
  for (let i = 0; i < 160 && s.expenses === 0; i++) {
    tick(s, 0.25);
    const pose = location(s, worker);
    if (worker.mode === "care") {
      actions.add(pose.activity);
      assert(worker.workTotal > 0);
      near(pose.progress, 1 - worker.workLeft / worker.workTotal);
      assert(pose.progress >= 0 && pose.progress <= 1);
      assert.equal(pose.walking, false);
      assert(pose.dx < 0, "Care faces the habitat from its exterior path");
      assert.equal(s.expenses, 0);
    }
  }
  assert.deepEqual([...actions], ["feed", "water", "clean"]);
  assert.equal(s.expenses, Z.CARE_PER_ANIMAL);
  assert.equal(worker.workTotal, undefined);
});

test("Patrol save/resume is deterministic and pause/read helpers are exact no-ops", () => {
  const { s, worker } = setup();
  tick(s, 1.25);
  const loaded = JSON.parse(JSON.stringify(s));
  assert(Z.validZoo(loaded));
  tick(s, 3);
  tick(loaded, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), loaded);
  s.speed = 0;
  const paused = structuredClone(s);
  S.tick(s, 30);
  assert.deepEqual(s, paused);
  freeze(s);
  const random = Math.random;
  Math.random = () => {
    throw new Error("Staff lookup consumed randomness");
  };
  try {
    const first = location(s, worker),
      second = location(s, worker);
    assert.deepEqual(first, second);
    assert.deepEqual(s, paused);
    first.x = 999;
    assert.equal(worker.x, paused.zoo.workers[0].x);
  } finally {
    Math.random = random;
  }
});

test("Removed patrol paths cancel movement without leaving invalid routes or charging", () => {
  const { s, worker, habitat } = setup();
  Z.assignZooKeeperToHabitat(s, worker.id, habitat.id);
  tick(s, 0.25);
  const next = worker.route[0];
  s.tiles[next.y][next.x] = "grass";
  tick(s, 0.25);
  assert(worker.route.every((p) => s.tiles[p.y]?.[p.x] === "path"));
  assert.equal(s.expenses, 0);
  assert(Z.validZoo(s));
});

test("Operator checking and unloading move continuously between shared gate/control endpoints", () => {
  const s = S.newPark("sandbox"),
    b = s.buildings.find((b) => b.kind === "wheel"),
    ref = { kind: "operator", id: b.id },
    read = () => F.staffLocation(s, ref);
  b.queue = [123];
  b.riders = [];
  b.cycle = 0;
  O.resetRideOperations(b);
  const initial = read(),
    money = s.cash;
  assert.deepEqual({ x: initial.x, y: initial.y }, initial.gate);
  assert.equal(O.tickOperations(b, 2, true), false);
  assert.equal(O.operatorState(b).consoleProgress, 0);
  assert.equal(read().x, initial.x);
  assert.equal(O.tickOperations(b, 0.75, true), false);
  const mid = read();
  near(mid.x, (mid.gate.x + mid.control.x) / 2);
  near(mid.y, (mid.gate.y + mid.control.y) / 2);
  assert.equal(mid.walking, true);
  assert.equal(mid.activity, "checking");
  assert.equal(O.tickOperations(b, 0.75, true), true);
  const checked = read();
  near(checked.x, checked.control.x);
  near(checked.y, checked.control.y);
  b.riders = [123];
  b.queue = [];
  b.cycle = 24;
  O.startRideProgram(b);
  const running = read();
  assert.equal(running.x, checked.x);
  assert.equal(running.y, checked.y);
  assert.equal(running.activity, "control");
  b.riders = [];
  O.finishRideProgram(b);
  assert.equal(read().x, running.x);
  assert.equal(read().y, running.y);
  O.tickOperations(b, 0.6, true);
  const unloading = read();
  near(unloading.x, mid.x);
  near(unloading.y, mid.y);
  near(unloading.dx, -mid.dx);
  near(unloading.dy, -mid.dy);
  O.tickOperations(b, 0.6, true);
  const done = read();
  near(done.x, initial.x);
  near(done.y, initial.y);
  assert.equal(s.cash, money);
  assert.equal(O.programDuration(b, 24), 28.7);
});

test("Operator lookup is pure, follows moved buildings and returns null for missing people", () => {
  const s = S.newPark("sandbox"),
    b = s.buildings.find((b) => b.kind === "wheel"),
    ref = { kind: "operator", id: b.id };
  b.pods ??= S.effectivePods(s, b);
  const before = F.staffLocation(s, ref);
  b.x += 1;
  near(F.staffLocation(s, ref).x, before.x + 1);
  const snapshot = structuredClone(s);
  F.staffLocation(s, ref);
  assert.deepEqual(s, snapshot);
  assert.equal(O.setRideStaffed(b, false), null);
  assert.equal(F.staffLocation(s, ref), null);
  assert.equal(F.staffLocation(s, { kind: "keeper", id: 99999 }), null);
  assert.equal(F.staffLocation(s, { kind: "cleaner", id: 99999 }), null);
  assert.equal(F.staffLocation(s, { kind: "operator", id: 99999 }), null);
});

test("Legacy keeper movement fields are optional; malformed distance/progress fields reject saves", () => {
  const { s, worker } = setup();
  assert(Z.validZoo(s));
  for (const [field, value] of [
    ["walked", -1],
    ["walked", Infinity],
    ["heading", NaN],
    ["workTotal", -1],
  ]) {
    worker[field] = value;
    assert.equal(Z.validZoo(s), false);
    delete worker[field];
  }
  worker.workLeft = 3;
  worker.workTotal = 2;
  assert.equal(Z.validZoo(s), false);
});

test("Cleaner camera location uses the same physical service pose and actual carried waste", () => {
  const { s } = setup();
  const worker = {
    id: 1,
    x: 15,
    y: 29,
    route: [],
    mode: "deposit",
    workLeft: 1.2,
    workTotal: 2.4,
    retry: 0,
    heading: 0,
    walked: 5,
    carried: 3,
    toCollection: true,
    target: { kind: "collection", id: 0, point: { x: 15, y: 29 } },
  };
  s.cleanliness = {
    version: 1,
    workers: [worker],
    litter: [],
    nextId: 1,
    binned: 0,
    cleaned: 0,
    emptied: 0,
  };
  const before = structuredClone(s),
    location = F.staffLocation(s, { kind: "cleaner", id: 1 }),
    pose = C.cleanerServicePose(s, worker);
  for (const field of ["x", "y", "dx", "dy", "walking", "progress", "distanceWalked"])
    assert.equal(location[field], pose[field]);
  assert.equal(location.name, "Alex · #1");
  assert.equal(location.activity, "deposit");
  assert.equal(location.carried, 3);
  assert.equal(location.carrying, "waste");
  assert.deepEqual(s, before);
});

console.log(`${passed} staff location/movement tests passed.`);

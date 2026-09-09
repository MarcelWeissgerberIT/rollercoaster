import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
process.on("uncaughtException", (e) => {
  console.error(e.message);
  process.exit(1);
});
const S = await import(moduleURL("game/simulation.ts")),
  T = await import(moduleURL("game/transit.ts"));
const results = [];
function test(name, fn) {
  try {
    results.push({ name, pass: true, evidence: fn() });
  } catch (e) {
    results.push({ name, pass: false, error: e.message.slice(0, 900) });
  }
  console.log(JSON.stringify(results.at(-1)));
}
function add(s, kind, x, y) {
  const r = S.build(s, kind, x, y);
  assert(!r.error, r.error);
  const b = s.buildings.find((b) => b.id === r.id);
  b.open = true;
  b.tested = true;
  return b;
}
function legacy() {
  const s = S.newPark("sandbox"),
    template = structuredClone(s.guests[0]);
  s.buildings = [];
  s.guests = [];
  s.transitLines = [];
  s.zoo = { keepers: 0, workers: [], nextId: 1 };
  s.tiles = s.tiles.map((r) => r.map(() => "grass"));
  s.open = false;
  s.cash = 100000;
  for (let y = 12; y < 30; y++) s.tiles[y][15] = "path";
  for (let x = 2; x <= 26; x++) {
    s.tiles[12][x] = "path";
    s.tiles[20][x] = "path";
  }
  const b = add(s, "zebra", 5, 5);
  b.habitat.count = 2;
  delete b.habitat.accessVersion;
  b.price = 3;
  b.pods = { entry: { side: 1, offset: 0 }, exit: { side: 1, offset: 4 } };
  for (let y = 10; y < 12; y++) {
    s.tiles[y][5] = "queue";
    s.tiles[y][9] = "exit";
  }
  return { s, b, template };
}
test("Old habitat pod save is accepted before migration", () => {
  const { s } = legacy();
  assert(S.validSave(structuredClone(s)));
});
test("Exclusive old blue/red components become paths; prices, pods and migrations are stable", () => {
  const { s, b } = legacy(),
    cash = s.cash;
  S.migratePark(s);
  assert.equal(s.cash, cash);
  for (const x of [5, 9]) for (let y = 10; y < 12; y++) assert.equal(s.tiles[y][x], "path");
  assert.equal(b.price, 0);
  assert.equal(b.pods, undefined);
  assert.equal(b.habitat.accessVersion, 1);
  assert(S.access(s, b));
  assert(S.validSave(structuredClone(s)));
  const first = structuredClone(s);
  S.migratePark(s);
  assert.deepEqual(s, first);
});
test("Shared closed ride blue queue remains blue", () => {
  const { s, b } = legacy(),
    ride = add(s, "wheel", 2, 8);
  ride.open = false;
  ride.pods = { entry: { side: 0, offset: 2 }, exit: { side: 1, offset: 0 } };
  const cap = S.queueCapacity(s, ride);
  S.migratePark(s);
  for (let y = 10; y < 12; y++) assert.equal(s.tiles[y][5], "queue");
  assert.equal(S.queueCapacity(s, ride), cap);
  for (let y = 10; y < 12; y++) assert.equal(s.tiles[y][9], "path");
  assert.equal(b.pods, undefined);
  return { capacity: cap };
});
test("Shared red component at a shop exterior remains an exit", () => {
  const { s } = legacy(),
    shop = add(s, "burger", 10, 10);
  s.tiles[11][10] = "path";
  const before = S.exitPath(s, shop);
  assert(before.length > 0);
  S.migratePark(s);
  for (let y = 10; y < 12; y++) assert.equal(s.tiles[y][9], "exit");
  assert.deepEqual(S.exitPath(s, shop), before);
});
test("Shared blue component serving keeper-hut exterior remains a queue", () => {
  const { s } = legacy();
  add(s, "keeperhut", 3, 9);
  S.migratePark(s);
  for (let y = 10; y < 12; y++) assert.equal(s.tiles[y][5], "queue");
});
test("An onboard transport passenger whose final destination is a legacy habitat remains onboard and save-valid", () => {
  const { s, b, template } = legacy(),
    a = add(s, "train", 5, 19),
    z = add(s, "train", 25, 19);
  a.pods = { entry: { side: 1, offset: 0 }, exit: { side: 3, offset: 0 } };
  z.pods = structuredClone(a.pods);
  assert.equal(T.createTransitLine(s, a, z), null);
  const l = s.transitLines[0],
    g = {
      ...template,
      id: s.nextId++,
      state: "ride",
      target: b.id,
      route: [],
      timer: 0,
      x: 5,
      y: 20,
      transit: { line: l.id, from: a.id, to: z.id, fare: 3 },
    };
  s.guests = [g];
  l.passengers = [g.id];
  const before = {
    state: g.state,
    transit: structuredClone(g.transit),
    passengers: [...l.passengers],
  };
  S.migratePark(s);
  assert.deepEqual({ state: g.state, transit: g.transit, passengers: l.passengers }, before);
  assert(S.validSave(structuredClone(s)));
});
test("Old waiting and riding zoo guests are released without charge or teleport", () => {
  const { s, b, template } = legacy(),
    waiting = {
      ...template,
      id: s.nextId++,
      state: "queue",
      target: b.id,
      x: 5,
      y: 10,
      route: [],
      timer: 6,
    },
    riding = {
      ...template,
      id: s.nextId++,
      state: "ride",
      target: b.id,
      x: 5,
      y: 10,
      route: [],
      timer: 0,
    };
  s.guests = [waiting, riding];
  b.queue = [waiting.id];
  b.riders = [riding.id];
  b.cycle = 7;
  const cash = s.cash,
    income = s.income,
    wallets = s.guests.map((g) => g.wallet);
  S.migratePark(s);
  assert.deepEqual(b.queue, []);
  assert.deepEqual(b.riders, []);
  assert.equal(waiting.state, "walk");
  assert.equal(riding.state, "observe");
  assert.deepEqual(
    s.guests.map((g) => [g.x, g.y]),
    [
      [5, 10],
      [5, 10],
    ],
  );
  assert.deepEqual(
    s.guests.map((g) => g.wallet),
    wallets,
  );
  assert.equal(s.cash, cash);
  assert.equal(s.income, income);
  assert(S.validSave(structuredClone(s)));
});
test("Old habitat without pods still converts exclusively adjacent legacy colored paths", () => {
  const { s, b } = legacy();
  delete b.pods;
  S.migratePark(s);
  for (const x of [5, 9]) for (let y = 10; y < 12; y++) assert.equal(s.tiles[y][x], "path");
  assert(S.access(s, b));
});
test("No-pod legacy ride exterior protects a shared queue before ensurePods runs", () => {
  const { s } = legacy(),
    ride = add(s, "wheel", 2, 8);
  delete ride.pods;
  S.migratePark(s);
  for (let y = 10; y < 12; y++) assert.equal(s.tiles[y][5], "queue");
  assert(ride.pods);
});
test("A public path separates components; unrelated exits remain untouched", () => {
  const { s } = legacy();
  s.tiles[11][12] = "exit";
  s.tiles[10][12] = "exit";
  S.migratePark(s);
  assert.equal(s.tiles[11][12], "exit");
  assert.equal(s.tiles[10][12], "exit");
  assert.equal(s.tiles[11][9], "path");
});
test("A migrated habitat does not repaint later player-authored paths on every tick", () => {
  const { s, b } = legacy();
  S.migratePark(s);
  s.tiles[10][5] = "queue";
  s.tiles[11][5] = "queue";
  s.tiles[10][9] = "exit";
  s.tiles[11][9] = "exit";
  const before = structuredClone(s.tiles);
  S.migratePark(s);
  assert.deepEqual(s.tiles, before);
  assert.equal(b.habitat.accessVersion, 1);
});
const A = await import(moduleURL("game/zoo-access.ts"));
const C = await import(moduleURL("game/construction.ts"));
const Z = await import(moduleURL("game/zoo.ts"));
function observationPark() {
  const { s, b, template } = legacy();
  S.migratePark(s);
  s.speed = 1;
  s.time = 0;
  s.staff = 0;
  s.guests = [];
  for (let x = 5; x <= 9; x++) s.tiles[10][x] = "path";
  return { s, b, template };
}
test("Every normal, connected fence side works; queue, exit and disconnected paths do not", () => {
  const { s, b } = observationPark();
  for (let y = 5; y <= 10; y++) s.tiles[y][4] = "path";
  for (let x = 4; x <= 10; x++) s.tiles[4][x] = "path";
  for (let y = 4; y <= 10; y++) s.tiles[y][10] = "path";
  assert.equal(A.habitatViewingSpots(s, b).length, 20);
  s.tiles[4][7] = "queue";
  s.tiles[4][8] = "exit";
  assert.equal(A.habitatViewingSpots(s, b).length, 18);
  for (const row of s.tiles)
    for (let x = 0; x < row.length; x++) if (row[x] === "path") row[x] = "grass";
  s.tiles[29][15] = "path";
  s.tiles[10][5] = "path";
  assert.equal(S.access(s, b), undefined);
});
test("Automatic habitat connection builds only normal paths and needs no pods", () => {
  const { s, b } = observationPark();
  for (let x = 4; x <= 10; x++) for (let y = 4; y <= 11; y++) s.tiles[y][x] = "grass";
  const plan = C.planConnection(s, b);
  assert.equal(plan.error, null);
  assert(plan.points.length > 0);
  assert.equal(plan.cost, plan.points.length * 12);
  const cash = s.cash;
  assert.equal(C.connectBuilding(s, b), null);
  assert.equal(cash - s.cash, plan.cost);
  assert(S.access(s, b));
  assert.equal(b.pods, undefined);
  for (const p of plan.points) assert.equal(s.tiles[p.y][p.x], "path");
});
test("Visitors choose different viewing spots and observe independently without queues or tickets", () => {
  const { s, b, template } = observationPark();
  const cash = s.cash,
    income = s.income;
  for (let i = 0; i < 8; i++) {
    const g = {
      ...structuredClone(template),
      id: s.nextId++,
      target: b.id,
      state: "walk",
      timer: 0,
      route: [],
      wallet: 40,
      x: 5,
      y: 12,
    };
    const p = A.viewingDestination(s, b, g);
    g.route = [p];
    s.guests.push(g);
  }
  assert(new Set(s.guests.map((g) => JSON.stringify(g.route[0]))).size >= 5);
  for (const g of s.guests) {
    Object.assign(g, g.route[0]);
    g.route = [];
  }
  S.tick(s, 0.1);
  assert(s.guests.every((g) => g.state === "observe"));
  assert(new Set(s.guests.map((g) => g.timer.toFixed(2))).size > 1);
  assert.equal(b.queue.length + b.riders.length, 0);
  assert.equal(S.queueCapacity(s, b), 0);
  assert.equal(S.expectedWait(b), 0);
  assert.equal(s.cash, cash);
  assert.equal(s.income, income);
  assert(s.guests.every((g) => g.wallet === 40));
  assert.equal(b.served, 8);
  assert.equal(b.revenue, 0);
  const first = s.guests[0],
    other = s.guests[1];
  first.timer = 0.05;
  other.timer = 10;
  S.tick(s, 0.1);
  assert.equal(first.state, "walk");
  assert.equal(other.state, "observe");
  assert(first.visited.includes(b.id));
  assert.equal(first.rides, template.rides + 1);
  assert(S.validSave(JSON.parse(JSON.stringify(s))));
});
test("Visitors with no remaining pocket money can still choose a free habitat", () => {
  const { s, b, template } = observationPark();
  s.open = true;
  const g = {
    ...structuredClone(template),
    id: s.nextId++,
    target: null,
    state: "walk",
    route: [],
    timer: 0,
    wallet: 0,
    x: 5,
    y: 12,
    hunger: 0,
    thirst: 0,
    bladder: 0,
    rides: 0,
  };
  s.guests = [g];
  S.tick(s, 0.1);
  assert.equal(g.target, b.id);
  assert.equal(g.state, "walk");
});
test("Removing a viewing path or closing the habitat releases its observers outside the fence", () => {
  for (const close of [false, true]) {
    const { s, b, template } = observationPark();
    const g = {
      ...structuredClone(template),
      id: s.nextId++,
      target: b.id,
      state: "observe",
      route: [],
      timer: 12,
      x: 5,
      y: 10,
    };
    s.guests = [g];
    if (close) b.open = false;
    else s.tiles[10][5] = "grass";
    S.tick(s, 0.1);
    assert.equal(g.state, "walk");
    assert.equal(g.target, null);
    assert.equal(s.tiles[Math.round(g.y)][Math.round(g.x)], "path");
    assert(!S.footprint(b).some((p) => p.x === g.x && p.y === g.y));
    assert(S.validSave(s));
  }
});
test("Keepers and emergency care use a normal viewing path on any side", () => {
  const { s, b } = observationPark();
  b.habitat.food = 20;
  b.habitat.water = 20;
  assert.equal(Z.careHabitat(s, b), null);
  assert.equal(b.habitat.food, 100);
  b.habitat.food = 20;
  for (const p of A.habitatViewingSpots(s, b)) s.tiles[p.y][p.x] = "queue";
  assert(Z.careHabitat(s, b));
  assert.equal(b.habitat.food, 20);
});
test("New zoo campaign starts with ordinary viewing promenades and no habitat pods", () => {
  const s = S.newPark("scenario", "zoo");
  for (const b of s.buildings.filter((b) => Z.isHabitat(b.kind))) {
    assert.equal(b.pods, undefined);
    assert.equal(b.price, 0);
    assert(A.habitatViewingSpots(s, b).length >= Z.SPECIES[b.kind].size);
  }
  assert(s.tiles.flat().every((t) => t !== "queue" && t !== "exit"));
  assert(S.validSave(s));
});
console.log(`${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exitCode = results.every((r) => r.pass) ? 0 : 1;

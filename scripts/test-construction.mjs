import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
function source(name) {
  return ts.transpileModule(
    fs.readFileSync(new URL(`../game/${name}.ts`, import.meta.url), "utf8"),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
  ).outputText;
}
const url = (code) => "data:text/javascript;base64," + Buffer.from(code).toString("base64");
const simulationURL = url(source("simulation")),
  M = await import(simulationURL);
const C = await import(
  url(source("construction").replace(/from ['"]\.\/simulation['"]/g, `from '${simulationURL}'`))
);
const A = await import(url(source("motion")));
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log("PASS", name);
  } catch (e) {
    failed++;
    console.error("FAIL", name, e.stack);
  }
}
function empty() {
  const s = M.newPark("sandbox");
  s.buildings = [];
  s.guests = [];
  s.tiles = Array.from({ length: 30 }, () => Array(30).fill("grass"));
  s.tiles[29][15] = "path";
  s.open = false;
  return s;
}
function add(s, kind, x, y, track) {
  const r = M.build(s, kind, x, y, track);
  assert(!r.error, r.error);
  return s.buildings.find((b) => b.id === r.id);
}
function road(s, x, y) {
  for (let yy = y; yy < 30; yy++) s.tiles[yy][x] = "path";
  for (let xx = Math.min(x, 15); xx <= Math.max(x, 15); xx++) s.tiles[29][xx] = "path";
}
test("Blueprint preview and price include one deduplicated tree and rotate in all four directions", () => {
  for (let r = 0; r < 4; r++) {
    const s = empty(),
      p = { x: 12, y: 12 },
      t = C.blueprint(p, r),
      tree = add(s, "tree", 12, 12),
      before = s.cash;
    const plan = C.planPlacement(s, "coaster", p, t);
    assert.equal(plan.error, null);
    assert.equal(plan.cost, 4715);
    assert.deepEqual(plan.clearIds, [tree.id]);
    const result = C.place(s, "coaster", p, t);
    assert(!result.error);
    assert.equal(before - s.cash, plan.cost);
    assert(!s.buildings.some((b) => b.id === tree.id));
    assert.deepEqual(t[0], t.at(-1));
  }
});
test("Rejected building is atomic: missing euro, building obstacle, disabled clearing and park edge", () => {
  for (const scenario of ["budget", "building", "clearing", "bounds"]) {
    const s = empty(),
      p = { x: 12, y: 12 },
      t = C.blueprint(p);
    add(s, scenario === "building" ? "burger" : "tree", 12, 12);
    if (scenario === "budget") s.cash = 4714;
    const before = JSON.stringify(s);
    const result = C.place(
      s,
      "coaster",
      scenario === "bounds" ? { x: 29, y: 29 } : p,
      scenario === "bounds" ? C.blueprint({ x: 29, y: 29 }) : t,
      scenario !== "clearing",
    );
    assert(result.error);
    assert.equal(JSON.stringify(s), before);
  }
});
test("One path stroke undoes only its own transactions while live ticks and a day rollover survive", () => {
  const s = empty();
  s.time = 89.8;
  const records = [],
    before = s.cash;
  records.push(C.recordEdit(s, "Wegebau", () => C.place(s, "path", { x: 1, y: 1 })));
  M.tick(s, 0.25);
  const time = s.time,
    profit = s.lastProfit,
    afterTick = s.cash;
  records.push(C.recordEdit(s, "Wegebau", () => C.place(s, "path", { x: 2, y: 1 })));
  const nextId = s.nextId;
  C.undoEdits(s, records);
  assert.equal(s.time, time);
  assert.equal(s.lastProfit, profit);
  assert.equal(s.nextId, nextId);
  assert.equal(s.cash, afterTick + 12);
  assert(s.cash <= before);
  assert.equal(s.tiles[1][1], "grass");
  assert.equal(s.tiles[1][2], "grass");
  assert.equal(s.dayExpenses, -12);
});
test("Undo construction restores cleared scenery without removing live guests or other buildings", () => {
  const s = empty(),
    tree = add(s, "tree", 4, 4),
    other = add(s, "burger", 8, 8),
    cash = s.cash;
  const record = C.recordEdit(s, "Bau", () => C.place(s, "carousel", { x: 4, y: 4 }));
  const nextId = s.nextId;
  s.guests.push({ ...M.newPark().guests[0], id: s.nextId++, target: null });
  C.undoEdits(s, [record]);
  assert.equal(s.cash, cash);
  assert.equal(s.guests.length, 1);
  assert(s.nextId > nextId);
  assert.equal(
    s.buildings.find((b) => b.id === other.id),
    other,
  );
  assert(s.buildings.some((b) => b.id === tree.id));
});
test("Undo demolition restores safe empty ride queues and preserves the world clock", () => {
  const s = M.newPark(),
    b = s.buildings.find((b) => b.kind === "carousel");
  const record = C.recordEdit(s, "Abriss", () => C.place(s, "erase", { x: b.x, y: b.y }));
  M.tick(s, 0.25);
  const time = s.time;
  C.undoEdits(s, [record]);
  const restored = s.buildings.find((o) => o.id === b.id);
  assert.deepEqual(restored.queue, []);
  assert.deepEqual(restored.riders, []);
  assert.equal(s.time, time);
  assert(M.validSave(s));
});
test("Automatic connection costs match, preserves roads and opens an attraction", () => {
  const s = empty(),
    b = add(s, "carousel", 12, 20);
  road(s, 15, 20);
  const plan = C.planConnection(s, b),
    cash = s.cash;
  assert(!plan.error);
  assert(plan.points.length > 0);
  assert.equal(C.connectBuilding(s, b), null);
  assert.equal(cash - s.cash, plan.cost);
  assert(M.access(s, b));
  assert(b.open);
  assert.equal(s.tiles[20][15], "path");
});
test("Shop connection preserves an existing ride queue and rejects a blocked entrance", () => {
  const s = empty(),
    ride = add(s, "carousel", 8, 14);
  s.tiles[16][8] = "queue";
  s.tiles[17][8] = "queue";
  road(s, 8, 18);
  const shop = add(s, "burger", 6, 16);
  const plan = C.planConnection(s, shop);
  assert(!plan.error);
  assert.equal(C.connectBuilding(s, shop), null);
  assert(M.access(s, shop));
  assert(M.access(s, ride));
  assert.equal(s.tiles[16][8], "queue");
  assert.equal(s.tiles[17][8], "queue");
  const blocked = add(s, "burger", 3, 3);
  for (const [x, y] of [
    [3, 2],
    [2, 3],
    [4, 3],
    [3, 4],
  ])
    s.tiles[y][x] = "water";
  const before = JSON.stringify(s);
  assert(C.connectBuilding(s, blocked));
  assert.equal(JSON.stringify(s), before);
});
test("Connection permits exactly twelve new cells and rejects insufficient funds atomically", () => {
  const s = empty(),
    b = add(s, "burger", 15, 7);
  road(s, 15, 20);
  const p = C.planConnection(s, b);
  assert.equal(p.error, null);
  assert.equal(p.points.length, 12);
  s.cash = p.cost - 1;
  const before = JSON.stringify(s);
  assert(C.connectBuilding(s, b));
  assert.equal(JSON.stringify(s), before);
});
test("Coaster connector starts at station; auto-opening recovers after a temporary disconnection", () => {
  const s = empty(),
    t = C.blueprint({ x: 8, y: 15 }),
    b = add(s, "coaster", 8, 15, t);
  road(s, 6, 15);
  assert.equal(C.connectBuilding(s, b), null);
  assert(b.autoOpen);
  const entry = M.access(s, b);
  assert(Math.abs(entry.x - b.x) + Math.abs(entry.y - b.y) === 1);
  s.tiles[entry.y][entry.x] = "grass";
  for (let i = 0; i < 40; i++) M.tick(s, 0.25);
  assert(b.tested);
  assert(!b.open);
  s.tiles[entry.y][entry.x] = "queue";
  M.tick(s, 0.25);
  assert(b.open);
  assert(!b.autoOpen);
});
test("Motor integration is frame-rate independent, freezes at pause and never snaps on stop", () => {
  const initial = { angle: 1, velocity: 0.5 },
    whole = A.advanceSpin(initial, 1, 2);
  let parts = initial;
  for (let i = 0; i < 120; i++) parts = A.advanceSpin(parts, 1, 2 / 120);
  assert(Math.abs(whole.angle - parts.angle) < 1e-10);
  assert(Math.abs(whole.velocity - parts.velocity) < 1e-10);
  assert.deepEqual(A.advanceSpin(initial, 1, 0), initial);
  const stop = A.advanceSpin(initial, 0, 0.1);
  assert(stop.angle > initial.angle);
  assert(stop.velocity > 0 && stop.velocity < initial.velocity);
});
test("Coaster travel accelerates, brakes, slows uphill and preserves car spacing", () => {
  assert.equal(A.tripProgress(0), 0);
  assert.equal(A.tripProgress(1), 1);
  let last = -1;
  for (let i = 0; i <= 100; i++) {
    const p = A.tripProgress(i / 100);
    assert(p >= last);
    last = p;
  }
  assert(A.tripProgress(0.01) < 0.001);
  assert(1 - A.tripProgress(0.99) < 0.001);
  const r = A.prepareRoute([
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 1 },
    { x: 2, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ]);
  const crest = r.points.findIndex((p) => p.x === 1),
    bottom = r.points.findIndex((p) => p.x === 2);
  assert(r.cost[crest] > r.cost[bottom] - r.cost[crest]);
  const speeds = r.distance
    .slice(1)
    .map((d, i) => (d - r.distance[i]) / (r.cost[i + 1] - r.cost[i]));
  for (let i = 1; i < speeds.length; i++)
    assert(
      Math.max(speeds[i] / speeds[i - 1], speeds[i - 1] / speeds[i]) < 1.6,
      "Speed must blend over track crests",
    );
  assert.equal(A.trainDistance(r, 0), 0);
  assert.equal(A.trainDistance(r, 1), r.length);
  for (let i = 0; i <= 100; i++) {
    const p = A.routePosition(r, A.trainDistance(r, i / 100) - 0.55);
    assert(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
  }
  const p = A.routePosition(
    A.prepareRoute([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]),
    0,
  );
  assert(Number.isFinite(p.x));
});
test("Closing a running train preserves position and decelerates; pause freezes it", () => {
  let state = { angle: 7, velocity: 2, target: 7.24, time: 10 };
  assert.deepEqual(A.advanceTrain(state, 0, false, 10, 30), state);
  const next = A.advanceTrain(state, 0, false, 10.1, 30);
  assert(next.angle > 7 && next.angle < 7.3);
  assert(next.velocity > 0 && next.velocity < 2);
  state = next;
  for (let i = 1; i <= 100; i++) state = A.advanceTrain(state, 0, false, 10.1 + i * 0.1, 30);
  assert(Math.abs(state.angle - 7.24) < 1e-8);
  assert(state.velocity < 0.001);
  const resumed = A.advanceTrain(state, 0, true, state.time + 0.02, 30);
  assert(resumed.angle - state.angle < 0.2);
});
if (failed) process.exit(1);

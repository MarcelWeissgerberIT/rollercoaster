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
test("Connection supports twelve new cells and rejects insufficient funds atomically", () => {
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
test("Screenshot regression: paths directly beside a station work without converting public paths", () => {
  const s = empty(),
    b = add(s, "coaster", 12, 12, C.blueprint({ x: 12, y: 12 }));
  road(s, 11, 11);
  s.tiles[11][12] = "path";
  const tiles = JSON.stringify(s.tiles),
    cash = s.cash;
  assert(M.access(s, b));
  assert.equal(M.queueCapacity(s, b), 4);
  assert.equal(C.planConnection(s, b).cost, 0);
  assert.equal(C.connectBuilding(s, b), null);
  assert(b.autoOpen);
  assert.equal(s.cash, cash);
  assert.equal(JSON.stringify(s.tiles), tiles);
  for (let i = 0; i < 40; i++) M.tick(s, 0.25);
  assert(b.tested && b.open);
  assert(M.validSave(s));
});
test("Direct boarding still requires the park entrance; a dedicated queue takes priority", () => {
  const s = empty(),
    b = add(s, "coaster", 12, 12, C.blueprint({ x: 12, y: 12 }));
  s.tiles[12][11] = "path";
  assert(!M.access(s, b));
  assert.equal(M.queueCapacity(s, b), 0);
  road(s, 11, 11);
  assert(M.access(s, b));
  assert.equal(M.queueCapacity(s, b), 4);
  s.tiles[11][12] = "queue";
  assert.deepEqual(M.access(s, b), { x: 12, y: 11 });
  assert.equal(M.queueCapacity(s, b), 4);
  s.tiles[11][13] = "queue";
  assert.equal(M.queueCapacity(s, b), 8);
});
test("Every eligible station shift preserves the entire circuit, hills, track stats and identity", () => {
  const s = empty(),
    b = add(s, "coaster", 10, 10, C.blueprint({ x: 10, y: 10 })),
    initial = JSON.stringify(b.track),
    stats = M.trackStats(b.track),
    id = b.id,
    cash = s.cash;
  const points = C.stationPositions(b);
  assert(points.length >= 4);
  const edges = (t) =>
    t
      .slice(1)
      .map((p, i) => JSON.stringify([t[i], p]))
      .sort();
  const beforeEdges = edges(b.track);
  for (const p of points) {
    b.track = JSON.parse(initial);
    b.x = 10;
    b.y = 10;
    const plan = C.planStationMove(s, b, p);
    assert.equal(plan.error, null);
    assert.equal(C.adjustBuilding(s, b, "station", p), null);
    assert.equal(b.id, id);
    assert.equal(s.cash, cash);
    assert.deepEqual(b.track[0], b.track.at(-1));
    assert.equal(b.x, p.x);
    assert.equal(b.y, p.y);
    assert.deepEqual(edges(b.track), beforeEdges);
    assert.deepEqual(M.trackStats(b.track), stats);
    assert(M.validSave(s));
  }
});
test("Station rejects hilltops, slopes, corners, unrelated land and another ride without mutation", () => {
  for (const p of [
    { x: 12, y: 10 },
    { x: 11, y: 10 },
    { x: 15, y: 13 },
    { x: 3, y: 3 },
  ]) {
    const s = empty(),
      b = add(s, "coaster", 10, 10, C.blueprint({ x: 10, y: 10 })),
      before = JSON.stringify(s);
    assert(C.adjustBuilding(s, b, "station", p));
    assert.equal(JSON.stringify(s), before);
  }
});
test("Station move and undo release passengers while retaining new revenue, time, prices and IDs", () => {
  const s = M.newPark(),
    b = s.buildings.find((b) => b.kind === "coaster"),
    before = structuredClone({ x: b.x, y: b.y, track: b.track }),
    p = C.stationPositions(b)[0],
    g = s.guests[0];
  g.target = b.id;
  g.state = "ride";
  b.riders = [g.id];
  b.queue = [];
  b.served = 14;
  b.revenue = 168;
  const record = C.recordEdit(s, "Station", () =>
    assert.equal(C.adjustBuilding(s, b, "station", p), null),
  );
  assert(record && record.geometry.length === 1);
  assert.equal(b.open, false);
  assert.equal(g.target, null);
  assert.equal(g.state, "walk");
  M.tick(s, 0.25);
  const time = s.time,
    nextId = s.nextId;
  b.revenue += 12;
  b.served += 1;
  b.price = 16;
  C.undoEdits(s, [record]);
  assert.equal(s.time, time);
  assert.equal(s.nextId, nextId);
  assert.equal(b.revenue, 180);
  assert.equal(b.served, 15);
  assert.equal(b.price, 16);
  assert.deepEqual({ x: b.x, y: b.y, track: b.track }, before);
  assert.deepEqual(b.riders, []);
  assert.deepEqual(b.queue, []);
  assert(M.validSave(s));
});
test("Rigid relocation rotates around the station, tolerates overlap with itself and preserves costs", () => {
  for (let r = 0; r < 4; r++) {
    const s = empty(),
      b = add(s, "coaster", 12, 12, C.blueprint({ x: 12, y: 12 })),
      oldTrack = b.track,
      stats = M.trackStats(b.track),
      cash = s.cash,
      id = b.id;
    const plan = C.planRelocation(s, b, { x: 13, y: 13 }, r);
    assert.equal(plan.error, null);
    assert.equal(plan.cost, 0);
    assert.equal(C.adjustBuilding(s, b, "move", { x: 13, y: 13 }, r), null);
    assert.notEqual(b.track, oldTrack);
    assert.equal(b.id, id);
    assert.equal(s.cash, cash);
    assert.deepEqual(M.trackStats(b.track), stats);
    assert(M.validSave(s));
  }
});
test("Move failures leave the original ride and trees intact; only actual clearing is charged", () => {
  for (const mode of ["budget", "building", "water", "edge", "clearing"]) {
    const s = empty(),
      b = add(s, "coaster", 4, 4, C.blueprint({ x: 4, y: 4 })),
      p = mode === "edge" ? { x: 29, y: 29 } : { x: 16, y: 16 };
    if (mode === "building") add(s, "burger", 16, 16);
    else if (mode === "water") s.tiles[16][16] = "water";
    else if (mode !== "edge") add(s, "tree", 16, 16);
    if (mode === "budget") s.cash = 9;
    const before = JSON.stringify(s);
    assert(C.adjustBuilding(s, b, "move", p, 0, mode !== "clearing"));
    assert.equal(JSON.stringify(s), before);
  }
  const s = empty(),
    b = add(s, "coaster", 4, 4, C.blueprint({ x: 4, y: 4 })),
    tree = add(s, "tree", 16, 16),
    cash = s.cash,
    track = structuredClone(b.track);
  const plan = C.planRelocation(s, b, { x: 16, y: 16 });
  assert.equal(plan.cost, 10);
  const record = C.recordEdit(s, "Umzug", () =>
    assert.equal(C.adjustBuilding(s, b, "move", { x: 16, y: 16 }), null),
  );
  assert.equal(s.cash, cash - 10);
  assert(!s.buildings.some((i) => i.id === tree.id));
  C.undoEdits(s, [record]);
  assert.equal(s.cash, cash);
  assert.deepEqual(b.track, track);
  assert(s.buildings.some((i) => i.id === tree.id));
  assert(M.validSave(s));
});
test("Unchanged preview is a no-op and free relocation works with a negative operating balance", () => {
  const s = empty(),
    b = add(s, "coaster", 10, 10, C.blueprint({ x: 10, y: 10 }));
  b.open = true;
  const before = JSON.stringify(s);
  assert.equal(
    C.recordEdit(s, "Nothing", () => C.adjustBuilding(s, b, "move", { x: 10, y: 10 })),
    null,
  );
  assert.equal(JSON.stringify(s), before);
  s.cash = -10;
  assert.equal(C.adjustBuilding(s, b, "move", { x: 11, y: 11 }), null);
  assert.equal(s.cash, -10);
});
test("A suggested station faces an accessible connection; longer useful routes are allowed", () => {
  const s = empty(),
    b = add(s, "coaster", 10, 10, C.blueprint({ x: 10, y: 10 }));
  road(s, 13, 14);
  const p = C.suggestStation(s, b);
  assert(p);
  assert.equal(C.planStationMove(s, b, p).connection.cost, 0);
  const far = empty(),
    shop = add(far, "burger", 15, 3);
  road(far, 15, 20);
  const plan = C.planConnection(far, shop);
  assert.equal(plan.error, null);
  assert.equal(plan.points.length, 16);
});

test("Connector repairs one missing field in an existing unconnected path without converting that path", () => {
  const s = empty(),
    b = add(s, "coaster", 12, 12, C.blueprint({ x: 12, y: 12 }));
  road(s, 11, 11);
  s.tiles[21][11] = "grass";
  s.tiles[11][12] = "path";
  assert(!M.access(s, b));
  const plan = C.planConnection(s, b);
  assert.equal(plan.error, null);
  assert.deepEqual(plan.points, [{ x: 11, y: 21 }]);
  assert.equal(plan.cost, 18);
  assert.equal(C.connectBuilding(s, b), null);
  assert(M.access(s, b));
  for (let y = 11; y <= 20; y++) assert.equal(s.tiles[y][11], "path");
});
test("Undo of a moved test ride allows a fresh automatic test instead of leaving a pending flag", () => {
  const s = empty(),
    b = add(s, "coaster", 12, 12, C.blueprint({ x: 12, y: 12 }));
  road(s, 11, 12);
  C.connectBuilding(s, b);
  M.tick(s, 2);
  assert(b.testing && b.autoOpen);
  const record = C.recordEdit(s, "Move", () => C.adjustBuilding(s, b, "move", { x: 19, y: 19 }));
  C.undoEdits(s, [record]);
  assert(!b.autoOpen);
  assert(!b.testing);
  assert.equal(C.connectBuilding(s, b), null);
  assert(b.testing);
  for (let i = 0; i < 40; i++) M.tick(s, 0.25);
  assert(b.tested && b.open);
  assert(M.validSave(s));
});
if (failed) process.exit(1);

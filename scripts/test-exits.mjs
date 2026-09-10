import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  C = await import(moduleURL("game/construction.ts")),
  G = await import(moduleURL("game/grid.ts")),
  T = await import(moduleURL("game/transit.ts"));
const W = await import(moduleURL("game/scene-world.ts"));
const clone = (x) => JSON.parse(JSON.stringify(x)),
  results = [];
function test(name, fn) {
  try {
    results.push({ name, pass: true, evidence: fn() });
  } catch (e) {
    results.push({ name, pass: false, error: e.message });
  }
}
// Route tests need a completed batch ride. The wheel now unloads at individual
// cabin stops and is covered separately by its operating-controller tests.
function fixture(kind = "carousel") {
  const s = S.newPark("sandbox"),
    template = clone(s.guests[0]);
  s.buildings = [];
  s.guests = [];
  s.transitLines = [];
  s.tiles = s.tiles.map((r) => r.map(() => "grass"));
  s.open = false;
  const n = S.CATALOG[kind].size,
    cy = 10 + Math.floor(n / 2),
    entry = { x: 9, y: cy },
    out = { x: 10 + n, y: cy },
    column = 11 + n;
  const r = S.build(s, kind, 10, 10);
  assert(!r.error, r.error);
  const b = s.buildings.find((b) => b.id === r.id);
  b.open = b.tested = true;
  for (let y = cy; y < 20; y++) s.tiles[y][9] = S.isRide(kind) ? "queue" : "path";
  for (let x = 9; x <= 15; x++) s.tiles[20][x] = "path";
  for (let y = 20; y < 30; y++) s.tiles[y][15] = "path";
  s.tiles[out.y][out.x] = "exit";
  for (let y = cy; y < 20; y++) s.tiles[y][column] = "exit";
  const g = {
    ...template,
    id: s.nextId++,
    x: entry.x,
    y: entry.y,
    state: "ride",
    target: b.id,
    route: [],
    timer: 0,
    hunger: 80,
    wallet: 50,
    rides: 0,
    transit: undefined,
    servicePrice: kind === "burger" ? b.price : undefined,
  };
  b.riders = [g.id];
  b.queue = [];
  b.cycle = 0.01;
  s.guests = [g];
  assert(S.access(s, b));
  assert(S.exitPath(s, b).length > 2);
  assert(S.validSave(clone(s)));
  return { s, b, g, entry, out, column };
}
function step(s, g, dt = 0.1, maxJump = 0.14) {
  const before = { x: g.x, y: g.y };
  S.tick(s, dt);
  const jump = Math.hypot(g.x - before.x, g.y - before.y);
  assert(
    jump <= maxJump + 1e-7,
    `Jump ${jump.toFixed(3)} tiles from ${before.x},${before.y} to ${g.x},${g.y}`,
  );
  return jump;
}
function complete(s, g) {
  S.tick(s, 0.1);
  assert.equal(g.state, "walk");
  assert.equal(g.target, null);
}
test("Ride completion exits on red and charges/increments exactly once", () => {
  const { s, b, g, out } = fixture(),
    cash = s.cash;
  complete(s, g);
  assert.deepEqual([g.x, g.y], [out.x, out.y]);
  assert.equal(g.rides, 1);
  assert.equal(s.cash, cash);
  assert(g.route.some((p) => s.tiles[p.y][p.x] === "exit"));
  S.tick(s, 0.2);
  assert.equal(g.rides, 1);
  assert.equal(s.cash, cash);
});
test("Shop success bills locked price once and uses red exit", () => {
  const { s, b, g, out } = fixture("burger"),
    cash = s.cash,
    price = g.servicePrice;
  complete(s, g);
  assert.deepEqual([g.x, g.y], [out.x, out.y]);
  assert(g.hunger < 0.1);
  assert.equal(g.wallet, 50 - price);
  assert.equal(b.served, 1);
  assert.equal(s.cash, cash + price - 3);
  S.tick(s, 0.2);
  assert.equal(b.served, 1);
  assert.equal(g.wallet, 50 - price);
});
test("Closed ride releases rider down red but waiting guest remains at blue entrance", () => {
  const { s, b, g, out, entry } = fixture(),
    waiting = { ...clone(g), id: s.nextId++, state: "queue", route: [], timer: 0 };
  s.guests.push(waiting);
  b.queue = [waiting.id];
  b.open = false;
  S.tick(s, 0.1);
  assert(Math.hypot(g.x - out.x, g.y - out.y) < 0.14);
  assert.deepEqual([waiting.x, waiting.y], [entry.x, entry.y]);
  assert.equal(b.riders.length, 0);
  assert.equal(b.queue.length, 0);
  assert.equal(g.rides, 0);
});
test("Aborted shop service does not bill or feed; exit still usable", () => {
  const { s, b, g, out } = fixture("burger"),
    cash = s.cash;
  C.releaseBuildingGuests(s, b);
  assert.deepEqual([g.x, g.y], [out.x, out.y]);
  assert.equal(s.cash, cash);
  assert.equal(g.wallet, 50);
  assert.equal(b.served, 0);
  assert.equal(g.hunger, 80);
  assert(g.route.length);
});
test("Continuous red walk through corners reaches public path without teleport", () => {
  const { s, g, column } = fixture();
  complete(s, g);
  let steps = 0;
  while ((Math.abs(g.x - column) > 1e-6 || g.y < 20) && steps++ < 250) step(s, g);
  assert(steps < 250);
  return { steps, position: [g.x, g.y] };
});
test("Saving on red preserves movement and route after load", () => {
  const { s, g } = fixture();
  complete(s, g);
  for (let i = 0; i < 35; i++) step(s, g);
  assert.equal(s.tiles[Math.round(g.y)][Math.round(g.x)], "exit");
  const loaded = clone(s),
    lg = loaded.guests[0];
  assert(S.validSave(loaded));
  S.migratePark(loaded);
  for (let i = 0; i < 25; i++) {
    step(s, g);
    step(loaded, lg);
  }
  assert.deepEqual([lg.x, lg.y, lg.route, lg.state], [g.x, g.y, g.route, g.state]);
});
test("Pause on exit walkway changes neither rider nor clock", () => {
  const { s, g } = fixture();
  complete(s, g);
  s.speed = 0;
  const before = clone(s);
  S.tick(s, 30);
  assert.deepEqual(clone(s), before);
});
test("Incomplete exit uses existing blue entrance", () => {
  const { s, b, g, entry, column } = fixture();
  s.tiles[16][column] = "grass";
  assert.equal(S.exitPath(s, b).length, 0);
  complete(s, g);
  assert.deepEqual([g.x, g.y], [entry.x, entry.y]);
  assert.equal(g.route.length, 0);
});
test("All-red perimeter cannot be used as entrance or auto-connection", () => {
  const { s, b } = fixture();
  for (const p of S.accessNeighbors(b)) s.tiles[p.y][p.x] = "exit";
  assert.equal(S.access(s, b), undefined);
  assert.equal(S.queueCapacity(s, b), 0);
  assert(C.planConnection(s, b).error);
  assert(C.connectBuilding(s, b));
  assert(!S.connected(s).has(S.key(S.accessNeighbors(b)[0])));
});
test("Public routes do not enter a red shortcut; outgoing route is directed", () => {
  const { s, b, out, column } = fixture(),
    end = { x: column, y: 20 };
  assert.deepEqual(S.findRoute(s, end, out), []);
  const route = S.findRoute(s, out, end);
  assert(route.length > 0);
  assert(route.every((p) => s.tiles[p.y][p.x] === "exit" || s.tiles[p.y][p.x] === "path"));
  assert.equal(S.access(s, b).x, 9);
});
test("Deleting red ahead recovers locally; undo restores route without losing guest", () => {
  const { s, g, column } = fixture();
  complete(s, g);
  while (g.y < 12.8) step(s, g);
  const rec = C.recordEdit(s, "erase exit", () => S.remove(s, column, 14));
  const old = { x: g.x, y: g.y };
  S.tick(s, 0.1);
  assert(Math.hypot(g.x - old.x, g.y - old.y) <= 3.1);
  assert(Math.hypot(g.x - S.ENTRANCE.x, g.y - S.ENTRANCE.y) > 5);
  C.undoEdits(s, [rec]);
  assert.equal(s.tiles[14][column], "exit");
  for (let i = 0; i < 30; i++) step(s, g);
  assert(S.validSave(clone(s)));
  assert(s.guests.includes(g));
});
test("Painting and undo of red tile is atomic and restores cash", () => {
  const { s } = fixture(),
    p = { x: 18, y: 22 },
    cash = s.cash;
  const plan = C.planPlacement(s, "exit", p);
  assert.equal(plan.cost, 18);
  const rec = C.recordEdit(s, "exit", () => assert(!C.place(s, "exit", p).error));
  assert.equal(s.cash, cash - 18);
  assert.equal(s.tiles[p.y][p.x], "exit");
  C.undoEdits(s, [rec]);
  assert.equal(s.cash, cash);
  assert.equal(s.tiles[p.y][p.x], "grass");
  assert(S.validSave(clone(s)));
});
test("No exit upgrade required for unchanged legacy park", () => {
  const s = S.newPark();
  assert(S.validSave(s));
  assert.equal(S.exitNetwork(s).size, 0);
  for (const b of s.buildings.filter((b) => !S.decorative(b.kind))) assert(S.access(s, b));
});
test("Demolition releases active rider through existing exit", () => {
  const { s, b, g, out } = fixture();
  S.remove(s, b.x, b.y);
  assert.deepEqual([g.x, g.y], [out.x, out.y]);
  assert(g.route.length > 0);
  assert.equal(g.state, "walk");
  assert(S.validSave(clone(s)));
});
test("An empty saved exit route resumes downstream before choosing a target", () => {
  const { s, g } = fixture();
  complete(s, g);
  g.timer = 0;
  g.route = [];
  step(s, g);
  assert(g.route.length);
  assert.equal(g.state, "walk");
});
test("Red pavement creates no extra queue spaces and cannot replace the park entrance", () => {
  const { s, b, column } = fixture(),
    capacity = S.queueCapacity(s, b),
    cash = s.cash;
  s.tiles[12][column + 1] = "exit";
  assert.equal(S.queueCapacity(s, b), capacity);
  assert(C.place(s, "exit", S.ENTRANCE).error);
  assert.equal(s.cash, cash);
  assert.equal(s.tiles[29][15], "path");
});
test("Park train passengers leave through red while vehicles keep using public paths", () => {
  const s = S.newPark("sandbox"),
    g = clone(s.guests[0]);
  s.buildings = [];
  s.guests = [];
  s.transitLines = [];
  s.tiles = s.tiles.map((r) => r.map(() => "grass"));
  s.open = false;
  for (let x = 2; x <= 24; x++) s.tiles[15][x] = "path";
  for (let y = 15; y < 30; y++) s.tiles[y][15] = "path";
  const aId = S.build(s, "train", 2, 14).id,
    bId = S.build(s, "train", 24, 14).id;
  const a = s.buildings.find((b) => b.id === aId),
    b = s.buildings.find((b) => b.id === bId);
  a.open = b.open = true;
  assert.equal(T.createTransitLine(s, a, b), null);
  const l = s.transitLines[0];
  for (let x = 22; x <= 24; x++) s.tiles[13][x] = "exit";
  s.tiles[14][22] = "exit";
  const out = S.exitPath(s, b);
  assert(out.length > 1);
  assert(T.transitValid(s, l));
  Object.assign(g, {
    id: s.nextId++,
    x: 2,
    y: 15,
    state: "ride",
    target: a.id,
    wallet: 50,
    route: [],
    transit: { line: l.id, from: a.id, to: b.id, fare: 3 },
  });
  s.guests = [g];
  l.passengers = [g.id];
  l.wait = 0;
  l.position = l.route.length - 1 - 0.05;
  l.direction = 1;
  T.tickTransit(s, 0.1);
  assert.equal(g.state, "walk");
  assert.equal(g.target, a.id);
  assert.equal(g.wallet, 47);
  assert.equal(l.served, 1);
  assert.deepEqual([g.x, g.y], [out[0].x, out[0].y]);
  assert.deepEqual(g.route, out.slice(1));
  assert(S.validSave(clone(s)));
  T.tickTransit(s, 0.1);
  assert.equal(g.wallet, 47);
  s.tiles[15][12] = "exit";
  assert(!T.transitValid(s, l));
});
test("3D world shows downstream arrows and disposes their instanced resources", () => {
  const { s } = fixture(),
    world = W.createWorld(s),
    arrows = world.scene.getObjectByName("exit-direction-arrows");
  assert(arrows);
  assert.equal(arrows.count, S.exitNetwork(s).size);
  let disposed = 0;
  arrows.geometry.addEventListener("dispose", () => disposed++);
  arrows.material.addEventListener("dispose", () => disposed++);
  world.dispose();
  assert.equal(disposed, 2);
});
for (const r of results)
  console[r.pass ? "log" : "error"](r.pass ? "PASS" : "FAIL", r.name, r.error ?? "");
process.exitCode = results.some((r) => !r.pass) ? 1 : 0;

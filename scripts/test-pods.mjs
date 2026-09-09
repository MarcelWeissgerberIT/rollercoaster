import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts"));
const C = await import(moduleURL("game/construction.ts"));
const T = await import(moduleURL("game/transit.ts"));
const P = await import(moduleURL("game/pods.ts"));
const failures = [];
let passes = 0;
function test(name, fn) {
  try {
    fn();
    passes++;
    console.log("PASS", name);
  } catch (e) {
    failures.push({ name, error: e.message });
    console.log("FAIL", name, e.message);
  }
}
const clone = (x) => structuredClone(x);
function empty() {
  const s = S.newPark("sandbox");
  const template = clone(s.guests[0]);
  s.buildings = [];
  s.guests = [];
  s.transitLines = [];
  s.tiles = s.tiles.map((r) => r.map(() => "grass"));
  s.open = false;
  s.cash = 100000;
  for (let y = 20; y < 30; y++) s.tiles[y][15] = "path";
  for (let x = 3; x <= 26; x++) s.tiles[20][x] = "path";
  return { s, template };
}
function add(s, kind, x, y) {
  const r = S.build(s, kind, x, y);
  assert.equal(r.error, undefined);
  const b = s.buildings.find((b) => b.id === r.id);
  b.open = true;
  b.tested = true;
  return b;
}
function transit() {
  const { s, template } = empty(),
    a = add(s, "train", 5, 19),
    b = add(s, "train", 25, 19);
  a.pods = { entry: { side: 1, offset: 0 }, exit: { side: 3, offset: 0 } };
  b.pods = clone(a.pods);
  assert.equal(T.createTransitLine(s, a, b), null);
  const l = s.transitLines[0];
  const g = {
    ...template,
    id: s.nextId++,
    state: "ride",
    target: null,
    route: [],
    timer: 0,
    x: 5,
    y: 20,
    transit: { line: l.id, from: a.id, to: b.id, fare: 3 },
  };
  s.guests = [g];
  l.passengers = [g.id];
  l.position = 5;
  l.direction = 1;
  l.wait = 0;
  s.tiles[19][6] = "path";
  assert(S.validSave(clone(s)));
  return { s, a, b, l, g };
}
test("Active train survives direct entry pod change with identical vehicle route", () => {
  const { s, a, l, g } = transit(),
    route = JSON.stringify(l.route),
    pos = l.position;
  assert.equal(C.setAccessPod(s, a, "entry", { side: 0, offset: 0 }), null);
  assert.equal(l.position, pos);
  assert.equal(JSON.stringify(l.route), route);
  assert.deepEqual(l.passengers, [g.id]);
  assert.equal(g.state, "ride");
  assert(a.open);
  assert(S.validSave(clone(s)));
});
test("Undo of active train pod change preserves passengers and stop open state", () => {
  const { s, a, l, g } = transit(),
    before = clone(a.pods),
    route = JSON.stringify(l.route);
  const rec = C.recordEdit(s, "entry pod", () =>
    assert.equal(C.setAccessPod(s, a, "entry", { side: 0, offset: 0 }), null),
  );
  assert(rec);
  C.undoEdits(s, [rec]);
  assert.deepEqual(a.pods, before);
  assert.equal(JSON.stringify(l.route), route);
  assert.equal(a.open, true, "undo unexpectedly closes the stop");
  assert.deepEqual(l.passengers, [g.id], "undo unexpectedly unloads train");
  assert.equal(g.state, "ride");
  assert(S.validSave(clone(s)));
});
test("Transport queue access agrees with generic building access and auto-connection", () => {
  const { s, a } = transit();
  s.tiles[19][6] = "queue";
  assert.equal(C.setAccessPod(s, a, "entry", { side: 0, offset: 0 }), null);
  assert.deepEqual(T.stopEntrance(s, a), { x: 6, y: 19 });
  assert.deepEqual(
    S.access(s, a),
    T.stopEntrance(s, a),
    "queue-connected train entrance reported disconnected by access()",
  );
  assert.equal(C.planConnection(s, a).error, null);
});
test("No alternate side used when explicit entry becomes disconnected", () => {
  const { s } = empty(),
    b = add(s, "wheel", 10, 10);
  b.pods = { entry: { side: 1, offset: 0 }, exit: { side: 0, offset: 0 } };
  for (let y = 13; y < 20; y++) s.tiles[y][10] = "queue";
  for (let x = 9; x <= 10; x++) s.tiles[14][x] = "path";
  for (let y = 10; y <= 14; y++) s.tiles[y][9] = "path";
  assert.deepEqual(S.access(s, b), { x: 10, y: 13 });
  s.tiles[13][10] = "grass";
  assert.equal(S.access(s, b), undefined);
});
test("Explicit exit never chooses another red side", () => {
  const { s } = empty(),
    b = add(s, "wheel", 10, 10);
  b.pods = { entry: { side: 1, offset: 0 }, exit: { side: 0, offset: 0 } };
  for (let y = 13; y < 20; y++) s.tiles[y][10] = "queue";
  for (let y = 10; y < 20; y++) s.tiles[y][9] = "exit";
  assert(S.exitNetwork(s).has("9,10"));
  assert.deepEqual(S.exitPath(s, b), []);
});
test("Every quarter-turn matches independent coordinate transform", () => {
  for (const n of [1, 2, 3])
    for (const entry of P.podSlots(n))
      for (const exit of P.podSlots(n)) {
        if (P.samePod(entry, exit)) continue;
        const orig = { entry, exit },
          rot = P.rotatePods(orig, n, 1);
        for (const role of ["entry", "exit"]) {
          const a = P.podPort({ x: 0, y: 0 }, n, orig[role]),
            b = P.podPort({ x: 0, y: 0 }, n, rot[role]);
          assert.deepEqual(b, { x: n - 1 - a.y, y: a.x });
        }
        assert.deepEqual(P.rotatePods(orig, n, 4), orig);
      }
});
test("Relocation and undo deeply restore both pod offsets and building location", () => {
  const { s } = empty(),
    b = add(s, "wheel", 10, 10);
  b.pods = { entry: { side: 2, offset: 2 }, exit: { side: 0, offset: 0 } };
  const old = clone(b.pods),
    plan = C.planRelocation(s, b, { x: 18, y: 10 }, 1);
  assert.equal(plan.error, null);
  const rec = C.recordEdit(s, "move", () =>
    assert.equal(C.adjustBuilding(s, b, "move", { x: 18, y: 10 }, 1), null),
  );
  assert(rec);
  assert.deepEqual(b.pods, P.rotatePods(old, 3, 1));
  C.undoEdits(s, [rec]);
  assert.deepEqual(b.pods, old);
  assert.deepEqual([b.x, b.y], [10, 10]);
  assert(S.validSave(clone(s)));
});
test("Save rejects malformed pod values but preserves disconnected valid pods", () => {
  const { s } = empty(),
    b = add(s, "wheel", 10, 10);
  b.pods = { entry: { side: 2, offset: 2 }, exit: { side: 0, offset: 0 } };
  assert(S.validSave(clone(s)));
  for (const bad of [
    null,
    { entry: null, exit: { side: 0, offset: 0 } },
    { entry: { side: 0, offset: 3 }, exit: { side: 1, offset: 0 } },
    { entry: { side: 4, offset: 0 }, exit: { side: 1, offset: 0 } },
    { entry: { side: 0, offset: 0.5 }, exit: { side: 1, offset: 0 } },
    { entry: { side: 0, offset: 0 }, exit: { side: 0, offset: 0 } },
  ]) {
    const k = clone(s);
    k.buildings[0].pods = bad;
    assert.equal(S.validSave(k), false, JSON.stringify(bad));
  }
});
test("Migration pins existing entry and is stable across repeated ticks", () => {
  const { s } = empty(),
    b = add(s, "wheel", 10, 10);
  for (let y = 13; y < 20; y++) s.tiles[y][10] = "queue";
  const access = S.access(s, b);
  S.migratePark(s);
  const pods = clone(b.pods);
  assert.deepEqual(S.access(s, b), access);
  for (let y = 10; y <= 20; y++) s.tiles[y][9] = "path";
  S.migratePark(s);
  assert.deepEqual(b.pods, pods);
  assert(S.validSave(clone(s)));
});
test("Changing exit while actual riders travel keeps their exact identities", () => {
  const { s, b, l, g } = transit();
  s.tiles[19][26] = "exit";
  assert.equal(C.setAccessPod(s, b, "exit", { side: 0, offset: 0 }), null);
  assert.deepEqual(l.passengers, [g.id]);
  assert.equal(g.state, "ride");
  l.position = l.route.length - 1 - 0.1;
  T.tickTransit(s, 0.1);
  assert.equal(g.state, "walk");
  assert.deepEqual([g.x, g.y], [26, 19]);
  assert(S.validSave(clone(s)));
});

test("Transport pod edit cancels queued and approaching guests, not onboard passengers", () => {
  const { s, a, l, g } = transit();
  const waiting = {
      ...clone(g),
      id: s.nextId++,
      state: "queue",
      target: null,
      x: 5,
      y: 20,
      route: [],
    },
    approach = {
      ...clone(g),
      id: s.nextId++,
      state: "walk",
      target: null,
      x: 6,
      y: 20,
      route: [{ x: 5, y: 20 }],
    };
  s.guests.push(waiting, approach);
  a.queue = [waiting.id];
  assert.equal(C.setAccessPod(s, a, "entry", { side: 0, offset: 0 }), null);
  assert.deepEqual(a.queue, []);
  for (const p of [waiting, approach]) {
    assert.equal(p.state, "walk");
    assert.equal(p.transit, undefined);
    assert.deepEqual(p.route, []);
  }
  assert.deepEqual(l.passengers, [g.id]);
  assert.equal(g.state, "ride");
  assert(S.validSave(clone(s)));
});
test("Auto-connection reaches only the configured entry port", () => {
  const { s } = empty(),
    b = add(s, "wheel", 10, 10);
  b.pods = { entry: { side: 3, offset: 2 }, exit: { side: 0, offset: 0 } };
  for (let y = 13; y < 20; y++) s.tiles[y][10] = "path";
  const port = P.podPort(b, 3, b.pods.entry);
  assert.equal(S.access(s, b), undefined);
  const plan = C.planConnection(s, b);
  assert.equal(plan.error, null);
  assert(plan.points.some((q) => q.x === port.x && q.y === port.y));
  assert.equal(C.connectBuilding(s, b), null);
  assert.deepEqual(S.access(s, b), port);
});
test("Move to map boundary rejects a pod that would fall outside the map", () => {
  const { s } = empty(),
    b = add(s, "wheel", 10, 10);
  b.pods = { entry: { side: 2, offset: 0 }, exit: { side: 0, offset: 0 } };
  const old = clone(b);
  assert(C.planRelocation(s, b, { x: 0, y: 5 }, 0).error);
  assert(C.adjustBuilding(s, b, "move", { x: 0, y: 5 }, 0));
  assert.deepEqual(b, old);
});
test("Changing an active ride pod releases rider at old exit before mutating entry", () => {
  const { s, template } = empty(),
    b = add(s, "wheel", 10, 10);
  b.pods = { entry: { side: 1, offset: 0 }, exit: { side: 2, offset: 1 } };
  for (let y = 11; y < 20; y++) s.tiles[y][9] = "path";
  for (let y = 13; y < 20; y++) s.tiles[y][10] = "queue";
  const g = {
    ...template,
    id: s.nextId++,
    state: "ride",
    target: b.id,
    x: 10,
    y: 13,
    route: [],
    timer: 0,
    transit: undefined,
  };
  s.guests = [g];
  b.riders = [g.id];
  b.cycle = 10;
  const cash = s.cash;
  assert.equal(C.setAccessPod(s, b, "entry", { side: 0, offset: 2 }), null);
  assert.deepEqual([g.x, g.y], [9, 11]);
  assert.equal(g.state, "walk");
  assert.equal(b.open, false);
  assert.deepEqual(b.riders, []);
  assert.equal(s.cash, cash);
  assert(S.validSave(clone(s)));
});

test("Auto-connection can repair a disconnected blue transport entry", () => {
  const { s, a } = transit();
  s.tiles[19][6] = "queue";
  s.tiles[20][6] = "grass";
  assert.equal(C.setAccessPod(s, a, "entry", { side: 0, offset: 0 }), null);
  assert.equal(T.stopEntrance(s, a), undefined);
  const plan = C.planConnection(s, a);
  assert.equal(plan.error, null, "blue entry is an accepted pod tile and should be connectable");
  assert(plan.points.length);
});

console.log(JSON.stringify({ passes, failures }, null, 2));
process.exitCode = failures.length ? 1 : 0;

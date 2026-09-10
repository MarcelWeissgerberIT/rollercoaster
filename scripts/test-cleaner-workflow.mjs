import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const C = await import(moduleURL("game/cleanliness.ts"));
const results = [];
function test(name, run) {
  try {
    results.push({ name, pass: true, evidence: run() });
  } catch (error) {
    results.push({ name, pass: false, error: error.message });
  }
  console.log(JSON.stringify(results.at(-1)));
}
function park(staff = 1) {
  const tiles = Array.from({ length: 30 }, () => Array(30).fill("grass"));
  for (let y = 1; y < 30; y++) tiles[y][15] = "path";
  const s = { tiles, staff, buildings: [], guests: [], speed: 1, time: 0 };
  C.initCleanliness(s);
  return s;
}
const worker = (s) => s.cleanliness.workers[0];
const units = (s) =>
  s.cleanliness.litter.reduce((n, l) => n + l.amount, 0) +
  s.buildings.reduce((n, b) => n + (b.binFill ?? 0), 0) +
  s.cleanliness.workers.reduce((n, w) => n + (w.carried ?? 0), 0) +
  s.guests.reduce((n, g) => n + (g.waste?.length ?? 0), 0) +
  (s.cleanliness.disposed ?? 0);
function step(s, expected) {
  const before = s.cleanliness.workers.map((w) => ({ id: w.id, x: w.x, y: w.y, walked: w.walked }));
  s.time += 0.1;
  C.tickCleanliness(s, 0.1);
  assert(C.validCleanliness(s), "Every intermediate state remains saveable");
  if (expected !== undefined)
    assert.equal(units(s), expected, "Waste conservation at every simulation step");
  for (const w of s.cleanliness.workers) {
    const old = before.find((o) => o.id === w.id);
    assert(
      Math.hypot(w.x - old.x, w.y - old.y) <= 0.1450001,
      "Cleaner teleported instead of walking",
    );
    assert(w.walked >= old.walked);
    assert(
      s.buildings.every((b) => (b.binFill ?? 0) <= C.BIN_CAPACITY),
      "No overflowing bins",
    );
  }
}
function until(s, condition, expected, seconds = 120) {
  for (let i = 0; i < seconds * 10 && !condition(); i++) step(s, expected);
  assert(condition(), `Condition not reached after ${seconds}s: ${JSON.stringify(worker(s))}`);
}
function run(s, seconds, expected) {
  for (let i = 0; i < seconds * 10; i++) step(s, expected);
}
const bin = (s, id = 10, y = 20, fill = 0) => {
  const b = { id, kind: "bin", x: 16, y, binFill: fill };
  s.buildings.push(b);
  return b;
};

test("Litter is visibly swept, carried along a route, then transferred into a reachable bin", () => {
  const s = park(),
    b = bin(s);
  C.dropWaste(s, { x: 15, y: 25 }, "cup", 3);
  until(s, () => worker(s).mode === "sweep", 3);
  assert.equal(worker(s).carried, 0);
  assert.equal(s.cleanliness.litter[0].amount, 3);
  assert.deepEqual(C.cleanerWorkTarget(s, worker(s)), { x: 15, y: 25 });
  assert(C.cleanerWorkProgress(worker(s)) > 0 && C.cleanerWorkProgress(worker(s)) < 1);
  until(s, () => worker(s).carried === 3, 3);
  assert.equal(s.cleanliness.cleaned, 3);
  assert.equal(b.binFill, 0);
  until(s, () => worker(s).mode === "walk" && worker(s).target?.kind === "deposit", 3);
  assert.equal(worker(s).carried, 3);
  assert.deepEqual(C.cleanerWorkTarget(s, worker(s)), { x: 16, y: 20 });
  until(s, () => worker(s).mode === "deposit", 3);
  assert.equal(worker(s).x, 15);
  assert.equal(worker(s).y, 20);
  assert.equal(b.binFill, 0, "Transfer waits until hand movement completes");
  until(s, () => b.binFill === 3, 3);
  assert.equal(worker(s).carried, 0);
  assert.equal(s.cleanliness.binned, 3);
  run(s, 15, 3);
  assert.equal(s.cleanliness.binned, 3);
});
test("Full bins take priority; their bags are carried to staff collection rather than another bin", () => {
  const s = park(),
    b = bin(s, 10, 25, 16),
    other = bin(s, 11, 27);
  C.dropWaste(s, { x: 15, y: 28 }, "wrapper", 2);
  step(s, 18);
  assert.deepEqual(worker(s).target, { kind: "bin", id: 10 });
  until(s, () => worker(s).mode === "empty", 18);
  assert.equal(b.binFill, 16);
  until(s, () => worker(s).carried === 16, 18);
  assert.equal(b.binFill, 0);
  assert.equal(s.cleanliness.emptied, 1);
  assert(worker(s).toCollection);
  until(s, () => worker(s).target?.kind === "collection", 18);
  assert.deepEqual(C.cleanerWorkTarget(s, worker(s)), { x: 15, y: 29 });
  assert.equal(other.binFill, 0);
  until(s, () => s.cleanliness.disposed === 16, 18);
  assert.equal(worker(s).carried, 0);
  run(s, 25, 18);
  assert.equal(s.cleanliness.disposed, 16);
});
test("Large piles, partial bin capacity and multiple workers conserve every unit without double disposal", () => {
  const s = park(2);
  bin(s, 10, 24, 15);
  C.dropWaste(s, { x: 15, y: 27 }, "cup", 47);
  C.dropWaste(s, { x: 15, y: 26 }, "wrapper", 5);
  run(s, 150, 67);
  assert.equal(s.cleanliness.cleaned, 52);
  assert.equal(s.cleanliness.litter.length, 0);
  assert(s.cleanliness.disposed > 0);
  const accounted = units(s);
  run(s, 40, 67);
  assert.equal(units(s), accounted);
  return {
    cleaned: s.cleanliness.cleaned,
    disposed: s.cleanliness.disposed,
    remainingInBins: C.cleanlinessStats(s).binFill,
  };
});
test("A nearer disconnected bin is skipped for an actually reachable bin", () => {
  const s = park(),
    good = bin(s, 10, 18);
  s.tiles[24][12] = "path";
  s.buildings.push({ id: 11, kind: "bin", x: 13, y: 24, binFill: 0 });
  C.dropWaste(s, { x: 15, y: 25 }, "wrapper", 2);
  until(s, () => worker(s).target?.kind === "deposit", 2);
  assert.equal(worker(s).target.id, good.id);
  until(s, () => good.binFill === 2, 2);
});
test("Without reachable bins, staff walk to the explicit entrance collection point", () => {
  const s = park();
  C.dropWaste(s, { x: 15, y: 24 }, "cup", 4);
  until(s, () => worker(s).target?.kind === "collection", 4);
  assert.deepEqual(worker(s).target.point, { x: 15, y: 29 });
  assert(worker(s).route.length > 0);
  until(s, () => s.cleanliness.disposed === 4, 4);
  run(s, 20, 4);
  assert.equal(s.cleanliness.disposed, 4);
});
test("A disconnected staff member uses a reachable pickup edge without crossing missing paths", () => {
  const s = park();
  s.tiles[25][15] = "grass";
  Object.assign(worker(s), { x: 15, y: 20 });
  C.dropWaste(s, { x: 15, y: 19 }, "cup", 2);
  until(s, () => worker(s).target?.kind === "collection", 2);
  assert.deepEqual(worker(s).target.point, { x: 15, y: 24 });
  until(s, () => s.cleanliness.disposed === 2, 2);
  assert(worker(s).y < 25);
});
test("Removing a chosen bin preserves the bag and reroutes to collection", () => {
  const s = park();
  bin(s, 10, 20);
  C.dropWaste(s, { x: 15, y: 25 }, "cup", 6);
  until(s, () => worker(s).target?.kind === "deposit", 6);
  s.buildings = [];
  assert.equal(C.cleanerWorkTarget(s, worker(s)), null);
  step(s, 6);
  assert.equal(worker(s).carried, 6);
  until(s, () => s.cleanliness.disposed === 6, 6);
});
test("A removed next route tile cancels the route and preserves carried waste", () => {
  const s = park();
  bin(s, 10, 18);
  C.dropWaste(s, { x: 15, y: 24 }, "cup", 3);
  until(s, () => worker(s).target?.kind === "deposit", 3);
  const next = worker(s).route[0];
  s.tiles[next.y][next.x] = "grass";
  step(s, 3);
  assert.equal(worker(s).carried, 3);
  until(s, () => s.cleanliness.disposed === 3, 3);
  assert(worker(s).y > next.y);
});
test("Departing employees take their bags to collection exactly once", () => {
  const s = park(2);
  worker(s).carried = 3;
  s.cleanliness.workers[1].carried = 5;
  s.staff = 1;
  C.initCleanliness(s);
  assert.equal(s.cleanliness.disposed, 5);
  assert.equal(units(s), 8);
  C.initCleanliness(s);
  assert.equal(s.cleanliness.disposed, 5);
  s.staff = 0;
  C.initCleanliness(s);
  assert.equal(s.cleanliness.disposed, 8);
  assert.equal(units(s), 8);
  C.initCleanliness(s);
  assert.equal(s.cleanliness.disposed, 8);
});
test("Patrols cover connected paths with distance-driven movement and promptly accept new work", () => {
  const s = park(),
    cells = new Set();
  for (let i = 0; i < 120; i++) {
    step(s, 0);
    cells.add(Math.round(worker(s).y));
  }
  assert(cells.size > 5);
  assert(worker(s).walked > 8);
  assert.equal(worker(s).mode, "patrol");
  assert.equal(C.cleanerWorkTarget(s, worker(s)), null);
  C.dropWaste(s, { x: 15, y: 26 }, "wrapper");
  until(s, () => worker(s).target?.kind === "litter", 1, 1.1);
  assert.equal(C.cleanlinessStats(s).busy, 1);
});
test("Single-cell paths and malformed long route steps never produce off-path movement", () => {
  const s = park();
  s.tiles = s.tiles.map((row) => row.map(() => "grass"));
  s.tiles[29][15] = "path";
  run(s, 10, 0);
  assert.equal(worker(s).mode, "idle");
  assert.equal(worker(s).walked, 0);
  s.tiles[28][15] = "path";
  s.tiles[27][15] = "path";
  worker(s).route = [{ x: 15, y: 27 }];
  worker(s).mode = "walk";
  step(s, 0);
  assert.equal(worker(s).y, 29);
  run(s, 3, 0);
  assert(worker(s).walked > 0);
});
test("Paused work and patrol states are exact no-ops and saved carrying routes resume deterministically", () => {
  const s = park();
  bin(s);
  C.dropWaste(s, { x: 15, y: 25 }, "cup", 2);
  until(s, () => worker(s).target?.kind === "deposit", 2);
  s.speed = 0;
  const paused = structuredClone(s);
  C.tickCleanliness(s, 100);
  assert.deepEqual(s, paused);
  s.speed = 1;
  const copy = JSON.parse(JSON.stringify(s));
  run(s, 25, 2);
  run(copy, 25, 2);
  assert.deepEqual(copy, s);
  s.speed = 0;
  const patrol = structuredClone(s);
  C.tickCleanliness(s, 100);
  assert.deepEqual(s, patrol);
});
test("Canonical bin service approach holds at the container and returns continuously to the saved path anchor", () => {
  const s = park(),
    b = bin(s, 10, 20),
    w = worker(s);
  Object.assign(w, {
    x: 15,
    y: 20,
    mode: "deposit",
    target: { kind: "deposit", id: b.id },
    workTotal: 10,
    workLeft: 10,
    carried: 3,
  });
  const poseAt = (progress) => {
    w.workLeft = (1 - progress) * 10;
    return C.cleanerServicePose(s, w);
  };
  assert.equal(poseAt(0).x, 15);
  assert(Math.abs(poseAt(0.11).x - 15.4) < 1e-8);
  assert(Math.abs(poseAt(0.22).x - 15.8) < 1e-8);
  assert.equal(poseAt(0.5).walking, false);
  assert(Math.abs(poseAt(0.89).x - 15.4) < 1e-8);
  assert.equal(poseAt(0.89).dx, -1);
  assert.equal(poseAt(1).x, 15);
  for (const boundary of [0.22, 0.78]) {
    const a = poseAt(boundary - 1e-8),
      b = poseAt(boundary + 1e-8);
    assert(Math.hypot(a.x - b.x, a.y - b.y) < 1e-6);
    assert(Math.abs(a.distanceWalked - b.distanceWalked) < 1e-6);
  }
  poseAt(0.5);
  const snapshot = structuredClone(s),
    before = C.cleanerServicePose(s, w);
  for (let i = 0; i < 5; i++) assert.deepEqual(C.cleanerServicePose(s, w), before);
  assert.deepEqual(s, snapshot, "Rendering a service pose must be read-only");
  assert.deepEqual({ x: w.x, y: w.y }, { x: 15, y: 20 }, "Route anchor remains walkable");
});
test("Collection approach faces the visible cart offset and pauses at its reachable service edge", () => {
  const s = park(),
    w = worker(s);
  Object.assign(w, {
    mode: "deposit",
    target: { kind: "collection", id: 0, point: { x: 15, y: 29 } },
    workTotal: 2.4,
    workLeft: 1.2,
    carried: 4,
  });
  const pose = C.cleanerServicePose(s, w);
  assert(Math.abs(Math.hypot(15.4 - pose.x, 28.85 - pose.y) - 0.2) < 1e-8);
  assert.equal(pose.walking, false);
  assert(pose.dx > 0 && pose.dy < 0);
  s.speed = 0;
  const snapshot = structuredClone(s);
  C.tickCleanliness(s, 100);
  assert.deepEqual(s, snapshot);
  assert.deepEqual(C.cleanerServicePose(s, w), pose);
});
test("Removing a bin midway through service walks the visible cleaner back and survives paused save/resume", () => {
  const s = park();
  bin(s);
  C.dropWaste(s, { x: 15, y: 25 }, "cup", 4);
  until(s, () => worker(s).mode === "deposit" && C.cleanerWorkProgress(worker(s)) > 0.3, 4);
  const before = C.cleanerServicePose(s, worker(s));
  s.buildings = [];
  assert.deepEqual(
    C.cleanerServicePose(s, worker(s)),
    before,
    "Deleted prop must not snap staff to path center",
  );
  step(s, 4);
  assert(worker(s).returning);
  assert.deepEqual(
    { x: C.cleanerServicePose(s, worker(s)).x, y: C.cleanerServicePose(s, worker(s)).y },
    { x: before.x, y: before.y },
  );
  const first = C.cleanerServicePose(s, worker(s));
  step(s, 4);
  const next = C.cleanerServicePose(s, worker(s));
  assert(Math.hypot(next.x - first.x, next.y - first.y) > 0);
  assert(Math.hypot(next.x - first.x, next.y - first.y) <= 0.1450001);
  s.speed = 0;
  const frozen = structuredClone(s);
  C.tickCleanliness(s, 5);
  assert.deepEqual(s, frozen);
  s.speed = 1;
  const copy = JSON.parse(JSON.stringify(s));
  assert(C.validCleanliness(copy));
  run(s, 30, 4);
  run(copy, 30, 4);
  assert.deepEqual(copy, s);
  assert.equal(s.cleanliness.disposed, 4);
  assert.equal(worker(s).carried, 0);
});
test("Old saves gain empty bags and reject malformed new optional fields", () => {
  const s = park(),
    w = worker(s);
  for (const key of ["carried", "toCollection", "heading", "walked", "workTotal", "patrolStep"])
    delete w[key];
  delete s.cleanliness.disposed;
  assert(C.validCleanliness(s));
  C.initCleanliness(s);
  assert.equal(w.carried, 0);
  assert.equal(s.cleanliness.disposed, 0);
  for (const change of [
    (s) => (worker(s).carried = -1),
    (s) => (worker(s).carried = 0.5),
    (s) => (worker(s).carried = NaN),
    (s) => (worker(s).toCollection = "yes"),
    (s) => (worker(s).heading = Infinity),
    (s) => (worker(s).walked = -1),
    (s) => (worker(s).workTotal = NaN),
    (s) => (worker(s).patrolStep = 0.5),
    (s) => (worker(s).transferred = "yes"),
    (s) => (worker(s).serviceTarget = { x: 15.5, y: 20 }),
    (s) => (worker(s).returning = { from: { x: 15, y: 20 }, left: 1, total: 0, distanceStart: 0 }),
    (s) => (s.cleanliness.disposed = -1),
    (s) => (worker(s).target = { kind: "collection", id: 0 }),
    (s) => (worker(s).target = { kind: "collection", id: 0, point: { x: 15, y: 99 } }),
  ]) {
    const bad = structuredClone(s);
    change(bad);
    assert.equal(C.validCleanliness(bad), false);
  }
});
console.log(`${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exitCode = results.some((r) => !r.pass) ? 1 : 0;

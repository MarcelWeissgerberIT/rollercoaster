import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const C = await import(moduleURL("game/cleanliness.ts")),
  S = await import(moduleURL("game/simulation.ts"));
const results = [];
function test(name, run) {
  try {
    run();
    results.push({ name, pass: true });
    console.log("PASS", name);
  } catch (error) {
    results.push({ name, pass: false });
    console.log("FAIL", name, error.message.slice(0, 1800));
  }
}
const copy = (value) => JSON.parse(JSON.stringify(value));
const left = { x1: 1, y1: 14, x2: 12, y2: 16 },
  right = { x1: 19, y1: 14, x2: 33, y2: 16 };
const inside = (a, p) => p.x >= a.x1 && p.x <= a.x2 && p.y >= a.y1 && p.y <= a.y2;
function park(staff = 2) {
  const tiles = Array.from({ length: 36 }, () => Array(36).fill("grass"));
  for (let x = 1; x <= 33; x++) tiles[15][x] = "path";
  for (let y = 15; y <= 29; y++) tiles[y][15] = "path";
  const s = { tiles, staff, buildings: [], guests: [], speed: 1, time: 0 };
  C.initCleanliness(s);
  for (const w of s.cleanliness.workers) Object.assign(w, { x: 15, y: 15 });
  return s;
}
const workers = (s) => s.cleanliness.workers;
function bin(s, x, fill = 0) {
  const b = { id: s.buildings.length + 100, x, y: 14, kind: "bin", binFill: fill };
  s.buildings.push(b);
  return b;
}
function litter(s, x, amount = 1) {
  assert(C.dropWaste(s, { x, y: 15 }, "wrapper", amount));
  return s.cleanliness.litter.find((l) => l.x === x);
}
const waste = (s) =>
  s.cleanliness.litter.reduce((n, l) => n + l.amount, 0) +
  s.buildings.reduce((n, b) => n + (b.binFill ?? 0), 0) +
  workers(s).reduce((n, w) => n + (w.carried ?? 0), 0) +
  (s.cleanliness.disposed ?? 0);
function tick(s, dt = 0.25) {
  C.tickCleanliness(s, dt);
  if (s.speed !== 0) s.time += dt;
}
function until(s, predicate, seconds = 180) {
  for (let time = 0; !predicate() && time < seconds; time += 0.25) tick(s);
  assert(predicate(), `Condition did not complete within ${seconds}s`);
}

test("Manual rectangles assign distinct real work while unassigned areas remain untouched", () => {
  const s = park(),
    [a, b] = workers(s);
  bin(s, 5);
  bin(s, 27);
  const outside = litter(s, 15, 2);
  litter(s, 6, 3);
  litter(s, 9, 3);
  litter(s, 23, 3);
  litter(s, 29, 3);
  assert.equal(C.assignCleanerArea(s, a.id, left), null);
  assert.equal(C.assignCleanerArea(s, b.id, right), null);
  const initial = waste(s);
  for (let i = 0; i < 600; i++) {
    const previous = workers(s).map((w) => ({ x: w.x, y: w.y }));
    tick(s);
    assert.equal(waste(s), initial, "Waste cannot disappear between pickup and disposal");
    for (const [j, w] of workers(s).entries()) {
      assert(Math.hypot(w.x - previous[j].x, w.y - previous[j].y) <= 1.45 * 0.25 + 1e-7);
      if (["litter", "bin"].includes(w.target?.kind)) {
        const goal = C.cleanerWorkTarget(s, w);
        if (goal) assert(inside(w.area, goal));
      }
    }
  }
  assert.deepEqual(
    s.cleanliness.litter.map((l) => l.id),
    [outside.id],
  );
  assert.equal(s.cleanliness.cleaned, 12);
  assert(C.validCleanliness(s));
});

test("Manual patrol remains inside its rectangle after the necessary arrival journey", () => {
  const s = park(1),
    w = workers(s)[0];
  assert.equal(C.assignCleanerArea(s, w.id, left), null);
  until(s, () => inside(left, w));
  const start = w.walked;
  for (let i = 0; i < 160; i++) {
    tick(s);
    assert(inside(left, w));
    assert(w.route.every((p) => inside(left, p)));
  }
  assert(w.walked > start + 10, "Assigned staff visibly patrol rather than stand still");
});

test("Disposal can reach a real bin outside the work area and then return to assigned work", () => {
  const s = park(1),
    w = workers(s)[0],
    container = bin(s, 16);
  Object.assign(w, { x: 7, y: 15 });
  assert.equal(C.assignCleanerArea(s, w.id, left), null);
  litter(s, 7, 4);
  until(s, () => w.target?.kind === "deposit");
  assert.equal(w.target.id, container.id);
  assert(!inside(left, container));
  const total = waste(s);
  until(s, () => container.binFill === 4 && w.carried === 0);
  assert.equal(waste(s), total);
  until(s, () => inside(left, w) && w.mode === "patrol");
});

test("Automatic workers reserve different dirty neighborhoods with a fallback for clustered jobs", () => {
  const s = park(3);
  for (const w of workers(s)) Object.assign(w, { x: 5, y: 15 });
  for (const x of [7, 8, 9, 27, 28]) litter(s, x);
  tick(s);
  const jobs = workers(s).map((w) => C.cleanerWorkTarget(s, w));
  assert(jobs.every(Boolean));
  assert(
    jobs.some((p) => p.x >= 27),
    "Distant dirty paths need an assigned cleaner immediately",
  );
  assert(jobs.some((p) => p.x <= 9));
  assert.equal(new Set(workers(s).map((w) => w.target.id)).size, 3);
  const crowded = park(3);
  for (const x of [7, 8, 9]) litter(crowded, x);
  tick(crowded);
  assert(
    workers(crowded).every((w) => w.target),
    "Neighborhood reservations must not leave useful staff idle",
  );
});

test("Automatic coverage prefers work outside a colleague's assigned rectangle", () => {
  const s = park(2),
    [manual, auto] = workers(s);
  assert.equal(C.assignCleanerArea(s, manual.id, left), null);
  litter(s, 8);
  litter(s, 10);
  litter(s, 29);
  tick(s);
  assert(inside(left, C.cleanerWorkTarget(s, manual)));
  assert.equal(C.cleanerWorkTarget(s, auto).x, 29);
});

test("An older distant job eventually wins even when nearby litter is continuously replenished", () => {
  const s = park(1),
    w = workers(s)[0];
  Object.assign(w, { x: 5, y: 15 });
  bin(s, 5);
  const distant = litter(s, 29);
  litter(s, 7);
  for (let i = 0; i < 640 && s.cleanliness.litter.some((l) => l.id === distant.id); i++) {
    if (!s.cleanliness.litter.some((l) => l.x === 7)) litter(s, 7);
    tick(s);
  }
  assert(
    !s.cleanliness.litter.some((l) => l.id === distant.id),
    "Local replenishment starved an older distant job",
  );
  assert((w.workStep ?? 0) >= 4);
  assert(C.validCleanliness(s));
});

test("Idle automatic patrols spread instead of selecting one shared park corner", () => {
  const s = park(3);
  tick(s);
  const goals = workers(s).map((w) => w.route.at(-1));
  assert(goals.every(Boolean));
  assert(goals.some((a) => goals.some((b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 6)));
});

test("Area assignment rejects missing workers, malformed bounds, empty ground and unreachable islands atomically", () => {
  const s = park(1),
    w = workers(s)[0];
  s.tiles[2][32] = "path";
  for (const [id, area] of [
    [999, left],
    [w.id, { ...left, x1: -1 }],
    [w.id, { ...left, x2: 36 }],
    [w.id, { ...left, x1: 9.5 }],
    [w.id, { ...left, y1: NaN }],
    [w.id, { ...left, x1: 12, x2: 1 }],
    [w.id, { x1: 2, y1: 2, x2: 4, y2: 4 }],
    [w.id, { x1: 32, y1: 2, x2: 32, y2: 2 }],
  ]) {
    const before = copy(s);
    assert(C.assignCleanerArea(s, id, area));
    assert.deepEqual(copy(s), before);
  }
});

test("A lost connection retains the chosen area and reports actionable status until paths reconnect", () => {
  const s = park(1),
    w = workers(s)[0];
  litter(s, 5);
  assert.equal(C.assignCleanerArea(s, w.id, left), null);
  s.tiles[15][14] = "grass";
  const info = C.cleanerAreaInfo(s, w);
  assert.equal(info.connected, false);
  assert.equal(info.reachablePaths, 0);
  assert(info.label.includes("verbinde"));
  for (let i = 0; i < 40; i++) tick(s);
  assert.deepEqual(w.area, left);
  assert.equal(w.target, null);
  assert.equal(s.cleanliness.cleaned, 0);
  s.tiles[15][14] = "path";
  until(s, () => s.cleanliness.cleaned === 1);
  assert.deepEqual(w.area, left);
});

test("Reassigning a walking worker reroutes without teleporting or collecting outside the new area", () => {
  const s = park(1),
    w = workers(s)[0],
    abandoned = litter(s, 5),
    chosen = litter(s, 27);
  assert.equal(C.assignCleanerArea(s, w.id, left), null);
  tick(s);
  tick(s);
  const at = { x: w.x, y: w.y };
  assert.equal(C.assignCleanerArea(s, w.id, right), null);
  assert.deepEqual({ x: w.x, y: w.y }, at);
  assert.equal(w.target, null);
  tick(s);
  assert.equal(w.target.id, chosen.id);
  assert(Math.hypot(w.x - at.x, w.y - at.y) <= 1.45 * 0.25 + 1e-7);
  until(s, () => !s.cleanliness.litter.some((l) => l.id === chosen.id));
  assert(s.cleanliness.litter.some((l) => l.id === abandoned.id));
});

test("Changing a working cleaner's area preserves the physical service and conserves its bag through disposal", () => {
  const s = park(1),
    w = workers(s)[0],
    full = bin(s, 8, C.BIN_CAPACITY);
  Object.assign(w, { x: 8, y: 15 });
  assert.equal(C.assignCleanerArea(s, w.id, left), null);
  until(s, () => w.mode === "empty" && C.cleanerWorkProgress(w) >= 0.45);
  const pose = C.cleanerServicePose(s, w),
    target = copy(w.target),
    remaining = w.workLeft;
  assert.equal(C.assignCleanerArea(s, w.id, right), null);
  assert.deepEqual(C.cleanerServicePose(s, w), pose);
  assert.deepEqual(w.target, target);
  assert.equal(w.workLeft, remaining);
  const ignored = litter(s, 6, 2),
    fresh = litter(s, 25, 2),
    initial = waste(s);
  let sawCarried = false;
  for (let i = 0; i < 700; i++) {
    tick(s);
    sawCarried ||= w.carried === C.BIN_CAPACITY;
    assert.equal(waste(s), initial);
    if (!s.cleanliness.litter.some((l) => l.id === fresh.id)) break;
  }
  assert(sawCarried);
  assert.equal(full.binFill, 0);
  assert(s.cleanliness.disposed >= C.BIN_CAPACITY);
  assert(s.cleanliness.litter.some((l) => l.id === ignored.id));
  assert(!s.cleanliness.litter.some((l) => l.id === fresh.id));
});

test("Reassigning a worker who carries litter preserves its real deposit route and quantity", () => {
  const s = park(1),
    w = workers(s)[0];
  bin(s, 16);
  Object.assign(w, { x: 5, y: 15 });
  litter(s, 5, 4);
  assert.equal(C.assignCleanerArea(s, w.id, left), null);
  until(s, () => w.target?.kind === "deposit" && w.route.length > 0);
  const before = copy(w);
  assert.equal(C.assignCleanerArea(s, w.id, right), null);
  assert.equal(w.carried, before.carried);
  assert.deepEqual(w.target, before.target);
  assert.deepEqual(w.route, before.route);
  assert.equal(w.x, before.x);
  assert.equal(w.y, before.y);
});

test("Clearing a manual assignment restores automatic park-wide work without charging or moving the worker", () => {
  const s = park(1),
    w = workers(s)[0];
  assert.equal(C.assignCleanerArea(s, w.id, right), null);
  const chosen = litter(s, 5),
    at = { x: w.x, y: w.y };
  assert.equal(C.assignCleanerArea(s, w.id, null), null);
  assert.equal(w.area, undefined);
  assert.deepEqual({ x: w.x, y: w.y }, at);
  tick(s);
  assert.equal(w.target.id, chosen.id);
});

test("Area facts are detached and read-only, with actual reachable paths, litter and bin counts", () => {
  const s = park(1),
    w = workers(s)[0],
    area = { ...left };
  assert.equal(C.assignCleanerArea(s, w.id, area), null);
  area.x1 = 99;
  bin(s, 4, C.BIN_CAPACITY);
  bin(s, 26);
  litter(s, 6, 3);
  litter(s, 26, 5);
  const before = copy(s),
    info = C.cleanerAreaInfo(s, w);
  assert.equal(info.mode, "manual");
  assert.equal(info.reachablePaths, 12);
  assert.equal(info.totalPaths, 12);
  assert.equal(info.litter, 3);
  assert.equal(info.bins, 1);
  assert.equal(info.fullBins, 1);
  assert.equal(info.connected, true);
  info.area.x1 = 99;
  assert.deepEqual(copy(s), before);
});

test("Manual areas and fair allocation survive real save/resume; pause never changes assignments or bags", () => {
  const s = S.newPark("sandbox");
  s.staff = 1;
  S.migratePark(s);
  const w = s.cleanliness.workers[0];
  assert.equal(C.assignCleanerArea(s, w.id, { x1: 0, y1: 0, x2: 29, y2: 29 }), null);
  w.workStep = 7;
  w.fairCursor = 19;
  s.speed = 0;
  const before = copy(s);
  C.tickCleanliness(s, 50);
  assert.deepEqual(copy(s), before);
  const restored = copy(s);
  assert(S.validSave(restored));
  S.migratePark(restored);
  assert.deepEqual(restored.cleanliness.workers[0].area, w.area);
  assert.equal(restored.cleanliness.workers[0].workStep, 7);
  assert.equal(restored.cleanliness.workers[0].fairCursor, 19);
  s.speed = restored.speed = 1;
  for (let i = 0; i < 80; i++) {
    C.tickCleanliness(s, 0.25);
    C.tickCleanliness(restored, 0.25);
  }
  assert.deepEqual(copy(s.cleanliness), copy(restored.cleanliness));
  const legacy = copy(s);
  delete legacy.cleanliness.workers[0].area;
  delete legacy.cleanliness.workers[0].workStep;
  delete legacy.cleanliness.workers[0].fairCursor;
  assert(S.validSave(legacy));
  S.migratePark(legacy);
  assert.equal(C.cleanerAreaInfo(legacy, legacy.cleanliness.workers[0]).mode, "auto");
});

test("Real save validation rejects malformed areas and fairness counters while absent legacy fields remain valid", () => {
  const s = S.newPark();
  s.staff = 1;
  S.migratePark(s);
  for (const value of [
    null,
    [],
    {},
    { ...left, x1: 0.5 },
    { ...left, y2: 999 },
    { ...left, x1: 20 },
  ]) {
    const bad = copy(s);
    bad.cleanliness.workers[0].area = value;
    assert.equal(S.validSave(bad), false);
  }
  for (const field of ["workStep", "fairCursor"]) {
    const bad = copy(s);
    bad.cleanliness.workers[0][field] = -1;
    assert.equal(S.validSave(bad), false);
  }
});

console.log(
  `${results.filter((result) => result.pass).length}/${results.length} cleaner area tests passed`,
);
process.exitCode = results.some((result) => !result.pass) ? 1 : 0;

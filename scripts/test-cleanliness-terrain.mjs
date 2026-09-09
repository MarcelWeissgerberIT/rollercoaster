/** Terrain edits and Undo must preserve live cleaning jobs and reachable litter. */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const root = resolve(process.argv[2] ?? process.cwd());
const { moduleURL } = await import(pathToFileURL(resolve(root, "scripts/ts-loader.mjs")).href);
const C = await import(moduleURL("game/cleanliness.ts"));
const S = await import(moduleURL("game/simulation.ts"));
const B = await import(moduleURL("game/construction.ts"));
const I = await import(moduleURL("game/park-insights.ts"));
let passed = 0,
  failed = 0;
const results = [];
function test(name, fn) {
  try {
    fn();
    passed++;
    results.push({ name, pass: true });
    console.log("PASS", name);
  } catch (error) {
    failed++;
    results.push({ name, pass: false, error: error.message });
    console.error("FAIL", name, error.message);
  }
}
function park() {
  const s = S.newPark("sandbox");
  s.open = false;
  s.buildings = [];
  s.guests = [];
  s.staff = 0;
  s.time = 1;
  s.tiles = Array.from({ length: 30 }, () => Array(30).fill("grass"));
  for (let y = 1; y < 30; y++) s.tiles[y][15] = "path";
  delete s.cleanliness;
  C.initCleanliness(s);
  return s;
}
function run(s, n) {
  for (let t = 0; t < n - 1e-8; t += 0.1) {
    s.time += 0.1;
    C.tickCleanliness(s, 0.1);
  }
}
const pileAt = (s, x, y, kind = "cup") =>
  s.cleanliness.litter.find((l) => l.x === x && l.y === y && l.kind === kind);
test("Demolition disposes only litter on the removed cell immediately, including while paused", () => {
  const s = park();
  C.dropWaste(s, { x: 15, y: 20 }, "cup", 3);
  C.dropWaste(s, { x: 15, y: 21 }, "wrapper", 4);
  s.speed = 0;
  S.remove(s, 15, 20);
  assert.equal(pileAt(s, 15, 20), undefined);
  assert.equal(pileAt(s, 15, 21, "wrapper").amount, 4);
  assert.equal(s.cleanliness.cleaned, 0);
  assert(S.validSave(s));
});
test("Water and grass repaint dispose litter, preserving finances beyond the terrain cost", () => {
  for (const tile of ["water", "grass"]) {
    const s = park();
    C.dropWaste(s, { x: 15, y: 20 }, "cup", 20);
    const cash = s.cash;
    s.speed = 0;
    assert.equal(S.paint(s, 15, 20, tile), null);
    assert.equal(s.cleanliness.litter.length, 0);
    assert.equal(C.cleanlinessScore(s), 100);
    assert.equal(s.cash, cash - (tile === "water" ? 35 : 12));
    assert.equal(s.cleanliness.cleaned, 0);
    assert(S.validSave(s));
  }
});
test("Path-to-queue and path-to-exit preserve the same litter IDs and amounts", () => {
  for (const tile of ["queue", "exit"]) {
    const s = park();
    C.dropWaste(s, { x: 15, y: 20 }, "cup", 3);
    const old = structuredClone(s.cleanliness.litter);
    assert.equal(S.paint(s, 15, 20, tile), null);
    assert.deepEqual(s.cleanliness.litter, old);
    assert(S.validSave(s));
  }
});
test("Disconnecting an existing dirty walkway retains litter until actual reconnection", () => {
  const s = park();
  s.staff = 1;
  C.dropWaste(s, { x: 15, y: 20 }, "cup", 2);
  S.remove(s, 15, 25);
  run(s, 20);
  assert.equal(pileAt(s, 15, 20).amount, 2);
  assert.equal(s.cleanliness.cleaned, 0);
  assert.equal(S.paint(s, 15, 25, "path"), null);
  run(s, 20);
  assert.equal(s.cleanliness.litter.length, 0);
  assert.equal(s.cleanliness.cleaned, 2);
});
test("A worker stranded by demolition immediately relocates then cleans through real routes", () => {
  const s = park();
  s.staff = 1;
  C.initCleanliness(s);
  const w = s.cleanliness.workers[0];
  Object.assign(w, { x: 15, y: 23, route: [], target: null, mode: "idle" });
  for (const y of [22, 23, 24]) S.remove(s, 15, y);
  assert.deepEqual({ x: w.x, y: w.y }, S.ENTRANCE);
  C.dropWaste(s, { x: 15, y: 26 }, "cup", 3);
  run(s, 0.2);
  assert.equal(C.cleanlinessStats(s).pieces, 3);
  run(s, 20);
  assert.equal(C.cleanlinessStats(s).pieces, 0);
  assert(S.validSave(s));
});
test("A worker on disconnected but intact walkway is not teleported away", () => {
  const s = park();
  s.staff = 1;
  C.initCleanliness(s);
  const w = s.cleanliness.workers[0];
  Object.assign(w, { x: 15, y: 20, route: [], target: null, mode: "idle" });
  S.remove(s, 15, 25);
  assert.deepEqual({ x: w.x, y: w.y }, { x: 15, y: 20 });
  C.dropWaste(s, { x: 15, y: 19 }, "cup");
  run(s, 5);
  assert.equal(s.cleanliness.cleaned, 1);
  assert(w.y < 25);
});
test("Worker already approaching a surviving adjacent cell finishes that step without a jump", () => {
  const s = park();
  s.staff = 1;
  C.initCleanliness(s);
  const w = s.cleanliness.workers[0];
  Object.assign(w, { x: 15, y: 23.4, route: [{ x: 15, y: 24 }], target: null, mode: "walk" });
  S.remove(s, 15, 23);
  assert.equal(w.y, 23.4);
  run(s, 0.2);
  assert(w.y > 23.4 && w.y < 24);
  assert(S.validSave(s));
});
test("Worker with removed next step and surviving later route recovers on subsequent update", () => {
  const s = park();
  s.staff = 1;
  C.initCleanliness(s);
  const w = s.cleanliness.workers[0];
  Object.assign(w, {
    x: 15,
    y: 23,
    route: [
      { x: 15, y: 24 },
      { x: 15, y: 25 },
      { x: 15, y: 26 },
    ],
    target: null,
    mode: "walk",
  });
  for (const y of [22, 23, 24, 25]) S.remove(s, 15, y);
  run(s, 0.3);
  assert(["path", "queue", "exit"].includes(s.tiles[Math.round(w.y)][Math.round(w.x)]));
  assert(S.validSave(s));
});
test("Legacy nonwalkable piles and stranded workers remain loadable and normalize safely", () => {
  const s = park();
  s.staff = 1;
  C.dropWaste(s, { x: 15, y: 20 }, "cup", 2);
  const w = s.cleanliness.workers[0];
  Object.assign(w, { x: 15, y: 20, route: [], target: null, mode: "idle" });
  for (const y of [19, 20, 21]) s.tiles[y][15] = "grass";
  const saved = JSON.parse(JSON.stringify(s));
  assert(S.validSave(saved));
  S.migratePark(saved);
  assert.equal(saved.cleanliness.litter.length, 0);
  assert.equal(saved.cleanliness.cleaned, 0);
  assert.deepEqual(
    { x: saved.cleanliness.workers[0].x, y: saved.cleanliness.workers[0].y },
    S.ENTRANCE,
  );
  assert(S.validSave(saved));
});
test("Selective undo restores removed piles but preserves unrelated cleaning, newer waste and counters", () => {
  const s = park();
  C.dropWaste(s, { x: 15, y: 20 }, "cup", 3);
  C.dropWaste(s, { x: 15, y: 27 }, "wrapper", 2);
  const old = structuredClone(pileAt(s, 15, 20));
  const edit = B.recordEdit(s, "demolish", () => S.remove(s, 15, 20));
  assert(edit);
  assert.deepEqual(edit.clearedLitter, [old]);
  s.staff = 1;
  run(s, 8);
  assert.equal(pileAt(s, 15, 27, "wrapper"), undefined);
  C.dropWaste(s, { x: 15, y: 28 }, "cup", 4);
  const current = structuredClone(s.cleanliness),
    time = s.time;
  B.undoEdits(s, [edit]);
  assert.deepEqual(pileAt(s, 15, 20), old);
  assert.equal(pileAt(s, 15, 27, "wrapper"), undefined);
  assert.equal(pileAt(s, 15, 28).amount, 4);
  assert.equal(s.cleanliness.cleaned, current.cleaned);
  assert.equal(s.cleanliness.binned, current.binned);
  assert.equal(s.cleanliness.emptied, current.emptied);
  assert.deepEqual(s.cleanliness.workers, current.workers);
  assert.equal(s.time, time);
  assert.equal(s.cleanliness.nextId, current.nextId);
  assert(S.validSave(s));
});
test("Batch demolition undo restores both kinds with original IDs and no duplicate restoration", () => {
  const s = park();
  C.dropWaste(s, { x: 15, y: 20 }, "cup", 2);
  C.dropWaste(s, { x: 15, y: 20 }, "wrapper", 3);
  C.dropWaste(s, { x: 15, y: 21 }, "cup", 4);
  const old = structuredClone(s.cleanliness.litter);
  const edits = [
    B.recordEdit(s, "one", () => S.remove(s, 15, 20)),
    B.recordEdit(s, "two", () => S.remove(s, 15, 21)),
  ];
  B.undoEdits(s, edits);
  assert.deepEqual(
    [...s.cleanliness.litter].sort((a, b) => a.id - b.id),
    old,
  );
  B.undoEdits(s, edits);
  assert.equal(s.cleanliness.litter.length, 3);
  assert(s.cleanliness.nextId > Math.max(...old.map((l) => l.id)));
  assert(S.validSave(s));
});
test("Hotspots for dirt and mood remain in bounds at every edge of rectangular expansions", () => {
  for (const width of [30, 36, 42, 48, 54])
    for (const height of [30, 36, 42, 48, 54]) {
      const s = park();
      s.tiles = Array.from({ length: height }, () => Array(width).fill("grass"));
      s.tiles[29][15] = "path";
      for (const [x, y] of [
        [0, 0],
        [width - 1, 0],
        [0, height - 1],
        [width - 1, height - 1],
      ]) {
        s.tiles[y][x] = "path";
        C.dropWaste(s, { x, y }, "cup", 2);
        for (let i = 0; i < 3; i++)
          s.guests.push({ id: s.nextId++, x, y, happiness: 30, state: "walk" });
      }
      const issues = I.parkInsights(s).issues;
      assert(issues.some((i) => i.kind === "dirt"));
      assert(issues.some((i) => i.kind === "mood"));
      for (const i of issues)
        assert(
          i.point.x >= 0 && i.point.x < width && i.point.y >= 0 && i.point.y < height,
          `${width}x${height}: ${JSON.stringify(i)}`,
        );
    }
});
test("Undoing a newly built path also reconciles newly dropped litter immediately while paused", () => {
  const s = park();
  const edit = B.recordEdit(s, "build path", () => assert.equal(S.paint(s, 14, 27, "path"), null));
  assert(edit);
  C.dropWaste(s, { x: 14, y: 27 }, "cup", 2);
  s.speed = 0;
  B.undoEdits(s, [edit]);
  assert.equal(s.tiles[27][14], "grass");
  assert.equal(
    pileAt(s, 14, 27),
    undefined,
    "Undo leaves new litter on restored grass until the next running tick",
  );
  assert(S.validSave(s));
});
console.log(JSON.stringify({ passed, failed, results }, null, 2));
process.exitCode = failed ? 1 : 0;

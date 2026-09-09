import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
process.on("uncaughtException", (e) => {
  console.error(e.message);
  process.exit(1);
});
const S = await import(moduleURL("game/simulation.ts")),
  E = await import(moduleURL("game/track-edit.ts")),
  P = await import(moduleURL("game/prefabs.ts")),
  C = await import(moduleURL("game/construction.ts")),
  F = await import(moduleURL("game/track-fit.ts"));
const same = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0)) < 1e-8;
function fixture(style = "steel", from = 12, to = 15) {
  const s = S.newPark("sandbox");
  s.guests = [];
  s.cash = 1e6;
  const b = s.buildings.find((x) => x.kind === "coaster");
  s.buildings = [b];
  s.tiles = Array.from({ length: 30 }, () => Array(30).fill("grass"));
  b.x = 14;
  b.y = 14;
  b.track = P.prefabBlueprint(b, 0, style);
  assert.equal(E.beginTrackEdit(s, b, from, to), null);
  return { s, b };
}
const tests = [];
function test(name, fn) {
  try {
    const evidence = fn();
    tests.push({ name, pass: true, evidence });
  } catch (e) {
    tests.push({ name, pass: false, error: e.message.slice(0, 1800) });
  }
}
function find(s, draft = s.draft.track, piece = "loop") {
  const before = JSON.stringify(s),
    given = JSON.stringify(draft),
    start = performance.now(),
    result = F.findTrackFit(s, draft, piece, true);
  assert.equal(JSON.stringify(s), before, "Search mutated input park");
  assert.equal(JSON.stringify(draft), given, "Search mutated draft");
  return { ...result, ms: performance.now() - start };
}
function assertRetained(s, b, solution) {
  const original = E.editableTrack(b),
    parts = E.trackSections(original);
  let edges = 0;
  parts.forEach((p, i) => {
    if (i < solution.from || i > solution.to)
      for (let j = p.start; j < p.end; j++) {
        const at = solution.track.findIndex(
          (q, k) =>
            k < solution.track.length - 1 &&
            same(q, original[j]) &&
            same(solution.track[k + 1], original[j + 1]),
        );
        assert(at >= 0, `Retained edge missing section${i} index${j}`);
        assert.deepEqual(solution.track[at].drive, original[j].drive, "Unselected drive changed");
        edges++;
      }
  });
  return edges;
}
function apply(s, b, result) {
  assert(result.solution, result.error);
  const solution = result.solution,
    edges = assertRetained(s, b, solution),
    cash = s.cash;
  assert.equal(F.commitTrackFit(s, solution, true), null);
  assert.deepEqual(b.track, solution.track);
  assert.equal(s.cash, cash - solution.cost, "Commit price differs from displayed quote");
  assert.equal(s.trackEdit, undefined);
  assert.equal(s.draft, undefined);
  assert(S.validSave(JSON.parse(JSON.stringify(s))), "Committed proposal not saveable");
  return edges;
}

for (const [x, y] of [
  [18, 19],
  [17, 19],
  [17, 18],
  [18, 21],
  [19, 21],
  [19, 22],
])
  test(`Water(${x},${y}) gets complete valid replacement without source mutation`, () => {
    const { s, b } = fixture();
    s.tiles[y][x] = "water";
    assert(
      P.pieceError(
        E.trackEditWorld(s),
        s.trackEdit.prefix,
        P.appendPiece(s.trackEdit.prefix, "loop"),
        true,
        s.trackEdit.suffix,
      ),
    );
    const result = find(s);
    const retained = apply(s, b, result);
    const solution = result.solution;
    assert(S.validSave(JSON.parse(JSON.stringify(s))));
    return {
      from: solution.from,
      to: solution.to,
      approach: solution.approach,
      cost: solution.cost,
      checked: result.checked,
      ms: result.ms,
      retained,
    };
  });
test("Water band supports moving loop forward with approach and later endpoint", () => {
  const { s, b } = fixture();
  for (let x = 18; x <= 26; x++) for (let y = 21; y <= 22; y++) s.tiles[y][x] = "water";
  const result = find(s);
  apply(s, b, result);
  return {
    from: result.solution.from,
    to: result.solution.to,
    approach: result.solution.approach,
    cost: result.solution.cost,
    checked: result.checked,
    ms: result.ms,
  };
});
test("Existing user-created approach and its module are retained", () => {
  const { s, b } = fixture("steel", 10, 16),
    prefix = s.trackEdit.prefix,
    drive = { kind: "boost", speed: 53, strength: 7 };
  const draft = P.appendPiece(prefix, "short").map((p, i) =>
    i >= prefix.length - 1 && i < P.appendPiece(prefix, "short").length - 1 ? { ...p, drive } : p,
  );
  s.draft.track = draft;
  const result = find(s, draft);
  assert(result.solution, result.error);
  assert.equal(result.solution.from, 10);
  assert.equal(result.solution.to, 16);
  draft.slice(0, -1).forEach((p, i) => {
    assert(same(result.solution.track[i], p));
    assert.deepEqual(result.solution.track[i].drive, p.drive);
  });
  apply(s, b, result);
  return { checked: result.checked, ms: result.ms };
});
test("Existing failed user draft is not discarded or enlarged silently", () => {
  const { s } = fixture(),
    prefix = s.trackEdit.prefix;
  const draft = P.appendPiece(prefix, "short");
  s.draft.track = draft;
  for (let x = 0; x < 30; x++)
    for (let y = 0; y < 30; y++)
      if (!S.trackFootprint(E.trackEditRange(s).track).some((p) => p.x === x && p.y === y))
        s.tiles[y][x] = "water";
  const result = find(s, draft);
  assert(!result.solution);
  assert(result.error);
  return { checked: result.checked, ms: result.ms };
});
test("Low budget keeps a usable geometry proposal with complete live price", () => {
  const { s } = fixture();
  s.tiles[21][18] = "water";
  const rich = find(s);
  assert(rich.solution, rich.error);
  s.cash = 0;
  const poor = find(s);
  assert(poor.solution, poor.error);
  assert.equal(poor.solution.cost, rich.solution.cost);
  assert(poor.solution.cost > 0);
  return { cost: poor.solution.cost, checked: poor.checked };
});
test("Wood rejects looping without mutation", () => {
  const { s } = fixture("wood", 1, 2);
  const result = find(s);
  assert(!result.solution);
  assert(result.error);
  return { error: result.error, checked: result.checked, ms: result.ms };
});
test("Unselected booster survives larger cut and applying proposal", () => {
  const { s, b } = fixture();
  E.cancelTrackEdit(s);
  assert.equal(E.installTrackDrive(s, b, 19, 19, { kind: "boost", speed: 71, strength: 3 }), null);
  E.beginTrackEdit(s, b, 12, 15);
  s.tiles[21][18] = "water";
  const payload = b.track.filter((p) => p.drive).map((p) => [p.x, p.y, p.z, p.drive]);
  const result = find(s);
  apply(s, b, result);
  assert.deepEqual(
    result.solution.track.filter((p) => p.drive).map((p) => [p.x, p.y, p.z, p.drive]),
    payload,
  );
  return { from: result.solution.from, to: result.solution.to };
});
test("Revalidation rejects stale water-conflicted proposal atomically", () => {
  const { s, b } = fixture();
  s.tiles[21][18] = "water";
  const result = find(s);
  assert(result.solution, result.error);
  const footprint = S.trackFootprint(result.solution.track),
    oldKeys = new Set(S.trackFootprint(b.track).map((p) => `${p.x},${p.y}`));
  const spot = footprint.find((p) => !oldKeys.has(`${p.x},${p.y}`));
  assert(spot);
  s.tiles[spot.y][spot.x] = "water";
  const before = JSON.stringify(s);
  assert(F.commitTrackFit(s, result.solution, true));
  assert.equal(JSON.stringify(s), before, "Rejected preview partially changed edit");
  return { spot };
});
test("Changed user draft invalidates old worker solution atomically", () => {
  const { s } = fixture();
  const result = find(s);
  assert(result.solution, result.error);
  s.draft.track = P.appendPiece(s.draft.track, "short");
  const before = JSON.stringify(s);
  assert(F.commitTrackFit(s, result.solution, true));
  assert.equal(JSON.stringify(s), before);
});
test("Insufficient cash rejects commit without closing or altering user edit", () => {
  const { s } = fixture();
  const result = find(s);
  assert(result.solution, result.error);
  s.cash = 0;
  const before = JSON.stringify(s);
  assert(F.commitTrackFit(s, result.solution, true));
  assert.equal(JSON.stringify(s), before);
});
test("One construction undo restores original geometry and cash without rewinding live time", () => {
  const { s, b } = fixture();
  s.tiles[21][18] = "water";
  const result = find(s);
  assert(result.solution, result.error);
  const track = JSON.stringify(b.track),
    cash = s.cash;
  const record = C.recordEdit(s, "automatic looping replacement", () =>
    assert.equal(F.commitTrackFit(s, result.solution, true), null),
  );
  assert(record);
  S.tick(s, 0.5);
  const time = s.time;
  C.undoEdits(s, [record]);
  assert.equal(JSON.stringify(b.track), track);
  assert.equal(s.cash, cash);
  assert.equal(s.time, time);
  assert(S.validSave(JSON.parse(JSON.stringify(s))));
});
for (const t of tests)
  console.log((t.pass ? "PASS " : "FAIL ") + t.name + (t.error ? " " + t.error : ""));
console.log(`${tests.filter((t) => t.pass).length}/${tests.length} passed`);
process.exitCode = tests.some((t) => !t.pass) ? 1 : 0;

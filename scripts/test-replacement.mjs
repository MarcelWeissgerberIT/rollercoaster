import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  E = await import(moduleURL("game/track-edit.ts")),
  P = await import(moduleURL("game/prefabs.ts")),
  M = await import(moduleURL("game/motion.ts")),
  D = await import(moduleURL("game/draft.ts")),
  C = await import(moduleURL("game/construction.ts"));
let failures = 0;
const test = (name, fn) => {
  try {
    fn();
    console.log("PASS " + name);
  } catch (e) {
    failures++;
    console.error("FAIL " + name, e.stack);
  }
};
function fixture(style) {
  const s = S.newPark("sandbox");
  s.guests = [];
  const b = s.buildings.find((b) => b.kind === "coaster");
  if (style) {
    s.buildings = [b];
    s.tiles = Array.from({ length: 30 }, () => Array(30).fill("grass"));
    b.x = 14;
    b.y = 14;
    b.track = P.prefabBlueprint(b, 0, style);
  }
  b.open = true;
  b.tested = true;
  return { s, b };
}
const connect = (s, track = s.trackEdit.prefix) => {
  const result = P.closeTrack(E.trackEditWorld(s), track, true, s.trackEdit.suffix);
  assert(result.track, result.error);
  assert.equal(E.trackEditPlan(s, result.track).error, null);
  return result.track;
};
test("Legacy conversion preserves actual rounded track geometry and length", () => {
  const { b } = fixture(),
    before = M.prepareRoute(b.track),
    converted = E.editableTrack(b),
    after = M.prepareRoute(converted);
  assert(Math.abs(before.length - after.length) < 1e-9);
  const segmentDistance = (p, a, b) => {
    const u = [b.x - a.x, b.y - a.y, b.z - a.z],
      v = [p.x - a.x, p.y - a.y, p.z - a.z];
    const t = Math.max(
      0,
      Math.min(1, u.reduce((s, x, i) => s + x * v[i], 0) / (u.reduce((s, x) => s + x * x, 0) || 1)),
    );
    return Math.hypot(...v.map((x, i) => x - u[i] * t));
  };
  for (const p of before.points)
    assert(
      Math.min(...converted.slice(1).map((q, i) => segmentDistance(p, converted[i], q))) < 1e-8,
    );
  assert(converted.length <= 2048);
});
for (const where of ["first", "last", "straight"])
  test(`Legacy ${where} cut reconnects locally and preserves station and retained geometry`, () => {
    const { s, b } = fixture(),
      old = { x: b.x, y: b.y },
      sections = E.trackSections(E.editableTrack(b));
    const i =
      where === "first"
        ? 0
        : where === "last"
          ? sections.length - 1
          : sections.findIndex((p) => p.label === "Gerade");
    assert.equal(E.beginTrackEdit(s, b, i, i), null);
    assert(S.validSave(structuredClone(s)));
    const { prefix, suffix } = s.trackEdit,
      replacement = connect(s),
      before = M.prepareRoute(b.track).length;
    assert(
      M.prepareRoute(replacement).length < before + 2,
      "Tiny gap must not produce a large detour",
    );
    assert.deepEqual(replacement.slice(0, prefix.length), prefix);
    if (suffix.length > 1) assert.deepEqual(replacement.slice(-suffix.length + 1), suffix.slice(1));
    assert.equal(E.commitTrackEdit(s, replacement), null);
    assert.equal(b.x, old.x);
    assert.equal(b.y, old.y);
    assert(S.validSave(structuredClone(s)));
  });
test("Cut expands in both directions, preserves original track and cancels back to open", () => {
  const { s, b } = fixture("steel"),
    original = structuredClone(b.track);
  assert.equal(E.beginTrackEdit(s, b, 2, 2), null);
  assert.equal(E.resizeTrackEdit(s, 1, 2), null);
  assert.equal(E.resizeTrackEdit(s, 1, 3), null);
  assert.deepEqual(
    { from: E.trackEditRange(s).from, to: E.trackEditRange(s).to },
    { from: 1, to: 3 },
  );
  assert.deepEqual(b.track, original);
  assert(S.validSave(structuredClone(s)));
  const pending = s.trackEdit;
  assert(E.resizeTrackEdit(s, -1, 3));
  assert.equal(s.trackEdit, pending);
  E.cancelTrackEdit(s);
  assert(b.open);
  assert.deepEqual(b.track, original);
});
test("One-field gap accepts one-field prefab and reconnects without a detour", () => {
  const { s, b } = fixture("steel");
  assert.equal(E.beginTrackEdit(s, b, 0, 0), null);
  const next = P.appendPiece(s.trackEdit.prefix, "short");
  assert.equal(
    P.pieceError(E.trackEditWorld(s), s.trackEdit.prefix, next, true, s.trackEdit.suffix),
    null,
  );
  const joined = connect(s, next);
  assert(Math.abs(M.prepareRoute(joined).length - M.prepareRoute(b.track).length) < 1e-6);
});
test("Looping fit suggests an explicit larger cut then inserts a fully connected loop", () => {
  const { s, b } = fixture("steel");
  E.beginTrackEdit(s, b, 0, 0);
  const fit = E.fittingTrackCut(s, "loop");
  assert(fit && fit.extra > 0);
  assert.equal(E.resizeTrackEdit(s, fit.from, fit.to), null);
  const next = P.appendPiece(s.trackEdit.prefix, "loop");
  assert.equal(
    P.pieceError(E.trackEditWorld(s), s.trackEdit.prefix, next, true, s.trackEdit.suffix),
    null,
  );
  assert.equal(E.commitTrackEdit(s, connect(s, next)), null);
  assert(b.track.some((p) => p.inversion));
});
test("Replacing an existing loop with flat pieces removes all inversion flags and bonuses", () => {
  const { s, b } = fixture("launch"),
    sections = E.trackSections(E.editableTrack(b)),
    i = sections.findIndex((p) => p.label === "Looping");
  assert(i >= 0);
  E.beginTrackEdit(s, b, i, i);
  const flat = P.appendPiece(P.appendPiece(s.trackEdit.prefix, "straight"), "straight"),
    joined = connect(s, flat);
  assert(!joined.some((p) => p.inversion));
  assert.equal(E.commitTrackEdit(s, joined), null);
  assert(!E.trackSections(b.track).some((p) => p.label === "Looping"));
});
test("Saved draft undo restores incoming and outgoing endpoint metadata exactly", () => {
  const { s, b } = fixture("steel");
  E.installTrackDrive(s, b, 2, 2, { kind: "boost", speed: 60, strength: 4 });
  E.beginTrackEdit(s, b, 1, 1);
  const next = P.appendPiece(s.trackEdit.prefix, "short"),
    last = structuredClone(next.at(-1)),
    joined = connect(s, next);
  s.draft = {
    track: joined,
    ...D.draftHistoryData([s.trackEdit.prefix, next], joined.length),
    rotation: 0,
    style: "steel",
    piece: "short",
  };
  const restored = JSON.parse(JSON.stringify(s));
  assert(S.validSave(restored));
  assert.deepEqual(D.restoreDraftHistory(restored.draft).at(-1).at(-1), last);
  restored.draft.historyEnds[0] = { x: NaN, y: 0 };
  assert(!S.validSave(restored));
});
for (const piece of ["short", "hill", "sbend"])
  test(`New ${piece} prefab stays connected, saves and restores the selection`, () => {
    const { s } = fixture("steel"),
      track = P.appendPiece(P.startTrack({ x: 7, y: 7 }), piece);
    assert.equal(P.pieceError({ ...s, buildings: [] }, [track[0]], track, true), null);
    s.draft = { track, history: [], rotation: 0, style: "steel", piece };
    assert(S.validSave(JSON.parse(JSON.stringify(s))));
  });
test("Converted legacy keeps usable ground station positions", () => {
  const { s, b } = fixture();
  E.installTrackDrive(s, b, 0, 0, { kind: "boost", speed: 60, strength: 4 });
  const candidates = C.stationPositions(b);
  assert(candidates.length);
  assert.equal(C.adjustBuilding(s, b, "station", candidates[0]), null);
  assert(S.validSave(structuredClone(s)));
});
test("Legacy large fallback module conversion rejects >2048 before cash/track mutations", () => {
  const s = S.newPark("sandbox");
  s.buildings = [];
  s.guests = [];
  s.transitLines = [];
  s.cash = 1000000;
  s.tiles = Array.from({ length: 54 }, () => Array(54).fill("grass"));
  function h(n, d) {
    let x = 0,
      y = 0;
    for (let z = 1, t = d; z < n; z *= 2) {
      const rx = 1 & (t / 2),
        ry = 1 & (t ^ rx);
      if (!ry) {
        if (rx) {
          x = z - 1 - x;
          y = z - 1 - y;
        }
        [x, y] = [y, x];
      }
      x += z * rx;
      y += z * ry;
      t = Math.floor(t / 4);
    }
    return { x: x + 5, y: y + 5, z: 0 };
  }
  const t = Array.from({ length: 1024 }, (_, d) => h(32, d));
  t.push({ x: 36, y: 4, z: 0 });
  for (let x = 35; x >= 5; x--) t.push({ x, y: 4, z: 0 });
  t.push({ ...t[0] });
  const r = S.build(s, "coaster", 5, 5, t);
  assert(!r.error, r.error);
  const b = s.buildings.find((b) => b.id === r.id),
    before = JSON.stringify(s);
  assert(S.validSave(s));
  assert(
    E.installTrackDrive(s, b, 0, 0, { kind: "boost", speed: 60, strength: 4 }),
    "Oversized module track accepted",
  );
  assert.equal(JSON.stringify(s), before);
  assert(S.validSave(s));
});
process.exitCode = failures ? 1 : 0;

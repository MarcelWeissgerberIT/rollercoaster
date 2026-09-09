import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
process.on("uncaughtException", (e) => {
  console.error(e.message);
  process.exit(1);
});
const S = await import(moduleURL("game/simulation.ts")),
  E = await import(moduleURL("game/track-edit.ts")),
  P = await import(moduleURL("game/prefabs.ts")),
  R = await import(moduleURL("game/ride-profiles.ts")),
  C = await import(moduleURL("game/construction.ts")),
  G = await import(moduleURL("game/gforce.ts"));
const tests = [];
function test(name, fn) {
  try {
    const evidence = fn();
    tests.push({ name, pass: true, evidence });
  } catch (e) {
    tests.push({ name, pass: false, error: e.message.slice(0, 1200) });
  }
  console.log(JSON.stringify(tests.at(-1)));
}
const snapshot = (x) => JSON.stringify(x),
  clone = (x) => structuredClone(x);
function fixture() {
  const s = S.newPark("sandbox");
  s.guests = [];
  s.cash = 1e6;
  const b = s.buildings.find((b) => b.kind === "coaster");
  s.buildings = [b];
  s.tiles = Array.from({ length: 30 }, () => Array(30).fill("grass"));
  b.x = 14;
  b.y = 14;
  b.track = P.prefabBlueprint(b, 0, "steel");
  return { s, b };
}
function plan(s, b, goal = "fun", profile) {
  const input = snapshot(s),
    start = performance.now(),
    r = R.planRideProfile(s, b.id, 12, 15, goal, profile);
  assert.equal(snapshot(s), input, "Planner mutated live park");
  assert(r.plan, r.error);
  return { p: r.plan, ms: performance.now() - start };
}
function geometry() {
  const { s, b } = fixture();
  return { s, b, ...plan(s, b, "fun", "airtime") };
}
const score = (a, g) =>
  g === "gforce"
    ? Math.max(a.peaks.vertical, a.maxLateral)
    : g === "airtime"
      ? a.airtime
      : g === "comfort"
        ? a.comfort
        : a.fun;
for (const [goal, profile] of [
  ["fun", "boost"],
  ["comfort", "brake"],
  ["fun", "airtime"],
  ["fun", "bunny"],
  ["gforce", "doubleloop"],
  ["fun", undefined],
  ["comfort", undefined],
])
  test(`${profile ?? "auto " + goal}: pure plan + exact whole-route before/after + valid save`, () => {
    const { s, b } = fixture(),
      { p, ms } = plan(s, b, goal, profile);
    assert.deepEqual(p.before, G.analyzeForces(b.track));
    assert.deepEqual(p.after, G.analyzeForces(p.track));
    if (!profile) assert(score(p.after, goal) >= score(p.before, goal) + 0.08);
    const cash = s.cash;
    assert.equal(R.commitRideProfile(s, p), null);
    assert.equal(cash - s.cash, p.cost);
    assert.deepEqual(b.track, p.track);
    assert.equal(b.open, false);
    assert.equal(b.tested, false);
    assert(S.validSave(JSON.parse(snapshot(s))));
    return { ms, cost: p.cost, before: score(p.before, goal), after: score(p.after, goal) };
  });
test("Drive changes preserve actual geometry and unselected drive metadata", () => {
  const { s, b } = fixture();
  assert.equal(E.installTrackDrive(s, b, 3, 4, { kind: "boost", speed: 45, strength: 7 }), null);
  const original = E.editableTrack(b),
    { p } = plan(s, b, "comfort", "brake");
  assert.deepEqual(
    p.track.map(({ drive, ...p }) => p),
    original.map(({ drive, ...p }) => p),
  );
  for (let i = 0; i < original.length; i++)
    if (original[i].drive) assert.deepEqual(p.track[i].drive, original[i].drive);
  return { points: p.track.length };
});
test("Geometry preserves all retained edges and drive metadata", () => {
  const { s, b } = fixture();
  assert.equal(E.installTrackDrive(s, b, 3, 4, { kind: "boost", speed: 45, strength: 7 }), null);
  const original = E.editableTrack(b),
    sections = E.trackSections(original),
    { p } = plan(s, b, "fun", "airtime");
  let count = 0;
  const same = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0)) < 1e-8;
  sections.forEach((sec, si) => {
    if (si < p.fit.from || si > p.fit.to)
      for (let j = sec.start; j < sec.end; j++) {
        const k = p.track.findIndex(
          (q, i) =>
            i < p.track.length - 1 && same(q, original[j]) && same(p.track[i + 1], original[j + 1]),
        );
        assert(k >= 0);
        assert.deepEqual(p.track[k].drive, original[j].drive);
        count++;
      }
  });
  return { count, from: p.fit.from, to: p.fit.to };
});
for (const kind of ["geometry", "drive"]) {
  test(`${kind}: insufficient live budget rejects atomically`, () => {
    const { s, b } = fixture(),
      { p } = plan(s, b, "fun", kind === "drive" ? "boost" : "airtime");
    s.cash = p.cost - 1;
    b.testing = 4;
    const before = snapshot(s);
    const error = R.commitRideProfile(s, p);
    assert(error);
    assert.equal(snapshot(s), before);
    return { error };
  });
  test(`${kind}: changed source rejects atomically`, () => {
    const { s, b } = fixture(),
      { p } = plan(s, b, "fun", kind === "drive" ? "boost" : "airtime");
    b.track = b.track.map((x, i) =>
      i === 3 ? { ...x, drive: { kind: "brake", speed: 20, strength: 3 } } : x,
    );
    const before = snapshot(s);
    const error = R.commitRideProfile(s, p);
    assert(error);
    assert.equal(snapshot(s), before);
    return { error };
  });
  test(`${kind}: live clock/profit advance permits commit and selective undo`, () => {
    const { s, b } = fixture();
    b.open = true;
    b.tested = true;
    const before = clone(b.track),
      { p } = plan(s, b, "fun", kind === "drive" ? "boost" : "airtime");
    const cash = s.cash;
    s.time += 14;
    s.cash += 107;
    s.income += 107;
    let error;
    const edit = C.recordEdit(s, "Profile", () => {
      error = R.commitRideProfile(s, p);
    });
    assert.equal(error, null);
    assert(edit);
    s.time += 9;
    s.cash += 31;
    s.income += 31;
    const time = s.time;
    C.undoEdits(s, [edit]);
    assert.deepEqual(b.track, before);
    assert.equal(s.time, time);
    assert.equal(s.cash, cash + 138);
    assert.equal(b.open, true);
    assert.equal(b.tested, true);
    assert(S.validSave(JSON.parse(snapshot(s))));
    return { time, cash: s.cash };
  });
}
test("Geometry terrain late failure leaves live riders/testing/geometry untouched", () => {
  const { s, b, p } = geometry();
  const tile = S.trackFootprint(p.track)[5];
  assert(tile);
  s.tiles[tile.y][tile.x] = "water";
  b.testing = 4;
  const before = snapshot(s),
    error = R.commitRideProfile(s, p);
  assert(error);
  assert.equal(snapshot(s), before);
  return { tile, error };
});
test("Existing track edit blocks plan and commit atomically", () => {
  const { s, b, p } = geometry();
  assert.equal(E.beginTrackEdit(s, b, 1, 2), null);
  const before = snapshot(s);
  assert(R.planRideProfile(s, b.id, 12, 15, "fun", "airtime").error);
  assert(R.commitRideProfile(s, p));
  assert.equal(snapshot(s), before);
});
test("Unrelated new-coaster draft survives geometry profile planning/commit", () => {
  const { s, b, p } = geometry();
  s.draft = {
    track: P.startTrack({ x: 3, y: 23 }),
    history: [],
    rotation: 0,
    style: "steel",
    piece: "straight",
  };
  const draft = clone(s.draft),
    before = snapshot(s);
  const error = R.commitRideProfile(s, p);
  if (error) {
    assert.equal(snapshot(s), before);
  } else {
    assert.deepEqual(s.draft, draft, "Profile commit discarded unrelated draft");
  }
  return { error };
});
test("No-budget search still returns valid geometry with actual quoted price", () => {
  const { s, b } = fixture();
  s.cash = 0;
  const { p } = plan(s, b, "fun", "airtime");
  assert(p.cost > 0);
  const before = snapshot(s);
  assert(R.commitRideProfile(s, p));
  assert.equal(snapshot(s), before);
  return { cost: p.cost };
});
test("Legacy route keeps rendered geometry for profile modules and compares true original ride", () => {
  const s = S.newPark("sandbox");
  s.guests = [];
  s.cash = 1e6;
  const b = s.buildings.find((b) => b.kind === "coaster");
  const original = E.editableTrack(b),
    input = snapshot(s),
    r = R.planRideProfile(s, b.id, 2, 6, "comfort", "brake");
  assert(r.plan, r.error);
  assert.equal(snapshot(s), input);
  assert.equal(
    snapshot(r.plan.track.map(({ drive, ...p }) => p)),
    snapshot(original.map(({ drive, ...p }) => p)),
  );
  assert.deepEqual(r.plan.before, G.analyzeForces(b.track));
  assert.deepEqual(r.plan.after, G.analyzeForces(r.plan.track));
  assert.equal(R.commitRideProfile(s, r.plan), null);
  assert(S.validSave(JSON.parse(snapshot(s))));
  return {
    points: r.plan.track.length,
    before: r.plan.before.comfort,
    after: r.plan.after.comfort,
  };
});
test("New prefab endpoint tangents and integer anchors", () => {
  const expected = {
    airtime: [6, 0, 0, 0],
    bunny: [8, 0, 0, 0],
    helixleft: [0, -6, 1, -Math.PI],
    helixright: [0, 6, 1, Math.PI],
    doubleloop: [8, 0, 0, 0],
  };
  const details = [];
  for (const [piece, [x, y, z, h]] of Object.entries(expected)) {
    const start = P.startTrack({ x: 12, y: 12 });
    const next = P.appendPiece(start, piece);
    const last = next.at(-1);
    assert(Math.hypot(last.x - 12 - x, last.y - 12 - y, last.z - z) < 1e-6);
    assert(Math.cos(last.heading - h) > 0.999999);
    const begin = next[1],
      prev = next.at(-2);
    assert(Math.abs(Math.atan2(begin.y - 12, begin.x - 12)) < 0.1);
    assert(Math.cos(Math.atan2(last.y - prev.y, last.x - prev.x) - h) > 0.995);
    const { s } = fixture();
    s.buildings = [];
    assert.equal(P.pieceError(s, start, next, true), null, piece);
    details.push({ piece, points: next.length, length: S.trackStats(next).length });
  }
  return details;
});
test("Wood rejects doubleloop while other new piece types have finite force samples", () => {
  const { s } = fixture();
  s.buildings = [];
  const start = P.startTrack({ x: 12, y: 12 }, 0, "wood");
  assert.match(P.pieceError(s, start, P.appendPiece(start, "doubleloop"), true), /Holz|Loop/);
  for (const piece of ["airtime", "bunny", "helixleft", "helixright"]) {
    const t = P.appendPiece(start, piece);
    assert.equal(P.pieceError(s, start, t, true), null);
    const a = G.analyzeForces(t);
    assert(Number.isFinite(a.fun) && Number.isFinite(a.comfort));
    assert(a.samples.every((s) => Number.isFinite(s.total)));
  }
});
console.log(`${tests.filter((x) => x.pass).length}/${tests.length} passed`);
process.exitCode = tests.every((x) => x.pass) ? 0 : 1;

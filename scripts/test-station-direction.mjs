import assert from "node:assert/strict";
import { moduleURL } from "../scripts/ts-loader.mjs";
process.on("uncaughtException", (error) => {
  console.error(error.message);
  process.exit(1);
});
const S = await import(moduleURL("game/simulation.ts")),
  C = await import(moduleURL("game/construction.ts")),
  F = await import(moduleURL("game/prefabs.ts")),
  E = await import(moduleURL("game/track-edit.ts")),
  M = await import(moduleURL("game/motion.ts")),
  D = await import(moduleURL("game/drive.ts")),
  V = await import(moduleURL("game/station-direction.ts"));
const results = [];
const clone = (x) => structuredClone(x);
function test(name, fn) {
  try {
    results.push({ name, pass: true, evidence: fn() });
  } catch (e) {
    results.push({ name, pass: false, error: e.message.slice(0, 1200) });
  }
  console.log(JSON.stringify(results.at(-1)));
}
function empty() {
  const s = S.newPark("sandbox"),
    g = clone(s.guests[0]);
  s.buildings = [];
  s.guests = [];
  s.transitLines = [];
  s.tiles = s.tiles.map((r) => r.map(() => "grass"));
  s.cash = 100000;
  s.open = false;
  return { s, g };
}
function fixture(style = "steel", legacy = false) {
  const { s, g } = empty(),
    track = legacy ? C.blueprint({ x: 7, y: 7 }) : F.prefabBlueprint({ x: 8, y: 8 }, 0, style);
  const built = S.build(s, "coaster", track[0].x, track[0].y, track);
  assert(!built.error, built.error);
  const b = s.buildings.find((b) => b.id === built.id);
  b.pods = S.effectivePods(s, b);
  b.tested = true;
  b.open = true;
  return { s, b, g };
}
const pos = (p) => `${p.x.toFixed(8)},${p.y.toFixed(8)},${(p.z ?? 0).toFixed(8)}`;
function edges(t) {
  return t
    .slice(0, -1)
    .map((p, i) =>
      JSON.stringify([[pos(p), pos(t[i + 1])].sort(), p.drive ?? null, !!t[i + 1].inversion]),
    )
    .sort();
}
const diff = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
test("Dense reversal preserves each physical edge, outgoing module and incoming inversion", () => {
  const { s, b } = fixture();
  b.track = b.track.map((p, i) => ({
    ...p,
    drive:
      i > 60 && i < 130
        ? { kind: "boost", speed: 58, strength: 7 }
        : i > 200 && i < 240
          ? { kind: "brake", speed: 18, strength: 3 }
          : undefined,
  }));
  b.track[b.track.length - 1] = { ...b.track[0] };
  const dense = E.editableTrack(b),
    before = clone(b),
    reverse = V.reverseTrackAtStation(b);
  assert.deepEqual(edges(reverse), edges(dense));
  assert.deepEqual(b, before);
  assert.equal(pos(reverse[0]), pos(dense[0]));
  assert.equal(D.driveCost(reverse), D.driveCost(dense));
  assert(Math.abs(Math.cos(reverse[0].heading - dense[0].heading) + 1) < 1e-8);
  return { points: reverse.length, hardwareCost: D.driveCost(reverse) };
});
test("Actual loop stays upside down at the top after reverse and inverse edge mapping", () => {
  const { s, b } = fixture("launch");
  const d = E.editableTrack(b),
    reverse = V.reverseTrackAtStation(b);
  assert.deepEqual(edges(reverse), edges(d));
  const a = M.prepareRoute(d),
    r = M.prepareRoute(reverse);
  const imax = a.points.reduce(
      (best, p, i) => ((p.z ?? 0) > (a.points[best].z ?? 0) ? i : best),
      0,
    ),
    p = a.points[imax];
  const j = r.points.reduce((best, q, i) => (diff(q, p) < diff(r.points[best], p) ? i : best), 0);
  assert(a.ups[imax].z < -0.5);
  assert(r.ups[j].z < -0.5);
  return { topZ: p.z, upBefore: a.ups[imax].z, upAfter: r.ups[j].z };
});
test("Reversing twice restores exact dense geometry and physical metadata", () => {
  const { s, b } = fixture();
  const d = E.editableTrack(b),
    twice = V.reverseTrackAtStation({ ...b, track: V.reverseTrackAtStation(b) });
  assert.deepEqual(edges(twice), edges(d));
  assert.equal(pos(twice[0]), pos(d[0]));
  for (let i = 0; i < d.length; i++) assert(Math.cos(twice[i].heading - d[i].heading) > 0.9999999);
});
test("Legacy reverse preserves actual rounded route and fractional station anchor", () => {
  const { s, b } = fixture("steel", true),
    route = M.prepareRoute(b.track),
    reverse = V.reverseTrackAtStation(b),
    r = M.prepareRoute(reverse);
  assert.equal(b.track[0].smooth, undefined);
  assert(diff(route.points[0], r.points[0]) < 1e-9);
  assert(Math.abs(route.length - r.length) < 1e-8);
  let max = 0;
  for (let i = 0; i <= 200; i++) {
    const distance = (route.length * i) / 200;
    max = Math.max(
      max,
      diff(M.routePosition(route, distance), M.routePosition(r, r.length - distance)),
    );
  }
  assert(max < 1e-6, `${max}tiles`);
  assert(reverse[0].smooth);
  return { points: reverse.length, anchor: reverse[0], maxErrorTiles: max };
});
test("Existing blue/red ports prevent unsafe automatic pod rotation; preserve mode succeeds", () => {
  const { s, b } = fixture();
  const P = Object.values(b.pods);
  const pod = (p) =>
    p.side === 0
      ? { x: b.x + 1, y: b.y }
      : p.side === 1
        ? { x: b.x, y: b.y + 1 }
        : p.side === 2
          ? { x: b.x - 1, y: b.y }
          : { x: b.x, y: b.y - 1 };
  const a = pod(P[0]),
    z = pod(P[1]);
  s.tiles[a.y][a.x] = "queue";
  s.tiles[z.y][z.x] = "exit";
  const before = clone(s),
    bad = V.planStationReverse(s, b, { rotatePods: true });
  assert(bad.error);
  assert.deepEqual(s, before);
  const good = V.planStationReverse(s, b);
  assert.equal(good.error, null);
  assert.deepEqual(good.geometry.pods, b.pods);
  return { blocked: bad.error };
});
test("Successful reverse interrupts test and actual riders, preserves accounts; Undo after ticks restores geometry/test", () => {
  const { s, b, g } = fixture();
  Object.assign(b, { served: 12, revenue: 123, testing: 9, testDuration: 20, autoOpen: true });
  Object.assign(g, { id: s.nextId++, target: b.id, state: "ride", x: b.x, y: b.y, route: [] });
  s.guests = [g];
  b.riders = [g.id];
  b.cycle = 10;
  const original = clone(b.track),
    cash = s.cash,
    time = s.time,
    plan = V.planStationReverse(s, b);
  assert.equal(plan.error, null);
  const record = C.recordEdit(s, "Station umkehren", () =>
    assert.equal(V.commitStationReverse(s, plan), null),
  );
  assert(record);
  assert.equal(b.open, false);
  assert.equal(b.tested, false);
  assert.equal(b.testing, undefined);
  assert.deepEqual(b.riders, []);
  assert.equal(g.state, "walk");
  assert.equal(b.revenue, 123);
  assert.equal(b.served, 12);
  assert.equal(s.cash, cash);
  S.tick(s, 1);
  const elapsed = s.time;
  assert(elapsed > time);
  assert(S.validSave(clone(s)));
  assert(!C.undoEdits(s, [record]));
  assert.deepEqual(b.track, original);
  assert(b.tested);
  assert.equal(s.time, elapsed);
  assert.equal(b.revenue, 123);
  assert(S.validSave(clone(s)));
});
test("Stale geometry, active drafts and late blocked pods reject without any mutation", () => {
  const { s, b } = fixture(),
    plan = V.planStationReverse(s, b);
  b.track = b.track.map((p, i) => (i === 0 ? { ...p, heading: p.heading + Math.PI * 2 } : p));
  let before = clone(s);
  assert(V.commitStationReverse(s, plan));
  assert.deepEqual(s, before);
  s.draft = { track: [{ x: 2, y: 2, z: 0, smooth: true, style: "steel" }] };
  before = clone(s);
  assert(V.planStationReverse(s, b).error);
  assert.deepEqual(s, before);
});
test("Free direction change works during negative cash; paid pod clearing rejects low budget atomically", () => {
  const { s, b } = fixture();
  s.cash = -10;
  assert.equal(V.planStationReverse(s, b).error, null);
  s.cash = 100000;
  const rotated = V.planStationReverse(s, b, { rotatePods: true });
  assert.equal(rotated.error, null);
  const p = rotated.geometry.pods.entry;
  const x = p.side === 0 ? b.x + 1 : p.side === 2 ? b.x - 1 : b.x,
    y = p.side === 1 ? b.y + 1 : p.side === 3 ? b.y - 1 : b.y;
  assert(!S.build(s, "tree", x, y).error);
  const quote = V.planStationReverse(s, b, { rotatePods: true });
  assert.equal(quote.cost, 10);
  assert.equal(quote.error, null);
  s.cash = 9;
  const before = clone(s);
  assert(V.commitStationReverse(s, quote));
  assert.deepEqual(s, before);
});
test("A new functional building at the proposed rotated pod rejects the old quote atomically", () => {
  const { s, b } = fixture(),
    plan = V.planStationReverse(s, b, { rotatePods: true });
  assert.equal(plan.error, null);
  const p = plan.geometry.pods.entry;
  const x = p.side === 0 ? b.x + 1 : p.side === 2 ? b.x - 1 : b.x,
    y = p.side === 1 ? b.y + 1 : p.side === 3 ? b.y - 1 : b.y;
  assert(!S.build(s, "burger", x, y).error);
  const before = clone(s);
  assert(V.commitStationReverse(s, plan));
  assert.deepEqual(s, before);
});
for (const style of ["steel", "wood", "launch"])
  test(`${style}: reversed route and save remain finite and valid`, () => {
    const { s, b } = fixture(style),
      plan = V.planStationReverse(s, b);
    assert.equal(plan.error, null);
    assert.equal(V.commitStationReverse(s, plan), null);
    const r = M.prepareRoute(b.track);
    assert(Number.isFinite(r.duration) && r.duration > 0);
    assert.equal(r.speeds[0], 0);
    assert.equal(r.speeds.at(-1), 0);
    assert(S.validSave(clone(s)));
    return { duration: r.duration, length: r.length, station: V.stationOrientation(b) };
  });
test("Existing whole-ride90° relocation rotates geometry, heading and pods coherently", () => {
  const { s, b } = fixture(),
    old = V.stationOrientation(b),
    p = C.planRelocation(s, b, { x: b.x, y: b.y }, 1);
  assert.equal(p.error, null);
  const next = V.stationOrientation({ ...b, ...p.geometry });
  assert(Math.abs(Math.cos(next.heading - old.heading)) < 1e-5);
  assert(Math.sin(next.heading - old.heading) > 0.99999);
  return { before: old.direction, after: next.direction };
});
console.log(`${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exitCode = results.every((r) => r.pass) ? 0 : 1;

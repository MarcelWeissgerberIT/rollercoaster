import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  C = await import(moduleURL("game/construction.ts")),
  E = await import(moduleURL("game/track-edit.ts")),
  P = await import(moduleURL("game/prefabs.ts")),
  M = await import(moduleURL("game/motion.ts"));
const results = [];
const test = (name, fn) => {
  try {
    const evidence = fn();
    results.push({ name, pass: true, evidence });
  } catch (e) {
    results.push({ name, pass: false, error: e.message });
  }
};
const mk = (style = "steel", hill = false, drive = null) => {
  const t = [];
  const add = (x, y, heading) => {
    const z = hill && y === 5 ? Math.min(3, Math.max(0, (x - 14) / 2)) : hill ? 3 : 0;
    t.push({
      x,
      y,
      z,
      smooth: true,
      style,
      heading,
      ...(drive && y === 5 && x >= 14 && x < 24 ? { drive } : {}),
    });
  };
  for (let x = 5; x < 30; x += 0.125) add(x, 5, 0);
  for (let y = 5; y < 25; y += 0.125) add(30, y, Math.PI / 2);
  for (let x = 30; x > 5; x -= 0.125) add(x, 25, Math.PI);
  for (let y = 25; y > 5; y -= 0.125) add(5, y, -Math.PI / 2);
  t.push({ ...t[0] });
  return t;
};
const at = (r, x) => r.points.findIndex((p) => p.y === 5 && p.x >= x);
for (const kind of ["boost", "brake"])
  test(`Flat ${kind}: strength 10 differs correctly from 3`, () => {
    const a = M.prepareRoute(
        mk(kind === "boost" ? "steel" : "launch", false, {
          kind,
          speed: kind === "boost" ? 82 : 15,
          strength: 3,
        }),
      ),
      b = M.prepareRoute(
        mk(kind === "boost" ? "steel" : "launch", false, {
          kind,
          speed: kind === "boost" ? 82 : 15,
          strength: 10,
        }),
      );
    const i = at(a, 16);
    assert(kind === "boost" ? b.speeds[i] > a.speeds[i] : b.speeds[i] < a.speeds[i]);
    return { atX: 16, strength3KmH: a.speeds[i] * 3.6, strength10KmH: b.speeds[i] * 3.6 };
  });
test("Low boost is exact no-op on fast flat section", () => {
  const a = M.prepareRoute(mk()),
    b = M.prepareRoute(mk("steel", false, { kind: "boost", speed: 5, strength: 10 }));
  assert.deepEqual(a.speeds, b.speeds);
  assert.equal(a.duration, b.duration);
});
test("Weak uphill boost never slows down normal lift", () => {
  const a = M.prepareRoute(mk("steel", true)),
    b = M.prepareRoute(mk("steel", true, { kind: "boost", speed: 12, strength: 0.5 }));
  for (let i = at(a, 15); i < at(a, 19); i++)
    assert(
      b.speeds[i] + 1e-7 >= a.speeds[i],
      `${b.speeds[i] * 3.6} < ${a.speeds[i] * 3.6} km/h at ${b.points[i].x}`,
    );
  return { base: a.speeds[at(a, 16)] * 3.6, withBoost: b.speeds[at(b, 16)] * 3.6 };
});
test("Weak 5 km/h brake reaches target, no artificial 2m/s reset", () => {
  const b = M.prepareRoute(mk("steel", false, { kind: "brake", speed: 5, strength: 0.5 }));
  assert(b.speeds[at(b, 22)] * 3.6 <= 5.0001);
  return { atX22KmH: b.speeds[at(b, 22)] * 3.6 };
});
for (const [style, cap] of [
  ["steel", 23],
  ["wood", 19],
  ["launch", 26],
])
  test(`${style} cap and station stop survive strong booster`, () => {
    const r = M.prepareRoute(mk(style, false, { kind: "boost", speed: 100, strength: 12 }));
    assert(r.speeds.every((v) => Number.isFinite(v) && v >= 0 && v <= cap + 1e-7));
    assert.equal(r.speeds[0], 0);
    assert.equal(r.speeds.at(-1), 0);
    return { maxKmH: Math.max(...r.speeds) * 3.6, duration: r.duration };
  });
const fixture = (legacy = true) => {
  const s = S.newPark("sandbox");
  s.guests = [];
  let b = s.buildings.find((b) => b.kind === "coaster");
  if (!legacy) {
    s.buildings = [];
    s.transitLines = [];
    s.tiles = Array.from({ length: 30 }, () => Array(30).fill("grass"));
    const track = P.prefabBlueprint({ x: 14, y: 14 }, 0, "steel"),
      out = S.build(s, "coaster", 14, 14, track);
    assert(!out.error, out.error);
    b = s.buildings.find((b) => b.id === out.id);
  }
  b.open = true;
  b.tested = true;
  return { s, b };
};
const drive = { kind: "boost", speed: 60, strength: 4 };
for (const legacy of [true, false]) {
  test(`${legacy ? "legacy" : "prefab"} unchanged hardware preserves operation and undo`, () => {
    const { s, b } = fixture(legacy);
    for (const value of [null, drive]) {
      if (value) E.installTrackDrive(s, b, 1, 2, value);
      b.open = true;
      b.tested = true;
      const original = b.track,
        cash = s.cash,
        cycle = b.cycle;
      assert.equal(E.trackDrivePlan(b, 1, 2, value).changed, false);
      const rec = C.recordEdit(s, "unchanged module", () =>
        assert.equal(E.installTrackDrive(s, b, 1, 2, value), null),
      );
      assert.equal(b.track, original);
      assert.equal(s.cash, cash);
      assert.equal(b.cycle, cycle);
      assert(b.open && b.tested);
      if (rec) C.undoEdits(s, [rec]);
      assert(b.open && b.tested);
    }
  });
  test(`${legacy ? "legacy" : "prefab"} geometry unchanged, cash, refund and save`, () => {
    const { s, b } = fixture(legacy),
      old = b.track,
      prev = M.prepareRoute(old),
      cash = s.cash;
    const plan = E.trackDrivePlan(b, 1, 2, drive);
    assert.equal(plan.error, null);
    assert.equal(E.installTrackDrive(s, b, 1, 2, drive), null);
    assert.equal(s.cash, cash - plan.cost);
    assert.deepEqual(
      b.track.map(({ drive, ...p }) => p),
      old.map(({ drive, ...p }) => p),
    );
    assert.deepEqual(b.track.at(-1), b.track[0]);
    assert.deepEqual(
      M.prepareRoute(b.track).points.map(({ drive, ...p }) => p),
      prev.points.map(({ drive, ...p }) => p),
    );
    assert(S.validSave(JSON.parse(JSON.stringify(s))));
    assert.equal(E.trackDrivePlan(b, 1, 2, { ...drive, speed: 10, strength: 12 }).cost, 0);
    assert.equal(E.installTrackDrive(s, b, 1, 2, null), null);
    assert(s.cash < cash);
    return { price: plan.cost, refund: s.cash - (cash - plan.cost) };
  });
  test(`${legacy ? "legacy" : "prefab"} undo restores tested/open/geometry and retains live time`, () => {
    const { s, b } = fixture(legacy),
      old = JSON.stringify(b.track),
      cash = s.cash;
    const rec = C.recordEdit(s, "module", () =>
      assert.equal(E.installTrackDrive(s, b, 1, 2, drive), null),
    );
    S.tick(s, 0.5);
    const time = s.time;
    C.undoEdits(s, [rec]);
    assert.equal(JSON.stringify(b.track), old);
    assert.equal(s.cash, cash);
    assert.equal(s.time, time);
    assert.equal(b.open, true);
    assert.equal(b.tested, true);
  });
  test(`${legacy ? "legacy" : "prefab"} cash0 atomic and successful install releases test`, () => {
    const { s, b } = fixture(legacy),
      old = JSON.stringify(b.track);
    s.cash = 0;
    b.testing = 2;
    b.testDuration = 10;
    b.autoOpen = true;
    assert(E.installTrackDrive(s, b, 1, 2, drive));
    assert.equal(JSON.stringify(b.track), old);
    assert(b.open && b.testing === 2 && b.tested && b.autoOpen);
    s.cash = 100000;
    assert.equal(E.installTrackDrive(s, b, 1, 2, drive), null);
    assert(
      !b.open &&
        !b.tested &&
        b.testing === undefined &&
        b.testDuration === undefined &&
        !b.autoOpen,
    );
  });
}
test("Station reorder and rotation preserve every outgoing addon", () => {
  const { s, b } = fixture(false);
  assert.equal(E.installTrackDrive(s, b, 1, 2, drive), null);
  const payload = (t) =>
    JSON.stringify(
      t
        .slice(0, -1)
        .filter((p) => p.drive)
        .map((p) => [p.x, p.y, p.z, p.drive])
        .sort(),
    );
  const before = payload(b.track);
  const pos = C.stationPositions(b).find((p) => p.x !== b.x || p.y !== b.y);
  assert(pos);
  assert.equal(C.adjustBuilding(s, b, "station", pos), null);
  assert.equal(payload(b.track), before);
  const plan = C.planRelocation(s, b, { x: b.x, y: b.y }, 1);
  assert(!plan.error, plan.error);
  for (let i = 0; i < b.track.length; i++)
    assert.deepEqual(plan.geometry.track[i].drive, b.track[i].drive);
});
test("Save rejects malformed drive in retained track-edit suffix", () => {
  const { s, b } = fixture(false);
  assert.equal(E.beginTrackEdit(s, b, 1, 1), null);
  s.trackEdit.suffix[1].drive = { kind: "boost", speed: NaN, strength: 4 };
  assert.equal(S.validSave(s), false);
});
test("A brake accumulates on the chain lift instead of resetting to lift speed", () => {
  const r = M.prepareRoute(mk("steel", true, { kind: "brake", speed: 5, strength: 0.5 }));
  assert(r.speeds[at(r, 19)] * 3.6 <= 5.001);
});
test("High target brake does not accelerate or change a normal lift", () => {
  assert.deepEqual(
    M.prepareRoute(mk("steel", true)).speeds,
    M.prepareRoute(mk("steel", true, { kind: "brake", speed: 100, strength: 4 })).speeds,
  );
});
for (const r of results)
  console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.error ? " · " + r.error : ""));
process.exitCode = results.some((r) => !r.pass) ? 1 : 0;

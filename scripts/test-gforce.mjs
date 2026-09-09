import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const M = await import(moduleURL("game/motion.ts")),
  P = await import(moduleURL("game/prefabs.ts")),
  S = await import(moduleURL("game/simulation.ts")),
  F = await import(moduleURL("game/gforce.ts"));
const g = 9.81,
  tests = [];
const near = (a, b, tol = 1e-5) => assert(Math.abs(a - b) < tol, `${a} not within ${tol} of ${b}`);
const test = (name, fn) => {
  try {
    const evidence = fn();
    tests.push({ name, pass: true, evidence });
  } catch (e) {
    tests.push({ name, pass: false, error: e.message.slice(0, 1000) });
  }
};
const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const norm = (p) => {
  const l = Math.hypot(p.x, p.y, p.z);
  return { x: p.x / l, y: p.y / l, z: p.z / l };
};
function analytic(points, tangents, rights, ups, speeds) {
  const distance = [0],
    cost = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      ds = Math.hypot(b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0));
    distance.push(distance.at(-1) + ds);
    cost.push(cost.at(-1) + (10 * ds) / Math.max(0.08, speeds[i - 1] + speeds[i]));
  }
  return {
    points,
    tangents,
    rights,
    ups,
    speeds,
    distance,
    cost,
    length: distance.at(-1),
    duration: cost.at(-1),
    phases: points.map(() => "coast"),
  };
}
function straight(accel = 0, backwards = false, n = 200) {
  const p = [],
    t = [],
    r = [],
    u = [],
    v = [];
  for (let i = 0; i <= n; i++) {
    const x = (50 * i) / n;
    p.push({ x: x / 5, y: 0, z: 0, smooth: true, heading: 0, style: "steel" });
    t.push({ x: 1, y: 0, z: 0 });
    r.push({ x: 0, y: -1, z: 0 });
    u.push({ x: 0, y: 0, z: 1 });
    v.push(accel ? Math.sqrt(2 * Math.abs(accel) * (backwards ? 50 - x : x)) : 10);
  }
  return analytic(p, t, r, u, v);
}
function circle({
  R = 10,
  speed = 10,
  n = 512,
  vertical = false,
  mirror = false,
  bank = 0,
  crest = false,
} = {}) {
  const p = [],
    t = [],
    r = [],
    u = [],
    v = [];
  for (let i = 0; i <= n; i++) {
    const angle = crest ? -0.8 + (1.6 * i) / n : (2 * Math.PI * i) / n;
    let tangent, up, right;
    if (vertical || crest) {
      p.push({
        x: (R * Math.sin(angle)) / 5,
        y: 0,
        z: (R * (crest ? Math.cos(angle) : 1 - Math.cos(angle))) / 5,
        smooth: true,
        inversion: vertical,
        style: "steel",
      });
      tangent = { x: Math.cos(angle), y: 0, z: (crest ? -1 : 1) * Math.sin(angle) };
      right = { x: 0, y: -1, z: 0 };
      up = cross(right, tangent);
    } else {
      const sign = mirror ? -1 : 1;
      p.push({
        x: (R * Math.sin(angle)) / 5,
        y: (sign * R * (1 - Math.cos(angle))) / 5,
        z: 0,
        smooth: true,
        style: "steel",
      });
      tangent = { x: Math.cos(angle), y: sign * Math.sin(angle), z: 0 };
      up = {
        x: -Math.sin(angle) * Math.sin(bank),
        y: sign * Math.cos(angle) * Math.sin(bank),
        z: Math.cos(bank),
      };
      right = norm(cross(tangent, up));
    }
    t.push(tangent);
    r.push(right);
    u.push(up);
    v.push(speed);
  }
  return analytic(p, t, r, u, v);
}
test("Flat stationary and moving train: vertical1, no lateral/longitudinal, total1", () => {
  const route = straight();
  for (const override of [undefined, { stationary: true }]) {
    const f = F.forceAt(route, 5, override);
    near(f.vertical, 1);
    near(f.lateral, 0);
    near(f.longitudinal, 0);
    near(f.total, 1);
  }
  return F.forceAt(route, 5);
});
test("Accelerating and braking straight have correct sign and m/s² conversion", () => {
  const a = F.forceAt(straight(3), 5),
    b = F.forceAt(straight(-3, true), 5);
  near(a.longitudinal, 3 / g);
  near(b.longitudinal, -3 / g);
  near(a.vertical, 1);
  return { acceleration: a, braking: b };
});
test("Exactly stopped endpoints have gravity only, no launch derivative leakage", () => {
  const a = F.forceAt(straight(3), 0),
    b = F.forceAt(straight(-3, true), 10);
  near(a.longitudinal, 0);
  near(b.longitudinal, 0);
  near(a.total, 1);
  near(b.total, 1);
});
test("Actual motion departure uses2m/s² and launch uses12m/s²", () => {
  const t = Array.from({ length: 101 }, (_, i) => ({
    x: i / 10,
    y: 0,
    z: 0,
    smooth: true,
    heading: 0,
    style: "steel",
  }));
  const r = M.prepareRoute(t),
    l = M.prepareRoute(t.map((p) => ({ ...p, style: "launch" })));
  near(F.forceAt(r, 1).longitudinal, 2 / g, 1e-6);
  near(F.forceAt(l, 1).longitudinal, 12 / g, 1e-6);
  return { steel: F.forceAt(r, 1), launch: F.forceAt(l, 1) };
});
test("Horizontal radius10m at10m/s has v²/R lateral g; mirror flips wagon-axis sign", () => {
  const r = circle(),
    m = circle({ mirror: true }),
    a = F.forceAt(r, r.length / 4),
    b = F.forceAt(m, m.length / 4);
  near(a.lateral, 100 / (10 * g), 0.006);
  near(b.lateral, -a.lateral, 1e-6);
  near(a.vertical, 1);
  return { a, b };
});
test("Properly banked turn moves lateral load into wagon vertical axis", () => {
  const route = circle({ bank: Math.atan(100 / (10 * g)) }),
    a = F.forceAt(route, route.length / 4);
  near(a.lateral, 0, 0.007);
  near(a.vertical, Math.hypot(1, 100 / (10 * g)), 0.007);
  return a;
});
test("Loop bottom2g and inverted apex0g at v=sqrt(gR), no false airtime bonus", () => {
  const route = circle({ vertical: true, speed: Math.sqrt(g * 10) }),
    bottom = F.forceAt(route, 0),
    top = F.forceAt(route, route.length / 2),
    a = F.analyzeRouteForces(route);
  near(bottom.vertical, 2, 0.006);
  near(top.vertical, 0, 0.006);
  near(top.total, 0, 0.006);
  near(a.airtime, 0, 0.01);
  assert(a.invertedTime > 2);
  return { bottom, top, airtime: a.airtime, invertedTime: a.invertedTime };
});
test("Upright crest gives0g and measured airtime in seconds", () => {
  const route = circle({ crest: true, speed: Math.sqrt(g * 10) }),
    a = F.analyzeRouteForces(route),
    mid = F.forceAt(route, route.length / 2);
  near(mid.vertical, 0, 0.006);
  assert(a.airtime > 0.8 * route.duration);
  assert(a.airtime <= route.duration + 1e-9);
  return { mid, airtime: a.airtime, duration: route.duration };
});
test("Static inverted wagon reads -1 vertical g, not +1", () => {
  const route = circle({ vertical: true });
  const f = F.forceAt(route, route.length / 2, { stationary: true });
  near(f.vertical, -1, 1e-8);
  near(f.total, 1, 1e-8);
  return f;
});
test("Time lookup inverts trainDistance including acceleration and braking", () => {
  for (const route of [
    straight(3),
    straight(-3, true),
    M.prepareRoute(P.prefabBlueprint({ x: 14, y: 14 }, 0, "steel")),
  ])
    for (let i = 1; i < 99; i++) {
      const time = (route.duration * i) / 100,
        d = M.trainDistance(route, time / route.duration);
      near(F.forceTimeAtDistance(route, d), time, 1e-6);
    }
});
test("Empty and one-point routes stay finite without force NaNs", () => {
  for (const track of [[], [{ x: 0, y: 0, z: 0, smooth: true, style: "steel" }]]) {
    const a = F.analyzeForces(track);
    assert(Object.values(a.peaks).every(Number.isFinite));
    assert(a.samples.every((p) => Object.values(p).every(Number.isFinite)));
    near(a.duration, 0);
    near(a.airtime, 0);
  }
});
test("Resampling same polyline preserves force profile, peaks and airtime", () => {
  const coarse = P.prefabBlueprint({ x: 14, y: 14 }, 0, "launch"),
    dense = [];
  for (let i = 0; i < coarse.length - 1; i++) {
    const a = coarse[i],
      b = coarse[i + 1];
    for (let k = 0; k < 3; k++)
      dense.push({
        ...a,
        x: a.x + ((b.x - a.x) * k) / 3,
        y: a.y + ((b.y - a.y) * k) / 3,
        z: a.z + ((b.z - a.z) * k) / 3,
        inversion: b.inversion,
      });
  }
  dense.push({ ...coarse.at(-1) });
  // Same velocity profile isolates force sampling from current drive/friction integrator discretization.
  const r = M.prepareRoute(coarse),
    q = M.prepareRoute(dense);
  q.speeds = q.distance.map((d) => M.routePosition(r, d).speed);
  q.cost = q.distance.map((d) => F.forceTimeAtDistance(r, d));
  q.duration = r.duration;
  let error = 0,
    axisError = 0;
  for (let i = 1; i < 500; i++) {
    const d = (r.length * i) / 500,
      a = F.forceAt(r, d),
      b = F.forceAt(q, d);
    error = Math.max(error, Math.abs(a.total - b.total));
    axisError = Math.max(
      axisError,
      Math.abs(a.vertical - b.vertical),
      Math.abs(a.lateral - b.lateral),
      Math.abs(a.longitudinal - b.longitudinal),
    );
  }
  assert(error < 0.08, `Density error ${error}g`);
  assert(axisError < 0.12, `Axis density error ${axisError}g`);
  const ar = F.analyzeRouteForces(r),
    aq = F.analyzeRouteForces(q);
  near(ar.peaks.total, aq.peaks.total, 0.06);
  near(ar.airtime, aq.airtime, 0.05);
  return {
    maxTotalError: error,
    maxAxisError: axisError,
    peakTotalDelta: Math.abs(ar.peaks.total - aq.peaks.total),
    airtimeDelta: Math.abs(ar.airtime - aq.airtime),
  };
});
test("Real prefab and legacy metrics are finite, deterministic, cached and leave route untouched", () => {
  const rows = [];
  for (const style of ["steel", "wood", "launch", "legacy"]) {
    const track =
        style === "legacy"
          ? S.newPark("sandbox").buildings.find((b) => b.kind === "coaster").track
          : P.prefabBlueprint({ x: 14, y: 14 }, 0, style),
      old = JSON.stringify(track),
      start = performance.now(),
      a = F.analyzeForces(track);
    assert.equal(F.analyzeForces(track), a);
    assert.equal(JSON.stringify(track), old);
    assert(a.samples.every((p) => Object.values(p).every(Number.isFinite)));
    assert(a.airtime <= a.duration);
    assert(a.fun >= 0 && a.fun <= 100 && a.comfort >= 0 && a.comfort <= 100);
    rows.push({
      style,
      ms: performance.now() - start,
      ...Object.fromEntries(Object.entries(a).filter(([k]) => k !== "samples")),
    });
  }
  return rows;
});
test("Overpowered tight turn loses comfort/fun despite speed gain", () => {
  const mild = F.analyzeRouteForces(circle({ speed: 10 })),
    rough = F.analyzeRouteForces(circle({ speed: 22 }));
  assert(rough.comfort < mild.comfort);
  assert(rough.fun < mild.fun, `${rough.fun} >= ${mild.fun}`);
  return {
    mild: { fun: mild.fun, comfort: mild.comfort },
    rough: { fun: rough.fun, comfort: rough.comfort },
  };
});
for (const t of tests)
  console.log((t.pass ? "PASS " : "FAIL ") + t.name + (t.error ? " " + t.error : ""));
console.log(`${tests.filter((t) => t.pass).length}/${tests.length} passed`);
process.exitCode = tests.some((t) => !t.pass) ? 1 : 0;

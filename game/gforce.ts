/**
 * Prototype for game/gforce.ts. Change this absolute import to './motion' when integrating.
 * Coordinates are simulation x/y/z, z upwards. Route distances use tiles; speed uses m/s.
 * Specific force = acceleration - gravity, projected onto the actual 3D wagon axes.
 * makeRidePath negates motion.right after the x/z/y coordinate conversion: lateral is -right.
 * The route is a polyline, so its mathematical vertex accelerations are impulses. We report
 * a reproducible spatially filtered estimate (2 m window, 7 taps), never an input-sample derivative.
 * Display raw resulting peaks; do not clip forces to comfortable values.
 */
import { prepareRoute, routePosition, type RouteMotion, type Vec } from "./motion";
export const GRAVITY = 9.81;
export const METERS_PER_TILE = 5;
export const CURVATURE_HALF_WINDOW_METERS = 1;
export type Forces = { vertical: number; lateral: number; longitudinal: number; total: number };
export type ForceSample = Forces & { distance: number; time: number; speed: number; upZ: number };
export type ForceAnalysis = {
  peaks: { vertical: number; lateral: number; longitudinal: number; total: number };
  minVertical: number;
  maxLateral: number;
  maxLongitudinal: number;
  airtime: number;
  negativeGTime: number;
  invertedTime: number;
  duration: number;
  maxSpeed: number;
  meanSpeed: number;
  verticalRms: number;
  lateralRms: number;
  longitudinalRms: number;
  jerk95: number;
  fun: number;
  comfort: number;
  intensity: number;
  sampleStepMeters: number;
  filterWindowMeters: number;
  samples: ForceSample[];
};
const add = (a: Vec, b: Vec, f = 1): Vec => ({
  x: a.x + b.x * f,
  y: a.y + b.y * f,
  z: a.z + b.z * f,
});
const mul = (v: Vec, f: number): Vec => ({ x: v.x * f, y: v.y * f, z: v.z * f });
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const length = (v: Vec) => Math.hypot(v.x, v.y, v.z);
const taps = [-1, -2 / 3, -1 / 3, 0, 1 / 3, 2 / 3, 1];
const weights = [1, 2, 3, 4, 3, 2, 1];
const isClosed = (r: RouteMotion) =>
  r.points.length > 1 &&
  Math.hypot(
    r.points[0].x - r.points.at(-1)!.x,
    r.points[0].y - r.points.at(-1)!.y,
    (r.points[0].z ?? 0) - (r.points.at(-1)!.z ?? 0),
  ) < 1e-6;
function canonicalDistance(r: RouteMotion, d: number) {
  if (!Number.isFinite(d) || r.length <= 0) return 0;
  return d === r.length
    ? r.length
    : isClosed(r)
      ? ((d % r.length) + r.length) % r.length
      : clamp(d, 0, r.length);
}
function upper(values: number[], target: number) {
  let lo = 1,
    hi = values.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (values[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
/** Time on the same constant-acceleration-per-segment schedule used by trainDistance. */
export function forceTimeAtDistance(r: RouteMotion, d: number) {
  if (r.distance.length < 2 || r.length <= 0) return 0;
  d = clamp(d, 0, r.length);
  if (d === r.length) return r.duration;
  const i = upper(r.distance, d),
    v0 = r.speeds[i - 1],
    v = routePosition(r, d).speed,
    ds = (d - r.distance[i - 1]) * METERS_PER_TILE;
  return clamp(r.cost[i - 1] + (2 * ds) / Math.max(0.08, v0 + v), r.cost[i - 1], r.cost[i]);
}
/** Position-only lookup: invariant if an existing straight edge is subdivided. */
function pointAt(r: RouteMotion, d: number): Vec {
  if (!r.points.length) return { x: 0, y: 0, z: 0 };
  if (r.points.length < 2) return { ...r.points[0], z: r.points[0].z ?? 0 };
  d = canonicalDistance(r, d);
  const i = upper(r.distance, d),
    span = r.distance[i] - r.distance[i - 1],
    f = span > 0 ? (d - r.distance[i - 1]) / span : 0,
    a = r.points[i - 1],
    b = r.points[i];
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * f,
  };
}
function geometricTangent(r: RouteMotion, d: number): Vec {
  const half = Math.min(0.25, Math.max(0.01, (r.length * METERS_PER_TILE) / 16)) / METERS_PER_TILE,
    closed = isClosed(r),
    a = pointAt(r, closed ? d - half : Math.max(0, d - half)),
    b = pointAt(r, closed ? d + half : Math.min(r.length, d + half)),
    delta = add(b, a, -1),
    n = length(delta);
  return n > 1e-12 ? mul(delta, 1 / n) : routePosition(r, d).tangent;
}
function dynamicsAt(r: RouteMotion, d: number) {
  const center = routePosition(r, d),
    half = Math.min(CURVATURE_HALF_WINDOW_METERS, Math.max(0.01, (r.length * METERS_PER_TILE) / 8)),
    closed = isClosed(r);
  let wsum = 0,
    xmean = 0,
    tmean: Vec = { x: 0, y: 0, z: 0 };
  const samples = taps.map((u, i) => {
    const offset = u * half,
      at = closed ? d + offset / METERS_PER_TILE : clamp(d + offset / METERS_PER_TILE, 0, r.length),
      x = closed ? offset : (at - d) * METERS_PER_TILE;
    const tangent = geometricTangent(r, at),
      w = weights[i];
    wsum += w;
    xmean += w * x;
    tmean = add(tmean, tangent, w);
    return { x, tangent, w };
  });
  xmean /= wsum;
  tmean = mul(tmean, 1 / wsum);
  let variance = 0,
    derivative: Vec = { x: 0, y: 0, z: 0 };
  for (const { x, tangent, w } of samples) {
    variance += w * (x - xmean) ** 2;
    derivative = add(derivative, add(tangent, tmean, -1), w * (x - xmean));
  }
  derivative = mul(derivative, 1 / Math.max(1e-12, variance));
  // A unit tangent's spatial derivative is normal to the direction of travel.
  const curvature = add(derivative, center.tangent, -dot(derivative, center.tangent));
  // Do not wrap speeds across the stopped station when fitting dv/dt = d(v²/2)/ds.
  let ex = 0,
    ev = 0,
    ew = 0;
  const energies = taps.map((u, i) => {
    const at = clamp(d + (u * half) / METERS_PER_TILE, 0, r.length),
      x = (at - d) * METERS_PER_TILE,
      v = routePosition(r, at).speed ** 2 / 2,
      w = weights[i];
    ex += x * w;
    ev += v * w;
    ew += w;
    return { x, v, w };
  });
  ex /= ew;
  ev /= ew;
  let numerator = 0,
    denominator = 0;
  for (const { x, v, w } of energies) {
    numerator += w * (x - ex) * (v - ev);
    denominator += w * (x - ex) ** 2;
  }
  return { center, curvature, tangential: denominator > 1e-12 ? numerator / denominator : 0 };
}
/** Stationary means physically stopped. Pausing the 3D viewer should freeze the current reading. */
export function forceAt(
  r: RouteMotion,
  distance: number,
  override?: { speed?: number; tangentialAcceleration?: number; stationary?: boolean },
): Forces {
  const d = canonicalDistance(r, distance),
    { center, curvature, tangential } = dynamicsAt(r, d),
    speed = override?.speed ?? center.speed;
  let acceleration: Vec = { x: 0, y: 0, z: 0 };
  if (!override?.stationary && speed > 0.05)
    acceleration = add(
      mul(curvature, speed * speed),
      center.tangent,
      override?.tangentialAcceleration ?? tangential,
    );
  const proper = add(acceleration, { x: 0, y: 0, z: GRAVITY });
  return {
    vertical: dot(proper, center.up) / GRAVITY,
    lateral: -dot(proper, center.right) / GRAVITY,
    longitudinal: dot(proper, center.tangent) / GRAVITY,
    total: length(proper) / GRAVITY,
  };
}
/** Fraction of an interval where all linearly interpolated inequalities are satisfied. */
function fraction(conditions: [number, number, number, boolean][]) {
  let lo = 0,
    hi = 1;
  for (const [a, b, threshold, below] of conditions) {
    const aa = below ? a - threshold : threshold - a,
      bb = below ? b - threshold : threshold - b;
    if (aa >= 0 && bb >= 0) return 0;
    if (aa < 0 && bb < 0) continue;
    const crossing = aa / (aa - bb);
    if (aa >= 0) lo = Math.max(lo, crossing);
    else hi = Math.min(hi, crossing);
  }
  return Math.max(0, hi - lo);
}
const cache = new WeakMap<RouteMotion, ForceAnalysis>();
/** Separate entry point for analytic/custom RouteMotion regression fixtures. */
export function analyzeRouteForces(route: RouteMotion): ForceAnalysis {
  const cached = cache.get(route);
  if (cached) return cached;
  const totalMeters = route.length * METERS_PER_TILE,
    count = Math.min(8192, Math.max(1, Math.ceil(totalMeters / 0.5))),
    samples: ForceSample[] = [];
  for (let i = 0; i <= count; i++) {
    const distance = (route.length * i) / count,
      p = routePosition(route, distance);
    samples.push({
      ...forceAt(route, distance),
      distance,
      time: forceTimeAtDistance(route, distance),
      speed: p.speed,
      upZ: p.up.z,
    });
  }
  let airtime = 0,
    negativeGTime = 0,
    invertedTime = 0,
    v2 = 0,
    l2 = 0,
    a2 = 0,
    meanSpeed = 0,
    discomfort = 0,
    travelTime = 0;
  const jerks: { v: number; w: number }[] = [];
  const discomfortAt = (p: ForceSample) =>
    Math.max(0, p.vertical - 3.5) ** 2 +
    Math.max(0, -0.7 - p.vertical) ** 2 +
    2 * Math.max(0, Math.abs(p.lateral) - 0.8) ** 2 +
    Math.max(0, Math.abs(p.longitudinal) - 0.6) ** 2;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1],
      b = samples[i],
      dt = Math.max(0, b.time - a.time);
    if (dt <= 0) continue;
    travelTime += dt;
    airtime +=
      dt *
      fraction([
        [a.vertical, b.vertical, 0.3, true],
        [a.upZ, b.upZ, 0.2, false],
        [a.speed, b.speed, 1, false],
      ]);
    negativeGTime +=
      dt *
      fraction([
        [a.vertical, b.vertical, 0, true],
        [a.speed, b.speed, 1, false],
      ]);
    invertedTime +=
      dt *
      fraction([
        [a.upZ, b.upZ, -0.2, true],
        [a.speed, b.speed, 1, false],
      ]);
    v2 += (dt * ((a.vertical - 1) ** 2 + (b.vertical - 1) ** 2)) / 2;
    l2 += (dt * (a.lateral ** 2 + b.lateral ** 2)) / 2;
    a2 += (dt * (a.longitudinal ** 2 + b.longitudinal ** 2)) / 2;
    meanSpeed += (dt * (a.speed + b.speed)) / 2;
    discomfort += (dt * (discomfortAt(a) + discomfortAt(b))) / 2;
    // Changing wagon-frame readings includes roll. Useful ride harshness, not world-vector jerk.
    jerks.push({
      v:
        Math.hypot(
          b.vertical - a.vertical,
          b.lateral - a.lateral,
          b.longitudinal - a.longitudinal,
        ) / dt,
      w: dt,
    });
  }
  const duration = route.duration,
    divisor = Math.max(travelTime, 1e-9),
    verticalRms = Math.sqrt(v2 / divisor),
    lateralRms = Math.sqrt(l2 / divisor),
    longitudinalRms = Math.sqrt(a2 / divisor);
  jerks.sort((a, b) => a.v - b.v);
  let accumulated = 0,
    jerk95 = 0;
  for (const j of jerks) {
    accumulated += j.w;
    if (accumulated >= 0.95 * travelTime) {
      jerk95 = j.v;
      break;
    }
  }
  const peaks = {
    vertical: Math.max(...samples.map((p) => p.vertical)),
    lateral: Math.max(...samples.map((p) => Math.abs(p.lateral))),
    longitudinal: Math.max(...samples.map((p) => Math.abs(p.longitudinal))),
    total: Math.max(...samples.map((p) => p.total)),
  };
  const minVertical = Math.min(...samples.map((p) => p.vertical)),
    maxSpeed = Math.max(...samples.map((p) => p.speed));
  meanSpeed /= divisor;
  // Explicit GAME HEURISTICS, not empirical enjoyment prediction or engineering limits.
  const peakPenalty =
    Math.max(0, peaks.vertical - 4) ** 2 +
    Math.max(0, -1 - minVertical) ** 2 +
    2 * Math.max(0, peaks.lateral - 1.5) ** 2 +
    Math.max(0, peaks.longitudinal - 1.2) ** 2;
  const comfort = clamp(
    100 - (22 * discomfort) / divisor - 8 * peakPenalty - 3 * Math.max(0, jerk95 - 2),
    0,
    100,
  );
  const stimulus =
    0.35 * clamp(meanSpeed / 22, 0, 1) +
    0.2 * clamp(verticalRms / 1.3, 0, 1) +
    0.2 * (1 - Math.exp(-airtime / 3)) +
    0.15 * (1 - Math.exp(-invertedTime / 2)) +
    0.1 * clamp(longitudinalRms / 0.4, 0, 1);
  const fun = duration > 0 ? clamp(100 * stimulus * (0.25 + (0.75 * comfort) / 100), 0, 100) : 0;
  const intensity =
    duration > 0
      ? clamp(20 * verticalRms + 30 * lateralRms + 25 * longitudinalRms + 4 * peaks.total, 0, 100)
      : 0;
  const result: ForceAnalysis = {
    peaks,
    minVertical,
    maxLateral: peaks.lateral,
    maxLongitudinal: peaks.longitudinal,
    airtime,
    negativeGTime,
    invertedTime,
    duration,
    maxSpeed,
    meanSpeed,
    verticalRms,
    lateralRms,
    longitudinalRms,
    jerk95,
    fun,
    comfort,
    intensity,
    sampleStepMeters: totalMeters / count,
    filterWindowMeters: CURVATURE_HALF_WINDOW_METERS * 2,
    samples,
  };
  cache.set(route, result);
  return result;
}
export function analyzeForces(track: Parameters<typeof prepareRoute>[0]): ForceAnalysis {
  return analyzeRouteForces(prepareRoute(track));
}

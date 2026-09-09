import type { Point } from "./simulation";
export type Spin = { angle: number; velocity: number };
/** Exact integration of a damped motor, independent of render frame rate. */
export function advanceSpin(state: Spin, target: number, dt: number, tau = 1.3): Spin {
  if (dt <= 0) return state;
  const e = Math.exp(-dt / tau);
  return {
    angle: state.angle + target * dt + (state.velocity - target) * tau * (1 - e),
    velocity: target + (state.velocity - target) * e,
  };
}
/** Integral of smooth acceleration/cruise/braking. Endpoints and velocity are continuous. */
export function tripProgress(t: number): number {
  const u = Math.max(0, Math.min(1, t)),
    a = 0.1,
    b = 0.18,
    area = 1 - (a + b) / 2;
  const integral = (v: number) => v * v * v - 0.5 * v * v * v * v;
  return (
    (u < a ? a * integral(u / a) : u > 1 - b ? area - b * integral((1 - u) / b) : u - a / 2) / area
  );
}
export type RouteMotion = {
  points: Point[];
  distance: number[];
  cost: number[];
  length: number;
  duration: number;
};
export function prepareRoute(points: Point[]): RouteMotion {
  // Subdivide once and blend slope around crests; no speed discontinuity at a track vertex.
  const samples: Point[] = points.length ? [{ ...points[0] }] : [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      steps = Math.max(
        1,
        Math.ceil(Math.hypot(b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0)) * 10),
      );
    for (let j = 1; j <= steps; j++) {
      const f = j / steps;
      samples.push({
        x: a.x + (b.x - a.x) * f,
        y: a.y + (b.y - a.y) * f,
        z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * f,
      });
    }
  }
  const distance = [0],
    cost = [0];
  for (let i = 1; i < samples.length; i++)
    distance.push(
      distance[i - 1] +
        Math.hypot(
          samples[i].x - samples[i - 1].x,
          samples[i].y - samples[i - 1].y,
          (samples[i].z ?? 0) - (samples[i - 1].z ?? 0),
        ),
    );
  const speeds = samples.map((_, i) => {
    let slope = 0,
      weight = 0;
    for (let j = Math.max(1, i - 9); j < Math.min(samples.length, i + 10); j++) {
      const separation = Math.abs((distance[j] + distance[j - 1]) / 2 - distance[i]);
      if (separation > 0.7) continue;
      const a = samples[j - 1],
        b = samples[j],
        w = 1 - separation / 0.7;
      slope += (((b.z ?? 0) - (a.z ?? 0)) / Math.max(0.001, Math.hypot(b.x - a.x, b.y - a.y))) * w;
      weight += w;
    }
    return Math.max(0.45, Math.min(3.2, 1.6 * Math.exp((-1.4 * slope) / Math.max(0.001, weight))));
  });
  for (let i = 1; i < samples.length; i++)
    cost.push(cost[i - 1] + (distance[i] - distance[i - 1]) / ((speeds[i - 1] + speeds[i]) / 2));
  return {
    points: samples,
    distance,
    cost,
    length: distance.at(-1) ?? 0,
    duration: cost.at(-1) ?? 0,
  };
}
export type TrainMotor = Spin & { target: number; time: number };
/** Retain position through closures and coast to rest instead of resetting to station. */
export function advanceTrain(
  state: TrainMotor,
  head: number,
  running: boolean,
  time: number,
  length: number,
): TrainMotor {
  const dt = Math.max(0, time - state.time);
  if (!dt || !length) return state;
  const gap = (((head - state.target) % length) + length) % length;
  const delta = running && gap > 1e-7 && length - gap > 1e-7 ? Math.min(gap, 8 * dt) : 0;
  return { ...advanceSpin(state, delta / dt, dt, 0.12), target: state.target + delta, time };
}
function segment(values: number[], target: number) {
  let lo = 1,
    hi = values.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (values[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
export function trainDistance(route: RouteMotion, progress: number) {
  if (route.duration <= 0) return 0;
  const target = tripProgress(progress) * route.duration,
    i = segment(route.cost, target),
    span = route.cost[i] - route.cost[i - 1];
  return (
    route.distance[i - 1] +
    (route.distance[i] - route.distance[i - 1]) *
      (span > 0 ? (target - route.cost[i - 1]) / span : 0)
  );
}
export function routePosition(
  route: RouteMotion,
  d: number,
): Point & { dx: number; dy: number; pitch: number } {
  if (route.length <= 0 || route.points.length < 2)
    return { ...(route.points[0] ?? { x: 0, y: 0, z: 0 }), dx: 1, dy: 0, pitch: 0 };
  const distance = ((d % route.length) + route.length) % route.length,
    i = segment(route.distance, distance),
    a = route.points[i - 1],
    b = route.points[i],
    span = route.distance[i] - route.distance[i - 1],
    f = span > 0 ? (distance - route.distance[i - 1]) / span : 0;
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * f,
    dx: b.x - a.x,
    dy: b.y - a.y,
    pitch: ((b.z ?? 0) - (a.z ?? 0)) / Math.max(0.001, Math.hypot(b.x - a.x, b.y - a.y)),
  };
}

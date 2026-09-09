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
export type Vec = { x: number; y: number; z: number };
export type RidePhase = "station" | "departure" | "lift" | "launch" | "coast" | "brake";
export const PHASE_NAMES: Record<RidePhase, string> = {
  station: "Station",
  departure: "Abfahrt aus der Station",
  lift: "Kettenlift",
  launch: "Beschleunigung",
  coast: "Freie Fahrt",
  brake: "Bremse",
};
const add = (a: Vec, b: Vec, f = 1): Vec => ({
  x: a.x + b.x * f,
  y: a.y + b.y * f,
  z: a.z + b.z * f,
});
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec, b: Vec): Vec => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const norm = (v: Vec): Vec => {
  const n = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / n, y: v.y / n, z: v.z / n };
};
const rotate = (v: Vec, a: Vec, t: number) =>
  add(
    add(
      { x: v.x * Math.cos(t), y: v.y * Math.cos(t), z: v.z * Math.cos(t) },
      cross(a, v),
      Math.sin(t),
    ),
    a,
    dot(a, v) * (1 - Math.cos(t)),
  );
const up: Vec = { x: 0, y: 0, z: 1 };
export type RouteMotion = {
  points: Point[];
  distance: number[];
  cost: number[];
  length: number;
  duration: number;
  speeds: number[];
  phases: RidePhase[];
  tangents: Vec[];
  rights: Vec[];
  ups: Vec[];
};
const routeCache = new WeakMap<Point[], RouteMotion>();
/** One geometry and time table for simulation, the park renderer and the 3D camera. Units: tiles, seconds; 1 tile = 5 m. */
export function prepareRoute(track: Point[]): RouteMotion {
  const cached = routeCache.get(track);
  if (cached) return cached;
  if (track.length > 2048 || track.some((p) => !Number.isFinite(p.x + p.y + (p.z ?? 0))))
    throw Error("Ungültige Streckendaten.");
  for (let i = 1; i < track.length; i++)
    if (
      Math.hypot(
        track[i].x - track[i - 1].x,
        track[i].y - track[i - 1].y,
        (track[i].z ?? 0) - (track[i - 1].z ?? 0),
      ) > 80
    )
      throw Error("Streckenabschnitt zu lang.");
  let points = track;
  if (track.length > 4 && !track[0].smooth) {
    const ring = track.slice(0, -1),
      rounded: Point[] = [];
    const mix = (a: Point, b: Point, t: number): Point => ({
      ...a,
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t,
    });
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i],
        a = mix(p, ring[(i + ring.length - 1) % ring.length], 0.28),
        b = mix(p, ring[(i + 1) % ring.length], 0.28);
      for (let j = 0; j < 8; j++) {
        const t = j / 8;
        rounded.push({ ...mix(mix(a, p, t), mix(p, b, t), t), smooth: true });
      }
    }
    rounded.push({ ...rounded[0] });
    points = rounded;
  }
  const samples: Point[] = points.length ? [{ ...points[0] }] : [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      steps = Math.max(
        1,
        Math.min(64, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0)) * 12)),
      );
    for (let j = 1; j <= steps; j++) {
      const f = j / steps;
      samples.push({
        ...b,
        drive: a.drive,
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
  const length = distance.at(-1) ?? 0,
    n = samples.length - 1,
    closed =
      n > 0 &&
      Math.hypot(
        samples[0].x - samples[n].x,
        samples[0].y - samples[n].y,
        (samples[0].z ?? 0) - (samples[n].z ?? 0),
      ) < 0.001;
  const tangents: Vec[] = [],
    rights: Vec[] = [],
    ups: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const a = samples[i === 0 && closed ? n - 1 : Math.max(0, i - 1)],
      b = samples[i === n && closed ? 1 : Math.min(n, i + 1)];
    const t = norm({ x: b.x - a.x, y: b.y - a.y, z: (b.z ?? 0) - (a.z ?? 0) });
    tangents.push(t);
    let right = norm(cross(t, up));
    if (i && samples[i].inversion && samples[i - 1].inversion) {
      const axis = cross(tangents[i - 1], t),
        angle = Math.atan2(Math.hypot(axis.x, axis.y, axis.z), dot(tangents[i - 1], t));
      right = rotate(rights[i - 1], norm(axis), angle);
    }
    if (Math.hypot(right.x, right.y, right.z) < 0.1) right = rights[i - 1] ?? { x: 0, y: -1, z: 0 };
    rights.push(norm(add(right, t, -dot(right, t))));
  }
  for (let start = 0; start <= n; start++) {
    if (!samples[start].inversion) continue;
    let end = start;
    while (end < n && samples[end + 1].inversion) end++;
    const desired = norm(cross(tangents[end], up)),
      twist = Math.atan2(
        dot(cross(rights[end], desired), tangents[end]),
        dot(rights[end], desired),
      );
    for (let j = start; j <= end; j++)
      rights[j] = rotate(rights[j], tangents[j], (twist * (j - start)) / Math.max(1, end - start));
    start = end;
  }
  for (let i = 0; i <= n; i++) ups.push(norm(cross(rights[i], tangents[i])));
  const speeds: number[] = [],
    phases: RidePhase[] = [],
    accelerationLimits: number[] = [],
    brakingLimits: number[] = [],
    style = track[0]?.style ?? "steel";
  const cap = style === "wood" ? 19 : style === "launch" ? 26 : 23;
  for (let i = 0; i <= n; i++) {
    const meters = distance[i] * 5,
      remaining = (length - distance[i]) * 5,
      ds = i ? (distance[i] - distance[i - 1]) * 5 : 0,
      dz = i ? ((samples[i].z ?? 0) - (samples[i - 1].z ?? 0)) * 5 : 0;
    let v = i
      ? Math.sqrt(
          Math.max(Math.min(4, speeds[i - 1] ** 2), speeds[i - 1] ** 2 - 2 * 9.81 * dz - 0.16 * ds),
        )
      : 0;
    let phase: RidePhase = "coast";
    const drive = samples[i].drive;
    if (style !== "launch" && !samples[i].inversion && tangents[i].z > 0.12) {
      v =
        drive?.kind === "boost" && drive.speed / 3.6 > 3
          ? Math.max(3, v)
          : drive?.kind === "brake" && drive.speed / 3.6 < 3
            ? Math.min(3, i ? speeds[i - 1] : 3)
            : 3;
      phase = "lift";
    }
    if (meters < Math.min(15, length * 1.2)) {
      v = Math.min(
        style === "launch" ? 26 : 7,
        Math.sqrt(2 * (style === "launch" ? 12 : 2) * meters),
      );
      phase = style === "launch" ? "launch" : "departure";
    }
    let acceleration = phase === "launch" ? 12 : 3,
      deceleration = 3;
    if (drive && i > 0) {
      const target = Math.min(cap, drive.speed / 3.6),
        old = v;
      if (drive.kind === "boost" && v < target) {
        v = Math.max(v, Math.min(target, Math.sqrt(v * v + 2 * drive.strength * ds)));
        if (v > old) {
          phase = "launch";
          acceleration = Math.max(acceleration, drive.strength);
        }
      }
      if (drive.kind === "brake" && v > target) {
        v = Math.min(v, Math.max(target, Math.sqrt(Math.max(0, v * v - 2 * drive.strength * ds))));
        if (v < old) {
          phase = "brake";
          deceleration = Math.max(3, drive.strength);
        }
      }
    }
    accelerationLimits.push(acceleration);
    brakingLimits.push(deceleration);
    v = Math.min(cap, v);
    if (remaining < Math.min(22, length * 1.5)) {
      const braking = Math.sqrt(2 * 3 * remaining);
      if (braking < v) {
        v = braking;
        phase = "brake";
      }
    }
    if (i === 0 || i === n) {
      v = 0;
      phase = "station";
    }
    speeds.push(v);
    phases.push(phase);
    if (i) cost.push(cost[i - 1] + ds / Math.max(0.08, (v + speeds[i - 1]) / 2));
  }
  // Bound acceleration and braking over distance, including the transitions into a lift.
  for (let i = 1; i <= n; i++)
    speeds[i] = Math.min(
      speeds[i],
      Math.sqrt(
        speeds[i - 1] ** 2 + 2 * accelerationLimits[i] * (distance[i] - distance[i - 1]) * 5,
      ),
    );
  for (let i = n - 1; i >= 0; i--)
    speeds[i] = Math.min(
      speeds[i],
      Math.sqrt(
        speeds[i + 1] ** 2 + 2 * brakingLimits[i + 1] * (distance[i + 1] - distance[i]) * 5,
      ),
    );
  cost.length = 1;
  for (let i = 1; i <= n; i++)
    cost.push(
      cost[i - 1] +
        ((distance[i] - distance[i - 1]) * 10) / Math.max(0.08, speeds[i - 1] + speeds[i]),
    );
  const result = {
    points: samples,
    distance,
    cost,
    length,
    duration: cost.at(-1) ?? 0,
    speeds,
    phases,
    tangents,
    rights,
    ups,
  };
  routeCache.set(track, result);
  return result;
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
  if (route.duration <= 0 || progress <= 0) return 0;
  if (progress >= 1) return route.length;
  const target = Math.max(0, Math.min(1, progress)) * route.duration,
    i = segment(route.cost, target),
    span = route.cost[i] - route.cost[i - 1];
  const elapsed = Math.max(0, Math.min(span, target - route.cost[i - 1])),
    v = route.speeds[i - 1],
    accel = span > 0 ? (route.speeds[i] - v) / span : 0;
  return route.distance[i - 1] + (v * elapsed + 0.5 * accel * elapsed * elapsed) / 5;
}
export function routePosition(
  route: RouteMotion,
  d: number,
): Point & {
  dx: number;
  dy: number;
  pitch: number;
  up: Vec;
  right: Vec;
  tangent: Vec;
  speed: number;
  phase: RidePhase;
} {
  if (route.length <= 0 || route.points.length < 2)
    return {
      ...(route.points[0] ?? { x: 0, y: 0, z: 0 }),
      dx: 1,
      dy: 0,
      pitch: 0,
      up,
      right: { x: 0, y: -1, z: 0 },
      tangent: { x: 1, y: 0, z: 0 },
      speed: 0,
      phase: "station",
    };
  const distance =
      d === route.length ? route.length : ((d % route.length) + route.length) % route.length,
    i = segment(route.distance, distance),
    a = route.points[i - 1],
    b = route.points[i],
    span = route.distance[i] - route.distance[i - 1],
    f = span > 0 ? (distance - route.distance[i - 1]) / span : 0;
  const tangent = norm(
    add(route.tangents[i - 1], add(route.tangents[i], route.tangents[i - 1], -1), f),
  );
  const right0 = add(route.rights[i - 1], add(route.rights[i], route.rights[i - 1], -1), f),
    right = norm(add(right0, tangent, -dot(right0, tangent)));
  return {
    tangent,
    right,
    up: norm(cross(right, tangent)),
    speed: Math.sqrt(
      Math.max(0, route.speeds[i - 1] ** 2 + (route.speeds[i] ** 2 - route.speeds[i - 1] ** 2) * f),
    ),
    phase: route.phases[i],
    drive: route.points[i].drive,
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * f,
    dx: b.x - a.x,
    dy: b.y - a.y,
    pitch: ((b.z ?? 0) - (a.z ?? 0)) / Math.max(0.001, Math.hypot(b.x - a.x, b.y - a.y)),
  };
}

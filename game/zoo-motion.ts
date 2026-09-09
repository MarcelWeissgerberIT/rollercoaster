import type { Building } from "./simulation";
import { SPECIES, isHabitat, type Species } from "./zoo";
import { habitatLayout, habitatPointBlocked } from "./zoo-layout";

export const ANIMAL_NAMES = {
  zebra: ["Zuri", "Milo", "Amara", "Kito"],
  giraffe: ["Nala", "Kaya", "Juma"],
  flamingo: ["Rosalie", "Pepe", "Coral", "Luna", "Fiete", "Ruby"],
  penguin: ["Pip", "Puck", "Lotte", "Kalle", "Nori", "Flocke"],
  elephant: ["Tara", "Tembo", "Mala"],
  lion: ["Kito", "Amira", "Nala", "Suri"],
  panda: ["Bao", "Mei", "Lin"],
} satisfies Record<Species, readonly string[]>;
/** Stable slots preserve existing populations and saves without introducing saved render state. */
export const animalSex = (kind: string, index: number): "male" | "female" | undefined =>
  kind === "lion" ? (index === 0 ? "male" : "female") : undefined;
export const animalName = (kind: string, index: number) =>
  isHabitat(kind as Building["kind"])
    ? ANIMAL_NAMES[kind as Species][Math.max(0, index) % ANIMAL_NAMES[kind as Species].length]
    : "";
export const animalSprite = (kind: string, index: number, direction: string) =>
  `${kind === "lion" && animalSex(kind, index) === "female" ? "lioness" : kind}-${direction}`;
export type AnimalActivity = "walk" | "pause" | "eat" | "drink" | "shelter";
export const ANIMAL_ACTIVITY_LABELS: Record<AnimalActivity, string> = {
  walk: "Unterwegs",
  pause: "Ruht sich aus",
  eat: "Am Futterplatz",
  drink: "An der Wasserstelle",
  shelter: "Im Rückzugsbereich",
};
type XY = { x: number; y: number };
type Stop = XY & { activity: Exclude<AnimalActivity, "walk">; dwell: number };
type Journey = {
  points: XY[];
  distances: number[];
  length: number;
  startDistance: number;
  start: number;
  travel: number;
  stop: Stop;
};
type Edge = { start: number; length: number; angle: number };
type Plan = {
  journeys: Journey[];
  edges: Edge[];
  duration: number;
  length: number;
  offset: number;
  stride: number;
  speed: number;
};
const TAU = Math.PI * 2;
const movement: Record<
  Species,
  { speed: number; stride: number; margin: number; clearance: number }
> = {
  elephant: { speed: 0.62, stride: 1.15, margin: 0.78, clearance: 0.6 },
  lion: { speed: 0.78, stride: 0.98, margin: 0.66, clearance: 0.42 },
  panda: { speed: 0.5, stride: 0.66, margin: 0.58, clearance: 0.34 },
  zebra: { speed: 0.8, stride: 1.02, margin: 0.62, clearance: 0.38 },
  giraffe: { speed: 0.7, stride: 1.35, margin: 0.76, clearance: 0.44 },
  flamingo: { speed: 0.36, stride: 0.5, margin: 0.39, clearance: 0.2 },
  penguin: { speed: 0.3, stride: 0.28, margin: 0.34, clearance: 0.2 },
};
const fract = (x: number) => x - Math.floor(x);
const random = (seed: number) => fract(Math.sin(seed * 12.9898 + 78.233) * 43758.5453);
const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const derivative = (t: number) => 30 * t * t * (t - 1) * (t - 1);
const distance = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y);
const cache = new WeakMap<
  Building,
  { layout: ReturnType<typeof habitatLayout>; id: number; plans: Map<number, Plan> }
>();

type Navigation = {
  loX: number;
  hiX: number;
  loY: number;
  hiY: number;
  cells: XY[];
  near: (p: XY) => number;
  path: (a: XY, z: XY) => XY[];
};
const navigationCache = new WeakMap<ReturnType<typeof habitatLayout>, Navigation>();
function navigationFor(b: Building): Navigation {
  const layout = habitatLayout(b),
    existing = navigationCache.get(layout);
  if (existing) return existing;
  const n = layout.size,
    config = movement[b.kind as Species];
  const loX = b.x - 0.5 + config.margin,
    hiX = b.x + n - 0.5 - config.margin;
  const loY = b.y - 0.5 + config.margin,
    hiY = b.y + n - 0.5 - config.margin;
  const allowed = (p: XY) =>
    p.x >= loX &&
    p.x <= hiX &&
    p.y >= loY &&
    p.y <= hiY &&
    !habitatPointBlocked(b, p.x, p.y, config.clearance);
  const cells: XY[] = [],
    links: number[][] = [],
    grid = new Map<string, number>();
  const step = 0.23,
    cols = Math.floor((hiX - loX) / step) + 1,
    rows = Math.floor((hiY - loY) / step) + 1;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const p = { x: loX + x * step, y: loY + y * step };
      if (allowed(p)) {
        grid.set(`${x},${y}`, cells.length);
        cells.push(p);
        links.push([]);
      }
    }
  const clear = (a: XY, z: XY) => {
    const samples = Math.max(1, Math.ceil(distance(a, z) / 0.06));
    for (let i = 0; i <= samples; i++)
      if (!allowed({ x: a.x + ((z.x - a.x) * i) / samples, y: a.y + ((z.y - a.y) * i) / samples }))
        return false;
    return true;
  };
  for (const [key, id] of grid) {
    const [x, y] = key.split(",").map(Number);
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
    ]) {
      const other = grid.get(`${x + dx},${y + dy}`);
      if (other !== undefined && clear(cells[id], cells[other])) links[id].push(other);
    }
  }
  if (!cells.length) cells.push({ ...layout.center });
  const nearest = (p: XY) =>
    cells.reduce((best, q, i) => (distance(p, q) < distance(p, cells[best]) ? i : best), 0);
  // Prefer one connected free area: even elaborate legacy equipment cannot make animals teleport.
  const first = nearest(layout.center),
    component = new Set<number>([first]),
    pending = [first];
  for (let k = 0; k < pending.length; k++)
    for (const next of links[pending[k]] ?? [])
      if (!component.has(next)) {
        component.add(next);
        pending.push(next);
      }
  const near = (p: XY) =>
    [...component].reduce(
      (best, id) => (distance(p, cells[id]) < distance(p, cells[best]) ? id : best),
      first,
    );
  const path = (a: XY, z: XY) => {
    if (clear(a, z)) return [a, z];
    const from = near(a),
      to = near(z),
      parent = new Map<number, number>([[from, -1]]),
      queue = [from];
    for (let k = 0; k < queue.length && !parent.has(to); k++)
      for (const next of links[queue[k]] ?? [])
        if (!parent.has(next)) {
          parent.set(next, queue[k]);
          queue.push(next);
        }
    if (!parent.has(to)) return [a, a];
    const ids = [to];
    while (ids.at(-1) !== from) ids.push(parent.get(ids.at(-1)!)!);
    const raw = ids.reverse().map((id) => cells[id]),
      simplified = [raw[0]];
    for (let i = 0; i < raw.length - 1;) {
      let j = raw.length - 1;
      while (j > i + 1 && !clear(raw[i], raw[j])) j--;
      simplified.push(raw[j]);
      i = j;
    }
    const rounded: XY[] = [simplified[0]];
    for (let k = 1; k < simplified.length - 1; k++) {
      const a = simplified[k - 1],
        c = simplified[k],
        z = simplified[k + 1];
      const before = distance(a, c),
        after = distance(c, z);
      let radius = Math.min(0.24, before * 0.28, after * 0.28),
        curve: XY[] = [];
      for (let attempt = 0; attempt < 5; attempt++) {
        const enter = {
          x: c.x + ((a.x - c.x) * radius) / before,
          y: c.y + ((a.y - c.y) * radius) / before,
        };
        const exit = {
          x: c.x + ((z.x - c.x) * radius) / after,
          y: c.y + ((z.y - c.y) * radius) / after,
        };
        curve = Array.from({ length: 9 }, (_, j) => {
          const t = j / 8,
            u = 1 - t;
          return {
            x: u * u * enter.x + 2 * u * t * c.x + t * t * exit.x,
            y: u * u * enter.y + 2 * u * t * c.y + t * t * exit.y,
          };
        });
        if (curve.every((p, i) => allowed(p) && (!i || clear(curve[i - 1], p)))) break;
        radius *= 0.5;
        curve = [];
      }
      rounded.push(...(curve.length ? curve : [c]));
    }
    rounded.push(simplified.at(-1)!);
    return rounded;
  };
  const result = { loX, hiX, loY, hiY, cells, near, path };
  navigationCache.set(layout, result);
  return result;
}
function makePlan(b: Building, index: number): Plan {
  const kind = b.kind as Species,
    n = SPECIES[kind].size,
    config = movement[kind],
    layout = habitatLayout(b);
  const seed = b.id * 83 + index * 479 + n * 19;
  const { loX, hiX, loY, hiY, cells, near, path } = navigationFor(b);
  const wander = (k: number) => ({
    x: loX + (hiX - loX) * (0.12 + 0.76 * random(seed + k * 11)),
    y: loY + (hiY - loY) * (0.12 + 0.76 * random(seed + k * 31 + 9)),
  });
  const goal = (p: XY, activity: Stop["activity"], k: number): Stop => {
    // Separate individuals at each shared service area without changing the visual fixture target.
    const angle = index * 2.399 + k,
      spread = index ? 0.17 + (index % 3) * 0.08 : 0;
    const at =
      cells[near({ x: p.x + Math.cos(angle) * spread, y: p.y + Math.sin(angle) * spread })];
    return {
      ...at,
      activity,
      dwell:
        (activity === "pause" ? 5 : activity === "shelter" ? 17 : 11) + random(seed + k * 17) * 6,
    };
  };
  const stops = [
    goal(wander(1), "pause", 0),
    goal(layout.food, "eat", 1),
    goal(wander(2), "pause", 2),
    goal(layout.water, "drink", 3),
    goal(wander(3), "pause", 4),
    goal(layout.enrichment, "pause", 5),
    goal(wander(4), "pause", 6),
    goal(layout.shelter, "shelter", 7),
  ];
  const journeys: Journey[] = [];
  let duration = 0,
    travelled = 0;
  for (let i = 0; i < stops.length; i++) {
    const points = path(stops[(i + stops.length - 1) % stops.length], stops[i]),
      distances = [0];
    for (let j = 1; j < points.length; j++)
      distances.push(distances.at(-1)! + distance(points[j - 1], points[j]) * 5);
    const length = distances.at(-1)!,
      travel = Math.max(1.5, (length * 1.875) / config.speed);
    journeys.push({
      points,
      distances,
      length,
      startDistance: travelled,
      start: duration,
      travel,
      stop: stops[i],
    });
    duration += travel + stops[i].dwell;
    travelled += length;
  }
  const edges: Edge[] = [];
  for (const j of journeys)
    for (let i = 1; i < j.points.length; i++) {
      const a = j.points[i - 1],
        b = j.points[i],
        length = j.distances[i] - j.distances[i - 1];
      if (length > 1e-7)
        edges.push({
          start: j.startDistance + j.distances[i - 1],
          length,
          angle: Math.atan2(b.y - a.y, b.x - a.x),
        });
    }
  return {
    journeys,
    edges,
    duration,
    length: travelled,
    offset: random(seed + 671) * duration,
    stride: config.stride,
    speed: config.speed,
  };
}
function planFor(b: Building, index: number) {
  const layout = habitatLayout(b);
  let entry = cache.get(b);
  if (!entry || entry.layout !== layout || entry.id !== b.id) {
    entry = { layout, id: b.id, plans: new Map() };
    cache.set(b, entry);
  }
  let plan = entry.plans.get(index);
  if (!plan) {
    plan = makePlan(b, index);
    entry.plans.set(index, plan);
  }
  return plan;
}
function sample(journey: Journey, d: number): XY {
  const clamped = Math.max(0, Math.min(journey.length, d));
  let k = 1;
  while (k < journey.distances.length - 1 && journey.distances[k] < clamped) k++;
  const a = journey.points[k - 1],
    b = journey.points[k],
    span = journey.distances[k] - journey.distances[k - 1];
  const t = span ? (clamped - journey.distances[k - 1]) / span : 0;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
function bearing(plan: Plan, d: number) {
  const wrapped = plan.length ? ((d % plan.length) + plan.length) % plan.length : 0;
  if (!plan.edges.length) return -Math.PI / 2;
  let index = plan.edges.findIndex((e) => wrapped <= e.start + e.length);
  if (index < 0) index = plan.edges.length - 1;
  const e = plan.edges[index],
    before = plan.edges[(index + plan.edges.length - 1) % plan.edges.length],
    after = plan.edges[(index + 1) % plan.edges.length];
  const delta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const start = e.angle - delta(before.angle, e.angle) / 2,
    end = e.angle + delta(e.angle, after.angle) / 2;
  const t = Math.max(0, Math.min(e.length, wrapped - e.start)),
    zone = Math.min(0.4, e.length / 2);
  if (t < zone) return start + delta(start, e.angle) * smooth(t / zone);
  if (t > e.length - zone)
    return e.angle + delta(e.angle, end) * smooth((t - e.length + zone) / zone);
  return e.angle;
}
/** Absolute simulation time is seekable: repeated times, pauses and save/reload produce identical poses.
 * No frame integrator, random calls, route mutations or per-frame geometry allocation. */
export function animalPose(b: Building, index: number, time: number) {
  const safeIndex = Math.max(0, Math.floor(index)),
    plan = planFor(b, safeIndex),
    clock = Math.max(0, Number.isFinite(time) ? time : 0) + plan.offset;
  const lap = Math.floor(clock / plan.duration),
    t = clock - lap * plan.duration;
  const journey =
    plan.journeys.find((j) => t < j.start + j.travel + j.stop.dwell) ?? plan.journeys.at(-1)!;
  const elapsed = t - journey.start,
    moving = elapsed < journey.travel && journey.length > 0.001;
  const u = Math.max(0, Math.min(1, elapsed / journey.travel)),
    d = journey.length * smooth(u),
    p = sample(journey, d);
  const localDistance = journey.startDistance + d,
    travelled = lap * plan.length + localDistance;
  const angle = bearing(plan, localDistance),
    dx = Math.cos(angle),
    dy = Math.sin(angle);
  const speed = moving ? (journey.length * derivative(u)) / journey.travel : 0,
    gait = (travelled / plan.stride) * TAU;
  const strideWeight = Math.min(1, speed / Math.max(0.001, plan.speed * 0.35));
  const activity: AnimalActivity = moving ? "walk" : journey.stop.activity;
  const restElapsed = Math.max(0, elapsed - journey.travel),
    action = moving
      ? 0
      : smooth(Math.min(1, restElapsed / 1.8)) *
        smooth(Math.min(1, (journey.stop.dwell - restElapsed) / 1.8));
  return {
    x: p.x,
    y: p.y,
    dx,
    dy,
    walk: moving && speed > 0.003,
    bob:
      (1 - Math.cos(gait * 2)) *
      (b.kind === "elephant" ? 0.009 : b.kind === "penguin" ? 0.018 : 0.012) *
      strideWeight,
    name: animalName(b.kind, safeIndex),
    sex: animalSex(b.kind, safeIndex),
    activity,
    action,
    speed,
    distance: travelled,
    gait,
    stride: plan.stride,
    strideWeight,
    turn: 0,
  };
}

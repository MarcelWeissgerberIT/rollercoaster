/** Shared tile-space geometry and actual gate state for canvas, 3D and crew. */
import { CATALOG, effectivePods, type Building, type Park, type Point } from "./simulation";
import { podPort, podPose, type PodRole } from "./pods";
import { hasOperator, needsOperator, operationProgress, operationsOf } from "./operations";

export type AccessPose = Point & { dx: number; dy: number; tx: number; ty: number; port: Point };
export type CrewPostPose = Point & { dx: number; dy: number };
export type AccessLayout = {
  entry: AccessPose;
  exit: AccessPose;
  cabin: CrewPostPose & { width: number; depth: number };
  posts: { control: CrewPostPose; entry: CrewPostPose; exit: CrewPostPose };
};
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
function distanceToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = dx * dx + dy * dy,
    t = length ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / length) : 0;
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}
type GeometryCache = {
  signature: string;
  depth: number;
  layouts: WeakMap<Building, { key: string; layout: AccessLayout }>;
};
const geometryCaches = new WeakMap<Park, GeometryCache>();
function buildingGeometry(b: Building) {
  return `${b.id}:${b.kind}:${b.x},${b.y}:${b.pods ? `${b.pods.entry.side},${b.pods.entry.offset},${b.pods.exit.side},${b.pods.exit.offset}` : "auto"}:${b.track?.map((p) => `${p.x},${p.y},${p.z ?? 0}`).join("/") ?? ""}`;
}
function geometryCache(park: Park) {
  let cache = geometryCaches.get(park);
  if (cache?.depth) return cache;
  const signature = `${park.tiles.map((row) => row.join(",")).join(";")}|${park.buildings.map(buildingGeometry).join(";")}`;
  if (!cache || cache.signature !== signature) {
    cache = { signature, depth: 0, layouts: new WeakMap() };
    geometryCaches.set(park, cache);
  }
  return cache;
}
/** Batch synchronous renderer reads. Geometry is checked exactly once; callers
 * may advance operation phases inside the scope, but must not edit geometry.
 * Without a scope, every read validates in-place map, track and pod edits. */
export function withAccessLayoutCache<T>(park: Park, read: () => T): T {
  const cache = geometryCache(park);
  cache.depth++;
  try {
    return read();
  } finally {
    cache.depth--;
  }
}
function copyLayout(layout: AccessLayout): AccessLayout {
  return {
    entry: { ...layout.entry, port: { ...layout.entry.port } },
    exit: { ...layout.exit, port: { ...layout.exit.port } },
    cabin: { ...layout.cabin },
    posts: {
      control: { ...layout.posts.control },
      entry: { ...layout.posts.entry },
      exit: { ...layout.posts.exit },
    },
  };
}
export function accessLayout(park: Park, b: Building): AccessLayout {
  const cache = geometryCache(park),
    previous = cache.layouts.get(b);
  if (cache.depth && previous) return copyLayout(previous.layout);
  const key = buildingGeometry(b);
  if (previous?.key === key) return copyLayout(previous.layout);
  const layout = calculateLayout(park, b);
  cache.layouts.set(b, { key, layout });
  return copyLayout(layout);
}
function calculateLayout(park: Park, b: Building): AccessLayout {
  const size = CATALOG[b.kind].size,
    pods = b.pods ?? effectivePods(park, b),
    pose = (role: PodRole): AccessPose => {
      const p = podPose(b, size, pods[role]);
      return { ...p, tx: -p.dy, ty: p.dx, port: podPort(b, size, pods[role]) };
    },
    entry = pose("entry"),
    exit = pose("exit"),
    width = 0.54,
    depth = 0.5,
    candidates = [0.8, -0.8, 1.15, -1.15].map((offset) => {
      const cabin = {
          x: entry.x + entry.dx * 0.58 + entry.tx * offset,
          y: entry.y + entry.dy * 0.58 + entry.ty * offset,
          dx: entry.dx,
          dy: entry.dy,
          width,
          depth,
        },
        halfX = (Math.abs(entry.tx) * width) / 2 + (Math.abs(entry.dx) * depth) / 2,
        halfY = (Math.abs(entry.ty) * width) / 2 + (Math.abs(entry.dy) * depth) / 2;
      let score = Math.abs(offset) * 0.1;
      for (const x of [cabin.x - halfX, cabin.x, cabin.x + halfX])
        for (const y of [cabin.y - halfY, cabin.y, cabin.y + halfY]) {
          const tile = park.tiles[Math.round(y)]?.[Math.round(x)];
          score +=
            tile === undefined
              ? 20000
              : tile === "water"
                ? 500
                : tile === "path" || tile === "queue" || tile === "exit"
                  ? 100
                  : 0;
        }
      for (const other of park.buildings) {
        const otherSize = CATALOG[other.kind].size;
        if (
          other.id !== b.id &&
          cabin.x + halfX > other.x - 0.5 &&
          cabin.x - halfX < other.x + otherSize - 0.5 &&
          cabin.y + halfY > other.y - 0.5 &&
          cabin.y - halfY < other.y + otherSize - 0.5
        )
          score += 10000;
        for (let i = 1; i < (other.track?.length ?? 0); i++)
          if (
            distanceToSegment(cabin, other.track![i - 1], other.track![i]) <
            Math.hypot(halfX, halfY) + 0.3
          )
            score += 10000;
      }
      // Keep the alternate gate and its public-path passage free where possible.
      score += Math.max(0, 0.85 - distanceToSegment(cabin, exit, exit.port)) * 2000;
      return { cabin, offset, score };
    });
  candidates.sort((a, b) => a.score - b.score);
  const { cabin, offset } = candidates[0],
    sign = Math.sign(offset),
    exitSign = (cabin.x - exit.x) * exit.tx + (cabin.y - exit.y) * exit.ty > 0 ? -1 : 1;
  return {
    entry,
    exit,
    cabin,
    posts: {
      control: { x: cabin.x, y: cabin.y, dx: cabin.dx, dy: cabin.dy },
      entry: {
        x: entry.x - entry.tx * sign * 0.47 + entry.dx * 0.32,
        y: entry.y - entry.ty * sign * 0.47 + entry.dy * 0.32,
        dx: entry.dx,
        dy: entry.dy,
      },
      exit: {
        x: exit.x + exit.tx * exitSign * 0.47 + exit.dx * 0.12,
        y: exit.y + exit.ty * exitSign * 0.47 + exit.dy * 0.12,
        dx: -exit.dx,
        dy: -exit.dy,
      },
    },
  };
}
export type GateMotion = {
  /** 0 closed, 1 fully open. `open` is the same value for renderer convenience. */
  progress: number;
  open: number;
  phaseProgress: number;
  activeGuests: number;
  phase: string;
};
/** No independent animation clock: callers preview by advancing a copied Park.
 * Recently released riders wait two seconds, longer than the unloading phase.
 * Their real exit position keeps the gate open until they have passed through. */
export function gateMotion(park: Park, b: Building, role: PodRole, _time = park.time): GateMotion {
  // Transport stations use their existing open access, not a ride crew's dispatch phases.
  if (!needsOperator(b.kind)) {
    const open = b.open ? 1 : 0;
    return {
      open,
      progress: open,
      phaseProgress: 0,
      activeGuests: 0,
      phase: b.open ? "station" : "closed",
    };
  }
  const operation = operationsOf(b),
    phase = operation.phase,
    phaseProgress = operationProgress(b);
  let open = 0,
    activeGuests = 0;
  if (role === "entry") {
    activeGuests = park.guests.filter((g) => g.state === "queue" && b.queue.includes(g.id)).length;
    if (b.open && hasOperator(b))
      open =
        phase === "boarding"
          ? smooth(phaseProgress / 0.2)
          : phase === "checking"
            ? 1 - smooth(phaseProgress)
            : 0;
  } else {
    const port = accessLayout(park, b).exit.port;
    let guestOpening = 0;
    for (const g of park.guests) {
      if (
        (g.state !== "walk" && g.state !== "leave") ||
        g.target !== null ||
        g.visited?.[g.visited.length - 1] !== b.id
      )
        continue;
      const distance = Math.hypot(g.x - port.x, g.y - port.y);
      if (distance >= 1.5) continue;
      activeGuests++;
      guestOpening = Math.max(guestOpening, smooth((1.5 - distance) / 0.75));
    }
    open = phase === "unloading" ? smooth(phaseProgress / 0.2) : guestOpening;
  }
  return { open, progress: open, phaseProgress, activeGuests, phase };
}

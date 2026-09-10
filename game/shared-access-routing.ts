/** Pure shared-corridor routing. Sizes are passed by the simulation/catalog wrapper. */
import type { Building, Guest, Park, Point } from "./simulation";
import { connected } from "./walkways";
import { needsOperator } from "./operations";
import { POD_DIRECTIONS, podPort } from "./pods";
const key = (p: Point) => `${p.x},${p.y}`;
const neighbors = (p: Point): Point[] =>
  [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ].map(([x, y]) => ({ x: p.x + x, y: p.y + y }));
export const SHARED_LANE_OFFSET = 0.22;
export const supportsSharedAccess = (b: Pick<Building, "kind">) => needsOperator(b.kind);
/** Includes both the queue entrance cell and the first connected public path. */
export function routeFrom(s: Park, start: Point): Point[] {
  const net = connected(s),
    queue = [start],
    previous = new Map<string, Point | null>([[key(start), null]]);
  if (!net.has(key(start))) return [];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i],
      tile = s.tiles[p.y]?.[p.x];
    if (tile === "path") {
      const route: Point[] = [];
      let point: Point | null = p;
      while (point) {
        route.unshift({ ...point });
        point = previous.get(key(point)) ?? null;
      }
      return route;
    }
    if (tile !== "queue") continue;
    for (const next of neighbors(p))
      if (net.has(key(next)) && !previous.has(key(next))) {
        previous.set(key(next), p);
        queue.push(next);
      }
  }
  return [];
}
export function sharedAccessRoute(s: Park, b: Building, size: number): Point[] {
  return b.sharedAccess && supportsSharedAccess(b) && b.pods
    ? routeFrom(s, podPort(b, size, b.pods.entry))
    : [];
}
export function sharedExitPending(
  s: Pick<Park, "guests">,
  b: Pick<Building, "id" | "sharedAccess">,
): boolean {
  return !!b.sharedAccess && s.guests.some((g) => g.sharedExit === b.id);
}
export function getSharedAccessLanes(
  s: Park,
  b: Building,
  size: number,
): { route: Point[]; entry: Point[]; exit: Point[] } {
  const route = sharedAccessRoute(s, b, size),
    [dx, dy] = POD_DIRECTIONS[b.pods?.entry.side ?? 0];
  const offsets = route.map((p, i) => {
    const before = route[Math.max(0, i - 1)],
      after = route[Math.min(route.length - 1, i + 1)];
    const x = i === 0 ? dx : after.x - before.x,
      y = i === 0 ? dy : after.y - before.y;
    const norm = Math.hypot(x, y) || 1;
    const amount = i > 0 && i === route.length - 1 ? 0 : SHARED_LANE_OFFSET;
    return { x: (-y / norm) * amount, y: (x / norm) * amount };
  });
  return {
    route,
    entry: route.map((p, i) => ({ x: p.x - offsets[i].x, y: p.y - offsets[i].y })),
    exit: route.map((p, i) => ({ x: p.x + offsets[i].x, y: p.y + offsets[i].y })),
  };
}
export function sharedAccessGuestPosition(
  s: Park,
  g: Guest,
  size: number,
  cachedLanes?: ReturnType<typeof getSharedAccessLanes>,
): Point | undefined {
  if (g.transit || !["walk", "queue", "leave"].includes(g.state)) return undefined;
  const outgoing = g.sharedExit !== undefined;
  const b = s.buildings.find((b) => b.id === (outgoing ? g.sharedExit : g.target));
  if (!b?.sharedAccess || !supportsSharedAccess(b)) return undefined;
  const lanes = cachedLanes ?? getSharedAccessLanes(s, b, size),
    points = outgoing ? lanes.exit : lanes.entry;
  if (!points.length) return undefined;
  if (!outgoing && g.state === "queue") {
    const index = b.queue.indexOf(g.id);
    if (index < 0) return undefined;
    if (points.length === 1) {
      const [dx, dy] = POD_DIRECTIONS[b.pods?.entry.side ?? 0];
      return {
        x: points[0].x + dx * (index ? 0.2 : -0.2),
        y: points[0].y + dy * (index ? 0.2 : -0.2),
      };
    }
    const position = Math.min(index * 0.48, Math.max(0, points.length - 1.25));
    const a = Math.floor(position),
      blend = position - a,
      first = points[a],
      next = points[Math.min(a + 1, points.length - 1)];
    return { x: first.x + (next.x - first.x) * blend, y: first.y + (next.y - first.y) * blend };
  }
  let nearest: Point | undefined,
    distance = 0.75;
  if (points.length === 1 && Math.hypot(g.x - lanes.route[0].x, g.y - lanes.route[0].y) < 0.5)
    return points[0];
  for (let i = 1; i < lanes.route.length; i++) {
    const a = lanes.route[i - 1],
      b = lanes.route[i],
      dx = b.x - a.x,
      dy = b.y - a.y;
    const fraction = Math.max(
      0,
      Math.min(1, ((g.x - a.x) * dx + (g.y - a.y) * dy) / (dx * dx + dy * dy)),
    );
    const d = Math.hypot(g.x - a.x - dx * fraction, g.y - a.y - dy * fraction);
    if (d < distance) {
      distance = d;
      nearest = {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * fraction,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * fraction,
      };
    }
  }
  return nearest;
}
/** Resume saved exits before party-following or destination choice. Only reaching
 * a public path clears the boarding interlock; the simulation owns walking. */
export function resumeSharedExit(s: Park, g: Guest): boolean {
  if (g.sharedExit === undefined) return false;
  const b = s.buildings.find((b) => b.id === g.sharedExit),
    p = { x: Math.round(g.x), y: Math.round(g.y) };
  if (
    !b?.sharedAccess ||
    !supportsSharedAccess(b) ||
    (g.timer <= 0 && s.tiles[p.y]?.[p.x] === "path" && Math.hypot(p.x - g.x, p.y - g.y) < 0.05)
  ) {
    delete g.sharedExit;
    return false;
  }
  if (!g.route.length) g.route = routeFrom(s, p).slice(1);
  return true;
}

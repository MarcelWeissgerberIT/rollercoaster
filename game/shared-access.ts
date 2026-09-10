/** Catalog-backed public API for the single staffed entrance/exit mode. */
import {
  CATALOG,
  effectivePods,
  type Building,
  type Guest,
  type Park,
  type Point,
} from "./simulation";
import { operationsOf, resetRideOperations } from "./operations";
import { podPort, usesPods, type AccessPods } from "./pods";
import {
  routeFrom,
  supportsSharedAccess,
  sharedAccessRoute as routeCore,
  getSharedAccessLanes as lanesCore,
  sharedAccessGuestPosition as positionCore,
} from "./shared-access-routing";
export {
  supportsSharedAccess,
  sharedExitPending,
  SHARED_LANE_OFFSET,
} from "./shared-access-routing";
const key = (p: Point) => `${p.x},${p.y}`;
const neighbors = (p: Point): Point[] =>
  [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ].map(([x, y]) => ({ x: p.x + x, y: p.y + y }));
const basePods = (s: Park, b: Building): AccessPods =>
  b.pods ?? effectivePods(s, { ...b, sharedAccess: false });
const startOf = (s: Park, b: Building) => podPort(b, CATALOG[b.kind].size, basePods(s, b).entry);
export const sharedAccessRoute = (s: Park, b: Building) => routeCore(s, b, CATALOG[b.kind].size);
type Lanes = ReturnType<typeof lanesCore>;
const frameCaches = new WeakMap<Park, Map<number, Lanes>>();
/** Renderer-owned synchronous scope; construction between frames never sees stale routes. */
export function withSharedAccessCache<T>(s: Park, fn: () => T): T {
  const previous = frameCaches.get(s);
  frameCaches.set(s, new Map());
  try {
    return fn();
  } finally {
    if (previous) frameCaches.set(s, previous);
    else frameCaches.delete(s);
  }
}
export function getSharedAccessLanes(s: Park, b: Building): Lanes {
  const cache = frameCaches.get(s),
    existing = cache?.get(b.id);
  if (existing) return existing;
  const result = lanesCore(s, b, CATALOG[b.kind].size);
  cache?.set(b.id, result);
  return result;
}
export function sharedAccessGuestPosition(
  s: Park,
  g: Guest,
  cachedLanes?: ReturnType<typeof getSharedAccessLanes>,
): Point | undefined {
  const b = s.buildings.find((b) => b.id === (g.sharedExit ?? g.target));
  return b
    ? positionCore(s, g, CATALOG[b.kind].size, cachedLanes ?? getSharedAccessLanes(s, b))
    : undefined;
}
export function sharedAccessBusy(s: Park, b: Building): boolean {
  return !!(
    b.queue.length ||
    b.riders.length ||
    b.testing ||
    b.autoOpen ||
    ["running", "unloading"].includes(operationsOf(b).phase) ||
    s.guests.some((g) => g.target === b.id || g.sharedExit === b.id)
  );
}
export function sharedAccessChangeError(s: Park, b: Building, enabled: boolean): string | null {
  if (!s.buildings.includes(b) || !supportsSharedAccess(b))
    return "Ein gemeinsamer Zugang ist nur für Fahrgeschäfte mit Bedienpersonal verfügbar.";
  if (typeof enabled !== "boolean") return "Ungültige Einstellung für den gemeinsamen Zugang.";
  if (!!b.sharedAccess === enabled) return null;
  if (s.trackEdit?.buildingId === b.id) return "Beende zuerst den Streckenumbau.";
  if (sharedAccessBusy(s, b))
    return "Warte, bis alle Gäste die Attraktion und den Zugang verlassen haben und die Testfahrt beendet ist.";
  if (!enabled) return null;
  const start = startOf(s, b),
    route = routeFrom(s, start);
  if (!route.length)
    return "Verbinde den Eingang mit einem blauen Weg oder direkt mit einem öffentlichen Parkweg.";
  const component = [start],
    seen = new Set<string>();
  for (let i = 0; i < component.length; i++) {
    const p = component[i];
    if (seen.has(key(p)) || s.tiles[p.y]?.[p.x] !== "queue") continue;
    seen.add(key(p));
    component.push(...neighbors(p));
  }
  if (
    s.buildings.some(
      (other) => other.id !== b.id && usesPods(other.kind) && seen.has(key(startOf(s, other))),
    )
  )
    return "Diesen blauen Weg nutzt bereits eine andere Attraktion. Baue zuerst einen eigenen Zugang.";
  return null;
}
export function setSharedAccess(s: Park, b: Building, enabled: boolean): string | null {
  const error = sharedAccessChangeError(s, b, enabled);
  if (error) return error;
  if (!!b.sharedAccess === enabled) return null;
  // Never persist effective same-port pods: the separate exit is the return option.
  b.pods ??= structuredClone(basePods(s, b));
  b.sharedAccess = enabled;
  resetRideOperations(b);
  return null;
}

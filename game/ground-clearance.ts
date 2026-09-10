import type { Building, Point, Tile } from "./simulation";
import { prepareRoute } from "./motion";

/** Five metres below the rail structure leaves room for people and carried props. */
export const PATH_CLEARANCE = 1;
const RAIL_UNDERSIDE = 0.12;
const RAIL_HALF_WIDTH = 0.22;
const cache = new WeakMap<Point[], Map<string, number> | null>();
const groundCache = new WeakMap<Point[], Point[]>();
const cellKey = (x: number, y: number) => `${x},${y}`;

/** Segment interval inside a whole path tile, expanded by the rail's half-width.
 * Checking the complete interval also catches steep descents and loop bottoms. */
function clippedInterval(a: Point, b: Point, x: number, y: number) {
  let low = 0,
    high = 1;
  const radius = 0.5 + RAIL_HALF_WIDTH;
  for (const [start, delta, center] of [
    [a.x, b.x - a.x, x],
    [a.y, b.y - a.y, y],
  ]) {
    if (Math.abs(delta) < 1e-10) {
      if (Math.abs(start - center) > radius) return null;
      continue;
    }
    const first = (center - radius - start) / delta,
      last = (center + radius - start) / delta;
    low = Math.max(low, Math.min(first, last));
    high = Math.min(high, Math.max(first, last));
    if (low > high) return null;
  }
  return [low, high];
}
function heights(track: Point[]) {
  const cached = cache.get(track);
  if (cached !== undefined) return cached;
  let points: Point[];
  try {
    if (track.some(p => Math.abs(p.x) > 1e6 || Math.abs(p.y) > 1e6)) throw Error("Invalid extent");
    points = prepareRoute(track).points;
  } catch {
    // Corrupt or unfinished previews must never break camera/pod inspection or
    // gain a building exemption. The normal track validator reports the error.
    cache.set(track, null);
    return null;
  }
  const result = new Map<string, number>();
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)],
      b = points[i],
      radius = 0.5 + RAIL_HALF_WIDTH;
    for (
      let x = Math.ceil(Math.min(a.x, b.x) - radius);
      x <= Math.floor(Math.max(a.x, b.x) + radius);
      x++
    )
      for (
        let y = Math.ceil(Math.min(a.y, b.y) - radius);
        y <= Math.floor(Math.max(a.y, b.y) + radius);
        y++
      ) {
        const interval = clippedInterval(a, b, x, y);
        if (!interval) continue;
        const z = (t: number) => (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t - RAIL_UNDERSIDE,
          height = Math.min(z(interval[0]), z(interval[1])),
          key = cellKey(x, y);
        result.set(key, Math.min(height, result.get(key) ?? Infinity));
      }
  }
  cache.set(track, result);
  return result;
}
export function trackClearsGround(track: Point[], x: number, y: number, station = track[0]) {
  if (station && Math.round(station.x) === x && Math.round(station.y) === y) return false;
  const profile = heights(track);
  return !!profile && (profile.get(cellKey(x, y)) ?? Infinity) >= PATH_CLEARANCE;
}
export const pedestrianTile = (tile: Tile) =>
  tile === "path" || tile === "queue" || tile === "exit";
/** The same rule is used while laying paths and while editing a track above them. */
export function trackGroundCompatible(track: Point[], x: number, y: number, tile: Tile) {
  return tile === "grass" || (pedestrianTile(tile) && trackClearsGround(track, x, y));
}
/** Keep selection/demolition's full footprint intact; only ground construction uses this one. */
export function groundFootprint(
  b: Pick<Building, "kind" | "x" | "y" | "track">,
  solidFootprint: Point[],
): Point[] {
  if (b.kind !== "coaster" || !b.track) return solidFootprint;
  let cells = groundCache.get(b.track);
  if (!cells) {
    const profile = heights(b.track);
    if (!profile) return [...solidFootprint, { x: b.x, y: b.y }];
    cells = [...profile]
      .filter(([, z]) => z < PATH_CLEARANCE)
      .map(([key]) => {
        const [x, y] = key.split(",").map(Number);
        return { x, y };
      });
    groundCache.set(b.track, cells);
  }
  return cells.some((p) => p.x === b.x && p.y === b.y) ? cells : [...cells, { x: b.x, y: b.y }];
}

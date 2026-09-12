import type { Park, Point, CoasterType } from "./simulation";
import { prepareRoute, routePosition, type RouteMotion, type Vec } from "./motion";
import { terrainHeight } from "./terrain";
import { withTerrainSurfaceScope } from "./terrain-surface";

/** Coordinates are tiles, like the saved track. The 3D running rail has a 1.1 m datum. */
export const TUNNEL_RAIL_DATUM = 0.22;
export const TUNNEL_INNER_RADIUS = 0.66;
export const TUNNEL_CUT_RADIUS = 0.72;
export const TUNNEL_PORTAL_RADIUS = 0.88;
export type TunnelFrame = {
  x: number;
  y: number;
  z: number;
  tangent: Vec;
  right: Vec;
  up: Vec;
};
export type TunnelPortal = {
  buildingId: number;
  style: CoasterType;
  frame: TunnelFrame;
  /** Direction towards the open air, independent of train travel. */
  outward: Vec;
  entry: boolean;
};
export type TunnelSpan = {
  buildingId: number;
  style: CoasterType;
  start: number;
  end: number;
  frames: TunnelFrame[];
  portals: TunnelPortal[];
  closed: boolean;
};
export type TunnelLayout = {
  spans: TunnelSpan[];
  portals: TunnelPortal[];
  /** Conservative spatial index of bore samples, used only for affected terrain cells. */
  cells: Map<string, TunnelFrame[]>;
};
const cache = new WeakMap<
  Park,
  {
    signature: string;
    tracks: (Point[] | undefined)[];
    layout: TunnelLayout;
  }
>();
const frameAt = (route: RouteMotion, distance: number): TunnelFrame => {
  const p = routePosition(route, distance);
  return {
    x: p.x,
    y: p.y,
    z: (p.z ?? 0) + TUNNEL_RAIL_DATUM,
    tangent: p.tangent,
    right: p.right,
    up: p.up,
  };
};
/** The rail must actually enter ground; raised track over a hill never creates a tunnel. */
export function coasterPointBuried(park: Park, point: Point) {
  return terrainHeight(park, point.x, point.y) > (point.z ?? 0) + TUNNEL_RAIL_DATUM + 0.015;
}
function routeRanges(park: Park, route: RouteMotion) {
  if (route.length < 0.001) return [];
  const at = (distance: number) => routePosition(route, distance),
    buried = (distance: number) => coasterPointBuried(park, at(distance)),
    count = Math.max(1, Math.ceil(route.length / 0.07)),
    ranges: { start: number; end: number }[] = [];
  let previous = buried(0),
    start = previous ? 0 : -1;
  for (let i = 1; i <= count; i++) {
    const distance = (route.length * i) / count,
      current = buried(distance);
    if (current !== previous) {
      let lo = (route.length * (i - 1)) / count,
        hi = distance;
      // Handles both stepped cell boundaries and interpolated natural hills.
      for (let n = 0; n < 25; n++) {
        const middle = (lo + hi) / 2;
        if (buried(middle) === previous) lo = middle;
        else hi = middle;
      }
      const boundary = (lo + hi) / 2;
      if (current) start = boundary;
      else ranges.push({ start, end: boundary });
      previous = current;
    }
  }
  if (previous) ranges.push({ start, end: route.length });
  const a = route.points[0],
    b = route.points.at(-1)!,
    closed = Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0)) < 0.001;
  if (closed && ranges.length > 1 && ranges[0].start === 0 && ranges.at(-1)!.end === route.length) {
    const first = ranges.shift()!,
      last = ranges.pop()!;
    ranges.push({ start: last.start, end: route.length + first.end });
  }
  return ranges;
}
/** Derived from terrain and existing saved tracks; no second tunnel state can drift on load/Undo. */
export function parkCoasterTunnels(park: Park): TunnelLayout {
  return withTerrainSurfaceScope(park, () => {
    const buildings = park.buildings.filter(
        (b) => b.kind === "coaster" && (b.track?.length ?? 0) >= 2,
      ),
      tracks = buildings.map((b) => b.track),
      signature = `${JSON.stringify(park.terrain ?? {})}|${park.naturalTerrain === true}|${park.tiles.map((row) => row.join(",")).join(";")}|${park.buildings.map((b) => `${b.id}:${b.kind}:${b.x},${b.y},${b.orientation ?? 0}`).join(";")}`,
      old = cache.get(park);
    if (
      old &&
      old.signature === signature &&
      old.tracks.length === tracks.length &&
      tracks.every((track, i) => track === old.tracks[i])
    )
      return old.layout;
    const layout: TunnelLayout = { spans: [], portals: [], cells: new Map() };
    for (const building of buildings) {
      const track = building.track!,
        route = prepareRoute(track),
        style = track[0].style ?? "steel";
      for (const range of routeRanges(park, route)) {
        if (range.end - range.start < 0.015) continue;
        const closed =
            range.start === 0 &&
            range.end === route.length &&
            Math.hypot(
              track[0].x - track.at(-1)!.x,
              track[0].y - track.at(-1)!.y,
              (track[0].z ?? 0) - (track.at(-1)!.z ?? 0),
            ) < 0.001,
          count = Math.max(1, Math.ceil((range.end - range.start) / 0.075)),
          frames = Array.from({ length: count + 1 }, (_, i) =>
            frameAt(route, range.start + ((range.end - range.start) * i) / count),
          ),
          portals: TunnelPortal[] = [];
        // A wholly buried closed circuit has an uninterrupted bore, not two fake doors at its seam.
        if (!closed)
          for (const entry of [true, false]) {
            const frame = entry ? frames[0] : frames.at(-1)!,
              sign = entry ? -1 : 1;
            portals.push({
              buildingId: building.id,
              style,
              frame,
              entry,
              outward: {
                x: frame.tangent.x * sign,
                y: frame.tangent.y * sign,
                z: frame.tangent.z * sign,
              },
            });
          }
        const span: TunnelSpan = {
          buildingId: building.id,
          style,
          ...range,
          frames,
          portals,
          closed,
        };
        layout.spans.push(span);
        layout.portals.push(...portals);
        for (const frame of frames) {
          const r = TUNNEL_CUT_RADIUS + 0.1;
          for (let y = Math.ceil(frame.y - r - 0.5); y <= Math.floor(frame.y + r + 0.5); y++)
            for (let x = Math.ceil(frame.x - r - 0.5); x <= Math.floor(frame.x + r + 0.5); x++) {
              if (!park.tiles[y]?.[x]) continue;
              const key = `${x},${y}`,
                samples = layout.cells.get(key) ?? [];
              samples.push(frame);
              layout.cells.set(key, samples);
            }
        }
      }
    }
    cache.set(park, { signature, tracks, layout });
    return layout;
  });
}
/** Union all bores at a column, keeping stacked tunnels separated by intact rock. */
export function tunnelVoidIntervals(samples: TunnelFrame[], x: number, y: number, halfWidth = 0) {
  const intervals: [number, number][] = [],
    radius = TUNNEL_CUT_RADIUS + halfWidth * Math.SQRT2;
  for (const sample of samples) {
    const d2 = (sample.x - x) ** 2 + (sample.y - y) ** 2;
    if (d2 >= radius ** 2) continue;
    const h = Math.sqrt(radius ** 2 - d2);
    intervals.push([sample.z - h, sample.z + h]);
  }
  intervals.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const interval of intervals) {
    const previous = merged.at(-1);
    if (previous && interval[0] <= previous[1]) previous[1] = Math.max(previous[1], interval[1]);
    else merged.push([...interval]);
  }
  return merged;
}
/** The same ring points draw both the park portal and the open 3D lining. */
export function tunnelRingPoint(
  frame: TunnelFrame,
  angle: number,
  radius = TUNNEL_INNER_RADIUS,
): Point {
  const side = Math.cos(angle) * radius,
    up = Math.sin(angle) * radius;
  return {
    x: frame.x + frame.right.x * side + frame.up.x * up,
    y: frame.y + frame.right.y * side + frame.up.y * up,
    z: frame.z + frame.right.z * side + frame.up.z * up,
  };
}

/** Keep chase cameras within the bore by moving to the front seat before entry.
 * Fade back only once the full trailing camera distance has cleared the exit. */
export function tunnelChaseBlend(
  park: Park,
  buildingId: number,
  distance: number,
  routeLength: number,
  backMetres: number,
) {
  const spans = parkCoasterTunnels(park).spans.filter((span) => span.buildingId === buildingId);
  if (!spans.length || routeLength <= 0) return 1;
  const d = ((distance % routeLength) + routeLength) % routeLength;
  let gap = Infinity;
  for (const span of spans)
    for (const shift of [-routeLength, 0, routeLength]) {
      const start = span.start + shift,
        end = span.end + shift;
      gap = Math.min(gap, d < start ? start - d : d > end ? d - end : 0);
    }
  const t = Math.max(0, Math.min(1, (gap - backMetres / 5 - 1) / 2));
  return t * t * (3 - 2 * t);
}

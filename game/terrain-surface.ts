import type { Park, Point } from "./simulation";

export type SurfacePoint = { x: number; y: number; z: number };
let footprint: (b: Park["buildings"][number]) => Point[] = (b) => [{ x: b.x, y: b.y }];
export function setSurfaceFootprints(resolve: typeof footprint) {
  footprint = resolve;
}
export const terrainCenterHeight = (s: Park, x: number, y: number) =>
  s.terrain?.[`${Math.round(x)},${Math.round(y)}`] ?? 0;

const natural = (kind: string) => kind === "tree" || kind === "pine" || kind === "flowers";
const masks = new WeakMap<
  Park,
  {
    buildings: Park["buildings"];
    positions: string;
    cells: Set<string>;
  }
>();
type SurfaceScope = { pads: Set<string>; surfaces: Map<string, SurfacePoint[]> };
const scopes = new WeakMap<Park, SurfaceScope>();
const snapshots = new WeakMap<Park, { signature: string; scope: SurfaceScope }>();

/** One read-only render, physics tick or mesh build shares its surface results.
 * Discard the scope on return so subsequent in-place construction edits are live. */
export function withTerrainSurfaceScope<T>(s: Park, read: () => T): T {
  if (!s.naturalTerrain || scopes.has(s)) return read();
  const pads = buildingPads(s),
    signature =
      Object.entries(s.terrain ?? {})
        .map(([key, z]) => `${key}:${z}`)
        .join(";") +
      "|" +
      s.tiles.map((row) => row.join(",")).join(";"),
    old = snapshots.get(s),
    scope =
      old?.signature === signature && old.scope.pads === pads
        ? old.scope
        : { pads, surfaces: new Map<string, SurfacePoint[]>() };
  // Compare live values once per operation, so edits made in-place between
  // frames invalidate the geometry without rescanning buildings at every sample.
  snapshots.set(s, { signature, scope });
  scopes.set(s, scope);
  try {
    return read();
  } finally {
    scopes.delete(s);
  }
}
function buildingPads(s: Park) {
  const hard = s.buildings.filter((b) => !natural(b.kind)),
    positions = hard.map((b) => `${b.id}:${b.kind}:${b.x},${b.y},${b.orientation ?? 0}`).join(";"),
    cached = masks.get(s);
  if (cached?.buildings === s.buildings && cached.positions === positions) return cached.cells;
  const cells = new Set<string>();
  for (const b of hard)
    // Only the station needs a pad; elevated rail must not flatten a mountainside.
    for (const p of b.kind === "coaster" ? [{ x: b.x, y: b.y }] : footprint(b))
      cells.add(`${p.x},${p.y}`);
  masks.set(s, { buildings: s.buildings, positions, cells });
  return cells;
}

/** Natural land has integer construction heights at cell centers and shared
 * corner heights between them. Both renderers and fractional ground queries use
 * these same four triangles. Old parks retain their original level columns. */
export function terrainCellSurface(s: Park, x: number, y: number): SurfacePoint[] {
  const scope = scopes.get(s),
    key = `${x},${y}`,
    cached = scope?.surfaces.get(key);
  if (cached) return cached;
  const z = terrainCenterHeight(s, x, y),
    pads = s.naturalTerrain ? (scope?.pads ?? buildingPads(s)) : undefined,
    hard = (xx: number, yy: number) =>
      (s.tiles[yy]?.[xx] !== undefined && s.tiles[yy][xx] !== "grass") ||
      Boolean(pads?.has(`${xx},${yy}`)),
    flat = !s.naturalTerrain || hard(x, y);
  const surface = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ].map(([dx, dy]) => {
    const cx = x + dx,
      cy = y + dy;
    if (flat) return { x: cx, y: cy, z };
    const heights: number[] = [],
      pinned: number[] = [];
    for (let yy = Math.floor(cy); yy <= Math.ceil(cy); yy++)
      for (let xx = Math.floor(cx); xx <= Math.ceil(cx); xx++) {
        if (s.tiles[yy]?.[xx] === undefined) continue;
        const h = terrainCenterHeight(s, xx, yy);
        heights.push(h);
        if (hard(xx, yy)) pinned.push(h);
      }
    // Deliberately excavated cliffs remain cliffs. Natural one-level changes
    // meet at one shared height, with paths, lake shores and building pads level.
    const cliff =
      Math.max(...heights) - Math.min(...heights) > 1 ||
      (pinned.length > 1 && Math.max(...pinned) !== Math.min(...pinned));
    const corner = cliff
      ? z
      : pinned.length
        ? pinned[0]
        : heights.reduce((sum, h) => sum + h, 0) / heights.length;
    return { x: cx, y: cy, z: corner };
  });
  scope?.surfaces.set(key, surface);
  return surface;
}

export function terrainSurfaceHeight(s: Park, x: number, y: number) {
  const onMap = x >= -0.5 && y >= -0.5 && x <= s.tiles[0].length - 0.5 && y <= s.tiles.length - 0.5,
    cx =
      s.naturalTerrain && onMap
        ? Math.min(s.tiles[0].length - 1, Math.max(0, Math.round(x)))
        : Math.round(x),
    cy =
      s.naturalTerrain && onMap
        ? Math.min(s.tiles.length - 1, Math.max(0, Math.round(y)))
        : Math.round(y),
    z = terrainCenterHeight(s, cx, cy);
  if (!s.naturalTerrain || (x === cx && y === cy) || s.tiles[cy]?.[cx] === undefined) return z;
  const ring = terrainCellSurface(s, cx, cy),
    dx = x - cx,
    dy = y - cy,
    edge = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0,
    a = ring[edge],
    b = ring[(edge + 1) % 4],
    ax = a.x - cx,
    ay = a.y - cy,
    bx = b.x - cx,
    by = b.y - cy,
    determinant = ax * by - ay * bx,
    wa = (dx * by - dy * bx) / determinant,
    wb = (ax * dy - ay * dx) / determinant;
  return z + wa * (a.z - z) + wb * (b.z - z);
}

/** Slow, overlapping meadow patches avoid a repeating checkerboard in both views. */
export function terrainGrassColor(x: number, y: number) {
  const patch = Math.sin(x * 0.29 + Math.sin(y * 0.21)) + Math.cos(y * 0.33 - x * 0.11) * 0.65;
  return patch > 0.8 ? "#88ac59" : patch < -0.65 ? "#789c4e" : "#80a653";
}

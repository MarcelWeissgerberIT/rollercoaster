import type { Park } from "./simulation";
import { terrainCenterHeight, type SurfacePoint } from "./terrain-surface";

/** A shared shoreline within the real water cells, with exposed corners rounded
 * into small coves. Adjacent water cells meet without seams or artificial rims. */
export function naturalWaterOutline(s: Park, x: number, y: number, bank = false): SurfacePoint[] {
  const z = terrainCenterHeight(s, x, y),
    inset = bank ? 0 : 0.065,
    water = (dx: number, dy: number) =>
      s.tiles[y + dy]?.[x + dx] === "water" && terrainCenterHeight(s, x + dx, y + dy) === z,
    result: SurfacePoint[] = [];
  for (const [sx, sy, ax, ay, bx, by] of [
    [-1, -1, 0, 1, 1, 0],
    [1, -1, -1, 0, 0, 1],
    [1, 1, 0, -1, -1, 0],
    [-1, 1, 1, 0, 0, -1],
  ]) {
    const sideX = !water(sx, 0),
      sideY = !water(0, sy),
      cx = x + sx * (0.5 - (sideX ? inset : 0)),
      cy = y + sy * (0.5 - (sideY ? inset : 0));
    if (!sideX || !sideY) {
      result.push({ x: cx, y: cy, z });
      continue;
    }
    const radius = bank ? 0.28 : 0.3;
    for (const t of [0, 1 / 3, 2 / 3, 1])
      result.push({
        x: cx + radius * ((1 - t) ** 2 * ax + t ** 2 * bx),
        y: cy + radius * ((1 - t) ** 2 * ay + t ** 2 * by),
        z,
      });
  }
  return result;
}

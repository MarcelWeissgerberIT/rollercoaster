import { pedestrianTile } from "./ground-clearance";
import type { Park } from "./simulation";

export type GroundPath = (x: number, y: number) => boolean;
export const groundPathAt = (s: Pick<Park, "tiles">, x: number, y: number) =>
  pedestrianTile(s.tiles[Math.round(y)]?.[Math.round(x)] ?? "grass");

/** Reserve the entire bent and both footings, not just a point at the rail centre. */
export function supportClearAt(x: number, y: number, groundPath?: GroundPath): boolean {
  if (!groundPath) return true;
  const radius = 0.4;
  for (let cy = Math.ceil(y - radius - 0.5); cy <= Math.floor(y + radius + 0.5); cy++)
    for (let cx = Math.ceil(x - radius - 0.5); cx <= Math.floor(x + radius + 0.5); cx++)
      if (groundPath(cx, cy)) return false;
  return true;
}
export const trackSupportClear = (s: Pick<Park, "tiles">, x: number, y: number) =>
  supportClearAt(x, y, (cx, cy) => groundPathAt(s, cx, cy));

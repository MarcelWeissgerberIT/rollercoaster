import type { Guest, Park, Point } from "./simulation";

const traversable = (park: Park, x: number, y: number) =>
  ["path", "queue", "exit"].includes(park.tiles[y]?.[x]);

/** Use the same tile-space formation in the map and 3D, without changing the
 * simulation's route, walking speed, wallet or party membership. */
export function guestWalkPosition(
  park: Park,
  g: Guest,
  position: Point = g,
  direction?: Point,
): Point {
  if (!["walk", "leave"].includes(g.state) || g.transit) return { x: position.x, y: position.y };
  const next =
      direction ?? g.route.find((p) => Math.hypot(p.x - position.x, p.y - position.y) > 0.025),
    dx = next ? next.x - position.x : 0,
    dy = next && Math.hypot(dx, next.y - position.y) > 0.001 ? next.y - position.y : -1,
    length = Math.hypot(dx, dy) || 1,
    forward = { x: dx / length, y: dy / length },
    member = g.party && g.party.kind !== "solo" ? g.party.member : 0,
    size = g.party && g.party.kind !== "solo" ? g.party.size : 1,
    across = size > 1 ? (member % 2 ? 0.23 : -0.23) : ((g.id % 3) - 1) * 0.13,
    along = size > 2 ? (Math.floor(member / 2) ? -0.31 : 0.31) : 0,
    intended = {
      x: position.x + forward.x * along - forward.y * across,
      y: position.y + forward.y * along + forward.x * across,
    };
  // Project the formation onto nearby walkable tile interiors. This handles
  // one-tile paths, corners and map edges without stepping through grass or
  // another tile's building. The body retains a 0.1-tile border clearance.
  let best: Point | undefined,
    distance = Infinity;
  for (let y = Math.round(position.y) - 1; y <= Math.round(position.y) + 1; y++)
    for (let x = Math.round(position.x) - 1; x <= Math.round(position.x) + 1; x++) {
      if (!traversable(park, x, y)) continue;
      const q = {
          x: Math.max(
            x - (traversable(park, x - 1, y) ? 0.5 : 0.4),
            Math.min(x + (traversable(park, x + 1, y) ? 0.5 : 0.4), intended.x),
          ),
          y: Math.max(
            y - (traversable(park, x, y - 1) ? 0.5 : 0.4),
            Math.min(y + (traversable(park, x, y + 1) ? 0.5 : 0.4), intended.y),
          ),
        },
        d = Math.hypot(q.x - intended.x, q.y - intended.y);
      const clear = Array.from({ length: 9 }, (_, i) => i / 8).every((t) =>
        traversable(
          park,
          Math.round(position.x + (q.x - position.x) * t),
          Math.round(position.y + (q.y - position.y) * t),
        ),
      );
      if (clear && d < distance) {
        best = q;
        distance = d;
      }
    }
  return best ?? { x: position.x, y: position.y };
}

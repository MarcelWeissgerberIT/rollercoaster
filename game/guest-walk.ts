import { hasElevations, walkTile } from "./terrain";
import type { Guest, Park, Point } from "./simulation";
import { getSharedAccessLanes, sharedAccessGuestPosition } from "./shared-access";
import { POD_DIRECTIONS } from "./pods";

const traversable = (park: Park, x: number, y: number) =>
  ["path", "queue", "exit"].includes(park.tiles[y]?.[x]);

/** Waiting guests face along their real incoming lane toward the gate. The
 * short final segment also covers a gate directly on a public path. */
export function guestQueueDirection(park: Park, g: Guest, position?: Point): Point | undefined {
  if (g.state !== "queue" || g.transit || g.sharedExit !== undefined) return undefined;
  const b = park.buildings.find((item) => item.id === g.target);
  if (!b?.sharedAccess || !b.queue.includes(g.id)) return undefined;
  const lanes = getSharedAccessLanes(park, b),
    p = position ?? sharedAccessGuestPosition(park, g, lanes);
  if (!p || !lanes.entry.length) return undefined;
  const [dx, dy] = POD_DIRECTIONS[b.pods?.entry.side ?? 0];
  let closest = Infinity,
    facing: Point | undefined;
  for (let i = 0; i < lanes.entry.length; i++) {
    const end = lanes.entry[i],
      start = lanes.entry[i - 1] ?? { x: end.x - dx * 0.6, y: end.y - dy * 0.6 },
      vx = end.x - start.x,
      vy = end.y - start.y,
      length = Math.hypot(vx, vy);
    if (length < 0.001) continue;
    const fraction = Math.max(
        0,
        Math.min(1, ((p.x - start.x) * vx + (p.y - start.y) * vy) / (length * length)),
      ),
      distance = Math.hypot(p.x - start.x - vx * fraction, p.y - start.y - vy * fraction);
    if (distance < closest) {
      closest = distance;
      facing = { x: -vx / length, y: -vy / length };
    }
  }
  return facing;
}

/** Use the same tile-space formation in the map and 3D, without changing the
 * simulation's route, walking speed, wallet or party membership. */
export function guestWalkPosition(
  park: Park,
  g: Guest,
  position: Point = g,
  direction?: Point,
): Point {
  const traversable = (state: Park, x: number, y: number) =>
    ["path", "queue", "exit"].includes(walkTile(state, { x, y, z: position.z ?? g.z }) ?? "");
  const shared = sharedAccessGuestPosition(
    park,
    position === g ? g : { ...g, x: position.x, y: position.y },
  );
  if (shared) return shared;
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

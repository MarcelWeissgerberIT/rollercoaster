import { canAfford } from "./budget";
import { groundFootprint } from "./ground-clearance";
import {
  type Park,
  type Building,
  type Point,
  CATALOG,
  connected,
  occupant,
  groundOccupant,
  canAutoClear,
  effectivePods,
  paint,
  spend,
  key,
  footprint,
  exitPath,
} from "./simulation";
import { podSlots, podPort, samePod, usesPods, type Pod } from "./pods";
import { planPod, setAccessPod } from "./construction";
export type ExitSuggestion = {
  pod: Pod;
  points: Point[];
  clearIds: number[];
  cost: number;
  /** The preview can explain a relocated pod and safe crossings beneath rail. */
  moved: boolean;
  underpass: Point[];
};
/** Search only real buildable cells. Blue admission paths and occupied facilities are barriers. */
export function suggestExit(s: Park, b: Building, clear = true): ExitSuggestion | null {
  const net = connected(s),
    pods = effectivePods(s, b),
    blocked = new Map<string, Building>();
  for (const item of s.buildings)
    for (const p of groundFootprint(item, footprint(item))) {
      const previous = blocked.get(key(p));
      if (!previous || canAutoClear(previous.kind)) blocked.set(key(p), item);
    }
  let best: ExitSuggestion | null = null;
  // On equal cost keep the player's existing exit instead of moving it arbitrarily.
  const slots = [
    pods.exit,
    ...podSlots(CATALOG[b.kind].size).filter((p) => !samePod(p, pods.exit)),
  ];
  for (const pod of slots) {
    if (planPod(s, b, "exit", pod, clear).error) continue;
    const start = podPort(b, CATALOG[b.kind].size, pod),
      frontier = [{ p: start, path: [] as Point[], ids: [] as number[], cost: 0 }],
      seen = new Map<string, number>();
    while (frontier.length) {
      frontier.sort((a, b) => b.cost - a.cost);
      const q = frontier.pop()!,
        k = key(q.p);
      if (
        q.cost >= (best?.cost ?? Infinity) ||
        q.cost >= (seen.get(k) ?? Infinity) ||
        q.path.length > 18
      )
        continue;
      seen.set(k, q.cost);
      const tile = s.tiles[q.p.y]?.[q.p.x];
      if (!tile || tile === "water" || tile === "queue") continue;
      const hit = blocked.get(k);
      if (hit && (!clear || !canAutoClear(hit.kind))) continue;
      if (net.has(k) && tile === "path" && !hit) {
        best = {
          pod,
          points: q.path,
          clearIds: q.ids,
          cost: q.cost,
          moved: !samePod(pod, pods.exit),
          underpass: q.path.filter((p) => occupant(s, p.x, p.y)?.kind === "coaster"),
        };
        break;
      }
      const ids = hit && !q.ids.includes(hit.id) ? [...q.ids, hit.id] : q.ids;
      const cost = q.cost + (tile === "exit" ? 0 : 18) + (ids.length - q.ids.length) * 10;
      const path = [...q.path, q.p];
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ])
        frontier.push({ p: { x: q.p.x + dx, y: q.p.y + dy }, path, ids, cost });
    }
  }
  return best;
}
/** Contextual construction help belongs to the nearby unconnected exit, even
 * when a different coaster is the obstacle. It never picks a remote park ride. */
export function exitHelpAt(
  s: Park,
  point: Point,
  clear = true,
): {
  buildingId: number;
  name: string;
  proposal: ExitSuggestion | null;
} | null {
  if (!groundOccupant(s, point.x, point.y) && s.tiles[point.y]?.[point.x] !== "water") return null;
  const net = connected(s),
    candidates = s.buildings
      .filter((b) => usesPods(b.kind))
      .map((b) => {
        const port = podPort(b, CATALOG[b.kind].size, effectivePods(s, b, net).exit);
        return { b, distance: Math.abs(port.x - point.x) + Math.abs(port.y - point.y) };
      })
      .filter((item) => item.distance <= 6 && !exitPath(s, item.b, net).length);
  candidates.sort((a, b) => a.distance - b.distance || a.b.id - b.b.id);
  const candidate = candidates[0]?.b;
  return candidate
    ? {
        buildingId: candidate.id,
        name: candidate.name || CATALOG[candidate.kind].name,
        proposal: suggestExit(s, candidate, clear),
      }
    : null;
}
export function applyExitSuggestion(
  s: Park,
  b: Building,
  proposal: ExitSuggestion,
  clear = true,
): string | null {
  const fresh = suggestExit(s, b, clear);
  if (!fresh || JSON.stringify(fresh) !== JSON.stringify(proposal))
    return "Der Bauplatz hat sich geändert. Lass den Ausgang erneut prüfen.";
  if (!canAfford(s, fresh.cost)) return "Das Budget reicht für diesen Ausgang nicht.";
  const error = setAccessPod(s, b, "exit", fresh.pod, clear);
  if (error) return error;
  // setAccessPod may already clear the first cell and charge its ten euros.
  const remaining = s.buildings.filter((item) => fresh.clearIds.includes(item.id));
  if (remaining.length) spend(s, remaining.length * 10);
  s.buildings = s.buildings.filter((item) => !fresh.clearIds.includes(item.id));
  for (const p of fresh.points)
    if (s.tiles[p.y][p.x] !== "exit") {
      const error = paint(s, p.x, p.y, "exit");
      if (error) return error;
    }
  return null;
}

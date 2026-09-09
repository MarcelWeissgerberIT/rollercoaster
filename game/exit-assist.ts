import {
  type Park,
  type Building,
  type Point,
  CATALOG,
  connected,
  occupant,
  canAutoClear,
  effectivePods,
  paint,
  spend,
  key,
  footprint,
} from "./simulation";
import { podSlots, podPort, samePod, type Pod } from "./pods";
import { planPod, setAccessPod } from "./construction";
export type ExitSuggestion = { pod: Pod; points: Point[]; clearIds: number[]; cost: number };
/** Search only real buildable cells. Blue admission paths and occupied facilities are barriers. */
export function suggestExit(s: Park, b: Building, clear = true): ExitSuggestion | null {
  const net = connected(s),
    pods = effectivePods(s, b),
    blocked = new Map<string, Building>();
  for (const item of s.buildings) for (const p of footprint(item)) blocked.set(key(p), item);
  let best: ExitSuggestion | null = null;
  for (const pod of podSlots(CATALOG[b.kind].size)) {
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
      if (net.has(k) && s.tiles[q.p.y]?.[q.p.x] === "path") {
        best = { pod, points: q.path, clearIds: q.ids, cost: q.cost };
        break;
      }
      const tile = s.tiles[q.p.y]?.[q.p.x];
      if (!tile || tile === "water" || tile === "queue") continue;
      const hit = blocked.get(k);
      if (hit && (!clear || !canAutoClear(hit.kind))) continue;
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
export function applyExitSuggestion(
  s: Park,
  b: Building,
  proposal: ExitSuggestion,
  clear = true,
): string | null {
  const fresh = suggestExit(s, b, clear);
  if (!fresh || JSON.stringify(fresh) !== JSON.stringify(proposal))
    return "Der Bauplatz hat sich geändert. Lass den Ausgang erneut prüfen.";
  if (s.cash < fresh.cost) return "Das Budget reicht für diesen Ausgang nicht.";
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

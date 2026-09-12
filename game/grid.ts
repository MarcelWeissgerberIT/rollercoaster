import type { Park, Point } from "./simulation";
import { canAfford, spendCash } from "./budget";
import { hasElevations, elevationRoute } from "./terrain";
export const PARK_ENTRANCE = { x: 15, y: 29 };
export const INITIAL_SIZE = 30,
  MAX_SIZE = 54,
  LAND_STEP = 6;
export const mapWidth = (s: Pick<Park, "tiles">) => s.tiles[0]?.length ?? 0;
export const mapHeight = (s: Pick<Park, "tiles">) => s.tiles.length;
export const insideMap = (s: Pick<Park, "tiles">, x: number, y: number) =>
  x >= 0 && y >= 0 && x < mapWidth(s) && y < mapHeight(s);
export function pathRoute(s: Park, start: Point, end: Point, queues = false): Point[] {
  if (hasElevations(s)) return elevationRoute(s, start, end, queues);
  const q = [{ x: Math.round(start.x), y: Math.round(start.y) }],
    key = (p: Point) => `${p.x},${p.y}`,
    previous = new Map<string, Point | null>([[key(q[0]), null]]);
  for (let i = 0; i < q.length; i++) {
    const p = q[i];
    if (p.x === end.x && p.y === end.y) {
      const route: Point[] = [];
      let at: Point | null = p;
      while (at) {
        route.unshift(at);
        at = previous.get(key(at)) ?? null;
      }
      return route;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = { x: p.x + dx, y: p.y + dy };
      if (
        insideMap(s, n.x, n.y) &&
        (s.tiles[n.y][n.x] === "path" || (queues && s.tiles[n.y][n.x] === "queue")) &&
        !previous.has(key(n))
      ) {
        previous.set(key(n), p);
        q.push(n);
      }
    }
  }
  return [];
}
export function expansionPlan(s: Park, axis: "east" | "south") {
  const width = mapWidth(s),
    height = mapHeight(s),
    count = Math.min(LAND_STEP, MAX_SIZE - (axis === "east" ? width : height));
  const points: Point[] = [];
  if (count > 0) {
    if (axis === "east")
      for (let y = 0; y < height; y++)
        for (let x = width; x < width + count; x++) points.push({ x, y });
    else
      for (let y = height; y < height + count; y++)
        for (let x = 0; x < width; x++) points.push({ x, y });
  }
  const cost = points.length * (12 + Math.floor((width - 30 + (height - 30)) / 6) * 2);
  return {
    axis,
    points,
    cost,
    width: width + (axis === "east" ? count : 0),
    height: height + (axis === "south" ? count : 0),
    error:
      count <= 0
        ? "Der Park ist in dieser Richtung vollständig erweitert."
        : !canAfford(s, cost)
          ? "Das Budget reicht für dieses Grundstück noch nicht."
          : null,
  };
}
export function expandPark(s: Park, axis: "east" | "south"): string | null {
  const plan = expansionPlan(s, axis);
  if (plan.error) return plan.error;
  const width = mapWidth(s),
    height = mapHeight(s);
  for (let y = 0; y < plan.height; y++) {
    if (!s.tiles[y]) s.tiles[y] = [];
    for (let x = s.tiles[y].length; x < plan.width; x++) s.tiles[y][x] = "grass";
  }
  spendCash(s, plan.cost);
  s.expenses += plan.cost;
  s.dayExpenses += plan.cost;
  s.landValue = (s.landValue ?? 0) + plan.cost;
  return null;
}

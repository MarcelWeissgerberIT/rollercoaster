import type { Park, Point } from "./simulation";
import { insideMap, PARK_ENTRANCE as ENTRANCE } from "./grid";
const key = (p: Point) => `${p.x},${p.y}`;
const dirs = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
export function connected(s: Park) {
  const seen = new Set<string>();
  const q = [ENTRANCE];
  if (!["path", "queue"].includes(s.tiles[ENTRANCE.y][ENTRANCE.x])) return seen;
  seen.add(key(ENTRANCE));
  for (let i = 0; i < q.length; i++) {
    const p = q[i];
    for (const [dx, dy] of dirs) {
      const n = { x: p.x + dx, y: p.y + dy };
      if (
        insideMap(s, n.x, n.y) &&
        ["path", "queue"].includes(s.tiles[n.y][n.x]) &&
        !seen.has(key(n))
      ) {
        seen.add(key(n));
        q.push(n);
      }
    }
  }
  return seen;
}
/** Each red tile points downstream to a connected public path. Red never extends the entrance network. */
export function exitNetwork(s: Park, net = connected(s)): Map<string, Point> {
  const next = new Map<string, Point>(),
    q: Point[] = [];
  for (const k of net) {
    const [x, y] = k.split(",").map(Number);
    if (s.tiles[y][x] !== "path") continue;
    for (const [dx, dy] of dirs) {
      const p = { x: x + dx, y: y + dy };
      if (s.tiles[p.y]?.[p.x] === "exit" && !next.has(key(p))) {
        next.set(key(p), { x, y });
        q.push(p);
      }
    }
  }
  for (let i = 0; i < q.length; i++)
    for (const [dx, dy] of dirs) {
      const p = { x: q[i].x + dx, y: q[i].y + dy };
      if (s.tiles[p.y]?.[p.x] === "exit" && !next.has(key(p))) {
        next.set(key(p), q[i]);
        q.push(p);
      }
    }
  return next;
}
export function followExit(start: Point, exits: Map<string, Point>): Point[] {
  const route = [start];
  let p = start;
  while (exits.has(key(p))) {
    p = exits.get(key(p))!;
    route.push(p);
  }
  return route;
}
export function exitFromCells(cells: Point[], exits: Map<string, Point>) {
  return (
    cells
      .filter((p) => exits.has(key(p)))
      .map((p) => followExit(p, exits))
      .sort((a, b) => a.length - b.length)[0] ?? []
  );
}

import type { Park, Point, Tile } from "./simulation";
// Injected by simulation to keep routing modules free of a runtime import cycle.
let footprint: (b: Park["buildings"][number]) => Point[] = (b) => [{ x: b.x, y: b.y }];
export function setTerrainFootprints(resolve: typeof footprint) {
  footprint = resolve;
}
import { canAfford, spendCash } from "./budget";
import type { PathStyle } from "./park-life";

/** Heights use the same five-metre units as the coaster editor. */
export type ElevatedPath = {
  x: number;
  y: number;
  z: number;
  slope?: 0 | 1 | 2 | 3;
  type: "path" | "queue" | "exit";
  style: PathStyle;
};
export type TerrainTool = "raise" | "lower" | "level";
const xy = (p: Point) => `${p.x},${p.y}`;
const directions = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const;
export const terrainHeight = (s: Park, x: number, y: number) =>
  s.terrain?.[`${Math.round(x)},${Math.round(y)}`] ?? 0;
export const hasElevations = (s: Park) =>
  Boolean(Object.keys(s.terrain ?? {}).length || s.elevatedPaths?.length);
const walkingScopes = new WeakMap<Park, boolean>();
/** A synchronous simulation step does not edit terrain or paths. Share its one
 * network check, then discard it before any subsequent construction action. */
export function withWalkingElevationScope<T>(s: Park, read: () => T): T {
  const previous = walkingScopes.get(s);
  walkingScopes.set(s, hasWalkingElevations(s));
  try {
    return read();
  } finally {
    if (previous === undefined) walkingScopes.delete(s);
    else walkingScopes.set(s, previous);
  }
}
/** Scenery on hills does not make a flat path network multi-level. Read live tiles
 * so painting/removing a path or changing terrain in place takes effect at once. */
export function hasWalkingElevations(s: Park) {
  const scoped = walkingScopes.get(s);
  if (scoped !== undefined) return scoped;
  if (s.elevatedPaths?.length) return true;
  if (!s.terrain) return false;
  for (let y = 0; y < s.tiles.length; y++)
    for (let x = 0; x < s.tiles[y].length; x++) {
      const tile = s.tiles[y][x];
      if ((tile === "path" || tile === "queue" || tile === "exit") && s.terrain[`${x},${y}`])
        return true;
    }
  return false;
}
export const deckHeight = (p: ElevatedPath, x = p.x, y = p.y) =>
  p.z +
  (p.slope === undefined
    ? 0
    : 0.5 + (x - p.x) * directions[p.slope][0] + (y - p.y) * directions[p.slope][1]);
export function walkingHeight(s: Park, p: Point) {
  if (p.z !== undefined) return p.z;
  return terrainHeight(s, p.x, p.y);
}
export function walkKey(s: Park, p: Point) {
  const x = Math.round(p.x),
    y = Math.round(p.y),
    ground = terrainHeight(s, x, y);
  if (p.z === undefined) return `${x},${y}`;
  const decks = (s.elevatedPaths ?? [])
    .filter((d) => d.x === x && d.y === y)
    .sort((a, b) => Math.abs(deckHeight(a) - p.z!) - Math.abs(deckHeight(b) - p.z!));
  const deck = decks[0],
    surface = ["path", "queue", "exit"].includes(s.tiles[y]?.[x]);
  if (
    deck &&
    Math.abs(deckHeight(deck) - p.z) <= 0.51 &&
    (!surface || Math.abs(deckHeight(deck) - p.z) < Math.abs(ground - p.z))
  )
    return `${x},${y},${deckHeight(deck)}`;
  return `${x},${y}`;
}
export function pointFromKey(k: string): Point {
  const [x, y, z] = k.split(",").map(Number);
  return z === undefined ? { x, y } : { x, y, z };
}
export type WalkNode = {
  id: string;
  point: Point;
  type: "path" | "queue" | "exit";
  deck?: ElevatedPath;
};
export function walkNodes(s: Park) {
  const nodes = new Map<string, WalkNode>();
  for (let y = 0; y < s.tiles.length; y++)
    for (let x = 0; x < s.tiles[y].length; x++) {
      const type = s.tiles[y][x];
      if (type !== "path" && type !== "queue" && type !== "exit") continue;
      const z = terrainHeight(s, x, y),
        point = z ? { x, y, z } : { x, y };
      nodes.set(`${x},${y}`, { id: `${x},${y}`, point, type });
    }
  for (const deck of s.elevatedPaths ?? []) {
    const point = { x: deck.x, y: deck.y, z: deckHeight(deck) },
      id = `${deck.x},${deck.y},${deckHeight(deck)}`;
    nodes.set(id, { id, point, type: deck.type, deck });
  }
  return nodes;
}
function edgeHeight(n: WalkNode, dx: number, dy: number) {
  return n.deck ? deckHeight(n.deck, n.point.x + dx * 0.5, n.point.y + dy * 0.5) : (n.point.z ?? 0);
}
export function walkGraph(s: Park) {
  const nodes = walkNodes(s),
    cells = new Map<string, WalkNode[]>(),
    neighbors = new Map<string, WalkNode[]>();
  for (const node of nodes.values())
    cells.set(xy(node.point), [...(cells.get(xy(node.point)) ?? []), node]);
  for (const node of nodes.values()) {
    const list: WalkNode[] = [];
    for (const [dx, dy] of directions)
      for (const next of cells.get(`${node.point.x + dx},${node.point.y + dy}`) ?? []) {
        if (Math.abs(edgeHeight(node, dx, dy) - edgeHeight(next, -dx, -dy)) < 0.01) list.push(next);
      }
    neighbors.set(node.id, list);
  }
  return { nodes, neighbors };
}
export function elevationRoute(
  s: Park,
  start: Point,
  end: Point,
  queues = true,
  directedExits?: Map<string, Point>,
): Point[] {
  const graph = walkGraph(s),
    a = { ...start, x: Math.round(start.x), y: Math.round(start.y) },
    origin = walkKey(s, a),
    target = walkKey(s, end);
  if (!graph.nodes.has(origin) || !graph.nodes.has(target)) return [];
  const queue = [origin],
    previous = new Map<string, string | null>([[origin, null]]);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (id === target) {
      const route: Point[] = [];
      let at: string | null = id;
      while (at !== null) {
        route.unshift({ ...graph.nodes.get(at)!.point });
        at = previous.get(at) ?? null;
      }
      return route;
    }
    const node = graph.nodes.get(id)!;
    for (const next of graph.neighbors.get(id) ?? []) {
      const exit = directedExits?.get(id);
      if (
        node.type === "exit"
          ? !exit || next.id !== walkKey(s, exit)
          : next.type !== "path" && !(queues && next.type === "queue")
      )
        continue;
      if (!previous.has(next.id)) {
        previous.set(next.id, id);
        queue.push(next.id);
      }
    }
  }
  return [];
}
export function heightAccess(
  s: Park,
  points: Point[],
  z: number,
  net: Set<string>,
  types: Tile[] = ["path", "queue"],
) {
  const nodes = walkNodes(s);
  return points.flatMap((p) =>
    [...nodes.values()]
      .filter(
        (n) =>
          n.point.x === p.x &&
          n.point.y === p.y &&
          Math.abs((n.point.z ?? 0) - z) < 0.01 &&
          types.includes(n.type) &&
          net.has(n.id),
      )
      .map((n) => n.point),
  );
}
export function walkTile(s: Park, p: Point): Tile | undefined {
  const k = walkKey(s, p),
    [x, y, z] = k.split(",").map(Number);
  return z === undefined
    ? s.tiles[y]?.[x]
    : s.elevatedPaths?.find((d) => d.x === x && d.y === y && deckHeight(d) === z)?.type;
}
function charge(s: Park, cost: number) {
  spendCash(s, cost);
  s.expenses += cost;
  s.dayExpenses += cost;
}
export function terrainPlan(s: Park, p: Point, tool: TerrainTool, size: number, level: number) {
  const cells: Point[] = [],
    radius = Math.floor(size / 2);
  let error: string | null = null;
  for (let y = p.y - radius; y <= p.y + radius; y++)
    for (let x = p.x - radius; x <= p.x + radius; x++) {
      if (!s.tiles[y]?.[x]) continue;
      const old = terrainHeight(s, x, y),
        z = tool === "level" ? level : old + (tool === "raise" ? 1 : -1);
      if (z === old) continue;
      if (z < -4 || z > 10) error = "Geländehöhe zwischen −20 und 50 m wählen.";
      if (x === 15 && y === 29) error = "Der Parkeingang bleibt auf seiner Anschlusshöhe.";
      if (s.tiles[y][x] !== "grass")
        error = "Entferne zuerst Wege oder Wasser auf den markierten Feldern.";
      if (s.buildings.some((b) => footprint(b).some((q) => q.x === x && q.y === y)))
        error = "Unter bestehenden Attraktionen und Gebäuden bleibt das Gelände erhalten.";
      if (s.elevatedPaths?.some((d) => d.x === x && d.y === y && d.z < z && d.z + 1 > z))
        error = "Der Weg benötigt mindestens 5 m freie Höhe.";
      cells.push({ x, y, z });
    }
  const cost = cells.reduce((sum, q) => sum + Math.abs(q.z! - terrainHeight(s, q.x, q.y)) * 18, 0);
  if (!canAfford(s, cost)) error = "Das Budget reicht für diese Geländeänderung nicht.";
  return { cells, cost, error };
}
export function editTerrain(s: Park, p: Point, tool: TerrainTool, size: number, level: number) {
  const plan = terrainPlan(s, p, tool, size, level);
  if (plan.error) return plan.error;
  s.terrain ??= {};
  for (const q of plan.cells) {
    if (q.z) s.terrain[xy(q)] = q.z;
    else delete s.terrain[xy(q)];
  }
  charge(s, plan.cost);
  return null;
}
export function deckPlan(s: Park, path: ElevatedPath) {
  const { x, y, z } = path,
    top = z + (path.slope === undefined ? 0 : 1),
    ground = terrainHeight(s, x, y);
  let error: string | null = null;
  if (!s.tiles[y]?.[x]) error = "Außerhalb des Parkgeländes.";
  if (z < -4 || top > 10) error = "Weghöhe zwischen −20 und 50 m wählen.";
  const existing = s.elevatedPaths?.find((d) => d.x === x && d.y === y && d.z === z);
  if (
    s.elevatedPaths?.some(
      (d) =>
        d !== existing && d.x === x && d.y === y && Math.abs(deckHeight(d) - deckHeight(path)) < 1,
    )
  )
    error = "Zwischen zwei Wegen werden mindestens 5 m Abstand benötigt.";
  if (s.tiles[y]?.[x] === "water" && z < ground + 1)
    error = "Über Wasser mindestens eine Höhenstufe als Brücke bauen.";
  if (s.tiles[y]?.[x] !== "grass" && s.tiles[y]?.[x] !== "water" && z <= ground && top >= ground)
    error = "Hier liegt bereits ein Bodenweg. Baue die Rampe auf das nächste freie Feld.";
  if (s.buildings.some((b) => footprint(b).some((q) => q.x === x && q.y === y)))
    error = "Dieses Feld gehört zu einer Attraktion. Wähle einen freien Verlauf.";
  const tunnel = top < ground,
    cost = existing ? 12 : tunnel ? 70 : path.slope !== undefined ? 55 : 38;
  if (!canAfford(s, cost)) error = "Das Budget reicht für dieses Wegstück nicht.";
  return { error, cost, tunnel, path };
}
export function placeDeck(s: Park, path: ElevatedPath) {
  const plan = deckPlan(s, path);
  if (plan.error) return plan.error;
  s.elevatedPaths = [
    ...(s.elevatedPaths ?? []).filter((d) => d.x !== path.x || d.y !== path.y || d.z !== path.z),
    { ...path },
  ];
  charge(s, plan.cost);
  return null;
}
export function removeDeck(s: Park, p: Point, z: number) {
  s.elevatedPaths = s.elevatedPaths?.filter((d) => d.x !== p.x || d.y !== p.y || d.z !== z);
}
export function validTerrain(s: Park) {
  const validHeight = (n: unknown) =>
    typeof n === "number" && Number.isInteger(n) && n >= -4 && n <= 10;
  if (
    s.terrain &&
    (typeof s.terrain !== "object" ||
      Array.isArray(s.terrain) ||
      Object.entries(s.terrain).some(
        ([k, h]) =>
          !/^\d+,\d+$/.test(k) ||
          !validHeight(h) ||
          !s.tiles[Number(k.split(",")[1])]?.[Number(k.split(",")[0])],
      ))
  )
    return false;
  if (
    s.elevatedPaths &&
    (!Array.isArray(s.elevatedPaths) ||
      s.elevatedPaths.length > 12000 ||
      s.elevatedPaths.some(
        (d) =>
          !d ||
          !Number.isInteger(d.x) ||
          !Number.isInteger(d.y) ||
          !s.tiles[d.y]?.[d.x] ||
          !validHeight(d.z) ||
          (d.slope !== undefined && ![0, 1, 2, 3].includes(d.slope)) ||
          !["path", "queue", "exit"].includes(d.type) ||
          !["garden", "stone", "brick", "boardwalk"].includes(d.style),
      ))
  )
    return false;
  return (
    s.buildings.every((b) => b.z === undefined || validHeight(b.z)) &&
    s.guests.every((g) => g.z === undefined || (Number.isFinite(g.z) && g.z >= -4 && g.z <= 11))
  );
}

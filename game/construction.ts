import {
  CATALOG,
  SIZE,
  ENTRANCE,
  access,
  build,
  paint,
  remove,
  spend,
  footprint,
  occupant,
  decorative,
  isRide,
  connected,
  validateTrack,
  type Park,
  type Point,
  type Kind,
  type Tile,
  type Building,
} from "./simulation";
export type BuildTool = Kind | "path" | "queue" | "water" | "erase";
export type Placement = {
  points: Point[];
  clearIds: number[];
  cost: number;
  error: string | null;
  warning?: string;
};
const unique = (points: Point[]) => [...new Map(points.map((p) => [`${p.x},${p.y}`, p])).values()];
const inside = (p: Point) =>
  Number.isInteger(p.x) &&
  Number.isInteger(p.y) &&
  p.x >= 0 &&
  p.y >= 0 &&
  p.x < SIZE &&
  p.y < SIZE;
export function blueprint(origin: Point, rotation = 0): Point[] {
  const t: Point[] = [];
  for (let i = 0; i <= 5; i++) t.push({ x: i, y: 0, z: i <= 2 ? i : Math.max(0, 4 - i) });
  for (let j = 1; j <= 3; j++) t.push({ x: 5, y: j, z: 0 });
  for (let i = 4; i >= 0; i--) t.push({ x: i, y: 3, z: 0 });
  for (let j = 2; j >= 0; j--) t.push({ x: 0, y: j, z: 0 });
  return t.map((p) => {
    let { x, y } = p;
    for (let i = 0; i < rotation % 4; i++) [x, y] = [-y, x];
    return { x: origin.x + x, y: origin.y + y, z: p.z };
  });
}
export function planPlacement(
  s: Park,
  tool: BuildTool,
  p: Point,
  track?: Point[],
  clear = true,
): Placement {
  const points =
    tool === "erase"
      ? unique(occupant(s, p.x, p.y) ? footprint(occupant(s, p.x, p.y)!) : [p])
      : tool in CATALOG
        ? unique(footprint({ kind: tool as Kind, x: p.x, y: p.y, track }))
        : [p];
  const plan: Placement = { points, clearIds: [], cost: 0, error: null };
  if (!points.length || points.some((t) => !inside(t)))
    return { ...plan, error: "Außerhalb des Parkgeländes" };
  if (tool === "erase") {
    const b = occupant(s, p.x, p.y);
    return {
      ...plan,
      cost: b ? -Math.round(CATALOG[b.kind].cost * 0.4) : 0,
      error: !b && p.x === ENTRANCE.x && p.y === ENTRANCE.y ? "Der Eingang bleibt erhalten" : null,
    };
  }
  const painting = ["path", "queue", "water"].includes(tool);
  const mayClear = clear && (painting || !decorative(tool as Kind));
  for (const t of points) {
    const b = occupant(s, t.x, t.y);
    if (b) {
      if (mayClear && decorative(b.kind)) {
        if (!plan.clearIds.includes(b.id)) plan.clearIds.push(b.id);
      } else
        return {
          ...plan,
          error: decorative(b.kind)
            ? "Deko im Weg – Freiräumen aktivieren"
            : "Hier steht bereits ein Gebäude",
        };
    }
    if (!painting && s.tiles[t.y][t.x] !== "grass")
      return { ...plan, error: "Gebäude brauchen freie Wiese" };
    if (painting && t.x === ENTRANCE.x && t.y === ENTRANCE.y && tool !== "path")
      return { ...plan, error: "Der Eingang braucht einen normalen Weg" };
  }
  plan.cost = painting
    ? s.tiles[p.y][p.x] === tool
      ? 0
      : tool === "path"
        ? 12
        : tool === "queue"
          ? 18
          : 35
    : CATALOG[tool as Kind].cost + (track ? track.length * 65 : 0);
  plan.cost += plan.clearIds.length * 10;
  if (tool === "coaster") {
    const virtual = { ...s, buildings: s.buildings.filter((b) => !plan.clearIds.includes(b.id)) };
    const error = validateTrack(virtual, track ?? []);
    if (error) return { ...plan, error };
  }
  if (s.cash < plan.cost) plan.error = "Das Parkbudget reicht nicht";
  if (plan.clearIds.length)
    plan.warning = `${plan.clearIds.length} Deko entfernen · ${plan.clearIds.length * 10} € enthalten`;
  return plan;
}
export function place(
  s: Park,
  tool: BuildTool,
  p: Point,
  track?: Point[],
  clear = true,
): { error?: string; id?: number; cost?: number } {
  const plan = planPlacement(s, tool, p, track, clear);
  if (plan.error) return { error: plan.error };
  if (tool === "erase") {
    remove(s, p.x, p.y);
    return { cost: plan.cost };
  }
  if (plan.clearIds.length) {
    s.buildings = s.buildings.filter((b) => !plan.clearIds.includes(b.id));
    spend(s, plan.clearIds.length * 10);
  }
  if (["path", "queue", "water"].includes(tool)) {
    const error = paint(s, p.x, p.y, tool as Tile);
    return error ? { error } : { cost: plan.cost };
  }
  return { ...build(s, tool as Kind, p.x, p.y, track), cost: plan.cost };
}
export type Connection = {
  points: Point[];
  clearIds: number[];
  cost: number;
  error: string | null;
};
export function planConnection(s: Park, b: Building, clear = true): Connection {
  const empty = { points: [], clearIds: [], cost: 0, error: null };
  if (access(s, b)) return empty;
  const n = CATALOG[b.kind].size,
    net = connected(s),
    ride = isRide(b.kind),
    starts: Point[] = [];
  for (let i = 0; i < n; i++)
    starts.push(
      { x: b.x + i, y: b.y + n },
      { x: b.x - 1, y: b.y + i },
      { x: b.x + n, y: b.y + i },
      { x: b.x + i, y: b.y - 1 },
    );
  const blocked = new Set<string>();
  for (const item of s.buildings)
    if (!clear || !decorative(item.kind))
      for (const p of footprint(item)) blocked.add(`${p.x},${p.y}`);
  const passable = (p: Point) =>
    inside(p) && !blocked.has(`${p.x},${p.y}`) && s.tiles[p.y][p.x] !== "water";
  const q: Array<{ p: Point; path: Point[] }> = [],
    seen = new Set<string>();
  for (const p of starts)
    if (passable(p) && ["grass", ride ? "queue" : "path"].includes(s.tiles[p.y][p.x])) {
      q.push({ p, path: [p] });
      seen.add(`${p.x},${p.y}`);
    }
  const dirs = [
    [0, 1],
    [-1, 0],
    [1, 0],
    [0, -1],
  ];
  let route: Point[] | undefined;
  for (let i = 0; i < q.length; i++) {
    const { p, path } = q[i];
    if (["path", "queue"].includes(s.tiles[p.y][p.x]) && net.has(`${p.x},${p.y}`)) {
      route = path.slice(0, -1);
      break;
    }
    if (path.length > 12) continue;
    for (const [dx, dy] of dirs) {
      const next = { x: p.x + dx, y: p.y + dy },
        key = `${next.x},${next.y}`;
      if (
        !passable(next) ||
        seen.has(key) ||
        (s.tiles[next.y][next.x] !== "grass" &&
          s.tiles[next.y][next.x] !== (ride ? "queue" : "path") &&
          !net.has(key))
      )
        continue;
      seen.add(key);
      q.push({ p: next, path: [...path, next] });
    }
  }
  if (!route?.length)
    return {
      ...empty,
      error:
        "Kein freier Anschluss innerhalb von 12 Feldern. Baue zuerst einen Parkweg näher heran.",
    };
  const points = unique(route),
    clearIds = [
      ...new Set(
        points.map((p) => occupant(s, p.x, p.y)?.id).filter((id): id is number => id !== undefined),
      ),
    ];
  const cost =
    points.reduce(
      (sum, p) => sum + (s.tiles[p.y][p.x] === (ride ? "queue" : "path") ? 0 : ride ? 18 : 12),
      0,
    ) +
    clearIds.length * 10;
  return {
    points,
    clearIds,
    cost,
    error: cost > s.cash ? "Das Parkbudget reicht für den Anschluss nicht" : null,
  };
}
export function connectBuilding(s: Park, b: Building, clear = true): string | null {
  const plan = planConnection(s, b, clear);
  if (plan.error) return plan.error;
  s.buildings = s.buildings.filter((item) => !plan.clearIds.includes(item.id));
  spend(s, plan.clearIds.length * 10);
  for (const p of plan.points) paint(s, p.x, p.y, isRide(b.kind) ? "queue" : "path");
  if (b.kind === "coaster" && !b.tested) {
    b.testing = b.testing || 8;
    b.autoOpen = true;
  } else b.open = true;
  return null;
}
export type EditRecord = {
  label: string;
  tiles: { x: number; y: number; before: Tile; after: Tile }[];
  added: number[];
  removed: Building[];
  flags: { id: number; open: boolean; autoOpen?: boolean }[];
  cash: number;
  income: number;
  expenses: number;
};
export function recordEdit(s: Park, label: string, fn: () => void): EditRecord | null {
  const tiles = s.tiles.map((row) => [...row]),
    buildings = [...s.buildings],
    flags = buildings.map((b) => ({ id: b.id, open: b.open, autoOpen: b.autoOpen }));
  const cash = s.cash,
    income = s.income,
    expenses = s.expenses;
  fn();
  const changes: EditRecord = {
    label,
    tiles: [],
    added: s.buildings.filter((b) => !buildings.some((old) => old.id === b.id)).map((b) => b.id),
    removed: buildings
      .filter((b) => !s.buildings.some((now) => now.id === b.id))
      .map((b) => structuredClone(b)),
    flags: flags.filter((old) => {
      const b = s.buildings.find((b) => b.id === old.id);
      return b && (b.open !== old.open || b.autoOpen !== old.autoOpen);
    }),
    cash: s.cash - cash,
    income: s.income - income,
    expenses: s.expenses - expenses,
  };
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++)
      if (tiles[y][x] !== s.tiles[y][x])
        changes.tiles.push({ x, y, before: tiles[y][x], after: s.tiles[y][x] });
  return changes.tiles.length ||
    changes.added.length ||
    changes.removed.length ||
    changes.flags.length
    ? changes
    : null;
}
export function undoEdits(s: Park, records: EditRecord[]) {
  for (const record of [...records].reverse()) {
    for (const g of s.guests)
      if (g.target !== null && record.added.includes(g.target)) {
        g.state = "walk";
        g.target = null;
        g.route = [];
        g.timer = 0;
        g.x = ENTRANCE.x;
        g.y = ENTRANCE.y;
      }
    s.buildings = s.buildings.filter((b) => !record.added.includes(b.id));
    for (const b of record.removed)
      s.buildings.push({
        ...structuredClone(b),
        queue: [],
        riders: [],
        cycle: 0,
        testing: undefined,
        autoOpen: false,
      });
    for (const t of record.tiles) s.tiles[t.y][t.x] = t.before;
    for (const old of record.flags) {
      const b = s.buildings.find((b) => b.id === old.id);
      if (b) {
        b.open = old.open;
        b.autoOpen = old.autoOpen;
      }
    }
    s.cash -= record.cash;
    s.income -= record.income;
    s.expenses -= record.expenses;
    s.dayIncome -= record.income;
    s.dayExpenses -= record.expenses;
  }
}

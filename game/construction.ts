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
export const CONNECTION_LIMIT = 30;
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
  // Dijkstra prefers existing paths (free) and fills only missing cells. It never repaints infrastructure.
  type Search = { p: Point; path: Point[]; cost: number; newCells: number };
  const heap: Search[] = [],
    best = new Map<string, number>();
  const push = (item: Search) => {
    let i = heap.length;
    heap.push(item);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent].cost <= item.cost) break;
      heap[i] = heap[parent];
      i = parent;
    }
    heap[i] = item;
  };
  const pop = () => {
    const first = heap[0],
      last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1].cost < heap[child].cost) child++;
        if (heap[child].cost >= last.cost) break;
        heap[i] = heap[child];
        i = child;
      }
      heap[i] = last;
    }
    return first;
  };
  const price = (p: Point) =>
    (s.tiles[p.y][p.x] === "grass" ? (ride ? 18 : 12) : 0) + (occupant(s, p.x, p.y) ? 10 : 0);
  for (const p of starts)
    if (passable(p) && (ride || s.tiles[p.y][p.x] !== "queue")) {
      const cost = price(p),
        key = `${p.x},${p.y}`;
      best.set(key, cost);
      push({ p, path: [p], cost, newCells: s.tiles[p.y][p.x] === "grass" ? 1 : 0 });
    }
  const dirs = [
    [0, 1],
    [-1, 0],
    [1, 0],
    [0, -1],
  ];
  let route: Point[] | undefined;
  while (heap.length) {
    const current = pop(),
      { p, path, cost, newCells } = current;
    if (cost !== best.get(`${p.x},${p.y}`)) continue;
    if (net.has(`${p.x},${p.y}`)) {
      route = path.slice(0, -1);
      break;
    }
    for (const [dx, dy] of dirs) {
      const next = { x: p.x + dx, y: p.y + dy },
        key = `${next.x},${next.y}`;
      if (!passable(next)) continue;
      const count = newCells + (s.tiles[next.y][next.x] === "grass" ? 1 : 0),
        nextCost = cost + price(next);
      if (count > CONNECTION_LIMIT || nextCost >= (best.get(key) ?? Infinity)) continue;
      best.set(key, nextCost);
      push({ p: next, path: [...path, next], cost: nextCost, newCells: count });
    }
  }
  if (!route?.length)
    return {
      ...empty,
      error:
        "Kein freier Weg zur Station. Versetze die Station oder die Bahn; Wasser und Gebäude blockieren den Anschluss.",
    };
  const points = unique(route).filter((p) => s.tiles[p.y][p.x] === "grass"),
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
  if (plan.clearIds.length) spend(s, plan.clearIds.length * 10);
  for (const p of plan.points) paint(s, p.x, p.y, isRide(b.kind) ? "queue" : "path");
  if (b.kind === "coaster" && !b.tested) {
    b.testing = b.testing || 8;
    b.autoOpen = true;
  } else b.open = true;
  return null;
}
export type Geometry = Pick<Building, "x" | "y" | "track">;
export type AdjustmentPlan = Placement & {
  geometry: Geometry;
  changed: boolean;
  connection: Connection | null;
};
const geometryOf = (b: Building): Geometry => ({
  x: b.x,
  y: b.y,
  track: b.track?.map((p) => ({ ...p })),
});
const sameGeometry = (a: Geometry, b: Geometry) =>
  a.x === b.x && a.y === b.y && JSON.stringify(a.track) === JSON.stringify(b.track);
export function stationPositions(b: Building): Point[] {
  if (b.kind !== "coaster" || !b.track) return [];
  const ring = b.track.slice(0, -1);
  return ring
    .filter((p, i) => {
      const prev = ring[(i + ring.length - 1) % ring.length],
        next = ring[(i + 1) % ring.length];
      return (
        (p.z ?? 0) === 0 &&
        (prev.z ?? 0) === 0 &&
        (next.z ?? 0) === 0 &&
        prev.x + next.x === 2 * p.x &&
        prev.y + next.y === 2 * p.y
      );
    })
    .map((p) => ({ ...p }));
}
function withConnection(
  s: Park,
  b: Building,
  plan: AdjustmentPlan,
  clear: boolean,
): AdjustmentPlan {
  if (plan.error) return plan;
  const moved = { ...b, ...plan.geometry },
    virtual = {
      ...s,
      buildings: [
        ...s.buildings.filter((item) => item.id !== b.id && !plan.clearIds.includes(item.id)),
        moved,
      ],
      cash: s.cash - plan.cost,
    };
  return { ...plan, connection: planConnection(virtual, moved, clear) };
}
export function planStationMove(s: Park, b: Building, p: Point, clear = true): AdjustmentPlan {
  const empty: AdjustmentPlan = {
    points: [p],
    clearIds: [],
    cost: 0,
    error: null,
    geometry: geometryOf(b),
    changed: false,
    connection: null,
  };
  if (b.kind !== "coaster" || !b.track)
    return { ...empty, error: "Nur Achterbahnen haben eine versetzbare Station." };
  if (p.x === b.x && p.y === b.y) return withConnection(s, b, empty, clear);
  if (!stationPositions(b).some((q) => q.x === p.x && q.y === p.y))
    return { ...empty, error: "Wähle einen grün markierten, geraden Gleisabschnitt am Boden." };
  const ring = b.track.slice(0, -1),
    i = ring.findIndex((q) => q.x === p.x && q.y === p.y && (q.z ?? 0) === 0);
  const reordered = [...ring.slice(i), ...ring.slice(0, i)].map((q) => ({ ...q }));
  const geometry = { x: p.x, y: p.y, track: [...reordered, { ...reordered[0] }] };
  const error = validateTrack(
    { ...s, buildings: s.buildings.filter((item) => item.id !== b.id) },
    geometry.track,
  );
  return withConnection(s, b, { ...empty, geometry, changed: true, error }, clear);
}
export function planRelocation(
  s: Park,
  b: Building,
  p: Point,
  rotation = 0,
  clear = true,
): AdjustmentPlan {
  const turns = ((rotation % 4) + 4) % 4;
  const geometry: Geometry = {
    x: p.x,
    y: p.y,
    track: b.track?.map((q) => {
      let x = q.x - b.x,
        y = q.y - b.y;
      for (let i = 0; i < turns; i++) [x, y] = [-y, x];
      return { x: p.x + x, y: p.y + y, z: q.z };
    }),
  };
  const points = unique(footprint({ ...b, ...geometry }));
  const plan: AdjustmentPlan = {
    points,
    clearIds: [],
    cost: 0,
    error: null,
    geometry,
    changed: !sameGeometry(b, geometry),
    connection: null,
  };
  if (points.some((q) => !inside(q)))
    return { ...plan, error: "Die Bahn ragt über den Parkrand hinaus." };
  const virtual = { ...s, buildings: s.buildings.filter((item) => item.id !== b.id) };
  for (const q of points) {
    if (s.tiles[q.y][q.x] !== "grass")
      return {
        ...plan,
        error: "Die neue Position braucht Wiese. Wege und Wasser bleiben erhalten.",
      };
    const obstacle = occupant(virtual, q.x, q.y);
    if (obstacle) {
      if (!clear || !decorative(obstacle.kind))
        return {
          ...plan,
          error: decorative(obstacle.kind)
            ? "Deko im Weg – Freiräumen aktivieren."
            : "Hier steht ein anderes Gebäude.",
        };
      if (!plan.clearIds.includes(obstacle.id)) plan.clearIds.push(obstacle.id);
    }
  }
  plan.cost = plan.clearIds.length * 10;
  if (b.kind === "coaster")
    plan.error = validateTrack(
      {
        ...virtual,
        buildings: virtual.buildings.filter((item) => !plan.clearIds.includes(item.id)),
      },
      geometry.track ?? [],
    );
  if (plan.cost > 0 && plan.cost > s.cash)
    plan.error = "Das Parkbudget reicht zum Freiräumen nicht.";
  plan.warning = plan.clearIds.length
    ? `${plan.clearIds.length} Deko freiräumen · ${plan.cost} €`
    : "Versetzen kostenlos · vorhandene Wege bleiben stehen";
  return withConnection(s, b, plan, clear);
}
export function suggestStation(s: Park, b: Building, clear = true): Point | null {
  const options = stationPositions(b)
    .filter((p) => p.x !== b.x || p.y !== b.y)
    .map((p) => ({ p, plan: planStationMove(s, b, p, clear) }))
    .filter((o) => !o.plan.error && !o.plan.connection?.error);
  options.sort((a, b) => (a.plan.connection?.cost ?? 0) - (b.plan.connection?.cost ?? 0));
  return options[0]?.p ?? null;
}
function releaseBuildingGuests(s: Park, b: Building) {
  const exit = access(s, b) ?? ENTRANCE;
  for (const g of s.guests)
    if (g.target === b.id) {
      if (g.state === "ride" || g.state === "queue") {
        g.x = exit.x;
        g.y = exit.y;
      }
      g.target = null;
      g.route = [];
      g.timer = 0;
      g.state = "walk";
    }
  b.queue = [];
  b.riders = [];
  b.cycle = 0;
  b.testing = undefined;
  b.autoOpen = false;
  b.open = false;
}
export function adjustBuilding(
  s: Park,
  b: Building,
  mode: "station" | "move",
  p: Point,
  rotation = 0,
  clear = true,
): string | null {
  const plan =
    mode === "station" ? planStationMove(s, b, p, clear) : planRelocation(s, b, p, rotation, clear);
  if (plan.error) return plan.error;
  if (!plan.changed) return null;
  releaseBuildingGuests(s, b);
  s.buildings = s.buildings.filter((item) => !plan.clearIds.includes(item.id));
  if (plan.cost) spend(s, plan.cost);
  Object.assign(b, plan.geometry);
  // Rigid moves retain existing test results, track shape and operating statistics.
  return null;
}
export type EditRecord = {
  label: string;
  tiles: { x: number; y: number; before: Tile; after: Tile }[];
  added: number[];
  removed: Building[];
  flags: { id: number; open: boolean; autoOpen?: boolean }[];
  geometry: { id: number; before: Geometry }[];
  cash: number;
  income: number;
  expenses: number;
};
export function recordEdit(s: Park, label: string, fn: () => void): EditRecord | null {
  const tiles = s.tiles.map((row) => [...row]),
    buildings = [...s.buildings],
    flags = buildings.map((b) => ({ id: b.id, open: b.open, autoOpen: b.autoOpen }));
  const geometries = buildings.map((b) => ({ id: b.id, before: geometryOf(b) }));
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
    geometry: geometries.filter((old) => {
      const b = s.buildings.find((b) => b.id === old.id);
      return b && !sameGeometry(old.before, b);
    }),
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
    changes.flags.length ||
    changes.geometry.length
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
    for (const old of record.geometry) {
      const b = s.buildings.find((b) => b.id === old.id);
      if (b) {
        releaseBuildingGuests(s, b);
        Object.assign(b, structuredClone(old.before));
      }
    }
    for (const old of record.flags) {
      const b = s.buildings.find((b) => b.id === old.id);
      if (b) {
        b.open = old.open;
        b.autoOpen = record.geometry.some((item) => item.id === b.id) ? false : old.autoOpen;
      }
    }
    s.cash -= record.cash;
    s.income -= record.income;
    s.expenses -= record.expenses;
    s.dayIncome -= record.income;
    s.dayExpenses -= record.expenses;
  }
}

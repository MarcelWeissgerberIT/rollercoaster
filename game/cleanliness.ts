/** Park care simulation. Guest navigation and economy remain caller-owned. */
export type Cell = { x: number; y: number };
export type WasteKind = "wrapper" | "cup";
export type Waste = { kind: WasteKind; remaining: number; waited: number };
export type Litter = Cell & { id: number; kind: WasteKind; amount: number };
export type Cleaner = Cell & {
  id: number;
  route: Cell[];
  mode: "idle" | "walk" | "sweep" | "empty";
  target: { kind: "litter" | "bin"; id: number } | null;
  workLeft: number;
  retry: number;
};
export type Cleanliness = {
  version: 1;
  nextId: number;
  litter: Litter[];
  workers: Cleaner[];
  binned: number;
  cleaned: number;
  emptied: number;
};
export type WasteGuest = Cell & { id: number; state: string; happiness: number; waste?: Waste[] };
export type CleanBuilding = Cell & { id: number; kind: string; binFill?: number };
export type CleaningPark = {
  tiles: string[][];
  buildings: CleanBuilding[];
  guests: WasteGuest[];
  staff: number;
  speed?: number;
  time: number;
  cleanliness?: Cleanliness;
};
export const BIN_CAPACITY = 16;
const key = (p: Cell) => `${p.x},${p.y}`;
const cell = (p: Cell): Cell => ({ x: Math.round(p.x), y: Math.round(p.y) });
const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
const directions = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const adjacent = (p: Cell): Cell[] => directions.map(([x, y]) => ({ x: p.x + x, y: p.y + y }));
const inBounds = (s: CleaningPark, p: Cell) =>
  p.x >= 0 && p.y >= 0 && p.y < s.tiles.length && p.x < (s.tiles[p.y]?.length ?? 0);
/** Staff may service an exit in either direction; these rules never change guest routes. */
const walkable = (s: CleaningPark, p: Cell) =>
  inBounds(s, p) && ["path", "queue", "exit"].includes(s.tiles[p.y][p.x]);
const walkCells = (s: CleaningPark) =>
  s.tiles.flatMap((r, y) => r.flatMap((_, x) => (walkable(s, { x, y }) ? [{ x, y }] : [])));
const bins = (s: CleaningPark) => s.buildings.filter((b) => b.kind === "bin");
const distance = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function initCleanliness(s: CleaningPark): Cleanliness {
  const c = (s.cleanliness ??= {
    version: 1,
    nextId: 1,
    litter: [],
    workers: [],
    binned: 0,
    cleaned: 0,
    emptied: 0,
  });
  c.litter = c.litter.filter((l) => walkable(s, l));
  for (const b of bins(s)) b.binFill ??= 0;
  const count = Math.max(0, Math.min(8, Math.floor(s.staff)));
  c.workers = c.workers.filter((w) => w.id <= count);
  const origin = { x: 15, y: 29 },
    spawn = walkable(s, origin) ? origin : walkCells(s)[0];
  if (spawn)
    for (const w of c.workers)
      if (!walkable(s, cell(w)) && !w.route.some((p) => walkable(s, p))) {
        resetWorker(w);
        w.x = spawn.x;
        w.y = spawn.y;
      }
  if (spawn)
    for (let id = 1; id <= count; id++)
      if (!c.workers.some((w) => w.id === id))
        c.workers.push({
          id,
          ...spawn,
          route: [],
          mode: "idle",
          target: null,
          workLeft: 0,
          retry: 0,
        });
  return c;
}

/** Called after a successful purchase, never on service start/cancellation. */
export function giveWaste(s: CleaningPark, guest: WasteGuest, kind: WasteKind): boolean {
  const carried = (guest.waste ??= []);
  if (carried.length >= 8) {
    if (!dropWaste(s, guest, carried[0].kind)) return false;
    carried.shift();
  }
  carried.push({ kind, remaining: (kind === "cup" ? 18 : 13) + (guest.id % 7) * 1.3, waited: 0 });
  return true;
}
/** One bounded pile per tile and kind. Its amount preserves all units without unbounded sprites. */
export function dropWaste(s: CleaningPark, point: Cell, kind: WasteKind, amount = 1): boolean {
  const p = cell(point);
  if (!walkable(s, p) || !Number.isInteger(amount) || amount < 1) return false;
  const c = initCleanliness(s),
    pile = c.litter.find((l) => same(l, p) && l.kind === kind);
  if (pile) pile.amount += amount;
  else c.litter.push({ id: c.nextId++, ...p, kind, amount });
  return true;
}

type Job = { kind: "litter" | "bin"; id: number; cells: Cell[] };
function routeToJob(s: CleaningPark, from: Cell, jobs: Job[]): { job: Job; route: Cell[] } | null {
  const targets = new Map<string, Job>();
  for (const job of jobs)
    for (const p of job.cells) if (walkable(s, p) && !targets.has(key(p))) targets.set(key(p), job);
  if (!targets.size) return null;
  const start = cell(from),
    queue = [start],
    previous = new Map<string, Cell | null>([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i],
      job = targets.get(key(p));
    if (job) {
      const route: Cell[] = [];
      let at: Cell | null = p;
      while (at) {
        route.unshift(at);
        at = previous.get(key(at)) ?? null;
      }
      if (Math.hypot(from.x - start.x, from.y - start.y) < 0.01) route.shift();
      return { job, route };
    }
    for (const n of adjacent(p))
      if (walkable(s, n) && !previous.has(key(n))) {
        previous.set(key(n), p);
        queue.push(n);
      }
  }
  return null;
}
function resetWorker(w: Cleaner) {
  w.route = [];
  w.target = null;
  w.workLeft = 0;
  w.mode = "idle";
  w.retry = 0.6;
}
function liveTarget(s: CleaningPark, w: Cleaner): Litter | CleanBuilding | undefined {
  return w.target?.kind === "litter"
    ? s.cleanliness!.litter.find((l) => l.id === w.target!.id)
    : w.target?.kind === "bin"
      ? bins(s).find((b) => b.id === w.target!.id)
      : undefined;
}
function update(s: CleaningPark, dt: number) {
  const c = initCleanliness(s),
    containers = bins(s);
  for (const g of s.guests) {
    if (g.state === "ride") continue;
    const here = cell(g);
    if (!walkable(s, here)) continue;
    const carried = g.waste;
    if (carried)
      for (let i = carried.length - 1; i >= 0; i--) {
        const item = carried[i];
        if (item.remaining > 0) {
          item.remaining = Math.max(0, item.remaining - dt);
          continue;
        }
        const bin = containers.find(
          (b) => distance(here, b) <= 1 && (b.binFill ?? 0) < BIN_CAPACITY,
        );
        if (bin) {
          bin.binFill = (bin.binFill ?? 0) + 1;
          c.binned++;
          carried.splice(i, 1);
        } else {
          item.waited += dt;
          if (item.waited >= 8 && dropWaste(s, here, item.kind)) carried.splice(i, 1);
        }
      }
  }
  const reserved = new Set(
    c.workers.filter((w) => w.target).map((w) => `${w.target!.kind}:${w.target!.id}`),
  );
  for (const w of c.workers) {
    if (w.target && !liveTarget(s, w)) {
      reserved.delete(`${w.target.kind}:${w.target.id}`);
      resetWorker(w);
    }
    if (w.route.length) {
      let budget = dt * 1.45;
      while (w.route.length && budget > 0) {
        const p = w.route[0];
        if (!walkable(s, p)) {
          if (w.target) reserved.delete(`${w.target.kind}:${w.target.id}`);
          resetWorker(w);
          break;
        }
        const d = Math.hypot(p.x - w.x, p.y - w.y);
        if (d <= budget) {
          w.x = p.x;
          w.y = p.y;
          budget -= d;
          w.route.shift();
        } else {
          w.x += ((p.x - w.x) / d) * budget;
          w.y += ((p.y - w.y) / d) * budget;
          budget = 0;
        }
      }
      if (w.route.length) {
        w.mode = "walk";
        continue;
      }
    }
    if (w.target) {
      const target = liveTarget(s, w);
      if (
        !target ||
        (w.target.kind === "litter"
          ? Math.hypot(w.x - target.x, w.y - target.y) > 0.05
          : distance(cell(w), target) > 1)
      ) {
        resetWorker(w);
        continue;
      }
      if (w.workLeft <= 0)
        w.workLeft =
          w.target.kind === "bin" ? 3 : 1.6 + ("amount" in target ? target.amount * 0.3 : 0);
      w.mode = w.target.kind === "bin" ? "empty" : "sweep";
      w.workLeft -= dt;
      if (w.workLeft <= 0) {
        if (w.target.kind === "litter") {
          const litter = target as Litter;
          c.cleaned += litter.amount;
          c.litter = c.litter.filter((l) => l.id !== litter.id);
        } else {
          (target as CleanBuilding).binFill = 0;
          c.emptied++;
        }
        reserved.delete(`${w.target.kind}:${w.target.id}`);
        resetWorker(w);
      }
      continue;
    }
    w.retry -= dt;
    if (w.retry > 0) continue;
    const available = (kind: Job["kind"], id: number) => !reserved.has(`${kind}:${id}`);
    const binJobs = containers
      .filter((b) => (b.binFill ?? 0) >= BIN_CAPACITY * 0.75 && available("bin", b.id))
      .map((b) => ({ kind: "bin" as const, id: b.id, cells: adjacent(b) }));
    const litterJobs = c.litter
      .filter((l) => available("litter", l.id))
      .map((l) => ({ kind: "litter" as const, id: l.id, cells: [l] }));
    const found = routeToJob(s, w, binJobs) ?? routeToJob(s, w, litterJobs);
    if (found) {
      w.target = { kind: found.job.kind, id: found.job.id };
      w.route = found.route;
      w.workLeft = 0;
      w.mode = found.route.length ? "walk" : found.job.kind === "bin" ? "empty" : "sweep";
      reserved.add(`${w.target.kind}:${w.target.id}`);
    } else {
      w.mode = "idle";
      w.retry = 1.2 + w.id * 0.1;
    }
  }
  // Small, local mood effect. Does not overwrite service/transit thoughts or navigation.
  for (const g of s.guests)
    if (g.state !== "ride") {
      const nearby = c.litter.reduce((n, l) => n + (distance(g, l) <= 2.5 ? l.amount : 0), 0);
      g.happiness = Math.max(0, g.happiness - Math.min(0.06, nearby * 0.008) * dt);
    }
}
/** Call from tick after guest service/navigation, before park rating; dt is already speed-scaled. */
export function tickCleanliness(s: CleaningPark, dt: number) {
  if (s.speed === 0 || !Number.isFinite(dt) || dt <= 0) return;
  for (let left = dt; left > 1e-8;) {
    const step = Math.min(0.25, left);
    update(s, step);
    left -= step;
  }
}
export function cleanlinessScore(s: CleaningPark): number {
  const pieces = s.cleanliness?.litter.reduce((n, l) => n + l.amount, 0) ?? 0;
  return Math.round(100 * Math.exp(-pieces / Math.max(6, walkCells(s).length * 0.12)));
}
export function cleanlinessStats(s: CleaningPark) {
  const litter = s.cleanliness?.litter ?? [],
    containers = bins(s),
    map = new Map<string, { x: number; y: number; pieces: number }>();
  for (const l of litter) {
    const p = map.get(key(l)) ?? { x: l.x, y: l.y, pieces: 0 };
    p.pieces += l.amount;
    map.set(key(l), p);
  }
  return {
    score: cleanlinessScore(s),
    pieces: litter.reduce((n, l) => n + l.amount, 0),
    dirtyTiles: map.size,
    bins: containers.length,
    fullBins: containers.filter((b) => (b.binFill ?? 0) >= BIN_CAPACITY).length,
    binFill: containers.reduce((n, b) => n + (b.binFill ?? 0), 0),
    binCapacity: containers.length * BIN_CAPACITY,
    staff: s.cleanliness?.workers.length ?? 0,
    busy: s.cleanliness?.workers.filter((w) => w.mode !== "idle").length ?? 0,
    binned: s.cleanliness?.binned ?? 0,
    cleaned: s.cleanliness?.cleaned ?? 0,
    emptied: s.cleanliness?.emptied ?? 0,
    hotspots: [...map.values()].sort((a, b) => b.pieces - a.pieces).slice(0, 5),
  };
}
export function moodFace(happiness: number): "happy" | "content" | "neutral" | "sad" | "angry" {
  return happiness >= 80
    ? "happy"
    : happiness >= 65
      ? "content"
      : happiness >= 45
        ? "neutral"
        : happiness >= 25
          ? "sad"
          : "angry";
}
/** Structural validation intentionally tolerates deleted job targets; update cancels stale jobs. */
export function validCleanliness(s: CleaningPark): boolean {
  try {
    const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
    const nonnegative = (v: unknown) => finite(v) && v >= 0;
    const integer = (v: unknown) => nonnegative(v) && Number.isInteger(v);
    const position = (p: Cell) =>
      !!p && finite(p.x) && finite(p.y) && inBounds(s, { x: Math.floor(p.x), y: Math.floor(p.y) });
    const grid = (p: Cell) => position(p) && Number.isInteger(p.x) && Number.isInteger(p.y);
    const kind = (k: unknown) => k === "wrapper" || k === "cup";
    for (const b of s.buildings)
      if (
        b.binFill !== undefined &&
        (b.kind !== "bin" || !integer(b.binFill) || b.binFill > BIN_CAPACITY)
      )
        return false;
    for (const g of s.guests)
      if (
        g.waste !== undefined &&
        (!Array.isArray(g.waste) ||
          g.waste.length > 8 ||
          !g.waste.every(
            (w) => w && kind(w.kind) && nonnegative(w.remaining) && nonnegative(w.waited),
          ))
      )
        return false;
    const c = s.cleanliness;
    if (c === undefined) return true;
    if (
      !c ||
      c.version !== 1 ||
      !integer(c.nextId) ||
      !integer(c.binned) ||
      !integer(c.cleaned) ||
      !integer(c.emptied) ||
      !Array.isArray(c.litter) ||
      !Array.isArray(c.workers) ||
      c.workers.length > 8 ||
      c.litter.length > s.tiles.length * s.tiles[0].length * 2
    )
      return false;
    const ids = new Set<number>();
    for (const l of c.litter) {
      if (
        !grid(l) ||
        !integer(l.id) ||
        ids.has(l.id) ||
        !kind(l.kind) ||
        !integer(l.amount) ||
        l.amount < 1
      )
        return false;
      ids.add(l.id);
    }
    if (c.nextId <= Math.max(0, ...ids)) return false;
    ids.clear();
    for (const w of c.workers) {
      if (
        !position(w) ||
        !Number.isInteger(w.id) ||
        w.id < 1 ||
        w.id > 8 ||
        ids.has(w.id) ||
        !["idle", "walk", "sweep", "empty"].includes(w.mode) ||
        !Array.isArray(w.route) ||
        w.route.length > s.tiles.length * s.tiles[0].length ||
        !w.route.every(grid) ||
        !finite(w.workLeft) ||
        !finite(w.retry) ||
        (w.target !== null &&
          (!w.target || !["litter", "bin"].includes(w.target.kind) || !integer(w.target.id)))
      )
        return false;
      ids.add(w.id);
    }
    return true;
  } catch {
    return false;
  }
}

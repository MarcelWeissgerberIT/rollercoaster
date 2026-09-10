/** Park care simulation. Guest navigation and economy remain caller-owned. */
export type Cell = { x: number; y: number };
export type CleanerArea = { x1: number; y1: number; x2: number; y2: number };
export type WasteKind = "wrapper" | "cup";
export type Waste = { kind: WasteKind; remaining: number; waited: number };
export type Litter = Cell & { id: number; kind: WasteKind; amount: number };
export type Cleaner = Cell & {
  id: number;
  route: Cell[];
  mode: "idle" | "walk" | "patrol" | "sweep" | "empty" | "deposit";
  target: { kind: "litter" | "bin" | "deposit" | "collection"; id: number; point?: Cell } | null;
  workLeft: number;
  retry: number;
  carried?: number;
  /** Emptied bin bags go to staff collection, never straight into another public bin. */
  toCollection?: boolean;
  heading?: number;
  walked?: number;
  workTotal?: number;
  patrolStep?: number;
  /** Inclusive assigned work area. Missing means automatic park-wide coverage. */
  area?: CleanerArea;
  workStep?: number;
  fairCursor?: number;
  transferred?: boolean;
  serviceTarget?: Cell;
  returning?: { from: Cell; left: number; total: number; distanceStart: number };
};
export type Cleanliness = {
  version: 1;
  nextId: number;
  litter: Litter[];
  workers: Cleaner[];
  binned: number;
  cleaned: number;
  emptied: number;
  /** Waste handed over to staff collection, including bags taken away by departing staff. */
  disposed?: number;
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
const inArea = (area: CleanerArea | undefined, p: Cell) =>
  !area || (p.x >= area.x1 && p.x <= area.x2 && p.y >= area.y1 && p.y <= area.y2);
function validArea(s: CleaningPark, area: CleanerArea): boolean {
  return (
    !!area &&
    !Array.isArray(area) &&
    [area.x1, area.y1, area.x2, area.y2].every(Number.isSafeInteger) &&
    area.x1 >= 0 &&
    area.y1 >= 0 &&
    area.x1 <= area.x2 &&
    area.y1 <= area.y2 &&
    area.y2 < s.tiles.length &&
    s.tiles.slice(area.y1, area.y2 + 1).every((row) => area.x2 < row.length)
  );
}

/** Detached, read-only area facts; an interrupted connection never clears an assignment. */
export function cleanerAreaInfo(s: CleaningPark, w: Cleaner) {
  const area = w.area ? { ...w.area } : null,
    paths = walkCells(s).filter((p) => inArea(w.area, p)),
    reachable = new Set(reachableCells(s, w).map(key)),
    reachablePaths = paths.filter((p) => reachable.has(key(p))).length,
    containers = bins(s).filter((b) => inArea(w.area, b)),
    connected = reachablePaths > 0;
  return {
    area,
    mode: w.area ? ("manual" as const) : ("auto" as const),
    reachablePaths,
    totalPaths: paths.length,
    litter:
      s.cleanliness?.litter.reduce((sum, l) => sum + (inArea(w.area, l) ? l.amount : 0), 0) ?? 0,
    bins: containers.length,
    fullBins: containers.filter((b) => (b.binFill ?? 0) >= BIN_CAPACITY).length,
    connected,
    label: !connected
      ? "Bereich nicht erreichbar – verbinde die Wege."
      : w.area
        ? `Fester Bereich · ${reachablePaths} von ${paths.length} Wegfeldern erreichbar`
        : "Automatisch im ganzen Park",
  };
}

/** A reassignment changes the next work destination, never the worker's physical position or bag. */
export function assignCleanerArea(
  s: CleaningPark,
  id: number,
  area: CleanerArea | null,
): string | null {
  const w = s.cleanliness?.workers.find((worker) => worker.id === id);
  if (!Number.isSafeInteger(id) || !w) return "Diese Reinigungskraft ist nicht mehr verfügbar.";
  if (area !== null) {
    if (!validArea(s, area)) return "Wähle einen rechteckigen Bereich innerhalb des Parks.";
    if (!walkCells(s).some((p) => inArea(area, p)))
      return "Der Bereich braucht mindestens ein Wegfeld.";
    if (!reachableCells(s, w).some((p) => inArea(area, p)))
      return "Dieser Bereich ist nicht erreichbar. Verbinde zuerst die Wege.";
  }
  if (area) w.area = { ...area };
  else delete w.area;
  const target = liveTarget(s, w),
    carryingTask = w.target?.kind === "deposit" || w.target?.kind === "collection",
    activeService = w.workTotal && ["sweep", "empty", "deposit"].includes(w.mode);
  // Finish a physical service/return already under way. Deposits may use bins outside the area.
  if (
    !w.returning &&
    !activeService &&
    !carryingTask &&
    (w.mode === "patrol" || (target && !inArea(w.area, target)))
  )
    resetWorker(w);
  w.retry = 0;
  return null;
}

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
  c.disposed ??= 0;
  c.litter = c.litter.filter((l) => walkable(s, l));
  for (const b of bins(s)) b.binFill ??= 0;
  const count = Math.max(0, Math.min(8, Math.floor(s.staff)));
  for (const w of c.workers) {
    w.carried ??= 0;
    w.toCollection ??= false;
    w.heading ??= -Math.PI / 2;
    w.walked ??= 0;
    w.workTotal ??= Math.max(0, w.workLeft);
    w.patrolStep ??= 0;
    w.transferred ??= false;
    if (w.id > count) c.disposed += w.carried;
  }
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
          carried: 0,
          toCollection: false,
          heading: -Math.PI / 2,
          walked: 0,
          workTotal: 0,
          patrolStep: 0,
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

type Job = {
  kind: NonNullable<Cleaner["target"]>["kind"];
  id: number;
  cells: Cell[];
  point?: Cell;
};
function routeToJob(
  s: CleaningPark,
  from: Cell,
  jobs: Job[],
  area?: CleanerArea,
): { job: Job; route: Cell[] } | null {
  const targets = new Map<string, Job>();
  for (const job of jobs)
    for (const p of job.cells)
      if (walkable(s, p) && inArea(area, p) && !targets.has(key(p))) targets.set(key(p), job);
  if (!targets.size) return null;
  const start = cell(from),
    queue = [start],
    previous = new Map<string, Cell | null>([[key(start), null]]);
  if (!walkable(s, start)) return null;
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
      if (walkable(s, n) && inArea(area, n) && !previous.has(key(n))) {
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
  w.workTotal = 0;
  w.transferred = false;
  delete w.serviceTarget;
  delete w.returning;
  w.mode = "idle";
  w.retry = 0.6;
}
function liveTarget(s: CleaningPark, w: Cleaner): Litter | CleanBuilding | Cell | undefined {
  return w.target?.kind === "litter"
    ? s.cleanliness!.litter.find((l) => l.id === w.target!.id)
    : w.target?.kind === "bin" || w.target?.kind === "deposit"
      ? bins(s).find((b) => b.id === w.target!.id)
      : w.target?.kind === "collection" && w.target.point && walkable(s, w.target.point)
        ? w.target.point
        : undefined;
}
/** Exact world point for facing a bin, swept pile or explicit staff collection stop. */
export function cleanerWorkTarget(s: CleaningPark, w: Cleaner): Cell | null {
  const target = liveTarget(s, w);
  return target ? { x: target.x, y: target.y } : null;
}
export function cleanerWorkProgress(w: Cleaner): number {
  return w.workTotal ? Math.max(0, Math.min(1, 1 - w.workLeft / w.workTotal)) : 0;
}
/** Canonical visible service approach shared by cards, camera and both renderers.
 * The path anchor remains saved and walkable; the timed task supplies the short
 * approach to the container and the return, with no independent animation clock. */
export function cleanerServicePose(s: CleaningPark, w: Cleaner) {
  if (w.returning) {
    const back = w.returning,
      dx = w.x - back.from.x,
      dy = w.y - back.from.y,
      distance = Math.hypot(dx, dy),
      progress = Math.max(0, Math.min(1, 1 - back.left / back.total));
    return {
      x: back.from.x + dx * progress,
      y: back.from.y + dy * progress,
      walking: back.left > 0 && distance > 1e-7,
      progress: 0,
      dx: distance ? dx / distance : Math.cos(w.heading ?? 0),
      dy: distance ? dy / distance : Math.sin(w.heading ?? 0),
      distanceWalked: back.distanceStart + distance * progress,
    };
  }
  const progress = cleanerWorkProgress(w),
    moving = w.route.length > 0 && (w.mode === "walk" || w.mode === "patrol"),
    workTarget = cleanerWorkTarget(s, w) ?? w.serviceTarget ?? null,
    goal = moving ? w.route[0] : workTarget,
    goalX = goal ? goal.x - w.x : 0,
    goalY = goal ? goal.y - w.y : 0,
    length = Math.hypot(goalX, goalY),
    direction =
      length > 1e-7
        ? { dx: goalX / length, dy: goalY / length }
        : { dx: Math.cos(w.heading ?? -Math.PI / 2), dy: Math.sin(w.heading ?? -Math.PI / 2) },
    base = {
      x: w.x,
      y: w.y,
      walking: moving,
      progress,
      ...direction,
      distanceWalked: w.walked ?? 0,
    };
  if (
    !workTarget ||
    !w.workTotal ||
    (w.mode !== "empty" && w.mode !== "deposit") ||
    !w.target ||
    !["bin", "deposit", "collection"].includes(w.target.kind)
  )
    return base;
  const container =
      w.target.kind === "collection"
        ? { x: workTarget.x + 0.4, y: workTarget.y - 0.15 }
        : workTarget,
    dx = container.x - w.x,
    dy = container.y - w.y,
    distance = Math.hypot(dx, dy);
  if (distance < 1e-7) return base;
  const travel = Math.max(0, distance - 0.2),
    returning = progress > 0.78,
    fraction = Math.max(
      0,
      Math.min(1, progress < 0.22 ? progress / 0.22 : returning ? (1 - progress) / 0.22 : 1),
    ),
    sign = returning ? -1 : 1;
  return {
    x: w.x + (dx / distance) * travel * fraction,
    y: w.y + (dy / distance) * travel * fraction,
    walking: travel > 1e-7 && (progress < 0.22 || returning),
    progress,
    dx: (dx / distance) * sign,
    dy: (dy / distance) * sign,
    distanceWalked: (w.walked ?? 0) + travel * (returning ? 2 - fraction : fraction),
  };
}
function reachableCells(s: CleaningPark, from: Cell, area?: CleanerArea): Cell[] {
  const start = cell(from),
    queue = walkable(s, start) ? [start] : [],
    seen = new Set(queue.map(key));
  for (let i = 0; i < queue.length; i++)
    for (const p of adjacent(queue[i]))
      if (walkable(s, p) && inArea(area, p) && !seen.has(key(p))) {
        seen.add(key(p));
        queue.push(p);
      }
  return queue;
}
function assign(w: Cleaner, found: NonNullable<ReturnType<typeof routeToJob>>) {
  w.target = {
    kind: found.job.kind,
    id: found.job.id,
    ...(found.job.kind === "collection" ? { point: { ...found.job.cells[0] } } : {}),
  };
  w.route = found.route;
  w.workLeft = 0;
  w.workTotal = 0;
  w.mode = found.route.length
    ? "walk"
    : found.job.kind === "litter"
      ? "sweep"
      : found.job.kind === "bin"
        ? "empty"
        : "deposit";
}
function disposalJob(s: CleaningPark, w: Cleaner) {
  if (!w.toCollection) {
    const found = routeToJob(
      s,
      w,
      bins(s)
        .filter((b) => (b.binFill ?? 0) < BIN_CAPACITY)
        .map((b) => ({ kind: "deposit" as const, id: b.id, cells: adjacent(b) })),
    );
    if (found) return found;
  }
  const entrance = { x: 15, y: 29 };
  const atEntrance = routeToJob(s, w, [{ kind: "collection", id: 0, cells: [entrance] }]);
  if (atEntrance) return atEntrance;
  // A disconnected path island receives a staff pickup at its nearest reachable
  // edge toward the entrance; no worker or bag teleports across the missing path.
  const point = reachableCells(s, w).sort(
    (a, b) => distance(a, entrance) - distance(b, entrance) || a.y - b.y || a.x - b.x,
  )[0];
  return point ? routeToJob(s, w, [{ kind: "collection", id: 0, cells: [point] }]) : null;
}
function patrol(s: CleaningPark, w: Cleaner) {
  const routeArea = w.area && inArea(w.area, cell(w)) ? w.area : undefined,
    reachable = reachableCells(s, w, routeArea).filter((p) => inArea(w.area, p)),
    preferred = reachable.filter(
      (p) => s.tiles[p.y][p.x] === "path" && distance(p, cell(w)) >= 2 && distance(p, cell(w)) <= 9,
    ),
    all = reachable.filter((p) => !same(p, cell(w))),
    covered = neighborhoodCoverage(s, w),
    uncovered = (points: Cell[]) => points.filter((p) => !covered(p)),
    localFree = w.area ? preferred : uncovered(preferred),
    farFree = w.area ? [] : uncovered(all),
    candidates = localFree.length
      ? localFree
      : farFree.length
        ? farFree
        : preferred.length
          ? preferred
          : all;
  if (!candidates.length) {
    w.mode = "idle";
    w.retry = 1.2;
    return;
  }
  const step = w.patrolStep ?? 0,
    point = candidates[(w.id * 17 + step * 13) % candidates.length],
    found = routeToJob(s, w, [{ kind: "collection", id: 0, cells: [point] }], routeArea);
  if (!found) return;
  w.patrolStep = step + 1;
  w.route = found.route;
  w.mode = "patrol";
  w.retry = 0.8;
}
/** Reserve neighborhoods as well as individual jobs, so a second worker sees distant demand. */
function neighborhoodCoverage(s: CleaningPark, w: Cleaner, patrols = true) {
  const neighbors = s
    .cleanliness!.workers.filter((other) => other.id !== w.id)
    .map((other) => ({
      area: other.area,
      point:
        other.target?.kind === "litter" || other.target?.kind === "bin"
          ? liveTarget(s, other)
          : patrols && !other.target
            ? (other.route.at(-1) ?? other)
            : undefined,
    }));
  return (point: Cell) =>
    neighbors.some(
      (neighbor) =>
        (neighbor.area && inArea(neighbor.area, point)) ||
        (neighbor.point && distance(point, neighbor.point) <= 6),
    );
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
  const findWork = (w: Cleaner) => {
    if ((w.carried ?? 0) > 0) return disposalJob(s, w);
    const available = (kind: Job["kind"], id: number) => !reserved.has(`${kind}:${id}`);
    const binJobs = containers
      .filter(
        (b) =>
          inArea(w.area, b) && (b.binFill ?? 0) >= BIN_CAPACITY * 0.75 && available("bin", b.id),
      )
      .map((b) => ({ kind: "bin" as const, id: b.id, cells: adjacent(b), point: b }));
    const litterJobs = c.litter
      .filter((l) => inArea(w.area, l) && available("litter", l.id))
      .map((l) => ({ kind: "litter" as const, id: l.id, cells: [l], point: l }));
    if (!w.area) {
      const accepted = (found: ReturnType<typeof routeToJob>) => {
        if (found) w.workStep = (w.workStep ?? 0) + 1;
        return found;
      };
      // Periodically walk the stable job order. A constantly replenished nearby
      // corner must not indefinitely postpone an older reachable task elsewhere.
      if ((w.workStep ?? 0) % 4 === 3) {
        const reachable = new Set(reachableCells(s, w).map(key)),
          token = (job: Job) => job.id * 2 + (job.kind === "litter" ? 1 : 0),
          jobs = [...binJobs, ...litterJobs]
            .filter((job) => job.cells.some((p) => reachable.has(key(p))))
            .sort((a, b) => token(a) - token(b)),
          next = jobs.find((job) => token(job) > (w.fairCursor ?? 0)) ?? jobs[0];
        if (next) {
          w.fairCursor = token(next);
          return accepted(routeToJob(s, w, [next]));
        }
      }
      const covered = neighborhoodCoverage(s, w, false),
        uncovered = (jobs: Job[]) => jobs.filter((job) => !covered(job.point!)),
        spread = routeToJob(s, w, uncovered(binJobs)) ?? routeToJob(s, w, uncovered(litterJobs));
      return accepted(spread ?? routeToJob(s, w, binJobs) ?? routeToJob(s, w, litterJobs));
    }
    return routeToJob(s, w, binJobs) ?? routeToJob(s, w, litterJobs);
  };
  for (const w of c.workers) {
    if (w.returning) {
      w.returning.left = Math.max(0, w.returning.left - dt);
      if (!w.returning.left) {
        w.walked = cleanerServicePose(s, w).distanceWalked;
        delete w.returning;
        w.mode = "idle";
        w.retry = 0;
      }
      continue;
    }
    const release = () => {
      const pose = cleanerServicePose(s, w),
        distance = Math.hypot(pose.x - w.x, pose.y - w.y);
      if (w.target) reserved.delete(`${w.target.kind}:${w.target.id}`);
      w.walked = pose.distanceWalked;
      resetWorker(w);
      if (distance > 1e-7) {
        const total = Math.max(0.1, distance / 1.45);
        w.returning = {
          from: { x: pose.x, y: pose.y },
          left: total,
          total,
          distanceStart: w.walked,
        };
        w.mode = "walk";
      }
    };
    if (w.target && !liveTarget(s, w)) {
      release();
      if (w.returning) continue;
    }
    if (w.mode === "patrol") {
      w.retry -= dt;
      if (w.retry <= 0) {
        const found = findWork(w);
        if (found) {
          assign(w, found);
          reserved.add(`${w.target!.kind}:${w.target!.id}`);
        } else w.retry = 0.8;
      }
    }
    if (w.route.length) {
      let budget = dt * 1.45;
      while (w.route.length && budget > 0) {
        const p = w.route[0],
          dx = p.x - w.x,
          dy = p.y - w.y;
        if (
          !walkable(s, p) ||
          Math.abs(dx) + Math.abs(dy) > 1.001 ||
          (Math.abs(dx) > 0.001 && Math.abs(dy) > 0.001)
        ) {
          release();
          break;
        }
        const d = Math.hypot(dx, dy);
        if (d > 0.00001) w.heading = Math.atan2(dy, dx);
        w.walked = (w.walked ?? 0) + Math.min(d, budget);
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
        if (w.mode !== "patrol") w.mode = "walk";
        continue;
      }
      // Work time starts on the following update, after reaching the actual tile.
      if (w.target) continue;
      w.mode = "idle";
      w.retry = 0;
    }
    if (w.target) {
      const target = liveTarget(s, w);
      if (
        !target ||
        (w.target.kind === "litter" || w.target.kind === "collection"
          ? Math.hypot(w.x - target.x, w.y - target.y) > 0.05
          : distance(cell(w), target) > 1)
      ) {
        release();
        continue;
      }
      if (
        !w.transferred &&
        ((w.target.kind === "deposit" && (target as CleanBuilding).binFill! >= BIN_CAPACITY) ||
          ((w.target.kind === "deposit" || w.target.kind === "collection") && !w.carried) ||
          (w.target.kind === "bin" && !(target as CleanBuilding).binFill))
      ) {
        release();
        continue;
      }
      if (w.workLeft <= 0) {
        w.workTotal =
          w.target.kind === "bin"
            ? 3
            : w.target.kind === "deposit"
              ? 1.4
              : w.target.kind === "collection"
                ? 2.4
                : 1.6 + ("amount" in target ? target.amount * 0.3 : 0);
        w.workLeft = w.workTotal;
        w.transferred = false;
        if (w.target.kind !== "litter") w.serviceTarget = { x: target.x, y: target.y };
      }
      w.mode = w.target.kind === "bin" ? "empty" : w.target.kind === "litter" ? "sweep" : "deposit";
      w.workLeft -= dt;
      if (
        !w.transferred &&
        (w.target.kind === "litter" ? w.workLeft <= 0 : cleanerWorkProgress(w) >= 0.78)
      ) {
        if (w.target.kind === "litter") {
          const litter = target as Litter;
          c.cleaned += litter.amount;
          w.carried = (w.carried ?? 0) + litter.amount;
          w.toCollection = false;
          c.litter = c.litter.filter((l) => l.id !== litter.id);
        } else if (w.target.kind === "bin") {
          const bin = target as CleanBuilding;
          w.carried = (w.carried ?? 0) + (bin.binFill ?? 0);
          w.toCollection = true;
          bin.binFill = 0;
          c.emptied++;
        } else if (w.target.kind === "deposit") {
          const bin = target as CleanBuilding,
            amount = Math.min(w.carried ?? 0, BIN_CAPACITY - (bin.binFill ?? 0));
          bin.binFill = (bin.binFill ?? 0) + amount;
          w.carried = (w.carried ?? 0) - amount;
          c.binned += amount;
        } else {
          c.disposed = (c.disposed ?? 0) + (w.carried ?? 0);
          w.carried = 0;
        }
        if (!w.carried) w.toCollection = false;
        w.transferred = true;
      }
      if (w.workLeft <= 0) release();
      continue;
    }
    w.retry -= dt;
    if (w.retry > 0) continue;
    const found = findWork(w);
    if (found) {
      assign(w, found);
      reserved.add(`${w.target!.kind}:${w.target!.id}`);
    } else patrol(s, w);
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
    busy:
      s.cleanliness?.workers.filter((w) => w.mode !== "idle" && w.mode !== "patrol").length ?? 0,
    carried: s.cleanliness?.workers.reduce((sum, w) => sum + (w.carried ?? 0), 0) ?? 0,
    disposed: s.cleanliness?.disposed ?? 0,
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
      (c.disposed !== undefined && !integer(c.disposed)) ||
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
        !["idle", "walk", "patrol", "sweep", "empty", "deposit"].includes(w.mode) ||
        !Array.isArray(w.route) ||
        w.route.length > s.tiles.length * s.tiles[0].length ||
        !w.route.every(grid) ||
        !finite(w.workLeft) ||
        !finite(w.retry) ||
        (w.carried !== undefined && !integer(w.carried)) ||
        (w.toCollection !== undefined && typeof w.toCollection !== "boolean") ||
        (w.heading !== undefined && !finite(w.heading)) ||
        (w.walked !== undefined && !nonnegative(w.walked)) ||
        (w.workTotal !== undefined && !nonnegative(w.workTotal)) ||
        (w.patrolStep !== undefined && !integer(w.patrolStep)) ||
        (w.area !== undefined && !validArea(s, w.area)) ||
        (w.workStep !== undefined && !integer(w.workStep)) ||
        (w.fairCursor !== undefined && !integer(w.fairCursor)) ||
        (w.transferred !== undefined && typeof w.transferred !== "boolean") ||
        (w.serviceTarget !== undefined && !grid(w.serviceTarget)) ||
        (w.returning !== undefined &&
          (!w.returning ||
            !position(w.returning.from) ||
            !nonnegative(w.returning.left) ||
            !finite(w.returning.total) ||
            w.returning.total <= 0 ||
            w.returning.left > w.returning.total ||
            !nonnegative(w.returning.distanceStart))) ||
        (w.target !== null &&
          (!w.target ||
            !["litter", "bin", "deposit", "collection"].includes(w.target.kind) ||
            !integer(w.target.id) ||
            (w.target.kind === "collection" &&
              (w.target.id !== 0 || !w.target.point || !grid(w.target.point)))))
      )
        return false;
      ids.add(w.id);
    }
    return true;
  } catch {
    return false;
  }
}

/** Actual train state. Distances are in map tiles; speed is m/s. Renderers read
 * these positions and passenger IDs; they never invent a second timetable. */
import type { Building, Park } from "./simulation";
import { prepareRoute, routePosition, trainDistance } from "./motion";

export const CAR_SPACING = 0.74;
export type TrainPhase = "waiting" | "boarding" | "checking" | "running" | "blocked" | "unloading";
export type TrainProgram = {
  count: number;
  cars: number;
  minWait: number;
  maxWait: number;
  minLoad: number;
  blocks: number;
};
export type CoasterTrain = {
  id: number;
  distance: number;
  speed: number;
  phase: TrainPhase;
  riders: number[];
  wait: number;
  timer: number;
  roundsLeft: number;
  completed: number;
  tripComplete: boolean;
};
export type CoasterFleet = { version: 1; program: TrainProgram; trains: CoasterTrain[] };
export const TRAIN_PHASE_LABELS: Record<TrainPhase, string> = {
  waiting: "An der Station",
  boarding: "Einsteigen",
  checking: "Sicherheitskontrolle",
  running: "Unterwegs",
  blocked: "Wartet am Blocksignal",
  unloading: "Aussteigen",
};
export function trainProgramOf(b: Building, legacyCapacity = 8): TrainProgram {
  return (
    b.trainFleet?.program ?? {
      count: 1,
      cars: Math.ceil(legacyCapacity / 2),
      minWait: 2,
      maxWait: 15,
      minLoad: 25,
      blocks: 3,
    }
  );
}
function validProgram(p: TrainProgram): boolean {
  return (
    !!p &&
    [p.count, p.cars, p.blocks, p.minWait, p.maxWait, p.minLoad].every(Number.isInteger) &&
    p.count >= 1 &&
    p.count <= 4 &&
    p.cars >= 1 &&
    p.cars <= 8 &&
    p.blocks >= p.count + 2 &&
    p.blocks <= 16 &&
    p.minWait >= 0 &&
    p.maxWait >= Math.max(1, p.minWait) &&
    p.maxWait <= 120 &&
    p.minLoad >= 0 &&
    p.minLoad <= 100
  );
}
export const trainLength = (p: TrainProgram) => (p.cars - 1) * CAR_SPACING + 0.55;
export function trainProgramError(b: Building, p: TrainProgram): string | null {
  if (b.kind !== "coaster" || !b.track?.length)
    return "Wähle eine Achterbahn mit geschlossener Strecke.";
  if (!validProgram(p))
    return "Wähle 1–4 Züge, 1–8 Wagen und mindestens zwei freie Sicherheitsblöcke.";
  const length = prepareRoute(b.track).length;
  if (length / p.blocks < trainLength(p) + 0.7)
    return "Die Blockabschnitte sind zu kurz. Nutze weniger Wagen oder eine längere Strecke.";
  if (b.riders.length) return "Lass zuerst alle Gäste aussteigen; schließe dafür die Bahn.";
  if (b.testing) return "Beende zuerst die Probefahrt.";
  return null;
}
export function setCoasterTrainProgram(b: Building, p: TrainProgram): string | null {
  const error = trainProgramError(b, p);
  if (error) return error;
  const length = prepareRoute(b.track!).length;
  b.trainFleet = {
    version: 1,
    program: { ...p },
    trains: Array.from({ length: p.count }, (_, i) => ({
      id: i + 1,
      distance: i ? ((p.blocks - i) * length) / p.blocks - 0.2 : 0,
      speed: 0,
      phase: i ? "blocked" : "waiting",
      riders: [],
      wait: 0,
      timer: 0,
      roundsLeft: 0,
      completed: 0,
      tripComplete: false,
    })),
  };
  b.cycle = 0;
  if (b.operations)
    Object.assign(b.operations, { phase: "idle", phaseLeft: 0, remainingRounds: 0 });
  return null;
}
const mod = (v: number, n: number) => ((v % n) + n) % n;
/** A block remains held until the REAR of the train has passed its signal. */
export function trainBlockOwners(b: Building): Map<number, number> {
  const fleet = b.trainFleet,
    owners = new Map<number, number>();
  if (!fleet || !b.track) return owners;
  const length = prepareRoute(b.track).length,
    blockLength = length / fleet.program.blocks;
  for (const train of fleet.trains) {
    const head = Math.floor(mod(train.distance, length) / blockLength);
    const tail = Math.floor(mod(train.distance - trainLength(fleet.program), length) / blockLength);
    owners.set(head, train.id);
    owners.set(tail, train.id);
  }
  return owners;
}
type TrainTick = {
  ready: boolean;
  exitClear: boolean;
  rounds: number;
  /** Return one affordable waiting guest, charging only at this transition. */
  board: () => number | null;
  release: (id: number, completed: boolean) => void;
  /** Mechanical defects stop every train until maintenance restores operation. */
  emergencyStop?: boolean;
};
export function tickCoasterTrains(b: Building, dt: number, options: TrainTick): void {
  if (!b.trainFleet || !b.track || !Number.isFinite(dt) || dt <= 0) return;
  // Integrate fast simulation and big API steps with the same safety gates.
  if (dt > 0.05) {
    let left = dt;
    while (left > 1e-8) {
      const step = Math.min(0.05, left);
      tickCoasterTrains(b, step, options);
      left -= step;
    }
    return;
  }
  const fleet = b.trainFleet,
    p = fleet.program,
    route = prepareRoute(b.track),
    length = route.length,
    blockLength = length / p.blocks;
  for (const t of fleet.trains) {
    if (["waiting", "boarding", "checking", "unloading"].includes(t.phase)) {
      t.distance = 0;
      t.speed = 0;
      if (t.phase === "unloading") {
        t.timer = Math.max(0, t.timer - dt);
        if (t.timer <= 0 && t.riders.length) {
          const id = t.riders.shift()!;
          // Remove occupancy before the callback hands the real guest to the exit.
          b.riders = b.riders.filter((r) => r !== id);
          options.release(id, t.tripComplete);
          t.timer = 0.35;
        }
        if (!t.riders.length && options.exitClear) {
          t.phase = "waiting";
          t.wait = 0;
          t.timer = 0;
        }
        continue;
      }
      if (!options.ready && t.riders.length) {
        t.phase = "unloading";
        t.timer = 0;
        continue;
      }
      // An empty train must clear the platform so occupied followers can unload
      // after closure. It keeps its real position and obeys the same signals.
      if (
        !options.ready &&
        fleet.trains.some((other) => other.id !== t.id && other.riders.length)
      ) {
        t.phase = "running";
        t.roundsLeft = 0;
        continue;
      }
      if (!options.ready || !options.exitClear) {
        t.wait = 0;
        continue;
      }
      t.wait += dt;
      if (t.phase === "waiting") {
        t.phase = "boarding";
        t.timer = 0;
        t.tripComplete = false;
      }
      if (t.phase === "boarding") {
        t.timer = Math.max(0, t.timer - dt);
        if (t.timer <= 0 && t.riders.length < p.cars * 2) {
          const id = options.board();
          if (id !== null) {
            t.riders.push(id);
            if (!b.riders.includes(id)) b.riders.push(id);
          }
          t.timer = 0.35;
        }
        const full = t.riders.length === p.cars * 2,
          minimum = t.riders.length >= Math.max(1, Math.ceil((p.cars * 2 * p.minLoad) / 100));
        if (t.riders.length && t.wait >= p.minWait && (full || minimum || t.wait >= p.maxWait)) {
          t.phase = "checking";
          t.timer = 1.5;
        }
        if (
          !t.riders.length &&
          t.wait >= p.maxWait &&
          fleet.trains.some((other) => other.riders.length)
        ) {
          t.phase = "running";
          t.roundsLeft = 0;
          t.wait = 0;
        }
      } else if (t.phase === "checking") {
        t.timer = Math.max(0, t.timer - dt);
        if (t.timer === 0 && options.exitClear) {
          t.phase = "running";
          t.roundsLeft = options.rounds;
          t.wait = 0;
        }
      }
      continue;
    }
    if (options.emergencyStop) {
      t.speed = 0;
      t.phase = "blocked";
      continue;
    }
    const owners = trainBlockOwners(b),
      block = Math.floor(t.distance / blockLength),
      next = (block + 1) % p.blocks,
      boundary = (block + 1) * blockLength,
      blocked = owners.has(next) && owners.get(next) !== t.id,
      stop = blocked ? boundary - 0.08 : boundary,
      remaining = Math.max(0, stop - t.distance),
      desired = Math.max(2.5, routePosition(route, t.distance).speed),
      target = blocked ? Math.min(desired, Math.sqrt(2 * 5 * remaining * 5)) : desired;
    t.speed = Math.max(0, Math.min(target, t.speed + 2.5 * dt));
    let step = Math.min(remaining, (t.speed * dt) / 5);
    if (!blocked && step >= remaining - 1e-8) step += 1e-6;
    t.distance += step;
    t.phase = blocked && remaining < 0.081 ? "blocked" : "running";
    if (blocked && t.distance >= stop - 1e-7) t.speed = 0;
    if (t.distance >= length) {
      t.distance = 0;
      t.completed++;
      if (t.riders.length && t.roundsLeft > 1 && options.ready) {
        t.roundsLeft--;
      } else {
        t.tripComplete = t.riders.length > 0;
        t.speed = 0;
        t.roundsLeft = 0;
        t.wait = 0;
        t.timer = 0;
        t.phase = t.riders.length ? "unloading" : "waiting";
      }
    }
  }
  b.riders = fleet.trains.flatMap((t) => t.riders);
  const station = fleet.trains.find((t) =>
    ["waiting", "boarding", "checking", "unloading"].includes(t.phase),
  );
  if (b.operations) {
    const phase = station?.phase;
    b.operations.phase =
      phase === "waiting"
        ? "idle"
        : phase === "boarding" || phase === "checking" || phase === "unloading"
          ? phase
          : b.riders.length
            ? "running"
            : "idle";
    b.operations.phaseLeft =
      phase === "checking"
        ? station!.timer
        : phase === "unloading"
          ? Math.min(1.2, station!.timer)
          : phase === "boarding"
            ? Math.min(2, station!.timer)
            : 0;
    b.operations.remainingRounds =
      b.operations.phase === "running" ? Math.max(1, ...fleet.trains.map((t) => t.roundsLeft)) : 0;
  }
  b.cycle = Math.max(
    0,
    ...fleet.trains
      .filter((t) => t.riders.length)
      .map((t) => route.duration * (1 - t.distance / length)),
  );
}
export function coasterTrainVisuals(b: Building, legacyCapacity = 8) {
  if (b.trainFleet)
    return b.trainFleet.trains.map((t) => ({ ...t, cars: b.trainFleet!.program.cars }));
  const route = prepareRoute(b.track ?? []),
    progress = b.testing
      ? 1 - b.testing / (b.testDuration ?? 8)
      : b.riders.length
        ? 1 - b.cycle / route.duration
        : 0,
    distance = trainDistance(route, progress);
  return [
    {
      id: 1,
      distance,
      speed: b.testing || b.riders.length ? routePosition(route, distance).speed : 0,
      phase: (b.riders.length ? "running" : "waiting") as TrainPhase,
      riders: b.riders,
      cars: Math.ceil(legacyCapacity / 2),
      wait: 0,
      timer: 0,
      roundsLeft: 1,
      completed: 0,
      tripComplete: false,
    },
  ];
}
export function coasterBlockVisuals(b: Building) {
  if (!b.trainFleet || !b.track) return [];
  const route = prepareRoute(b.track),
    owners = trainBlockOwners(b);
  return Array.from({ length: b.trainFleet.program.blocks }, (_, index) => ({
    index,
    distance: (index * route.length) / b.trainFleet!.program.blocks,
    owner: owners.get(index) ?? null,
    position: routePosition(route, (index * route.length) / b.trainFleet!.program.blocks),
  }));
}
export function validCoasterFleets(s: Pick<Park, "buildings" | "guests">): boolean {
  return s.buildings.every((b) => {
    const f = b.trainFleet;
    if (f === undefined) return true;
    if (
      b.kind !== "coaster" ||
      !b.track ||
      !f ||
      f.version !== 1 ||
      !validProgram(f.program) ||
      !Array.isArray(f.trains) ||
      f.trains.length !== f.program.count
    )
      return false;
    const route = prepareRoute(b.track),
      ids = new Set<number>(),
      guests = new Set<number>();
    if (route.length / f.program.blocks < trainLength(f.program) + 0.7) return false;
    const occupied = new Map<number, number>(),
      bl = route.length / f.program.blocks;
    for (const t of f.trains) {
      if (
        !t ||
        !Number.isInteger(t.id) ||
        t.id < 1 ||
        ids.has(t.id) ||
        !Object.hasOwn(TRAIN_PHASE_LABELS, t.phase) ||
        ![t.distance, t.speed, t.wait, t.timer, t.roundsLeft, t.completed].every(Number.isFinite) ||
        t.distance < 0 ||
        t.distance >= route.length ||
        t.speed < 0 ||
        t.speed > 100 ||
        t.wait < 0 ||
        t.timer < 0 ||
        t.timer > 2 ||
        typeof t.tripComplete !== "boolean" ||
        !Number.isInteger(t.roundsLeft) ||
        t.roundsLeft < 0 ||
        t.roundsLeft > 5 ||
        !Number.isInteger(t.completed) ||
        t.completed < 0 ||
        !Array.isArray(t.riders) ||
        t.riders.length > f.program.cars * 2 ||
        (["waiting", "boarding", "checking", "unloading"].includes(t.phase) &&
          (t.distance !== 0 || t.speed !== 0))
      )
        return false;
      ids.add(t.id);
      for (const id of t.riders) {
        if (
          !Number.isInteger(id) ||
          guests.has(id) ||
          !s.guests.some((g) => g.id === id && g.state === "ride" && g.target === b.id)
        )
          return false;
        guests.add(id);
      }
      for (const block of new Set([
        Math.floor(t.distance / bl),
        Math.floor(mod(t.distance - trainLength(f.program), route.length) / bl),
      ])) {
        if (occupied.has(block)) return false;
        occupied.set(block, t.id);
      }
    }
    return b.riders.length === guests.size && b.riders.every((id) => guests.has(id));
  });
}

/** Geometry edits retain a valid program but restart unoccupied trains safely. */
export function rebuildCoasterFleet(b: Building) {
  if (!b.trainFleet) return;
  const program = { ...b.trainFleet.program },
    testing = b.testing;
  delete b.trainFleet;
  b.testing = undefined;
  if (!b.riders.length && trainProgramError(b, program) === null)
    setCoasterTrainProgram(b, program);
  b.testing = testing;
}

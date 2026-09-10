/** Ride crew assignments and dispatch programs. Crew edits may release waiting
 * guests; revenue, ride rewards, Park.time and payroll billing remain caller-owned. */
import type { Building, Kind, Park } from "./simulation";
import {
  resetWheelState,
  wheelProgramDuration,
  wheelProgramRemaining,
  wheelVisualState,
} from "./wheel-boarding";

export const OPERATOR_WAGE = 70;
/** One assignment hires the complete three-person crew; wages remain per crew. */
export const OPERATOR_POSTS = ["control", "entry", "exit"] as const;
export type OperatorPost = (typeof OPERATOR_POSTS)[number];
export type RideCrew = { id: number; buildingId: number | null; mode: "auto" | "manual" };
export type RideCrewPool = { version: 1; nextId: number; crews: RideCrew[] };
export type CrewPool = RideCrewPool;
export type RideStaffingMode = "auto" | "off";
export const MAX_RIDE_CREWS = 200;
type CrewPark = Pick<Park, "buildings"> & Partial<Pick<Park, "crewPool" | "guests">>;
const crewOwners = new WeakMap<Building, CrewPark>();
export const OPERATOR_ROLES: Record<OperatorPost, string> = {
  control: "Fahrsteuerung",
  entry: "Einlass",
  exit: "Ausstieg",
};
export const BOARDING_SECONDS = 2;
export const CHECKING_SECONDS = 1.5;
export const UNLOADING_SECONDS = 1.2;
export type OperationPhase = "idle" | "boarding" | "checking" | "running" | "unloading";
export type RideOperations = {
  staffed: boolean;
  crewId?: number;
  assignment?: RideStaffingMode;
  rounds: number;
  remainingRounds: number;
  phase: OperationPhase;
  phaseLeft: number;
};
export type OperatedBuilding = Building & { operations?: RideOperations };
const RIDE_KINDS = [
  "coaster",
  "wheel",
  "carousel",
  "swing",
  "drop",
  "pirate",
  "teacups",
  "spinner",
  "custom",
  "bumper",
  "balloonride",
] as const satisfies readonly Kind[];
export const needsOperator = (kind: string) => (RIDE_KINDS as readonly string[]).includes(kind);
const phaseDuration: Record<OperationPhase, number> = {
  idle: 0,
  boarding: BOARDING_SECONDS,
  checking: CHECKING_SECONDS,
  running: 0,
  unloading: UNLOADING_SECONDS,
};
const fresh = (b: Building): RideOperations => ({
  staffed: true,
  rounds: 1,
  remainingRounds: b.riders.length ? 1 : 0,
  phase: b.riders.length ? "running" : "idle",
  phaseLeft: 0,
});
/** Pure read; old saves behave as assigned single-round rides even before init. */
export const operationsOf = (b: Building): Readonly<RideOperations> =>
  (b as OperatedBuilding).operations ?? fresh(b);
export function ensureOperations(b: Building): RideOperations {
  const item = b as OperatedBuilding;
  return (item.operations ??= fresh(b));
}
/** Missing fields are migration only; explicit false/round counts are never overwritten. */
export function initOperations(s: CrewPark): void {
  const legacy = s.crewPool === undefined;
  for (const b of s.buildings)
    if (needsOperator(b.kind)) {
      const o = ensureOperations(b);
      o.assignment ??= legacy && !o.staffed ? "off" : "auto";
      crewOwners.set(b, s);
    }
  ensureCrewPool(s);
  autoAssignRideCrews(s);
}
export function hasOperator(b: Building): boolean {
  return !needsOperator(b.kind) || operationsOf(b).staffed;
}
export function setRideStaffed(b: Building, staffed: boolean): string | null {
  if (!needsOperator(b.kind)) return "Diese Einrichtung benötigt kein Fahrpersonal.";
  if (typeof staffed !== "boolean") return "Ungültige Personalzuweisung.";
  const owner = crewOwners.get(b);
  if (owner?.crewPool) return setRideStaffingMode(owner, b.id, staffed ? "auto" : "off");
  const o = ensureOperations(b);
  if (!staffed && b.riders.length)
    return "Die Crew kann nach Ende der laufenden Fahrt abgezogen werden.";
  o.staffed = staffed;
  o.assignment = staffed ? "auto" : "off";
  if (!staffed) resetRideOperations(b);
  return null;
}
export function setRideRounds(b: Building, rounds: number): string | null {
  if (!needsOperator(b.kind)) return "Betriebsprogramme gelten nur für Fahrgeschäfte.";
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 5) return "Wähle eine bis fünf Runden.";
  ensureOperations(b).rounds = rounds;
  return null;
}
/** Preserve the assignment and next-program setting when a ride is closed/moved. */
export function resetRideOperations(b: Building): void {
  if (!needsOperator(b.kind)) return;
  const o = ensureOperations(b);
  o.phase = "idle";
  o.phaseLeft = 0;
  o.remainingRounds = 0;
  if (!b.riders.length) resetWheelState(b);
}
/** Advance only admission/control/unloading, with dt already speed-scaled.
 * Call once per simulation step before the legacy boarding block. `ready` must
 * include open, reachable, tested, unbroken, and not currently being track-edited.
 * True grants one dispatch; caller moves guests/charges once, then calls startRideProgram.
 * Services return true and keep their original dispatch behavior. */
export function tickOperations(b: Building, dt: number, ready: boolean, exitClear = true): boolean {
  if (!needsOperator(b.kind)) return ready;
  if (!Number.isFinite(dt) || dt <= 0) return false;
  const o = ensureOperations(b);
  if (b.riders.length) {
    // Continue an existing occupied ride until the simulation safely releases it.
    o.phase = "running";
    o.phaseLeft = 0;
    if (o.remainingRounds < 1) o.remainingRounds = 1;
    return false;
  }
  if (!exitClear) {
    o.phase = "unloading";
    o.phaseLeft = UNLOADING_SECONDS;
    return false;
  }
  if (!ready || !o.staffed) {
    resetRideOperations(b);
    return false;
  }
  if (o.phase === "running") resetRideOperations(b);
  if (o.phase !== "unloading" && !b.queue.length) {
    resetRideOperations(b);
    return false;
  }
  let left = dt;
  // At most unloading -> boarding -> checking in one large input; no wall clocks.
  for (let step = 0; step < 4; step++) {
    if (o.phase === "idle") {
      if (!b.queue.length) return false;
      o.phase = "boarding";
      o.phaseLeft = BOARDING_SECONDS;
    }
    const used = Math.min(left, o.phaseLeft);
    o.phaseLeft = Math.max(0, o.phaseLeft - used);
    left -= used;
    if (o.phaseLeft > 1e-9) return false;
    o.phaseLeft = 0;
    if (o.phase === "checking") return true;
    if (o.phase === "boarding") {
      o.phase = "checking";
      o.phaseLeft = CHECKING_SECONDS;
    } else if (o.phase === "unloading") {
      o.phase = "idle";
    }
    if (left <= 1e-9) return false;
  }
  return false;
}
/** Call after boarding populated b.riders. Config changes then apply next dispatch. */
export function startRideProgram(b: Building): void {
  if (!needsOperator(b.kind)) return;
  const o = ensureOperations(b);
  if (!b.riders.length) {
    resetRideOperations(b);
    return;
  }
  o.phase = "running";
  o.phaseLeft = 0;
  o.remainingRounds = o.rounds;
}
/** Call when occupied b.cycle <=0, BEFORE the legacy disembark/reward block.
 * Returns true while additional base rounds keep the current passengers aboard.
 * Never multiply rideDuration or the physics/render progress denominator. */
export function repeatRideRound(b: Building, baseDuration: number): boolean {
  if (!needsOperator(b.kind) || !b.riders.length || b.cycle > 0) return false;
  if (!Number.isFinite(baseDuration) || baseDuration <= 0) return false;
  const o = ensureOperations(b);
  while (b.cycle <= 0 && o.remainingRounds > 1) {
    o.remainingRounds--;
    b.cycle += baseDuration; // Preserve sub-step overshoot at each station crossing.
  }
  return b.cycle > 0;
}
/** Call after the final legacy disembark/reward block clears b.riders. */
export function finishRideProgram(b: Building): void {
  if (!needsOperator(b.kind)) return;
  const o = ensureOperations(b);
  o.remainingRounds = 0;
  o.phase = "unloading";
  o.phaseLeft = UNLOADING_SECONDS;
}
/** Full next dispatch time for wait estimates, without changing ride physics. */
export function programDuration(b: Building, baseDuration: number): number {
  if (b.kind === "wheel") return wheelProgramDuration(operationsOf(b).rounds, baseDuration);
  return needsOperator(b.kind)
    ? baseDuration * operationsOf(b).rounds +
        BOARDING_SECONDS +
        CHECKING_SECONDS +
        UNLOADING_SECONDS
    : baseDuration;
}
export function programRemaining(b: Building, baseDuration: number): number {
  if (b.kind === "wheel" && b.wheel) return wheelProgramRemaining(b, baseDuration);
  if (!needsOperator(b.kind)) return Math.max(0, b.cycle);
  const o = operationsOf(b);
  if (b.riders.length)
    return (
      Math.max(0, b.cycle) + Math.max(0, o.remainingRounds - 1) * baseDuration + UNLOADING_SECONDS
    );
  if (o.phase === "boarding") return o.phaseLeft + CHECKING_SECONDS;
  return o.phaseLeft;
}
export function operatorActivity(b: Building): OperationPhase | "off" {
  return operationsOf(b).staffed ? operationsOf(b).phase : "off";
}
export function operationProgress(b: Building): number {
  if (b.kind === "wheel" && b.wheel) return wheelVisualState(b).progress;
  const o = operationsOf(b),
    duration = phaseDuration[o.phase];
  return duration ? Math.max(0, Math.min(1, 1 - o.phaseLeft / duration)) : 0;
}
export const OPERATION_LABELS: Record<OperationPhase | "off", string> = {
  off: "Crew fehlt",
  idle: "Bereit am Eingang",
  boarding: "Gäste einlassen",
  checking: "Sicherheitskontrolle",
  running: "Am Bedienpult",
  unloading: "Ausstieg begleiten",
};
const CREW_NAMES = [
  "Hanna",
  "Ben",
  "Emir",
  "Mara",
  "Jonas",
  "Lina",
  "Noah",
  "Amira",
  "Tom",
  "Kira",
  "Paul",
  "Mila",
];
export const crewMemberName = (crewId: number, post: OperatorPost = "control") =>
  CREW_NAMES[(Math.abs(crewId) + OPERATOR_POSTS.indexOf(post) * 4) % CREW_NAMES.length];
export const operatorName = (b: Building, post: OperatorPost = "control") =>
  crewMemberName(operationsOf(b).crewId ?? b.id, post);
/** Real crew posts share one assignment. Attendants take a short step toward
 * their gate, work there, then return within the actual admission/unload phase. */
export function operatorState(b: Building, post: OperatorPost = "control") {
  if (!needsOperator(b.kind) || !hasOperator(b) || !OPERATOR_POSTS.includes(post)) return null;
  const phase = operatorActivity(b),
    progress = operationProgress(b),
    onDuty =
      b.kind === "wheel" && b.wheel
        ? post === "entry"
          ? b.wheel.phase === "loading"
          : post === "exit" && (b.wheel.phase === "unloading" || b.wheel.phase === "clearing")
        : post === "entry"
          ? phase === "boarding" || phase === "checking"
          : post === "exit" && phase === "unloading",
    stepProgress = onDuty ? Math.min(1, progress / 0.2, (1 - progress) / 0.2) : 0,
    returning = onDuty && progress > 0.8,
    activity =
      post === "control"
        ? b.open || b.riders.length || phase === "unloading"
          ? "control"
          : "idle"
        : onDuty
          ? phase
          : "idle";
  return {
    id: `operator-${operationsOf(b).crewId ?? b.id}-${post}`,
    crewId: operationsOf(b).crewId ?? b.id,
    buildingId: b.id,
    post,
    role: OPERATOR_ROLES[post],
    name: operatorName(b, post),
    phase,
    activity,
    atGate: post !== "control",
    progress,
    consoleProgress: post === "control" ? 1 : 0,
    stepProgress,
    returning,
    walking: onDuty && (progress < 0.2 || (progress > 0.8 && progress < 1)),
  };
}
export function rideCrew(b: Building) {
  return OPERATOR_POSTS.flatMap((post) => {
    const member = operatorState(b, post);
    return member ? [member] : [];
  });
}
export function operationsStats(s: CrewPark) {
  const rides = s.buildings.filter((b) => needsOperator(b.kind));
  const staffed = rides.filter(hasOperator).length,
    pool = crewPoolOf(s);
  return {
    rides: rides.length,
    staffed,
    crewCount: pool.crews.length,
    personCount: pool.crews.length * OPERATOR_POSTS.length,
    availableCrews: availableRideCrews(s).length,
    manualCrews: pool.crews.filter((c) => c.mode === "manual").length,
    unstaffed: rides.length - staffed,
    active: rides.filter((b) => operationsOf(b).phase === "running").length,
    boarding: rides.filter((b) => ["boarding", "checking"].includes(operationsOf(b).phase)).length,
    dailyCost: pool.crews.length * OPERATOR_WAGE,
  };
}
/** Add this exactly once to the existing daily cost block; this function never charges. */
export const operatorWages = (s: CrewPark) => operationsStats(s).dailyCost;
export function validOperations(s: Pick<Park, "buildings">): boolean {
  return s.buildings.every((b) => {
    const o = (b as OperatedBuilding).operations;
    if (o === undefined) return true;
    if (
      !needsOperator(b.kind) ||
      !o ||
      typeof o !== "object" ||
      typeof o.staffed !== "boolean" ||
      (o.crewId !== undefined && (!Number.isSafeInteger(o.crewId) || o.crewId < 1)) ||
      (o.assignment !== undefined && o.assignment !== "auto" && o.assignment !== "off") ||
      !Number.isInteger(o.rounds) ||
      o.rounds < 1 ||
      o.rounds > 5 ||
      !Number.isInteger(o.remainingRounds) ||
      o.remainingRounds < 0 ||
      o.remainingRounds > 5 ||
      !Object.hasOwn(phaseDuration, o.phase) ||
      !Number.isFinite(o.phaseLeft) ||
      o.phaseLeft < 0 ||
      o.phaseLeft > Math.max(phaseDuration[o.phase], 0.001)
    )
      return false;
    if (o.phase === "running" && (!b.riders.length || o.remainingRounds < 1)) return false;
    if (o.phase !== "running" && o.remainingRounds !== 0) return false;
    return true;
  });
}

/** Legacy saves retain exactly the crews they already employed; reads never hire. */
export function crewPoolOf(s: CrewPark): Readonly<RideCrewPool> {
  if (s.crewPool) return s.crewPool;
  const crews: RideCrew[] = s.buildings
    .filter((b) => needsOperator(b.kind) && operationsOf(b).staffed)
    .map((b) => ({ id: b.id, buildingId: b.id, mode: "auto" }));
  return { version: 1, nextId: Math.max(0, ...crews.map((c) => c.id)) + 1, crews };
}
function ensureCrewPool(s: CrewPark): RideCrewPool {
  return (s.crewPool ??= structuredClone(crewPoolOf(s)));
}
export function availableRideCrews(s: CrewPark): RideCrew[] {
  return crewPoolOf(s).crews.filter(
    (c) =>
      c.buildingId === null ||
      !s.buildings.some((b) => b.id === c.buildingId && needsOperator(b.kind)),
  );
}
function crewRide(s: CrewPark, id: number | null) {
  return s.buildings.find((b) => b.id === id && needsOperator(b.kind));
}
function busy(b: Building | undefined) {
  return !!b && (b.riders.length > 0 || ["running", "unloading"].includes(operationsOf(b).phase));
}
/** Waiting visitors remain at their existing reachable path position. */
function releaseWaiting(s: CrewPark, b: Building) {
  const queued = new Set(b.queue);
  for (const g of s.guests ?? [])
    if (g.state === "queue" && queued.has(g.id)) {
      g.state = "walk";
      g.target = null;
      g.route = [];
      g.timer = 1;
      g.transit = undefined;
      g.thought = "Die Crew wechselt ihren Einsatz. Ich suche ein anderes Ziel.";
    }
  b.queue = [];
}
function detach(s: CrewPark, crew: RideCrew) {
  const b = crewRide(s, crew.buildingId);
  if (b) {
    releaseWaiting(s, b);
    const o = ensureOperations(b);
    o.staffed = false;
    delete o.crewId;
    resetRideOperations(b);
  }
  crew.buildingId = null;
}
function synchronizeCrewFlags(s: CrewPark) {
  const pool = ensureCrewPool(s);
  for (const b of s.buildings)
    if (needsOperator(b.kind)) {
      crewOwners.set(b, s);
      const o = ensureOperations(b),
        crew = pool.crews.find((c) => c.buildingId === b.id);
      o.assignment ??= "auto";
      if (crew) {
        o.staffed = true;
        o.crewId = crew.id;
      } else {
        if (o.staffed && !busy(b)) {
          releaseWaiting(s, b);
          resetRideOperations(b);
        }
        o.staffed = false;
        delete o.crewId;
      }
    }
}
/** Allocate existing people only. Closed automatic assignments are retained
 * unless an open/tested ride needs them and no free crew can take that job. */
export function autoAssignRideCrews(s: CrewPark, preferredBuildingId?: number): void {
  const pool = ensureCrewPool(s);
  for (const crew of pool.crews) {
    const b = crewRide(s, crew.buildingId);
    if (!b) {
      if (crew.buildingId !== null) {
        crew.buildingId = null;
        crew.mode = "auto";
      }
    } else if (operationsOf(b).assignment === "off" && !busy(b)) detach(s, crew);
  }
  const rides = s.buildings.filter(
      (b) => needsOperator(b.kind) && operationsOf(b).assignment !== "off",
    ),
    assigned = () => new Set(pool.crews.map((c) => c.buildingId)),
    free = () => pool.crews.filter((c) => c.buildingId === null).sort((a, b) => a.id - b.id),
    ready = rides
      .filter(
        (b) =>
          (b.id === preferredBuildingId || (b.open && b.tested)) &&
          !busy(b) &&
          !assigned().has(b.id),
      )
      .sort(
        (a, b) =>
          Number(b.id === preferredBuildingId) - Number(a.id === preferredBuildingId) ||
          a.id - b.id,
      );
  for (const b of ready) {
    let crew: RideCrew | undefined = free()[0];
    if (!crew)
      crew = pool.crews.find(
        (c) =>
          c.mode === "auto" &&
          c.buildingId !== null &&
          c.buildingId !== preferredBuildingId &&
          !crewRide(s, c.buildingId)?.open &&
          !busy(crewRide(s, c.buildingId)),
      );
    if (crew) {
      if (crew.buildingId !== null) detach(s, crew);
      crew.buildingId = b.id;
    }
  }
  const occupied = assigned(),
    waiting = rides
      .filter((b) => !busy(b) && !occupied.has(b.id))
      .sort(
        (a, b) =>
          Number(b.open) - Number(a.open) || Number(b.tested) - Number(a.tested) || a.id - b.id,
      );
  for (const b of waiting) {
    const crew = free()[0];
    if (!crew) break;
    crew.buildingId = b.id;
  }
  synchronizeCrewFlags(s);
}
export function canAssignRideCrew(
  s: CrewPark,
  id: number,
  buildingId: number | null,
): string | null {
  const pool = crewPoolOf(s),
    crew = pool.crews.find((c) => c.id === id);
  if (!Number.isSafeInteger(id) || !crew) return "Diese Crew ist nicht mehr verfügbar.";
  if (buildingId !== null && (!Number.isSafeInteger(buildingId) || !crewRide(s, buildingId)))
    return "Wähle ein vorhandenes Fahrgeschäft.";
  if (crew.buildingId === buildingId) return null;
  if (busy(crewRide(s, crew.buildingId)))
    return "Die Crew bleibt bis nach Fahrt und Ausstieg im Einsatz.";
  if (buildingId !== null && busy(crewRide(s, buildingId)))
    return "Die Zielcrew bleibt bis nach Fahrt und Ausstieg im Einsatz.";
  return null;
}
export function assignRideCrew(s: CrewPark, id: number, buildingId: number | null): string | null {
  const error = canAssignRideCrew(s, id, buildingId);
  if (error) return error;
  const pool = ensureCrewPool(s),
    crew = pool.crews.find((c) => c.id === id)!;
  if (crew.buildingId !== buildingId) {
    const old = crewRide(s, crew.buildingId);
    if (old && buildingId === null) ensureOperations(old).assignment = "off";
    const replaced =
      buildingId === null ? undefined : pool.crews.find((c) => c.buildingId === buildingId);
    if (replaced) {
      detach(s, replaced);
      replaced.mode = "auto";
    }
    detach(s, crew);
    crew.buildingId = buildingId;
  }
  crew.mode = buildingId === null ? "auto" : "manual";
  if (buildingId !== null) ensureOperations(crewRide(s, buildingId)!).assignment = "auto";
  autoAssignRideCrews(s);
  return null;
}
export function setCrewAutomatic(s: CrewPark, id: number): string | null {
  if (!Number.isSafeInteger(id) || !crewPoolOf(s).crews.some((c) => c.id === id))
    return "Diese Crew ist nicht mehr verfügbar.";
  ensureCrewPool(s).crews.find((c) => c.id === id)!.mode = "auto";
  autoAssignRideCrews(s);
  return null;
}
export function setRideStaffingMode(
  s: CrewPark,
  buildingId: number,
  mode: RideStaffingMode,
): string | null {
  const b = crewRide(s, buildingId);
  if (!b || (mode !== "auto" && mode !== "off")) return "Ungültige Crewzuweisung.";
  if (mode === "off" && busy(b)) return "Die Crew bleibt bis nach Fahrt und Ausstieg im Einsatz.";
  ensureCrewPool(s);
  ensureOperations(b).assignment = mode;
  if (mode === "off") {
    const crew = s.crewPool!.crews.find((c) => c.buildingId === b.id);
    if (crew) {
      detach(s, crew);
      crew.mode = "auto";
    } else {
      releaseWaiting(s, b);
      ensureOperations(b).staffed = false;
      resetRideOperations(b);
    }
  }
  autoAssignRideCrews(s, mode === "auto" ? buildingId : undefined);
  return null;
}
export function hireRideCrew(s: CrewPark): string | null {
  if (crewPoolOf(s).crews.length >= MAX_RIDE_CREWS)
    return `Maximal ${MAX_RIDE_CREWS} Crews können beschäftigt werden.`;
  const pool = ensureCrewPool(s);
  pool.crews.push({ id: pool.nextId++, buildingId: null, mode: "auto" });
  autoAssignRideCrews(s);
  return null;
}
export function dismissRideCrew(s: CrewPark, id: number): string | null {
  const error = canAssignRideCrew(s, id, null);
  if (error) return error;
  const pool = ensureCrewPool(s),
    crew = pool.crews.find((c) => c.id === id)!;
  detach(s, crew);
  pool.crews = pool.crews.filter((c) => c.id !== id);
  autoAssignRideCrews(s);
  return null;
}
function validPoolShape(value: unknown): value is RideCrewPool {
  if (!value || typeof value !== "object") return false;
  const p = value as RideCrewPool;
  if (
    p.version !== 1 ||
    !Number.isSafeInteger(p.nextId) ||
    p.nextId < 1 ||
    !Array.isArray(p.crews) ||
    p.crews.length > 10000
  )
    return false;
  const ids = new Set<number>(),
    buildings = new Set<number>();
  for (const c of p.crews) {
    if (
      !c ||
      !Number.isSafeInteger(c.id) ||
      c.id < 1 ||
      c.id >= p.nextId ||
      ids.has(c.id) ||
      (c.mode !== "auto" && c.mode !== "manual") ||
      (c.buildingId !== null &&
        (!Number.isSafeInteger(c.buildingId) || c.buildingId < 1 || buildings.has(c.buildingId)))
    )
      return false;
    ids.add(c.id);
    if (c.buildingId !== null) buildings.add(c.buildingId);
  }
  return true;
}
export function validCrewPool(s: CrewPark): boolean {
  if (s.crewPool === undefined) return true;
  if (!validPoolShape(s.crewPool)) return false;
  for (const crew of s.crewPool.crews) {
    const b = s.buildings.find((b) => b.id === crew.buildingId);
    if (
      b &&
      (!needsOperator(b.kind) ||
        !operationsOf(b).staffed ||
        operationsOf(b).crewId !== crew.id ||
        operationsOf(b).assignment === "off")
    )
      return false;
  }
  return s.buildings.every(
    (b) =>
      !needsOperator(b.kind) ||
      (!operationsOf(b).staffed && operationsOf(b).crewId === undefined) ||
      s.crewPool!.crews.some((c) => c.id === operationsOf(b).crewId && c.buildingId === b.id),
  );
}
export function canRestoreCrewAssignments(s: CrewPark, snapshot: RideCrewPool): string | null {
  if (!validPoolShape(snapshot)) return "Die gespeicherte Crewzuweisung ist ungültig.";
  const current = crewPoolOf(s);
  for (const c of current.crews) {
    const desired = snapshot.crews.find((old) => old.id === c.id);
    if (desired?.buildingId !== c.buildingId && busy(crewRide(s, c.buildingId)))
      return "Die Crew bleibt bis nach Fahrt und Ausstieg im Einsatz.";
  }
  for (const c of snapshot.crews)
    if (
      c.buildingId !== null &&
      busy(crewRide(s, c.buildingId)) &&
      !current.crews.some((now) => now.id === c.id && now.buildingId === c.buildingId)
    )
      return "Eine laufende Fahrt verhindert diese Crewzuweisung.";
  return null;
}
export function restoreCrewAssignments(s: CrewPark, snapshot: RideCrewPool): string | null {
  const error = canRestoreCrewAssignments(s, snapshot);
  if (error) return error;
  const current = ensureCrewPool(s),
    previousNextId = current.nextId;
  for (const c of current.crews)
    if (snapshot.crews.find((old) => old.id === c.id)?.buildingId !== c.buildingId) detach(s, c);
  s.crewPool = structuredClone(snapshot);
  s.crewPool.nextId = Math.max(previousNextId, snapshot.nextId);
  for (const c of s.crewPool.crews)
    if (c.buildingId !== null) {
      const b = crewRide(s, c.buildingId);
      if (!b) {
        c.buildingId = null;
        c.mode = "auto";
      } else ensureOperations(b).assignment = "auto";
    }
  synchronizeCrewFlags(s);
  return null;
}

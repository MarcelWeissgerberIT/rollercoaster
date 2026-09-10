/** Ride crew and dispatch programs. This module never mutates guests, queues,
 * revenue, routes, Park.time or payroll. The simulation owns those transitions. */
import type { Building, Kind, Park } from "./simulation";

export const OPERATOR_WAGE = 70;
export const BOARDING_SECONDS = 2;
export const CHECKING_SECONDS = 1.5;
export const UNLOADING_SECONDS = 1.2;
export type OperationPhase = "idle" | "boarding" | "checking" | "running" | "unloading";
export type RideOperations = {
  staffed: boolean;
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
export function initOperations(s: Pick<Park, "buildings">): void {
  for (const b of s.buildings) if (needsOperator(b.kind)) ensureOperations(b);
}
export function hasOperator(b: Building): boolean {
  return !needsOperator(b.kind) || operationsOf(b).staffed;
}
export function setRideStaffed(b: Building, staffed: boolean): string | null {
  if (!needsOperator(b.kind)) return "Diese Einrichtung benötigt kein Fahrpersonal.";
  if (typeof staffed !== "boolean") return "Ungültige Personalzuweisung.";
  const o = ensureOperations(b);
  if (!staffed && b.riders.length)
    return "Die Crew kann nach Ende der laufenden Fahrt abgezogen werden.";
  o.staffed = staffed;
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
}
/** Advance only admission/control/unloading, with dt already speed-scaled.
 * Call once per simulation step before the legacy boarding block. `ready` must
 * include open, reachable, tested, unbroken, and not currently being track-edited.
 * True grants one dispatch; caller moves guests/charges once, then calls startRideProgram.
 * Services return true and keep their original dispatch behavior. */
export function tickOperations(b: Building, dt: number, ready: boolean): boolean {
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
  return needsOperator(b.kind)
    ? baseDuration * operationsOf(b).rounds +
        BOARDING_SECONDS +
        CHECKING_SECONDS +
        UNLOADING_SECONDS
    : baseDuration;
}
export function programRemaining(b: Building, baseDuration: number): number {
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
export const operatorName = (b: Building) => CREW_NAMES[Math.abs(b.id) % CREW_NAMES.length];
/** Position along the crew's gate-to-console leg, driven only by existing
 * simulation phases. Both transition endpoints meet without changing dispatch
 * timing or adding a second clock that could continue while the park is paused. */
export function operatorState(b: Building) {
  if (!needsOperator(b.kind) || !hasOperator(b)) return null;
  const phase = operatorActivity(b),
    progress = operationProgress(b),
    consoleProgress =
      phase === "checking"
        ? progress
        : phase === "running"
          ? 1
          : phase === "unloading"
            ? 1 - progress
            : 0;
  return {
    id: `operator-${b.id}`,
    buildingId: b.id,
    name: operatorName(b),
    phase,
    atGate: phase === "idle" || phase === "boarding" || phase === "unloading",
    progress,
    consoleProgress,
    walking: (phase === "checking" || phase === "unloading") && progress < 1,
  };
}
export function operationsStats(s: Pick<Park, "buildings">) {
  const rides = s.buildings.filter((b) => needsOperator(b.kind));
  const staffed = rides.filter(hasOperator).length;
  return {
    rides: rides.length,
    staffed,
    unstaffed: rides.length - staffed,
    active: rides.filter((b) => operationsOf(b).phase === "running").length,
    boarding: rides.filter((b) => ["boarding", "checking"].includes(operationsOf(b).phase)).length,
    dailyCost: staffed * OPERATOR_WAGE,
  };
}
/** Add this exactly once to the existing daily cost block; this function never charges. */
export const operatorWages = (s: Pick<Park, "buildings">) => operationsStats(s).dailyCost;
export function validOperations(s: Pick<Park, "buildings">): boolean {
  return s.buildings.every((b) => {
    const o = (b as OperatedBuilding).operations;
    if (o === undefined) return true;
    if (
      !needsOperator(b.kind) ||
      !o ||
      typeof o !== "object" ||
      typeof o.staffed !== "boolean" ||
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

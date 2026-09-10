/** Ferris-wheel boarding uses actual, persistent cabin assignments. No renderer
 * clock or array position decides which cabin a guest occupies. */
import type { Building, Park } from "./simulation";

export const WHEEL_GONDOLAS = 8;
export const WHEEL_STOP_SECONDS = 1.5;
export const WHEEL_INDEX_SECONDS = 1;
const CLEAR_SECONDS = 1.2;
const TAU = Math.PI * 2;
const STEP = TAU / WHEEL_GONDOLAS;
export type WheelPhase =
  | "idle"
  | "loading"
  | "indexing-load"
  | "running"
  | "indexing-unload"
  | "unloading"
  | "clearing";
export type WheelState = {
  version: 1;
  phase: WheelPhase;
  /** Radians; cabin i is at angle+i*TAU/8, zero is the bottom platform. */
  angle: number;
  fromAngle: number;
  targetAngle: number;
  phaseLeft: number;
  phaseDuration: number;
  currentGondola: number;
  gondolas: (number | null)[];
  programRounds: number;
  completed: boolean;
};
const labels: Record<WheelPhase, string> = {
  idle: "Bereit zum Einsteigen",
  loading: "Gäste steigen ein",
  "indexing-load": "Nächste Gondel zur Plattform",
  running: "Panoramafahrt",
  "indexing-unload": "Nächste Gondel zum Ausstieg",
  unloading: "Gäste steigen aus",
  clearing: "Ausstieg wird frei",
};
const cabinAt = (angle: number) =>
  ((-Math.round(angle / STEP) % WHEEL_GONDOLAS) + WHEEL_GONDOLAS) % WHEEL_GONDOLAS;
const moving = (phase: WheelPhase) =>
  phase === "running" || phase === "indexing-load" || phase === "indexing-unload";
const smooth = (p: number) => p * p * (3 - 2 * p);
/** Integral of a short acceleration/cruise/braking profile. It travels exactly
 * the selected turns and reaches both platform stops with zero angular speed. */
function travel(p: number, duration: number) {
  const ramp = Math.min(0.2, 1.2 / Math.max(0.001, duration));
  const normal = 1 - ramp;
  if (p < ramp) return { position: (p * p) / (2 * ramp * normal), speed: p / ramp / normal };
  if (p > 1 - ramp)
    return { position: 1 - (1 - p) ** 2 / (2 * ramp * normal), speed: (1 - p) / ramp / normal };
  return { position: (p - ramp / 2) / normal, speed: 1 / normal };
}
function legacyState(b: Building, baseDuration = 24): WheelState {
  const remaining = Math.max(1, b.operations?.remainingRounds ?? 1);
  const occupied = b.riders.length > 0;
  const duration = occupied ? Math.max(0.001, b.cycle) + (remaining - 1) * baseDuration : 0;
  return {
    version: 1,
    phase: occupied ? "running" : "idle",
    angle: 0,
    fromAngle: 0,
    targetAngle: occupied ? (duration / baseDuration) * TAU : 0,
    phaseLeft: duration,
    phaseDuration: duration,
    currentGondola: 0,
    gondolas: Array.from({ length: WHEEL_GONDOLAS }, (_, i) => b.riders[i] ?? null),
    programRounds: occupied ? remaining : 0,
    completed: false,
  };
}
export function ensureWheelState(b: Building, baseDuration = 24): WheelState {
  return (b.wheel ??= legacyState(b, baseDuration));
}
/** Call only after the caller has released all riders (relocation/demolition). */
export function resetWheelState(b: Building): void {
  if (b.kind === "wheel") delete b.wheel;
}
export function wheelVisualState(b: Building) {
  const w = b.wheel ?? legacyState(b);
  const progress = w.phaseDuration
    ? Math.max(0, Math.min(1, 1 - w.phaseLeft / w.phaseDuration))
    : 0;
  const velocity =
    moving(w.phase) && w.phaseDuration > 0
      ? ((w.targetAngle - w.fromAngle) / w.phaseDuration) *
        (w.phase === "running"
          ? travel(progress, w.phaseDuration).speed
          : 6 * progress * (1 - progress))
      : 0;
  const guestId = w.gondolas[w.currentGondola];
  const transfer =
    guestId !== null && (w.phase === "loading" || w.phase === "unloading")
      ? {
          guestId,
          gondola: w.currentGondola,
          direction: w.phase === "loading" ? ("boarding" as const) : ("alighting" as const),
          progress,
        }
      : undefined;
  return {
    angle: w.angle,
    velocity,
    gondolas: [...w.gondolas],
    phase: w.phase,
    currentGondola: w.currentGondola,
    progress,
    remainingRounds:
      w.phase === "running" ? Math.max(1, Math.ceil((w.targetAngle - w.angle - 1e-8) / TAU)) : 0,
    label: labels[w.phase],
    transfer,
  };
}
function setPhase(w: WheelState, phase: WheelPhase, duration: number, target = w.angle) {
  w.phase = phase;
  w.phaseDuration = duration;
  w.phaseLeft = duration;
  w.fromAngle = w.angle;
  w.targetAngle = target;
}
function beginRun(b: Building, w: WheelState, base: number) {
  if (!b.riders.length) {
    setPhase(w, "idle", 0);
    return;
  }
  w.programRounds = Math.max(1, Math.min(5, b.operations?.rounds ?? 1));
  w.completed = false;
  setPhase(w, "running", base * w.programRounds, w.angle + TAU * w.programRounds);
}
/** Find the next occupied cabin in the forward direction, including the one
 * already at the platform. Empty cabins do not require a pretend unload stop. */
function beginUnload(w: WheelState) {
  if (w.gondolas.every((id) => id === null)) {
    setPhase(w, "clearing", CLEAR_SECONDS);
    return;
  }
  const aligned = Math.abs(w.angle / STEP - Math.round(w.angle / STEP)) < 1e-7;
  let target = aligned ? Math.round(w.angle / STEP) * STEP : Math.ceil(w.angle / STEP) * STEP;
  for (let step = 0; step < WHEEL_GONDOLAS; step++, target += STEP) {
    const cabin = cabinAt(target);
    if (w.gondolas[cabin] === null) continue;
    w.currentGondola = cabin;
    if (Math.abs(target - w.angle) < 1e-7) setPhase(w, "unloading", WHEEL_STOP_SECONDS);
    else
      setPhase(
        w,
        "indexing-unload",
        Math.max(0.15, ((target - w.angle) / STEP) * WHEEL_INDEX_SECONDS),
        target,
      );
    return;
  }
}
function syncOperations(b: Building, w: WheelState, base: number) {
  const o = b.operations;
  if (!o) return;
  o.phase =
    w.phase === "running"
      ? "running"
      : w.phase === "loading"
        ? "boarding"
        : w.phase === "indexing-load"
          ? "checking"
          : ["unloading", "indexing-unload", "clearing"].includes(w.phase)
            ? "unloading"
            : "idle";
  o.phaseLeft =
    o.phase === "running" || o.phase === "idle"
      ? 0
      : o.phase === "checking"
        ? Math.min(1.5, w.phaseLeft)
        : Math.min(o.phase === "boarding" ? 2 : 1.2, w.phaseLeft);
  o.remainingRounds =
    w.phase === "running" ? Math.max(1, Math.ceil((w.phaseLeft - 1e-8) / base)) : 0;
  b.cycle =
    w.phase === "running"
      ? Math.max(0, w.phaseLeft - Math.max(0, o.remainingRounds - 1) * base)
      : 0;
}
export type WheelTickContext = {
  ready: boolean;
  exitClear: boolean;
  baseDuration: number;
  /** Consume at most one affordable queued guest, charge once, return their id. */
  board: () => number | null;
  /** Release exactly this guest and award the completed ride at most once. */
  release: (guestId: number, completed: boolean) => void;
};
function beginLoad(b: Building, w: WheelState, context: WheelTickContext) {
  const id = context.ready && context.exitClear ? context.board() : null;
  if (id === null) {
    beginRun(b, w, context.baseDuration);
    return;
  }
  w.gondolas[w.currentGondola] = id;
  setPhase(w, "loading", WHEEL_STOP_SECONDS);
}
export function tickWheel(b: Building, dt: number, context: WheelTickContext): void {
  if (b.kind !== "wheel" || !Number.isFinite(dt) || dt <= 0) return;
  const w = ensureWheelState(b, context.baseDuration);
  // Structural edits may explicitly clear all guests; never resurrect a seat id.
  w.gondolas = w.gondolas.map((id) => (id !== null && b.riders.includes(id) ? id : null));
  if (!context.ready && !["unloading", "indexing-unload", "clearing"].includes(w.phase)) {
    if (b.riders.length) {
      w.completed = false;
      beginUnload(w);
    } else setPhase(w, "idle", 0);
  }
  let left = dt;
  for (let transitions = 0; transitions < 64 && left > 1e-9; transitions++) {
    if (w.phase === "idle") {
      if (!context.ready || !context.exitClear || !b.queue.length) break;
      w.currentGondola = cabinAt(w.angle);
      w.programRounds = 0;
      beginLoad(b, w, context);
      if (w.phase === "idle") break;
    }
    if (w.phase === "clearing" && w.phaseLeft <= 0) {
      if (!context.exitClear) break;
      setPhase(w, "idle", 0);
      continue;
    }
    const used = Math.min(left, w.phaseLeft);
    left -= used;
    w.phaseLeft = Math.max(0, w.phaseLeft - used);
    if (moving(w.phase)) {
      const p = w.phaseDuration ? 1 - w.phaseLeft / w.phaseDuration : 1;
      w.angle =
        w.fromAngle +
        (w.targetAngle - w.fromAngle) *
          (w.phase === "running" ? travel(p, w.phaseDuration).position : smooth(p));
    }
    if (w.phaseLeft > 1e-9) break;
    w.phaseLeft = 0;
    switch (w.phase) {
      case "loading": {
        if (!b.queue.length || b.riders.length >= WHEEL_GONDOLAS)
          beginRun(b, w, context.baseDuration);
        else {
          const target = w.angle + STEP;
          w.currentGondola = cabinAt(target);
          setPhase(w, "indexing-load", WHEEL_INDEX_SECONDS, target);
        }
        break;
      }
      case "indexing-load":
        beginLoad(b, w, context);
        break;
      case "running":
        w.completed = true;
        beginUnload(w);
        break;
      case "indexing-unload":
        setPhase(w, "unloading", WHEEL_STOP_SECONDS);
        break;
      case "unloading": {
        const id = w.gondolas[w.currentGondola];
        if (id !== null) context.release(id, w.completed);
        b.riders = b.riders.filter((guest) => guest !== id);
        w.gondolas[w.currentGondola] = null;
        beginUnload(w);
        // Physical exit routes advance later in this simulation step. Do not
        // let a stale exitClear=true board again in a large direct helper tick.
        if (!b.riders.length) left = 0;
        break;
      }
      case "clearing":
        if (context.exitClear) setPhase(w, "idle", 0);
        else left = 0;
        break;
    }
  }
  syncOperations(b, w, context.baseDuration);
}
/** Conservative full-load estimate, with no change to the ride's revolution time. */
export const wheelProgramDuration = (rounds: number, base: number) =>
  base * rounds +
  WHEEL_GONDOLAS * WHEEL_STOP_SECONDS * 2 +
  (WHEEL_GONDOLAS - 1) * WHEEL_INDEX_SECONDS * 2 +
  CLEAR_SECONDS;
export function wheelProgramRemaining(b: Building, base: number): number {
  const w = b.wheel;
  if (!w) return Math.max(0, b.cycle);
  const occupied = w.gondolas.filter((id) => id !== null).length;
  const unload = occupied * (WHEEL_STOP_SECONDS + WHEEL_INDEX_SECONDS) + CLEAR_SECONDS;
  if (w.phase === "running") return w.phaseLeft + unload;
  if (w.phase === "loading" || w.phase === "indexing-load")
    return (
      w.phaseLeft +
      Math.min(b.queue.length, WHEEL_GONDOLAS - occupied) *
        (WHEEL_STOP_SECONDS + WHEEL_INDEX_SECONDS) +
      base * (b.operations?.rounds ?? 1) +
      unload
    );
  if (w.phase === "clearing") return w.phaseLeft;
  return w.phaseLeft + unload;
}
export function validWheelStates(s: Pick<Park, "buildings" | "guests">): boolean {
  return s.buildings.every((b) => {
    const w = b.wheel;
    if (w === undefined) return true;
    if (
      b.kind !== "wheel" ||
      !w ||
      w.version !== 1 ||
      !Object.hasOwn(labels, w.phase) ||
      ![w.angle, w.fromAngle, w.targetAngle, w.phaseLeft, w.phaseDuration].every(Number.isFinite) ||
      w.phaseLeft < 0 ||
      w.phaseDuration < 0 ||
      w.phaseLeft > w.phaseDuration + 1e-7 ||
      w.targetAngle < w.fromAngle ||
      w.angle < w.fromAngle - 1e-7 ||
      w.angle > w.targetAngle + 1e-7 ||
      !Number.isInteger(w.currentGondola) ||
      w.currentGondola < 0 ||
      w.currentGondola >= WHEEL_GONDOLAS ||
      !Number.isInteger(w.programRounds) ||
      w.programRounds < 0 ||
      w.programRounds > 5 ||
      typeof w.completed !== "boolean" ||
      !Array.isArray(w.gondolas) ||
      w.gondolas.length !== WHEEL_GONDOLAS
    )
      return false;
    const seats = w.gondolas.filter((id) => id !== null);
    if (
      seats.some(
        (id) =>
          !Number.isSafeInteger(id) ||
          !b.riders.includes(id!) ||
          !s.guests.some((g) => g.id === id && g.state === "ride" && g.target === b.id),
      ) ||
      new Set(seats).size !== seats.length ||
      b.riders.length !== seats.length
    )
      return false;
    if (w.phase === "running" && (!seats.length || w.programRounds < 1 || w.completed))
      return false;
    if (["idle", "clearing"].includes(w.phase) && seats.length) return false;
    return true;
  });
}

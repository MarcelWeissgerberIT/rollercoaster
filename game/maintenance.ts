import type { Building, Park, Point } from "./simulation";
import { spendCash } from "./budget";
import { pathRoute, PARK_ENTRANCE } from "./grid";
import { podPort } from "./pods";
import { walkTile, heightAccess, walkNodes, walkKey, terrainHeight } from "./terrain";
import { recordFinance } from "./finance";

export const MECHANIC_WAGE = 65;
export const INSPECTION_INTERVALS = [90, 180, 360] as const;
export type RideMaintenance = {
  interval: number;
  lastInspection: number;
  request?: "inspect" | "repair";
  fault?: "restraints" | "brakes" | "motor";
  paid?: number;
  resumeOpen?: boolean;
  completed?: number;
  workerId?: number;
};
export type Mechanic = Point & {
  id: number;
  name: string;
  qualification: "Fahrgeschäfttechnik";
  assignment: number | null;
  targetId: number | null;
  mode: "idle" | "walk" | "inspect" | "repair";
  route: Point[];
  workLeft: number;
  workTotal: number;
  walked: number;
  heading: number;
  retry: number;
  completed: number;
};
export type MaintenanceState = { version: 1; nextId: number; workers: Mechanic[] };
type Catalogue = Record<string, { size: number; cost: number }>;
const names = ["Robin", "Yasmin", "Theo", "Kira", "Luis", "Samira", "Paul", "Nika"];
export const mechanical = (b: Building) =>
  [
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
    "rapids",
    "train",
    "shuttle",
  ].includes(b.kind);
export const condition = (b: Building) => b.condition ?? 100;
export const broken = (b: Building) =>
  mechanical(b) && (condition(b) < 25 || !!b.maintenance?.fault);
export const maintenanceUnavailable = (b: Building) =>
  b.maintenance?.request === "repair" || !!b.maintenance?.workerId;
export const FAULT_LABELS = {
  restraints: "Sicherheitsbügel prüfen",
  brakes: "Bremsanlage prüfen",
  motor: "Antrieb prüfen",
};
export function initMaintenance(s: Park) {
  s.maintenance ??= { version: 1, nextId: 1, workers: [] };
  for (const b of s.buildings)
    if (mechanical(b)) b.maintenance ??= { interval: 180, lastInspection: s.time };
  return s.maintenance;
}
export function maintenanceScore(s: Park) {
  const rides = s.buildings.filter(mechanical);
  return rides.length
    ? Math.round(rides.reduce((n, b) => n + condition(b), 0) / rides.length)
    : 100;
}
export const mechanicWages = (s: Park) => (s.maintenance?.workers.length ?? 0) * MECHANIC_WAGE;
export function hireMechanic(s: Park): string | null {
  const state = initMaintenance(s);
  if (state.workers.length >= 8) return "Höchstens acht Mechaniker sind möglich.";
  const id = state.nextId++;
  state.workers.push({
    ...PARK_ENTRANCE,
    id,
    name: names[(id - 1) % names.length],
    qualification: "Fahrgeschäfttechnik",
    assignment: null,
    targetId: null,
    mode: "idle",
    route: [],
    workLeft: 0,
    workTotal: 0,
    walked: 0,
    heading: -Math.PI / 2,
    retry: 0,
    completed: 0,
  });
  return null;
}
export function dismissMechanic(s: Park, id: number): string | null {
  const state = initMaintenance(s),
    worker = state.workers.find((w) => w.id === id);
  if (!worker) return "Dieser Mitarbeiter ist nicht mehr im Park.";
  if (worker.mode === "repair" || worker.mode === "inspect")
    return "Lass den laufenden Einsatz zuerst abschließen.";
  state.workers = state.workers.filter((w) => w.id !== id);
  return null;
}
export function assignMechanic(s: Park, id: number, buildingId: number | null): string | null {
  const worker = initMaintenance(s).workers.find((w) => w.id === id);
  if (
    !worker ||
    (buildingId !== null && !s.buildings.some((b) => b.id === buildingId && mechanical(b)))
  )
    return "Wähle einen Mechaniker und ein Fahrgeschäft.";
  if (worker.mode === "repair" || worker.mode === "inspect")
    return "Der laufende Einsatz muss zuerst abgeschlossen werden.";
  worker.assignment = buildingId;
  worker.targetId = null;
  worker.route = [];
  worker.mode = "idle";
  worker.retry = 0;
  return null;
}
export function setInspectionInterval(s: Park, b: Building, seconds: number): string | null {
  if (
    !s.buildings.includes(b) ||
    !mechanical(b) ||
    !INSPECTION_INTERVALS.some((n) => n === seconds)
  )
    return "Wähle 90, 180 oder 360 Sekunden.";
  initMaintenance(s);
  b.maintenance!.interval = seconds;
  return null;
}
export function requestInspection(s: Park, b: Building): string | null {
  if (!s.buildings.includes(b) || !mechanical(b)) return "Wähle ein Fahrgeschäft.";
  initMaintenance(s);
  if (b.maintenance!.request) return "Für diese Attraktion läuft bereits ein Wartungsauftrag.";
  b.maintenance!.request = "inspect";
  return null;
}
export function repairCost(b: Building, baseCost: number) {
  return condition(b) >= 100 && !b.maintenance?.fault
    ? 0
    : Math.max(45, Math.ceil((baseCost * 0.12 * (100 - condition(b))) / 100));
}
export function repairAttraction(s: Park, b: Building, baseCost: number): string | null {
  if (!s.buildings.includes(b) || !mechanical(b)) return "Wähle ein Fahrgeschäft zum Reparieren.";
  initMaintenance(s);
  if (b.maintenance!.request === "repair")
    return "Der Reparaturauftrag wartet bereits auf einen Mechaniker.";
  const cost = repairCost(b, baseCost);
  if (!cost) return "Diese Attraktion ist bereits in gutem Zustand.";
  if (!spendCash(s, cost)) return "Für die Reparatur reicht das Parkbudget nicht.";
  s.expenses += cost;
  s.dayExpenses += cost;
  s.operatingExpensesToday = (s.operatingExpensesToday ?? 0) + cost;
  recordFinance(s, "maintenance", cost);
  b.maintenance!.request = "repair";
  b.maintenance!.paid = cost;
  return null;
}
function release(w: Mechanic) {
  w.targetId = null;
  w.route = [];
  w.mode = "idle";
  w.workLeft = 0;
  w.workTotal = 0;
  w.retry = 2;
}
export function mechanicServicePoint(s: Park, b: Building, catalogue: Catalogue): Point | null {
  if (!catalogue[b.kind]) return null;
  const size = catalogue[b.kind].size;
  const points = b.pods?.entry
    ? [podPort(b, size, b.pods.entry)]
    : Array.from({ length: size }, (_, i) => [
        { x: b.x + i, y: b.y - 1 },
        { x: b.x + i, y: b.y + size },
        { x: b.x - 1, y: b.y + i },
        { x: b.x + size, y: b.y + i },
      ]).flat();
  return (
    heightAccess(s, points, b.z ?? terrainHeight(s, b.x, b.y), new Set(walkNodes(s).keys()), [
      "path",
      "queue",
      "exit",
    ])[0] ?? null
  );
}
export function tickMaintenance(s: Park, dt: number, catalogue: Catalogue) {
  const state = initMaintenance(s);
  for (const b of s.buildings) {
    if (!mechanical(b)) continue;
    const m = b.maintenance!;
    if (m.workerId && !state.workers.some((w) => w.id === m.workerId && w.targetId === b.id))
      m.workerId = undefined;
    if (b.open && b.riders.length) b.condition = Math.max(0, condition(b) - dt / 180);
    if (condition(b) < 25) m.fault ??= (["restraints", "brakes", "motor"] as const)[b.id % 3];
    // Scheduled checks never invent failures; the real wear and service history decide.
    if (!m.request && !broken(b) && s.time - m.lastInspection >= m.interval) m.request = "inspect";
    if (broken(b)) {
      b.open = false;
      b.autoOpen = false;
      b.testing = undefined;
    }
  }
  for (const w of state.workers) {
    if (w.assignment !== null && !s.buildings.some((b) => b.id === w.assignment))
      w.assignment = null;
    const target = s.buildings.find((b) => b.id === w.targetId);
    if (w.targetId !== null && (!target || !target.maintenance?.request)) release(w);
    if (w.mode === "walk") {
      const destination = target && mechanicServicePoint(s, target, catalogue);
      const last = w.route.at(-1);
      if (
        !destination ||
        (last && walkKey(s, last) !== walkKey(s, destination)) ||
        w.route.some((p) => !["path", "queue", "exit"].includes(walkTile(s, p) ?? ""))
      ) {
        release(w);
        continue;
      }
      const next = w.route[0];
      if (!next) {
        w.mode = "idle";
      } else {
        const distance = Math.hypot(next.x - w.x, next.y - w.y, (next.z ?? 0) - (w.z ?? 0)),
          move = Math.min(distance, dt * 0.8);
        if (distance > 1e-8) {
          w.heading = Math.atan2(next.y - w.y, next.x - w.x);
          w.x += ((next.x - w.x) / distance) * move;
          w.y += ((next.y - w.y) / distance) * move;
          w.z = (w.z ?? 0) + (((next.z ?? 0) - (w.z ?? 0)) / distance) * move;
          w.walked += move;
        }
        if (move >= distance) {
          w.x = next.x;
          w.y = next.y;
          w.z = next.z ?? 0;
          w.route.shift();
        }
        if (!w.route.length) w.mode = "idle";
        continue;
      }
    }
    if (target && target.maintenance?.request && w.targetId !== null) {
      const servicePoint = mechanicServicePoint(s, target, catalogue);
      if (
        !servicePoint ||
        Math.hypot(w.x - servicePoint.x, w.y - servicePoint.y, (w.z ?? 0) - (servicePoint.z ?? 0)) >
          0.1
      ) {
        target.maintenance.workerId = undefined;
        release(w);
        continue;
      }
      if (target.riders.length) continue; // Always let all occupied cabins / trains unload.
      const m = target.maintenance;
      if (w.mode === "idle") {
        m.resumeOpen ??= target.open;
        w.mode = m.request!;
        w.workTotal = w.mode === "repair" ? 9 + (100 - condition(target)) * 0.15 : 6;
        w.workLeft = w.workTotal;
        w.heading = Math.atan2(target.y - w.y, target.x - w.x);
      }
      w.workLeft = Math.max(0, w.workLeft - dt);
      if (w.workLeft === 0) {
        if (w.mode === "repair") {
          target.condition = 100;
          m.fault = undefined;
          m.paid = undefined;
        } else target.condition = Math.min(100, condition(target) + 5);
        m.lastInspection = s.time;
        m.completed = (m.completed ?? 0) + 1;
        m.request = undefined;
        m.workerId = undefined;
        if (m.resumeOpen && !broken(target)) target.open = true;
        m.resumeOpen = undefined;
        w.completed++;
        release(w);
      }
      continue;
    }
    w.retry -= dt;
    if (w.retry > 0) continue;
    w.retry = 4;
    const jobs = s.buildings
      .filter(
        (b) =>
          b.maintenance?.request &&
          (w.assignment === null || w.assignment === b.id) &&
          !state.workers.some((other) => other.id !== w.id && other.targetId === b.id),
      )
      .sort(
        (a, b) =>
          Number(b.maintenance?.request === "repair") -
            Number(a.maintenance?.request === "repair") ||
          a.maintenance!.lastInspection - b.maintenance!.lastInspection ||
          a.id - b.id,
      );
    for (const b of jobs) {
      const point = mechanicServicePoint(s, b, catalogue);
      if (!point) continue;
      const route = pathRoute(s, w, point, true);
      if (!route.length) continue;
      w.targetId = b.id;
      b.maintenance!.workerId = w.id;
      w.route = route.slice(1);
      w.mode = w.route.length ? "walk" : "idle";
      break;
    }
  }
}
export function maintenanceStatus(s: Park, b: Building) {
  const m = b.maintenance,
    worker = s.maintenance?.workers.find((w) => w.targetId === b.id);
  if (worker)
    return `${worker.name}: ${worker.mode === "walk" ? "unterwegs" : worker.mode === "repair" ? "repariert" : worker.mode === "inspect" ? "prüft die Anlage" : "wartet auf das Ende der Fahrt"}`;
  if (m?.request)
    return !s.maintenance?.workers.length
      ? "Auftrag wartet – stelle einen Mechaniker ein."
      : "Auftrag wartet auf erreichbaren, zuständigen Mechaniker.";
  if (m?.fault) return FAULT_LABELS[m.fault];
  return `Nächste Inspektion in ${Math.max(0, Math.ceil((m?.interval ?? 180) - (s.time - (m?.lastInspection ?? s.time))))} s`;
}
export function validMaintenance(s: Park): boolean {
  const state = s.maintenance;
  const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  if (
    state !== undefined &&
    (!state ||
      state.version !== 1 ||
      !Number.isSafeInteger(state.nextId) ||
      !Array.isArray(state.workers) ||
      state.workers.length > 8 ||
      new Set(state.workers.map((w) => w.id)).size !== state.workers.length ||
      !state.workers.every(
        (w) =>
          w &&
          Number.isSafeInteger(w.id) &&
          w.id > 0 &&
          w.id < state.nextId &&
          typeof w.name === "string" &&
          w.name.length < 60 &&
          w.qualification === "Fahrgeschäfttechnik" &&
          ["idle", "walk", "inspect", "repair"].includes(w.mode) &&
          [w.x, w.y, w.workLeft, w.workTotal, w.walked, w.completed].every(finite) &&
          Number.isFinite(w.z ?? 0) &&
          (w.z ?? 0) >= -4 &&
          (w.z ?? 0) <= 11 &&
          Number.isFinite(w.heading) &&
          Number.isFinite(w.retry) &&
          (w.assignment === null || Number.isSafeInteger(w.assignment)) &&
          (w.targetId === null || Number.isSafeInteger(w.targetId)) &&
          Array.isArray(w.route) &&
          w.route.length < 10000 &&
          w.route.every(
            (p) =>
              p &&
              [p.x, p.y].every(finite) &&
              Number.isFinite(p.z ?? 0) &&
              (p.z ?? 0) >= -4 &&
              (p.z ?? 0) <= 11,
          ),
      ))
  )
    return false;
  return s.buildings.every(
    (b) =>
      !b.maintenance ||
      (mechanical(b) &&
        INSPECTION_INTERVALS.some((i) => i === b.maintenance!.interval) &&
        finite(b.maintenance.lastInspection) &&
        (b.maintenance.request === undefined ||
          ["inspect", "repair"].includes(b.maintenance.request)) &&
        (b.maintenance.fault === undefined || Object.hasOwn(FAULT_LABELS, b.maintenance.fault)) &&
        (b.maintenance.paid === undefined || finite(b.maintenance.paid)) &&
        (b.maintenance.resumeOpen === undefined || typeof b.maintenance.resumeOpen === "boolean")),
  );
}

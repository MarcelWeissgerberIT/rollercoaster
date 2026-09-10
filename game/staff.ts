/** One read-only position/action source for employee cards, camera focus and both
 * renderers. No snapshot poses, random animation clocks or synthetic employees. */
import { CATALOG, effectivePods, type Park, type Point } from "./simulation";
import { operatorState } from "./operations";
import { podPose } from "./pods";
import { SPECIALIST_ROLES, type Keeper } from "./zoo";
import { cleanerServicePose } from "./cleanliness";

export type StaffRef = { kind: "cleaner" | "keeper" | "operator"; id: number };
export type StaffActivity =
  | "idle"
  | "patrol"
  | "walk"
  | "feed"
  | "water"
  | "clean"
  | "repair"
  | "sweep"
  | "empty"
  | "deposit"
  | "boarding"
  | "checking"
  | "control"
  | "unloading";
export type StaffLocation = Point & {
  name: string;
  role: string;
  activity: StaffActivity;
  label: string;
  progress: number;
  walking: boolean;
  dx: number;
  dy: number;
  targetId: number | null;
  carrying: "none" | "feed" | "bucket" | "tools" | "broom" | "waste";
  distanceWalked: number;
  carried: number;
  gate?: Point;
  control?: Point;
};
const keeperNames = [
  "Mila",
  "Emil",
  "Jasmin",
  "Noah",
  "Clara",
  "Samir",
  "Leni",
  "Finn",
  "Nora",
  "Elias",
  "Lara",
  "Kian",
];
const cleanerNames = ["Alex", "Jule", "Ben", "Maya", "Toni", "Nele", "Oskar", "Elif"];
const clamp = (n: number) => Math.max(0, Math.min(1, n));
function direction(from: Point & { heading?: number }, to?: Point | null) {
  const dx = to ? to.x - from.x : 0,
    dy = to ? to.y - from.y : 0,
    length = Math.hypot(dx, dy);
  return length > 1e-7
    ? { dx: dx / length, dy: dy / length }
    : { dx: Math.cos(from.heading ?? Math.PI / 2), dy: Math.sin(from.heading ?? Math.PI / 2) };
}
function employeeName(kind: "keeper" | "cleaner", id: number) {
  const names = kind === "keeper" ? keeperNames : cleanerNames;
  return `${names[Math.abs(id - 1) % names.length]} · #${id}`;
}
function keeperLocation(s: Park, w: Keeper): StaffLocation {
  const target = s.buildings.find((b) => b.id === w.targetId),
    walking = w.route.length > 0 && (w.mode === "walk" || w.mode === "patrol"),
    progress =
      w.mode === "care"
        ? clamp(
            1 -
              w.workLeft / Math.max(0.001, w.workTotal ?? 4 + (target?.habitat?.count ?? 0) * 0.6),
          )
        : 0,
    activity: StaffActivity =
      w.mode === "care"
        ? w.role === "technical"
          ? "repair"
          : progress < 1 / 3
            ? "feed"
            : progress < 2 / 3
              ? "water"
              : "clean"
        : w.mode,
    labels: Partial<Record<StaffActivity, string>> = {
      idle: "Bereit für einen Auftrag",
      patrol: "Kontrollrunde auf den Parkwegen",
      walk: "Unterwegs zum Einsatz",
      feed: "Füttert die Tiere",
      water: "Versorgt die Wasserstelle",
      clean: "Reinigt den Pflegebereich",
      repair: "Prüft und wartet die Sicherung",
    },
    goal =
      w.mode === "care" && target
        ? {
            x: target.x + (CATALOG[target.kind].size - 1) / 2,
            y: target.y + (CATALOG[target.kind].size - 1) / 2,
          }
        : w.route[0];
  return {
    x: w.x,
    y: w.y,
    name: employeeName("keeper", w.id),
    role: w.role ? SPECIALIST_ROLES[w.role].label : "Basis-Tierpflege",
    activity,
    label: `${labels[activity] ?? "Bereit"}${target ? ` · ${target.name}` : ""}`,
    progress,
    walking,
    ...direction(w, goal),
    targetId: target?.id ?? null,
    carrying:
      activity === "patrol" || activity === "idle"
        ? "none"
        : w.role === "technical"
          ? "tools"
          : activity === "water" || activity === "clean"
            ? "bucket"
            : "feed",
    distanceWalked: w.walked ?? 0,
    carried: 0,
  };
}

export function staffLocation(s: Park, ref: StaffRef): StaffLocation | null {
  if (ref.kind === "keeper") {
    const w = s.zoo?.workers.find((w) => w.id === ref.id);
    return w ? keeperLocation(s, w) : null;
  }
  if (ref.kind === "cleaner") {
    const w = s.cleanliness?.workers.find((w) => w.id === ref.id);
    if (!w) return null;
    const pose = cleanerServicePose(s, w),
      activity = w.mode,
      label =
        activity === "patrol"
          ? "Kontrollrunde auf den Parkwegen"
          : activity === "walk"
            ? w.toCollection
              ? "Bringt Müll zur Sammelstelle"
              : (w.carried ?? 0) > 0
                ? "Bringt Müll zur Tonne"
                : "Unterwegs zum Auftrag"
            : activity === "sweep"
              ? "Sammelt Müll auf"
              : activity === "empty"
                ? "Wechselt den Müllbeutel"
                : activity === "deposit"
                  ? "Entsorgt gesammelten Müll"
                  : "Bereit für einen Auftrag";
    return {
      ...pose,
      name: employeeName("cleaner", w.id),
      role: "Parkreinigung",
      activity,
      label,
      targetId: w.target?.id ?? null,
      carrying: (w.carried ?? 0) > 0 ? "waste" : "broom",
      carried: w.carried ?? 0,
    };
  }
  if (ref.kind !== "operator") return null;
  const b = s.buildings.find((b) => b.id === ref.id),
    state = b && operatorState(b);
  if (!b || !state) return null;
  const pod = podPose(b, CATALOG[b.kind].size, b.pods?.entry ?? effectivePods(s, b).entry),
    gate = { x: pod.x - pod.dy * 0.23, y: pod.y + pod.dx * 0.23 },
    control = {
      x: gate.x - pod.dy * 0.32 - pod.dx * 0.06,
      y: gate.y + pod.dx * 0.32 - pod.dy * 0.06,
    },
    dx = control.x - gate.x,
    dy = control.y - gate.y,
    length = Math.hypot(dx, dy),
    activity: StaffActivity =
      state.phase === "running" ? "control" : state.phase === "off" ? "idle" : state.phase,
    label =
      activity === "control"
        ? "Bedient das Fahrgeschäft"
        : activity === "checking"
          ? "Zum Bedienpult · Sicherheitskontrolle"
          : activity === "unloading"
            ? "Zurück zum Eingang · Ausstieg begleiten"
            : activity === "boarding"
              ? "Begrüßt und lässt Gäste ein"
              : "Bereit am Eingang",
    reverse = state.phase === "unloading" ? -1 : 1;
  return {
    x: gate.x + dx * state.consoleProgress,
    y: gate.y + dy * state.consoleProgress,
    name: state.name,
    role: "Bedienpersonal",
    activity,
    label,
    progress: state.progress,
    walking: state.walking,
    dx: state.walking ? (dx / length) * reverse : -pod.dx,
    dy: state.walking ? (dy / length) * reverse : -pod.dy,
    targetId: b.id,
    carrying: "none",
    distanceWalked: length * (state.walking ? state.progress : state.consoleProgress),
    carried: 0,
    gate,
    control,
  };
}

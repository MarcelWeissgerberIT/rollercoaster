/** One read-only position/action source for employee cards, camera focus and both
 * renderers. No snapshot poses, random animation clocks or synthetic employees. */
import { CATALOG, type Park, type Point } from "./simulation";
import { operatorState, crewPoolOf, type OperatorPost } from "./operations";
import { accessLayout, gateMotion } from "./ride-access";
import { SPECIALIST_ROLES, type Keeper } from "./zoo";
import { cleanerServicePose } from "./cleanliness";

export type StaffRef = {
  kind: "cleaner" | "keeper" | "operator";
  id: number;
  post?: OperatorPost;
  crewId?: number;
};
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
  const buildingId =
    ref.crewId === undefined
      ? ref.id
      : crewPoolOf(s).crews.find((crew) => crew.id === ref.crewId)?.buildingId;
  if (buildingId === null || buildingId === undefined) return null;
  const b = s.buildings.find((b) => b.id === buildingId),
    post = ref.post ?? "control",
    state = b && operatorState(b, post);
  if (!b || !state) return null;
  const layout = accessLayout(s, b),
    anchor = layout.posts[post],
    gate = post === "exit" ? layout.exit : layout.entry,
    dx = gate.x - anchor.x,
    dy = gate.y - anchor.y,
    length = Math.hypot(dx, dy),
    stride = post === "control" ? 0 : 0.12,
    step = state.stepProgress * stride,
    reverse = state.returning ? -1 : 1,
    exitGate = post === "exit" ? gateMotion(s, b, "exit") : null,
    activeExit = !!exitGate?.activeGuests,
    activity: StaffActivity =
      post === "control"
        ? b.open
          ? "control"
          : "idle"
        : post === "entry" && (state.phase === "boarding" || state.phase === "checking")
          ? state.phase
          : post === "exit" && (state.phase === "unloading" || activeExit)
            ? "unloading"
            : "idle",
    label =
      activity === "control"
        ? "Bedient das Fahrgeschäft am Pult"
        : activity === "checking"
          ? "Prüft den Einlass und die Sicherung"
          : activity === "unloading"
            ? "Begleitet Gäste am Ausstieg"
            : activity === "boarding"
              ? "Begrüßt und lässt Gäste ein"
              : post === "control"
                ? "Bereit in der Fahrerkabine"
                : post === "entry"
                  ? "Bereit am Einlass"
                  : "Bereit am Ausstieg";
  return {
    x: anchor.x + (length ? dx / length : 0) * step,
    y: anchor.y + (length ? dy / length : 0) * step,
    name: state.name,
    role: state.role,
    activity,
    label,
    progress: activeExit && state.phase !== "unloading" ? 1 - exitGate!.open : state.progress,
    walking: state.walking,
    dx: state.walking && length ? (dx / length) * reverse : anchor.dx,
    dy: state.walking && length ? (dy / length) * reverse : anchor.dy,
    targetId: b.id,
    carrying: "none",
    distanceWalked: stride * (state.returning ? 2 - state.stepProgress : state.stepProgress),
    carried: 0,
    gate,
    control: { x: layout.posts.control.x, y: layout.posts.control.y },
  };
}

import { CATALOG, spend, type Building, type Park, type Point } from "./simulation";
import {
  planConnection,
  planPod,
  releaseBuildingGuests,
  type AdjustmentPlan,
  type Geometry,
} from "./construction";
import { editableTrack } from "./track-edit";
import { prepareRoute } from "./motion";
import { effectivePods } from "./simulation";
import { rotatePods } from "./pods";

const TAU = Math.PI * 2;
const normalize = (a: number) => ((a % TAU) + TAU) % TAU;
const samePosition = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0)) < 1e-8;
export const stationSource = (b: Building) => JSON.stringify([b.id, b.x, b.y, b.track, b.pods]);
export type StationReverseOptions = { rotatePods?: boolean; clear?: boolean };
export type StationReversePlan = AdjustmentPlan & {
  id: number;
  source: string;
  options: { rotatePods: boolean; clear: boolean };
};

/** Keep the actual physical station point fixed, including fractional legacy anchors.
 * Input metadata: drive belongs to the outgoing edge; inversion belongs to the incoming edge.
 * There is no sign reversal of a boost/brake: the same module acts in the new travel direction. */
export function reverseTrackAtStation(b: Building): Point[] {
  const dense = editableTrack(b);
  if (dense.length < 9 || !samePosition(dense[0], dense.at(-1)!))
    throw new Error("Nur eine vollständig geschlossene Bahn kann die Fahrtrichtung wechseln.");
  if (dense.length > 2048)
    throw new Error(
      "Diese alte Bahn benötigt zu viele Detailpunkte. Teile die Strecke zuerst in kleinere bearbeitbare Abschnitte auf.",
    );
  const n = dense.length - 1;
  const ring = Array.from({ length: n }, (_, i) => {
    const j = (n - i) % n,
      p = dense[j],
      predecessor = dense[(j + n - 1) % n],
      successor = dense[j + 1];
    const next = {
      ...p,
      heading: normalize(
        (p.heading ?? Math.atan2(successor.y - predecessor.y, successor.x - predecessor.x)) +
          Math.PI,
      ),
      // Old predecessor -> p becomes p -> old predecessor.
      drive: predecessor.drive ? { ...predecessor.drive } : undefined,
      // Old p -> successor becomes successor -> p.
      inversion: successor.inversion,
    };
    return next;
  });
  return [...ring, { ...ring[0], drive: ring[0].drive ? { ...ring[0].drive } : undefined }];
}
export function planStationReverse(
  s: Park,
  b: Building,
  options: StationReverseOptions = {},
): StationReversePlan {
  const settings = { rotatePods: options.rotatePods ?? false, clear: options.clear ?? true };
  const geometry: Geometry = {
    x: b.x,
    y: b.y,
    track: b.track ? structuredClone(b.track) : undefined,
    pods: b.pods ? structuredClone(b.pods) : undefined,
    tested: false,
  };
  const plan: StationReversePlan = {
    id: b.id,
    source: stationSource(b),
    options: settings,
    geometry,
    points: [],
    clearIds: [],
    cost: 0,
    error: null,
    changed: false,
    connection: null,
  };
  if (!s.buildings.some((item) => item.id === b.id) || b.kind !== "coaster" || !b.track)
    return { ...plan, error: "Wähle eine bestehende Achterbahn." };
  if (s.trackEdit || s.draft)
    return {
      ...plan,
      error: "Beende zuerst die offene Baustelle, bevor du die Fahrtrichtung änderst.",
    };
  try {
    geometry.track = reverseTrackAtStation(b);
  } catch (error) {
    return {
      ...plan,
      error:
        error instanceof Error ? error.message : "Die Fahrtrichtung konnte nicht berechnet werden.",
    };
  }
  // Reordering the same edges cannot create terrain collisions or self-crossings.
  // Do not rerun quadratic self-clearance on unchanged geometry (legacy tracks included).
  if (settings.rotatePods) geometry.pods = rotatePods(effectivePods(s, b), CATALOG[b.kind].size, 2);
  const moved = { ...b, ...geometry };
  let virtual: Park = {
    ...s,
    buildings: s.buildings.map((item) => (item.id === b.id ? moved : item)),
  };
  if (settings.rotatePods && geometry.pods) {
    for (const role of ["entry", "exit"] as const) {
      const pod = planPod(virtual, moved, role, geometry.pods[role], settings.clear);
      if (pod.error)
        return {
          ...plan,
          error: `${role === "entry" ? "Eingang" : "Ausgang"} kann nicht mitgedreht werden: ${pod.error} Behalte die Anschlüsse an ihren bisherigen Wegen.`,
        };
      for (const id of pod.clearIds) if (!plan.clearIds.includes(id)) plan.clearIds.push(id);
      plan.cost = plan.clearIds.length * 10;
      virtual = {
        ...virtual,
        cash: s.cash - plan.cost,
        buildings: virtual.buildings.filter((item) => !plan.clearIds.includes(item.id)),
      };
    }
  }
  if (plan.cost > 0 && plan.cost > s.cash)
    return { ...plan, error: "Das Budget reicht zum Freiräumen der gedrehten Anschlüsse nicht." };
  plan.changed = true;
  plan.connection = planConnection(virtual, moved, settings.clear);
  plan.warning = settings.rotatePods
    ? "Fahrtrichtung und Anschlüsse werden umgekehrt. Prüfe die Wege und starte danach eine neue Testfahrt."
    : "Die Bahn fährt die gleiche Strecke in Gegenrichtung. Die vorhandenen Ein- und Ausgangswege bleiben nutzbar. Eine neue Testfahrt ist erforderlich.";
  return plan;
}

/** Live preflight; no world, guest or finance mutation on rejected/obsolete plans. Wrap in recordEdit/edit for one existing geometry undo. */
export function commitStationReverse(s: Park, plan: StationReversePlan): string | null {
  const b = s.buildings.find((item) => item.id === plan.id);
  if (!b || stationSource(b) !== plan.source)
    return "Die Station oder Bahn hat sich geändert. Berechne die Drehung erneut.";
  const current = planStationReverse(s, b, plan.options);
  if (current.error) return current.error;
  if (
    current.cost !== plan.cost ||
    JSON.stringify([...current.clearIds].sort()) !== JSON.stringify([...plan.clearIds].sort()) ||
    JSON.stringify(current.geometry) !== JSON.stringify(plan.geometry)
  )
    return "Die Umgebung oder Bauvorschau hat sich geändert. Prüfe die Drehung erneut.";
  if (!current.changed) return null;
  if (current.cost && !spend(s, current.cost)) return "Das Budget reicht zum Freiräumen nicht.";
  releaseBuildingGuests(s, b);
  s.buildings = s.buildings.filter((item) => !current.clearIds.includes(item.id));
  Object.assign(b, current.geometry);
  if (b.photoPoint !== undefined) b.photoPoint = 1 - b.photoPoint;
  b.tested = false;
  b.open = false;
  b.autoOpen = false;
  b.testing = undefined;
  b.testDuration = undefined;
  return null;
}

export function stationOrientation(b: Pick<Building, "track" | "x" | "y">) {
  if (!b.track?.length) return null;
  const route = prepareRoute(b.track),
    p = route.points[0],
    tangent = route.tangents[0];
  if (!p || !tangent) return null;
  const heading = normalize(Math.atan2(tangent.y, tangent.x));
  const compass = ["Ost", "Südost", "Süd", "Südwest", "West", "Nordwest", "Nord", "Nordost"];
  return {
    x: p.x,
    y: p.y,
    z: p.z ?? 0,
    heading,
    dx: Math.cos(heading),
    dy: Math.sin(heading),
    direction: compass[Math.round(heading / (Math.PI / 4)) % 8],
  };
}
/** Project the real world direction; this stays correct in every camera view.
 * Draw after the station sprite for the selected or previewed coaster. */
export function drawStationDirection(
  ctx: CanvasRenderingContext2D,
  b: Pick<Building, "track" | "x" | "y">,
  project: (x: number, y: number, z?: number) => { x: number; y: number },
  scale = 1,
  color = "#238471",
) {
  const o = stationOrientation(b);
  if (!o) return;
  const start = project(o.x + o.dx * 0.5, o.y + o.dy * 0.5, o.z + 0.22);
  const end = project(o.x + o.dx * 1.6, o.y + o.dy * 1.6, o.z + 0.22);
  const angle = Math.atan2(end.y - start.y, end.x - start.x),
    head = 8 * scale;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const stroke = () => {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.moveTo(end.x - Math.cos(angle - 0.6) * head, end.y - Math.sin(angle - 0.6) * head);
    ctx.lineTo(end.x, end.y);
    ctx.lineTo(end.x - Math.cos(angle + 0.6) * head, end.y - Math.sin(angle + 0.6) * head);
    ctx.stroke();
  };
  ctx.strokeStyle = "#fff9e6";
  ctx.lineWidth = 7 * scale;
  stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5 * scale;
  stroke();
  ctx.restore();
}

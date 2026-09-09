import type { Park, Building, Point } from "./simulation";
import { releaseBuildingGuests } from "./construction";
import { findTrackFit, type TrackFit } from "./track-fit";
import {
  beginTrackEdit,
  commitTrackEdit,
  trackEditPlan,
  editableTrack,
  trackSections,
  driveSections,
  trackDrivePlan,
  installTrackDrive,
} from "./track-edit";
import { analyzeForces, type ForceAnalysis } from "./gforce";
import type { Piece } from "./prefabs";
import type { TrackDrive } from "./drive";
export const RIDE_GOALS = {
  fun: "Mehr Fahrspaß",
  gforce: "Mehr G-Kraft",
  airtime: "Mehr Airtime",
  comfort: "Sanfter fahren",
} as const;
export type RideGoal = keyof typeof RIDE_GOALS;
export const RIDE_PROFILES = [
  { id: "airtime", name: "Airtime-Hügel", detail: "Sanfter Kamm für kurze Schwerelosigkeit" },
  { id: "bunny", name: "Bunny-Hops", detail: "Zwei schnelle Auf-und-ab-Momente" },
  { id: "helixleft", name: "Helix links", detail: "Steigende 180°-Kurve" },
  { id: "helixright", name: "Helix rechts", detail: "Steigende 180°-Kurve" },
  { id: "doubleloop", name: "Doppel-Looping", detail: "Zwei verbundene Inversionen" },
  { id: "boost", name: "Tempo-Schub", detail: "Beschleuniger auf der Auswahl" },
  { id: "brake", name: "Entspannung", detail: "Bremsen für weniger Belastung" },
] as const;
export type RideProfileId = (typeof RIDE_PROFILES)[number]["id"];
export type RideProfilePlan = {
  id: number;
  from: number;
  to: number;
  source: string;
  title: string;
  goal: RideGoal;
  track: Point[];
  removed: Point[];
  added: Point[];
  cost: number;
  before: ForceAnalysis;
  after: ForceAnalysis;
  fit?: TrackFit;
  drive?: { from: number; to: number; value: TrackDrive };
};
export type ProfileResult = { plan?: RideProfilePlan; error?: string };
export const profileSource = (b: Building) => JSON.stringify([b.id, b.x, b.y, b.track]);
const score = (a: ForceAnalysis, g: RideGoal) =>
  g === "gforce"
    ? Math.max(a.peaks.vertical, a.maxLateral)
    : g === "airtime"
      ? a.airtime
      : g === "comfort"
        ? a.comfort
        : a.fun;
export function planRideProfile(
  s: Park,
  id: number,
  from: number,
  to: number,
  goal: RideGoal,
  profile?: RideProfileId,
  clear = true,
): ProfileResult {
  const b = s.buildings.find((b) => b.id === id);
  if (!b?.track || b.kind !== "coaster" || s.trackEdit || s.draft)
    return { error: "Beende offene Baustellen und wähle einen zusammenhängenden Gleisbereich." };
  const track = editableTrack(b),
    sections = trackSections(track),
    a = sections[from]?.start,
    z = sections[to]?.end;
  if (a === undefined || z === undefined || from > to)
    return { error: "Markiere einen gültigen Streckenabschnitt." };
  const before = analyzeForces(b.track),
    source = profileSource(b);
  const candidates: RideProfilePlan[] = [];
  let reason = "";
  function offer(
    next: Point[],
    title: string,
    cost: number,
    fit?: TrackFit,
    drive?: RideProfilePlan["drive"],
  ) {
    const after = analyzeForces(next);
    if (!profile) {
      if (score(after, goal) < score(before, goal) + 0.08) return;
      // Keep automatic thrills within a tolerable game envelope; never hide measured peaks.
      if (
        goal !== "comfort" &&
        (after.peaks.vertical > Math.max(5.5, before.peaks.vertical + 0.1) ||
          after.minVertical < Math.min(-1.5, before.minVertical - 0.1) ||
          after.maxLateral > Math.max(3.5, before.maxLateral + 0.1))
      )
        return;
    }
    candidates.push({
      id,
      from,
      to,
      goal,
      source,
      title,
      track: next,
      cost,
      before,
      after,
      fit,
      drive,
      removed: fit?.removed ?? track.slice(a, z + 1),
      added: fit?.added ?? next.slice(a, z + 1),
    });
  }
  const parts: Piece[] =
    profile && !["boost", "brake"].includes(profile)
      ? [profile as Piece]
      : profile
        ? []
        : goal === "comfort"
          ? []
          : goal === "airtime"
            ? ["airtime", "bunny", "hill"]
            : goal === "gforce"
              ? ["helixleft", "helixright", "loop", "airtime"]
              : ["airtime", "bunny", "helixleft", "helixright", "loop"];
  for (const piece of parts) {
    const copy = structuredClone(s),
      live = copy.buildings.find((x) => x.id === id)!;
    const error = beginTrackEdit(copy, live, from, to);
    if (error) {
      reason = error;
      continue;
    }
    const result = findTrackFit(copy, copy.draft!.track, piece, clear);
    if (result.solution) {
      const f = result.solution;
      offer(f.track, RIDE_PROFILES.find((p) => p.id === piece)?.name ?? "Looping", f.cost, f);
    } else reason = result.error ?? reason;
  }
  if (!profile || profile === "boost" || profile === "brake") {
    const ds = driveSections(track),
      df = ds.findIndex((p) => p.start === a),
      dt = ds.findIndex((p) => p.end === z);
    const brake = profile === "brake" || (!profile && goal === "comfort");
    const speeds = brake ? [18, 28, 38] : [45, 58, 70, 82];
    for (const speed of speeds) {
      const value: TrackDrive = {
        kind: brake ? "brake" : "boost",
        speed: Math.min(
          speed,
          b.track[0]?.style === "wood" ? 68 : b.track[0]?.style === "launch" ? 93 : 82,
        ),
        strength: brake ? 3.5 : 7,
      };
      const plan = trackDrivePlan(b, df, dt, value);
      if (plan.error || !plan.changed) continue;
      offer(
        plan.track,
        `${brake ? "Entspannung" : "Tempo-Schub"} · ${value.speed} km/h`,
        plan.cost,
        undefined,
        { from: df, to: dt, value },
      );
    }
  }
  candidates.sort(
    (a, b) =>
      Number(a.cost > s.cash) - Number(b.cost > s.cash) ||
      score(b.after, goal) - score(a.after, goal) ||
      a.cost - b.cost,
  );
  return candidates.length
    ? { plan: candidates[0] }
    : {
        error: profile
          ? reason || "Dieses Profil ändert hier nichts. Wähle einen anderen Abschnitt."
          : "Hier wurde keine passende Verbesserung gefunden. Markiere einen längeren Abschnitt oder ein anderes Ziel. Deine Bahn bleibt unverändert.",
      };
}
export function commitRideProfile(s: Park, plan: RideProfilePlan, clear = true): string | null {
  const b = s.buildings.find((b) => b.id === plan.id);
  if (!b || s.trackEdit || s.draft || profileSource(b) !== plan.source)
    return "Die Bahn hat sich geändert. Berechne den Vorschlag erneut.";
  if (plan.drive) {
    const current = trackDrivePlan(b, plan.drive.from, plan.drive.to, plan.drive.value);
    if (current.error) return current.error;
    if (current.cost !== plan.cost || JSON.stringify(current.track) !== JSON.stringify(plan.track))
      return "Der Vorschlag hat sich geändert. Bitte neu berechnen.";
    return installTrackDrive(s, b, plan.drive.from, plan.drive.to, plan.drive.value);
  }
  if (!plan.fit) return "Kein gültiges Fahrprofil vorhanden.";
  const current = trackEditPlan({ ...s, trackEdit: plan.fit.edit }, plan.track, clear);
  if (current.error) return current.error;
  if (current.cost !== plan.cost)
    return "Die Baukosten haben sich geändert. Berechne den Vorschlag erneut.";
  releaseBuildingGuests(s, b);
  b.testing = undefined;
  b.testDuration = undefined;
  s.trackEdit = structuredClone(plan.fit.edit);
  return commitTrackEdit(s, plan.track, clear);
}

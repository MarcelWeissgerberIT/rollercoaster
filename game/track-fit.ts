import { invertingPiece } from "./track-parts";
import {
  appendPiece,
  pieceError,
  precisionJoin,
  closeTrack,
  isClosedTrack,
  type Piece,
  PIECES,
} from "./prefabs";
import {
  trackEditRange,
  trackEditWorld,
  trackEditPlan,
  commitTrackEdit,
  type TrackEdit,
} from "./track-edit";
import { trackCost, type Park, type Point } from "./simulation";
export type TrackFit = {
  from: number;
  to: number;
  track: Point[];
  removed: Point[];
  added: Point[];
  cost: number;
  clearIds: number[];
  extraBefore: number;
  extraAfter: number;
  approach: Piece[];
  edit: TrackEdit;
  source: string;
  piece: Piece;
};
export type FitResult = { solution?: TrackFit; error?: string; checked: number };
export const fitSource = (s: Park) =>
  JSON.stringify([
    s.trackEdit,
    s.buildings.find((b) => b.id === s.trackEdit?.buildingId)?.track,
    s.draft?.track,
  ]);
/** Bounded search: prefer a small local replacement; never erase scenery, paths or preserved rails while searching. */
export function findTrackFit(s: Park, draft: Point[], piece: Piece, clear = true): FitResult {
  const range = trackEditRange(s),
    original = s.trackEdit;
  if (!range || !original || !draft.length)
    return { checked: 0, error: "Öffne zuerst einen Gleisbereich zum Umbauen." };
  if (isClosedTrack(draft))
    return { checked: 0, error: "Die Strecke ist bereits verbunden. Übernimm zuerst den Umbau." };
  if (draft[0].style === "wood" && invertingPiece(piece))
    return {
      checked: 0,
      error: "Holzbahnen unterstützen keine Loopings. Wähle einen Hügel oder eine Stahlbahn.",
    };
  if (JSON.stringify(draft) !== JSON.stringify(s.draft?.track))
    return { checked: 0, error: "Der Entwurf hat sich geändert. Starte die Suche erneut." };
  const source = fitSource(s),
    world = trackEditWorld(s),
    ranges = [{ from: range.from, to: range.to }];
  // Hand-built additions are protected. Expanding backwards would silently discard them.
  const hasAdditions = JSON.stringify(draft) !== JSON.stringify(original.prefix);
  if (!hasAdditions)
    for (let extra = 1; extra <= 12; extra++)
      for (let before = 0; before <= Math.min(8, range.from, extra); before++) {
        const after = extra - before,
          from = range.from - before,
          to = range.to + after;
        if (after <= 8 && to < range.sections.length && to - from + 1 < range.sections.length)
          ranges.push({ from, to });
      }
  const approaches: Piece[][] = [
    [],
    ["short"],
    ["straight"],
    ["left"],
    ["right"],
    ["rise"],
    ["fall"],
    ["straight", "left"],
    ["straight", "right"],
    ["rise", "left"],
    ["rise", "right"],
  ];
  let checked = 0,
    best: TrackFit | undefined;
  const routes: { edit: TrackEdit; next: Point[]; from: number; to: number; approach: Piece[] }[] =
    [];
  const makeEdit = (from: number, to: number): TrackEdit => {
    if (from === range.from && to === range.to) return structuredClone(original);
    const a = range.sections[from].start,
      z = range.sections[to].end,
      prefix = range.track.slice(0, a + 1).map((p) => ({ ...p })),
      suffix = range.track.slice(z).map((p) => ({ ...p }));
    prefix[prefix.length - 1] = { ...prefix.at(-1)!, drive: undefined };
    if (suffix.length === 1) suffix[0] = { ...range.track[0] };
    return {
      ...original,
      prefix,
      suffix,
      removedLength: trackCost(range.track.slice(a, z + 1)) - trackCost([range.track[a]]),
    };
  };
  const offer = (edit: TrackEdit, track: Point[], from: number, to: number, approach: Piece[]) => {
    const state = { ...s, cash: Number.MAX_SAFE_INTEGER, trackEdit: edit },
      plan = trackEditPlan(state, track, clear);
    if (plan.error) return;
    const solution: TrackFit = {
      from,
      to,
      track,
      cost: plan.cost,
      clearIds: plan.clearIds,
      edit,
      source,
      piece,
      approach,
      removed: range.track.slice(range.sections[from].start, range.sections[to].end + 1),
      added: track.slice(edit.prefix.length - 1, track.length - edit.suffix.length + 1),
      extraBefore: range.from - from,
      extraAfter: to - range.to,
    };
    if (plan.cost <= s.cash) return solution;
    if (!best || plan.cost < best.cost) best = solution;
  };
  // Check simple connections first, including earlier starts and short approaches around obstacles.
  for (const approach of approaches)
    for (const { from, to } of ranges) {
      const edit = makeEdit(from, to);
      let next = from === range.from && to === range.to ? draft : edit.prefix,
        valid = true;
      for (const part of [...approach, piece]) {
        const candidate = appendPiece(next, part);
        checked++;
        if (pieceError(world, next, candidate, clear, edit.suffix)) {
          valid = false;
          break;
        }
        next = candidate;
      }
      if (!valid) continue;
      const end = next.at(-1)!,
        goal = edit.suffix[0],
        exact =
          Math.hypot(end.x - goal.x, end.y - goal.y, (end.z ?? 0) - (goal.z ?? 0)) < 1e-6 &&
          Math.cos((end.heading ?? 0) - (goal.heading ?? 0)) > 0.999999;
      const joined = exact ? next : precisionJoin(next, goal);
      if (joined && !pieceError(world, next, joined, clear, edit.suffix)) {
        const full = [
          ...joined.slice(0, -1),
          { ...goal, inversion: joined.at(-1)?.inversion },
          ...edit.suffix.slice(1),
        ];
        const solution = offer(edit, full, from, to, approach);
        if (solution) return { solution, checked };
      }
      if (routes.length < 24) routes.push({ edit, next, from, to, approach });
    }
  // More complex detours get a fixed search budget and run in a Worker in the UI.
  for (const route of routes) {
    const joined = closeTrack(world, route.next, clear, route.edit.suffix, {
      iterations: 350,
      depth: 14,
    });
    checked++;
    if (joined.track) {
      const solution = offer(route.edit, joined.track, route.from, route.to, route.approach);
      if (solution) return { solution, checked };
    }
  }
  if (best) return { solution: best, checked };
  return {
    checked,
    error: `Keine passende Verbindung für ${PIECES[piece].name} im geprüften Umfeld gefunden.${hasAdditions ? " Deine bereits ergänzten Teile wurden beibehalten. Nimm sie zurück, damit die Hilfe auch den Anfang der Lücke verschieben kann." : " Wähle einen anderen Gleisbereich oder schaffe mehr Platz."}`,
  };
}
/** Revalidate against the live park, then commit the whole connected replacement once. */
export function commitTrackFit(s: Park, solution: TrackFit, clear = true): string | null {
  if (fitSource(s) !== solution.source)
    return "Die Baustelle hat sich geändert. Suche erneut nach einer Lösung.";
  const old = s.trackEdit;
  const plan = trackEditPlan({ ...s, trackEdit: solution.edit }, solution.track, clear);
  if (plan.error) return plan.error;
  s.trackEdit = structuredClone(solution.edit);
  const error = commitTrackEdit(s, solution.track, clear);
  if (error) s.trackEdit = old;
  return error;
}

import { prepareRoute } from "./motion";
import { driveCost, validDrive, type TrackDrive } from "./drive";
import {
  type Park,
  type Point,
  type Building,
  validateTrack,
  trackCost,
  spend,
  decorative,
} from "./simulation";
import { planPlacement, releaseBuildingGuests } from "./construction";
import { appendPiece, closeTrack, pieceError, precisionJoin, type Piece } from "./prefabs";
export type TrackEdit = {
  buildingId: number;
  prefix: Point[];
  suffix: Point[];
  wasOpen: boolean;
  removedLength: number;
};
export function editableTrack(b: Building): Point[] {
  const input = b.track ?? [],
    style = input[0]?.style ?? "steel";
  if (input[0]?.smooth) return input.map((p) => ({ ...p, style }));
  const sampled = prepareRoute(input).points,
    n = sampled.length - 1;
  const points = sampled.slice(0, -1).map((p, i) => {
    const prev = sampled[(i + n - 1) % n],
      next = sampled[(i + 1) % n];
    let heading = Math.atan2(next.y - prev.y, next.x - prev.x),
      quarter = Math.round(heading / (Math.PI / 2));
    if (Math.abs(heading - (quarter * Math.PI) / 2) < 1e-10) heading = (quarter * Math.PI) / 2;
    return { ...p, z: p.z ?? 0, heading, smooth: true, style, drive: sampled[i + 1]?.drive };
  });
  if (!points.length) return [];
  points.push({ ...points[0], inversion: sampled[n]?.inversion });
  const nearlyInteger = (v: number) => Math.abs(v - Math.round(v)) < 1e-8;
  const anchor = (p: Point) =>
    nearlyInteger(p.x) &&
    nearlyInteger(p.y) &&
    nearlyInteger(p.z ?? 0) &&
    Math.abs(Math.sin((p.heading ?? 0) * 2)) < 1e-8;
  const kept = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = kept.at(-1)!,
      p = points[i],
      b = points[i + 1],
      u = [p.x - a.x, p.y - a.y, p.z - a.z],
      v = [b.x - p.x, b.y - p.y, b.z - p.z];
    const cross = Math.hypot(
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    );
    const distance = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (
      anchor(p) ||
      distance > 1 ||
      cross > 1e-10 ||
      u.reduce((sum, x, j) => sum + x * v[j], 0) < 0 ||
      JSON.stringify(a.drive) !== JSON.stringify(p.drive) ||
      !!p.inversion !== !!b.inversion
    )
      kept.push(p);
  }
  kept.push(points.at(-1)!);
  return kept;
}
export function trackSections(track: Point[]) {
  const marks = [0];
  for (let i = 1; i < track.length - 1; i++) {
    const p = track[i],
      angle = p.heading ?? 0;
    if (
      Math.abs(p.x - Math.round(p.x)) < 0.001 &&
      Math.abs(p.y - Math.round(p.y)) < 0.001 &&
      Math.abs((p.z ?? 0) - Math.round(p.z ?? 0)) < 0.001 &&
      Math.abs(Math.sin(angle * 2)) < 0.001 &&
      !(p.inversion && track[i + 1].inversion)
    )
      marks.push(i);
  }
  if (track.length > 1) marks.push(track.length - 1);
  return marks.slice(0, -1).map((a, i) => ({
    start: a,
    end: marks[i + 1],
    label: track.slice(a + 1, marks[i + 1] + 1).some((p) => p.inversion)
      ? "Looping"
      : Math.abs((track[marks[i + 1]].z ?? 0) - (track[a].z ?? 0)) > 0.1
        ? "Höhenwechsel"
        : track
              .slice(a, marks[i + 1] + 1)
              .some((p) => Math.abs((p.z ?? 0) - (track[a].z ?? 0)) > 0.1)
          ? "Hügel"
          : Math.cos((track[a].heading ?? 0) - (track[marks[i + 1]].heading ?? 0)) < 0.99
            ? "Kurve"
            : "Gerade",
  }));
}
/** Hardware boundaries are selectable even where a geometric prefab has no endpoint. */
export function driveSections(track: Point[]) {
  const geometry = trackSections(track),
    marks = new Set(geometry.flatMap((p) => [p.start, p.end]));
  for (let i = 1; i < track.length - 1; i++)
    if (JSON.stringify(track[i - 1].drive) !== JSON.stringify(track[i].drive)) marks.add(i);
  const sorted = [...marks].sort((a, b) => a - b);
  return sorted
    .slice(0, -1)
    .map((start, i) => ({
      start,
      end: sorted[i + 1],
      label: track[start].drive
        ? track[start].drive!.kind === "boost"
          ? "Beschleuniger"
          : "Bremse"
        : (geometry.find((p) => p.start <= start && p.end > start)?.label ?? "Gleis"),
    }));
}
export function trackDriveGroups(b: Building) {
  if (!b.track?.length) return [];
  const track = editableTrack(b),
    sections = driveSections(track);
  const groups: { from: number; to: number; drive: TrackDrive; length: number }[] = [];
  sections.forEach((part, i) => {
    const drive = track[part.start]?.drive;
    if (!drive) return;
    let length = 0;
    for (let j = part.start; j < part.end; j++)
      length +=
        Math.hypot(
          track[j + 1].x - track[j].x,
          track[j + 1].y - track[j].y,
          (track[j + 1].z ?? 0) - (track[j].z ?? 0),
        ) * 5;
    const last = groups.at(-1);
    if (last && last.to === i - 1 && JSON.stringify(last.drive) === JSON.stringify(drive)) {
      last.to = i;
      last.length += length;
    } else groups.push({ from: i, to: i, drive: { ...drive }, length });
  });
  return groups;
}
export function pickTrackSection(
  track: Point[],
  sections: { start: number; end: number }[],
  point: Point,
  project: (x: number, y: number, z?: number) => Point,
  limit = 35,
) {
  let found = -1,
    best = limit;
  sections.forEach((part, index) => {
    for (let i = part.start; i < part.end; i++) {
      const a = project(track[i].x, track[i].y, track[i].z),
        b = project(track[i + 1].x, track[i + 1].y, track[i + 1].z),
        dx = b.x - a.x,
        dy = b.y - a.y;
      const t = Math.max(
        0,
        Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
      );
      const distance = Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
      if (distance < best) {
        best = distance;
        found = index;
      }
    }
  });
  return found;
}
export function trackEditWorld(s: Park): Park {
  return s.trackEdit
    ? { ...s, buildings: s.buildings.filter((b) => b.id !== s.trackEdit!.buildingId) }
    : s;
}
export function beginTrackEdit(s: Park, b: Building, from: number, to: number): string | null {
  if (s.trackEdit) return "Beende zuerst die offene Streckenbearbeitung.";
  if (b.kind !== "coaster" || !b.track) return "Wähle eine Achterbahn.";
  const track = editableTrack(b),
    sections = trackSections(track);
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < from ||
    to >= sections.length
  )
    return "Wähle einen gültigen Abschnitt.";
  if (track.length > 2048) return "Die Bahn ist zu komplex für den Streckenumbau.";
  const a = sections[from].start,
    z = sections[to].end;
  const removed = track.slice(a, z + 1),
    prefix = track.slice(0, a + 1),
    suffix = track.slice(z);
  // The station is an immutable anchor, even when the final return section is removed.
  if (suffix.length === 1) suffix[0] = { ...track[0] };
  prefix[prefix.length - 1] = { ...prefix.at(-1)!, drive: undefined };
  s.trackEdit = {
    buildingId: b.id,
    prefix,
    suffix,
    wasOpen: b.open,
    removedLength: trackCost(removed) - trackCost([removed[0]]),
  };
  b.open = false;
  b.autoOpen = false;
  releaseBuildingGuests(s, b);
  s.draft = {
    track: prefix,
    history: [],
    rotation: 0,
    style: track[0].style ?? "steel",
    piece: "straight",
  };
  return null;
}
export function cancelTrackEdit(s: Park) {
  const e = s.trackEdit,
    b = s.buildings.find((b) => b.id === e?.buildingId);
  if (b && e) b.open = e.wasOpen;
  s.trackEdit = undefined;
  s.draft = undefined;
}
/** The original track remains intact until commit, so cuts can be expanded without losing it. */
export function trackEditRange(s: Park) {
  const edit = s.trackEdit,
    b = s.buildings.find((b) => b.id === edit?.buildingId);
  if (!edit || !b) return null;
  const track = editableTrack(b),
    sections = trackSections(track);
  const from = sections.findIndex((part) => part.start === edit.prefix.length - 1);
  const to = sections.findIndex((part) => part.end === track.length - edit.suffix.length);
  return from < 0 || to < from ? null : { from, to, sections, track };
}
export function resizeTrackEdit(s: Park, from: number, to: number) {
  const original = s.trackEdit,
    b = s.buildings.find((b) => b.id === original?.buildingId);
  if (!original || !b) return "Keine offene Baustelle.";
  s.trackEdit = undefined;
  const error = beginTrackEdit(s, b, from, to);
  if (error) s.trackEdit = original;
  else s.trackEdit!.wasOpen = original.wasOpen;
  return error;
}
/** Offer a larger visible cut only after checking the prefab and its short final connector. */
export function fittingTrackCut(s: Park, piece: Piece, clear = true) {
  const range = trackEditRange(s);
  if (!range || !s.trackEdit) return null;
  const prefix = s.trackEdit.prefix,
    next = appendPiece(prefix, piece),
    end = next.at(-1)!;
  for (let to = range.to + 1; to < range.sections.length; to++) {
    const suffix = range.track.slice(range.sections[to].end),
      goal = suffix[0];
    const world = trackEditWorld(s);
    if (pieceError(world, prefix, next, clear, suffix)) continue;
    const matches =
      Math.hypot(end.x - goal.x, end.y - goal.y, (end.z ?? 0) - (goal.z ?? 0)) < 0.001 &&
      Math.cos((end.heading ?? 0) - (goal.heading ?? 0)) > 0.999;
    const joined = matches ? next : precisionJoin(next, goal);
    if (!joined || pieceError(world, next, joined, clear, suffix)) continue;
    const full = [
      ...joined.slice(0, -1),
      { ...suffix[0], inversion: joined.at(-1)?.inversion },
      ...suffix.slice(1),
    ];
    if (
      !validateTrack(
        { ...world, buildings: world.buildings.filter((b) => !clear || !decorative(b.kind)) },
        full,
      )
    )
      return { from: range.from, to, extra: to - range.to };
  }
  return null;
}
export function trackEditPlan(s: Park, track: Point[], clear = true) {
  const e = s.trackEdit,
    b = s.buildings.find((b) => b.id === e?.buildingId);
  const plan = planPlacement(
    trackEditWorld(s),
    "coaster",
    b ?? track[0] ?? { x: 0, y: 0 },
    track,
    clear,
  );
  if (!e || !b) return { ...plan, error: "Keine Bahn in Bearbeitung." };
  const same = (a: Point, b: Point | undefined, checkDrive = true, checkInversion = true) =>
    !!b &&
    Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0)) < 0.000001 &&
    Math.cos((a.heading ?? 0) - (b.heading ?? 0)) > 0.999999 &&
    a.style === b.style &&
    (!checkInversion || !!a.inversion === !!b.inversion) &&
    (!checkDrive || JSON.stringify(a.drive) === JSON.stringify(b.drive));
  if (
    track.length < e.prefix.length + e.suffix.length - 1 ||
    !e.prefix.every((p, i) => same(p, track[i], i < e.prefix.length - 1)) ||
    !e.suffix.every((p, i) => same(p, track[track.length - e.suffix.length + i], true, i > 0))
  )
    return {
      ...plan,
      error:
        "Verbinde zuerst mit dem türkis markierten offenen Ende. Erhaltene Gleise bleiben Teil der Bahn.",
    };
  // Only replacement material is charged. Original station and retained sections are already paid.
  const retained = trackCost(e.prefix) + trackCost(e.suffix) - trackCost([track[0]]) * 2;
  const material = Math.max(0, trackCost(track) - trackCost([track[0]]) - retained);
  plan.cost = Math.max(0, material - Math.round(e.removedLength * 0.4)) + plan.clearIds.length * 10;
  if (plan.error === "Das Parkbudget reicht nicht") plan.error = null;
  if (!plan.error && s.cash < plan.cost) plan.error = "Das Parkbudget reicht nicht";
  return plan;
}
export function commitTrackEdit(s: Park, track: Point[], clear = true): string | null {
  const plan = trackEditPlan(s, track, clear),
    b = s.buildings.find((b) => b.id === s.trackEdit?.buildingId);
  if (plan.error || !b) return plan.error ?? "Bahn nicht gefunden.";
  if (!spend(s, plan.cost)) return "Das Parkbudget reicht nicht.";
  s.buildings = s.buildings.filter((b) => !plan.clearIds.includes(b.id));
  b.track = track.map((p) => ({ ...p }));
  b.tested = false;
  b.open = false;
  b.autoOpen = false;
  s.trackEdit = undefined;
  s.draft = undefined;
  return null;
}

/** Group selected prefabs without spanning any unselected section. */
export function selectionGroups(indices: number[], count: number) {
  if (!indices.length || indices.some((i) => !Number.isInteger(i) || i < 0 || i >= count))
    return null;
  const groups: { from: number; to: number }[] = [];
  for (const i of [...new Set(indices)].sort((a, b) => a - b)) {
    const last = groups.at(-1);
    if (last && i === last.to + 1) last.to = i;
    else groups.push({ from: i, to: i });
  }
  return groups;
}
export type BatchRemovalPlan = {
  track: Point[];
  cost: number;
  clearIds: number[];
  error: string | null;
  groups: { from: number; to: number }[];
  connections: Point[][];
};
/** Plan all gaps on a copy. A late failed connector cannot leave half a demolished ride. */
export function batchTrackRemovalPlan(
  s: Park,
  b: Building,
  indices: number[],
  clear = true,
): BatchRemovalPlan {
  const result: BatchRemovalPlan = {
    track: b.track ?? [],
    cost: 0,
    clearIds: [],
    error: null,
    groups: [],
    connections: [],
  };
  const fail = (error: string) => ({ ...result, error });
  if (s.trackEdit || s.draft) return fail("Beende zuerst die offene Streckenbearbeitung.");
  if (b.kind !== "coaster" || !b.track || !s.buildings.includes(b))
    return fail("Wähle eine Achterbahn.");
  const track = editableTrack(b),
    sections = trackSections(track),
    groups = selectionGroups(indices, sections.length);
  if (!groups) return fail("Markiere mindestens einen gültigen Abschnitt.");
  if (new Set(indices).size === sections.length)
    return fail(
      "Mindestens ein Gleisteil muss erhalten bleiben. Die ganze Bahn entfernst du mit Abreißen.",
    );
  if (track.length > 2048) return fail("Die Bahn ist zu komplex für den Streckenumbau.");
  result.groups = groups;
  const work = structuredClone(s),
    copy = work.buildings.find((x) => x.id === b.id)!;
  work.cash = Number.MAX_SAFE_INTEGER;
  copy.track = track;
  // Later gaps cannot change the indices of earlier, retained sections.
  for (const group of [...groups].reverse()) {
    const error = beginTrackEdit(work, copy, group.from, group.to);
    if (error) return fail(error);
    const cut = work.trackEdit!,
      joined = closeTrack(trackEditWorld(work), cut.prefix, clear, cut.suffix);
    if (!joined.track)
      return fail(
        `Abschnitte ${group.from + 1}–${group.to + 1}: ${joined.error ?? "Die offenen Enden lassen sich nicht verbinden."} Wähle einen größeren Bereich oder ersetze ihn mit Fertigteilen.`,
      );
    const plan = trackEditPlan(work, joined.track, clear);
    if (plan.error) return fail(plan.error);
    result.cost += plan.cost;
    result.connections.push(
      joined.track.slice(cut.prefix.length - 1, joined.track.length - cut.suffix.length + 1),
    );
    const commitError = commitTrackEdit(work, joined.track, clear);
    if (commitError) return fail(commitError);
  }
  result.track = copy.track!;
  const retained = new Set(work.buildings.map((x) => x.id));
  result.clearIds = s.buildings.filter((x) => !retained.has(x.id)).map((x) => x.id);
  if (s.cash < result.cost) result.error = "Das Parkbudget reicht für den gesamten Umbau nicht.";
  return result;
}
export function removeTrackSections(
  s: Park,
  b: Building,
  indices: number[],
  clear = true,
): string | null {
  const plan = batchTrackRemovalPlan(s, b, indices, clear);
  if (plan.error) return plan.error;
  if (!spend(s, plan.cost)) return "Das Parkbudget reicht nicht.";
  releaseBuildingGuests(s, b);
  s.buildings = s.buildings.filter((x) => !plan.clearIds.includes(x.id));
  b.track = plan.track;
  b.tested = false;
  b.open = false;
  b.autoOpen = false;
  return null;
}

export function trackDrivePlan(b: Building, from: number, to: number, drive: TrackDrive | null) {
  const dense = editableTrack(b),
    sections = driveSections(dense);
  if (
    !b.track ||
    !sections[from] ||
    !sections[to] ||
    from > to ||
    (drive !== null && !validDrive(drive))
  )
    return {
      error: "Wähle einen gültigen Abschnitt und gültige Moduleinstellungen.",
      cost: 0,
      changed: false,
      track: b.track ?? [],
    };
  const original = dense,
    start = sections[from].start,
    end = sections[to].end;
  if (original.length > 2048)
    return {
      error: "Die Bahn ist zu komplex für diese Modulmontage.",
      cost: 0,
      changed: false,
      track: b.track,
    };
  const track = original.map((p, i) =>
    i >= start && i < end ? { ...p, drive: drive ? { ...drive } : undefined } : { ...p },
  );
  if (track.length) track[track.length - 1] = { ...track[0] };
  let cost = 0;
  for (let i = start; i < end; i++) {
    const a = original[i],
      b = original[i + 1],
      length = Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
    if (a.drive?.kind === drive?.kind) continue;
    const price = (kind: string | undefined) => (kind === "boost" ? 80 : kind === "brake" ? 45 : 0);
    cost += length * (price(drive?.kind) - price(a.drive?.kind) * 0.4);
  }
  const changed = original
    .slice(start, end)
    .some((p) =>
      drive
        ? p.drive?.kind !== drive.kind ||
          p.drive.speed !== drive.speed ||
          p.drive.strength !== drive.strength
        : !!p.drive,
    );
  return { track, cost: Math.round(cost), changed, error: null };
}
export function installTrackDrive(
  s: Park,
  b: Building,
  from: number,
  to: number,
  drive: TrackDrive | null,
) {
  if (s.trackEdit?.buildingId === b.id) return "Beende zuerst den Streckenumbau.";
  const plan = trackDrivePlan(b, from, to, drive);
  if (plan.error) return plan.error;
  if (!plan.changed) return null;
  if (plan.cost > 0 && !spend(s, plan.cost)) return "Das Parkbudget reicht nicht.";
  if (plan.cost < 0) {
    s.cash -= plan.cost;
    s.income -= plan.cost;
    s.dayIncome -= plan.cost;
  }
  releaseBuildingGuests(s, b);
  b.track = plan.track;
  b.open = false;
  b.tested = false;
  return null;
}

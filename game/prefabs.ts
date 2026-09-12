import { terrainHeight } from "./terrain";
import { coasterMaxHeight } from "./track-limits";
import { trackGroundCompatible } from "./ground-clearance";
import { insideMap } from "./grid";
import {
  type Point,
  type Park,
  type CoasterType,
  occupant,
  CATALOG,
  decorative,
  trackFootprint,
  validateTrack,
} from "./simulation";
import { PIECES, type Piece } from "./track-parts";
export { PIECES, type Piece } from "./track-parts";
const snap = (v: number) => Math.round(v * 1e6) / 1e6;
export function startTrack(p: Point, rotation = 0, style: CoasterType = "steel"): Point[] {
  return [
    {
      ...p,
      z: p.z ?? (style === "inverted" ? 1 : 0),
      smooth: true,
      heading: (rotation * Math.PI) / 2,
      style,
    },
  ];
}
export function appendPiece(track: Point[], piece: Piece, straightLength = 2): Point[] {
  if (!track.length) return track;
  if (piece === "doubleloop") return appendPiece(appendPiece(track, "loop"), "loop");
  if (piece === "hill") return appendPiece(appendPiece(track, "rise"), "fall");
  if (piece === "sbend") return appendPiece(appendPiece(track, "right"), "left");
  const end = track.at(-1)!;
  const angle =
    end.heading ??
    Math.atan2(end.y - (track.at(-2)?.y ?? end.y), end.x - (track.at(-2)?.x ?? end.x - 1));
  const turn = piece === "left" ? -1 : 1;
  const count = ["loop", "airtime", "bunny", "helixleft", "helixright"].includes(piece) ? 64 : 16;
  const points: Point[] = [];
  for (let i = 1; i <= count; i++) {
    const t = i / count;
    let x = (piece === "short" ? 1 : piece === "straight" ? straightLength : 2) * t,
      y = 0,
      z = 0,
      heading = angle;
    if (piece === "left" || piece === "right") {
      const a = (t * Math.PI) / 2;
      x = 2 * Math.sin(a);
      y = turn * 2 * (1 - Math.cos(a));
      heading += turn * a;
    }
    if (piece === "rise" || piece === "fall")
      z = (piece === "rise" ? 1 : -1) * (t * t * (3 - 2 * t));
    if (piece === "airtime" || piece === "bunny") {
      x = (piece === "airtime" ? 6 : 8) * t;
      z =
        ((piece === "airtime" ? 1 : 0.65) *
          (1 - Math.cos((piece === "airtime" ? 2 : 4) * Math.PI * t))) /
        2;
    }
    if (piece === "helixleft" || piece === "helixright") {
      const turn = piece === "helixleft" ? -1 : 1,
        a = t * Math.PI;
      x = 3 * Math.sin(a);
      y = turn * 3 * (1 - Math.cos(a));
      z = t * t * (3 - 2 * t);
      heading += turn * a;
    }
    if (piece === "loop") {
      x = 4 * t + 2 * Math.sin(2 * Math.PI * t);
      z = 2 * (1 - Math.cos(2 * Math.PI * t));
      y = 2 * Math.sin(2 * Math.PI * t) * Math.sin(Math.PI * t);
    }
    points.push({
      x: snap(end.x + x * Math.cos(angle) - y * Math.sin(angle)),
      y: snap(end.y + x * Math.sin(angle) + y * Math.cos(angle)),
      z: snap((end.z ?? 0) + z),
      heading,
      smooth: true,
      inversion: piece === "loop",
      style: track[0].style,
    });
  }
  return [...track, ...points];
}
export function isClosedTrack(t: Point[]) {
  return (
    t.length > 8 &&
    Math.hypot(t[0].x - t.at(-1)!.x, t[0].y - t.at(-1)!.y, (t[0].z ?? 0) - (t.at(-1)!.z ?? 0)) <
      0.001 &&
    Math.cos((t[0].heading ?? 0) - (t.at(-1)!.heading ?? 0)) > 0.999
  );
}
export function retainedTrackError(old: Point[], next: Point[], suffix?: Point[]): string | null {
  if (!suffix?.length) return null;
  const arc = (t: Point[]) => {
    const d = [0];
    for (let i = 1; i < t.length; i++)
      d.push(
        d[i - 1] +
          Math.hypot(t[i].x - t[i - 1].x, t[i].y - t[i - 1].y, (t[i].z ?? 0) - (t[i - 1].z ?? 0)),
      );
    return d;
  };
  const distances = arc(next),
    tail = arc(suffix),
    end = next.at(-1)!,
    goal = suffix[0];
  const joined =
    Math.hypot(end.x - goal.x, end.y - goal.y, (end.z ?? 0) - (goal.z ?? 0)) < 0.001 &&
    Math.cos((end.heading ?? 0) - (goal.heading ?? 0)) > 0.999;
  for (let i = old.length; i < next.length; i++)
    for (let j = 0; j < suffix.length; j++) {
      if (
        distances[i] + tail.at(-1)! - tail[j] < 2.5 ||
        (joined && distances.at(-1)! - distances[i] + tail[j] < 2.5)
      )
        continue;
      if (
        Math.hypot(next[i].x - suffix[j].x, next[i].y - suffix[j].y) < 0.35 &&
        Math.abs((next[i].z ?? 0) - (suffix[j].z ?? 0)) < 0.6
      )
        return "Dieses Bauteil kreuzt den erhaltenen Streckenteil. Ändere Richtung oder Höhe.";
    }
  return null;
}
export function pieceError(
  s: Park,
  old: Point[],
  next: Point[],
  clear: boolean,
  suffix?: Point[],
): string | null {
  if (isClosedTrack(old)) return "Der Rundkurs ist geschlossen. Du kannst ihn jetzt bauen.";
  if (next.length > 2048) return "Maximal 2.048 Streckenpunkte pro Bahn.";
  if (next.some((p) => (p.z ?? 0) < 0 || (p.z ?? 0) > coasterMaxHeight(next[0]?.style)))
    return "Diese Höhe ist für den Bahntyp nicht möglich.";
  if (["wood", "giga"].includes(next[0]?.style ?? "steel") && next.some((p) => p.inversion))
    return "Dieser Bahntyp unterstützt keine Loopings.";
  const start = next[0],
    last = next.at(-1)!;
  const distances = [0];
  for (let i = 1; i < next.length; i++)
    distances.push(
      distances[i - 1] +
        Math.hypot(
          next[i].x - next[i - 1].x,
          next[i].y - next[i - 1].y,
          (next[i].z ?? 0) - (next[i - 1].z ?? 0),
        ),
    );
  const closed = isClosedTrack(next);
  for (let i = Math.max(1, old.length); i < next.length; i++)
    for (let j = 0; j < i; j++) {
      const gap = distances[i] - distances[j];
      if (gap < 2.5 || (closed && distances.at(-1)! - gap < 2.5)) continue;
      if (
        Math.hypot(next[i].x - next[j].x, next[i].y - next[j].y) < 0.35 &&
        Math.abs((next[i].z ?? 0) - (next[j].z ?? 0)) < 0.6
      )
        return "Dieses Bauteil kreuzt deine Strecke. Ändere Richtung oder Höhe.";
    }
  const added = next.slice(Math.max(0, old.length - 1));
  for (const p of trackFootprint(added)) {
    if (!insideMap(s, p.x, p.y)) return "Das Bauteil ragt aus dem Park.";
    const b = occupant(s, p.x, p.y);
    const tile = s.tiles[p.y][p.x],
      field = `Feld (${p.x}, ${p.y})`;
    if (tile === "water")
      return `Wasser blockiert ${field}. Das Bauteil braucht auch seitlich freie Landfläche. Die Einpasshilfe sucht einen anderen Verlauf.`;
    if (!trackGroundCompatible(next, p.x, p.y, tile, terrainHeight(s, p.x, p.y)))
      return `${tile === "queue" ? "Ein blauer Eingangsweg" : tile === "exit" ? "Ein roter Ausgangsweg" : "Ein Parkweg"} blockiert ${field}. Die Einpasshilfe versucht, den Weg zu umgehen.`;
    if (b && (!clear || !(decorative(b.kind) && b.kind !== "keeperhut")))
      return `${b.name || CATALOG[b.kind].name} blockiert ${field}.${decorative(b.kind) && b.kind !== "keeperhut" ? " Aktiviere „Deko freiräumen“." : " Die Einpasshilfe sucht einen freien Verlauf."}`;
  }
  return retainedTrackError(old, next, suffix);
}
export function prefabBlueprint(p: Point, rotation: number, style: CoasterType): Point[] {
  let t = startTrack(p, rotation, style);
  const pieces: Piece[] =
    style === "wood"
      ? [
          "straight",
          "rise",
          "fall",
          "right",
          "straight",
          "right",
          "straight",
          "rise",
          "fall",
          "right",
          "straight",
          "right",
        ]
      : [
          "straight",
          ...(["launch", "inverted"].includes(style)
            ? (["loop"] as Piece[])
            : (["rise", "fall"] as Piece[])),
          "straight",
          "right",
          "straight",
          "right",
          "straight",
          "straight",
          "straight",
          "straight",
          "right",
          "straight",
          "right",
        ];
  for (const part of pieces) t = appendPiece(t, part);
  t[t.length - 1] = { ...t[0] };
  if (style === "giga") t = t.map((q) => ({ ...q, z: (p.z ?? 0) + ((q.z ?? 0) - (p.z ?? 0)) * 3 }));
  return t;
}
export function precisionJoin(prefix: Point[], goal: Point): Point[] | null {
  const a = prefix.at(-1)!,
    d = Math.hypot(goal.x - a.x, goal.y - a.y, (goal.z ?? 0) - (a.z ?? 0));
  if (d < 1e-7 || d > 3) return null;
  const h = Math.max(0.08, d * 0.35),
    ax = a.x + Math.cos(a.heading ?? 0) * h,
    ay = a.y + Math.sin(a.heading ?? 0) * h,
    bx = goal.x - Math.cos(goal.heading ?? 0) * h,
    by = goal.y - Math.sin(goal.heading ?? 0) * h;
  const count = Math.max(16, Math.ceil(d * 16)),
    out = [...prefix];
  for (let i = 1; i <= count; i++) {
    const t = i / count,
      u = 1 - t;
    const dx = 3 * u * u * (ax - a.x) + 6 * u * t * (bx - ax) + 3 * t * t * (goal.x - bx),
      dy = 3 * u * u * (ay - a.y) + 6 * u * t * (by - ay) + 3 * t * t * (goal.y - by);
    out.push({
      x:
        i === count
          ? goal.x
          : u * u * u * a.x + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * goal.x,
      y:
        i === count
          ? goal.y
          : u * u * u * a.y + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * goal.y,
      z:
        i === count
          ? (goal.z ?? 0)
          : (a.z ?? 0) + ((goal.z ?? 0) - (a.z ?? 0)) * (t * t * (3 - 2 * t)),
      heading: i === count ? goal.heading : Math.atan2(dy, dx),
      smooth: true,
      style: prefix[0].style,
      inversion: false,
    });
  }
  return out;
}
/** Close with tangent-matched straight/quarter-circle prefabs. Search poses, never draw a teleporting closing chord. */
export function closeTrack(
  s: Park,
  track: Point[],
  clear = true,
  suffix?: Point[],
  limits: { iterations: number; depth: number } = { iterations: 6500, depth: 28 },
): { track?: Point[]; error?: string } {
  if (track.length < (suffix ? 1 : 2)) return { error: "Baue zuerst ein paar Abschnitte." };
  const first = suffix?.[0] ?? track[0],
    targetHeading =
      first.heading ?? (suffix?.[1] ? Math.atan2(suffix[1].y - first.y, suffix[1].x - first.x) : 0);
  const same = (p: Point) =>
    Math.hypot(p.x - first.x, p.y - first.y, (p.z ?? 0) - (first.z ?? 0)) < 0.001 &&
    Math.cos((p.heading ?? 0) - targetHeading) > 0.999;
  const virtual = {
    ...s,
    buildings: s.buildings.filter((b) => !clear || !(decorative(b.kind) && b.kind !== "keeperhut")),
  };
  const suffixDistances = [0];
  if (suffix)
    for (let i = 1; i < suffix.length; i++)
      suffixDistances.push(
        suffixDistances[i - 1] +
          Math.hypot(
            suffix[i].x - suffix[i - 1].x,
            suffix[i].y - suffix[i - 1].y,
            (suffix[i].z ?? 0) - (suffix[i - 1].z ?? 0),
          ),
      );
  const finish = (t: Point[]) =>
    suffix
      ? [...t.slice(0, -1), { ...suffix[0], inversion: t.at(-1)?.inversion }, ...suffix.slice(1)]
      : [...t.slice(0, -1), { ...track[0] }];
  type Node = { track: Point[]; depth: number; score: number };
  const queue: Node[] = [{ track, depth: 0, score: 0 }],
    visited = new Set<string>();
  for (let iterations = 0; queue.length && iterations < limits.iterations; iterations++) {
    queue.sort((a, b) => a.score - b.score);
    const node = queue.shift()!,
      last = node.track.at(-1)!;
    if (same(last)) {
      const done = finish(node.track);
      if (!validateTrack(virtual, done)) return { track: done };
      if (node.depth) continue;
    }
    if (suffix) {
      const joined = precisionJoin(node.track, first);
      if (
        joined &&
        joined.length + suffix.length - 1 <= 2048 &&
        !pieceError(s, node.track, joined, clear, suffix)
      ) {
        const done = finish(joined);
        if (!validateTrack(virtual, done)) return { track: done };
      }
    }
    if (node.depth >= limits.depth) continue;
    const key = `${last.x},${last.y},${last.z},${Math.round((last.heading ?? 0) / (Math.PI / 2) + 400) % 4}`;
    if (visited.has(key)) continue;
    visited.add(key);
    const options: Piece[] = ["straight", "left", "right"];
    if ((last.z ?? 0) > 0) options.push("fall");
    if ((last.z ?? 0) < Math.min(coasterMaxHeight(track[0].style), (first.z ?? 0) + 1))
      options.push("rise");
    for (const choice of [
      ...options.map((piece) => ({ piece, length: 2 })),
      { piece: "straight" as Piece, length: 1 },
    ]) {
      const next = appendPiece(node.track, choice.piece, choice.length),
        end = next.at(-1)!;
      if (
        next.length + (suffix?.length ?? 1) - 1 > 2048 ||
        pieceError(s, node.track, next, clear, suffix)
      )
        continue;
      queue.push({
        track: next,
        depth: node.depth + 1,
        score:
          node.depth +
          1 +
          Math.hypot(end.x - first.x, end.y - first.y) / 2 +
          Math.abs((end.z ?? 0) - (first.z ?? 0)) * 2,
      });
    }
  }
  return {
    error: suffix
      ? "Kein freier Anschluss gefunden. Entferne einen größeren Abschnitt oder ändere Höhe und Richtung."
      : "Kein freier Rückweg gefunden. Führe das Ende näher zur Station oder entferne ein Bauteil.",
  };
}

/** Alternatives are fully preflighted against terrain, other rides, height and self-collisions. */
export function suggestPieces(
  s: Park,
  track: Point[],
  selected: Piece,
  clear = true,
  suffix?: Point[],
) {
  if (!track.length || isClosedTrack(track)) return [];
  const choices: Piece[][] = [
    ["left"],
    ["right"],
    ["rise"],
    ["fall"],
    ["straight"],
    ["rise", "left"],
    ["rise", "right"],
    ["left", "straight"],
    ["right", "straight"],
  ];
  const result: { label: string; track: Point[]; pieces: Piece[] }[] = [];
  for (const parts of choices) {
    if (parts.length === 1 && parts[0] === selected) continue;
    let next = track,
      valid = true;
    for (const part of parts) {
      const candidate = appendPiece(next, part);
      if (pieceError(s, next, candidate, clear, suffix)) {
        valid = false;
        break;
      }
      next = candidate;
    }
    if (valid)
      result.push({
        label: parts.map((p) => PIECES[p].name).join(" + "),
        track: next,
        pieces: parts,
      });
    if (result.length === 3) break;
  }
  return result;
}

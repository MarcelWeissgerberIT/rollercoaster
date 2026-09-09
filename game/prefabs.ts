import { insideMap } from "./grid";
import {
  type Point,
  type Park,
  type CoasterType,
  occupant,
  decorative,
  trackFootprint,
  validateTrack,
} from "./simulation";
export const PIECES = {
  straight: { name: "Gerade", glyph: "━", detail: "2 Felder" },
  rise: { name: "Steigung", glyph: "╱", detail: "+5 m · Kettenlift" },
  fall: { name: "Abfahrt", glyph: "╲", detail: "−5 m" },
  left: { name: "Linkskurve", glyph: "↰", detail: "90° · Radius 2" },
  right: { name: "Rechtskurve", glyph: "↱", detail: "90° · Radius 2" },
  loop: { name: "Looping", glyph: "↻", detail: "20 m · Inversion" },
} as const;
export type Piece = keyof typeof PIECES;
const snap = (v: number) => Math.round(v * 1e6) / 1e6;
export function startTrack(p: Point, rotation = 0, style: CoasterType = "steel"): Point[] {
  return [{ ...p, z: 0, smooth: true, heading: (rotation * Math.PI) / 2, style }];
}
export function appendPiece(track: Point[], piece: Piece, straightLength = 2): Point[] {
  if (!track.length) return track;
  const end = track.at(-1)!;
  const angle =
    end.heading ??
    Math.atan2(end.y - (track.at(-2)?.y ?? end.y), end.x - (track.at(-2)?.x ?? end.x - 1));
  const turn = piece === "left" ? -1 : 1;
  const count = piece === "loop" ? 64 : 16;
  const points: Point[] = [];
  for (let i = 1; i <= count; i++) {
    const t = i / count;
    let x = (piece === "straight" ? straightLength : 2) * t,
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
  if (next.some((p) => (p.z ?? 0) < 0 || (p.z ?? 0) > (next[0]?.style === "wood" ? 4 : 8)))
    return "Diese Höhe ist für den Bahntyp nicht möglich.";
  if (next[0]?.style === "wood" && next.some((p) => p.inversion))
    return "Holzbahnen unterstützen keine Loopings.";
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
    if (s.tiles[p.y][p.x] !== "grass" || (b && (!clear || !decorative(b.kind))))
      return "Am Anschluss ist kein Platz für dieses Bauteil.";
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
          ...(style === "launch" ? (["loop"] as Piece[]) : (["rise", "fall"] as Piece[])),
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
  return t;
}
/** Close with tangent-matched straight/quarter-circle prefabs. Search poses, never draw a teleporting closing chord. */
export function closeTrack(
  s: Park,
  track: Point[],
  clear = true,
  suffix?: Point[],
): { track?: Point[]; error?: string } {
  if (track.length < (suffix ? 1 : 2)) return { error: "Baue zuerst ein paar Abschnitte." };
  const first = suffix?.[0] ?? track[0],
    targetHeading =
      first.heading ?? (suffix?.[1] ? Math.atan2(suffix[1].y - first.y, suffix[1].x - first.x) : 0);
  const same = (p: Point) =>
    Math.hypot(p.x - first.x, p.y - first.y, (p.z ?? 0) - (first.z ?? 0)) < 0.001 &&
    Math.cos((p.heading ?? 0) - targetHeading) > 0.999;
  const virtual = { ...s, buildings: s.buildings.filter((b) => !clear || !decorative(b.kind)) };
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
    suffix ? [...t.slice(0, -1), ...suffix] : [...t.slice(0, -1), { ...track[0] }];
  type Node = { track: Point[]; depth: number; score: number };
  const queue: Node[] = [{ track, depth: 0, score: 0 }],
    visited = new Set<string>();
  for (let iterations = 0; queue.length && iterations < 6500; iterations++) {
    queue.sort((a, b) => a.score - b.score);
    const node = queue.shift()!,
      last = node.track.at(-1)!;
    if (same(last)) {
      const done = finish(node.track);
      if (!validateTrack(virtual, done)) return { track: done };
      if (node.depth) continue;
    }
    if (node.depth >= 28) continue;
    const key = `${last.x},${last.y},${last.z},${Math.round((last.heading ?? 0) / (Math.PI / 2) + 400) % 4}`;
    if (visited.has(key)) continue;
    visited.add(key);
    const options: Piece[] = ["straight", "left", "right"];
    if ((last.z ?? 0) > 0) options.push("fall");
    if ((last.z ?? 0) < Math.min(track[0].style === "wood" ? 4 : 8, (first.z ?? 0) + 1))
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

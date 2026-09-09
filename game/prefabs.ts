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
export function appendPiece(track: Point[], piece: Piece): Point[] {
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
    let x = 2 * t,
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
export function pieceError(s: Park, old: Point[], next: Point[], clear: boolean): string | null {
  if (next.length > 2048) return "Maximal 2.048 Streckenpunkte pro Bahn.";
  if (next.some((p) => (p.z ?? 0) < 0 || (p.z ?? 0) > (next[0]?.style === "wood" ? 4 : 8)))
    return "Diese Höhe ist für den Bahntyp nicht möglich.";
  const added = next.slice(Math.max(0, old.length - 1));
  for (const p of trackFootprint(added)) {
    if (p.x < 0 || p.y < 0 || p.x >= 30 || p.y >= 30) return "Das Bauteil ragt aus dem Park.";
    const b = occupant(s, p.x, p.y);
    if (s.tiles[p.y][p.x] !== "grass" || (b && (!clear || !decorative(b.kind))))
      return "Am Anschluss ist kein Platz für dieses Bauteil.";
  }
  return null;
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
): { track?: Point[]; error?: string } {
  if (track.length < 2) return { error: "Baue zuerst ein paar Abschnitte." };
  const first = track[0];
  const same = (a: Point) =>
    Math.hypot(a.x - first.x, a.y - first.y, (a.z ?? 0) - (first.z ?? 0)) < 0.001 &&
    Math.cos((a.heading ?? 0) - (first.heading ?? 0)) > 0.999;
  if (same(track.at(-1)!)) return { track };
  type Node = { track: Point[]; depth: number; score: number };
  const queue: Node[] = [{ track, depth: 0, score: 0 }],
    visited = new Set<string>();
  for (let iterations = 0; queue.length && iterations < 5000; iterations++) {
    queue.sort((a, b) => a.score - b.score);
    const node = queue.shift()!,
      last = node.track.at(-1)!;
    if (node.depth && same(last)) {
      const completed = [...node.track.slice(0, -1), { ...first }];
      const virtual = { ...s, buildings: s.buildings.filter((b) => !clear || !decorative(b.kind)) };
      if (!validateTrack(virtual, completed)) return { track: completed };
      continue;
    }
    if (node.depth >= 24) continue;
    const key = `${last.x},${last.y},${last.z},${Math.round((last.heading ?? 0) / (Math.PI / 2) + 400) % 4}`;
    if (visited.has(key)) continue;
    visited.add(key);
    const options: Piece[] =
      (last.z ?? 0) > 0 ? ["fall", "straight", "left", "right"] : ["straight", "left", "right"];
    for (const piece of options) {
      const next = appendPiece(node.track, piece),
        end = next.at(-1)!;
      if (pieceError(s, node.track, next, clear)) continue;
      // Avoid running through the existing route; neighbouring samples and the final station are allowed.
      const old = node.track.slice(0, -24);
      if (
        next
          .slice(node.track.length)
          .some((p) =>
            old.some(
              (o) =>
                Math.hypot(o.x - p.x, o.y - p.y) < 0.35 &&
                Math.abs((o.z ?? 0) - (p.z ?? 0)) < 0.6 &&
                Math.hypot(p.x - first.x, p.y - first.y) > 0.45,
            ),
          )
      )
        continue;
      queue.push({
        track: next,
        depth: node.depth + 1,
        score: node.depth + 1 + Math.hypot(end.x - first.x, end.y - first.y) / 2 + (end.z ?? 0) * 2,
      });
    }
  }
  return {
    error:
      "Kein freier Rückweg gefunden. Führe das Ende näher zur Station oder entferne ein Bauteil.",
  };
}

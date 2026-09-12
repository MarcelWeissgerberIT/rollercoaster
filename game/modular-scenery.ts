import type { Park } from "./simulation";
import { spendCash, creditCash } from "./budget";

export const SCENERY_THEMES = {
  woodland: {
    name: "Waldhütte",
    wall: "#cfae7d",
    trim: "#715634",
    roof: "#517d70",
    light: "#ffe8a6",
  },
  fairytale: {
    name: "Märchenschloss",
    wall: "#e7d3dc",
    trim: "#9981ad",
    roof: "#9baece",
    light: "#fff0bd",
  },
  western: {
    name: "Westernstadt",
    wall: "#c79662",
    trim: "#79513d",
    roof: "#b77460",
    light: "#ffe0a0",
  },
  tropical: {
    name: "Tropenbucht",
    wall: "#e5cc91",
    trim: "#528e87",
    roof: "#83a56b",
    light: "#fff2bb",
  },
} as const;
export const SCENERY_PARTS = {
  wall: { name: "Wand", cost: 40, height: 1 },
  window: { name: "Fensterwand", cost: 65, height: 1 },
  arch: { name: "Durchgang", cost: 75, height: 1 },
  roof: { name: "Satteldach", cost: 95, height: 0.7 },
  flatroof: { name: "Flachdach", cost: 55, height: 0.12 },
  tower: { name: "Turmspitze", cost: 140, height: 1.2 },
  lamp: { name: "Wandleuchte", cost: 35, height: 0.35 },
} as const;
export type SceneryPart = keyof typeof SCENERY_PARTS;
export type SceneryPiece = {
  id: number;
  x: number;
  y: number;
  z: number;
  orientation: 0 | 1 | 2 | 3;
  part: SceneryPart;
  theme: keyof typeof SCENERY_THEMES;
};
export type SceneryDraft = Omit<SceneryPiece, "id">;
const edgePart = (part: SceneryPart) => ["wall", "window", "arch", "lamp"].includes(part);
const number = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
export function validScenery(s: Pick<Park, "scenery" | "tiles">): boolean {
  if (s.scenery === undefined) return true;
  const ids = new Set<number>();
  return (
    Array.isArray(s.scenery) &&
    s.scenery.length <= 1500 &&
    s.scenery.every((p) => {
      if (!p || !Number.isInteger(p.id) || p.id < 1 || ids.has(p.id)) return false;
      ids.add(p.id);
      return (
        Number.isInteger(p.x) &&
        Number.isInteger(p.y) &&
        number(p.x, 0, s.tiles[0].length - 1) &&
        number(p.y, 0, s.tiles.length - 1) &&
        number(p.z, -4, 14) &&
        Number.isInteger(p.z * 2) &&
        [0, 1, 2, 3].includes(p.orientation) &&
        Object.hasOwn(SCENERY_PARTS, p.part) &&
        Object.hasOwn(SCENERY_THEMES, p.theme)
      );
    })
  );
}
export function sceneryError(s: Park, p: SceneryDraft, ignoreId?: number): string | null {
  if (!validScenery({ tiles: s.tiles, scenery: [{ ...p, id: 1 }] }))
    return "Das Bauteil liegt außerhalb des Baubereichs.";
  if ((s.scenery?.length ?? 0) >= 1500 && !ignoreId)
    return "Maximal 1.500 Themenbauteile pro Park.";
  if (
    s.scenery?.some(
      (q) =>
        q.id !== ignoreId &&
        q.x === p.x &&
        q.y === p.y &&
        q.z === p.z &&
        edgePart(q.part) === edgePart(p.part) &&
        (!edgePart(p.part) || q.orientation === p.orientation),
    )
  )
    return "Hier sitzt bereits ein Bauteil auf derselben Höhe. Ändere Höhe oder Seite.";
  // Buildings can be dressed with facades, but a low solid wall must not sever pedestrian routes.
  if (
    ["path", "queue", "exit"].includes(s.tiles[p.y][p.x]) &&
    ["wall", "window"].includes(p.part) &&
    p.z < ((s as Park & { terrain?: Record<string, number> }).terrain?.[`${p.x},${p.y}`] ?? 0) + 1
  )
    return "Auf Wegen einen Durchgang verwenden oder die Wand über Kopfhöhe setzen.";
  return null;
}
export function placeScenery(s: Park, p: SceneryDraft): string | null {
  const error = sceneryError(s, p);
  if (error) return error;
  const cost = SCENERY_PARTS[p.part].cost;
  if (!spendCash(s, cost)) return "Für dieses Themenbauteil fehlt Parkbudget.";
  s.expenses += cost;
  s.dayExpenses += cost;
  (s.scenery ??= []).push({ ...p, id: s.nextId++ });
  return null;
}
export function rotateScenery(s: Park, id: number): string | null {
  const p = s.scenery?.find((p) => p.id === id);
  if (!p) return "Bauteil nicht gefunden.";
  const next = { ...p, orientation: ((p.orientation + 1) % 4) as SceneryPiece["orientation"] };
  const error = sceneryError(s, next, id);
  if (error) return error;
  p.orientation = next.orientation;
  return null;
}
export function removeScenery(s: Park, id: number): string | null {
  const p = s.scenery?.find((p) => p.id === id);
  if (!p) return "Bauteil nicht gefunden.";
  s.scenery = s.scenery!.filter((p) => p.id !== id);
  creditCash(s, Math.floor(SCENERY_PARTS[p.part].cost / 2));
  return null;
}
export type SceneryFace = { color: string; points: [number, number, number][] };
/** Shared solid mesh, metres around a tile centre: x, map-y, height. */
export function sceneryFaces(
  p: Pick<SceneryPiece, "part" | "theme" | "orientation">,
): SceneryFace[] {
  const c = SCENERY_THEMES[p.theme],
    faces: SceneryFace[] = [];
  const face = (color: string, points: [number, number, number][]) => faces.push({ color, points });
  const box = (x: number, y: number, z: number, w: number, d: number, h: number, color: string) => {
    const a = x - w / 2,
      b = x + w / 2,
      e = y - d / 2,
      f = y + d / 2;
    face(color, [
      [a, e, z],
      [b, e, z],
      [b, e, z + h],
      [a, e, z + h],
    ]);
    face(color, [
      [b, e, z],
      [b, f, z],
      [b, f, z + h],
      [b, e, z + h],
    ]);
    face(color, [
      [b, f, z],
      [a, f, z],
      [a, f, z + h],
      [b, f, z + h],
    ]);
    face(color, [
      [a, f, z],
      [a, e, z],
      [a, e, z + h],
      [a, f, z + h],
    ]);
    face(color, [
      [a, e, z + h],
      [b, e, z + h],
      [b, f, z + h],
      [a, f, z + h],
    ]);
  };
  if (p.part === "wall" || p.part === "window" || p.part === "arch") {
    if (p.part === "wall") box(0, -2.35, 0, 5, 0.3, 5, c.wall);
    else {
      box(-1.8, -2.35, 0, 1.4, 0.3, 5, c.wall);
      box(1.8, -2.35, 0, 1.4, 0.3, 5, c.wall);
      box(0, -2.35, 3.8, 2.2, 0.3, 1.2, c.wall);
      if (p.part === "window") {
        box(0, -2.35, 0, 2.2, 0.3, 1.7, c.wall);
        box(0, -2.55, 1.7, 2.2, 0.07, 2.1, "#9ccbd2");
        box(0, -2.6, 1.7, 0.12, 0.08, 2.1, c.trim);
        box(0, -2.6, 2.7, 2.2, 0.08, 0.12, c.trim);
      }
    }
    for (const x of [-2.4, 2.4]) box(x, -2.52, 0, 0.18, 0.18, 5, c.trim);
    box(0, -2.52, 4.75, 5, 0.18, 0.25, c.trim);
    for (const z of [0.4, 1.2, 2, 2.8, 3.6])
      if (p.part === "wall") box(0, -2.52, z, 4.7, 0.04, 0.035, c.trim);
  } else if (p.part === "roof") {
    face(c.roof, [
      [-2.7, -2.7, 0],
      [2.7, -2.7, 0],
      [2.7, 0, 3.5],
      [-2.7, 0, 3.5],
    ]);
    face(c.roof, [
      [-2.7, 0, 3.5],
      [2.7, 0, 3.5],
      [2.7, 2.7, 0],
      [-2.7, 2.7, 0],
    ]);
    for (const x of [-2.5, 2.5])
      face(c.wall, [
        [x, -2.5, 0],
        [x, 2.5, 0],
        [x, 0, 3.4],
      ]);
    box(0, 0, 3.45, 5.5, 0.15, 0.15, c.trim);
    for (const y of [-1.9, -0.9, 0.9, 1.9])
      box(0, y, 3.5 - (Math.abs(y) * 3.5) / 2.7, 5.5, 0.08, 0.04, c.trim);
  } else if (p.part === "tower") {
    box(0, 0, 0, 4, 4, 2, c.wall);
    for (const [a, b] of [
      [
        [-2.6, -2.6],
        [2.6, -2.6],
      ],
      [
        [2.6, -2.6],
        [2.6, 2.6],
      ],
      [
        [2.6, 2.6],
        [-2.6, 2.6],
      ],
      [
        [-2.6, 2.6],
        [-2.6, -2.6],
      ],
    ])
      face(c.roof, [
        [a[0], a[1], 2],
        [b[0], b[1], 2],
        [0, 0, 6],
      ]);
    box(0, 0, 6, 0.13, 0.13, 0.8, c.trim);
    box(0.4, 0, 6.4, 0.8, 0.06, 0.4, c.light);
  } else if (p.part === "flatroof") {
    box(0, 0, 0, 5.3, 5.3, 0.35, c.roof);
    box(0, -2.6, 0.35, 5.3, 0.18, 0.25, c.trim);
  } else {
    box(0, -2.4, 0, 0.14, 0.25, 1.5, c.trim);
    box(0, -2.7, 0.8, 0.55, 0.55, 0.8, c.light);
    box(0, -2.7, 1.6, 0.75, 0.75, 0.15, c.roof);
  }
  const a = (p.orientation * Math.PI) / 2;
  return faces.map((f) => ({
    ...f,
    points: f.points.map(([x, y, z]) => [
      x * Math.cos(a) - y * Math.sin(a),
      x * Math.sin(a) + y * Math.cos(a),
      z,
    ]),
  }));
}

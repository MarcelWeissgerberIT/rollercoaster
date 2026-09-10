import type { Building, Point } from "./simulation";
import { furnitureParts, FURNITURE_HEIGHT_PIXELS } from "./furniture";
import { viewDepth, type IsoProject } from "./isometric-view";

export type WeatherObjectKind = "shelter" | "parasol" | "fountain";
export const isWeatherObject = (kind: string): kind is WeatherObjectKind =>
  ["shelter", "parasol", "fountain"].includes(kind);
export type WeatherFace = { points: [number, number, number][]; color: string };

/** Physical metres, shared by park rendering, catalogue pictures and 3D. */
export function weatherObjectFaces(kind: WeatherObjectKind): WeatherFace[] {
  const faces: WeatherFace[] = [];
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    color: string,
    top = color,
    side = color,
  ) => {
    const p = (a: number, b: number, c: number): [number, number, number] => [
      x + (a * w) / 2,
      y + (b * d) / 2,
      z + (c * h) / 2,
    ];
    faces.push(
      { points: [p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1)], color: top },
      { points: [p(-1, 1, -1), p(1, 1, -1), p(1, 1, 1), p(-1, 1, 1)], color },
      { points: [p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), p(1, -1, 1)], color: side },
      { points: [p(-1, -1, -1), p(-1, 1, -1), p(-1, 1, 1), p(-1, -1, 1)], color: side },
      { points: [p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1)], color },
    );
  };
  if (kind !== "fountain") {
    for (const p of furnitureParts(kind === "parasol" ? "picnic" : "bench"))
      box(p.x, p.y, p.z, p.width, p.depth, p.height, p.color, p.top, p.shade);
  }
  if (kind === "shelter") {
    for (const x of [-2, 2])
      for (const y of [-1.35, 1.35])
        box(x, y, 1.22, 0.14, 0.14, 2.44, "#4f8071", "#a4bfa7", "#35604f");
    box(0, 0, 0.035, 4.4, 3.1, 0.07, "#c4b799", "#d9ceb4", "#a99b7a");
    faces.push(
      {
        points: [
          [-2.25, -1.55, 2.48],
          [2.25, -1.55, 2.48],
          [2.25, 0, 3.08],
          [-2.25, 0, 3.08],
        ],
        color: "#658f99",
      },
      {
        points: [
          [-2.25, 0, 3.08],
          [2.25, 0, 3.08],
          [2.25, 1.55, 2.48],
          [-2.25, 1.55, 2.48],
        ],
        color: "#85aeb2",
      },
      {
        points: [
          [2.25, -1.55, 2.48],
          [2.25, 1.55, 2.48],
          [2.25, 0, 3.08],
        ],
        color: "#dbe3cb",
      },
      {
        points: [
          [-2.25, -1.55, 2.48],
          [-2.25, 1.55, 2.48],
          [-2.25, 0, 3.08],
        ],
        color: "#c3d1b9",
      },
    );
    for (const y of [-1.55, 1.55]) box(0, y, 2.46, 4.6, 0.1, 0.12, "#486b69", "#b9d5c9", "#375957");
    for (let i = -3; i <= 3; i++) box(i * 0.57, -1.38, 1.02, 0.4, 0.05, 0.13, "#83a68e");
  } else if (kind === "parasol") {
    box(0, 0, 1.4, 0.12, 0.12, 2.8, "#b39058", "#e3c893", "#826a45");
    box(0, 0, 0.1, 0.6, 0.6, 0.2, "#82948b", "#a9b6a4", "#657b72");
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        b = ((i + 1) * Math.PI) / 4;
      const p: [number, number, number] = [Math.cos(a) * 2.15, Math.sin(a) * 2.15, 2.55];
      const q: [number, number, number] = [Math.cos(b) * 2.15, Math.sin(b) * 2.15, 2.55];
      faces.push({ points: [[0, 0, 3], p, q], color: i % 2 ? "#f4e3b7" : "#93c4b7" });
      faces.push({
        points: [p, q, [q[0], q[1], 2.4], [p[0], p[1], 2.4]],
        color: i % 2 ? "#d7c392" : "#629a8f",
      });
    }
  } else {
    box(0, 0, 0.08, 1.8, 1.7, 0.16, "#c1beab", "#e2ddc7", "#989e92");
    box(0, 0, 0.64, 0.72, 0.8, 1.15, "#6b9d97", "#a8c9b8", "#4e7d78");
    box(0, 0, 1.18, 1.3, 1.2, 0.17, "#b9c4b9", "#e9e5d1", "#93a59b");
    box(0, 0, 1.28, 1.04, 0.92, 0.05, "#5b9faf", "#94d5dc", "#5b9faf");
    for (const x of [-0.6, 0.6]) box(x, 0, 1.31, 0.13, 1.2, 0.19, "#b9c4b9", "#e9e5d1", "#93a59b");
    for (const y of [-0.53, 0.53])
      box(0, y, 1.31, 1.3, 0.13, 0.19, "#b9c4b9", "#e9e5d1", "#93a59b");
    box(0, -0.4, 1.57, 0.11, 0.12, 0.52, "#b2c9c7", "#e8f2e9", "#829b9b");
    box(0, -0.22, 1.8, 0.11, 0.4, 0.11, "#b2c9c7", "#e8f2e9", "#829b9b");
    box(0.25, 0.4, 1.31, 0.2, 0.15, 0.08, "#87b9cf", "#b9dded", "#52788d");
  }
  // Accessible basin at waist height; the spout remains below an adult's head.
  if (kind === "fountain") for (const face of faces) for (const p of face.points) p[2] *= 0.72;
  return faces;
}

const cache = new Map<WeatherObjectKind, WeatherFace[]>();
export function weatherFaces(kind: WeatherObjectKind) {
  if (!cache.has(kind)) cache.set(kind, weatherObjectFaces(kind));
  return cache.get(kind)!;
}

export function drawWeatherObject(
  ctx: CanvasRenderingContext2D,
  b: Building,
  project: IsoProject,
  scale: number,
  alpha = 1,
): Point[][] {
  if (!isWeatherObject(b.kind)) return [];
  const faces = weatherFaces(b.kind)
    .map((face) => ({
      ...face,
      depth:
        face.points.reduce((sum, p) => sum + viewDepth(project, p[0], p[1]) + p[2] * 1.6, 0) /
        face.points.length,
      screen: face.points.map(([x, y, z]) => {
        const p = project(b.x + x / 5, b.y + y / 5);
        return { x: p.x, y: p.y - z * FURNITURE_HEIGHT_PIXELS * scale };
      }),
    }))
    .sort((a, b) => a.depth - b.depth);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = "#42695c";
  ctx.lineWidth = 0.28 * scale;
  ctx.lineJoin = "round";
  for (const face of faces) {
    ctx.beginPath();
    face.screen.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = face.color;
    ctx.fill();
    ctx.stroke();
  }
  if (b.kind === "fountain" && b.riders.length) {
    const p = project(b.x, b.y);
    ctx.strokeStyle = "#bcebf1";
    ctx.lineWidth = 0.7 * scale;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 14.4 * scale);
    ctx.quadraticCurveTo(p.x + 2 * scale, p.y - 13.68 * scale, p.x + scale, p.y - 10.8 * scale);
    ctx.stroke();
  }
  ctx.restore();
  return faces.map((f) => f.screen);
}

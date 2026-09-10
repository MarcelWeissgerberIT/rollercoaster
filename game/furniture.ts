import type { Building, Point } from "./simulation";
import { buildingOrientation, furniturePoint, isRotatableFurniture } from "./building-orientation";

/** Metres in the furniture's local frame, shared by the park canvas and the 3D scene. */
export type FurniturePart = {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  top: string;
  shade: string;
};
const WOOD = ["#bd913f", "#e6bd64", "#956a32"] as const;
const IRON = ["#387565", "#579785", "#285849"] as const;
const part = (
  x: number,
  y: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  colors = WOOD as readonly string[],
): FurniturePart => ({
  x,
  y,
  z,
  width,
  depth,
  height,
  color: colors[0],
  top: colors[1],
  shade: colors[2],
});
const BENCH: FurniturePart[] = [
  ...[-1.54, 1.54].flatMap((x) => [
    ...[-0.21, 0.21].map((y) => part(x, y, 0.21, 0.19, 0.19, 0.42, IRON)),
    ...[-0.21, 0.21].map((y) => part(x, y, 0.04, 0.29, 0.25, 0.08, IRON)),
    part(x, 0, 0.38, 0.22, 0.65, 0.13, IRON),
    part(x, -0.27, 0.48, 0.17, 0.17, 0.9, IRON),
    part(x, 0.22, 0.6, 0.16, 0.16, 0.29, IRON),
    part(x, -0.025, 0.745, 0.23, 0.68, 0.1, IRON),
  ]),
  ...[-0.2, 0, 0.2].map((y) => part(0, y, 0.445, 3.7, 0.18, 0.11)),
  ...[0.66, 0.85].map((z) => part(0, -0.28, z, 3.7, 0.15, 0.16)),
];
const PICNIC: FurniturePart[] = [
  ...[-1.25, 1.25].flatMap((x) => [
    part(x, 0, 0.34, 0.2, 2.24, 0.14, IRON),
    ...[-0.47, 0.47].map((y) => part(x, y, 0.375, 0.18, 0.18, 0.75, IRON)),
    ...[-0.88, 0.88].map((y) => part(x, y, 0.22, 0.18, 0.18, 0.44, IRON)),
  ]),
  ...[-0.405, -0.135, 0.135, 0.405].map((y) => part(0, y, 0.745, 3.7, 0.24, 0.11)),
  ...[-1, 1].flatMap((side) =>
    [-0.12, 0.12].map((offset) => part(0, side * 0.88 + offset, 0.445, 3.5, 0.2, 0.11)),
  ),
];
export const furnitureParts = (kind: "bench" | "picnic"): readonly FurniturePart[] =>
  kind === "bench" ? BENCH : PICNIC;

/** Metre coordinates of the actual cushion surface, shared by both seated guest renderers. */
export const furnitureSeat = (kind: "bench" | "picnic", slot: number) => ({
  x: slot % 2 ? 1.0 : -1.0,
  y: kind === "picnic" ? (slot < 2 ? -0.88 : 0.88) : -0.06,
  height: 0.5,
  yaw: kind === "picnic" && slot >= 2 ? 0 : Math.PI,
});

// The map deliberately exaggerates people vertically; furniture uses the same
// height unit as their cushion anchor. Physical seat/back heights stay in metres.
export const FURNITURE_HEIGHT_PIXELS = 12;

/** Project each slat and leg after rotating in world space; never rotate a flat sprite. */
export function drawFurniture(
  ctx: CanvasRenderingContext2D,
  b: Building,
  project: (x: number, y: number) => Point,
  scale: number,
  alpha = 1,
): Point[][] {
  if (!isRotatableFurniture(b.kind)) return [];
  const faces: { points: Point[]; color: string; depth: number }[] = [];
  const rotated = buildingOrientation(b) % 2 !== 0;
  const p = (x: number, y: number, z: number) => {
    const out = project(x, y);
    return { x: out.x, y: out.y - z * FURNITURE_HEIGHT_PIXELS * scale };
  };
  for (const part of furnitureParts(b.kind)) {
    const center = furniturePoint(b, part.x / 5, part.y / 5),
      w = (rotated ? part.depth : part.width) / 10,
      d = (rotated ? part.width : part.depth) / 10,
      x0 = center.x - w,
      x1 = center.x + w,
      y0 = center.y - d,
      y1 = center.y + d,
      z0 = part.z - part.height / 2,
      z1 = part.z + part.height / 2;
    const depth = center.x + center.y + part.z * 0.08;
    faces.push(
      {
        points: [p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), p(x1, y0, z1)],
        color: part.shade,
        depth,
      },
      {
        points: [p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)],
        color: part.color,
        depth,
      },
      {
        points: [p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)],
        color: part.top,
        depth: depth + 0.0001,
      },
    );
  }
  faces.sort((a, b) => a.depth - b.depth);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineWidth = 0.42 * scale;
  ctx.strokeStyle = "#425e47";
  ctx.lineJoin = "round";
  for (const face of faces) {
    ctx.beginPath();
    face.points.forEach((p, index) => (index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = face.color;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  return faces.map((face) => face.points);
}

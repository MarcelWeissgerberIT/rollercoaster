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
  ...[-1.28, 1.28].flatMap((x) => [
    ...[-0.28, 0.28].map((y) => part(x, y, 0.35, 0.14, 0.14, 0.7, IRON)),
    part(x, 0, 0.63, 0.16, 0.85, 0.13, IRON),
    part(x, -0.36, 1.0, 0.13, 0.14, 1.1, IRON),
    part(x, 0, 1.02, 0.13, 0.76, 0.11, IRON),
  ]),
  ...[-0.24, 0, 0.24].map((y) => part(0, y, 0.73, 3.2, 0.2, 0.14)),
  ...[1.0, 1.28, 1.56].map((z) => part(0, -0.39, z, 3.2, 0.12, 0.2)),
];
const PICNIC: FurniturePart[] = [
  ...[-1.25, 1.25].flatMap((x) => [
    part(x, 0, 0.54, 0.17, 2.55, 0.15, IRON),
    ...[-0.57, 0.57].map((y) => part(x, y, 0.57, 0.17, 0.16, 1.14, IRON)),
    ...[-0.98, 0.98].map((y) => part(x, y, 0.31, 0.17, 0.16, 0.62, IRON)),
  ]),
  ...[-0.45, -0.15, 0.15, 0.45].map((y) => part(0, y, 1.19, 3.7, 0.26, 0.16)),
  ...[-1, 1].flatMap((side) =>
    [-0.13, 0.13].map((offset) => part(0, side * 0.95 + offset, 0.73, 3.5, 0.22, 0.14)),
  ),
];
export const furnitureParts = (kind: "bench" | "picnic"): readonly FurniturePart[] =>
  kind === "bench" ? BENCH : PICNIC;

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
    return { x: out.x, y: out.y - z * 15 * scale };
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

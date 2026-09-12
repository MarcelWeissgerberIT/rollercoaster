import { viewDepth } from "./isometric-view";
import { sceneryFaces, type SceneryPiece } from "./modular-scenery";
/** The main renderer supplies its camera-aware isometric projection. */
export function drawScenery(
  ctx: CanvasRenderingContext2D,
  p: SceneryPiece,
  project: ((x: number, y: number, z?: number) => { x: number; y: number }) & { turn?: number },
  alpha = 1,
) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  const faces = sceneryFaces(p).map((face) => ({
    ...face,
    screen: face.points.map(([x, y, z]) => project(p.x + x / 5, p.y + y / 5, p.z + z / 5)),
  }));
  const depth = (face: (typeof faces)[number]) =>
    face.points.reduce(
      (n, [x, y, z]) => n + viewDepth(project, p.x + x / 5, p.y + y / 5) + z * 0.35,
      0,
    ) / face.points.length;
  faces.sort((a, b) => depth(a) - depth(b));
  for (const face of faces) {
    ctx.beginPath();
    face.screen.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y)));
    ctx.closePath();
    ctx.fillStyle = face.color;
    ctx.fill();
    ctx.strokeStyle = "rgba(62,73,55,.32)";
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  ctx.restore();
}

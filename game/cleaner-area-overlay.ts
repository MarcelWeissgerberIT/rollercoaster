import type { CleanerArea } from "./cleanliness";
type Project = (x: number, y: number, z?: number) => { x: number; y: number };
export type CleanerAreaOverlay = {
  id: number;
  name: string;
  area: CleanerArea;
  selected?: boolean;
  preview?: boolean;
};
const colors = [
  "#438b72",
  "#b47741",
  "#7366b0",
  "#377fba",
  "#b7637f",
  "#777e38",
  "#a65747",
  "#397e80",
];
/** A work-area overlay only. Never changes staff positions, routes or park tiles. */
export function drawCleanerAreas(
  ctx: CanvasRenderingContext2D,
  areas: CleanerAreaOverlay[],
  project: Project,
) {
  ctx.save();
  for (const item of areas) {
    const a = item.area,
      color = colors[(item.id - 1) % colors.length];
    const points = [
      [a.x1 - 0.5, a.y1 - 0.5],
      [a.x2 + 0.5, a.y1 - 0.5],
      [a.x2 + 0.5, a.y2 + 0.5],
      [a.x1 - 0.5, a.y2 + 0.5],
    ].map(([x, y]) => project(x, y));
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = color + (item.selected ? "38" : "12");
    ctx.fill();
    ctx.setLineDash(item.preview ? [8, 5] : []);
    ctx.lineWidth = item.selected ? 3 : 1.5;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.setLineDash([]);
    const p = project((a.x1 + a.x2) / 2, a.y1 - 0.5),
      text = `${item.name}${item.preview ? " · Vorschau" : ""}`;
    ctx.font = "600 12px sans-serif";
    const width = ctx.measureText(text).width + 18;
    ctx.fillStyle = "#fffbed";
    ctx.fillRect(p.x - width / 2, p.y - 27, width, 23);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.fillText(text, p.x, p.y - 11);
  }
  ctx.restore();
}

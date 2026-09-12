import type { Park, Point } from "./simulation";
import { deckHeight, terrainHeight, type ElevatedPath } from "./terrain";
import { PATH_STYLES } from "./park-life";
type Project = (x: number, y: number, z?: number) => Point;
export function drawDeck(
  ctx: CanvasRenderingContext2D,
  s: Park,
  d: ElevatedPath,
  project: Project,
  scale: number,
  cutaway = false,
  ghost = false,
) {
  const underground = d.z + (d.slope === undefined ? 0 : 1) < terrainHeight(s, d.x, d.y);
  if (underground && !cutaway) return;
  const line = (a: Point, b: Point, color: string, w: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w * scale;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };
  const corner = (x: number, y: number, offset = 0) =>
    project(d.x + x, d.y + y, deckHeight(d, d.x + x, d.y + y) + offset);
  ctx.save();
  ctx.globalAlpha = ghost ? 0.65 : 1;
  const corners = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ] as const;
  if (d.z > terrainHeight(s, d.x, d.y))
    for (const [x, y] of corners) {
      line(project(d.x + x, d.y + y, terrainHeight(s, d.x, d.y)), corner(x, y), "#6c826d", 3);
    }
  ctx.beginPath();
  corners.forEach(([x, y], i) => {
    const p = corner(x, y);
    i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = underground
    ? "#c6b8a0"
    : d.type === "queue"
      ? "#7faee0"
      : d.type === "exit"
        ? "#df9a92"
        : PATH_STYLES[d.style].color;
  ctx.fill();
  ctx.strokeStyle = ghost ? "#fff7bf" : "#65786b";
  ctx.lineWidth = 1.4 * scale;
  ctx.stroke();
  const alongX = d.slope === 0 || d.slope === 2 || d.slope === undefined;
  for (let i = -0.4; i < 0.5; i += 0.2)
    line(
      corner(alongX ? i : -0.48, alongX ? -0.48 : i),
      corner(alongX ? i : 0.48, alongX ? 0.48 : i),
      "#63766366",
      0.6,
    );
  for (const side of [-0.46, 0.46]) {
    const a = alongX ? [-0.5, side] : [side, -0.5],
      b = alongX ? [0.5, side] : [side, 0.5];
    line(corner(a[0], a[1], 0.22), corner(b[0], b[1], 0.22), "#f1edcf", 2);
    for (const end of [a, b])
      line(corner(end[0], end[1]), corner(end[0], end[1], 0.22), "#55755f", 1.5);
  }
  ctx.restore();
}
export function drawTerrainFaces(
  ctx: CanvasRenderingContext2D,
  s: Park,
  x: number,
  y: number,
  project: Project,
) {
  const z = terrainHeight(s, x, y);
  if (!z) return;
  for (const [dx, dy, ax, ay, bx, by] of [
    [1, 0, 0.5, -0.5, 0.5, 0.5],
    [0, 1, -0.5, 0.5, 0.5, 0.5],
    [-1, 0, -0.5, -0.5, -0.5, 0.5],
    [0, -1, -0.5, -0.5, 0.5, -0.5],
  ]) {
    const base = terrainHeight(s, x + dx, y + dy);
    if (base >= z) continue;
    const p = [
      project(x + ax, y + ay, z),
      project(x + bx, y + by, z),
      project(x + bx, y + by, base),
      project(x + ax, y + ay, base),
    ];
    ctx.beginPath();
    p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    ctx.fillStyle = dx === 1 ? "#987b51" : "#796745";
    ctx.fill();
  }
}
export function pickTerrain(
  s: Park,
  x: number,
  y: number,
  project: Project,
  tw: number,
  th: number,
  fallback: Point,
) {
  let result = fallback,
    best = -Infinity;
  for (const [k, z] of Object.entries(s.terrain ?? {})) {
    const [gx, gy] = k.split(",").map(Number),
      p = project(gx, gy, z);
    if (Math.abs(x - p.x) / tw + Math.abs(y - p.y) / th <= 1 && p.y + z * 1000 > best) {
      result = { x: gx, y: gy };
      best = p.y + z * 1000;
    }
  }
  return result;
}

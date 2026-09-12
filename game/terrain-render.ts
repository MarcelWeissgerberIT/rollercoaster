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
  const z = terrainHeight(s, x, y),
    center = project(x, y, z),
    screenScale = Math.abs(project(x, y, z - 1).y - center.y) / 24;
  const fillFace = (points: Point[], color: string) => {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  for (const [dx, dy, ax, ay, bx, by] of [
    [1, 0, 0.5, -0.5, 0.5, 0.5],
    [0, 1, -0.5, 0.5, 0.5, 0.5],
    [-1, 0, -0.5, -0.5, -0.5, 0.5],
    [0, -1, -0.5, -0.5, 0.5, -0.5],
  ]) {
    const base = terrainHeight(s, x + dx, y + dy);
    // The two faces turned towards the camera are opaque. Back faces must not
    // spill across lower cells when the player rotates the map by 90 degrees.
    if (base >= z || project(x + dx, y + dy, z).y <= center.y) continue;
    const at = (f: number, height: number) =>
      project(x + ax + (bx - ax) * f, y + ay + (by - ay) * f, height);
    const light = dx !== 0,
      rock = light ? "#9a9175" : "#7b8067",
      soil = light ? "#a78858" : "#867247",
      turf = light ? "#7fa148" : "#668a3d";
    fillFace([at(0, z), at(1, z), at(1, base), at(0, base)], rock);
    const soilBase = Math.max(base, z - 0.24);
    fillFace([at(0, z), at(1, z), at(1, soilBase), at(0, soilBase)], soil);
    // A narrow grass lip makes each ledge read as a grassy terrace rather than
    // a stack of brown boxes. Small uneven roots break up its straight edge.
    fillFace(
      [
        at(0, z),
        at(1, z),
        at(1, z - 0.06),
        at(0.78, z - 0.1),
        at(0.54, z - 0.065),
        at(0.3, z - 0.09),
        at(0, z - 0.06),
      ],
      turf,
    );
    ctx.strokeStyle = light ? "#c0b28b66" : "#a4a18166";
    ctx.lineWidth = Math.max(0.5, screenScale * 0.75);
    for (let level = Math.floor(base * 2 + 1) / 2; level < z - 0.28; level += 0.5) {
      const wobble = ((x * 13 + y * 7 + level * 2) % 5) * 0.008;
      const points = [at(0, level), at(0.4, level + wobble), at(1, level - 0.025)];
      ctx.beginPath();
      points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    }
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
  for (let gy = 0; gy < s.tiles.length; gy++)
    for (let gx = 0; gx < s.tiles[gy].length; gx++) {
      const z = terrainHeight(s, gx, gy),
        p = project(gx, gy, z),
        depth = project(gx, gy, 0).y;
      if (Math.abs(x - p.x) / tw + Math.abs(y - p.y) / th <= 1 && depth > best) {
        result = { x: gx, y: gy };
        best = depth;
      }
    }
  return result;
}

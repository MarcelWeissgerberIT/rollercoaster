import type { Park, Point } from "./simulation";
import { deckHeight, terrainHeight, type ElevatedPath } from "./terrain";
import { PATH_STYLES } from "./park-life";
import { terrainCellSurface, withTerrainSurfaceScope } from "./terrain-surface";
type Project = (x: number, y: number, z?: number) => Point;

export function drawTerrainTop(
  ctx: CanvasRenderingContext2D,
  s: Park,
  x: number,
  y: number,
  project: Project,
  color: string,
  grid = false,
) {
  const ring = terrainCellSurface(s, x, y),
    center = { x, y, z: terrainHeight(s, x, y) },
    point = (p: typeof center) => project(p.x, p.y, p.z),
    polygon = (points: Point[], fill: string) => {
      ctx.beginPath();
      points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };
  const flat = ring.every((p) => p.z === center.z);
  if (flat) polygon(ring.map(point), color);
  // A summit can rise above its projected rim; draw the actual center fan.
  else
    for (let i = 0; i < ring.length; i++) {
      polygon([point(center), point(ring[i]), point(ring[(i + 1) % ring.length])], color);
      if (s.tiles[y][x] === "grass") {
        const a = ring[i],
          b = ring[(i + 1) % ring.length],
          dx = (a.z - center.z) * (b.y - y) - (b.z - center.z) * (a.y - y),
          dy = (a.x - x) * (b.z - center.z) - (b.x - x) * (a.z - center.z),
          shade = Math.max(-0.09, Math.min(0.1, (dx + dy) * 0.2));
        if (Math.abs(shade) > 0.005)
          polygon(
            [point(center), point(a), point(b)],
            shade > 0 ? `rgba(33,66,29,${shade})` : `rgba(235,241,177,${-shade})`,
          );
      }
    }
  if (grid) {
    ctx.beginPath();
    ring.map(point).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.strokeStyle = "#28522030";
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
}
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
  if (s.naturalTerrain) {
    const ring = terrainCellSurface(s, x, y),
      center = project(x, y, terrainHeight(s, x, y));
    for (const [i, dx, dy] of [
      [0, 0, -1],
      [1, 1, 0],
      [2, 0, 1],
      [3, -1, 0],
    ]) {
      if (project(x + dx, y + dy, terrainHeight(s, x, y)).y <= center.y) continue;
      const a = ring[i],
        b = ring[(i + 1) % 4],
        neighbor =
          s.tiles[y + dy]?.[x + dx] === undefined
            ? undefined
            : terrainCellSurface(s, x + dx, y + dy),
        lowA = neighbor?.[(i + 3) % 4].z ?? Math.min(0, a.z),
        lowB = neighbor?.[(i + 2) % 4].z ?? Math.min(0, b.z);
      if (lowA >= a.z && lowB >= b.z) continue;
      const points = [
        project(a.x, a.y, a.z),
        project(b.x, b.y, b.z),
        project(b.x, b.y, Math.min(lowB, b.z)),
        project(a.x, a.y, Math.min(lowA, a.z)),
      ];
      ctx.beginPath();
      points.forEach((p, at) => (at ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = dx ? "#8e9270" : "#777f5a";
      ctx.fill();
    }
    return;
  }
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
  return withTerrainSurfaceScope(s, () => pickSurface(s, x, y, project, tw, th, fallback));
}
function pickSurface(
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
      const inside = s.naturalTerrain
        ? terrainCellSurface(s, gx, gy)
            .map((q) => project(q.x, q.y, q.z))
            .some((a, i, ring) =>
              [p, a, ring[(i + 1) % ring.length]].reduce((hit, a, i, triangle) => {
                const b = triangle[(i + 1) % triangle.length];
                return a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
                  ? !hit
                  : hit;
              }, false),
            )
        : Math.abs(x - p.x) / tw + Math.abs(y - p.y) / th <= 1;
      if (inside && depth > best) {
        result = { x: gx, y: gy };
        best = depth;
      }
    }
  return result;
}

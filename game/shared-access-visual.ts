import type { Park, Point } from "./simulation";
import { getSharedAccessLanes } from "./shared-access";
import type { IsoProject } from "./isometric-view";

export type SharedAccessTile = {
  buildingId: number;
  cell: Point;
  entry: Point[];
  exit: Point[];
  divider: Point[];
  arrows: { role: "entry" | "exit"; center: Point; direction: Point }[];
};
export const SHARED_ACCESS_COLORS = { entry: "#79aadd", exit: "#db8b81", line: "#fff5e4" };

function contains(polygon: Point[], point: Point) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}

/** Split a square by the real centreline, including L corners. Both views consume
 * these same polygons; a corner never paints one lane across the other lane. */
export function sharedAccessTiles(park: Park): SharedAccessTile[] {
  const tiles: SharedAccessTile[] = [];
  for (const building of park.buildings) {
    if (!building.sharedAccess) continue;
    const lanes = getSharedAccessLanes(park, building);
    lanes.route.forEach((cell, index) => {
      if (park.tiles[cell.y]?.[cell.x] !== "queue") return;
      const entry = lanes.entry[index],
        exit = lanes.exit[index],
        nx = exit.x - entry.x,
        ny = exit.y - entry.y,
        length = Math.hypot(nx, ny) || 1,
        outward = { x: ny / length, y: -nx / length },
        previous = lanes.route[index - 1] ?? { x: cell.x - outward.x, y: cell.y - outward.y },
        next = lanes.route[index + 1] ?? { x: cell.x + outward.x, y: cell.y + outward.y },
        a = { x: (previous.x + cell.x) / 2, y: (previous.y + cell.y) / 2 },
        b = { x: (next.x + cell.x) / 2, y: (next.y + cell.y) / 2 };
      const corners = [
        { x: cell.x - 0.5, y: cell.y - 0.5 },
        { x: cell.x + 0.5, y: cell.y - 0.5 },
        { x: cell.x + 0.5, y: cell.y + 0.5 },
        { x: cell.x - 0.5, y: cell.y + 0.5 },
      ];
      const perimeter = (p: Point) =>
        Math.abs(p.y - cell.y + 0.5) < 0.001
          ? p.x - cell.x + 0.5
          : Math.abs(p.x - cell.x - 0.5) < 0.001
            ? 1 + p.y - cell.y + 0.5
            : Math.abs(p.y - cell.y - 0.5) < 0.001
              ? 2 + 0.5 - p.x + cell.x
              : 3 + 0.5 - p.y + cell.y;
      const boundary = (from: Point, to: Point) => {
        const start = perimeter(from),
          end = perimeter(to) + (perimeter(to) <= start ? 4 : 0),
          result: Point[] = [];
        for (let i = Math.floor(start) + 1; i < end; i++) result.push(corners[i % 4]);
        return result;
      };
      const first = [a, cell, b, ...boundary(b, a)],
        second = [b, cell, a, ...boundary(a, b)],
        exitFirst = contains(first, exit);
      tiles.push({
        buildingId: building.id,
        cell,
        entry: exitFirst ? second : first,
        exit: exitFirst ? first : second,
        divider: [a, cell, b],
        arrows: [
          { role: "entry", center: entry, direction: { x: -outward.x, y: -outward.y } },
          { role: "exit", center: exit, direction: outward },
        ],
      });
    });
  }
  return tiles;
}

export function sharedArrowSegments(center: Point, direction: Point): [Point, Point][] {
  const end = { x: center.x + direction.x * 0.18, y: center.y + direction.y * 0.18 };
  return [
    [{ x: center.x - direction.x * 0.18, y: center.y - direction.y * 0.18 }, end],
    ...[-1, 1].map((side): [Point, Point] => [
      end,
      {
        x: center.x - direction.x * 0.02 - direction.y * side * 0.075,
        y: center.y - direction.y * 0.02 + direction.x * side * 0.075,
      },
    ]),
  ];
}

export function drawSharedAccessTile(
  ctx: CanvasRenderingContext2D,
  tile: SharedAccessTile,
  project: IsoProject,
  scale: number,
) {
  ctx.save();
  for (const role of ["entry", "exit"] as const) {
    ctx.beginPath();
    tile[role].forEach((p, i) => {
      const q = project(p.x, p.y);
      if (i) ctx.lineTo(q.x, q.y);
      else ctx.moveTo(q.x, q.y);
    });
    ctx.closePath();
    ctx.fillStyle = SHARED_ACCESS_COLORS[role];
    ctx.fill();
  }
  ctx.strokeStyle = SHARED_ACCESS_COLORS.line;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  tile.divider.forEach((p, i) => {
    const q = project(p.x, p.y);
    if (i) ctx.lineTo(q.x, q.y);
    else ctx.moveTo(q.x, q.y);
  });
  ctx.lineWidth = 0.9 * scale;
  ctx.stroke();
  ctx.lineWidth = 1.3 * scale;
  for (const arrow of tile.arrows)
    for (const [a, b] of sharedArrowSegments(arrow.center, arrow.direction)) {
      const pa = project(a.x, a.y),
        pb = project(b.x, b.y);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
  ctx.restore();
}

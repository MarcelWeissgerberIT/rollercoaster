/** Detailed, articulated ride access. Coordinates are metres in the shared tile layout. */
import type { Point } from "./simulation";
import type { AccessLayout, AccessPose, GateMotion } from "./ride-access";
import type { PodRole } from "./pods";
import { viewFacing, type IsoProject } from "./isometric-view";
type Local = [number, number, number]; // tangent, outward, height
export type AccessProject = IsoProject;
export type AccessHitPolygon = Point[];
const INK = "#35594f",
  CREAM = "#fff3d6",
  BLUE = "#528db5",
  RED = "#c86c65";
function painter(
  ctx: CanvasRenderingContext2D,
  pose: { x: number; y: number; dx: number; dy: number },
  project: AccessProject,
  scale: number,
  hits?: AccessHitPolygon[],
) {
  const tx = -pose.dy,
    ty = pose.dx,
    facing = viewFacing(project, pose.dx, pose.dy),
    tangent = viewFacing(project, tx, ty);
  const p = ([x, z, h]: Local): Point => {
    const q = project(pose.x + (x * tx + z * pose.dx) / 5, pose.y + (x * ty + z * pose.dy) / 5);
    return { x: q.x, y: q.y - h * 15 * scale };
  };
  const poly = (points: Local[], color: string, edge = INK) => {
    const projected = points.map(p);
    hits?.push(projected);
    ctx.beginPath();
    projected.forEach((s, i) => {
      if (i) ctx.lineTo(s.x, s.y);
      else ctx.moveTo(s.x, s.y);
    });
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (edge) {
      ctx.strokeStyle = edge;
      ctx.lineWidth = 0.55 * scale;
      ctx.stroke();
    }
  };
  const line = (a: Local, b: Local, color: string, width = 0.07) => {
    const pa = p(a),
      pb = p(b);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.45, width * 8) * scale;
    if (hits) {
      const dx = pb.x - pa.x,
        dy = pb.y - pa.y,
        length = Math.hypot(dx, dy),
        radius = ctx.lineWidth / 2,
        nx = length ? (-dy / length) * radius : radius,
        ny = length ? (dx / length) * radius : 0;
      hits.push([
        { x: pa.x + nx, y: pa.y + ny },
        { x: pb.x + nx, y: pb.y + ny },
        { x: pb.x - nx, y: pb.y - ny },
        { x: pa.x - nx, y: pa.y - ny },
      ]);
    }
    ctx.lineCap = "round";
    ctx.stroke();
  };
  const box = (
    x: number,
    z: number,
    h: number,
    w: number,
    d: number,
    height: number,
    color: string,
    shade = color,
    top = CREAM,
  ) => {
    const l = x - w / 2,
      r = x + w / 2,
      b = z - d / 2,
      f = z + d / 2,
      u = h + height;
    if (facing.x + facing.y > 0)
      poly(
        [
          [l, f, h],
          [r, f, h],
          [r, f, u],
          [l, f, u],
        ],
        color,
      );
    else
      poly(
        [
          [r, b, h],
          [l, b, h],
          [l, b, u],
          [r, b, u],
        ],
        color,
      );
    if (tangent.x + tangent.y > 0)
      poly(
        [
          [r, f, h],
          [r, b, h],
          [r, b, u],
          [r, f, u],
        ],
        shade,
      );
    else
      poly(
        [
          [l, b, h],
          [l, f, h],
          [l, f, u],
          [l, b, u],
        ],
        shade,
      );
    poly(
      [
        [l, b, u],
        [r, b, u],
        [r, f, u],
        [l, f, u],
      ],
      top,
    );
  };
  const lamp = (q: Local, on: boolean) => {
    const s = p(q);
    hits?.push(
      Array.from({ length: 12 }, (_, i) => ({
        x: s.x + Math.cos((i * Math.PI) / 6) * 1.1 * scale,
        y: s.y + Math.sin((i * Math.PI) / 6) * 1.1 * scale,
      })),
    );
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1.1 * scale, 0, Math.PI * 2);
    ctx.fillStyle = on ? "#bbe991" : "#dc927b";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.35 * scale;
    ctx.stroke();
  };
  const sign = (q: Local, label: string, color: string) => {
    const s = p(q);
    ctx.font = `bold ${4.2 * scale}px sans-serif`;
    ctx.textAlign = "center";
    const width = (label.length * 2.55 + 4) * scale;
    hits?.push([
      { x: s.x - width / 2, y: s.y - 3.8 * scale },
      { x: s.x + width / 2, y: s.y - 3.8 * scale },
      { x: s.x + width / 2, y: s.y + 2.4 * scale },
      { x: s.x - width / 2, y: s.y + 2.4 * scale },
    ]);
    ctx.fillStyle = CREAM;
    ctx.fillRect(s.x - width / 2, s.y - 3.8 * scale, width, 6.2 * scale);
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.6 * scale;
    ctx.strokeRect(s.x - width / 2, s.y - 3.8 * scale, width, 6.2 * scale);
    ctx.fillStyle = INK;
    ctx.fillText(label, s.x, s.y + 0.5 * scale);
  };
  return { p, poly, line, box, lamp, sign };
}
export function drawAccessPod(
  ctx: CanvasRenderingContext2D,
  pose: AccessPose,
  role: PodRole,
  motion: GateMotion,
  project: AccessProject,
  scale: number,
  boothSide = -1,
  hits?: AccessHitPolygon[],
) {
  const { poly, line, box, lamp, sign } = painter(ctx, pose, project, scale, hits),
    entry = role === "entry",
    color = entry ? BLUE : RED;
  ctx.save();
  // Contrasting paving and a clear opening: the path passes THROUGH the gateway.
  box(
    0,
    0.08,
    0,
    2.85,
    2.1,
    0.06,
    entry ? "#8eb9ce" : "#d9a197",
    "#899d91",
    entry ? "#c2dbe1" : "#eed0bb",
  );
  for (const x of [-1.42, 1.42]) {
    line([x, -0.88, 0.12], [x, 1, 0.12], "#bdac84", 0.065);
    for (const z of [-0.88, 0.92]) box(x, z, 0.08, 0.075, 0.075, 0.9, CREAM, "#b8baa2");
    line([x, -0.88, 0.94], [x, 0.92, 0.94], CREAM, 0.085);
  }
  // Portal columns have footings, inset panels, brass trim and a shallow canopy.
  for (const x of [-1.2, 1.2]) {
    box(x, 0, 0.06, 0.3, 0.34, 0.16, "#aaa88c", "#858e7c");
    box(x, 0, 0.22, 0.18, 0.2, 2.28, CREAM, "#c8d1b8");
    box(x, 0, 0.42, 0.19, 0.21, 0.36, color, color);
    box(x, 0, 2.4, 0.27, 0.3, 0.1, "#d7b76d", "#ae8d50");
  }
  box(0, 0, 2.48, 2.95, 0.84, 0.16, color, entry ? "#3d718e" : "#a15150", CREAM);
  box(
    0,
    0,
    2.64,
    3.1,
    0.98,
    0.08,
    entry ? "#709eb6" : "#d48e7d",
    color,
    entry ? "#86b6c6" : "#e0a592",
  );
  for (const x of [-0.85, -0.42, 0, 0.42, 0.85])
    line([x, 0.47, 2.69], [x, -0.47, 2.69], "#ebddb7", 0.035);
  if (entry) {
    const x = boothSide * 1.8,
      z = 0.65;
    box(x, z, 0.06, 1, 1.25, 0.16, "#7c8070", "#606e65");
    box(x, z, 0.22, 0.93, 1.18, 0.67, "#bd9768", "#98764f");
    for (const stripe of [-0.3, 0, 0.3])
      line([x + stripe, z + 0.6, 0.27], [x + stripe, z + 0.6, 0.83], "#e6c797", 0.045);
    box(x, z, 0.89, 0.94, 1.2, 0.78, "#83b8c3", "#5792a4", "#c2dedd");
    // Ticket window frame and counter on both visible sides.
    for (const px of [x - 0.47, x + 0.47])
      for (const pz of [z - 0.6, z + 0.6]) line([px, pz, 0.83], [px, pz, 1.77], CREAM, 0.1);
    box(x, z, 1.7, 1.09, 1.35, 0.14, color, "#346b82", CREAM);
    box(x, z, 1.78, 1.2, 1.45, 0.09, "#5c97ac", "#3c7387", "#8eb5bc");
    line([x - 0.46, z + 0.62, 1.23], [x + 0.46, z + 0.62, 1.23], CREAM, 0.055);
    line([x - 0.25, z + 0.63, 1.36], [x + 0.15, z + 0.63, 1.61], "#d7ece5", 0.045);
    box(x, z + 0.65, 0.91, 1.14, 0.2, 0.09, CREAM, "#c4a67a");
    box(boothSide * 1.08, 0.35, 0.86, 0.19, 0.2, 0.32, "#3a5055", "#263d43", "#a8cdce");
    lamp([boothSide * 1.08, 0.47, 1.06], motion.open > 0.3);
  }
  // A hinged barrier sweeps clear of the passage, synchronized to actual boarding/unloading.
  const angle = (motion.open * Math.PI) / 2,
    end: Local = [-1.1 + Math.cos(angle) * 2.2, Math.sin(angle) * 2.2 * (entry ? -1 : 1), 1.03];
  line([-1.1, 0, 1.03], end, color, 0.13);
  line([-1.1, 0, 1.1], [end[0], end[1], 1.1], CREAM, 0.065);
  for (const t of [0.22, 0.48, 0.74]) {
    const x = -1.1 + (end[0] + 1.1) * t,
      z = end[1] * t;
    line([x, z, 0.28], [x, z, 1], CREAM, 0.055);
  }
  box(-1.1, 0, 0.06, 0.13, 0.16, 1.1, color, "#718785");
  lamp([1.2, 0.13, 2.24], motion.open > 0.3);
  // Ground arrows remain visible even when the barrier is open.
  const dz = entry ? -1 : 1;
  line([0, 0.36 - dz * 0.27, 0.09], [0, 0.36 + dz * 0.36, 0.09], CREAM, 0.13);
  line([0, 0.36 + dz * 0.36, 0.09], [-0.23, 0.36 + dz * 0.1, 0.09], CREAM, 0.11);
  line([0, 0.36 + dz * 0.36, 0.09], [0.23, 0.36 + dz * 0.1, 0.09], CREAM, 0.11);
  sign([0, 0.06, 2.42], entry ? "EINLASS" : "AUSGANG", color);
  ctx.restore();
}
export function drawAccessCabin(
  ctx: CanvasRenderingContext2D,
  layout: AccessLayout,
  project: AccessProject,
  scale: number,
  stage: "back" | "front",
  running: boolean,
  hits?: AccessHitPolygon[],
) {
  const c = layout.cabin,
    { box, line, poly, lamp, sign } = painter(ctx, c, project, scale, hits),
    w = c.width * 5,
    d = c.depth * 5;
  // Match the view-facing cutaway to the camera. Lower front walls overlap the driver,
  // while the glazing, rear walls and partial roof render behind the actual person.
  const facing = viewFacing(project, c.dx, c.dy),
    tangent = viewFacing(project, -c.dy, c.dx),
    frontZ = facing.x + facing.y > 0 ? 1 : -1,
    frontX = tangent.x + tangent.y > 0 ? 1 : -1;
  ctx.save();
  if (stage === "back") {
    box(0, 0, 0, w + 0.14, d + 0.14, 0.12, "#989c89", "#737f71", "#e1d8b9");
    box(0, -frontZ * (d / 2 - 0.06), 0.12, w, 0.12, 0.8, BLUE, "#386b83", CREAM);
    box(-frontX * (w / 2 - 0.06), 0, 0.12, 0.12, d, 0.8, BLUE, "#386b83", CREAM);
    box(0, -frontZ * (d / 2 - 0.07), 0.98, w - 0.24, 0.06, 1.12, "#a6d0d3", "#8fb8c6", "#d0e4dd");
    box(-frontX * (w / 2 - 0.07), 0, 0.98, 0.06, d - 0.24, 1.12, "#a6d0d3", "#8fb8c6", "#d0e4dd");
    for (const x of [-w / 2, w / 2])
      for (const z of [-d / 2, d / 2]) line([x, z, 0.14], [x, z, 2.36], CREAM, 0.105);
    line([-w / 2, (-frontZ * d) / 2, 1.47], [w / 2, (-frontZ * d) / 2, 1.47], CREAM, 0.07);
    line([(-frontX * w) / 2, -d / 2, 1.47], [(-frontX * w) / 2, d / 2, 1.47], CREAM, 0.07);
    box(0, -frontZ * (d / 2 - 0.3), 2.33, w + 0.24, 0.75, 0.18, "#597b80", "#365762", "#82a8a5");
    // Console faces the actual control post, whose heading is the outward normal.
    box(0, 0.51, 0.12, 0.98, 0.42, 0.83, "#4b6462", "#31494c", "#324f56");
    box(-0.23, 0.51, 0.98, 0.36, 0.28, 0.045, "#94c6bc", "#517d78", "#c8dfb6");
    lamp([0.22, 0.49, 1], running);
    lamp([0.36, 0.49, 1], false);
    line([0.11, 0.58, 0.95], [0.11, 0.58, 1.16], "#303f43", 0.08);
    box(-w * 0.3, -d * 0.32, 0.18, 0.53, 0.52, 0.48, "#57706b", "#3c5755", "#b5bb98");
  } else {
    box(0, frontZ * (d / 2 - 0.04), 0.12, w, 0.09, 0.68, BLUE, "#396780", CREAM);
    box(frontX * (w / 2 - 0.04), 0, 0.12, 0.09, d, 0.68, BLUE, "#396780", CREAM);
    for (const x of [-w / 2, w / 2]) line([x, -d / 2, 0.84], [x, d / 2, 0.84], CREAM, 0.08);
    for (const z of [-d / 2, d / 2]) line([-w / 2, z, 0.84], [w / 2, z, 0.84], CREAM, 0.08);
    // Front windows are open as a deliberate cutaway, preserving sight of hands and face.
    for (const z of [-d / 2, d / 2]) line([-w / 2, z, 2.31], [w / 2, z, 2.31], CREAM, 0.1);
    line([-w / 2, -d / 2, 2.31], [-w / 2, d / 2, 2.31], CREAM, 0.1);
    line([w / 2, -d / 2, 2.31], [w / 2, d / 2, 2.31], CREAM, 0.1);
    sign([0, (frontZ * d) / 2, 0.47], "BEDIENUNG", BLUE);
  }
  ctx.restore();
}

import type { Point } from "./simulation";
import { viewDepth, type IsoProject } from "./isometric-view";
import {
  tunnelRingPoint,
  TUNNEL_INNER_RADIUS,
  TUNNEL_PORTAL_RADIUS,
  type TunnelPortal,
} from "./coaster-tunnels";

/** Project the same transported ring as the 3D lining. The dark recess belongs behind
 * the masonry and the two running rails continue into its open center. */
export function drawCoasterTunnelPortal(
  ctx: CanvasRenderingContext2D,
  portal: TunnelPortal,
  project: IsoProject,
  scale: number,
) {
  const f = portal.frame,
    facing = viewDepth(project, portal.outward.x, portal.outward.y);
  if (facing <= 0.025) return;
  const at = (angle: number, radius: number) => {
      const p = tunnelRingPoint(f, angle, radius);
      return project(p.x, p.y, p.z);
    },
    polygon = (points: Point[], fill: string, stroke?: string) => {
      ctx.beginPath();
      points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = Math.max(0.65, scale * 0.8);
        ctx.stroke();
      }
    },
    count = 20;
  ctx.save();
  polygon(
    Array.from({ length: count }, (_, i) => at((i * Math.PI * 2) / count, TUNNEL_INNER_RADIUS)),
    "#25322e",
  );
  // A smaller inner arch creates depth, with no painted earth across the rail aperture.
  const recess = {
    ...f,
    x: f.x - portal.outward.x * 0.28,
    y: f.y - portal.outward.y * 0.28,
    z: f.z - portal.outward.z * 0.28,
  };
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI * 2) / count,
      b = ((i + 1) * Math.PI * 2) / count,
      inside = [a, b].map((angle) => {
        const p = tunnelRingPoint(recess, angle, TUNNEL_INNER_RADIUS * 0.9);
        return project(p.x, p.y, p.z);
      });
    polygon(
      [at(a, TUNNEL_INNER_RADIUS), at(b, TUNNEL_INNER_RADIUS), inside[1], inside[0]],
      i < count / 2 ? "#555f51" : "#404c42",
    );
  }
  for (const side of [-0.15, 0.15]) {
    ctx.beginPath();
    for (const [index, along] of [-0.23, 0.13].entries()) {
      const p = project(
        f.x + f.right.x * side + portal.outward.x * along,
        f.y + f.right.y * side + portal.outward.y * along,
        f.z + f.right.z * side + portal.outward.z * along - 0.22,
      );
      index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    }
    ctx.strokeStyle =
      portal.style === "wood" ? "#d9d4b8" : portal.style === "launch" ? "#59bbb1" : "#d97b61";
    ctx.lineWidth = 2.1 * scale;
    ctx.stroke();
  }
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI * 2) / count,
      b = ((i + 1) * Math.PI * 2) / count;
    polygon(
      [
        at(a, TUNNEL_INNER_RADIUS),
        at(b, TUNNEL_INNER_RADIUS),
        at(b, TUNNEL_PORTAL_RADIUS),
        at(a, TUNNEL_PORTAL_RADIUS),
      ],
      ["#b2aa8d", "#a49e82", "#beb494", "#aba58a"][i % 4],
      "#737961",
    );
  }
  ctx.restore();
}

import { staffPose, staffYaw, type StaffMotion, type V3 } from "./staff-animation";

/** Project articulated joints into the same isometric view as the park sprites. */
export function drawStaff(
  ctx: CanvasRenderingContext2D,
  m: StaffMotion,
  x: number,
  y: number,
  scale: number,
) {
  const yaw = staffYaw(m.heading),
    c = Math.cos(yaw),
    s = Math.sin(yaw);
  const project = (p: V3) => {
    const wx = p[0] * c + p[2] * s,
      wz = -p[0] * s + p[2] * c;
    return {
      x: x + (wx - wz) * 9 * scale,
      y: y + ((wx + wz) * 4.5 - p[1] * 15) * scale,
      depth: wx + wz,
    };
  };
  ctx.save();
  ctx.fillStyle = "rgba(36,59,33,0.19)";
  ctx.beginPath();
  ctx.ellipse(x, y + 1 * scale, 4.5 * scale, 2 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  const parts = staffPose(m).map((part) => ({
    part,
    a: project(part.a),
    b: part.b ? project(part.b) : undefined,
  }));
  parts.sort(
    (a, b) =>
      (a.a.depth + (a.b?.depth ?? a.a.depth)) / 2 - (b.a.depth + (b.b?.depth ?? b.a.depth)) / 2,
  );
  ctx.lineCap = "round";
  for (const { part, a, b } of parts) {
    ctx.fillStyle = part.color;
    ctx.strokeStyle = "#304139";
    if (b) {
      ctx.lineWidth = (part.size[0] * 23 + 0.6) * scale;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = part.color;
      ctx.lineWidth = part.size[0] * 23 * scale;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      if (part.size[0] > 0.045) {
        ctx.strokeStyle = "rgba(255,249,211,0.19)";
        ctx.lineWidth = 0.5 * scale;
        ctx.beginPath();
        ctx.moveTo(a.x - 0.5 * scale, a.y);
        ctx.lineTo(b.x - 0.5 * scale, b.y);
        ctx.stroke();
      }
    } else {
      const rx = Math.max(0.12, Math.hypot(part.size[0], part.size[2]) * 8.5) * scale,
        ry = Math.max(0.1, Math.hypot(part.size[1] * 15, part.size[2] * 3.5)) * scale;
      ctx.lineWidth = 0.45 * scale;
      ctx.beginPath();
      ctx.ellipse(a.x, a.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      if (Math.min(rx, ry) > 0.6 * scale) ctx.stroke();
    }
  }
  ctx.restore();
}

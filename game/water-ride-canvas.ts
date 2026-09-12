import type { Building, Point } from "./simulation";
import {
  rapidsChannel,
  rapidsPose,
  rapidsSeatPose,
  rapidsPhase,
  RAPIDS_BOATS,
  RAPIDS_SEATS,
} from "./water-rides";
export function drawWaterRide(
  ctx: CanvasRenderingContext2D,
  b: Building,
  project: (x: number, y: number, z: number) => { x: number; y: number },
  scale: number,
  rider: (id: number | undefined, p: Point, yaw: number) => void,
  alpha = 1,
) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  const cx = b.x + 2.5,
    cy = b.y + 2.5,
    base = b.z ?? 0;
  const pr = (x: number, y: number, z: number) => project(cx + x / 5, cy + y / 5, base + z / 5);
  const line = (color: string, width: number, offset = 0) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width * scale;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i <= 128; i++) {
      const p = rapidsChannel(i / 128),
        a = pr(p.x, p.z, p.y + offset);
      i ? ctx.lineTo(a.x, a.y) : ctx.moveTo(a.x, a.y);
    }
    ctx.stroke();
  };
  line("#81755d", 14, -0.28);
  line("#cbb78c", 13, 0.05);
  line("#377c91", 10, 0.1);
  line("#68bed0", 7, 0.15);
  for (let i = 0; i < 32; i++) {
    const p = rapidsChannel(i / 32),
      p2 = rapidsChannel(i / 32 + 0.005),
      a = pr(p.x, p.z, p.y + 0.2),
      c = pr(p2.x, p2.z, p2.y + 0.2);
    ctx.strokeStyle = i % 3 ? "#b4e4e1" : "#ecfaf0";
    ctx.lineWidth = 1.2 * scale;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
  }
  // The same rocky island as the 3D rig makes the complete ride footprint legible.
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6,
      p = pr(Math.cos(angle) * 5.8, Math.sin(angle) * 4.2, 0.65 + (i % 3) * 0.2);
    ctx.beginPath();
    ctx.moveTo(p.x - 4 * scale, p.y);
    ctx.lineTo(p.x - 3 * scale, p.y - 4 * scale);
    ctx.lineTo(p.x + 1 * scale, p.y - 6 * scale);
    ctx.lineTo(p.x + 4 * scale, p.y - 2 * scale);
    ctx.lineTo(p.x + 3 * scale, p.y + scale);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? "#8f9986" : "#b5af97";
    ctx.fill();
    ctx.strokeStyle = "#737d68";
    ctx.lineWidth = 0.6 * scale;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x - 3 * scale, p.y - 4 * scale);
    ctx.lineTo(p.x + 1 * scale, p.y - 6 * scale);
    ctx.lineTo(p.x + 4 * scale, p.y - 2 * scale);
    ctx.lineTo(p.x, p.y - 2 * scale);
    ctx.closePath();
    ctx.fillStyle = "#c4c6ad";
    ctx.fill();
  }
  const phase = rapidsPhase(b),
    boats = Array.from({ length: RAPIDS_BOATS }, (_, i) => ({ i, p: rapidsPose(i, phase) }));
  boats.sort((a, c) => pr(a.p.x, a.p.z, a.p.y).y - pr(c.p.x, c.p.z, c.p.y).y);
  for (const { i, p } of boats) {
    const a = pr(p.x, p.z, p.y + 0.25);
    ctx.fillStyle = "#34595b";
    ctx.beginPath();
    ctx.ellipse(a.x, a.y, 10 * scale, 6 * scale, p.roll, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ["#d98476", "#93bdb0", "#dab66f"][i];
    ctx.beginPath();
    ctx.ellipse(a.x, a.y - 2 * scale, 8 * scale, 4.5 * scale, p.roll, 0, Math.PI * 2);
    ctx.fill();
    for (let j = 0; j < RAPIDS_SEATS; j++) {
      const seat = rapidsSeatPose(i, j, phase);
      rider(
        b.riders[i * 4 + j],
        { x: cx + seat.x / 5, y: cy + seat.z / 5, z: base + seat.y / 5 },
        seat.yaw,
      );
    }
    ctx.strokeStyle = "#eef0cc";
    ctx.lineWidth = 1.4 * scale;
    ctx.beginPath();
    ctx.ellipse(a.x, a.y - 2 * scale, 7.8 * scale, 4.5 * scale, p.roll, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

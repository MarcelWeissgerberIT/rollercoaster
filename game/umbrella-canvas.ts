import type { Guest } from "./simulation";
import { personParts } from "./guest-model";
import { umbrellaPanels, type UmbrellaVertex } from "./umbrella";
export function drawHeldUmbrella(
  ctx: CanvasRenderingContext2D,
  g: Guest,
  x: number,
  y: number,
  scale: number,
  time: number,
  direction: "se" | "sw" | "nw" | "ne",
  phase: number,
  moving: boolean,
) {
  if (!g.umbrella) return;
  const yaw = { se: Math.PI, sw: Math.PI / 2, nw: 0, ne: -Math.PI / 2 }[direction],
    c = Math.cos(yaw),
    s = Math.sin(yaw),
    parts = personParts(g, false, phase, moving),
    grip = parts.find((p) => p.umbrellaGrip);
  if (!grip) return;
  const project = (p: number[]) => {
    const wx = p[0] * c + p[2] * s,
      wz = -p[0] * s + p[2] * c;
    return {
      x: x + (wx - wz) * 9 * scale,
      y: y + ((wx + wz) * 4.5 - p[1] * 15) * scale,
      depth: wx + wz,
    };
  };
  const hand = project(grip.p),
    top = project([grip.p[0], grip.p[1] + 0.91, grip.p[2]]);
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = "#586c6c";
  ctx.lineWidth = 0.7 * scale;
  ctx.beginPath();
  ctx.moveTo(hand.x, hand.y);
  ctx.lineTo(top.x, top.y);
  ctx.stroke();
  const panels = umbrellaPanels(g).map((p) => ({
    ...p,
    points: p.vertices.map((v: UmbrellaVertex) =>
      project([grip.p[0] + v[0], grip.p[1] + v[1], grip.p[2] + v[2]]),
    ),
  }));
  panels.sort(
    (a, b) => a.points.reduce((n, p) => n + p.depth, 0) - b.points.reduce((n, p) => n + p.depth, 0),
  );
  for (const panel of panels) {
    ctx.beginPath();
    panel.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = panel.color;
    ctx.fill();
    ctx.strokeStyle = "#627a7566";
    ctx.lineWidth = 0.3 * scale;
    ctx.stroke();
  }
  ctx.restore();
}

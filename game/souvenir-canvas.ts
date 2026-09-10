import type { Guest } from "./simulation";
import { guestAppearance } from "./visitors";
import { souvenirStyle, souvenirPose, type BalloonShape } from "./souvenirs";

function balloonOutline(ctx: CanvasRenderingContext2D, shape: BalloonShape) {
  ctx.beginPath();
  if (shape === "star") {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5,
        r = i % 2 ? 3.2 : 7;
      if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  } else if (shape === "heart") {
    ctx.moveTo(0, 6);
    ctx.bezierCurveTo(-12, -2, -6, -11, 0, -5);
    ctx.bezierCurveTo(6, -11, 12, -2, 0, 6);
  } else {
    ctx.ellipse(0, 0, 5.3, 6.5, 0, 0, Math.PI * 2);
  }
}

/** Articulated tether and hand-held toy; no replacement static sprite. */
export function drawHeldSouvenir(
  ctx: CanvasRenderingContext2D,
  g: Guest,
  x: number,
  y: number,
  scale: number,
  time: number,
  direction: "se" | "sw" | "nw" | "ne",
  stepPhase: number,
  moving: boolean,
) {
  const style = souvenirStyle(g);
  if (!style) return;
  const look = guestAppearance(g),
    pose = souvenirPose(g, time),
    side = direction === "sw" || direction === "nw" ? 1 : -1,
    handStep = moving ? Math.sin(stepPhase) * 1.3 : 0;
  ctx.save();
  ctx.translate(x + side * 4 * scale, y - (12 * look.heightScale + handStep) * scale);
  ctx.scale(scale, scale);
  if (style.kind === "balloon") {
    const bx = pose.x * 24 + side * 3.5,
      by = -pose.lift * 20;
    ctx.strokeStyle = "#f4eddd";
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(pose.x * 10 - 1, by * 0.35, bx + 1, by * 0.6, bx, by + 6.4);
    ctx.stroke();
    ctx.translate(bx, by);
    ctx.rotate(pose.roll);
    const paint = ctx.createLinearGradient(-6, -6, 7, 7);
    paint.addColorStop(0, "#fffbe7");
    paint.addColorStop(0.28, style.color);
    paint.addColorStop(0.5, style.foil ? "#fff9f0" : style.color);
    paint.addColorStop(0.65, style.color);
    paint.addColorStop(1, style.accent);
    if (style.shape === "bear") {
      ctx.fillStyle = style.color;
      ctx.strokeStyle = style.accent;
      ctx.lineWidth = 0.6;
      for (const ex of [-4.3, 4.3]) {
        ctx.beginPath();
        ctx.arc(ex, -5, 2.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    balloonOutline(ctx, style.shape);
    ctx.fillStyle = paint;
    ctx.fill();
    ctx.strokeStyle = style.accent;
    ctx.lineWidth = 0.6;
    ctx.stroke();
    if (style.foil) {
      ctx.save();
      ctx.scale(0.86, 0.87);
      balloonOutline(ctx, style.shape);
      ctx.strokeStyle = "#fff4da9c";
      ctx.lineWidth = 0.45;
      ctx.stroke();
      ctx.restore();
    }
    if (style.shape === "bear" || style.shape === "round") {
      ctx.fillStyle = "#514043";
      for (const ex of [-1.9, 1.9]) {
        ctx.beginPath();
        ctx.ellipse(ex, -0.7, 0.65, 0.85, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "#514043";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(0, 0.6, 1.8, 0.2, Math.PI - 0.2);
      ctx.stroke();
      if (style.shape === "bear") {
        ctx.fillStyle = "#f9e3c7";
        ctx.beginPath();
        ctx.ellipse(0, 2, 2, 1.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#514043";
        ctx.fillRect(-0.65, 0.8, 1.3, 0.8);
      }
    }
    ctx.strokeStyle = "#ffffffd9";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-3, -3.5);
    ctx.lineTo(-2, -4.7);
    ctx.stroke();
    ctx.fillStyle = style.color;
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.lineTo(-1.2, 8);
    ctx.lineTo(1.2, 8);
    ctx.fill();
  } else {
    ctx.translate(side * 1.2, 2);
    ctx.rotate(side * 0.1 + (moving ? Math.sin(stepPhase) * 0.09 : 0));
    const ball = (cx: number, cy: number, rx: number, ry: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#61473788";
      ctx.lineWidth = 0.45;
      ctx.stroke();
    };
    for (const sx of [-1, 1]) {
      ball(sx * 3, -3, 1.5, 1.5, style.color);
      ball(sx * 3, 2.7, 1.2, 2, style.color);
      ball(sx * 1.8, 5.8, 1.5, 1.4, style.color);
    }
    ball(0, 2.6, 2.8, 3.2, style.color);
    ball(0, -1.2, 3.4, 2.9, style.color);
    ball(0, 3.1, 1.8, 2, "#f6dec0");
    ball(0, 0.1, 1.6, 1.1, "#f6dec0");
    for (const sx of [-1, 1]) ball(sx * 1.3, -1.5, 0.45, 0.5, "#443c36");
    ball(0, -0.2, 0.55, 0.42, "#443c36");
    if (style.trim === "scarf") {
      ctx.fillStyle = style.accent;
      ctx.fillRect(-2.5, 1.1, 5, 1.3);
      ctx.fillRect(1, 1.5, 1.3, 3);
    } else {
      for (const sx of [-1, 1]) ball(sx * 1, 1.3, 1.1, 0.75, style.accent);
    }
  }
  ctx.restore();
}

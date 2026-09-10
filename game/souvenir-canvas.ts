import type { Guest } from "./simulation";
import { guestAppearance } from "./visitors";
import { souvenirStyle, souvenirPose, type BalloonShape, type SouvenirStyle } from "./souvenirs";

function balloonOutline(ctx: CanvasRenderingContext2D, shape: BalloonShape) {
  ctx.beginPath();
  if (shape === "star") {
    const points = Array.from({ length: 10 }, (_, i) => {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5,
        radius = i % 2 ? 3.35 : 6.9;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    });
    for (let i = 0; i < points.length; i++) {
      const previous = points[(i + 9) % 10],
        p = points[i],
        next = points[(i + 1) % 10],
        round = i % 2 ? 0.14 : 0.23,
        x = p.x + (previous.x - p.x) * round,
        y = p.y + (previous.y - p.y) * round;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
      ctx.quadraticCurveTo(p.x, p.y, p.x + (next.x - p.x) * round, p.y + (next.y - p.y) * round);
    }
    ctx.closePath();
  } else if (shape === "heart") {
    ctx.moveTo(0, 5.9);
    ctx.bezierCurveTo(-1.1, 5.4, -6.8, 1.5, -6.8, -2.3);
    ctx.bezierCurveTo(-6.8, -6.3, -3.8, -8, -0.7, -5.35);
    ctx.quadraticCurveTo(0, -4.6, 0.7, -5.35);
    ctx.bezierCurveTo(3.8, -8, 6.8, -6.3, 6.8, -2.3);
    ctx.bezierCurveTo(6.8, 1.5, 1.1, 5.4, 0, 5.9);
    ctx.closePath();
  } else {
    ctx.ellipse(0, 0, 5.3, 6.5, 0, 0, Math.PI * 2);
  }
}

function mixColor(color: string, toward: string, amount: number) {
  const rgb = (value: string) => [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16)),
    a = rgb(color),
    b = rgb(toward);
  return `rgb(${a.map((value, i) => Math.round(value + (b[i] - value) * amount)).join(",")})`;
}

/** A lit, inflated front and a displaced shaded rear skin. The slight turn
 * changes visible depth instead of sliding a reflection across a flat icon. */
function inflatedBalloon(ctx: CanvasRenderingContext2D, style: SouvenirStyle, turn: number) {
  const light = mixColor(style.color, "#fff6de", 0.57),
    midLight = mixColor(style.color, "#fff6de", 0.2),
    shadow = mixColor(style.color, "#243444", 0.47),
    deep = mixColor(style.color, "#243444", 0.66),
    width = 0.89 + Math.cos(turn) * 0.055,
    depth = 1.35 + Math.sin(turn) * 0.65;
  ctx.save();
  ctx.transform(width, -0.055, 0, 1, 0, 0);
  const outline = () => balloonOutline(ctx, style.shape);
  const shell = (x: number, y: number, front: boolean) => {
    ctx.save();
    ctx.translate(x, y);
    if (style.shape === "bear") {
      for (const ex of [-4.1, 4.1]) {
        const ear = ctx.createRadialGradient(ex - 0.8, -5.9, 0.2, ex, -4.8, 2.85);
        ear.addColorStop(0, front ? light : shadow);
        ear.addColorStop(0.48, front ? style.color : shadow);
        ear.addColorStop(1, front ? shadow : deep);
        ctx.fillStyle = ear;
        ctx.beginPath();
        ctx.ellipse(ex, -4.8, 2.55, 2.8, -0.14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    outline();
    if (!front) {
      const edge = ctx.createLinearGradient(-4, -6, 5, 7);
      edge.addColorStop(0, midLight);
      edge.addColorStop(0.32, shadow);
      edge.addColorStop(1, deep);
      ctx.fillStyle = edge;
      ctx.fill();
      ctx.strokeStyle = mixColor(style.color, "#fef3dc", 0.16);
      ctx.lineWidth = 0.2;
      ctx.stroke();
      ctx.restore();
      return;
    }
    const dome = ctx.createRadialGradient(
      -2.1,
      -2.6,
      0.15,
      -0.45,
      -0.55,
      style.shape === "star" ? 7 : 7.3,
    );
    dome.addColorStop(0, light);
    dome.addColorStop(0.25, midLight);
    dome.addColorStop(0.48, style.color);
    dome.addColorStop(0.78, mixColor(style.color, "#253645", 0.17));
    dome.addColorStop(1, shadow);
    ctx.fillStyle = dome;
    ctx.fill();
    ctx.save();
    outline();
    ctx.clip();
    // Rounded air chambers keep the heart lobes and star arms visibly padded.
    if (style.shape === "heart") {
      for (const [cx, cy, rx, ry] of [
        [-3.25, -3.65, 3.15, 3.2],
        [3.1, -3.5, 2.7, 2.9],
      ]) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(rx, ry);
        const lobe = ctx.createRadialGradient(-0.28, -0.25, 0.08, 0, 0, 1);
        lobe.addColorStop(0, "#fff6de70");
        lobe.addColorStop(0.5, "#fff6de20");
        lobe.addColorStop(1, "#fff6de00");
        ctx.fillStyle = lobe;
        ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
      }
    } else if (style.shape === "star") {
      for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        ctx.save();
        ctx.rotate(angle);
        ctx.translate(2.3, 0);
        ctx.scale(2.8, 1.5);
        const arm = ctx.createRadialGradient(-0.3, -0.15, 0.08, 0, 0, 1);
        arm.addColorStop(0, "#fff9dc35");
        arm.addColorStop(0.6, "#fff9dc12");
        arm.addColorStop(1, "#fff9dc00");
        ctx.fillStyle = arm;
        ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
      }
    }
    // Broad edge rolloff supplies volume; reflection stays a small soft light.
    ctx.save();
    ctx.translate(-2.35 + Math.sin(turn) * 0.35, style.shape === "heart" ? -4 : -3.3);
    ctx.rotate(-0.36);
    ctx.scale(style.foil ? 1.15 : 1.35, style.foil ? 1.7 : 2);
    const shine = ctx.createRadialGradient(-0.15, -0.16, 0.05, 0, 0, 1);
    shine.addColorStop(0, "#fffef2e0");
    shine.addColorStop(0.3, "#fffdf29a");
    shine.addColorStop(0.72, "#fff9e724");
    shine.addColorStop(1, "#fff9e700");
    ctx.fillStyle = shine;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
    if (style.foil) {
      // Fine heat-sealed edge, mostly on the unlit side, never a sticker border.
      ctx.save();
      ctx.translate(0.25, 0.2);
      ctx.scale(0.965, 0.965);
      outline();
      const seam = ctx.createLinearGradient(-5, -5, 5, 6);
      seam.addColorStop(0, "#fff8db00");
      seam.addColorStop(0.35, "#fff8db09");
      seam.addColorStop(0.75, "#fff8db65");
      seam.addColorStop(1, "#fff8db32");
      ctx.strokeStyle = seam;
      ctx.lineWidth = 0.19;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();
  };
  shell(depth, 0.68, false);
  shell(-0.24, -0.22, true);
  if (style.shape === "bear" || style.shape === "round") {
    ctx.save();
    ctx.translate(-0.7, -0.1);
    ctx.scale(0.88, 0.97);
    ctx.fillStyle = "#3c3540";
    for (const ex of [-1.9, 1.9]) {
      ctx.beginPath();
      ctx.ellipse(ex, -0.7, 0.56, 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#433746";
    ctx.lineWidth = 0.42;
    ctx.beginPath();
    ctx.arc(0, 0.65, 1.65, 0.2, Math.PI - 0.2);
    ctx.stroke();
    if (style.shape === "bear") {
      const muzzle = ctx.createRadialGradient(-0.6, 1.2, 0.2, 0, 1.7, 2);
      muzzle.addColorStop(0, "#fff1d7");
      muzzle.addColorStop(0.6, "#ecd3b5");
      muzzle.addColorStop(1, "#bba286");
      ctx.fillStyle = muzzle;
      ctx.beginPath();
      ctx.ellipse(0, 1.65, 1.8, 1.2, -0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#514043";
      ctx.beginPath();
      ctx.ellipse(-0.1, 0.85, 0.55, 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  // The tied neck is a shaded fold, with the string ending at this point.
  const knot = ctx.createLinearGradient(-0.8, 6, 1.2, 8);
  knot.addColorStop(0, midLight);
  knot.addColorStop(0.5, style.color);
  knot.addColorStop(1, shadow);
  ctx.fillStyle = knot;
  ctx.beginPath();
  ctx.moveTo(0.2, 5.9);
  ctx.lineTo(-0.7, 7.8);
  ctx.quadraticCurveTo(0.25, 8.25, 1.15, 7.85);
  ctx.lineTo(0.45, 6);
  ctx.fill();
  ctx.restore();
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
    inflatedBalloon(ctx, style, 0.45 + pose.z * 4 + pose.roll * 2);
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

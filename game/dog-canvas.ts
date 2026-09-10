import type { Guest, Point } from "./simulation";
import { guestAppearance } from "./visitors";
import { dogParts, dogWorldPoint, type DogPose, type DogVector } from "./guest-dogs";

/** Right-hand counterpart of the held-souvenir anchor, following the same sprite step and lean. */
export function dogLeashGrip(
  g: Guest,
  x: number,
  y: number,
  scale: number,
  direction: "se" | "sw" | "nw" | "ne",
  phase: number,
  moving: boolean,
): Point {
  const side = direction === "sw" || direction === "nw" ? -1 : 1,
    step = moving ? -Math.sin(phase) * 1.3 : 0,
    lean = moving ? Math.sin(phase) * 0.018 : 0,
    dx = side * 4,
    dy = -(12 * guestAppearance(g).heightScale + step);
  return {
    x: x + (dx * Math.cos(lean) - dy * Math.sin(lean)) * scale,
    y: y + (dx * Math.sin(lean) + dy * Math.cos(lean)) * scale,
  };
}

export function drawDogCompanion(
  ctx: CanvasRenderingContext2D,
  pose: DogPose,
  project: (x: number, y: number) => Point,
  scale: number,
  ownerGrip?: Point,
) {
  const screen = (p: ReturnType<typeof dogWorldPoint>, heightScale = 10.5) => {
    const q = project(p.x, p.y);
    return { x: q.x, y: q.y - p.z * heightScale * scale };
  };
  const local = (p: DogVector) => screen(dogWorldPoint(pose, p));
  ctx.save();
  const anchor = local([0, 0.5, -0.27]),
    hand =
      ownerGrip ??
      screen(
        dogWorldPoint({ x: pose.owner.x, y: pose.owner.y, yaw: pose.ownerYaw }, [
          0.27 * pose.ownerHeight,
          0.98 * pose.ownerHeight,
          0,
        ]),
        15,
      );
  ctx.beginPath();
  ctx.moveTo(hand.x, hand.y);
  ctx.quadraticCurveTo(
    (hand.x + anchor.x) / 2,
    (hand.y + anchor.y) / 2 + 3 * scale,
    anchor.x,
    anchor.y,
  );
  ctx.strokeStyle = "#6b5b43";
  ctx.lineWidth = 0.65 * scale;
  ctx.lineCap = "round";
  ctx.stroke();
  const floor = project(pose.x, pose.y);
  ctx.beginPath();
  ctx.ellipse(floor.x, floor.y, 3.2 * scale, 1.4 * scale, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#344c3430";
  ctx.fill();
  const parts = dogParts(pose)
    .map((part) => ({ part, world: dogWorldPoint(pose, part.p) }))
    .sort(
      (a, b) =>
        a.world.x + a.world.y + a.world.z * 0.018 - b.world.x - b.world.y - b.world.z * 0.018,
    );
  for (const { part, world } of parts) {
    const center = screen(world);
    if (part.end) {
      const end = local(part.end);
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(end.x, end.y);
      ctx.strokeStyle = part.color;
      ctx.lineWidth = Math.max(0.55, part.radius[0] * 24) * scale;
      ctx.stroke();
    } else {
      const axes = part.radius.map((radius, axis) => {
          const p = [...part.p] as DogVector;
          p[axis] += radius;
          const q = local(p);
          return { x: q.x - center.x, y: q.y - center.y };
        }),
        xx = axes.reduce((n, p) => n + p.x * p.x, 0),
        yy = axes.reduce((n, p) => n + p.y * p.y, 0),
        xy = axes.reduce((n, p) => n + p.x * p.y, 0),
        disc = Math.hypot(xx - yy, 2 * xy),
        r1 = Math.sqrt(Math.max(0.01, (xx + yy + disc) / 2)),
        r2 = Math.sqrt(Math.max(0.01, (xx + yy - disc) / 2));
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, r1, r2, Math.atan2(2 * xy, xx - yy) / 2, 0, Math.PI * 2);
      ctx.fillStyle = part.color;
      ctx.fill();
      if (!part.name.startsWith("eye")) {
        ctx.strokeStyle = "#594f403d";
        ctx.lineWidth = 0.3 * scale;
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

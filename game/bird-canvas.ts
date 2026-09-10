import type { Park } from "./simulation";
import { viewDepth, viewFacing, type IsoProject } from "./isometric-view";
import {
  BIRD_COLORS,
  birdAnatomy,
  birdHeadPoint,
  birdLocalWorld,
  birdPerch,
  parkBirds,
  type BirdPoint,
  type BirdPose,
} from "./birds";
type Project = IsoProject;

export function drawBird(
  ctx: CanvasRenderingContext2D,
  pose: BirdPose,
  project: Project,
  scale: number,
  spriteLift = 0,
) {
  if (pose.opacity < 0.001) return;
  const anatomy = birdAnatomy(pose),
    colors = BIRD_COLORS[pose.id % BIRD_COLORS.length],
    point = (p: BirdPoint) => {
      const q = birdLocalWorld(pose, p);
      const screen = project(q.x, q.y, q.z);
      return { x: screen.x, y: screen.y - spriteLift * scale };
    };
  const shape = (points: BirdPoint[], fill: string, stroke: string = colors.tip) => {
    ctx.beginPath();
    points.forEach((p, i) => {
      const q = point(p);
      if (i) ctx.lineTo(q.x, q.y);
      else ctx.moveTo(q.x, q.y);
    });
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.35 * scale;
    ctx.lineJoin = "round";
    ctx.stroke();
  };
  const stroke = (points: BirdPoint[], color: string, width: number) => {
    ctx.beginPath();
    points.forEach((p, i) => {
      const q = point(p);
      if (i) ctx.lineTo(q.x, q.y);
      else ctx.moveTo(q.x, q.y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = width * scale;
    ctx.lineCap = "round";
    ctx.stroke();
  };
  const oval = (
    center: BirdPoint,
    width: number,
    height: number,
    length: number,
    color: string,
  ) => {
    const q = point(center),
      horizontal = point({ ...center, z: center.z + length }),
      vertical = point({ ...center, y: center.y + height }),
      side = point({ ...center, x: center.x + width });
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(Math.atan2(horizontal.y - q.y, horizontal.x - q.x));
    ctx.beginPath();
    ctx.ellipse(
      0,
      0,
      Math.max(0.6 * scale, Math.hypot(horizontal.x - q.x, horizontal.y - q.y)),
      Math.max(
        0.4 * scale,
        Math.hypot(vertical.x - q.x, vertical.y - q.y),
        Math.hypot(side.x - q.x, side.y - q.y),
      ),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  };
  ctx.save();
  ctx.globalAlpha *= pose.opacity;
  shape(anatomy.tail, colors.tip);
  const side = viewFacing(project, Math.sin(pose.heading), -Math.cos(pose.heading)),
    near = side.x + side.y > 0 ? 1 : 0,
    far = 1 - near;
  const wing = (index: number) => {
    shape(anatomy.wings[index], colors.wing);
    const points = anatomy.wings[index];
    stroke([points[1], points[2], points[3]], colors.breast, 0.32);
    stroke([points[2], points[4]], colors.tip, 0.3);
  };
  wing(far);
  if (pose.feet > 0.05)
    for (const foot of anatomy.feet) {
      stroke([{ ...foot, y: 0.13, z: 0 }, foot, { ...foot, z: 0.075 }], colors.beak, 0.4);
    }
  oval({ x: 0, y: 0.14, z: 0 }, 0.1, 0.105, 0.235, colors.body);
  oval({ x: 0, y: 0.115, z: 0.075 }, 0.083, 0.065, 0.15, colors.breast);
  wing(near);
  oval(anatomy.head, 0.087, 0.083, 0.095, colors.body);
  shape(
    [
      birdHeadPoint(pose, { x: -0.025, y: 0.045, z: 0.14 }),
      anatomy.beak,
      birdHeadPoint(pose, { x: 0.025, y: 0.045, z: 0.14 }),
    ],
    colors.beak,
    colors.beak,
  );
  const eye = point(birdHeadPoint(pose, { x: (near ? 1 : -1) * 0.073, y: 0.075, z: 0.1 }));
  ctx.beginPath();
  ctx.arc(eye.x, eye.y, 0.35 * scale, 0, Math.PI * 2);
  ctx.fillStyle = "#253b3c";
  ctx.fill();
  ctx.restore();
}

/** Pixel-v2 art: 96px high, anchorY82; crown at centre-column source row80/20 of384. */
export function birdSpriteLift(park: Park, pose: BirdPose): number {
  if (!pose.perchId || !pose.perchBlend) return 0;
  const building = park.buildings.find((b) => b.id === pose.perchId),
    perch = building && birdPerch(building);
  if (!building || !perch) return 0;
  const crown = building.kind === "pine" ? 77 : 62;
  return (crown - perch.z * 24) * pose.perchBlend;
}
export function birdCanvasLayers(
  ctx: CanvasRenderingContext2D,
  park: Park,
  project: Project,
  scale: number,
  time = park.time,
) {
  return parkBirds(park, time)
    .filter((p) => p.opacity > 0.001)
    .map((pose) => ({
      // Perching birds sit on the actual tree; flyers pass above the park's objects.
      depth:
        viewDepth(project, pose.x, pose.y) + (pose.phase === "perched" ? 0 : pose.z * 0.035) + 0.3,
      draw: () => drawBird(ctx, pose, project, scale, birdSpriteLift(park, pose)),
    }));
}

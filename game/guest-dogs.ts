import type { Guest, Park, Point } from "./simulation";
import { appearanceSeed, guestAppearance } from "./visitors";
import { guestWalkPosition } from "./guest-walk";

export const MAX_COMPANION_DOGS = 3;
export const dogOwnerEligible = (g: Guest) =>
  guestAppearance(g).ageGroup === "adult" &&
  (!g.party || g.party.kind === "solo" || (g.party.kind === "couple" && g.party.member === 0)) &&
  appearanceSeed(g.id ^ 0x2ea571) % 100 < 2;
/** Identity is derived from saved guest IDs; loading/reordering never rerolls an animal. */
export function dogCompanionOwners(park: Park): Set<number> {
  return new Set(
    park.guests
      .filter(dogOwnerEligible)
      .map((g) => g.id)
      .sort((a, b) => a - b)
      .slice(0, MAX_COMPANION_DOGS),
  );
}
export type DogVector = [number, number, number]; // local X, height, local Z, metres
export type DogPose = {
  ownerId: number;
  x: number;
  y: number;
  yaw: number;
  moving: boolean;
  phase: number;
  clock: number;
  coat: string;
  patch: string;
  collar: string;
  owner: Point;
  ownerYaw: number;
  ownerHeight: number;
};
const path = (park: Park, x: number, y: number) =>
  park.tiles[Math.round(y)]?.[Math.round(x)] === "path";
export function dogCompanionPose(
  park: Park,
  g: Guest,
  options: { time?: number; position?: Point; direction?: Point; moving?: boolean } = {},
): DogPose | null {
  if (
    !dogOwnerEligible(g) ||
    !["walk", "leave"].includes(g.state) ||
    g.transit ||
    !path(park, g.x, g.y)
  )
    return null;
  const owner = options.position ?? guestWalkPosition(park, g);
  if (!path(park, owner.x, owner.y)) return null;
  const next = options.direction ?? g.route.find((p) => Math.hypot(p.x - g.x, p.y - g.y) > 0.025),
    dx = next ? next.x - (options.position ? owner.x : g.x) : 0,
    dy = next ? next.y - (options.position ? owner.y : g.y) : -1,
    length = Math.hypot(dx, dy) || 1,
    fx = dx / length,
    fy = dy / length,
    moving = options.moving ?? (g.route.length > 0 && g.timer <= 0),
    side = g.party?.kind === "couple" ? -1 : appearanceSeed(g.id) % 2 ? -1 : 1,
    time = options.time ?? park.time;
  // Stay on the outer side of a pair. A short trailing alternative fits narrow corners.
  const candidates = [
    [-0.17, side * 0.2],
    [-0.24, side * 0.12],
    [-0.31, 0],
  ];
  let position: Point | undefined;
  for (const [along, across] of candidates) {
    const desired = {
      x: owner.x + fx * along - fy * across,
      y: owner.y + fy * along + fx * across,
    };
    const tx = Math.round(desired.x),
      ty = Math.round(desired.y);
    if (!path(park, tx, ty)) continue;
    const q = {
      x: Math.max(tx - 0.38, Math.min(tx + 0.38, desired.x)),
      y: Math.max(ty - 0.38, Math.min(ty + 0.38, desired.y)),
    };
    if (Math.hypot(q.x - owner.x, q.y - owner.y) < 0.18) continue;
    const clearLeash = Array.from({ length: 9 }, (_, i) => i / 8).every((t) =>
      path(park, owner.x + (q.x - owner.x) * t, owner.y + (q.y - owner.y) * t),
    );
    if (!clearLeash) continue;
    const crowdCollision = park.guests.some((other) => {
      if (
        other.id === g.id ||
        !["walk", "leave"].includes(other.state) ||
        Math.hypot(other.x - g.x, other.y - g.y) > 1.5
      )
        return false;
      const p = guestWalkPosition(park, other);
      return (
        Math.hypot(p.x - q.x, p.y - q.y) <
        (guestAppearance(other).ageGroup === "child" ? 0.24 : 0.2)
      );
    });
    if (!crowdCollision) {
      position = q;
      break;
    }
  }
  if (!position) return null;
  const variation = appearanceSeed(g.id ^ 0x7631) % 3;
  return {
    ownerId: g.id,
    ...position,
    yaw: Math.atan2(-fx, -fy),
    moving,
    phase: time * 8 + (appearanceSeed(g.id) % 23),
    clock: time,
    coat: ["#ad7950", "#e2cfaa", "#675e55"][variation],
    patch: ["#f2dfbd", "#ac8259", "#e9ddd0"][variation],
    collar: ["#668fbc", "#be645a", "#68a69a"][variation],
    owner,
    ownerYaw: Math.atan2(-fx, -fy),
    ownerHeight: guestAppearance(g).heightScale,
  };
}
export const dogWorldPoint = (pose: Pick<DogPose, "x" | "y" | "yaw">, p: DogVector) => ({
  x: pose.x + (Math.cos(pose.yaw) * p[0] + Math.sin(pose.yaw) * p[2]) / 5,
  y: pose.y + (-Math.sin(pose.yaw) * p[0] + Math.cos(pose.yaw) * p[2]) / 5,
  z: p[1],
});
export type DogPart = {
  name: string;
  p: DogVector;
  radius: DogVector;
  color: string;
  end?: DogVector;
};
/** A four-beat walk with planted paws, bending knees and distinct front/hind legs. */
export function dogParts(pose: DogPose): DogPart[] {
  const bob = pose.moving
      ? Math.sin(pose.phase * 2) * 0.009
      : Math.sin(pose.clock * 1.6 + pose.ownerId) * 0.004,
    sniff = pose.moving ? 0 : Math.max(0, Math.sin(pose.clock * 0.65 + pose.ownerId)) * 0.04,
    out: DogPart[] = [];
  const add = (name: string, p: DogVector, radius: DogVector, color: string) =>
    out.push({ name, p, radius, color });
  add("body", [0, 0.4 + bob, 0], [0.145, 0.145, 0.31], pose.coat);
  add("chest", [0, 0.4 + bob, -0.19], [0.13, 0.16, 0.13], pose.patch);
  add("neck", [0, 0.47 + bob, -0.27], [0.105, 0.13, 0.12], pose.coat);
  add("head", [0, 0.56 + bob - sniff, -0.36], [0.12, 0.12, 0.135], pose.coat);
  add("muzzle", [0, 0.515 + bob - sniff, -0.475], [0.087, 0.065, 0.11], pose.patch);
  add("nose", [0, 0.535 + bob - sniff, -0.57], [0.037, 0.028, 0.024], "#383831");
  add("collar", [0, 0.48 + bob, -0.275], [0.118, 0.032, 0.12], pose.collar);
  for (const side of [-1, 1]) {
    add(
      `eye-${side}`,
      [side * 0.091, 0.591 + bob - sniff, -0.433],
      [0.018, 0.021, 0.014],
      "#292f2b",
    );
    add(
      `ear-${side}`,
      [side * 0.116, 0.558 + bob - sniff, -0.319],
      [0.042, 0.113, 0.065],
      pose.patch,
    );
  }
  for (let leg = 0; leg < 4; leg++) {
    const side = leg % 2 ? -1 : 1,
      front = leg < 2,
      a = pose.phase + [0, Math.PI, Math.PI * 1.5, Math.PI * 0.5][leg],
      cycle = (((a / (Math.PI * 2)) % 1) + 1) % 1,
      swing = cycle > 0.75 ? (cycle - 0.75) * 4 : 0,
      step = pose.moving
        ? cycle <= 0.75
          ? 0.11 - (cycle / 0.75) * 0.22
          : -0.11 + swing * 0.22
        : 0,
      lift = pose.moving ? Math.sin(swing * Math.PI) * 0.085 : 0,
      hip: DogVector = [side * 0.118, 0.355 + bob, front ? -0.205 : 0.21],
      foot: DogVector = [side * 0.135, 0.04 + lift, (front ? -0.22 : 0.23) + step],
      dy = foot[1] - hip[1],
      dz = foot[2] - hip[2],
      d = Math.hypot(dy, dz),
      bend = Math.sqrt(Math.max(0, 0.195 * 0.195 - (d / 2) ** 2)),
      direction = front ? -1 : 1,
      knee: DogVector = [
        side * 0.13,
        (hip[1] + foot[1]) / 2 + (dz / d) * bend * direction,
        (hip[2] + foot[2]) / 2 - (dy / d) * bend * direction,
      ];
    out.push({
      name: `leg-${leg}-upper`,
      p: hip,
      end: knee,
      radius: [0.042, 0.042, 0.042],
      color: pose.coat,
    });
    out.push({
      name: `leg-${leg}-lower`,
      p: knee,
      end: foot,
      radius: [0.031, 0.031, 0.031],
      color: pose.patch,
    });
    add(`paw-${leg}`, [foot[0], foot[1], foot[2] - 0.023], [0.046, 0.034, 0.072], pose.patch);
  }
  const wag = Math.sin(pose.clock * (pose.moving ? 3 : 2.2) + pose.ownerId) * 0.085;
  out.push({
    name: "tail-base",
    p: [0, 0.45 + bob, 0.27],
    end: [wag * 0.4, 0.53 + bob, 0.39],
    radius: [0.043, 0.043, 0.043],
    color: pose.coat,
  });
  out.push({
    name: "tail-tip",
    p: [wag * 0.4, 0.53 + bob, 0.39],
    end: [wag, 0.58 + bob, 0.52],
    radius: [0.026, 0.026, 0.026],
    color: pose.patch,
  });
  return out;
}

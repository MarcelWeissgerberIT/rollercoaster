import type { Point } from "./simulation";
/** Mounted on the outgoing edge of a control point. Speeds in km/h, strength in m/s². */
export type TrackDrive = { kind: "boost" | "brake"; speed: number; strength: number };
export function validDrive(value: unknown): value is TrackDrive {
  const d = value as TrackDrive;
  return (
    !!d &&
    ["boost", "brake"].includes(d.kind) &&
    Number.isFinite(d.speed) &&
    d.speed >= 5 &&
    d.speed <= 100 &&
    Number.isFinite(d.strength) &&
    d.strength >= 0.5 &&
    d.strength <= 12
  );
}
export function driveCost(track: Point[]) {
  let cost = 0;
  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i],
      b = track[i + 1];
    if (!a.drive) continue;
    cost +=
      Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0)) *
      (a.drive.kind === "boost" ? 80 : 45);
  }
  return Math.round(cost);
}

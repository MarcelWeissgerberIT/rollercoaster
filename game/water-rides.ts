import type { Building } from "./simulation";
export const RAPIDS_BOATS = 3,
  RAPIDS_SEATS = 4,
  RAPIDS_DURATION = 32;
const tau = Math.PI * 2;
/** Metres around ride centre. Channel and boats use exactly this closed route in both views. */
export function rapidsChannel(t: number) {
  t = ((t % 1) + 1) % 1;
  const a = t * tau;
  const swell = Math.max(0, Math.sin(a));
  return { x: Math.cos(a) * 10.5, z: Math.sin(a) * 8.6, y: 0.6 + 2.8 * swell * swell };
}
export function rapidsPose(boat: number, phase: number) {
  const t = phase + boat / RAPIDS_BOATS,
    p = rapidsChannel(t),
    before = rapidsChannel(t - 0.002),
    after = rapidsChannel(t + 0.002);
  const moving = phase > 0 && phase < 1;
  return {
    ...p,
    y: p.y + (moving ? Math.sin(t * tau * 9) * 0.11 : 0),
    yaw: Math.atan2(-(after.x - before.x), -(after.z - before.z)),
    spin: Math.sin(t * tau * 3) * 0.7,
    pitch: Math.atan2(after.y - before.y, Math.hypot(after.x - before.x, after.z - before.z)),
    roll: moving ? Math.sin(t * tau * 7) * 0.045 : 0,
  };
}
export function rapidsPhase(b: Pick<Building, "riders" | "cycle">) {
  return b.riders.length ? Math.max(0, Math.min(1, 1 - b.cycle / RAPIDS_DURATION)) : 0;
}
export function rapidsSeatPose(boat: number, seat: number, phase: number) {
  const p = rapidsPose(boat, phase),
    a = (seat * tau) / RAPIDS_SEATS + p.yaw + p.spin;
  return { x: p.x + Math.sin(a) * 0.92, z: p.z + Math.cos(a) * 0.92, y: p.y + 0.7, yaw: a };
}

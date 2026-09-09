import * as THREE from "three";
import type { Point } from "./simulation";
import { prepareRoute, routePosition, trainDistance } from "./motion";
export function makeRidePath(track: Point[]) {
  if (track.length < 4) throw Error("Die Strecke ist zu kurz.");
  const route = prepareRoute(track),
    count = Math.min(4096, Math.max(64, Math.ceil(route.length * 12)));
  if (route.length < 0.001 || route.duration < 0.001)
    throw Error("Die Strecke hat keine fahrbare Länge.");
  const vec = (v: { x: number; y: number; z: number }) => new THREE.Vector3(v.x, v.z, v.y);
  function at(u: number) {
    const p = routePosition(route, Math.max(0, Math.min(1, u)) * route.length),
      position = new THREE.Vector3(p.x * 5, (p.z ?? 0) * 5 + 1.1, p.y * 5),
      tangent = vec(p.tangent),
      right = vec(p.right).negate(),
      up = vec(p.up);
    const quaternion = new THREE.Quaternion()
      .setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, tangent.clone().negate()))
      .normalize();
    return {
      position,
      tangent,
      right,
      up,
      quaternion,
      speed: p.speed,
      phase: p.phase,
      drive: p.drive,
    };
  }
  const frames = Array.from({ length: count + 1 }, (_, i) => at(i / count));
  return {
    points: frames.map((f) => f.position),
    rights: frames.map((f) => f.right),
    ups: frames.map((f) => f.up),
    count,
    length: route.length * 5,
    duration: route.duration,
    at,
    progress: (t: number) =>
      route.length ? trainDistance(route, t / route.duration) / route.length : 0,
  };
}

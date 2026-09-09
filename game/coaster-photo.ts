import * as THREE from "three";
import type { Building } from "./simulation";
import type { makeRidePath } from "./ride-path";

export type PhotoPath = Pick<ReturnType<typeof makeRidePath>, "points" | "length" | "at">;
export type PhotoPointBuilding = Building & { photoPoint?: number };
export const isPhotoPoint = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
/** The saved number is normalized ARC LENGTH, not normalized travel time. */
export function validPhotoPoint(b: Building): boolean {
  const u = (b as PhotoPointBuilding).photoPoint;
  return (
    u === undefined || (b.kind === "coaster" && !!b.track && b.track.length >= 4 && isPhotoPoint(u))
  );
}
export type PhotoLocation = { u: number; distance: number; position: THREE.Vector3 };
/** Closest point in Three.js world coordinates (x,z=map plane; y=height).
 * Projection uses each sampled segment, not just the closest vertex. No path mutation. */
export function closestPhotoPoint(
  path: PhotoPath,
  target: { x: number; y: number; z: number },
): PhotoLocation | null {
  if (
    path.points.length < 2 ||
    path.length <= 0 ||
    ![target.x, target.y, target.z].every(Number.isFinite)
  )
    return null;
  let distance2 = Infinity,
    u = 0;
  for (let i = 0; i < path.points.length - 1; i++) {
    const a = path.points[i],
      b = path.points[i + 1],
      dx = b.x - a.x,
      dy = b.y - a.y,
      dz = b.z - a.z;
    const length2 = dx * dx + dy * dy + dz * dz;
    const t = length2
      ? Math.max(
          0,
          Math.min(
            1,
            ((target.x - a.x) * dx + (target.y - a.y) * dy + (target.z - a.z) * dz) / length2,
          ),
        )
      : 0;
    const d =
      (a.x + dx * t - target.x) ** 2 +
      (a.y + dy * t - target.y) ** 2 +
      (a.z + dz * t - target.z) ** 2;
    if (d < distance2) {
      distance2 = d;
      u = (i + t) / (path.points.length - 1);
    }
  }
  return { u, distance: Math.sqrt(distance2), position: path.at(u).position.clone() };
}
/** Same selection in projected 2D pixels, preserving over/underpass height via project().
 * If two projected spans overlap exactly the first wins; UI may offer next/previous. */
export function closestPhotoPoint2D(
  path: PhotoPath,
  target: { x: number; y: number },
  project: (p: THREE.Vector3) => { x: number; y: number },
): PhotoLocation | null {
  if (path.points.length < 2 || path.length <= 0 || ![target.x, target.y].every(Number.isFinite))
    return null;
  let distance2 = Infinity,
    u = 0,
    a = project(path.points[0]);
  for (let i = 0; i < path.points.length - 1; i++) {
    const b = project(path.points[i + 1]),
      dx = b.x - a.x,
      dy = b.y - a.y,
      length2 = dx * dx + dy * dy;
    const t = length2
      ? Math.max(0, Math.min(1, ((target.x - a.x) * dx + (target.y - a.y) * dy) / length2))
      : 0;
    const d = (a.x + dx * t - target.x) ** 2 + (a.y + dy * t - target.y) ** 2;
    if (Number.isFinite(d) && d < distance2) {
      distance2 = d;
      u = (i + t) / (path.points.length - 1);
    }
    a = b;
  }
  return Number.isFinite(distance2)
    ? { u, distance: Math.sqrt(distance2), position: path.at(u).position.clone() }
    : null;
}
/** Strict-before/inclusive-after threshold. Equal frames and backwards seeking do
 * not fire. Inputs can be monotonically increasing unwrapped laps (0..1..2...),
 * although RideView currently uses a single0..1 run. Point0 fires at the finish,
 * identically to point1, avoiding a photo on initial mount. Forward timeline seeks
 * must reset the caller's previous sample BEFORE this check. */
export function crossedPhotoPoint(
  previous: number | null,
  current: number,
  point: number,
): boolean {
  if (
    previous === null ||
    ![previous, current].every(Number.isFinite) ||
    previous < 0 ||
    current <= previous ||
    !isPhotoPoint(point)
  )
    return false;
  const target = point === 0 ? 1 : point;
  return Math.floor(current - target) > Math.floor(previous - target);
}
/** Shared world-space anchors for the2D overlay and3D rig. */
export function photoHardwarePoints(path: PhotoPath, u: number) {
  if (!isPhotoPoint(u) || path.length <= 0) return null;
  const f = path.at(u);
  const local = (x: number, y: number, z = 0) =>
    f.position
      .clone()
      .addScaledVector(f.right, x)
      .addScaledVector(f.up, y)
      .addScaledVector(f.tangent, -z);
  return {
    center: local(0, 1.35),
    leftBase: local(-1.95, -0.2),
    rightBase: local(1.95, -0.2),
    leftTop: local(-1.95, 3.8),
    rightTop: local(1.95, 3.8),
    beamA: local(-1.86, 1.35),
    beamB: local(1.86, 1.35),
    camera: local(2.18, 2.65),
    flash: local(2.18, 3.06),
  };
}
/** Adds a track-mounted camera gantry. Every GPU resource is owned by a mesh
 * under root, so the existing world/ride-view traversal disposes it exactly once.
 * No scene lights, timers, capture side effects, persistent cache or path edits. */
export function addPhotoHardware(scene: THREE.Scene, path: PhotoPath, u: number) {
  if (!isPhotoPoint(u) || path.length <= 0) return null;
  const f = path.at(u),
    root = new THREE.Group();
  root.name = "coaster-photo-hardware";
  root.position.copy(f.position);
  root.quaternion.copy(f.quaternion);
  scene.add(root);
  const cube = new THREE.BoxGeometry(1, 1, 1),
    cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const dark = new THREE.MeshStandardMaterial({
    color: "#34494b",
    metalness: 0.35,
    roughness: 0.5,
  });
  const yellow = new THREE.MeshStandardMaterial({ color: "#efc252", roughness: 0.55 });
  const black = new THREE.MeshStandardMaterial({ color: "#162b36", roughness: 0.35 });
  const lens = new THREE.MeshStandardMaterial({
    color: "#83d5e1",
    metalness: 0.5,
    roughness: 0.15,
    emissive: "#236977",
    emissiveIntensity: 0.35,
  });
  const beam = new THREE.MeshBasicMaterial({
    color: "#56e1ef",
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const flash = new THREE.MeshBasicMaterial({ color: "#fff7d2" });
  function mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    parent: THREE.Object3D = root,
  ) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    parent.add(m);
    return m;
  }
  for (const side of [-1, 1]) {
    mesh(cube, dark, side * 1.95, 1.8, 0, 0.13, 4, 0.16);
    mesh(cube, yellow, side * 1.95, 0.2, 0, 0.28, 0.75, 0.25);
    mesh(cube, dark, side * 1.95, -0.24, 0, 0.72, 0.18, 0.5);
    mesh(cube, black, side * 1.95, 1.35, 0, 0.24, 0.3, 0.28);
    mesh(cube, lens, side * 1.82, 1.35, 0, 0.07, 0.11, 0.14);
  }
  mesh(cube, dark, 0, 3.82, 0, 4.1, 0.17, 0.18);
  mesh(cube, yellow, 0, 3.82, -0.1, 1.05, 0.42, 0.1);
  const ray = mesh(cylinder, beam, 0, 1.35, 0, 0.025, 3.72, 0.025);
  ray.rotation.z = Math.PI / 2;
  const camera = new THREE.Group();
  camera.position.set(2.18, 2.65, 0);
  camera.rotation.y = -Math.PI / 2;
  root.add(camera);
  mesh(cube, dark, 0, 0, 0, 0.68, 0.48, 0.5, camera);
  mesh(cube, black, 0, 0, 0.27, 0.54, 0.36, 0.1, camera);
  const barrel = mesh(cylinder, black, 0, 0, 0.4, 0.17, 0.3, 0.17, camera);
  barrel.rotation.x = Math.PI / 2;
  const glass = mesh(cylinder, lens, 0, 0, 0.56, 0.135, 0.035, 0.135, camera);
  glass.rotation.x = Math.PI / 2;
  mesh(cube, black, 0, 0.41, 0, 0.49, 0.24, 0.21, camera);
  mesh(cube, flash, 0, 0.41, 0.115, 0.39, 0.16, 0.03, camera);
  return {
    root,
    setFlash: (amount: number) => {
      const v = Number.isFinite(amount) ? Math.max(0, Math.min(1, amount)) : 0;
      flash.color.set(v > 0 ? "#ffffff" : "#fff7d2");
      beam.opacity = 0.42 + v * 0.28;
      lens.emissiveIntensity = 0.35 + v * 0.65;
    },
  };
}

import * as THREE from "three";
import { createGuestModel } from "./guest-model";
import type { Building, Park } from "./simulation";
import {
  rapidsChannel,
  rapidsPose,
  RAPIDS_BOATS,
  RAPIDS_SEATS,
  RAPIDS_DURATION,
} from "./water-rides";
/** Boats, seats and cameras are part of the same articulated rig. */
export function createWaterRideRig(b: Building, park: Park) {
  const root = new THREE.Group();
  root.name = `rapids-${b.id}`;
  root.position.set((b.x + 2.5) * 5, (b.z ?? 0) * 5, (b.y + 2.5) * 5);
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (c: string) => {
    if (!materials.has(c))
      materials.set(
        c,
        new THREE.MeshStandardMaterial({
          color: c,
          roughness: c === "#63bed0" ? 0.2 : 0.65,
          metalness: 0.07,
        }),
      );
    return materials.get(c)!;
  };
  const cube = (
    parent: THREE.Object3D,
    c: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z);
    parent.add(m);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const cyl = (
    parent: THREE.Object3D,
    c: string,
    r: number,
    h: number,
    x: number,
    y: number,
    z: number,
  ) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), mat(c));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const vectors = Array.from({ length: 129 }, (_, i) => {
    const p = rapidsChannel(i / 128);
    return new THREE.Vector3(p.x, p.y, p.z);
  });
  const route = new THREE.CatmullRomCurve3(vectors, true, "centripetal");
  // Flat cross-section trough made from strips; the narrow berms and flowing surface remain visibly separate.
  for (let i = 0; i < 128; i++) {
    const a = vectors[i],
      c = vectors[i + 1],
      delta = c.clone().sub(a),
      mid = a.clone().add(c).multiplyScalar(0.5),
      yaw = Math.atan2(delta.x, delta.z);
    const g = new THREE.Group();
    g.position.copy(mid);
    g.rotation.y = yaw;
    root.add(g);
    cube(g, "#a8b8a5", 0, -0.19, 0, 3.9, 0.4, delta.length() + 0.1);
    cube(g, "#63bed0", 0, 0.04, 0, 3.05, 0.09, delta.length() + 0.11);
    for (const side of [-1, 1])
      cube(g, "#ceb88d", side * 1.8, 0.2, 0, 0.35, 0.65, delta.length() + 0.11);
    if (i % 8 === 0)
      for (const side of [-1, 1])
        cube(g, "#746748", side * 1.8, -mid.y / 2 - 0.1, 0, 0.25, Math.max(0.3, mid.y), 0.25);
  }
  const rocks = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(rocks, mat(i % 2 ? "#8f9986" : "#b5af97"));
    const a = (i * Math.PI) / 6;
    m.position.set(Math.cos(a) * 5.8, 0.65 + (i % 3) * 0.2, Math.sin(a) * 4.2);
    m.scale.set(1.1, 0.7 + (i % 3) * 0.3, 1.35);
    root.add(m);
  }
  for (const x of [-2, 2]) cyl(root, "#4c8874", 0.12, 2.4, x, 1.2, -4.5);
  cube(root, "#ecbc70", 0, 2.5, -4.5, 4.6, 0.55, 0.25);
  const seats: THREE.Object3D[] = [],
    passengers: THREE.Object3D[] = [],
    boats: THREE.Group[] = [],
    splashes: THREE.Object3D[] = [];
  for (let i = 0; i < RAPIDS_BOATS; i++) {
    const boat = new THREE.Group();
    boat.name = `rapids-boat-${i}`;
    boats.push(boat);
    root.add(boat);
    const tube = new THREE.Mesh(new THREE.TorusGeometry(1.33, 0.32, 10, 24), mat("#35575a"));
    tube.rotation.x = Math.PI / 2;
    tube.position.y = 0.16;
    boat.add(tube);
    cyl(boat, "#d79e60", 1.15, 0.22, 0, 0.23, 0);
    cyl(boat, "#c5e0d6", 0.33, 0.95, 0, 0.62, 0);
    for (let j = 0; j < RAPIDS_SEATS; j++) {
      const a = (j * Math.PI) / 2,
        mount = new THREE.Group();
      mount.position.set(Math.sin(a) * 0.88, 0.55, Math.cos(a) * 0.88);
      mount.rotation.y = a;
      boat.add(mount);
      cube(mount, ["#d98476", "#93bdb0", "#dab66f"][i], 0, 0, 0, 0.67, 0.2, 0.7);
      cube(mount, "#e7d5a2", 0, 0.35, 0.37, 0.7, 0.75, 0.18);
      const guest = park.guests.find((g) => g.id === b.riders[i * RAPIDS_SEATS + j]),
        person = createGuestModel(guest);
      person.visible = !!guest;
      person.userData.occupied = !!guest;
      mount.add(person);
      passengers.push(person);
      const eye = new THREE.Object3D();
      eye.position.set(0, 0.97, -0.12);
      mount.add(eye);
      seats.push(eye);
      cube(mount, "#477a76", 0, 0.34, -0.4, 0.72, 0.07, 0.07);
    }
    for (let j = 0; j < 6; j++) {
      const splash = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), mat("#dbf5ec"));
      root.add(splash);
      splashes.push(splash);
    }
  }
  const update = (time: number) => {
    const phase = (((time / RAPIDS_DURATION) % 1) + 1) % 1;
    boats.forEach((boat, i) => {
      const p = rapidsPose(i, phase);
      boat.position.set(p.x, p.y + 0.2, p.z);
      boat.rotation.set(p.pitch * 0.3, p.yaw + p.spin, p.roll);
      for (let j = 0; j < 6; j++) {
        const splash = splashes[i * 6 + j],
          f = (((time * 1.6 + j / 6) % 1) + 1) % 1;
        splash.visible = phase > 0 && p.pitch < -0.05;
        splash.position.set(
          p.x + Math.cos(j) * 1.6,
          p.y + Math.sin(f * Math.PI) * 0.8,
          p.z + Math.sin(j) * 1.6,
        );
        splash.scale.setScalar(1 - f * 0.8);
      }
    });
    root.updateMatrixWorld(true);
  };
  update(0);
  // Curve is a shared reference for diagnostics, not a disconnected alternate animation.
  root.userData.route = route;
  return { root, seats, passengers, duration: RAPIDS_DURATION, update };
}

import * as THREE from "three";
import { type TransitLine, transportCarPose, transportClock, transportSpeed } from "./transit";
import { createGuestModel } from "./guest-model";
import type { Park } from "./simulation";
export function createTransportRig(line: TransitLine, park: Park) {
  const root = new THREE.Group(),
    seats: THREE.Object3D[] = [],
    passengers: THREE.Object3D[] = [],
    cars: THREE.Group[] = [];
  const cube = new THREE.BoxGeometry(1, 1, 1),
    sphere = new THREE.SphereGeometry(1, 12, 8),
    cylinder = new THREE.CylinderGeometry(1, 1, 1, 16),
    mats = new Map<string, THREE.MeshStandardMaterial>();
  const mesh = (
    parent: THREE.Object3D,
    c: string,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    g: THREE.BufferGeometry = cube,
  ) => {
    if (!mats.has(c)) mats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.65 }));
    const m = new THREE.Mesh(g, mats.get(c));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    parent.add(m);
    return m;
  };
  const train = line.kind === "train",
    total = train ? 4 : 1;
  for (let car = 0; car < total; car++) {
    const group = new THREE.Group();
    cars.push(group);
    root.add(group);
    const loco = train && car === 0,
      col = loco ? "#cf5a3d" : train ? "#d4a442" : "#4d8eab",
      length = loco ? 3.7 : train ? 3.5 : 5.8;
    mesh(group, col, 0, 0.65, 0, 2.25, 0.6, length);
    for (const side of [-1, 1])
      for (const z of [-length * 0.32, length * 0.32]) {
        const wheel = mesh(group, "#303e40", side * 1.04, 0.45, z, 0.37, 0.15, 0.37, cylinder);
        wheel.rotation.z = Math.PI / 2;
        mesh(group, "#d2c595", side * 1.15, 0.45, z, 0.12, 0.07, 0.12, cylinder).rotation.z =
          Math.PI / 2;
      }
    if (loco) {
      mesh(group, "#d6533e", 0, 1.25, -0.65, 0.76, 1.75, 0.76, cylinder).rotation.x = Math.PI / 2;
      mesh(group, "#f0d894", 0, 1.28, -1.55, 0.54, 0.12, 0.54, cylinder).rotation.x = Math.PI / 2;
      mesh(group, "#304c46", 0, 2, -0.85, 0.21, 0.8, 0.21, cylinder);
      mesh(group, "#287b7d", 0, 1.3, 0.95, 2.1, 1.1, 1.15);
      mesh(group, "#f5e7ba", 0, 2.68, 0.95, 2.35, 0.18, 1.7);
      for (const side of [-0.92, 0.92]) mesh(group, "#256b6d", side, 2, 0.95, 0.09, 1.5, 0.09);
    } else {
      const n = train ? 4 : 8;
      mesh(group, "#fcf0c9", 0, 2.45, 0, 2.38, 0.16, length + 0.12);
      for (const x of [-1, 1])
        for (const z of [-length * 0.42, length * 0.42])
          mesh(group, "#2e7577", x, 1.73, z, 0.055, 1.4, 0.055);
      for (let i = 0; i < n; i++) {
        const index = seats.length,
          x = i % 2 ? 0.56 : -0.56,
          z = train ? (Math.floor(i / 2) - 0.5) * 1.35 : (Math.floor(i / 2) - 1.5) * 1.2;
        mesh(group, "#f6dda1", x, 1.05, z, 0.36, 0.09, 0.34, sphere);
        mesh(group, "#edd199", x, 1.4, z + 0.22, 0.35, 0.38, 0.1, sphere);
        const person = createGuestModel(park.guests.find((g) => g.id === line.passengers[index]));
        person.position.set(x, 1.05, z);
        person.visible = index < line.passengers.length;
        group.add(person);
        passengers.push(person);
        const eye = new THREE.Object3D();
        eye.position.set(x, 1.93, z - 0.13);
        group.add(eye);
        seats.push(eye);
      }
      for (const side of [-1, 1]) mesh(group, col, side, 1.1, 0, 0.1, 0.55, length);
    }
  }
  const duration = ((line.route.length - 1) / transportSpeed(line.kind)) * 2 + 8;
  const update = (t: number) => {
    cars.forEach((car, i) => {
      const p = transportCarPose(line, i, transportClock(line) + t);
      car.position.set(p.x * 5, 0, p.y * 5);
      car.rotation.y = Math.atan2(-p.headingX, -p.headingY);
    });
    root.updateMatrixWorld(true);
  };
  update(0);
  return { root, seats, passengers, duration, update };
}

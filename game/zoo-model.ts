import * as THREE from "three";
import type { Building } from "./simulation";
import { isHabitat, SPECIES, type Species } from "./zoo";
import { animalPose } from "./zoo-motion";

/** Recognizable species geometry with articulated legs/flippers and a shared habitat layout. */
export function createHabitatModel(b: Building) {
  const root = new THREE.Group(),
    species = b.kind as Species,
    n = SPECIES[species].size;
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (c: string) => {
    if (!mats.has(c)) mats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
    return mats.get(c)!;
  };
  const box = new THREE.BoxGeometry(1, 1, 1),
    ball = new THREE.SphereGeometry(1, 10, 8),
    pole = new THREE.CylinderGeometry(1, 1, 1, 8);
  const mesh = (
    parent: THREE.Object3D,
    g: THREE.BufferGeometry,
    c: string,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
  ) => {
    const m = new THREE.Mesh(g, mat(c));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    parent.add(m);
    return m;
  };
  const span = n * 5,
    cx = (b.x + (n - 1) / 2) * 5,
    cz = (b.y + (n - 1) / 2) * 5;
  root.position.set(cx, 0, cz);
  mesh(
    root,
    box,
    species === "penguin" ? "#c5c6bd" : species === "flamingo" ? "#b7bc83" : "#b7b46a",
    0,
    0.09,
    0,
    span - 0.3,
    0.12,
    span - 0.3,
  );
  const water = species === "penguin" || species === "flamingo";
  mesh(
    root,
    ball,
    "#66bbc5",
    span * 0.15,
    0.12,
    span * 0.08,
    water ? span * 0.29 : 1.4,
    0.13,
    water ? span * 0.25 : 1.05,
  );
  for (let side = 0; side < 4; side++)
    for (let i = 0; i < n; i++) {
      const a = -span / 2 + i * 5,
        edge = span / 2;
      const x = side % 2 ? a : side === 0 ? -edge : edge,
        z = side % 2 ? (side === 1 ? -edge : edge) : a;
      mesh(root, pole, "#735b39", x, 0.9, z, 0.15, 1.8, 0.15);
      for (const height of [0.55, 1.25])
        mesh(
          root,
          box,
          "#9c7c4e",
          side % 2 ? x + 2.5 : x,
          height,
          side % 2 ? z : z + 2.5,
          side % 2 ? 5 : 0.12,
          0.13,
          side % 2 ? 0.12 : 5,
        );
    }
  mesh(root, box, "#745132", -span * 0.28, 0.35, -span * 0.3, 2.8, 0.7, 1.5);
  mesh(root, ball, "#c6bb64", -span * 0.28, 0.76, -span * 0.3, 1.2, 0.22, 0.6);
  if (b.habitat?.shelter) {
    for (const x of [-2, 2])
      for (const z of [-1.5, 1.5])
        mesh(root, pole, "#6a573e", x + span * 0.24, 1.8, z - span * 0.27, 0.15, 3.6, 0.15);
    mesh(root, box, "#ad6847", span * 0.24, 3.65, -span * 0.27, 5, 0.35, 4);
  }
  if (b.habitat?.enrichment) {
    mesh(root, ball, "#e4b044", -span * 0.17, 0.65, span * 0.3, 0.65, 0.65, 0.65);
    mesh(root, pole, "#665538", span * 0.27, 0.4, span * 0.3, 0.65, 0.8, 0.65);
  }
  const animals = Array.from({ length: b.habitat?.count ?? 0 }, (_, i) => {
    const a = new THREE.Group();
    root.add(a);
    const limbs: THREE.Mesh[] = [];
    if (species === "zebra" || species === "giraffe") {
      const giraffe = species === "giraffe",
        color = giraffe ? "#d7aa58" : "#eee6d4",
        tall = giraffe ? 1.55 : 1;
      mesh(a, ball, color, 0, 1.35 * tall, 0, 0.65, 0.68, 1.14);
      for (const x of [-0.4, 0.4])
        for (const z of [-0.72, 0.72]) {
          limbs.push(mesh(a, pole, color, x, 0.69 * tall, z, 0.12, 1.35 * tall, 0.12));
          mesh(a, box, "#333731", x, 0.09, z, 0.22, 0.18, 0.27);
        }
      const neck = mesh(
        a,
        pole,
        color,
        0,
        giraffe ? 3.2 : 1.95,
        -0.9,
        giraffe ? 0.21 : 0.27,
        giraffe ? 2.6 : 0.8,
        0.25,
      );
      neck.rotation.x = -0.18;
      mesh(a, ball, color, 0, giraffe ? 4.55 : 2.38, giraffe ? -1.22 : -1.07, 0.34, 0.35, 0.56);
      mesh(a, ball, "#675348", 0, giraffe ? 4.44 : 2.24, giraffe ? -1.66 : -1.49, 0.29, 0.2, 0.23);
      for (const x of [-0.28, 0.28]) {
        mesh(a, ball, color, x, giraffe ? 4.8 : 2.74, -1.03, 0.14, 0.26, 0.11);
        mesh(a, ball, "#172521", x * 0.95, giraffe ? 4.62 : 2.43, -1.39, 0.047, 0.05, 0.04);
        if (giraffe) mesh(a, pole, "#725334", x * 0.6, 5.04, -1.13, 0.055, 0.35, 0.055);
      }
      if (giraffe)
        for (let j = 0; j < 24; j++) {
          const ang = j * 2.399,
            y = 1.65 + (j % 4) * 0.23;
          mesh(a, ball, "#946135", Math.cos(ang) * 0.61, y, Math.sin(ang) * 1.03, 0.14, 0.19, 0.16);
        }
      else
        for (let j = 0; j < 8; j++) {
          const stripe = mesh(a, box, "#30352f", 0, 1.55, -0.85 + j * 0.24, 1.27, 0.7, 0.085);
          stripe.rotation.z = (j % 2 ? 1 : -1) * 0.14;
        }
      const tail = mesh(a, pole, "#4a4034", 0, 1.12 * tall, 1.26, 0.05, 0.85, 0.05);
      tail.rotation.x = -0.3;
    } else if (species === "penguin") {
      mesh(a, ball, "#233746", 0, 0.68, 0, 0.4, 0.64, 0.32);
      mesh(a, ball, "#f4ede1", 0, 0.66, -0.2, 0.31, 0.48, 0.16);
      mesh(a, ball, "#233746", 0, 1.24, -0.08, 0.3, 0.28, 0.27);
      mesh(a, box, "#e5a743", 0, 1.15, -0.36, 0.2, 0.12, 0.3);
      for (const side of [-1, 1]) {
        const wing = mesh(a, ball, "#233746", side * 0.43, 0.64, 0, 0.11, 0.43, 0.2);
        limbs.push(wing);
        mesh(a, ball, "#e5a743", side * 0.2, 0.09, -0.17, 0.16, 0.09, 0.24);
        mesh(a, ball, "#faf6e2", side * 0.18, 1.31, -0.26, 0.047, 0.052, 0.035);
      }
    } else {
      mesh(a, ball, "#ef97a3", 0, 0.99, 0, 0.34, 0.36, 0.56);
      for (const side of [-1, 1])
        limbs.push(mesh(a, pole, "#a66064", side * 0.12, 0.43, 0, 0.032, 0.86, 0.032));
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 1.05, -0.35),
        new THREE.Vector3(0, 1.48, -0.53),
        new THREE.Vector3(0, 1.85, -0.28),
        new THREE.Vector3(0, 2.04, -0.58),
      ]);
      mesh(a, new THREE.TubeGeometry(curve, 12, 0.075, 6, false), "#ed9caa", 0, 0, 0, 1, 1, 1);
      mesh(a, ball, "#f3b1b9", 0, 2.05, -0.61, 0.14, 0.17, 0.22);
      const beak = mesh(a, box, "#272d32", 0, 1.94, -0.85, 0.11, 0.15, 0.2);
      beak.rotation.x = -0.5;
      for (const side of [-1, 1])
        mesh(a, ball, "#26252b", side * 0.12, 2.07, -0.68, 0.023, 0.024, 0.02);
    }
    return { a, limbs, i };
  });
  return {
    root,
    update: (time: number) =>
      animals.forEach(({ a, limbs, i }) => {
        const p = animalPose(b, i, time);
        a.position.set(p.x * 5 - cx, p.bob, p.y * 5 - cz);
        a.rotation.y = Math.atan2(-p.dx, -p.dy);
        limbs.forEach((leg, j) => {
          if (species === "penguin")
            leg.rotation.z = (j ? 1 : -1) * (0.12 + Math.sin(time * 4 + i) * 0.16);
          else leg.rotation.x = p.walk ? Math.sin(time * 4 + i + j * Math.PI) * 0.15 : 0;
        });
      }),
  };
}

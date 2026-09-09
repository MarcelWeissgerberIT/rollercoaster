import * as THREE from "three";
import { effectivePods, CATALOG, type Park } from "./simulation";
import { podPose, usesPods } from "./pods";
export function addAccessPods(scene: THREE.Scene, park: Park) {
  const cube = new THREE.BoxGeometry(1, 1, 1),
    materials = new Map<string, THREE.MeshStandardMaterial>();
  const box = (
    parent: THREE.Object3D,
    color: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) => {
    if (!materials.has(color))
      materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.65 }));
    const m = new THREE.Mesh(cube, materials.get(color));
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    parent.add(m);
    return m;
  };
  let count = 0;
  for (const b of park.buildings) {
    if (!usesPods(b.kind)) continue;
    const pods = effectivePods(park, b);
    for (const role of ["entry", "exit"] as const) {
      count++;
      const p = podPose(b, CATALOG[b.kind].size, pods[role]),
        g = new THREE.Group(),
        color = role === "entry" ? "#327abc" : "#c44c49";
      g.name = `${role}-pod-${b.id}`;
      g.position.set(p.x * 5, 0, p.y * 5);
      g.rotation.y = Math.atan2(p.dx, p.dy);
      scene.add(g);
      box(g, color, 0, 0.1, 0.9, 3.4, 0.15, 3.6);
      box(g, "#f0e5c4", -0.8, 1.05, 0, 1.45, 1.9, 1.4);
      box(g, color, -0.8, 2.1, 0, 1.8, 0.32, 1.7);
      box(g, "#264c52", -0.8, 1.4, 0.72, 0.85, 0.65, 0.06);
      box(g, "#d6ddce", 0.25, 0.8, 0.1, 0.12, 1.6, 0.12);
      box(g, "#d6ddce", 1.35, 0.8, 0.1, 0.12, 1.6, 0.12);
      box(g, color, 0.8, 1.6, 0.1, 1.3, 0.25, 0.2);
      box(g, "#fdf4d5", 0.8, 1.0, 0.1, 1.15, 0.1, 0.1);
      // White direction mark on the canopy, visible without texture loading.
      box(g, "#fff8da", -0.8, 2.29, 0, 0.13, 0.025, 0.8);
      for (const side of [-1, 1]) {
        const arm = box(
          g,
          "#fff8da",
          -0.8 + side * 0.15,
          2.29,
          role === "entry" ? -0.22 : 0.22,
          0.13,
          0.025,
          0.42,
        );
        arm.rotation.y = side * (role === "entry" ? 1 : -1) * 0.75;
      }
    }
  }
  if (!count) cube.dispose();
}

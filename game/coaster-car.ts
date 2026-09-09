import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { wagonPaint, carSeat, type Vehicle } from "./vehicles";
/** One shared, detailed car model for both park cameras and on-ride views. Front points toward -Z. */
export function createCoasterCar(vehicle: Vehicle, index = 0) {
  const v = wagonPaint(vehicle, index),
    root = new THREE.Group();
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const material = (c: string) => {
    if (!materials.has(c))
      materials.set(
        c,
        new THREE.MeshStandardMaterial({ color: c, roughness: 0.48, metalness: 0.12 }),
      );
    return materials.get(c)!;
  };
  function box(c: string, x: number, y: number, z: number, w: number, h: number, d: number) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(c));
    m.position.set(x, y, z);
    root.add(m);
    return m;
  }
  const dark = "#283a42",
    metal = "#c3d7d8";
  box(dark, 0, 0.16, 0, 1.5, 0.18, 2.7);
  if (v.model === "mine") {
    for (const side of [-1, 1]) {
      for (let j = 0; j < 3; j++) box(v.body, side * 0.79, 0.4 + j * 0.23, 0, 0.14, 0.19, 2.55);
      for (const z of [-1, 1]) box(v.accent, side * 0.87, 0.69, z, 0.08, 0.88, 0.14);
    }
    box(v.body, 0, 0.6, -1.22, 1.6, 0.8, 0.14);
  } else if (v.model === "sport") {
    const nose = box(v.body, 0, 0.45, -0.85, 1.45, 0.53, 1.5);
    nose.rotation.x = -0.17;
    box(v.accent, 0, 0.69, -0.92, 0.22, 0.055, 1.55);
    for (const side of [-1, 1]) {
      box(v.body, side * 0.76, 0.52, 0.15, 0.16, 0.44, 1.75);
      const fin = box(v.accent, side * 0.83, 0.79, 0.91, 0.09, 0.7, 0.67);
      fin.rotation.x = -0.26;
    }
  } else {
    const shape = new THREE.Shape();
    shape.moveTo(-0.78, 0.9);
    shape.lineTo(-0.78, -0.65);
    shape.quadraticCurveTo(-0.78, -1.5, 0, -1.5);
    shape.quadraticCurveTo(0.78, -1.5, 0.78, -0.65);
    shape.lineTo(0.78, 0.9);
    shape.closePath();
    const shell = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.55,
        bevelEnabled: true,
        bevelSize: 0.09,
        bevelThickness: 0.06,
        bevelSegments: 2,
        steps: 1,
      }),
      material(v.body),
    );
    shell.rotation.x = Math.PI / 2;
    shell.position.y = 0.76;
    root.add(shell);
    for (const side of [-1, 1]) box(v.accent, side * 0.8, 0.73, 0.1, 0.07, 0.15, 1.8);
  }
  for (const seat of [0, 1]) {
    const { x, z } = carSeat(v, seat);
    box(v.seats, x, 0.72, z, 0.61, 0.15, 0.7);
    const back = box(v.seats, x, 1.08, z + 0.4, 0.61, 0.7, 0.16);
    back.rotation.x = -0.08;
    box(v.accent, x, 1.49, z + 0.46, 0.43, 0.16, 0.16);
    box(metal, x, 0.97, z - 0.38, 0.58, 0.06, 0.07);
    for (const sign of [-1, 1]) box(dark, x + sign * 0.27, 0.82, z - 0.38, 0.045, 0.32, 0.045);
  }
  for (const side of [-1, 1])
    for (const z of [-0.85, 0.85]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 0.18, 12),
        material(dark),
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 0.8, 0.17, z);
      root.add(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.19, 10), material(metal));
      hub.rotation.z = Math.PI / 2;
      hub.position.copy(wheel.position);
      root.add(hub);
    }
  box(dark, 0, 0.2, 1.52, 0.14, 0.14, 0.4);
  root.updateMatrixWorld(true);
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const child of [...root.children])
    if (child instanceof THREE.Mesh) {
      const geom = (
          child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone()
        ).applyMatrix4(child.matrixWorld),
        list = groups.get(child.material) ?? [];
      list.push(geom);
      groups.set(child.material, list);
      child.geometry.dispose();
      root.remove(child);
    }
  for (const [mat, list] of groups) {
    const geometry = mergeGeometries(list);
    list.forEach((g) => g.dispose());
    if (geometry) root.add(new THREE.Mesh(geometry, mat));
  }
  return root;
}

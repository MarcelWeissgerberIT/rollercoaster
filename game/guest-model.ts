import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { guestAppearance } from "./guest-identity";
import type { Guest } from "./simulation";
type Part = { p: number[]; s: number[]; color: string; angle?: number; head?: boolean };
const sphere = new THREE.SphereGeometry(1, 12, 8);
/** Human proportions in metres, looking along -Z. Seated origin is the cushion. */
export function personParts(
  g: Pick<Guest, "id" | "skin"> | undefined,
  seated: boolean,
  phase = 0,
): Part[] {
  const c = guestAppearance(g),
    hip = seated ? 0.12 : 0.85,
    neck = hip + 0.51,
    headY = neck + 0.24;
  const parts: Part[] = [];
  const add = (color: string, p: number[], s: number[], head = false, angle = 0) =>
    parts.push({ color, p, s, head, angle });
  const limb = (color: string, a: number[], b: number[], r: number, wide = r) => {
    const dy = b[1] - a[1],
      dz = b[2] - a[2];
    add(
      color,
      [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
      [wide, Math.hypot(dy, dz) / 2 + r, r],
      false,
      Math.atan2(-dz, dy),
    );
  };
  add(c.shirt, [0, hip + 0.29, 0.035], [0.225, 0.285, 0.14]);
  add(c.pants, [0, hip, 0.025], [0.205, 0.14, 0.135]);
  add(c.skin, [0, neck + 0.06, 0], [0.06, 0.09, 0.055]);
  add(c.skin, [0, headY, 0], [0.145, 0.175, 0.14], true);
  add(c.hair, [0, headY + 0.113, 0.026], [0.15, 0.089, 0.133], true);
  add(
    c.hair,
    [(g?.id ?? 0) % 2 ? 0.075 : -0.075, headY + 0.065, -0.102],
    [0.077, 0.065, 0.05],
    true,
  );
  for (const side of [-1, 1]) {
    add(c.skin, [side * 0.145, headY - 0.01, 0.012], [0.029, 0.051, 0.031], true);
    add("#fef9ed", [side * 0.055, headY + 0.012, -0.132], [0.034, 0.024, 0.013], true);
    add("#343531", [side * 0.055, headY + 0.012, -0.144], [0.011, 0.016, 0.006], true);
    add(c.hair, [side * 0.055, headY + 0.052, -0.128], [0.04, 0.01, 0.011], true);
    const swing = seated ? 0 : Math.sin(phase + (side > 0 ? Math.PI : 0));
    const shoulder = [side * 0.215, neck - 0.06, 0.03],
      elbow = [side * 0.27, hip + 0.27, seated ? -0.14 : 0.03 + swing * 0.12],
      hand = [side * 0.27, hip + 0.12, seated ? -0.32 : swing * 0.21];
    limb(c.shirt, shoulder, [side * 0.25, hip + 0.37, seated ? -0.08 : swing * 0.06], 0.07, 0.073);
    limb(c.skin, [side * 0.25, hip + 0.37, seated ? -0.08 : swing * 0.06], elbow, 0.046);
    limb(c.skin, elbow, hand, 0.039);
    add(c.skin, hand, [0.05, 0.07, 0.038]);
    const knee = [side * 0.11, seated ? hip - 0.09 : 0.46, seated ? -0.36 : -swing * 0.18],
      ankle = [side * 0.11, seated ? -0.4 : 0.14, seated ? -0.41 : -swing * 0.3];
    limb(c.pants, [side * 0.105, hip, 0], knee, 0.083);
    limb(c.pants, knee, ankle, 0.059);
    add(c.shoes, [side * 0.11, ankle[1] - 0.058, ankle[2] - 0.065], [0.084, 0.074, 0.15]);
    add("#eae2cc", [side * 0.11, ankle[1] - 0.105, ankle[2] - 0.065], [0.085, 0.022, 0.151]);
  }
  add(c.skin, [0, headY - 0.017, -0.146], [0.025, 0.041, 0.027], true);
  add("#9d6252", [0, headY - 0.075, -0.126], [0.035, 0.009, 0.009], true);
  return parts;
}
export function createGuestModel(g?: Pick<Guest, "id" | "skin">, seated = true) {
  const root = new THREE.Group(),
    material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
  const parts = personParts(g, seated);
  for (const isHead of [false, true]) {
    const geometries = parts
      .filter((p) => !!p.head === isHead)
      .map((p) => {
        const geometry = sphere.clone();
        geometry.scale(p.s[0], p.s[1], p.s[2]);
        geometry.rotateX(-(p.angle ?? 0));
        geometry.translate(p.p[0], p.p[1], p.p[2]);
        const col = new THREE.Color(p.color),
          colors = new Float32Array(geometry.attributes.position.count * 3);
        for (let i = 0; i < colors.length; i += 3) {
          colors[i] = col.r;
          colors[i + 1] = col.g;
          colors[i + 2] = col.b;
        }
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        return geometry;
      });
    const merged = mergeGeometries(geometries);
    geometries.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = isHead ? "head" : "body";
    root.add(mesh);
  }
  return root;
}
export function createCrowd(guests: Guest[]) {
  const count = personParts(guests[0], false).length;
  const mesh = new THREE.InstancedMesh(
    sphere.clone(),
    new THREE.MeshStandardMaterial({ roughness: 0.85 }),
    guests.length * count,
  );
  mesh.frustumCulled = false;
  const base = new THREE.Matrix4(),
    local = new THREE.Matrix4(),
    world = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    r = new THREE.Quaternion(),
    p = new THREE.Vector3(),
    s = new THREE.Vector3();
  guests.forEach((g, i) =>
    personParts(g, false).forEach((part, j) =>
      mesh.setColorAt(i * count + j, new THREE.Color(part.color)),
    ),
  );
  return {
    mesh,
    pose(i: number, x: number, z: number, yaw: number, phase: number, walking: boolean) {
      base.compose(
        p.set(x, walking ? Math.abs(Math.sin(phase)) * 0.025 : 0, z),
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw),
        s.set(1, 1, 1),
      );
      personParts(guests[i], false, walking ? phase : 0).forEach((part, j) => {
        local.compose(
          p.fromArray(part.p),
          r.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -(part.angle ?? 0)),
          s.fromArray(part.s),
        );
        world.multiplyMatrices(base, local);
        mesh.setMatrixAt(i * count + j, world);
      });
    },
    finish() {
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

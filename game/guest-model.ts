import { FOOD } from "./park-life";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { guestAppearance } from "./visitors";
import type { Guest } from "./simulation";
type GuestSource = Pick<Guest, "id" | "skin"> &
  Partial<Pick<Guest, "food" | "ageGroup" | "appearance" | "party">>;
type Part = { p: number[]; s: number[]; color: string; angle?: number; head?: boolean };
const sphere = new THREE.SphereGeometry(1, 12, 8);
/** Human proportions in metres, looking along -Z. Seated origin is the cushion. */
export function personParts(
  g: GuestSource | undefined,
  seated: boolean,
  phase = 0,
  walking = true,
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
  add(
    c.hair,
    [0, headY + (c.hairStyle === 2 ? 0.07 : 0.113), c.hairStyle === 2 ? 0.07 : 0.026],
    c.hairStyle === 2 ? [0.163, 0.15, 0.13] : [0.15, 0.089, 0.133],
    true,
  );
  add(
    c.hair,
    [c.hairStyle % 2 ? 0.075 : -0.075, headY + 0.065, -0.102],
    c.hairStyle === 1 ? [0.095, 0.075, 0.06] : [0.077, 0.065, 0.05],
    true,
  );
  // One fixed slot provides longer hair or a ponytail. Hidden slots keep every
  // person's instanced geometry count identical, regardless of outfit or age.
  add(
    c.hair,
    [0, headY - (c.hairStyle === 2 ? 0.06 : 0.025), 0.135],
    c.hairStyle === 2 ? [0.15, 0.145, 0.07] : c.hairStyle === 3 ? [0.073, 0.145, 0.095] : [0, 0, 0],
    true,
  );
  for (const side of [-1, 1]) {
    add(c.skin, [side * 0.145, headY - 0.01, 0.012], [0.029, 0.051, 0.031], true);
    add("#fef9ed", [side * 0.055, headY + 0.012, -0.132], [0.034, 0.024, 0.013], true);
    add("#343531", [side * 0.055, headY + 0.012, -0.144], [0.011, 0.016, 0.006], true);
    add(c.hair, [side * 0.055, headY + 0.052, -0.128], [0.04, 0.01, 0.011], true);
    const swing = seated || !walking ? 0 : Math.sin(phase + (side > 0 ? Math.PI : 0));
    const shoulder = [side * 0.215, neck - 0.06, 0.03],
      elbow = [side * 0.27, hip + 0.27, seated ? -0.14 : 0.03 + swing * 0.12],
      hand =
        g?.food && side > 0
          ? [side * 0.2, hip + 0.36 + Math.max(0, Math.sin(phase * 1.1)) * 0.3, -0.29]
          : [side * 0.27, hip + 0.12, seated ? -0.32 : swing * 0.21];
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
  const striped = c.pattern === "stripe" ? 1 : 0;
  for (const y of [hip + 0.25, hip + 0.39])
    add("#f5f0dc", [0, y, -0.103], [0.215 * striped, 0.025 * striped, 0.043 * striped]);
  // Accessories reuse exactly three geometry slots. Backpacks are tucked away
  // in ride seats so their volume cannot penetrate the backrest.
  const accessory = c.accessory === "backpack" && seated ? "none" : c.accessory;
  if (accessory === "cap") {
    add(c.shirt, [0, headY + 0.16, 0.015], [0.17, 0.07, 0.155], true);
    add(c.pants, [0, headY + 0.135, -0.13], [0.165, 0.019, 0.095], true);
    add(c.shirt, [0, headY + 0.22, 0.015], [0.022, 0.015, 0.022], true);
  } else if (accessory === "glasses") {
    for (const side of [-1, 1])
      add("#344351", [side * 0.055, headY + 0.012, -0.156], [0.043, 0.031, 0.013], true);
    add("#344351", [0, headY + 0.018, -0.158], [0.023, 0.007, 0.009], true);
  } else if (accessory === "backpack") {
    add(c.pants, [0, hip + 0.3, 0.17], [0.165, 0.19, 0.095]);
    for (const side of [-1, 1])
      add(c.pants, [side * 0.15, hip + 0.32, -0.078], [0.025, 0.2, 0.043]);
  } else {
    for (let i = 0; i < 3; i++) add(c.shirt, [0, hip, 0], [0, 0, 0]);
  }
  const food = g?.food,
    enabled = food ? 1 : 0,
    info = food && FOOD[food.kind];
  const fy = hip + 0.36 + Math.max(0, Math.sin(phase * 1.1)) * 0.3;
  add(info?.color ?? "#ffffff", [0.2, fy, -0.3], [0.11 * enabled, 0.08 * enabled, 0.075 * enabled]);
  add(
    food?.kind === "hotdog" ? "#b75d3c" : food?.kind === "icecream" ? "#fff0cd" : "#eadcb9",
    [0.2, fy + 0.045, -0.32],
    [0.09 * enabled, 0.035 * enabled, 0.05 * enabled],
  );
  add(
    info?.drink ? "#684533" : "#edca67",
    [0.2, fy + 0.06, -0.3],
    [0.08 * enabled, 0.009 * enabled, 0.06 * enabled],
  );
  const child = c.ageGroup === "child",
    height = c.heightScale,
    widthScale = height,
    legScale = height * (child ? 0.86 : 1),
    torsoScale = height * (child ? 0.92 : 1),
    headScale = height * (child ? 1.2 : 1),
    fittedHip = hip * (seated ? height : legScale),
    fittedHead = fittedHip + 0.51 * torsoScale + 0.24 * headScale;
  return parts.map((part) => {
    const verticalScale = part.head ? headScale : part.p[1] >= hip ? torsoScale : legScale,
      horizontalScale = part.head ? headScale : widthScale,
      angle = part.angle ?? 0,
      lengthScale = Math.hypot(Math.cos(angle) * verticalScale, Math.sin(angle) * horizontalScale);
    return {
      ...part,
      p: [
        part.p[0] * horizontalScale,
        part.head
          ? fittedHead + (part.p[1] - headY) * headScale
          : fittedHip + (part.p[1] - hip) * verticalScale,
        part.p[2] * horizontalScale,
      ],
      s: [part.s[0] * horizontalScale, part.s[1] * lengthScale, part.s[2] * horizontalScale],
      angle: Math.atan2(Math.sin(angle) * horizontalScale, Math.cos(angle) * verticalScale),
    };
  });
}
export function createGuestModel(g?: GuestSource, seated = true) {
  const root = new THREE.Group(),
    material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 }),
    appearance = guestAppearance(g);
  root.name = `guest-${appearance.ageGroup}-${g?.id ?? "empty"}`;
  root.userData.guestId = g?.id ?? null;
  root.userData.ageGroup = appearance.ageGroup;
  root.userData.heightScale = appearance.heightScale;
  root.userData.paletteIndex = appearance.paletteIndex;
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
  mesh.name = "visitor-crowd";
  mesh.userData.visitors = guests.map((g) => {
    const appearance = guestAppearance(g);
    return { id: g.id, ageGroup: appearance.ageGroup, heightScale: appearance.heightScale };
  });
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
    pose(
      i: number,
      x: number,
      z: number,
      yaw: number,
      phase: number,
      walking: boolean,
      seated = false,
      height = 0,
    ) {
      base.compose(
        p.set(x, height + (walking ? Math.abs(Math.sin(phase)) * 0.025 : 0), z),
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw),
        s.set(1, 1, 1),
      );
      personParts(guests[i], seated, phase, walking).forEach((part, j) => {
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

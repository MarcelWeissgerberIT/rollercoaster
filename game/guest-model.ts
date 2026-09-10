import { FOOD } from "./park-life";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { guestAppearance } from "./visitors";
import { createSouvenirModel } from "./souvenir-model";
import { personHeadParts } from "./person-head";
import type { Guest } from "./simulation";
type GuestSource = Pick<Guest, "id" | "skin"> &
  Partial<Pick<Guest, "food" | "souvenir" | "ageGroup" | "appearance" | "party">>;
type Part = {
  p: number[];
  s: number[];
  color: string;
  angle?: number;
  head?: boolean;
  grip?: boolean;
  leashGrip?: boolean;
};
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
  for (const part of personHeadParts({ ...c, hat: c.shirt, brim: c.pants }))
    add(part.color, [part.p[0], headY + part.p[1], part.p[2]], part.s, true);
  for (const side of [-1, 1]) {
    const swing = seated || !walking ? 0 : Math.sin(phase + (side > 0 ? Math.PI : 0));
    const shoulder = [side * 0.215, neck - 0.06, 0.03],
      elbow = [side * 0.27, hip + 0.27, seated ? -0.14 : 0.03 + swing * 0.12],
      hand =
        g?.souvenir && side < 0 && !seated
          ? [side * 0.27, hip + 0.23 + swing * 0.025, -0.12 + swing * 0.055]
          : g?.food && side > 0
            ? [side * 0.2, hip + 0.36 + Math.max(0, Math.sin(phase * 1.1)) * 0.3, -0.29]
            : [side * 0.27, hip + 0.12, seated ? -0.32 : swing * 0.21];
    limb(c.shirt, shoulder, [side * 0.25, hip + 0.37, seated ? -0.08 : swing * 0.06], 0.07, 0.073);
    limb(c.skin, [side * 0.25, hip + 0.37, seated ? -0.08 : swing * 0.06], elbow, 0.046);
    limb(c.skin, elbow, hand, 0.039);
    add(c.skin, hand, [0.05, 0.07, 0.038]);
    if (side < 0 && g?.souvenir && !seated) parts[parts.length - 1].grip = true;
    if (side > 0) parts[parts.length - 1].leashGrip = true;
    const knee = [side * 0.11, seated ? hip - 0.09 : 0.46, seated ? -0.36 : -swing * 0.18],
      ankle = [side * 0.11, seated ? -0.4 : 0.14, seated ? -0.41 : -swing * 0.3];
    limb(c.pants, [side * 0.105, hip, 0], knee, 0.083);
    limb(c.pants, knee, ankle, 0.059);
    add(c.shoes, [side * 0.11, ankle[1] - 0.058, ankle[2] - 0.065], [0.084, 0.074, 0.15]);
    add("#eae2cc", [side * 0.11, ankle[1] - 0.105, ankle[2] - 0.065], [0.085, 0.022, 0.151]);
  }
  const striped = c.pattern === "stripe" ? 1 : 0;
  for (const y of [hip + 0.25, hip + 0.39])
    add("#f5f0dc", [0, y, -0.103], [0.215 * striped, 0.025 * striped, 0.043 * striped]);
  // Backpack slots stay fixed and are tucked away when sitting. Head accessories
  // already come from the same anatomy used by staff and the park canvas.
  if (c.accessory === "backpack" && !seated) {
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
  if (g?.souvenir && !seated) {
    const souvenir = createSouvenirModel(g),
      grip = parts.find((p) => p.grip);
    if (grip) souvenir.root.position.fromArray(grip.p);
    souvenir.root.scale.setScalar(appearance.ageGroup === "child" ? 0.86 : 1);
    root.add(souvenir.root);
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
  const souvenirs = guests.map((g) => (g.souvenir ? createSouvenirModel(g) : undefined));
  souvenirs.forEach((souvenir) => {
    if (souvenir) mesh.add(souvenir.root);
  });
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
      time = phase / 7,
    ) {
      base.compose(
        p.set(x, height + (walking ? Math.abs(Math.sin(phase)) * 0.025 : 0), z),
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw),
        s.set(1, 1, 1),
      );
      const parts = personParts(guests[i], seated, phase, walking);
      parts.forEach((part, j) => {
        local.compose(
          p.fromArray(part.p),
          r.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -(part.angle ?? 0)),
          s.fromArray(part.s),
        );
        world.multiplyMatrices(base, local);
        mesh.setMatrixAt(i * count + j, world);
      });
      const souvenir = souvenirs[i],
        grip = parts.find((part) => part.grip);
      if (souvenir) {
        souvenir.root.visible = !!grip && !seated;
        if (grip) {
          souvenir.root.position.fromArray(grip.p).applyMatrix4(base);
          souvenir.root.quaternion.copy(q);
          souvenir.root.scale.setScalar(guestAppearance(guests[i]).ageGroup === "child" ? 0.86 : 1);
          souvenir.update(time);
        }
      }
    },
    finish() {
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

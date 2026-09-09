import { createGuestModel } from "./guest-model";
import { assetUrl } from "./assets";
import * as THREE from "three";
import { CATALOG, rideCapacity, rideDuration, type Building, type Park } from "./simulation";
/** Every seat is a real child of the animated mechanism. Both spectators and ride cameras use these anchors. */
export function createAttractionRig(b: Building, park: Park) {
  const root = new THREE.Group(),
    n = CATALOG[b.kind].size;
  root.position.set((b.x + (n - 1) / 2) * 5, 0, (b.y + (n - 1) / 2) * 5);
  const seats: THREE.Object3D[] = [],
    passengers: THREE.Object3D[] = [],
    updates: ((p: number) => void)[] = [];
  const cube = new THREE.BoxGeometry(1, 1, 1),
    cylinder = new THREE.CylinderGeometry(1, 1, 1, 16),
    sphere = new THREE.SphereGeometry(1, 10, 8),
    cone = new THREE.ConeGeometry(1, 1, 12),
    materials = new Map<string, THREE.MeshStandardMaterial>();
  const color =
      b.design?.color ??
      (b.kind === "teacups" ? "#528eaf" : b.kind === "spinner" ? "#8665a4" : "#df6748"),
    gold = "#f5d692",
    teal = "#25868a";
  const mat = (c: string) => {
    if (!materials.has(c))
      materials.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.65 }));
    return materials.get(c)!;
  };
  function mesh(
    g: THREE.BufferGeometry,
    c: string,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    parent: THREE.Object3D = root,
  ) {
    const m = new THREE.Mesh(g, mat(c));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    parent.add(m);
    return m;
  }
  function group(parent: THREE.Object3D, x = 0, y = 0, z = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }
  const beam = (
    a: THREE.Vector3,
    c: THREE.Vector3,
    parent: THREE.Object3D,
    width = 0.12,
    col = gold,
  ) => {
    const d = c.clone().sub(a),
      m = mesh(
        cylinder,
        col,
        ...(a.clone().add(c).multiplyScalar(0.5).toArray() as [number, number, number]),
        width,
        d.length(),
        width,
        parent,
      );
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return m;
  };
  function seat(parent: THREE.Object3D, x: number, y: number, z: number, yaw = 0) {
    const mount = group(parent, x, y, z);
    mount.rotation.y = yaw;
    const index = seats.length;
    mesh(sphere, gold, 0, 0, 0, 0.4, 0.1, 0.37, mount);
    mesh(sphere, gold, 0, 0.38, 0.22, 0.38, 0.43, 0.1, mount);
    const eye = group(mount, 0, .88, -.13);
    seats.push(eye);
    const person = createGuestModel(park.guests.find(g=>g.id===b.riders[index]));
    mount.add(person); person.visible = index < b.riders.length;
    passengers.push(person);
    mesh(cube, "#345556", 0, 0.38, -0.45, 0.95, 0.1, 0.1, mount);
    return mount;
  }
  const kind = b.design?.mechanism ?? b.kind,
    capacity = rideCapacity(b),
    heightScale = b.design?.height ?? 1;
  mesh(cylinder, "#d0c3a2", 0, 0.16, 0, kind === "wheel" ? 5 : 6, 0.32, kind === "wheel" ? 4 : 6);
  if (kind === "wheel") {
    const rotor = group(root, 0, 11, 0),
      cabins: THREE.Group[] = [];
    rotor.add(new THREE.Mesh(new THREE.TorusGeometry(8, 0.2, 8, 64), mat(color)));
    for (let i = 0; i < capacity; i++) {
      const a = (i / capacity) * Math.PI * 2;
      beam(new THREE.Vector3(), new THREE.Vector3(Math.sin(a) * 8, Math.cos(a) * 8, 0), rotor);
      const cabin = group(rotor, Math.sin(a) * 8, Math.cos(a) * 8, 0);
      cabins.push(cabin);
      mesh(cube, color, 0, -0.5, 0, 1.7, 0.65, 1.8, cabin);
      mesh(cone, gold, 0, 1.85, 0, 1.3, 0.8, 1.3, cabin);
      for (const side of [-0.7, 0.7]) mesh(cylinder, teal, side, 0.65, 0, 0.045, 2, 0.045, cabin);
      seat(cabin, 0, 0, 0);
    }
    for (const side of [-1, 1])
      beam(new THREE.Vector3(side * 4, 0, 2), new THREE.Vector3(0, 11, 2), root, 0.38, teal);
    updates.push((p) => {
      rotor.rotation.z = p * Math.PI * 2;
      cabins.forEach((c) => (c.rotation.z = -rotor.rotation.z));
    });
  } else if (kind === "drop") {
    const height = 18 * heightScale;
    mesh(cube, teal, 0, height / 2 + 1, 0, 1.2, height, 1.2);
    mesh(cone, gold, 0, height + 2, 0, 1.4, 2, 1.4);
    const ring = group(root, 0, 2, 0);
    mesh(cylinder, color, 0, 0, 0, 3.3, 0.5, 3.3, ring);
    for (let i = 0; i < capacity; i++) {
      const a = (i / capacity) * Math.PI * 2;
      seat(ring, Math.sin(a) * 2.7, 0.35, Math.cos(a) * 2.7, a + Math.PI);
    }
    updates.push(
      (p) =>
        (ring.position.y =
          2 +
          height *
            (p < 0.52
              ? p / 0.52
              : p < 0.67
                ? 1
                : p < 0.87
                  ? Math.max(0, 1 - ((p - 0.67) / 0.2) ** 2)
                  : 0)),
    );
  } else if (kind === "pirate") {
    const height = 8 + heightScale * 2,
      pivot = group(root, 0, height, 0),
      boat = group(pivot, 0, -height + 2, 0);
    for (const z of [-2, 2])
      for (const side of [-1, 1])
        beam(new THREE.Vector3(side * 5, 0, z), new THREE.Vector3(0, height, z), root, 0.2, teal);
    mesh(cube, "#a56e39", 0, 0, 0, 9, 1.1, 3, boat);
    for (const side of [-1, 1])
      mesh(cone, color, side * 4.3, 0.3, 0, 1.7, 2.8, 1.7, boat).rotation.z = (side * Math.PI) / 2;
    for (const side of [-1, 1])
      beam(new THREE.Vector3(0, 0, side), new THREE.Vector3(0, -height + 2, side), pivot, 0.1);
    for (let i = 0; i < capacity; i++)
      seat(
        boat,
        (Math.floor(i / 2) - (Math.ceil(capacity / 2) - 1) / 2) * 1.2,
        0.6,
        (i % 2 ? 1 : -1) * 0.65,
        -Math.PI / 2,
      );
    updates.push(
      (p) => (pivot.rotation.z = Math.sin(p * Math.PI * 4) * Math.sin(Math.PI * p) * 1.05),
    );
  } else if (kind === "teacups") {
    const rotor = group(root, 0, 0.45, 0);
    mesh(cylinder, color, 0, 0, 0, 5.7, 0.45, 5.7, rotor);
    const cups = Math.ceil(capacity / 3);
    for (let i = 0; i < cups; i++) {
      const a = (i / cups) * Math.PI * 2,
        cup = group(rotor, Math.sin(a) * 3.6, 0.5, Math.cos(a) * 3.6);
      mesh(cylinder, i % 2 ? gold : color, 0, 0.4, 0, 1.5, 0.7, 1.5, cup);
      mesh(cylinder, teal, 0, 1.2, 0, 0.25, 0.8, 0.25, cup);
      for (let j = 0; j < 3 && seats.length < capacity; j++) {
        const angle = (j * Math.PI * 2) / 3;
        seat(cup, Math.sin(angle) * 0.85, 0.6, Math.cos(angle) * 0.85, angle);
      }
      updates.push((p) => (cup.rotation.y = -p * Math.PI * 6 + i));
    }
    updates.push((p) => (rotor.rotation.y = p * Math.PI * 4));
  } else if (kind === "spinner") {
    mesh(cylinder, teal, 0, 3, 0, 0.8, 6, 0.8);
    const rotor = group(root, 0, 6, 0);
    for (let i = 0; i < 3; i++) {
      const arm = group(rotor);
      arm.rotation.y = (i * Math.PI * 2) / 3;
      const tilt = group(arm);
      beam(new THREE.Vector3(), new THREE.Vector3(0, 0, 5), tilt, 0.32, color);
      const gondola = group(tilt, 0, 0, 5);
      mesh(cube, color, 0, 0, 0, 3.5, 0.6, Math.ceil(Math.ceil(capacity / 3) / 2) * 1.3, gondola);
      for (let j = 0; j < Math.ceil(capacity / 3) && seats.length < capacity; j++)
        seat(
          gondola,
          (j % 2 ? 1 : -1) * 0.8,
          0.4,
          (Math.floor(j / 2) - (Math.ceil(Math.ceil(capacity / 3) / 2) - 1) / 2) * 1.3,
          0,
        );
      updates.push((p) => {
        tilt.rotation.x = Math.sin(p * Math.PI * 4 + i) * 0.55 * Math.sin(Math.PI * p);
        gondola.rotation.z = p * Math.PI * 2;
      });
    }
    updates.push((p) => (rotor.rotation.y = p * Math.PI * 4));
  } else {
    const swing = kind === "swing",
      h = swing ? 7 + heightScale : 5,
      r = swing ? 4 : 3.4,
      rotor = group(root, 0, h, 0);
    mesh(cylinder, teal, 0, h / 2, 0, 0.35, h, 0.35);
    mesh(cone, color, 0, 0.4, 0, r + 1, 2, r + 1, rotor);
    for (let i = 0; i < capacity; i++) {
      const a = (i / capacity) * Math.PI * 2,
        mount = group(rotor, Math.sin(a) * r, 0, Math.cos(a) * r);
      mount.rotation.y = a;
      const chain = group(mount);
      mesh(cylinder, gold, 0, -h * 0.37, 0, 0.05, h * 0.74, 0.05, chain);
      const chair = seat(chain, 0, -h * 0.74, 0, -Math.PI / 2);
      if (!swing) {
        mesh(sphere, gold, 0, -0.35, -0.05, 0.5, 0.35, 0.85, chair);
        mesh(cone, color, 0, 0, -0.7, 0.25, 0.8, 0.3, chair);
      }
      updates.push((p) => {
        if (swing) chain.rotation.x = -Math.sin(Math.PI * p) * 0.45;
        else mount.position.y = Math.sin(p * Math.PI * 8 + a) * 0.28;
      });
    }
    updates.push((p) => (rotor.rotation.y = p * Math.PI * (swing ? 6 : 4)));
  }
  if (b.design && typeof document !== "undefined") {
    const texture = new THREE.TextureLoader().load(
      b.design.art ?? assetUrl(`theme-${b.design.theme}`),
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    const sign = group(root, -5, 3, 5),
      panel = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 4.8),
        new THREE.MeshStandardMaterial({
          map: texture,
          transparent: true,
          side: THREE.DoubleSide,
          alphaTest: 0.2,
        }),
      );
    sign.add(panel);
    mesh(cylinder, teal, -5, 1.3, 5, 0.12, 2.6, 0.12);
    sign.rotation.y = ((b.design.seed % 7) - 3) * 0.1;
  }
  const duration = rideDuration(b);
  return {
    root,
    seats,
    passengers,
    duration,
    update: (time: number) => {
      const p = (((time / duration) % 1) + 1) % 1;
      updates.forEach((fn) => fn(p));
      root.updateMatrixWorld(true);
    },
  };
}

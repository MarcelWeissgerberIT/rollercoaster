import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Building } from "./simulation";
import { habitatLayout, type HabitatFixture } from "./zoo-layout";

/** Static habitat furniture. All positions come from the same plan as animal navigation. */
export function createHabitatScenery(b: Building): THREE.Group {
  const layout = habitatLayout(b),
    n = layout.size,
    span = n * 5;
  const root = new THREE.Group();
  root.name = `habitat-scenery:${b.id}`;
  const cube = new THREE.BoxGeometry(1, 1, 1),
    sphere = new THREE.SphereGeometry(1, 10, 7),
    cylinder = new THREE.CylinderGeometry(1, 1, 1, 8),
    cone = new THREE.ConeGeometry(1, 1, 8),
    disc = new THREE.CircleGeometry(1, 28);
  const batches = new Map<
    string,
    { material: THREE.MeshStandardMaterial; geometries: THREE.BufferGeometry[] }
  >();
  const transform = new THREE.Object3D();
  const part = (
    geometry: THREE.BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    rx = 0,
    ry = 0,
    rz = 0,
    opacity = 1,
  ) => {
    const key = `${color}:${opacity}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = {
        material: new THREE.MeshStandardMaterial({
          color,
          roughness: color === "#64b6c3" ? 0.35 : 0.86,
          transparent: opacity < 1,
          opacity,
          depthWrite: opacity === 1,
          side: opacity < 1 ? THREE.DoubleSide : THREE.FrontSide,
        }),
        geometries: [],
      };
      batches.set(key, batch);
    }
    transform.position.set(x, y, z);
    transform.scale.set(sx, sy, sz);
    transform.rotation.set(rx, ry, rz);
    transform.updateMatrix();
    const g = (geometry.index ? geometry.toNonIndexed() : geometry.clone()).applyMatrix4(
      transform.matrix,
    );
    batch.geometries.push(g);
  };
  const box = (
    c: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    ry = 0,
  ) => part(cube, c, x, y, z, w, h, d, 0, ry);
  const ball = (c: string, x: number, y: number, z: number, w: number, h: number, d: number) =>
    part(sphere, c, x, y, z, w, h, d);
  const post = (c: string, x: number, y: number, z: number, r: number, h: number) =>
    part(cylinder, c, x, y, z, r, h, r);
  const patch = (c: string, x: number, z: number, rx: number, rz: number, y = 0.17, opacity = 1) =>
    part(disc, c, x, y, z, rx, rz, 1, -Math.PI / 2, 0, 0, opacity);
  const beam = (c: string, a: THREE.Vector3, d: THREE.Vector3, r: number) => {
    const delta = d.clone().sub(a),
      m = new THREE.Object3D();
    m.position.copy(a).add(d).multiplyScalar(0.5);
    m.scale.set(r, delta.length(), r);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    m.updateMatrix();
    const key = `${c}:1`;
    let batch = batches.get(key);
    if (!batch) {
      batch = {
        material: new THREE.MeshStandardMaterial({ color: c, roughness: 0.86 }),
        geometries: [],
      };
      batches.set(key, batch);
    }
    batch.geometries.push(cylinder.toNonIndexed().applyMatrix4(m.matrix));
  };
  box(layout.ground, 0, 0.09, 0, span - 0.18, 0.12, span - 0.18);
  // Fixed, sparse ground variation reads well from a ride without noisy animated textures.
  for (let j = 0; j < 18; j++) {
    const u = 0.1 + ((j * 0.381966) % 1) * 0.8,
      v = 0.1 + ((j * 0.618034 + 0.22) % 1) * 0.8;
    patch(
      layout.species === "penguin" ? "#b8bdba" : layout.species === "panda" ? "#769256" : "#a49e60",
      (u - 0.5) * span,
      (v - 0.5) * span,
      0.45 + (j % 3) * 0.21,
      0.25 + (j % 2) * 0.18,
      0.157,
    );
  }
  const fenceHeight =
    layout.barrier === "glass"
      ? layout.species === "lion"
        ? 3.4
        : 2.1
      : layout.barrier === "reinforced"
        ? 3.1
        : 1.9;
  const postColor = layout.barrier === "wood" ? "#71583b" : "#40554f";
  const railColor = layout.barrier === "wood" ? "#a88b58" : "#73867c";
  for (let side = 0; side < 4; side++)
    for (let i = 0; i < n; i++) {
      const at = (t: number) =>
        side === 0
          ? new THREE.Vector3(-span / 2 + t * 5, 0, -span / 2)
          : side === 1
            ? new THREE.Vector3(span / 2, 0, -span / 2 + t * 5)
            : side === 2
              ? new THREE.Vector3(span / 2 - t * 5, 0, span / 2)
              : new THREE.Vector3(-span / 2, 0, span / 2 - t * 5);
      const a = at(i),
        e = at(i + 1),
        m = a.clone().add(e).multiplyScalar(0.5),
        horizontal = side % 2 === 0;
      box("#72786b", a.x, 0.14, a.z, 0.5, 0.28, 0.5);
      post(postColor, a.x, fenceHeight / 2, a.z, 0.12, fenceHeight + 0.18);
      for (const h of layout.barrier === "wood" ? [0.55, 1.32] : [0.28, fenceHeight])
        box(railColor, m.x, h, m.z, horizontal ? 5 : 0.13, 0.13, horizontal ? 0.13 : 5);
      if (layout.barrier === "glass") {
        part(
          cube,
          "#abd8d5",
          m.x,
          fenceHeight / 2 + 0.12,
          m.z,
          horizontal ? 4.8 : 0.055,
          fenceHeight - 0.2,
          horizontal ? 0.055 : 4.8,
          0,
          0,
          0,
          0.19,
        );
        // Two slanted highlights make a transparent barrier legible against grass.
        for (const offset of [-0.8, 0.8]) {
          const v = horizontal
            ? new THREE.Vector3(m.x + offset, 0.7, m.z)
            : new THREE.Vector3(m.x, 0.7, m.z + offset);
          beam(
            "#cde6df",
            v,
            v.clone().add(new THREE.Vector3(horizontal ? 0.55 : 0, 0.8, horizontal ? 0 : 0.55)),
            0.025,
          );
        }
      } else if (layout.barrier === "reinforced") {
        for (let j = 1; j < 8; j++) {
          const v = a.clone().lerp(e, j / 8);
          post("#667870", v.x, fenceHeight / 2, v.z, 0.055, fenceHeight);
        }
        box(
          "#4d6257",
          m.x,
          fenceHeight * 0.53,
          m.z,
          horizontal ? 5 : 0.17,
          0.14,
          horizontal ? 0.17 : 5,
        );
      }
      if (layout.electricInstalled) {
        for (const height of [fenceHeight * 0.38, fenceHeight * 0.73, fenceHeight + 0.12]) {
          box("#e5c958", a.x, height, a.z, 0.21, 0.17, 0.21);
          beam(
            layout.electric ? "#c1b47a" : "#77847b",
            a.clone().setY(height),
            e.clone().setY(height),
            0.024,
          );
        }
        if (i === 1) {
          box(
            layout.safety === "closed" ? "#c74b40" : "#efcc4c",
            m.x,
            fenceHeight * 0.74 + 0.12,
            m.z,
            horizontal ? 0.63 : 0.09,
            0.48,
            horizontal ? 0.09 : 0.63,
          );
          box(
            "#554827",
            m.x,
            fenceHeight * 0.74 + 0.12,
            m.z,
            horizontal ? 0.075 : 0.105,
            0.28,
            horizontal ? 0.105 : 0.075,
          );
        }
      }
      if (layout.safety === "closed" && side === 2 && i === Math.floor(n / 2)) {
        box("#d9634d", m.x, 1.2, m.z, horizontal ? 0.85 : 0.09, 0.55, horizontal ? 0.09 : 0.85);
        box("#fff0ca", m.x, 1.2, m.z, horizontal ? 0.57 : 0.11, 0.1, horizontal ? 0.11 : 0.57);
      }
    }
  const species = layout.species;
  const renderFixture = (f: HabitatFixture) => {
    const x = (f.u - 0.5) * span,
      z = (f.v - 0.5) * span,
      w = f.width * span,
      d = f.depth * span,
      h = f.height;
    const wood = "#7e5d3b",
      lightwood = "#b89559",
      rock = species === "penguin" ? "#a2b1ad" : "#a69b83";
    if (f.kind !== "pool" && f.kind !== "mud" && f.kind !== "foraging")
      patch("#344c35", x + 0.3, z + 0.35, w * 0.58, d * 0.58, 0.169, 0.13);
    if (f.kind === "pool" || f.kind === "mud") {
      patch(
        f.kind === "mud" ? "#938363" : species === "penguin" ? "#dce0cf" : "#c5b98b",
        x,
        z,
        w * 0.55,
        d * 0.55,
        0.18,
      );
      patch(f.kind === "mud" ? "#84775f" : "#368b9d", x, z, w * 0.5, d * 0.5, 0.185);
      patch(
        f.kind === "mud" ? "#9b8d70" : "#64b6c3",
        x - w * 0.035,
        z - d * 0.025,
        w * 0.445,
        d * 0.44,
        0.191,
      );
      if (f.kind === "pool") {
        for (let j = 0; j < 4; j++)
          box(
            "#b2ddd3",
            x + (j - 1.5) * w * 0.15,
            0.2,
            z + Math.sin(j * 2) * d * 0.25,
            w * 0.11,
            0.01,
            0.025,
          );
        for (let j = 0; j < 6; j++) {
          const a = j * 1.6;
          ball(
            rock,
            x + Math.cos(a) * w * 0.51,
            0.27,
            z + Math.sin(a) * d * 0.5,
            0.38 + (j % 2) * 0.12,
            0.23,
            0.3,
          );
        }
        if (species === "flamingo")
          for (let j = 0; j < 8; j++) {
            const a = j * 0.29;
            post(
              "#728d4c",
              x + Math.cos(a) * w * 0.49,
              0.52,
              z + Math.sin(a) * d * 0.49,
              0.033,
              0.74,
            );
          }
      }
    } else if (f.kind === "filter") {
      box("#758a7b", x, 0.5, z, w, 0.85, d);
      box("#afbeab", x, 0.97, z, w * 1.07, 0.12, d * 1.07);
      for (let j = 0; j < 3; j++)
        box("#485d54", x, 0.42 + j * 0.13, z + d * 0.51, w * 0.61, 0.045, 0.03);
      post("#506e61", x + w * 0.34, 1.08, z, 0.06, 0.26);
      box("#b8d194", x - w * 0.22, 0.8, z + d * 0.52, w * 0.18, 0.14, 0.025);
    } else if (f.kind === "trough") {
      box("#7b8581", x, 0.28, z, w, 0.52, d);
      box("#4e7778", x, 0.56, z, w * 0.82, 0.025, d * 0.83);
      box("#86c9c9", x, 0.58, z, w * 0.71, 0.015, d * 0.72);
    } else if (
      f.kind === "feeder" ||
      f.kind === "bamboo" ||
      f.kind === "fish" ||
      f.kind === "meat" ||
      f.kind === "browse"
    ) {
      const elevated = f.kind === "browse",
        deck = elevated ? h - 0.65 : 0.55;
      if (elevated) {
        post(wood, x, deck / 2, z, 0.17, deck);
        beam(
          lightwood,
          new THREE.Vector3(x, deck - 0.5, z),
          new THREE.Vector3(x + w * 0.36, deck, z),
          0.09,
        );
      }
      box(wood, x, deck, z, w, 0.22, d);
      for (const v of [-1, 1]) box(lightwood, x, deck + 0.22, z + v * d * 0.46, w, 0.36, 0.1);
      for (let j = 0; j < 5; j++) {
        const fx = x + (j - 2) * w * 0.16;
        if (f.kind === "fish") {
          ball("#879da6", fx, deck + 0.25, z + ((j % 2) - 0.5) * d * 0.4, 0.18, 0.08, 0.1);
          part(
            cone,
            "#c2d0c9",
            fx + 0.16,
            deck + 0.25,
            z + ((j % 2) - 0.5) * d * 0.4,
            0.08,
            0.17,
            0.07,
            0,
            0,
            -Math.PI / 2,
          );
        } else if (f.kind === "meat") {
          ball("#a05c4a", fx, deck + 0.29, z, 0.21, 0.16, 0.18);
          box("#e7d5b6", fx + 0.05, deck + 0.38, z, 0.05, 0.08, 0.17);
        } else if (f.kind === "bamboo" || elevated) {
          beam(
            "#799951",
            new THREE.Vector3(fx, deck + 0.12, z - d * 0.24),
            new THREE.Vector3(fx + 0.14, deck + 0.38, z + d * 0.24),
            0.04,
          );
          ball("#56884b", fx, deck + 0.37, z, 0.25, 0.13, 0.24);
        } else ball("#c5bb70", fx, deck + 0.28, z, 0.24, 0.19, d * 0.35);
      }
    } else if (f.kind === "cave") {
      // An actual recessed entrance: two rock piers, cap stones, dark rear wall.
      box("#514e43", x, h * 0.38, z - d * 0.33, w * 0.8, h * 0.72, 0.2);
      box("#685e4b", x, 0.22, z, w * 0.87, 0.16, d * 0.88);
      for (const side of [-1, 1]) {
        ball(rock, x + side * w * 0.36, h * 0.4, z, w * 0.2, h * 0.47, d * 0.5);
        ball(
          species === "penguin" ? "#c0c8bf" : "#baaa88",
          x + side * w * 0.29,
          h * 0.82,
          z - d * 0.08,
          w * 0.25,
          h * 0.24,
          d * 0.51,
        );
      }
      ball(rock, x, h * 0.95, z - d * 0.1, w * 0.47, h * 0.24, d * 0.52);
      for (const side of [-1, 1])
        box("#303c36", x + side * w * 0.15, h * 0.35, z - d * 0.18, w * 0.24, h * 0.55, 0.07);
      box(rock, x, h * 0.37, z, w * 0.075, h * 0.73, d * 0.62);
      patch("#c7b580", x, z + d * 0.14, w * 0.3, d * 0.3, 0.23);
      if (species === "penguin")
        for (let j = 0; j < 3; j++)
          ball("#e2e4d4", x + (j - 1) * w * 0.23, h * 1.04, z, w * 0.2, 0.13, d * 0.27);
    } else if (f.kind === "shade") {
      for (const dx of [-0.4, 0.4])
        for (const dz of [-0.4, 0.4]) post(wood, x + dx * w, h * 0.46, z + dz * d, 0.14, h * 0.92);
      box("#72543a", x, h * 0.91, z, w, 0.19, d);
      // Slats and alternating roof facets avoid a featureless flat box.
      for (let j = 0; j < 8; j++)
        box(
          j % 2 ? "#bba16a" : "#a68b55",
          x + ((j - 3.5) * w) / 8,
          h + 0.08,
          z,
          w / 8 - 0.025,
          0.17,
          d * 1.06,
        );
      for (const side of [-1, 1])
        beam(
          lightwood,
          new THREE.Vector3(x + side * w * 0.4, h * 0.65, z + d * 0.4),
          new THREE.Vector3(x + side * w * 0.23, h * 0.93, z + d * 0.4),
          0.075,
        );
      patch("#d0ba7f", x, z, w * 0.32, d * 0.32, 0.185);
    } else if (f.kind === "rock") {
      ball(rock, x - w * 0.18, h * 0.36, z, w * 0.36, h * 0.4, d * 0.49);
      ball(
        species === "penguin" ? "#d2d8cb" : "#c4b395",
        x + w * 0.21,
        h * 0.32,
        z - d * 0.05,
        w * 0.31,
        h * 0.37,
        d * 0.42,
      );
      ball("#b5aa91", x, h * 0.8, z - d * 0.06, w * 0.34, h * 0.23, d * 0.37);
    } else if (f.kind === "log") {
      const top = new THREE.Vector3(x + w * 0.43, h * 0.65, z),
        bottom = new THREE.Vector3(x - w * 0.43, 0.45, z);
      beam(wood, bottom, top, Math.min(0.36, d * 0.35));
      beam(
        lightwood,
        top,
        top.clone().add(new THREE.Vector3(0.025, 0.03, 0)),
        Math.min(0.34, d * 0.33),
      );
      post(wood, x - w * 0.15, h * 0.58, z, 0.22, h * 1.08);
      for (let j = 0; j < 4; j++) post("#a69672", x - w * 0.15, 0.65 + j * 0.18, z, 0.24, 0.055);
    } else if (f.kind === "climbing") {
      for (const dx of [-0.38, 0.38])
        for (const dz of [-0.37, 0.37])
          post(wood, x + dx * w, h * 0.44, z + dz * d, 0.15, h * 0.88);
      box(lightwood, x, h * 0.69, z, w * 0.9, 0.17, d * 0.83);
      for (const dx of [-0.35, 0.35])
        beam(
          wood,
          new THREE.Vector3(x + dx * w, h * 0.7, z + d * 0.38),
          new THREE.Vector3(x + dx * w, 0.2, z + d * 0.49),
          0.09,
        );
      for (let j = 0; j < 5; j++)
        beam(
          lightwood,
          new THREE.Vector3(x - w * 0.34, 0.3 + j * h * 0.125, z + d * (0.49 - j * 0.0275)),
          new THREE.Vector3(x + w * 0.34, 0.3 + j * h * 0.125, z + d * (0.49 - j * 0.0275)),
          0.055,
        );
      for (let j = 0; j < 5; j++)
        post("#c3b07a", x + (j - 2) * w * 0.16, h * 0.98, z - d * 0.36, 0.024, 0.5);
      beam(
        wood,
        new THREE.Vector3(x - w * 0.48, h, z - d * 0.36),
        new THREE.Vector3(x + w * 0.48, h, z - d * 0.36),
        0.09,
      );
    } else if (f.kind === "nest") {
      for (let j = 0; j < 3; j++) {
        const nx = x + (j - 1) * w * 0.27;
        patch("#aa9979", nx, z, w * 0.18, d * 0.35, 0.23);
        patch("#6e6952", nx, z, w * 0.13, d * 0.25, 0.25);
        ball("#d5ca9d", nx, 0.28, z, w * 0.08, 0.12, d * 0.12);
      }
    } else if (f.kind === "foraging") {
      patch("#b7ac78", x, z, w * 0.5, d * 0.5, 0.19);
      for (let j = 0; j < 9; j++) {
        const a = j * 2.4,
          r = ((j % 3) + 1) / 3;
        ball(
          species === "lion" ? "#a35e44" : "#c4ba69",
          x + Math.cos(a) * w * 0.42 * r,
          0.24,
          z + Math.sin(a) * d * 0.42 * r,
          0.12,
          0.12,
          0.12,
        );
      }
    } else if (f.kind === "planting") {
      const bamboo = species === "panda",
        reeds = species === "flamingo",
        acacia = species === "giraffe" || species === "zebra";
      const count = bamboo ? 18 : reeds ? 20 : acacia ? 3 : 10;
      for (let j = 0; j < count; j++) {
        const px = x + Math.sin(j * 2.39) * w * 0.37,
          pz = z + Math.cos(j * 1.87) * d * 0.38,
          ph = h * (0.6 + (j % 4) * 0.11);
        if (bamboo || reeds) {
          post(bamboo ? "#5d8247" : "#81915a", px, ph * 0.5, pz, bamboo ? 0.055 : 0.035, ph);
          for (let k = 1; k < 4; k++) {
            post("#bac78c", px, (ph * k) / 4, pz, bamboo ? 0.065 : 0.045, 0.065);
            part(
              sphere,
              j % 2 ? "#527b40" : "#6d9650",
              px + (k % 2 ? 0.21 : -0.21),
              (ph * k) / 4 + 0.1,
              pz,
              0.32,
              0.09,
              0.14,
              0,
              0,
              k % 2 ? 0.4 : -0.4,
            );
          }
        } else if (acacia) {
          post(wood, px, ph * 0.42, pz, 0.1, ph * 0.85);
          ball(
            "#567744",
            px,
            ph * 0.82,
            pz,
            Math.min(w * 0.45, 1.6),
            ph * 0.17,
            Math.min(d * 0.6, 1.3),
          );
          ball(
            "#7d9957",
            px - 0.15,
            ph * 0.9,
            pz,
            Math.min(w * 0.33, 1.1),
            ph * 0.12,
            Math.min(d * 0.45, 0.9),
          );
        } else {
          ball(
            j % 2 ? "#748b4e" : "#526f41",
            px,
            ph * 0.3,
            pz,
            Math.min(w * 0.28, 0.85),
            ph * 0.34,
            Math.min(d * 0.25, 0.9),
          );
          part(cone, "#94a366", px + 0.16, ph * 0.35, pz, 0.2, ph * 0.6, 0.18);
        }
      }
    }
  };
  layout.fixtures.forEach(renderFixture);
  if (b.habitat?.viewpoint) {
    const x = (b.habitat.viewpoint.x - layout.center.x) * 5,
      z = (b.habitat.viewpoint.y - layout.center.y) * 5;
    // A small public viewing sign, outside the fence and clear of the standing area.
    box("#b7d1b0", x, 0.13, z, 4.5, 0.1, 4.5);
    post("#826449", x - 1.4, 0.9, z - 1.4, 0.1, 1.8);
    box("#306754", x - 1.4, 1.95, z - 1.4, 1.45, 0.85, 0.14);
    for (const dx of [-0.29, 0.29]) {
      part(cylinder, "#f5e7bc", x - 1.4 + dx, 1.94, z - 1.49, 0.21, 0.05, 0.21, Math.PI / 2);
      part(cylinder, "#4c8a79", x - 1.4 + dx, 1.94, z - 1.53, 0.12, 0.05, 0.12, Math.PI / 2);
    }
  }
  // Merge static pieces by material: a rich habitat costs dozens, not hundreds, of draw calls.
  for (const [key, batch] of batches) {
    const geometry = mergeGeometries(batch.geometries);
    batch.geometries.forEach((g) => g.dispose());
    if (geometry) {
      const mesh = new THREE.Mesh(geometry, batch.material);
      mesh.name = `habitat-material:${key}`;
      root.add(mesh);
    } else batch.material.dispose();
  }
  for (const g of [cube, sphere, cylinder, cone, disc]) g.dispose();
  root.position.set(layout.center.x * 5, 0, layout.center.y * 5);
  return root;
}

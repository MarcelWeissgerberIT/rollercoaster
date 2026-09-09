import * as THREE from "three";
import type { Building } from "./simulation";
import { SPECIES, type Species } from "./zoo";
import { animalPose, animalSex } from "./zoo-motion";
import { createHabitatScenery } from "./zoo-scenery";

/** Recognizable species geometry with articulated legs/flippers and a shared habitat layout. */
export function createHabitatModel(b: Building) {
  const root = createHabitatScenery(b),
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
  // Surface colouring keeps stripes attached to the coat, including in close-up.
  const zebraBody =
    species === "zebra" && (b.habitat?.count ?? 0) > 0 ? new THREE.SphereGeometry(1, 56, 32) : null;
  if (zebraBody) {
    const positions = zebraBody.getAttribute("position"),
      colors = new Float32Array(positions.count * 3),
      light = new THREE.Color("#eee6d4"),
      dark = new THREE.Color("#30352f");
    for (let i = 0; i < positions.count; i++) {
      const wave = positions.getZ(i) * 28 + Math.sin(positions.getY(i) * 5) * 0.65,
        color = Math.sin(wave) > 0.25 ? dark : light;
      color.toArray(colors, i * 3);
    }
    zebraBody.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    mat("#ffffff").vertexColors = true;
  }
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
  const cx = root.position.x,
    cz = root.position.z;
  const animals = Array.from({ length: b.habitat?.count ?? 0 }, (_, i) => {
    const a = new THREE.Group();
    root.add(a);
    const limbs: THREE.Object3D[] = [];
    const legs: Array<{
      hip: THREE.Group;
      knee: THREE.Group;
      foot: THREE.Group;
      upper: number;
      lower: number;
      top: number;
      ground: number;
      phase: number;
    }> = [];
    /** Hip and knee pivots carry every lower leg and foot. Targets are solved in local space.
     * During stance the foot moves backwards by exactly the distance the body advances. */
    const leg = (
      x: number,
      z: number,
      top: number,
      _length: number,
      width: number,
      color: string,
      footColor = color,
    ) => {
      const hip = new THREE.Group(),
        knee = new THREE.Group(),
        foot = new THREE.Group();
      hip.name = `leg:hip:${legs.length}`;
      knee.name = `leg:knee:${legs.length}`;
      foot.name = `leg:foot:${legs.length}`;
      hip.position.set(x, top, z);
      a.add(hip);
      const ground =
        species === "flamingo" ? 0.035 : species === "penguin" ? 0.07 : Math.min(0.11, width * 0.5);
      const segment = species === "penguin" ? 0.65 : 0.57;
      const upper = (top - ground) * segment,
        lower = (top - ground) * segment;
      mesh(hip, pole, color, 0, -upper / 2, 0, width, upper, width);
      knee.position.y = -upper;
      hip.add(knee);
      mesh(knee, pole, color, 0, -lower / 2, 0, width * 0.8, lower, width * 0.8);
      foot.position.y = -lower;
      knee.add(foot);
      mesh(
        foot,
        ball,
        footColor,
        0,
        0,
        -0.045,
        width * (species === "penguin" ? 1.75 : 1.15),
        ground,
        width * (species === "penguin" ? 2.5 : 1.4),
      );
      const phase =
        species === "flamingo" || species === "penguin"
          ? x > 0
            ? 0.5
            : 0
          : (x > 0 ? 0.5 : 0) + (z > 0 ? 0.25 : 0);
      legs.push({ hip, knee, foot, upper, lower, top, ground, phase });
      return foot;
    };
    a.userData.sex = animalSex(species, i);
    let animate: ((pose: ReturnType<typeof animalPose>, time: number) => void) | undefined;
    a.name = `animal:${species}:${i}`;
    if (species === "zebra" || species === "giraffe") {
      const giraffe = species === "giraffe",
        color = giraffe ? "#d7aa58" : "#eee6d4",
        tall = giraffe ? 1.55 : 1;
      mesh(a, zebraBody ?? ball, giraffe ? color : "#ffffff", 0, 1.35 * tall, 0, 0.65, 0.68, 1.14);
      for (const x of [-0.4, 0.4])
        for (const z of [-0.72, 0.72]) {
          leg(x, z, 1.35 * tall, 1.35 * tall, 0.12, color, "#333731");
        }
      const head = new THREE.Group();
      head.position.set(0, 1.35 * tall, -0.72);
      a.add(head);
      const neck = mesh(
        head,
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
      mesh(head, ball, color, 0, giraffe ? 4.55 : 2.38, giraffe ? -1.22 : -1.07, 0.34, 0.35, 0.56);
      mesh(
        head,
        ball,
        "#675348",
        0,
        giraffe ? 4.44 : 2.24,
        giraffe ? -1.66 : -1.49,
        0.29,
        0.2,
        0.23,
      );
      for (const x of [-0.28, 0.28]) {
        mesh(head, ball, color, x, giraffe ? 4.8 : 2.74, -1.03, 0.14, 0.26, 0.11);
        mesh(head, ball, "#172521", x * 0.95, giraffe ? 4.62 : 2.43, -1.39, 0.047, 0.05, 0.04);
        if (giraffe) mesh(head, pole, "#725334", x * 0.6, 5.04, -1.13, 0.055, 0.35, 0.055);
      }
      for (const part of head.children) part.position.sub(head.position);
      animate = (p, time) => {
        const eating = p.activity === "eat" || p.activity === "drink";
        head.rotation.x = -(eating ? 0.32 : 0) * p.action + Math.sin(time * 0.43 + i) * 0.018;
        head.rotation.y = Math.sin(time * 0.31 + i) * 0.035 * (1 - p.strideWeight);
      };
      if (giraffe)
        for (let j = 0; j < 24; j++) {
          const ang = j * 2.399,
            y = 1.65 + (j % 4) * 0.23;
          mesh(a, ball, "#946135", Math.cos(ang) * 0.61, y, Math.sin(ang) * 1.03, 0.14, 0.19, 0.16);
        }
      const tail = mesh(a, pole, "#4a4034", 0, 1.12 * tall, 1.26, 0.05, 0.85, 0.05);
      tail.rotation.x = -0.3;
    } else if (species === "elephant" || species === "lion" || species === "panda") {
      const head = new THREE.Group(),
        tail = new THREE.Group();
      a.add(head, tail);
      const ears: THREE.Object3D[] = [],
        trunk: THREE.Object3D[] = [];
      if (species === "elephant") {
        mesh(a, ball, "#929991", 0, 1.83, 0.05, 1.08, 1.14, 1.62);
        mesh(a, ball, "#a4aaa1", 0, 2.28, -0.8, 0.95, 0.87, 1.04);
        for (const x of [-0.68, 0.68])
          for (const z of [-0.98, 0.96]) {
            const joint = leg(x, z, 1.47, 1.29, 0.29, "#858f86");
            for (const toe of [-1, 0, 1])
              mesh(joint, ball, "#cec9b3", toe * 0.13, 0.025, -0.27, 0.075, 0.08, 0.045);
          }
        head.position.set(0, 2.28, -1.29);
        mesh(head, ball, "#a0a69d", 0, 0.1, 0, 0.74, 0.83, 0.73);
        mesh(head, ball, "#afb3a8", 0, 0.6, -0.15, 0.59, 0.33, 0.54);
        for (const side of [-1, 1]) {
          const ear = new THREE.Group();
          ear.position.set(side * 0.59, 0.2, 0.16);
          head.add(ear);
          mesh(ear, ball, "#7c887f", side * 0.38, -0.02, 0, 0.61, 0.85, 0.13);
          mesh(ear, ball, "#a7a799", side * 0.39, -0.06, -0.08, 0.44, 0.66, 0.065);
          ears.push(ear);
          mesh(head, ball, "#293933", side * 0.47, 0.29, -0.52, 0.065, 0.059, 0.04);
          const tusk = new THREE.CatmullRomCurve3([
            new THREE.Vector3(side * 0.42, -0.28, -0.52),
            new THREE.Vector3(side * 0.5, -0.48, -0.88),
            new THREE.Vector3(side * 0.48, -0.39, -1.21),
          ]);
          mesh(head, new THREE.TubeGeometry(tusk, 8, 0.065, 6, false), "#e8dfbf", 0, 0, 0, 1, 1, 1);
        }
        // Three linked sections produce a flexible trunk without changing geometry.
        let parent: THREE.Object3D = head;
        for (let j = 0; j < 3; j++) {
          const joint = new THREE.Group();
          joint.position.set(0, j ? -0.59 : -0.2, j ? 0 : -0.62);
          parent.add(joint);
          trunk.push(joint);
          mesh(joint, pole, "#929c91", 0, -0.28, 0, 0.21 - j * 0.045, 0.64, 0.21 - j * 0.045);
          mesh(joint, ball, "#929c91", 0, -0.6, 0, 0.19 - j * 0.045, 0.15, 0.19 - j * 0.045);
          parent = joint;
        }
        mesh(parent, ball, "#4d5d53", 0, -0.64, -0.05, 0.075, 0.035, 0.055);
        tail.position.set(0, 1.79, 1.57);
        const shaft = mesh(tail, pole, "#737e74", 0, -0.34, 0.15, 0.07, 0.79, 0.07);
        shaft.rotation.x = -0.35;
        mesh(tail, ball, "#414a3f", 0, -0.7, 0.29, 0.11, 0.17, 0.11);
      } else if (species === "lion") {
        mesh(a, ball, "#c9944f", 0, 1.17, 0.12, 0.6, 0.61, 1.18);
        mesh(a, ball, "#dcac66", 0, 1.28, -0.64, 0.67, 0.7, 0.68);
        for (const x of [-0.4, 0.4])
          for (const z of [-0.74, 0.85]) {
            const joint = leg(x, z, 1.11, 0.99, 0.19, "#c9944f");
            for (const toe of [-1, 0, 1])
              mesh(joint, ball, "#ac773e", toe * 0.08, 0.025, -0.22, 0.035, 0.025, 0.04);
          }
        head.position.set(0, 1.62, -0.96);
        if (animalSex(species, i) === "male") {
          const mane = new THREE.Group();
          mane.name = "lion-mane";
          head.add(mane);
          mesh(mane, ball, "#714828", 0, -0.05, 0.02, 0.86, 0.89, 0.61);
          // Interleaved low-poly tufts, all attached to the animated head/mane.
          for (let j = 0; j < 14; j++) {
            const angle = (j * Math.PI * 2) / 14;
            const tuft = mesh(
              mane,
              ball,
              j % 2 ? "#94602d" : "#80512a",
              Math.cos(angle) * 0.71,
              Math.sin(angle) * 0.77 - 0.02,
              -0.02,
              0.24,
              0.34,
              0.29,
            );
            tuft.rotation.z = angle - Math.PI / 2;
          }
        }
        mesh(head, ball, "#d6a157", 0, 0.05, -0.39, 0.5, 0.52, 0.5);
        for (const side of [-1, 1]) {
          mesh(head, ball, "#bd873f", side * 0.43, 0.51, -0.15, 0.2, 0.21, 0.12);
          mesh(head, ball, "#66472e", side * 0.43, 0.51, -0.24, 0.1, 0.12, 0.045);
          mesh(head, ball, "#efce8d", side * 0.17, -0.15, -0.83, 0.23, 0.19, 0.2);
          mesh(head, ball, "#202c23", side * 0.27, 0.22, -0.79, 0.061, 0.045, 0.025);
          mesh(head, ball, "#e8ba70", side * 0.28, 0.3, -0.76, 0.12, 0.04, 0.035);
          for (let j = 0; j < 3; j++)
            mesh(
              head,
              ball,
              "#765533",
              side * (0.17 + j * 0.055),
              -0.14 - (j % 2) * 0.06,
              -1,
              0.017,
              0.018,
              0.01,
            );
        }
        mesh(head, ball, "#44372c", 0, -0.06, -1.01, 0.14, 0.095, 0.075);
        mesh(head, ball, "#513c2d", 0, -0.34, -0.78, 0.13, 0.038, 0.13);
        tail.position.set(0, 1.37, 1.18);
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.12, 0.14, 0.53),
          new THREE.Vector3(0.26, 0.07, 1.03),
          new THREE.Vector3(0.26, -0.15, 1.28),
        ]);
        mesh(tail, new THREE.TubeGeometry(curve, 10, 0.055, 6, false), "#c18b47", 0, 0, 0, 1, 1, 1);
        mesh(tail, ball, "#62412b", 0.26, -0.15, 1.28, 0.15, 0.21, 0.14);
      } else {
        mesh(a, ball, "#eeeade", 0, 1.05, 0.17, 0.72, 0.76, 0.92);
        mesh(a, ball, "#232b2a", 0, 1.15, -0.45, 0.73, 0.65, 0.44);
        for (const x of [-0.47, 0.47])
          for (const z of [-0.58, 0.68]) leg(x, z, 0.88, 0.74, 0.27, "#242c2c");
        head.position.set(0, 1.57, -0.83);
        mesh(head, ball, "#f1eee3", 0, 0.02, 0, 0.67, 0.59, 0.58);
        for (const side of [-1, 1]) {
          mesh(head, ball, "#20292a", side * 0.48, 0.51, 0.06, 0.24, 0.23, 0.16);
          const patch = mesh(head, ball, "#28312e", side * 0.29, 0.09, -0.49, 0.17, 0.23, 0.065);
          patch.rotation.z = side * -0.27;
          mesh(head, ball, "#070f10", side * 0.27, 0.12, -0.553, 0.061, 0.069, 0.025);
          mesh(head, ball, "#fff8e7", side * 0.25, 0.15, -0.579, 0.018, 0.02, 0.008);
          mesh(head, ball, "#e7e4d8", side * 0.14, -0.2, -0.55, 0.2, 0.16, 0.17);
        }
        mesh(head, ball, "#25302d", 0, -0.1, -0.72, 0.14, 0.095, 0.05);
        mesh(head, ball, "#5d6358", 0, -0.32, -0.6, 0.13, 0.027, 0.075);
        tail.position.set(0, 1.1, 0.97);
        mesh(tail, ball, "#e5e4d9", 0, 0, 0, 0.17, 0.17, 0.19);
      }
      animate = (p, time) => {
        const heavy = species === "elephant";
        const beat = p.gait;
        const feeding = p.activity === "eat" || p.activity === "drink";
        head.rotation.y = Math.sin(time * 0.35 + i) * (0.035 + 0.1 * (1 - p.strideWeight));
        head.rotation.x =
          -(feeding ? 0.25 * p.action : 0) +
          Math.sin(beat * 0.5) * (heavy ? 0.015 : 0.022) * p.strideWeight;
        tail.rotation.y = Math.sin(time * 1.1 + i) * (heavy ? 0.15 : 0.29);
        ears.forEach((ear, side) => {
          ear.rotation.y = (side ? 1 : -1) * (0.08 + Math.sin(time * 1.2 + i) * 0.11);
        });
        trunk.forEach((part, j) => {
          part.rotation.x = -0.11 + Math.sin(time * 0.8 + i + j * 0.8) * 0.11 - j * 0.16 * p.action;
          part.rotation.z = Math.sin(time * 0.6 + i + j * 0.5) * 0.05;
        });
      };
    } else if (species === "penguin") {
      mesh(a, ball, "#233746", 0, 0.68, 0, 0.4, 0.64, 0.32);
      mesh(a, ball, "#f4ede1", 0, 0.66, -0.2, 0.31, 0.48, 0.16);
      mesh(a, ball, "#233746", 0, 1.24, -0.08, 0.3, 0.28, 0.27);
      mesh(a, box, "#e5a743", 0, 1.15, -0.36, 0.2, 0.12, 0.3);
      for (const side of [-1, 1]) {
        const wing = new THREE.Group();
        wing.position.set(side * 0.36, 0.96, 0);
        a.add(wing);
        mesh(wing, ball, "#233746", side * 0.07, -0.3, 0, 0.11, 0.43, 0.2);
        limbs.push(wing);
        leg(side * 0.2, -0.12, 0.28, 0.22, 0.075, "#e5a743");
        mesh(a, ball, "#faf6e2", side * 0.18, 1.31, -0.26, 0.047, 0.052, 0.035);
      }
    } else {
      mesh(a, ball, "#ef97a3", 0, 0.99, 0, 0.34, 0.36, 0.56);
      for (const side of [-1, 1]) leg(side * 0.12, 0, 0.9, 0.86, 0.032, "#a66064");
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
    return { a, limbs, legs, i, animate };
  });
  return {
    root,
    update: (time: number) =>
      animals.forEach(({ a, limbs, legs, i, animate }) => {
        const p = animalPose(b, i, time);
        a.position.set(p.x * 5 - cx, p.bob, p.y * 5 - cz);
        a.rotation.y = Math.atan2(-p.dx, -p.dy);
        animate?.(p, time);
        for (const limb of legs) {
          const q = (((p.gait / (Math.PI * 2) + limb.phase) % 1) + 1) % 1,
            duty = 0.64;
          // Local +Z is backwards. Linear stance cancels forward root displacement.
          const span = p.stride;
          const swing = Math.max(0, (q - duty) / (1 - duty));
          const footZ = q < duty ? (q - duty / 2) * span : (0.5 - swing) * duty * span;
          const lift =
            (species === "elephant"
              ? 0.07
              : species === "penguin"
                ? 0.05
                : species === "flamingo"
                  ? 0.12
                  : 0.11) *
            Math.sin(Math.PI * swing) *
            p.strideWeight;
          const targetY = limb.ground - limb.top - p.bob + lift,
            targetZ = footZ;
          const reach = Math.min(
            limb.upper + limb.lower - 0.0001,
            Math.max(0.001, Math.hypot(targetY, targetZ)),
          );
          const base = Math.atan2(-targetZ, -targetY);
          const clamp = (v: number) => Math.max(-1, Math.min(1, v));
          const alpha = Math.acos(
            clamp((limb.upper ** 2 + reach ** 2 - limb.lower ** 2) / (2 * limb.upper * reach)),
          );
          const bend = Math.acos(
            clamp((reach ** 2 - limb.upper ** 2 - limb.lower ** 2) / (2 * limb.upper * limb.lower)),
          );
          limb.hip.rotation.x = base - alpha;
          limb.knee.rotation.x = bend;
          limb.foot.rotation.x = -limb.hip.rotation.x - bend;
          limb.foot.userData.stance = q < duty;
          limb.foot.userData.gait = q;
        }
        limbs.forEach((wing, j) => {
          wing.rotation.z = (j ? 1 : -1) * (0.08 + Math.sin(p.gait) * 0.1 * p.strideWeight);
        });
      }),
  };
}

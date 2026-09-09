import * as THREE from "three";
import type { Building } from "./simulation";
import { SPECIES, type Species } from "./zoo";
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
  const span = n * 5,
    cx = (b.x + (n - 1) / 2) * 5,
    cz = (b.y + (n - 1) / 2) * 5;
  root.position.set(cx, 0, cz);
  mesh(
    root,
    box,
    species === "penguin"
      ? "#c5c6bd"
      : species === "flamingo"
        ? "#b7bc83"
        : species === "panda"
          ? "#8ba769"
          : species === "elephant"
            ? "#b9aa81"
            : "#b7b46a",
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
  if (species === "panda") {
    for (let j = 0; j < 7; j++) {
      const x = -span * 0.31 + (j % 3) * 0.55,
        z = -span * 0.3 + Math.floor(j / 3) * 0.48;
      mesh(root, pole, "#527942", x, 1.45, z, 0.07, 2.9, 0.07);
      for (const height of [0.75, 1.5, 2.25]) {
        mesh(root, pole, "#b4c485", x, height, z, 0.085, 0.1, 0.085);
        const leaf = mesh(
          root,
          ball,
          "#4f8342",
          x + (j % 2 ? 0.27 : -0.27),
          height + 0.15,
          z,
          0.39,
          0.08,
          0.14,
        );
        leaf.rotation.z = j % 2 ? 0.35 : -0.35;
      }
    }
  } else if (species === "elephant") {
    mesh(root, ball, "#8b8164", -span * 0.25, 0.18, span * 0.28, 2.1, 0.13, 1.55);
    for (let j = 0; j < 3; j++)
      mesh(root, ball, "#99988a", span * 0.31 + j * 0.45, 0.4, -span * 0.3, 0.8, 0.65, 0.7);
  } else if (species === "lion") {
    mesh(root, ball, "#b59f7d", -span * 0.27, 0.4, -span * 0.24, 2.1, 0.6, 1.4);
    mesh(root, ball, "#c4b18d", -span * 0.29, 0.75, -span * 0.25, 1.3, 0.3, 1.05);
  }
  const animals = Array.from({ length: b.habitat?.count ?? 0 }, (_, i) => {
    const a = new THREE.Group();
    root.add(a);
    const limbs: THREE.Mesh[] = [];
    let animate: ((pose: ReturnType<typeof animalPose>, time: number) => void) | undefined;
    a.name = `animal:${species}:${i}`;
    if (species === "zebra" || species === "giraffe") {
      const giraffe = species === "giraffe",
        color = giraffe ? "#d7aa58" : "#eee6d4",
        tall = giraffe ? 1.55 : 1;
      mesh(a, zebraBody ?? ball, giraffe ? color : "#ffffff", 0, 1.35 * tall, 0, 0.65, 0.68, 1.14);
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
      const tail = mesh(a, pole, "#4a4034", 0, 1.12 * tall, 1.26, 0.05, 0.85, 0.05);
      tail.rotation.x = -0.3;
    } else if (species === "elephant" || species === "lion" || species === "panda") {
      // Individual hip pivots carry their feet; nothing is created during update().
      const hips: Array<{ joint: THREE.Group; phase: number }> = [];
      const leg = (
        x: number,
        z: number,
        top: number,
        length: number,
        width: number,
        color: string,
      ) => {
        const joint = new THREE.Group();
        joint.position.set(x, top, z);
        a.add(joint);
        mesh(joint, pole, color, 0, -length / 2, 0, width, length, width);
        const foot = mesh(
          joint,
          ball,
          color,
          0,
          -length + width * 0.33,
          -0.045,
          width * 1.12,
          width * 0.5,
          width * 1.24,
        );
        foot.name = "paw";
        hips.push({ joint, phase: x * z < 0 ? Math.PI : 0 });
        return joint;
      };
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
              mesh(joint, ball, "#cec9b3", toe * 0.13, -1.2, -0.27, 0.075, 0.08, 0.045);
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
              mesh(joint, ball, "#ac773e", toe * 0.08, -0.94, -0.22, 0.035, 0.025, 0.04);
          }
        head.position.set(0, 1.62, -0.96);
        mesh(head, ball, "#714828", 0, -0.05, 0.02, 0.86, 0.89, 0.61);
        // Interleaved low-poly tufts, all attached to the animated head/mane.
        for (let j = 0; j < 14; j++) {
          const angle = (j * Math.PI * 2) / 14;
          const tuft = mesh(
            head,
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
        const heavy = species === "elephant",
          resting = !p.walk;
        const beat = time * (heavy ? 2.3 : species === "lion" ? 3.5 : 3.1) + i * 1.7;
        hips.forEach(({ joint, phase }) => {
          joint.rotation.x = p.walk ? Math.sin(beat + phase) * (heavy ? 0.15 : 0.23) : 0;
        });
        a.rotation.z = species === "panda" && p.walk ? Math.sin(beat) * 0.035 : 0;
        head.rotation.y = Math.sin(time * (resting ? 0.7 : 0.35) + i) * (resting ? 0.17 : 0.035);
        head.rotation.x = (resting ? 0.07 : 0) + Math.sin(beat * 0.5) * (heavy ? 0.025 : 0.04);
        tail.rotation.y = Math.sin(time * 1.1 + i) * (heavy ? 0.15 : 0.29);
        ears.forEach((ear, side) => {
          ear.rotation.y = (side ? 1 : -1) * (0.08 + Math.sin(time * 1.2 + i) * 0.11);
        });
        trunk.forEach((part, j) => {
          part.rotation.x =
            -0.11 + Math.sin(time * 0.8 + i + j * 0.8) * 0.11 - (resting ? j * 0.16 : 0);
          part.rotation.z = Math.sin(time * 0.6 + i + j * 0.5) * 0.05;
        });
      };
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
    return { a, limbs, i, animate };
  });
  return {
    root,
    update: (time: number) =>
      animals.forEach(({ a, limbs, i, animate }) => {
        const p = animalPose(b, i, time);
        a.position.set(p.x * 5 - cx, p.bob, p.y * 5 - cz);
        a.rotation.y = Math.atan2(-p.dx, -p.dy);
        animate?.(p, time);
        limbs.forEach((leg, j) => {
          if (species === "penguin")
            leg.rotation.z = (j ? 1 : -1) * (0.12 + Math.sin(time * 4 + i) * 0.16);
          else leg.rotation.x = p.walk ? Math.sin(time * 4 + i + j * Math.PI) * 0.15 : 0;
        });
      }),
  };
}

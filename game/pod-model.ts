import * as THREE from "three";
import type { Park } from "./simulation";
import { usesPods } from "./pods";
import { needsOperator } from "./operations";
import { accessLayout, gateMotion } from "./ride-access";

/** Shared layout is in tiles; architecture below is in metres. Local X follows
 * its tangent, and local -Z points out of the ride, toward the public path. */
export function addAccessPods(scene: THREE.Scene, park: Park) {
  const cube = new THREE.BoxGeometry(1, 1, 1),
    cylinder = new THREE.CylinderGeometry(1, 1, 1, 12),
    materials = new Map<string, THREE.MeshStandardMaterial>(),
    gates: {
      id: number;
      role: "entry" | "exit";
      root: THREE.Group;
      hinge: THREE.Group;
      lamp: THREE.MeshStandardMaterial;
    }[] = [],
    cabins: { id: number; root: THREE.Group }[] = [];
  const material = (color: string, glass = false) => {
    const key = `${color}:${glass}`;
    let value = materials.get(key);
    if (!value) {
      value = new THREE.MeshStandardMaterial({
        color,
        roughness: glass ? 0.13 : 0.68,
        metalness: 0.04,
        ...(glass ? { transparent: true, opacity: 0.3, depthWrite: false } : {}),
      });
      materials.set(key, value);
    }
    return value;
  };
  const part = (
    parent: THREE.Object3D,
    name: string,
    color: string,
    p: number[],
    size: number[],
    round = false,
    glass = false,
  ) => {
    const m = new THREE.Mesh(round ? cylinder : cube, material(color, glass));
    m.name = name;
    m.position.set(p[0], p[1], p[2]);
    m.scale.set(size[0], size[1], size[2]);
    parent.add(m);
    return m;
  };
  const group = (name: string, p: { x: number; y: number; dx: number; dy: number }) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(p.x * 5, 0, p.y * 5);
    g.rotation.y = Math.atan2(-p.dx, -p.dy);
    scene.add(g);
    return g;
  };
  const arrow = (
    g: THREE.Object3D,
    name: string,
    x: number,
    y: number,
    z: number,
    exit: boolean,
  ) => {
    part(g, `${name}-stem`, "#fff6d8", [x, y, z], [0.12, 0.035, 0.65]);
    for (const side of [-1, 1]) {
      const arm = part(
        g,
        `${name}-head-${side}`,
        "#fff6d8",
        [x + side * 0.13, y, z + (exit ? -0.23 : 0.23)],
        [0.1, 0.035, 0.37],
      );
      arm.rotation.y = side * (exit ? -0.75 : 0.75);
    }
  };
  for (const b of park.buildings) {
    if (!usesPods(b.kind)) continue;
    const layout = accessLayout(park, b);
    for (const role of ["entry", "exit"] as const) {
      const p = layout[role],
        g = group(`${role}-pod-${b.id}`, p),
        entry = role === "entry",
        color = entry ? "#347eaf" : "#bb5650",
        trim = "#f2e5c5",
        post = layout.posts[role],
        side = Math.sign((post.x - p.x) * p.tx + (post.y - p.y) * p.ty) || -1;
      g.userData.buildingId = b.id;
      g.userData.accessRole = role;
      g.userData.passageWidth = 2.2;
      part(g, "threshold", "#d3cdb6", [0, 0.055, -0.45], [4.7, 0.11, 2.75]);
      part(g, "passage-mat", color, [0, 0.118, -0.5], [2.18, 0.022, 1.7]);
      for (const side of [-1, 1]) {
        part(g, `post-foot-${side}`, "#64746a", [side * 1.2, 0.12, 0], [0.3, 0.24, 0.3]);
        part(g, `gateway-post-${side}`, trim, [side * 1.2, 1.29, 0], [0.16, 2.5, 0.16]);
        part(g, `post-base-${side}`, color, [side * 1.2, 0.35, 0], [0.22, 0.55, 0.22]);
        part(
          g,
          `rail-post-${side}`,
          "#62756a",
          [side * 1.2, 0.7, -1.48],
          [0.045, 1.4, 0.045],
          true,
        );
        part(g, `guide-rail-${side}`, "#bdc8b6", [side * 1.2, 1.08, -0.77], [0.07, 0.07, 1.47]);
        part(
          g,
          `guide-rail-low-${side}`,
          "#bdc8b6",
          [side * 1.2, 0.5, -0.77],
          [0.055, 0.055, 1.47],
        );
        part(
          g,
          `rail-light-${side}`,
          "#f8e8ac",
          [side * 1.2, 1.44, -1.48],
          [0.085, 0.1, 0.085],
          true,
        );
      }
      part(g, "canopy-beam", color, [0, 2.48, 0], [2.7, 0.25, 0.3]);
      part(g, "canopy-roof", color, [0, 2.72, -0.2], [2.95, 0.17, 1.35]);
      part(g, "canopy-edge", trim, [0, 2.64, -0.85], [3, 0.1, 0.12]);
      part(g, "sign-face", "#23464d", [0, 2.45, -0.17], [1.8, 0.22, 0.045]);
      arrow(g, "roof-arrow", 0, 2.815, -0.2, !entry);
      arrow(g, "ground-arrow", 0, 0.142, -0.65, !entry);
      if (entry) {
        const x = side * 1.8;
        part(g, "ticket-booth-plinth", "#785f47", [x, 0.17, -0.65], [1.05, 0.3, 1.35]);
        part(g, "ticket-booth-body", "#e8d9b8", [x, 0.65, -0.65], [1, 0.78, 1.25]);
        for (const z of [-1.25, -0.05]) {
          part(g, `ticket-window-${z}`, "#9cc9c6", [x, 1.34, z], [0.85, 0.62, 0.045], false, true);
          part(g, `window-sill-${z}`, "#866648", [x, 1.0, z], [1.05, 0.08, 0.15]);
          part(g, `window-top-${z}`, trim, [x, 1.69, z], [1.04, 0.07, 0.08]);
          for (const a of [-1, 1])
            part(
              g,
              `window-mullion-${z}-${a}`,
              trim,
              [x + a * 0.46, 1.34, z],
              [0.055, 0.68, 0.065],
            );
        }
        for (const a of [-1, 1])
          part(g, `booth-side-${a}`, "#866648", [x + a * 0.47, 1.16, -0.65], [0.07, 1.1, 1.22]);
        part(g, "ticket-booth-roof", color, [x, 1.83, -0.65], [1.2, 0.18, 1.43]);
        part(g, "ticket-slot", "#31413c", [x, 0.87, -1.293], [0.32, 0.065, 0.026]);
        part(g, "ticket-reader", color, [side * 1.17, 1.14, -0.5], [0.18, 0.3, 0.24]);
        part(g, "reader-screen", "#a4dfb3", [side * 1.17, 1.21, -0.628], [0.12, 0.1, 0.018]);
        part(g, "reader-tap-ring", "#f8e5b1", [side * 1.17, 1.06, -0.628], [0.06, 0.04, 0.018]);
      } else {
        const x = side * 1.8;
        part(g, "exit-side-panel", color, [x, 0.72, 0.02], [1.03, 1.24, 0.16]);
        part(g, "exit-rail-top", trim, [x, 1.39, 0.02], [1.12, 0.1, 0.22]);
        part(g, "exit-direction-sign", "#f5e7c5", [x, 0.96, -0.073], [0.65, 0.31, 0.035]);
        for (const a of [-1, 1]) {
          const chevron = part(
            g,
            `exit-chevron-${a}`,
            color,
            [x + a * 0.08, 0.96, -0.1],
            [0.19, 0.06, 0.028],
          );
          chevron.rotation.z = a * -0.65;
        }
      }
      const hinge = new THREE.Group();
      hinge.name = "gate-hinge";
      hinge.position.set(-1.1, 0.9, 0);
      g.add(hinge);
      part(hinge, "gate-frame-top", color, [1.1, 0.32, 0], [2.2, 0.075, 0.07]);
      part(hinge, "gate-frame-bottom", color, [1.1, -0.32, 0], [2.2, 0.06, 0.06]);
      for (let i = 0; i < 5; i++)
        part(hinge, `gate-bar-${i}`, trim, [0.25 + i * 0.42, 0, 0], [0.04, 0.63, 0.04]);
      part(g, "gate-hinge-pin", "#6c7c71", [-1.1, 0.9, 0], [0.04, 0.96, 0.04], true);
      const lamp = new THREE.MeshStandardMaterial({
          color: "#c98c49",
          emissive: "#493017",
          emissiveIntensity: 0.4,
          roughness: 0.38,
        }),
        lampMesh = new THREE.Mesh(cube, lamp);
      lampMesh.name = "gate-status-light";
      lampMesh.position.set(1.2, 1.87, -0.105);
      lampMesh.scale.set(0.1, 0.12, 0.07);
      g.add(lampMesh);
      gates.push({ id: b.id, role, root: g, hinge, lamp });
    }
    if (!needsOperator(b.kind)) continue;
    const p = layout.cabin,
      cabin = group(`control-cabin-${b.id}`, p),
      width = p.width * 5,
      depth = p.depth * 5,
      hw = width / 2,
      hd = depth / 2,
      trim = "#e7d9b5",
      blue = "#426f85";
    cabin.userData.buildingId = b.id;
    cabin.userData.accessRole = "control";
    cabin.userData.cutawayRoof = true;
    part(cabin, "cabin-foundation", "#85887a", [0, -0.055, 0], [width + 0.16, 0.15, depth + 0.16]);
    part(cabin, "cabin-floor", "#aa9570", [0, 0.04, 0], [width - 0.12, 0.04, depth - 0.12]);
    for (const side of [-1, 1]) {
      part(cabin, `cabin-side-panel-${side}`, blue, [side * hw, 0.465, 0], [0.09, 0.83, depth]);
      part(
        cabin,
        `cabin-side-glass-${side}`,
        "#9ec9ca",
        [side * hw, 1.49, 0],
        [0.045, 1.18, depth - 0.12],
        false,
        true,
      );
      part(cabin, `cabin-side-sill-${side}`, trim, [side * hw, 0.91, 0], [0.14, 0.08, depth]);
      part(
        cabin,
        `cabin-roof-side-${side}`,
        blue,
        [side * (hw - 0.08), 2.26, 0],
        [0.28, 0.12, depth + 0.2],
      );
      for (const z of [-hd, hd])
        part(cabin, `cabin-corner-${side}-${z}`, trim, [side * hw, 1.15, z], [0.11, 2.2, 0.11]);
    }
    part(cabin, "cabin-rear-panel", blue, [0, 0.47, hd], [width, 0.84, 0.09]);
    part(
      cabin,
      "cabin-rear-glass",
      "#9ec9ca",
      [0, 1.5, hd],
      [width - 0.15, 1.18, 0.045],
      false,
      true,
    );
    for (const side of [-1, 1]) {
      const section = Math.max(0.2, (width - 0.84) / 2),
        x = side * (0.42 + section / 2);
      part(cabin, `cabin-front-panel-${side}`, blue, [x, 0.47, -hd], [section, 0.84, 0.09]);
      part(
        cabin,
        `cabin-front-glass-${side}`,
        "#9ec9ca",
        [x, 1.49, -hd],
        [section - 0.08, 1.18, 0.045],
        false,
        true,
      );
      part(cabin, `cabin-door-jamb-${side}`, trim, [side * 0.42, 1.11, -hd], [0.08, 2.12, 0.11]);
    }
    part(cabin, "cabin-door-lintel", trim, [0, 2.17, -hd], [width + 0.14, 0.14, 0.17]);
    part(cabin, "cabin-roof-rear", blue, [0, 2.26, hd - 0.2], [width + 0.2, 0.12, 0.6]);
    const hatch = part(
      cabin,
      "cabin-open-roof-hatch",
      "#718c95",
      [0, 2.56, hd - 0.37],
      [width - 0.38, 0.07, 0.72],
    );
    hatch.rotation.x = -0.9;
    part(cabin, "cabin-entry-step", "#b5b29c", [0, 0.035, -hd - 0.18], [0.89, 0.05, 0.36]);
    const control = layout.posts.control,
      tx = -p.dy,
      ty = p.dx,
      cx = ((control.x - p.x) * tx + (control.y - p.y) * ty) * 5,
      cz = -((control.x - p.x) * p.dx + (control.y - p.y) * p.dy) * 5;
    part(cabin, "control-console-base", "#365564", [cx, 0.57, cz - 0.5], [0.95, 0.65, 0.36]);
    for (const side of [-1, 1])
      part(
        cabin,
        `control-console-leg-${side}`,
        "#60716b",
        [cx + side * 0.35, 0.19, cz - 0.5],
        [0.08, 0.28, 0.26],
      );
    part(cabin, "control-console-top", "#718a88", [cx, 0.95, cz - 0.5], [1.04, 0.12, 0.44]);
    part(cabin, "control-monitor", "#294149", [cx - 0.18, 1.18, cz - 0.56], [0.47, 0.28, 0.07]);
    part(
      cabin,
      "control-monitor-glass",
      "#9bcdb5",
      [cx - 0.18, 1.18, cz - 0.514],
      [0.38, 0.2, 0.022],
    );
    for (let i = 0; i < 3; i++)
      part(
        cabin,
        `control-button-${i}`,
        ["#eac56b", "#ba645a", "#9cbd84"][i],
        [cx + 0.18 + i * 0.09, 1.025, cz - 0.36],
        [0.032, 0.033, 0.032],
        true,
      );
    part(cabin, "control-radio", "#273d42", [cx + 0.35, 1.15, cz - 0.59], [0.12, 0.23, 0.1]);
    part(cabin, "control-stool-seat", "#6d6755", [cx, 0.47, cz + 0.28], [0.22, 0.1, 0.22], true);
    part(cabin, "control-stool-leg", "#60716b", [cx, 0.27, cz + 0.28], [0.045, 0.43, 0.045], true);
    cabins.push({ id: b.id, root: cabin });
  }
  if (!gates.length) {
    cube.dispose();
    cylinder.dispose();
  }
  const update = (state: Park = park) => {
    const buildings = new Map(state.buildings.map((b) => [b.id, b]));
    for (const gate of gates) {
      const b = buildings.get(gate.id);
      gate.root.visible = !!b;
      if (!b) continue;
      const motion = gateMotion(state, b, gate.role),
        open = Math.max(0, Math.min(1, motion.open));
      gate.hinge.rotation.y = (((gate.role === "entry" ? -1 : 1) * Math.PI) / 2) * open;
      gate.root.userData.gateOpen = open;
      gate.lamp.color.set(open > 0.7 ? "#9fca84" : "#ce9758");
      gate.lamp.emissive.set(open > 0.7 ? "#315731" : "#493017");
    }
    for (const cabin of cabins) cabin.root.visible = buildings.has(cabin.id);
  };
  update();
  return update;
}

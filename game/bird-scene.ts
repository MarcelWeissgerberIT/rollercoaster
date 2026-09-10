import * as THREE from "three";
import type { Park } from "./simulation";
import { BIRD_COLORS, birdAnatomy, parkBirds, type BirdPoint } from "./birds";

export function createBirdScene(scene: THREE.Scene, park: Park) {
  const root = new THREE.Group();
  root.name = "park-birds";
  scene.add(root);
  const sphere = new THREE.SphereGeometry(1, 10, 7),
    cone = new THREE.ConeGeometry(1, 1, 5),
    materials = new Map<string, THREE.MeshStandardMaterial>(),
    dynamic: THREE.BufferGeometry[] = [];
  const material = (color: string) => {
    let m = materials.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide });
      materials.set(color, m);
    }
    return m;
  };
  const ellipsoid = (
    parent: THREE.Group,
    color: string,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
  ) => {
    const mesh = new THREE.Mesh(sphere, material(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
  };
  const polygon = (parent: THREE.Group, color: string, count: number) => {
    const geometry = new THREE.BufferGeometry(),
      array = new Float32Array((count - 2) * 9);
    geometry.setAttribute("position", new THREE.BufferAttribute(array, 3));
    dynamic.push(geometry);
    const mesh = new THREE.Mesh(geometry, material(color));
    mesh.frustumCulled = false;
    parent.add(mesh);
    return {
      mesh,
      update(points: BirdPoint[]) {
        let index = 0;
        for (let i = 1; i < points.length - 1; i++)
          for (const p of [points[0], points[i], points[i + 1]]) {
            array[index++] = p.x;
            array[index++] = p.y;
            array[index++] = p.z;
          }
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
      },
    };
  };
  const models = Array.from({ length: 5 }, (_, id) => {
    const colors = BIRD_COLORS[id % BIRD_COLORS.length],
      bird = new THREE.Group(),
      body = new THREE.Group(),
      head = new THREE.Group();
    bird.name = `park-bird-${id}`;
    body.name = "bird-body-frame";
    head.name = "bird-head-joint";
    root.add(bird);
    bird.add(body);
    body.add(head);
    ellipsoid(body, colors.body, 0, 0.14, 0, 0.1, 0.105, 0.235);
    ellipsoid(body, colors.breast, 0, 0.115, 0.075, 0.083, 0.065, 0.15);
    head.position.set(0, 0.18, 0.12);
    ellipsoid(head, colors.body, 0, 0.06, 0.055, 0.087, 0.083, 0.095);
    for (const side of [-1, 1])
      ellipsoid(head, "#263a3b", side * 0.073, 0.075, 0.1, 0.017, 0.017, 0.015);
    const beak = new THREE.Mesh(cone, material(colors.beak));
    beak.scale.set(0.028, 0.105, 0.028);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.04, 0.1775);
    head.add(beak);
    const wings = [polygon(body, colors.wing, 7), polygon(body, colors.wing, 7)],
      tips = [polygon(body, colors.tip, 3), polygon(body, colors.tip, 3)],
      tail = polygon(body, colors.tip, 4),
      feet = [
        ellipsoid(body, colors.beak, -0.055, 0.07, 0.03, 0.015, 0.055, 0.017),
        ellipsoid(body, colors.beak, 0.055, 0.07, 0.03, 0.015, 0.055, 0.017),
      ];
    return { bird, body, head, wings, tips, tail, feet, shapeKey: "" };
  });
  function update(time = park.time) {
    const poses = parkBirds(park, time);
    models.forEach((model, id) => {
      const pose = poses[id];
      model.bird.visible = !!pose && pose.opacity > 0.05;
      if (!pose) return;
      model.bird.position.set(pose.x * 5, pose.z * 5, pose.y * 5);
      model.bird.rotation.y = Math.PI / 2 - pose.heading;
      model.body.rotation.set(-pose.pitch, 0, pose.bank, "XZY");
      model.head.rotation.set(pose.headDip, pose.headTurn, 0, "XYZ");
      model.bird.userData.pose = pose;
      const shapeKey = `${pose.wing}:${pose.tipFold}:${pose.feet}`;
      if (model.shapeKey === shapeKey) return;
      model.shapeKey = shapeKey;
      const anatomy = birdAnatomy(pose);
      model.wings.forEach((wing, i) => {
        wing.update(anatomy.wings[i]);
        model.tips[i].update([anatomy.wings[i][2], anatomy.wings[i][3], anatomy.wings[i][4]]);
      });
      model.tail.update(anatomy.tail);
      model.feet.forEach((foot, i) => {
        foot.position.set(anatomy.feet[i].x, anatomy.feet[i].y + 0.045, anatomy.feet[i].z);
        foot.scale.y = 0.055 * pose.feet;
        foot.visible = pose.feet > 0.05;
      });
    });
    return poses;
  }
  update(park.time);
  return {
    root,
    update,
    dispose() {
      scene.remove(root);
      sphere.dispose();
      cone.dispose();
      dynamic.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

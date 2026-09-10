import * as THREE from "three";
import { staffPose, staffYaw, type StaffMotion } from "./staff-animation";

/** Reusable meshes: no geometry/material allocation during a work or walking cycle. */
export function createStaffModel(initial: StaffMotion) {
  const root = new THREE.Group(),
    round = new THREE.SphereGeometry(1, 10, 8),
    box = new THREE.BoxGeometry(2, 2, 2),
    meshes = new Map<string, THREE.Mesh>(),
    materials = new Map<string, THREE.MeshStandardMaterial>(),
    up = new THREE.Vector3(0, 1, 0),
    direction = new THREE.Vector3();
  root.name = `staff-${initial.role}-${initial.id}${initial.post && initial.post !== "control" ? `-${initial.post}` : ""}`;
  root.userData.staffPost = initial.post;
  root.userData.staffId = initial.id;
  root.userData.staffKind = initial.role;
  const update = (motion: StaffMotion) => {
    for (const mesh of meshes.values()) mesh.visible = false;
    root.rotation.y = staffYaw(motion.heading);
    for (const part of staffPose(motion)) {
      let mesh = meshes.get(part.id);
      if (!mesh) {
        let material = materials.get(part.color);
        if (!material) {
          material = new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.85 });
          materials.set(part.color, material);
        }
        mesh = new THREE.Mesh(part.shape === "box" ? box : round, material);
        mesh.name = part.id;
        root.add(mesh);
        meshes.set(part.id, mesh);
      }
      mesh.visible = true;
      if (part.b) {
        direction.set(part.b[0] - part.a[0], part.b[1] - part.a[1], part.b[2] - part.a[2]);
        const length = direction.length();
        mesh.position.set(
          (part.a[0] + part.b[0]) / 2,
          (part.a[1] + part.b[1]) / 2,
          (part.a[2] + part.b[2]) / 2,
        );
        mesh.scale.set(part.size[0], length / 2 + part.size[0] * 0.45, part.size[2]);
        if (length > 0.00001) mesh.quaternion.setFromUnitVectors(up, direction.normalize());
      } else {
        mesh.position.set(...part.a);
        mesh.scale.set(...part.size);
        mesh.quaternion.identity();
      }
    }
  };
  update(initial);
  return { root, update };
}

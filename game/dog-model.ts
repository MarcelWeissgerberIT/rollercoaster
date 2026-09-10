import * as THREE from "three";
import { dogParts, dogWorldPoint, type DogPose, type DogVector } from "./guest-dogs";

export function createDogCompanionModel(ownerId: number) {
  const root = new THREE.Group(),
    sphere = new THREE.SphereGeometry(1, 10, 7),
    cylinder = new THREE.CylinderGeometry(1, 1, 1, 7),
    materials = new Map<string, THREE.MeshStandardMaterial>(),
    parts: THREE.Mesh[] = [],
    leashGeometry = new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(27), 3),
    ),
    leashMaterial = new THREE.LineBasicMaterial({ color: "#6b5b43" }),
    leash = new THREE.Line(leashGeometry, leashMaterial);
  root.name = `companion-dog-${ownerId}`;
  root.userData.ownerId = ownerId;
  root.add(leash);
  const material = (color: string) => {
    let m = materials.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.94 });
      materials.set(color, m);
    }
    return m;
  };
  return {
    root,
    update(pose: DogPose | null, ownerHand?: DogVector) {
      root.visible = !!pose;
      if (!pose) return;
      const skeleton = dogParts(pose);
      for (const [i, part] of skeleton.entries()) {
        if (!parts[i]) {
          const mesh = new THREE.Mesh(part.end ? cylinder : sphere, material(part.color));
          mesh.name = part.name;
          mesh.castShadow = true;
          root.add(mesh);
          parts.push(mesh);
        }
        const mesh = parts[i],
          p = dogWorldPoint(pose, part.p);
        mesh.position.set(p.x * 5, p.z, p.y * 5);
        if (part.end) {
          const q = dogWorldPoint(pose, part.end),
            from = new THREE.Vector3(p.x * 5, p.z, p.y * 5),
            to = new THREE.Vector3(q.x * 5, q.z, q.y * 5),
            delta = to.clone().sub(from);
          mesh.position.copy(from.add(to).multiplyScalar(0.5));
          mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
          mesh.scale.set(part.radius[0], delta.length(), part.radius[0]);
        } else {
          mesh.rotation.set(0, pose.yaw, 0);
          mesh.scale.set(...part.radius);
        }
      }
      const hand = dogWorldPoint(
          { x: pose.owner.x, y: pose.owner.y, yaw: pose.ownerYaw },
          ownerHand ?? [0.27 * pose.ownerHeight, 0.98 * pose.ownerHeight, 0],
        ),
        collar = dogWorldPoint(pose, [0, 0.5, -0.27]),
        buffer = leashGeometry.attributes.position;
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        buffer.setXYZ(
          i,
          (hand.x + (collar.x - hand.x) * t) * 5,
          hand.z + (collar.z - hand.z) * t - Math.sin(Math.PI * t) * 0.12,
          (hand.y + (collar.y - hand.y) * t) * 5,
        );
      }
      buffer.needsUpdate = true;
      leashGeometry.computeBoundingSphere();
    },
    dispose() {
      sphere.dispose();
      cylinder.dispose();
      leashGeometry.dispose();
      leashMaterial.dispose();
      for (const m of materials.values()) m.dispose();
    },
  };
}

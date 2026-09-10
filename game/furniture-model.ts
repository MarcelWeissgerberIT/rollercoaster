import * as THREE from "three";
import type { Building } from "./simulation";
import { buildingOrientation, isRotatableFurniture } from "./building-orientation";
import { furnitureParts } from "./furniture";

export function createFurnitureModel(
  b: Building,
  cube: THREE.BufferGeometry,
  material: (color: string) => THREE.Material,
) {
  const root = new THREE.Group();
  if (!isRotatableFurniture(b.kind)) return root;
  root.name = `furniture-${b.id}`;
  root.userData.buildingId = b.id;
  root.userData.orientation = buildingOrientation(b);
  root.position.set(b.x * 5, 0, b.y * 5);
  // World tile rotation +90° is a negative yaw in Three's X/Z plane.
  root.rotation.y = (-buildingOrientation(b) * Math.PI) / 2;
  for (const [index, part] of furnitureParts(b.kind).entries()) {
    const mesh = new THREE.Mesh(cube, material(part.color));
    mesh.name = `${b.kind}-slat-or-support-${index}`;
    mesh.position.set(part.x, part.z, part.y);
    mesh.scale.set(part.width, part.height, part.depth);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  return root;
}

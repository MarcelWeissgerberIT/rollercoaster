import * as THREE from "three";
import { sceneryFaces, type SceneryPiece } from "./modular-scenery";
export function createSceneryModel(p: SceneryPiece) {
  const root = new THREE.Group();
  root.name = `scenery-${p.id}`;
  root.position.set(p.x * 5, p.z * 5, p.y * 5);
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  for (const face of sceneryFaces(p)) {
    const points: number[] = [];
    for (let i = 1; i < face.points.length - 1; i++)
      for (const v of [face.points[0], face.points[i], face.points[i + 1]])
        points.push(v[0], v[2], v[1]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    geometry.computeVertexNormals();
    if (!materials.has(face.color))
      materials.set(
        face.color,
        new THREE.MeshStandardMaterial({
          color: face.color,
          roughness: 0.73,
          side: THREE.DoubleSide,
        }),
      );
    const mesh = new THREE.Mesh(geometry, materials.get(face.color));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  return root;
}

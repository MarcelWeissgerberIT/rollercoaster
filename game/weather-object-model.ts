import * as THREE from "three";
import type { Building } from "./simulation";
import { isWeatherObject, weatherFaces } from "./weather-objects";

export function createWeatherObjectModel(b: Building) {
  const root = new THREE.Group();
  root.name = `weather-object-${b.id}`;
  root.position.set(b.x * 5, 0, b.y * 5);
  if (!isWeatherObject(b.kind)) return root;
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  for (const face of weatherFaces(b.kind)) {
    const vertices: number[] = [];
    for (let i = 1; i < face.points.length - 1; i++)
      for (const p of [face.points[0], face.points[i], face.points[i + 1]])
        vertices.push(p[0], p[2], p[1]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.computeVertexNormals();
    if (!materials.has(face.color))
      materials.set(
        face.color,
        new THREE.MeshStandardMaterial({
          color: face.color,
          roughness: 0.77,
          side: THREE.DoubleSide,
        }),
      );
    const mesh = new THREE.Mesh(geo, materials.get(face.color));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 1.8 * 0.72, -0.03),
    new THREE.Vector3(0, 1.72 * 0.72, 0.13),
    new THREE.Vector3(0, 1.27 * 0.72, 0.22),
  );
  const stream = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 8, 0.025, 5, false),
    new THREE.MeshStandardMaterial({ color: "#ade4ed", transparent: true, opacity: 0.8 }),
  );
  if (b.kind === "fountain") root.add(stream);
  else {
    stream.geometry.dispose();
    stream.material.dispose();
  }
  root.userData.updateWeatherObject = () => {
    stream.visible = b.kind === "fountain" && b.riders.length > 0;
  };
  root.userData.updateWeatherObject();
  return root;
}

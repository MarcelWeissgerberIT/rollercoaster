import * as THREE from "three";
import { umbrellaPanels, type UmbrellaSource } from "./umbrella";
export function createUmbrellaModel(g: UmbrellaSource) {
  const root = new THREE.Group(),
    shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.92, 7),
      new THREE.MeshStandardMaterial({ color: "#596c70", metalness: 0.5, roughness: 0.4 }),
    );
  root.name = `guest-umbrella-${g.id}`;
  shaft.position.y = 0.45;
  root.add(shaft);
  const panels = umbrellaPanels(g).map((p) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(9), 3));
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: p.color, side: THREE.DoubleSide, roughness: 0.7 }),
    );
    root.add(mesh);
    return mesh;
  });
  const update = (source: UmbrellaSource, time: number) => {
    umbrellaPanels(source).forEach((panel, i) => {
      const positions = panels[i].geometry.getAttribute("position") as THREE.BufferAttribute;
      panel.vertices.forEach((p, n) => positions.setXYZ(n, ...p));
      positions.needsUpdate = true;
      panels[i].geometry.computeVertexNormals();
    });
    root.rotation.z = Math.sin(time * 1.7 + g.id) * 0.025 * (source.umbrella?.opened ?? 0);
  };
  update(g, 0);
  return { root, update };
}

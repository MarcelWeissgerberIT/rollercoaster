import * as THREE from "three";
import type { makeRidePath } from "./ride-path";
/** Motor fins / brake pads use the exact same sampled span as the speed solver. */
export function addDriveHardware(scene: THREE.Scene, path: ReturnType<typeof makeRidePath>) {
  for (const kind of ["boost", "brake"] as const) {
    const frames = [];
    for (let d = 0.5; d < path.length; d += 1) {
      const f = path.at(d / path.length);
      if (f.drive?.kind === kind) frames.push(f);
    }
    if (!frames.length) continue;
    const mesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.65, 0.16, 0.78),
        new THREE.MeshStandardMaterial({
          color: kind === "boost" ? "#32d4cc" : "#e99b48",
          metalness: 0.35,
          roughness: 0.4,
          emissive: kind === "boost" ? "#155654" : "#573416",
          emissiveIntensity: 0.3,
        }),
        frames.length,
      ),
      matrix = new THREE.Matrix4();
    frames.forEach((f, i) => {
      matrix.compose(
        f.position.clone().addScaledVector(f.up, 0.12),
        f.quaternion,
        new THREE.Vector3(1, 1, 1),
      );
      mesh.setMatrixAt(i, matrix);
    });
    scene.add(mesh);
  }
}

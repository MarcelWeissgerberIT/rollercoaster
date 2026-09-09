import * as THREE from "three";
import type { Park } from "./simulation";
import { exitNetwork } from "./walkways";

/** Ground arrows share the simulation's actual downstream direction in every 3D view. */
export function addExitArrows(scene: THREE.Scene, park: Park) {
  const exits = exitNetwork(park);
  if (!exits.size) return;
  const shape = new THREE.Shape();
  shape.moveTo(-1.25, -0.2);
  shape.lineTo(0.2, -0.2);
  shape.lineTo(0.2, -0.65);
  shape.lineTo(1.25, 0);
  shape.lineTo(0.2, 0.65);
  shape.lineTo(0.2, 0.2);
  shape.lineTo(-1.25, 0.2);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  const arrows = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: "#fff5e4" }),
    exits.size,
  );
  const matrix = new THREE.Matrix4();
  let index = 0;
  for (const [key, to] of exits) {
    const [x, y] = key.split(",").map(Number);
    matrix.makeRotationY(-Math.atan2(to.y - y, to.x - x));
    matrix.setPosition(x * 5, 0.085, y * 5);
    arrows.setMatrixAt(index++, matrix);
  }
  arrows.name = "exit-direction-arrows";
  scene.add(arrows);
}

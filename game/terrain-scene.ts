import * as THREE from "three";
import type { Park } from "./simulation";
import { terrainHeight, deckHeight } from "./terrain";
import { PATH_STYLES } from "./park-life";
export function addTerrainScene(scene: THREE.Scene, s: Park) {
  const cube = new THREE.BoxGeometry(1, 1, 1),
    materials = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (color: string) => {
    if (!materials.has(color))
      materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.88 }));
    return materials.get(color)!;
  };
  const groups = new Map<string, THREE.Matrix4[]>();
  const box = (
    color: string,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    angle = 0,
    axis = "x",
  ) => {
    if (sy <= 0) return;
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(
        axis === "x" ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1),
        angle,
      ),
      new THREE.Vector3(sx, sy, sz),
    );
    groups.set(color, [...(groups.get(color) ?? []), matrix]);
  };
  for (let y = 0; y < s.tiles.length; y++)
    for (let x = 0; x < s.tiles[y].length; x++) {
      const top = terrainHeight(s, x, y) * 5 - 0.12,
        tunnels = (s.elevatedPaths ?? []).filter(
          (d) =>
            d.x === x &&
            d.y === y &&
            d.z + (d.slope === undefined ? 0 : 1) < terrainHeight(s, x, y),
        );
      if (tunnels.length) {
        const bottom = Math.min(...tunnels.map((d) => d.z)) * 5 - 0.2,
          ceiling = Math.max(...tunnels.map((d) => d.z + (d.slope === undefined ? 0 : 1))) * 5 + 3;
        box("#8b795b", x * 5, (-26 + bottom) / 2, y * 5, 5, bottom + 26, 5);
        box("#8b795b", x * 5, (top + ceiling) / 2, y * 5, 5, top - ceiling, 5);
      } else box("#8b795b", x * 5, (-26 + top) / 2, y * 5, 5, top + 26, 5);
      box((x + y) % 2 ? "#82ad4e" : "#86b152", x * 5, top + 0.05, y * 5, 4.999, 0.1, 4.999);
    }
  for (const d of s.elevatedPaths ?? []) {
    const alongX = d.slope === undefined || d.slope === 0 || d.slope === 2,
      sign = d.slope === 0 || d.slope === 3 ? 1 : -1,
      angle = d.slope === undefined ? 0 : (sign * Math.PI) / 4,
      length = d.slope === undefined ? 5 : Math.sqrt(50),
      height = deckHeight(d) * 5;
    const color =
      d.type === "queue" ? "#79aadd" : d.type === "exit" ? "#df9589" : PATH_STYLES[d.style].color;
    box(
      color,
      d.x * 5,
      height,
      d.y * 5,
      alongX ? length : 4.9,
      0.17,
      alongX ? 4.9 : length,
      angle,
      alongX ? "z" : "x",
    );
    for (const side of [-2.3, 2.3]) {
      box(
        "#e1dec0",
        d.x * 5 + (alongX ? 0 : side),
        height + 1.1,
        d.y * 5 + (alongX ? side : 0),
        alongX ? length : 0.1,
        0.1,
        alongX ? 0.1 : length,
        angle,
        alongX ? "z" : "x",
      );
      for (const end of [-2.3, 2.3]) {
        const x = d.x + (alongX ? end : side) / 5,
          y = d.y + (alongX ? side : end) / 5,
          h = deckHeight(d, x, y) * 5;
        box("#567c70", x * 5, h + 0.55, y * 5, 0.13, 1.1, 0.13);
        const floor = terrainHeight(s, d.x, d.y) * 5;
        if (h > floor + 0.5) box("#7e8a6c", x * 5, (h + floor) / 2, y * 5, 0.23, h - floor, 0.23);
      }
    }
  }
  for (const [color, matrices] of groups) {
    const mesh = new THREE.InstancedMesh(cube, mat(color), matrices.length);
    mesh.name = "terrain-and-elevated-paths";
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    scene.add(mesh);
  }
}

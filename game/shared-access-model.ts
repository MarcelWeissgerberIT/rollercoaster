import * as THREE from "three";
import type { Park, Point } from "./simulation";
import {
  sharedAccessTiles,
  sharedArrowSegments,
  SHARED_ACCESS_COLORS,
} from "./shared-access-visual";

/** Thin surfaces sit above existing queue paving; world tiles remain unchanged. */
export function addSharedAccessMarkings(scene: THREE.Scene, park: Park) {
  const tiles = sharedAccessTiles(park);
  if (!tiles.length) return;
  const materials = {
      entry: new THREE.MeshStandardMaterial({
        color: SHARED_ACCESS_COLORS.entry,
        roughness: 0.88,
        side: THREE.DoubleSide,
      }),
      exit: new THREE.MeshStandardMaterial({
        color: SHARED_ACCESS_COLORS.exit,
        roughness: 0.88,
        side: THREE.DoubleSide,
      }),
      line: new THREE.MeshStandardMaterial({ color: SHARED_ACCESS_COLORS.line, roughness: 0.8 }),
    },
    cube = new THREE.BoxGeometry(1, 1, 1);
  const line = (parent: THREE.Group, a: Point, b: Point, width: number, name: string) => {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      mesh = new THREE.Mesh(cube, materials.line);
    mesh.name = name;
    mesh.position.set((a.x + b.x) * 2.5, 0.107, (a.y + b.y) * 2.5);
    mesh.scale.set(width, 0.016, Math.hypot(dx, dy) * 5);
    mesh.rotation.y = Math.atan2(dx, dy);
    parent.add(mesh);
  };
  for (const tile of tiles) {
    const group = new THREE.Group();
    group.name = `shared-access-path-${tile.buildingId}-${tile.cell.x}-${tile.cell.y}`;
    group.userData.buildingId = tile.buildingId;
    group.userData.cell = { ...tile.cell };
    scene.add(group);
    for (const role of ["entry", "exit"] as const) {
      const outline = tile[role].map((p) => new THREE.Vector2(p.x * 5, p.y * 5)),
        geometry = new THREE.BufferGeometry(),
        positions: number[] = [];
      for (const triangle of THREE.ShapeUtils.triangulateShape(outline, []))
        for (const index of triangle) positions.push(outline[index].x, 0.092, outline[index].y);
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, materials[role]);
      mesh.name = `shared-${role}-lane`;
      mesh.userData.outline = tile[role].map((p) => ({ ...p }));
      group.add(mesh);
    }
    for (let i = 1; i < tile.divider.length; i++)
      line(group, tile.divider[i - 1], tile.divider[i], 0.065, "shared-lane-divider");
    for (const arrow of tile.arrows)
      for (const [a, b] of sharedArrowSegments(arrow.center, arrow.direction))
        line(group, a, b, 0.085, `shared-${arrow.role}-arrow`);
  }
}

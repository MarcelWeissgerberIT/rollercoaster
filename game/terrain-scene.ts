import * as THREE from "three";
import type { Park } from "./simulation";
import { terrainHeight, deckHeight } from "./terrain";
import { PATH_STYLES } from "./park-life";
import { terrainCellSurface, terrainGrassColor, type SurfacePoint } from "./terrain-surface";
import { parkCoasterTunnels, tunnelVoidIntervals } from "./coaster-tunnels";
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
    const matrices = groups.get(color) ?? [];
    matrices.push(matrix);
    groups.set(color, matrices);
  };
  const surfaces = new Map<string, number[]>(),
    tunnelLayout = parkCoasterTunnels(s);
  const triangle = (color: string, a: SurfacePoint, b: SurfacePoint, c: SurfacePoint) => {
    const vertices = surfaces.get(color) ?? [];
    // World Y is altitude. Reversed winding keeps the grass's normals facing up.
    for (const p of [a, c, b]) vertices.push(p.x * 5, p.z * 5 - 0.015, p.y * 5);
    surfaces.set(color, vertices);
  };
  const quad = (
    color: string,
    a: SurfacePoint,
    b: SurfacePoint,
    c: SurfacePoint,
    d: SurfacePoint,
  ) => {
    triangle(color, a, b, c);
    triangle(color, a, c, d);
  };
  function grassPatch(x: number, y: number, center: number, ring: SurfacePoint[], color: string) {
    for (let i = 0; i < 4; i++) triangle(color, { x, y, z: center }, ring[i], ring[(i + 1) % 4]);
  }
  // Each solid interval gets its own strata. Never bridge across separate, stacked bores.
  function groundColumn(
    x: number,
    y: number,
    bottom: number,
    top: number,
    surface: number,
    width = 5,
  ) {
    const strata: [number, number, string][] = [
      [bottom, surface - 1.2, "#908b72"],
      [surface - 1.2, surface - 0.3, "#a18a61"],
      [surface - 0.3, surface, "#718f43"],
    ];
    for (const [lo, hi, color] of strata) {
      const a = Math.max(bottom, lo),
        b = Math.min(top, hi);
      box(color, x * 5, (a + b) / 2, y * 5, width, b - a, width);
    }
  }
  const directions = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ],
    neighbors = [
      [3, 2],
      [0, 3],
      [1, 0],
      [2, 1],
    ];
  for (let y = 0; y < s.tiles.length; y++)
    for (let x = 0; x < s.tiles[y].length; x++) {
      const height = terrainHeight(s, x, y),
        top = height * 5 - 0.12,
        samples = tunnelLayout.cells.get(`${x},${y}`),
        paths = (s.elevatedPaths ?? []).filter(
          (d) => d.x === x && d.y === y && d.z + (d.slope === undefined ? 0 : 1) < height,
        ),
        grass = terrainGrassColor(x, y),
        ring = terrainCellSurface(s, x, y);
      if (samples?.length || paths.length) {
        // Only bore cells are subdivided. Removing volume, including the top turf at
        // sloping entrances, leaves actual open geometry for the on-ride camera.
        const divisions = 10,
          step = 1 / divisions,
          half = step / 2;
        for (let iy = 0; iy < divisions; iy++)
          for (let ix = 0; ix < divisions; ix++) {
            const xx = x - 0.5 + (ix + 0.5) * step,
              yy = y - 0.5 + (iy + 0.5) * step,
              cellRing = [
                [-half, -half],
                [half, -half],
                [half, half],
                [-half, half],
              ].map(([dx, dy]) => ({
                x: xx + dx,
                y: yy + dy,
                // At an artificial cliff, sample its own side of the boundary.
                z: terrainHeight(s, xx + dx * 0.999999, yy + dy * 0.999999),
              })),
              surfaceMin = Math.min(...cellRing.map((p) => p.z), terrainHeight(s, xx, yy)),
              surfaceMax = Math.max(...cellRing.map((p) => p.z), terrainHeight(s, xx, yy)),
              intervals = tunnelVoidIntervals(samples ?? [], xx, yy, half);
            for (const path of paths)
              intervals.push([path.z - 0.04, path.z + (path.slope === undefined ? 0 : 1) + 0.6]);
            intervals.sort((a, b) => a[0] - b[0]);
            let floor = -5.2;
            for (const [lo, hi] of intervals) {
              if (lo > surfaceMax) break;
              if (lo > floor)
                groundColumn(
                  xx,
                  yy,
                  floor * 5,
                  Math.min(lo, surfaceMin) * 5,
                  surfaceMin * 5,
                  step * 5,
                );
              floor = Math.max(floor, hi);
            }
            if (floor < surfaceMin) {
              groundColumn(xx, yy, floor * 5, surfaceMin * 5 - 0.015, surfaceMin * 5, step * 5);
              grassPatch(xx, yy, terrainHeight(s, xx, yy), cellRing, grass);
              for (let i = 0; i < 4; i++) {
                const a = cellRing[i],
                  b = cellRing[(i + 1) % 4];
                quad("#718f43", a, b, { ...b, z: surfaceMin }, { ...a, z: surfaceMin });
              }
            }
          }
      } else if (s.naturalTerrain) {
        // One shared center fan matches park view, terrain sampling and tree placement.
        grassPatch(x, y, height, ring, grass);
        for (let edge = 0; edge < 4; edge++) {
          const [dx, dy] = directions[edge],
            a = ring[edge],
            b = ring[(edge + 1) % 4],
            neighbor =
              s.tiles[y + dy]?.[x + dx] === undefined
                ? null
                : terrainCellSurface(s, x + dx, y + dy),
            lowA = neighbor ? neighbor[neighbors[edge][0]].z : -5.2,
            lowB = neighbor ? neighbor[neighbors[edge][1]].z : -5.2;
          if (lowA >= a.z - 0.001 && lowB >= b.z - 0.001) continue;
          const baseA = { ...a, z: Math.min(a.z, lowA) },
            baseB = { ...b, z: Math.min(b.z, lowB) };
          quad("#908b72", a, b, baseB, baseA);
          quad(
            "#a18a61",
            a,
            b,
            { ...b, z: Math.max(baseB.z, b.z - 0.24) },
            { ...a, z: Math.max(baseA.z, a.z - 0.24) },
          );
          quad(
            "#718f43",
            a,
            b,
            { ...b, z: Math.max(baseB.z, b.z - 0.06) },
            { ...a, z: Math.max(baseA.z, a.z - 0.06) },
          );
        }
      } else {
        let bottom = -26;
        for (const path of paths.toSorted((a, b) => a.z - b.z)) {
          groundColumn(x, y, bottom, path.z * 5 - 0.2, top);
          bottom = Math.max(bottom, (path.z + (path.slope === undefined ? 0 : 1)) * 5 + 3);
        }
        groundColumn(x, y, bottom, top, top);
        box(grass, x * 5, top + 0.05, y * 5, 5, 0.1, 5);
      }
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
  for (const [color, positions] of surfaces) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const material = mat(color);
    material.side = THREE.DoubleSide;
    const surface = new THREE.Mesh(geometry, material);
    surface.name = "terrain-surface";
    scene.add(surface);
  }
  for (const [color, matrices] of groups) {
    const mesh = new THREE.InstancedMesh(cube, mat(color), matrices.length);
    mesh.name = "terrain-and-elevated-paths";
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    scene.add(mesh);
  }
}

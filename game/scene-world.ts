import { createBirdScene } from "./bird-scene";
import { PATH_STYLES, pathStyleAt } from "./park-life";
import * as THREE from "three";
import { populatePark } from "./park-scene";
import { mapWidth, mapHeight } from "./grid";
import type { Park } from "./simulation";
import { createWeatherScene } from "./weather-scene";
export function createWorld(park: Park, exclude = -1) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#b9dce3");
  scene.fog = new THREE.Fog("#b9dce3", 230, 650);
  const ambient = new THREE.HemisphereLight("#f0fbff", "#5c753e", 2.8);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight("#fff2d2", 2.3);
  sun.position.set(30, 100, -30);
  scene.add(sun);
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (c: string) => {
    if (!materials.has(c))
      materials.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 }));
    return materials.get(c)!;
  };
  const cube = new THREE.BoxGeometry(1, 1, 1),
    cylinder = new THREE.CylinderGeometry(1, 1, 1, 8),
    cone = new THREE.ConeGeometry(1, 1, 7);
  const mesh = (
    g: THREE.BufferGeometry,
    c: string,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    parent: THREE.Object3D = scene,
  ) => {
    const m = new THREE.Mesh(g, mat(c));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    parent.add(m);
    return m;
  };
  mesh(
    cube,
    "#80aa4c",
    (mapWidth(park) - 1) * 2.5,
    -0.65,
    (mapHeight(park) - 1) * 2.5,
    mapWidth(park) * 5,
    1,
    mapHeight(park) * 5,
  );
  for (const type of ["path", "queue", "exit", "water"] as const) {
    const cells = park.tiles.flatMap((row, y) =>
        row.flatMap((t, x) => (t === type ? [{ x, y }] : [])),
      ),
      m = new THREE.InstancedMesh(
        cube,
        mat(
          type === "path"
            ? "#ffffff"
            : type === "queue"
              ? "#79aadd"
              : type === "exit"
                ? "#db8b81"
                : "#499fb7",
        ),
        cells.length,
      ),
      matrix = new THREE.Matrix4();
    cells.forEach((p, i) => {
      matrix.makeScale(4.96, 0.12, 4.96);
      matrix.setPosition(p.x * 5, 0, p.y * 5);
      m.setMatrixAt(i, matrix);
      if (type === "path")
        m.setColorAt(i, new THREE.Color(PATH_STYLES[pathStyleAt(park, p.x, p.y)].color));
    });
    scene.add(m);
  }
  const updatePark = populatePark(scene, park, exclude, mesh, mat, cube, cylinder, cone),
    weather = createWeatherScene(scene, park, { ambient, sun }),
    birds = createBirdScene(scene, park),
    update = (time: number) => {
      updatePark(time);
      weather.update(park.time + Math.max(0, time));
      birds.update(park.time + Math.max(0, time));
    };
  update(0);
  return {
    scene,
    update,
    dispose: () => {
      weather.dispose();
      birds.dispose();
      const geometries = new Set<THREE.BufferGeometry>(),
        mats = new Set<THREE.Material>();
      scene.traverse((o) => {
        if (o instanceof THREE.InstancedMesh) o.dispose();
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          geometries.add(o.geometry);
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m));
        }
      });
      geometries.forEach((g) => g.dispose());
      mats.forEach((m) => {
        if (m instanceof THREE.MeshStandardMaterial) m.map?.dispose();
        m.dispose();
      });
    },
  };
}

import * as THREE from "three";
import { COASTER_TYPES, type Building, type Park } from "./simulation";
import { makeRidePath } from "./ride-path";
import { TRACK_HALF_GAUGE, TRACK_TIE_SPACING } from "./track-canvas";
import { trackSupportClear } from "./track-support";

type Path = ReturnType<typeof makeRidePath>;
type Frame = ReturnType<Path["at"]>;
type Coaster = Pick<Building, "id" | "track">;
export const COASTER_GAUGE_METRES = TRACK_HALF_GAUGE * 10;
export const COASTER_SLEEPER_METRES = TRACK_TIE_SPACING * 5;

/** Shared physical structure in park cameras and on-ride views. Every support
 * reserves the same pedestrian clearance as the 2D park renderer.
 */
export function addCoasterStructure(
  scene: THREE.Scene,
  park: Pick<Park, "tiles">,
  building: Coaster,
  path: Path = makeRidePath(building.track!),
) {
  const root = new THREE.Group();
  root.name = `coaster-structure-${building.id}`;
  const style = building.track?.[0]?.style ?? "steel",
    wood = style === "wood",
    color = COASTER_TYPES[style].color,
    railColor = wood ? "#d9d4b8" : color,
    beamColor = wood ? "#a77a45" : "#426e70",
    tieColor = wood ? "#bd8a50" : "#6d8d88",
    cube = new THREE.BoxGeometry(1, 1, 1),
    materials = new Map<string, THREE.MeshStandardMaterial>(),
    batches = new Map<
      string,
      { geometry: THREE.BufferGeometry; color: string; matrices: THREE.Matrix4[] }
    >(),
    up = new THREE.Vector3(0, 1, 0),
    unit = new THREE.Quaternion();
  let cylinder: THREE.CylinderGeometry | undefined;
  const material = (color: string) => {
    if (!materials.has(color))
      materials.set(
        color,
        new THREE.MeshStandardMaterial({
          color,
          roughness: wood ? 0.86 : 0.55,
          metalness: wood ? 0.03 : 0.24,
        }),
      );
    return materials.get(color)!;
  };
  function piece(
    name: string,
    color: string,
    p: THREE.Vector3,
    size: THREE.Vector3,
    rotation = unit,
    round = false,
  ) {
    const key = `${name}:${color}`,
      batch = batches.get(key) ?? {
      geometry: round ? (cylinder ??= new THREE.CylinderGeometry(1, 1, 1, 8)) : cube,
        color,
        matrices: [],
      };
    batch.matrices.push(new THREE.Matrix4().compose(p, rotation, size));
    batches.set(key, batch);
  }
  function member(
    name: string,
    color: string,
    a: THREE.Vector3,
    b: THREE.Vector3,
    width: number,
    round = false,
  ) {
    const delta = b.clone().sub(a),
      length = delta.length();
    if (length < 1e-6) return;
    piece(
      name,
      color,
      a.clone().add(b).multiplyScalar(0.5),
      new THREE.Vector3(width, length, width),
      new THREE.Quaternion().setFromUnitVectors(up, delta.normalize()),
      round,
    );
  }
  const point = (f: Frame, side: number, height = 0) =>
    f.position.clone().addScaledVector(f.right, side).addScaledVector(f.up, height);

  for (const side of [-COASTER_GAUGE_METRES / 2, COASTER_GAUGE_METRES / 2]) {
    const curve = new THREE.CatmullRomCurve3(
      path.points.slice(0, -1).map((p, i) => p.clone().addScaledVector(path.rights[i], side)),
      true,
      "centripetal",
    );
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.min(1600, path.count), wood ? 0.075 : 0.11, 6, true),
      material(railColor),
    );
    rail.name = `running-rail-${side < 0 ? "left" : "right"}`;
    root.add(rail);
  }
  const tieDistances: number[] = [];
  for (let d = COASTER_SLEEPER_METRES / 2; d < path.length; d += COASTER_SLEEPER_METRES) {
    const f = path.at(d / path.length);
    piece(
      "sleepers",
      tieColor,
      point(f, 0, -0.075),
      new THREE.Vector3(2.05, 0.15, 0.24),
      f.quaternion,
    );
    tieDistances.push(d);
    for (const side of [-0.75, 0.75]) {
      piece(
        "rail-clamps",
        wood ? "#665545" : "#adc2b7",
        point(f, side, -0.015),
        new THREE.Vector3(0.28, 0.1, 0.21),
        f.quaternion,
      );
      if (wood)
        piece(
          "timber-stringers",
          beamColor,
          point(f, side, -0.23),
          new THREE.Vector3(0.22, 0.25, COASTER_SLEEPER_METRES + 0.08),
          f.quaternion,
        );
    }
    if (!wood)
      piece(
        "steel-spine",
        "#2b4b50",
        point(f, 0, -0.35),
        new THREE.Vector3(0.26, 0.36, COASTER_SLEEPER_METRES + 0.08),
        f.quaternion,
      );
  }

  const supportSpacing = (wood ? 1.05 : 1.55) * 5,
    supports: { distance: number; x: number; z: number; upright: number }[] = [];
  for (let d = supportSpacing / 2; d < path.length; d += supportSpacing) {
    const f = path.at(d / path.length);
    // +1.1 m is the path's rail datum. Match the Canvas minimum clearance.
    if (
      f.position.y < 2.2 ||
      f.up.y < 0.3 ||
      !trackSupportClear(park, f.position.x / 5, f.position.z / 5)
    )
      continue;
    const horizontal = f.right.clone().setY(0).normalize();
    if (horizontal.lengthSq() < 0.5) continue;
    const tops = [-1, 1].map((side) => point(f, side * 0.92, -0.38)),
      feet = [-1, 1].map((side) =>
        f.position
          .clone()
          .addScaledVector(horizontal, side * 1.15)
          .setY(0.27),
      );
    supports.push({ distance: d, x: f.position.x / 5, z: f.position.z / 5, upright: f.up.y });
    member(
      wood ? "wood-crosshead" : "steel-crosshead",
      beamColor,
      tops[0],
      tops[1],
      wood ? 0.23 : 0.19,
    );
    for (let side = 0; side < 2; side++) {
      member(
        wood ? "wood-posts" : "steel-columns",
        beamColor,
        feet[side],
        tops[side],
        wood ? 0.22 : 0.16,
        !wood,
      );
      piece(
        "concrete-foundations",
        "#c4bfac",
        feet[side].clone().setY(0.12),
        new THREE.Vector3(0.78, 0.24, 0.78),
      );
      piece("base-plates", "#526b65", feet[side], new THREE.Vector3(0.44, 0.08, 0.44));
      for (const offset of [-0.16, 0.16])
        piece(
          "anchor-bolts",
          "#d5d8c3",
          feet[side].clone().add(new THREE.Vector3(offset, 0.065, offset)),
          new THREE.Vector3(0.035, 0.075, 0.035),
          unit,
          true,
        );
      // A mounting saddle connects the crosshead to the rail-bearing sleeper.
      member(
        "rail-saddles",
        wood ? "#765032" : "#adc2b7",
        tops[side],
        point(f, (side ? 1 : -1) * 0.75, -0.09),
        0.13,
      );
    }
    if (wood) {
      const bays = Math.max(1, Math.ceil((f.position.y - 0.7) / 3));
      for (let bay = 0; bay < bays; bay++) {
        const lower = feet.map((p, side) => p.clone().lerp(tops[side], bay / bays)),
          upper = feet.map((p, side) => p.clone().lerp(tops[side], (bay + 1) / bays));
        member("wood-crossbraces", "#765032", lower[0], upper[1], 0.12);
        member("wood-crossbraces", "#c39154", lower[1], upper[0], 0.12);
        if (bay) member("wood-bay-ties", beamColor, lower[0], lower[1], 0.15);
      }
    }
  }

  const station = path.at(0),
    // Legacy starts can immediately slope or turn. Passenger decks/canopies
    // follow the station heading while staying level under people's feet.
    stationYaw = new THREE.Quaternion().setFromAxisAngle(
      up,
      Math.atan2(-station.tangent.x, -station.tangent.z),
    ),
    stationTransform = new THREE.Matrix4().compose(
      station.position,
      stationYaw,
      new THREE.Vector3(1, 1, 1),
    );
  const platform = (
    name: string,
    color: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    depth: number,
    tilt = 0,
  ) => {
    const rotation = stationYaw
      .clone()
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt));
    piece(
      `station-${name}`,
      color,
      new THREE.Vector3(x, y, z).applyMatrix4(stationTransform),
      new THREE.Vector3(w, h, depth),
      rotation,
    );
  };
  platform("platform", "#d5c596", 2.05, -0.28, 0, 2.1, 0.35, 6.5);
  platform("edge", "#f6e8bb", 1.08, -0.075, 0, 0.12, 0.08, 6.5);
  for (let z = -3; z <= 3; z += 0.5)
    platform("deck-slats", "#b39b6e", 2.05, -0.08, z, 1.95, 0.025, 0.035);
  for (const x of [1.1, 3.05])
    for (const z of [-2.8, 2.8])
      platform("canopy-posts", wood ? "#906536" : "#426e70", x, 1.45, z, 0.15, 3.1, 0.15);
  platform("canopy", wood ? "#6b6842" : color, 1.6, 3.12, 0, 1.3, 0.17, 7, 0.3);
  platform("canopy", wood ? "#807548" : color, 2.99, 3.12, 0, 1.7, 0.17, 7, -0.24);
  platform("ridge", "#e9d8a4", 2.22, 3.35, 0, 0.14, 0.12, 7.04);
  platform("sign", "#eee2bc", 2.07, 2.56, -2.88, 1.7, 0.45, 0.09);
  platform("sign-inset", wood ? "#8c683a" : "#426e70", 2.07, 2.56, -2.941, 1.36, 0.19, 0.04);
  for (const z of [-2.9, -1.5, 1.5, 2.9])
    platform("railing-posts", "#78928a", 3.02, 0.45, z, 0.075, 1.1, 0.075);
  for (const z of [-2.2, 2.2])
    for (const y of [0.35, 0.89]) platform("railing", "#bfd0b5", 3.02, y, z, 0.07, 0.07, 1.6);

  for (const [name, batch] of batches) {
    const mesh = new THREE.InstancedMesh(
      batch.geometry,
      material(batch.color),
      batch.matrices.length,
    );
    mesh.name = name.split(":")[0];
    batch.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.computeBoundingSphere();
    root.add(mesh);
  }
  root.userData.gaugeMetres = COASTER_GAUGE_METRES;
  root.userData.tieDistances = tieDistances;
  root.userData.supports = supports;
  root.userData.style = style;
  root.userData.stationFrame = stationTransform.toArray();
  scene.add(root);
  return root;
}

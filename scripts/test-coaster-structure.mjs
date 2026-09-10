import assert from "node:assert/strict";
import * as THREE from "three";
import { moduleURL } from "./ts-loader.mjs";
const C = await import(moduleURL("game/coaster-structure.ts")),
  T = await import(moduleURL("game/track-canvas.ts")),
  R = await import(moduleURL("game/ride-path.ts")),
  Support = await import(moduleURL("game/track-support.ts")),
  World = await import(moduleURL("game/scene-world.ts")),
  S = await import(moduleURL("game/simulation.ts"));
let passed = 0;
const test = (name, run) => {
  run();
  console.log("PASS", name);
  passed++;
};
const near = (a, b) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const park = () => ({ tiles: Array.from({ length: 25 }, () => Array(25).fill("grass")) });
const track = (style = "steel") =>
  Array.from({ length: 81 }, (_, i) => {
    const a = (i / 80) * Math.PI * 2;
    return {
      x: 10 + Math.cos(a) * 5,
      y: 10 + Math.sin(a) * 4,
      z: 1.5 + Math.sin(a) * 0.6,
      style,
      smooth: true,
    };
  });
const building = (style = "steel") => ({ id: 701, track: track(style) });
const dispose = (root) => {
  const geometries = new Set(),
    materials = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      geometries.add(o.geometry);
      materials.add(o.material);
      if (o.isInstancedMesh) o.dispose();
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
};

test("3D rails and sleepers use exactly the Canvas gauge and global spacing", () => {
  const b = building(),
    path = R.makeRidePath(b.track),
    scene = new THREE.Scene(),
    root = C.addCoasterStructure(scene, park(), b, path);
  try {
    near(C.COASTER_GAUGE_METRES, T.TRACK_HALF_GAUGE * 10);
    near(C.COASTER_SLEEPER_METRES, T.TRACK_TIE_SPACING * 5);
    const left = root.getObjectByName("running-rail-left").geometry.parameters.path.points,
      right = root.getObjectByName("running-rail-right").geometry.parameters.path.points;
    assert.equal(left.length, path.points.length - 1);
    for (let i = 0; i < left.length; i++) {
      near(left[i].distanceTo(right[i]), 1.5);
      assert(left[i].clone().add(right[i]).multiplyScalar(0.5).distanceTo(path.points[i]) < 1e-7);
    }
    const distances = root.userData.tieDistances;
    near(distances[0], 0.6);
    for (let i = 1; i < distances.length; i++) near(distances[i] - distances[i - 1], 1.2);
    assert(root.getObjectByName("rail-clamps").count === distances.length * 2);
  } finally {
    dispose(root);
  }
});

test("Wood has timber stringers and braced bents; steel has columns, saddles and anchoring", () => {
  for (const style of ["steel", "wood", "launch"]) {
    const b = building(style),
      root = C.addCoasterStructure(new THREE.Scene(), park(), b);
    try {
      assert(root.userData.supports.length > 0);
      assert(root.getObjectByName("concrete-foundations"));
      assert(root.getObjectByName("base-plates"));
      assert(root.getObjectByName("anchor-bolts"));
      if (style === "wood") {
        assert(root.getObjectByName("wood-crossbraces").count > root.userData.supports.length);
        assert(root.getObjectByName("timber-stringers"));
        assert(!root.getObjectByName("steel-columns"));
      } else {
        assert(root.getObjectByName("steel-columns"));
        assert(root.getObjectByName("steel-crosshead"));
        assert(root.getObjectByName("rail-saddles"));
        assert(!root.getObjectByName("wood-crossbraces"));
      }
    } finally {
      dispose(root);
    }
  }
});

test("Supports never occupy visitor paths, queue paths or exits, including their full foundations", () => {
  for (const type of ["path", "queue", "exit"]) {
    const p = park(),
      b = building("wood");
    for (let y = 0; y < p.tiles.length; y++) for (let x = 8; x <= 12; x++) p.tiles[y][x] = type;
    const root = C.addCoasterStructure(new THREE.Scene(), p, b);
    try {
      assert(root.userData.supports.length > 0, "Control grass areas should retain supports");
      for (const support of root.userData.supports)
        assert(Support.trackSupportClear(p, support.x, support.z));
      const allPaths = { tiles: p.tiles.map((row) => row.map(() => type)) },
        empty = C.addCoasterStructure(new THREE.Scene(), allPaths, b);
      assert.equal(empty.userData.supports.length, 0);
      assert(!empty.getObjectByName("wood-posts"));
      dispose(empty);
    } finally {
      dispose(root);
    }
  }
});

test("A real vertical loop keeps inverted overhead rails clear of ground-to-rail poles", () => {
  const loop = Array.from({ length: 161 }, (_, i) => {
      const a = (i / 160) * Math.PI * 2;
      return {
        x: 10 + Math.sin(a) * 3,
        y: 10,
        z: 3 - Math.cos(a) * 3,
        style: "steel",
        smooth: true,
        inversion: true,
      };
    }),
    path = R.makeRidePath(loop),
    root = C.addCoasterStructure(new THREE.Scene(), park(), { id: 2, track: loop }, path);
  try {
    assert(
      path.ups.some((v) => v.y < -0.5),
      "Fixture must actually invert its transported frame",
    );
    assert(root.userData.supports.length > 0);
    for (const support of root.userData.supports) {
      assert(support.upright >= 0.3);
      assert(path.at(support.distance / path.length).up.y >= 0.3);
    }
  } finally {
    dispose(root);
  }
});

test("The station follows the actual start height and heading, and resources stay bounded", () => {
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const b = building("wood");
    b.track = b.track.map((p) => ({
      ...p,
      x: 10 + (p.x - 10) * Math.cos(angle) - (p.y - 10) * Math.sin(angle),
      y: 10 + (p.x - 10) * Math.sin(angle) + (p.y - 10) * Math.cos(angle),
    }));
    const path = R.makeRidePath(b.track),
      root = C.addCoasterStructure(new THREE.Scene(), park(), b, path);
    try {
      const matrix = new THREE.Matrix4().fromArray(root.userData.stationFrame),
        start = new THREE.Vector3().setFromMatrixPosition(matrix);
      assert(start.distanceTo(path.at(0).position) < 1e-8);
      assert(
        new THREE.Vector3(0, 1, 0)
          .transformDirection(matrix)
          .distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-8,
        "Passenger platform must stay level even when a legacy start immediately slopes",
      );
      const platform = root.getObjectByName("station-platform"),
        actual = new THREE.Matrix4();
      platform.getMatrixAt(0, actual);
      const expected = new THREE.Vector3(2.05, -0.28, 0).applyMatrix4(matrix);
      assert(new THREE.Vector3().setFromMatrixPosition(actual).distanceTo(expected) < 1e-5);
      assert(root.children.length < 45, "Use instanced parts, not a mesh per sleeper/bolt");
      root.traverse((o) => {
        if (o.isMesh) {
          assert(o.geometry.attributes.position.array.every(Number.isFinite));
          if (o.isInstancedMesh) assert(o.instanceMatrix.array.every(Number.isFinite));
        }
      });
    } finally {
      dispose(root);
    }
  }
});

test("The populated park and on-ride helper produce the same rails, supports and station", () => {
  const p = S.newPark(),
    b = p.buildings.find((b) => b.kind === "coaster");
  assert(b?.track);
  const world = World.createWorld(p, -1),
    direct = C.addCoasterStructure(new THREE.Scene(), p, b),
    existing = world.scene.getObjectByName(`coaster-structure-${b.id}`);
  try {
    assert(existing);
    assert.deepEqual(existing.userData, direct.userData);
    assert.equal(existing.children.length, direct.children.length);
    existing.children.forEach((mesh, i) => {
      assert.equal(mesh.name, direct.children[i].name);
      if (mesh.isInstancedMesh)
        assert.deepEqual(mesh.instanceMatrix.array, direct.children[i].instanceMatrix.array);
    });
  } finally {
    world.dispose();
    dispose(direct);
  }
});
console.log(`${passed} coaster structure tests passed.`);

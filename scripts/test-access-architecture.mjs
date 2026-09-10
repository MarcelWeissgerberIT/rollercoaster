import assert from "node:assert/strict";
import * as THREE from "three";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  O = await import(moduleURL("game/operations.ts")),
  A = await import(moduleURL("game/ride-access.ts")),
  P = await import(moduleURL("game/pod-model.ts"));
const results = [];
function test(name, fn) {
  try {
    results.push({ name, pass: true, evidence: fn() });
  } catch (e) {
    results.push({ name, pass: false, error: e.message });
  }
  console.log(JSON.stringify(results.at(-1)));
}
function setup(side = 0) {
  const s = S.newPark("sandbox"),
    b = s.buildings.find((b) => b.kind === "wheel");
  assert(b);
  s.guests = [];
  s.buildings = [b];
  b.x = 10;
  b.y = 10;
  b.open = true;
  b.riders = [];
  b.queue = [];
  b.pods = { entry: { side, offset: 0 }, exit: { side: (side + 2) % 4, offset: 0 } };
  Object.assign(O.ensureOperations(b), { staffed: true, phase: "idle", phaseLeft: 0 });
  const scene = new THREE.Scene(),
    update = P.addAccessPods(scene, s);
  return { s, b, scene, update, layout: A.accessLayout(s, b) };
}
const close = (a, b) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const resources = (scene) => {
  const meshes = [],
    geometries = new Set(),
    materials = new Set();
  scene.traverse((o) => {
    if (o.isMesh) {
      meshes.push(o.uuid);
      geometries.add(o.geometry.uuid);
      materials.add(o.material.uuid);
    }
  });
  return { meshes, geometries: [...geometries], materials: [...materials] };
};
function dispose(scene) {
  const g = new Set(),
    m = new Set();
  scene.traverse((o) => {
    if (o.isMesh) {
      g.add(o.geometry);
      m.add(o.material);
    }
  });
  for (const x of [...g, ...m]) x.dispose();
}
function localBounds(mesh, root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mesh),
    inv = root.matrixWorld.clone().invert(),
    points = [];
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z])
        points.push(new THREE.Vector3(x, y, z).applyMatrix4(inv));
  return new THREE.Box3().setFromPoints(points);
}

test("Detailed entrance, exit and glazed cabin follow canonical placement in all four directions", () => {
  let parts = 0;
  for (let side = 0; side < 4; side++) {
    const { s, b, scene, layout } = setup(side),
      snapshot = JSON.stringify(s);
    for (const role of ["entry", "exit"]) {
      const g = scene.getObjectByName(`${role}-pod-${b.id}`),
        p = layout[role];
      assert(g);
      close(g.position.x, p.x * 5);
      close(g.position.z, p.y * 5);
      g.updateMatrixWorld(true);
      const tangent = new THREE.Vector3(1, 0, 0).applyQuaternion(g.quaternion);
      close(tangent.x, p.tx);
      close(tangent.z, p.ty);
      for (const name of [
        "gateway-post--1",
        "canopy-roof",
        "gate-hinge",
        "gate-status-light",
        "ground-arrow-stem",
      ])
        assert(g.getObjectByName(name), name);
      if (role === "entry")
        for (const name of ["ticket-booth-body", "ticket-reader", "reader-screen", "ticket-slot"])
          assert(g.getObjectByName(name), name);
      else assert(g.getObjectByName("exit-direction-sign"));
    }
    const cabin = scene.getObjectByName(`control-cabin-${b.id}`);
    assert(cabin);
    close(cabin.position.x, layout.cabin.x * 5);
    close(cabin.position.z, layout.cabin.y * 5);
    assert(cabin.userData.cutawayRoof);
    assert(cabin.getObjectByName("control-console-top"));
    assert(cabin.getObjectByName("control-monitor-glass"));
    const glazing = cabin.children.filter(
      (x) => x.name.startsWith("cabin-") && x.name.includes("glass"),
    );
    assert.equal(glazing.length, 5);
    for (const glass of glazing) {
      assert(glass.material.transparent);
      assert(glass.material.opacity > 0.1 && glass.material.opacity < 0.5);
      assert.equal(glass.material.depthWrite, false);
    }
    scene.traverse((o) => {
      assert(o.position.toArray().every(Number.isFinite));
      if (o.isMesh) {
        parts++;
        assert(o.geometry.attributes.position.array.every(Number.isFinite));
        assert(o.scale.toArray().every((x) => Number.isFinite(x) && x > 0));
      }
    });
    assert.equal(JSON.stringify(s), snapshot);
    dispose(scene);
  }
  return { meshPartsAcrossFourOrientations: parts };
});
test("An open gate leaves a real human-width passage under the canopy", () => {
  for (let side = 0; side < 4; side++)
    for (const role of ["entry", "exit"]) {
      const { s, b, scene, update } = setup(side),
        o = O.ensureOperations(b);
      Object.assign(o, { phase: role === "entry" ? "boarding" : "unloading", phaseLeft: 0.1 });
      update(s);
      const root = scene.getObjectByName(`${role}-pod-${b.id}`),
        clear = new THREE.Box3(
          new THREE.Vector3(-0.9, 0.3, -1.35),
          new THREE.Vector3(0.9, 1.85, 0.4),
        );
      assert(root.userData.gateOpen > 0.99);
      root.traverse((m) => {
        if (!m.isMesh) return;
        const bounds = localBounds(m, root);
        assert(!bounds.intersectsBox(clear), `${role} passage blocked by ${m.name}`);
      });
      dispose(scene);
    }
});
test("Driver has a reachable console and remains visible through the open roof", () => {
  const { b, scene, layout } = setup(),
    cabin = scene.getObjectByName(`control-cabin-${b.id}`);
  scene.updateMatrixWorld(true);
  const driver = new THREE.Vector3(layout.posts.control.x * 5, 1.7, layout.posts.control.y * 5),
    ray = new THREE.Raycaster(driver, new THREE.Vector3(0, 1, 0), 0, 5),
    hits = ray.intersectObject(cabin, true).filter((h) => !h.object.material.transparent);
  assert.equal(hits.length, 0, `Roof hides driver: ${hits.map((h) => h.object.name).join(",")}`);
  const console = cabin
    .getObjectByName("control-console-top")
    .getWorldPosition(new THREE.Vector3());
  assert(Math.hypot(console.x - driver.x, console.z - driver.z) < 0.65);
  close(console.y, 0.95);
  const floor = localBounds(cabin.getObjectByName("cabin-foundation"), cabin);
  close(localBounds(cabin.getObjectByName("cabin-floor"), cabin).max.y, 0.06);
  assert(
    floor.max.x - floor.min.x < 3.1 && floor.max.z - floor.min.z < 3.1,
    "Cabin exceeds one tile",
  );
  dispose(scene);
});
test("The canonical entrance attendant stands in front of the ticket booth without clipping its walls", () => {
  for (let side = 0; side < 4; side++) {
    const { b, scene, layout } = setup(side),
      root = scene.getObjectByName(`entry-pod-${b.id}`);
    root.updateMatrixWorld(true);
    const p = root.worldToLocal(
      new THREE.Vector3(layout.posts.entry.x * 5, 0, layout.posts.entry.y * 5),
    );
    const body = new THREE.Box3(
        new THREE.Vector3(p.x - 0.23, 0.55, p.z - 0.23),
        new THREE.Vector3(p.x + 0.23, 1.4, p.z + 0.23),
      ),
      head = new THREE.Box3(
        new THREE.Vector3(p.x - 0.16, 1.4, p.z - 0.16),
        new THREE.Vector3(p.x + 0.16, 1.85, p.z + 0.16),
      );
    root.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const bounds = localBounds(mesh, root);
      assert(
        !bounds.intersectsBox(body) && !bounds.intersectsBox(head),
        `Entry attendant intersects ${mesh.name}`,
      );
    });
    dispose(scene);
  }
});
test("Animated gate angles come from current operation/guest state and freeze with unchanged paused state", () => {
  const { s, b, scene, update, layout } = setup(),
    entry = scene.getObjectByName(`entry-pod-${b.id}`),
    exit = scene.getObjectByName(`exit-pod-${b.id}`),
    o = O.ensureOperations(b);
  close(entry.getObjectByName("gate-hinge").rotation.y, 0);
  Object.assign(o, { phase: "boarding", phaseLeft: 1.8 });
  update();
  const partial = entry.getObjectByName("gate-hinge").rotation.y;
  assert(partial < 0 && partial > -Math.PI / 2);
  Object.assign(o, { phase: "boarding", phaseLeft: 0.5 });
  update();
  close(entry.getObjectByName("gate-hinge").rotation.y, -Math.PI / 2);
  Object.assign(o, { phase: "checking", phaseLeft: 0.75 });
  update();
  close(entry.getObjectByName("gate-hinge").rotation.y, -Math.PI / 4);
  s.speed = 0;
  const snapshot = JSON.stringify(s),
    held = entry.getObjectByName("gate-hinge").rotation.y;
  for (let i = 0; i < 100; i++) update(s);
  close(entry.getObjectByName("gate-hinge").rotation.y, held);
  assert.equal(JSON.stringify(s), snapshot);
  Object.assign(o, { phase: "idle", phaseLeft: 0 });
  s.guests = [
    {
      id: 99,
      x: layout.exit.port.x,
      y: layout.exit.port.y,
      state: "walk",
      target: null,
      visited: [b.id],
    },
  ];
  update();
  close(exit.getObjectByName("gate-hinge").rotation.y, Math.PI / 2);
  s.guests = [];
  update();
  close(exit.getObjectByName("gate-hinge").rotation.y, 0);
  dispose(scene);
});
test("Repeated gate motion reuses geometry/materials/meshes and accepts a cloned live park", () => {
  const { s, b, scene, update } = setup(),
    before = resources(scene),
    copy = structuredClone(s),
    o = O.ensureOperations(copy.buildings[0]);
  for (let i = 0; i < 300; i++) {
    o.phase = i % 2 ? "boarding" : "unloading";
    o.phaseLeft = (i % 10) * 0.09;
    update(copy);
  }
  assert.deepEqual(resources(scene), before);
  assert.equal(
    O.operationsOf(b).phase,
    "idle",
    "Updater mutated source instead of reading copied phase",
  );
  copy.buildings = [];
  update(copy);
  assert(scene.children.every((g) => g.visible === false));
  dispose(scene);
  return {
    meshes: before.meshes.length,
    geometries: before.geometries.length,
    materials: before.materials.length,
  };
});
test("A park without access pods adds no phantom architecture", () => {
  const s = S.newPark("sandbox");
  s.buildings = [];
  const scene = new THREE.Scene(),
    update = P.addAccessPods(scene, s);
  assert.equal(typeof update, "function");
  update(s);
  assert.equal(scene.children.length, 0);
});
test("Transport stations have usable gateways without an unstaffed ride-control cabin", () => {
  for (const kind of ["train", "shuttle"]) {
    const { s, b, scene: old } = setup();
    dispose(old);
    b.kind = kind;
    delete b.operations;
    b.pods = { entry: { side: 0, offset: 0 }, exit: { side: 2, offset: 0 } };
    const scene = new THREE.Scene(),
      update = P.addAccessPods(scene, s);
    assert.equal(scene.getObjectByName(`control-cabin-${b.id}`), undefined);
    assert.equal(scene.children.length, 2);
    for (const role of ["entry", "exit"])
      assert.equal(
        scene.getObjectByName(`${role}-pod-${b.id}`).userData.gateOpen,
        1,
        `${kind} ${role} closed despite an open station`,
      );
    b.open = false;
    update(s);
    assert.equal(scene.getObjectByName(`entry-pod-${b.id}`).userData.gateOpen, 0);
    dispose(scene);
  }
});
console.log(`${results.filter((x) => x.pass).length}/${results.length} passed`);
process.exitCode = results.some((x) => !x.pass) ? 1 : 0;

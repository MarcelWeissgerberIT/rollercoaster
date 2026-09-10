import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts"));
const C = await import(moduleURL("game/construction.ts"));
const T = await import(moduleURL("game/transit.ts"));
const P = await import(moduleURL("game/pods.ts"));
const failures = [];
let passes = 0;
function test(name, fn) {
  try {
    fn();
    passes++;
    console.log("PASS", name);
  } catch (e) {
    failures.push({ name, error: e.message });
    console.log("FAIL", name, e.message);
  }
}
const clone = (x) => structuredClone(x);
function empty() {
  const s = S.newPark("sandbox");
  const template = clone(s.guests[0]);
  s.buildings = [];
  s.guests = [];
  s.transitLines = [];
  s.tiles = s.tiles.map((r) => r.map(() => "grass"));
  s.open = false;
  s.cash = 100000;
  for (let y = 20; y < 30; y++) s.tiles[y][15] = "path";
  for (let x = 3; x <= 26; x++) s.tiles[20][x] = "path";
  return { s, template };
}
function add(s, kind, x, y) {
  const r = S.build(s, kind, x, y);
  assert.equal(r.error, undefined);
  const b = s.buildings.find((b) => b.id === r.id);
  b.open = true;
  b.tested = true;
  return b;
}
function transit() {
  const { s, template } = empty(),
    a = add(s, "train", 5, 19),
    b = add(s, "train", 25, 19);
  a.pods = { entry: { side: 1, offset: 0 }, exit: { side: 3, offset: 0 } };
  b.pods = clone(a.pods);
  assert.equal(T.createTransitLine(s, a, b), null);
  const l = s.transitLines[0];
  const g = {
    ...template,
    id: s.nextId++,
    state: "ride",
    target: null,
    route: [],
    timer: 0,
    x: 5,
    y: 20,
    transit: { line: l.id, from: a.id, to: b.id, fare: 3 },
  };
  s.guests = [g];
  l.passengers = [g.id];
  l.position = 5;
  l.direction = 1;
  l.wait = 0;
  s.tiles[19][6] = "path";
  assert(S.validSave(clone(s)));
  return { s, a, b, l, g };
}

const THREE = await import("three");
const W = await import(moduleURL("game/scene-world.ts"));
test("Station relocation while paused keeps waiting guests save-valid immediately", () => {
  const { s, a, l, g } = transit();
  const waiting = {
    ...clone(g),
    id: s.nextId++,
    state: "queue",
    target: null,
    x: 5,
    y: 20,
    route: [],
  };
  s.guests.push(waiting);
  a.queue = [waiting.id];
  s.speed = 0;
  assert(S.validSave(clone(s)));
  assert.equal(C.adjustBuilding(s, a, "move", { x: 5, y: 17 }, 0), null);
  assert(
    S.validSave(clone(s)),
    "moving stop clears its queue but leaves guest.state=queue and guest.transit",
  );
  S.tick(s, 0.1);
  assert(S.validSave(clone(s)));
});
test("Relocation never commits a pod port which direct placement rejects as occupied", () => {
  const { s } = empty(),
    b = add(s, "wheel", 10, 10);
  b.pods = { entry: { side: 0, offset: 0 }, exit: { side: 1, offset: 0 } };
  add(s, "burger", 21, 10);
  const plan = C.planRelocation(s, b, { x: 18, y: 10 }, 0);
  if (plan.error) return;
  assert.equal(C.adjustBuilding(s, b, "move", { x: 18, y: 10 }, 0), null);
  assert.equal(
    C.planPod(s, b, "entry", b.pods.entry).error,
    null,
    "move accepted entry port underneath burger building",
  );
});
test("Pod direct placement rejects water and another building without mutation", () => {
  const { s } = empty(),
    b = add(s, "wheel", 10, 10);
  b.pods = { entry: { side: 1, offset: 0 }, exit: { side: 2, offset: 0 } };
  s.tiles[10][13] = "water";
  const old = clone(b);
  assert(C.setAccessPod(s, b, "entry", { side: 0, offset: 0 }));
  assert.deepEqual(b, old);
  s.tiles[10][13] = "grass";
  add(s, "burger", 13, 10);
  assert(C.setAccessPod(s, b, "entry", { side: 0, offset: 0 }));
  assert.deepEqual(b, old);
});
test("Pod placement removes approved decoration atomically and Undo restores it", () => {
  const { s } = empty(),
    b = add(s, "wheel", 10, 10);
  b.pods = { entry: { side: 1, offset: 0 }, exit: { side: 2, offset: 0 } };
  const deco = add(s, "tree", 13, 10),
    cash = s.cash,
    old = clone(b.pods);
  const rec = C.recordEdit(s, "pod plus clear", () =>
    assert.equal(C.setAccessPod(s, b, "entry", { side: 0, offset: 0 }, true), null),
  );
  assert(rec);
  assert.equal(s.cash, cash - 10);
  assert(!s.buildings.some((x) => x.id === deco.id));
  C.undoEdits(s, [rec]);
  assert.deepEqual(b.pods, old);
  assert.equal(s.cash, cash);
  assert(s.buildings.some((x) => x.id === deco.id));
  assert(S.validSave(clone(s)));
});
test("Migration at each map corner creates distinct in-bounds pods and valid saves", () => {
  for (const [kind, n] of [
    ["train", 1],
    ["carousel", 2],
    ["wheel", 3],
  ])
    for (const [x, y] of [
      [0, 0],
      [30 - n, 0],
      [0, 30 - n],
      [30 - n, 30 - n],
    ]) {
      const { s } = empty();
      s.tiles = s.tiles.map((r) => r.map(() => "grass"));
      const b = add(s, kind, x, y);
      S.migratePark(s);
      assert(P.validPods(b.pods, n));
      assert(S.validSave(clone(s)), kind + " " + x + "," + y);
      const first = clone(b.pods);
      S.migratePark(s);
      assert.deepEqual(b.pods, first);
    }
});
test("3D pod positions and outward orientation match all four logical sides", () => {
  for (let side = 0; side < 4; side++) {
    const { s } = empty(),
      b = add(s, "wheel", 10, 10);
    b.pods = { entry: { side, offset: 1 }, exit: { side: (side + 2) % 4, offset: 1 } };
    const world = W.createWorld(s);
    world.scene.updateMatrixWorld(true);
    for (const role of ["entry", "exit"]) {
      const pod = b.pods[role],
        g = world.scene.getObjectByName(role + "-pod-" + b.id),
        dir = [
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
        ][pod.side];
      assert(g);
      const expected =
        pod.side === 0
          ? [12.32, 11]
          : pod.side === 1
            ? [11, 12.32]
            : pod.side === 2
              ? [9.68, 11]
              : [11, 9.68];
      assert(g.position.distanceTo(new THREE.Vector3(expected[0] * 5, 0, expected[1] * 5)) < 1e-8);
      // Check the actual public-path approach mat, independent of the model's
      // internal choice of +Z/-Z. It must extend outward from the gate plane.
      const mat = g.getObjectByName("passage-mat");
      assert(mat, "Access architecture provides a visible public-path approach");
      const forward = mat
        .getWorldPosition(new THREE.Vector3())
        .sub(g.getWorldPosition(new THREE.Vector3()));
      forward.y = 0;
      forward.normalize();
      assert(forward.distanceTo(new THREE.Vector3(dir[0], 0, dir[1])) < 1e-8);
    }
    world.dispose();
  }
});
test("Selected attraction still has exactly its two 3D pods", () => {
  const { s } = empty(),
    b = add(s, "wheel", 10, 10);
  b.pods = { entry: { side: 1, offset: 0 }, exit: { side: 2, offset: 1 } };
  const world = W.createWorld(s, b.id),
    pods = [];
  world.scene.traverse((o) => {
    if (o.name === "entry-pod-" + b.id || o.name === "exit-pod-" + b.id) pods.push(o);
  });
  assert.equal(pods.length, 2);
  world.dispose();
});
test("3D pod geometries and shared materials are disposed exactly once", () => {
  const { s } = empty(),
    b = add(s, "wheel", 10, 10);
  b.pods = { entry: { side: 1, offset: 0 }, exit: { side: 2, offset: 1 } };
  const world = W.createWorld(s),
    resources = new Set();
  for (const role of ["entry", "exit"])
    world.scene.getObjectByName(role + "-pod-" + b.id).traverse((o) => {
      if (o.isMesh) {
        resources.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) resources.add(m);
      }
    });
  assert(resources.size > 2);
  const counts = new Map([...resources].map((r) => [r, 0]));
  for (const r of resources) r.addEventListener("dispose", () => counts.set(r, counts.get(r) + 1));
  world.dispose();
  for (const n of counts.values()) assert.equal(n, 1);
});
console.log(JSON.stringify({ passes, failures }, null, 2));
process.exitCode = failures.length ? 1 : 0;

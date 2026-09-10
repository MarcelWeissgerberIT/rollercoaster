import assert from "node:assert/strict";
import * as THREE from "three";
import { moduleURL } from "./ts-loader.mjs";
process.on("uncaughtException", (error) => {
  console.error(error.message);
  process.exit(1);
});
const S = await import(moduleURL("game/simulation.ts")),
  V = await import(moduleURL("game/souvenirs.ts")),
  M = await import(moduleURL("game/souvenir-model.ts")),
  G = await import(moduleURL("game/guest-model.ts")),
  W = await import(moduleURL("game/guest-walk.ts")),
  C = await import(moduleURL("game/souvenir-canvas.ts"));
let passed = 0;
function test(name, fn) {
  fn();
  console.log("PASS", name);
  passed++;
}
function fixture() {
  const park = S.newPark("sandbox");
  park.guests = [];
  park.buildings = [];
  park.tiles = Array.from({ length: 12 }, () => Array(12).fill("grass"));
  for (let x = 2; x < 10; x++) park.tiles[6][x] = "path";
  for (let y = 2; y < 7; y++) park.tiles[y][8] = "path";
  return park;
}
function guest(id = 20, member = 0, souvenir = "balloon") {
  return {
    id,
    x: 5,
    y: 6,
    skin: id % 3,
    state: "walk",
    route: [
      { x: 6, y: 6 },
      { x: 7, y: 6 },
      { x: 8, y: 6 },
      { x: 8, y: 5 },
    ],
    timer: 0,
    target: null,
    souvenir,
    ageGroup: member > 1 ? "child" : "adult",
    wallet: 75,
    hunger: 22,
    thirst: 20,
    happiness: 85,
    party: { id: 20, kind: "family", member, size: 4 },
  };
}
function dispose(root) {
  const geometries = new Set(),
    materials = new Set();
  root.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    if (o.material)
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => materials.add(m));
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}
function matrices(root) {
  root.updateMatrixWorld(true);
  const list = [];
  root.traverse((o) => list.push(...o.matrixWorld.elements));
  return list;
}

test("Stable old-save assortment contains four balloon shapes, eight colors and varied teddy trims", () => {
  const shapes = new Set(),
    colors = new Set(),
    furs = new Set(),
    trims = new Set(),
    random = Math.random;
  Math.random = () => {
    throw Error("Visual assortment must not consume simulation randomness");
  };
  try {
    for (let id = 1; id <= 96; id++) {
      const g = Object.freeze({ id, souvenir: "balloon" }),
        style = V.souvenirStyle(g);
      assert.deepEqual(style, V.souvenirStyle(JSON.parse(JSON.stringify(g))));
      shapes.add(style.shape);
      colors.add(style.color);
      const teddy = V.souvenirStyle({ id, souvenir: "plush" });
      furs.add(teddy.color);
      trims.add(teddy.trim);
    }
  } finally {
    Math.random = random;
  }
  assert.equal(shapes.size, 4);
  assert.equal(colors.size, 8);
  assert.equal(furs.size, 6);
  assert.equal(trims.size, 2);
  assert.equal(V.souvenirStyle({ id: 1 }), null);
});

test("Foil balloons have actual volume, reflective materials and deforming anchored strings", () => {
  for (let id = 1; id <= 4; id++) {
    const rig = M.createSouvenirModel(guest(id));
    rig.update(2.7);
    const first = matrices(rig.root),
      tether = rig.root.getObjectByName("held-balloon-string"),
      oldString = tether.geometry.attributes.position.array.slice();
    assert(first.every(Number.isFinite));
    assert(
      [...oldString.slice(0, 3)].every((v) => v === 0),
      "String detached from hand",
    );
    let volume = false,
      foil = false;
    rig.root.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox;
      if (b.max.x - b.min.x > 0.1 && b.max.z - b.min.z > 0.07) volume = true;
      if (o.material.metalness >= 0.6) foil = true;
    });
    assert(volume, "Balloon is a billboard instead of a 3D object");
    if (id % 4) assert(foil);
    rig.update(2.7);
    assert.deepEqual(matrices(rig.root), first, "Paused balloon moved");
    assert.deepEqual(tether.geometry.attributes.position.array, oldString);
    rig.update(3.7);
    assert.notDeepEqual(tether.geometry.attributes.position.array, oldString);
    assert([...tether.geometry.attributes.position.array.slice(0, 3)].every((v) => v === 0));
    dispose(rig.root);
  }
});

test("Teddy fur, ears, muzzle, paws and scarf/bow are meshes with matching shared colors", () => {
  for (let id = 1; id <= 6; id++) {
    const g = guest(id, 0, "plush"),
      rig = M.createSouvenirModel(g),
      style = V.souvenirStyle(g),
      colors = new Set();
    let meshes = 0;
    rig.root.traverse((o) => {
      if (o.isMesh) {
        meshes++;
        colors.add(`#${o.material.color.getHexString()}`);
      }
    });
    assert(meshes >= 17);
    assert(colors.has(style.color));
    assert(colors.has(style.accent));
    assert(rig.root.getObjectByName(`teddy-${style.trim}`));
    const before = matrices(rig.root);
    rig.update(9);
    assert.deepEqual(matrices(rig.root), before, "Toy should follow the hand, not move by itself");
    dispose(rig.root);
  }
});

test("Adult and child souvenir roots follow the actual articulated hand and hide in seats", () => {
  const guests = [guest(21), guest(22, 2, "plush")],
    crowd = G.createCrowd(guests);
  for (let i = 0; i < guests.length; i++) {
    const g = guests[i],
      item = crowd.mesh.getObjectByName(`souvenir-${g.souvenir}-${g.id}`),
      phase = 1.1 + i,
      parts = G.personParts(g, false, phase, true),
      grip = parts.find((p) => p.grip);
    crowd.pose(i, 10, 20, 0.4, phase, true, false, 0, 5);
    const base = new THREE.Matrix4().compose(
        new THREE.Vector3(10, Math.abs(Math.sin(phase)) * 0.025, 20),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.4),
        new THREE.Vector3(1, 1, 1),
      ),
      hand = new THREE.Vector3(...grip.p).applyMatrix4(base);
    assert(item.visible);
    assert(item.position.distanceTo(hand) < 1e-8);
    const previous = matrices(item);
    crowd.pose(i, 10, 20, 0.4, phase, true, false, 0, 5);
    assert.deepEqual(matrices(item), previous);
    crowd.pose(i, 10, 20, 0.4, phase, false, true);
    assert.equal(item.visible, false);
    crowd.pose(i, 10, 20, 0.4, phase + 0.6, true, false, 0, 5.6);
    assert(item.visible);
    assert.notDeepEqual(matrices(item), previous);
  }
  assert.equal(
    G.personParts(guests[0], false).length,
    G.personParts({ ...guests[0], souvenir: undefined }, false).length,
  );
  dispose(crowd.mesh);
});

test("Canvas uses the same styles, foil gradients and a hand-anchored flexible string", () => {
  for (const souvenir of ["balloon", "plush"])
    for (let id = 1; id <= 4; id++) {
      const calls = [],
        gradient = { addColorStop: (...args) => calls.push(["color", ...args]) },
        ctx = new Proxy(
          {},
          {
            get: (_t, key) =>
              key === "createLinearGradient"
                ? () => gradient
                : (...args) => calls.push([key, ...args]),
            set: (_t, key, value) => {
              calls.push([key, value]);
              return true;
            },
          },
        ),
        g = guest(id, 0, souvenir);
      C.drawHeldSouvenir(ctx, g, 100, 200, 2, 3, "se", 0.5, true);
      assert(calls.some((c) => c.includes(V.souvenirStyle(g).color)));
      if (souvenir === "balloon") assert(calls.some((c) => c[0] === "bezierCurveTo"));
      assert.equal(calls.at(-1)[0], "restore");
    }
});

test("A four-person family walks in two spacious rows without changing its budget or route", () => {
  const park = fixture(),
    family = Array.from({ length: 4 }, (_, i) => guest(20 + i, i));
  park.guests = family;
  const before = JSON.stringify(park),
    positions = family.map((g) => W.guestWalkPosition(park, g));
  for (let a = 0; a < 4; a++)
    for (let b = a + 1; b < 4; b++)
      assert(Math.hypot(positions[a].x - positions[b].x, positions[a].y - positions[b].y) >= 0.45);
  assert.equal(new Set(positions.map((p) => p.x)).size, 2);
  assert.equal(new Set(positions.map((p) => p.y)).size, 2);
  assert.equal(JSON.stringify(park), before);
  assert.deepEqual(
    positions,
    family.map((g) => W.guestWalkPosition(park, g)),
    "Paused formation moved",
  );
  assert.deepEqual(
    positions,
    family.map((g) => W.guestWalkPosition(park, g, { x: g.x, y: g.y }, g.route[0])),
    "Map and 3D use different formation positions",
  );
});

test("Tight turns, one-tile paths and map-edge formations stay on connected walkable ground", () => {
  const park = fixture();
  for (const position of [
    { x: 2, y: 6 },
    { x: 7.45, y: 6 },
    { x: 7.8, y: 6 },
    { x: 8, y: 6 },
    { x: 8, y: 5.5 },
    { x: 8, y: 2 },
  ])
    for (let member = 0; member < 4; member++) {
      const g = { ...guest(20 + member, member), ...position },
        p = W.guestWalkPosition(park, g, position, { x: 8, y: position.x < 8 ? 6 : 2 });
      assert.equal(park.tiles[Math.round(p.y)][Math.round(p.x)], "path");
      for (let t = 0; t <= 1; t += 0.1)
        assert.equal(
          park.tiles[Math.round(g.y + (p.y - g.y) * t)][Math.round(g.x + (p.x - g.x) * t)],
          "path",
          "Formation cuts through grass",
        );
    }
});

test("Queues, observation spots, ride seats and resting places retain their own canonical position", () => {
  const park = fixture();
  for (const state of ["queue", "observe", "ride", "rest"]) {
    const g = { ...guest(), state };
    assert.deepEqual(W.guestWalkPosition(park, g), { x: g.x, y: g.y });
  }
});
console.log(`${passed} souvenir and formation checks passed.`);

import assert from "node:assert/strict";
import * as THREE from "three";
import { moduleURL } from "./ts-loader.mjs";
const G = await import(moduleURL("game/guest-model.ts")),
  V = await import(moduleURL("game/visitors.ts"));
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("PASS", name);
}
function guest(id, ageGroup = "adult", appearance = V.appearanceSeed(id)) {
  return {
    id,
    skin: id % 3,
    ageGroup,
    appearance,
    x: 15,
    y: 29,
    route: [],
    target: null,
    state: "walk",
    timer: 0,
    happiness: 80,
    hunger: 0,
    thirst: 0,
    rides: 0,
    thought: "",
  };
}
function dispose(model) {
  const geometries = new Set(),
    materials = new Set();
  model.traverse((object) => {
    if (!object.isMesh) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}
function finite(model) {
  model.updateMatrixWorld(true);
  model.traverse((object) => {
    assert(object.matrixWorld.elements.every(Number.isFinite));
    if (object.isMesh) {
      assert(object.geometry.attributes.position.array.every(Number.isFinite));
      if (object.geometry.attributes.color)
        assert(object.geometry.attributes.color.array.every(Number.isFinite));
    }
  });
}
function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
const box = (model) => new THREE.Box3().setFromObject(model);

test("Appearance and geometry are deterministic pure reads with the shared visitor palette", () => {
  const g = freeze(guest(27, "child", 931)),
    original = structuredClone(g),
    random = Math.random;
  Math.random = () => {
    throw new Error("Guest rendering consumed simulation randomness");
  };
  try {
    const first = G.personParts(g, false, 0.5),
      second = G.personParts(g, false, 0.5),
      c = V.guestAppearance(g);
    assert.deepEqual(first, second);
    assert.equal(first[0].color, c.shirt);
    assert(first.some((part) => part.color === c.skin));
    assert(first.some((part) => part.color === c.hair));
    assert(first.some((part) => part.color === c.pants));
    assert.deepEqual(g, original);
    first[0].p[0] = 999;
    first[0].s[0] = 999;
    assert.notDeepEqual(first, G.personParts(g, false, 0.5));
    assert.deepEqual(g, original);
  } finally {
    Math.random = random;
  }
});

test("Children have shorter bodies and proportionally larger heads, not a uniform adult scale", () => {
  const adult = guest(18, "adult", 71),
    child = { ...adult, ageGroup: "child" },
    adultParts = G.personParts(adult, false),
    childParts = G.personParts(child, false),
    adultHead = adultParts
      .filter((p) => p.head && p.color === V.guestAppearance(adult).skin)
      .sort((a, b) => b.s[1] - a.s[1])[0],
    childHead = childParts
      .filter((p) => p.head && p.color === V.guestAppearance(child).skin)
      .sort((a, b) => b.s[1] - a.s[1])[0],
    adultModel = G.createGuestModel(adult, false),
    childModel = G.createGuestModel(child, false);
  assert(childHead.s[1] / childParts[0].s[1] > (adultHead.s[1] / adultParts[0].s[1]) * 1.2);
  assert(childHead.s[0] / childParts[0].s[0] > (adultHead.s[0] / adultParts[0].s[0]) * 1.1);
  assert(box(childModel).max.y < box(adultModel).max.y * 0.83);
  assert(box(childModel).max.y > 0.9);
  assert.equal(childModel.userData.ageGroup, "child");
  assert.equal(childModel.name, `guest-child-${child.id}`);
  assert.equal(childModel.children.length, 2);
  assert(childModel.getObjectByName("head"));
  assert(childModel.getObjectByName("body"));
  dispose(adultModel);
  dispose(childModel);
});

test("Seated children retain their proportions and fit within the adult seat envelope", () => {
  const adult = guest(41, "adult", 302),
    child = { ...adult, ageGroup: "child" },
    adultModel = G.createGuestModel(adult),
    childModel = G.createGuestModel(child),
    a = box(adultModel),
    c = box(childModel);
  finite(adultModel);
  finite(childModel);
  assert(c.max.y < a.max.y * 0.86);
  assert(c.min.y > a.min.y);
  assert(c.max.x < a.max.x);
  assert(c.min.y > -0.55);
  assert(c.max.z < 0.45);
  dispose(adultModel);
  dispose(childModel);
});

test("Hair silhouettes, shirts, patterns and accessories visibly vary with fixed part counts", () => {
  const shirts = new Set(),
    hair = new Set(),
    styles = new Set(),
    accessories = new Set(),
    patterns = new Set(),
    counts = new Set();
  for (let id = 1; id <= 96; id++) {
    const g = guest(id, id % 4 ? "adult" : "child"),
      c = V.guestAppearance(g),
      parts = G.personParts(g, false);
    shirts.add(c.shirt);
    hair.add(c.hair);
    styles.add(c.hairStyle);
    accessories.add(c.accessory);
    patterns.add(c.pattern);
    counts.add(parts.length);
    counts.add(G.personParts(g, true).length);
    for (const part of parts) {
      assert(part.p.every(Number.isFinite));
      assert(part.s.every((v) => Number.isFinite(v) && v >= 0));
      assert(Number.isFinite(part.angle ?? 0));
    }
  }
  assert(shirts.size >= 8);
  assert(hair.size >= 3);
  assert.equal(styles.size, 4);
  assert(accessories.has("cap") && accessories.has("glasses") && accessories.has("backpack"));
  assert.deepEqual([...patterns].sort(), ["plain", "stripe"]);
  assert.equal(counts.size, 1);
  assert([...counts][0] <= 48, "Keep per-guest instanced geometry modest");
});

test("Backpacks are tucked away in ride seats, while capped and bespectacled passengers retain their look", () => {
  const source = Array.from({ length: 200 }, (_, id) => guest(id));
  for (const accessory of ["backpack", "cap", "glasses"]) {
    const g = source.find((g) => V.guestAppearance(g).accessory === accessory);
    assert(g);
    const standing = G.personParts(g, false),
      seated = G.personParts(g, true),
      visible = (parts) => parts.filter((p) => p.s.every((v) => v > 0)).length;
    assert.equal(standing.length, seated.length);
    if (accessory === "backpack") assert.equal(visible(standing) - visible(seated), 3);
    else assert.equal(visible(standing), visible(seated));
  }
});

test("Mixed adult and child crowds keep stable instancing, independent slots and animated limbs", () => {
  const guests = [guest(31), guest(32, "child"), guest(33, "child"), guest(34)],
    count = G.personParts(guests[0], false).length,
    crowd = G.createCrowd(guests);
  assert.equal(crowd.mesh.count, guests.length * count);
  assert.equal(crowd.mesh.userData.visitors.filter((g) => g.ageGroup === "child").length, 2);
  for (let i = 0; i < guests.length; i++) crowd.pose(i, i * 3, 0, 0.4, i, true);
  const before = crowd.mesh.instanceMatrix.array.slice();
  crowd.pose(1, 3, 0, 0.4, 2.75, true, true, 0.8);
  assert.deepEqual(
    crowd.mesh.instanceMatrix.array.slice(0, count * 16),
    before.slice(0, count * 16),
  );
  assert.notDeepEqual(
    crowd.mesh.instanceMatrix.array.slice(count * 16, count * 32),
    before.slice(count * 16, count * 32),
  );
  crowd.finish();
  assert(crowd.mesh.instanceMatrix.array.every(Number.isFinite));
  assert(crowd.mesh.instanceMatrix.version > 0);
  assert.notDeepEqual(G.personParts(guests[1], false, 0), G.personParts(guests[1], false, 1));
  dispose(crowd.mesh);
});

test("Legacy staff calls, undefined passenger slots and empty crowds remain supported", () => {
  for (const source of [undefined, { id: 9012, skin: 1 }]) {
    const model = G.createGuestModel(source, false);
    finite(model);
    assert.equal(model.userData.ageGroup, "adult");
    assert(box(model).max.y > 1.5);
    assert.equal(model.children.length, 2);
    dispose(model);
  }
  const empty = G.createCrowd([]);
  empty.finish();
  assert.equal(empty.mesh.count, 0);
  dispose(empty.mesh);
});

test("Guest models own their output resources and dispose all temporary geometries", () => {
  const source = guest(17, "child"),
    originalDispose = THREE.BufferGeometry.prototype.dispose;
  let temporaryDisposals = 0;
  THREE.BufferGeometry.prototype.dispose = function () {
    temporaryDisposals++;
    return originalDispose.call(this);
  };
  let first;
  try {
    first = G.createGuestModel(source);
    assert.equal(temporaryDisposals, G.personParts(source, true).length);
  } finally {
    THREE.BufferGeometry.prototype.dispose = originalDispose;
  }
  const second = G.createGuestModel(source),
    a = first.getObjectByName("body"),
    b = second.getObjectByName("body");
  assert.notEqual(a.geometry, b.geometry);
  assert.notEqual(a.material, b.material);
  assert.notEqual(a.geometry.attributes.color.array, b.geometry.attributes.color.array);
  const bBefore = b.geometry.attributes.position.array.slice();
  a.geometry.translate(1, 0, 0);
  assert.deepEqual(b.geometry.attributes.position.array, bBefore);
  dispose(first);
  finite(second);
  dispose(second);
});

console.log(`${passed} guest diversity tests passed.`);

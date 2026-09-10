import assert from "node:assert/strict";
import * as THREE from "three";
import { moduleURL } from "./ts-loader.mjs";

const S = await import(moduleURL("game/simulation.ts")),
  C = await import(moduleURL("game/cleanliness.ts")),
  Z = await import(moduleURL("game/zoo.ts")),
  O = await import(moduleURL("game/operations.ts")),
  F = await import(moduleURL("game/staff.ts")),
  W = await import(moduleURL("game/scene-world.ts"));
let passed = 0;
function test(name, run) {
  run();
  console.log("PASS", name);
  passed++;
}
const near = (a, b, message = "Coordinate mismatch") =>
  assert(Math.abs(a - b) < 1e-8, `${message}: ${a} != ${b}`);
function park() {
  const s = S.newPark("sandbox");
  s.tiles = Array.from({ length: 36 }, () => Array(36).fill("grass"));
  for (let y = 0; y < 36; y++) s.tiles[y][15] = "path";
  Object.assign(s, {
    buildings: [],
    guests: [],
    open: false,
    staff: 1,
    time: 7,
    cash: 100000,
    cleanliness: undefined,
    zoo: undefined,
    transitLines: [],
  });
  C.initCleanliness(s);
  return s;
}
function build(s, kind, x, y) {
  const result = S.build(s, kind, x, y);
  assert(result.id, `${kind}: ${result.error ?? "Building failed"}`);
  return s.buildings.find((b) => b.id === result.id);
}
function cleanerFixture(kind = "bin", progress = 0.5) {
  const s = park(),
    bin = build(s, "bin", 14, 21),
    worker = s.cleanliness.workers[0],
    point = kind === "collection" ? { x: 15, y: 29 } : { x: bin.x, y: bin.y };
  bin.binFill = kind === "bin" ? 16 : 2;
  Object.assign(worker, {
    x: 15,
    y: kind === "collection" ? 29 : 21,
    mode: kind === "bin" ? "empty" : "deposit",
    route: [],
    target: {
      kind,
      id: kind === "collection" ? 0 : bin.id,
      ...(kind === "collection" ? { point } : {}),
    },
    workTotal: 4,
    workLeft: 4 * (1 - progress),
    carried: kind === "bin" ? 0 : 8,
    toCollection: kind === "collection",
    transferred: false,
    serviceTarget: point,
    walked: 12,
    heading: Math.PI,
  });
  return { s, bin, worker, ref: { kind: "cleaner", id: worker.id } };
}
function employee(world, ref) {
  const model = world.scene.getObjectByName(`staff-${ref.kind}-${ref.id}`);
  assert(model, `Missing real ${ref.kind} #${ref.id}`);
  return model;
}
function atSharedLocation(model, state, ref) {
  const location = F.staffLocation(state, ref);
  assert(location);
  near(model.position.x, location.x * 5);
  near(model.position.y, 0);
  near(model.position.z, location.y * 5);
}
function snapshot(scene) {
  const result = [];
  scene.traverse((o) =>
    result.push([
      o.id,
      o.visible,
      o.position.toArray(),
      o.quaternion.toArray(),
      o.scale.toArray(),
      o.instanceMatrix ? Array.from(o.instanceMatrix.array) : null,
    ]),
  );
  return result;
}

test("Actual populated scene approaches the bin and opens its hinged lid during the real service phase", () => {
  const { s, bin, worker, ref } = cleanerFixture("bin", 0),
    before = structuredClone(s),
    world = W.createWorld(s),
    model = employee(world, ref),
    lid = world.scene.getObjectByName(`bin-lid-${bin.id}`),
    origin = model.position.clone();
  try {
    atSharedLocation(model, s, ref);
    assert(model.getObjectByName("forearm-1"), "Cleaner must have articulated arms");
    near(lid.rotation.x, 0);
    for (let i = 1; i <= 20; i++) world.update(i * 0.1);
    assert(model.position.distanceTo(origin) > 3, "Employee must approach the actual bin");
    assert(model.position.distanceTo(new THREE.Vector3(bin.x * 5, 0, bin.y * 5)) <= 1.001);
    assert(lid.rotation.x > 1, "Lid must lift during bag handling");
    const bag = world.scene.getObjectByName(`staff-waste-transfer-${worker.id}`);
    assert(bag?.visible, "Real service must transfer a visible bag");
    assert(
      !model.getObjectByName("bag")?.visible,
      "Transferred bag cannot also remain in the hand",
    );
    assert(bag.position.y > 1, "Transfer crosses the container rim");
    assert.deepEqual(s, before, "3D preview cannot empty the live bin or bill the live park");
  } finally {
    world.dispose();
  }
});

test("Collection disposal has a visible cart at its exact collection point and ends the transfer", () => {
  const { s, worker, ref } = cleanerFixture("collection"),
    world = W.createWorld(s),
    model = employee(world, ref),
    cart = world.scene.getObjectByName("staff-waste-collection-15.4,28.85"),
    bag = world.scene.getObjectByName(`staff-waste-transfer-${worker.id}`);
  try {
    atSharedLocation(model, s, ref);
    assert(cart?.visible, "Waste must enter a visible collection container");
    near(cart.position.x, 15.4 * 5);
    near(cart.position.z, 28.85 * 5);
    assert(bag?.visible);
    for (let i = 1; i <= 12; i++) world.update(i * 0.1);
    assert(!bag.visible, "Bag must disappear from the transfer only after reaching collection");
    assert(!model.getObjectByName("bag")?.visible, "Disposed bag must not return to the hand");
    const state = snapshot(world.scene);
    world.update(1.2);
    assert.deepEqual(
      snapshot(world.scene),
      state,
      "Repeating the same paused time cannot advance work",
    );
  } finally {
    world.dispose();
  }
});

test("The populated cleaner grips a grounded broom while sweeping, with callbacks updating the work pose", () => {
  const { s, worker, ref } = cleanerFixture(),
    litter = { id: s.cleanliness.nextId++, x: 15, y: 21, kind: "cup", age: 0 };
  s.cleanliness.litter.push(litter);
  Object.assign(worker, {
    mode: "sweep",
    target: { kind: "litter", id: litter.id },
    workTotal: 4,
    workLeft: 3,
    carried: 0,
    serviceTarget: undefined,
  });
  const world = W.createWorld(s),
    model = employee(world, ref);
  try {
    const broom = model.getObjectByName("broom-head"),
      before = broom.position.clone();
    world.update(0.1);
    assert(broom.position.distanceTo(before) > 0.001, "Work callback must move the broom tip");
    const left = model.getObjectByName("hand-1").position,
      right = model.getObjectByName("hand1").position,
      tip = broom.position;
    assert(
      new THREE.Vector3()
        .subVectors(right, left)
        .cross(new THREE.Vector3().subVectors(tip, right))
        .length() < 1e-7,
      "Both hands must grip the broom's actual shaft",
    );
    assert(
      Math.abs(tip.y - broom.scale.y) < 0.005,
      "Broom bristles must meet the ground within 5 mm",
    );
  } finally {
    world.dispose();
  }
});

test("Keeper scene callbacks progress through actual feeding, watering and cleaning on an isolated park", () => {
  const s = park(),
    habitat = build(s, "zebra", 10, 8);
  build(s, "keeperhut", 16, 27);
  Z.ensureHabitat(habitat).count = 1;
  habitat.habitat.food = 50;
  Z.initZoo(s);
  s.zoo.keepers = 1;
  Z.initZoo(s);
  const worker = s.zoo.workers[0],
    ref = { kind: "keeper", id: worker.id },
    gate = S.access(s, habitat);
  Object.assign(worker, {
    ...gate,
    route: [],
    mode: "care",
    targetId: habitat.id,
    workTotal: 6,
    workLeft: 6,
  });
  const before = structuredClone(s),
    world = W.createWorld(s),
    model = employee(world, ref);
  try {
    atSharedLocation(model, s, ref);
    assert(model.getObjectByName("food0")?.visible, "Care begins with feeding");
    for (let i = 1; i <= 25; i++) world.update(i * 0.1);
    assert(model.getObjectByName("watering-can")?.visible, "Care callback reaches watering");
    assert(!model.getObjectByName("food0").visible);
    for (let i = 26; i <= 45; i++) world.update(i * 0.1);
    assert(model.getObjectByName("broom-head")?.visible, "Care callback reaches cleaning");
    assert(!model.getObjectByName("watering-can").visible);
    assert.deepEqual(s, before, "Preview care cannot feed animals or charge the live park");
  } finally {
    world.dispose();
  }
});

test("Operators reach only their existing phase endpoint without inventing boarding or throughput", () => {
  for (const phase of ["checking", "unloading"]) {
    const s = park(),
      ride = build(s, "wheel", 16, 15),
      operations = O.ensureOperations(ride),
      ref = { kind: "operator", id: ride.id };
    Object.assign(operations, { phase, phaseLeft: phase === "checking" ? 1.5 : 1.2 });
    const before = structuredClone(s),
      world = W.createWorld(s),
      model = employee(world, ref),
      origin = model.position.clone(),
      location = F.staffLocation(s, ref);
    try {
      atSharedLocation(model, s, ref);
      world.update(0.5);
      assert(model.position.distanceTo(origin) > 0.1, `${phase} must visibly move`);
      world.update(2);
      const endpoint = phase === "checking" ? location.control : location.gate;
      near(model.position.x, endpoint.x * 5);
      near(model.position.z, endpoint.y * 5);
      const stopped = model.position.clone();
      world.update(30);
      assert(model.position.equals(stopped), "An empty paused ride cannot invent another cycle");
      assert.deepEqual(
        s,
        before,
        "Preview cannot change queues, riders, phase or finance counters",
      );
    } finally {
      world.dispose();
    }
  }
});

test("Actual staff scene freezes repeated times, allocates no recurring resources and disposes each resource once", () => {
  const { s } = cleanerFixture("collection"),
    world = W.createWorld(s),
    before = structuredClone(s);
  world.update(0.1);
  const state = snapshot(world.scene),
    geometries = new Map(),
    materials = new Map();
  world.scene.traverse((o) => {
    if (o.geometry && !geometries.has(o.geometry)) {
      geometries.set(o.geometry, 0);
      o.geometry.addEventListener("dispose", () =>
        geometries.set(o.geometry, geometries.get(o.geometry) + 1),
      );
    }
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
      if (materials.has(m)) continue;
      materials.set(m, 0);
      m.addEventListener("dispose", () => materials.set(m, materials.get(m) + 1));
    }
  });
  for (let i = 0; i < 10; i++) world.update(0.1);
  assert.deepEqual(snapshot(world.scene), state);
  assert.deepEqual(s, before);
  world.dispose();
  assert([...geometries.values(), ...materials.values()].every((count) => count === 1));
});

test("Vacant roles do not produce fabricated 3D employees", () => {
  const s = park(),
    ride = build(s, "wheel", 16, 15);
  s.staff = 0;
  s.cleanliness.workers = [];
  O.setRideStaffed(ride, false);
  const world = W.createWorld(s),
    employees = [];
  try {
    world.update(1);
    world.scene.traverse((o) => {
      if (o.userData.staffKind) employees.push(o);
    });
    assert.deepEqual(employees, []);
  } finally {
    world.dispose();
  }
});

console.log(`${passed} actual staff scene tests passed.`);

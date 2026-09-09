// Portable: copy this file into the repository's scripts/ directory and run node scripts/test-v8-runtime.mjs.
// Uses the actual game modules; no prototype overlays or geometry stubs.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import * as THREE from "three";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  C = await import(moduleURL("game/construction.ts")),
  F = await import(moduleURL("game/prefabs.ts")),
  Rig = await import(moduleURL("game/attraction-rig.ts")),
  Family = await import(moduleURL("game/family-rides.ts")),
  Render = await import(moduleURL("game/render.ts")),
  Zoo = await import(moduleURL("game/zoo.ts")),
  Animals = await import(moduleURL("game/zoo-model.ts")),
  Motion = await import(moduleURL("game/zoo-motion.ts")),
  Entrance = await import(moduleURL("game/entrance.ts")),
  Coins = await import(moduleURL("game/research-coins.ts")),
  Photo = await import(moduleURL("game/coaster-photo.ts")),
  Path = await import(moduleURL("game/ride-path.ts")),
  Station = await import(moduleURL("game/station-direction.ts"));

Math.random = () => 0.5;
const clone = (v) => structuredClone(v),
  json = (v) => JSON.parse(JSON.stringify(v));
const results = [];
function test(name, fn) {
  try {
    const evidence = fn();
    results.push({ name, pass: true, evidence });
    console.log("PASS", name);
  } catch (error) {
    results.push({ name, pass: false, error: error.message });
    console.error("FAIL", name, error.message);
  }
}
const close = (a, b, epsilon = 1e-7, label = "difference") =>
  assert(Math.abs(a - b) < epsilon, `${label}: ${a} vs ${b}`);
function resources(root) {
  const geometry = new Set(),
    materials = new Set();
  root.traverse((o) => {
    if (o.geometry) geometry.add(o.geometry);
    for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [])
      materials.add(m);
  });
  return { geometry, materials };
}
function dispose(root) {
  const { geometry, materials } = resources(root);
  for (const resource of [...geometry, ...materials]) resource.dispose();
}
function empty() {
  const s = S.newPark("sandbox");
  s.buildings = [];
  s.guests = [];
  s.transitLines = [];
  s.tiles = s.tiles.map((row) => row.map(() => "grass"));
  s.cash = 100000;
  s.open = false;
  return s;
}
function coaster(style = "steel", legacy = false) {
  const s = empty(),
    track = legacy ? C.blueprint({ x: 7, y: 7 }) : F.prefabBlueprint({ x: 8, y: 8 }, 0, style);
  const built = S.build(s, "coaster", track[0].x, track[0].y, track);
  assert(!built.error, built.error);
  const b = s.buildings.find((b) => b.id === built.id);
  b.pods = S.effectivePods(s, b);
  b.tested = true;
  b.open = true;
  return { s, b };
}
const accounts = (s) => [
  s.cash,
  s.income,
  s.expenses,
  s.dayIncome,
  s.dayExpenses,
  s.operatingIncomeToday,
  s.operatingExpensesToday,
];

// The fake image loader enables the real renderer's sprite/hit positions; it makes no visual-quality claim.
// It does not replace draw(), projection(), poses, specs, or any geometry.
const previousImage = globalThis.Image,
  previousDocument = globalThis.document;
globalThis.Image = class {
  naturalWidth = 4;
  naturalHeight = 4;
  complete = true;
  set src(value) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }
  get src() {
    return this._src;
  }
};
globalThis.document = { createElement: () => ({ getContext: () => null }) };
await Render.loadSprites();
if (previousImage === undefined) delete globalThis.Image;
else globalThis.Image = previousImage;
if (previousDocument === undefined) delete globalThis.document;
else globalThis.document = previousDocument;
const noop = () => {},
  gradient = { addColorStop: noop };
const ctx = new Proxy(
  {
    globalAlpha: 1,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: () => ({ width: 20 }),
    drawImage: (_image, ...numbers) =>
      assert(numbers.every(Number.isFinite), "finite draw coordinates"),
  },
  { get: (o, k) => (k in o ? o[k] : noop), set: (o, k, v) => ((o[k] = v), true) },
);
const view = () => ({
  zoom: 1,
  panX: 0,
  panY: 0,
  grid: false,
  hover: null,
  tool: "select",
  selected: null,
  draft: [],
  height: 0,
});

for (const kind of ["bumper", "balloonride"])
  test(`${kind}: eight distinct animated seat poses agree with actual 2D car anchors`, () => {
    const s = empty(),
      template = S.newPark().guests[0],
      b = { ...Render.previewBuilding(kind, 10, 10), id: 444, open: true, tested: true };
    b.riders = Array.from({ length: 8 }, (_, i) => 1000 + i);
    s.guests = b.riders.map((id) => ({
      ...clone(template),
      id,
      state: "ride",
      target: b.id,
      route: [],
      food: undefined,
    }));
    s.buildings = [b];
    const before = clone(b),
      rig = Rig.createAttractionRig(b, s),
      duration = S.rideDuration(b);
    assert.equal(rig.seats.length, S.rideCapacity(b));
    assert(rig.seats.length >= 8);
    assert.equal(rig.passengers.length, rig.seats.length);
    close(rig.duration, duration);
    const initial = [],
      changes = Array(8).fill(0);
    let maxProjectionError = 0;
    for (const phase of [0, 0.11, 0.36, 0.71, 0.9999]) {
      b.cycle = duration * (1 - phase);
      rig.update(duration * phase);
      const v = view();
      Render.draw(ctx, 1280, 720, s, v, phase * duration);
      const project = Render.projection(1280, 720, v).project;
      const hits = v.hitTargets.filter(
        (h) =>
          h.id === b.id &&
          (kind === "bumper"
            ? /^bumper-car-(se|sw)$/.test(h.name ?? "")
            : h.name === "balloon-gondola"),
      );
      assert.equal(hits.length, 4, "four actual car sprite anchors");
      const positions = rig.seats.map((seat, i) => {
        const p = seat.getWorldPosition(new THREE.Vector3()),
          q = seat.getWorldQuaternion(new THREE.Quaternion());
        assert([...p.toArray(), ...q.toArray()].every(Number.isFinite));
        close(q.length(), 1);
        if (phase === 0) initial[i] = p.clone();
        else changes[i] = Math.max(changes[i], p.distanceTo(initial[i]));
        return p;
      });
      for (let i = 0; i < positions.length; i++)
        for (let j = i + 1; j < positions.length; j++)
          assert(positions[i].distanceTo(positions[j]) > 0.3, "distinct camera seats");
      const unused = [...hits];
      for (let car = 0; car < 4; car++) {
        const carrier = rig.seats[car * 2].parent.parent,
          local =
            kind === "bumper" ? Family.bumperPose(car, phase) : Family.balloonPose(car, phase);
        close(carrier.position.x, local.x);
        close(carrier.position.y, local.y);
        close(carrier.position.z, local.z);
        close(Math.cos(carrier.rotation.y - local.yaw), 1);
        const world = carrier.getWorldPosition(new THREE.Vector3()),
          expected = project(world.x / 5, world.z / 5, world.y / 5);
        const index = unused.findIndex(
          (h) => Math.hypot(h.p.x - expected.x, h.p.y - expected.y) < 1e-7,
        );
        assert(index >= 0, "2D sprite anchor is projection of animated 3D carrier");
        const actual = unused.splice(index, 1)[0];
        maxProjectionError = Math.max(
          maxProjectionError,
          Math.hypot(actual.p.x - expected.x, actual.p.y - expected.y),
        );
      }
    }
    assert(
      changes.every((d) => d > 0.25),
      "all seats move",
    );
    rig.update(duration * 0.41);
    const paused = rig.seats.map((s) => s.matrixWorld.toArray());
    rig.update(duration * 0.41);
    assert.deepEqual(
      rig.seats.map((s) => s.matrixWorld.toArray()),
      paused,
    );
    b.cycle = before.cycle;
    assert.deepEqual(b, before);
    dispose(rig.root);
    return { seats: rig.seats.length, maxProjectionError, minSeatTravel: Math.min(...changes) };
  });

for (const [kind, spec] of Object.entries(Zoo.SPECIES))
  test(`${kind}: full-capacity animated model remains finite inside its enclosure`, () => {
    const b = {
      ...Render.previewBuilding(kind, 9, 11),
      id: 7,
      habitat: {
        count: spec.capacity,
        food: 100,
        water: 100,
        clean: 100,
        health: 100,
        enrichment: true,
        shelter: true,
      },
    };
    const before = clone(b),
      rig = Animals.createHabitatModel(b),
      animals = [];
    rig.root.traverse((o) => {
      if (o.name.startsWith("animal:")) animals.push(o);
    });
    assert.equal(animals.length, spec.capacity);
    assert(Motion.ANIMAL_NAMES[kind].length >= spec.capacity);
    const bounds = new THREE.Box3();
    let minimumMargin = Infinity;
    for (let time = 0; time <= 720; time += 4.73) {
      rig.update(time);
      rig.root.updateMatrixWorld(true);
      for (let i = 0; i < animals.length; i++) {
        const p = Motion.animalPose(b, i, time),
          position = animals[i].getWorldPosition(new THREE.Vector3());
        assert(
          Object.values(p)
            .filter((v) => typeof v === "number")
            .every(Number.isFinite),
        );
        close(position.x, p.x * 5);
        close(position.z, p.y * 5);
        close(position.y, p.bob);
        animals[i].traverse((o) =>
          assert(o.matrixWorld.elements.every(Number.isFinite), "finite full model transform"),
        );
        bounds.setFromObject(animals[i]);
        const margin = Math.min(
          bounds.min.x - (b.x - 0.5) * 5,
          (b.x + spec.size - 0.5) * 5 - bounds.max.x,
          bounds.min.z - (b.y - 0.5) * 5,
          (b.y + spec.size - 0.5) * 5 - bounds.max.z,
        );
        assert(margin > 0, `${kind} geometry crosses fence by ${-margin}m`);
        minimumMargin = Math.min(minimumMargin, margin);
      }
    }
    const snapshot = () => {
      const values = [];
      rig.root.traverse((o) =>
        values.push([...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray()]),
      );
      return values;
    };
    rig.update(37.5);
    const paused = snapshot();
    for (let i = 0; i < 4; i++) rig.update(37.5);
    assert.deepEqual(snapshot(), paused);
    assert.deepEqual(b, before);
    const owned = resources(rig.root),
      other = Animals.createHabitatModel(b),
      next = resources(other.root);
    assert([...owned.geometry].every((g) => !next.geometry.has(g)));
    assert([...owned.materials].every((m) => !next.materials.has(m)));
    let disposed = 0;
    for (const r of [...owned.geometry, ...owned.materials])
      r.addEventListener("dispose", () => disposed++);
    dispose(rig.root);
    assert.equal(disposed, owned.geometry.size + owned.materials.size);
    dispose(other.root);
    return { count: animals.length, minimumFenceMarginMetres: minimumMargin, pausedStable: true };
  });

test("Entrance themes purchase once, switch free, preserve research coins, and survive actual save migration", () => {
  const s = S.newPark();
  Coins.initResearchCoins(s);
  const coins = clone(s.research.ledger),
    cash = s.cash,
    expenses = s.expenses,
    daily = s.dayExpenses;
  assert.equal(Entrance.gateStyle(s), "classic");
  let cost = 0;
  for (const style of Object.keys(Entrance.GATES)) {
    assert.equal(Entrance.changeGate(s, style), null);
    cost += Entrance.GATES[style].cost;
    assert.equal(s.cash, cash - cost);
    assert.equal(s.expenses, expenses + cost);
    assert.equal(s.dayExpenses, daily + cost);
    const paid = accounts(s);
    assert.equal(Entrance.changeGate(s, style), null);
    assert.deepEqual(accounts(s), paid);
    assert.deepEqual(s.research.ledger, coins);
    assert(S.validSave(json(s)));
    const restored = json(s);
    S.migratePark(restored);
    assert.deepEqual(restored.entrance, s.entrance);
    assert.deepEqual(restored.research.ledger, coins);
  }
  const paid = accounts(s);
  for (const style of ["classic", "festival", "safari", "classic"])
    assert.equal(Entrance.changeGate(s, style), null);
  assert.deepEqual(accounts(s), paid);
  assert.equal(Coins.researchCoins(s), coins.coins);
  return { cost, owned: s.entrance.owned };
});
test("Entrance denied purchases are atomic and invalid save shapes are rejected", () => {
  const s = S.newPark();
  s.cash = 1;
  const before = clone(s);
  assert(Entrance.changeGate(s, "festival"));
  assert.deepEqual(s, before);
  assert(Entrance.changeGate(s, "missing"));
  assert.deepEqual(s, before);
  for (const entrance of [
    null,
    { style: "missing", owned: ["classic"] },
    { style: "safari", owned: ["classic"] },
    { style: "classic", owned: ["classic", "classic"] },
    { style: "classic", owned: "classic" },
    { style: "classic", owned: ["classic", "missing"] },
  ]) {
    const bad = clone(s);
    bad.entrance = entrance;
    assert.equal(S.validSave(bad), false, JSON.stringify(entrance));
  }
  delete s.entrance;
  assert(S.validSave(s));
  S.migratePark(s);
  assert.equal(Entrance.gateStyle(s), "classic");
});
test("Already-owned entrance switching remains free when park cash is negative", () => {
  const s = S.newPark();
  assert.equal(Entrance.changeGate(s, "safari"), null);
  s.cash = -1;
  const paid = accounts(s),
    coins = clone(s.research.ledger);
  assert.equal(Entrance.changeGate(s, "classic"), null);
  assert.equal(Entrance.changeGate(s, "safari"), null);
  assert.deepEqual(accounts(s), paid);
  assert.deepEqual(s.research.ledger, coins);
  assert(S.validSave(json(s)));
});

test("Actual photo add/move/remove edit records undo only intended hardware and money", () => {
  const { s, b } = coaster(),
    original = clone(b),
    ledger = accounts(s),
    coins = clone(s.research.ledger);
  const added = C.recordEdit(s, "Foto-Laser montieren", () => {
    assert(S.spend(s, 180));
    b.photoPoint = 0.37;
  });
  assert(added);
  assert.equal(added.photos.length, 1);
  assert.equal(b.photoPoint, 0.37);
  assert.equal(s.cash, ledger[0] - 180);
  const moved = C.recordEdit(s, "Fotopunkt verschieben", () => {
    b.photoPoint = 0.63;
  });
  assert(moved);
  assert.equal(moved.cash, 0);
  assert.equal(moved.photos.length, 1);
  const removed = C.recordEdit(s, "Foto-Laser entfernen", () => {
    delete b.photoPoint;
  });
  assert(removed);
  assert.equal(C.undoEdits(s, [removed]), null);
  assert.equal(b.photoPoint, 0.63);
  assert.equal(C.undoEdits(s, [moved]), null);
  assert.equal(b.photoPoint, 0.37);
  assert(S.validSave(json(s)));
  const saved = json(s);
  S.migratePark(saved);
  assert.equal(saved.buildings[0].photoPoint, 0.37);
  assert.equal(C.undoEdits(s, [added]), null);
  assert.equal(b.photoPoint, undefined);
  delete b.photoPoint;
  assert.deepEqual(b, original);
  assert.deepEqual(accounts(s), ledger);
  assert.deepEqual(s.research.ledger, coins);
});
test("Actual save validation accepts legacy absent photo and rejects wrong kind/range/nonfinite points", () => {
  const { s, b } = coaster();
  assert(S.validSave(json(s)));
  for (const u of [0, 0.37, 1]) {
    b.photoPoint = u;
    assert(S.validSave(json(s)));
  }
  for (const u of [-0.001, 1.001, NaN, Infinity, "0.5", null]) {
    b.photoPoint = u;
    assert.equal(S.validSave(s), false, String(u));
  }
  delete b.photoPoint;
  const wheel = S.newPark(),
    ride = wheel.buildings.find((b) => b.kind === "wheel");
  ride.photoPoint = 0.5;
  assert.equal(S.validSave(wheel), false);
});
for (const [style, legacy] of [
  ["steel", false],
  ["wood", false],
  ["launch", false],
  ["steel", true],
])
  test(`${style}${legacy ? " legacy" : ""}: station reversal preserves physical photo point; undo restores geometry and point`, () => {
    const { s, b } = coaster(style, legacy);
    b.photoPoint = 0.371;
    const original = clone(b.track),
      source = Path.makeRidePath(b.track),
      point = source.at(b.photoPoint).position.clone(),
      money = accounts(s),
      coins = clone(s.research.ledger);
    const plan = Station.planStationReverse(s, b);
    assert.equal(plan.error, null);
    const record = C.recordEdit(s, "Station umkehren", () =>
      assert.equal(Station.commitStationReverse(s, plan), null),
    );
    assert(record);
    close(b.photoPoint, 1 - 0.371);
    assert.equal(record.photos.length, 1);
    const reversed = Path.makeRidePath(b.track),
      distance = reversed.at(b.photoPoint).position.distanceTo(point);
    assert(distance < 1e-5, `photo moved ${distance}m after direction reversal`);
    assert(S.validSave(json(s)));
    assert.deepEqual(accounts(s), money);
    assert.deepEqual(s.research.ledger, coins);
    const scene = new THREE.Scene(),
      hardware = Photo.addPhotoHardware(scene, reversed, b.photoPoint);
    assert(hardware);
    close(hardware.root.position.distanceTo(point), 0, 1e-5);
    dispose(scene);
    assert.equal(C.undoEdits(s, [record]), null);
    assert.deepEqual(b.track, original);
    close(b.photoPoint, 0.371);
    assert(S.validSave(json(s)));
    assert.deepEqual(accounts(s), money);
    return { physicalErrorMetres: distance, legacy };
  });

console.log(`${results.filter((r) => r.pass).length}/${results.length} passed`);
if (process.env.V8_RESULTS_PATH)
  writeFileSync(process.env.V8_RESULTS_PATH, JSON.stringify(results, null, 2));
process.exitCode = results.every((r) => r.pass) ? 0 : 1;

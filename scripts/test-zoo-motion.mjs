import assert from "node:assert/strict";
import * as THREE from "three";
import { moduleURL } from "./ts-loader.mjs";
const Z = await import(moduleURL("game/zoo.ts")),
  N = await import(moduleURL("game/habitat-needs.ts")),
  M = await import(moduleURL("game/zoo-motion.ts")),
  G = await import(moduleURL("game/zoo-model.ts")),
  L = await import(moduleURL("game/zoo-layout.ts"));
const results = [];
function test(name, fn) {
  try {
    const evidence = fn();
    results.push({ name, pass: true, evidence });
    console.log("PASS", name, JSON.stringify(evidence ?? {}));
  } catch (e) {
    results.push({ name, pass: false, error: e.message });
    console.error("FAIL", name, e.message);
  }
}
function building(kind, features = true) {
  return {
    kind,
    id: 101,
    x: 8,
    y: 9,
    habitat: {
      count: Z.SPECIES[kind].capacity,
      food: 100,
      water: 100,
      clean: 100,
      health: 100,
      enrichment: false,
      shelter: false,
      ...(features ? { features: N.HABITAT_PROFILES[kind].features.map((f) => f.id) } : {}),
    },
  };
}
const materialResources = (root) => {
  const set = new Set();
  root.traverse((o) => {
    if (o.geometry) set.add(o.geometry);
    if (o.material)
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) set.add(m);
  });
  return set;
};
for (const kind of Object.keys(Z.SPECIES))
  test(`${kind}: deterministic noncircular journeys, pauses and service visits`, () => {
    const b = building(kind),
      before = structuredClone(b),
      activities = new Set(),
      lay = L.habitatLayout(b),
      initial = performance.now();
    const first = M.animalPose(b, 0, 0),
      setupMs = performance.now() - initial;
    let maxStep = 0,
      maxYaw = 0,
      paused = 0,
      walking = 0,
      previous = first;
    for (let t = 0.04; t < 1200; t += 0.04) {
      const p = M.animalPose(b, 0, t);
      assert(
        Object.values(p)
          .filter((v) => typeof v === "number")
          .every(Number.isFinite),
      );
      assert(!L.habitatPointBlocked(b, p.x, p.y, 0.05), "animal centre enters solid fixture");
      const moved = Math.hypot(p.x - previous.x, p.y - previous.y) * 5,
        heading = Math.abs(
          Math.atan2(
            previous.dx * p.dy - previous.dy * p.dx,
            previous.dx * p.dx + previous.dy * p.dy,
          ),
        );
      maxStep = Math.max(maxStep, moved);
      maxYaw = Math.max(maxYaw, heading);
      assert(moved < 0.04, "position jumped");
      assert(heading < 0.5, `heading jumped ${heading}`);
      assert(p.distance >= previous.distance - 1e-7, "distance went backwards");
      assert(
        Math.abs(
          p.gait - previous.gait - ((p.distance - previous.distance) / p.stride) * Math.PI * 2,
        ) < 1e-7,
        "gait does not follow distance",
      );
      activities.add(p.activity);
      if (p.activity !== "walk" && previous.activity === p.activity) {
        assert(moved < 1e-8, "stationary activity slid");
        assert(Math.abs(p.gait - previous.gait) < 1e-8, "gait runs while stopped");
        paused++;
      }
      if (p.walk) walking++;
      if (p.action > 0.9 && ["eat", "drink", "shelter"].includes(p.activity)) {
        const goal =
          lay[p.activity === "eat" ? "food" : p.activity === "drink" ? "water" : "shelter"];
        assert(
          Math.hypot(p.x - goal.x, p.y - goal.y) < 0.8,
          "service stop disagrees with shared layout",
        );
      }
      previous = p;
    }
    for (const state of ["walk", "pause", "eat", "drink", "shelter"])
      assert(activities.has(state), state + " absent");
    for (const t of [0, 32, 104.3, 881, 42]) {
      const p = M.animalPose(b, 0, t);
      assert.deepEqual(p, M.animalPose(b, 0, t));
      assert.deepEqual(p, M.animalPose(structuredClone(b), 0, t));
    }
    assert.deepEqual(b, before);
    assert(paused > 500 && walking > 500);
    return {
      setupMs,
      maximumFrameStepMetres: maxStep,
      maximumFrameYawRadians: maxYaw,
      pausedFrames: paused,
    };
  });
for (const kind of Object.keys(Z.SPECIES))
  test(`${kind}: correct joint chains, grounded stance and full geometry bounds`, () => {
    const b = building(kind),
      rig = G.createHabitatModel(b),
      animals = [];
    rig.root.traverse((o) => {
      if (o.name.startsWith("animal:")) animals.push(o);
    });
    assert.equal(animals.length, b.habitat.count);
    const expectedLegs = ["flamingo", "penguin"].includes(kind) ? 2 : 4;
    for (const animal of animals) {
      let legs = 0;
      animal.traverse((o) => {
        if (o.name.startsWith("leg:foot:")) {
          legs++;
          assert(o.parent.name.startsWith("leg:knee:"));
          assert(o.parent.parent.name.startsWith("leg:hip:"));
        }
      });
      assert.equal(legs, expectedLegs);
    }
    let minMargin = Infinity,
      maxStanceLift = 0,
      feet = 0;
    for (let time = 0; time < 1200; time += 3.31) {
      rig.update(time);
      rig.root.updateMatrixWorld(true);
      animals.forEach((animal, i) => {
        const p = M.animalPose(b, i, time),
          box = new THREE.Box3().setFromObject(animal),
          n = Z.SPECIES[kind].size;
        const margin = Math.min(
          box.min.x - (b.x - 0.5) * 5,
          (b.x + n - 0.5) * 5 - box.max.x,
          box.min.z - (b.y - 0.5) * 5,
          (b.y + n - 0.5) * 5 - box.max.z,
        );
        minMargin = Math.min(minMargin, margin);
        assert(margin > 0, `geometry crossed fence ${margin}m`);
        animal.traverse((o) => {
          assert(o.matrixWorld.elements.every(Number.isFinite));
          if (o.name.startsWith("leg:foot:") && o.userData.stance) {
            feet++;
            const pos = o.getWorldPosition(new THREE.Vector3());
            maxStanceLift = Math.max(maxStanceLift, pos.y);
            assert(pos.y > -0.01 && pos.y < 0.125, `foot floats or penetrates: ${pos.y}`);
            const up = new THREE.Vector3(0, 1, 0).applyQuaternion(
              o.getWorldQuaternion(new THREE.Quaternion()),
            );
            assert(up.y > 0.999, "sole rotates into ground");
          }
        });
        assert.equal(p.sex, animal.userData.sex);
      });
    }
    const transforms = () => {
      const s = [];
      rig.root.traverse((o) => s.push([...o.position.toArray(), ...o.quaternion.toArray()]));
      return s;
    };
    rig.update(53);
    const paused = transforms();
    rig.update(53);
    assert.deepEqual(transforms(), paused);
    const own = materialResources(rig.root);
    let disposed = 0;
    for (const r of own) {
      r.addEventListener("dispose", () => disposed++);
      r.dispose();
    }
    assert.equal(disposed, own.size);
    return {
      animals: animals.length,
      feetChecked: feet,
      minimumFenceMarginMetres: minMargin,
      maximumStanceFootHeight: maxStanceLift,
    };
  });
test("One male lion and remaining lionesses retain deterministic names and sprite IDs", () => {
  const b = building("lion"),
    rig = G.createHabitatModel(b),
    animals = [];
  rig.root.traverse((o) => {
    if (o.name.startsWith("animal:")) animals.push(o);
  });
  animals.forEach((animal, i) => {
    let manes = 0;
    animal.traverse((o) => {
      if (o.name === "lion-mane") manes++;
    });
    assert.equal(manes, i ? 0 : 1);
    assert.equal(M.animalSex("lion", i), i ? "female" : "male");
    assert.equal(M.animalSprite("lion", i, "sw"), i ? "lioness-sw" : "lion-sw");
    assert(M.animalName("lion", i));
  });
  const names = animals.map((_, i) => M.animalName("lion", i));
  assert.equal(new Set(names).size, animals.length);
  for (const r of materialResources(rig.root)) r.dispose();
  return { names };
});
test("Legacy habitat with no equipment fields works without mutating the save", () => {
  for (const kind of Object.keys(Z.SPECIES)) {
    const b = building(kind, false),
      before = structuredClone(b);
    for (const time of [0, 10, 120, 500]) assert(Number.isFinite(M.animalPose(b, 0, time).x));
    assert.deepEqual(b, before);
  }
});
console.log(`${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exitCode = results.every((r) => r.pass) ? 0 : 1;

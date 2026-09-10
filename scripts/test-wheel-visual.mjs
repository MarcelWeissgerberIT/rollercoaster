import assert from "node:assert/strict";
import * as THREE from "three";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts"));
const W = await import(moduleURL("game/wheel-boarding.ts"));
const G = await import(moduleURL("game/wheel-geometry.ts"));
const R = await import(moduleURL("game/attraction-rig.ts"));
const A = await import(moduleURL("game/ride-access.ts"));
let passed = 0;
const near = (a, b) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function test(name, fn) {
  fn();
  passed++;
  console.log("PASS", name);
}
function fixture() {
  const s = S.newPark("sandbox"),
    b = s.buildings.find((b) => b.kind === "wheel");
  const template = structuredClone(s.guests[0]);
  b.riders = [];
  b.queue = [];
  b.open = b.tested = true;
  b.cycle = 0;
  delete b.wheel;
  s.guests = [0, 1, 2].map((i) => ({
    ...structuredClone(template),
    id: s.nextId++,
    state: "queue",
    target: b.id,
    name: `Gast ${i}`,
    route: [],
    party: undefined,
  }));
  b.queue = s.guests.map((g) => g.id);
  const advance = (dt) => {
    W.tickWheel(b, dt, {
      ready: true,
      exitClear: true,
      baseDuration: 24,
      board: () => {
        const id = b.queue.shift();
        if (id === undefined) return null;
        b.riders.push(id);
        s.guests.find((g) => g.id === id).state = "ride";
        return id;
      },
      release: (id) => {
        const g = s.guests.find((g) => g.id === id);
        g.state = "walk";
        g.target = null;
      },
    });
    s.time += dt;
  };
  return { s, b, advance };
}
test("Live rig has eight fixed gondolas matching the common pose, independent of render time", () => {
  const f = fixture();
  f.advance(0.1);
  const rig = R.createAttractionRig(f.b, f.s);
  assert.equal(rig.seats.length, 8);
  f.advance(W.WHEEL_STOP_SECONDS + 0.25);
  rig.update(400);
  const state = W.wheelVisualState(f.b);
  for (let i = 0; i < 8; i++) {
    const cabin = rig.root.getObjectByName(`wheel-gondola-${i}`);
    const actual = cabin.getWorldPosition(new THREE.Vector3()).sub(rig.root.position);
    const expected = G.wheelGondolaPose(i, state.angle, 8);
    near(actual.x, expected.x * 8);
    near(actual.y, 11 + expected.y * 8);
    near(cabin.getWorldQuaternion(new THREE.Quaternion()).angleTo(new THREE.Quaternion()), 0);
  }
  const angle = rig.root.userData.wheelAngle;
  rig.update(9000);
  near(rig.root.userData.wheelAngle, angle);
});
test("Real transfer guest is drawn once, walks during the stop and retains the same seat after indexing", () => {
  const f = fixture();
  f.advance(0.15);
  const rig = R.createAttractionRig(f.b, f.s),
    id = f.b.riders[0];
  const transfer = rig.root.getObjectByName("wheel-transfer-guest");
  assert(transfer);
  assert.equal(transfer.userData.guestId, id);
  assert.equal(rig.passengers.filter((p) => p.visible).length, 0);
  const matrix = [...transfer.instanceMatrix.array];
  f.advance(0.6);
  rig.update(0);
  assert.notDeepEqual([...transfer.instanceMatrix.array], matrix);
  f.advance(W.WHEEL_STOP_SECONDS);
  rig.update(0);
  assert.equal(rig.passengers[0].userData.guestId, id);
  assert(rig.passengers[0].visible);
  assert(!rig.root.getObjectByName("wheel-transfer-guest"));
  const restored = JSON.parse(JSON.stringify(f.s));
  const restoredWheel = restored.buildings.find((b) => b.id === f.b.id);
  const restoredRig = R.createAttractionRig(restoredWheel, restored);
  near(restoredRig.root.userData.wheelAngle, rig.root.userData.wheelAngle);
  assert.deepEqual(restoredRig.root.userData.wheelGondolas, rig.root.userData.wheelGondolas);
});
test("Entrance only opens at a stopped loading cabin, never while indexing or running", () => {
  const f = fixture();
  f.advance(0.4);
  assert(A.gateMotion(f.s, f.b, "entry").open > 0.9);
  f.advance(W.WHEEL_STOP_SECONDS);
  assert.equal(W.wheelVisualState(f.b).phase, "indexing-load");
  assert.equal(A.gateMotion(f.s, f.b, "entry").open, 0);
  for (let i = 0; i < 150 && W.wheelVisualState(f.b).phase !== "running"; i++) f.advance(0.1);
  assert.equal(W.wheelVisualState(f.b).phase, "running");
  assert.equal(A.gateMotion(f.s, f.b, "entry").open, 0);
});
test("3D trial ride is explicit, preserves identities and leaves the live ride unchanged", () => {
  const f = fixture();
  f.advance(0.2);
  const before = JSON.stringify(f.b);
  const preview = R.createAttractionRig(f.b, f.s, { preview: true });
  preview.update(0);
  const first = preview.root.userData.wheelAngle;
  preview.update(12);
  assert(preview.root.userData.wheelAngle > first);
  assert.equal(JSON.stringify(f.b), before);
  assert(preview.passengers[0].visible);
  assert.equal(preview.passengers[0].userData.guestId, f.b.riders[0]);
  near(G.wheelPreviewProgress(0, 24), 0);
  near(G.wheelPreviewProgress(24, 24), 1);
  assert(G.wheelPreviewProgress(0.01, 24) < 0.00001);
});
console.log(`${passed}/${passed} wheel visual tests passed`);

import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";
import { moduleURL } from "./ts-loader.mjs";
const P = await import(moduleURL("game/coaster-photo.ts")),
  C = await import(moduleURL("game/coaster-photo-capture.ts")),
  R = await import(moduleURL("game/ride-path.ts"));
const tests = [];
function test(name, fn) {
  try {
    const detail = fn();
    tests.push({ name, pass: true, detail });
    console.log("PASS", name);
  } catch (e) {
    tests.push({ name, pass: false, error: e.message });
    console.log("FAIL", name, e.message);
  }
}
const line = {
  length: 10,
  points: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 0, 0)],
  at: (u) => ({
    position: new THREE.Vector3(u * 10, 0, 0),
    right: new THREE.Vector3(0, 0, 1),
    up: new THREE.Vector3(0, 1, 0),
    tangent: new THREE.Vector3(1, 0, 0),
    quaternion: new THREE.Quaternion(),
  }),
};
test("3D closest point interpolates segments and clamps endpoints", () => {
  const p = P.closestPhotoPoint(line, { x: 3.5, y: 2, z: 0 });
  assert.equal(p.u, 0.35);
  assert.equal(p.distance, 2);
  assert.equal(P.closestPhotoPoint(line, { x: -2, y: 0, z: 0 }).u, 0);
  assert.equal(P.closestPhotoPoint(line, { x: 12, y: 0, z: 0 }).u, 1);
  assert.equal(P.closestPhotoPoint(line, { x: NaN, y: 0, z: 0 }), null);
});
test("Projected2D selection returns screen distance and same arc-length coordinate", () => {
  const p = P.closestPhotoPoint2D(line, { x: 35, y: 12 }, (q) => ({ x: q.x * 10, y: 0 }));
  assert.equal(p.u, 0.35);
  assert.equal(p.distance, 12);
  assert.equal(
    P.closestPhotoPoint2D(line, { x: NaN, y: 0 }, (q) => q),
    null,
  );
});
test("Threshold fires once at inclusive destination, never same frame/backwards", () => {
  assert(P.crossedPhotoPoint(0.29, 0.3, 0.3));
  assert(!P.crossedPhotoPoint(0.3, 0.31, 0.3));
  assert(!P.crossedPhotoPoint(0.3, 0.3, 0.3));
  assert(!P.crossedPhotoPoint(0.4, 0.1, 0.3));
  assert(!P.crossedPhotoPoint(null, 0.4, 0.3));
  for (const q of [NaN, Infinity, -0.1, 1.1]) assert(!P.crossedPhotoPoint(0, 1, q));
});
test("Point0/1 both trigger on finish, and unwrapped future laps work", () => {
  for (const u of [0, 1]) {
    assert(!P.crossedPhotoPoint(0, 0.1, u));
    assert(P.crossedPhotoPoint(0.99, 1, u));
    assert(!P.crossedPhotoPoint(1, 1.01, u));
  }
  assert(P.crossedPhotoPoint(0.95, 1.05, 0.02));
  assert(P.crossedPhotoPoint(1.2, 1.4, 0.3));
});
test("Save field permits disabled old coasters and rejects wrong kind/range", () => {
  assert(P.validPhotoPoint({ kind: "wheel" }));
  assert(P.validPhotoPoint({ kind: "coaster", track: [1, 2, 3, 4], photoPoint: 0.4 }));
  for (const u of [NaN, Infinity, -1, 1.1, "0.3"])
    assert(!P.validPhotoPoint({ kind: "coaster", track: [1, 2, 3, 4], photoPoint: u }));
  assert(!P.validPhotoPoint({ kind: "wheel", photoPoint: 0.4 }));
});
test("Camera hardware follows3D frame including inverted spans; all resources traverse for disposal", () => {
  const track = Array.from({ length: 49 }, (_, i) => {
      const t = (i / 48) * Math.PI * 2;
      return {
        x: 10 + 4 * Math.cos(t),
        y: 10 + 2 * Math.sin(t),
        z: 3 + 3 * Math.sin(t),
        smooth: true,
        inversion: true,
      };
    }),
    path = R.makeRidePath(track),
    before = structuredClone(track);
  for (const u of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
    const scene = new THREE.Scene(),
      h = P.addPhotoHardware(scene, path, u),
      points = P.photoHardwarePoints(path, u);
    assert(h);
    assert.equal(scene.children.length, 1);
    h.root.updateMatrixWorld(true);
    const left = h.root.localToWorld(new THREE.Vector3(-1.86, 1.35, 0));
    assert(left.distanceTo(points.beamA) < 1e-8);
    assert(h.root.position.distanceTo(path.at(u).position) < 1e-8);
    const gs = new Map(),
      ms = new Map();
    h.root.traverse((o) => {
      if (o.geometry) gs.set(o.geometry, 0);
      if (o.material) ms.set(o.material, 0);
    });
    for (const g of gs.keys()) g.addEventListener("dispose", () => gs.set(g, gs.get(g) + 1));
    for (const m of ms.keys()) m.addEventListener("dispose", () => ms.set(m, ms.get(m) + 1));
    for (const value of [0, 1, NaN, -1, 5]) h.setFlash(value);
    for (const g of gs.keys()) g.dispose();
    for (const m of ms.keys()) m.dispose();
    assert([...gs.values(), ...ms.values()].every((v) => v === 1));
    assert.equal(gs.size, 2);
    assert.equal(ms.size, 6);
  }
  assert.deepEqual(track, before);
  const scene = new THREE.Scene();
  assert.equal(P.addPhotoHardware(scene, path, NaN), null);
  assert.equal(scene.children.length, 0);
});
let next = 0;
const live = new Set(),
  revoked = [];
const create = URL.createObjectURL,
  revoke = URL.revokeObjectURL;
URL.createObjectURL = () => {
  const u = "blob:test-" + next++;
  live.add(u);
  return u;
};
URL.revokeObjectURL = (u) => {
  assert(live.has(u), "URL revoked twice " + u);
  live.delete(u);
  revoked.push(u);
};
const canvas = () => {
  const pending = [];
  return {
    width: 640,
    height: 480,
    pending,
    toBlob(cb, mime, quality) {
      assert.equal(mime, "image/jpeg");
      assert.equal(quality, 0.9);
      pending.push(cb);
    },
  };
};
try {
  test("Capture holds one pending encode and replaces/revokes one retained URL", () => {
    const seen = [],
      c = canvas(),
      h = C.createRidePhotoCapture((p) => seen.push(p));
    assert(h.capture(c, "one.jpg"));
    for (let i = 0; i < 50; i++) assert.equal(h.capture(c, "later.jpg"), false);
    assert.equal(c.pending.length, 1);
    c.pending.shift()(new Blob(["one"]));
    assert.equal(live.size, 1);
    assert(h.capture(c, "two.jpg"));
    c.pending.shift()(new Blob(["two"]));
    assert.equal(live.size, 1);
    assert.equal(seen.length, 2);
    assert.equal(seen[1].filename, "two.jpg");
    h.dispose();
    h.dispose();
    assert.equal(live.size, 0);
  });
  test("Unmount during encode prevents new URL and callback, with idempotent cleanup", () => {
    const seen = [],
      c = canvas(),
      h = C.createRidePhotoCapture((p) => seen.push(p));
    h.capture(c, "photo.jpg");
    h.dispose();
    c.pending.shift()(new Blob(["late"]));
    assert.equal(seen.length, 0);
    assert.equal(live.size, 0);
    assert.equal(h.capture(c, "closed.jpg"), false);
  });
  test("Reset invalidates encode but cannot create a queue of new pending buffers", () => {
    const seen = [],
      c = canvas(),
      h = C.createRidePhotoCapture((p) => seen.push(p));
    h.capture(c, "old.jpg");
    h.clear();
    for (let i = 0; i < 20; i++) {
      h.clear();
      assert.equal(h.capture(c, "new.jpg"), false);
    }
    assert.equal(c.pending.length, 1);
    c.pending.shift()(new Blob(["stale"]));
    assert.equal(live.size, 0);
    assert(h.capture(c, "new.jpg"));
    c.pending.shift()(new Blob(["fresh"]));
    assert.equal(live.size, 1);
    h.dispose();
  });
  test("Null blob and synchronous canvas failure leave no pending lock or URL leak", () => {
    let errors = 0;
    const c = canvas(),
      h = C.createRidePhotoCapture(
        () => {},
        () => errors++,
      );
    h.capture(c, "null.jpg");
    c.pending.shift()(null);
    assert.equal(errors, 1);
    assert(h.capture(c, "try.jpg"));
    c.pending.shift()(new Blob(["ok"]));
    assert.equal(live.size, 1);
    assert.equal(
      h.capture(
        {
          width: 1,
          height: 1,
          toBlob() {
            throw Error("tainted");
          },
        },
        "bad.jpg",
      ),
      false,
    );
    assert.equal(errors, 2);
    assert(h.capture(c, "again.jpg"));
    h.dispose();
    c.pending.shift()(new Blob(["late"]));
    assert.equal(live.size, 0);
  });
} finally {
  URL.createObjectURL = create;
  URL.revokeObjectURL = revoke;
}
const result = {
  passed: tests.filter((t) => t.pass).length,
  failed: tests.filter((t) => !t.pass).length,
  tests,
};
fs.writeFileSync("/tmp/coaster-photo-results.json", JSON.stringify(result, null, 2));
console.log(`${result.passed}/${tests.length} passed`);
process.exitCode = result.failed ? 1 : 0;

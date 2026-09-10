import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
import * as THREE from "three";
const B = await import(moduleURL("game/birds.ts"));
const Canvas = await import(moduleURL("game/bird-canvas.ts"));
const Scene = await import(moduleURL("game/bird-scene.ts"));
const S = await import(moduleURL("game/simulation.ts"));
let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("PASS", name);
  } catch (error) {
    console.error("FAIL", name, error.message);
    process.exit(1);
  }
}
const close = (a, b) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function park(trees = true) {
  const s = S.newPark("sandbox");
  s.buildings = [];
  s.guests = [];
  s.transitLines = [];
  s.crewPool = { version: 1, nextId: 1, crews: [] };
  s.staff = 0;
  s.zoo.keepers = 0;
  s.zoo.workers = [];
  s.cleanliness.workers = [];
  s.cleanliness.litter = [];
  s.open = false;
  s.spawnClock = -10000;
  s.cash = 100000;
  s.tiles = Array.from({ length: 30 }, () => Array(30).fill("grass"));
  s.pathStyles = {};
  for (let y = 24; y < 30; y++) s.tiles[y][15] = "path";
  if (trees)
    for (const [kind, x, y] of [
      ["tree", 5, 5],
      ["pine", 12, 8],
      ["tree", 22, 11],
      ["pine", 26, 20],
    ])
      assert.equal(S.build(s, kind, x, y).error, undefined);
  S.migratePark(s);
  return s;
}
const pose = (s, t, id = 0) => B.parkBirds(s, t)[id];
test("Three to five birds have deterministic positions without random calls or saved state", () => {
  const s = park(),
    before = JSON.stringify(s),
    oldRandom = Math.random;
  Math.random = () => {
    throw Error("No random calls allowed");
  };
  try {
    for (const t of [0, 0.25, 17, 27, 37.2, 47, 57, 90, 101, 333])
      assert.deepEqual(B.parkBirds(s, t), B.parkBirds(JSON.parse(before), t));
  } finally {
    Math.random = oldRandom;
  }
  assert.equal(JSON.stringify(s), before);
  assert.equal(B.parkBirds(s).length, 3);
  s.tiles = Array.from({ length: 50 }, () => Array(50).fill("grass"));
  assert.equal(B.parkBirds(s).length, 5);
});
test("Perches are the actual crown tops of existing trees and are unique between resting birds", () => {
  const s = park(),
    perches = B.birdPerches(s);
  assert.equal(perches.length, 4);
  for (const p of perches) {
    const b = s.buildings.find((b) => b.id === p.buildingId),
      variation = 0.85 + (b.id % 7) * 0.04;
    assert.equal(p.x, b.x);
    assert.equal(p.y, b.y);
    close(p.z, ((b.kind === "pine" ? 9.5 : 9.3) * variation) / 5);
  }
  for (let t = 0; t < 300; t += 0.5) {
    const birds = B.parkBirds(s, t).filter((p) => p.phase === "perched");
    assert.equal(new Set(birds.map((p) => p.perchId)).size, birds.length);
    birds.forEach((p) => {
      const target = perches.find((perch) => perch.buildingId === p.perchId);
      assert(target);
      close(p.x, target.x);
      close(p.y, target.y);
      close(p.z, target.z);
    });
  }
});
test("An empty park gets passing birds and never invented sitting places", () => {
  const s = park(false);
  for (let t = 0; t < 300; t += 0.5)
    for (const p of B.parkBirds(s, t)) {
      assert(["flight", "glide"].includes(p.phase));
      assert.equal(p.perchId, undefined);
      assert(p.z >= 12.5);
    }
});
test("Deleted or relocated trees invalidate perches without leaving phantom targets", () => {
  const s = park(),
    tree = s.buildings[0],
    old = B.birdPerches(s).find((p) => p.buildingId === tree.id);
  tree.x += 2;
  const moved = B.birdPerches(s).find((p) => p.buildingId === tree.id);
  assert.equal(moved.x, old.x + 2);
  s.buildings = s.buildings.filter((b) => b.id !== tree.id);
  for (let t = 0; t < 200; t++) assert(B.parkBirds(s, t).every((p) => p.perchId !== tree.id));
});
test("Landing columns avoid overhead track and cruise clears the tallest track", () => {
  const s = park(),
    tree = s.buildings[0];
  s.buildings.push({
    ...tree,
    id: 9999,
    kind: "coaster",
    track: [
      { x: tree.x - 2, y: tree.y, z: 16, smooth: true },
      { x: tree.x + 2, y: tree.y, z: 16, smooth: true },
    ],
  });
  assert(!B.birdPerches(s).some((p) => p.buildingId === tree.id));
  for (let t = 0; t < 10; t += 0.2) assert(pose(s, t).z >= 19);
});
test("Flight, glide, landing, perching and takeoff all occur on simulation time", () => {
  const s = park(),
    phases = new Set();
  for (let t = 0; t < 300; t += 0.1) B.parkBirds(s, t).forEach((p) => phases.add(p.phase));
  assert.deepEqual([...phases].sort(), ["flight", "glide", "landing", "perched", "takeoff"]);
  s.time = 37.2;
  s.speed = 0;
  const before = JSON.stringify(s),
    birds = B.parkBirds(s);
  S.tick(s, 10);
  assert.equal(JSON.stringify(s), before);
  assert.deepEqual(B.parkBirds(s), birds);
  s.speed = 1;
  S.tick(s, 0.2);
  assert.notDeepEqual(B.parkBirds(s), birds);
});
test("Landing and takeoff stay continuous at every visible phase boundary", () => {
  const s = park();
  for (const t of [17, 27, 47, 57]) {
    const a = pose(s, t - 1e-5),
      b = pose(s, t + 1e-5);
    assert(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 0.001);
    assert(Math.abs(a.heading - b.heading) < 0.001);
    assert(Math.abs(a.tipFold - b.tipFold) < 0.001);
  }
  assert(pose(s, 91 - 1e-5).opacity < 1e-7);
  assert(pose(s, 91 + 1e-5).opacity < 1e-7);
});
test("Wing joints flap in flight, hold during glides and fold while only the head pecks", () => {
  const s = park(),
    f1 = pose(s, 2),
    f2 = pose(s, 2.1),
    g1 = pose(s, 5),
    g2 = pose(s, 5.1),
    p1 = pose(s, 37.1),
    p2 = pose(s, 37.3);
  assert.notDeepEqual(B.birdAnatomy(f1).wings, B.birdAnatomy(f2).wings);
  assert.equal(g1.phase, "glide");
  assert.equal(g2.phase, "glide");
  assert.equal(g1.wing, g2.wing);
  assert.equal(p1.phase, "perched");
  assert.equal(p1.tipFold, 1);
  assert.equal(p1.x, p2.x);
  assert.equal(p1.z, p2.z);
  assert.deepEqual(B.birdAnatomy(p1).wings, B.birdAnatomy(p2).wings);
  assert.notDeepEqual(B.birdAnatomy(p1).head, B.birdAnatomy(p2).head);
});
test("Shared anatomy stays finite and wings have independent elbow and tip movement", () => {
  const s = park();
  for (let t = 0; t < 110; t += 0.2)
    for (const p of B.parkBirds(s, t)) {
      const anatomy = B.birdAnatomy(p);
      for (const wing of anatomy.wings) {
        assert.equal(wing.length, 7);
        wing.forEach((v) => assert(Number.isFinite(v.x + v.y + v.z)));
      }
      assert(p.opacity >= 0 && p.opacity <= 1);
      assert(p.tipFold >= 0 && p.tipFold <= 1);
    }
  const p = pose(s, 2),
    a = B.birdAnatomy({ ...p, wing: -0.8, tipFold: 0 }),
    b = B.birdAnatomy({ ...p, wing: 0.8, tipFold: 0 });
  assert(a.wings[0][1].y < b.wings[0][1].y);
  assert(a.wings[0][2].y < b.wings[0][2].y);
});
test("3D body, head and articulated wing vertices agree with the shared canvas world pose", () => {
  const s = park(),
    scene = new THREE.Scene(),
    rig = Scene.createBirdScene(scene, s);
  for (const t of [2, 5, 22, 37.2, 50]) {
    const poses = rig.update(t);
    scene.updateMatrixWorld(true);
    for (const p of poses) {
      const bird = rig.root.getObjectByName(`park-bird-${p.id}`),
        body = bird.getObjectByName("bird-body-frame"),
        head = bird.getObjectByName("bird-head-joint");
      close(bird.position.x, p.x * 5);
      close(bird.position.y, p.z * 5);
      close(bird.position.z, p.y * 5);
      const local = B.birdAnatomy(p).wings[0][2],
        expected = B.birdLocalWorld(p, local),
        actual = new THREE.Vector3(local.x, local.y, local.z).applyMatrix4(body.matrixWorld);
      close(actual.x, expected.x * 5);
      close(actual.y, expected.z * 5);
      close(actual.z, expected.y * 5);
      const center = B.birdLocalWorld(p, B.birdAnatomy(p).head),
        actualHead = new THREE.Vector3(0, 0.06, 0.055).applyMatrix4(head.matrixWorld);
      close(actualHead.x, center.x * 5);
      close(actualHead.y, center.z * 5);
      close(actualHead.z, center.y * 5);
    }
  }
  const before = rig.root.getObjectByName("park-bird-0").matrixWorld.clone();
  rig.update(50);
  scene.updateMatrixWorld(true);
  assert.deepEqual(rig.root.getObjectByName("park-bird-0").matrixWorld.elements, before.elements);
  rig.dispose();
  assert(!scene.children.includes(rig.root));
});
test("Canvas draws real articulated silhouettes and keeps the caller's state intact", () => {
  const s = park(),
    shapes = [],
    stack = [];
  let points = [];
  const ctx = {
    globalAlpha: 1,
    fillStyle: "before",
    strokeStyle: "before",
    lineWidth: 2,
    lineJoin: "miter",
    lineCap: "butt",
    save() {
      stack.push([
        this.globalAlpha,
        this.fillStyle,
        this.strokeStyle,
        this.lineWidth,
        this.lineJoin,
        this.lineCap,
      ]);
    },
    restore() {
      [
        this.globalAlpha,
        this.fillStyle,
        this.strokeStyle,
        this.lineWidth,
        this.lineJoin,
        this.lineCap,
      ] = stack.pop();
    },
    beginPath() {
      points = [];
    },
    closePath() {},
    moveTo(x, y) {
      assert(Number.isFinite(x + y));
      points.push([x, y]);
    },
    lineTo(x, y) {
      assert(Number.isFinite(x + y));
      points.push([x, y]);
    },
    fill() {
      shapes.push({ points: [...points], color: this.fillStyle });
    },
    stroke() {},
    translate(x, y) {
      assert(Number.isFinite(x + y));
    },
    rotate(a) {
      assert(Number.isFinite(a));
    },
    ellipse(...values) {
      assert(values.every(Number.isFinite));
    },
    arc(...values) {
      assert(values.every(Number.isFinite));
    },
  };
  for (const t of [2, 5, 22, 37.2, 50])
    Canvas.drawBird(
      ctx,
      pose(s, t),
      (x, y, z) => ({ x: (x - y) * 24, y: (x + y) * 12 - z * 24 }),
      2,
    );
  assert(
    shapes.some((shape) => shape.points.length === 7),
    "Jointed wing silhouettes are drawn",
  );
  assert(
    shapes.some((shape) => shape.color === B.BIRD_COLORS[0].breast),
    "Breast and wing materials stay distinct",
  );
  assert.equal(stack.length, 0);
  assert.equal(ctx.globalAlpha, 1);
  assert.equal(ctx.fillStyle, "before");
});
test("Real save/load and changed 3D view preserve bird identities, perch selection and phase", () => {
  const s = park();
  s.time = 37.2;
  assert(S.validSave(s));
  const original = B.parkBirds(s),
    loaded = JSON.parse(JSON.stringify(s));
  S.migratePark(loaded);
  assert.deepEqual(B.parkBirds(loaded), original);
  assert(S.validSave(loaded));
  const scene = new THREE.Scene(),
    rig = Scene.createBirdScene(scene, loaded);
  assert.deepEqual(rig.update(), original);
  rig.dispose();
});
test("Landing follows a broad curved descent and flares horizontally before the crown", () => {
  const s = park(),
    perch = B.birdPerches(s)[0],
    points = Array.from({ length: 65 }, (_, i) => B.birdApproach(perch, 13, i / 64));
  let horizontal = 0;
  for (let i = 1; i < points.length; i++)
    horizontal += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  assert(horizontal > 10, "The descent has a real curved flight corridor, not a vertical elevator");
  assert(Math.hypot(points[0].x - perch.x, points[0].y - perch.y) > 3);
  const last = points.at(-1),
    previous = points.at(-2);
  assert(
    Math.abs(last.z - previous.z) < Math.hypot(last.x - previous.x, last.y - previous.y) * 0.1,
    "Final approach flattens before landing",
  );
  for (let i = 1; i < points.length; i++) assert(points[i].z <= points[i - 1].z);
  const departure = B.birdApproach(perch, 13, 0.5, true);
  assert(Math.hypot(departure.x - perch.x, departure.y - perch.y) > 1);
});
test("A tall neighboring attraction inside the approach corridor suppresses that perch", () => {
  const s = park(),
    tree = s.buildings[0],
    perch = B.birdPerch(tree),
    crossing = B.birdApproach(perch, 13, 0.55);
  s.buildings.push({
    ...tree,
    id: 9998,
    kind: "drop",
    x: Math.round(crossing.x),
    y: Math.round(crossing.y),
  });
  assert(!B.birdPerches(s).some((p) => p.buildingId === tree.id));
});
test("Canvas feet align to actual sprite crown pixels while physical poses remain unchanged", () => {
  const s = park();
  for (const tree of s.buildings) {
    const perch = B.birdPerch(tree),
      p = {
        ...pose(s, 32),
        x: perch.x,
        y: perch.y,
        z: perch.z,
        phase: "perched",
        perchId: tree.id,
        perchBlend: 1,
      },
      before = JSON.stringify(p);
    close(p.z * 24 + Canvas.birdSpriteLift(s, p), tree.kind === "pine" ? 77 : 62);
    assert.equal(JSON.stringify(p), before);
    assert.equal(Canvas.birdSpriteLift(s, { ...p, perchBlend: 0 }), 0);
  }
  let previous = Infinity;
  for (let t = 17; t <= 27; t += 0.02) {
    const p = pose(s, t),
      height = p.z * 24 + Canvas.birdSpriteLift(s, p);
    assert(height <= previous + 1e-6, "The canopy correction cannot pull a landing bird upward");
    previous = height;
  }
});
console.log(`${passed}/${passed} bird tests passed`);

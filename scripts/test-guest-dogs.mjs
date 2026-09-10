import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const D = await import(moduleURL("game/guest-dogs.ts"));
const M = await import(moduleURL("game/dog-model.ts"));
const H = await import(moduleURL("game/guest-model.ts"));
const C = await import(moduleURL("game/dog-canvas.ts"));
const results = [];
function test(name, run) {
  try {
    run();
    results.push({ name, pass: true });
  } catch (e) {
    results.push({ name, pass: false, error: e.message });
  }
  console.log(JSON.stringify(results.at(-1)));
}
const near = (a, b) => assert(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
const guest = (id, patch = {}) => ({
  id,
  x: 5,
  y: 5,
  route: [{ x: 6, y: 5 }],
  timer: 0,
  state: "walk",
  skin: 0,
  ageGroup: "adult",
  ...patch,
});
const ownerId = Array.from({ length: 200 }, (_, i) => i + 1).find((id) =>
  D.dogOwnerEligible(guest(id)),
);
assert(ownerId);
function fixture() {
  const g = guest(ownerId),
    park = {
      guests: [g],
      time: 15,
      speed: 1,
      tiles: Array.from({ length: 12 }, () => Array(12).fill("grass")),
    };
  for (let x = 0; x < 12; x++) park.tiles[5][x] = "path";
  return { g, park };
}
test("Only about2% of adult solo/pair leads qualify, never children or every group member", () => {
  const guests = Array.from({ length: 20000 }, (_, id) => guest(id + 1)),
    qualifying = guests.filter(D.dogOwnerEligible);
  assert(qualifying.length > 300 && qualifying.length < 500, `${qualifying.length}/20000`);
  for (const g of qualifying.slice(0, 10)) {
    assert(!D.dogOwnerEligible({ ...g, ageGroup: "child" }));
    for (const kind of ["family", "friends"])
      assert(!D.dogOwnerEligible({ ...g, party: { id: g.id, kind, member: 0, size: 4 } }));
    assert(D.dogOwnerEligible({ ...g, party: { id: g.id, kind: "couple", member: 0, size: 2 } }));
    assert(!D.dogOwnerEligible({ ...g, party: { id: g.id, kind: "couple", member: 1, size: 2 } }));
  }
  assert.equal(D.dogCompanionOwners({ guests }).size, 3);
});
test("Save reload, guest reorder and repeated rendering preserve dog IDs/coats without RNG or mutation", () => {
  const { g, park } = fixture(),
    before = JSON.stringify(park),
    pose = D.dogCompanionPose(park, g);
  assert(pose);
  const rng = Math.random;
  Math.random = () => {
    throw Error("No reroll during rendering");
  };
  try {
    const saved = JSON.parse(before);
    assert.deepEqual(D.dogCompanionPose(saved, saved.guests[0]), pose);
    assert.deepEqual(
      [...D.dogCompanionOwners({ ...park, guests: [...park.guests].reverse() })],
      [...D.dogCompanionOwners(park)],
    );
  } finally {
    Math.random = rng;
  }
  assert.equal(JSON.stringify(park), before);
});
test("Companions and their leash stay on normal paths in every direction and at corners", () => {
  const { g, park } = fixture();
  for (const direction of [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ]) {
    park.tiles = park.tiles.map((r) => r.map(() => "grass"));
    for (let i = 0; i < 12; i++) park.tiles[direction.y ? i : 5][direction.x ? i : 5] = "path";
    g.route = [{ x: g.x + direction.x, y: g.y + direction.y }];
    const pose = D.dogCompanionPose(park, g);
    assert(pose);
    for (let t = 0; t <= 1; t += 0.05)
      assert.equal(
        park.tiles[Math.round(pose.owner.y + (pose.y - pose.owner.y) * t)][
          Math.round(pose.owner.x + (pose.x - pose.owner.x) * t)
        ],
        "path",
      );
    for (const part of D.dogParts(pose)) {
      const p = D.dogWorldPoint(pose, part.p);
      assert.equal(park.tiles[Math.round(p.y)][Math.round(p.x)], "path");
    }
  }
  park.tiles = park.tiles.map((r) => r.map(() => "grass"));
  park.tiles[5][5] = "path";
  park.tiles[5][6] = "path";
  park.tiles[6][6] = "path";
  g.route = [
    { x: 6, y: 5 },
    { x: 6, y: 6 },
  ];
  const pose = D.dogCompanionPose(park, g);
  assert(pose);
  assert.equal(park.tiles[Math.round(pose.y)][Math.round(pose.x)], "path");
});
test("No dogs in rides, seated areas, transport, queues, exits or water; narrow crowded paths stay clear", () => {
  const { g, park } = fixture();
  for (const state of ["ride", "rest", "queue", "observe"])
    assert.equal(D.dogCompanionPose(park, { ...g, state }), null);
  for (const tile of ["water", "grass", "queue", "exit"]) {
    park.tiles[5][5] = tile;
    assert.equal(D.dogCompanionPose(park, g), null);
  }
  park.tiles[5][5] = "path";
  assert.equal(D.dogCompanionPose(park, { ...g, transit: { line: 1 } }), null);
  const original = D.dogCompanionPose(park, g);
  assert(original);
  park.guests.push(guest(99999, { x: original.x, y: original.y, ageGroup: "child" }));
  const avoided = D.dogCompanionPose(park, g);
  assert(!avoided || Math.hypot(avoided.x - original.x, avoided.y - original.y) > 0.1);
});
test("Walking articulates all four legs; stopped paws remain planted and paused clocks freeze every joint", () => {
  const { g, park } = fixture(),
    pose = D.dogCompanionPose(park, g);
  assert(pose);
  const first = D.dogParts(pose),
    later = D.dogParts({ ...pose, phase: pose.phase + 1, clock: pose.clock + 0.2 });
  assert.notDeepEqual(
    first.filter((p) => p.name.startsWith("leg-")),
    later.filter((p) => p.name.startsWith("leg-")),
  );
  park.speed = 0;
  assert.deepEqual(D.dogParts(D.dogCompanionPose(park, g)), first);
  const still = D.dogParts({ ...pose, moving: false }),
    idleLater = D.dogParts({
      ...pose,
      moving: false,
      clock: pose.clock + 2,
      phase: pose.phase + 10,
    });
  assert.deepEqual(
    still.filter((p) => p.name.startsWith("paw-")),
    idleLater.filter((p) => p.name.startsWith("paw-")),
  );
  for (let phase = 0; phase < Math.PI * 2; phase += 0.1) {
    const paws = D.dogParts({ ...pose, phase }).filter((p) => p.name.startsWith("paw-"));
    assert(
      paws.filter((p) => p.p[1] > 0.041).length <= 1,
      "At most one paw swings in four-beat walk",
    );
  }
});
test("3D has articulated geometry and leash attached to the actual animated owner hand", () => {
  const { g, park } = fixture(),
    pose = D.dogCompanionPose(park, g),
    rig = M.createDogCompanionModel(g.id);
  assert(pose);
  const hand = H.personParts(g, false, 2, true).find((p) => p.leashGrip).p;
  rig.update(pose, hand);
  assert(rig.root.visible);
  assert.equal(rig.root.userData.ownerId, g.id);
  assert.equal(rig.root.children.filter((p) => p.name.startsWith("leg-")).length, 8);
  const expected = D.dogWorldPoint({ x: pose.owner.x, y: pose.owner.y, yaw: pose.ownerYaw }, hand),
    leash = rig.root.children.find((p) => p.isLine).geometry.attributes.position;
  near(leash.getX(0), expected.x * 5);
  near(leash.getY(0), expected.z);
  near(leash.getZ(0), expected.y * 5);
  const body = rig.root.children.find((p) => p.name === "body"),
    b = D.dogWorldPoint(pose, D.dogParts(pose).find((p) => p.name === "body").p);
  near(body.position.x, b.x * 5);
  near(body.position.y, b.z);
  near(body.position.z, b.y * 5);
  rig.update(null);
  assert(!rig.root.visible);
  rig.dispose();
});
test("Canvas renders actual body, eyes, paws, articulated legs and leash without sprite dependencies", () => {
  const { g, park } = fixture(),
    pose = D.dogCompanionPose(park, g);
  assert(pose);
  const counts = { ellipse: 0, lines: 0, leash: 0 },
    ctx = new Proxy(
      { globalAlpha: 1 },
      {
        get(t, key) {
          if (key in t) return t[key];
          if (key === "ellipse") return () => counts.ellipse++;
          if (key === "lineTo") return () => counts.lines++;
          if (key === "quadraticCurveTo") return () => counts.leash++;
          return () => {};
        },
      },
    );
  C.drawDogCompanion(ctx, pose, (x, y) => ({ x: (x - y) * 24, y: (x + y) * 12 }), 3);
  assert(counts.ellipse > 15);
  assert(counts.lines >= 10);
  assert.equal(counts.leash, 1);
});
test("Canvas leash follows the owner's animated hand, direction and scale and freezes when standing", () => {
  const { g, park } = fixture(),
    pose = D.dogCompanionPose(park, g);
  const grip = C.dogLeashGrip(g, 100, 100, 2, "se", 0, true),
    stepped = C.dogLeashGrip(g, 100, 100, 2, "se", 1, true),
    reversed = C.dogLeashGrip(g, 100, 100, 2, "nw", 0, true);
  assert.notDeepEqual(grip, stepped);
  assert(grip.x > 100 && reversed.x < 100);
  assert.deepEqual(
    C.dogLeashGrip(g, 100, 100, 2, "se", 0, false),
    C.dogLeashGrip(g, 100, 100, 2, "se", 10, false),
  );
  const paths = [],
    ctx = new Proxy(
      { globalAlpha: 1 },
      {
        get(target, key) {
          if (key in target) return target[key];
          if (key === "moveTo") return (x, y) => paths.push({ x, y });
          return () => {};
        },
      },
    );
  C.drawDogCompanion(ctx, pose, (x, y) => ({ x, y }), 2, stepped);
  assert.deepEqual(paths[0], stepped);
});
if (results.some((r) => !r.pass)) process.exitCode = 1;
else console.log(`PASS ${results.length}/${results.length} companion dog checks`);

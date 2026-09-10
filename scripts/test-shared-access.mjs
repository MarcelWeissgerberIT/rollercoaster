import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts"));
const A = await import(moduleURL("game/shared-access.ts"));
const O = await import(moduleURL("game/operations.ts"));
const C = await import(moduleURL("game/construction.ts"));
const P = await import(moduleURL("game/pods.ts"));
let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("PASS", name);
  } catch (error) {
    console.error("FAIL", name, error);
    process.exit(1);
  }
}
function fixture(direct = false) {
  const s = S.newPark("sandbox");
  s.tiles = Array.from({ length: 30 }, () => Array(30).fill("grass"));
  for (let y = 20; y < 30; y++) s.tiles[y][13] = "path";
  for (let x = 13; x <= 15; x++) s.tiles[29][x] = "path";
  s.tiles[20][14] = direct ? "path" : "queue";
  s.tiles[20][15] = direct ? "path" : "queue";
  const b = {
    id: 100,
    kind: "carousel",
    name: "Gemeinsames Rad",
    x: 16,
    y: 20,
    price: 7,
    open: true,
    tested: true,
    served: 0,
    revenue: 0,
    cycle: 0,
    queue: [],
    riders: [],
    pods: { entry: { side: 2, offset: 0 }, exit: { side: 2, offset: 1 } },
    operations: {
      staffed: true,
      crewId: 101,
      assignment: "auto",
      rounds: 1,
      remainingRounds: 0,
      phase: "idle",
      phaseLeft: 0,
    },
  };
  s.buildings = [b];
  s.guests = [];
  s.nextId = 200;
  s.transitLines = [];
  s.crewPool = { version: 1, nextId: 102, crews: [{ id: 101, buildingId: 100, mode: "manual" }] };
  s.cleanliness.workers = [];
  s.cleanliness.litter = [];
  s.staff = 0;
  s.zoo.workers = [];
  s.zoo.keepers = 0;
  s.time = 0;
  s.speed = 1;
  s.open = true;
  s.spawnClock = -1000;
  return { s, b };
}
const guest = (id, extra = {}) => ({
  id,
  x: 15,
  y: 20,
  target: 100,
  route: [],
  state: "queue",
  timer: 0,
  happiness: 80,
  hunger: 10,
  thirst: 10,
  rides: 0,
  skin: 0,
  thought: "",
  wallet: 60,
  profile: "family",
  ...extra,
});
const enable = (f) => assert.equal(A.setSharedAccess(f.s, f.b, true), null);

test("Toggle preserves separate pods, costs, geometry and readable save", () => {
  const f = fixture(),
    pods = JSON.stringify(f.b.pods),
    before = f.s.cash;
  const snapshot = JSON.stringify(f.s);
  assert.equal(A.sharedAccessChangeError(f.s, f.b, true), null);
  assert.equal(JSON.stringify(f.s), snapshot);
  enable(f);
  assert.equal(JSON.stringify(f.b.pods), pods);
  assert.equal(f.s.cash, before);
  assert(P.samePod(S.effectivePods(f.s, f.b).entry, S.effectivePods(f.s, f.b).exit));
  assert(P.validPods(f.b.pods, S.CATALOG[f.b.kind].size));
  assert(S.validSave(f.s));
  assert.equal(A.setSharedAccess(f.s, f.b, false), null);
  assert.equal(JSON.stringify(f.b.pods), pods);
  assert(S.validSave(f.s));
});
test("Queue route points outward and shared capacity uses only its single incoming lane", () => {
  const f = fixture();
  enable(f);
  assert.deepEqual(A.sharedAccessRoute(f.s, f.b), [
    { x: 15, y: 20 },
    { x: 14, y: 20 },
    { x: 13, y: 20 },
  ]);
  assert.deepEqual(S.exitPath(f.s, f.b), A.sharedAccessRoute(f.s, f.b));
  assert.equal(S.queueCapacity(f.s, f.b), 4);
  f.s.tiles[19][15] = "queue";
  f.s.tiles[18][15] = "queue";
  assert.equal(
    S.queueCapacity(f.s, f.b),
    4,
    "Side branches do not invent extra displayed queue places",
  );
});
test("Public path directly at the shared gate is valid with two distinct incoming positions", () => {
  const f = fixture(true);
  enable(f);
  assert.equal(A.sharedAccessRoute(f.s, f.b).length, 1);
  assert.equal(S.queueCapacity(f.s, f.b), 2);
  f.b.queue = [1, 2];
  f.s.guests = [guest(1), guest(2)];
  assert.notDeepEqual(
    A.sharedAccessGuestPosition(f.s, f.s.guests[0]),
    A.sharedAccessGuestPosition(f.s, f.s.guests[1]),
  );
});
test("Shared access refuses unconnected paths, animals, transport, and an already shared ride queue", () => {
  const f = fixture();
  f.s.tiles[20][14] = "grass";
  assert.match(A.setSharedAccess(f.s, f.b, true), /Verbinde/);
  for (const kind of ["elephant", "train"]) {
    const f = fixture();
    f.b.kind = kind;
    assert(A.setSharedAccess(f.s, f.b, true));
  }
  const other = fixture();
  other.s.buildings.push({
    ...other.b,
    id: 102,
    x: 14,
    y: 20 - S.CATALOG[other.b.kind].size,
    pods: { entry: { side: 1, offset: 0 }, exit: { side: 0, offset: 0 } },
  });
  assert.deepEqual(
    P.podPort(other.s.buildings[1], S.CATALOG[other.b.kind].size, other.s.buildings[1].pods.entry),
    { x: 14, y: 20 },
  );
  assert.match(A.setSharedAccess(other.s, other.b, true), /andere Attraktion/);
});
test("Mode change rejects guests on their way, riders, queue, outgoing guests, and a test without edits", () => {
  for (const state of ["walk", "queue", "ride"]) {
    const f = fixture();
    f.s.guests = [guest(1, { state })];
    const before = JSON.stringify(f.s);
    assert(A.setSharedAccess(f.s, f.b, true));
    assert.equal(JSON.stringify(f.s), before);
  }
  const f = fixture();
  enable(f);
  f.s.guests = [guest(1, { state: "walk", target: null, sharedExit: 100 })];
  const before = JSON.stringify(f.s);
  assert(A.setSharedAccess(f.s, f.b, false));
  assert.equal(JSON.stringify(f.s), before);
  const testing = fixture();
  testing.b.testing = 10;
  assert(A.setSharedAccess(testing.s, testing.b, true));
});
test("Queue and outgoing walkers occupy opposite consistent 2D/3D lanes without changing routes", () => {
  const f = fixture();
  enable(f);
  const incoming = guest(1, { state: "walk", x: 14.5, route: [{ x: 15, y: 20 }] });
  const outgoing = guest(2, {
    state: "walk",
    target: null,
    sharedExit: 100,
    x: 14.5,
    route: [
      { x: 14, y: 20 },
      { x: 13, y: 20 },
    ],
  });
  f.s.guests = [incoming, outgoing];
  const before = JSON.stringify(f.s);
  const a = A.sharedAccessGuestPosition(f.s, incoming),
    b = A.sharedAccessGuestPosition(f.s, outgoing);
  assert(a.y > 20);
  assert(b.y < 20);
  assert.equal(a.x, b.x);
  assert.equal(JSON.stringify(f.s), before);
  A.withSharedAccessCache(f.s, () =>
    assert.equal(A.getSharedAccessLanes(f.s, f.b), A.getSharedAccessLanes(f.s, f.b)),
  );
  f.s.tiles[20][14] = "grass";
  assert.deepEqual(A.sharedAccessRoute(f.s, f.b), []);
});
test("Actual ride unloads into shared route and interlocks admission until last guest reaches path", () => {
  const f = fixture();
  enable(f);
  f.s.guests = [guest(1, { state: "ride" }), guest(2)];
  f.b.riders = [1];
  f.b.queue = [2];
  Object.assign(f.b.operations, { phase: "running", remainingRounds: 1 });
  f.b.cycle = 0.1;
  S.tick(f.s, 0.25);
  const exiting = f.s.guests[0];
  assert.equal(exiting.sharedExit, 100);
  assert.equal(exiting.target, null);
  let frames = 0;
  while (A.sharedExitPending(f.s, f.b) && frames++ < 60) {
    assert(!f.b.riders.includes(2));
    S.tick(f.s, 0.25);
  }
  assert(frames < 60);
  assert.equal(exiting.sharedExit, undefined);
  assert.equal(f.s.tiles[Math.round(exiting.y)][Math.round(exiting.x)], "path");
  for (let i = 0; i < 24 && !f.b.riders.includes(2); i++) S.tick(f.s, 0.25);
  assert(f.b.riders.includes(2));
});
test("Direct public gate also has marked red-lane exit pause before admission", () => {
  const f = fixture(true);
  enable(f);
  f.s.guests = [guest(1, { state: "ride" }), guest(2)];
  f.b.riders = [1];
  f.b.queue = [2];
  Object.assign(f.b.operations, { phase: "running", remainingRounds: 1 });
  f.b.cycle = 0.1;
  S.tick(f.s, 0.25);
  assert.equal(f.s.guests[0].sharedExit, 100);
  assert(f.s.guests[0].timer > 0);
  assert(A.sharedAccessGuestPosition(f.s, f.s.guests[0]));
  assert(!f.b.riders.includes(2));
  for (let i = 0; i < 3; i++) S.tick(f.s, 0.25);
  assert.equal(f.s.guests[0].sharedExit, undefined);
  assert(!f.b.riders.includes(2), "Boarding/checking phases still take time");
});
test("Family member exits cannot be redirected or held by a new leader destination", () => {
  const f = fixture();
  enable(f);
  const child = guest(2, {
    state: "walk",
    target: null,
    sharedExit: 100,
    route: [
      { x: 14, y: 20 },
      { x: 13, y: 20 },
    ],
    party: { id: 1, kind: "couple", member: 1, size: 2 },
  });
  const leader = guest(1, {
    state: "leave",
    target: null,
    x: 13,
    y: 27,
    party: { id: 1, kind: "couple", member: 0, size: 2 },
    route: [
      { x: 13, y: 28 },
      { x: 13, y: 29 },
      { x: 14, y: 29 },
      { x: 15, y: 29 },
    ],
  });
  f.s.guests = [leader, child];
  for (let i = 0; i < 24 && child.sharedExit !== undefined; i++) S.tick(f.s, 0.25);
  assert.equal(child.sharedExit, undefined);
  assert.equal(f.s.tiles[Math.round(child.y)][Math.round(child.x)], "path");
});
test("Paused and restored saves preserve exit marker and lane identity", () => {
  const f = fixture();
  enable(f);
  f.s.guests = [
    guest(1, {
      state: "walk",
      target: null,
      sharedExit: 100,
      route: [
        { x: 14, y: 20 },
        { x: 13, y: 20 },
      ],
    }),
  ];
  assert(S.validSave(f.s));
  const restored = S.migratePark(JSON.parse(JSON.stringify(f.s)));
  assert(S.validSave(restored));
  assert.deepEqual(
    A.sharedAccessGuestPosition(restored, restored.guests[0]),
    A.sharedAccessGuestPosition(f.s, f.s.guests[0]),
  );
  restored.speed = 0;
  const before = JSON.stringify(restored);
  S.tick(restored, 2);
  assert.equal(JSON.stringify(restored), before);
  restored.speed = 1;
  for (let i = 0; i < 24 && restored.guests[0].sharedExit !== undefined; i++)
    S.tick(restored, 0.25);
  assert.equal(restored.guests[0].sharedExit, undefined);
});
test("Save validation rejects invalid shared flags, duplicate stored pods and foreign exit tokens", () => {
  const f = fixture();
  enable(f);
  assert(S.validSave(f.s));
  f.b.sharedAccess = "yes";
  assert(!S.validSave(f.s));
  f.b.sharedAccess = true;
  const old = structuredClone(f.b.pods.exit);
  f.b.pods.exit = { ...f.b.pods.entry };
  assert(!S.validSave(f.s));
  f.b.pods.exit = old;
  f.s.guests = [guest(1, { state: "walk", target: null, sharedExit: 999 })];
  assert(!S.validSave(f.s));
});
test("Undo restores access mode and stored pods but refuses a mixed occupied batch atomically", () => {
  const f = fixture(),
    stored = JSON.stringify(f.b.pods);
  const record = C.recordEdit(f.s, "Gemeinsamer Zugang", () => enable(f));
  assert(record);
  assert.equal(C.undoEdits(f.s, [record]), null);
  assert(!f.b.sharedAccess);
  assert.equal(JSON.stringify(f.b.pods), stored);
  enable(f);
  const off = C.recordEdit(f.s, "Getrennt", () =>
    assert.equal(A.setSharedAccess(f.s, f.b, false), null),
  );
  assert.equal(C.undoEdits(f.s, [off]), null);
  assert(f.b.sharedAccess);
  f.s.guests = [guest(1, { state: "walk", target: null, sharedExit: 100 })];
  const before = JSON.stringify(f.s);
  assert(C.undoEdits(f.s, [record]));
  assert.equal(JSON.stringify(f.s), before);
});
test("Moving shared gate onto saved exit swaps hidden reserve without corrupting save", () => {
  const f = fixture();
  enable(f);
  const oldEntry = structuredClone(f.b.pods.entry),
    oldExit = structuredClone(f.b.pods.exit);
  assert.equal(C.setAccessPod(f.s, f.b, "entry", oldExit, false), null);
  assert.deepEqual(f.b.pods.entry, oldExit);
  assert.deepEqual(f.b.pods.exit, oldEntry);
  assert(S.validSave(f.s));
  assert(C.setAccessPod(f.s, f.b, "exit", oldEntry, false));
});
test("Shared queue cannot take over a transport stop's existing queue", () => {
  const f = fixture();
  f.s.buildings.push({
    ...f.b,
    id: 102,
    kind: "train",
    x: 14,
    y: 19,
    pods: { entry: { side: 1, offset: 0 }, exit: { side: 0, offset: 0 } },
  });
  assert.match(A.setSharedAccess(f.s, f.b, true), /andere Attraktion/);
});
test("Shared corridor geometry undo waits for outgoing guests without touching state", () => {
  const f = fixture();
  enable(f);
  const record = C.recordEdit(f.s, "Pod versetzen", () =>
    assert.equal(C.setAccessPod(f.s, f.b, "entry", { side: 2, offset: 1 }, false), null),
  );
  assert(record);
  f.s.guests = [guest(1, { state: "walk", target: null, sharedExit: 100 })];
  const before = JSON.stringify(f.s);
  assert(C.undoEdits(f.s, [record]));
  assert.equal(JSON.stringify(f.s), before);
});
console.log(`Shared access: ${passed}/${passed} passed`);

import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts"));
const W = await import(moduleURL("game/wheel-boarding.ts"));
const O = await import(moduleURL("game/operations.ts"));
const C = await import(moduleURL("game/construction.ts"));
const A = await import(moduleURL("game/shared-access.ts"));
Math.random = () => 0.5;
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
function fixture(count = 3, shared = false, direct = false) {
  const s = S.newPark("sandbox"),
    template = structuredClone(s.guests[0]);
  const b = s.buildings.find((item) => item.kind === "wheel");
  b.x = 16;
  b.y = 20;
  b.pods = { entry: { side: 2, offset: 0 }, exit: { side: 2, offset: 1 } };
  s.tiles = Array.from({ length: 30 }, () => Array(30).fill("grass"));
  for (let y = 20; y < 30; y++) s.tiles[y][13] = "path";
  for (let x = 13; x <= 15; x++) s.tiles[29][x] = "path";
  for (let x = 14; x <= 15; x++) {
    s.tiles[20][x] = direct ? "path" : "queue";
    s.tiles[21][x] = "exit";
  }
  s.tiles[21][13] = "path";
  s.buildings = [b];
  s.guests = [];
  s.speed = 1;
  s.open = false;
  s.staff = 0;
  s.spawnClock = -1000;
  s.transitLines = [];
  s.cleanliness.workers = [];
  s.cleanliness.litter = [];
  s.zoo.workers = [];
  s.zoo.keepers = 0;
  b.queue = [];
  b.riders = [];
  b.served = 0;
  b.revenue = 0;
  b.cycle = 0;
  b.open = true;
  b.tested = true;
  b.testing = undefined;
  b.condition = 100;
  O.resetRideOperations(b);
  O.initOperations(s);
  if (shared) assert.equal(A.setSharedAccess(s, b, true), null);
  const addGuest = () => {
    const g = {
      ...structuredClone(template),
      id: s.nextId++,
      x: 15,
      y: 20,
      state: "queue",
      target: b.id,
      route: [],
      timer: 0,
      rides: 0,
      visited: [],
      wallet: 100,
      happiness: 80,
      hunger: 0,
      thirst: 0,
      bladder: 0,
      energy: 100,
      waste: [],
      food: undefined,
      party: undefined,
      sharedExit: undefined,
    };
    s.guests.push(g);
    b.queue.push(g.id);
    return g;
  };
  const guests = Array.from({ length: count }, addGuest);
  return { s, b, guests, addGuest };
}
function until(f, predicate, limit = 200) {
  let elapsed = 0;
  while (!predicate() && elapsed < limit) {
    S.tick(f.s, 0.05);
    elapsed += 0.05;
  }
  assert(predicate(), `Condition not met after ${limit}s, wheel=${JSON.stringify(f.b.wheel)}`);
  return elapsed;
}
const view = (f) => W.wheelVisualState(f.b);

test("Each real guest boards a stationary cabin, then the next cabin indexes smoothly", () => {
  const f = fixture();
  S.tick(f.s, 0.05);
  assert.equal(f.b.riders.length, 1);
  assert.equal(view(f).phase, "loading");
  assert.equal(view(f).transfer.guestId, f.guests[0].id);
  assert.equal(view(f).transfer.direction, "boarding");
  const angle = view(f).angle;
  S.tick(f.s, 0.5);
  assert.equal(view(f).angle, angle);
  assert.equal(view(f).velocity, 0);
  until(f, () => view(f).phase === "indexing-load");
  const identity = [...view(f).gondolas];
  S.tick(f.s, 0.4);
  assert(view(f).angle > angle);
  assert(view(f).velocity > 0);
  assert.deepEqual(view(f).gondolas, identity);
  until(f, () => f.b.riders.length === 2);
  assert.equal(view(f).currentGondola, 7);
  assert.equal(view(f).gondolas[0], f.guests[0].id);
  assert.equal(view(f).gondolas[7], f.guests[1].id);
  assert.equal(view(f).velocity, 0);
  until(f, () => view(f).phase === "running");
  assert.equal(f.b.riders.length, 3);
  assert.equal(f.b.queue.length, 0);
  assert(S.validSave(f.s));
});

test("One visitor starts without waiting for a full wheel; three turns and next-program edits charge and reward once", () => {
  const f = fixture(1);
  O.setRideRounds(f.b, 3);
  assert(until(f, () => view(f).phase === "running", 3) <= 2);
  const start = view(f).angle,
    fee = f.b.price,
    paid = f.b.revenue;
  assert.equal(paid, fee);
  assert.equal(f.guests[0].wallet, 100 - fee);
  const rec = C.recordEdit(f.s, "Runden", () => O.setRideRounds(f.b, 5));
  assert(rec);
  S.tick(f.s, 2);
  const actual = JSON.stringify(f.b.wheel);
  assert.equal(C.undoEdits(f.s, [rec]), null);
  assert.equal(JSON.stringify(f.b.wheel), actual);
  assert.equal(f.b.wheel.programRounds, 3);
  until(f, () => view(f).phase === "unloading", 80);
  assert(Math.abs(view(f).angle - start - Math.PI * 6) < 1e-7);
  assert.equal(view(f).velocity, 0);
  assert.equal(f.guests[0].rides, 0);
  until(f, () => f.b.riders.length === 0);
  assert.equal(f.guests[0].rides, 1);
  assert.equal(f.guests[0].visited.filter((id) => id === f.b.id).length, 1);
  assert.equal(f.b.served, 1);
  assert.equal(f.b.revenue, paid);
  assert.equal(f.guests[0].wallet, 100 - fee);
});

test("Eight cabins retain their guest identities through rotation and unload only at the platform", () => {
  const f = fixture(8);
  until(f, () => view(f).phase === "running");
  assert.equal(f.b.riders.length, 8);
  const seats = [...view(f).gondolas];
  assert.equal(new Set(seats).size, 8);
  assert(!seats.includes(null));
  until(f, () => view(f).phase === "unloading");
  let previous = 8,
    releases = 0;
  while (f.b.riders.length) {
    const before = view(f),
      releaseId = before.phase === "unloading" ? before.gondolas[before.currentGondola] : null;
    S.tick(f.s, 0.05);
    if (f.b.riders.length !== previous) {
      assert.equal(previous - f.b.riders.length, 1);
      assert.notEqual(releaseId, null);
      assert.equal(f.guests.find((g) => g.id === releaseId).rides, 1);
      assert(
        Math.abs(Math.sin((view(f).angle + (before.currentGondola * Math.PI) / 4) / 2)) < 1e-6,
      );
      previous--;
      releases++;
    }
    for (let i = 0; i < 8; i++)
      if (view(f).gondolas[i] !== null) assert.equal(view(f).gondolas[i], seats[i]);
    assert(S.validSave(f.s));
  }
  assert.equal(releases, 8);
  assert(f.guests.every((g) => g.rides === 1));
});

for (const direct of [false, true])
  test(`Shared ${direct ? "direct path" : "queue corridor"} drains red exits completely before admitting a new blue guest`, () => {
    const f = fixture(2, true, direct);
    until(f, () => view(f).phase === "running");
    const next = f.addGuest();
    until(f, () => f.guests[0].sharedExit === f.b.id || f.guests[1].sharedExit === f.b.id);
    const outgoing = f.guests.find((g) => g.sharedExit === f.b.id);
    outgoing.timer = 15;
    until(f, () => f.b.riders.length === 0);
    assert(A.sharedExitPending(f.s, f.b));
    S.tick(f.s, 2);
    assert.equal(next.state, "queue");
    assert.equal(view(f).phase, "clearing");
    assert(O.hasOperator(f.b));
    assert(O.setRideStaffed(f.b, false));
    until(f, () => !A.sharedExitPending(f.s, f.b), 30);
    until(f, () => f.b.riders.includes(next.id), 5);
    assert(S.validSave(f.s));
  });

for (const problem of ["close", "broken", "access"])
  test(`${problem}: occupied wheel unloads one cabin at a time and retains crew until the final exit`, () => {
    const f = fixture(3, true);
    until(f, () => view(f).phase === "running");
    S.tick(f.s, 4);
    if (problem === "close") f.b.open = false;
    if (problem === "broken") f.b.condition = 0;
    if (problem === "access") f.s.tiles[20][14] = "grass";
    S.tick(f.s, 0.05);
    assert.equal(f.b.riders.length, 3, "Closing must not teleport all riders out");
    assert(["indexing-unload", "unloading"].includes(view(f).phase));
    assert(O.setRideStaffed(f.b, false));
    until(f, () => f.b.riders.length === 0, 30);
    assert.equal(f.b.served, 3);
    assert.equal(f.b.revenue, f.b.price * 3);
    assert(
      f.guests.every((g) => g.rides === 0),
      "Aborted trip must not award a completed programme",
    );
    until(f, () => view(f).phase === "idle", 30);
    assert.equal(O.setRideStaffed(f.b, false), null);
    assert(S.validSave(f.s));
  });

test("All wheel phases save/resume identically, keep exact seats, and remain motionless while paused", () => {
  const phases = [
    "loading",
    "indexing-load",
    "running",
    "indexing-unload",
    "unloading",
    "clearing",
  ];
  for (const phase of phases) {
    const f = fixture(3);
    until(f, () => view(f).phase === phase);
    assert(S.validSave(f.s), `Invalid ${phase}`);
    const resumed = JSON.parse(JSON.stringify(f.s));
    S.migratePark(resumed);
    const before = JSON.stringify(resumed);
    resumed.speed = 0;
    const frozen = JSON.stringify(resumed);
    S.tick(resumed, 8);
    assert.equal(JSON.stringify(resumed), frozen);
    resumed.speed = 1;
    assert.equal(JSON.stringify(resumed), before);
    for (let i = 0; i < 8; i++) {
      S.tick(f.s, 0.05);
      S.tick(resumed, 0.05);
    }
    assert.deepEqual(JSON.parse(JSON.stringify(f.s)), JSON.parse(JSON.stringify(resumed)), phase);
  }
});

test("Legacy occupied wheels migrate without rebilling; invalid or duplicate cabin guests are rejected", () => {
  const f = fixture(2);
  for (const g of f.guests) g.state = "ride";
  f.b.riders = f.b.queue.splice(0);
  f.b.cycle = 8;
  f.b.operations.phase = "running";
  f.b.operations.remainingRounds = 2;
  delete f.b.wheel;
  const before = JSON.stringify(f.b);
  W.wheelVisualState(f.b);
  assert.equal(JSON.stringify(f.b), before);
  assert(S.validSave(f.s));
  S.migratePark(f.s);
  const fees = f.b.revenue;
  until(f, () => f.b.riders.length === 0, 70);
  assert.equal(f.b.revenue, fees);
  assert(f.guests.every((g) => g.rides === 1));
  const g = fixture(2);
  S.tick(g.s, 0.1);
  const good = JSON.parse(JSON.stringify(g.s));
  for (const alter of [
    (b) => {
      b.wheel.gondolas[1] = b.wheel.gondolas[0];
    },
    (b) => {
      b.wheel.gondolas[0] = 999999;
    },
    (b) => {
      b.wheel.currentGondola = 9;
    },
    (b) => {
      b.wheel.phaseLeft = -1;
    },
    (b) => {
      b.wheel.angle = Infinity;
    },
  ]) {
    const bad = structuredClone(good);
    alter(bad.buildings[0]);
    assert(!S.validSave(bad));
  }
});

test("Relocation release and demolition undo discard cabin ids instead of resurrecting old passengers", () => {
  const f = fixture(2);
  until(f, () => view(f).phase === "running");
  C.releaseBuildingGuests(f.s, f.b);
  assert.equal(f.b.wheel, undefined);
  assert.equal(f.b.riders.length, 0);
  S.migratePark(f.s);
  assert(view(f).gondolas.every((id) => id === null));
  assert(S.validSave(f.s));
});

test("No affordable guest or missing crew cannot start a phantom programme", () => {
  const f = fixture(1);
  f.guests[0].wallet = 0;
  S.tick(f.s, 3);
  assert.equal(f.b.served, 0);
  assert.equal(f.b.riders.length, 0);
  assert.equal(view(f).phase, "idle");
  const n = fixture(1);
  O.setRideStaffed(n.b, false);
  S.tick(n.s, 3);
  assert.equal(n.b.served, 0);
  assert.equal(n.b.riders.length, 0);
  assert.equal(view(n).phase, "idle");
});
console.log(`${passed}/${passed} wheel boarding tests passed`);

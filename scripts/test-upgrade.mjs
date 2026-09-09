import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
import * as THREE from "three";
const S = await import(moduleURL("game/simulation.ts")),
  C = await import(moduleURL("game/construction.ts")),
  P = await import(moduleURL("game/prefabs.ts")),
  M = await import(moduleURL("game/motion.ts")),
  R = await import(moduleURL("game/ride-path.ts"));
let failed = 0;
const test = (name, fn) => {
  try {
    fn();
    console.log("PASS " + name);
  } catch (e) {
    failed++;
    console.error("FAIL " + name, e.stack);
  }
};
const clone = (v) => JSON.parse(JSON.stringify(v));
function empty() {
  const s = S.newPark("sandbox");
  s.buildings = [];
  s.guests = [];
  s.tiles = s.tiles.map((r) => r.map(() => "grass"));
  return s;
}
function service(n = 20) {
  const s = S.newPark(),
    b = s.buildings.find((b) => b.kind === "burger"),
    a = S.access(s, b);
  s.open = false;
  s.guests = Array.from({ length: n }, (_, i) => ({
    ...clone(s.guests[0]),
    id: 10000 + i,
    x: a.x,
    y: a.y,
    state: "walk",
    target: b.id,
    route: [],
    timer: 0,
    hunger: 80,
    wallet: 100,
  }));
  s.nextId = 11000;
  return { s, b };
}
test("Saved parks migrate without changing cash, geometry, guests or historical unlocks", () => {
  const old = clone(S.newPark());
  delete old.research;
  delete old.scenario;
  for (const g of old.guests) {
    delete g.profile;
    delete g.wallet;
    delete g.visited;
    delete g.bladder;
  }
  const before = clone(old);
  assert(S.validSave(old));
  S.migratePark(old);
  assert.equal(old.cash, before.cash);
  assert.deepEqual(
    old.buildings.map(({ pods, ...b }) => b),
    before.buildings.map(({ pods, ...b }) => b),
  );
  for (const b of old.buildings.filter((b) => b.pods))
    assert.deepEqual(
      S.access(old, b),
      S.access(
        before,
        before.buildings.find((x) => x.id === b.id),
      ),
    );
  assert.deepEqual(
    old.guests.map((g) => [g.id, g.x, g.y, g.happiness]),
    before.guests.map((g) => [g.id, g.x, g.y, g.happiness]),
  );
  assert(S.isUnlocked(old, "coaster", "launch"));
  assert(S.validSave(old));
});
test("Research costs once, pauses, completes in simulation time and gates construction atomically", () => {
  const s = S.newPark();
  const tree = s.buildings.find((b) => b.kind === "tree"),
    before = clone(s);
  const result = C.place(s, "drop", tree, undefined, true);
  assert(result.error);
  assert.deepEqual(clone(s), before);
  const cash = s.cash;
  assert.equal(S.startResearch(s, "family"), null);
  assert.equal(s.cash, cash - 1200);
  s.speed = 0;
  S.tick(s, 900);
  assert.equal(s.research.remaining, 90);
  s.speed = 3;
  S.tick(s, 30);
  assert.deepEqual(s.research.completed, ["family"]);
  assert(S.isUnlocked(s, "coaster", "wood"));
  assert(S.isUnlocked(s, "pirate"));
  const paid = s.cash;
  assert(S.startResearch(s, "family"));
  assert.equal(s.cash, paid);
  assert(S.startResearch(s, "launch"));
});
test("Different scenario maps and goals survive saves; sandbox unlocks everything", () => {
  const states = ["waldhain", "lakeside", "summit"].map((id) => S.newPark("scenario", id));
  assert.equal(new Set(states.map((s) => s.cash)).size, 3);
  assert.equal(new Set(states.map((s) => JSON.stringify(s.tiles))).size, 2);
  assert.equal(
    new Set(states.map((s) => s.buildings.filter((b) => S.isRide(b.kind)).length)).size,
    3,
  );
  for (const s of states) assert(S.validSave(clone(s)));
  assert(S.isUnlocked(S.newPark("sandbox"), "coaster", "launch"));
});
test("Family and thrill visitors prefer different intensity; price, queue and repeats reduce demand", () => {
  const s = S.newPark("sandbox"),
    wheel = s.buildings.find((b) => b.kind === "wheel");
  S.build(s, "drop", 3, 23);
  const drop = s.buildings.at(-1),
    g = { ...s.guests[0], x: 3, y: 23, profile: "thrill", visited: [] };
  assert(S.rideAppeal(drop, "thrill") > S.rideAppeal(wheel, "thrill"));
  assert(S.rideAppeal(wheel, "family") > S.rideAppeal(drop, "family"));
  const score = S.guestScore(drop, g);
  drop.price += 8;
  assert(S.guestScore(drop, g) < score);
  drop.price -= 8;
  drop.cycle = 30;
  assert(S.guestScore(drop, g) < score);
  drop.cycle = 0;
  g.visited = [drop.id];
  assert(S.guestScore(drop, g) < score);
});
test("Entry demand is continuous, price sensitive and zero for an empty park", () => {
  const s = S.newPark();
  let last = 1;
  for (let p = 0; p <= 30; p++) {
    s.ticket = p;
    const d = S.entryDemand(s);
    assert(d <= last);
    last = d;
  }
  s.ticket = 25;
  const a = S.entryDemand(s);
  s.ticket = 26;
  assert(S.entryDemand(s) > 0 && S.entryDemand(s) < a);
  s.buildings = [];
  assert.equal(S.entryDemand(s), 0);
});
test("Shops queue, obey service duration/capacity and charge once only after completion", () => {
  const { s, b } = service();
  const cash = s.cash;
  S.tick(s, 0.01);
  assert.equal(b.queue.length, 6);
  assert.equal(b.served, 0);
  S.tick(s, 0.01);
  assert.equal(b.riders.length, 1);
  assert.equal(b.served, 0);
  assert.equal(s.cash, cash);
  const g = s.guests.find((g) => g.id === b.riders[0]);
  assert(g.hunger > 79);
  S.tick(s, 2.9);
  assert.equal(b.served, 0);
  S.tick(s, 0.11);
  assert.equal(b.served, 1);
  assert.equal(g.rides, 0);
  assert(g.hunger < 1);
  assert.equal(g.wallet, 92);
  assert.equal(s.cash, cash + 8 - 3);
});
test("Unpaid service is canceled on closure; price is fixed at the start of service", () => {
  const { s, b } = service(1);
  S.tick(s, 0.01);
  S.tick(s, 0.01);
  const cash = s.cash;
  b.open = false;
  S.tick(s, 4);
  assert.equal(b.served, 0);
  assert.equal(s.cash, cash);
  const other = service(1);
  S.tick(other.s, 0.01);
  S.tick(other.s, 0.01);
  other.b.price = 30;
  S.tick(other.s, 3.1);
  assert.equal(other.b.revenue, 8);
  assert.equal(other.s.guests[0].wallet, 92);
});
test("Guests unable to pay do not create phantom cycles or block an affordable customer", () => {
  const { s, b } = service(2);
  S.tick(s, 0.01);
  s.guests[0].wallet = 0;
  S.tick(s, 0.01);
  assert.deepEqual(b.riders, [s.guests[1].id]);
  assert.equal(s.guests[0].state, "walk");
  assert.equal(b.cycle, 3);
});
test("Toilets require need and cannot be used as an unlimited free happiness loop", () => {
  const s = S.newPark();
  s.buildings = s.buildings.filter((b) => b.kind === "toilet");
  s.guests = s.guests.slice(0, 1);
  const g = s.guests[0],
    b = s.buildings[0];
  g.bladder = 0;
  g.x = b.x;
  g.y = b.y + 1;
  g.happiness = 50;
  g.hunger = 0;
  g.thirst = 0;
  s.ticket = 30;
  S.tick(s, 900);
  assert(b.served < 10);
  assert(!s.guests.length || s.guests[0].happiness < 70);
});
test("Demolition and construction cannot fake a positive operating-profit target", () => {
  const s = S.newPark("scenario", "summit");
  s.open = false;
  s.guests = [];
  S.remove(s, s.buildings[0].x, s.buildings[0].y);
  S.tick(s, 90);
  assert(s.operatingProfit < 0);
  assert.equal(s.won, false);
});
test("Draft and undo lengths survive save/restore; malformed research and geometry are rejected", () => {
  const s = S.newPark(),
    track = P.appendPiece(P.startTrack({ x: 3, y: 21 }), "rise");
  s.draft = { track, history: [1], rotation: 0, style: "steel" };
  assert(S.validSave(clone(s)));
  assert.deepEqual(clone(s).draft.track.slice(0, clone(s).draft.history[0]), [track[0]]);
  for (const r of [
    { completed: [], active: ["family"], remaining: 1 },
    { completed: [["launch"]], active: null, remaining: 0 },
  ]) {
    const bad = clone(s);
    bad.research = r;
    assert(!S.validSave(bad));
  }
  const same = clone(s),
    b = same.buildings.find((b) => b.track);
  b.track = Array.from({ length: 9 }, () => ({ ...track[0] }));
  assert(!S.validSave(same));
  const long = clone(s),
    coaster = long.buildings.find((b) => b.track);
  coaster.track = Array.from({ length: 9 }, (_, i) => ({
    ...track[0],
    x: i % 2 ? 29 : 0,
    y: i % 2 ? 29 : 0,
  }));
  assert(!S.validSave(long));
});
test("Self-collision is rejected before adding a piece while valid loopings and closure remain allowed", () => {
  const s = empty();
  let track = P.startTrack({ x: 14, y: 14 });
  for (let i = 0; i < 4; i++) {
    const next = P.appendPiece(track, "right");
    assert.equal(P.pieceError(s, track, next, true), null);
    track = next;
  }
  assert(P.pieceError(s, track, P.appendPiece(track, "right"), true));
  const start = P.startTrack({ x: 10, y: 10 }, 0, "launch");
  assert.equal(P.pieceError(s, start, P.appendPiece(start, "loop"), true), null);
});
test("2D and 3D use identical distance, duration, speed, inversion and camera direction", () => {
  for (const style of ["steel", "wood", "launch"])
    for (let rotation = 0; rotation < 4; rotation++) {
      const track = P.prefabBlueprint({ x: 14, y: 14 }, rotation, style),
        route = M.prepareRoute(track),
        path = R.makeRidePath(track);
      assert.equal(path.duration, route.duration);
      assert.equal(path.length, route.length * 5);
      for (let i = 0; i <= 100; i++) {
        const time = (route.duration * i) / 100,
          distance = M.trainDistance(route, i / 100),
          p = M.routePosition(route, distance),
          q = path.at(path.progress(time));
        assert(Math.abs(p.x * 5 - q.position.x) < 1e-6);
        assert(Math.abs(p.z * 5 + 1.1 - q.position.y) < 1e-6);
        assert(Math.abs(p.speed - q.speed) < 1e-5);
        assert(new THREE.Vector3(0, 0, -1).applyQuaternion(q.quaternion).dot(q.tangent) > 0.9999);
      }
      assert.equal(route.speeds[0], 0);
      assert.equal(route.speeds.at(-1), 0);
    }
});
test("Automatic test drives last exactly the same duration as a normal 3D ride", () => {
  const s = S.newPark(),
    b = s.buildings.find((b) => b.kind === "coaster");
  b.open = false;
  b.tested = false;
  assert.equal(C.connectBuilding(s, b, true), null);
  assert.equal(b.testing, R.makeRidePath(b.track).duration);
  const duration = b.testing;
  S.tick(s, duration - 0.05);
  assert(!b.tested);
  S.tick(s, 0.1);
  assert(b.tested && b.open);
});
process.exitCode = failed ? 1 : 0;

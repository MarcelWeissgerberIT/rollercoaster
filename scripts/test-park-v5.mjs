import assert from "node:assert/strict";
import * as THREE from "three";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  C = await import(moduleURL("game/construction.ts")),
  T = await import(moduleURL("game/transit.ts")),
  G = await import(moduleURL("game/grid.ts")),
  D = await import(moduleURL("game/designs.ts")),
  P = await import(moduleURL("game/prefabs.ts")),
  R = await import(moduleURL("game/attraction-rig.ts"));
let failures = 0;
const clone = structuredClone,
  test = (name, fn) => {
    try {
      fn();
      console.log("PASS " + name);
    } catch (e) {
      failures++;
      console.error("FAIL " + name, e.stack);
    }
  };
const guest = clone(S.newPark().guests[0]);
function empty() {
  const s = S.newPark("sandbox");
  s.buildings = [];
  s.guests = [];
  s.tiles = s.tiles.map((r) => r.map(() => "grass"));
  s.nextId = 1000;
  s.open = false;
  return s;
}
function transit(kind = "shuttle") {
  const s = empty();
  for (let x = 2; x <= 27; x++) s.tiles[20][x] = "path";
  for (let y = 20; y < 30; y++) s.tiles[y][15] = "path";
  const aId = S.build(s, kind, 2, 19).id,
    bId = S.build(s, kind, 27, 19).id,
    a = s.buildings.find((b) => b.id === aId),
    b = s.buildings.find((b) => b.id === bId);
  assert.equal(T.createTransitLine(s, a, b), null);
  return { s, a, b, line: s.transitLines[0] };
}
function queue(s, line, a, n = 1) {
  for (let i = 0; i < n; i++) {
    const g = {
      ...clone(guest),
      id: s.nextId++,
      x: 2,
      y: 20,
      state: "queue",
      target: null,
      route: [],
      wallet: 60,
      rides: 0,
      transit: { line: line.id, from: line.a, to: line.b },
      timer: 0,
    };
    s.guests.push(g);
    a.queue.push(g.id);
  }
  return s.guests;
}
const design = {
  id: "unique-design",
  name: "Sternentanz",
  mechanism: "teacups",
  theme: "star",
  color: "#9955bb",
  speed: 1.2,
  height: 2,
  seats: 10,
  seed: 234,
};
test("Old saves retain historical unlocks, while new workshop, orbital and transport stay gated", () => {
  const s = S.newPark();
  delete s.research;
  S.migratePark(s);
  assert.deepEqual(s.research.completed, ["family", "thrill", "launch"]);
  for (const kind of ["train", "shuttle", "custom", "spinner", "teacups"])
    assert.equal(S.isUnlocked(s, kind), false);
  s.research.completed.push("orbital");
  assert.equal(S.startResearch(s, "workshop"), null);
  assert(S.validSave(clone(s)));
  S.tick(s, 270);
  assert(S.isUnlocked(s, "custom"));
});
test("Land expansion preserves coordinates and permits construction, connections, undo and saves beyond tile29", () => {
  const s = empty(),
    oldId = S.build(s, "burger", 4, 4).id;
  assert.equal(G.expandPark(s, "east"), null);
  assert.equal(G.expandPark(s, "south"), null);
  assert.equal(G.mapWidth(s), 36);
  assert.equal(G.mapHeight(s), 36);
  assert.equal(s.buildings.find((b) => b.id === oldId).x, 4);
  for (let y = 29; y < 36; y++) s.tiles[y][15] = "path";
  for (let x = 15; x <= 35; x++) s.tiles[35][x] = "path";
  const edit = C.recordEdit(s, "new territory", () =>
    assert(C.place(s, "burger", { x: 34, y: 34 }).id),
  );
  assert(S.access(s, s.buildings.at(-1)));
  assert(S.validSave(clone(s)));
  C.undoEdits(s, [edit]);
  assert(!s.buildings.some((b) => b.x === 34));
  assert.equal(s.tiles.length, 36);
  assert(S.validSave(s));
});
test("Rejected land purchase is atomic and the maximum rectangular park stays valid", () => {
  const s = empty();
  s.cash = 1;
  const before = clone(s);
  assert(G.expandPark(s, "east"));
  assert.deepEqual(s, before);
  s.cash = 1e6;
  for (let i = 0; i < 4; i++) {
    assert.equal(G.expandPark(s, "east"), null);
    assert.equal(G.expandPark(s, "south"), null);
  }
  assert.equal(G.mapWidth(s), 54);
  assert(G.expandPark(s, "east"));
  assert(S.validSave(s));
  s.tiles[0].pop();
  assert(!S.validSave(s));
});
test("Custom attraction stats are derived, affordable placement is atomic, and built designs are independent", () => {
  const s = empty();
  assert.equal(D.validDesign(design), true);
  s.cash = D.designStats(design).cost - 1;
  const before = clone(s);
  assert(C.place(s, "custom", { x: 6, y: 6 }, undefined, true, design).error);
  assert.deepEqual(s, before);
  s.cash++;
  assert(C.place(s, "custom", { x: 6, y: 6 }, undefined, true, design).id);
  const built = s.buildings[0],
    d = clone(design);
  d.name = "Changed";
  assert.equal(built.design.name, "Sternentanz");
  assert.equal(S.rideCapacity(built), 10);
  assert.equal(S.rideDuration(built), 23);
  assert(S.validSave(clone(s)));
  built.design.art = "https://external.example/file.png";
  assert(!S.validSave(s));
});
test("Design library rejects invalid mechanisms, foreign image URLs and unbounded imported parameters", () => {
  for (const bad of [
    { speed: 100 },
    { height: 100 },
    { seats: 10000 },
    { mechanism: "__proto__" },
    { color: "url(x)" },
    { art: "<svg>" },
    { name: "" },
  ])
    assert.equal(D.validDesign({ ...design, ...bad }), false);
  assert.equal(D.parseDesignLibrary(JSON.stringify([design, { ...design, speed: -1 }])).length, 1);
});
test("A waiting vehicle is chosen when faster, including the final walk into a ride queue", () => {
  const { s, line, a } = transit();
  s.tiles[21][27] = "queue";
  const g = {
    ...clone(guest),
    id: s.nextId++,
    x: 2,
    y: 20,
    route: [],
    target: null,
    state: "walk",
    wallet: 60,
  };
  s.guests.push(g);
  assert(T.chooseTransit(s, g, { x: 27, y: 21 }, S.findRoute(s, g, { x: 27, y: 21 })));
  assert.equal(g.state, "queue");
  assert(a.queue.includes(g.id));
  assert.equal(
    T.chooseTransit(
      s,
      { ...g, transit: undefined },
      { x: 5, y: 20 },
      S.findRoute(s, g, { x: 5, y: 20 }),
    ),
    false,
  );
  line.wait = 0.25;
  T.tickTransit(s, 0.25);
  assert(line.passengers.includes(g.id));
});
test("Shuttle capacity8 leaves the ninth guest waiting, charges once on arrival and grants no ride credit", () => {
  const { s, line, a } = transit();
  queue(s, line, a, 9);
  const cash = s.cash;
  T.tickTransit(s, 4);
  assert.equal(line.passengers.length, 8);
  assert.equal(a.queue.length, 1);
  assert.equal(s.cash, cash);
  T.tickTransit(s, 25 / T.transportSpeed("shuttle"));
  assert.equal(line.passengers.length, 0);
  assert.equal(line.served, 8);
  assert.equal(s.cash, cash + 16);
  assert(s.guests.every((g) => g.rides === 0));
  assert.equal(s.guests[0].x, 27);
  assert(S.validSave(clone(s)));
  T.tickTransit(s, 1);
  assert.equal(s.cash, cash + 16);
});
test("Transit integration and save/resume are independent of normal or triple-speed timestep", () => {
  const a = transit(),
    b = clone(a.s);
  queue(a.s, a.line, a.a, 3);
  const saved = clone(a.s);
  for (let t = 0; t < 120; t += 0.25) T.tickTransit(a.s, 0.25);
  for (let t = 0; t < 120; t += 0.75) T.tickTransit(saved, 0.75);
  assert(Math.abs(a.line.position - saved.transitLines[0].position) < 1e-7);
  assert(Math.abs(a.line.wait - saved.transitLines[0].wait) < 1e-7);
  assert.equal(a.s.cash, saved.cash);
  const resumed = clone(a.s);
  assert(S.validSave(resumed));
  T.tickTransit(a.s, 3);
  T.tickTransit(resumed, 3);
  assert.deepEqual(a.s, resumed);
});
test("Line interruption releases actual passengers without teleporting people waiting at the origin", () => {
  const { s, line, a } = transit();
  queue(s, line, a, 9);
  T.tickTransit(s, 8);
  const waiter = s.guests[8];
  assert.equal(waiter.x, 2);
  line.position = 20;
  line.enabled = false;
  T.tickTransit(s, 0);
  assert.equal(waiter.x, 2);
  assert.equal(s.guests[0].x, 27);
  assert(s.guests.every((g) => !g.transit && g.state === "walk"));
  assert.equal(line.position, 25);
  assert.equal(line.direction, -1);
  assert(S.validSave(s));
});
test("Additional roads do not change a live stop attachment and route jumps are rejected", () => {
  const { s, line, a } = transit();
  const original = clone(T.stopAccess(s, a));
  s.tiles[a.y][a.x - 1] = "path";
  assert.deepEqual(T.stopAccess(s, a), original);
  assert(T.transitValid(s, line));
  line.route = [line.route[0], line.route.at(-1)];
  assert(!T.transitValid(s, line));
  assert(!S.validSave(s));
});
test("Destination demolition leaves passengers on their vehicle until the actual destination stop", () => {
  const { s, line, a } = transit();
  const goal = S.build(s, "burger", 27, 21).id;
  queue(s, line, a);
  s.guests[0].target = goal;
  T.tickTransit(s, 6);
  S.remove(s, 27, 21);
  assert.equal(s.guests[0].state, "ride");
  assert.equal(s.guests[0].target, null);
  assert(S.validSave(s));
  T.tickTransit(s, 10);
  assert.equal(s.guests[0].x, 27);
  assert.equal(s.guests[0].wallet, 58);
  assert.equal(s.guests[0].transit, undefined);
});
test("Undo changes only affected transport configuration and preserves another line operating state", () => {
  const { s, line, a } = transit();
  queue(s, line, a, 2);
  const record = C.recordEdit(s, "other line", () => {
    for (let x = 2; x <= 27; x++) s.tiles[25][x] = "path";
    const a = S.build(s, "train", 2, 24).id,
      b = S.build(s, "train", 27, 24).id;
    assert.equal(
      T.createTransitLine(
        s,
        s.buildings.find((x) => x.id === a),
        s.buildings.find((x) => x.id === b),
      ),
      null,
    );
  });
  T.tickTransit(s, 15);
  const expected = clone(line);
  C.undoEdits(s, [record]);
  assert.deepEqual(s.transitLines[0], expected);
  assert.equal(s.transitLines.length, 1);
  assert(S.validSave(s));
});
test("A relocated stop can reconnect its route, preserve totals and undo to the original route", () => {
  const { s, line, b } = transit();
  line.served = 5;
  line.revenue = 10;
  assert.equal(C.adjustBuilding(s, b, "move", { x: 25, y: 19 }), null);
  assert(!T.transitValid(s, line));
  const record = C.recordEdit(s, "repair", () => assert.equal(T.repairTransit(s, line), null));
  assert(T.transitValid(s, line));
  assert.equal(line.served, 5);
  assert.equal(line.revenue, 10);
  assert.equal(line.route.at(-1).x, 25);
  C.undoEdits(s, [record]);
  assert.equal(s.transitLines[0].route.at(-1).x, 27);
  assert(S.validSave(s));
});
test("Malformed save passenger/queue references and inconsistent mid-route boarding are rejected", () => {
  const { s, line, a } = transit();
  queue(s, line, a);
  T.tickTransit(s, 4);
  assert(S.validSave(s));
  let bad = clone(s);
  bad.transitLines[0].passengers.push(bad.guests[0].id);
  assert(!S.validSave(bad));
  bad = clone(s);
  bad.guests[0].state = "walk";
  assert(!S.validSave(bad));
  bad = clone(s);
  bad.transitLines[0].position = 5;
  bad.transitLines[0].wait = 3;
  assert(!S.validSave(bad));
});
test("Transport3D starts at its actual position, dwells four seconds and keeps continuous headings at corners", () => {
  const { line } = transit();
  line.position = 7;
  line.direction = -1;
  line.wait = 0;
  const live = T.transportPose(line),
    preview = T.transportPose(line, T.transportClock(line));
  assert(Math.abs(live.x - preview.x) < 1e-9);
  assert.equal(live.direction, preview.direction);
  assert.equal(T.transportPose(line, 2).x, 2);
  line.route = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
    { x: 3, y: 2 },
  ];
  line.position = 0.999;
  const a = T.transportPose(line);
  line.position = 1.001;
  const b = T.transportPose(line);
  assert(Math.hypot(a.headingX - b.headingX, a.headingY - b.headingY) < 0.02);
});
test("Every custom mechanism supports4–16 distinct real seats, occupied people and finite camera frames", () => {
  const s = empty();
  for (const mechanism of Object.keys(D.MECHANISMS))
    for (let capacity = 4; capacity <= 16; capacity++) {
      const b = {
          id: 1,
          kind: "custom",
          x: 5,
          y: 5,
          name: "Rig",
          open: true,
          tested: true,
          price: 1,
          served: 0,
          revenue: 0,
          queue: [],
          riders: [1, 2, 3],
          cycle: 0,
          design: { ...design, mechanism, seats: capacity, height: 3 },
        },
        rig = R.createAttractionRig(b, s);
      assert.equal(rig.seats.length, capacity);
      assert.equal(rig.passengers.filter((p) => p.visible).length, 3);
      for (const t of [0, 0.2, 0.5, 0.7, 0.99]) {
        rig.update(t * rig.duration);
        const positions = rig.seats.map((seat) => seat.getWorldPosition(new THREE.Vector3()));
        for (let i = 0; i < capacity; i++) {
          const q = rig.seats[i].getWorldQuaternion(new THREE.Quaternion());
          assert(Math.abs(q.length() - 1) < 1e-9);
          assert(positions[i].toArray().every(Number.isFinite));
          for (let j = 0; j < i; j++)
            assert(positions[i].distanceTo(positions[j]) > 0.5, mechanism + " overlapping seats");
        }
      }
    }
});
test("Conflict alternatives really pass placement preflight and can be appended as one undo step", () => {
  const s = empty(),
    track = P.startTrack({ x: 8, y: 8 }, 0, "steel");
  s.tiles[8][10] = "path";
  const next = P.appendPiece(track, "straight");
  assert(P.pieceError(s, track, next, true));
  const choices = P.suggestPieces(s, track, "straight");
  assert(choices.length);
  for (const choice of choices) {
    let old = track;
    for (const part of choice.pieces) {
      const next = P.appendPiece(old, part);
      assert.equal(P.pieceError(s, old, next, true), null);
      old = next;
    }
    assert.deepEqual(old, choice.track);
  }
});
if (failures) process.exit(1);

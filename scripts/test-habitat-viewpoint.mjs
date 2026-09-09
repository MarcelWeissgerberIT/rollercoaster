import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  A = await import(moduleURL("game/zoo-access.ts")),
  C = await import(moduleURL("game/construction.ts")),
  V = await import(moduleURL("game/habitat-viewpoint.ts"));
const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, pass: true });
  } catch (e) {
    results.push({ name, pass: false, error: e.message.slice(0, 1000) });
  }
  console.log(JSON.stringify(results.at(-1)));
}
function park() {
  const s = S.newPark("sandbox"),
    template = structuredClone(s.guests[0]);
  s.buildings = [];
  s.guests = [];
  s.transitLines = [];
  s.zoo = { keepers: 0, workers: [], nextId: 1 };
  s.tiles = s.tiles.map((row) => row.map(() => "grass"));
  s.cash = 100000;
  s.speed = 1;
  s.time = 0;
  s.staff = 0;
  s.open = false;
  for (let y = 12; y < 30; y++) s.tiles[y][15] = "path";
  for (let x = 4; x <= 15; x++) s.tiles[12][x] = "path";
  for (let y = 10; y <= 12; y++) s.tiles[y][5] = "path";
  for (let x = 5; x <= 9; x++) s.tiles[10][x] = "path";
  const built = S.build(s, "zebra", 5, 5);
  assert(!built.error, built.error);
  const b = s.buildings.find((item) => item.id === built.id);
  b.habitat.count = 2;
  b.open = true;
  return { s, b, template };
}
function guest(s, b, template, x = 5, y = 12) {
  const g = {
    ...structuredClone(template),
    id: s.nextId++,
    state: "walk",
    target: b.id,
    x,
    y,
    route: [],
    timer: 0,
    wallet: 40,
    hunger: 0,
    thirst: 0,
    bladder: 0,
  };
  s.guests.push(g);
  return g;
}
test("Legacy habitats retain all connected fence viewing spots and save compatibility", () => {
  const { s, b } = park();
  delete b.habitat.accessVersion;
  assert.equal(A.habitatViewingSpots(s, b).length, 5);
  assert.equal(V.viewpointStatus(s, b).point, null);
  assert.equal(V.viewpointStatus(s, b).connected, true);
  assert(S.validSave(structuredClone(s)));
  S.migratePark(s);
  assert.equal(b.habitat.viewpoint, undefined);
  assert.equal(A.habitatViewingSpots(s, b).length, 5);
});
test("Selecting an existing path is free and gathers guests at at most three same-side spots", () => {
  const { s, b } = park(),
    cash = s.cash,
    expenses = s.expenses;
  assert.equal(V.setHabitatViewpoint(s, b, { x: 7, y: 10 }), null);
  assert.equal(s.cash, cash);
  assert.equal(s.expenses, expenses);
  assert.equal(b.open, true);
  assert.equal(V.viewpointStatus(s, b).connected, true);
  assert.deepEqual(
    A.habitatViewingSpots(s, b)
      .map((p) => `${p.x},${p.y}`)
      .sort(),
    ["6,10", "7,10", "8,10"],
  );
  assert.deepEqual(S.access(s, b), { x: 7, y: 10 });
  assert.equal(b.pods, undefined);
  assert(S.validSave(JSON.parse(JSON.stringify(s))));
});
test("A disconnected marker creates one ordinary path and blocks access until it is connected", () => {
  const { s, b } = park(),
    cash = s.cash;
  assert.equal(V.setHabitatViewpoint(s, b, { x: 7, y: 4 }), null);
  assert.equal(s.cash, cash - 12);
  assert.equal(s.tiles[4][7], "path");
  assert.equal(b.open, false);
  assert.equal(V.viewpointStatus(s, b).connected, false);
  assert.match(V.viewpointStatus(s, b).label, /verbinden/);
  assert.deepEqual(A.habitatViewingSpots(s, b), []);
  assert.equal(S.access(s, b), undefined);
  const plan = C.planConnection(s, b);
  assert.equal(plan.error, null);
  assert(plan.points.length > 0);
  assert.equal(C.connectBuilding(s, b), null);
  assert.equal(b.open, true);
  assert.equal(V.viewpointStatus(s, b).connected, true);
  assert.deepEqual(S.access(s, b), { x: 7, y: 4 });
  assert.equal(s.cash, cash - 12 - plan.cost);
  assert(S.validSave(s));
});
test("Placement and clearing never implicitly reopen a closed habitat", () => {
  const { s, b } = park();
  b.open = false;
  assert.equal(V.setHabitatViewpoint(s, b, { x: 7, y: 10 }), null);
  assert.equal(b.open, false);
  assert.equal(V.clearHabitatViewpoint(s, b), null);
  assert.equal(b.open, false);
});
test("Selecting the same connected marker preserves ongoing observations", () => {
  const { s, b, template } = park();
  V.setHabitatViewpoint(s, b, { x: 7, y: 10 });
  const g = guest(s, b, template, 7, 10);
  g.state = "observe";
  g.timer = 10;
  const before = structuredClone(s);
  assert.equal(V.setHabitatViewpoint(s, b, { x: 7, y: 10 }), null);
  assert.deepEqual(s, before);
});
test("Invalid cells, occupied cells and insufficient budget leave the park unchanged", () => {
  for (const p of [
    { x: 4, y: 4 },
    { x: 5, y: 5 },
    { x: -1, y: 4 },
    { x: 7.5, y: 4 },
    { x: NaN, y: 4 },
    { x: 7, y: Infinity },
  ]) {
    const { s, b } = park(),
      before = structuredClone(s);
    assert(V.setHabitatViewpoint(s, b, p));
    assert.deepEqual(s, before);
  }
  for (const tile of ["water", "queue", "exit"]) {
    const { s, b } = park();
    s.tiles[4][7] = tile;
    const before = structuredClone(s);
    assert(V.setHabitatViewpoint(s, b, { x: 7, y: 4 }));
    assert.deepEqual(s, before);
  }
  const { s, b } = park();
  assert(!S.build(s, "tree", 7, 4).error);
  const before = structuredClone(s);
  assert(V.setHabitatViewpoint(s, b, { x: 7, y: 4 }));
  assert.deepEqual(s, before);
  s.cash = 0;
  const poor = structuredClone(s);
  assert(V.setHabitatViewpoint(s, b, { x: 8, y: 4 }));
  assert.deepEqual(s, poor);
  assert.equal(V.setHabitatViewpoint(s, b, { x: 7, y: 10 }), null);
});
test("Candidates contain only free side-adjacent perimeter cells", () => {
  const { s, b } = park();
  s.tiles[4][7] = "water";
  assert(!S.build(s, "tree", 8, 4).error);
  const candidates = V.habitatViewpointCandidates(s, b);
  assert.equal(candidates.length, 18);
  assert(!candidates.some((p) => (p.x === 7 || p.x === 8) && p.y === 4));
  assert(!candidates.some((p) => p.x === 4 && p.y === 4));
});
test("Guests walk to the terrace and observe there without queueing or paying", () => {
  const { s, b, template } = park();
  V.setHabitatViewpoint(s, b, { x: 8, y: 10 });
  const guests = Array.from({ length: 6 }, () => guest(s, b, template));
  const cash = s.cash;
  for (let i = 0; i < 80 && guests.some((g) => g.state !== "observe"); i++) S.tick(s, 0.1);
  assert(
    guests.every((g) => g.state === "observe"),
    JSON.stringify(guests.map((g) => [g.state, g.x, g.y])),
  );
  const spots = A.habitatViewingSpots(s, b);
  assert(guests.every((g) => spots.some((p) => Math.hypot(p.x - g.x, p.y - g.y) < 0.2)));
  assert(new Set(guests.map((g) => `${Math.round(g.x)},${Math.round(g.y)}`)).size >= 2);
  assert.deepEqual(b.queue, []);
  assert.equal(b.revenue, 0);
  assert.equal(s.cash, cash);
  assert(guests.every((g) => g.wallet === 40));
  assert(S.validSave(s));
});
test("Changing the point reroutes walkers and observers without teleporting", () => {
  const { s, b, template } = park();
  V.setHabitatViewpoint(s, b, { x: 5, y: 10 });
  const observer = guest(s, b, template, 5, 10),
    walker = guest(s, b, template, 5, 11);
  observer.state = "observe";
  observer.timer = 8;
  walker.route = [{ x: 5, y: 10 }];
  const positions = [observer, walker].map((g) => [g.x, g.y]);
  V.setHabitatViewpoint(s, b, { x: 9, y: 10 });
  assert.deepEqual(
    [observer, walker].map((g) => [g.x, g.y]),
    positions,
  );
  assert(
    [observer, walker].every(
      (g) => g.state === "walk" && g.target === b.id && g.route.at(-1)?.x >= 8,
    ),
  );
  for (let i = 0; i < 65 && [observer, walker].some((g) => g.state !== "observe"); i++)
    S.tick(s, 0.1);
  assert([observer, walker].every((g) => g.state === "observe"));
});
test("Removing a terrace path releases observers; clearing the marker restores fence access", () => {
  const { s, b, template } = park();
  V.setHabitatViewpoint(s, b, { x: 7, y: 10 });
  const g = guest(s, b, template, 7, 10);
  g.state = "observe";
  g.timer = 10;
  S.remove(s, 7, 10);
  assert.equal(S.access(s, b), undefined);
  S.tick(s, 0.1);
  assert.equal(g.state, "walk");
  assert.equal(g.target, null);
  assert.equal(s.tiles[Math.round(g.y)][Math.round(g.x)], "path");
  assert(S.validSave(s));
  const cash = s.cash;
  assert.equal(V.clearHabitatViewpoint(s, b), null);
  assert.equal(s.cash, cash);
  assert(A.habitatViewingSpots(s, b).length > 0);
  assert.equal(b.habitat.viewpoint, undefined);
});
test("Save validation rejects invalid marker geometry but allows removed-path markers", () => {
  for (const p of [
    null,
    { x: NaN, y: 10 },
    { x: 7.5, y: 10 },
    { x: 7, y: 5 },
    { x: 4, y: 4 },
    { x: 100, y: 10 },
  ]) {
    const { s, b } = park();
    b.habitat.viewpoint = p;
    assert.equal(S.validSave(s), false, JSON.stringify(p));
  }
  const { s, b } = park();
  b.habitat.viewpoint = { x: 7, y: 4 };
  assert(S.validSave(s));
});
test("Moves translate markers and undo restores them without rewinding animal care or removing paths", () => {
  const { s, b } = park();
  V.setHabitatViewpoint(s, b, { x: 7, y: 10 });
  const edit = C.recordEdit(s, "Gehege versetzen", () => {
    assert.equal(C.adjustBuilding(s, b, "move", { x: 19, y: 5 }), null);
  });
  assert(edit);
  assert.deepEqual(b.habitat.viewpoint, { x: 21, y: 10 });
  assert.equal(s.tiles[10][7], "path");
  assert.equal(b.open, false);
  assert.equal(V.viewpointStatus(s, b).connected, false);
  assert(S.validSave(s));
  b.habitat.food = 44;
  C.undoEdits(s, [edit]);
  assert.deepEqual(b.habitat.viewpoint, { x: 7, y: 10 });
  assert.equal(b.habitat.food, 44);
  assert.equal(b.open, true);
  assert(S.validSave(s));
});
test("Moving a marker outside the map clears it and preserves a valid save", () => {
  const { s, b } = park();
  V.setHabitatViewpoint(s, b, { x: 9, y: 10 });
  assert.equal(C.adjustBuilding(s, b, "move", { x: 20, y: 25 }), null);
  assert.equal(b.habitat.viewpoint, undefined);
  assert.equal(s.tiles[10][9], "path");
  assert(S.validSave(s));
});
test("Marker changes on existing paths can be undone without reverting animal care", () => {
  const { s, b } = park(),
    cash = s.cash;
  const edit = C.recordEdit(s, "Aussichtspunkt", () =>
    V.setHabitatViewpoint(s, b, { x: 7, y: 10 }),
  );
  assert(edit);
  b.habitat.water = 56;
  C.undoEdits(s, [edit]);
  assert.equal(b.habitat.viewpoint, undefined);
  assert.equal(b.habitat.water, 56);
  assert.equal(s.cash, cash);
  assert.equal(b.open, true);
});
test("Opening a habitat with a safety stop or no animals fails without spending", () => {
  for (const safety of [true, false]) {
    const { s, b } = park();
    V.setHabitatViewpoint(s, b, { x: 7, y: 4 });
    if (safety) b.habitat.safety = { condition: 10, electric: false };
    else b.habitat.count = 0;
    const before = structuredClone(s);
    assert(C.connectBuilding(s, b));
    assert.deepEqual(s, before);
  }
});
console.log(`${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exitCode = results.every((r) => r.pass) ? 0 : 1;

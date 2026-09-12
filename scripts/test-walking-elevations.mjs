import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  T = await import(moduleURL("game/terrain.ts")),
  G = await import(moduleURL("game/grid.ts")),
  F = await import(moduleURL("game/free-play.ts"));
let passed = 0;
function test(name, run) {
  run();
  passed++;
  console.log("PASS", name);
}

test("Natural hills retain the flat path network and route behavior", () => {
  const s = F.createFreePark(),
    expected = G.pathRoute(s, { x: 15, y: 29 }, { x: 15, y: 26 });
  s.terrain = { "0,0": 4, "1,0": 3, "2,0": -1 };
  assert(T.hasElevations(s), "Rendering still sees the landscape");
  assert(!T.hasWalkingElevations(s));
  assert.deepEqual(G.pathRoute(s, { x: 15, y: 29 }, { x: 15, y: 26 }), expected);
  assert.deepEqual(S.findRoute(s, { x: 15, y: 29 }, { x: 15, y: 26 }), expected.slice(1));
  assert.equal(S.connected(s).size, 4);
});

test("In-place path and terrain edits immediately change the routing mode", () => {
  const s = F.createFreePark();
  s.terrain = { "15,25": 1 };
  assert(!T.hasWalkingElevations(s));
  for (const tile of ["path", "queue", "exit"]) {
    s.tiles[25][15] = tile;
    assert(T.hasWalkingElevations(s), tile);
    assert(!S.connected(s).has("15,25"), "No step up a cliff");
  }
  s.tiles[25][15] = "path";
  s.terrain["15,25"] = 0;
  assert(!T.hasWalkingElevations(s));
  assert(S.connected(s).has("15,25"));
  s.terrain["15,25"] = -1;
  assert(T.hasWalkingElevations(s));
  assert(!S.connected(s).has("15,25"));
  s.tiles[25][15] = "grass";
  assert(!T.hasWalkingElevations(s));
});

test("Ramps retain distinct bridge levels, raised ground paths and directed exits", () => {
  const s = F.createFreePark();
  s.terrain = { "15,23": 1, "16,23": 1 };
  s.tiles[23][15] = "path";
  s.tiles[23][14] = "path";
  s.tiles[23][16] = "exit";
  s.tiles[23][17] = "exit";
  s.elevatedPaths = [
    { x: 15, y: 25, z: 0, slope: 3, type: "path", style: "boardwalk" },
    { x: 15, y: 24, z: 1, type: "path", style: "boardwalk" },
  ];
  assert(T.hasWalkingElevations(s));
  const net = S.connected(s);
  assert(net.has("15,25,0.5"));
  assert(net.has("15,24,1"));
  assert(net.has("15,23"));
  assert(!net.has("14,23"), "The public path below is not reachable through a raised edge");
  const route = G.pathRoute(s, { x: 15, y: 29 }, { x: 15, y: 23, z: 1 });
  assert.equal(route.length, 7);
  assert.equal(route.at(-1).z, 1);
  const exits = S.exitNetwork(s, net);
  assert(exits.has("16,23"));
  assert(!exits.has("17,23"), "Exits cannot step off a raised path");
});

test("A tunnel deck requires routing even when every walking height is zero", () => {
  const s = F.createFreePark();
  s.terrain = { "15,25": 2 };
  s.elevatedPaths = [{ x: 15, y: 25, z: 0, type: "path", style: "stone" }];
  assert(T.hasWalkingElevations(s));
  assert(S.connected(s).has("15,25,0"));
  assert.equal(G.pathRoute(s, { x: 15, y: 29 }, { x: 15, y: 25, z: 0 }).length, 5);
  s.elevatedPaths.length = 0;
  assert(!T.hasWalkingElevations(s));
  assert(!S.connected(s).has("15,25,0"));
});

test("Raised attraction entrances and exits never connect to a flat road below", () => {
  const s = F.createFreePark(),
    result = S.build(s, "wheel", 16, 26);
  assert(result.id, result.error);
  const b = s.buildings.find((b) => b.id === result.id);
  b.pods = { entry: { side: 2, offset: 0 }, exit: { side: 2, offset: 1 } };
  assert(S.access(s, b));
  assert.equal(S.exitPath(s, b).length, 1);
  b.z = 1;
  assert(!T.hasWalkingElevations(s), "Only the building is raised");
  assert.equal(S.access(s, b), undefined);
  assert.deepEqual(S.exitPath(s, b), []);
  delete b.z;
  s.terrain = { "16,26": 1 };
  assert.equal(S.access(s, b), undefined, "Legacy building z follows its foundation");
  assert.deepEqual(S.exitPath(s, b), []);
});

test("Simulation scopes are discarded on return and error, with no stale future edits", () => {
  const s = F.createFreePark();
  s.terrain = { "15,25": 1 };
  T.withWalkingElevationScope(s, () => {
    assert(!T.hasWalkingElevations(s));
    T.withWalkingElevationScope(s, () => assert(!T.hasWalkingElevations(s)));
  });
  s.tiles[25][15] = "path";
  assert(T.hasWalkingElevations(s));
  assert.throws(() =>
    T.withWalkingElevationScope(s, () => {
      throw Error("scope cleanup");
    }),
  );
  s.tiles[25][15] = "grass";
  assert(!T.hasWalkingElevations(s));
  S.tick(s, 0.1);
  s.tiles[25][15] = "path";
  assert(T.hasWalkingElevations(s));
  assert(!S.connected(s).has("15,25"));
});

console.log(`${passed} walking-elevation tests passed.`);

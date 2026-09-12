import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  N = await import(moduleURL("game/new-game.ts")),
  T = await import(moduleURL("game/terrain.ts")),
  Surface = await import(moduleURL("game/terrain-surface.ts")),
  Campaign = await import(moduleURL("game/campaigns.ts")),
  Birds = await import(moduleURL("game/birds.ts")),
  BirdCanvas = await import(moduleURL("game/bird-canvas.ts"));
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("PASS", name);
}
const copy = (s) => JSON.parse(JSON.stringify(s));

test("Every new campaign has real relief and retains reachable starting attractions", () => {
  for (const id of Object.keys(S.SCENARIOS)) {
    const flat = S.newPark("scenario", id),
      park = N.createLandscapePark("scenario", id, 1234);
    assert(Object.keys(park.terrain).length > 100, id + " contains meaningful terrain");
    assert(
      Math.max(...Object.values(park.terrain)) >= 2,
      id + " has a gentle ridge at least 10m high",
    );
    assert.equal(park.naturalTerrain, true);
    assert.deepEqual(
      [...S.connected(park)].sort(),
      [...S.connected(flat)].sort(),
      id + " paths remain reachable",
    );
    for (const b of flat.buildings.filter((b) => !["tree", "pine", "flowers"].includes(b.kind))) {
      const fresh = park.buildings.find((v) => v.id === b.id);
      assert(fresh, id + " keeps its existing buildings");
      assert.deepEqual(S.access(park, fresh), S.access(flat, b), id + " keeps access to " + b.kind);
      for (const p of S.footprint(fresh)) assert.equal(T.terrainHeight(park, p.x, p.y), 0);
      assert.equal(fresh.condition, b.condition);
    }
    for (const key of ["cash", "income", "expenses", "dayExpenses", "arrivals", "staff"])
      assert.equal(
        park[key],
        flat[key],
        id + " no landscape charge or changed start conditions: " + key,
      );
    assert(S.validSave(copy(park)), id + " is a valid save");
  }
});

test("Free parks combine lake, woodland groves and rolling land with an empty entrance meadow", () => {
  const park = N.createLandscapePark("sandbox", "waldhain", 42);
  assert(park.unlimitedBudget);
  assert.equal(park.cash, 0);
  assert.equal(park.expenses, 0);
  assert.equal(park.guests.length, 0);
  assert(park.tiles.flat().filter((t) => t === "water").length >= 20);
  assert(park.buildings.length >= 15);
  assert(park.buildings.every((b) => ["tree", "pine"].includes(b.kind)));
  assert(Object.values(park.terrain).filter((z) => z > 0).length >= 250);
  for (let y = 22; y <= 29; y++)
    for (let x = 10; x <= 20; x++) {
      assert.equal(T.terrainHeight(park, x, y), 0);
      assert.equal(S.occupant(park, x, y), undefined);
    }
  assert(S.build(park, "wheel", 11, 23).id, "A first large attraction fits without terraforming");
  for (const b of park.buildings.filter((b) => ["tree", "pine"].includes(b.kind)))
    assert.equal(b.z ?? 0, T.terrainHeight(park, b.x, b.y), "Tree base follows real elevation");
  assert(S.validSave(copy(park)));
});

test("Seeded landforms vary across games without jagged height spikes or raised paths", () => {
  const signatures = new Set();
  for (let seed = 0; seed < 12; seed++) {
    const park = N.createLandscapePark("sandbox", "waldhain", seed);
    signatures.add(JSON.stringify(park.terrain));
    assert.deepEqual(park.terrain, N.createLandscapePark("sandbox", "waldhain", seed).terrain);
    for (let y = 0; y < park.tiles.length; y++)
      for (let x = 0; x < park.tiles[y].length; x++) {
        const z = T.terrainHeight(park, x, y);
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
        ])
          if (park.tiles[y + dy]?.[x + dx])
            assert(
              Math.abs(z - T.terrainHeight(park, x + dx, y + dy)) <= 1,
              "Neighbor terraces differ by at most one level",
            );
        if (park.tiles[y][x] !== "grass")
          assert.equal(z, 0, "Flat accessible paths and consistent lake level");
      }
  }
  assert.equal(signatures.size, 12);
});

test("Zoo expansion pads stay buildable and landscape survives save migration unchanged", () => {
  const park = N.createLandscapePark("scenario", "zoo", 234);
  for (const r of Campaign.ZOO_RESERVED)
    for (let y = r.y; y <= r.frontage; y++)
      for (let x = r.x; x < r.x + r.size; x++) assert.equal(T.terrainHeight(park, x, y), 0);
  const restored = copy(park);
  S.migratePark(restored);
  assert.equal(restored.naturalTerrain, true);
  assert.deepEqual(restored.terrain, park.terrain);
  assert(S.validSave(restored));
  const old = S.newPark();
  S.migratePark(old);
  assert.equal(Object.keys(old.terrain ?? {}).length, 0, "Existing flat saves stay flat");
  assert.equal(old.naturalTerrain, undefined);
});
test("Natural terrain shares every corner, preserves construction heights and samples its actual slopes", () => {
  const park = N.createLandscapePark("sandbox", "waldhain", 42);
  let slopes = 0;
  for (let y = 0; y < park.tiles.length; y++)
    for (let x = 0; x < park.tiles[y].length; x++) {
      const z = T.terrainHeight(park, x, y),
        ring = Surface.terrainCellSurface(park, x, y);
      assert(Number.isInteger(z), "Construction heights keep five-metre steps");
      for (const corner of ring) {
        assert.equal(T.terrainHeight(park, corner.x, corner.y), corner.z);
        const midpoint = T.terrainHeight(park, (x + corner.x) / 2, (y + corner.y) / 2);
        assert.equal(midpoint, (z + corner.z) / 2, "Ground queries follow the rendered triangles");
        if (corner.z !== z) slopes++;
      }
      for (const [dx, dy, i] of [
        [1, 0, 1],
        [0, 1, 2],
      ]) {
        if (!park.tiles[y + dy]?.[x + dx]) continue;
        const next = Surface.terrainCellSurface(park, x + dx, y + dy);
        assert.equal(ring[i].z, next[(i + 3) % 4].z, "No vertical seams between natural cells");
        assert.equal(ring[(i + 1) % 4].z, next[(i + 2) % 4].z);
      }
    }
  assert(slopes > 400, "The land contains broad connected slopes instead of column walls");
  const saved = copy(park);
  delete saved.naturalTerrain;
  assert.equal(
    T.terrainHeight(saved, 25.2, 4.3),
    T.terrainHeight(saved, 25, 4),
    "Legacy parks remain columns",
  );
});

test("Building and path pads stay level on natural land, while the lake has an open level shore", () => {
  const park = N.createLandscapePark("sandbox", "waldhain", 42);
  assert(S.build(park, "wheel", 11, 23).id);
  const wheel = park.buildings.find((b) => b.kind === "wheel");
  for (const p of S.footprint(wheel))
    assert(Surface.terrainCellSurface(park, p.x, p.y).every((q) => q.z === 0));
  for (let y = 0; y < park.tiles.length; y++)
    for (let x = 0; x < park.tiles[y].length; x++) {
      if (park.tiles[y][x] !== "water") continue;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        if (park.tiles[y + dy]?.[x + dx])
          assert.equal(
            T.terrainHeight(park, x + dx, y + dy),
            0,
            "Lake shores are not excavated cliff rims",
          );
    }
});
test("Surface scopes reuse reads while subsequent terrain, path and building edits remain live", () => {
  const park = S.newPark("sandbox");
  park.tiles = park.tiles.map((row) => row.map(() => "grass"));
  park.buildings = [];
  park.terrain = { "5,5": 1 };
  park.naturalTerrain = true;
  const sample = () => Surface.withTerrainSurfaceScope(park, () => T.terrainHeight(park, 4.5, 4.5));
  assert.equal(sample(), 0.25);
  park.terrain["5,5"] = 0;
  assert.equal(sample(), 0);
  park.terrain["5,5"] = 1;
  park.tiles[4][4] = "path";
  assert.equal(sample(), 0, "An in-place path pins its real corners");
  park.tiles[4][4] = "grass";
  const result = S.build(park, "burger", 4, 4);
  assert(result.id);
  assert.equal(sample(), 0, "New buildings establish flat pads");
  const building = park.buildings.find((b) => b.id === result.id);
  building.x = 9;
  building.y = 9;
  assert.equal(sample(), 0.25, "Moving a building invalidates its old footprint");
  assert.throws(() =>
    Surface.withTerrainSurfaceScope(park, () => {
      throw Error("scope cleanup");
    }),
  );
  park.terrain["5,5"] = 0;
  assert.equal(sample(), 0, "Thrown callbacks cannot retain stale active scopes");
});
test("Birds land on raised crowns and clear the actual terrain during their approach", () => {
  const park = N.createLandscapePark("sandbox", "waldhain", 42),
    tree = park.buildings.find((b) => b.z >= 2),
    perch = Birds.birdPerch(tree),
    flat = { ...tree, z: 0 };
  assert(Math.abs(perch.z - Birds.birdPerch(flat).z - tree.z) < 1e-9);
  const pose = { perchId: tree.id, perchBlend: 1 };
  assert(
    Math.abs(
      BirdCanvas.birdSpriteLift(park, pose) -
        BirdCanvas.birdSpriteLift({ ...park, buildings: [flat] }, pose),
    ) < 1e-9,
  );
  for (const p of Birds.birdPerches(park)) {
    assert(p.z > T.terrainHeight(park, p.x, p.y));
    for (const depart of [false, true])
      for (let step = 0; step <= 64; step++) {
        const point = Birds.birdApproach(p, 13, step / 64, depart);
        assert(point.z >= T.terrainHeight(park, point.x, point.y), "Approach stays above hills");
      }
  }
});
console.log(`${passed} new landscape tests passed.`);

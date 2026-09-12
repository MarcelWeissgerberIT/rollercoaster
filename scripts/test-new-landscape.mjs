import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  N = await import(moduleURL("game/new-game.ts")),
  T = await import(moduleURL("game/terrain.ts")),
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
    assert(Math.max(...Object.values(park.terrain)) >= 3, id + " has a hill at least 15m high");
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

test("Free parks combine lake, forest and terraces with a generous empty entrance meadow", () => {
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
    assert.equal(b.z, T.terrainHeight(park, b.x, b.y), "Tree base follows real elevation");
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
  assert.deepEqual(restored.terrain, park.terrain);
  assert(S.validSave(restored));
  const old = S.newPark();
  S.migratePark(old);
  assert.equal(Object.keys(old.terrain ?? {}).length, 0, "Existing flat saves stay flat");
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

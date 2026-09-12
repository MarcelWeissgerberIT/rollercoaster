import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  T = await import(moduleURL("game/terrain.ts")),
  G = await import(moduleURL("game/grid.ts")),
  C = await import(moduleURL("game/construction.ts")),
  F = await import(moduleURL("game/prefabs.ts")),
  M = await import(moduleURL("game/maintenance.ts")),
  E = await import(moduleURL("game/scenario-editor.ts")),
  Fin = await import(moduleURL("game/finance.ts")),
  Retail = await import(moduleURL("game/retail.ts")),
  Sc = await import(moduleURL("game/modular-scenery.ts")),
  W = await import(moduleURL("game/water-rides.ts"));
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log("PASS", name);
  } catch (e) {
    failed++;
    console.error("FAIL", name, e.message);
  }
}
function empty() {
  const s = S.newPark("sandbox");
  s.buildings = [];
  s.guests = [];
  s.tiles = s.tiles.map((r) => r.map(() => "grass"));
  s.tiles[29][15] = "path";
  s.terrain = {};
  s.elevatedPaths = [];
  s.cash = 1e6;
  s.staff = 0;
  s.maintenance = undefined;
  s.unlimitedBudget = true;
  return s;
}
function deck(s, x, y, z, slope) {
  assert.equal(T.placeDeck(s, { x, y, z, slope, type: "path", style: "boardwalk" }), null);
}
test("Bridge ramps connect matching edges, not the public path underneath", () => {
  const s = empty();
  s.tiles[29][14] = "path";
  deck(s, 16, 29, 0, 0);
  deck(s, 17, 29, 1);
  deck(s, 18, 29, 0, 2);
  s.tiles[29][19] = "path";
  s.tiles[28][17] = "path";
  s.tiles[29][17] = "path";
  const route = G.pathRoute(s, { x: 15, y: 29 }, { x: 19, y: 29 });
  assert.equal(route.length, 5);
  assert.equal(route[2].z, 1);
  assert(!S.connected(s).has("17,29"));
  assert(!S.connected(s).has("17,28"));
  assert(S.connected(s).has("17,29,1"));
  assert.equal(G.pathRoute(s, { x: 17, y: 29, z: 1 }, { x: 17, y: 29, z: 0 }).length, 0);
});
test("Tunnel routes keep real elevation; save, load and undo retain geometry", () => {
  const s = empty();
  s.tiles[29][16] = "path";
  const before = s.cash;
  const record = C.recordEdit(s, "Tunnel", () => {
    assert.equal(T.editTerrain(s, { x: 17, y: 29 }, "raise", 1, 0), null);
    deck(s, 17, 29, 0);
    s.tiles[29][18] = "path";
  });
  assert(record);
  assert.equal(G.pathRoute(s, { x: 15, y: 29 }, { x: 18, y: 29 }).length, 4);
  assert(S.validSave(JSON.parse(JSON.stringify(s))));
  assert.equal(C.undoEdits(s, [record]), null);
  assert.equal(T.terrainHeight(s, 17, 29), 0);
  assert.equal(s.elevatedPaths.length, 0);
  assert.equal(s.cash, before);
});
test("Terrain protects entrance and buildings; invalid decks are atomic", () => {
  const s = empty(),
    cash = s.cash;
  assert(T.editTerrain(s, { x: 15, y: 29 }, "raise", 1, 0));
  assert(T.placeDeck(s, { x: 15, y: 29, z: 0, type: "path", style: "garden" }));
  assert.equal(s.cash, cash);
  assert.equal(s.elevatedPaths.length, 0);
});
test("New coaster styles build closed templates and survive serialization", () => {
  for (const style of ["giga", "inverted"]) {
    const s = empty(),
      track = F.prefabBlueprint({ x: 8, y: 8 }, 0, style);
    assert.equal(S.validateTrack(s, track), null, style);
    const built = S.build(s, "coaster", 8, 8, track);
    assert(built.id, `${style}: ${built.error}`);
    assert(S.validSave(JSON.parse(JSON.stringify(s))), style);
    assert.equal(track.at(-1).z, track[0].z);
  }
});
test("Mechanic reaches station, works for real time and completes a paid repair", () => {
  const s = S.newPark("sandbox"),
    b = s.buildings.find((b) => b.kind === "carousel");
  assert(b);
  S.ensurePods(s, b);
  b.riders = [];
  b.queue = [];
  b.open = false;
  b.condition = 20;
  assert.equal(M.hireMechanic(s), null);
  assert.equal(M.repairAttraction(s, b, S.CATALOG[b.kind].cost), null);
  const charge = s.cash;
  assert.equal(b.condition, 20);
  const modes = new Set();
  for (let i = 0; i < 2200 && b.condition < 99; i++) {
    s.time += 0.05;
    M.tickMaintenance(s, 0.05, S.CATALOG);
    modes.add(s.maintenance.workers[0].mode);
  }
  assert(modes.has("walk"));
  assert(modes.has("repair"));
  assert.equal(b.condition, 100);
  assert.equal(s.cash, charge);
  assert.equal(s.maintenance.workers[0].completed, 1);
  assert(S.validSave(JSON.parse(JSON.stringify(s))));
});
test("Scenario export starts with fresh accounts and retains themes and terrain", () => {
  const s = empty();
  s.time = 500;
  Fin.recordFinance(s, "ticket", 100);
  s.dayIncome = 100;
  Fin.closeFinancePeriod(s);
  assert.equal(
    Sc.placeScenery(s, { x: 10, y: 10, z: 0, part: "wall", theme: "woodland", orientation: 0 }),
    null,
  );
  T.editTerrain(s, { x: 12, y: 12 }, "raise", 1, 0);
  const settings = E.scenarioTemplate(s);
  settings.name = "Brückenpark";
  settings.rides = 0;
  settings.arrivals = 50;
  const file = E.parseScenarioFile(E.exportScenarioFile(E.createScenarioFile(s, settings))),
    park = E.startCustomScenario(file);
  assert.equal(park.time, 0);
  assert.equal(park.arrivals, 0);
  assert.equal(park.scenery.length, 1);
  assert.equal(park.terrain["12,12"], 1);
  assert.equal(park.financeLedger?.history.length ?? 0, 0);
  assert.equal(S.scenarioOf(park).name, "Brückenpark");
  assert(S.validSave(park));
});
test("Photo purchase debits actual guest wallet and posts net retail revenue", () => {
  const s = empty(),
    b = { kind: "coaster", id: 99, photoPoint: 0.2, revenue: 0 },
    g = { id: 1, rides: 1, happiness: 100, wallet: 30 };
  s.unlimitedBudget = false;
  const cash = s.cash;
  assert(Retail.buyRidePhoto(s, b, g));
  assert.equal(g.wallet, 25);
  assert.equal(b.retail.photoSales, 1);
  assert.equal(s.cash, cash + 4.3);
  assert.equal(s.financeLedger.current.photos, 5);
});
test("Raft channel moves boats continuously and provides matching passenger seats", () => {
  const a = W.rapidsPose(0, 0.1),
    b = W.rapidsPose(0, 0.2);
  assert(Math.hypot(a.x - b.x, a.z - b.z) > 0.1);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 4; j++)
      assert(Object.values(W.rapidsSeatPose(i, j, 0.34)).every(Number.isFinite));
});
test("Played campaign maps export without old financial or visitor progress", () => {
  for (const scenario of ["ruinenpark", "grosspark", "zoo"]) {
    const s = S.newPark("scenario", scenario);
    for (let i = 0; i < 1200; i++) S.tick(s, 0.1);
    const p = E.startCustomScenario(E.createScenarioFile(s, E.scenarioTemplate(s)));
    assert(S.validSave(p), scenario);
    assert.equal(p.time, 0);
    assert.equal(p.guests.length, 0);
    assert.equal(p.income, 0);
  }
});
test("Cancelled repair cannot complete or charge again; working repairs cannot be refunded", () => {
  const s = S.newPark("sandbox"),
    b = s.buildings.find((b) => b.kind === "carousel");
  S.ensurePods(s, b);
  b.riders = [];
  b.queue = [];
  b.open = false;
  b.condition = 20;
  M.hireMechanic(s);
  const cash = s.cash;
  const edit = C.recordEdit(s, "Reparatur", () =>
    M.repairAttraction(s, b, S.CATALOG.carousel.cost),
  );
  M.tickMaintenance(s, 0.05, S.CATALOG);
  assert.equal(C.undoEdits(s, [edit]), null);
  assert.equal(s.cash, cash);
  assert(!b.maintenance?.request);
  for (let i = 0; i < 1000; i++) M.tickMaintenance(s, 0.05, S.CATALOG);
  assert.equal(b.condition, 20);
  const edit2 = C.recordEdit(s, "Reparatur", () =>
    M.repairAttraction(s, b, S.CATALOG.carousel.cost),
  );
  for (let i = 0; i < 2200 && s.maintenance.workers[0].mode !== "repair"; i++)
    M.tickMaintenance(s, 0.05, S.CATALOG);
  assert.equal(s.maintenance.workers[0].mode, "repair");
  const before = JSON.stringify(s);
  assert(C.undoEdits(s, [edit2]));
  assert.equal(JSON.stringify(s), before);
});
process.exitCode = failed ? 1 : 0;

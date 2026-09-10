import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts"));
const G = await import(moduleURL("game/ground-clearance.ts"));
const C = await import(moduleURL("game/construction.ts"));
const E = await import(moduleURL("game/exit-assist.ts"));
const P = await import(moduleURL("game/pods.ts"));
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS", name);
  count++;
}
function empty() {
  const s = S.newPark("sandbox");
  s.buildings = [];
  s.guests = [];
  s.tiles = Array.from({ length: 30 }, () => Array(30).fill("grass"));
  s.cash = 100000;
  s.mode = "scenario";
  s.research.completed = Object.keys(S.RESEARCH);
  s.transitLines = [];
  s.crewPool = { version: 1, nextId: 1, crews: [] };
  s.pathStyles = {};
  return s;
}
function rectangle() {
  const track = [{ x: 18, y: 7, z: 0 }];
  for (let x = 19; x <= 24; x++) track.push({ x, y: 7, z: Math.min(2, x - 18) });
  for (let y = 8; y <= 17; y++) track.push({ x: 24, y, z: 2 });
  for (let x = 23; x >= 18; x--) track.push({ x, y: 17, z: 2 });
  for (let y = 16; y >= 7; y--) track.push({ x: 18, y, z: Math.min(2, y - 7) });
  return track;
}
function build(s, kind, x, y, track) {
  const result = S.build(s, kind, x, y, track);
  assert(!result.error, result.error);
  return s.buildings.find((b) => b.id === result.id);
}
function fixture() {
  const s = empty(),
    coaster = build(s, "coaster", 18, 7, rectangle()),
    b = build(s, "wheel", 15, 11);
  b.pods = { entry: { side: 2, offset: 1 }, exit: { side: 0, offset: 1 } };
  for (let y = 12; y < 30; y++) assert.equal(S.paint(s, 20, y, "path"), null);
  for (let x = 15; x < 20; x++) assert.equal(S.paint(s, x, 29, "path"), null);
  return { s, b, coaster };
}

test("A whole high crossing is buildable, while low rail and the station remain solid", () => {
  const { s, coaster } = fixture();
  assert.equal(S.occupant(s, 18, 12), coaster);
  assert.equal(S.groundOccupant(s, 18, 12), undefined);
  for (const type of ["path", "queue", "exit"]) {
    assert.equal(C.planPlacement(s, type, { x: 18, y: 12 }).error, null);
    assert.equal(S.paint(s, 18, 12, type), null);
    assert.equal(s.tiles[12][18], type);
  }
  for (const p of [
    { x: 18, y: 7 },
    { x: 18, y: 8 },
  ]) {
    assert.equal(S.groundOccupant(s, p.x, p.y), coaster);
    assert(C.planPlacement(s, "exit", p).error);
    assert(S.paint(s, p.x, p.y, "path"));
  }
  assert(C.planPlacement(s, "burger", { x: 18, y: 12 }).error);
  assert(C.planPlacement(s, "water", { x: 18, y: 12 }).error);
  assert.equal(S.occupant(s, 18, 12), coaster, "selection must still find the entire coaster");
});

test("Descent clipping uses the complete tile, not a high endpoint or average", () => {
  const track = [
    { x: 2, y: 5, z: 3, smooth: true },
    { x: 8, y: 5, z: 0, smooth: true },
  ];
  assert(G.trackClearsGround(track, 4, 5));
  assert(!G.trackClearsGround(track, 6, 5));
  assert(!G.trackClearsGround(track, 8, 5));
  const stacked = [
    { x: 2, y: 5, z: 3, smooth: true },
    { x: 8, y: 5, z: 3, smooth: true },
    { x: 8, y: 6, z: 0, smooth: true },
    { x: 2, y: 6, z: 0, smooth: true },
    { x: 2, y: 5, z: 0, smooth: true },
    { x: 8, y: 5, z: 0, smooth: true },
  ];
  assert(!G.trackClearsGround(stacked, 5, 5), "low return rail must override high crossing");
});

test("Existing and new tracks keep paths underneath high rail, but cannot descend into them", () => {
  const { s, coaster } = fixture();
  const virtual = { ...s, buildings: s.buildings.filter((b) => b.id !== coaster.id) };
  assert.equal(S.validateTrack(virtual, coaster.track), null);
  assert.equal(C.planPlacement(virtual, "coaster", coaster, coaster.track).error, null);
  const lowered = coaster.track.map((p) => ({ ...p, z: 0 }));
  assert(S.validateTrack(virtual, lowered));
  assert(C.planPlacement(virtual, "coaster", coaster, lowered).error);
  assert.equal(S.build(virtual, "coaster", 18, 7, coaster.track).error, undefined);
});

test("Pods and admission path planning reuse high clearances without deleting the coaster", () => {
  const { s, b, coaster } = fixture();
  assert.equal(C.planPod(s, b, "exit", b.pods.exit).error, null);
  b.pods = { entry: { side: 0, offset: 1 }, exit: { side: 2, offset: 1 } };
  const plan = C.planConnection(s, b);
  assert.equal(plan.error, null);
  assert(plan.points.some((p) => p.x === 18 && p.y === 12));
  assert(!plan.clearIds.includes(coaster.id));
  assert.equal(plan.clearIds.length, 0);
  assert.equal(plan.cost, 36);
});

test("Exit assistant builds a real route below the high rail and quotes its exact cost", () => {
  const { s, b, coaster } = fixture(),
    before = structuredClone(s);
  const proposal = E.suggestExit(s, b);
  assert(proposal);
  assert.deepEqual(s, before);
  assert.equal(proposal.moved, false);
  assert(proposal.underpass.some((p) => p.x === 18 && p.y === 12));
  assert(!proposal.clearIds.includes(coaster.id));
  const cash = s.cash,
    track = structuredClone(coaster.track);
  assert.equal(E.applyExitSuggestion(s, b, proposal), null);
  assert.equal(cash - s.cash, proposal.cost);
  assert.deepEqual(coaster.track, track);
  const route = S.exitPath(s, b);
  assert(route.length);
  assert(S.connected(s).has(S.key(route.at(-1))));
  assert.equal(s.tiles[12][20], "path");
  assert(S.validSave(s), "the connected underpass must survive a save");
});

test("A blocked current exit is replaced by a genuinely buildable pod alternative", () => {
  const { s, b } = fixture();
  build(s, "burger", 19, 12);
  s.tiles[11][18] = "water";
  s.tiles[13][18] = "water";
  const proposal = E.suggestExit(s, b);
  assert(proposal);
  assert(proposal.moved);
  assert(!P.samePod(proposal.pod, b.pods.exit));
  assert.equal(E.applyExitSuggestion(s, b, proposal), null);
  assert(S.exitPath(s, b).length);
  assert(s.buildings.some((v) => v.kind === "burger"));
});

test("Lowering rail after preview rejects the entire stale proposal without charging", () => {
  const { s, b, coaster } = fixture(),
    proposal = E.suggestExit(s, b);
  assert(proposal?.underpass.length);
  coaster.track = coaster.track.map((p) => ({ ...p, z: 0 }));
  const before = structuredClone(s);
  assert(E.applyExitSuggestion(s, b, proposal));
  assert.deepEqual(s, before);
});

test("Applying then undoing an exit under the coaster restores paths, pods and cash", () => {
  const { s, b, coaster } = fixture(),
    before = structuredClone(s),
    proposal = E.suggestExit(s, b);
  const record = C.recordEdit(s, "Unterführung", () =>
    assert.equal(E.applyExitSuggestion(s, b, proposal), null),
  );
  assert(record);
  assert(S.exitPath(s, b).length);
  assert.equal(C.undoEdits(s, [record]), null);
  assert.deepEqual(s.tiles, before.tiles);
  assert.deepEqual(b.pods, before.buildings.find((v) => v.id === b.id).pods);
  assert.deepEqual(coaster.track, before.buildings.find((v) => v.id === coaster.id).track);
  assert.equal(s.cash, before.cash);
});
test("Context help selects the nearby disconnected attraction, not a remote track owner", () => {
  const { s, b } = fixture();
  const shop = build(s, "burger", 19, 12);
  const help = E.exitHelpAt(s, { x: 19, y: 12 });
  assert.equal(help.buildingId, b.id);
  assert(help.proposal);
  assert.equal(E.exitHelpAt(s, { x: 1, y: 1 }), null);
  assert.equal(E.applyExitSuggestion(s, b, help.proposal), null);
  assert.notEqual(E.exitHelpAt(s, { x: 19, y: 12 })?.buildingId, b.id);
  assert(s.buildings.includes(shop));
});
test("A tree cannot mask a solid station during path preview or charge a failed build", () => {
  const s = empty(),
    coaster = build(s, "coaster", 18, 7, rectangle());
  const tree = build(s, "tree", 2, 2);
  tree.x = 18;
  tree.y = 7;
  s.buildings = [tree, coaster];
  assert.equal(S.groundOccupant(s, 18, 7).id, coaster.id);
  const before = JSON.stringify(s),
    plan = C.planPlacement(s, "exit", { x: 18, y: 7 }, undefined, true);
  assert(plan.error);
  assert.equal(plan.clearIds.length, 0);
  assert(S.paint(s, 18, 7, "exit"));
  assert.equal(JSON.stringify(s), before);
});
console.log(`${count}/${count} ground-clearance tests passed`);

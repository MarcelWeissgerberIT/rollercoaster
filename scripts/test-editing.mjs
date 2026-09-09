import assert from "node:assert/strict";
import * as THREE from "three";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  C = await import(moduleURL("game/construction.ts")),
  P = await import(moduleURL("game/prefabs.ts")),
  E = await import(moduleURL("game/track-edit.ts")),
  T = await import(moduleURL("game/transit.ts")),
  R = await import(moduleURL("game/transport-rig.ts")),
  I = await import(moduleURL("game/guest-identity.ts")),
  M = await import(moduleURL("game/guest-model.ts"));
let failures = 0;
const test = (name, fn) => {
  try {
    fn();
    console.log("PASS " + name);
  } catch (e) {
    failures++;
    console.error("FAIL " + name, e.stack);
  }
};
function fixture(legacy = false) {
  const s = S.newPark("sandbox");
  s.guests = [];
  let b;
  if (legacy) b = s.buildings.find((b) => b.kind === "coaster");
  else {
    s.buildings = [];
    s.transitLines = [];
    s.tiles = Array.from({ length: 30 }, () => Array(30).fill("grass"));
    const t = P.prefabBlueprint({ x: 14, y: 14 }, 0, "steel"),
      r = S.build(s, "coaster", 14, 14, t);
    assert(!r.error, r.error);
    b = s.buildings.find((b) => b.id === r.id);
  }
  b.open = true;
  b.tested = true;
  return { s, b };
}
function begin(s, b, from, to = from) {
  const before = JSON.stringify(b.track);
  assert.equal(E.beginTrackEdit(s, b, from, to), null);
  assert.equal(JSON.stringify(b.track), before);
  assert(S.validSave(structuredClone(s)));
  return before;
}
function connect(s, track = s.trackEdit.prefix) {
  const out = P.closeTrack(E.trackEditWorld(s), track, true, s.trackEdit.suffix);
  assert(out.track, out.error);
  return out.track;
}
for (const [name, from, to, legacy, loop] of [
  ["straight", 0, 0, false, false],
  ["elevated end", 2, 2, false, false],
  ["hill", 2, 3, false, false],
  ["inserted loop", 0, 3, false, true],
  ["last curve", 21, 21, false, false],
  ["legacy straight", 7, 7, true, false],
  ["legacy hill", 1, 1, true, false],
])
  test(`Partial coaster edit: ${name}, reconnect, charge only replacement, valid save`, () => {
    const { s, b } = fixture(legacy),
      original = begin(s, b, from, to);
    let work = s.trackEdit.prefix;
    if (loop) {
      work = P.appendPiece(work, "loop");
      assert.equal(
        P.pieceError(E.trackEditWorld(s), s.trackEdit.prefix, work, true, s.trackEdit.suffix),
        null,
      );
    }
    const track = connect(s, work),
      plan = E.trackEditPlan(s, track);
    assert.equal(plan.error, null);
    assert(plan.cost < S.trackCost(track));
    assert.equal(JSON.stringify(b.track), original);
    const cash = s.cash;
    assert.equal(E.commitTrackEdit(s, track), null);
    assert.equal(s.cash, cash - plan.cost);
    assert(!b.open && !b.tested && !s.trackEdit);
    assert(S.validSave(structuredClone(s)));
    if (loop) assert(b.track.some((p) => p.inversion));
  });
test("Pending edit survives save/reload, cannot open or test, and cancellation restores original", () => {
  const { s, b } = fixture(),
    original = begin(s, b, 2);
  assert(C.connectBuilding(s, b));
  b.open = true;
  b.autoOpen = true;
  b.testing = 2;
  S.tick(s, 3);
  assert(!b.open && !b.testing && !b.autoOpen);
  const restored = structuredClone(s);
  assert(S.validSave(restored));
  E.cancelTrackEdit(restored);
  assert.equal(JSON.stringify(restored.buildings[0].track), original);
  assert(restored.buildings[0].open);
  assert(S.validSave(restored));
});
test("Committing another small ring cannot discard retained track for free", () => {
  const { s, b } = fixture();
  begin(s, b, 0);
  let tiny = P.startTrack({ x: b.x, y: b.y });
  for (let i = 0; i < 4; i++) tiny = P.appendPiece(tiny, "right");
  const cash = s.cash,
    original = JSON.stringify(b.track);
  assert(E.trackEditPlan(s, tiny).error);
  assert(E.commitTrackEdit(s, tiny));
  assert.equal(s.cash, cash);
  assert.equal(JSON.stringify(b.track), original);
});
test("Manual prefab preview and suggestions reject retained suffix collisions", () => {
  const { s, b } = fixture();
  begin(s, b, 0);
  const prefix = s.trackEdit.prefix,
    suffix = s.trackEdit.suffix,
    bad = P.appendPiece(prefix, "right");
  assert(P.pieceError(E.trackEditWorld(s), prefix, bad, true, suffix));
  for (const alt of P.suggestPieces(E.trackEditWorld(s), prefix, "right", true, suffix))
    assert.equal(P.retainedTrackError(prefix, alt.track, suffix), null);
});
test("Commit undo preserves original geometry, cash and elapsed simulation time", () => {
  const { s, b } = fixture(),
    original = begin(s, b, 0),
    track = connect(s),
    cash = s.cash;
  const rec = C.recordEdit(s, "modify", () => assert.equal(E.commitTrackEdit(s, track), null));
  S.tick(s, 0.5);
  const time = s.time;
  C.undoEdits(s, [rec]);
  assert.equal(JSON.stringify(b.track), original);
  assert.equal(s.cash, cash);
  assert.equal(s.time, time);
  assert(S.validSave(s));
});
test("Undoing a newly built coaster also removes its pending edit and draft", () => {
  const { s } = fixture();
  s.buildings = [];
  let b;
  const rec = C.recordEdit(s, "build", () => {
    const t = P.prefabBlueprint({ x: 14, y: 14 }, 0, "steel");
    const r = S.build(s, "coaster", 14, 14, t);
    b = s.buildings.find((b) => b.id === r.id);
  });
  begin(s, b, 0);
  C.undoEdits(s, [rec]);
  assert(!s.trackEdit && !s.draft);
  assert(S.validSave(s));
});
test("Names persist across save/reload and legacy guests get varied stable names", () => {
  const s = S.newPark();
  const names = s.guests.map((g) => g.name);
  assert(names.every((n) => n && n.includes(" ")));
  assert(new Set(names).size > names.length * 0.8);
  const reloaded = structuredClone(s);
  S.migratePark(reloaded);
  assert.deepEqual(
    reloaded.guests.map((g) => g.name),
    names,
  );
  delete reloaded.guests[0].name;
  S.migratePark(reloaded);
  assert.equal(reloaded.guests[0].name, I.guestName(reloaded.guests[0].id));
});
test("Detailed people share their actual skin/shirt and have face, hands, shoes and moving limbs", () => {
  const a = { id: 44, skin: 2 },
    parts = M.personParts(a, false, 0),
    walk = M.personParts(a, false, 1);
  assert(parts.length > 30);
  assert(parts.filter((p) => p.head).length >= 10);
  assert(parts.some((p) => p.color === I.guestAppearance(a).skin));
  assert.notDeepEqual(parts, walk);
  const model = M.createGuestModel(a);
  assert(model.getObjectByName("head"));
  assert(model.getObjectByName("body"));
  model.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      assert(o.geometry.attributes.color);
      o.geometry.dispose();
      o.material.dispose();
    }
  });
});
test("Articulated railway keeps four vehicles separate at both stops and every seat follows its car", () => {
  const park = S.newPark("sandbox"),
    line = {
      id: 999,
      kind: "train",
      a: 1,
      b: 2,
      route: Array.from({ length: 12 }, (_, i) => ({ x: 4 + i, y: 12 })),
      position: 0,
      direction: 1,
      wait: 4,
      passengers: park.guests.slice(0, 12).map((g) => g.id),
      enabled: true,
      trips: 0,
      served: 0,
      revenue: 0,
    };
  const rig = R.createTransportRig(line, park);
  assert.equal(rig.seats.length, 12);
  for (const t of [0, 4, 6, rig.duration / 2, rig.duration - 1]) {
    rig.update(t);
    const points = rig.seats.map((s) => s.getWorldPosition(new THREE.Vector3()));
    assert.equal(new Set(points.map((p) => p.toArray().join(","))).size, 12);
    for (let i = 0; i < 4; i++) {
      const p = T.transportCarPose(line, i, t);
      assert(p.x >= 4 && p.x <= 15);
      assert(Number.isFinite(p.headingX + p.headingY));
    }
    assert.equal(rig.passengers.filter((p) => p.visible).length, line.passengers.length);
  }
});
process.exitCode = failures ? 1 : 0;

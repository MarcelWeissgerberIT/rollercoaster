import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  O = await import(moduleURL("game/operations.ts")),
  F = await import(moduleURL("game/staff.ts")),
  V = await import(moduleURL("game/staff-visual.ts")),
  A = await import(moduleURL("game/staff-animation.ts")),
  C = await import(moduleURL("game/construction.ts"));
let passed = 0;
function test(label, fn) {
  fn();
  console.log("PASS", label);
  passed++;
}
function fixture() {
  const s = S.newPark("sandbox");
  for (const b of s.buildings) {
    b.open = false;
    b.queue = [];
    b.riders = [];
    b.cycle = 0;
    O.resetRideOperations(b);
  }
  s.guests = [];
  s.open = false;
  s.time = 8;
  O.initOperations(s);
  const rides = s.buildings.filter((b) => O.needsOperator(b.kind)),
    crews = O.crewPoolOf(s).crews;
  return { s, rides, crews };
}
test("Crew cards and live models keep the same person after a manual assignment change", () => {
  const {
      s,
      rides: [a, b],
      crews,
    } = fixture(),
    crew = crews.find((c) => c.buildingId === a.id),
    other = crews.find((c) => c.buildingId === b.id);
  const refs = O.OPERATOR_POSTS.map((post) => ({
      kind: "operator",
      id: a.id,
      post,
      crewId: crew.id,
    })),
    before = refs.map((ref) => ({
      location: F.staffLocation(s, ref),
      motion: V.staffMotion(s, ref),
    }));
  assert.equal(O.assignRideCrew(s, crew.id, null), null);
  for (const ref of refs) {
    assert.equal(F.staffLocation(s, ref), null);
    assert.equal(V.staffMotion(s, ref), null);
  }
  assert.equal(O.assignRideCrew(s, other.id, null), null);
  assert.equal(O.assignRideCrew(s, crew.id, b.id), null);
  for (let i = 0; i < refs.length; i++) {
    const location = F.staffLocation(s, refs[i]),
      motion = V.staffMotion(s, refs[i]),
      live = V.staffMotion(s, { kind: "operator", id: b.id, post: refs[i].post });
    assert.equal(location.targetId, b.id);
    assert.equal(location.name, before[i].location.name);
    assert.equal(motion.appearanceId, before[i].motion.appearanceId);
    assert.deepEqual(A.staffPose(motion), A.staffPose(before[i].motion));
    assert.deepEqual(A.staffPose(live), A.staffPose(motion));
  }
  assert(S.validSave(JSON.parse(JSON.stringify(s))));
});
test("Undo restores crew ownership and manual binding without rewinding time or revenue", () => {
  const {
      s,
      rides: [a, b],
      crews,
    } = fixture(),
    crew = crews.find((c) => c.buildingId === a.id),
    other = crews.find((c) => c.buildingId === b.id);
  assert.equal(O.assignRideCrew(s, crew.id, a.id), null);
  assert.equal(O.assignRideCrew(s, other.id, null), null);
  const before = structuredClone(O.crewPoolOf(s));
  const record = C.recordEdit(s, "Crew umsetzen", () =>
    assert.equal(O.assignRideCrew(s, crew.id, b.id), null),
  );
  assert(record?.crewConfig);
  s.time += 50;
  s.cash += 25;
  s.income += 25;
  const { time, cash, income } = s;
  assert.equal(C.undoEdits(s, [record]), null);
  assert.deepEqual(O.crewPoolOf(s).crews, before.crews);
  assert.equal(a.operations.crewId, crew.id);
  assert.equal(b.operations.staffed, false);
  assert.equal(s.time, time);
  assert.equal(s.cash, cash);
  assert.equal(s.income, income);
  assert(S.validSave(JSON.parse(JSON.stringify(s))));
});
test("Undo cannot remove or move the real crew of a newly occupied ride", () => {
  const {
      s,
      rides: [a, b],
      crews,
    } = fixture(),
    crew = crews.find((c) => c.buildingId === a.id),
    other = crews.find((c) => c.buildingId === b.id);
  assert.equal(O.assignRideCrew(s, other.id, null), null);
  const record = C.recordEdit(s, "Teamwechsel", () =>
    assert.equal(O.assignRideCrew(s, crew.id, b.id), null),
  );
  assert(record);
  b.riders = [123];
  b.cycle = 10;
  O.startRideProgram(b);
  const before = structuredClone(s);
  assert(C.undoEdits(s, [record]));
  assert.deepEqual(s, before);
});
test("Undo a pool hire removes only the hired team and keeps existing names and rides", () => {
  const { s } = fixture(),
    before = structuredClone(O.crewPoolOf(s)),
    record = C.recordEdit(s, "Crew einstellen", () => assert.equal(O.hireRideCrew(s), null));
  assert(record?.crewConfig);
  assert.equal(O.crewPoolOf(s).crews.length, before.crews.length + 1);
  assert.equal(C.undoEdits(s, [record]), null);
  assert.deepEqual(O.crewPoolOf(s).crews, before.crews);
  assert(S.validSave(JSON.parse(JSON.stringify(s))));
});
console.log(`${passed} crew identity and undo tests passed.`);

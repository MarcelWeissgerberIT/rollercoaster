import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  O = await import(moduleURL("game/operations.ts")),
  D = await import(moduleURL("game/difficulty.ts"));
Math.random = () => 0.5;
const results = [];
function test(name, fn) {
  try {
    results.push({ name, pass: true, evidence: fn() });
  } catch (e) {
    results.push({ name, pass: false, error: e.message.slice(0, 1800) });
  }
  console.log(JSON.stringify(results.at(-1)));
}
const copy = (s) => JSON.parse(JSON.stringify(s));
function park() {
  const s = S.newPark("sandbox");
  s.open = false;
  s.guests = [];
  s.staff = 0;
  s.zoo = undefined;
  s.cleanliness = undefined;
  s.transitLines = [];
  s.cash = 100000;
  s.buildings = s.buildings.filter((b) => O.needsOperator(b.kind));
  s.crewPool = { version: 1, nextId: 1, crews: [] };
  for (const b of s.buildings) {
    b.open = true;
    b.tested = true;
    b.testing = undefined;
    b.queue = [];
    b.riders = [];
    b.cycle = 0;
    const o = O.ensureOperations(b);
    Object.assign(o, {
      staffed: false,
      assignment: "off",
      phase: "idle",
      phaseLeft: 0,
      remainingRounds: 0,
    });
    delete o.crewId;
  }
  O.initOperations(s);
  return s;
}
const pool = (s) => O.crewPoolOf(s),
  rides = (s) => s.buildings.filter((b) => O.needsOperator(b.kind));
function hire(s) {
  const old = new Set(pool(s).crews.map((c) => c.id));
  assert.equal(O.hireRideCrew(s), null);
  const crew = pool(s).crews.find((c) => !old.has(c.id));
  assert(crew, "Hiring must create exactly one real crew");
  return crew;
}
function assertConsistent(s) {
  const crews = pool(s).crews,
    assigned = crews.filter((c) => c.buildingId !== null);
  assert.equal(new Set(crews.map((c) => c.id)).size, crews.length);
  assert.equal(new Set(assigned.map((c) => c.buildingId)).size, assigned.length);
  for (const b of rides(s)) {
    const crew = crews.find((c) => c.buildingId === b.id);
    assert.equal(O.hasOperator(b), !!crew);
    if (crew) assert.equal(b.operations.crewId, crew.id);
  }
  assert(S.validSave(copy(s)), "Actual save validator accepts pool and assignment links");
}

test("New attractions and repeated automatic distribution never hire crews from nowhere", () => {
  const s = park();
  for (const b of rides(s)) assert.equal(O.setRideStaffingMode(s, b.id, "auto"), null);
  for (let i = 0; i < 20; i++) O.autoAssignRideCrews(s);
  assert.equal(pool(s).crews.length, 0);
  assert(rides(s).every((b) => !O.hasOperator(b)));
  const size = S.CATALOG.carousel.size,
    spot = s.tiles
      .flatMap((row, y) => row.map((_, x) => ({ x, y })))
      .find(
        (p) =>
          p.x + size < s.tiles[0].length &&
          p.y + size < s.tiles.length &&
          S.footprint({ kind: "carousel", x: p.x, y: p.y }).every(
            (cell) => s.tiles[cell.y][cell.x] === "grass" && !S.occupant(s, cell.x, cell.y),
          ),
      );
  assert(spot, "Fixture provides a real empty construction site");
  const before = s.cash,
    built = S.build(s, "carousel", spot.x, spot.y);
  assert(!built.error, built.error);
  assert(s.cash < before);
  O.autoAssignRideCrews(s);
  assert.equal(pool(s).crews.length, 0);
  assert.equal(O.hasOperator(s.buildings.find((b) => b.id === built.id)), false);
  assertConsistent(s);
});
test("Free crews automatically fill eligible rides exactly once without charging assignment fees", () => {
  const s = park(),
    a = hire(s),
    b = hire(s),
    targets = rides(s).slice(0, 2),
    cash = s.cash;
  assert.equal(O.availableRideCrews(s).length, 2);
  for (const ride of targets) assert.equal(O.setRideStaffingMode(s, ride.id, "auto"), null);
  O.autoAssignRideCrews(s);
  assert(targets.every((ride) => O.hasOperator(ride)));
  assert.equal(O.availableRideCrews(s).length, 0);
  assert.equal(s.cash, cash);
  const bindings = pool(s).crews.map((c) => [c.id, c.buildingId]);
  for (let i = 0; i < 40; i++) O.autoAssignRideCrews(s);
  assert.deepEqual(
    pool(s).crews.map((c) => [c.id, c.buildingId]),
    bindings,
  );
  assert.deepEqual(
    pool(s).crews.map((c) => c.id),
    [a.id, b.id],
  );
  assertConsistent(s);
});
test("Manual crew relocation preserves all three names and stable crew identity", () => {
  const s = park(),
    crew = hire(s),
    [a, b] = rides(s);
  const names = O.OPERATOR_POSTS.map((p) => O.crewMemberName(crew.id, p));
  assert.equal(O.assignRideCrew(s, crew.id, a.id), null);
  assert.equal(crew.mode, "manual");
  assert.deepEqual(
    O.rideCrew(a).map((m) => m.name),
    names,
  );
  assert.equal(O.assignRideCrew(s, crew.id, b.id), null);
  assert.equal(crew.buildingId, b.id);
  assert.equal(O.hasOperator(a), false);
  assert.equal(O.hasOperator(b), true);
  assert.equal(b.operations.crewId, crew.id);
  assert.deepEqual(
    O.rideCrew(b).map((m) => m.name),
    names,
  );
  assertConsistent(s);
});
test("An assigned manual crew remains pinned when other attractions need staff", () => {
  const s = park(),
    crew = hire(s),
    [a, b] = rides(s);
  assert.equal(O.assignRideCrew(s, crew.id, a.id), null);
  a.open = false;
  assert.equal(O.setRideStaffingMode(s, b.id, "auto"), null);
  for (let i = 0; i < 10; i++) O.autoAssignRideCrews(s);
  assert.equal(crew.buildingId, a.id);
  assert.equal(crew.mode, "manual");
  assert.equal(O.hasOperator(b), false);
  assertConsistent(s);
});
test("Closed/new rides receive fallback crews without loops, then yield an automatic idle crew to open tested demand", () => {
  const s = park(),
    crew = hire(s),
    [a, b] = rides(s);
  a.open = false;
  a.tested = false;
  b.open = false;
  b.tested = false;
  assert.equal(O.setRideStaffingMode(s, a.id, "auto"), null);
  O.autoAssignRideCrews(s);
  assert.equal(crew.buildingId, a.id);
  // Background demand is distinct from an explicit user request to prioritize B.
  b.operations.assignment = "auto";
  for (let i = 0; i < 20; i++) O.autoAssignRideCrews(s);
  assert.equal(crew.buildingId, a.id, "Closed rides do not continuously exchange the same team");
  b.open = true;
  b.tested = true;
  O.autoAssignRideCrews(s);
  assert.equal(crew.buildingId, b.id);
  assert.equal(O.hasOperator(a), false);
  assert.equal(pool(s).crews.length, 1);
  assertConsistent(s);
});
test("Available pool crews fill a later opening before an existing closed-ride crew is moved", () => {
  const s = park(),
    assigned = hire(s),
    [a, b] = rides(s);
  a.open = false;
  assert.equal(O.assignRideCrew(s, assigned.id, a.id), null);
  assert.equal(O.setCrewAutomatic(s, assigned.id), null);
  const free = hire(s);
  assert.equal(free.buildingId, null);
  assert.equal(O.setRideStaffingMode(s, b.id, "auto"), null);
  O.autoAssignRideCrews(s);
  assert.equal(assigned.buildingId, a.id);
  assert.equal(free.buildingId, b.id);
  assertConsistent(s);
});
test("Manual assignment replaces an idle destination crew in one click without changing identities or wages", () => {
  const s = park(),
    one = hire(s),
    two = hire(s),
    [a, b] = rides(s);
  assert.equal(O.assignRideCrew(s, two.id, b.id), null);
  const before = copy(s),
    wages = O.operatorWages(s),
    names = new Map(
      pool(s).crews.map((crew) => [
        crew.id,
        O.OPERATOR_POSTS.map((p) => O.crewMemberName(crew.id, p)),
      ]),
    );
  assert.equal(O.canAssignRideCrew(s, one.id, b.id), null);
  assert.deepEqual(copy(s), before, "Eligibility lookup must remain read-only");
  assert.equal(O.assignRideCrew(s, one.id, b.id), null);
  assert.equal(one.buildingId, b.id);
  assert.equal(one.mode, "manual");
  assert.equal(two.buildingId, null);
  assert.equal(two.mode, "auto");
  assert.equal(pool(s).crews.length, 2);
  assert.equal(O.operatorWages(s), wages);
  assert.equal(s.cash, before.cash);
  assert.deepEqual(
    O.rideCrew(b).map((member) => member.name),
    names.get(one.id),
  );
  assert.equal(O.setRideStaffingMode(s, a.id, "auto"), null);
  assert.equal(two.buildingId, a.id, "Displaced crew is available for normal automatic assignment");
  assert.deepEqual(
    O.rideCrew(a).map((member) => member.name),
    names.get(two.id),
  );
  assert.equal(O.assignRideCrew(s, one.id, a.id), null);
  assert.equal(one.buildingId, a.id);
  assert.equal(one.mode, "manual");
  assert.equal(
    two.buildingId,
    b.id,
    "The replaced crew automatically covers the now-vacant source",
  );
  assert.equal(two.mode, "auto");
  assert.equal(O.operatorWages(s), wages);
  assert.equal(s.cash, before.cash);
  assertConsistent(s);
});
test("Manual replacement rejects a running or unloading target atomically", () => {
  for (const phase of ["running", "unloading"]) {
    const s = park(),
      one = hire(s),
      two = hire(s),
      [a, b] = rides(s);
    assert.equal(O.assignRideCrew(s, one.id, a.id), null);
    assert.equal(O.assignRideCrew(s, two.id, b.id), null);
    Object.assign(b.operations, {
      phase,
      phaseLeft: phase === "unloading" ? 0.6 : 0,
      remainingRounds: phase === "running" ? 1 : 0,
    });
    if (phase === "running") {
      const template = S.newPark("sandbox").guests[0],
        id = s.nextId++;
      s.guests = [{ ...structuredClone(template), id, state: "ride", target: b.id, route: [] }];
      b.riders = [id];
      b.cycle = S.rideDuration(b);
    }
    assertConsistent(s);
    const before = copy(s);
    assert(O.canAssignRideCrew(s, one.id, b.id));
    assert.deepEqual(copy(s), before);
    assert(O.assignRideCrew(s, one.id, b.id));
    assert.deepEqual(copy(s), before);
  }
});
test("Busy or unloading crews cannot be moved, released or dismissed", () => {
  for (const phase of ["running", "unloading"]) {
    const s = park(),
      crew = hire(s),
      [a, b] = rides(s);
    assert.equal(O.assignRideCrew(s, crew.id, a.id), null);
    assert.equal(O.setCrewAutomatic(s, crew.id), null);
    Object.assign(a.operations, {
      phase,
      phaseLeft: phase === "unloading" ? 0.6 : 0,
      remainingRounds: phase === "running" ? 1 : 0,
    });
    if (phase === "running") {
      const template = S.newPark("sandbox").guests[0],
        id = s.nextId++;
      s.guests = [{ ...structuredClone(template), id, state: "ride", target: a.id, route: [] }];
      a.riders = [id];
      a.cycle = S.rideDuration(a);
    }
    a.open = false;
    assert.equal(O.setRideStaffingMode(s, b.id, "auto"), null);
    assertConsistent(s);
    const before = copy(s);
    for (const action of [
      () => O.assignRideCrew(s, crew.id, b.id),
      () => O.assignRideCrew(s, crew.id, null),
      () => O.dismissRideCrew(s, crew.id),
    ]) {
      assert(action());
      assert.deepEqual(copy(s), before);
    }
    O.autoAssignRideCrews(s);
    assert.equal(crew.buildingId, a.id);
    assert.equal(pool(s).crews.length, 1);
  }
});
test("Manual release returns the same crew to automatic distribution and explicitly disables the old ride", () => {
  const s = park(),
    crew = hire(s),
    [a, b] = rides(s);
  assert.equal(O.assignRideCrew(s, crew.id, a.id), null);
  assert.equal(O.assignRideCrew(s, crew.id, null), null);
  assert.equal(crew.buildingId, null);
  assert.equal(a.operations.assignment, "off");
  assert.equal(O.hasOperator(a), false);
  assert.equal(O.setRideStaffingMode(s, b.id, "auto"), null);
  O.autoAssignRideCrews(s);
  assert.equal(crew.buildingId, b.id);
  assert.equal(crew.mode, "auto");
  assertConsistent(s);
});
test("Dismissing an idle crew removes one wage unit without touching another crew's assignment", () => {
  const s = park(),
    one = hire(s),
    two = hire(s),
    a = rides(s)[0];
  assert.equal(O.assignRideCrew(s, one.id, a.id), null);
  const wage = O.operatorWages(s);
  assert.equal(O.dismissRideCrew(s, two.id), null);
  assert.equal(O.operatorWages(s), wage - O.OPERATOR_WAGE);
  assert.equal(one.buildingId, a.id);
  assert.equal(pool(s).crews.length, 1);
  assertConsistent(s);
});
test("Idle crews are paid once per crew, with actual daily payroll and no triple-person wage", () => {
  const s = park();
  hire(s);
  hire(s);
  hire(s);
  const expected = 3 * O.OPERATOR_WAGE;
  assert.equal(O.operatorWages(s), expected);
  assert.equal(O.operationsStats(s).personCount, 9);
  const baseline = copy(s);
  baseline.crewPool = { version: 1, nextId: 1, crews: [] };
  s.time = baseline.time = 89.9;
  const cost = s.expenses,
    zeroCost = baseline.expenses;
  S.tick(s, 0.2);
  S.tick(baseline, 0.2);
  const delta = s.expenses - cost - (baseline.expenses - zeroCost);
  assert(
    Math.abs(delta - D.difficultyCost(s, expected, "wages")) < 1e-7,
    `Idle payroll delta ${delta}`,
  );
  const paid = s.expenses;
  S.tick(s, 0.1);
  assert.equal(s.expenses, paid, "No second charge inside the same day");
  assertConsistent(s);
});
test("Legacy staffed rides migrate once, retain names, and preserve explicit unstaffed rides", () => {
  const s = park(),
    rs = rides(s);
  delete s.crewPool;
  for (const [i, b] of rs.entries()) {
    b.operations.staffed = i !== 1;
    delete b.operations.crewId;
    delete b.operations.assignment;
  }
  const expected = rs
    .filter((b) => b.operations.staffed)
    .map((b) => ({
      building: b.id,
      names: O.OPERATOR_POSTS.map((post) => O.operatorName(b, post)),
    }));
  assert(S.validSave(copy(s)));
  const before = copy(s);
  O.crewPoolOf(s);
  assert.deepEqual(copy(s), before, "Read-only pool lookup migrated state");
  S.migratePark(s);
  assert.equal(pool(s).crews.length, expected.length);
  assert.equal(O.hasOperator(rs[1]), false);
  for (const row of expected)
    assert.deepEqual(
      O.rideCrew(rs.find((b) => b.id === row.building)).map((m) => m.name),
      row.names,
    );
  const once = copy(s);
  for (let i = 0; i < 3; i++) S.migratePark(s);
  assert.deepEqual(copy(s), once);
  assertConsistent(s);
});
test("Assigned/free crews and modes survive pause and deterministic save/resume", () => {
  const s = park(),
    crew = hire(s),
    idle = hire(s),
    a = rides(s)[0];
  assert.equal(O.assignRideCrew(s, crew.id, a.id), null);
  assert.equal(O.assignRideCrew(s, idle.id, null), null);
  s.speed = 0;
  const frozen = copy(s);
  S.tick(s, 30);
  assert.deepEqual(copy(s), frozen);
  const resumed = copy(s);
  S.migratePark(resumed);
  assertConsistent(resumed);
  s.speed = resumed.speed = 1;
  for (let i = 0; i < 20; i++) {
    S.tick(s, 0.1);
    S.tick(resumed, 0.1);
  }
  assert.deepEqual(copy(s), copy(resumed));
});
test("Unknown references and malformed pool/link shapes are rejected without partial mutations", () => {
  const s = park(),
    crew = hire(s),
    a = rides(s)[0];
  assert.equal(O.assignRideCrew(s, crew.id, a.id), null);
  for (const action of [
    () => O.assignRideCrew(s, 999, a.id),
    () => O.assignRideCrew(s, crew.id, 999),
    () => O.dismissRideCrew(s, 999),
    () => O.setRideStaffingMode(s, 999, "off"),
  ]) {
    const before = copy(s);
    assert(action());
    assert.deepEqual(copy(s), before);
  }
  for (const change of [
    (s) => (s.crewPool.version = 2),
    (s) => (s.crewPool.nextId = 0),
    (s) => s.crewPool.crews.push({ ...s.crewPool.crews[0] }),
    (s) => (s.crewPool.crews[0].id = 0.5),
    (s) => (s.crewPool.crews[0].mode = "sometimes"),
    (s) => (s.crewPool.crews[0].buildingId = 999999),
    (s) => (s.buildings[0].operations.crewId = NaN),
    (s) => (s.buildings[0].operations.assignment = "locked"),
  ]) {
    const bad = copy(s);
    change(bad);
    assert.equal(S.validSave(bad), false);
  }
});
test("Demolishing a staffed empty attraction while paused preserves the crew and an immediately valid save", () => {
  const s = park(),
    crew = hire(s),
    a = rides(s)[0];
  assert.equal(O.assignRideCrew(s, crew.id, a.id), null);
  s.speed = 0;
  const count = pool(s).crews.length;
  S.remove(s, a.x, a.y);
  assert(!s.buildings.some((b) => b.id === a.id));
  assert.equal(pool(s).crews.length, count);
  assert.equal(pool(s).crews.find((c) => c.id === crew.id).buildingId, null);
  assert.equal(crew.mode, "auto", "A demolished manual binding returns the crew to the free pool");
  assertConsistent(s);
});
test("Crew hiring limit rejects the extra hire without charging or altering the roster", () => {
  const s = park();
  s.crewPool = {
    version: 1,
    nextId: O.MAX_RIDE_CREWS + 1,
    crews: Array.from({ length: O.MAX_RIDE_CREWS }, (_, i) => ({
      id: i + 1,
      buildingId: null,
      mode: "manual",
    })),
  };
  const before = copy(s);
  assert(O.hireRideCrew(s));
  assert.deepEqual(copy(s), before);
});
// Coordinated final opening-edge regression: an explicit Auto request has a
// preferred target, while ordinary simulation updates keep closed posts stable.
test("An explicit Auto request staffs a closed target without stealing manual or busy crews", () => {
  for (const guard of ["none", "manual", "running", "unloading"]) {
    const s = park(),
      [source, target] = rides(s),
      crew = hire(s),
      cash = s.cash;
    source.open = target.open = false;
    assert.equal(O.setRideStaffingMode(s, source.id, "auto"), null);
    target.operations.assignment = "auto";
    if (guard === "manual") assert.equal(O.assignRideCrew(s, crew.id, source.id), null);
    if (guard === "running") {
      source.riders = [99999];
      O.startRideProgram(source);
    }
    if (guard === "unloading") O.finishRideProgram(source);
    for (let i = 0; i < 8; i++) O.autoAssignRideCrews(s);
    assert.equal(
      crew.buildingId,
      source.id,
      "Background updates must not shuffle closed assignments",
    );
    const names = O.OPERATOR_POSTS.map((post) => O.crewMemberName(crew.id, post));
    assert.equal(O.setRideStaffingMode(s, target.id, "auto"), null);
    assert.equal(crew.buildingId, guard === "none" ? target.id : source.id);
    assert.equal(O.hasOperator(target), guard === "none");
    assert.equal(pool(s).crews.length, 1);
    assert.equal(O.operatorWages(s), 70);
    assert.equal(s.cash, cash);
    if (guard === "none") {
      assert.deepEqual(
        O.rideCrew(target).map((member) => member.name),
        names,
      );
      for (let i = 0; i < 8; i++) O.autoAssignRideCrews(s);
      assert.equal(crew.buildingId, target.id);
      assertConsistent(s);
    }
  }
});
console.log(`${results.filter((t) => t.pass).length}/${results.length} passed`);
process.exitCode = results.some((t) => !t.pass) ? 1 : 0;

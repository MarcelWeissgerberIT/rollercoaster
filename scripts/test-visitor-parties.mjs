import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  V = await import(moduleURL("game/visitors.ts")),
  M = await import(moduleURL("game/marketing.ts"));
const results = [];
let seed = 8821;
Math.random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
function test(name, run) {
  try {
    run();
    results.push({ name, pass: true });
  } catch (error) {
    results.push({ name, pass: false, error: error.message.slice(0, 1400) });
  }
  console.log(JSON.stringify(results.at(-1)));
}
function fixture() {
  const s = S.newPark("sandbox");
  s.guests = [];
  s.buildings = [];
  s.transitLines = [];
  s.zoo = { keepers: 0, workers: [], nextId: 1 };
  s.tiles = s.tiles.map((row) => row.map(() => "grass"));
  for (let y = 1; y < 30; y++) s.tiles[y][15] = "path";
  for (let x = 8; x <= 15; x++) s.tiles[16][x] = "path";
  for (let x = 8; x <= 12; x++) s.tiles[15][x] = "path";
  s.time = 0;
  s.spawnClock = -100000;
  s.staff = 0;
  s.open = true;
  s.speed = 1;
  s.cash = 100000;
  const result = S.build(s, "zebra", 8, 10);
  assert(!result.error, result.error);
  const b = s.buildings.find((b) => b.id === result.id);
  b.open = true;
  b.habitat.count = 2;
  return { s, b };
}
function rollFor(s, kind) {
  const weights = V.visitorAudience(s).weights;
  const order = ["solo", "couple", "friends", "family"];
  const before = order.slice(0, order.indexOf(kind)).reduce((sum, k) => sum + weights[k], 0);
  return (before + weights[kind] * 0.5) / Object.values(weights).reduce((a, n) => a + n, 0);
}
function party(s, kind = "family") {
  return S.newVisitorParty(s, rollFor(s, kind));
}
function positionGroup(guests, x = 15, y = 18) {
  for (const g of guests)
    Object.assign(g, {
      x,
      y,
      timer: 0,
      route: [],
      target: null,
      state: "walk",
      hunger: 5,
      thirst: 5,
      bladder: 5,
    });
}
test("A real family has two named adults and two children, stable group membership and one profile", () => {
  const { s } = fixture(),
    members = party(s);
  assert.equal(members.length, 4);
  assert.deepEqual(
    members.map((g) => g.ageGroup),
    ["adult", "adult", "child", "child"],
  );
  assert(
    members.every(
      (g, i) =>
        g.party.kind === "family" &&
        g.party.id === members[0].id &&
        g.party.member === i &&
        g.party.size === 4 &&
        g.profile === "family",
    ),
  );
  assert.equal(new Set(members.map((g) => g.name.split(" ").at(-1))).size, 1);
  assert.match(V.visitorPartyLabel(members[2]), /Familie .+ · 4 Personen/);
  assert(S.validSave(s));
});
test("Couples, friends and solos have real adult members and unique party identities", () => {
  const { s } = fixture();
  const couples = party(s, "couple"),
    friends = party(s, "friends"),
    solo = party(s, "solo");
  assert.equal(couples.length, 2);
  assert(friends.length === 2 || friends.length === 3);
  assert.equal(solo.length, 1);
  assert([...couples, ...friends, ...solo].every((g) => g.ageGroup === "adult"));
  assert.equal(new Set([couples[0], friends[0], solo[0]].map((g) => g.party.id)).size, 3);
  assert(S.validSave(JSON.parse(JSON.stringify(s))));
});
test("Zoo, family attractions and thrill rides change the model only when open and reachable", () => {
  const { s, b } = fixture();
  b.open = false;
  const base = V.visitorAudience(s);
  b.open = true;
  const zoo = V.visitorAudience(s);
  assert.equal(zoo.activeZoo, 1);
  assert(zoo.percentages.family > base.percentages.family);
  b.habitat.viewpoint = { x: 7, y: 12 };
  assert.equal(V.visitorAudience(s).activeZoo, 0);
  delete b.habitat.viewpoint;
  b.habitat.safety = { condition: 10, electric: false };
  assert.equal(V.visitorAudience(s).activeZoo, 0);
  delete b.habitat.safety;
  const r = S.build(s, "drop", 16, 20);
  assert(!r.error, r.error);
  const ride = s.buildings.find((b) => b.id === r.id);
  ride.open = true;
  const thrill = V.visitorAudience(s);
  assert.equal(thrill.thrillAttractions, 1);
  assert(thrill.percentages.friends > zoo.percentages.friends);
  ride.operations = { staffed: false, rounds: 1, remainingRounds: 0, phase: "idle", phaseLeft: 0 };
  assert.equal(V.visitorAudience(s).thrillAttractions, 0);
  assert.match(thrill.summary, /keine gemessene/);
});
test("Family amenities count only at their actual accessible edge", () => {
  const { s } = fixture();
  const result = S.build(s, "playground", 16, 22);
  assert(!result.error, result.error);
  assert.equal(V.visitorAudience(s).familyAmenities, 1);
  for (let y = 22; y < 25; y++) s.tiles[y][15] = "grass";
  assert.equal(V.visitorAudience(s).familyAmenities, 0);
});
test("Group admission preserves per-person ticket, income and marketing accounting", () => {
  const { s } = fixture();
  assert.equal(M.startMarketing(s, "flyers", 1), null);
  const c = s.marketing.campaigns[0],
    before = {
      cash: s.cash,
      income: s.income,
      dayIncome: s.dayIncome,
      arrivals: s.arrivals,
      op: s.operatingIncomeToday,
    };
  const original = Math.random;
  Math.random = () => 0.999;
  let members;
  try {
    members = S.newVisitorParty(s, 0.999);
  } finally {
    Math.random = original;
  }
  assert.equal(members.length, 4);
  assert.equal(s.cash - before.cash, s.ticket * 4);
  assert.equal(s.income - before.income, s.ticket * 4);
  assert.equal(s.dayIncome - before.dayIncome, s.ticket * 4);
  assert.equal(s.arrivals - before.arrivals, 4);
  assert.equal(s.operatingIncomeToday - before.op, s.ticket * 4);
  assert.equal(c.visitors, 4);
  assert.equal(c.revenue.ticket, s.ticket * 4);
  assert(S.validSave(s));
});
test("Full parties fit within 220 guests and a full park makes no partial admission or charge", () => {
  const { s } = fixture();
  while (s.guests.length < 218) S.newVisitorParty(s, 0);
  const last = S.newVisitorParty(s, 0.999);
  assert.equal(last.length, 2);
  assert(last.every((g) => g.party.kind !== "family" && g.party.size === 2));
  assert.equal(s.guests.length, 220);
  const before = structuredClone(s);
  assert.deepEqual(S.newVisitorParty(s, 0.99), []);
  assert.deepEqual(s, before);
  assert(S.validSave(s));
});
test("Admission probability normalization preserves expected people rather than multiplying attendance", () => {
  const { s } = fixture(),
    audience = V.visitorAudience(s),
    demand = S.entryDemand(s);
  assert(audience.expectedPartySize > 1);
  const kinds = new Map();
  for (let i = 0; i < 1000; i++) {
    const plan = V.planVisitorParty(s, (i + 0.5) / 1000, audience);
    kinds.set(plan.kind, (kinds.get(plan.kind) ?? 0) + 1);
  }
  for (const [kind, count] of kinds)
    assert(Math.abs(count / 10 - audience.percentages[kind]) < 0.2);
  const before = s.arrivals,
    original = Math.random;
  try {
    for (let i = 0; i < 500; i++) {
      s.guests = [];
      s.spawnClock = 100;
      s.rating = 80;
      Math.random = () => (i + 0.5) / 500;
      S.tick(s, 0.001);
    }
  } finally {
    Math.random = original;
  }
  assert(
    Math.abs(s.arrivals - before - demand * 500) < 10,
    `${s.arrivals - before} actual admitted people versus ${demand * 500} expected without group multiplication`,
  );
});
test("Existing saves stay valid and old guests become varied adults without invented family links", () => {
  const s = S.newPark("sandbox");
  for (const g of s.guests) {
    delete g.party;
    delete g.ageGroup;
    delete g.appearance;
  }
  assert(S.validSave(s));
  S.migratePark(s);
  assert(s.guests.every((g) => !g.party && g.ageGroup === "adult"));
  assert(new Set(s.guests.map((g) => V.guestAppearance(g).shirt)).size > 7);
  assert(S.validSave(s));
});
test("Appearance is deterministic across save/reload with independent clothes and child proportions", () => {
  const { s } = fixture(),
    members = party(s),
    saved = JSON.parse(JSON.stringify(s));
  assert.deepEqual(members.map(V.guestAppearance), saved.guests.map(V.guestAppearance));
  const child = V.guestAppearance(members[2]),
    adult = V.guestAppearance(members[0]);
  assert(child.heightScale < adult.heightScale * 0.83);
  assert.equal(child.ageGroup, "child");
  const variants = Array.from({ length: 100 }, (_, i) =>
    V.guestAppearance({ id: i + 1, skin: 0, appearance: V.appearanceSeed(i + 1) }),
  );
  assert.equal(new Set(variants.map((v) => v.shirt)).size, 12);
  assert(new Set(variants.map((v) => v.skinTone)).size >= 5);
  assert.equal(new Set(variants.map((v) => v.accessory)).size, 4);
});
test("Malformed ages, appearance seeds and inconsistent or duplicated memberships are rejected", () => {
  for (const patch of [
    { ageGroup: "baby" },
    { ageGroup: "child", party: undefined },
    { appearance: -1 },
    { appearance: 0.5 },
    { appearance: Infinity },
    { appearance: 2 ** 32 },
    { party: null },
    { party: { id: 1, kind: "family", member: 1, size: 3 } },
  ]) {
    const { s } = fixture();
    party(s);
    Object.assign(s.guests[0], patch);
    assert.equal(S.validSave(s), false, JSON.stringify(patch));
  }
  const { s } = fixture(),
    group = party(s);
  group[1].party.member = 0;
  assert.equal(S.validSave(s), false);
  group[1].party.member = 1;
  group[2].ageGroup = "adult";
  assert.equal(S.validSave(s), false);
  group[2].ageGroup = "child";
  s.guests = s.guests.filter((g) => g.id !== group[0].id);
  assert(S.validSave(s), "An already-departed member must not invalidate the remaining group");
});
test("Family members walk to their adult's habitat and observe without teleporting or queues", () => {
  const { s, b } = fixture(),
    group = party(s);
  positionGroup(group);
  let allObserved = false;
  for (let i = 0; i < 180; i++) {
    const before = group.map((g) => ({ x: g.x, y: g.y }));
    S.tick(s, 0.1);
    for (let j = 0; j < group.length; j++)
      assert(
        Math.hypot(group[j].x - before[j].x, group[j].y - before[j].y) < 0.2,
        "Guest teleported while following",
      );
    if (group.every((g) => g.state === "observe")) {
      allObserved = true;
      break;
    }
  }
  assert(allObserved, JSON.stringify(group.map((g) => [g.state, g.target, g.x, g.y, g.thought])));
  assert(group.every((g) => g.target === b.id));
  assert.deepEqual(b.queue, []);
  assert(S.validSave(s));
});
test("A leading walker pauses for lagging companions, then resumes as they approach", () => {
  const { s, b } = fixture(),
    group = party(s);
  positionGroup(group, 15, 21);
  group[0].y = 16;
  for (const g of group) {
    g.target = b.id;
    g.route = S.findRoute(s, g, S.access(s, b));
  }
  const before = { x: group[0].x, y: group[0].y };
  assert(V.partyShouldWait(s, group[0]));
  S.tick(s, 0.1);
  assert.deepEqual({ x: group[0].x, y: group[0].y }, before);
  for (let i = 0; i < 100 && group[0].x === before.x && group[0].y === before.y; i++)
    S.tick(s, 0.1);
  assert(Math.hypot(group[0].x - before.x, group[0].y - before.y) > 0);
  assert(group.every((g) => V.partyWalkingSpeed(g) === V.partyWalkingSpeed(group[0])));
});
test("Followers safely update their routes when the adult changes destination", () => {
  const { s, b } = fixture(),
    group = party(s);
  const built = S.build(s, "flamingo", 18, 6);
  assert(!built.error, built.error);
  const next = s.buildings.find((b) => b.id === built.id);
  next.open = true;
  next.habitat.count = 2;
  for (let x = 15; x <= 22; x++) s.tiles[10][x] = "path";
  positionGroup(group, 15, 18);
  for (const g of group) {
    g.target = b.id;
    g.route = S.findRoute(s, g, S.access(s, b));
  }
  group[0].target = next.id;
  group[0].route = S.findRoute(s, group[0], S.access(s, next));
  const before = group.map((g) => ({ x: g.x, y: g.y }));
  S.tick(s, 0.1);
  assert(group.every((g) => g.target === next.id));
  assert(group.every((g, i) => Math.hypot(g.x - before[i].x, g.y - before[i].y) < 0.2));
  assert(S.validSave(s));
});
test("Couples share their destination and follow a departing companion normally", () => {
  const { s, b } = fixture(),
    group = party(s, "couple");
  positionGroup(group);
  S.tick(s, 0.1);
  assert.equal(group[0].target, b.id);
  assert.equal(group[1].target, b.id);
  group[0].state = "leave";
  group[0].target = null;
  group[0].route = S.findRoute(s, group[0], S.ENTRANCE);
  S.tick(s, 0.1);
  assert.equal(group[1].state, "leave");
  assert.equal(group[1].target, null);
  assert(S.validSave(s));
});
test("Finished companions wait through the same observation without repeating visits", () => {
  const { s, b } = fixture(),
    group = party(s);
  for (let i = 0; i < group.length; i++)
    Object.assign(group[i], {
      x: 8 + i,
      y: 15,
      target: b.id,
      state: "observe",
      route: [],
      timer: [7, 4, 1, 2][i],
    });
  b.served = 4;
  for (let i = 0; i < 65; i++) S.tick(s, 0.1);
  assert.equal(b.served, 4);
  assert.equal(group[0].rides, 0);
  assert(group.slice(1).every((g) => g.rides === 1 && g.state === "walk"));
  for (let i = 0; i < 10; i++) S.tick(s, 0.1);
  assert(group.every((g) => g.rides === 1));
  assert.equal(b.served, 4);
  assert(S.validSave(JSON.parse(JSON.stringify(s))));
});
test("Cohesion respects existing queue capacity and reunites after split ride cycles", () => {
  const { s, b } = fixture();
  b.open = false;
  const built = S.build(s, "carousel", 16, 20);
  assert(!built.error, built.error);
  const ride = s.buildings.find((b) => b.id === built.id);
  ride.open = true;
  const outsider = party(s, "solo")[0];
  Object.assign(outsider, { x: 15, y: 20, state: "ride", target: ride.id, route: [], timer: 0 });
  ride.riders = [outsider.id];
  ride.cycle = 20;
  const group = party(s);
  positionGroup(group, 15, 19);
  let reunited = false;
  for (let i = 0; i < 1000; i++) {
    S.tick(s, 0.1);
    assert(ride.queue.length <= S.queueCapacity(s, ride));
    assert.equal(new Set(ride.queue).size, ride.queue.length);
    if (group.every((g) => g.rides >= 1)) {
      reunited = true;
      break;
    }
  }
  assert(reunited, JSON.stringify(group.map((g) => [g.state, g.target, g.rides, g.thought])));
  assert(S.validSave(s));
});
test("Families wait at the exit for their children and leave as a cohort", () => {
  const { s } = fixture(),
    group = party(s);
  positionGroup(group, 15, 23);
  group[0].y = 29;
  group[0].state = "leave";
  group[0].target = null;
  group[0].route = [];
  S.tick(s, 0.1);
  assert(s.guests.includes(group[0]));
  assert(group.slice(1).every((g) => g.state === "leave"));
  for (let i = 0; i < 150 && s.guests.length; i++) S.tick(s, 0.1);
  assert.equal(s.guests.length, 0);
  assert(S.validSave(s));
});
console.log(`${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exitCode = results.every((r) => r.pass) ? 0 : 1;

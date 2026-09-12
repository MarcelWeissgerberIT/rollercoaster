import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts"));
const A = await import(moduleURL("game/attraction-advisor.ts"));
const O = await import(moduleURL("game/operations.ts"));
const Z = await import(moduleURL("game/zoo.ts"));
const C = await import(moduleURL("game/construction.ts"));
const P = await import(moduleURL("game/pods.ts"));
let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("PASS", name);
  } catch (error) {
    console.error("FAIL", name, error);
    process.exit(1);
  }
}
function fixture(kind = "wheel") {
  const s = S.newPark("sandbox");
  s.unlimitedBudget = false;
  s.tiles = Array.from({ length: 30 }, () => Array(30).fill("grass"));
  for (let y = 0; y < 30; y++) s.tiles[y][15] = "path";
  s.guests = [];
  s.buildings = [];
  s.transitLines = [];
  s.cleanliness.litter = [];
  s.cleanliness.workers = [];
  s.zoo.workers = [];
  s.zoo.keepers = 0;
  s.staff = 0;
  s.cash = 50000;
  s.time = 0;
  s.spawnClock = -1000;
  s.open = true;
  s.speed = 1;
  s.crewPool = { version: 1, nextId: 2, crews: [] };
  const b = {
    id: 100,
    name: "Testangebot",
    kind,
    x: 16,
    y: 20,
    open: true,
    price: S.CATALOG[kind].price,
    tested: true,
    served: 0,
    revenue: 0,
    queue: [],
    riders: [],
    cycle: 0,
    condition: 100,
  };
  s.buildings.push(b);
  if (P.usesPods(kind))
    b.pods = {
      entry: { side: 2, offset: 0 },
      exit: { side: 2, offset: Math.min(1, S.CATALOG[kind].size - 1) },
    };
  if (O.needsOperator(kind)) {
    b.operations = {
      staffed: true,
      crewId: 1,
      assignment: "auto",
      rounds: 1,
      remainingRounds: 0,
      phase: "idle",
      phaseLeft: 0,
    };
    s.crewPool.crews = [{ id: 1, buildingId: b.id, mode: "manual" }];
  }
  if (Z.isHabitat(kind)) {
    Z.ensureHabitat(b);
    b.habitat.accessVersion = 1;
  }
  return { s, b };
}
const guest = (id, overrides = {}) => ({
  id,
  x: 15,
  y: 25,
  route: [],
  target: null,
  state: "walk",
  timer: 0,
  happiness: 80,
  hunger: 10,
  thirst: 10,
  rides: 0,
  skin: 0,
  thought: "",
  wallet: 30,
  profile: "family",
  bladder: 10,
  ...overrides,
});
const report = ({ s, b }) => A.attractionAdvice(s, b.id);
const issue = (f, id) => report(f).issues.find((i) => i.id === id);
const apply = (f, id) => {
  const item = issue(f, id);
  assert(item?.action, `${id} has an action`);
  return A.applyAttractionAdvice(f.s, f.b.id, id, item.action.id);
};

test("Healthy reachable ride has no invented attendance blocker and reads are pure", () => {
  const f = fixture();
  f.s.guests.push(guest(1, { target: f.b.id }));
  const before = JSON.stringify(f.s),
    r = report(f);
  assert.equal(r.status, "healthy");
  assert.equal(r.metrics.enRoute, 1);
  assert.equal(r.metrics.waiting, 0);
  assert.equal(r.metrics.active, 0);
  assert(!r.issues.some((i) => i.severity === "blocker"));
  assert.equal(JSON.stringify(f.s), before);
  delete f.b.operations;
  delete f.s.crewPool;
  const legacy = JSON.stringify(f.s);
  report(f);
  assert.equal(JSON.stringify(f.s), legacy);
});
test("Unknown and decorative objects are not given fake ride diagnoses", () => {
  const f = fixture("tree");
  assert.equal(report(f), null);
  assert.equal(A.attractionAdvice(f.s, -1), null);
});
test("Real target states count transit as en route rather than as a second ride", () => {
  const f = fixture();
  f.b.served = 12;
  f.s.guests = [
    guest(1, { target: 100, state: "queue" }),
    guest(2, { target: 100, state: "ride" }),
    guest(3, { target: 100, state: "ride", transit: { line: 1, from: 2, to: 3 } }),
    guest(4, { target: 100, state: "leave" }),
  ];
  assert.deepEqual(report(f).metrics, { enRoute: 1, waiting: 1, active: 1, served: 12 });
});
test("Closed ready ride gets an explicit zero-cost opening action", () => {
  const f = fixture();
  f.b.open = false;
  assert.equal(issue(f, "closed").action.kind, "connect-open");
  const cash = f.s.cash;
  assert.equal(apply(f, "closed"), null);
  assert.equal(f.b.open, true);
  assert.equal(f.s.cash, cash);
});
test("Missing crew blocks opening; assigning an existing crew never hires one", () => {
  const f = fixture();
  f.b.open = false;
  f.b.operations.staffed = false;
  f.s.crewPool.crews[0].buildingId = null;
  assert.equal(issue(f, "staff").severity, "blocker");
  assert.equal(issue(f, "staff").action.kind, "assign-crew");
  assert.notEqual(issue(f, "closed").action?.kind, "connect-open");
  const cash = f.s.cash;
  assert.equal(apply(f, "staff"), null);
  assert.equal(O.hasOperator(f.b), true);
  assert.equal(f.s.crewPool.crews.length, 1);
  assert.equal(f.s.cash, cash);
});
test("No free crew produces navigation instead of silently hiring", () => {
  const f = fixture();
  f.b.operations.staffed = false;
  f.s.crewPool.crews = [];
  const before = JSON.stringify(f.s);
  assert.equal(issue(f, "staff").action.kind, "staff");
  assert(A.applyAttractionAdvice(f.s, 100, "staff"));
  assert.equal(JSON.stringify(f.s), before);
});
test("Broken ride quotes an affordable repair and charges exactly once", () => {
  const f = fixture();
  f.b.condition = 20;
  f.b.open = false;
  const advice = issue(f, "repair"),
    cost = advice.action.cost,
    cash = f.s.cash;
  assert(cost > 0);
  assert.equal(advice.severity, "blocker");
  assert.equal(A.applyAttractionAdvice(f.s, 100, "repair", advice.action.id), null);
  assert.equal(f.b.condition, 20);
  assert.equal(f.b.maintenance.request, "repair");
  assert.equal(f.s.cash, cash - cost);
  assert.equal(f.b.open, false);
  const after = JSON.stringify(f.s);
  assert(A.applyAttractionAdvice(f.s, 100, "repair", advice.action.id));
  assert.equal(JSON.stringify(f.s), after);
});
test("Insufficient repair funds and changed price quotes never mutate the park", () => {
  const f = fixture();
  f.b.condition = 20;
  const quote = issue(f, "repair").action.id;
  f.b.condition = 18;
  const stale = JSON.stringify(f.s);
  assert(A.applyAttractionAdvice(f.s, 100, "repair", quote));
  assert.equal(JSON.stringify(f.s), stale);
  f.s.cash = 0;
  assert(issue(f, "repair").action.disabledReason);
  const before = JSON.stringify(f.s);
  assert(apply(f, "repair"));
  assert.equal(JSON.stringify(f.s), before);
});
test("Missing entry can connect without clearing scenery then receive real guests", () => {
  const f = fixture();
  f.b.x = 19;
  f.b.open = false;
  f.s.guests = [guest(1), guest(2), guest(3)];
  const a = issue(f, "access");
  assert.equal(a.action.kind, "connect-open");
  assert(a.action.cost > 0);
  const cash = f.s.cash;
  assert.equal(apply(f, "access"), null);
  assert(S.access(f.s, f.b));
  assert.equal(f.s.cash, cash - a.action.cost);
  assert(f.b.open);
  S.tick(f.s, 0.25);
  assert(
    f.s.guests.some((g) => g.target === 100),
    "Actual chooser selects newly connected ride",
  );
});
test("Entry solver refuses occupied fields and unaffordable plans without partial painting", () => {
  const f = fixture();
  f.b.x = 19;
  f.b.open = false;
  f.s.cash = 0;
  assert(issue(f, "access").action.disabledReason);
  const before = JSON.stringify(f.s);
  assert(apply(f, "access"));
  assert.equal(JSON.stringify(f.s), before);
  f.s.cash = 50000;
  const port = P.podPort(f.b, S.CATALOG.wheel.size, f.b.pods.entry);
  f.s.buildings.push({ ...f.b, id: 101, kind: "tree", x: port.x, y: port.y, pods: undefined });
  const alternative = issue(f, "access").action;
  assert.equal(alternative.kind, "connect-open");
  assert.match(alternative.label, /Einlass versetzen/);
  const oldPod = structuredClone(f.b.pods.entry);
  assert.equal(apply(f, "access"), null);
  assert(S.access(f.s, f.b));
  assert.notDeepEqual(f.b.pods.entry, oldPod);
  assert(
    f.s.buildings.some((b) => b.id === 101),
    "Tree is never removed",
  );
});
test("Entry relocation will not interrupt guests and rejects changed alternative routes", () => {
  const f = fixture();
  f.b.x = 19;
  f.b.open = false;
  const p = P.podPort(f.b, S.CATALOG.wheel.size, f.b.pods.entry);
  f.s.buildings.push({ ...f.b, id: 101, kind: "tree", x: p.x, y: p.y, pods: undefined });
  const quote = issue(f, "access").action.id;
  f.s.guests.push(guest(1, { target: 100 }));
  assert.equal(issue(f, "access").action.kind, "access");
  const before = JSON.stringify(f.s);
  assert(A.applyAttractionAdvice(f.s, 100, "access", quote));
  assert.equal(JSON.stringify(f.s), before);
});
test("Closed park is a real blocker even when the attraction is open", () => {
  const f = fixture();
  f.s.open = false;
  assert.equal(issue(f, "park-closed").severity, "blocker");
  assert.equal(report(f).status, "blocked");
});
test("Open track edit suppresses opening and access mutations", () => {
  const f = fixture();
  f.b.open = false;
  f.s.trackEdit = { buildingId: 100, prefix: [], suffix: [], wasOpen: true, removedLength: 0 };
  assert.equal(report(f).issues[0].id, "track-edit");
  assert(!report(f).issues.some((i) => i.action?.kind === "connect-open"));
});
test("Untested coaster offers explicit test with later automatic opening", () => {
  const original = S.newPark("sandbox");
  const b = original.buildings.find((b) => b.kind === "coaster");
  assert(b);
  b.tested = false;
  b.open = false;
  const f = { s: original, b };
  assert(S.access(f.s, b));
  const a = issue(f, "test").action;
  assert.equal(a.kind, "connect-open");
  assert.match(a.label, /Test/);
  assert.equal(apply(f, "test"), null);
  assert(b.testing > 0);
  assert.equal(b.autoOpen, true);
  assert.equal(b.open, false);
});
test("Disconnected exit is a warning with a safe relocation, not a false zero-visitor blocker", () => {
  const f = fixture();
  f.b.pods.exit = { side: 0, offset: 1 };
  const a = issue(f, "exit");
  assert.equal(a.severity, "warning");
  assert.equal(a.action.kind, "connect-exit");
  const oldCash = f.s.cash;
  assert.equal(apply(f, "exit"), null);
  assert(S.exitPath(f.s, f.b).length);
  assert.equal(f.b.open, true);
  assert.equal(f.s.cash, oldCash - a.action.cost);
});
test("Exit assistant does not eject or reroute existing guests", () => {
  const f = fixture();
  f.b.pods.exit = { side: 0, offset: 1 };
  f.s.guests.push(guest(1, { target: 100 }));
  assert.equal(issue(f, "exit").action.kind, "access");
  const before = JSON.stringify(f.s);
  assert(apply(f, "exit"));
  assert.equal(JSON.stringify(f.s), before);
});
test("Party minimum wallet drives price advice; lower price changes actual selection", () => {
  const f = fixture();
  f.b.price = 30;
  f.s.guests = [guest(1, { wallet: 8 }), guest(2, { wallet: 8 }), guest(3, { wallet: 8 })];
  const price = issue(f, "price");
  assert.equal(price.action.kind, "lower-price");
  const current = f.s.cash;
  assert.equal(apply(f, "price"), null);
  assert(f.b.price <= 8);
  assert.equal(f.s.cash, current);
  S.tick(f.s, 0.25);
  assert(f.s.guests.some((g) => g.target === 100));
  const families = fixture();
  families.b.price = 12;
  for (let i = 0; i < 3; i++)
    families.s.guests.push(
      guest(i * 2 + 1, { wallet: 50, party: { id: i + 1, kind: "couple", member: 0, size: 2 } }),
      guest(i * 2 + 2, { wallet: 4, party: { id: i + 1, kind: "couple", member: 1, size: 2 } }),
    );
  assert.match(issue(families, "price").detail, /3 von 3/);
});
test("Free price advice is usable while park cash is negative and respects supplies", () => {
  const f = fixture("plush");
  f.s.cash = -200;
  f.b.price = 30;
  f.s.guests = [guest(1, { wallet: 8 }), guest(2, { wallet: 8 }), guest(3, { wallet: 8 })];
  const a = issue(f, "price").action;
  assert(!a.disabledReason);
  assert(a.value >= 5);
  assert.equal(apply(f, "price"), null);
  assert.equal(f.s.cash, -200);
});
test("Long programs and full queues get distinct facts; current ride is preserved", () => {
  const f = fixture();
  f.b.operations.rounds = 3;
  f.b.operations.remainingRounds = 3;
  f.b.operations.phase = "running";
  f.b.cycle = 70;
  f.b.riders = [1];
  f.s.guests = [
    guest(1, { target: 100, state: "ride" }),
    ...Array.from({ length: 4 }, (_, i) => guest(i + 2, { target: 100, state: "queue" })),
  ];
  f.b.queue = [2, 3, 4, 5];
  assert(issue(f, "queue-full"));
  assert.equal(issue(f, "wait").action.kind, "shorter-program");
  assert.equal(apply(f, "wait"), null);
  assert.equal(f.b.operations.rounds, 1);
  assert.equal(f.b.operations.remainingRounds, 3);
  assert.equal(f.b.cycle, 70);
  assert.deepEqual(f.b.riders, [1]);
});
test("Empty and unsafe habitats are diagnosed without imaginary ride queues or tests", () => {
  const f = fixture("elephant");
  f.b.open = false;
  f.b.habitat.count = 0;
  assert(issue(f, "animals"));
  assert(!issue(f, "test"));
  assert(!issue(f, "exit"));
  f.b.habitat.count = 2;
  f.b.habitat.safety = { condition: 10, electric: false };
  assert(issue(f, "safety"));
  assert(!report(f).issues.some((i) => i.action?.kind === "connect-open"));
});
test("Designated habitat viewpoint, specialist care and low welfare are actionable facts", () => {
  const f = fixture("elephant");
  f.b.habitat.count = 2;
  f.b.habitat.health = 20;
  f.b.habitat.viewpoint = { x: f.b.x + S.CATALOG.elephant.size, y: f.b.y };
  assert(issue(f, "access"));
  assert.match(issue(f, "access").detail, /festgelegte/);
  assert(issue(f, "zoo-staff"));
  assert.match(issue(f, "welfare").detail, /auf null/);
  assert(!issue(f, "test"));
  assert(!issue(f, "queue-full"));
});
test("Transport has line readiness and travel-purpose advice instead of coaster diagnoses", () => {
  const f = fixture("train");
  f.b.pods = undefined;
  assert(issue(f, "transport-line"));
  assert(!issue(f, "staff"));
  assert(!issue(f, "test"));
  const other = { ...f.b, id: 101, y: 10 };
  f.s.buildings.push(other);
  f.s.transitLines = [
    {
      id: 200,
      kind: "train",
      a: 100,
      b: 101,
      route: Array.from({ length: 11 }, (_, i) => ({ x: 15, y: 20 - i })),
      position: 0,
      direction: 1,
      wait: 4,
      passengers: [],
      trips: 0,
      served: 0,
      revenue: 0,
      enabled: true,
    },
  ];
  assert(issue(f, "transport-demand"));
  assert(!issue(f, "transport-line"));
});
test("Local litter and unmet needs are observations rather than invented lost revenue", () => {
  const f = fixture();
  f.s.cleanliness.litter = [{ id: 1, x: 15, y: 20, kind: "cup", amount: 4 }];
  f.s.guests = [1, 2, 3].map((id) => guest(id, { y: 20, thirst: 90 }));
  assert.match(issue(f, "litter").detail, /kein bestimmter verlorener Besuch/);
  assert.match(issue(f, "needs").detail, /3 durstig/);
});
function transportFixture() {
  const f = fixture("train");
  f.b.pods = undefined;
  f.s.buildings.push({ ...f.b, id: 101, y: 10 });
  f.s.transitLines = [
    {
      id: 200,
      kind: "train",
      a: 100,
      b: 101,
      route: Array.from({ length: 11 }, (_, i) => ({ x: 15, y: 20 - i })),
      position: 0,
      direction: 1,
      wait: 4,
      passengers: [],
      trips: 0,
      served: 0,
      revenue: 0,
      enabled: true,
    },
  ];
  return f;
}
test("Transport detects full waiting areas and states solo-only eligibility", () => {
  const f = transportFixture();
  f.b.queue = Array.from({ length: 16 }, (_, i) => i + 1);
  assert.equal(issue(f, "queue-full").severity, "warning");
  assert.match(issue(f, "transport-demand").detail, /Einzelgäste/);
  assert.match(issue(f, "transport-demand").detail, /Familien, Paare und Freundesgruppen/);
  f.s.guests = [1, 2, 3, 4].map((id) =>
    guest(id, { party: { id: 1, kind: "family", member: id - 1, size: 4 } }),
  );
  assert(issue(f, "transport-audience"));
  assert.equal(report(f).status, "improve");
});
test("Transport fare advice uses solo wallets instead of family leaders", () => {
  const f = transportFixture();
  f.b.price = 30;
  f.s.guests = [1, 2, 3].map((id) => guest(id, { wallet: 8 }));
  const advice = issue(f, "price");
  assert.match(advice.detail, /3 von 3/);
  assert.equal(advice.action.kind, "lower-price");
  const cash = f.s.cash;
  assert.equal(apply(f, "price"), null);
  assert.equal(f.b.price, S.CATALOG.train.price);
  assert.equal(f.s.cash, cash);
  f.b.price = 30;
  f.s.guests.forEach((g, i) => {
    g.party = { id: 1, kind: "friends", member: i, size: 3 };
  });
  assert(!issue(f, "price"));
});
const finance = (s) => [
  s.cash,
  s.income,
  s.expenses,
  s.dayIncome,
  s.dayExpenses,
  s.operatingExpensesToday,
];
test("Advisor price edits undo only the price while preserving live condition and guests", () => {
  const f = fixture();
  f.b.price = 30;
  f.s.guests = [1, 2, 3].map((id) => guest(id, { wallet: 8 }));
  const money = finance(f.s),
    record = C.recordEdit(f.s, "Preis senken", () => assert.equal(apply(f, "price"), null));
  assert(record);
  assert.deepEqual(record.settings[0].keys, ["price"]);
  f.b.condition = 84;
  const visitors = JSON.stringify(f.s.guests);
  assert.equal(C.undoEdits(f.s, [record]), null);
  assert.equal(f.b.price, 30);
  assert.equal(f.b.condition, 84);
  assert.equal(JSON.stringify(f.s.guests), visitors);
  assert.deepEqual(finance(f.s), money);
});
test("Repair undo restores condition and exact same-period financial ledgers", () => {
  const f = fixture();
  f.b.condition = 20;
  f.b.open = false;
  f.s.operatingExpensesToday = 43;
  f.s.dayExpenses = 50;
  const before = finance(f.s);
  const record = C.recordEdit(f.s, "Reparieren", () => assert.equal(apply(f, "repair"), null));
  assert(record);
  assert.deepEqual(record.settings[0].keys, ["maintenance"]);
  assert(record.operatingExpenses > 0);
  assert.equal(C.undoEdits(f.s, [record]), null);
  assert.equal(f.b.condition, 20);
  assert.equal(f.b.maintenance?.request, undefined);
  assert.equal(f.b.open, false);
  assert.deepEqual(finance(f.s), before);
});
test("Undo of an older repair records one refund credit in the current billing period", () => {
  const f = fixture();
  f.b.condition = 20;
  f.b.open = false;
  const cash = f.s.cash,
    expenses = f.s.expenses;
  const record = C.recordEdit(f.s, "Reparieren", () => assert.equal(apply(f, "repair"), null));
  f.s.time += 90;
  f.s.dayExpenses = 77;
  f.s.operatingExpensesToday = 66;
  f.s.dayIncome = 55;
  assert.equal(C.undoEdits(f.s, [record]), null);
  assert.equal(f.s.cash, cash);
  assert.equal(f.s.expenses, expenses);
  assert.equal(f.s.dayExpenses, 77 - record.expenses);
  assert.equal(f.s.operatingExpensesToday, 66 - record.operatingExpenses);
  assert.equal(f.s.dayIncome, 55);
});
test("Repair undo batch refuses an occupied broken-state restore atomically", () => {
  const f = fixture();
  f.b.condition = 20;
  f.b.open = false;
  const repair = C.recordEdit(f.s, "Reparieren", () => assert.equal(apply(f, "repair"), null));
  const path = C.recordEdit(f.s, "Weg", () => assert.equal(S.paint(f.s, 14, 25, "path"), null));
  assert(repair);
  assert(path);
  for (const state of ["ride", "queue"]) {
    f.b.riders = state === "ride" ? [1] : [];
    f.b.queue = state === "queue" ? [1] : [];
    f.s.guests = [guest(1, { target: 100, state })];
    const before = JSON.stringify(f.s);
    assert.match(C.undoEdits(f.s, [repair, path]), /Gäste ausgestiegen/);
    assert.equal(
      JSON.stringify(f.s),
      before,
      "No path, money, guest or setting can change on failed undo",
    );
  }
});
test("Summary remains short and uses correct singular and plural", () => {
  const f = fixture();
  f.b.open = false;
  assert.match(report(f).summary, /^1 Betriebsproblem verhindert/);
  f.s.open = false;
  assert.match(report(f).summary, /^2 Betriebsprobleme verhindern/);
  f.b.open = true;
  f.s.open = true;
  assert(report(f).summary.length < 75);
  assert(!report(f).summary.includes("Prognose"));
});
console.log(`Attraction assistant: ${passed}/${passed} passed`);

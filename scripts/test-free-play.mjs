import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  B = await import(moduleURL("game/budget.ts")),
  F = await import(moduleURL("game/free-play.ts")),
  C = await import(moduleURL("game/construction.ts")),
  G = await import(moduleURL("game/grid.ts")),
  E = await import(moduleURL("game/entrance.ts")),
  M = await import(moduleURL("game/maintenance.ts")),
  Z = await import(moduleURL("game/zoo.ts")),
  K = await import(moduleURL("game/marketing.ts")),
  T = await import(moduleURL("game/transit.ts")),
  TE = await import(moduleURL("game/track-edit.ts")),
  O = await import(moduleURL("game/operations.ts")),
  L = await import(moduleURL("game/loans.ts"));
Math.random = () => 0.5;
let passed = 0;
const copy = (s) => JSON.parse(JSON.stringify(s));
function test(name, fn) {
  fn();
  passed++;
  console.log("PASS", name);
}
function build(s, kind, x, y, track) {
  const result = S.build(s, kind, x, y, track);
  assert(result.id, result.error);
  return s.buildings.find((b) => b.id === result.id);
}
function finiteSave(s) {
  assert(Number.isFinite(s.cash));
  assert(S.validSave(copy(s)), "Park remains a valid finite save");
}

test("New free parks are empty and independent, and existing sandboxes keep finite budgets", () => {
  const s = F.createFreePark(),
    ordinary = S.newPark("sandbox");
  assert.equal(s.mode, "sandbox");
  assert(B.hasUnlimitedBudget(s));
  assert.equal(s.open, false);
  assert.equal(s.cash, 0);
  assert.equal(s.time, 0);
  assert.deepEqual(s.buildings, []);
  assert.deepEqual(s.guests, []);
  assert.equal(s.staff, 0);
  assert.deepEqual(s.crewPool.crews, []);
  assert.equal(s.zoo?.workers?.length ?? 0, 0);
  assert.equal(s.cleanliness?.workers?.length ?? 0, 0);
  assert.equal(s.loan, undefined);
  assert.equal(s.marketing, undefined);
  for (const field of [
    "income",
    "expenses",
    "dayIncome",
    "dayExpenses",
    "lastProfit",
    "arrivals",
    "operatingIncomeToday",
    "operatingExpensesToday",
    "operatingProfit",
    "landValue",
  ])
    assert.equal(s[field], 0, `No inherited ${field}`);
  assert.equal(s.tiles.flat().filter((t) => t === "path").length, 4);
  assert(s.tiles.every((row) => row.every((tile) => tile === "grass" || tile === "path")));
  assert.equal(s.tiles[29][15], "path");
  assert.deepEqual([...s.research.completed].sort(), Object.keys(S.RESEARCH).sort());
  assert.equal(s.research.active, null);
  assert.equal(s.research.ledger.profit, 0);
  assert.equal(ordinary.unlimitedBudget, undefined);
  assert.equal(ordinary.cash, 100000);
  assert(ordinary.buildings.length > 0);
  assert(!B.hasUnlimitedBudget(ordinary));
  finiteSave(s);
  finiteSave(ordinary);
  s.tiles[0][0] = "water";
  assert.equal(F.createFreePark().tiles[0][0], "grass");
});

test("Budget helpers validate money and preserve finite cash without silently upgrading ordinary parks", () => {
  const unlimited = { cash: 0, mode: "sandbox", unlimitedBudget: true },
    ordinary = { cash: 5, mode: "sandbox" },
    scenario = { cash: 0, mode: "scenario", unlimitedBudget: true };
  assert(B.canAfford(unlimited, 500000));
  assert(!B.canAfford(ordinary, 6));
  assert(!B.canAfford(scenario, 1));
  for (const amount of [-1, NaN, Infinity]) {
    assert(!B.canAfford(unlimited, amount));
    assert(!B.spendCash(unlimited, amount));
    assert(!B.creditCash(unlimited, amount));
  }
  assert(B.spendCash(unlimited, 500000));
  assert(B.creditCash(unlimited, 500000));
  assert.equal(unlimited.cash, 0);
  assert(!B.spendCash(ordinary, 6));
  assert.equal(ordinary.cash, 5);
  assert(B.spendCash(ordinary, 6, true));
  assert.equal(ordinary.cash, -1);
  assert(B.creditCash(ordinary, 4));
  assert.equal(ordinary.cash, 3);
  unlimited.cash = 17;
  B.spendCash(unlimited, 500);
  B.creditCash(unlimited, 200);
  assert.equal(unlimited.cash, 17, "Unlimited mode never resets or invents cash");
  const indebted = S.newPark("sandbox");
  indebted.cash = -1;
  indebted.entrance = { style: "festival", owned: ["classic", "festival"] };
  const expenses = indebted.expenses;
  assert.equal(E.changeGate(indebted, "classic"), null, "Owned gate switches remain free in debt");
  assert.equal(E.changeGate(indebted, "festival"), null);
  assert(E.changeGate(indebted, "safari"));
  assert.equal(indebted.cash, -1);
  assert.equal(indebted.expenses, expenses);
});

test("Construction, clearing, paths, refunds and undo work at zero cash with real ledgers", () => {
  const s = F.createFreePark();
  build(s, "tree", 2, 2);
  const plan = C.planPlacement(s, "wheel", { x: 2, y: 2 });
  assert.equal(plan.error, null);
  assert(plan.cost > 0);
  assert.equal(plan.clearIds.length, 1);
  const before = { expenses: s.expenses, income: s.income },
    record = C.recordEdit(s, "Free ride", () => assert(C.place(s, "wheel", { x: 2, y: 2 }).id));
  assert(record);
  assert.equal(s.cash, 0);
  assert.equal(s.expenses - before.expenses, plan.cost);
  assert.equal(C.undoEdits(s, [record]), null);
  assert.equal(s.cash, 0);
  assert.equal(s.expenses, before.expenses);
  assert.equal(s.income, before.income);
  assert.equal(S.paint(s, 15, 25, "path"), null);
  const ride = build(s, "carousel", 4, 6),
    earned = s.income;
  S.remove(s, ride.x, ride.y);
  assert.equal(s.income - earned, Math.round(S.CATALOG.carousel.cost * 0.4));
  assert.equal(s.cash, 0);
  finiteSave(s);
});

test("Land expansion, entrance styles and repairs honor free budgets while charging ledgers", () => {
  const s = F.createFreePark(),
    land = G.expansionPlan(s, "east");
  assert.equal(land.error, null);
  assert.equal(G.expandPark(s, "east"), null);
  assert.equal(s.tiles[0].length, 36);
  assert.equal(s.landValue, land.cost);
  assert.equal(E.changeGate(s, "festival"), null);
  const ride = build(s, "wheel", 3, 3);
  ride.condition = 20;
  const cost = M.repairCost(ride, S.CATALOG.wheel.cost),
    before = s.expenses;
  assert.equal(M.repairAttraction(s, ride, S.CATALOG.wheel.cost), null);
  assert.equal(ride.condition, 100);
  assert.equal(s.expenses - before, cost);
  assert.equal(s.cash, 0);
  finiteSave(s);
});

test("Animal adoption, upgrades and real keeper care remain affordable at zero cash", () => {
  const s = F.createFreePark();
  for (let y = 20; y <= 25; y++) assert.equal(S.paint(s, 15, y, "path"), null);
  const habitat = build(s, "zebra", 10, 21);
  assert.equal(Z.adoptAnimal(s, habitat), null);
  assert.equal(Z.upgradeHabitat(s, habitat, "shelter"), null);
  Object.assign(habitat.habitat, { food: 50, water: 50, clean: 50 });
  assert.equal(Z.careHabitat(s, habitat), null);
  build(s, "keeperhut", 16, 27);
  Z.initZoo(s);
  s.zoo.keepers = 1;
  Z.initZoo(s);
  Object.assign(habitat.habitat, { food: 50, water: 50, clean: 50 });
  const before = s.operatingExpensesToday;
  for (let i = 0; i < 300; i++) Z.tickZoo(s, 0.1, (park, b) => S.access(park, b));
  assert(habitat.habitat.food > 90);
  assert(habitat.habitat.water > 90);
  assert(
    s.operatingExpensesToday > before,
    "A real reachable care job finishes and records its cost",
  );
  assert.equal(s.cash, 0);
  finiteSave(s);
});

test("Marketing, transport construction and line repairs use free-play affordability", () => {
  const s = F.createFreePark();
  assert.equal(K.startMarketing(s, "flyers", 1), null);
  assert.equal(s.operatingExpensesToday, K.MARKETING_TYPES.flyers.dailyCost);
  for (let x = 2; x <= 25; x++) assert.equal(S.paint(s, x, 20, "path"), null);
  for (let y = 21; y <= 25; y++) assert.equal(S.paint(s, 15, y, "path"), null);
  const a = build(s, "train", 2, 19),
    b = build(s, "train", 25, 19),
    plan = T.transitPlan(s, a, b);
  assert.equal(plan.error, null);
  assert(plan.cost > 0);
  const before = s.expenses;
  assert.equal(T.createTransitLine(s, a, b), null);
  assert.equal(s.expenses - before, plan.cost);
  const line = s.transitLines[0];
  // A detour changes the existing line's actual path and has a nonzero repair quote.
  s.tiles[20][10] = "grass";
  for (let x = 9; x <= 11; x++) assert.equal(S.paint(s, x, 21, "path"), null);
  const repair = T.repairTransitPlan(s, line);
  assert.equal(repair.error, null);
  assert(repair.cost > 0);
  assert.equal(T.repairTransit(s, line), null);
  assert.equal(s.cash, 0);
  finiteSave(s);
});

test("Coaster construction and drive upgrades/refunds retain actual cost accounting", () => {
  const s = F.createFreePark(),
    track = C.blueprint({ x: 3, y: 3 }),
    plan = C.planPlacement(s, "coaster", track[0], track);
  assert.equal(plan.error, null);
  const b = build(s, "coaster", 3, 3, track),
    drive = { kind: "boost", speed: 60, strength: 5 },
    quote = TE.trackDrivePlan(b, 1, 2, drive),
    expenses = s.expenses;
  assert.equal(quote.error, null);
  assert(quote.cost > 0);
  assert.equal(TE.installTrackDrive(s, b, 1, 2, drive), null);
  assert.equal(s.expenses - expenses, quote.cost);
  const refund = TE.trackDrivePlan(b, 1, 2, null),
    income = s.income;
  assert(refund.cost < 0);
  assert.equal(TE.installTrackDrive(s, b, 1, 2, null), null);
  assert.equal(s.income - income, -refund.cost);
  assert.equal(s.cash, 0);
  finiteSave(s);
});

test("Real shop revenue and operating bills remain finite without limiting free play", () => {
  const s = F.createFreePark(),
    shop = build(s, "burger", 16, 26),
    template = S.newPark("sandbox").guests[0];
  s.guests = [
    {
      ...structuredClone(template),
      id: s.nextId++,
      x: 15,
      y: 26,
      target: shop.id,
      state: "walk",
      route: [],
      timer: 0,
      wallet: 100,
      hunger: 75,
      thirst: 0,
      bladder: 0,
      energy: 100,
      food: undefined,
      waste: [],
      party: undefined,
      visited: [],
    },
  ];
  for (let i = 0; i < 100; i++) S.tick(s, 0.1);
  assert(shop.served > 0);
  assert(s.income > 0);
  assert(s.operatingIncomeToday > 0);
  assert(s.operatingExpensesToday > 0);
  assert.equal(s.cash, 0);
  s.guests = [];
  assert.equal(O.hireRideCrew(s), null);
  const ordinary = copy(s);
  delete ordinary.unlimitedBudget;
  s.time = ordinary.time = 89.9;
  const expenses = s.expenses;
  S.tick(s, 0.2);
  S.tick(ordinary, 0.2);
  assert(s.expenses > expenses);
  assert.equal(s.expenses, ordinary.expenses);
  assert.equal(s.cash, 0);
  assert(ordinary.cash < 0, "Ordinary operating bills still permit overdrafts");
  finiteSave(s);
  finiteSave(ordinary);
});

test("Free-play saves preserve the setting through pause/resume and never acquire scenario goals or debt", () => {
  const s = F.createFreePark();
  build(s, "carousel", 2, 3);
  const before = copy(s);
  assert(L.borrowLoan(s, 1000));
  assert.deepEqual(copy(s), before);
  s.speed = 0;
  const paused = copy(s);
  S.tick(s, 20);
  assert.deepEqual(copy(s), paused);
  const resumed = copy(s);
  S.migratePark(resumed);
  resumed.speed = 1;
  S.tick(resumed, 90);
  assert.equal(resumed.cash, 0);
  assert.equal(resumed.won, false);
  assert(B.hasUnlimitedBudget(resumed));
  finiteSave(resumed);
  for (const bad of ["true", 1, null]) {
    const invalid = copy(s);
    invalid.unlimitedBudget = bad;
    assert(!S.validSave(invalid));
  }
  for (const value of [undefined, false]) {
    const legacy = copy(s);
    legacy.unlimitedBudget = value;
    assert(S.validSave(legacy));
  }
  const empty = F.createFreePark();
  S.tick(empty, 90);
  assert.equal(empty.guests.length, 0);
});

console.log(`${passed} free-play budget tests passed.`);

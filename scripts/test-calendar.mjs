import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const C = await import(moduleURL("game/calendar.ts"));
const S = await import(moduleURL("game/simulation.ts"));
const R = await import(moduleURL("game/research-coins.ts"));
const L = await import(moduleURL("game/loans.ts"));
const M = await import(moduleURL("game/marketing.ts"));
let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("PASS", name);
  } catch (error) {
    console.error("FAIL", name, error.message);
    process.exit(1);
  }
}
const close = (a, b) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function empty() {
  const s = S.newPark("sandbox");
  s.buildings = [];
  s.guests = [];
  s.transitLines = [];
  s.crewPool = { version: 1, nextId: 1, crews: [] };
  s.zoo.keepers = 0;
  s.zoo.workers = [];
  s.cleanliness.workers = [];
  s.cleanliness.litter = [];
  s.staff = 0;
  s.open = false;
  s.spawnClock = -100000;
  s.cash = 100000;
  s.income = 0;
  s.expenses = 0;
  s.lastProfit = 0;
  s.dayIncome = 0;
  s.dayExpenses = 0;
  s.operatingIncomeToday = 0;
  s.operatingExpensesToday = 0;
  s.operatingProfit = 0;
  s.research = { completed: [], active: null, remaining: 0 };
  s.rating = 80;
  S.migratePark(s);
  return s;
}
const money = (s) => [
  s.cash,
  s.income,
  s.expenses,
  s.dayIncome,
  s.dayExpenses,
  s.operatingIncomeToday,
  s.operatingExpensesToday,
  s.operatingProfit,
];
const oldLedger = (s, time, coins = 3) => {
  delete s.calendar;
  s.time = time;
  s.research.ledger = {
    coins,
    year: Math.floor(time / 1080),
    elapsed: time % 1080,
    ratingTotal: (time % 1080) * 70,
    profit: 0,
    lastReward: 0,
  };
};

test("Twenty-minute calendar has 28 exact day boundaries and seven repeating weekdays", () => {
  assert.equal(C.YEAR_SECONDS, 1200);
  assert.equal(C.DAYS_PER_YEAR, 28);
  for (let day = 0; day < 56; day++) {
    const t = day * C.DAY_SECONDS,
      current = C.calendarAt(t),
      before = C.calendarAt(t - 0.001);
    assert.equal(current.absoluteDay, day);
    assert.equal(current.day, (day % 28) + 1);
    assert.equal(current.year, Math.floor(day / 28) + 1);
    assert.equal(current.weekday, C.WEEKDAYS[day % 7]);
    close(current.dayProgress, 0);
    if (day) assert.equal(before.absoluteDay, day - 1);
  }
});
test("Four seasons change on seven-day boundaries and restart with spring", () => {
  for (const [time, season, name] of [
    [0, "spring", "Frühling"],
    [300, "summer", "Sommer"],
    [600, "autumn", "Herbst"],
    [900, "winter", "Winter"],
    [1200, "spring", "Frühling"],
  ]) {
    const current = C.calendarAt(time);
    assert.equal(current.season, season);
    assert.equal(current.seasonName, name);
  }
  const s = empty(),
    snapshot = JSON.stringify(s);
  C.calendarOf(s);
  C.calendarOf(s, 600);
  assert.equal(JSON.stringify(s), snapshot, "Calendar reads are pure");
});
test("Actual 1x and 3x simulation reach the same one-year boundary and reward", () => {
  const one = empty(),
    three = empty();
  three.speed = 3;
  S.tick(one, 1200);
  S.tick(three, 400);
  assert.equal(one.time, 1200);
  assert.equal(three.time, 1200);
  assert.deepEqual(C.calendarOf(one), C.calendarOf(three));
  assert.equal(C.calendarOf(one).year, 2);
  assert.equal(R.researchCoins(one), 5);
  assert.equal(R.researchCoins(three), 5);
});
test("Pause freezes calendar, annual accounting and all financial clocks", () => {
  const s = empty();
  s.time = 1199.75;
  s.research.ledger.elapsed = 1199.75;
  s.research.ledger.ratingTotal = 1199.75 * 80;
  s.speed = 0;
  const before = JSON.stringify(s);
  S.tick(s, 1200);
  assert.equal(JSON.stringify(s), before);
  s.speed = 1;
  S.tick(s, 0.25);
  assert.equal(C.calendarOf(s).year, 2);
  assert.equal(R.researchCoins(s), 5);
});
test("Old paid annual boundary migrates once without changing time, euros or coins", () => {
  const s = empty();
  oldLedger(s, 1080, 6);
  s.research.ledger.lastReward = 3;
  const euros = money(s);
  assert(S.validSave(s));
  S.migratePark(s);
  assert.equal(s.time, 1080);
  assert.equal(s.calendar.offsetSeconds, 120);
  assert.equal(C.calendarOf(s).year, 2);
  assert.equal(R.nextResearchReward(s).remaining, 1200);
  assert.equal(R.researchCoins(s), 6);
  assert.deepEqual(money(s), euros);
  assert(S.validSave(s));
  const saved = JSON.stringify(s);
  S.migratePark(s);
  assert.equal(JSON.stringify(s), saved);
  S.tick(s, 0.25);
  assert.equal(R.researchCoins(s), 6);
  const resumed = JSON.parse(JSON.stringify(s));
  S.migratePark(resumed);
  S.tick(resumed, 1199.75);
  assert.equal(R.researchCoins(resumed), 8);
  S.tick(resumed, 0.25);
  assert.equal(R.researchCoins(resumed), 8);
});
test("Legacy half-year preserves satisfaction, progress, active campaigns and loan periods", () => {
  const s = empty();
  oldLedger(s, 540);
  assert.equal(L.borrowLoan(s, 10000), null);
  assert.equal(M.startMarketing(s, "flyers", 1), null);
  s.research.ledger.profit = 100;
  const loan = JSON.stringify(s.loan),
    campaign = JSON.stringify(s.marketing),
    euros = money(s);
  assert(S.validSave(s));
  S.migratePark(s);
  assert.equal(s.time, 540);
  assert.equal(s.calendar.offsetSeconds, 60);
  close(C.calendarOf(s).yearProgress, 0.5);
  assert.equal(s.research.ledger.elapsed, 600);
  assert.equal(s.research.ledger.ratingTotal / s.research.ledger.elapsed, 70);
  assert.equal(s.research.ledger.profit, 100);
  assert.equal(R.nextResearchReward(s).remaining, 600);
  assert.equal(JSON.stringify(s.loan), loan);
  assert.equal(JSON.stringify(s.marketing), campaign);
  assert.deepEqual(money(s), euros);
  assert(S.validSave(s));
});
test("Old park without a coin ledger gets its starting allowance and no historical payouts", () => {
  const s = empty();
  oldLedger(s, 10800);
  delete s.research.ledger;
  assert(S.validSave(s));
  S.migratePark(s);
  assert.equal(C.calendarOf(s).year, 11);
  assert.equal(R.researchCoins(s), 3);
  assert.equal(s.research.ledger.year, 10);
  S.tick(s, 0.25);
  assert.equal(R.researchCoins(s), 3);
  assert(S.validSave(s));
});
test("Legacy pre-boundary profit and old satisfaction survive the longer remaining fraction", () => {
  const s = empty();
  oldLedger(s, 1079.75);
  s.research.ledger.profit = 1;
  S.migratePark(s);
  const remaining = R.nextResearchReward(s).remaining;
  close(remaining, (0.25 * 1200) / 1080);
  S.tick(s, remaining - 0.001);
  assert.equal(R.researchCoins(s), 3);
  S.tick(s, 0.002);
  assert.equal(R.researchCoins(s), 6);
  const saved = JSON.parse(JSON.stringify(s));
  assert(S.validSave(saved));
  S.migratePark(saved);
  S.tick(saved, 0.25);
  assert.equal(R.researchCoins(saved), 6);
});
test("A step spanning the migrated year boundary carries satisfaction into the next year", () => {
  const s = empty();
  oldLedger(s, 1079.75);
  S.migratePark(s);
  const beforeBoundary = R.nextResearchReward(s).remaining;
  s.rating = 90;
  s.time += beforeBoundary + 0.2;
  R.tickResearchCoins(s, beforeBoundary + 0.2);
  close(s.research.ledger.elapsed, 0.2);
  close(s.research.ledger.ratingTotal, 18);
  assert.equal(s.research.ledger.year, 1);
  assert.equal(R.researchCoins(s), 5);
});
test("Open-period operating profit counts in the ending year only, including after reload", () => {
  const s = empty();
  S.tick(s, 1170);
  s.operatingIncomeToday += 10;
  s.dayIncome += 10;
  s.income += 10;
  s.cash += 10;
  S.tick(s, 30);
  assert.equal(R.researchCoins(s), 6);
  assert.equal(s.operatingIncomeToday, 10, "The 90-second financial period is still open");
  assert.equal(s.research.ledger.operatingBalance, 10);
  assert.equal(R.nextResearchReward(s).coins, 2, "No carry-over annual profit in the forecast");
  const resumed = JSON.parse(JSON.stringify(s));
  assert(S.validSave(resumed));
  S.migratePark(resumed);
  S.tick(resumed, 60);
  assert.equal(resumed.operatingProfit, 10);
  assert.equal(
    resumed.research.ledger.profit,
    0,
    "Closing the period cannot count the same income twice",
  );
  S.tick(resumed, 1140);
  assert.equal(R.researchCoins(resumed), 8);
});
test("New operating expenses reduce the forecast once and persist across period closure", () => {
  const s = empty();
  s.operatingIncomeToday = 100;
  S.tick(s, 1);
  assert.equal(s.research.ledger.profit, 100);
  assert.equal(R.nextResearchReward(s).coins, 3);
  s.operatingExpensesToday = 110;
  assert.equal(R.nextResearchReward(s).coins, 2);
  S.tick(s, 89);
  assert.equal(s.research.ledger.profit, -10);
  assert.equal(R.nextResearchReward(s).coins, 2);
});
test("A shorter calendar day does not accelerate wages or interest", () => {
  const s = empty();
  s.difficulty = "challenging";
  s.staff = 1;
  assert.equal(L.borrowLoan(s, 10000), null);
  const cash = s.cash;
  S.tick(s, C.DAY_SECONDS + 0.01);
  assert.equal(s.cash, cash);
  assert.equal(s.expenses, 0);
  S.tick(s, 90 - s.time);
  assert.equal(s.cash, cash - 105);
  assert.equal(s.expenses, 105);
  assert.equal(s.loan.interestPaid, 25);
  assert.equal(s.loan.lastInterestDay, 1);
  assert.equal(L.tickLoanDay(s), 0);
  S.tick(s, 90);
  assert.equal(s.expenses, 210);
  assert.equal(s.loan.interestPaid, 50);
});
test("Campaign pricing, saved duration and expiry stay on 90-second billing periods", () => {
  const s = empty();
  assert.equal(M.MARKETING_DAY, C.BILLING_PERIOD_SECONDS);
  assert.equal(L.LOAN_DAY_SECONDS, C.BILLING_PERIOD_SECONDS);
  const quote = M.quoteMarketing(s, "flyers", 1);
  assert.equal(quote.cost, 90);
  assert.equal(quote.duration, 90);
  assert.equal(M.startMarketing(s, "flyers", 1), null);
  S.tick(s, C.DAY_SECONDS * 2);
  assert.equal(M.campaignStatus(s, s.marketing.campaigns[0]), "active");
  S.tick(s, 90 - s.time);
  assert.equal(M.campaignStatus(s, s.marketing.campaigns[0]), "finished");
  assert(S.validSave(s));
});
test("Malformed new metadata is rejected while absent legacy metadata stays loadable", () => {
  for (const value of [
    null,
    [],
    {},
    { version: 2, offsetSeconds: 0 },
    { version: 1, offsetSeconds: -1 },
    { version: 1, offsetSeconds: Infinity },
    { version: 1, offsetSeconds: "0" },
  ]) {
    const s = empty();
    s.calendar = value;
    assert.equal(S.validSave(s), false);
  }
  const s = empty();
  delete s.calendar;
  assert(S.validSave(s));
  s.research.ledger.operatingBalance = NaN;
  assert.equal(S.validSave(s), false);
});
test("Three is the absolute annual reward ceiling through migrated and modern years", () => {
  const s = empty();
  oldLedger(s, 1080, 6);
  S.migratePark(s);
  for (let year = 0; year < 3; year++) {
    const before = R.researchCoins(s);
    s.rating = 100;
    s.operatingIncomeToday += 1e6;
    S.tick(s, 1200);
    assert.equal(R.researchCoins(s) - before, 3);
    assert(S.validSave(s));
  }
});
console.log(`${passed}/${passed} calendar tests passed`);

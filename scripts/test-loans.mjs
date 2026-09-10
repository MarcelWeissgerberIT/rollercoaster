import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const L = await import(moduleURL("game/loans.ts"));
const S = await import(moduleURL("game/simulation.ts"));
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("PASS", name);
}
const park = (cash = 16000) => ({
  cash,
  time: 0,
  income: 11,
  expenses: 12,
  dayIncome: 13,
  dayExpenses: 14,
  operatingIncomeToday: 15,
  operatingExpensesToday: 16,
  lastProfit: 17,
});
const balances = (s) => [
  s.income,
  s.expenses,
  s.dayIncome,
  s.dayExpenses,
  s.operatingIncomeToday,
  s.operatingExpensesToday,
  s.lastProfit,
];

test("Legacy parks have no debt, no fee and no read-time migration", () => {
  const s = park(),
    before = structuredClone(s);
  assert.equal(L.validateLoan(s), true);
  assert.equal(L.loanDailyCost(s), 0);
  assert.equal(L.tickLoanDay(s), 0);
  assert.deepEqual(s, before);
});

test("Borrowing pays real cash, respects the limit and never becomes operating income", () => {
  const s = park(),
    before = balances(s);
  assert.equal(L.borrowLoan(s, 1000), null);
  assert.equal(s.cash, 17000);
  assert.equal(s.loan.principal, 1000);
  assert.equal(s.loan.lastInterestDay, 0);
  assert.equal(s.loan.interestPaid, 0);
  assert.equal(L.borrowLoan(s, 19000), null);
  assert.equal(s.cash, 36000);
  assert.equal(s.loan.principal, L.LOAN_LIMIT);
  const full = structuredClone(s);
  assert.equal(typeof L.borrowLoan(s, 1000), "string");
  assert.deepEqual(s, full);
  assert.deepEqual(balances(s), before);
});

test("Invalid, nonfinite and non-block borrowing amounts cannot partially change a loan", () => {
  for (const amount of [-1000, 0, 0.1, 999, 1000.01, NaN, Infinity, -Infinity, 21000]) {
    const s = park(),
      before = structuredClone(s);
    assert.equal(typeof L.borrowLoan(s, amount), "string");
    assert.deepEqual(s, before);
  }
  for (const cash of [NaN, Infinity, -Infinity]) {
    const s = park(cash),
      before = structuredClone(s);
    assert.equal(typeof L.borrowLoan(s, 1000), "string");
    assert.deepEqual(s, before);
  }
});

test("Partial and full repayment use actual cash and restore capacity without profit", () => {
  const s = park(),
    before = balances(s);
  L.borrowLoan(s, 10000);
  assert.equal(L.repayLoan(s, 2500.45), null);
  assert.equal(s.loan.principal, 7499.55);
  assert.equal(s.cash, 23499.55);
  assert.equal(L.repayLoan(s, s.loan.principal), null);
  assert.equal(s.loan.principal, 0);
  assert.equal(s.cash, 16000);
  assert.equal(L.loanDailyCost(s), 0);
  assert.deepEqual(balances(s), before);
  assert.equal(L.borrowLoan(s, 20000), null);
  assert.equal(s.loan.principal, 20000);
});

test("Borrow-repay cycles preserve cash minus debt and cannot mint capital", () => {
  const s = park();
  for (let i = 0; i < 50; i++) {
    assert.equal(L.borrowLoan(s, 10000), null);
    assert.equal(s.cash - s.loan.principal, 16000);
    assert.equal(L.repayLoan(s, 10000), null);
    assert.equal(s.cash, 16000);
    assert.equal(s.loan.principal, 0);
  }
});

test("Repayment rejects negative, nonfinite, fractional-cent and overdrawn amounts atomically", () => {
  for (const amount of [-1000, 0, 0.001, NaN, Infinity, 1001]) {
    const s = park();
    L.borrowLoan(s, 1000);
    const before = structuredClone(s);
    assert.equal(typeof L.repayLoan(s, amount), "string");
    assert.deepEqual(s, before);
  }
  const s = park();
  L.borrowLoan(s, 1000);
  for (const cash of [-100, 0, 999.99, NaN, Infinity]) {
    s.cash = cash;
    const before = structuredClone(s);
    assert.equal(typeof L.repayLoan(s, 1000), "string");
    assert.deepEqual(s, before);
  }
});

test("A negative cash balance may borrow within the real cap, but cannot repay unavailable money", () => {
  const s = park(-1200);
  assert.equal(L.borrowLoan(s, 1000), null);
  assert.equal(s.cash, -200);
  assert.equal(s.loan.principal, 1000);
  const before = structuredClone(s);
  assert.equal(typeof L.repayLoan(s, 1), "string");
  assert.deepEqual(s, before);
});

test("The daily rate is explicit and an exact 25 euros for 10000 principal", () => {
  assert.equal(L.LOAN_DAILY_RATE, 0.0025);
  const s = park();
  L.borrowLoan(s, 10000);
  assert.equal(L.loanDailyCost(s), 25);
  assert.equal(L.tickLoanDay(s), 0);
  s.time = 89.99;
  assert.equal(L.tickLoanDay(s), 0);
  s.time = 90;
  const cash = s.cash,
    before = balances(s);
  assert.equal(L.tickLoanDay(s), 25);
  assert.equal(s.loan.interestPaid, 25);
  assert.equal(s.loan.principal, 10000);
  assert.equal(s.loan.lastInterestDay, 1);
  assert.equal(s.cash, cash, "Only the caller books the returned daily bill");
  assert.deepEqual(balances(s), before);
  assert.equal(L.tickLoanDay(s), 0);
  s.time = 180;
  assert.equal(L.tickLoanDay(s), 25);
  assert.equal(s.loan.interestPaid, 50);
  assert.equal(s.loan.principal, 10000, "Interest must not compound into principal");
});

test("Repaying changes the day-end charge immediately, with cent rounding", () => {
  const s = park();
  L.borrowLoan(s, 2000);
  L.repayLoan(s, 765.44);
  assert.equal(s.loan.principal, 1234.56);
  assert.equal(L.loanDailyCost(s), 3.09);
  s.time = 90;
  assert.equal(L.tickLoanDay(s), 3.09);
  L.repayLoan(s, 1234.56);
  s.time = 180;
  assert.equal(L.tickLoanDay(s), 0);
  assert.equal(s.loan.interestPaid, 3.09);
});

test("Borrowing after several completed days never creates retroactive interest", () => {
  const s = park();
  s.time = 905;
  assert.equal(L.borrowLoan(s, 10000), null);
  assert.equal(s.loan.lastInterestDay, 10);
  assert.equal(L.tickLoanDay(s), 0);
  s.time = 990;
  assert.equal(L.tickLoanDay(s), 25);
  assert.equal(s.loan.interestPaid, 25);
});

test("Save validation rejects malformed principal, ledger and future-day data", () => {
  const s = park();
  L.borrowLoan(s, 1000);
  const valid = structuredClone(s.loan);
  for (const [key, value] of [
    ["principal", -1],
    ["principal", 20000.01],
    ["principal", 1.001],
    ["principal", NaN],
    ["principal", Infinity],
    ["principal", "1000"],
    ["interestPaid", -1],
    ["interestPaid", NaN],
    ["interestPaid", 0.001],
    ["lastInterestDay", -1],
    ["lastInterestDay", 1],
    ["lastInterestDay", 0.5],
  ]) {
    s.loan = { ...valid, [key]: value };
    assert.equal(L.validateLoan(s), false, `${key}=${value}`);
    const before = structuredClone(s);
    assert.equal(L.tickLoanDay(s), 0);
    assert.equal(typeof L.borrowLoan(s, 1000), "string");
    assert.equal(typeof L.repayLoan(s, 1), "string");
    assert.deepEqual(s, before);
  }
  for (const loan of [null, [], {}, "loan"]) {
    s.loan = loan;
    assert.equal(L.validateLoan(s), false);
  }
  s.loan = valid;
  assert.equal(L.validateLoan(s), true);
  const loaded = JSON.parse(JSON.stringify(s));
  assert.equal(L.validateLoan(loaded), true);
});

test("The real daily simulation books interest once at every difficulty and respects pause", () => {
  for (const difficulty of ["relaxed", "normal", "challenging"]) {
    const s = S.newPark("sandbox");
    Object.assign(s, {
      difficulty,
      buildings: [],
      crewPool: { version: 1, nextId: 1, crews: [] },
      guests: [],
      staff: 0,
      cash: 0,
      time: 89.75,
      open: false,
      speed: 1,
      income: 0,
      expenses: 0,
      dayIncome: 0,
      dayExpenses: 0,
      operatingIncomeToday: 0,
      operatingExpensesToday: 0,
      operatingProfit: 0,
      zoo: { keepers: 0, workers: [], nextId: 1 },
      cleanliness: undefined,
    });
    assert.equal(L.borrowLoan(s, 10000), null);
    S.tick(s, 0.25);
    assert.equal(s.cash, 9975);
    assert.equal(s.expenses, 25);
    assert.equal(s.lastProfit, -25);
    assert.equal(s.operatingProfit, -25);
    assert.equal(s.loan.interestPaid, 25);
    assert.equal(s.loan.principal, 10000);
    S.tick(s, 0.25);
    assert.equal(s.expenses, 25);
    s.speed = 0;
    const paused = structuredClone(s);
    S.tick(s, 180);
    assert.deepEqual(s, paused);
    assert.equal(S.validSave(s), true);
  }
});

test("Real park value deducts debt and full save validation covers the optional field", () => {
  const s = S.newPark("sandbox"),
    originalValue = S.parkValue(s);
  assert.equal(S.validSave(s), true);
  assert.equal(L.borrowLoan(s, 10000), null);
  assert.equal(S.parkValue(s), originalValue);
  assert.equal(S.validSave(s), true);
  assert.equal(L.repayLoan(s, 10000), null);
  assert.equal(S.parkValue(s), originalValue);
  s.loan.principal = L.LOAN_LIMIT + 1;
  assert.equal(S.validSave(s), false);
});

console.log(`${passed} loan tests passed.`);

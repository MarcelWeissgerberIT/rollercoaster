import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";

const D = await import(moduleURL("game/difficulty.ts"));
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("PASS", name);
}

test("Legacy saves use fair Normal without mutation or a cash grant", () => {
  const oldSave = { cash: 123.45, time: 180, operatingIncomeToday: 40, operatingExpensesToday: 10 };
  const before = structuredClone(oldSave);
  assert.equal(D.difficultyOf(oldSave), "normal");
  assert.equal(D.validDifficulty(oldSave), true);
  assert.deepEqual(oldSave, before);
  assert.equal(D.difficultyCost(oldSave, 100, "wages"), 65);
});

test("Changing difficulty alters only the setting and survives a JSON roundtrip", () => {
  const s = { cash: 100, time: 172, operatingIncomeToday: 26, operatingExpensesToday: 88 };
  const before = structuredClone(s);
  for (const value of ["relaxed", "challenging", "normal"]) {
    assert.equal(D.setDifficulty(s, value), null);
    assert.deepEqual(s, { ...before, difficulty: value });
    assert.equal(D.difficultyOf(JSON.parse(JSON.stringify(s))), value);
  }
});

test("Malformed explicit difficulty is rejected and cannot mutate state", () => {
  for (const value of [null, "easy", "", 1, {}, [], "__proto__", "toString"]) {
    const s = { difficulty: "normal", cash: 80 };
    assert.equal(D.validDifficulty({ difficulty: value }), false);
    assert.equal(typeof D.setDifficulty(s, value), "string");
    assert.deepEqual(s, { difficulty: "normal", cash: 80 });
  }
});

test("Challenging retains existing charges while both easier modes stay positive", () => {
  for (const kind of ["wages", "upkeep"]) {
    const full = D.difficultyCost({ difficulty: "challenging" }, 123.4, kind);
    const normal = D.difficultyCost({ difficulty: "normal" }, 123.4, kind);
    const relaxed = D.difficultyCost({ difficulty: "relaxed" }, 123.4, kind);
    assert.equal(full, 123.4);
    assert(relaxed > 0 && relaxed < normal && normal < full);
    assert.equal(D.difficultyCost({}, 0, kind), 0);
  }
});

test("Actual payroll quotes retain cents and combine to the daily payroll", () => {
  const s = { difficulty: "normal" };
  const cleaner = D.difficultyCost(s, 80, "wages");
  const keeper = D.difficultyCost(s, 90, "wages");
  const specialist = D.difficultyCost(s, 150, "wages");
  const operator = D.difficultyCost(s, 70, "wages");
  assert.equal(cleaner, 52);
  assert.equal(keeper, 58.5);
  assert.equal(specialist, 97.5);
  assert.equal(operator, 45.5);
  assert.equal(
    D.difficultyCost(s, 80 + 90 + 150 + 70, "wages"),
    cleaner + keeper + specialist + operator,
  );
  assert.match(D.difficultyEuro(keeper), /58,50/);
  assert.match(D.difficultyEuro(cleaner), /52/);
});

test("Consumables, care, repairs and loan interest cannot accidentally be discounted", () => {
  for (const kind of ["supplies", "care", "repair", "interest", "loan"])
    assert.throws(() => D.difficultyCost({}, 120, kind), RangeError);
});

test("A closed, empty park still pays costs and never receives a difficulty profit", () => {
  for (const difficulty of Object.keys(D.DIFFICULTIES)) {
    const s = { difficulty, cash: 1000 };
    const daily = D.difficultyCost(s, 370, "wages") + D.difficultyCost(s, 193 * 0.25, "upkeep");
    assert(daily > 0);
    s.cash -= daily;
    assert(s.cash < 1000);
  }
});

test("Cost helper rejects invalid or unsupported charges", () => {
  for (const base of [NaN, Infinity, -1])
    assert.throws(() => D.difficultyCost({}, base, "wages"), RangeError);
  assert.throws(() => D.difficultyCost({}, 10, "supplies"), RangeError);
});

console.log(`${passed} difficulty tests passed`);

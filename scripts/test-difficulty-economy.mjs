/** Integration checks for the daily-cost hooks in simulation.ts. */
import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts"));
const D = await import(moduleURL("game/difficulty.ts"));
const Z = await import(moduleURL("game/zoo.ts"));
const O = await import(moduleURL("game/operations.ts"));

Math.random = () => 0.5;
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("PASS", name);
}
const closePark = () => {
  const s = S.newPark();
  s.open = false;
  s.guests = [];
  return s;
};
function fixedBase(s) {
  return {
    wages: s.staff * 80 + Z.zooWages(s) + O.operatorWages(s),
    upkeep: s.buildings
      .filter((b) => !S.decorative(b.kind))
      .reduce(
        (sum, b) =>
          sum +
          (Z.isHabitat(b.kind)
            ? Math.round(Z.SPECIES[b.kind].upkeep * ((b.habitat?.count ?? 0) > 0 ? 1 : 0.25))
            : Math.round(
                (b.track ? S.trackCost(b.track) : S.buildingBaseCost(b)) *
                  0.022 *
                  (b.open ? 1 : 0.25),
              )),
        0,
      ),
  };
}

for (const difficulty of Object.keys(D.DIFFICULTIES)) {
  test(`${difficulty}: actual daily debit and all expense ledgers use the same charge`, () => {
    const s = closePark();
    D.setDifficulty(s, difficulty);
    const base = fixedBase(s);
    const expected =
      D.difficultyCost(s, base.wages, "wages") + D.difficultyCost(s, base.upkeep, "upkeep");
    const cash = s.cash,
      expenses = s.expenses;
    S.tick(s, 90);
    assert(Math.abs(cash - s.cash - expected) < 1e-7);
    assert(Math.abs(s.expenses - expenses - expected) < 1e-7);
    assert(Math.abs(s.lastProfit + expected) < 1e-7);
    assert(Math.abs(s.operatingProfit + expected) < 1e-7);
    assert.equal(s.income, 0, "Difficulty does not manufacture revenue");
    assert(s.cash < cash, "Closed parks retain a real daily cost");
  });
}

test("An older save without difficulty remains valid and receives Normal costs", () => {
  const old = closePark();
  delete old.difficulty;
  assert(S.validSave(JSON.parse(JSON.stringify(old))));
  const base = fixedBase(old),
    cash = old.cash;
  S.tick(old, 90);
  assert(
    Math.abs(
      cash -
        old.cash -
        D.difficultyCost({}, base.wages, "wages") -
        D.difficultyCost({}, base.upkeep, "upkeep"),
    ) < 1e-7,
  );
});

test("Save validation rejects malformed explicit difficulty", () => {
  for (const value of [null, "easy", {}, 1, "__proto__"]) {
    const s = S.newPark();
    s.difficulty = value;
    assert.equal(S.validSave(JSON.parse(JSON.stringify(s))), false);
  }
});

test("A difficulty change preserves the clock, earned income and paid expenses", () => {
  const s = closePark();
  s.buildings = [];
  s.crewPool = { version: 1, nextId: 1, crews: [] };
  s.staff = 2;
  S.tick(s, 89);
  s.operatingIncomeToday = 37;
  s.operatingExpensesToday = 12;
  const cash = s.cash,
    time = s.time;
  assert.equal(D.setDifficulty(s, "relaxed"), null);
  assert.equal(s.cash, cash);
  assert.equal(s.time, time);
  assert.equal(s.operatingExpensesToday, 12);
  S.tick(s, 1);
  assert.equal(s.operatingProfit, 37 - 12 - 72);
  assert.equal(cash - s.cash, 72);
});

console.log(`${passed} difficulty economy integration tests passed`);

/** Bounded integration regressions. Optional argv[2] is the repository root. */
import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  Z = await import(moduleURL("game/zoo.ts")),
  B = await import(moduleURL("game/construction.ts")),
  P = await import(moduleURL("game/prefabs.ts"));
let passed = 0,
  failed = 0;
const results = [];
function test(name, fn) {
  try {
    fn();
    passed++;
    results.push({ name, pass: true });
    console.log("PASS", name);
  } catch (e) {
    failed++;
    results.push({ name, pass: false, error: e.message });
    console.log("FAIL", name, e.message);
  }
}
function park() {
  const s = S.newPark("sandbox");
  s.tiles = Array.from({ length: 36 }, () => Array(36).fill("grass"));
  for (let y = 0; y < 36; y++) s.tiles[y][15] = "path";
  s.buildings = [];
  s.crewPool = { version: 1, nextId: 1, crews: [] };
  s.guests = [];
  s.open = false;
  s.staff = 0;
  s.time = 0;
  s.cash = 100000;
  s.expenses = 0;
  s.income = 0;
  s.dayExpenses = 0;
  s.dayIncome = 0;
  s.operatingExpensesToday = 0;
  s.operatingIncomeToday = 0;
  s.zoo = undefined;
  s.cleanliness = undefined;
  return s;
}
function makeHabitat(s, kind = "zebra") {
  const id = S.build(s, kind, 15 - Z.SPECIES[kind].size, 18).id;
  assert(id);
  const b = s.buildings.find((b) => b.id === id);
  b.pods = { entry: { side: 0, offset: 0 }, exit: { side: 0, offset: Z.SPECIES[kind].size - 1 } };
  return b;
}
for (const index of [0, 1, 2])
  test(`Blocked batch is entirely unchanged when occupied habitat is record ${index + 1}/3`, () => {
    const s = park(),
      initial = s.cash,
      records = [];
    let b;
    const operations = [
      () => B.recordEdit(s, "path", () => assert.equal(S.paint(s, 14, 28, "path"), null)),
      () => B.recordEdit(s, "bench", () => assert(S.build(s, "bench", 16, 28).id)),
    ];
    operations.splice(index, 0, () =>
      B.recordEdit(s, "habitat", () => {
        b = makeHabitat(s);
      }),
    );
    for (const op of operations) records.push(op());
    assert(records.every(Boolean));
    assert.equal(Z.adoptAnimal(s, b), null);
    Z.initZoo(s);
    s.time = 42;
    s.speed = 0;
    const before = structuredClone(s),
      recordBefore = structuredClone(records);
    try {
      B.undoEdits(s, records);
    } catch {
      /* Throw or explicit error are both acceptable provided state remains atomic. */
    }
    assert.deepEqual(
      s,
      before,
      "Blocked Undo partially mutated terrain, balances, building state or time",
    );
    assert.deepEqual(records, recordBefore);
    b = s.buildings.find((x) => x.id === b.id);
    b.habitat.count = 0;
    b.open = false;
    B.undoEdits(s, records);
    assert.equal(s.buildings.length, 0);
    assert.equal(s.tiles[28][14], "grass");
    assert.equal(s.cash, initial - Z.SPECIES.zebra.adoption);
    assert.equal(s.time, 42);
    assert.equal(s.speed, 0);
    assert(S.validSave(s));
  });
for (const kind of Object.keys(Z.SPECIES))
  for (const open of [true, false])
    test(`${kind}: occupied ${open ? "open" : "closed"} habitat pays declared upkeep and exactly one keeper wage`, () => {
      const s = park(),
        b = makeHabitat(s, kind);
      // Preserve the declared full-price upkeep regression for every species.
      s.difficulty = "challenging";
      assert.equal(Z.adoptAnimal(s, b), null);
      b.open = open;
      Z.initZoo(s);
      s.zoo.keepers = 1;
      s.time = 89.95;
      const cash = s.cash,
        expenses = s.expenses;
      S.tick(s, 0.1);
      assert.equal(cash - s.cash, Z.SPECIES[kind].upkeep + 90);
      assert.equal(s.expenses - expenses, Z.SPECIES[kind].upkeep + 90);
      assert(S.validSave(s));
    });
test("Keeper hut blocks prefab preview and final placement consistently", () => {
  const s = park(),
    id = S.build(s, "keeperhut", 12, 10).id;
  assert(id);
  const old = P.startTrack({ x: 10, y: 10 }),
    next = P.appendPiece(old, "straight", 4),
    preview = P.pieceError(s, old, next, true);
  const final = B.planPlacement(s, "coaster", next[0], next, true);
  assert(final.error);
  assert(!final.clearIds.includes(id));
  assert(s.buildings.some((b) => b.id === id));
  assert(preview);
});
console.log(JSON.stringify({ passed, failed, results }, null, 2));
process.exitCode = failed ? 1 : 0;

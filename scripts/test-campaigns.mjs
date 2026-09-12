import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
process.on("uncaughtException", (e) => {
  console.error(e.message);
  process.exit(1);
});
const S = await import(moduleURL("game/simulation.ts")),
  Z = await import(moduleURL("game/zoo.ts")),
  L = await import(moduleURL("game/cleanliness.ts")),
  M = await import(moduleURL("game/maintenance.ts")),
  D = await import(moduleURL("game/pods.ts"));
const tests = [];
function test(name, fn) {
  try {
    tests.push({ name, pass: true, evidence: fn() });
  } catch (e) {
    tests.push({ name, pass: false, error: e.message.slice(0, 1400) });
  }
  console.log(JSON.stringify(tests.at(-1)));
}
const configs = {
  ruinenpark: { size: 30, cash: 8000, guests: 24, litter: 25, rides: 4, open: 1 },
  grosspark: { size: 42, cash: 12000, guests: 120, litter: 80, rides: 8, open: 8 },
  zoo: { size: 36, cash: 22000, guests: 28, litter: 0, rides: 0, open: 0 },
};
const parks = {};
for (const [id, cfg] of Object.entries(configs))
  test(`${id}: real newPark dimensions, balances, paths, Pods and save`, () => {
    const s = S.newPark("scenario", id);
    parks[id] = s;
    assert.equal(s.tiles.length, cfg.size);
    assert(s.tiles.every((r) => r.length === cfg.size));
    assert.equal(s.cash, cfg.cash);
    assert.equal(s.guests.length, cfg.guests);
    assert.equal(s.arrivals, cfg.guests);
    assert.equal(
      s.income +
        s.expenses +
        s.dayIncome +
        s.dayExpenses +
        s.operatingIncomeToday +
        s.operatingExpensesToday,
      0,
    );
    assert.equal(s.tiles[29][15], "path");
    const net = S.connected(s);
    assert(s.guests.every((g) => net.has(`${g.x},${g.y}`)));
    const ids = new Set([...s.buildings, ...s.guests].map((x) => x.id));
    assert.equal(ids.size, s.buildings.length + s.guests.length);
    assert(s.nextId > Math.max(...ids));
    const rides = s.buildings.filter((b) => S.isRide(b.kind));
    assert.equal(rides.length, cfg.rides);
    assert.equal(rides.filter((b) => b.open).length, cfg.open);
    const footprints = new Map();
    for (const b of s.buildings) {
      for (const p of S.footprint(b)) {
        assert.equal(s.tiles[p.y][p.x], "grass", `Footprint on route ${b.kind} ${p.x},${p.y}`);
        const k = `${p.x},${p.y}`;
        assert(!footprints.has(k), `Overlap ${b.kind}/${footprints.get(k)}`);
        footprints.set(k, b.kind);
      }
      if (!S.decorative(b.kind)) {
        assert(S.access(s, b), `No entry for ${b.kind}#${b.id}`);
        if (D.usesPods(b.kind)) {
          assert(D.validPods(b.pods, S.CATALOG[b.kind].size));
          const out = S.exitPath(s, b);
          assert(out.length > 0, `No exit for ${b.kind}`);
          assert.equal(s.tiles[out.at(-1).y][out.at(-1).x], "path");
        }
      }
    }
    assert.equal(L.cleanlinessStats(s).pieces, cfg.litter);
    assert(S.validSave(JSON.parse(JSON.stringify(s))));
    return {
      buildings: s.buildings.length,
      paths: net.size,
      condition: M.maintenanceScore(s),
      cleanliness: L.cleanlinessScore(s),
      entryDemand: S.entryDemand(s),
      species: Z.zooStats(s, S.access),
    };
  });
test("Ruins expose real broken ride, repairable 20–65 condition and one working attraction", () => {
  const s = structuredClone(parks.ruinenpark);
  assert(s);
  const rides = s.buildings.filter((b) => S.isRide(b.kind));
  assert.deepEqual(rides.map(M.condition), [20, 65, 35, 45]);
  assert.equal(s.open, false);
  assert(rides.some(M.broken));
  assert(s.guests.every((g) => g.happiness < 50));
  const original = s.cash;
  for (const b of rides) assert.equal(M.repairAttraction(s, b, S.buildingBaseCost(b)), null);
  assert.equal(M.maintenanceScore(s), 41, "Repair orders do not repair remotely");
  assert.equal(M.hireMechanic(s), null);
  for (const b of rides) {
    S.ensurePods(s, b);
    b.riders = [];
    b.queue = [];
    b.open = false;
  }
  for (let i = 0; i < 12000 && M.maintenanceScore(s) < 100; i++) {
    s.time += 0.05;
    M.tickMaintenance(s, 0.05, S.CATALOG);
  }
  assert.equal(M.maintenanceScore(s), 100);
  return { allRepairs: original - s.cash, remaining: s.cash };
});
test("Zoo begins with two actual species and one reachable keeper; future habitat footprints remain free", () => {
  const s = parks.zoo;
  assert(s);
  assert.deepEqual(s.research.completed, ["zoo"]);
  assert.equal(S.isUnlocked(s, "giraffe"), false);
  assert.equal(S.isUnlocked(s, "penguin"), false);
  assert.equal(s.zoo.keepers, 1);
  assert.equal(s.zoo.workers.length, 1);
  const habitats = s.buildings.filter((b) => Z.isHabitat(b.kind));
  assert.deepEqual(
    habitats.map((b) => [b.kind, b.habitat.count]),
    [
      ["zebra", 2],
      ["flamingo", 4],
    ],
  );
  assert(
    habitats.every((b) =>
      Object.values(b.habitat)
        .filter((v) => typeof v === "number")
        .slice(1)
        .every((v) => v === 90),
    ),
  );
  const copy = structuredClone(s);
  copy.cash = 1e6;
  copy.research.completed.push("savanna", "polar");
  for (const [kind, x, y, size] of [
    ["giraffe", 5, 16, 6],
    ["penguin", 23, 18, 4],
  ]) {
    const r = S.build(copy, kind, x, y);
    assert(r.id, r.error);
    const b = copy.buildings.find((b) => b.id === r.id);
    for (let yy = y + size; yy < 24; yy++) {
      copy.tiles[yy][x] = "path";
      copy.tiles[yy][x + size - 1] = "path";
    }
    assert(S.access(copy, b));
  }
  assert(S.validSave(copy));
  return { initialWelfare: Z.zooStats(s).welfare, availableBuildPads: 2 };
});
let seed = 72921;
Math.random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
for (const id of Object.keys(configs))
  test(`${id}: 20 minutes real simulation retain valid save and finite state`, () => {
    const s = S.newPark("scenario", id),
      start = performance.now(),
      milestones = [];
    for (let elapsed = 120; elapsed <= 1200; elapsed += 120) {
      S.tick(s, 120);
      assert(S.validSave(JSON.parse(JSON.stringify(s))), `Save invalid at${elapsed}s`);
      assert(Number.isFinite(s.cash + s.rating + s.operatingProfit));
      milestones.push({
        seconds: elapsed,
        cash: Math.round(s.cash),
        arrivals: s.arrivals,
        guests: s.guests.length,
        rating: s.rating,
        cleanliness: L.cleanlinessScore(s),
        condition: M.maintenanceScore(s),
        profit: Math.round(s.operatingProfit),
        welfare: Z.zooStats(s).welfare,
      });
    }
    return { ms: Math.round(performance.now() - start), won: s.won, milestones };
  });
console.log(`${tests.filter((t) => t.pass).length}/${tests.length} passed`);
process.exitCode = tests.every((t) => t.pass) ? 0 : 1;

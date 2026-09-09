import assert from "node:assert/strict";
import fs from "node:fs";
import { moduleURL } from "./ts-loader.mjs";
const repo = "repository",
  overlay = undefined;
const S = await import(moduleURL("game/simulation.ts"));
const C = await import(moduleURL("game/construction.ts"));
const R = await import(moduleURL("game/research-coins.ts"));
const E = await import(moduleURL("game/exit-assist.ts"));
const P = await import(moduleURL("game/pods.ts"));
let seed = 9183;
Math.random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const results = [];
function test(group, name, run) {
  try {
    run();
    results.push({ group, name, pass: true });
    console.log("PASS", group, name);
  } catch (error) {
    results.push({ group, name, pass: false, error: error.message });
    console.error("FAIL", group, name, "\n ", error.message);
  }
}
const coin = (name, run) => test("coins", name, run);
const exit = (name, run) => test("exit", name, run);
const close = (a, b) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function emptyPark(mode = "scenario") {
  const s = S.newPark("sandbox");
  s.mode = mode;
  s.buildings = [];
  s.guests = [];
  s.transitLines = [];
  s.tiles = Array.from({ length: 30 }, () => Array(30).fill("grass"));
  for (let y = 0; y < 30; y++) s.tiles[y][15] = "path";
  s.pathStyles = {};
  s.time = 0;
  s.speed = 1;
  s.open = false;
  s.spawnClock = -10000;
  s.cash = 100000;
  s.income = 0;
  s.expenses = 0;
  s.dayIncome = 0;
  s.dayExpenses = 0;
  s.operatingIncomeToday = 0;
  s.operatingExpensesToday = 0;
  s.operatingProfit = 0;
  s.rating = 80;
  s.research = { completed: [], active: null, remaining: 0 };
  s.staff = 0;
  if (s.zoo) {
    s.zoo.keepers = 0;
    s.zoo.workers = [];
  }
  if (s.cleanliness) {
    s.cleanliness.workers = [];
    s.cleanliness.litter = [];
  }
  S.migratePark(s);
  return s;
}
const euro = (s) => [
  s.cash,
  s.income,
  s.expenses,
  s.dayIncome,
  s.dayExpenses,
  s.operatingIncomeToday,
  s.operatingExpensesToday,
  s.operatingProfit,
];
function year(s, rating, profit = 0) {
  s.rating = rating;
  s.time += R.YEAR_SECONDS;
  R.tickResearchCoins(s, R.YEAR_SECONDS, profit);
}

coin("Cost table and twelve-day year match the agreed contract", () => {
  assert.equal(R.YEAR_SECONDS, 1080);
  assert.deepEqual(R.COIN_COST, {
    zoo: 1,
    savanna: 2,
    polar: 2,
    family: 1,
    thrill: 1,
    launch: 2,
    festival: 1,
    transport: 2,
    orbital: 2,
    workshop: 3,
  });
  assert.deepEqual(Object.keys(R.COIN_COST).sort(), Object.keys(S.RESEARCH).sort());
});
coin("All fresh scenarios begin with three coins and their original park budget", () => {
  for (const id of Object.keys(S.SCENARIOS)) {
    const s = S.newPark("scenario", id);
    assert.equal(R.researchCoins(s), 3);
    assert.equal(s.cash, S.SCENARIOS[id].cash);
    const old = euro(s);
    S.migratePark(s);
    S.migratePark(s);
    assert.equal(R.researchCoins(s), 3);
    assert.deepEqual(euro(s), old);
    assert(S.validSave(s));
  }
});
for (const [rating, profit, expected] of [
  [0, -1e6, 1],
  [69.999, 100000, 1],
  [70, -1, 2],
  [70, 0, 2],
  [70, 0.01, 3],
  [100, 1e9, 3],
]) {
  coin(`Tier boundary rating=${rating}, profit=${profit} yields exactly ${expected}`, () => {
    assert.equal(R.coinReward(rating, profit), expected);
    const s = emptyPark(),
      money = euro(s);
    year(s, rating, profit);
    assert.equal(R.researchCoins(s), 3 + expected);
    assert.equal(s.research.ledger.lastReward, expected);
    assert.deepEqual(euro(s), money);
    assert(R.validResearchCoins(s));
  });
}
coin("Reward is one/two/three total, never additive or above three", () => {
  const s = emptyPark();
  for (let i = 0; i < 3; i++) year(s, 100, 1e9);
  assert.equal(R.researchCoins(s), 12);
  assert.equal(s.research.ledger.lastReward, 3);
});
coin("Annual satisfaction is weighted by elapsed simulation time", () => {
  const s = emptyPark();
  s.rating = 100;
  s.time = 100;
  R.tickResearchCoins(s, 100, 100);
  s.rating = 60;
  s.time = 1080;
  R.tickResearchCoins(s, 980, 0);
  assert.equal(s.research.ledger.lastReward, 1); // 63.7%, not the unweighted 80%.
});
coin("Current forecast includes the ongoing day's operating profit", () => {
  const s = emptyPark();
  s.time = 100;
  s.research.ledger.elapsed = 100;
  s.research.ledger.ratingTotal = 7000;
  s.research.ledger.profit = -5;
  s.operatingIncomeToday = 10;
  assert.deepEqual(R.nextResearchReward(s), { remaining: 980, coins: 3 });
  s.operatingExpensesToday = 5;
  assert.equal(R.nextResearchReward(s).coins, 2);
  s.research.ledger.ratingTotal = 6900;
  assert.equal(R.nextResearchReward(s).coins, 1);
});
for (const [rating, operatingIncome, expected] of [
  [69, 100, 1],
  [70, 0, 2],
  [70, 1, 3],
]) {
  coin(`Real tick closes the annual operating ledger for tier${expected}`, () => {
    const s = emptyPark();
    s.rating = rating;
    s.operatingIncomeToday = operatingIncome;
    S.tick(s, 1080);
    assert.equal(s.time, 1080);
    assert.equal(R.researchCoins(s), 3 + expected);
    assert.equal(s.research.ledger.lastReward, expected);
    assert.equal(s.research.active, null);
    assert(S.validSave(s));
  });
}
coin("No active research is required to earn a year's reward", () => {
  const s = emptyPark();
  s.research.active = null;
  S.tick(s, 1080);
  assert.equal(R.researchCoins(s), 5);
  assert.equal(s.research.active, null);
});
coin("Pause prevents research progress and annual rewards exactly", () => {
  const s = emptyPark();
  assert.equal(S.startResearch(s, "zoo"), null);
  s.speed = 0;
  const old = structuredClone(s);
  S.tick(s, 2000);
  assert.deepEqual(s, old);
});
coin("Three-times speed reaches one year once and does not multiply reward", () => {
  const s = emptyPark();
  s.speed = 3;
  S.tick(s, 360);
  assert.equal(s.time, 1080);
  assert.equal(R.researchCoins(s), 5);
  assert.equal(s.research.ledger.year, 1);
});
coin("Save/resume preserves half-year accounting and awards the same result", () => {
  const s = emptyPark();
  s.rating = 75;
  s.operatingIncomeToday = 20;
  S.tick(s, 540);
  const resumed = JSON.parse(JSON.stringify(s));
  assert(S.validSave(resumed));
  S.migratePark(resumed);
  S.tick(s, 540);
  S.tick(resumed, 540);
  assert.deepEqual(resumed.research, s.research);
  assert.equal(R.researchCoins(resumed), 6);
});
coin("Reload at the annual boundary never grants the same reward twice", () => {
  const s = emptyPark();
  S.tick(s, 1080);
  const resumed = JSON.parse(JSON.stringify(s));
  S.migratePark(resumed);
  S.migratePark(resumed);
  assert.equal(R.researchCoins(resumed), 5);
  S.tick(resumed, 0.25);
  assert.equal(R.researchCoins(resumed), 5);
  S.tick(resumed, 1079.75);
  assert.equal(R.researchCoins(resumed), 7);
  assert(S.validSave(resumed));
});
coin("Migrating an old ten-year park grants only the three-coin start allowance", () => {
  const s = emptyPark();
  s.time = 10 * R.YEAR_SECONDS + 20;
  delete s.research.ledger;
  const money = euro(s);
  S.migratePark(s);
  assert.equal(R.researchCoins(s), 3);
  assert.equal(s.research.ledger.year, 10);
  assert.equal(s.research.ledger.lastReward, 0);
  S.tick(s, 1);
  assert.equal(R.researchCoins(s), 3);
  assert.deepEqual(euro(s), money);
  assert(S.validSave(s));
});
coin("Legacy park without research keeps former unlocks and gains no retroactive rewards", () => {
  const s = emptyPark();
  s.time = 5000;
  delete s.research;
  S.migratePark(s);
  assert.deepEqual(s.research.completed, ["family", "thrill", "launch"]);
  assert.equal(R.researchCoins(s), 3);
  S.tick(s, 1);
  assert.equal(R.researchCoins(s), 3);
  assert(S.validSave(s));
});
coin("Starting research spends coins exactly once and leaves every euro ledger unchanged", () => {
  const s = emptyPark(),
    money = euro(s);
  assert.equal(S.startResearch(s, "zoo"), null);
  assert.equal(R.researchCoins(s), 2);
  assert.equal(s.research.active, "zoo");
  assert.equal(s.research.remaining, S.RESEARCH.zoo.duration);
  assert.deepEqual(euro(s), money);
  assert(S.startResearch(s, "family"));
  assert.equal(R.researchCoins(s), 2);
  S.tick(s, 90);
  assert.equal(s.research.active, null);
  assert(s.research.completed.includes("zoo"));
  assert.equal(S.startResearch(s, "savanna"), null);
  assert.equal(R.researchCoins(s), 0);
  assert.deepEqual(euro(s), money);
});
coin(
  "Prerequisites, insufficient coins and already-completed projects cannot consume coins",
  () => {
    const s = emptyPark();
    assert(S.startResearch(s, "savanna"));
    assert.equal(R.researchCoins(s), 3);
    s.research.completed = ["zoo"];
    assert(S.startResearch(s, "zoo"));
    assert.equal(R.researchCoins(s), 3);
    s.research.ledger.coins = 1;
    assert(S.startResearch(s, "savanna"));
    assert.equal(R.researchCoins(s), 1);
    assert.equal(s.research.active, null);
    assert(S.startResearch(s, "unknown-project"));
    assert.equal(R.researchCoins(s), 1);
  },
);
coin("Negative park cash does not prevent coin-funded research", () => {
  const s = emptyPark();
  s.cash = -500;
  const money = euro(s);
  assert.equal(S.startResearch(s, "zoo"), null);
  assert.equal(R.researchCoins(s), 2);
  assert.deepEqual(euro(s), money);
  assert(S.validSave(s));
});
coin("Sandbox research is already unlocked and cannot spend coins", () => {
  const s = emptyPark("sandbox"),
    old = euro(s);
  assert(S.startResearch(s, "zoo"));
  assert.equal(R.researchCoins(s), 3);
  assert.equal(s.research.active, null);
  assert.deepEqual(euro(s), old);
});
coin("Construction expenses and demolition refunds are excluded from operating bonus", () => {
  const profitable = emptyPark();
  profitable.rating = 75;
  profitable.operatingIncomeToday = 1;
  S.spend(profitable, 10000);
  S.tick(profitable, 1080);
  assert.equal(profitable.research.ledger.lastReward, 3);
  const refund = emptyPark();
  refund.rating = 75;
  refund.cash += 10000;
  refund.income += 10000;
  refund.dayIncome += 10000;
  S.tick(refund, 1080);
  assert.equal(refund.research.ledger.lastReward, 2);
});
coin("Completing research and receiving a yearly bonus in the same step are independent", () => {
  const s = emptyPark();
  s.rating = 70;
  s.time = 1079.75;
  s.research.active = "zoo";
  s.research.remaining = 0.25;
  Object.assign(s.research.ledger, {
    coins: 0,
    year: 0,
    elapsed: 1079.75,
    ratingTotal: 1079.75 * 70,
  });
  S.tick(s, 0.25);
  assert.equal(s.research.active, null);
  assert.deepEqual(s.research.completed, ["zoo"]);
  assert.equal(R.researchCoins(s), 2);
  assert(S.validSave(s));
});
coin("Malformed coin ledgers are rejected by the real save validator", () => {
  for (const [field, value] of [
    ["coins", -1],
    ["coins", 1.5],
    ["year", 1],
    ["elapsed", Infinity],
    ["ratingTotal", -1],
    ["profit", NaN],
    ["lastReward", 4],
  ]) {
    const s = emptyPark();
    s.research.ledger[field] = value;
    assert(!S.validSave(s), `${field}=${value}`);
  }
});

function build(s, kind, x, y) {
  const out = S.build(s, kind, x, y);
  assert(!out.error, out.error);
  return s.buildings.find((b) => b.id === out.id);
}
function exitFixture() {
  const s = emptyPark("sandbox"),
    b = build(s, "wheel", 10, 10),
    n = S.CATALOG.wheel.size;
  b.pods = { entry: { side: 2, offset: 1 }, exit: { side: 0, offset: 1 } };
  b.open = true;
  b.tested = true;
  for (let y = 11; y < 20; y++) s.tiles[y][9] = "queue";
  for (let x = 9; x <= 15; x++) s.tiles[20][x] = "path";
  assert(n === 3);
  assert(S.access(s, b));
  assert.equal(S.exitPath(s, b).length, 0);
  return { s, b };
}
function connectedExit(s, b) {
  const route = S.exitPath(s, b);
  assert(route.length > 0, "proposal built no usable exit");
  const end = route.at(-1);
  assert.equal(s.tiles[end.y][end.x], "path");
  assert(S.connected(s).has(S.key(end)));
  return route;
}
function pureProposal(s, b, clear = true) {
  const old = structuredClone(s),
    p = E.suggestExit(s, b, clear);
  assert.deepEqual(s, old, "suggestExit mutated the park");
  return p;
}
exit("Suggestion is pure and reaches public path instead of stopping at blue queue", () => {
  const { s, b } = exitFixture();
  const proposal = pureProposal(s, b);
  assert(proposal);
  assert.equal(E.applyExitSuggestion(s, b, proposal), null);
  connectedExit(s, b);
  assert(S.validSave(s));
});
exit("Every proposed step is bounded, cardinal and excludes water/queue/solid facilities", () => {
  const { s, b } = exitFixture();
  s.tiles[10][14] = "water";
  build(s, "picnic", 13, 12);
  const proposal = pureProposal(s, b);
  assert(proposal);
  assert(proposal.points.length <= 18);
  let previous = P.podPort(b, S.CATALOG[b.kind].size, proposal.pod);
  for (const [i, point] of proposal.points.entries()) {
    assert(S.inBounds(point.x, point.y, s));
    assert(!["water", "queue"].includes(s.tiles[point.y][point.x]));
    const distance = Math.abs(previous.x - point.x) + Math.abs(previous.y - point.y);
    assert.equal(distance, i === 0 ? 0 : 1);
    const hit = S.occupant(s, point.x, point.y);
    assert(!hit || S.canAutoClear(hit.kind));
    previous = point;
  }
  assert.equal(E.applyExitSuggestion(s, b, proposal), null);
  connectedExit(s, b);
});
exit("Applying a proposal preserves every blue path and styled public path", () => {
  const { s, b } = exitFixture();
  s.pathStyles = { "15,10": "boardwalk", "15,11": "brick" };
  const queue = [],
    paths = [];
  for (let y = 0; y < 30; y++)
    for (let x = 0; x < 30; x++) {
      if (s.tiles[y][x] === "queue") queue.push([x, y]);
      if (s.tiles[y][x] === "path") paths.push([x, y]);
    }
  const styles = structuredClone(s.pathStyles),
    proposal = pureProposal(s, b);
  assert(proposal);
  assert.equal(E.applyExitSuggestion(s, b, proposal), null);
  for (const [x, y] of queue) assert.equal(s.tiles[y][x], "queue");
  for (const [x, y] of paths) assert.equal(s.tiles[y][x], "path");
  assert.deepEqual(s.pathStyles, styles);
  connectedExit(s, b);
});
exit("A directly connected current pod costs zero and applies as a complete no-op", () => {
  const { s, b } = exitFixture();
  s.tiles[11][13] = "path";
  s.tiles[11][14] = "path";
  const proposal = pureProposal(s, b);
  assert(proposal);
  assert.equal(proposal.cost, 0);
  assert.deepEqual(proposal.points, []);
  assert.deepEqual(proposal.pod, b.pods.exit);
  const old = structuredClone(s);
  assert.equal(E.applyExitSuggestion(s, b, proposal), null);
  assert.deepEqual(s, old);
  assert.equal(E.applyExitSuggestion(s, b, proposal), null);
  assert.deepEqual(s, old);
});
exit("An already connected red route is reused without repainting or charging", () => {
  const { s, b } = exitFixture();
  s.tiles[11][13] = "exit";
  s.tiles[11][14] = "exit";
  const proposal = pureProposal(s, b);
  assert(proposal);
  assert.equal(proposal.cost, 0);
  const old = structuredClone(s);
  assert.equal(E.applyExitSuggestion(s, b, proposal), null);
  assert.deepEqual(s, old);
  connectedExit(s, b);
});
exit("Real application charges exactly the quoted total", () => {
  const { s, b } = exitFixture();
  const proposal = pureProposal(s, b);
  assert(proposal);
  const cash = s.cash,
    expense = s.expenses;
  assert.equal(E.applyExitSuggestion(s, b, proposal), null);
  close(cash - s.cash, proposal.cost);
  close(s.expenses - expense, proposal.cost);
  connectedExit(s, b);
});
exit("Clearing a first-cell tree is charged once, including a changed pod", () => {
  const { s, b } = exitFixture();
  for (let y = 10; y <= 12; y++) build(s, "tree", 13, y);
  const proposal = pureProposal(s, b);
  assert(proposal);
  assert(proposal.clearIds.length > 0);
  assert.notDeepEqual(proposal.pod, b.pods.exit);
  const cash = s.cash;
  assert.equal(E.applyExitSuggestion(s, b, proposal), null);
  close(cash - s.cash, proposal.cost);
  assert(proposal.clearIds.every((id) => !s.buildings.some((v) => v.id === id)));
  connectedExit(s, b);
  assert(S.validSave(s));
});
exit("Clear-off routing keeps trees and never removes functional amenities", () => {
  const { s, b } = exitFixture();
  const tree = build(s, "tree", 13, 10),
    picnic = build(s, "picnic", 13, 11),
    bench = build(s, "bench", 13, 12);
  const proposal = pureProposal(s, b, false);
  assert(proposal);
  assert.deepEqual(proposal.clearIds, []);
  assert.equal(E.applyExitSuggestion(s, b, proposal, false), null);
  for (const item of [tree, picnic, bench]) assert(s.buildings.includes(item));
  connectedExit(s, b);
});
exit("Water isolation returns no proposal without changing park state", () => {
  const { s, b } = exitFixture();
  for (let y = 0; y < 30; y++)
    for (let x = 0; x < 30; x++)
      if (s.tiles[y][x] === "grass" && !S.occupant(s, x, y)) s.tiles[y][x] = "water";
  assert.equal(pureProposal(s, b), null);
});
exit("Stale geometry/proposal is rejected before any mutation or charge", () => {
  const { s, b } = exitFixture();
  const proposal = pureProposal(s, b);
  assert(proposal?.points.length);
  const first = proposal.points[0];
  s.tiles[first.y][first.x] = "water";
  const old = structuredClone(s);
  assert(E.applyExitSuggestion(s, b, proposal));
  assert.deepEqual(s, old);
});
exit("Insufficient funds reject the entire proposal without partial construction", () => {
  const { s, b } = exitFixture();
  const proposal = pureProposal(s, b);
  assert(proposal && proposal.cost > 0);
  s.cash = proposal.cost - 1;
  const old = structuredClone(s);
  assert(E.applyExitSuggestion(s, b, proposal));
  assert.deepEqual(s, old);
});
exit("A paid proposal cannot be applied twice or charge twice", () => {
  const { s, b } = exitFixture();
  const proposal = pureProposal(s, b);
  assert(proposal && proposal.cost > 0);
  assert.equal(E.applyExitSuggestion(s, b, proposal), null);
  const old = structuredClone(s);
  assert(E.applyExitSuggestion(s, b, proposal));
  assert.deepEqual(s, old);
});
exit("Apply plus actual recordEdit/undo restores terrain, pods, trees and accounting", () => {
  const { s, b } = exitFixture();
  for (let y = 10; y <= 12; y++) build(s, "tree", 13, y);
  const proposal = pureProposal(s, b);
  assert(proposal);
  const old = {
    tiles: structuredClone(s.tiles),
    pods: structuredClone(b.pods),
    ids: s.buildings.map((v) => v.id).sort(),
    money: euro(s),
    open: b.open,
  };
  const rec = C.recordEdit(s, "auto exit", () =>
    assert.equal(E.applyExitSuggestion(s, b, proposal), null),
  );
  assert(rec);
  connectedExit(s, b);
  s.time = 3;
  assert.equal(C.undoEdits(s, [rec]), null);
  assert.deepEqual(s.tiles, old.tiles);
  assert.deepEqual(b.pods, old.pods);
  assert.deepEqual(s.buildings.map((v) => v.id).sort(), old.ids);
  assert.deepEqual(euro(s), old.money);
  assert.equal(b.open, old.open);
  assert.equal(s.time, 3);
  assert(S.validSave(s));
});
const failed = results.filter((r) => !r.pass);
const report = {
  repo,
  overlay: overlay ?? null,
  count: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  groups: Object.fromEntries(
    ["coins", "exit"].map((group) => {
      const list = results.filter((v) => v.group === group);
      return [group, { total: list.length, passed: list.filter((v) => v.pass).length }];
    }),
  ),
  results,
};
fs.writeFileSync(
  `/tmp/coins-exit-${overlay ? "prototype" : "original"}-results.json`,
  JSON.stringify(report, null, 2),
);
console.log(`\n${report.passed}/${report.count} passed; ${report.failed} failed`);
process.exitCode = failed.length ? 1 : 0;

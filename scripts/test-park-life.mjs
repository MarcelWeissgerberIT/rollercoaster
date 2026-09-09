import assert from "node:assert/strict";
import fs from "node:fs";
import { moduleURL } from "./ts-loader.mjs";
const repo = "repository",
  overlay = undefined;
const S = await import(moduleURL("game/simulation.ts"));
const C = await import(moduleURL("game/construction.ts"));
const L = await import(moduleURL("game/park-life.ts"));
let seed = 73;
Math.random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const results = [];
function test(name, run) {
  try {
    run();
    results.push({ name, pass: true });
    console.log("PASS", name);
  } catch (error) {
    results.push({ name, pass: false, error: error.message });
    console.error("FAIL", name, "\n ", error.message);
  }
}
function fixture() {
  const s = S.newPark("sandbox");
  s.buildings = [];
  s.guests = [];
  s.transitLines = [];
  s.tiles = Array.from({ length: 30 }, () => Array(30).fill("grass"));
  for (let y = 0; y < 30; y++) s.tiles[y][15] = "path";
  s.pathStyles = {};
  s.time = 0;
  s.speed = 1;
  s.open = true;
  s.spawnClock = -10000;
  s.cash = 100000;
  s.income = 0;
  s.expenses = 0;
  s.dayIncome = 0;
  s.dayExpenses = 0;
  s.operatingIncomeToday = 0;
  s.operatingExpensesToday = 0;
  s.operatingProfit = 0;
  s.staff = 0;
  if (s.zoo) {
    s.zoo.keepers = 0;
    s.zoo.workers = [];
  }
  if (s.cleanliness) {
    s.cleanliness.workers = [];
    s.cleanliness.litter = [];
  }
  if (s.research?.ledger)
    Object.assign(s.research.ledger, { year: 0, elapsed: 0, ratingTotal: 0, profit: 0 });
  return s;
}
function build(s, kind, x = 14, y = 20) {
  const out = S.build(s, kind, x, y);
  assert(!out.error, out.error);
  const b = s.buildings.find((item) => item.id === out.id);
  assert(b, "built object exists");
  return b;
}
function guest(s, patch = {}) {
  const g = {
    id: s.nextId++,
    name: "Test Gast",
    x: 15,
    y: 20,
    state: "walk",
    route: [],
    target: null,
    timer: 0,
    happiness: 80,
    hunger: 20,
    thirst: 20,
    bladder: 10,
    rides: 0,
    skin: 0,
    thought: "Test",
    profile: "family",
    wallet: 100,
    energy: 20,
    visited: [],
    ...patch,
  };
  s.guests.push(g);
  return g;
}
function resting(s, b, patch = {}) {
  const a = S.access(s, b);
  assert(a, "amenity is reachable");
  return guest(s, {
    x: a.x,
    y: a.y,
    target: b.id,
    state: "rest",
    rest: { slot: 0, remaining: 10 },
    ...patch,
  });
}
const close = (a, b) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

for (const kind of Object.keys(L.FOOD))
  test(`${kind}: service grants visible food and charges price/supplies exactly once`, () => {
    const s = fixture(),
      b = build(s, kind),
      g = guest(s, { state: "ride", target: b.id, hunger: 85, thirst: 85, servicePrice: b.price });
    b.riders = [g.id];
    b.cycle = 0.01;
    const before = { cash: s.cash, wallet: g.wallet, income: s.income, expenses: s.expenses };
    S.tick(s, 0.25);
    assert.equal(g.food?.kind, kind);
    assert.equal(g.food.total, L.FOOD[kind].duration);
    close(g.food.remaining, L.FOOD[kind].duration - 0.25);
    assert.equal(b.served, 1);
    close(b.revenue, b.price);
    close(g.wallet, before.wallet - b.price);
    close(s.cash, before.cash + b.price - L.FOOD[kind].supplies);
    close(s.income, before.income + b.price);
    close(s.expenses, before.expenses + L.FOOD[kind].supplies);
    assert(g[L.FOOD[kind].drink ? "thirst" : "hunger"] < 1);
    assert.equal(g.waste?.[0]?.kind, L.FOOD[kind].drink ? "cup" : "wrapper");
    S.tick(s, 0.25);
    assert.equal(b.served, 1);
    close(g.wallet, before.wallet - b.price);
    assert(S.validSave(s), "service result is a valid save");
  });
test("Pause freezes food, reservations and simulation exactly", () => {
  const s = fixture(),
    b = build(s, "bench");
  resting(s, b, { food: { kind: "hotdog", remaining: 12, total: 22 } });
  s.speed = 0;
  const before = structuredClone(s);
  S.tick(s, 50);
  assert.deepEqual(s, before);
});
test("Food and rest use simulation speed once, not wall time", () => {
  const s = fixture(),
    b = build(s, "picnic");
  const g = resting(s, b, { food: { kind: "popcorn", remaining: 20, total: 30 } });
  const faster = structuredClone(s);
  faster.speed = 3;
  S.tick(s, 0.75);
  S.tick(faster, 0.25);
  close(g.food.remaining, faster.guests[0].food.remaining);
  close(g.rest.remaining, faster.guests[0].rest.remaining);
  close(g.energy, faster.guests[0].energy);
  close(s.time, faster.time);
});
test("Consuming the last food clears it without another sale", () => {
  const s = fixture();
  s.open = false;
  const g = guest(s, { timer: 100, food: { kind: "coffee", remaining: 0.1, total: 24 } });
  const cash = s.cash;
  S.tick(s, 0.25);
  assert.equal(g.food, undefined);
  assert.equal(s.cash, cash);
});
for (const kind of Object.keys(L.AMENITIES))
  test(`${kind}: distinct seats, bounded capacity and free rest completion`, () => {
    const s = fixture(),
      b = build(s, kind, kind === "playground" ? 12 : 14, 20);
    const n = L.AMENITIES[kind].seats;
    for (let i = 0; i < n + 1; i++) guest(s);
    S.tick(s, 0.1);
    const booked = s.guests.filter((g) => g.target === b.id && g.rest);
    assert.equal(booked.length, n);
    assert.equal(new Set(booked.map((g) => g.rest.slot)).size, n);
    assert.equal(L.amenityRoom(s, b), -1);
    S.tick(s, 0.1);
    assert(booked.every((g) => g.state === "rest"));
    const g = booked[0],
      energy = g.energy,
      joy = g.happiness,
      wallet = g.wallet,
      cash = s.cash;
    g.rest.remaining = 0.1;
    S.tick(s, 0.25);
    assert.equal(g.state, "walk");
    assert.equal(g.rest, undefined);
    assert.equal(g.target, null);
    assert(g.energy > energy);
    assert(g.happiness > joy);
    assert.equal(g.rides, 0);
    assert(g.visited.includes(b.id));
    assert.equal(b.served, 1);
    assert.equal(g.wallet, wallet);
    assert.equal(s.cash, cash);
    assert(S.validSave(s));
  });
test("Closed amenity releases its guest and seat on the next tick", () => {
  const s = fixture(),
    b = build(s, "picnic"),
    g = resting(s, b);
  b.open = false;
  S.tick(s, 0.1);
  assert.equal(g.state, "walk");
  assert.equal(g.target, null);
  assert.equal(g.rest, undefined);
  assert(S.validSave(s));
});
test("Disconnected amenity releases its guest to reachable paths", () => {
  const s = fixture(),
    b = build(s, "bench"),
    g = resting(s, b);
  S.remove(s, 15, 21);
  S.tick(s, 0.1);
  assert.equal(g.rest, undefined);
  assert.equal(g.target, null);
  assert(S.connected(s).has(`${g.x},${g.y}`));
  assert(S.validSave(s));
});
test("Explicit demolition releases a resting guest immediately", () => {
  const s = fixture(),
    b = build(s, "bench"),
    g = resting(s, b);
  S.remove(s, b.x, b.y);
  assert.equal(g.rest, undefined);
  assert.equal(g.target, null);
  assert.equal(g.state, "walk");
  assert(S.validSave(s));
});
for (const kind of Object.keys(L.AMENITIES))
  test(`${kind}: automatic path placement protects functional furniture`, () => {
    const s = fixture(),
      b = build(s, kind, kind === "playground" ? 12 : 14, 20),
      g = resting(s, b);
    const before = structuredClone(s);
    const plan = C.planPlacement(s, "path", { x: b.x, y: b.y }, undefined, true);
    assert(plan.error, "functional furniture must require explicit demolition");
    assert(!plan.clearIds.includes(b.id));
    const outcome = C.place(s, "path", { x: b.x, y: b.y }, undefined, true);
    assert(outcome.error);
    assert.deepEqual(s, before);
    assert(S.validSave(s));
    assert.equal(g.target, b.id);
  });
test("Tree decorations remain automatically clearable", () => {
  const s = fixture(),
    tree = build(s, "tree"),
    plan = C.planPlacement(s, "path", tree, undefined, true);
  assert.equal(plan.error, null);
  assert(plan.clearIds.includes(tree.id));
  const out = C.place(s, "path", tree, undefined, true);
  assert(!out.error);
  assert(!s.buildings.some((b) => b.id === tree.id));
  assert(S.validSave(s));
});
test("Automatic connection routes around a bench instead of clearing it", () => {
  const s = fixture(),
    food = build(s, "burger", 10, 20),
    bench = build(s, "bench", 11, 20);
  const plan = C.planConnection(s, food, true);
  assert.equal(plan.error, null);
  assert(!plan.clearIds.includes(bench.id), "bench would be silently demolished");
  assert(!plan.points.some((p) => p.x === bench.x && p.y === bench.y));
});
test("Pod placement protects a bench at the connection point", () => {
  const s = fixture(),
    ride = build(s, "wheel", 10, 15);
  ride.pods = { entry: { side: 1, offset: 0 }, exit: { side: 3, offset: 0 } };
  const bench = build(s, "bench", 10 + S.CATALOG.wheel.size, 16);
  const plan = C.planPod(s, ride, "entry", { side: 0, offset: 1 }, true);
  assert(plan.error);
  assert(!plan.clearIds.includes(bench.id));
});
test("Releasing/moving an amenity clears active and walking seat reservations", () => {
  const s = fixture(),
    b = build(s, "bench"),
    seated = resting(s, b);
  const walking = guest(s, {
    target: b.id,
    rest: { slot: 1, remaining: 0 },
    route: [{ x: 15, y: 20 }],
  });
  C.releaseBuildingGuests(s, b);
  for (const g of [seated, walking]) {
    assert.equal(g.target, null);
    assert.equal(g.rest, undefined);
    assert.equal(g.state, "walk");
  }
  assert(S.validSave(s));
});
test("Undo of a newly built amenity clears all seat reservations", () => {
  const s = fixture();
  let b;
  const record = C.recordEdit(s, "bench", () => {
    b = build(s, "bench");
  });
  assert(record);
  const g = resting(s, b);
  assert.equal(C.undoEdits(s, [record]), null);
  assert.equal(g.rest, undefined);
  assert.equal(g.target, null);
  assert.equal(g.state, "walk");
  assert(S.validSave(s));
});
test("Food-only area: guest eats at available picnic after 30s instead of leaving", () => {
  const s = fixture(),
    table = build(s, "picnic"),
    food = build(s, "hotdog", 14, 22);
  s.time = 40;
  const g = guest(s, { wallet: 2, energy: 80, food: { kind: "hotdog", remaining: 20, total: 22 } });
  S.tick(s, 0.1);
  assert.equal(g.target, table.id);
  assert(g.rest);
  assert.notEqual(g.state, "leave");
});
test("Family-only area: playground remains usable without a paid attraction", () => {
  const s = fixture(),
    b = build(s, "playground", 12, 20);
  s.time = 40;
  const g = guest(s, { energy: 80 });
  S.tick(s, 0.1);
  assert.equal(g.target, b.id);
  assert(g.rest);
  assert.notEqual(g.state, "leave");
});
test("Far-away seating does not trap a departing guest in an empty park", () => {
  const s = fixture();
  build(s, "bench", 14, 2);
  s.time = 40;
  const g = guest(s, { y: 25, energy: 20 });
  S.tick(s, 0.1);
  assert.equal(g.state, "leave");
  assert.equal(g.rest, undefined);
});
test("Park closure still sends guests home instead of starting another rest", () => {
  const s = fixture();
  build(s, "bench");
  s.open = false;
  const g = guest(s);
  S.tick(s, 0.1);
  assert.equal(g.state, "leave");
  assert.equal(g.rest, undefined);
});
for (const style of Object.keys(L.PATH_STYLES))
  test(`${style}: new path + unchanged paint + erase + undo preserve style and money`, () => {
    const s = fixture(),
      point = { x: 14, y: 25 },
      cash = s.cash;
    const added = C.recordEdit(s, "path", () => {
      assert.equal(S.paint(s, point.x, point.y, "path", style), null);
    });
    assert(added);
    close(s.cash, cash - 12);
    assert.equal(L.pathStyleAt(s, point.x, point.y), style);
    const unchanged = C.recordEdit(s, "no-op", () => {
      assert.equal(S.paint(s, point.x, point.y, "path", style), null);
    });
    assert.equal(unchanged, null);
    close(s.cash, cash - 12);
    const erased = C.recordEdit(s, "erase", () => S.remove(s, point.x, point.y));
    assert(erased);
    assert.equal(s.pathStyles?.["14,25"], undefined);
    C.undoEdits(s, [erased]);
    assert.equal(s.tiles[25][14], "path");
    assert.equal(L.pathStyleAt(s, 14, 25), style);
    C.undoEdits(s, [added]);
    assert.equal(s.tiles[25][14], "grass");
    assert.equal(s.pathStyles?.["14,25"], undefined);
    close(s.cash, cash);
    assert(S.validSave(s));
  });
test("Resurfacing costs six, records a style-only change and preserves time on undo", () => {
  const s = fixture(),
    cash = s.cash;
  const plan = C.planPlacement(s, "path", { x: 15, y: 20 }, undefined, true, undefined, "brick");
  assert.equal(plan.cost, 6);
  const record = C.recordEdit(s, "brick", () => {
    assert(!C.place(s, "path", { x: 15, y: 20 }, undefined, true, undefined, "brick").error);
  });
  assert(record);
  assert.equal(record.tiles.length, 0);
  assert.equal(record.pathStyles.length, 1);
  close(s.cash, cash - 6);
  s.time = 12;
  C.undoEdits(s, [record]);
  close(s.cash, cash);
  assert.equal(s.time, 12);
  assert.equal(L.pathStyleAt(s, 15, 20), "garden");
  assert(S.validSave(s));
});
test("Changing styled path to queue and undo restores both tile and style", () => {
  const s = fixture();
  S.paint(s, 15, 20, "path", "boardwalk");
  const record = C.recordEdit(s, "queue", () => S.paint(s, 15, 20, "queue"));
  assert.equal(s.pathStyles?.["15,20"], undefined);
  C.undoEdits(s, [record]);
  assert.equal(s.tiles[20][15], "path");
  assert.equal(L.pathStyleAt(s, 15, 20), "boardwalk");
  assert(S.validSave(s));
});
test("Sequential style undo is reversible, including return to default garden", () => {
  const s = fixture(),
    cash = s.cash;
  const records = ["stone", "brick", "garden"].map((style) =>
    C.recordEdit(s, style, () => S.paint(s, 15, 20, "path", style)),
  );
  close(s.cash, cash - 18);
  assert.equal(s.pathStyles["15,20"], undefined);
  C.undoEdits(s, records);
  assert.equal(L.pathStyleAt(s, 15, 20), "garden");
  close(s.cash, cash);
  assert(S.validSave(s));
});
test("Insufficient funds do not partially repaint a path", () => {
  const s = fixture();
  s.cash = 5;
  const before = structuredClone(s);
  const out = C.place(s, "path", { x: 15, y: 20 }, undefined, true, undefined, "brick");
  assert(out.error);
  assert.deepEqual(s, before);
});
test("Save rejects malformed path styles and food values", () => {
  for (const patch of [
    (s) => {
      s.pathStyles = { "015,20": "stone" };
    },
    (s) => {
      s.pathStyles = { "14,20": "stone" };
    },
    (s) => {
      s.pathStyles = { "15,20": "lava" };
    },
    (s) => {
      guest(s, { food: { kind: "coffee", remaining: -1, total: 24 } });
    },
    (s) => {
      guest(s, { food: { kind: "coffee", remaining: 25, total: 24 } });
    },
    (s) => {
      guest(s, { energy: 101 });
    },
  ]) {
    const s = fixture();
    patch(s);
    assert(!S.validSave(s));
  }
});
test("Save rejects seat indices outside the actual amenity capacity", () => {
  const s = fixture(),
    b = build(s, "bench");
  resting(s, b, { rest: { slot: 7, remaining: 10 } });
  assert(!S.validSave(s), "bench has only two seats but slot7 was accepted");
});
test("Save rejects two guests reserving the same amenity seat", () => {
  const s = fixture(),
    b = build(s, "picnic");
  resting(s, b);
  resting(s, b);
  assert(!S.validSave(s), "duplicate slot0 reservations were accepted");
});
const failed = results.filter((r) => !r.pass);
const report = {
  repo,
  overlay: overlay ?? null,
  count: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
};
const name = overlay ? "prototype" : "original";
fs.writeFileSync(`/tmp/park-life-${name}-results.json`, JSON.stringify(report, null, 2));
console.log(`\n${report.passed}/${report.count} passed; ${report.failed} failed (${name})`);
process.exitCode = failed.length ? 1 : 0;

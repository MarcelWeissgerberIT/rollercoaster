import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
process.on("uncaughtException", (e) => {
  console.error(e.message);
  process.exit(1);
});
const S = await import(moduleURL("game/simulation.ts")),
  M = await import(moduleURL("game/marketing.ts")),
  T = await import(moduleURL("game/transit.ts")),
  O = await import(moduleURL("game/operations.ts"));
const tests = [];
const clone = structuredClone;
function test(name, fn) {
  try {
    tests.push({ name, pass: true, evidence: fn() });
  } catch (e) {
    tests.push({ name, pass: false, error: e.message.slice(0, 1200) });
  }
  console.log(JSON.stringify(tests.at(-1)));
}
function random(values, fn) {
  const original = Math.random;
  let i = 0;
  Math.random = () => values[i++] ?? 0.5;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}
const available = (s, b) => !!S.access(s, b);
function empty() {
  const s = S.newPark("sandbox");
  s.cash = 1e6;
  s.speed = 1;
  s.guests = [];
  s.spawnClock = 0;
  for (const b of s.buildings) {
    b.queue = [];
    b.riders = [];
    b.cycle = 0;
  }
  return s;
}
function arrival(attributed = true) {
  const s = empty();
  s.open = true;
  s.spawnClock = 100;
  assert.equal(M.startMarketing(s, "flyers", 1), null);
  const c = s.marketing.campaigns[0],
    before = { cash: s.cash, income: s.income, arrivals: s.arrivals, op: s.operatingIncomeToday };
  random([0, 0.5, 0.5, 0.5, attributed ? 0.999 : 0], () => S.tick(s, 0.01));
  assert.equal(s.guests.length, 1);
  const g = s.guests[0];
  assert.equal(g.campaignId, attributed ? c.id : null);
  assert.equal(s.arrivals, before.arrivals + 1);
  assert.equal(s.cash, before.cash + s.ticket);
  assert.equal(s.income, before.income + s.ticket);
  assert.equal(s.operatingIncomeToday, before.op + s.ticket);
  assert.equal(c.visitors, attributed ? 1 : 0);
  assert.equal(c.revenue.ticket, attributed ? s.ticket : 0);
  assert(S.validSave(JSON.parse(JSON.stringify(s))));
  s.open = false;
  return { s, c, g };
}
function queue(s, g, b) {
  const p = S.access(s, b);
  assert(p, `No access ${b.kind}`);
  g.x = p.x;
  g.y = p.y;
  g.route = [];
  g.target = b.id;
  g.state = "queue";
  g.timer = 0;
  g.wallet = 100;
  b.open = true;
  b.queue = [g.id];
  b.riders = [];
  b.cycle = 0;
}
function transport() {
  const { s, c, g } = arrival();
  s.buildings = [];
  s.tiles = s.tiles.map((r) => r.map(() => "grass"));
  s.transitLines = [];
  for (let x = 2; x <= 27; x++) s.tiles[20][x] = "path";
  for (let y = 20; y < 30; y++) s.tiles[y][15] = "path";
  const ai = S.build(s, "shuttle", 2, 19).id,
    bi = S.build(s, "shuttle", 27, 19).id,
    a = s.buildings.find((b) => b.id === ai),
    b = s.buildings.find((b) => b.id === bi);
  assert.equal(T.createTransitLine(s, a, b), null);
  const line = s.transitLines[0];
  g.x = 2;
  g.y = 20;
  g.state = "queue";
  g.target = null;
  g.route = [];
  g.timer = 0;
  g.wallet = 100;
  g.transit = { line: line.id, from: a.id, to: b.id };
  a.queue = [g.id];
  a.price = 3;
  return { s, c, g, a, b, line };
}
test("Real attributed arrival records visitor + paid entrance once", () => {
  const { s, c, g } = arrival();
  return { id: g.id, campaign: g.campaignId, visitors: c.visitors, ticket: c.revenue.ticket };
});
test("Real organic arrival remains organic during active advertising", () => {
  const { s, c, g } = arrival(false);
  assert.equal(c.revenue.ticket, 0);
  return { source: g.campaignId, campaignVisitors: c.visitors };
});
test("Ride boarding charges actual guest once; finish after campaign expiration does not double-count", () => {
  const { s, c, g } = arrival(),
    b = s.buildings.find((b) => S.isRide(b.kind) && S.access(s, b));
  queue(s, g, b);
  const cash = s.cash,
    wal = g.wallet,
    op = s.operatingIncomeToday,
    price = b.price;
  const dispatch = O.BOARDING_SECONDS + O.CHECKING_SECONDS;
  random([], () => S.tick(s, dispatch - 0.01));
  assert.equal(g.state, "queue");
  assert.equal(c.revenue.ride, 0);
  assert.equal(g.wallet, wal);
  assert.equal(s.cash, cash);
  random([], () => S.tick(s, 0.02));
  assert.equal(g.state, "ride");
  assert.equal(c.revenue.ride, price);
  assert.equal(g.wallet, wal - price);
  assert.equal(s.cash, cash + price);
  assert.equal(s.operatingIncomeToday, op + price);
  s.time = c.endsAt;
  b.cycle = 0.01;
  random([], () => S.tick(s, 0.02));
  assert.equal(g.rides, 1);
  assert.equal(c.revenue.ride, price);
  assert(M.validMarketing(s));
  return { kind: b.kind, price };
});
test("Shop reserves without charge, then credits actual service payment after cancellation", () => {
  const { s, c, g } = arrival(),
    b = s.buildings.find((b) => b.kind === "burger");
  queue(s, g, b);
  const cash = s.cash,
    wal = g.wallet,
    op = s.operatingIncomeToday,
    price = b.price;
  random([], () => S.tick(s, 0.01));
  assert.equal(g.state, "ride");
  assert.equal(g.servicePrice, price);
  assert.equal(c.revenue.shop, 0);
  assert.equal(g.wallet, wal);
  assert.equal(s.cash, cash);
  assert.equal(M.cancelMarketing(s, c.id), null);
  b.price += 2;
  b.cycle = 0.01;
  random([], () => S.tick(s, 0.02));
  assert.equal(g.servicePrice, undefined);
  assert.equal(c.revenue.shop, price);
  assert.equal(g.wallet, wal - price);
  assert.equal(s.cash, cash + price - 3);
  assert.equal(s.operatingIncomeToday, op + price);
  return { reserved: price, newMenuPrice: b.price, attributed: c.revenue.shop };
});
test("Shop closure before successful service does not invent attributed payments", () => {
  const { s, c, g } = arrival(),
    b = s.buildings.find((b) => b.kind === "burger");
  queue(s, g, b);
  const cash = s.cash,
    wal = g.wallet;
  random([], () => S.tick(s, 0.01));
  assert.equal(g.state, "ride");
  b.open = false;
  random([], () => S.tick(s, 0.02));
  assert.equal(c.revenue.shop, 0);
  assert.equal(s.cash, cash);
  assert.equal(g.wallet, wal);
});
test("Actual transit boarding reserves fare, arrival credits exactly once after saved resume", () => {
  let { s, c, g, a, b, line } = transport();
  const cash = s.cash,
    wal = g.wallet,
    op = s.operatingIncomeToday;
  random([], () => S.tick(s, 4.01));
  assert.equal(g.state, "ride");
  assert.equal(c.revenue.ride, 0);
  assert.equal(g.wallet, wal);
  assert.equal(s.cash, cash);
  assert(S.validSave(JSON.parse(JSON.stringify(s))));
  s = JSON.parse(JSON.stringify(s));
  c = s.marketing.campaigns[0];
  g = s.guests[0];
  line = s.transitLines[0];
  random([], () => S.tick(s, 25 / T.transportSpeed("shuttle") + 0.1));
  assert.equal(g.transit, undefined);
  assert.equal(c.revenue.ride, 3);
  assert.equal(g.wallet, wal - 3);
  assert.equal(s.cash, cash + 3);
  assert.equal(s.operatingIncomeToday, op + 3);
  assert.equal(line.revenue, 3);
  random([], () => S.tick(s, 0.1));
  assert.equal(c.revenue.ride, 3);
  assert(S.validSave(s));
  return { fare: c.revenue.ride };
});
test("Interrupted transit does not attribute an unpaid reserved fare", () => {
  const { s, c, g, b, line } = transport();
  const cash = s.cash,
    wal = g.wallet;
  random([], () => S.tick(s, 4.01));
  assert.equal(g.state, "ride");
  b.open = false;
  random([], () => S.tick(s, 0.1));
  assert.equal(g.transit, undefined);
  assert.equal(c.revenue.ride, 0);
  assert.equal(g.wallet, wal);
  assert.equal(s.cash, cash);
});
test("Campaign expense enters actual day-close operating profit exactly once", () => {
  const a = empty();
  a.open = false;
  const b = clone(a),
    cash = a.cash;
  assert.equal(M.startMarketing(a, "park", 1), null);
  random([], () => S.tick(a, 90));
  random([], () => S.tick(b, 90));
  assert.equal(a.time, 90);
  assert.equal(M.campaignStatus(a, a.marketing.campaigns[0]), "finished");
  assert.equal(a.cash - b.cash, -180);
  assert.equal(a.operatingProfit - b.operatingProfit, -180);
  assert.equal(a.lastProfit - b.lastProfit, -180);
  assert.equal(a.dayExpenses, b.dayExpenses);
  assert.equal(a.operatingExpensesToday, b.operatingExpensesToday);
  return { campaignProfit: a.operatingProfit, controlProfit: b.operatingProfit, cost: 180 };
});
test("Real paused and triple-speed ticks plus save/resume preserve duration", () => {
  const s = empty();
  s.open = false;
  assert.equal(M.startMarketing(s, "flyers", 1), null);
  s.speed = 0;
  const before = s.time;
  S.tick(s, 10);
  assert.equal(s.time, before);
  s.speed = 3;
  random([], () => S.tick(s, 10));
  assert.equal(s.time, 30);
  const copy = JSON.parse(JSON.stringify(s));
  assert(S.validSave(copy));
  random([], () => S.tick(copy, 20));
  assert.equal(copy.time, 90);
  assert.equal(M.campaignStatus(copy, copy.marketing.campaigns[0]), "finished");
});
test("Actual choice changes only for attributed ride guests; organic score and price/wait sensitivity remain", () => {
  const s = empty();
  s.buildings = [];
  s.guests = [];
  s.tiles = s.tiles.map((r) => r.map(() => "grass"));
  for (let x = 2; x <= 27; x++) s.tiles[20][x] = "path";
  for (let y = 20; y < 30; y++) s.tiles[y][15] = "path";
  const first = S.build(s, "carousel", 12, 18).id,
    second = S.build(s, "carousel", 17, 18).id;
  const a = s.buildings.find((b) => b.id === first),
    b = s.buildings.find((b) => b.id === second);
  a.open = b.open = true;
  a.tested = b.tested = true;
  assert(available(s, a) && available(s, b));
  s.open = true;
  assert.equal(M.startMarketing(s, "ride", 1, a.id, available), null);
  const organic = {
    ...clone(S.newPark().guests[0]),
    id: s.nextId++,
    campaignId: null,
    x: 15,
    y: 20,
    target: null,
    state: "walk",
    route: [],
    timer: 0,
    wallet: 100,
    hunger: 0,
    thirst: 0,
    bladder: 0,
    visited: [],
    rides: 0,
    happiness: 90,
    profile: "family",
  };
  const ad = { ...clone(organic), id: s.nextId++ };
  delete ad.campaignId;
  s.guests = [organic, ad];
  M.attributeMarketingGuest(s, ad, 0.999, available);
  assert.equal(S.guestScore(a, organic, s), S.guestScore(a, organic));
  assert(Math.abs(S.guestScore(a, ad, s) - S.guestScore(a, ad) - 2) < 1e-9);
  assert.equal(S.guestScore(b, ad, s), S.guestScore(b, ad));
  s.spawnClock = 0;
  random([], () => S.tick(s, 0.01));
  assert.equal(organic.target, b.id);
  assert.equal(ad.target, a.id);
  const base = S.guestScore(a, ad, s);
  a.price += 10;
  assert(S.guestScore(a, ad, s) < base - 3);
  // A running cycle now belongs to an occupied dispatch, not an empty ride.
  const occupied = clone(a);
  occupied.riders = [organic.id];
  occupied.cycle = 100;
  O.startRideProgram(occupied);
  assert(S.guestScore(occupied, ad, s) < base - 8);
  return { organic: organic.target, advertised: ad.target, bonus: 2 };
});
test("Integrated campaign increases admission demand and shortens real first-arrival interval", () => {
  const control = empty(),
    advertised = clone(control);
  control.open = advertised.open = true;
  assert.equal(M.startMarketing(advertised, "park", 1), null);
  const base = S.entryDemand(control),
    boosted = S.entryDemand(advertised);
  assert(boosted > base || base === 1);
  const timeToFirst = (s) => {
    const n = s.arrivals;
    random(Array(1000).fill(0), () => {
      for (let i = 0; i < 300 && s.arrivals === n; i++) S.tick(s, 0.05);
    });
    assert.equal(s.arrivals, n + 1);
    return s.time;
  };
  const normal = timeToFirst(control),
    promo = timeToFirst(advertised);
  assert(promo < normal);
  return {
    baseDemand: base,
    promotedDemand: boosted,
    normalSeconds: normal,
    promotedSeconds: promo,
  };
});
console.log(`${tests.filter((t) => t.pass).length}/${tests.length} passed`);
process.exitCode = tests.every((t) => t.pass) ? 0 : 1;

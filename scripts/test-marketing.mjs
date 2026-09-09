import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const M = await import(moduleURL("game/marketing.ts"));
const S = await import(moduleURL("game/simulation.ts"));
process.on("uncaughtException", (e) => {
  console.error(e.message);
  process.exit(1);
});
const tests = [];
function test(name, fn) {
  try {
    const evidence = fn();
    tests.push({ name, pass: true, evidence });
  } catch (e) {
    tests.push({ name, pass: false, error: e.message.slice(0, 1600) });
  }
  console.log(JSON.stringify(tests.at(-1)));
}
const snap = JSON.stringify,
  clone = structuredClone;
function fixture() {
  const s = S.newPark("sandbox");
  s.cash = 10000;
  s.guests = [];
  s.open = true;
  const b = s.buildings.find((b) => b.kind === "coaster");
  b.open = true;
  b.tested = true;
  return { s, b };
}
const available = (s, b) => !!S.access(s, b);
function guest(s) {
  const g = {
    id: s.nextId++,
    x: 15,
    y: 29,
    route: [],
    target: null,
    state: "walk",
    timer: 0,
    happiness: 80,
    hunger: 20,
    thirst: 20,
    rides: 0,
    skin: 1,
    thought: "Test",
    wallet: 60,
    visited: [],
  };
  s.guests.push(g);
  return g;
}
function start(s, kind = "flyers", days = 1, targetId) {
  assert.equal(M.startMarketing(s, kind, days, targetId, available), null);
  return s.marketing.campaigns.at(-1);
}
function assigned(s, roll = 0.999) {
  const g = guest(s);
  assert(M.attributeMarketingGuest(s, g, roll, available));
  return g;
}
test("Old saves validate with absent marketing state", () => {
  const { s } = fixture();
  assert(M.validMarketing(s));
  assert(S.validSave(s));
});
test("Quote is read-only and duration/cost scale 1–3 days", () => {
  const { s } = fixture(),
    before = snap(s);
  for (const d of [1, 2, 3]) {
    const q = M.quoteMarketing(s, "park", d);
    assert.equal(q.cost, 180 * d);
    assert.equal(q.duration, 90 * d);
    assert.equal(q.error, null);
  }
  assert.equal(snap(s), before);
});
test("Start upfront book cost exactly once including operating expenses", () => {
  const { s } = fixture(),
    cash = s.cash,
    expenses = s.expenses,
    day = s.dayExpenses,
    op = s.operatingExpensesToday,
    c = start(s, "park", 3);
  assert.equal(c.endsAt - c.startedAt, 270);
  assert.equal(s.cash, cash - 540);
  assert.equal(s.expenses, expenses + 540);
  assert.equal(s.dayExpenses, day + 540);
  assert.equal(s.operatingExpensesToday, op + 540);
  assert(M.validMarketing(s));
  return { cost: c.cost };
});
test("Insufficient live budget and invalid durations are atomic without lazy state creation", () => {
  const { s } = fixture();
  for (const [kind, d] of [
    ["flyers", 0],
    ["flyers", 4],
    ["flyers", 1.5],
    ["missing", 2],
    ["flyers", NaN],
  ]) {
    const before = snap(s);
    assert(M.startMarketing(s, kind, d));
    assert.equal(snap(s), before);
  }
  s.cash = 89;
  const before = snap(s);
  assert(M.startMarketing(s, "flyers", 1));
  assert.equal(snap(s), before);
});
test("One active per type and maximum two types, no debit on rejection", () => {
  const { s, b } = fixture();
  start(s);
  let before = snap(s);
  assert(M.startMarketing(s, "flyers", 2));
  assert.equal(snap(s), before);
  start(s, "park");
  before = snap(s);
  assert(M.startMarketing(s, "ride", 1, b.id, available));
  assert.equal(snap(s), before);
});
test("Ride campaign enforces eligible target and live access callback", () => {
  const { s, b } = fixture();
  for (const target of [undefined, -1, s.buildings.find((b) => b.kind === "tree")?.id]) {
    const before = snap(s);
    assert(M.startMarketing(s, "ride", 1, target, available));
    assert.equal(snap(s), before);
  }
  b.open = false;
  let before = snap(s);
  assert(M.startMarketing(s, "ride", 1, b.id));
  assert.equal(snap(s), before);
  b.open = true;
  b.tested = false;
  assert(M.startMarketing(s, "ride", 1, b.id));
  b.tested = true;
  before = snap(s);
  assert(M.startMarketing(s, "ride", 1, b.id, () => false));
  assert.equal(snap(s), before);
  start(s, "ride", 1, b.id);
});
test("Cancelled/expired campaigns lose effects without refund and allow next same type", () => {
  const { s } = fixture(),
    c = start(s);
  const cash = s.cash;
  assert(M.marketingEffects(s).entryMultiplier > 1);
  assert.equal(M.cancelMarketing(s, c.id), null);
  assert.equal(s.cash, cash);
  assert.equal(M.campaignStatus(s, c), "cancelled");
  assert.equal(M.marketingEffects(s).entryMultiplier, 1);
  const before = snap(s);
  assert(M.cancelMarketing(s, c.id));
  assert.equal(snap(s), before);
  const next = start(s);
  s.time = next.endsAt;
  assert.equal(M.campaignStatus(s, next), "finished");
  assert.equal(M.marketingEffects(s).spawnMultiplier, 1);
  start(s);
  assert(M.validMarketing(s));
});
test("Pause/save/resume uses game time only; exact end time expires", () => {
  const { s } = fixture(),
    c = start(s, "park", 2);
  s.time += 25;
  const saved = JSON.parse(snap(s));
  assert(M.validMarketing(saved));
  assert.deepEqual(M.marketingEffects(saved), M.marketingEffects(s));
  assert.equal(c.endsAt - s.time, 155);
  for (let i = 0; i < 10; i++) M.marketingEffects(s);
  assert.equal(c.endsAt - s.time, 155);
  saved.time = c.endsAt - 0.0001;
  assert.equal(M.campaignStatus(saved, c), "active");
  saved.time = c.endsAt;
  assert.equal(M.campaignStatus(saved, c), "finished");
});
test("Effects never revive zero demand; park closure and lost ride access suppress promotion", () => {
  const { s, b } = fixture();
  start(s, "ride", 1, b.id);
  assert(M.marketingEffects(s, available).entryMultiplier > 1);
  assert.equal(M.marketingDemand(s, 0, available), 0);
  assert.equal(M.marketingDemand(s, 0.9, available), 1);
  assert.equal(M.marketingEffects(s, () => false).entryMultiplier, 1);
  s.open = false;
  assert.equal(M.marketingEffects(s, available).spawnMultiplier, 1);
});
test("Guest source is exactly one campaign and attribution is idempotent including organic guests", () => {
  const { s } = fixture(),
    a = start(s),
    b = start(s, "park");
  const g0 = guest(s);
  assert.equal(M.attributeMarketingGuest(s, g0, 0), null);
  assert.equal(M.attributeMarketingGuest(s, g0, 0.999), null);
  const g1 = assigned(s, 0.6),
    g2 = assigned(s, 0.999);
  assert.notEqual(g1.campaignId, g2.campaignId);
  const before = snap(s.marketing);
  assert.equal(M.attributeMarketingGuest(s, g1, 0), g1.campaignId);
  assert.equal(snap(s.marketing), before);
  assert.equal(a.visitors + b.visitors, 2);
  assert(M.validMarketing(s));
  return { organic: g0.campaignId, attributed: [g1.campaignId, g2.campaignId] };
});
test("Actual ticket/ride/shop payments credited after end/cancel without touching park money", () => {
  const { s } = fixture(),
    c = start(s),
    g = assigned(s),
    cash = s.cash;
  M.recordMarketingRevenue(s, g, 12, "ticket");
  s.time = c.endsAt;
  M.recordMarketingRevenue(s, g, 8, "ride");
  M.recordMarketingRevenue(s, g, 6, "shop");
  M.recordMarketingRevenue(s, g, -100, "ride");
  M.recordMarketingRevenue(s, g, NaN, "shop");
  assert.deepEqual(c.revenue, { ticket: 12, ride: 8, shop: 6 });
  assert.equal(s.cash, cash);
  assert.deepEqual(M.marketingReport(c), {
    visitors: 1,
    cost: 90,
    costPerVisitor: 90,
    attributedRevenue: 26,
    ticket: 12,
    ride: 8,
    shop: 6,
  });
  assert(M.validMarketing(s));
});
test("No-source visitors and failed service produce no campaign revenue", () => {
  const { s } = fixture(),
    c = start(s),
    g = guest(s);
  M.attributeMarketingGuest(s, g, 0);
  M.recordMarketingRevenue(s, g, 8, "ride");
  assert.equal(M.marketingReport(c).attributedRevenue, 0);
  assert.equal(M.marketingReport(c).costPerVisitor, null);
});
test("Ride preference belongs to the assigned guest, requires access, and stops after first visit", () => {
  const { s, b } = fixture();
  start(s, "ride", 1, b.id);
  const g = assigned(s),
    organic = guest(s);
  assert.equal(M.marketingRideBonus(s, b, g, available), 2);
  assert.equal(M.marketingRideBonus(s, b, organic, available), 0);
  assert.equal(
    M.marketingRideBonus(s, b, g, () => false),
    0,
  );
  g.visited = [b.id];
  assert.equal(M.marketingRideBonus(s, b, g, available), 0);
});
test("Deleted historical target is saveable; active missing target has no effect", () => {
  const { s, b } = fixture();
  start(s, "ride", 1, b.id);
  s.buildings = s.buildings.filter((x) => x !== b);
  assert(M.validMarketing(s));
  assert.equal(M.marketingEffects(s).entryMultiplier, 1);
});
test("Invalid saved counters, IDs, duration, campaign sources and active limits rejected", () => {
  const { s, b } = fixture();
  start(s);
  const g = assigned(s);
  for (const mutate of [
    (x) => (x.marketing.campaigns[0].cost = 1),
    (x) => (x.marketing.campaigns[0].revenue.ticket = NaN),
    (x) => (x.marketing.campaigns[0].endsAt += 1),
    (x) => (x.marketing.campaigns[0].days = 4),
    (x) => (x.marketing.nextId = 1),
    (x) => (x.guests[0].campaignId = 999),
    (x) => (x.marketing.campaigns[0].visitors = 0),
    (x) => x.marketing.campaigns.push({ ...x.marketing.campaigns[0], id: 2 }),
    (x) => (x.marketing.campaigns[0].targetId = b.id),
  ]) {
    const bad = clone(s);
    mutate(bad);
    assert.equal(M.validMarketing(bad), false);
  }
  assert(M.validMarketing(s));
});
test("Bounded reports archive totals and retain IDs needed by guests after expiration", () => {
  const { s } = fixture(),
    first = start(s),
    g = assigned(s);
  M.recordMarketingRevenue(s, g, 8, "ticket");
  s.time = first.endsAt;
  for (let i = 0; i < 90; i++) {
    s.cash = 1e6;
    const c = start(s);
    s.time = c.endsAt;
  }
  assert(s.marketing.campaigns.length <= 65);
  assert(s.marketing.campaigns.some((c) => c.id === first.id));
  M.recordMarketingRevenue(s, g, 7, "shop");
  let totals = M.marketingTotals(s);
  assert.equal(totals.cost, 91 * 90);
  assert.equal(totals.visitors, 1);
  assert.equal(totals.revenue.ticket + totals.revenue.shop, 15);
  s.guests = [];
  s.cash = 1e6;
  start(s);
  assert(!s.marketing.campaigns.some((c) => c.id === first.id));
  totals = M.marketingTotals(s);
  assert.equal(totals.cost, 92 * 90);
  assert.equal(totals.visitors, 1);
  assert.equal(totals.revenue.shop, 7);
  assert(M.validMarketing(s));
  return { kept: s.marketing.campaigns.length, archived: s.marketing.archivedTotals.cost };
});
console.log(`${tests.filter((t) => t.pass).length}/${tests.length} passed`);
process.exitCode = tests.every((t) => t.pass) ? 0 : 1;

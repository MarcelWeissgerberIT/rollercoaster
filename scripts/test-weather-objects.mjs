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
const W = await import(moduleURL("game/weather-comfort.ts"));
const O = await import(moduleURL("game/weather-objects.ts"));
const M = await import(moduleURL("game/weather-object-model.ts"));
const close = (a, b) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

for (const kind of ["shelter", "parasol", "fountain"]) {
  test(`${kind}: build, save, physical details and protected amenity`, () => {
    const s = fixture(),
      b = build(s, kind);
    assert(S.validSave(s));
    assert(S.access(s, b));
    assert.equal(S.canAutoClear(kind), false);
    const faces = O.weatherFaces(kind);
    assert(faces.length > 25);
    assert(faces.every((f) => f.points.every((p) => p.every(Number.isFinite))));
    const model = M.createWeatherObjectModel(b);
    assert(model.children.length >= faces.length);
    assert.equal(model.position.x, b.x * 5);
    if (kind !== "fountain") assert(L.AMENITIES[kind].seats >= 2);
    model.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
  });
}
test("Rain protection only applies when actually resting under a roof", () => {
  const s = fixture(),
    b = build(s, "shelter"),
    g = guest(s, { energy: 90 });
  const rain = { rain: 1, heat: 0 };
  assert.equal(W.guestWeatherComfort(s, g, rain).rainProtection, 0);
  g.target = b.id;
  g.state = "rest";
  g.rest = { slot: 0, remaining: 10 };
  assert.equal(W.guestWeatherComfort(s, g, rain).rainProtection, 1);
  assert(Math.abs(W.guestWeatherComfort(s, g, rain).moodPerSecond) < 1e-8);
  b.open = false;
  assert.equal(W.guestWeatherComfort(s, g, rain).rainProtection, 0);
});
test("Hot guests benefit from an occupied shade seat, not a distant tree", () => {
  const s = fixture(),
    b = build(s, "parasol"),
    g = guest(s, { energy: 90 }),
    heat = { rain: 0, heat: 1 };
  const exposed = W.guestWeatherComfort(s, g, heat);
  assert(exposed.extraThirst > 0);
  g.target = b.id;
  g.state = "rest";
  g.rest = { slot: 0, remaining: 10 };
  assert.equal(W.guestWeatherComfort(s, g, heat).extraThirst, 0);
  assert(W.seeksWeatherSeat(b, g, heat));
  g.visited = [b.id];
  assert(!W.seeksWeatherSeat(b, g, heat));
});
test("Energetic guests select shelter during actual rain and freeze on pause", () => {
  const s = fixture(),
    b = build(s, "shelter"),
    g = guest(s, { energy: 95 });
  s.time = 170;
  S.tick(s, 0.1);
  assert.equal(g.target, b.id);
  assert(g.rest);
  assert.match(g.thought, /trocken|Dach/);
  s.speed = 0;
  const before = structuredClone(s);
  S.tick(s, 30);
  assert.deepEqual(s, before);
});
test("Fountain is a real free service with one completed drink", () => {
  const s = fixture(),
    b = build(s, "fountain"),
    g = guest(s, { state: "ride", target: b.id, thirst: 95, servicePrice: 0 });
  b.riders = [g.id];
  b.cycle = 0.01;
  const money = s.cash,
    wallet = g.wallet;
  S.tick(s, 0.25);
  assert.equal(b.served, 1);
  assert.equal(b.revenue, 0);
  assert.equal(g.wallet, wallet);
  assert.equal(s.cash, money);
  assert.equal(g.food?.kind, "fountain");
  assert(g.thirst < 1);
  assert(S.validSave(s));
});
const failures = results.filter((r) => !r.pass);
console.log(`${results.length - failures.length}/${results.length} weather object tests passed`);
if (failures.length) process.exitCode = 1;

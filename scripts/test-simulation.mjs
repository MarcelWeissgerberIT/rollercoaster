import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
const output = ts.transpileModule(
  fs.readFileSync(new URL("../game/simulation.ts", import.meta.url), "utf8"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
).outputText;
const M = await import("data:text/javascript;base64," + Buffer.from(output).toString("base64"));
Math.random = () => 0.5;
const json = (v) => JSON.parse(JSON.stringify(v));
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log("PASS", name);
  } catch (e) {
    failed++;
    console.error("FAIL", name, e.message);
  }
}
function free(s) {
  for (let y = 0; y < M.SIZE; y++)
    for (let x = 0; x < M.SIZE; x++)
      if (s.tiles[y][x] === "grass" && !M.occupant(s, x, y)) return { x, y };
  throw Error("No free tile");
}
function at(s, b, n) {
  const p = M.access(s, b);
  return Array.from({ length: n }, (_, i) => ({
    ...json(s.guests[0]),
    id: 1000 + i,
    x: p.x,
    y: p.y,
    route: [],
    target: b.id,
    state: "walk",
    timer: 0,
  }));
}
test("Starter park has three working rides and a closed circuit", () => {
  const s = M.newPark();
  assert.equal(s.cash, 16000);
  const rides = s.buildings.filter((b) => M.isRide(b.kind));
  assert.equal(rides.length, 3);
  for (const b of rides) assert(b.open && b.tested && M.access(s, b));
  const b = rides.find((b) => b.kind === "coaster");
  assert.deepEqual(b.track[0], b.track.at(-1));
});
test("Overlap and lack of funds prevent construction without a charge", () => {
  const s = M.newPark(),
    b = s.buildings[0],
    cash = s.cash;
  assert(M.build(s, "tree", b.x, b.y).error);
  assert.equal(s.cash, cash);
  const p = free(s);
  assert.equal(M.paint(s, p.x, p.y, "path"), null);
  assert.equal(s.cash, cash - 12);
  s.cash = 0;
  const q = free(s);
  assert(M.build(s, "tree", q.x, q.y).error);
  assert.equal(M.occupant(s, q.x, q.y), undefined);
});
test("Queue limit and one payment per boarding", () => {
  const s = M.newPark(),
    b = s.buildings.find((b) => b.kind === "carousel");
  s.open = false;
  s.guests = at(s, b, 10);
  const cash = s.cash;
  M.tick(s, 0.01);
  assert.equal(b.queue.length, 8);
  M.tick(s, 0.01);
  assert.equal(b.riders.length, 6);
  assert.equal(b.queue.length, 2);
  assert.equal(s.cash - cash, 30);
  M.tick(s, 0.01);
  assert.equal(s.cash - cash, 30);
});
test("Disconnected rides stop accepting passengers", () => {
  const s = M.newPark(),
    b = s.buildings.find((b) => b.kind === "carousel");
  s.open = false;
  s.guests = at(s, b, 8);
  M.tick(s, 0.01);
  M.tick(s, 0.01);
  M.remove(s, 8, 18);
  const cash = s.cash;
  M.tick(s, 0.01);
  assert.equal(M.access(s, b), undefined);
  assert.equal(b.riders.length + b.queue.length, 0);
  assert.equal(s.cash, cash);
});
test("Daily profit includes construction and running costs", () => {
  const s = M.newPark();
  s.open = false;
  s.guests = [];
  const cash = s.cash,
    p = free(s);
  M.paint(s, p.x, p.y, "path");
  M.tick(s, 90);
  assert.equal(s.lastProfit, s.cash - cash);
});
test("Scenario completion requires a tested fourth coaster", () => {
  const s = M.newPark();
  const track = [
    [8, 20, 0],
    [9, 20, 1],
    [10, 20, 1],
    [10, 21, 1],
    [10, 22, 1],
    [9, 22, 1],
    [8, 22, 0],
    [8, 21, 0],
    [8, 20, 0],
  ].map(([x, y, z]) => ({ x, y, z }));
  for (const p of [...track, { x: 8, y: 19 }]) if (M.occupant(s, p.x, p.y)) M.remove(s, p.x, p.y);
  const { id } = M.build(s, "coaster", 8, 20, track);
  assert(id);
  M.paint(s, 8, 19, "queue");
  const b = s.buildings.find((b) => b.id === id);
  b.open = true;
  s.open = false;
  s.arrivals = 150;
  s.guests.forEach((g) => {
    g.happiness = 90;
    g.timer = 99;
  });
  M.tick(s, 0.01);
  assert.equal(s.won, false);
  b.tested = true;
  M.tick(s, 0.01);
  assert(s.won);
});
test("Malformed saved data is rejected without throwing", () => {
  const s = M.newPark();
  assert(M.validSave(json(s)));
  const a = json(s);
  delete a.buildings[0].queue;
  assert.equal(M.validSave(a), false);
  const b = json(s);
  b.buildings = [null];
  assert.doesNotThrow(() => M.validSave(b));
  assert.equal(M.validSave(b), false);
  const c = json(s);
  c.guests = [{}];
  assert.equal(M.validSave(c), false);
});
test("Pause and save/resume preserve simulation state", () => {
  const s = M.newPark();
  s.speed = 0;
  const before = json(s);
  M.tick(s, 30);
  assert.deepEqual(json(s), before);
  s.speed = 1;
  const resumed = json(s);
  for (let i = 0; i < 100; i++) {
    M.tick(s, 0.1);
    M.tick(resumed, 0.1);
  }
  assert.deepEqual(json(s), json(resumed));
});
test("Queue entrances work in the center of a large ride edge", () => {
  const s = M.newPark(),
    b = s.buildings.find((b) => b.kind === "wheel");
  s.tiles[16][20] = "grass";
  s.tiles[17][20] = "grass";
  s.tiles[16][21] = "queue";
  s.tiles[17][21] = "queue";
  assert.deepEqual(M.access(s, b), { x: 21, y: 16 });
});
test("Test drives take simulation time and respect pause", () => {
  const s = M.newPark(),
    b = s.buildings.find((b) => b.kind === "coaster");
  b.open = false;
  b.tested = false;
  b.testing = 8;
  s.speed = 0;
  M.tick(s, 20);
  assert.equal(b.testing, 8);
  s.speed = 1;
  M.tick(s, 4);
  assert.equal(b.tested, false);
  M.tick(s, 4);
  assert.equal(b.tested, true);
});
test("Demolition refunds are included in daily profit", () => {
  const s = M.newPark();
  s.open = false;
  s.guests = [];
  const cash = s.cash;
  const b = s.buildings.find((b) => b.kind === "carousel");
  M.remove(s, b.x, b.y);
  M.tick(s, 90);
  assert.equal(s.lastProfit, s.cash - cash);
});
test("Guests released after a long queue resume immediately", () => {
  for (const demolish of [false, true]) {
    const s = M.newPark();
    s.open = false;
    const b = s.buildings.find((b) => b.kind === "carousel");
    s.guests = at(s, b, 1);
    const g = s.guests[0];
    g.state = "queue";
    g.timer = 60;
    b.queue = [g.id];
    if (demolish) M.remove(s, b.x, b.y);
    else b.open = false;
    M.tick(s, 0.01);
    assert(["walk", "leave"].includes(g.state));
    assert(g.timer < 1);
  }
});
test("Changing the queue entrance reroutes an approaching guest", () => {
  const s = M.newPark();
  s.open = false;
  const b = s.buildings.find((b) => b.kind === "carousel");
  s.guests = at(s, b, 1);
  const g = s.guests[0];
  s.tiles[16][8] = "path";
  s.tiles[15][7] = "queue";
  s.tiles[16][7] = "queue";
  M.tick(s, 0.01);
  assert.equal(g.state, "walk");
  assert.equal(b.queue.length, 0);
  assert(g.route.length > 0);
});
test("Empty parks retain their last known guest satisfaction", () => {
  const s = M.newPark();
  s.open = false;
  s.guests = [];
  const rating = s.rating;
  M.tick(s, 2);
  assert.equal(s.rating, rating);
});
test("The entrance cannot be painted into an inaccessible pond", () => {
  const s = M.newPark();
  const cash = s.cash;
  assert(M.paint(s, M.ENTRANCE.x, M.ENTRANCE.y, "water"));
  assert.equal(s.cash, cash);
  assert.equal(s.tiles[M.ENTRANCE.y][M.ENTRANCE.x], "path");
});
test("Invalid test-drive timers are rejected on restore", () => {
  const s = json(M.newPark());
  s.buildings[0].testing = "bad";
  assert.equal(M.validSave(s), false);
});
test("A running park remains serializable across twenty game days", () => {
  const s = M.newPark();
  for (let i = 0; i < 20; i++) {
    M.tick(s, 90);
    assert(M.validSave(json(s)));
    assert(Number.isFinite(s.cash));
    assert(s.guests.length <= 220);
  }
  assert(s.income > 0);
  assert(s.buildings.some((b) => b.served > 0));
});
process.exitCode = failed ? 1 : 0;

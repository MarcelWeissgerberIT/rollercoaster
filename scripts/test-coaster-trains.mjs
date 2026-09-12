import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const T = await import(moduleURL("game/coaster-trains.ts"));
const M = await import(moduleURL("game/motion.ts"));
let passed = 0;
function test(name, run) {
  try {
    run();
    passed++;
    console.log("PASS", name);
  } catch (e) {
    console.error("FAIL", name, e);
    process.exit(1);
  }
}
function fixture(count = 3, cars = 2) {
  const track = Array.from({ length: 81 }, (_, i) => ({
    x: 15 + 12 * Math.sin((i * Math.PI) / 40),
    y: 15 + 12 * Math.cos((i * Math.PI) / 40),
    z: 0,
    smooth: true,
    style: "steel",
  }));
  const b = {
    id: 1,
    kind: "coaster",
    track,
    x: 15,
    y: 27,
    open: true,
    tested: true,
    queue: [],
    riders: [],
    cycle: 0,
    price: 5,
    served: 0,
    revenue: 0,
    operations: { staffed: true, rounds: 1, remainingRounds: 0, phase: "idle", phaseLeft: 0 },
  };
  const config = { count, cars, minWait: 2, maxWait: 6, minLoad: 100, blocks: count + 2 };
  assert.equal(T.setCoasterTrainProgram(b, config), null);
  let id = 10,
    charged = 0,
    released = 0,
    ready = true,
    exitClear = true;
  const guests = [];
  const options = {
    get ready() {
      return ready;
    },
    get exitClear() {
      return exitClear;
    },
    rounds: 1,
    board() {
      if (id >= 90) return null;
      const g = { id: id++, state: "ride", target: 1 };
      guests.push(g);
      charged++;
      return g.id;
    },
    release(id) {
      const g = guests.find((g) => g.id === id);
      g.state = "walk";
      g.target = null;
      released++;
    },
  };
  return {
    b,
    guests,
    options,
    step(dt = 0.05) {
      T.tickCoasterTrains(b, dt, options);
    },
    get charged() {
      return charged;
    },
    get released() {
      return released;
    },
    set ready(v) {
      ready = v;
    },
    set exitClear(v) {
      exitClear = v;
    },
  };
}
test("Three trains carry separate rosters, preserve tail blocks and finish visits", () => {
  const f = fixture();
  let concurrent = false,
    blocked = false;
  for (let i = 0; i < 12000; i++) {
    f.step();
    if (f.b.trainFleet.trains.filter((t) => t.riders.length).length > 1) concurrent = true;
    if (f.b.trainFleet.trains.some((t) => t.phase === "blocked")) blocked = true;
    assert(T.validCoasterFleets({ buildings: [f.b], guests: f.guests }), `invalid at ${i}`);
  }
  assert(concurrent);
  assert(blocked);
  assert(f.released > 20);
  assert.equal(f.charged - f.released, f.b.riders.length);
});
test("Two rounds charge once, release once after the final lap", () => {
  const f = fixture(1, 1);
  f.options.rounds = 2;
  for (let i = 0; i < 4000 && f.released === 0; i++) f.step();
  assert(f.released > 0);
  assert.equal(f.charged, 2);
  assert.equal(f.b.trainFleet.trains[0].completed, 2);
});
test("Maximum waiting dispatches below minimum fill", () => {
  const f = fixture(1, 4);
  let available = true;
  f.options.board = () => {
    if (!available) return null;
    available = false;
    return 10;
  };
  for (let i = 0; i < 170; i++) f.step();
  assert.equal(f.b.trainFleet.trains[0].phase, "running");
  assert.deepEqual(f.b.riders, [10]);
});
test("Shared exits interlock boarding and dispatch", () => {
  const f = fixture();
  f.exitClear = false;
  f.step(10);
  assert.equal(f.charged, 0);
  f.exitClear = true;
  f.step(4);
  assert(f.charged > 0);
});
test("Pause is exact; JSON save resumes the same train positions", () => {
  const f = fixture();
  f.step(20);
  const saved = JSON.stringify(f.b);
  f.step(0);
  assert.equal(JSON.stringify(f.b), saved);
  const copy = JSON.parse(saved);
  assert(T.validCoasterFleets({ buildings: [copy], guests: f.guests }));
  T.tickCoasterTrains(copy, 0.03, { ...f.options, board: () => null, release: () => {} });
  T.tickCoasterTrains(f.b, 0.03, { ...f.options, board: () => null, release: () => {} });
  assert.deepEqual(copy.trainFleet, f.b.trainFleet);
});
test("Closing drains trains at the station instead of teleporting guests", () => {
  const f = fixture();
  f.step(30);
  const before = f.b.trainFleet.trains.filter((t) => t.riders.length).length;
  assert(before > 0);
  f.ready = false;
  for (let i = 0; i < 10000 && f.b.riders.length; i++) f.step();
  assert.equal(f.b.riders.length, 0);
  assert.equal(f.charged, f.released);
});
test("Invalid overlapping trains and duplicate guest occupancy reject save", () => {
  const f = fixture();
  f.b.trainFleet.trains[1].distance = 0;
  assert(!T.validCoasterFleets({ buildings: [f.b], guests: [] }));
});
test("Impossible programs are atomic and give a useful explanation", () => {
  const f = fixture();
  const old = JSON.stringify(f.b);
  assert.match(
    T.setCoasterTrainProgram(f.b, { ...f.b.trainFleet.program, cars: 8, blocks: 16 }),
    /zu kurz/,
  );
  assert.equal(JSON.stringify(f.b), old);
  f.b.riders = [7];
  assert.match(T.setCoasterTrainProgram(f.b, f.b.trainFleet.program), /aussteigen/);
});
test("Legacy train without fleet still uses its existing physical route and riders", () => {
  const f = fixture();
  delete f.b.trainFleet;
  f.b.riders = [10, 11];
  f.b.cycle = M.prepareRoute(f.b.track).duration / 2;
  const v = T.coasterTrainVisuals(f.b, 12);
  assert.equal(v.length, 1);
  assert.equal(v[0].cars, 6);
  assert.deepEqual(v[0].riders, [10, 11]);
  assert(v[0].distance > 0);
});
console.log(`${passed} coaster train tests passed`);

import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  O = await import(moduleURL("game/operations.ts")),
  F = await import(moduleURL("game/staff.ts")),
  A = await import(moduleURL("game/ride-access.ts")),
  P = await import(moduleURL("game/pods.ts"));
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("PASS", name);
}
const near = (a, b) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const point = (p) => ({ x: p.x, y: p.y });
function fixture() {
  const s = S.newPark("sandbox"),
    b = s.buildings.find((b) => b.kind === "wheel");
  s.tiles = Array.from({ length: 36 }, () => Array(36).fill("grass"));
  s.buildings = [b];
  s.crewPool.crews = s.crewPool.crews.filter((crew) => crew.buildingId === b.id);
  s.guests = [];
  s.open = false;
  s.staff = 0;
  s.zoo = undefined;
  s.cleanliness = undefined;
  s.transitLines = [];
  s.speed = 1;
  b.x = 10;
  b.y = 10;
  b.pods = { entry: { side: 0, offset: 1 }, exit: { side: 2, offset: 1 } };
  b.riders = [];
  b.queue = [];
  b.cycle = 0;
  b.open = b.tested = true;
  O.resetRideOperations(b);
  return { s, b };
}
function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
const location = (s, b, post) => F.staffLocation(s, { kind: "operator", id: b.id, post });

test("One assignment creates three stable people while wages and dispatch remain per crew", () => {
  const { s, b } = fixture(),
    cash = s.cash;
  delete b.operations;
  const crew = O.rideCrew(b);
  assert.deepEqual(
    crew.map((w) => w.post),
    O.OPERATOR_POSTS,
  );
  assert.equal(new Set(crew.map((w) => w.id)).size, 3);
  assert.equal(new Set(crew.map((w) => w.name)).size, 3);
  assert(crew.every((w) => w.buildingId === b.id));
  assert.equal(b.operations, undefined, "Reading an old save must not initialize it");
  const stats = O.operationsStats(s);
  assert.equal(stats.crewCount, 1);
  assert.equal(stats.personCount, 3);
  assert.equal(stats.staffed, 1);
  assert.equal(stats.dailyCost, 70);
  assert.equal(O.operatorWages(s), 70);
  assert.equal(s.cash, cash);
  assert.deepEqual(location(s, b), location(s, b, "control"));
  assert.equal(O.setRideStaffed(b, false), null);
  assert.deepEqual(O.rideCrew(b), []);
  for (const post of O.OPERATOR_POSTS) assert.equal(location(s, b, post), null);
  assert.equal(O.operationsStats(s).staffed, 0);
  assert.equal(O.operationsStats(s).availableCrews, 1);
  assert.equal(O.operationsStats(s).personCount, 3);
  assert.equal(O.operatorWages(s), 70, "Releasing an assignment keeps the real crew on payroll");
  assert.equal(O.setRideStaffed(b, true), null);
  assert.deepEqual(
    O.rideCrew(b).map((w) => [w.id, w.name]),
    crew.map((w) => [w.id, w.name]),
  );
  assert.equal(location(s, b, "unknown"), null);
});

test("Every pod orientation keeps cabin outside the ride and crew outside the central passage", () => {
  const { s, b } = fixture(),
    size = S.CATALOG[b.kind].size;
  for (let side = 0; side < 4; side++)
    for (let offset = 0; offset < size; offset++) {
      b.pods = { entry: { side, offset }, exit: { side: (side + 2) % 4, offset } };
      const layout = A.accessLayout(s, b),
        { entry, exit, cabin, posts } = layout,
        outward = (cabin.x - entry.x) * entry.dx + (cabin.y - entry.y) * entry.dy,
        lateral = (cabin.x - entry.x) * entry.tx + (cabin.y - entry.y) * entry.ty;
      assert.deepEqual(entry.port, P.podPort(b, size, b.pods.entry));
      assert.deepEqual(exit.port, P.podPort(b, size, b.pods.exit));
      assert(outward - cabin.depth / 2 > 0.18, "Cabin overlaps the ride footprint");
      assert(Math.abs(lateral) - cabin.width / 2 > 0.45, "Cabin blocks the entrance passage");
      for (const role of ["entry", "exit"]) {
        const gate = layout[role],
          post = posts[role];
        assert(Math.abs((post.x - gate.x) * gate.tx + (post.y - gate.y) * gate.ty) >= 0.45);
        assert.deepEqual(point(location(s, b, role)), point(post));
      }
      assert.deepEqual(point(location(s, b)), point(cabin));
      near(posts.control.dx, cabin.dx);
      near(posts.control.dy, cabin.dy);
      for (const pose of [entry, exit, cabin, ...Object.values(posts)])
        assert([pose.x, pose.y, pose.dx, pose.dy].every(Number.isFinite));
    }
});

test("Automatic cabin placement prefers free ground over another building, path, water or track", () => {
  for (const obstruction of ["building", "path", "water", "track"]) {
    const { s, b } = fixture(),
      original = A.accessLayout(s, b),
      baseline = original.cabin,
      sign = Math.sign(
        (baseline.x - original.entry.x) * original.entry.tx +
          (baseline.y - original.entry.y) * original.entry.ty,
      );
    if (obstruction === "building")
      s.buildings.push({
        ...b,
        id: 999,
        kind: "bin",
        x: Math.round(baseline.x),
        y: Math.round(baseline.y),
        pods: undefined,
      });
    else if (obstruction === "track")
      b.track = [
        { x: baseline.x - 1, y: baseline.y },
        { x: baseline.x + 1, y: baseline.y },
      ];
    else s.tiles[Math.round(baseline.y)][Math.round(baseline.x)] = obstruction;
    const next = A.accessLayout(s, b),
      nextSign = Math.sign(
        (next.cabin.x - next.entry.x) * next.entry.tx +
          (next.cabin.y - next.entry.y) * next.entry.ty,
      );
    assert.equal(nextSign, -sign, `${obstruction} should cause the free cabin side to be chosen`);
  }
});

test("Cabin selection uses the in-bounds tangent at both map edges", () => {
  for (const x of [0, 33]) {
    const { s, b } = fixture();
    b.x = x;
    b.pods = { entry: { side: 3, offset: x === 0 ? 0 : 2 }, exit: { side: 1, offset: 1 } };
    const { cabin } = A.accessLayout(s, b);
    assert(cabin.x - cabin.width / 2 >= -0.5);
    assert(cabin.x + cabin.width / 2 <= 35.5);
    assert(cabin.y - cabin.depth / 2 >= -0.5);
    assert(cabin.y + cabin.depth / 2 <= 35.5);
  }
});

test("Entry gate opens during actual boarding and closes continuously through checking", () => {
  const { s, b } = fixture();
  b.queue = [777];
  const gate = (time) => A.gateMotion(s, b, "entry", time);
  assert.equal(gate().open, 0);
  O.tickOperations(b, 0.2, true);
  const beginning = gate().open;
  assert(beginning > 0 && beginning < 1);
  O.tickOperations(b, 1.8, true);
  near(gate().open, 1);
  assert.equal(gate().phase, "checking");
  O.tickOperations(b, 0.75, true);
  near(gate().open, 0.5);
  assert.deepEqual(
    gate(0),
    gate(100000),
    "Wall time must not drive gates independently of operations",
  );
  assert(O.tickOperations(b, 0.75, true));
  near(gate().open, 0);
  b.riders = [777];
  b.queue = [];
  O.startRideProgram(b);
  assert.equal(gate().open, 0);
  assert.equal(gate().progress, gate().open);
});

test("Attendants return to their own posts at every phase boundary while driver stays in cabin", () => {
  const { s, b } = fixture(),
    home = Object.fromEntries(O.OPERATOR_POSTS.map((p) => [p, location(s, b, p)]));
  for (const [post, phase, duration] of [
    ["entry", "boarding", 2],
    ["entry", "checking", 1.5],
    ["exit", "unloading", 1.2],
  ]) {
    const o = O.ensureOperations(b);
    o.phase = phase;
    const samples = [];
    for (const progress of [0, 0.1, 0.2, 0.5, 0.8, 0.9, 1]) {
      o.phaseLeft = duration * (1 - progress);
      const loc = location(s, b, post);
      samples.push(loc);
      near(location(s, b).x, home.control.x);
      near(location(s, b).y, home.control.y);
      assert.equal(location(s, b).walking, false);
      assert(Math.hypot(loc.x - home[post].x, loc.y - home[post].y) <= 0.120001);
    }
    assert.deepEqual(point(samples[0]), point(home[post]));
    assert.deepEqual(point(samples.at(-1)), point(home[post]));
    assert(samples[1].walking);
    assert(!samples[3].walking);
    assert(samples[5].walking);
    near(samples[1].dx, -samples[5].dx);
    near(samples[1].dy, -samples[5].dy);
  }
  assert.equal(O.programDuration(b, 24), 28.7);
});

test("Real unloaded guests keep the exit open beyond the unload timer, then close it by walking away", () => {
  const { s, b } = fixture(),
    template = S.newPark("sandbox").guests[0];
  for (let y = 9; y < 36; y++) {
    s.tiles[y][9] = "path";
    s.tiles[y][13] = "path";
  }
  for (let x = 9; x <= 15; x++) s.tiles[29][x] = "path";
  const entry = S.access(s, b),
    exit = S.exitPath(s, b)[0];
  assert(entry && exit);
  assert.notDeepEqual(entry, exit);
  const g = {
    ...structuredClone(template),
    id: 800,
    ...entry,
    state: "ride",
    target: b.id,
    route: [],
    timer: 0,
    visited: [],
    rides: 0,
    party: undefined,
    hunger: 0,
    thirst: 0,
    bladder: 0,
    energy: 100,
    wallet: 100,
    waste: [],
    food: undefined,
  };
  s.guests = [g];
  b.riders = [g.id];
  b.cycle = 0.01;
  O.startRideProgram(b);
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    S.tick(s, 0.05);
    assert.equal(g.state, "walk");
    assert.equal(g.visited.at(-1), b.id);
    assert.deepEqual(point(g), exit);
    for (let i = 0; i < 13; i++) S.tick(s, 0.1);
    assert.equal(b.operations.phase, "idle");
    assert(g.timer > 0);
    assert.equal(A.gateMotion(s, b, "exit").open, 1);
    assert.equal(A.gateMotion(s, b, "exit").activeGuests, 1);
    assert.equal(location(s, b, "exit").activity, "unloading");
    // The simulation resumes the real guest's outward route after their waiting timer.
    g.route = [
      { x: exit.x, y: exit.y + 1 },
      { x: exit.x, y: exit.y + 2 },
    ];
    let sawClosing = false;
    for (let i = 0; i < 40; i++) {
      S.tick(s, 0.1);
      const opening = A.gateMotion(s, b, "exit").open;
      if (opening > 0 && opening < 1) sawClosing = true;
      if (Math.hypot(g.x - exit.x, g.y - exit.y) > 1.6) break;
    }
    assert(sawClosing, "Gate snapped shut before the departing person cleared it");
    assert.equal(A.gateMotion(s, b, "exit").open, 0);
  } finally {
    Math.random = random;
  }
});

test("Passers-by, queued and riding guests cannot pretend to be discharged passengers", () => {
  const { s, b } = fixture(),
    exit = A.accessLayout(s, b).exit.port;
  s.guests = [
    { id: 10, ...exit, state: "walk", target: null, visited: [999] },
    { id: 11, ...exit, state: "queue", target: b.id, visited: [b.id] },
    { id: 12, ...exit, state: "ride", target: b.id, visited: [b.id] },
    { id: 13, ...exit, state: "walk", target: 999, visited: [b.id] },
  ];
  assert.equal(A.gateMotion(s, b, "exit").open, 0);
  assert.equal(A.gateMotion(s, b, "exit").activeGuests, 0);
  b.queue = [11, 888];
  assert.equal(
    A.gateMotion(s, b, "entry").activeGuests,
    1,
    "Stale queue IDs are not live visitors",
  );
});

test("Crew, layout and gate reads preserve paused and old save state and return detached geometry", () => {
  const { s, b } = fixture();
  b.queue = [777];
  O.tickOperations(b, 0.1, true);
  s.speed = 0;
  const before = JSON.stringify(s),
    pose = location(s, b, "entry"),
    gate = A.gateMotion(s, b, "entry");
  S.tick(s, 3);
  assert.equal(JSON.stringify(s), before);
  freeze(s);
  const result = A.accessLayout(s, b);
  result.cabin.x = -900;
  assert.notEqual(A.accessLayout(s, b).cabin.x, -900);
  assert.deepEqual(location(s, b, "entry"), pose);
  assert.deepEqual(A.gateMotion(s, b, "entry"), gate);
  assert.equal(JSON.stringify(s), before);
  const resumed = JSON.parse(before);
  assert.deepEqual(A.accessLayout(resumed, resumed.buildings[0]), A.accessLayout(s, b));
  for (const post of O.OPERATOR_POSTS)
    assert.deepEqual(location(resumed, resumed.buildings[0], post), location(s, b, post));
});

test("Scoped cache scans geometry once and still reflects live operation changes", () => {
  const { s, b } = fixture();
  let reads = 0,
    trackX = 20;
  const sample = { y: 20 };
  Object.defineProperty(sample, "x", {
    enumerable: true,
    get() {
      reads++;
      return trackX;
    },
    set(value) {
      trackX = value;
    },
  });
  b.track = [sample, { x: 22, y: 20 }];
  A.withAccessLayoutCache(s, () => {
    const first = A.accessLayout(s, b),
      scanned = reads;
    for (let i = 0; i < 20; i++)
      A.withAccessLayoutCache(s, () => {
        assert.deepEqual(A.accessLayout(s, b), first);
        for (const post of O.OPERATOR_POSTS) location(s, b, post);
        A.gateMotion(s, b, "exit");
      });
    assert.equal(reads, scanned, "Repeated renderer reads rescanned track geometry");
    b.queue = [777];
    O.tickOperations(b, 0.2, true);
    assert(A.gateMotion(s, b, "entry").open > 0);
    assert.equal(location(s, b, "entry").activity, "boarding");
    assert.deepEqual(A.accessLayout(s, b), first);
  });
});

test("Cache invalidates in-place pod, map, track, building and expansion edits, including after throws", () => {
  const { s, b } = fixture(),
    first = A.accessLayout(s, b);
  assert.throws(() =>
    A.withAccessLayoutCache(s, () => {
      throw new Error("render stopped");
    }),
  );
  b.pods.entry.offset = 0;
  const movedPod = A.accessLayout(s, b);
  assert.notDeepEqual(movedPod.entry.port, first.entry.port);
  assert.deepEqual(movedPod.entry.port, P.podPort(b, S.CATALOG[b.kind].size, b.pods.entry));
  const oldX = b.x;
  b.x += 1;
  near(A.accessLayout(s, b).entry.x, movedPod.entry.x + 1);
  b.x = oldX;
  const cabin = A.accessLayout(s, b).cabin;
  s.tiles[Math.round(cabin.y)][Math.round(cabin.x)] = "water";
  assert.notDeepEqual(A.accessLayout(s, b).cabin, cabin);
  s.tiles[Math.round(cabin.y)][Math.round(cabin.x)] = "grass";
  assert.deepEqual(A.accessLayout(s, b).cabin, cabin);
  b.track = [
    { x: cabin.x - 1, y: cabin.y },
    { x: cabin.x + 1, y: cabin.y },
  ];
  assert.notDeepEqual(A.accessLayout(s, b).cabin, cabin);
  b.track[0].y += 20;
  b.track[1].y += 20;
  assert.deepEqual(A.accessLayout(s, b).cabin, cabin);
  s.buildings.push({
    ...b,
    id: 999,
    kind: "bin",
    x: Math.round(cabin.x),
    y: Math.round(cabin.y),
    track: undefined,
  });
  assert.notDeepEqual(A.accessLayout(s, b).cabin, cabin);
  s.buildings.pop();
  s.tiles.push(Array(36).fill("grass"));
  assert.deepEqual(A.accessLayout(s, b).cabin, cabin);
  const clone = structuredClone(s),
    copy = A.accessLayout(clone, clone.buildings[0]);
  clone.buildings[0].pods.entry.side = 1;
  assert.notDeepEqual(A.accessLayout(clone, clone.buildings[0]).entry, copy.entry);
  assert.deepEqual(A.accessLayout(s, b).cabin, cabin, "Preview geometry polluted the live cache");
});

test("Open transport station gateways stay usable without inventing ride crews or boarding phases", () => {
  for (const kind of ["train", "shuttle"]) {
    const { s, b } = fixture();
    b.kind = kind;
    s.crewPool = { version: 1, nextId: 1, crews: [] };
    delete b.operations;
    const before = structuredClone(s);
    for (const role of ["entry", "exit"]) {
      const gate = A.gateMotion(s, b, role);
      assert.equal(gate.open, 1);
      assert.equal(gate.progress, 1);
      assert.equal(gate.phase, "station");
      assert.equal(gate.phaseProgress, 0);
      assert.deepEqual(gate, A.gateMotion(s, b, role, 10000));
    }
    assert.deepEqual(O.rideCrew(b), []);
    assert.equal(O.operatorWages(s), 0);
    assert.equal(location(s, b), null);
    assert.deepEqual(s, before);
    b.open = false;
    for (const role of ["entry", "exit"]) assert.equal(A.gateMotion(s, b, role).open, 0);
    assert.equal(b.operations, undefined);
  }
});

console.log(`${passed} ride access/crew tests passed.`);

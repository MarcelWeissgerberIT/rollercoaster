import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";

const S = await import(moduleURL("game/simulation.ts"));
const A = await import(moduleURL("game/attraction-advisor.ts"));
const E = await import(moduleURL("game/exit-assist.ts"));
const H = await import(moduleURL("game/shared-access.ts"));
const P = await import(moduleURL("game/pods.ts"));
const clone = (value) => structuredClone(value);
let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("PASS", name);
  } catch (error) {
    console.error("FAIL", name, error);
    process.exit(1);
  }
}

// Real connected blue entry, missing eastern exit, idle staffed ride. This is
// deliberately the same small park topology used by the shared-access suite.
function fixture() {
  const s = S.newPark("sandbox");
  s.unlimitedBudget = false;
  s.tiles = Array.from({ length: 30 }, () => Array(30).fill("grass"));
  for (let y = 20; y < 30; y++) s.tiles[y][13] = "path";
  for (let x = 13; x <= 15; x++) s.tiles[29][x] = "path";
  s.tiles[20][14] = s.tiles[20][15] = "queue";
  const b = {
    id: 100,
    kind: "wheel",
    name: "Gemeinsames Panoramarad",
    x: 16,
    y: 20,
    price: 7,
    open: true,
    tested: true,
    served: 0,
    revenue: 0,
    cycle: 0,
    queue: [],
    riders: [],
    pods: { entry: { side: 2, offset: 0 }, exit: { side: 0, offset: 0 } },
    operations: {
      staffed: true,
      crewId: 101,
      assignment: "auto",
      rounds: 1,
      remainingRounds: 0,
      phase: "idle",
      phaseLeft: 0,
    },
  };
  s.buildings = [b];
  s.guests = [];
  s.nextId = 200;
  s.transitLines = [];
  s.crewPool = { version: 1, nextId: 102, crews: [{ id: 101, buildingId: 100, mode: "manual" }] };
  s.cleanliness.workers = [];
  s.cleanliness.litter = [];
  s.zoo.workers = [];
  s.zoo.keepers = 0;
  s.staff = 0;
  s.cash = 50000;
  s.time = 0;
  s.speed = 1;
  s.open = true;
  s.spawnClock = -1000;
  assert(S.validSave(clone(s)));
  assert(S.access(s, b));
  assert.equal(S.exitPath(s, b).length, 0);
  return { s, b };
}
const report = ({ s, b }) => A.attractionAdvice(s, b.id);
const issue = (f, id) => report(f).issues.find((item) => item.id === id);
function enable(f) {
  assert.equal(H.setSharedAccess(f.s, f.b, true), null);
  assert.equal(f.b.sharedAccess, true);
}
const redTiles = (s) => s.tiles.flat().filter((tile) => tile === "exit").length;

test("Missing separate exit offers an explicit shared-space setup tip without changing the park", () => {
  const f = fixture(),
    before = clone(f.s);
  const exit = issue(f, "exit"),
    shared = issue(f, "shared-space");
  assert.equal(exit.action.kind, "connect-exit");
  assert.equal(shared.severity, "tip");
  assert.equal(shared.action.kind, "access");
  assert.match(shared.action.label, /Gemeinsamen Zugang/);
  assert.match(shared.detail, /Rot.*Blau/);
  assert.deepEqual(f.s, before, "Advice only offers setup; it must not switch or construct access");
});

test("Shared mode suppresses separate red exit proposals and contextual exit assistance", () => {
  const f = fixture(),
    blocked = { x: f.b.x, y: f.b.y };
  assert(E.suggestExit(f.s, f.b, false));
  assert.equal(E.exitHelpAt(f.s, blocked, false)?.buildingId, f.b.id);
  enable(f);
  const before = clone(f.s);
  assert.equal(E.suggestExit(f.s, f.b, false), null);
  assert.equal(E.suggestExit(f.s, f.b, true), null);
  assert.equal(E.exitHelpAt(f.s, blocked, false), null);
  assert(!issue(f, "exit"));
  assert(!issue(f, "shared-space"));
  assert(!report(f).issues.some((item) => item.action?.kind === "connect-exit"));
  assert.deepEqual(f.s, before);
});

test("A quoted red exit is rejected atomically after switching to shared access", () => {
  const f = fixture(),
    quote = E.suggestExit(f.s, f.b, false),
    advisor = issue(f, "exit").action;
  assert(quote && quote.points.length && quote.cost > 0);
  enable(f);
  const before = clone(f.s);
  assert.match(E.applyExitSuggestion(f.s, f.b, quote, false), /gemeinsame.*Zugang/);
  assert.deepEqual(
    f.s,
    before,
    "No red tiles, clearing, pod moves or charges from an obsolete quote",
  );
  assert(A.applyAttractionAdvice(f.s, f.b.id, "exit", advisor.id));
  assert.deepEqual(f.s, before, "The advisor must also reject its old exit action");
  assert(S.validSave(clone(f.s)));
});

test("Repairing a disconnected shared entry rebuilds blue access and retains the separate exit", () => {
  const f = fixture();
  enable(f);
  f.s.tiles[20][14] = "grass";
  f.b.open = false;
  assert.equal(S.access(f.s, f.b), undefined);
  const stored = clone(f.b.pods),
    cash = f.s.cash,
    advice = issue(f, "access").action;
  assert.equal(advice.kind, "connect-open");
  assert(advice.cost > 0);
  assert(!issue(f, "exit"), "A broken shared entry must not invent a separate exit problem");
  assert.equal(A.applyAttractionAdvice(f.s, f.b.id, "access", advice.id), null);
  assert(S.access(f.s, f.b));
  assert(H.sharedAccessRoute(f.s, f.b).length > 1);
  assert.deepEqual(f.b.pods, stored);
  assert(f.b.sharedAccess && f.b.open);
  assert.equal(f.s.tiles[20][14], "queue");
  assert.equal(redTiles(f.s), 0);
  assert.equal(f.s.cash, cash - advice.cost);
  assert(S.validSave(clone(f.s)));
});

test("Shared entry relocation around an obstruction preserves the inactive exit and scenery", () => {
  const f = fixture();
  enable(f);
  const oldEntry = clone(f.b.pods.entry),
    oldExit = clone(f.b.pods.exit);
  const port = P.podPort(f.b, S.CATALOG[f.b.kind].size, oldEntry);
  f.s.tiles[port.y][port.x] = "grass";
  const tree = S.build(f.s, "tree", port.x, port.y);
  assert(!tree.error, tree.error);
  f.b.open = false;
  const before = clone(f.s),
    cash = f.s.cash,
    advice = issue(f, "access").action;
  assert.equal(advice.kind, "connect-open");
  assert.match(advice.label, /Einlass versetzen/);
  assert.deepEqual(f.s, before, "Searching alternative entrances remains read-only");
  assert.equal(A.applyAttractionAdvice(f.s, f.b.id, "access", advice.id), null);
  assert.notDeepEqual(f.b.pods.entry, oldEntry);
  assert.deepEqual(f.b.pods.exit, oldExit);
  assert(!P.samePod(f.b.pods.entry, f.b.pods.exit));
  assert(f.s.buildings.some((building) => building.id === tree.id));
  assert(H.sharedAccessRoute(f.s, f.b).length > 1);
  assert(f.b.sharedAccess && f.b.open);
  assert.equal(redTiles(f.s), 0);
  assert.equal(f.s.cash, cash - advice.cost);
  assert(S.validSave(clone(f.s)), "Alternative entry must never persist effective duplicate pods");
});

console.log(`Shared access integration: ${passed}/${passed} passed`);

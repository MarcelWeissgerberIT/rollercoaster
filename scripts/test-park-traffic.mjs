import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  T = await import(moduleURL("game/park-traffic.ts")),
  Transit = await import(moduleURL("game/transit.ts"));
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log("PASS", name);
  } catch (error) {
    failed++;
    console.error("FAIL", name, error.stack);
  }
}
function park(width = 36, height = 36) {
  const s = S.newPark("sandbox");
  s.tiles = Array.from({ length: height }, () => Array(width).fill("path"));
  s.buildings = [];
  s.guests = [];
  s.transitLines = [];
  s.cleanliness = undefined;
  s.speed = 0;
  return s;
}
function building(s, kind, x = 6, y = 6, extra = {}) {
  const b = {
    id: s.nextId++,
    kind,
    x,
    y,
    name: `${S.CATALOG[kind].name} ${s.nextId}`,
    open: true,
    tested: true,
    price: S.CATALOG[kind].price,
    served: 0,
    revenue: 0,
    queue: [],
    riders: [],
    cycle: 0,
    ...(kind === "zebra"
      ? {
          habitat: {
            count: 2,
            food: 100,
            water: 100,
            clean: 100,
            health: 100,
            enrichment: true,
            shelter: true,
          },
        }
      : {}),
    ...extra,
  };
  s.buildings.push(b);
  return b;
}
function guest(s, target = null, state = "walk", x = 3, y = 3, extra = {}) {
  const g = {
    id: s.nextId++,
    x,
    y,
    target: target?.id ?? null,
    state,
    route: [],
    timer: 0,
    happiness: 80,
    hunger: 0,
    thirst: 0,
    rides: 0,
    skin: 0,
    thought: "",
    ...extra,
  };
  s.guests.push(g);
  return g;
}
const total = (values, key) => values.reduce((n, v) => n + v[key], 0);
const close = (a, b) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const row = (r, b) => r.buildings.find((v) => v.id === b.id);
function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

test("Empty and new maps have finite zeros and no invented demand or history", () => {
  const s = park(),
    r = T.parkTraffic(s);
  assert.equal(r.totalGuests, 0);
  assert.equal(r.totalTargeting, 0);
  assert.equal(r.totalVisits, 0);
  assert.equal(r.totalRevenue, 0);
  assert.equal(r.zones.length, 144);
  assert.equal(r.groups.length, 4);
  assert(r.groups.every((g) => g.share === 0 && g.visitShare === 0));
  assert(r.zones.every((z) => z.guests === 0 && z.happiness === null));
  s.tiles = [];
  assert.equal(T.parkTraffic(s).zones.length, 0);
  assert.equal(T.trafficAt(T.parkTraffic(s), { x: 0, y: 0 }), undefined);
});

test("Live shares use every known destination exactly once across all groups", () => {
  const s = park(),
    zoo = building(s, "zebra"),
    ride = building(s, "wheel", 12, 6),
    shop = building(s, "burger", 20, 6),
    bench = building(s, "bench", 20, 12);
  guest(s, zoo, "observe");
  guest(s, zoo);
  guest(s, ride);
  guest(s, ride, "queue");
  guest(s, shop, "ride");
  guest(s, bench, "rest");
  guest(s); // A passerby is not assigned to the nearest attraction.
  guest(s, { id: 999999 }); // A deleted destination is not a live assignment.
  guest(s, ride, "leave"); // Stale leaving targets do not count as intentions.
  // Occupancy arrays are bookkeeping, not additional people.
  ride.queue = [s.guests[3].id, s.guests[3].id, 777777];
  ride.riders = [s.guests[3].id, 888888];
  const r = T.parkTraffic(s);
  assert.equal(r.totalGuests, 9);
  assert.equal(r.totalTargeting, 6);
  assert.equal(total(r.buildings, "targeting"), 6);
  close(total(r.buildings, "share"), 100);
  close(total(r.groups, "share"), 100);
  close(row(r, zoo).share, 100 / 3);
  close(row(r, ride).share, 100 / 3);
  close(row(r, shop).share, 100 / 6);
  close(row(r, bench).share, 100 / 6);
  assert.equal(row(r, ride).waiting, 1);
  assert.equal(row(r, ride).active, 0);
  assert.equal(row(r, zoo).active, 1);
  assert.equal(row(r, zoo).enRoute, 1);
  assert.equal(row(r, shop).category, "shops");
  assert.equal(row(r, bench).category, "other");
  for (const b of r.buildings) assert.equal(b.enRoute + b.waiting + b.active, b.targeting);
  assert.equal(total(r.zones, "guests"), 9);
});

test("Visit and revenue shares normalize existing building counters, not arrivals", () => {
  const s = park(),
    zoo = building(s, "zebra", 6, 6, { served: 12 }),
    ride = building(s, "wheel", 15, 6, { served: 6, revenue: 60 }),
    shop = building(s, "plush", 20, 6, { served: 6, revenue: 40 });
  s.arrivals = 999;
  s.income = 99999;
  let r = T.parkTraffic(s);
  assert.equal(r.totalVisits, 24);
  assert.equal(r.totalRevenue, 100);
  assert.equal(row(r, zoo).visitShare, 50);
  assert.equal(row(r, zoo).revenueShare, 0);
  assert.equal(row(r, ride).revenueShare, 60);
  assert.equal(row(r, shop).visitShare, 25);
  s.buildings = s.buildings.filter((b) => b.id !== shop.id);
  r = T.parkTraffic(s);
  assert.equal(r.totalVisits, 18);
  assert.equal(r.totalRevenue, 60);
  close(row(r, zoo).visitShare, 200 / 3);
  assert.equal(row(r, ride).revenueShare, 100);
});

test("Appeal uses the real family model and excludes unavailable attractions", () => {
  const s = park(),
    zoo = building(s, "zebra"),
    ride = building(s, "wheel", 12, 6),
    closed = building(s, "carousel", 18, 6, { open: false }),
    empty = building(s, "zebra", 20, 10),
    crewless = building(s, "swing", 6, 20, {
      operations: {
        staffed: false,
        rounds: 1,
        remainingRounds: 0,
        phase: "idle",
        phaseLeft: 0,
      },
    }),
    isolated = building(s, "drop", 25, 25),
    shop = building(s, "burger", 18, 18);
  empty.habitat.count = 0;
  for (const p of S.accessNeighbors(isolated)) s.tiles[p.y][p.x] = "grass";
  const r = T.parkTraffic(s),
    a = S.rideAppeal(zoo, "family"),
    b = S.rideAppeal(ride, "family");
  close(row(r, zoo).appeal, a);
  close(row(r, ride).appealShare, (100 * b) / (a + b));
  close(total(r.buildings, "appealShare"), 100);
  for (const target of [closed, empty, crewless, isolated]) {
    assert.equal(row(r, target).available, false);
    assert.equal(row(r, target).appealShare, 0);
  }
  assert.equal(row(r, shop).available, true);
  assert.equal(row(r, shop).appeal, 0);
  assert(row(r, crewless).reasons.some((v) => v.includes("Fahrpersonal")));
  assert(row(r, isolated).reasons.some((v) => v.includes("Zugang")));
});

test("Passing a habitat does not assign its draw and observation stays at the fence", () => {
  const s = park(),
    zoo = building(s, "zebra", 12, 12),
    shop = building(s, "coffee", 24, 20);
  guest(s, shop, "walk", 11, 12);
  guest(s, null, "walk", 11, 12);
  guest(s, zoo, "observe", 11, 12);
  const r = T.parkTraffic(s),
    z = T.trafficAt(r, { x: 11, y: 12 });
  assert.equal(z.guests, 3);
  assert.equal(z.observing, 1);
  assert.equal(z.walking, 2);
  assert.equal(z.targets.find((t) => t.id === zoo.id).count, 1);
  assert.equal(row(r, zoo).targeting, 1);
  assert(z.reasons.some((v) => v.includes(`1 beobachten Tiere bei ${zoo.name}`)));
  assert(z.reasons.some((v) => v.includes(`1 unterwegs zum Ziel ${shop.name}`)));
  assert.equal(T.trafficAt(r, row(r, zoo).point).guests, 0);
});

test("Habitat safety closes availability immediately without a simulation tick", () => {
  const s = park(),
    zoo = building(s, "zebra"),
    ride = building(s, "wheel", 18, 18);
  zoo.habitat.safety = { condition: 29.8, electric: false };
  zoo.habitat.food = 68.314;
  const before = structuredClone(s),
    r = T.parkTraffic(s),
    habitat = row(r, zoo);
  assert.equal(zoo.open, true);
  assert.equal(habitat.available, false);
  assert.equal(habitat.appealShare, 0);
  assert.equal(row(r, ride).appealShare, 100);
  assert(habitat.reasons.some((reason) => reason.includes("Sicherheitsstopp")));
  assert(habitat.reasons.some((reason) => /^Tierwohl: \d+ %/.test(reason)));
  assert.deepEqual(s, before);
});

test("Riders produce heat at the ride center, not their stale boarding position", () => {
  const s = park(),
    ride = building(s, "wheel", 12, 12),
    coaster = building(s, "coaster", 3, 3, {
      track: [
        { x: 3, y: 3 },
        { x: 4, y: 3 },
        { x: 4, y: 12 },
        { x: 12, y: 12 },
        { x: 12, y: 3 },
        { x: 3, y: 3 },
      ],
    });
  guest(s, ride, "ride", 11, 12);
  guest(s, coaster, "ride", 2, 3);
  const r = T.parkTraffic(s);
  assert.equal(T.trafficAt(r, { x: 11, y: 12 }).guests, 0);
  assert.equal(T.trafficAt(r, { x: 2, y: 3 }).guests, 0);
  assert.equal(T.trafficAt(r, row(r, ride).point).riding, 1);
  assert.equal(T.trafficAt(r, row(r, coaster).point).riding, 1);
  assert.equal(total(r.zones, "guests"), 2);
});

test("Transport waiting and riding retain one final target with physical vehicle heat", () => {
  const s = park(),
    from = building(s, "train", 4, 4, { served: 2, revenue: 8 }),
    to = building(s, "train", 24, 4),
    zoo = building(s, "zebra", 25, 15),
    route = Array.from({ length: 21 }, (_, i) => ({ x: 4 + i, y: 5 })),
    line = {
      id: s.nextId++,
      kind: "train",
      a: from.id,
      b: to.id,
      route,
      position: 10.5,
      direction: 1,
      wait: 0,
      passengers: [],
      trips: 0,
      served: 2,
      revenue: 8,
      enabled: true,
    };
  s.transitLines.push(line);
  const transit = { line: line.id, from: from.id, to: to.id },
    riding = guest(s, zoo, "ride", 4, 5, { transit }),
    waiting = guest(s, zoo, "queue", 4, 5, { transit: { ...transit } });
  guest(s, null, "ride", 4, 5, { transit: { ...transit } }); // Destination was removed in transit.
  line.passengers = [riding.id, s.guests[2].id];
  from.queue.push(waiting.id);
  const r = T.parkTraffic(s),
    atVehicle = T.trafficAt(r, Transit.transportPose(line)),
    atStop = T.trafficAt(r, { x: 4, y: 5 });
  assert.equal(r.totalTargeting, 2);
  assert.equal(row(r, zoo).enRoute, 2);
  assert.equal(row(r, zoo).waiting, 0);
  assert.equal(row(r, zoo).active, 0);
  assert.equal(row(r, from).category, "other");
  assert.equal(row(r, from).targeting, 0);
  assert.equal(row(r, from).available, true);
  assert.equal(r.totalVisits, 2); // Station and line counters must not both be added.
  assert.equal(r.totalRevenue, 8);
  assert.equal(atVehicle.guests, 2);
  assert.equal(atVehicle.riding, 2);
  assert.equal(atStop.guests, 1);
  assert.equal(atStop.waiting, 1);
  assert(atStop.reasons.some((v) => v.includes(`warten am Transporthalt ${from.name}`)));
  assert.equal(total(r.zones, "guests"), 3);
});

test("Edge zones cover expanded maps once and clip both dimensions", () => {
  const s = park(35, 32);
  guest(s, null, "walk", 34.4, 31.4);
  const r = T.parkTraffic(s),
    corner = T.trafficAt(r, { x: 34.4, y: 31.4 });
  assert.equal(r.zones.length, 12 * 11);
  assert.equal(corner.x, 33);
  assert.equal(corner.y, 30);
  assert.equal(corner.width, 2);
  assert.equal(corner.height, 2);
  assert.equal(corner.guests, 1);
  assert.equal(T.trafficAt(r, { x: 35, y: 31 }), undefined);
  assert.equal(T.trafficAt(r, { x: -0.51, y: 0 }), undefined);
  assert.equal(T.trafficAt(r, { x: 34.5, y: 31 }), undefined);
  assert.equal(
    r.zones.reduce((n, z) => n + z.width * z.height, 0),
    35 * 32,
  );
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 35; x++)
      assert.equal(
        r.zones.filter((z) => x >= z.x && x < z.x + z.width && y >= z.y && y < z.y + z.height)
          .length,
        1,
      );
});

test("Fractional guest positions match rendered tile-center zone boundaries", () => {
  const s = park();
  guest(s, null, "walk", 2.8, 2.8);
  guest(s, null, "walk", -0.2, -0.2);
  guest(s, null, "walk", 2.49, 1);
  const r = T.parkTraffic(s),
    first = T.trafficAt(r, { x: -0.2, y: -0.2 }),
    next = T.trafficAt(r, { x: 2.8, y: 2.8 });
  assert.equal(first.id, "0,0");
  assert.equal(first.guests, 2);
  assert.equal(next.id, "3,3");
  assert.equal(next.guests, 1);
  assert.equal(T.trafficAt(r, { x: 2.5, y: 2.5 }).id, "3,3");
  assert.equal(total(r.zones, "guests"), 3);
});

test("Zone facts expose queue, mood and litter; congestion is only a recommendation", () => {
  const s = park(),
    ride = building(s, "carousel", 12, 12);
  for (let i = 0; i < 8; i++) {
    const g = guest(s, ride, i < 5 ? "queue" : "walk", 9, 12, { happiness: i < 4 ? 20 : 60 });
    if (g.state === "queue") ride.queue.push(g.id);
  }
  s.cleanliness = {
    version: 1,
    nextId: 3,
    litter: [
      { id: 1, x: 9, y: 12, kind: "cup", amount: 2 },
      { id: 2, x: 10, y: 12, kind: "wrapper", amount: 3 },
    ],
    workers: [],
    binned: 0,
    cleaned: 0,
    emptied: 0,
  };
  const r = T.parkTraffic(s),
    z = T.trafficAt(r, { x: 9, y: 12 });
  assert.equal(z.waiting, 5);
  assert.equal(z.walking, 3);
  assert.equal(z.happiness, 40);
  assert.equal(z.unhappy, 4);
  assert.equal(z.litter, 5);
  assert.equal(row(r, ride).expectedWait, S.expectedWait(ride));
  assert(z.reasons.some((v) => v.startsWith("Beobachtet:") && v.includes("5 warten bei")));
  assert(z.reasons.filter((v) => v.includes("Engpass")).every((v) => v.startsWith("Hinweis:")));
  assert(z.reasons.some((v) => v.startsWith("Hinweis:") && v.includes("Reinigung")));
});

test("Repeated paused reads are deterministic, consume no randomness and mutate no save", () => {
  const s = park(),
    zoo = building(s, "zebra"),
    shop = building(s, "burger", 15, 6);
  guest(s, zoo, "observe", 5, 6);
  guest(s, shop, "walk", 9, 6, { hunger: 90 });
  const before = structuredClone(s),
    random = Math.random;
  freeze(s);
  Math.random = () => {
    throw new Error("Analytics consumed simulation randomness");
  };
  try {
    const first = T.parkTraffic(s),
      second = T.parkTraffic(s);
    assert.deepEqual(first, second);
    assert.deepEqual(s, before);
    assert(row(first, shop).reasons.some((v) => v.includes("Hunger über 70 %")));
    first.buildings[0].point.x = 999;
    first.zones[0].point.x = 999;
    assert.deepEqual(s, before); // Returned points are detached from save state.
  } finally {
    Math.random = random;
  }
});

if (failed) process.exit(1);

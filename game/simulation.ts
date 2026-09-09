export type Point = { x: number; y: number; z?: number };
export type Kind =
  | "coaster"
  | "wheel"
  | "carousel"
  | "burger"
  | "drink"
  | "toilet"
  | "tree"
  | "pine"
  | "flowers"
  | "bench";
export type Tile = "grass" | "path" | "queue" | "water";
export type Building = {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  name: string;
  open: boolean;
  price: number;
  served: number;
  revenue: number;
  queue: number[];
  riders: number[];
  cycle: number;
  track?: Point[];
  tested: boolean;
  testing?: number;
};
export type Guest = {
  id: number;
  x: number;
  y: number;
  route: Point[];
  target: number | null;
  state: "walk" | "queue" | "ride" | "leave";
  timer: number;
  happiness: number;
  hunger: number;
  thirst: number;
  rides: number;
  skin: number;
  thought: string;
};
export type Park = {
  version: 1;
  cash: number;
  tiles: Tile[][];
  buildings: Building[];
  guests: Guest[];
  time: number;
  speed: number;
  open: boolean;
  ticket: number;
  arrivals: number;
  nextId: number;
  income: number;
  expenses: number;
  lastProfit: number;
  spawnClock: number;
  dayIncome: number;
  dayExpenses: number;
  rating: number;
  won: boolean;
  staff: number;
  mode: "scenario" | "sandbox";
};
export const SIZE = 30,
  ENTRANCE = { x: 15, y: 29 };
export const CATALOG: Record<
  Kind,
  {
    name: string;
    cost: number;
    size: number;
    price: number;
    duration: number;
    capacity: number;
    appeal: number;
    upkeep: number;
    sprite: string;
    description: string;
  }
> = {
  coaster: {
    name: "Achterbahn",
    cost: 3600,
    size: 1,
    price: 12,
    duration: 22,
    capacity: 8,
    appeal: 9,
    upkeep: 34,
    sprite: "car-se",
    description: "Deine Strecke. Dein Nervenkitzel.",
  },
  wheel: {
    name: "Panoramarad",
    cost: 1800,
    size: 3,
    price: 7,
    duration: 24,
    capacity: 8,
    appeal: 6,
    upkeep: 16,
    sprite: "wheel",
    description: "Die schönste Aussicht im Park.",
  },
  carousel: {
    name: "Karussell",
    cost: 950,
    size: 2,
    price: 5,
    duration: 15,
    capacity: 6,
    appeal: 5,
    upkeep: 10,
    sprite: "carousel",
    description: "Eine kleine Runde großes Glück.",
  },
  burger: {
    name: "Burgergarten",
    cost: 480,
    size: 1,
    price: 8,
    duration: 3,
    capacity: 1,
    appeal: 1,
    upkeep: 5,
    sprite: "burger",
    description: "Frische Energie für deine Gäste.",
  },
  drink: {
    name: "Limonadenbar",
    cost: 380,
    size: 1,
    price: 5,
    duration: 2,
    capacity: 1,
    appeal: 1,
    upkeep: 4,
    sprite: "drink",
    description: "Eine erfrischende Pause.",
  },
  toilet: {
    name: "Toiletten",
    cost: 320,
    size: 1,
    price: 0,
    duration: 4,
    capacity: 2,
    appeal: 1,
    upkeep: 3,
    sprite: "toilet",
    description: "Kleine Pause, zufriedene Gäste.",
  },
  tree: {
    name: "Laubbaum",
    cost: 45,
    size: 1,
    price: 0,
    duration: 0,
    capacity: 0,
    appeal: 0,
    upkeep: 0,
    sprite: "tree",
    description: "Mehr Grün für deinen Park.",
  },
  pine: {
    name: "Kiefer",
    cost: 40,
    size: 1,
    price: 0,
    duration: 0,
    capacity: 0,
    appeal: 0,
    upkeep: 0,
    sprite: "pine",
    description: "Ein Stück Wald zwischen den Fahrten.",
  },
  flowers: {
    name: "Blumenbeet",
    cost: 30,
    size: 1,
    price: 0,
    duration: 0,
    capacity: 0,
    appeal: 0,
    upkeep: 0,
    sprite: "flowers",
    description: "Farbe für jede Parkecke.",
  },
  bench: {
    name: "Parkbank",
    cost: 35,
    size: 1,
    price: 0,
    duration: 0,
    capacity: 0,
    appeal: 0,
    upkeep: 0,
    sprite: "bench",
    description: "Kurz durchatmen und weiterziehen.",
  },
};
export const isRide = (k: Kind) => ["coaster", "wheel", "carousel"].includes(k);
export const decorative = (k: Kind) => CATALOG[k].capacity === 0;
export const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
export const key = (p: Point) => `${p.x},${p.y}`;
const dirs = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
export function footprint(b: Pick<Building, "x" | "y" | "kind" | "track">): Point[] {
  if (b.kind === "coaster" && b.track) return b.track.map((p) => ({ x: p.x, y: p.y }));
  const n = CATALOG[b.kind].size;
  return Array.from({ length: n * n }, (_, i) => ({
    x: b.x + (i % n),
    y: b.y + Math.floor(i / n),
  }));
}
export function occupant(s: Park, x: number, y: number) {
  return s.buildings.find((b) => footprint(b).some((p) => p.x === x && p.y === y));
}
export function connected(s: Park) {
  const seen = new Set<string>();
  const q = [ENTRANCE];
  if (!["path", "queue"].includes(s.tiles[ENTRANCE.y][ENTRANCE.x])) return seen;
  seen.add(key(ENTRANCE));
  for (let i = 0; i < q.length; i++) {
    const p = q[i];
    for (const [dx, dy] of dirs) {
      const n = { x: p.x + dx, y: p.y + dy };
      if (
        inBounds(n.x, n.y) &&
        ["path", "queue"].includes(s.tiles[n.y][n.x]) &&
        !seen.has(key(n))
      ) {
        seen.add(key(n));
        q.push(n);
      }
    }
  }
  return seen;
}
export function access(s: Park, b: Building, net = connected(s)) {
  const n = CATALOG[b.kind].size;
  const adjacent: Point[] = [];
  for (let i = 0; i < n; i++)
    adjacent.push(
      { x: b.x + i, y: b.y + n },
      { x: b.x - 1, y: b.y + i },
      { x: b.x + n, y: b.y + i },
      { x: b.x + i, y: b.y - 1 },
    );
  return adjacent.find(
    (p) =>
      inBounds(p.x, p.y) &&
      net.has(key(p)) &&
      s.tiles[p.y][p.x] === (isRide(b.kind) ? "queue" : "path"),
  );
}
export function queueCapacity(s: Park, b: Building) {
  const a = access(s, b);
  if (!a) return 0;
  const seen = new Set([key(a)]),
    q = [a];
  for (let i = 0; i < q.length; i++)
    for (const [dx, dy] of dirs) {
      const p = { x: q[i].x + dx, y: q[i].y + dy };
      if (inBounds(p.x, p.y) && s.tiles[p.y][p.x] === "queue" && !seen.has(key(p))) {
        seen.add(key(p));
        q.push(p);
      }
    }
  return Math.min(40, q.length * 4);
}
export function findRoute(s: Park, start: Point, end: Point): Point[] {
  const a = { x: Math.round(start.x), y: Math.round(start.y) },
    target = key(end),
    q = [a],
    prev = new Map<string, Point | null>([[key(a), null]]);
  for (let i = 0; i < q.length; i++) {
    const p = q[i];
    if (key(p) === target) {
      const out: Point[] = [];
      let c: Point | null = p;
      while (c) {
        out.unshift(c);
        c = prev.get(key(c)) ?? null;
      }
      return out.slice(1);
    }
    for (const [dx, dy] of dirs) {
      const n = { x: p.x + dx, y: p.y + dy };
      if (
        inBounds(n.x, n.y) &&
        ["path", "queue"].includes(s.tiles[n.y][n.x]) &&
        !prev.has(key(n))
      ) {
        prev.set(key(n), p);
        q.push(n);
      }
    }
  }
  return [];
}
export function spend(s: Park, cost: number) {
  if (s.cash < cost) return false;
  s.cash -= cost;
  s.expenses += cost;
  s.dayExpenses += cost;
  return true;
}
export function trackStats(track: Point[]) {
  let length = 0,
    drop = 0,
    height = 0;
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1],
      b = track[i];
    length += Math.hypot(b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0)) * 5;
    drop = Math.max(drop, (a.z ?? 0) - (b.z ?? 0));
    height = Math.max(height, b.z ?? 0);
  }
  return {
    length: Math.round(length),
    height: height * 5,
    speed: Math.round(25 + Math.sqrt(height * 98)),
    excitement: Math.min(9.9, 3 + height * 0.7 + length / 180).toFixed(1),
    intensity: Math.min(9.9, 2 + drop * 1.3 + height * 0.3).toFixed(1),
  };
}
export function validateTrack(s: Park, track: Point[]): string | null {
  if (track.length < 9) return "Baue mindestens 8 Streckenabschnitte.";
  const a = track[0],
    b = track[track.length - 1];
  if (a.x !== b.x || a.y !== b.y || (a.z ?? 0) !== (b.z ?? 0))
    return "Verbinde das Ende auf Stationshöhe mit dem Startpunkt.";
  for (let i = 0; i < track.length; i++) {
    const p = track[i];
    if (!inBounds(p.x, p.y) || s.tiles[p.y][p.x] !== "grass" || occupant(s, p.x, p.y))
      return "Die Strecke braucht freie Landfelder.";
    if (i) {
      const prev = track[i - 1];
      if (
        Math.abs(prev.x - p.x) + Math.abs(prev.y - p.y) !== 1 ||
        Math.abs((prev.z ?? 0) - (p.z ?? 0)) > 1
      )
        return "Gleise müssen benachbart sein; maximal eine Höhenstufe pro Segment.";
    }
    if (
      i < track.length - 1 &&
      track
        .slice(0, i)
        .some((o) => o.x === p.x && o.y === p.y && Math.abs((o.z ?? 0) - (p.z ?? 0)) < 2)
    )
      return "Die Strecke kreuzt sich ohne ausreichenden Höhenabstand.";
  }
  return null;
}
export function build(
  s: Park,
  kind: Kind,
  x: number,
  y: number,
  track?: Point[],
): { error?: string; id?: number } {
  const proto = { kind, x, y, track };
  if (kind === "coaster") {
    const err = validateTrack(s, track ?? []);
    if (err) return { error: err };
  }
  if (
    footprint(proto).some(
      (p) => !inBounds(p.x, p.y) || s.tiles[p.y][p.x] !== "grass" || occupant(s, p.x, p.y),
    )
  )
    return { error: "Hier ist kein Platz. Wähle freie Wiese." };
  const cost = CATALOG[kind].cost + (track ? track.length * 65 : 0);
  if (!spend(s, cost)) return { error: "Dafür reicht dein Parkbudget nicht." };
  const b: Building = {
    ...proto,
    id: s.nextId++,
    name: kind === "coaster" ? "Waldflug" : CATALOG[kind].name,
    open: !isRide(kind),
    price: CATALOG[kind].price,
    served: 0,
    revenue: 0,
    queue: [],
    riders: [],
    cycle: 0,
    tested: kind !== "coaster",
  };
  s.buildings.push(b);
  return { id: b.id };
}
export function paint(s: Park, x: number, y: number, type: Tile): string | null {
  if (!inBounds(x, y)) return "Außerhalb des Parkgeländes.";
  if (x === ENTRANCE.x && y === ENTRANCE.y && type !== "path")
    return "Der Parkeingang muss ein normaler Weg bleiben.";
  if (occupant(s, x, y)) return "Dieses Feld ist bereits bebaut.";
  if (s.tiles[y][x] === type) return null;
  const cost = type === "queue" ? 18 : type === "water" ? 35 : 12;
  if (!spend(s, cost)) return "Dafür reicht dein Parkbudget nicht.";
  s.tiles[y][x] = type;
  return null;
}
export function remove(s: Park, x: number, y: number) {
  const b = occupant(s, x, y);
  if (b) {
    s.buildings = s.buildings.filter((o) => o.id !== b.id);
    const refund = Math.round(CATALOG[b.kind].cost * 0.4);
    s.cash += refund;
    s.income += refund;
    s.dayIncome += refund;
    for (const g of s.guests)
      if (g.target === b.id) {
        g.state = "walk";
        g.timer = 0;
        g.route = [];
        g.target = null;
        g.x = ENTRANCE.x;
        g.y = ENTRANCE.y;
      }
  } else if (inBounds(x, y) && !(x === ENTRANCE.x && y === ENTRANCE.y)) {
    s.tiles[y][x] = "grass";
  }
}
function newGuest(s: Park) {
  const g: Guest = {
    id: s.nextId++,
    x: 15,
    y: 29,
    route: [],
    target: null,
    state: "walk",
    timer: 0,
    happiness: 80,
    hunger: 10 + Math.random() * 20,
    thirst: 10 + Math.random() * 20,
    rides: 0,
    skin: s.nextId % 3,
    thought: "Mal sehen, was der Park zu bieten hat!",
  };
  s.guests.push(g);
  s.arrivals++;
  s.cash += s.ticket;
  s.income += s.ticket;
  s.dayIncome += s.ticket;
  return g;
}
export function newPark(mode: "scenario" | "sandbox" = "scenario"): Park {
  const s: Park = {
    version: 1,
    cash: 16000,
    tiles: Array.from({ length: SIZE }, () => Array(SIZE).fill("grass")),
    buildings: [],
    guests: [],
    time: 0,
    speed: 1,
    open: true,
    ticket: 6,
    arrivals: 0,
    nextId: 1,
    income: 0,
    expenses: 0,
    lastProfit: 0,
    spawnClock: 0,
    dayIncome: 0,
    dayExpenses: 0,
    rating: 80,
    won: false,
    staff: 2,
    mode,
  };
  for (let y = 6; y < SIZE; y++) s.tiles[y][15] = "path";
  for (let x = 5; x <= 25; x++) {
    s.tiles[18][x] = "path";
    s.tiles[10][x] = "path";
  }
  for (let y = 10; y <= 18; y++) {
    s.tiles[y][5] = "path";
    s.tiles[y][25] = "path";
  }
  for (let x = 1; x < 9; x++)
    for (let y = 1; y < 7; y++)
      if ((x - 4.5) ** 2 / 18 + (y - 3.5) ** 2 / 7 < 1) s.tiles[y][x] = "water";
  const place = (kind: Kind, x: number, y: number) => {
    build(s, kind, x, y);
    const b = s.buildings.at(-1)!;
    b.open = true;
    return b;
  };
  place("wheel", 20, 13);
  s.tiles[16][20] = "queue";
  s.tiles[17][20] = "queue";
  place("carousel", 8, 14);
  s.tiles[16][8] = "queue";
  s.tiles[17][8] = "queue";
  place("burger", 13, 19);
  place("drink", 17, 19);
  place("toilet", 24, 19);
  const t: Point[] = [];
  for (let x = 18; x <= 24; x++)
    t.push({ x, y: 5, z: x < 21 ? x - 18 : Math.max(1, 6 - (x - 18)) });
  for (let y = 6; y <= 8; y++) t.push({ x: 24, y, z: 1 });
  for (let x = 23; x >= 18; x--) t.push({ x, y: 8, z: x === 18 ? 0 : 1 });
  for (let y = 7; y >= 5; y--) t.push({ x: 18, y, z: 0 });
  const cr = build(s, "coaster", 18, 5, t);
  if (cr.id) {
    const b = s.buildings.at(-1)!;
    b.open = true;
    b.tested = true;
  }
  s.tiles[6][17] = "queue";
  s.tiles[5][17] = "queue";
  s.tiles[7][17] = "queue";
  s.tiles[8][17] = "queue";
  s.tiles[9][17] = "queue";
  s.tiles[10][17] = "path";
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++)
      if (
        s.tiles[y][x] === "grass" &&
        !occupant(s, x, y) &&
        ((x * 31 + y * 13) % 23 === 0 || ((x < 2 || x > 27 || y < 2) && (x + y) % 3 === 0))
      )
        place((x + y) % 3 === 0 ? "pine" : "tree", x, y);
  for (const [x, y] of [
    [13, 22],
    [17, 22],
    [7, 19],
    [22, 19],
    [13, 12],
    [17, 12],
  ])
    place("flowers", x, y);
  place("bench", 14, 24);
  place("bench", 16, 24);
  s.cash = mode === "sandbox" ? 100000 : 16000;
  s.expenses = 0;
  s.dayExpenses = 0;
  for (let i = 0; i < 26; i++) {
    const g = newGuest(s);
    g.y = 11 + Math.random() * 16;
    g.x = 15;
  }
  s.cash = mode === "sandbox" ? 100000 : 16000;
  s.income = 0;
  s.dayIncome = 0;
  s.arrivals = 26;
  return s;
}
function choose(s: Park, g: Guest, net: Set<string>) {
  const options = s.buildings.filter(
    (b) =>
      b.open &&
      !decorative(b.kind) &&
      access(s, b, net) &&
      b.price <= CATALOG[b.kind].price * 2 + 2 &&
      (!isRide(b.kind) || b.tested) &&
      b.queue.length < queueCapacity(s, b) + (!isRide(b.kind) ? 5 : 0),
  );
  const ranked = options
    .map((b) => ({
      b,
      score:
        (isRide(b.kind)
          ? CATALOG[b.kind].appeal * (1 - g.rides * 0.07)
          : b.kind === "burger"
            ? g.hunger / 5
            : b.kind === "drink"
              ? g.thirst / 5
              : 1) +
        Math.random() * 7 -
        b.price * 0.5 -
        b.queue.length * 0.7,
    }))
    .sort((a, b) => b.score - a.score);
  if (!s.open || g.rides >= 4 || g.happiness < 25 || (s.time > 30 && ranked.length === 0)) {
    g.state = "leave";
    g.route = findRoute(s, g, ENTRANCE);
    g.target = null;
    g.thought = "Zeit, nach Hause zu gehen.";
    return;
  }
  const b = ranked[0]?.b;
  if (!b) {
    g.timer = 3;
    g.thought = "Ich suche eine offene Attraktion mit einem Weg.";
    return;
  }
  const a = access(s, b, net)!;
  g.route = findRoute(s, g, a);
  g.target = b.id;
  g.thought = `Auf dem Weg: ${b.name}`;
}
export function tick(s: Park, dt: number) {
  if (s.speed === 0 || !Number.isFinite(dt) || dt <= 0) return;
  if (dt > 0.25) {
    let left = dt;
    while (left > 0) {
      const step = Math.min(0.25, left);
      tick(s, step);
      left -= step;
    }
    return;
  }
  dt *= s.speed;
  const oldDay = Math.floor(s.time / 90);
  s.time += dt;
  const net = connected(s);
  const active = s.buildings.filter((b) => b.open && !decorative(b.kind) && access(s, b, net));
  s.spawnClock += dt;
  const interval = Math.max(
    0.7,
    4 -
      active.filter((b) => isRide(b.kind)).length * 0.5 +
      s.ticket * 0.05 +
      (100 - s.rating) * 0.02,
  );
  if (s.open && s.ticket <= 25 && s.spawnClock >= interval && s.guests.length < 220) {
    s.spawnClock = 0;
    newGuest(s);
  }
  for (const b of s.buildings) {
    if (b.testing) {
      b.testing = Math.max(0, b.testing - dt);
      if (b.testing === 0) b.tested = true;
    }
    if (!b.open || !access(s, b, net)) {
      for (const id of [...b.queue, ...b.riders]) {
        const g = s.guests.find((g) => g.id === id);
        if (g) {
          g.state = "walk";
          g.timer = 0;
          g.target = null;
          g.route = [];
          g.x = 15;
          g.y = 18;
        }
      }
      b.queue = [];
      b.riders = [];
      b.cycle = 0;
      continue;
    }
    b.cycle -= dt;
    if (b.riders.length && b.cycle <= 0) {
      for (const id of b.riders) {
        const g = s.guests.find((g) => g.id === id);
        if (g) {
          g.state = "walk";
          g.target = null;
          g.timer = 2;
          g.rides++;
          g.happiness = Math.min(100, g.happiness + 12);
          g.thought = "Das hat Spaß gemacht!";
        }
      }
      b.riders = [];
    }
    if (!b.riders.length && b.queue.length && b.cycle <= 0) {
      b.riders = b.queue.splice(0, CATALOG[b.kind].capacity);
      b.cycle = CATALOG[b.kind].duration;
      for (const id of b.riders) {
        const g = s.guests.find((g) => g.id === id);
        if (g) g.state = "ride";
        b.served++;
        b.revenue += b.price;
        s.cash += b.price;
        s.income += b.price;
        s.dayIncome += b.price;
      }
    }
  }
  for (const g of s.guests) {
    g.hunger = Math.min(100, g.hunger + dt * 0.14);
    g.thirst = Math.min(100, g.thirst + dt * 0.2);
    g.happiness = Math.max(0, g.happiness - dt * (g.hunger > 70 || g.thirst > 70 ? 0.22 : 0.012));
    if (g.state === "ride") continue;
    if (g.state === "queue") {
      g.timer += dt;
      if (g.timer > 45) {
        g.happiness -= dt * 0.15;
        g.thought = "Die Schlange ist ganz schön lang.";
      }
      continue;
    }
    if (g.timer > 0) {
      g.timer -= dt;
      continue;
    }
    if (g.route.length) {
      const p = g.route[0];
      if (!inBounds(p.x, p.y) || !net.has(key(p))) {
        g.route = [];
        g.target = null;
        g.x = ENTRANCE.x;
        g.y = ENTRANCE.y;
        continue;
      }
      const d = Math.hypot(p.x - g.x, p.y - g.y),
        step = dt * 1.2;
      if (d <= step) {
        g.x = p.x;
        g.y = p.y;
        g.route.shift();
      } else {
        g.x += ((p.x - g.x) / d) * step;
        g.y += ((p.y - g.y) / d) * step;
      }
      continue;
    }
    if (g.state === "leave") {
      if (Math.hypot(g.x - 15, g.y - 29) < 0.2) {
        g.timer = -999;
      } else {
        g.x = 15;
        g.y = 29;
      }
      continue;
    }
    if (g.target) {
      const b = s.buildings.find((b) => b.id === g.target);
      if (b && b.open && access(s, b, net)) {
        const entrance = access(s, b, net)!;
        if (Math.hypot(g.x - entrance.x, g.y - entrance.y) > 0.2) {
          g.route = findRoute(s, g, entrance);
          if (!g.route.length) {
            g.target = null;
            g.x = ENTRANCE.x;
            g.y = ENTRANCE.y;
          }
          continue;
        }
        if (isRide(b.kind) && b.queue.length < queueCapacity(s, b)) {
          b.queue.push(g.id);
          g.state = "queue";
          g.timer = 0;
          g.thought = `Ich warte auf ${b.name}.`;
          continue;
        }
        if (!isRide(b.kind)) {
          g.hunger = b.kind === "burger" ? 0 : g.hunger;
          g.thirst = b.kind === "drink" ? 0 : g.thirst;
          g.happiness = Math.min(100, g.happiness + 7);
          s.cash += b.price;
          s.income += b.price;
          s.dayIncome += b.price;
          b.revenue += b.price;
          b.served++;
          g.timer = 4;
          g.thought =
            b.kind === "burger"
              ? "Der Burger war richtig gut."
              : b.kind === "drink"
                ? "Endlich etwas Kaltes trinken!"
                : "Eine gute Pause.";
        }
      }
      g.target = null;
    } else choose(s, g, net);
  }
  s.guests = s.guests.filter((g) => g.timer !== -999);
  if (s.guests.length)
    s.rating = Math.round(s.guests.reduce((a, g) => a + g.happiness, 0) / s.guests.length);
  if (Math.floor(s.time / 90) !== oldDay) {
    const cost =
      s.staff * 45 +
      s.buildings.filter((b) => b.open).reduce((a, b) => a + CATALOG[b.kind].upkeep, 0);
    s.cash -= cost;
    s.expenses += cost;
    s.dayExpenses += cost;
    s.lastProfit = s.dayIncome - s.dayExpenses;
    s.dayIncome = 0;
    s.dayExpenses = 0;
    const green = s.buildings.filter((b) => decorative(b.kind)).length;
    for (const g of s.guests)
      g.happiness = Math.min(100, g.happiness + Math.min(6, green * 0.1) + s.staff);
  }
  if (
    !s.won &&
    s.arrivals >= 150 &&
    s.rating >= 75 &&
    s.buildings.filter((b) => isRide(b.kind) && b.open && b.tested && access(s, b, net)).length >= 4
  )
    s.won = true;
}
export function validSave(v: unknown): v is Park {
  try {
    if (!v || typeof v !== "object") return false;
    const s = v as Park;
    const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
    const point = (p: Point) =>
      p &&
      Number.isInteger(p.x) &&
      Number.isInteger(p.y) &&
      inBounds(p.x, p.y) &&
      (p.z === undefined || (Number.isInteger(p.z) && p.z >= 0 && p.z <= 5));
    if (
      s.version !== 1 ||
      !["scenario", "sandbox"].includes(s.mode) ||
      typeof s.open !== "boolean" ||
      typeof s.won !== "boolean" ||
      ![0, 1, 3].includes(s.speed) ||
      ![
        "cash",
        "time",
        "ticket",
        "arrivals",
        "nextId",
        "income",
        "expenses",
        "lastProfit",
        "spawnClock",
        "dayIncome",
        "dayExpenses",
        "rating",
        "staff",
      ].every((k) => num((s as unknown as Record<string, unknown>)[k]))
    )
      return false;
    if (
      s.time < 0 ||
      s.ticket < 0 ||
      s.ticket > 30 ||
      s.staff < 0 ||
      s.staff > 8 ||
      !Array.isArray(s.tiles) ||
      s.tiles.length !== SIZE ||
      !s.tiles.every(
        (r) =>
          Array.isArray(r) &&
          r.length === SIZE &&
          r.every((t) => ["grass", "path", "queue", "water"].includes(t)),
      )
    )
      return false;
    if (
      !Array.isArray(s.buildings) ||
      !Array.isArray(s.guests) ||
      s.buildings.length > 900 ||
      s.guests.length > 220
    )
      return false;
    const ids = new Set<number>();
    for (const b of s.buildings) {
      if (
        !b ||
        !Object.hasOwn(CATALOG, b.kind) ||
        !point(b) ||
        !Number.isInteger(b.id) ||
        ids.has(b.id) ||
        typeof b.name !== "string" ||
        b.name.length > 150 ||
        typeof b.open !== "boolean" ||
        typeof b.tested !== "boolean" ||
        (b.testing !== undefined && (!num(b.testing) || b.testing < 0 || b.testing > 8)) ||
        !["price", "served", "revenue", "cycle"].every((k) =>
          num((b as unknown as Record<string, unknown>)[k]),
        ) ||
        b.price < 0 ||
        b.price > 30 ||
        !Array.isArray(b.queue) ||
        !b.queue.every(Number.isInteger) ||
        !Array.isArray(b.riders) ||
        !b.riders.every(Number.isInteger) ||
        (b.kind === "coaster" &&
          (!Array.isArray(b.track) || b.track.length < 9 || !b.track.every(point)))
      )
        return false;
      ids.add(b.id);
    }
    const buildingIds = new Set(ids);
    for (const g of s.guests) {
      if (
        !g ||
        !Number.isInteger(g.id) ||
        ids.has(g.id) ||
        !["x", "y", "timer", "happiness", "hunger", "thirst", "rides", "skin"].every((k) =>
          num((g as unknown as Record<string, unknown>)[k]),
        ) ||
        g.x < 0 ||
        g.x >= SIZE ||
        g.y < 0 ||
        g.y >= SIZE ||
        ![0, 1, 2].includes(g.skin) ||
        typeof g.thought !== "string" ||
        !["walk", "queue", "ride", "leave"].includes(g.state) ||
        !Array.isArray(g.route) ||
        !g.route.every(point) ||
        (g.target !== null && !buildingIds.has(g.target))
      )
        return false;
      ids.add(g.id);
    }
    const guests = new Set(s.guests.map((g) => g.id));
    if (
      s.buildings.some((b) => [...b.queue, ...b.riders].some((id) => !guests.has(id))) ||
      s.nextId <= Math.max(0, ...ids)
    )
      return false;
    return true;
  } catch {
    return false;
  }
}

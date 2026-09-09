import { prepareRoute } from "./motion";
export type CoasterType = "steel" | "wood" | "launch";
export type Point = {
  x: number;
  y: number;
  z?: number;
  smooth?: boolean;
  inversion?: boolean;
  heading?: number;
  style?: CoasterType;
};
export const COASTER_TYPES = {
  steel: {
    name: "Stahlfalke",
    description: "Stahlbahn · Kettenlift & Loopings",
    color: "#d95135",
    cost: 3600,
    capacity: 8,
    duration: 22,
    loop: true,
  },
  wood: {
    name: "Holzexpress",
    description: "Holzbahn · Hügel & weiche Kurven",
    color: "#a06b36",
    cost: 2900,
    capacity: 12,
    duration: 28,
    loop: false,
  },
  launch: {
    name: "Blitzstart",
    description: "Launch-Coaster · Beschleunigung & Loopings",
    color: "#1cabb1",
    cost: 4600,
    capacity: 8,
    duration: 18,
    loop: true,
  },
};
export type Kind =
  | "coaster"
  | "wheel"
  | "carousel"
  | "swing"
  | "drop"
  | "pirate"
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
  testDuration?: number;
  autoOpen?: boolean;
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
  profile?: "family" | "thrill" | "budget";
  wallet?: number;
  bladder?: number;
  servicePrice?: number;
  visited?: number[];
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
  operatingIncomeToday?: number;
  operatingExpensesToday?: number;
  operatingProfit?: number;
  scenario?: ScenarioId;
  research?: { completed: ResearchId[]; active: ResearchId | null; remaining: number };
  draft?: {
    track: Point[];
    history: number[];
    rotation: number;
    style: CoasterType;
    piece?: "straight" | "rise" | "fall" | "left" | "right" | "loop";
  };
};
export const SCENARIOS = {
  waldhain: {
    name: "Waldhain Park",
    subtitle: "Ein Park für alle",
    description: "Baue deinen ersten Publikumsliebling mit vier geöffneten Attraktionen.",
    cash: 16000,
    arrivals: 150,
    rides: 4,
    rating: 75,
    value: 0,
    profit: 0,
    coasters: 0,
  },
  lakeside: {
    name: "Seeblick Park",
    subtitle: "Familien am Wasser",
    description:
      "Weniger Startkapital und ein zweiter See: Plane kurze Wege und einen vielseitigen Familienpark.",
    cash: 12000,
    arrivals: 250,
    rides: 5,
    rating: 80,
    value: 26000,
    profit: 200,
    coasters: 0,
  },
  summit: {
    name: "Gipfelrausch",
    subtitle: "Die Achterbahn-Challenge",
    description:
      "Drei Achterbahnen, zufriedene Gäste und ein rentabler Betrieb. Der Startpark hat nur eine Bahn.",
    cash: 20000,
    arrivals: 350,
    rides: 5,
    rating: 82,
    value: 34000,
    profit: 350,
    coasters: 3,
  },
} as const;
export type ScenarioId = keyof typeof SCENARIOS;
export const RESEARCH = {
  family: {
    name: "Familienfestival",
    description: "Holzexpress, Wellenflug und Piratenschaukel",
    cost: 1200,
    duration: 90,
    requires: null,
  },
  thrill: {
    name: "Hoch hinaus",
    description: "Himmelssturz mit freiem Fall",
    cost: 1800,
    duration: 120,
    requires: null,
  },
  launch: {
    name: "Magnetischer Start",
    description: "Blitzstart mit Launch und Loopings",
    cost: 2800,
    duration: 180,
    requires: "thrill",
  },
} as const;
export type ResearchId = keyof typeof RESEARCH;
export const scenarioOf = (s: Park) => SCENARIOS[s.scenario ?? "waldhain"];
export function isUnlocked(s: Park, kind: Kind, style: CoasterType = "steel") {
  if (s.mode === "sandbox" || !s.research) return true;
  if (
    s.buildings.some(
      (b) => b.kind === kind && (kind !== "coaster" || (b.track?.[0]?.style ?? "steel") === style),
    )
  )
    return true;
  const project =
    kind === "coaster"
      ? style === "launch"
        ? "launch"
        : style === "wood"
          ? "family"
          : null
      : kind === "drop"
        ? "thrill"
        : ["swing", "pirate"].includes(kind)
          ? "family"
          : null;
  return !project || s.research.completed.includes(project as ResearchId);
}
export function startResearch(s: Park, id: ResearchId): string | null {
  migratePark(s);
  const r = s.research!,
    project = RESEARCH[id];
  if (!project) return "Unbekanntes Forschungsprojekt.";
  if (s.mode === "sandbox" || r.completed.includes(id)) return "Bereits freigeschaltet.";
  if (r.active) return "Es läuft bereits ein Forschungsprojekt.";
  if (project.requires && !r.completed.includes(project.requires))
    return "Erforsche zuerst Hoch hinaus.";
  if (!spend(s, project.cost)) return "Das Budget reicht für diese Forschung noch nicht.";
  r.active = id;
  r.remaining = project.duration;
  return null;
}
/** Old parks retain all previously available content; new scenarios start with research. */
export function migratePark(s: Park): Park {
  s.scenario ??= "waldhain";
  s.operatingIncomeToday ??= 0;
  s.operatingExpensesToday ??= 0;
  s.operatingProfit ??= 0;
  s.research ??= { completed: Object.keys(RESEARCH) as ResearchId[], active: null, remaining: 0 };
  for (const g of s.guests) {
    g.profile ??= (["family", "thrill", "budget"] as const)[g.id % 3];
    g.wallet ??= 60;
    g.bladder ??= 10;
    g.visited ??= [];
  }
  return s;
}
export function parkValue(s: Park) {
  return Math.round(
    s.cash +
      s.buildings.reduce(
        (sum, b) => sum + (b.track ? trackCost(b.track) : CATALOG[b.kind].cost) * 0.8,
        0,
      ),
  );
}
export function expectedWait(b: Building) {
  return (
    Math.max(0, b.cycle) +
    Math.floor(b.queue.length / Math.max(1, rideCapacity(b))) * rideDuration(b)
  );
}
export function rideAppeal(b: Building, profile: Guest["profile"] = "family") {
  const stats = b.track ? trackStats(b.track) : null;
  const fun = stats ? Number(stats.excitement) : CATALOG[b.kind].appeal;
  const intensity = stats
    ? Number(stats.intensity)
    : (({ drop: 8, pirate: 6, swing: 4, wheel: 1, carousel: 1 } as Partial<Record<Kind, number>>)[
        b.kind
      ] ?? 2);
  const ideal = profile === "thrill" ? 7 : profile === "family" ? 3 : 4;
  return Math.max(0.5, fun + 2 - Math.abs(intensity - ideal) * 0.9);
}
export function guestScore(b: Building, g: Guest) {
  const desire = isRide(b.kind)
    ? rideAppeal(b, g.profile)
    : b.kind === "burger"
      ? g.hunger * 0.17
      : b.kind === "drink"
        ? g.thirst * 0.17
        : (g.bladder ?? 10) * 0.15 - 4;
  return (
    desire -
    b.price * (g.profile === "budget" ? 0.65 : 0.32) -
    expectedWait(b) / 18 -
    Math.hypot(b.x - g.x, b.y - g.y) * 0.09 -
    (g.visited?.includes(b.id) ? 3.5 : 0)
  );
}
export function entryDemand(s: Park) {
  const rides = s.buildings.filter((b) => b.open && b.tested && isRide(b.kind) && access(s, b));
  if (!rides.length) return 0;
  const value = rides.reduce((n, b) => n + rideAppeal(b, "family"), 0) * 0.62;
  return Math.min(
    1,
    Math.max(0, (1 / (1 + Math.exp((s.ticket - value) / 3.5))) * (0.5 + s.rating / 150)),
  );
}
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
  swing: {
    name: "Wellenflug",
    cost: 1450,
    size: 3,
    price: 6,
    duration: 20,
    capacity: 10,
    appeal: 6,
    upkeep: 13,
    sprite: "ride-swing",
    description: "Schwingende Sitze über den Baumwipfeln.",
  },
  drop: {
    name: "Himmelssturz",
    cost: 2600,
    size: 2,
    price: 9,
    duration: 18,
    capacity: 8,
    appeal: 8,
    upkeep: 22,
    sprite: "ride-drop",
    description: "Hoch hinaus. Im freien Fall zurück.",
  },
  pirate: {
    name: "Piratenschaukel",
    cost: 1950,
    size: 3,
    price: 7,
    duration: 21,
    capacity: 12,
    appeal: 7,
    upkeep: 17,
    sprite: "ride-pirate",
    description: "Eine schwungvolle Fahrt auf hoher See.",
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
export const isRide = (k: Kind) =>
  ["coaster", "wheel", "carousel", "swing", "drop", "pirate"].includes(k);
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
  if (b.kind === "coaster" && b.track) return trackFootprint(b.track);
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
  const reachable = adjacent.filter((p) => inBounds(p.x, p.y) && net.has(key(p)));
  // Prefer a dedicated queue, but a station can also board directly from a park path.
  return (
    (isRide(b.kind) ? reachable.find((p) => s.tiles[p.y][p.x] === "queue") : undefined) ??
    reachable.find((p) => s.tiles[p.y][p.x] === "path")
  );
}
export function queueCapacity(s: Park, b: Building) {
  const a = access(s, b);
  if (!a) return 0;
  if (s.tiles[a.y][a.x] === "path") return 4;
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
const footprintCache = new WeakMap<Point[], Point[]>();
export function trackFootprint(track: Point[]): Point[] {
  const cached = footprintCache.get(track);
  if (cached) return cached;
  const cells = new Map<string, Point>();
  for (let i = 0; i < track.length; i++) {
    const a = track[Math.max(0, i - 1)],
      b = track[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 4));
    for (let j = 0; j <= steps; j++) {
      const p = {
        x: Math.round(a.x + ((b.x - a.x) * j) / steps),
        y: Math.round(a.y + ((b.y - a.y) * j) / steps),
      };
      cells.set(`${p.x},${p.y}`, p);
    }
  }
  const points = [...cells.values()];
  footprintCache.set(track, points);
  return points;
}
export const buildingBaseCost = (b: Pick<Building, "kind" | "track">) =>
  b.kind === "coaster" ? COASTER_TYPES[b.track?.[0]?.style ?? "steel"].cost : CATALOG[b.kind].cost;
export const rideDuration = (b: Building) =>
  b.kind === "coaster"
    ? b.track
      ? prepareRoute(b.track).duration
      : COASTER_TYPES.steel.duration
    : CATALOG[b.kind].duration;
export const rideCapacity = (b: Building) =>
  b.kind === "coaster"
    ? COASTER_TYPES[b.track?.[0]?.style ?? "steel"].capacity
    : CATALOG[b.kind].capacity;
export function trackCost(track: Point[]) {
  let units = 1;
  for (let i = 1; i < track.length; i++)
    units += Math.max(
      Math.hypot(track[i].x - track[i - 1].x, track[i].y - track[i - 1].y),
      Math.abs((track[i].z ?? 0) - (track[i - 1].z ?? 0)),
    );
  return COASTER_TYPES[track[0]?.style ?? "steel"].cost + Math.round(units * 65);
}
const statsCache = new WeakMap<
  Point[],
  { length: number; height: number; speed: number; excitement: string; intensity: string }
>();
export function trackStats(track: Point[]) {
  const cached = statsCache.get(track);
  if (cached) return cached;
  const route = prepareRoute(track),
    height = Math.max(0, ...track.map((p) => p.z ?? 0)) * 5;
  let peak = track[0]?.z ?? 0,
    drop = 0;
  for (const p of track) {
    const z = p.z ?? 0;
    if (z > peak) peak = z;
    else drop = Math.max(drop, peak - z);
  }
  const speed = Math.max(0, ...route.speeds) * 3.6,
    inversions = track.some((p) => p.inversion) ? 1 : 0;
  const stats = {
    length: Math.round(route.length * 5),
    height,
    speed: Math.round(speed),
    excitement: Math.min(
      9.9,
      2.5 + height * 0.1 + route.length / 40 + inversions * 1.2 + speed / 100,
    ).toFixed(1),
    intensity: Math.min(
      9.9,
      1.5 + drop * 0.55 + height * 0.05 + inversions * 2 + speed / 70,
    ).toFixed(1),
  };
  statsCache.set(track, stats);
  return stats;
}
export function validateTrack(s: Park, track: Point[]): string | null {
  if (track.length < 9) return "Baue mindestens 8 Streckenabschnitte.";
  const a = track[0],
    b = track[track.length - 1];
  if (a.x !== b.x || a.y !== b.y || (a.z ?? 0) !== (b.z ?? 0))
    return "Verbinde das Ende auf Stationshöhe mit dem Startpunkt.";
  if (track[0].smooth) {
    const style = track[0].style ?? "steel";
    if (
      !(style in COASTER_TYPES) ||
      track.some(
        (p) =>
          p.style !== track[0].style ||
          p.smooth !== true ||
          (style === "wood" && (p.inversion || (p.z ?? 0) > 4)),
      )
    )
      return "Dieser Bahntyp unterstützt diese Bauteile nicht.";
    if (
      track.length > 2048 ||
      track.some(
        (p) => !Number.isFinite(p.x + p.y + (p.z ?? 0)) || (p.z ?? 0) < 0 || (p.z ?? 0) > 8,
      )
    )
      return "Ungültige Gleisgeometrie.";
    if (
      trackFootprint(track).some(
        (p) => !inBounds(p.x, p.y) || s.tiles[p.y][p.x] !== "grass" || occupant(s, p.x, p.y),
      )
    )
      return "Die Strecke braucht freie Landfelder.";
    const distances = [0];
    for (let i = 1; i < track.length; i++) {
      const p = track[i],
        prev = track[i - 1];
      const d = Math.hypot(p.x - prev.x, p.y - prev.y, (p.z ?? 0) - (prev.z ?? 0));
      if (d > 1.5 || d < 1e-8) return "Die Bauteile müssen lückenlos verbunden sein.";
      distances.push(distances[i - 1] + d);
    }
    if (distances.at(-1)! < 8) return "Baue mindestens 8 Streckenabschnitte.";
    for (let i = 0; i < track.length - 1; i++)
      for (let j = i + 1; j < track.length - 1; j++) {
        const separation = Math.min(
          distances[j] - distances[i],
          distances.at(-1)! - (distances[j] - distances[i]),
        );
        if (separation < 2.5) continue;
        const p = track[i],
          q = track[j];
        if (Math.hypot(p.x - q.x, p.y - q.y) < 0.35 && Math.abs((p.z ?? 0) - (q.z ?? 0)) < 0.6)
          return "Die Strecke kreuzt sich ohne ausreichenden Höhenabstand.";
      }
    return null;
  }
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
  if (!isUnlocked(s, kind, track?.[0]?.style))
    return { error: "Diese Attraktion wird durch Forschung freigeschaltet." };
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
  const cost = track ? trackCost(track) : CATALOG[kind].cost;
  if (!spend(s, cost)) return { error: "Dafür reicht dein Parkbudget nicht." };
  const b: Building = {
    ...proto,
    id: s.nextId++,
    name:
      kind === "coaster"
        ? track?.[0]?.style
          ? COASTER_TYPES[track[0].style].name
          : "Waldflug"
        : CATALOG[kind].name,
    open: !isRide(kind),
    price:
      kind === "coaster" && track?.[0]?.style
        ? track[0].style === "wood"
          ? 9
          : track[0].style === "launch"
            ? 15
            : 12
        : CATALOG[kind].price,
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
    const refund = Math.round(buildingBaseCost(b) * 0.4);
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
    profile: (["family", "thrill", "budget"] as const)[s.nextId % 3],
    wallet: Math.max(0, 55 + Math.floor(Math.random() * 50) - s.ticket),
    visited: [],
    bladder: 10,
  };
  s.guests.push(g);
  s.arrivals++;
  s.cash += s.ticket;
  s.income += s.ticket;
  s.dayIncome += s.ticket;
  s.operatingIncomeToday = (s.operatingIncomeToday ?? 0) + s.ticket;
  return g;
}
export function newPark(
  mode: "scenario" | "sandbox" = "scenario",
  scenario: ScenarioId = "waldhain",
): Park {
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
    operatingIncomeToday: 0,
    operatingExpensesToday: 0,
    operatingProfit: 0,
    scenario,
    research: {
      completed: mode === "sandbox" ? (Object.keys(RESEARCH) as ResearchId[]) : [],
      active: null,
      remaining: 0,
    },
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
  s.operatingIncomeToday = 0;
  if (mode === "scenario") {
    s.cash = SCENARIOS[scenario].cash;
    if (scenario === "lakeside") {
      s.buildings = s.buildings.filter((b) => b.kind !== "coaster");
      for (let y = 21; y < 28; y++)
        for (let x = 20; x < 28; x++)
          if ((x - 24) ** 2 / 15 + (y - 24) ** 2 / 9 < 1 && s.tiles[y][x] === "grass") {
            s.buildings = s.buildings.filter(
              (b) => !(b.x === x && b.y === y && decorative(b.kind)),
            );
            if (!occupant(s, x, y)) s.tiles[y][x] = "water";
          }
    }
    if (scenario === "summit")
      s.buildings = s.buildings.filter((b) => !["wheel", "carousel"].includes(b.kind));
  }
  return s;
}
function choose(s: Park, g: Guest, net: Set<string>) {
  const options = s.buildings.filter(
    (b) =>
      b.open &&
      !decorative(b.kind) &&
      access(s, b, net) &&
      b.price <= (g.wallet ?? 60) &&
      (!isRide(b.kind) || b.tested) &&
      b.queue.length < (isRide(b.kind) ? queueCapacity(s, b) : 6),
  );
  const ranked = options
    .map((b) => ({ b, score: guestScore(b, g) + Math.random() * 1.4 }))
    .filter((o) => o.score > -0.5)
    .sort((a, b) => b.score - a.score);
  if (
    !s.open ||
    g.rides >= 5 ||
    g.happiness < 25 ||
    (g.wallet ?? 60) < 3 ||
    (s.time > 30 && !ranked.length)
  ) {
    g.state = "leave";
    g.route = findRoute(s, g, ENTRANCE);
    g.target = null;
    g.thought =
      (g.wallet ?? 60) < 3
        ? "Mein Ausflugsbudget ist aufgebraucht."
        : !ranked.length
          ? "Preise, Wartezeit oder Fahrten passen heute nicht zu mir."
          : "Zeit, nach Hause zu gehen.";
    return;
  }
  const b = ranked[0]?.b;
  if (!b) {
    g.timer = 3;
    g.thought = "Ich suche eine passende, offene Attraktion.";
    return;
  }
  g.route = findRoute(s, g, access(s, b, net)!);
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
  migratePark(s);
  const research = s.research!;
  if (research.active) {
    research.remaining = Math.max(0, research.remaining - dt);
    if (research.remaining === 0) {
      research.completed.push(research.active);
      research.active = null;
    }
  }
  const oldDay = Math.floor(s.time / 90);
  s.time += dt;
  const net = connected(s);
  const active = s.buildings.filter((b) => b.open && !decorative(b.kind) && access(s, b, net));
  s.spawnClock += dt;
  const interval = Math.max(
    2.2,
    4.5 - active.filter((b) => isRide(b.kind)).length * 0.2 + (100 - s.rating) * 0.035,
  );
  if (s.open && s.spawnClock >= interval && s.guests.length < 220) {
    s.spawnClock = 0;
    if (Math.random() < entryDemand(s)) newGuest(s);
  }
  for (const b of s.buildings) {
    if (b.testing) {
      b.testDuration ??= b.testing;
      b.testing = Math.max(0, b.testing - dt);
      if (b.testing === 0) b.tested = true;
    }
    if (b.autoOpen && b.tested && access(s, b, net)) {
      b.open = true;
      b.autoOpen = false;
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
          if (isRide(b.kind)) {
            g.rides++;
            (g.visited ??= []).push(b.id);
            g.visited = g.visited.slice(-8);
            const appeal = rideAppeal(b, g.profile),
              change = (appeal - 4) * 2 - b.price * 0.12;
            g.happiness = Math.max(0, Math.min(100, g.happiness + change));
            g.thought =
              change > 2
                ? "Genau mein Geschmack – diese Fahrt hat sich gelohnt!"
                : change < 0
                  ? "Die Fahrt war für mich zu heftig, zu zahm oder zu teuer."
                  : "Eine nette Runde.";
          } else {
            if (b.kind === "burger") g.hunger = 0;
            if (b.kind === "drink") g.thirst = 0;
            if (b.kind === "toilet") g.bladder = 0;
            const price = g.servicePrice ?? Math.min(b.price, g.wallet ?? 60);
            g.servicePrice = undefined;
            g.wallet = Math.max(0, (g.wallet ?? 60) - price);
            b.served++;
            b.revenue += price;
            s.cash += price;
            s.income += price;
            s.dayIncome += price;
            s.operatingIncomeToday! += price;
            const supplies = b.kind === "burger" ? 3 : b.kind === "drink" ? 1.5 : 0.4;
            s.cash -= supplies;
            s.expenses += supplies;
            s.dayExpenses += supplies;
            s.operatingExpensesToday! += supplies;
            g.happiness = Math.min(100, g.happiness + (b.kind === "toilet" ? 1 : 4));
            g.thought =
              b.kind === "burger"
                ? "Frisch zubereitet – jetzt bin ich satt."
                : b.kind === "drink"
                  ? "Endlich ein kühles Getränk!"
                  : "Eine erholsame Pause.";
          }
        }
      }
      b.riders = [];
    }
    if (!b.riders.length && b.queue.length && b.cycle <= 0) {
      b.riders = [];
      while (b.queue.length && b.riders.length < rideCapacity(b)) {
        const id = b.queue.shift()!,
          g = s.guests.find((g) => g.id === id);
        if (!g) continue;
        if ((g.wallet ?? 60) < b.price) {
          g.state = "walk";
          g.target = null;
          g.timer = 1;
          g.thought = "Der neue Preis übersteigt mein Budget.";
          continue;
        }
        b.riders.push(id);
        g.state = "ride";
        if (!isRide(b.kind)) g.servicePrice = b.price;
        if (isRide(b.kind)) {
          g.wallet = Math.max(0, (g.wallet ?? 60) - b.price);
          b.served++;
          b.revenue += b.price;
          s.cash += b.price;
          s.income += b.price;
          s.dayIncome += b.price;
          s.operatingIncomeToday! += b.price;
        }
      }
      b.cycle = b.riders.length ? rideDuration(b) : 0;
    }
  }
  for (const g of s.guests) {
    g.hunger = Math.min(100, g.hunger + dt * 0.14);
    g.thirst = Math.min(100, g.thirst + dt * 0.2);
    g.bladder = Math.min(100, (g.bladder ?? 10) + dt * 0.17);
    g.happiness = Math.max(
      0,
      g.happiness - dt * (g.hunger > 70 || g.thirst > 70 || (g.bladder ?? 0) > 80 ? 0.22 : 0.012),
    );
    if (g.state === "ride") continue;
    if (g.state === "queue") {
      g.timer += dt;
      if (g.timer > 30) {
        g.happiness -= dt * 0.15;
        g.thought = "Die Schlange ist ganz schön lang.";
      }
      const patience = g.profile === "thrill" ? 80 : g.profile === "family" ? 55 : 65;
      if (g.timer > patience) {
        const b = s.buildings.find((b) => b.id === g.target);
        if (b) b.queue = b.queue.filter((id) => id !== g.id);
        g.state = "walk";
        g.target = null;
        g.timer = 2;
        g.thought = "Zu lange gewartet. Ich suche etwas anderes.";
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
        step = dt * (1 + (g.id % 7) * 0.065);
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
        if (
          (g.wallet ?? 60) >= b.price &&
          b.queue.length < (isRide(b.kind) ? queueCapacity(s, b) : 6)
        ) {
          b.queue.push(g.id);
          g.state = "queue";
          g.timer = 0;
          g.thought = `Ich warte auf ${b.name}.`;
          continue;
        }
        g.thought = "Hier ist die Schlange voll oder der Preis zu hoch.";
        g.timer = 2;
      }
      g.target = null;
    } else choose(s, g, net);
  }
  s.guests = s.guests.filter((g) => g.timer !== -999);
  if (s.guests.length)
    s.rating = Math.round(s.guests.reduce((a, g) => a + g.happiness, 0) / s.guests.length);
  if (Math.floor(s.time / 90) !== oldDay) {
    const cost =
      s.staff * 80 +
      s.buildings
        .filter((b) => !decorative(b.kind))
        .reduce(
          (a, b) =>
            a +
            Math.round(
              (b.track ? trackCost(b.track) : CATALOG[b.kind].cost) * 0.022 * (b.open ? 1 : 0.25),
            ),
          0,
        );
    s.cash -= cost;
    s.expenses += cost;
    s.dayExpenses += cost;
    s.operatingExpensesToday! += cost;
    s.operatingProfit = s.operatingIncomeToday! - s.operatingExpensesToday!;
    s.operatingIncomeToday = 0;
    s.operatingExpensesToday = 0;
    s.lastProfit = s.dayIncome - s.dayExpenses;
    s.dayIncome = 0;
    s.dayExpenses = 0;
    const staffing = Math.min(1, s.staff / Math.max(1, s.guests.length / 25));
    for (const g of s.guests) {
      const nearby = s.buildings.filter(
        (b) => decorative(b.kind) && Math.hypot(b.x - g.x, b.y - g.y) < 4,
      ).length;
      g.happiness = Math.max(0, Math.min(100, g.happiness + (nearby ? 1 : 0) - (1 - staffing) * 3));
    }
  }
  const goal = scenarioOf(s),
    openRides = s.buildings.filter(
      (b) => isRide(b.kind) && b.open && b.tested && access(s, b, net),
    );
  if (
    !s.won &&
    s.arrivals >= goal.arrivals &&
    s.rating >= goal.rating &&
    openRides.length >= goal.rides &&
    (!goal.value || parkValue(s) >= goal.value) &&
    (!goal.profit || (s.operatingProfit ?? 0) >= goal.profit) &&
    openRides.filter((b) => b.kind === "coaster").length >= goal.coasters
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
    const trackPoint = (p: Point) =>
      p &&
      (p.smooth === undefined || typeof p.smooth === "boolean") &&
      (p.inversion === undefined || typeof p.inversion === "boolean") &&
      (p.heading === undefined || num(p.heading)) &&
      (p.style === undefined || ["steel", "wood", "launch"].includes(p.style)) &&
      (p.smooth
        ? num(p.x) &&
          num(p.y) &&
          inBounds(p.x, p.y) &&
          num(p.z) &&
          p.z! >= 0 &&
          p.z! <= (p.style === "wood" ? 4 : 8) &&
          !(p.style === "wood" && p.inversion)
        : point(p));
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
    if (
      s.scenario !== undefined &&
      (typeof s.scenario !== "string" || !Object.hasOwn(SCENARIOS, s.scenario))
    )
      return false;
    if (s.research !== undefined) {
      const r = s.research;
      if (
        !r ||
        !Array.isArray(r.completed) ||
        !r.completed.every((id) => typeof id === "string" && Object.hasOwn(RESEARCH, id)) ||
        new Set(r.completed).size !== r.completed.length ||
        !(
          r.active === null ||
          (typeof r.active === "string" && Object.hasOwn(RESEARCH, r.active))
        ) ||
        !num(r.remaining) ||
        r.remaining < 0 ||
        r.remaining > 180 ||
        (r.active !== null && r.completed.includes(r.active))
      )
        return false;
    }
    if (s.draft !== undefined) {
      const d = s.draft;
      if (
        !d ||
        (d.piece !== undefined &&
          !["straight", "rise", "fall", "left", "right", "loop"].includes(d.piece)) ||
        !Array.isArray(d.track) ||
        d.track.length > 2048 ||
        !d.track.every(trackPoint) ||
        !Array.isArray(d.history) ||
        d.history.length > 128 ||
        !d.history.every((n) => Number.isInteger(n) && n >= 0 && n < d.track.length) ||
        typeof d.style !== "string" ||
        !Object.hasOwn(COASTER_TYPES, d.style) ||
        !Number.isInteger(d.rotation) ||
        d.rotation < 0 ||
        d.rotation > 3
      )
        return false;
    }
    if (
      [s.operatingIncomeToday, s.operatingExpensesToday, s.operatingProfit].some(
        (v) => v !== undefined && !num(v),
      )
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
        (b.autoOpen !== undefined && typeof b.autoOpen !== "boolean") ||
        (b.testing !== undefined && (!num(b.testing) || b.testing < 0 || b.testing > 3600)) ||
        (b.testDuration !== undefined &&
          (!num(b.testDuration) || b.testDuration < 0 || b.testDuration > 3600)) ||
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
          (!Array.isArray(b.track) ||
            b.track.length < 9 ||
            b.track.length > 2048 ||
            !b.track.every(trackPoint)))
      )
        return false;
      if (b.track) {
        const t = b.track,
          first = t[0],
          last = t.at(-1)!;
        if (first.x !== last.x || first.y !== last.y || (first.z ?? 0) !== (last.z ?? 0))
          return false;
        let length = 0;
        for (let i = 1; i < t.length; i++) {
          const a = t[i - 1],
            p = t[i],
            distance = Math.hypot(p.x - a.x, p.y - a.y, (p.z ?? 0) - (a.z ?? 0));
          if (distance < 1e-8 || distance > (first.smooth ? 1.5 : Math.SQRT2 + 0.001)) return false;
          length += distance;
        }
        if (length < 8) return false;
      }
      ids.add(b.id);
    }
    const buildingIds = new Set(ids);
    for (const g of s.guests) {
      if (
        !g ||
        (g.profile !== undefined && !["family", "thrill", "budget"].includes(g.profile)) ||
        (g.servicePrice !== undefined &&
          (!num(g.servicePrice) || g.servicePrice < 0 || g.servicePrice > 30)) ||
        (g.bladder !== undefined && (!num(g.bladder) || g.bladder < 0 || g.bladder > 100)) ||
        (g.wallet !== undefined && (!num(g.wallet) || g.wallet < 0 || g.wallet > 200)) ||
        (g.visited !== undefined &&
          (!Array.isArray(g.visited) ||
            g.visited.length > 8 ||
            !g.visited.every(Number.isInteger))) ||
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

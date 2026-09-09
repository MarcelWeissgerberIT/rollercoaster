/** Ready-made campaign parks, with reachable entrances and fresh operating balances. */
import type { Park, Building, Guest, Kind, ResearchId } from "./simulation";
export type CampaignId = "ruinenpark" | "grosspark" | "zoo";
export type CampaignDeps = {
  build: (s: Park, kind: Kind, x: number, y: number) => { id?: number; error?: string };
  /** Pass the existing private newGuest function. Final balances are reset after seeding. */
  newGuest: (s: Park) => Guest;
};
export const CAMPAIGN_LAYOUTS = {
  ruinenpark: {
    size: 30,
    cash: 8000,
    guests: 24,
    staff: 1,
    litter: 25,
    open: false,
    rating: 40,
    research: ["family"],
  },
  grosspark: {
    size: 42,
    cash: 12000,
    guests: 120,
    staff: 2,
    litter: 80,
    open: true,
    rating: 64,
    research: ["family", "thrill", "festival", "orbital", "transport"],
  },
  zoo: {
    size: 36,
    cash: 22000,
    guests: 28,
    staff: 1,
    litter: 0,
    open: true,
    rating: 80,
    research: ["zoo"],
  },
} as const;
/** These areas remain empty and ready for the two researched additions. */
export const ZOO_RESERVED = [
  { kind: "giraffe", x: 5, y: 16, size: 6, frontage: 24 },
  { kind: "penguin", x: 23, y: 18, size: 4, frontage: 24 },
] as const;
const sizeOf: Partial<Record<Kind, number>> = {
  wheel: 3,
  carousel: 2,
  swing: 3,
  drop: 2,
  pirate: 3,
  teacups: 3,
  spinner: 3,
  zebra: 5,
  giraffe: 6,
  flamingo: 4,
  penguin: 4,
  keeperhut: 2,
};
const own = (x: number, y: number, b: { x: number; y: number; kind: Kind }) =>
  x >= b.x && y >= b.y && x < b.x + (sizeOf[b.kind] ?? 1) && y < b.y + (sizeOf[b.kind] ?? 1);
/** Returns false for established scenarios without mutating them. Initialization-only; not a live editor. */
export function populateCampaign(s: Park, id: string, deps: CampaignDeps): boolean {
  if (!Object.hasOwn(CAMPAIGN_LAYOUTS, id)) return false;
  const key = id as CampaignId,
    cfg = CAMPAIGN_LAYOUTS[key],
    mode = s.mode;
  s.tiles = Array.from({ length: cfg.size }, () =>
    Array<Park["tiles"][number][number]>(cfg.size).fill("grass"),
  );
  s.buildings = [];
  s.guests = [];
  s.nextId = 1;
  s.time = 0;
  s.speed = 1;
  s.arrivals = 0;
  s.spawnClock = 0;
  s.won = false;
  s.draft = undefined;
  s.trackEdit = undefined;
  s.transitLines = [];
  s.marketing = undefined;
  s.cleanliness = undefined;
  s.zoo = undefined;
  s.landValue = 0;
  s.staff = cfg.staff;
  s.open = cfg.open;
  s.ticket = key === "ruinenpark" ? 3 : key === "grosspark" ? 9 : 4;
  s.research = { completed: [...cfg.research] as ResearchId[], active: null, remaining: 0 };
  s.scenario = key;
  // Reuse normal building construction/footprint checks; initial assets cost the player nothing.
  s.mode = "sandbox";
  s.cash = 1e9;
  const path = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= cfg.size || y >= cfg.size)
      throw Error(`Scenario path out of bounds ${x},${y}`);
    s.tiles[y][x] = "path";
  };
  const horizontal = (y: number, x1: number, x2: number) => {
    for (let x = x1; x <= x2; x++) path(x, y);
  };
  const vertical = (x: number, y1: number, y2: number) => {
    for (let y = y1; y <= y2; y++) path(x, y);
  };
  const rows = key === "ruinenpark" ? [10, 20] : key === "grosspark" ? [10, 20, 30] : [12, 24];
  const left = 3,
    right = cfg.size - 4;
  rows.forEach((y) => horizontal(y, left, right));
  vertical(15, rows[0], Math.max(29, rows.at(-1)! + 4));
  vertical(left, rows[0], rows.at(-1)!);
  vertical(right, rows[0], rows.at(-1)!);
  path(15, 29); // Entrance stays here even on 36/42-tile maps.
  function place(
    kind: Kind,
    x: number,
    y: number,
    condition = 100,
    open = true,
    name?: string,
  ): Building {
    const result = deps.build(s, kind, x, y);
    if (result.error || !result.id)
      throw Error(`${key}: cannot place ${kind}@${x},${y}: ${result.error ?? "missing id"}`);
    const b = s.buildings.find((b) => b.id === result.id)!;
    b.condition = condition;
    b.open = open;
    b.tested = true;
    b.autoOpen = false;
    if (name) b.name = name;
    return b;
  }
  function attraction(
    kind: Kind,
    x: number,
    frontage: number,
    condition = 100,
    open = true,
    name?: string,
  ) {
    const size = sizeOf[kind] ?? 1,
      y = frontage - size - 2,
      b = place(kind, x, y, condition, open, name);
    b.pods = { entry: { side: 1, offset: 0 }, exit: { side: 1, offset: size - 1 } };
    for (let yy = y + size; yy < frontage; yy++) {
      s.tiles[yy][x] = "queue";
      s.tiles[yy][x + size - 1] = "exit";
    }
    return b;
  }
  const shop = (kind: Kind, x: number, y: number, condition = 100) => {
    const b = place(kind, x, y, condition);
    path(x < 15 ? 14 : 16, y);
    return b;
  };
  const bin = (x: number, y: number, full = false) => {
    const b = place("bin", x, y);
    b.binFill = full ? 16 : 0;
  };
  if (key === "ruinenpark") {
    attraction("wheel", 5, 10, 20, false, "Rosenrad");
    attraction("carousel", 20, 10, 65, true, "Das letzte Karussell");
    attraction("pirate", 5, 20, 35, false, "Verlassene Piratenbucht");
    attraction("swing", 20, 20, 45, false, "Alter Wellenflug");
    shop("burger", 13, 24, 55);
    shop("drink", 17, 24, 50);
    shop("toilet", 13, 27, 40);
    bin(10, 11, true);
    bin(18, 21, true);
    place("bench", 16, 27);
    place("flowers", 14, 22);
  } else if (key === "grosspark") {
    attraction("wheel", 5, 10, 88, true, "Festival-Panoramarad");
    attraction("carousel", 22, 10, 92, true, "Blütenkarussell");
    attraction("swing", 32, 10, 85, true, "Sternenflug");
    attraction("drop", 5, 20, 87, true, "Festivalsturz");
    attraction("pirate", 22, 20, 89, true, "Hafenpiraten");
    attraction("teacups", 32, 20, 90, true, "Tassenparty");
    attraction("spinner", 5, 30, 86, true, "Orbitalbühne");
    attraction("carousel", 22, 30, 91, true, "Abendkarussell");
    for (const [kind, x, y] of [
      ["burger", 13, 13],
      ["drink", 17, 13],
      ["toilet", 13, 16],
      ["burger", 17, 23],
      ["drink", 13, 23],
      ["toilet", 17, 26],
      ["balloon", 13, 33],
      ["plush", 17, 33],
    ] as const)
      shop(kind, x, y, 92);
    for (const [x, y] of [
      [10, 11],
      [27, 11],
      [35, 11],
      [10, 21],
      [27, 21],
      [35, 21],
      [10, 31],
      [27, 31],
    ])
      bin(x, y, true);
    for (const [x, y] of [
      [14, 12],
      [16, 17],
      [14, 22],
      [16, 27],
      [14, 32],
    ])
      place("bench", x, y);
  } else {
    const zebra = attraction("zebra", 5, 12, 100, true, "Zebras der Savanne");
    const flamingo = attraction("flamingo", 23, 12, 100, true, "Flamingo-Lagune");
    zebra.habitat = {
      count: 2,
      food: 90,
      water: 90,
      clean: 90,
      health: 90,
      enrichment: false,
      shelter: false,
    };
    flamingo.habitat = {
      count: 4,
      food: 90,
      water: 90,
      clean: 90,
      health: 90,
      enrichment: false,
      shelter: false,
    };
    shop("keeperhut", 17, 26);
    shop("burger", 13, 16);
    shop("drink", 17, 16);
    shop("toilet", 13, 27);
    s.zoo = { keepers: 1, workers: [], nextId: 1 };
    bin(11, 13);
    bin(28, 13);
    bin(11, 25);
    bin(28, 25);
    place("bench", 14, 20);
    place("bench", 16, 30);
  }
  // Sparse scenery, never over a path/building or the two expansion habitat footprints/frontages.
  for (let y = 2; y < cfg.size - 2; y += 5)
    for (let x = 1; x < cfg.size - 1; x += cfg.size - 3) {
      const reserved =
        key === "zoo" &&
        ZOO_RESERVED.some((r) => x >= r.x && x < r.x + r.size && y >= r.y && y <= r.frontage);
      if (!reserved && s.tiles[y][x] === "grass" && !s.buildings.some((b) => own(x, y, b)))
        place((x + y) % 2 ? "tree" : "pine", x, y);
    }
  const walk = s.tiles.flatMap((row, y) =>
    row.flatMap((tile, x) => (tile === "path" ? [{ x, y }] : [])),
  );
  s.cleanliness = {
    version: 1,
    nextId: cfg.litter + 1,
    litter: [],
    workers: [],
    binned: 0,
    cleaned: 0,
    emptied: 0,
  };
  for (let i = 0; i < cfg.litter; i++) {
    const p = walk[(i * 37 + 11) % walk.length];
    s.cleanliness.litter.push({ id: i + 1, ...p, kind: i % 2 ? "cup" : "wrapper", amount: 1 });
  }
  // One canonical guest constructor keeps wallets/profiles/names/new fields consistent with future saves.
  for (let i = 0; i < cfg.guests; i++) {
    const g = deps.newGuest(s),
      p = walk[(i * 19 + 7) % walk.length];
    g.x = p.x;
    g.y = p.y;
    g.happiness =
      key === "ruinenpark" ? 38 + (i % 9) : key === "grosspark" ? 61 + (i % 8) : 80 + (i % 6);
    g.hunger =
      key === "ruinenpark" ? 45 + (i % 30) : key === "grosspark" ? 20 + (i % 55) : 10 + (i % 20);
    g.thirst =
      key === "ruinenpark" ? 40 + (i % 35) : key === "grosspark" ? 20 + (i % 60) : 10 + (i % 20);
    g.thought =
      key === "ruinenpark"
        ? "Früher war es hier schöner. Hoffentlich wird der Park gerettet."
        : key === "grosspark"
          ? "Tolles Festival, aber die Wege müssen dringend sauber werden."
          : "Ich möchte die Tiere sehen!";
    g.target = null;
    g.route = [];
    g.state = "walk";
    g.timer = (i % 8) * 0.12;
  }
  s.mode = mode;
  s.cash = cfg.cash;
  s.rating = cfg.rating;
  s.arrivals = cfg.guests;
  s.income = 0;
  s.expenses = 0;
  s.dayIncome = 0;
  s.dayExpenses = 0;
  s.lastProfit = 0;
  s.operatingIncomeToday = 0;
  s.operatingExpensesToday = 0;
  s.operatingProfit = 0;
  return true;
}

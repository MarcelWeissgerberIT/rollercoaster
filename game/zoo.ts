/** Zoo simulation. dt is already speed-scaled; caller passes no positive dt while paused.
 * Capital/adoption and service costs are charged here. Wages (90/keeper/day,
 * 150/specialist/day) and
 * SPECIES.upkeep are charged ONLY by the caller's existing daily economy. */
import type { Park, Building, Point } from "./simulation";
import {
  HABITAT_PROFILES,
  SPECIALIST_ROLES,
  type HabitatFeatureId,
  type SpecialistRole,
} from "./habitat-needs";
export { SPECIALIST_ROLES, type SpecialistRole } from "./habitat-needs";

export const SPECIES = {
  elephant: {
    name: "Elefantengehege",
    animalName: "Elefant",
    size: 7,
    cost: 6200,
    adoption: 1600,
    capacity: 3,
    upkeep: 26,
    description: "Große Wasserstelle, Futter und Platz für bis zu drei Elefanten.",
    sprite: "elephant-se",
  },
  lion: {
    name: "Löwenanlage",
    animalName: "Löwe",
    size: 6,
    cost: 5100,
    adoption: 1300,
    capacity: 4,
    upkeep: 23,
    description:
      "Ein Löwe und bis zu drei Löwinnen mit Felshöhlen, Beschäftigung und Raubtierpflege.",
    sprite: "lion-se",
  },
  panda: {
    name: "Pandagehege",
    animalName: "Panda",
    size: 5,
    cost: 4900,
    adoption: 1400,
    capacity: 3,
    upkeep: 21,
    description: "Schattiger Bambusgarten für bis zu drei Pandas.",
    sprite: "panda-se",
  },
  zebra: {
    name: "Zebragehege",
    animalName: "Zebra",
    size: 5,
    cost: 3600,
    adoption: 900,
    capacity: 4,
    upkeep: 14,
    sprite: "zebra-se",
    description:
      "Offene Savanne für bis zu vier Zebras. Futter, Wasser und Rückzug sichern das Tierwohl.",
  },
  giraffe: {
    name: "Giraffengehege",
    animalName: "Giraffe",
    size: 6,
    cost: 5200,
    adoption: 1400,
    capacity: 3,
    upkeep: 20,
    sprite: "giraffe-se",
    description: "Großes Savannengehege für bis zu drei Giraffen mit hohen Futterstellen.",
  },
  flamingo: {
    name: "Flamingoteich",
    animalName: "Flamingo",
    size: 4,
    cost: 2300,
    adoption: 260,
    capacity: 6,
    upkeep: 9,
    sprite: "flamingo-se",
    description: "Flache Wasserflächen und Rückzug für bis zu sechs Flamingos.",
  },
  penguin: {
    name: "Pinguinanlage",
    animalName: "Pinguin",
    size: 4,
    cost: 3200,
    adoption: 380,
    capacity: 6,
    upkeep: 13,
    sprite: "penguin-se",
    description: "Sauberes Wasser und geschützte Plätze für bis zu sechs Pinguine.",
  },
} as const;
export type Species = keyof typeof SPECIES;
export type Habitat = {
  accessVersion?: 1;
  viewpoint?: Point;
  count: number;
  food: number;
  water: number;
  clean: number;
  health: number;
  enrichment: boolean;
  shelter: boolean;
  features?: HabitatFeatureId[];
  safety?: { condition: number; electric: boolean; electricInstalled?: boolean };
};
export type Keeper = {
  id: number;
  role?: SpecialistRole;
  /** Omitted means automatic job selection; qualification is always kept in role. */
  assignedHabitatId?: number;
  x: number;
  y: number;
  homeId: number;
  targetId: number | null;
  route: Point[];
  mode: "idle" | "walk" | "care";
  workLeft: number;
  retry: number;
};
export type ZooState = {
  keepers: number;
  workers: Keeper[];
  nextId: number;
  specialists?: Partial<Record<SpecialistRole, number>>;
};
export type ZooBuilding = Building & { habitat?: Habitat };
export type ZooPark = Park & { zoo?: ZooState };
export type ZooAccess = (s: Park, b: Building) => Point | null | undefined;
export const KEEPER_WAGE = 90;
export const ZOO_SPECIALIST_WAGE = 150;
export const ELECTRIC_FENCE_COST = 800;
export const HABITAT_INSPECTION_COST = 120;
export const KEEPER_HUT_SIZE = 2;
export const CARE_PER_ANIMAL = 8;
export const isHabitat = (kind: string): kind is Species => Object.hasOwn(SPECIES, kind);
const dirs = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const key = (p: Point) => `${p.x},${p.y}`;
const cell = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });
const equal = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const within = (s: Park, p: Point) =>
  p.x >= 0 && p.y >= 0 && p.y < s.tiles.length && p.x < (s.tiles[p.y]?.length ?? 0);
const walkway = (s: Park, p: Point) =>
  within(s, p) && ["path", "queue"].includes(s.tiles[p.y][p.x]);
const cap = (v: number) => Math.max(0, Math.min(100, v));
const habitats = (s: Park) => s.buildings.filter((b) => isHabitat(b.kind)) as ZooBuilding[];
function network(s: Park): Set<string> {
  const start = { x: 15, y: 29 },
    seen = new Set<string>();
  if (!walkway(s, start)) return seen;
  const queue = [start];
  seen.add(key(start));
  for (let i = 0; i < queue.length; i++)
    for (const [dx, dy] of dirs) {
      const p = { x: queue[i].x + dx, y: queue[i].y + dy };
      if (walkway(s, p) && !seen.has(key(p))) {
        seen.add(key(p));
        queue.push(p);
      }
    }
  return seen;
}
function exterior(b: Building, p: Point, size: number): boolean {
  return (
    ((p.x === b.x - 1 || p.x === b.x + size) && p.y >= b.y && p.y < b.y + size) ||
    ((p.y === b.y - 1 || p.y === b.y + size) && p.x >= b.x && p.x < b.x + size)
  );
}
function port(s: Park, b: Building, net: Set<string>, access?: ZooAccess): Point | undefined {
  const size = isHabitat(b.kind) ? SPECIES[b.kind].size : KEEPER_HUT_SIZE;
  const valid = (p: Point | null | undefined): p is Point =>
    !!p &&
    Number.isInteger(p.x) &&
    Number.isInteger(p.y) &&
    exterior(b, p, size) &&
    walkway(s, p) &&
    (!isHabitat(b.kind) || s.tiles[p.y][p.x] === "path") &&
    net.has(key(p));
  if (access) {
    const p = access(s, b);
    return valid(p) ? { x: p.x, y: p.y } : undefined;
  }
  // Honor an explicitly selected entry; never silently route around the other side.
  if (b.pods && !isHabitat(b.kind)) {
    const p = b.pods.entry;
    const v =
      p.side === 0
        ? { x: b.x + size, y: b.y + p.offset }
        : p.side === 1
          ? { x: b.x + p.offset, y: b.y + size }
          : p.side === 2
            ? { x: b.x - 1, y: b.y + p.offset }
            : { x: b.x + p.offset, y: b.y - 1 };
    return valid(v) ? v : undefined;
  }
  for (let i = 0; i < size; i++)
    for (const p of [
      { x: b.x + i, y: b.y + size },
      { x: b.x - 1, y: b.y + i },
      { x: b.x + size, y: b.y + i },
      { x: b.x + i, y: b.y - 1 },
    ])
      if (valid(p)) return p;
  return undefined;
}
export function ensureHabitat(b: Building): Habitat | undefined {
  if (!isHabitat(b.kind)) return undefined;
  return ((b as ZooBuilding).habitat ??= {
    count: 0,
    food: 100,
    water: 100,
    clean: 100,
    health: 100,
    enrichment: false,
    shelter: false,
  });
}
function reset(w: Keeper, retry = 1) {
  w.targetId = null;
  w.route = [];
  w.mode = "idle";
  w.workLeft = 0;
  w.retry = retry;
}
function reconcile(s: ZooPark, net: Set<string>, access?: ZooAccess): ZooState {
  const z = (s.zoo ??= { keepers: 0, workers: [], nextId: 1 });
  for (const b of habitats(s)) ensureHabitat(b);
  const homes = s.buildings
    .filter((b) => (b.kind as string) === "keeperhut")
    .flatMap((b) => {
      const p = port(s, b, net, access);
      return p ? [{ b, p }] : [];
    });
  const roles: Array<SpecialistRole | undefined> = Array.from(
    { length: z.keepers },
    () => undefined,
  );
  for (const role of Object.keys(SPECIALIST_ROLES) as SpecialistRole[])
    for (let i = 0; i < (z.specialists?.[role] ?? 0); i++) roles.push(role);
  if (!homes.length) {
    z.workers = [];
    return z;
  }
  const remaining = [...z.workers];
  z.workers = roles.map((role, index) => {
    const existing = remaining.findIndex((w) => w.role === role);
    const w = existing >= 0 ? remaining.splice(existing, 1)[0] : undefined;
    const home = homes.find((h) => h.b.id === w?.homeId) ?? homes[index % homes.length];
    if (w) {
      if (w.assignedHabitatId !== undefined) {
        const assignment = s.buildings.find((b) => b.id === w.assignedHabitatId);
        if (!assignment || !canWorkAt(w, assignment)) {
          delete w.assignedHabitatId;
          reset(w, 0);
        } else if (w.targetId !== null && w.targetId !== assignment.id) reset(w, 0);
      }
      if (w.homeId !== home.b.id || !net.has(key(cell(w)))) {
        reset(w);
        w.homeId = home.b.id;
        w.x = home.p.x;
        w.y = home.p.y;
      }
      return w;
    }
    return {
      id: z.nextId++,
      ...(role ? { role } : {}),
      ...home.p,
      homeId: home.b.id,
      targetId: null,
      route: [],
      mode: "idle" as const,
      workLeft: 0,
      retry: 0,
    };
  });
  return z;
}
/** Missing legacy state is optional and initializes empty; new habitats contain no animals. */
export function initZoo(s: ZooPark): ZooState {
  return reconcile(s, network(s));
}
export function welfare(b: Building): number {
  const h = (b as ZooBuilding).habitat;
  if (!isHabitat(b.kind) || !h?.count) return 100;
  return Math.round(
    cap(
      h.food * 0.19 +
        h.water * 0.19 +
        h.clean * 0.15 +
        h.health * 0.27 +
        (20 * HABITAT_PROFILES[b.kind].features.filter((f) => habitatHasFeature(b, f.id)).length) /
          HABITAT_PROFILES[b.kind].features.length,
    ),
  );
}
export function zooAppeal(b: Building, guestProfile?: Park["guests"][number]["profile"]): number {
  const h = (b as ZooBuilding).habitat;
  if (!isHabitat(b.kind) || !h?.count || h.health < 30 || habitatSafety(b).status === "closed")
    return 0;
  return Math.max(
    0,
    ((3.8 +
      (b.kind === "panda" ? 1 : (2 * h.count) / SPECIES[b.kind].capacity) +
      (guestProfile === "family" ? 1.8 : guestProfile === "thrill" ? -0.6 : 0.5)) *
      welfare(b)) /
      100,
  );
}
export function zooStats(s: Park, access?: ZooAccess) {
  const net = network(s);
  const list = habitats(s),
    occupied = list.filter((b) => (b.habitat?.count ?? 0) > 0),
    count = occupied.reduce((n, b) => n + b.habitat!.count, 0);
  return {
    species: new Set(occupied.map((b) => b.kind)).size,
    count,
    welfare: count
      ? Math.round(occupied.reduce((n, b) => n + welfare(b) * b.habitat!.count, 0) / count)
      : 100,
    healthyOpen: new Set(
      occupied
        .filter(
          (b) =>
            b.open &&
            b.habitat!.health >= 55 &&
            welfare(b) >= 55 &&
            habitatSafety(b).status !== "closed" &&
            port(s, b, net, access),
        )
        .map((b) => b.kind),
    ).size,
    habitats: list.length,
    keepers: (s as ZooPark).zoo?.keepers ?? 0,
    specialists: Object.values((s as ZooPark).zoo?.specialists ?? {}).reduce((a, n) => a + n, 0),
    unsafe: occupied.filter((b) => habitatSafety(b).status !== "safe").length,
    working: (s as ZooPark).zoo?.workers.filter((w) => w.mode !== "idle").length ?? 0,
  };
}
/** Legacy generic upgrades map to the first matching species-specific feature. */
export function habitatHasFeature(b: Building, id: HabitatFeatureId): boolean {
  if (!isHabitat(b.kind)) return false;
  const h = b.habitat;
  if (!h) return false;
  if (h.features?.includes(id)) return true;
  const features = HABITAT_PROFILES[b.kind].features;
  return (
    (h.enrichment && features.find((f) => f.category === "enrichment")?.id === id) ||
    (h.shelter && features.find((f) => f.id === "shelter")?.id === id)
  );
}
export function habitatBarrier(b: Building) {
  return isHabitat(b.kind) ? HABITAT_PROFILES[b.kind].barrier : "wood";
}
export function habitatHasElectric(b: Building): boolean {
  return (
    isHabitat(b.kind) &&
    HABITAT_PROFILES[b.kind].electric &&
    !!b.habitat?.safety?.electric &&
    habitatSafety(b).status !== "closed"
  );
}
export function habitatSafety(b: Building): {
  score: number;
  status: "closed" | "warning" | "safe";
  label: string;
} {
  const condition = b.habitat?.safety?.condition ?? 100;
  return {
    score: Math.round(condition),
    status: condition < 30 ? "closed" : condition < 60 ? "warning" : "safe",
    label:
      condition < 30
        ? "Sicherheitsstopp · Anlage prüfen lassen"
        : condition < 60
          ? "Wartung der Barriere fällig"
          : "Barriere & Schleuse betriebsbereit",
  };
}
function qualified(w: Keeper, b: Building): boolean {
  if (!isHabitat(b.kind)) return false;
  const profile = HABITAT_PROFILES[b.kind];
  return w.role === profile.careGroup || (!w.role && !profile.specialistRequired);
}
function canWorkAt(w: Keeper, b: Building): boolean {
  return isHabitat(b.kind) && (w.role === "technical" || qualified(w, b));
}
function assignedTo(w: Keeper, b: Building): boolean {
  return w.assignedHabitatId === undefined || w.assignedHabitatId === b.id;
}
/** Read-only choices for an existing employee. Empty or closed habitats may be
 * reserved ahead of need; assignment never grants a different qualification. */
export function keeperAssignments(s: Park, worker: Keeper): Building[] {
  const w = s.zoo?.workers.find((w) => w.id === worker.id);
  if (!w) return [];
  const net = network(s),
    home = s.buildings.find((b) => b.id === w.homeId && b.kind === "keeperhut");
  if (!home || !port(s, home, net) || !net.has(key(cell(w)))) return [];
  return habitats(s).filter((b) => canWorkAt(w, b) && !!port(s, b, net));
}
/** Assign an existing qualified employee to one habitat, or null for automatic
 * work. This changes neither role, payroll, identity nor the current position. */
export function assignZooKeeperToHabitat(
  s: Park,
  workerId: number,
  buildingId: number | null,
): string | null {
  const w = s.zoo?.workers.find((w) => w.id === workerId);
  if (!w) return "Dieser Mitarbeiter ist nicht mehr im Team.";
  if (buildingId !== null) {
    const b = s.buildings.find((b) => b.id === buildingId);
    if (!b || !isHabitat(b.kind)) return "Wähle ein vorhandenes Tiergehege.";
    if (!canWorkAt(w, b))
      return `Die Qualifikation dieses Mitarbeiters passt nicht zu ${HABITAT_PROFILES[b.kind].careLabel}.`;
    if (!keeperAssignments(s, w).some((b) => b.id === buildingId))
      return "Für diesen Einsatz fehlen erreichbare Parkwege zwischen Mitarbeiter, Pflegerstation und Gehege.";
  }
  if (w.assignedHabitatId === (buildingId ?? undefined)) return null;
  if (buildingId === null) delete w.assignedHabitatId;
  else w.assignedHabitatId = buildingId;
  // Keep useful work already in progress. A new incompatible job starts from
  // the worker's actual location on the next simulation step, without teleporting.
  if (buildingId !== null && w.targetId !== null && w.targetId !== buildingId) reset(w, 0);
  if (w.targetId === null) w.retry = 0;
  return null;
}
export function habitatCareStatus(s: Park, b: Building) {
  if (!isHabitat(b.kind)) return { qualified: false, staffed: false, label: "Kein Tiergehege" };
  const profile = HABITAT_PROFILES[b.kind],
    net = network(s);
  const workers = s.zoo?.workers ?? [];
  const available = workers.filter((w) => {
    const home = s.buildings.find((home) => home.id === w.homeId && home.kind === "keeperhut");
    return home && assignedTo(w, b) && port(s, home, net) && net.has(key(cell(w)));
  });
  const trained = available.some((w) => w.role === profile.careGroup);
  const staffed = !!port(s, b, net) && available.some((w) => qualified(w, b));
  return {
    qualified: trained,
    staffed,
    label: staffed
      ? trained
        ? `${profile.careLabel} einsatzbereit`
        : "Tierpflege einsatzbereit · Fachpflege verbessert die Betreuung"
      : `${profile.specialistRequired ? profile.careLabel : "Tierpflege"} fehlt, ist anderweitig zugewiesen oder hat keine erreichbare Pflegerstation`,
  };
}
export function habitatRequirements(s: Park, b: Building) {
  if (!isHabitat(b.kind)) return [];
  const profile = HABITAT_PROFILES[b.kind],
    care = habitatCareStatus(s, b),
    net = network(s),
    viewpoint = b.habitat?.viewpoint,
    visitorAccess = viewpoint
      ? Number.isInteger(viewpoint.x) &&
        Number.isInteger(viewpoint.y) &&
        s.tiles[viewpoint.y]?.[viewpoint.x] === "path" &&
        net.has(key(viewpoint))
      : !!port(s, b, net);
  return [
    {
      label: "Erreichbarer Besucherweg",
      met: visitorAccess,
      detail: "Normale Parkwege am äußeren Gehegerand dienen Besuchern und Pflegepersonal.",
    },
    {
      label: profile.specialistRequired ? profile.careLabel : "Tierpflege",
      met: care.staffed,
      detail: care.label,
    },
    {
      label: profile.barrierLabel,
      met: habitatSafety(b).status === "safe",
      detail: habitatSafety(b).label,
    },
    ...profile.features.map((f) => ({
      label: f.label,
      met: habitatHasFeature(b, f.id),
      detail: f.description,
    })),
  ];
}
export function zooWages(s: Park): number {
  return (
    (s.zoo?.keepers ?? 0) * KEEPER_WAGE +
    Object.values(s.zoo?.specialists ?? {}).reduce((a, n) => a + n, 0) * ZOO_SPECIALIST_WAGE
  );
}
export function setZooSpecialists(s: Park, role: SpecialistRole, count: number): string | null {
  if (!Object.hasOwn(SPECIALIST_ROLES, role) || !Number.isInteger(count) || count < 0 || count > 4)
    return "Ungültige Fachpersonal-Anzahl.";
  const z = initZoo(s);
  (z.specialists ??= {})[role] = count;
  initZoo(s);
  return null;
}
export function addHabitatFeature(s: Park, b: Building, id: HabitatFeatureId): string | null {
  if (!s.buildings.includes(b) || !isHabitat(b.kind)) return "Wähle ein Tiergehege.";
  const feature = HABITAT_PROFILES[b.kind].features.find((f) => f.id === id);
  if (!feature) return "Diese Ausstattung passt nicht zu dieser Tierart.";
  if (habitatHasFeature(b, id)) return "Diese Ausstattung ist bereits vorhanden.";
  if (!charge(s, feature.cost)) return "Das Budget reicht für diese Ausstattung nicht.";
  const h = ensureHabitat(b)!;
  (h.features ??= []).push(id);
  if (id === "foraging") h.enrichment = true;
  if (id === "shelter") h.shelter = true;
  return null;
}
export function setHabitatElectric(s: Park, b: Building, enabled: boolean): string | null {
  if (!s.buildings.includes(b) || !isHabitat(b.kind)) return "Wähle ein Tiergehege.";
  if (!HABITAT_PROFILES[b.kind].electric)
    return "Diese Tierart benötigt eine andere Absicherung; ein Elektrozaun ist hier nicht vorgesehen.";
  const h = ensureHabitat(b)!;
  if (!!h.safety?.electric === enabled) return "Die Sicherung ist bereits so eingestellt.";
  if (
    enabled &&
    !s.zoo?.workers.some((w) => {
      const home = s.buildings.find((h) => h.id === w.homeId && h.kind === "keeperhut");
      return w.role === "technical" && home && port(s, home, network(s));
    })
  )
    return "Stelle zuerst Zaun- & Anlagentechnik mit erreichbarer Pflegerstation ein.";
  if (enabled && !port(s, b, network(s)))
    return "Für die Installation fehlt ein erreichbarer Parkweg am Gehege.";
  if (enabled && !h.safety?.electricInstalled && !charge(s, ELECTRIC_FENCE_COST))
    return "Das Budget reicht für die Elektro-Zusatzsicherung nicht.";
  h.safety ??= { condition: 100, electric: false };
  h.safety.electric = enabled;
  if (enabled) h.safety.electricInstalled = true;
  return null;
}
export function inspectHabitat(s: Park, b: Building): string | null {
  if (!s.buildings.includes(b) || !isHabitat(b.kind)) return "Wähle ein Tiergehege.";
  if (!port(s, b, network(s))) return "Für die Sicherheitsprüfung fehlt ein erreichbarer Parkweg.";
  if ((b.habitat?.safety?.condition ?? 100) >= 100)
    return "Die Anlage ist bereits vollständig gewartet.";
  if (!charge(s, HABITAT_INSPECTION_COST, true))
    return "Das Budget reicht für den Fachservice nicht.";
  b.habitat!.safety ??= { condition: 100, electric: false };
  b.habitat!.safety.condition = 100;
  return null;
}
function charge(s: Park, amount: number, operating = false): boolean {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(s.cash) || s.cash < amount)
    return false;
  s.cash -= amount;
  s.expenses += amount;
  s.dayExpenses += amount;
  if (operating) s.operatingExpensesToday = (s.operatingExpensesToday ?? 0) + amount;
  return true;
}
export function adoptAnimal(s: Park, b: Building): string | null {
  if (!s.buildings.includes(b) || !isHabitat(b.kind)) return "Wähle ein Tiergehege.";
  const h = ensureHabitat(b)!;
  if (h.count >= SPECIES[b.kind].capacity) return "Dieses Gehege ist voll.";
  if (h.count && (h.health < 40 || Math.min(h.food, h.water, h.clean) < 20))
    return "Versorge zuerst die vorhandenen Tiere.";
  if (!charge(s, SPECIES[b.kind].adoption)) return "Das Budget reicht für dieses Tier nicht.";
  h.count++;
  return null;
}
export function upgradeHabitat(
  s: Park,
  b: Building,
  upgrade: "enrichment" | "shelter",
): string | null {
  if (!s.buildings.includes(b) || !isHabitat(b.kind)) return "Wähle ein Tiergehege.";
  if (upgrade !== "enrichment" && upgrade !== "shelter") return "Unbekannte Gehegeverbesserung.";
  const h = ensureHabitat(b)!;
  if (h[upgrade]) return "Diese Verbesserung ist bereits vorhanden.";
  const cost = upgrade === "enrichment" ? 350 : 500;
  if (!charge(s, cost)) return "Das Budget reicht für diese Verbesserung nicht.";
  h[upgrade] = true;
  return null;
}
const serviceCost = (h: Habitat) => CARE_PER_ANIMAL * h.count;
const needsCare = (h: Habitat) =>
  h.count > 0 && (Math.min(h.food, h.water, h.clean) < 78 || h.health < 85);
function applyCare(s: Park, h: Habitat): string | null {
  if (!h.count) return "In diesem Gehege leben noch keine Tiere.";
  if (Math.min(h.food, h.water, h.clean, h.health) >= 99.9)
    return "Dieses Gehege ist bereits vollständig versorgt.";
  if (!charge(s, serviceCost(h), true))
    return "Das Budget reicht für Futter, Wasser und Pflege nicht.";
  h.food = 100;
  h.water = 100;
  h.clean = 100;
  h.health = cap(h.health + 18);
  return null;
}
/** Paid manual visit, requires an exterior entrance connected to the park. No keeper hut needed. */
export function careHabitat(s: Park, b: Building, access?: ZooAccess): string | null {
  if (!s.buildings.includes(b) || !isHabitat(b.kind)) return "Wähle ein Tiergehege.";
  if (!port(s, b, network(s), access))
    return "Baue einen erreichbaren normalen Parkweg an den Gehegezaun.";
  if (HABITAT_PROFILES[b.kind].specialistRequired && !habitatCareStatus(s, b).staffed)
    return `Für diese Tierart brauchst du ${HABITAT_PROFILES[b.kind].careLabel} mit erreichbarer Pflegerstation.`;
  return applyCare(s, ensureHabitat(b)!);
}
type Job = { b: ZooBuilding; p: Point };
function routeToJob(
  s: Park,
  from: Point,
  jobs: Job[],
  net: Set<string>,
): { job: Job; route: Point[] } | undefined {
  const start = cell(from);
  if (!net.has(key(start))) return undefined;
  const targets = new Map<string, Job>();
  for (const job of jobs) if (!targets.has(key(job.p))) targets.set(key(job.p), job);
  const queue = [start],
    prev = new Map<string, Point | null>([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i],
      job = targets.get(key(p));
    if (job) {
      const route: Point[] = [];
      let at: Point | null = p;
      while (at) {
        route.unshift(at);
        at = prev.get(key(at)) ?? null;
      }
      if (Math.hypot(from.x - start.x, from.y - start.y) < 0.01) route.shift();
      return { job, route };
    }
    for (const [dx, dy] of dirs) {
      const q = { x: p.x + dx, y: p.y + dy };
      if (net.has(key(q)) && !prev.has(key(q))) {
        prev.set(key(q), p);
        queue.push(q);
      }
    }
  }
  return undefined;
}
function needsWorker(w: Keeper, b: ZooBuilding): boolean {
  if (!assignedTo(w, b)) return false;
  return w.role === "technical"
    ? (b.habitat?.safety?.condition ?? 100) < 80
    : qualified(w, b) && needsCare(b.habitat!);
}
function step(s: ZooPark, dt: number, access: ZooAccess) {
  const net = network(s),
    z = reconcile(s, net, access),
    list = habitats(s),
    ports = new Map<number, Point>();
  for (const b of list) {
    const h = ensureHabitat(b)!;
    const p = port(s, b, net, access);
    if (p) ports.set(b.id, p);
    if (!h.count) continue;
    h.safety ??= { condition: 100, electric: false };
    h.safety.condition = cap(h.safety.condition - dt * (h.safety.electric ? 0.016 : 0.004));
    if (h.safety.condition < 30) b.open = false;
    const load = 0.55 + (0.45 * h.count) / SPECIES[b.kind as Species].capacity;
    h.food = cap(h.food - dt * 0.11 * load);
    h.water = cap(h.water - dt * 0.13 * load * ((b.kind as string) === "penguin" ? 1.15 : 1));
    h.clean = cap(h.clean - dt * 0.1 * load * (h.enrichment ? 0.92 : 1));
    const vital = Math.min(h.food, h.water, h.clean);
    if (vital < 35)
      h.health = cap(h.health - dt * (0.06 + (35 - vital) * 0.002) * (h.shelter ? 0.8 : 1));
    else if (vital > 65) h.health = cap(h.health + dt * 0.006);
  }
  const reserved = new Set(z.workers.flatMap((w) => (w.targetId === null ? [] : [w.targetId])));
  for (const w of z.workers) {
    let target = list.find((b) => b.id === w.targetId),
      goal = target ? ports.get(target.id) : undefined;
    const clear = (retry = 1) => {
      if (w.targetId !== null) reserved.delete(w.targetId);
      reset(w, retry);
    };
    if (
      w.targetId !== null &&
      (!target ||
        !goal ||
        !needsWorker(w, target) ||
        (w.route.length && !equal(w.route.at(-1)!, goal)))
    )
      clear();
    if (w.route.length) {
      let budget = dt * 1.35;
      while (w.route.length && budget > 0) {
        const p = w.route[0];
        if (!net.has(key(p))) {
          clear();
          break;
        }
        const d = Math.hypot(p.x - w.x, p.y - w.y);
        if (d <= budget) {
          w.x = p.x;
          w.y = p.y;
          budget -= d;
          w.route.shift();
        } else {
          w.x += ((p.x - w.x) / d) * budget;
          w.y += ((p.y - w.y) / d) * budget;
          budget = 0;
        }
      }
      if (w.route.length) {
        w.mode = "walk";
        continue;
      }
    }
    if (w.targetId !== null) {
      target = list.find((b) => b.id === w.targetId);
      goal = target ? ports.get(target.id) : undefined;
      if (!target || !goal || Math.hypot(w.x - goal.x, w.y - goal.y) > 0.05) {
        clear();
        continue;
      }
      if (w.workLeft <= 0) w.workLeft = 4 + target.habitat!.count * 0.6;
      w.mode = "care";
      w.workLeft = Math.max(0, w.workLeft - dt);
      if (w.workLeft === 0) {
        const error =
          w.role === "technical" ? inspectHabitat(s, target) : applyCare(s, target.habitat!);
        if (!error && w.role && w.role !== "technical")
          target.habitat!.health = cap(target.habitat!.health + 7);
        clear(error ? 5 : 1);
      }
      continue;
    }
    w.retry = Math.max(0, w.retry - dt);
    if (w.retry > 0) continue;
    const jobs = list
      .filter(
        (b) =>
          !reserved.has(b.id) &&
          needsWorker(w, b) &&
          s.cash >= (w.role === "technical" ? HABITAT_INSPECTION_COST : serviceCost(b.habitat!)) &&
          ports.has(b.id),
      )
      .sort(
        (a, b) =>
          Math.min(a.habitat!.food, a.habitat!.water, a.habitat!.clean, a.habitat!.health) -
          Math.min(b.habitat!.food, b.habitat!.water, b.habitat!.clean, b.habitat!.health),
      )
      .map((b) => ({ b, p: ports.get(b.id)! }));
    const found = routeToJob(s, w, jobs, net);
    if (found) {
      w.targetId = found.job.b.id;
      w.route = found.route;
      w.workLeft = 0;
      w.mode = found.route.length ? "walk" : "care";
      reserved.add(w.targetId);
    } else w.retry = 1.5;
  }
}
export function tickZoo(s: ZooPark, dt: number, access: ZooAccess): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  for (let left = dt; left > 1e-8;) {
    const d = Math.min(0.25, left);
    step(s, d, access);
    left -= d;
  }
}
/** Deleted/moved homes and targets are accepted structurally and reconciled on the next tick. */
export function validZoo(s: Park): boolean {
  try {
    const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
    const int = (x: unknown): x is number => num(x) && Number.isInteger(x) && x >= 0;
    const pos = (p: Point) =>
      !!p && num(p.x) && num(p.y) && within(s, { x: Math.floor(p.x), y: Math.floor(p.y) });
    const grid = (p: Point) => pos(p) && Number.isInteger(p.x) && Number.isInteger(p.y);
    for (const b of s.buildings) {
      const h = (b as ZooBuilding).habitat;
      if (h === undefined) continue;
      if (
        !isHabitat(b.kind) ||
        !h ||
        (h.accessVersion !== undefined && h.accessVersion !== 1) ||
        (h.viewpoint !== undefined &&
          (!grid(h.viewpoint) || !exterior(b, h.viewpoint, SPECIES[b.kind].size))) ||
        !int(h.count) ||
        h.count > SPECIES[b.kind].capacity ||
        !["food", "water", "clean", "health"].every((k) => {
          const v = h[k as keyof Habitat];
          return num(v) && v >= 0 && v <= 100;
        }) ||
        typeof h.enrichment !== "boolean" ||
        typeof h.shelter !== "boolean" ||
        (h.features !== undefined &&
          (!Array.isArray(h.features) ||
            h.features.length > 8 ||
            new Set(h.features).size !== h.features.length ||
            !h.features.every((id) =>
              HABITAT_PROFILES[b.kind as Species].features.some((f) => f.id === id),
            ))) ||
        (h.safety !== undefined &&
          (!h.safety ||
            !num(h.safety.condition) ||
            h.safety.condition < 0 ||
            h.safety.condition > 100 ||
            typeof h.safety.electric !== "boolean" ||
            (h.safety.electricInstalled !== undefined &&
              typeof h.safety.electricInstalled !== "boolean") ||
            (h.safety.electric && !HABITAT_PROFILES[b.kind as Species].electric)))
      )
        return false;
    }
    const z = (s as ZooPark).zoo;
    if (z === undefined) return true;
    if (
      !z ||
      !int(z.keepers) ||
      z.keepers > 8 ||
      !int(z.nextId) ||
      z.nextId < 1 ||
      !Array.isArray(z.workers) ||
      z.workers.length > 28 ||
      (z.specialists !== undefined &&
        (!z.specialists ||
          typeof z.specialists !== "object" ||
          Array.isArray(z.specialists) ||
          !Object.entries(z.specialists).every(
            ([role, count]) => Object.hasOwn(SPECIALIST_ROLES, role) && int(count) && count <= 4,
          )))
    )
      return false;
    const ids = new Set<number>();
    for (const w of z.workers) {
      if (
        !w ||
        !pos(w) ||
        (w.role !== undefined && !Object.hasOwn(SPECIALIST_ROLES, w.role)) ||
        !int(w.id) ||
        w.id < 1 ||
        ids.has(w.id) ||
        w.id >= z.nextId ||
        !int(w.homeId) ||
        (w.assignedHabitatId !== undefined &&
          (!int(w.assignedHabitatId) || w.assignedHabitatId < 1)) ||
        (w.targetId !== null && !int(w.targetId)) ||
        !["idle", "walk", "care"].includes(w.mode) ||
        !num(w.workLeft) ||
        w.workLeft < 0 ||
        !num(w.retry) ||
        w.retry < 0 ||
        !Array.isArray(w.route) ||
        w.route.length > s.tiles.length * s.tiles[0].length ||
        !w.route.every(grid)
      )
        return false;
      for (let i = 1; i < w.route.length; i++)
        if (
          Math.abs(w.route[i].x - w.route[i - 1].x) + Math.abs(w.route[i].y - w.route[i - 1].y) !==
          1
        )
          return false;
      if (w.route.length && Math.hypot(w.x - w.route[0].x, w.y - w.route[0].y) > 1.01) return false;
      ids.add(w.id);
    }
    return true;
  } catch {
    return false;
  }
}

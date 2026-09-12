import { coasterMaxHeight } from "./track-limits";
import {
  sharedAccessRoute,
  sharedExitPending,
  resumeSharedExit,
  sharedQueueTileError,
} from "./shared-access-routing";
import { ensureWheelState, tickWheel, validWheelStates, type WheelState } from "./wheel-boarding";
import { tickCoasterTrains, validCoasterFleets, type CoasterFleet } from "./coaster-trains";
import { groundFootprint, pedestrianTile, trackGroundCompatible } from "./ground-clearance";
import { parkWeather } from "./weather";
import { guestWeatherComfort, seeksWeatherSeat, weatherSeatScore } from "./weather-comfort";
import { tickLoanDay, validateLoan, type LoanState } from "./loans";
import { billingPeriodAt, validCalendar, type CalendarState } from "./calendar";
import { spendCash, creditCash } from "./budget";
import { difficultyCost, validDifficulty } from "./difficulty";
import { validEntrance, type GateStyle } from "./entrance";
import {
  COIN_COST,
  initResearchCoins,
  tickResearchCoins,
  validResearchCoins,
  type CoinLedger,
} from "./research-coins";
import {
  initOperations,
  autoAssignRideCrews,
  hasOperator,
  needsOperator,
  tickOperations,
  repeatRideRound,
  finishRideProgram,
  startRideProgram,
  resetRideOperations,
  programDuration,
  programRemaining,
  operatorWages,
  validOperations,
  validCrewPool,
  type RideOperations,
  type RideCrewPool,
  operationsOf,
} from "./operations";
import {
  FOOD,
  isFood,
  AMENITIES,
  isAmenity,
  amenityRoom,
  PATH_STYLES,
  pathStyleAt,
  validParkLife,
  type Food,
  type Rest,
  type PathStyle,
} from "./park-life";
import { habitatViewingSpots, viewingDestination, migrateHabitatAccess } from "./zoo-access";
import { populateCampaign } from "./campaigns";
import {
  broken,
  condition,
  maintenanceScore,
  tickMaintenance,
  mechanicWages,
  maintenanceUnavailable,
  validMaintenance,
  type MaintenanceState,
  type RideMaintenance,
} from "./maintenance";
import { recordFinance, closeFinancePeriod, validFinance, type FinanceLedger } from "./finance";
import {
  buyRidePhoto,
  buyUmbrella,
  tickUmbrella,
  validRetail,
  type RetailState,
  type GuestUmbrella,
} from "./retail";
import {
  isHabitat,
  SPECIES,
  initZoo,
  tickZoo,
  ensureHabitat,
  welfare,
  zooAppeal,
  zooStats,
  zooWages,
  validZoo,
  type Habitat,
  type ZooState,
} from "./zoo";
import {
  marketingDemand,
  marketingEffects,
  attributeMarketingGuest,
  recordMarketingRevenue,
  marketingRideBonus,
  validMarketing,
  type MarketingState,
} from "./marketing";
import {
  initCleanliness,
  tickCleanliness,
  giveWaste,
  cleanlinessScore,
  validCleanliness,
  type Cleanliness,
  type Waste,
} from "./cleanliness";
import { analyzeForces } from "./gforce";
import { PIECES, type Piece } from "./track-parts";
import { validVehicle, type Vehicle } from "./vehicles";
import { connected, exitNetwork, followExit, exitFromCells } from "./walkways";
import {
  setTerrainFootprints,
  terrainHeight,
  hasWalkingElevations,
  withWalkingElevationScope,
  elevationRoute,
  heightAccess,
  walkKey,
  pointFromKey,
  walkingHeight,
  walkTile,
  validTerrain,
  type ElevatedPath,
} from "./terrain";
import { podPort, podSlots, samePod, usesPods, validPods, type AccessPods } from "./pods";
export { connected, exitNetwork } from "./walkways";
import { PARK_ENTRANCE } from "./grid";
import { validDrive, driveCost, type TrackDrive } from "./drive";
import type { TrackEdit } from "./track-edit";
import { guestName } from "./guest-identity";
import {
  appearanceSeed,
  visitorAudience,
  planVisitorParty,
  partyLeader,
  partyMembers,
  partyWalkingSpeed,
  partyShouldWait,
  visitorPartyLabel,
  validVisitorParties,
  type AgeGroup,
  type VisitorParty,
  type VisitorAudience,
} from "./visitors";
import { insideMap, mapWidth, mapHeight, MAX_SIZE } from "./grid";
import { designStats, validDesign, type AttractionDesign } from "./designs";
import {
  isTransport,
  cancelTransitDestination,
  chooseTransit,
  tickTransit,
  releaseTransit,
  stopAccess,
  stopEntrance,
  type TransitLine,
  type GuestTransit,
} from "./transit";
import { prepareRoute } from "./motion";
import { validCustomScenario, customScenarioExpired, type CustomScenario } from "./custom-scenario";
import { validScenery, type SceneryPiece } from "./modular-scenery";
setTerrainFootprints(footprint);
export type CoasterType = "steel" | "wood" | "launch" | "giga" | "inverted";
export type Point = {
  x: number;
  y: number;
  z?: number;
  smooth?: boolean;
  inversion?: boolean;
  heading?: number;
  style?: CoasterType;
  drive?: TrackDrive;
};
export const COASTER_TYPES = {
  giga: {
    name: "Wolkenjäger",
    description: "Giga-Coaster · Hohe Kuppen, lange Züge & Airtime",
    color: "#7559aa",
    cost: 6200,
    capacity: 16,
    duration: 34,
    loop: false,
  },
  inverted: {
    name: "Himmelssegler",
    description: "Inverted-Coaster · Hängende Sitze & Inversionen",
    color: "#369b99",
    cost: 5400,
    capacity: 12,
    duration: 25,
    loop: true,
  },
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
  | "rapids"
  | "shelter"
  | "parasol"
  | "fountain"
  | "hotdog"
  | "icecream"
  | "popcorn"
  | "coffee"
  | "picnic"
  | "playground"
  | "bumper"
  | "balloonride"
  | "elephant"
  | "lion"
  | "panda"
  | "coaster"
  | "wheel"
  | "carousel"
  | "swing"
  | "drop"
  | "pirate"
  | "teacups"
  | "spinner"
  | "custom"
  | "train"
  | "shuttle"
  | "balloon"
  | "plush"
  | "burger"
  | "drink"
  | "toilet"
  | "tree"
  | "pine"
  | "flowers"
  | "bench"
  | "bin"
  | "zebra"
  | "giraffe"
  | "flamingo"
  | "penguin"
  | "keeperhut";
export type Tile = "grass" | "path" | "queue" | "exit" | "water";
export type Building = {
  z?: number;
  maintenance?: RideMaintenance;
  retail?: RetailState;
  trainFleet?: CoasterFleet;
  wheel?: WheelState;
  sharedAccess?: boolean;
  orientation?: 0 | 1 | 2 | 3;
  photoPoint?: number;
  operations?: RideOperations;
  condition?: number;
  habitat?: Habitat;
  vehicle?: Vehicle;
  binFill?: number;
  pods?: AccessPods;
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
  design?: AttractionDesign;
};
export type Guest = {
  z?: number;
  umbrella?: GuestUmbrella;
  photoCount?: number;
  /** Ride whose shared corridor this guest is still leaving. */
  sharedExit?: number;
  ageGroup?: AgeGroup;
  appearance?: number;
  party?: VisitorParty;
  partyVisitDone?: number;
  energy?: number;
  food?: Food;
  rest?: Rest;
  campaignId?: number | null;
  waste?: Waste[];
  id: number;
  name?: string;
  x: number;
  y: number;
  route: Point[];
  target: number | null;
  state: "walk" | "queue" | "ride" | "observe" | "rest" | "leave";
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
  transit?: GuestTransit;
  souvenir?: "balloon" | "plush";
};
export type Park = {
  terrain?: Record<string, number>;
  elevatedPaths?: ElevatedPath[];
  maintenance?: MaintenanceState;
  financeLedger?: FinanceLedger;
  scenery?: SceneryPiece[];
  customScenario?: CustomScenario;
  calendar?: CalendarState;
  unlimitedBudget?: boolean;
  crewPool?: RideCrewPool;
  difficulty?: import("./difficulty").Difficulty;
  loan?: LoanState;
  entrance?: { style: GateStyle; owned: GateStyle[] };
  pathStyles?: Record<string, PathStyle>;
  zoo?: ZooState;
  marketing?: MarketingState;
  cleanliness?: Cleanliness;
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
  research?: {
    completed: ResearchId[];
    active: ResearchId | null;
    remaining: number;
    ledger?: CoinLedger;
  };
  landValue?: number;
  transitLines?: TransitLine[];
  trackEdit?: TrackEdit;
  draft?: {
    track: Point[];
    history: number[];
    historyEnds?: (Point | null)[];
    rotation: number;
    style: CoasterType;
    piece?: Piece;
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
    cleanliness: 0,
    condition: 0,
    species: 0,
    welfare: 0,
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
    cleanliness: 0,
    condition: 0,
    species: 0,
    welfare: 0,
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
    cleanliness: 0,
    condition: 0,
    species: 0,
    welfare: 0,
  },
  ruinenpark: {
    name: "Rosenhain erwacht",
    subtitle: "Rette den maroden Park",
    description:
      "Geschlossene Fahrgeschäfte, schlechte Laune und Müll. Repariere den Bestand und gewinne das Vertrauen der Gäste zurück.",
    cash: 8000,
    arrivals: 150,
    rides: 3,
    rating: 75,
    value: 0,
    profit: 0,
    coasters: 0,
    cleanliness: 85,
    condition: 80,
    species: 0,
    welfare: 0,
  },
  grosspark: {
    name: "Festival nach dem Sturm",
    subtitle: "Großer Park, große Aufräumaktion",
    description:
      "Übernimm einen 42 × 42 großen Park mit 120 Gästen und Müllbergen. Organisiere Reinigung, Wege und einen rentablen Betrieb.",
    cash: 12000,
    arrivals: 350,
    rides: 8,
    rating: 80,
    value: 0,
    profit: 400,
    coasters: 0,
    cleanliness: 90,
    condition: 0,
    species: 0,
    welfare: 0,
  },
  zoo: {
    name: "Wildhain Tierpark",
    subtitle: "Vier Arten, ein lebendiger Zoo",
    description:
      "Pflege Zebras und Flamingos, erforsche Savannen- und Polarwelten und eröffne vier gesunde Tiergehege.",
    cash: 22000,
    arrivals: 200,
    rides: 0,
    rating: 80,
    value: 0,
    profit: 0,
    coasters: 0,
    cleanliness: 85,
    condition: 0,
    species: 4,
    welfare: 80,
  },
} as const;
export type ScenarioId = keyof typeof SCENARIOS;
export const RESEARCH = {
  zoo: {
    name: "Ein Zuhause für Tiere",
    description: "Zebras, Flamingos und Tierpflegerstation",
    cost: 1500,
    duration: 90,
    requires: null,
  },
  savanna: {
    name: "Weite Savanne",
    description: "Giraffen, Elefanten und Löwen",
    cost: 2200,
    duration: 120,
    requires: "zoo",
  },
  polar: {
    name: "Wasserwelten",
    description: "Pinguine und Pandas mit eigenen Lebensräumen",
    cost: 2000,
    duration: 120,
    requires: "zoo",
  },
  family: {
    name: "Familienfestival",
    description: "Holzexpress, Wellenflug, Piratenschaukel und Autoscooter",
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
  festival: {
    name: "Buntes Treiben",
    description: "Tanzende Tassen, Ballonfahrt und Souvenirs",
    cost: 1400,
    duration: 100,
    requires: "family",
  },
  transport: {
    name: "Ein Park in Bewegung",
    description: "Parkbahn und Shuttle zwischen zwei Halten",
    cost: 2200,
    duration: 150,
    requires: "family",
  },
  orbital: {
    name: "Orbitale Abenteuer",
    description: "Orbitalwirbel mit drehenden Gondeln",
    cost: 3200,
    duration: 210,
    requires: "thrill",
  },
  workshop: {
    name: "Deine Erfinderwerkstatt",
    description: "Eigene Attraktionen entwerfen, gestalten und teilen",
    cost: 4500,
    duration: 270,
    requires: "orbital",
  },
} as const;
export type ResearchId = keyof typeof RESEARCH;
export const scenarioOf = (s: Park) => s.customScenario ?? SCENARIOS[s.scenario ?? "waldhain"];
export function isUnlocked(s: Park, kind: Kind, style: CoasterType = "steel") {
  if (s.mode === "sandbox" || !s.research) return true;
  if (
    s.buildings.some(
      (b) => b.kind === kind && (kind !== "coaster" || (b.track?.[0]?.style ?? "steel") === style),
    )
  )
    return true;
  const project = ["giraffe", "elephant", "lion"].includes(kind)
    ? "savanna"
    : ["penguin", "panda"].includes(kind)
      ? "polar"
      : ["zebra", "flamingo", "keeperhut"].includes(kind)
        ? "zoo"
        : kind === "coaster"
          ? ["launch", "giga", "inverted"].includes(style)
            ? "launch"
            : style === "wood"
              ? "family"
              : null
          : kind === "custom"
            ? "workshop"
            : kind === "spinner"
              ? "orbital"
              : ["train", "shuttle"].includes(kind)
                ? "transport"
                : ["teacups", "balloon", "plush", "balloonride"].includes(kind)
                  ? "festival"
                  : kind === "drop"
                    ? "thrill"
                    : ["swing", "pirate", "bumper", "rapids"].includes(kind)
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
    return `Erforsche zuerst ${RESEARCH[project.requires].name}.`;
  if (r.ledger!.coins < COIN_COST[id])
    return `Du brauchst ${COIN_COST[id]} Forschungs-Coins für dieses Projekt.`;
  r.ledger!.coins -= COIN_COST[id];
  r.active = id;
  r.remaining = project.duration;
  return null;
}
/** Old parks retain all previously available content; new scenarios start with research. */
export function migratePark(s: Park): Park {
  migrateHabitatAccess(s, CATALOG);
  initOperations(s);
  for (const b of s.buildings) if (b.kind === "wheel") ensureWheelState(b, rideDuration(b));
  initCleanliness(s);
  initZoo(s);
  s.scenario ??= "waldhain";
  s.operatingIncomeToday ??= 0;
  s.operatingExpensesToday ??= 0;
  s.operatingProfit ??= 0;
  s.research ??= { completed: ["family", "thrill", "launch"], active: null, remaining: 0 };
  initResearchCoins(s);
  s.transitLines ??= [];
  s.landValue ??= 0;
  for (const b of s.buildings) ensurePods(s, b);
  for (const g of s.guests) {
    g.name ??= guestName(g.id);
    g.ageGroup ??= "adult";
    g.appearance ??= appearanceSeed(g.id);
    g.energy ??= 80;
    g.profile ??= (["family", "thrill", "budget"] as const)[g.id % 3];
    g.wallet ??= 60;
    g.bladder ??= 10;
    g.visited ??= [];
  }
  return s;
}
export function parkValue(s: Park) {
  return Math.round(
    s.cash -
      (s.loan?.principal ?? 0) +
      (s.landValue ?? 0) * 0.8 +
      s.buildings.reduce(
        (sum, b) => sum + (b.track ? trackCost(b.track) : buildingBaseCost(b)) * 0.8,
        0,
      ),
  );
}
export function expectedWait(b: Building) {
  if (isHabitat(b.kind)) return 0;
  return (
    programRemaining(b, rideDuration(b)) +
    Math.floor(b.queue.length / Math.max(1, rideCapacity(b))) * programDuration(b, rideDuration(b))
  );
}
export function rideAppeal(b: Building, profile: Guest["profile"] = "family") {
  if (isHabitat(b.kind)) return zooAppeal(b, profile);
  const stats = b.track ? trackStats(b.track) : null;
  const fun = stats
    ? Number(stats.excitement)
    : b.design
      ? designStats(b.design).appeal
      : CATALOG[b.kind].appeal;
  const intensity = stats
    ? Number(stats.intensity)
    : b.design
      ? designStats(b.design).intensity
      : (({ drop: 8, pirate: 6, swing: 4, wheel: 1, carousel: 1 } as Partial<Record<Kind, number>>)[
          b.kind
        ] ?? 2);
  const ideal = profile === "thrill" ? 7 : profile === "family" ? 3 : 4;
  return Math.max(0.5, fun + 2 - Math.abs(intensity - ideal) * 0.9 - (100 - condition(b)) * 0.025);
}
export function guestScore(b: Building, g: Guest, s?: Park) {
  const desire = isAttraction(b.kind)
    ? rideAppeal(b, g.profile)
    : isFood(b.kind)
      ? g.food
        ? -20
        : FOOD[b.kind].drink
          ? g.thirst * 0.17
          : g.hunger * 0.17
      : ["balloon", "plush"].includes(b.kind)
        ? g.souvenir
          ? -20
          : 9 + (g.profile === "family" ? 3 : 0)
        : (g.bladder ?? 10) * 0.15 - 4;
  return (
    desire +
    (s ? marketingRideBonus(s, b, g, (s, b) => !!access(s, b)) : 0) -
    b.price * (g.profile === "budget" ? 0.65 : 0.32) -
    expectedWait(b) / 18 -
    Math.hypot(b.x - g.x, b.y - g.y) * 0.09 -
    (g.visited?.includes(b.id) ? 3.5 : 0)
  );
}
export function entryDemand(s: Park) {
  const rides = s.buildings.filter(
    (b) =>
      b.open &&
      hasOperator(b) &&
      b.tested &&
      isAttraction(b.kind) &&
      (!isHabitat(b.kind) || (b.habitat?.count ?? 0) > 0) &&
      access(s, b),
  );
  if (!rides.length) return 0;
  const value = rides.reduce((n, b) => n + rideAppeal(b, "family"), 0) * 0.62;
  const base = Math.min(
    1,
    Math.max(0, (1 / (1 + Math.exp((s.ticket - value) / 3.5))) * (0.5 + s.rating / 150)),
  );
  return marketingDemand(s, base, (s, b) => !!access(s, b));
}
export const SIZE = 30,
  ENTRANCE = PARK_ENTRANCE;
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
  rapids: {
    name: "Wildwasser-Rafting",
    cost: 4200,
    size: 6,
    price: 9,
    duration: 32,
    capacity: 12,
    appeal: 7,
    upkeep: 14,
    sprite: "ride-rapids",
    description:
      "Drei runde Boote, Strömung, Wellen und ein spritziger Gefällekanal. Gemeinsame 2D- und 3D-Fahrt mit echten Fahrgästen.",
  },
  shelter: {
    name: "Regenpavillon",
    cost: 180,
    size: 1,
    price: 0,
    duration: 0,
    capacity: 0,
    appeal: 0,
    upkeep: 0,
    sprite: "weather-shelter",
    description:
      "Zwei trockene Sitzplätze unter einem festen Dach. Bei Regen suchen Gäste hier Schutz.",
  },
  parasol: {
    name: "Schattenplatz",
    cost: 140,
    size: 1,
    price: 0,
    duration: 0,
    capacity: 0,
    appeal: 0,
    upkeep: 0,
    sprite: "weather-parasol",
    description:
      "Vier Picknickplätze unter einem Sonnenschirm. Schatten hilft bei Hitze und eine kurze Pause bei leichtem Regen.",
  },
  fountain: {
    name: "Trinkbrunnen",
    cost: 160,
    size: 1,
    price: 0,
    duration: 3,
    capacity: 1,
    appeal: 1,
    upkeep: 2,
    sprite: "weather-fountain",
    description: "Kostenloses Trinkwasser gegen Durst. Direkt an einen Parkweg stellen und öffnen.",
  },
  hotdog: {
    name: "Hotdog-Ecke",
    cost: 520,
    size: 1,
    price: 7,
    duration: 3,
    capacity: 1,
    appeal: 1,
    upkeep: 5,
    sprite: "hotdog-shop",
    description: "Heiße Würstchen im Brötchen für hungrige Gäste.",
  },
  icecream: {
    name: "Eisparadies",
    cost: 560,
    size: 1,
    price: 6,
    duration: 3,
    capacity: 1,
    appeal: 1,
    upkeep: 5,
    sprite: "icecream-shop",
    description: "Kühle Kugeln, die Gäste unterwegs genießen.",
  },
  popcorn: {
    name: "Popcornküche",
    cost: 460,
    size: 1,
    price: 5,
    duration: 2,
    capacity: 1,
    appeal: 1,
    upkeep: 4,
    sprite: "popcorn-shop",
    description: "Eine knusprige Pause zwischen den Attraktionen.",
  },
  coffee: {
    name: "Kaffeepavillon",
    cost: 620,
    size: 1,
    price: 6,
    duration: 3,
    capacity: 1,
    appeal: 1,
    upkeep: 5,
    sprite: "coffee-shop",
    description: "Ein warmer Kaffee am Picknicktisch.",
  },
  picnic: {
    name: "Picknickplatz",
    cost: 95,
    size: 1,
    price: 0,
    duration: 0,
    capacity: 0,
    appeal: 0,
    upkeep: 0,
    sprite: "picnic-table",
    description: "Vier Sitzplätze zum Essen und Erholen.",
  },
  playground: {
    name: "Abenteuerspielplatz",
    cost: 850,
    size: 3,
    price: 0,
    duration: 0,
    capacity: 0,
    appeal: 0,
    upkeep: 3,
    sprite: "playground",
    description: "Klettern, rutschen und spielen. Besonders beliebt bei Familien.",
  },
  bumper: {
    name: "Autoscooter",
    cost: 2850,
    size: 3,
    price: 8,
    duration: 24,
    capacity: 8,
    appeal: 8,
    upkeep: 20,
    sprite: "bumper-pavilion",
    description: "Bunte Wagen, kurvige Fahrten und eine echte 3D-Fahrerperspektive.",
  },
  balloonride: {
    name: "Wolkenreise",
    cost: 2400,
    size: 3,
    price: 7,
    duration: 26,
    capacity: 8,
    appeal: 7,
    upkeep: 17,
    sprite: "balloonride",
    description: "Sanft aufsteigende Ballonkörbe über dem Park.",
  },
  elephant: {
    name: "Elefantenrevier",
    cost: 6200,
    size: 7,
    price: 0,
    duration: 24,
    capacity: 12,
    appeal: 9,
    upkeep: 26,
    sprite: "elephant-se",
    description: "Weites Gehege mit Wasserstelle für sanfte Riesen.",
  },
  lion: {
    name: "Löwenfelsen",
    cost: 5100,
    size: 6,
    price: 0,
    duration: 22,
    capacity: 10,
    appeal: 8,
    upkeep: 23,
    sprite: "lion-se",
    description: "Ein ruhiger Rückzugsort für die Könige der Savanne.",
  },
  panda: {
    name: "Pandawald",
    cost: 4900,
    size: 5,
    price: 0,
    duration: 24,
    capacity: 10,
    appeal: 8,
    upkeep: 21,
    sprite: "panda-se",
    description: "Bambus, Schatten und neugierige Pandas.",
  },
  teacups: {
    name: "Tanzende Tassen",
    cost: 1850,
    size: 3,
    price: 7,
    duration: 22,
    capacity: 12,
    appeal: 7,
    upkeep: 10,
    sprite: "ride-teacups",
    description: "Jede Tasse dreht ihre eigene Runde.",
  },
  spinner: {
    name: "Orbitalwirbel",
    cost: 3400,
    size: 3,
    price: 10,
    duration: 24,
    capacity: 12,
    appeal: 9,
    upkeep: 10,
    sprite: "ride-spinner",
    description: "Schwingende Arme und drehende Gondeln.",
  },
  custom: {
    name: "Eigene Attraktion",
    cost: 3000,
    size: 3,
    price: 10,
    duration: 24,
    capacity: 12,
    appeal: 8,
    upkeep: 10,
    sprite: "workshop",
    description: "Deine Idee wird zu einer neuen Parkattraktion.",
  },
  train: {
    name: "Parkbahnhof",
    cost: 850,
    size: 1,
    price: 2,
    duration: 1,
    capacity: 12,
    appeal: 0,
    upkeep: 10,
    sprite: "train-station",
    description: "Zwei Bahnhöfe entlang der Parkwege verbinden.",
  },
  shuttle: {
    name: "Shuttle-Halt",
    cost: 450,
    size: 1,
    price: 2,
    duration: 1,
    capacity: 8,
    appeal: 0,
    upkeep: 10,
    sprite: "shuttle-stop",
    description: "Ein schneller Zubringer auf deinen Parkwegen.",
  },
  balloon: {
    name: "Ballonbude",
    cost: 520,
    size: 1,
    price: 6,
    duration: 3,
    capacity: 1,
    appeal: 1,
    upkeep: 10,
    sprite: "balloon-shop",
    description: "Bunte Erinnerungen für den Heimweg.",
  },
  plush: {
    name: "Kuscheltierladen",
    cost: 680,
    size: 1,
    price: 10,
    duration: 4,
    capacity: 1,
    appeal: 1,
    upkeep: 10,
    sprite: "plush-shop",
    description: "Ein neuer Lieblingsfreund für kleine Gäste.",
  },
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
  zebra: {
    name: "Zebra-Savanne",
    cost: SPECIES.zebra.cost,
    size: 5,
    price: 0,
    duration: 18,
    capacity: 10,
    appeal: 6,
    upkeep: SPECIES.zebra.upkeep,
    sprite: "zebra-se",
    description: "Herde auf Grasland mit Wasserstelle. Tiere nach dem Bau aufnehmen.",
  },
  giraffe: {
    name: "Giraffenhain",
    cost: SPECIES.giraffe.cost,
    size: 6,
    price: 0,
    duration: 22,
    capacity: 12,
    appeal: 8,
    upkeep: SPECIES.giraffe.upkeep,
    sprite: "giraffe-se",
    description: "Weites Gehege für die höchsten Bewohner des Parks.",
  },
  flamingo: {
    name: "Flamingo-Lagune",
    cost: SPECIES.flamingo.cost,
    size: 4,
    price: 0,
    duration: 16,
    capacity: 8,
    appeal: 5.5,
    upkeep: SPECIES.flamingo.upkeep,
    sprite: "flamingo-se",
    description: "Flaches Wasser und Ruheplätze für eine Flamingokolonie.",
  },
  penguin: {
    name: "Pinguin-Küste",
    cost: SPECIES.penguin.cost,
    size: 4,
    price: 0,
    duration: 20,
    capacity: 10,
    appeal: 7,
    upkeep: SPECIES.penguin.upkeep,
    sprite: "penguin-se",
    description: "Felsen, Schwimmbecken und Schutzplätze für Pinguine.",
  },
  keeperhut: {
    name: "Tierpflegerstation",
    cost: 450,
    size: 2,
    price: 0,
    duration: 0,
    capacity: 0,
    appeal: 0,
    upkeep: 0,
    sprite: "zoo-keeper-hut",
    description: "An einen Parkweg anschließen. Hier starten deine Tierpfleger.",
  },
  bin: {
    name: "Mülleimer",
    cost: 65,
    size: 1,
    price: 0,
    duration: 0,
    capacity: 0,
    appeal: 0,
    upkeep: 0,
    sprite: "bin-empty",
    description: "Neben Wege und Imbisse stellen. Reinigungskräfte leeren volle Eimer.",
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
  [
    "rapids",
    "bumper",
    "balloonride",
    "coaster",
    "wheel",
    "carousel",
    "swing",
    "drop",
    "pirate",
    "teacups",
    "spinner",
    "custom",
  ].includes(k);
export const isAttraction = (k: Kind) => isRide(k) || isHabitat(k);
export const decorative = (k: Kind) => CATALOG[k].capacity === 0;
/** Functional seats/playgrounds and keeper buildings must survive automatic clearing. */
export const canAutoClear = (k: Kind) => decorative(k) && k !== "keeperhut" && !isAmenity(k);
export const inBounds = (x: number, y: number, s?: Park) =>
  s ? insideMap(s, x, y) : x >= 0 && y >= 0 && x < SIZE && y < SIZE;
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
/** Ground construction leaves elevated track selectable without treating it as a solid wall. */
export function groundOccupant(s: Park, x: number, y: number) {
  const hits = s.buildings.filter((b) =>
    groundFootprint(b, footprint(b)).some((p) => p.x === x && p.y === y),
  );
  // A removable tree must never hide a low rail or a solid building on the same cell.
  return hits.find((b) => !canAutoClear(b.kind)) ?? hits[0];
}

export function accessNeighbors(b: Building): Point[] {
  const n = CATALOG[b.kind].size;
  const adjacent: Point[] = [];
  for (let i = 0; i < n; i++)
    adjacent.push(
      { x: b.x + i, y: b.y + n },
      { x: b.x - 1, y: b.y + i },
      { x: b.x + n, y: b.y + i },
      { x: b.x + i, y: b.y - 1 },
    );
  return adjacent;
}
/** Old parks retain their working side; explicit pods stay fixed when nearby paths change. */
export function effectivePods(
  s: Park,
  b: Building,
  net = connected(s),
  exits = exitNetwork(s, net),
): AccessPods {
  if (b.pods) return b.sharedAccess ? { entry: b.pods.entry, exit: b.pods.entry } : b.pods;
  const size = CATALOG[b.kind].size,
    slots = podSlots(size);
  const port = (p: (typeof slots)[number]) => podPort(b, size, p);
  const viable = (p: (typeof slots)[number]) => {
    const q = port(p),
      obstacle = groundOccupant(s, q.x, q.y);
    return (
      inBounds(q.x, q.y, s) &&
      s.tiles[q.y][q.x] !== "water" &&
      (!obstacle || canAutoClear(obstacle.kind))
    );
  };
  const legacy = access(s, b, net);
  const entry =
    slots.find((p) => legacy && key(port(p)) === key(legacy)) ??
    slots.find(
      (p) =>
        isAttraction(b.kind) && net.has(key(port(p))) && s.tiles[port(p).y][port(p).x] === "queue",
    ) ??
    slots.find((p) => net.has(key(port(p))) && s.tiles[port(p).y][port(p).x] === "path") ??
    slots
      .filter(viable)
      .filter((p) => s.tiles[port(p).y][port(p).x] !== "exit")
      .sort((a, b) => {
        const distance = (p: typeof a) =>
          net.size
            ? Math.min(
                ...[...net].map((k) => {
                  const [x, y] = k.split(",").map(Number);
                  return Math.abs(x - port(p).x) + Math.abs(y - port(p).y);
                }),
              )
            : 0;
        return distance(a) - distance(b);
      })[0] ??
    slots.find((p) => inBounds(port(p).x, port(p).y, s)) ??
    slots[0];
  const outgoing = exitFromCells(slots.filter((p) => !samePod(p, entry)).map(port), exits)[0];
  const exit =
    slots.find((p) => outgoing && key(port(p)) === key(outgoing)) ??
    slots.find(
      (p) =>
        !samePod(p, entry) &&
        viable(p) &&
        s.tiles[port(p).y][port(p).x] === "path" &&
        net.has(key(port(p))),
    ) ??
    slots.find(
      (p) => !samePod(p, entry) && viable(p) && s.tiles[port(p).y][port(p).x] !== "queue",
    ) ??
    slots.find((p) => !samePod(p, entry) && inBounds(port(p).x, port(p).y, s))!;
  return { entry: { ...entry }, exit: { ...(b.sharedAccess ? entry : exit) } };
}
export function ensurePods(s: Park, b: Building) {
  if (usesPods(b.kind) && !b.pods) b.pods = effectivePods(s, { ...b, sharedAccess: false });
}
/** Resolve legacy auto-selected entries without making route validation recursive. */
export function buildingEntryPort(s: Park, b: Building): Point {
  const pods = b.pods ?? effectivePods(s, { ...b, sharedAccess: false });
  return podPort(b, CATALOG[b.kind].size, pods.entry);
}
export function access(s: Park, b: Building, net = connected(s)) {
  if (isHabitat(b.kind)) return habitatViewingSpots(s, b, net)[0];
  if (b.sharedAccess && !sharedAccessRoute(s, b, buildingEntryPort).length) return undefined;
  const points =
    usesPods(b.kind) && b.pods
      ? [podPort(b, CATALOG[b.kind].size, b.pods.entry)]
      : accessNeighbors(b);
  const z = b.z ?? terrainHeight(s, b.x, b.y);
  if (z !== 0 || hasWalkingElevations(s))
    return heightAccess(s, points, z, net).sort(
      (a, c) => Number(walkTile(s, c) === "queue") - Number(walkTile(s, a) === "queue"),
    )[0];
  const reachable = points.filter((p) => inBounds(p.x, p.y, s) && net.has(key(p)));
  // Prefer a dedicated queue, but a station can also board directly from a park path.
  return (
    (isAttraction(b.kind) || isTransport(b.kind)
      ? reachable.find((p) => s.tiles[p.y][p.x] === "queue")
      : undefined) ?? reachable.find((p) => s.tiles[p.y][p.x] === "path")
  );
}
export function exitPath(s: Park, b: Building, net = connected(s), exits = exitNetwork(s, net)) {
  if (isHabitat(b.kind)) return [];
  if (b.sharedAccess) return sharedAccessRoute(s, b, buildingEntryPort);
  const points =
    usesPods(b.kind) && b.pods
      ? [podPort(b, CATALOG[b.kind].size, b.pods.exit)]
      : accessNeighbors(b);
  const z = b.z ?? terrainHeight(s, b.x, b.y);
  if (z !== 0 || hasWalkingElevations(s)) {
    const direct = heightAccess(s, points, z, net, ["path"])[0];
    if (direct) return [direct];
    const starts = heightAccess(s, points, z, new Set(exits.keys()), ["exit"]);
    return starts.length ? followExit(starts[0], exits, s) : [];
  }
  const direct = b.pods && points.find((p) => net.has(key(p)) && s.tiles[p.y]?.[p.x] === "path");
  return direct ? [direct] : exitFromCells(points, exits);
}
/** Riders use the finished exit; waiting guests and legacy parks keep their existing entrance. */
export function leaveBuilding(
  s: Park,
  b: Building,
  g: Guest,
  net = connected(s),
  exits = exitNetwork(s, net),
) {
  const route = g.state === "ride" ? exitPath(s, b, net, exits) : [];
  const standing = { x: Math.round(g.x), y: Math.round(g.y) };
  const nearby = isHabitat(b.kind)
    ? net.has(key(standing))
      ? standing
      : [...net]
          .map((k) => {
            const [x, y] = k.split(",").map(Number);
            return { x, y };
          })
          .sort((a, b) => Math.hypot(a.x - g.x, a.y - g.y) - Math.hypot(b.x - g.x, b.y - g.y))[0]
    : undefined;
  const p = nearby ?? route[0] ?? access(s, b, net) ?? ENTRANCE;
  g.x = p.x;
  g.y = p.y;
  g.z = walkingHeight(s, p);
  g.route = route.slice(1);
  if (b.sharedAccess && g.state === "ride" && route.length > 0 && s.buildings.includes(b))
    g.sharedExit = b.id;
  else delete g.sharedExit;
  g.target = null;
  g.state = "walk";
  g.timer = 0;
  g.rest = undefined;
}
export function queueCapacity(s: Park, b: Building) {
  if (isHabitat(b.kind)) return 0;
  const a = access(s, b);
  if (!a) return 0;
  if (s.tiles[a.y][a.x] === "path") return b.sharedAccess ? 2 : 4;
  if (b.sharedAccess)
    return Math.min(40, Math.max(2, (sharedAccessRoute(s, b, buildingEntryPort).length - 1) * 2));
  const seen = new Set([key(a)]),
    q = [a];
  for (let i = 0; i < q.length; i++)
    for (const [dx, dy] of dirs) {
      const p = { x: q[i].x + dx, y: q[i].y + dy };
      if (inBounds(p.x, p.y, s) && s.tiles[p.y][p.x] === "queue" && !seen.has(key(p))) {
        seen.add(key(p));
        q.push(p);
      }
    }
  return Math.min(40, q.length * 4);
}
export function findRoute(s: Park, start: Point, end: Point): Point[] {
  if (hasWalkingElevations(s)) return elevationRoute(s, start, end, true, exitNetwork(s)).slice(1);
  const exits = exitNetwork(s);
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
        inBounds(n.x, n.y, s) &&
        (s.tiles[p.y]?.[p.x] === "exit"
          ? key(exits.get(key(p)) ?? { x: -1, y: -1 }) === key(n)
          : ["path", "queue"].includes(s.tiles[n.y][n.x])) &&
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
  if (!spendCash(s, cost)) return false;
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
export const buildingBaseCost = (b: Pick<Building, "kind" | "track" | "design">) =>
  b.design
    ? designStats(b.design).cost
    : b.kind === "coaster"
      ? COASTER_TYPES[b.track?.[0]?.style ?? "steel"].cost
      : CATALOG[b.kind].cost;
export const rideDuration = (b: Building) =>
  b.design
    ? designStats(b.design).duration
    : b.kind === "coaster"
      ? b.track
        ? prepareRoute(b.track).duration
        : COASTER_TYPES.steel.duration
      : CATALOG[b.kind].duration;
export const rideCapacity = (b: Building) =>
  b.trainFleet
    ? b.trainFleet.program.cars * 2
    : b.design
      ? b.design.seats
      : b.kind === "coaster"
        ? COASTER_TYPES[b.track?.[0]?.style ?? "steel"].capacity
        : CATALOG[b.kind].capacity;
export function trackCost(track: Point[]) {
  let units = 1;
  for (let i = 1; i < track.length; i++)
    units += Math.max(
      Math.hypot(track[i].x - track[i - 1].x, track[i].y - track[i - 1].y),
      Math.abs((track[i].z ?? 0) - (track[i - 1].z ?? 0)),
    );
  return COASTER_TYPES[track[0]?.style ?? "steel"].cost + Math.round(units * 65) + driveCost(track);
}
const statsCache = new WeakMap<
  Point[],
  { length: number; height: number; speed: number; excitement: string; intensity: string }
>();
export function trackStats(track: Point[]) {
  const cached = statsCache.get(track);
  if (cached) return cached;
  const route = prepareRoute(track),
    height = Math.max(0, ...track.map((p) => p.z ?? 0)) * 5,
    speed = Math.max(0, ...route.speeds) * 3.6,
    forces = analyzeForces(track);
  const stats = {
    length: Math.round(route.length * 5),
    height,
    speed: Math.round(speed),
    excitement: Math.min(9.9, 2 + forces.fun / 12).toFixed(1),
    intensity: Math.min(9.9, 1 + forces.intensity / 11).toFixed(1),
  };
  statsCache.set(track, stats);
  return stats;
}
export function validateTrack(s: Park, track: Point[]): string | null {
  if (track.length < 9) return "Baue mindestens 8 Streckenabschnitte.";
  if (track.some((p) => p.drive !== undefined && !validDrive(p.drive)))
    return "Ungültige Beschleuniger- oder Bremseinstellung.";
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
          (!COASTER_TYPES[style].loop && p.inversion) ||
          (p.z ?? 0) > coasterMaxHeight(style),
      )
    )
      return "Dieser Bahntyp unterstützt diese Bauteile nicht.";
    if (
      track.length > 2048 ||
      track.some(
        (p) =>
          !Number.isFinite(p.x + p.y + (p.z ?? 0)) ||
          (p.z ?? 0) < 0 ||
          (p.z ?? 0) > coasterMaxHeight(style),
      )
    )
      return "Ungültige Gleisgeometrie.";
    if (
      trackFootprint(track).some(
        (p) =>
          !inBounds(p.x, p.y, s) ||
          !trackGroundCompatible(track, p.x, p.y, s.tiles[p.y][p.x], terrainHeight(s, p.x, p.y)) ||
          occupant(s, p.x, p.y),
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
    if (
      !inBounds(p.x, p.y, s) ||
      !trackGroundCompatible(track, p.x, p.y, s.tiles[p.y][p.x], terrainHeight(s, p.x, p.y)) ||
      occupant(s, p.x, p.y)
    )
      return "Die Strecke braucht freie Landfelder oder mindestens 5 m Abstand über einem Weg.";
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
const startingParks = new WeakSet<Park>();
export function build(
  s: Park,
  kind: Kind,
  x: number,
  y: number,
  track?: Point[],
  design?: AttractionDesign,
): { error?: string; id?: number } {
  if (!isUnlocked(s, kind, track?.[0]?.style))
    return { error: "Diese Attraktion wird durch Forschung freigeschaltet." };
  if (kind === "custom" && !validDesign(design))
    return { error: "Wähle zuerst einen gültigen Werkstatt-Entwurf." };
  const proto = { kind, x, y, track, ...(design ? { design: structuredClone(design) } : {}) };
  const ground = terrainHeight(s, x, y);
  if (kind !== "coaster" && footprint(proto).some((p) => terrainHeight(s, p.x, p.y) !== ground))
    return { error: "Ebne zuerst das Gelände unter dem Gebäude ein." };
  if (kind === "coaster") {
    const err = validateTrack(s, track ?? []);
    if (err) return { error: err };
  }
  if (
    footprint(proto).some(
      (p) =>
        !inBounds(p.x, p.y, s) ||
        !(kind === "coaster" && track
          ? trackGroundCompatible(track, p.x, p.y, s.tiles[p.y][p.x], terrainHeight(s, p.x, p.y))
          : s.tiles[p.y][p.x] === "grass") ||
        occupant(s, p.x, p.y),
    )
  )
    return { error: "Hier ist kein Platz. Wähle freie Wiese." };
  const cost = track ? trackCost(track) : design ? designStats(design).cost : CATALOG[kind].cost;
  if (!spend(s, cost)) return { error: "Dafür reicht dein Parkbudget nicht." };
  if (!startingParks.has(s)) initOperations(s);
  const b: Building = {
    ...proto,
    ...(ground ? { z: ground } : {}),
    id: s.nextId++,
    name: design
      ? design.name
      : kind === "coaster"
        ? track?.[0]?.style
          ? COASTER_TYPES[track[0].style].name
          : "Waldflug"
        : CATALOG[kind].name,
    open: !isAttraction(kind),
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
  if (isHabitat(kind)) ensureHabitat(b)!.accessVersion = 1;
  s.buildings.push(b);
  if (!startingParks.has(s)) initOperations(s);
  return { id: b.id };
}
export function paint(s: Park, x: number, y: number, type: Tile, style?: PathStyle): string | null {
  if (!inBounds(x, y, s)) return "Außerhalb des Parkgeländes.";
  if (x === ENTRANCE.x && y === ENTRANCE.y && type !== "path")
    return "Der Parkeingang muss ein normaler Weg bleiben.";
  if (pedestrianTile(type) ? groundOccupant(s, x, y) : occupant(s, x, y))
    return "Dieses Feld ist bereits bebaut oder das Gleis liegt zu tief (5 m Durchfahrtshöhe nötig).";
  const resurfacing =
    type === "path" &&
    s.tiles[y][x] === "path" &&
    style !== undefined &&
    pathStyleAt(s, x, y) !== style;
  if (s.tiles[y][x] === type && !resurfacing) return null;
  if (type === "queue") {
    const error = sharedQueueTileError(s, [{ x, y }], buildingEntryPort);
    if (error) return error;
  }
  const cost = resurfacing
    ? 6
    : type === "queue" || type === "exit"
      ? 18
      : type === "water"
        ? 35
        : 12;
  if (!spend(s, cost)) return "Dafür reicht dein Parkbudget nicht.";
  s.tiles[y][x] = type;
  if (type === "path" && style && style !== "garden") (s.pathStyles ??= {})[`${x},${y}`] = style;
  else if (s.pathStyles) delete s.pathStyles[`${x},${y}`];
  if (s.cleanliness) initCleanliness(s);
  return null;
}
export function remove(s: Park, x: number, y: number) {
  const occupiedHabitat = occupant(s, x, y);
  if (
    occupiedHabitat &&
    isHabitat(occupiedHabitat.kind) &&
    (occupiedHabitat.habitat?.count ?? 0) > 0
  )
    return;
  const b = occupant(s, x, y);
  if (b) {
    if (!startingParks.has(s)) initOperations(s);
    for (const l of s.transitLines ?? [])
      if (l.a === b.id || l.b === b.id) {
        for (const g of s.guests) if (g.transit?.line === l.id) releaseTransit(s, g, l);
        for (const stop of s.buildings) if (stop.id === l.a || stop.id === l.b) stop.queue = [];
      }
    s.transitLines = s.transitLines?.filter((l) => l.a !== b.id && l.b !== b.id);
    s.buildings = s.buildings.filter((o) => o.id !== b.id);
    for (const g of s.guests) if (g.sharedExit === b.id) delete g.sharedExit;
    if (s.trackEdit?.buildingId === b.id) {
      s.trackEdit = undefined;
      s.draft = undefined;
    }
    const refund = Math.round(buildingBaseCost(b) * 0.4);
    creditCash(s, refund);
    s.income += refund;
    s.dayIncome += refund;
    for (const g of s.guests)
      if (g.target === b.id) {
        if (cancelTransitDestination(s, g)) continue;
        leaveBuilding(s, b, g);
      }
    if (!startingParks.has(s)) autoAssignRideCrews(s);
  } else if (inBounds(x, y, s) && !(x === ENTRANCE.x && y === ENTRANCE.y)) {
    s.tiles[y][x] = "grass";
    if (s.pathStyles) delete s.pathStyles[`${x},${y}`];
    if (s.cleanliness) initCleanliness(s);
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
  g.name = guestName(g.id);
  g.ageGroup = "adult";
  g.appearance = appearanceSeed(g.id);
  attributeMarketingGuest(s, g, Math.random(), (s, b) => !!access(s, b));
  s.guests.push(g);
  s.arrivals++;
  recordMarketingRevenue(s, g, s.ticket, "ticket");
  creditCash(s, s.ticket);
  s.income += s.ticket;
  s.dayIncome += s.ticket;
  recordFinance(s, "ticket", s.ticket);
  s.operatingIncomeToday = (s.operatingIncomeToday ?? 0) + s.ticket;
  return g;
}
/** One arrival event is a complete party; admission and marketing stay per person. */
export function newVisitorParty(s: Park, roll: number, audience?: VisitorAudience): Guest[] {
  const plan = planVisitorParty(s, roll, audience);
  if (!plan) return [];
  const id = s.nextId,
    members: Guest[] = [],
    surname = guestName(id).split(" ").at(-1)!;
  for (let member = 0; member < plan.size; member++) {
    const g = newGuest(s);
    g.party = { id, kind: plan.kind, member, size: plan.size };
    g.ageGroup = plan.kind === "family" && member >= 2 ? "child" : "adult";
    g.profile = plan.profile;
    if (plan.kind === "family") g.name = `${g.name!.split(" ")[0]} ${surname}`;
    g.thought =
      plan.kind === "solo"
        ? "Heute entdecke ich den Park in meinem Tempo."
        : `${visitorPartyLabel(g)}: Wir entdecken den Park zusammen.`;
    members.push(g);
  }
  return members;
}
export function newPark(
  mode: "scenario" | "sandbox" = "scenario",
  scenario: ScenarioId = "waldhain",
): Park {
  const s: Park = {
    version: 1,
    calendar: { version: 1, offsetSeconds: 0 },
    difficulty: "normal",
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
  // Starter/campaign parks explicitly begin with the crews their initial rides
  // already had. Later builds use this finite pool and never hire implicitly.
  startingParks.add(s);
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
  if (mode === "scenario") populateCampaign(s, scenario, { build, newGuest });
  initCleanliness(s);
  initZoo(s);
  startingParks.delete(s);
  initOperations(s);
  return s;
}
/** Followers reuse normal route finding and boarding checks; never move coordinates here. */
function followParty(s: Park, g: Guest, net: Set<string>): boolean {
  if (!g.party || g.party.kind === "solo" || g.transit) return false;
  const leader = partyLeader(s, g);
  if (!leader || leader.id === g.id) return false;
  if (leader.state === "leave") {
    g.state = "leave";
    g.target = null;
    g.rest = undefined;
    g.timer = 0;
    g.route = findRoute(s, g, ENTRANCE);
    g.thought = `${visitorPartyLabel(g)}: Wir gehen gemeinsam nach Hause.`;
    return true;
  }
  const b = s.buildings.find((b) => b.id === leader.target);
  if (!b) {
    if (leader.state === "walk" && leader.target === null) {
      g.timer = 0.4;
      g.thought = "Ich warte kurz auf meine Begleitung.";
      return true;
    }
    return false;
  }
  if (g.partyVisitDone === b.id) {
    // A guest may still be walking along the ride's one-way exit after finishing.
    if (g.route.length) return false;
    g.timer = 0.5;
    g.target = null;
    g.thought = "Ich warte auf meine Begleitung, bis alle fertig sind.";
    return true;
  }
  if (
    !b.open ||
    !hasOperator(b) ||
    broken(b) ||
    !access(s, b, net) ||
    b.price > (g.wallet ?? 60) ||
    (isAttraction(b.kind) && !b.tested) ||
    (isHabitat(b.kind) && !b.habitat?.count)
  )
    return false;
  const slot = isAmenity(b.kind) ? amenityRoom(s, b, g) : -1;
  if (isAmenity(b.kind) && slot < 0) return false;
  const destination = isHabitat(b.kind) ? viewingDestination(s, b, g, net) : access(s, b, net);
  if (!destination) return false;
  const route = findRoute(s, g, destination);
  if (!route.length && Math.hypot(g.x - destination.x, g.y - destination.y) > 0.25) return false;
  g.rest = isAmenity(b.kind) ? { slot, remaining: 0 } : undefined;
  g.target = b.id;
  g.route = route;
  g.timer = 0;
  g.thought = `${visitorPartyLabel(g)} · gemeinsam zu ${b.name}.`;
  return true;
}
function beginPartyVisit(s: Park, g: Guest) {
  const members = partyLeader(s, g)?.id === g.id ? partyMembers(s, g) : [g];
  for (const member of members) delete member.partyVisitDone;
}
function finishPartyVisit(g: Guest, b: Building) {
  if (g.party && g.party.kind !== "solo") g.partyVisitDone = b.id;
}
function choose(s: Park, g: Guest, net: Set<string>) {
  if (followParty(s, g, net)) return;
  const members = partyMembers(s, g);
  if (
    g.party &&
    g.party.kind !== "solo" &&
    partyLeader(s, g)?.id === g.id &&
    members.some(
      (other) => other.id !== g.id && ["queue", "ride", "observe", "rest"].includes(other.state),
    )
  ) {
    g.timer = 0.5;
    g.thought = "Ich warte hier, bis meine Begleitung fertig ist.";
    return;
  }
  const budget = Math.min(...members.map((member) => member.wallet ?? 60));
  const options = s.buildings.filter(
    (b) =>
      b.open &&
      hasOperator(b) &&
      !decorative(b.kind) &&
      !isTransport(b.kind) &&
      access(s, b, net) &&
      b.price <= budget &&
      (!isAttraction(b.kind) || b.tested) &&
      (!isHabitat(b.kind) || (b.habitat?.count ?? 0) > 0) &&
      !broken(b) &&
      (isHabitat(b.kind) || b.queue.length < (isRide(b.kind) ? queueCapacity(s, b) : 6)),
  );
  const ranked = options
    .map((b) => ({ b, score: guestScore(b, g, s) + Math.random() * 1.4 }))
    .filter((o) => o.score > -0.5)
    .sort((a, b) => b.score - a.score);
  const weather = parkWeather(s);
  const resting = s.buildings
    .filter(
      (b) =>
        isAmenity(b.kind) &&
        Math.hypot(b.x - g.x, b.y - g.y) < 18 &&
        b.open &&
        access(s, b, net) &&
        amenityRoom(s, b, g) >= 0 &&
        (!g.party ||
          g.party.kind === "solo" ||
          AMENITIES[b.kind].seats -
            s.guests.filter(
              (other) => other.target === b.id && other.rest && other.party?.id !== g.party!.id,
            ).length >=
            members.length) &&
        (b.kind === "playground"
          ? g.profile === "family" && !g.visited?.includes(b.id)
          : (g.energy ?? 80) < 50 || !!g.food || seeksWeatherSeat(b, g, weather)),
    )
    .sort((a, b) => weatherSeatScore(b, g, weather) - weatherSeatScore(a, g, weather))[0];
  if (
    !s.open ||
    g.rides >= 5 ||
    g.happiness < 25 ||
    ((g.wallet ?? 60) < 3 && !ranked.some((o) => isHabitat(o.b.kind)) && !resting) ||
    (s.time > 30 && !ranked.length && !resting)
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
  if (resting) {
    beginPartyVisit(s, g);
    g.rest = { slot: amenityRoom(s, resting, g), remaining: 0 };
    g.target = resting.id;
    g.route = findRoute(s, g, access(s, resting, net)!);
    g.thought =
      resting.kind === "playground"
        ? "Eine Runde auf den Spielplatz!"
        : resting.kind === "shelter" && weather.rain > 0.25
          ? "Ich suche einen trockenen Platz unter dem Dach."
          : resting.kind === "parasol" && weather.heat > 0.2
            ? "Eine Pause im Schatten wäre jetzt schön."
            : "Ich suche mir einen gemütlichen Sitzplatz.";
    return;
  }
  const b = ranked[0]?.b;
  if (!b) {
    g.timer = 3;
    g.thought = "Ich suche eine passende, offene Attraktion.";
    return;
  }
  const destination = (isHabitat(b.kind) ? viewingDestination(s, b, g, net) : access(s, b, net))!;
  beginPartyVisit(s, g);
  g.route = findRoute(s, g, destination);
  g.target = b.id;
  g.thought = `Auf dem Weg: ${b.name}`;
  if (!g.party || g.party.kind === "solo") chooseTransit(s, g, destination, g.route);
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
  return withWalkingElevationScope(s, () => tickParkStep(s, dt));
}
function tickParkStep(s: Park, dt: number) {
  const research = s.research!;
  if (research.active) {
    research.remaining = Math.max(0, research.remaining - dt);
    if (research.remaining === 0) {
      research.completed.push(research.active);
      research.active = null;
    }
  }
  const oldBillingPeriod = billingPeriodAt(s.time);
  s.time += dt;
  const net = connected(s),
    exits = exitNetwork(s, net);
  const weatherNow = parkWeather(s);
  tickMaintenance(s, dt, CATALOG);
  const active = s.buildings.filter(
    (b) => b.open && hasOperator(b) && !decorative(b.kind) && access(s, b, net),
  );
  s.spawnClock += dt;
  const interval =
    Math.max(
      2.2,
      4.5 - active.filter((b) => isAttraction(b.kind)).length * 0.2 + (100 - s.rating) * 0.035,
    ) / marketingEffects(s, (s, b) => !!access(s, b)).spawnMultiplier;
  if (s.open && s.spawnClock >= interval && s.guests.length < 220) {
    s.spawnClock = 0;
    const audience = visitorAudience(s, (park, b) => !!access(park, b, net)),
      chance = entryDemand(s) / audience.expectedPartySize,
      roll = Math.random();
    // Larger parties arrive less often, preserving approximately the old people-per-minute rate.
    if (roll < chance) newVisitorParty(s, roll / chance, audience);
  }
  for (const b of s.buildings) {
    if (s.trackEdit?.buildingId === b.id) {
      b.open = false;
      b.autoOpen = false;
      b.testing = undefined;
      continue;
    }
    if (isTransport(b.kind) || isHabitat(b.kind)) continue;
    if (b.testing) {
      b.testDuration ??= b.testing;
      b.testing = Math.max(0, b.testing - dt);
      if (b.testing === 0) b.tested = true;
    }
    if (b.autoOpen && b.tested && access(s, b, net)) {
      b.open = true;
      b.autoOpen = false;
    }
    if (b.kind === "wheel") {
      const ready =
        b.open &&
        !!access(s, b, net) &&
        hasOperator(b) &&
        b.tested &&
        !broken(b) &&
        !maintenanceUnavailable(b);
      if (!ready) {
        for (const id of b.queue) {
          const g = s.guests.find((guest) => guest.id === id);
          if (g) leaveBuilding(s, b, g, net, exits);
        }
        b.queue = [];
      }
      tickWheel(b, dt, {
        ready,
        exitClear: !sharedExitPending(s, b),
        baseDuration: rideDuration(b),
        board: () => {
          while (b.queue.length) {
            const id = b.queue.shift()!,
              g = s.guests.find((guest) => guest.id === id);
            if (!g || g.state !== "queue" || g.target !== b.id) continue;
            if ((g.wallet ?? 60) < b.price) {
              leaveBuilding(s, b, g, net, exits);
              g.timer = 1;
              g.thought = "Der neue Preis übersteigt mein Budget.";
              continue;
            }
            b.riders.push(id);
            g.state = "ride";
            g.wallet = Math.max(0, (g.wallet ?? 60) - b.price);
            b.served++;
            b.revenue += b.price;
            recordMarketingRevenue(s, g, b.price, "ride");
            recordFinance(s, "rides", b.price);
            creditCash(s, b.price);
            s.income += b.price;
            s.dayIncome += b.price;
            s.operatingIncomeToday! += b.price;
            return id;
          }
          return null;
        },
        release: (id, completed) => {
          const g = s.guests.find((guest) => guest.id === id);
          if (!g) return;
          finishPartyVisit(g, b);
          leaveBuilding(s, b, g, net, exits);
          g.timer = g.sharedExit === b.id ? 0.4 : 2;
          if (!completed) {
            g.thought = "Die Fahrt wurde beendet. Das Personal begleitet den Ausstieg.";
            return;
          }
          g.rides++;
          (g.visited ??= []).push(b.id);
          g.visited = g.visited.slice(-8);
          const change = (rideAppeal(b, g.profile) - 4) * 2 - b.price * 0.12;
          g.happiness = Math.max(0, Math.min(100, g.happiness + change));
          g.thought =
            change > 2
              ? "Genau mein Geschmack – diese Fahrt hat sich gelohnt!"
              : change < 0
                ? "Die Fahrt war für mich zu heftig, zu zahm oder zu teuer."
                : "Eine nette Runde.";
        },
      });
      continue;
    }
    if (b.kind === "coaster" && b.trainFleet) {
      const ready =
        b.open &&
        !!access(s, b, net) &&
        hasOperator(b) &&
        b.tested &&
        !broken(b) &&
        !maintenanceUnavailable(b);
      if (!ready) {
        for (const id of b.queue) {
          const g = s.guests.find((guest) => guest.id === id);
          if (g) leaveBuilding(s, b, g, net, exits);
        }
        b.queue = [];
      }
      tickCoasterTrains(b, dt, {
        ready,
        get exitClear() {
          return !sharedExitPending(s, b);
        },
        rounds: operationsOf(b).rounds,
        board: () => {
          while (b.queue.length) {
            const id = b.queue.shift()!,
              g = s.guests.find((guest) => guest.id === id);
            if (!g || g.state !== "queue" || g.target !== b.id) continue;
            if ((g.wallet ?? 60) < b.price) {
              leaveBuilding(s, b, g, net, exits);
              g.thought = "Der neue Preis übersteigt mein Budget.";
              continue;
            }
            g.state = "ride";
            g.wallet = Math.max(0, (g.wallet ?? 60) - b.price);
            b.served++;
            b.revenue += b.price;
            recordMarketingRevenue(s, g, b.price, "ride");
            recordFinance(s, "rides", b.price);
            creditCash(s, b.price);
            s.income += b.price;
            s.dayIncome += b.price;
            s.operatingIncomeToday! += b.price;
            return id;
          }
          return null;
        },
        release: (id, completed) => {
          const g = s.guests.find((guest) => guest.id === id);
          if (!g) return;
          finishPartyVisit(g, b);
          leaveBuilding(s, b, g, net, exits);
          g.timer = g.sharedExit === b.id ? 0.4 : 2;
          if (!completed) return;
          g.rides++;
          buyRidePhoto(s, b, g);
          (g.visited ??= []).push(b.id);
          g.visited = g.visited.slice(-8);
          const change = (rideAppeal(b, g.profile) - 4) * 2 - b.price * 0.12;
          g.happiness = Math.max(0, Math.min(100, g.happiness + change));
          g.thought =
            change > 2
              ? "Genau mein Geschmack – diese Fahrt hat sich gelohnt!"
              : change < 0
                ? "Die Fahrt war für mich zu heftig, zu zahm oder zu teuer."
                : "Eine nette Runde.";
        },
      });
      continue;
    }
    if (!b.open || !access(s, b, net) || !hasOperator(b)) {
      for (const id of [...b.queue, ...b.riders]) {
        const g = s.guests.find((g) => g.id === id);
        if (g) {
          leaveBuilding(s, b, g, net, exits);
        }
      }
      b.queue = [];
      b.riders = [];
      b.cycle = 0;
      resetRideOperations(b);
      continue;
    }
    const dispatchReady = tickOperations(
      b,
      dt,
      b.open && !!access(s, b, net) && b.tested && !broken(b) && !maintenanceUnavailable(b),
      !sharedExitPending(s, b),
    );
    b.cycle -= dt;
    if (b.riders.length && b.cycle <= 0 && !repeatRideRound(b, rideDuration(b))) {
      for (const id of b.riders) {
        const g = s.guests.find((g) => g.id === id);
        if (g) {
          finishPartyVisit(g, b);
          leaveBuilding(s, b, g, net, exits);
          g.timer = g.sharedExit === b.id ? 0.4 + Math.max(0, b.riders.indexOf(g.id)) * 0.3 : 2;
          if (isAttraction(b.kind)) {
            g.rides++;
            (g.visited ??= []).push(b.id);
            g.visited = g.visited.slice(-8);
            buyRidePhoto(s, b, g);
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
            if (isFood(b.kind)) {
              const food = FOOD[b.kind];
              if (food.drink) g.thirst = 0;
              else g.hunger = 0;
              g.food = { kind: b.kind, remaining: food.duration, total: food.duration };
            }
            if (b.kind === "toilet") g.bladder = 0;
            if (b.kind === "balloon" || b.kind === "plush") g.souvenir = b.kind;
            const price = g.servicePrice ?? Math.min(b.price, g.wallet ?? 60);
            g.servicePrice = undefined;
            g.wallet = Math.max(0, (g.wallet ?? 60) - price);
            b.served++;
            b.revenue += price;
            recordMarketingRevenue(s, g, price, "shop");
            recordFinance(s, "shops", price);
            creditCash(s, price);
            s.income += price;
            s.dayIncome += price;
            s.operatingIncomeToday! += price;
            const supplies = isFood(b.kind)
              ? FOOD[b.kind].supplies
              : b.kind === "balloon"
                ? 1.2
                : b.kind === "plush"
                  ? 4
                  : 0.4;
            spendCash(s, supplies, true);
            s.expenses += supplies;
            s.dayExpenses += supplies;
            s.operatingExpensesToday! += supplies;
            recordFinance(s, "supplies", supplies);
            buyUmbrella(s, b, g);
            if (isFood(b.kind)) giveWaste(s, g, FOOD[b.kind].drink ? "cup" : "wrapper");
            g.happiness = Math.min(100, g.happiness + (b.kind === "toilet" ? 1 : 4));
            g.thought = isFood(b.kind)
              ? `Lecker! Ich genieße ${FOOD[b.kind].name}${g.food ? " unterwegs oder auf einer Bank" : ""}.`
              : b.kind === "balloon"
                ? "Mein Ballon darf mit nach Hause!"
                : b.kind === "plush"
                  ? "Mein neuer Kuschelfreund!"
                  : "Eine erholsame Pause.";
          }
        }
      }
      b.riders = [];
      finishRideProgram(b);
    }
    if (!b.riders.length && b.queue.length && b.cycle <= 0 && dispatchReady) {
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
        if (!isAttraction(b.kind)) g.servicePrice = b.price;
        if (isAttraction(b.kind)) {
          g.wallet = Math.max(0, (g.wallet ?? 60) - b.price);
          b.served++;
          b.revenue += b.price;
          recordMarketingRevenue(s, g, b.price, "ride");
          recordFinance(s, "rides", b.price);
          creditCash(s, b.price);
          s.income += b.price;
          s.dayIncome += b.price;
          s.operatingIncomeToday! += b.price;
        }
      }
      b.cycle = b.riders.length ? rideDuration(b) : 0;
      startRideProgram(b);
    }
  }
  for (const g of s.guests) {
    g.hunger = Math.min(100, g.hunger + dt * 0.14);
    tickUmbrella(g, dt, weatherNow.rain);
    const comfort = guestWeatherComfort(s, g, weatherNow);
    g.thirst = Math.min(100, g.thirst + dt * (0.2 + comfort.extraThirst));
    g.happiness = Math.max(0, Math.min(100, g.happiness + dt * comfort.moodPerSecond));
    g.bladder = Math.min(100, (g.bladder ?? 10) + dt * 0.17);
    g.happiness = Math.max(
      0,
      g.happiness - dt * (g.hunger > 70 || g.thirst > 70 || (g.bladder ?? 0) > 80 ? 0.22 : 0.012),
    );
    g.energy = Math.max(0, (g.energy ?? 80) - dt * 0.055);
    if (g.food) {
      g.food.remaining = Math.max(0, g.food.remaining - dt);
      if (g.food.remaining === 0) g.food = undefined;
    }
    if (g.state === "rest") {
      const b = s.buildings.find((b) => b.id === g.target);
      if (!b || !isAmenity(b.kind) || !b.open || !access(s, b, net) || !g.rest) {
        if (b) leaveBuilding(s, b, g, net, exits);
        else {
          g.state = "walk";
          g.target = null;
          g.rest = undefined;
          g.timer = 1;
        }
        continue;
      }
      g.rest.remaining = Math.max(0, g.rest.remaining - dt);
      g.energy = Math.min(
        100,
        g.energy + (dt * AMENITIES[b.kind].energy) / AMENITIES[b.kind].duration,
      );
      if (g.rest.remaining === 0) {
        finishPartyVisit(g, b);
        g.happiness = Math.min(100, g.happiness + AMENITIES[b.kind].joy);
        (g.visited ??= []).push(b.id);
        g.visited = g.visited.slice(-8);
        g.thought =
          b.kind === "playground" ? "Der Spielplatz macht richtig Spaß!" : "So eine Pause tut gut.";
        b.served++;
        leaveBuilding(s, b, g, net, exits);
        g.timer = 2;
      }
      continue;
    }
    if (g.state === "observe") {
      const b = s.buildings.find((b) => b.id === g.target);
      const spots = b && habitatViewingSpots(s, b, net);
      if (
        !b ||
        !b.open ||
        !b.habitat?.count ||
        !spots?.some((p) => Math.hypot(p.x - g.x, p.y - g.y) < 0.25)
      ) {
        if (b) leaveBuilding(s, b, g, net, exits);
        else {
          g.state = "walk";
          g.target = null;
          g.route = [];
        }
        g.timer = 1;
        g.thought = "Ich suche mir einen anderen Aussichtspunkt.";
        continue;
      }
      g.timer -= dt;
      if (g.timer <= 0) {
        finishPartyVisit(g, b);
        g.rides++;
        (g.visited ??= []).push(b.id);
        g.visited = g.visited.slice(-8);
        g.happiness = Math.max(0, Math.min(100, g.happiness + (rideAppeal(b, g.profile) - 4) * 2));
        g.thought =
          welfare(b) >= 75
            ? "Die Tiere sehen zufrieden aus. Das war ein schöner Besuch!"
            : "Die Tiere brauchen dringend bessere Pflege.";
        leaveBuilding(s, b, g, net, exits);
        g.timer = 2;
      }
      continue;
    }
    if (g.state === "ride") continue;
    if (g.state === "queue") {
      g.timer += dt;
      if (g.timer > 30) {
        g.happiness -= dt * 0.15;
        g.thought = "Die Schlange ist ganz schön lang.";
      }
      const patience = g.profile === "thrill" ? 80 : g.profile === "family" ? 55 : 65;
      if (g.timer > patience) {
        const b = s.buildings.find((b) => b.id === (g.transit?.from ?? g.target));
        g.transit = undefined;
        if (b) b.queue = b.queue.filter((id) => id !== g.id);
        g.state = "walk";
        g.target = null;
        g.timer = 2;
        g.thought = "Zu lange gewartet. Ich suche etwas anderes.";
      }
      continue;
    }
    const sharedExiting = resumeSharedExit(s, g);
    if (g.state === "walk" && g.party && !g.transit && !sharedExiting) {
      const leader = partyLeader(s, g);
      if (
        leader &&
        leader.id !== g.id &&
        (leader.state === "leave" || (leader.target !== null && leader.target !== g.target))
      )
        followParty(s, g, net);
    }
    if (g.timer > 0) {
      g.timer -= dt;
      continue;
    }
    const standing = { x: Math.round(g.x), y: Math.round(g.y), z: g.z };
    if (!g.route.length && walkTile(s, standing) === "exit") {
      // Also resume saved or newly rerouted guests before choosing another destination.
      const onward = followExit(standing, exits, s).slice(1);
      g.route = onward.length ? onward : [standing];
    }
    if (g.route.length) {
      const p = g.route[0];
      const from = { x: Math.round(g.x), y: Math.round(g.y), z: g.z };
      const outgoing = exits.get(walkKey(s, from));
      const validExitStep =
        outgoing && (walkKey(s, from) === walkKey(s, p) || walkKey(s, outgoing) === walkKey(s, p));
      if (
        !inBounds(p.x, p.y, s) ||
        (walkTile(s, from) === "exit" ? !validExitStep : !net.has(walkKey(s, p)))
      ) {
        // Construction can remove a tile under a walking guest. Rejoin nearby infrastructure.
        const candidates = [...net, ...exits.keys()]
          .map(pointFromKey)
          .sort((a, b) => Math.hypot(a.x - g.x, a.y - g.y) - Math.hypot(b.x - g.x, b.y - g.y));
        const safe = candidates[0] ?? ENTRANCE;
        g.x = safe.x;
        g.y = safe.y;
        g.z = walkingHeight(s, safe);
        g.route =
          g.state === "leave"
            ? findRoute(s, safe, ENTRANCE)
            : exits.has(walkKey(s, safe))
              ? followExit(safe, exits, s).slice(1)
              : [];
        g.target = null;
        continue;
      }
      if (!sharedExiting && partyShouldWait(s, g)) {
        g.thought = "Ich lasse meine Begleitung aufschließen.";
        continue;
      }
      const d = Math.hypot(p.x - g.x, p.y - g.y),
        step = dt * partyWalkingSpeed(g);
      if (d <= step) {
        g.x = p.x;
        g.y = p.y;
        g.z = walkingHeight(s, p);
        g.route.shift();
      } else {
        g.z = walkingHeight(s, g) + ((walkingHeight(s, p) - walkingHeight(s, g)) * step) / d;
        g.x += ((p.x - g.x) / d) * step;
        g.y += ((p.y - g.y) / d) * step;
      }
      if (g.route.length) continue;
    }
    if (resumeSharedExit(s, g)) continue;
    if (g.state === "leave") {
      if (Math.hypot(g.x - 15, g.y - 29) < 0.2) {
        if (
          g.party &&
          g.party.kind !== "solo" &&
          partyMembers(s, g).some(
            (other) =>
              other.id !== g.id &&
              (other.state !== "leave" ||
                Math.hypot(other.x - ENTRANCE.x, other.y - ENTRANCE.y) > 1.5),
          )
        ) {
          g.timer = 0.5;
          g.thought = "Am Ausgang warten wir aufeinander.";
          continue;
        }
        g.timer = -999;
      } else {
        g.x = 15;
        g.y = 29;
      }
      continue;
    }
    if (g.transit) {
      const stop = s.buildings.find((b) => b.id === g.transit!.from);
      const a = stop && stopEntrance(s, stop);
      if (stop?.open && a && Math.hypot(g.x - a.x, g.y - a.y) < 0.2) {
        if (!stop.queue.includes(g.id)) stop.queue.push(g.id);
        g.state = "queue";
        g.timer = 0;
        g.thought = `Warte am ${stop.name}.`;
        continue;
      }
      g.transit = undefined;
    }
    if (g.target) {
      const b = s.buildings.find((b) => b.id === g.target);
      if (b && isAmenity(b.kind)) {
        const p = access(s, b, net);
        if (!b.open || !p || !g.rest) {
          leaveBuilding(s, b, g, net, exits);
          continue;
        }
        if (Math.hypot(g.x - p.x, g.y - p.y) > 0.2) {
          g.route = findRoute(s, g, p);
          continue;
        }
        g.state = "rest";
        g.route = [];
        g.timer = 0;
        g.rest.remaining = AMENITIES[b.kind].duration;
        g.thought =
          b.kind === "playground"
            ? "Klettern und rutschen!"
            : b.kind === "shelter" && weatherNow.rain > 0.25
              ? "Hier unter dem Dach bleibe ich trocken."
              : b.kind === "parasol" && weatherNow.heat > 0.2
                ? "Der Schatten tut bei dieser Hitze gut."
                : g.food
                  ? `Pause mit ${FOOD[g.food.kind].name}.`
                  : "Ich ruhe mich auf der Bank aus.";
        continue;
      }
      if (b && isHabitat(b.kind)) {
        const spots = habitatViewingSpots(s, b, net);
        if (!b.open || !b.habitat?.count || !spots.length) {
          leaveBuilding(s, b, g, net, exits);
          g.timer = 1;
          continue;
        }
        if (spots.some((p) => Math.hypot(g.x - p.x, g.y - p.y) < 0.2)) {
          g.state = "observe";
          g.timer = rideDuration(b) * (0.7 + (g.id % 7) * 0.08);
          g.route = [];
          b.served++;
          g.thought = `Ich beobachte die Tiere: ${b.name}.`;
        } else {
          const spot = viewingDestination(s, b, g, net)!;
          g.route = findRoute(s, g, spot);
          if (!g.route.length) {
            leaveBuilding(s, b, g, net, exits);
            g.timer = 1;
          }
        }
        continue;
      }
      if (b && b.open && hasOperator(b) && access(s, b, net)) {
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
          b.queue.length < (isAttraction(b.kind) ? queueCapacity(s, b) : 6)
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
  tickTransit(s, dt);
  tickZoo(s, dt, (park, b) => access(park, b, net));
  tickCleanliness(s, dt);
  s.guests = s.guests.filter((g) => g.timer !== -999);
  const zooStatus = zooStats(s, (_, b) => access(s, b, net));
  const dirtPenalty =
    (100 - cleanlinessScore(s)) * 0.16 +
    (100 - maintenanceScore(s)) * 0.08 +
    (100 - zooStatus.welfare) * 0.12;
  if (s.guests.length)
    s.rating = Math.max(
      0,
      Math.round(s.guests.reduce((a, g) => a + g.happiness, 0) / s.guests.length - dirtPenalty),
    );
  else if (dirtPenalty > 0) s.rating = Math.min(s.rating, Math.round(100 - dirtPenalty));
  let researchDailyProfit = 0;
  if (billingPeriodAt(s.time) !== oldBillingPeriod) {
    const payroll = s.staff * 80 + zooWages(s) + operatorWages(s) + mechanicWages(s);
    const upkeep = s.buildings
      .filter((b) => !decorative(b.kind))
      .reduce(
        (a, b) =>
          a +
          (isHabitat(b.kind)
            ? Math.round(SPECIES[b.kind].upkeep * ((b.habitat?.count ?? 0) > 0 ? 1 : 0.25))
            : Math.round(
                (b.track ? trackCost(b.track) : buildingBaseCost(b)) * 0.022 * (b.open ? 1 : 0.25),
              )),
        0,
      );
    const wages = difficultyCost(s, payroll, "wages"),
      running = difficultyCost(s, upkeep, "upkeep"),
      interest = tickLoanDay(s);
    const cost = wages + running + interest;
    recordFinance(s, "wages", wages);
    recordFinance(s, "upkeep", running);
    recordFinance(s, "interest", interest);
    spendCash(s, cost, true);
    s.expenses += cost;
    s.dayExpenses += cost;
    s.operatingExpensesToday! += cost;
    s.operatingProfit = s.operatingIncomeToday! - s.operatingExpensesToday!;
    researchDailyProfit = s.operatingProfit;
    s.operatingIncomeToday = 0;
    s.operatingExpensesToday = 0;
    s.lastProfit = s.dayIncome - s.dayExpenses;
    closeFinancePeriod(s);
    s.dayIncome = 0;
    s.dayExpenses = 0;
    const staffing = Math.min(1, s.staff / Math.max(1, s.guests.length / 25));
    for (const g of s.guests) {
      const nearby = s.buildings.filter(
        (b) =>
          !["bin", "keeperhut"].includes(b.kind) &&
          decorative(b.kind) &&
          Math.hypot(b.x - g.x, b.y - g.y) < 4,
      ).length;
      g.happiness = Math.max(0, Math.min(100, g.happiness + (nearby ? 1 : 0) - (1 - staffing) * 3));
    }
  }
  tickResearchCoins(s, dt, researchDailyProfit);
  const goal = scenarioOf(s),
    openRides = s.buildings.filter(
      (b) => isRide(b.kind) && b.open && hasOperator(b) && b.tested && access(s, b, net),
    );
  if (
    s.mode === "scenario" &&
    !s.won &&
    !customScenarioExpired(s) &&
    s.arrivals >= goal.arrivals &&
    s.rating >= goal.rating &&
    openRides.length >= goal.rides &&
    (!goal.value || parkValue(s) >= goal.value) &&
    (!goal.profit || (s.operatingProfit ?? 0) >= goal.profit) &&
    openRides.filter((b) => b.kind === "coaster").length >= goal.coasters &&
    cleanlinessScore(s) >= goal.cleanliness &&
    maintenanceScore(s) >= goal.condition &&
    zooStatus.healthyOpen >= goal.species &&
    zooStatus.welfare >= goal.welfare
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
      inBounds(p.x, p.y, s) &&
      (p.z === undefined || (Number.isInteger(p.z) && p.z >= 0 && p.z <= 5));
    const trackPoint = (p: Point) =>
      p &&
      (p.drive === undefined || validDrive(p.drive)) &&
      (p.smooth === undefined || typeof p.smooth === "boolean") &&
      (p.inversion === undefined || typeof p.inversion === "boolean") &&
      (p.heading === undefined || num(p.heading)) &&
      (p.style === undefined || Object.hasOwn(COASTER_TYPES, p.style)) &&
      (p.smooth
        ? num(p.x) &&
          num(p.y) &&
          inBounds(p.x, p.y, s) &&
          num(p.z) &&
          p.z! >= 0 &&
          p.z! <= coasterMaxHeight(p.style) &&
          !(p.style === "wood" && p.inversion)
        : point(p));
    if (
      !validateLoan(s) ||
      !validScenery(s) ||
      !validCustomScenario(s.customScenario) ||
      !validCalendar(s) ||
      !validDifficulty(s) ||
      (s.unlimitedBudget !== undefined && typeof s.unlimitedBudget !== "boolean") ||
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
      s.tiles.length < SIZE ||
      s.tiles.length > MAX_SIZE ||
      !s.tiles.every(
        (r) =>
          Array.isArray(r) &&
          r.length >= SIZE &&
          r.length <= MAX_SIZE &&
          r.length === s.tiles[0].length &&
          r.every((t) => ["grass", "path", "queue", "exit", "water"].includes(t)),
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
    if (
      s.buildings.some(
        (b) =>
          b.photoPoint !== undefined &&
          (b.kind !== "coaster" ||
            !b.track ||
            !Number.isFinite(b.photoPoint) ||
            b.photoPoint < 0 ||
            b.photoPoint > 1),
      )
    )
      return false;
    if (!validResearchCoins(s) || !validEntrance(s) || !validTerrain(s)) return false;
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
        r.remaining > (r.active ? RESEARCH[r.active].duration : 0) ||
        (r.active !== null && r.completed.includes(r.active))
      )
        return false;
    }
    if (s.draft !== undefined) {
      const d = s.draft;
      if (
        !d ||
        (d.piece !== undefined && !Object.hasOwn(PIECES, d.piece)) ||
        !Array.isArray(d.track) ||
        d.track.length > 2048 ||
        !d.track.every(trackPoint) ||
        !Array.isArray(d.history) ||
        d.history.length > 128 ||
        !d.history.every((n) => Number.isInteger(n) && n >= 0 && n < d.track.length) ||
        (d.historyEnds !== undefined &&
          (!Array.isArray(d.historyEnds) ||
            d.historyEnds.length !== d.history.length ||
            !d.historyEnds.every((p, i) => (d.history[i] === 0 ? p === null : trackPoint(p!))))) ||
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
    if (
      !validCleanliness(s) ||
      !validMaintenance(s) ||
      !validFinance(s) ||
      !validRetail(s) ||
      !validMarketing(s) ||
      !validZoo(s) ||
      !validParkLife(s) ||
      !validOperations(s) ||
      !validWheelStates(s) ||
      !validCoasterFleets(s) ||
      !validCrewPool(s)
    )
      return false;
    const ids = new Set<number>();
    for (const b of s.buildings) {
      if (
        !b ||
        !Object.hasOwn(CATALOG, b.kind) ||
        !Number.isInteger(b.x) ||
        !Number.isInteger(b.y) ||
        !inBounds(b.x, b.y, s) ||
        (b.orientation !== undefined &&
          (!Number.isInteger(b.orientation) || b.orientation < 0 || b.orientation > 3)) ||
        (b.pods !== undefined &&
          ((!usesPods(b.kind) && !isHabitat(b.kind)) ||
            !validPods(b.pods, CATALOG[b.kind].size) ||
            Object.values(b.pods).some(
              (p) =>
                !inBounds(
                  podPort(b, CATALOG[b.kind].size, p).x,
                  podPort(b, CATALOG[b.kind].size, p).y,
                  s,
                ),
            ))) ||
        (b.sharedAccess !== undefined &&
          (typeof b.sharedAccess !== "boolean" ||
            !needsOperator(b.kind) ||
            (b.sharedAccess && !b.pods))) ||
        (b.condition !== undefined &&
          (!num(b.condition) || b.condition < 0 || b.condition > 100)) ||
        (b.vehicle !== undefined && (b.kind !== "coaster" || !validVehicle(b.vehicle))) ||
        (b.kind === "custom" && !validDesign(b.design)) ||
        (b.kind !== "custom" && b.design !== undefined) ||
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
    if (s.trackEdit !== undefined) {
      const e = s.trackEdit,
        b = s.buildings.find((b) => b.id === e.buildingId);
      const editPoint = (p: Point) =>
        !!p &&
        (p.drive === undefined || validDrive(p.drive)) &&
        Number.isFinite(p.x + p.y + (p.z ?? 0) + (p.heading ?? 0)) &&
        p.smooth === true &&
        p.style === (b?.track?.[0]?.style ?? "steel") &&
        p.x >= 0 &&
        p.y >= 0 &&
        p.x < mapWidth(s) &&
        p.y < mapHeight(s) &&
        (p.z ?? 0) >= 0 &&
        (p.z ?? 0) <= 8;
      if (
        !b ||
        b.kind !== "coaster" ||
        b.open ||
        b.riders.length ||
        b.queue.length ||
        typeof e.wasOpen !== "boolean" ||
        !num(e.removedLength) ||
        e.removedLength < 0 ||
        !Array.isArray(e.prefix) ||
        !Array.isArray(e.suffix) ||
        e.prefix.length < 1 ||
        e.suffix.length < 1 ||
        e.prefix.length + e.suffix.length > 2050 ||
        !e.prefix.every(editPoint) ||
        !e.suffix.every(editPoint) ||
        !s.draft
      )
        return false;
      const first = e.prefix[0],
        last = e.suffix.at(-1)!;
      const actual = b.track![0].smooth ? b.track![0] : prepareRoute(b.track!).points[0];
      const matches = (anchor: Point) =>
        Math.hypot(first.x - anchor.x, first.y - anchor.y, (first.z ?? 0) - (anchor.z ?? 0)) <
        0.001;
      if (
        (!matches(actual) && !matches({ x: b.x, y: b.y, z: b.track![0].z })) ||
        first.x !== last.x ||
        first.y !== last.y ||
        (first.z ?? 0) !== (last.z ?? 0)
      )
        return false;
    }
    const buildingIds = new Set(ids);
    if (!validVisitorParties(s)) return false;
    for (const g of s.guests) {
      if (
        !g ||
        (g.name !== undefined &&
          (typeof g.name !== "string" || g.name.length < 1 || g.name.length > 80)) ||
        (g.sharedExit !== undefined &&
          (!Number.isSafeInteger(g.sharedExit) ||
            !s.buildings.some(
              (b) => b.id === g.sharedExit && b.sharedAccess && needsOperator(b.kind),
            ) ||
            g.state !== "walk" ||
            g.target !== null ||
            !!g.transit)) ||
        (g.souvenir !== undefined && !["balloon", "plush"].includes(g.souvenir)) ||
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
        g.x >= mapWidth(s) ||
        g.y < 0 ||
        g.y >= mapHeight(s) ||
        ![0, 1, 2].includes(g.skin) ||
        typeof g.thought !== "string" ||
        !["walk", "queue", "ride", "observe", "rest", "leave"].includes(g.state) ||
        (g.state === "rest" &&
          (!g.rest ||
            g.transit ||
            !s.buildings.some((b) => b.id === g.target && isAmenity(b.kind)))) ||
        (g.state === "observe" &&
          (g.transit || !s.buildings.some((b) => b.id === g.target && isHabitat(b.kind)))) ||
        !Array.isArray(g.route) ||
        !g.route.every(
          (p) =>
            point({ ...p, z: undefined }) &&
            (p.z === undefined || (Number.isFinite(p.z) && p.z >= -4 && p.z <= 11)),
        ) ||
        (g.target !== null && !buildingIds.has(g.target))
      )
        return false;
      ids.add(g.id);
    }
    const guests = new Set(s.guests.map((g) => g.id));
    if (s.landValue !== undefined && (!num(s.landValue) || s.landValue < 0)) return false;
    if (s.transitLines !== undefined) {
      if (!Array.isArray(s.transitLines) || s.transitLines.length > 100) return false;
      const stops = new Set<number>();
      for (const l of s.transitLines) {
        if (
          !l ||
          !Number.isInteger(l.id) ||
          ids.has(l.id) ||
          !["train", "shuttle"].includes(l.kind) ||
          !buildingIds.has(l.a) ||
          !buildingIds.has(l.b) ||
          l.a === l.b ||
          stops.has(l.a) ||
          stops.has(l.b) ||
          typeof l.enabled !== "boolean" ||
          ![1, -1].includes(l.direction) ||
          !Array.isArray(l.route) ||
          l.route.length < 6 ||
          l.route.length > MAX_SIZE * MAX_SIZE ||
          !l.route.every(point) ||
          l.route.some(
            (p, i) =>
              i > 0 && Math.abs(p.x - l.route[i - 1].x) + Math.abs(p.y - l.route[i - 1].y) !== 1,
          ) ||
          ![l.position, l.wait, l.trips, l.served, l.revenue].every(num) ||
          l.position < 0 ||
          l.position > l.route.length - 1 ||
          l.wait < 0 ||
          l.wait > 4 ||
          !Array.isArray(l.passengers) ||
          l.passengers.length > (l.kind === "train" ? 12 : 8) ||
          !l.passengers.every((id) => guests.has(id))
        )
          return false;
        if (
          s.buildings.find((b) => b.id === l.a)?.kind !== l.kind ||
          s.buildings.find((b) => b.id === l.b)?.kind !== l.kind ||
          new Set(l.passengers).size !== l.passengers.length ||
          l.passengers.some((id) => {
            const g = s.guests.find((g) => g.id === id);
            return g?.state !== "ride" || g.transit?.line !== l.id;
          }) ||
          (l.wait > 0 &&
            !(
              (l.position === 0 && l.direction === 1) ||
              (l.position === l.route.length - 1 && l.direction === -1)
            ))
        )
          return false;
        ids.add(l.id);
        stops.add(l.a);
        stops.add(l.b);
      }
    }
    for (const g of s.guests)
      if (g.transit) {
        const t = g.transit,
          l = s.transitLines?.find((l) => l.id === t.line);
        if (g.state === "queue" && !s.buildings.find((b) => b.id === t.from)?.queue.includes(g.id))
          return false;
        if (
          !l ||
          !((t.from === l.a && t.to === l.b) || (t.from === l.b && t.to === l.a)) ||
          (t.fare !== undefined && (!num(t.fare) || t.fare < 0 || t.fare > 30)) ||
          (g.state === "ride" && !l.passengers.includes(g.id))
        )
          return false;
      }
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

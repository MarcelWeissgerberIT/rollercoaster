import type { Building, Point } from "./simulation";
import {
  SPECIES,
  type Species,
  habitatHasFeature,
  habitatBarrier,
  habitatHasElectric,
  habitatSafety,
} from "./zoo";
import { HABITAT_PROFILES, type HabitatFeatureId as FeatureId } from "./habitat-needs";

export type FixtureKind =
  | "feeder"
  | "browse"
  | "bamboo"
  | "meat"
  | "fish"
  | "trough"
  | "pool"
  | "mud"
  | "rock"
  | "cave"
  | "shade"
  | "log"
  | "climbing"
  | "nest"
  | "planting"
  | "foraging"
  | "filter";
export type HabitatFixture = {
  id: string;
  kind: FixtureKind;
  purpose: "food" | "water" | "rest" | "play" | "landscape";
  /** Footprint normalized to the complete habitat square. */
  u: number;
  v: number;
  width: number;
  depth: number;
  /** Height in world metres (one tile is five metres). */
  height: number;
  solid: boolean;
  shape?: "ellipse";
  feature?: FeatureId;
  approach: { u: number; v: number };
};
export type HabitatLayout = {
  size: number;
  species: Species;
  center: Point;
  food: Point;
  water: Point;
  shelter: Point;
  enrichment: Point;
  waterRadius: { x: number; y: number };
  fixtures: HabitatFixture[];
  barrier: "wood" | "reinforced" | "glass";
  electric: boolean;
  electricInstalled: boolean;
  safety: "safe" | "warning" | "closed";
  ground: string;
};
const cache = new WeakMap<Building, { key: string; layout: HabitatLayout }>();
const features: FeatureId[] = [
  "foraging",
  "rubbing",
  "pool",
  "rocks",
  "shelter",
  "climbing",
  "nesting",
  "planting",
];
export function habitatLayout(b: Building): HabitatLayout {
  const species = b.kind as Species,
    n = SPECIES[species].size;
  const enabled = features.map((id) => habitatHasFeature(b, id));
  const barrier = habitatBarrier(b),
    electric = habitatHasElectric(b),
    electricInstalled =
      HABITAT_PROFILES[species].electric &&
      !!(b.habitat?.safety?.electricInstalled || b.habitat?.safety?.electric);
  const safety = habitatSafety(b).status;
  const key = `${b.kind}:${b.x}:${b.y}:${enabled.join()}:${barrier}:${electric}:${electricInstalled}:${safety}`;
  const previous = cache.get(b);
  if (previous?.key === key) return previous.layout;
  const has = (id: FeatureId) => enabled[features.indexOf(id)];
  const point = (u: number, v: number): Point => ({ x: b.x - 0.5 + n * u, y: b.y - 0.5 + n * v });
  const fixtures: HabitatFixture[] = [];
  const add = (
    id: string,
    kind: FixtureKind,
    purpose: HabitatFixture["purpose"],
    u: number,
    v: number,
    width: number,
    depth: number,
    height: number,
    solid: boolean,
    au: number,
    av: number,
    feature?: FeatureId,
  ) => {
    const f: HabitatFixture = {
      id,
      kind,
      purpose,
      u,
      v,
      width,
      depth,
      height,
      solid,
      approach: { u: au, v: av },
      feature,
    };
    if (["pool", "mud", "rock", "planting", "foraging"].includes(kind)) f.shape = "ellipse";
    fixtures.push(f);
    return f;
  };
  const birds = species === "penguin" || species === "flamingo";
  const ground =
    species === "penguin"
      ? "#c9ccbe"
      : species === "flamingo"
        ? "#b9bf83"
        : species === "panda"
          ? "#829b62"
          : species === "elephant"
            ? "#b9a87d"
            : "#b4af70";
  // All approaches face the open centre, with room for a 0.65-tile elephant.
  const food = add(
    "food-main",
    species === "giraffe"
      ? "browse"
      : species === "panda"
        ? "bamboo"
        : species === "lion"
          ? "meat"
          : birds
            ? "fish"
            : "feeder",
    "food",
    0.19,
    0.18,
    0.16,
    0.1,
    species === "giraffe" ? 4.4 : 0.8,
    true,
    0.32,
    0.35,
  );
  let water: HabitatFixture;
  if (birds || has("pool")) {
    water = add(
      "water-main",
      "pool",
      "water",
      0.73,
      0.67,
      birds ? (has("pool") ? 0.49 : 0.39) : 0.3,
      birds ? (has("pool") ? 0.46 : 0.4) : 0.27,
      0.04,
      false,
      birds ? 0.62 : 0.47,
      birds ? 0.63 : 0.64,
      has("pool") ? "pool" : undefined,
    );
    if (has("pool"))
      add(
        "water-filter",
        "filter",
        "water",
        0.88,
        0.4,
        0.095,
        0.085,
        1.0,
        true,
        0.68,
        0.41,
        "pool",
      );
  } else water = add("water-main", "trough", "water", 0.8, 0.69, 0.12, 0.2, 0.62, true, 0.59, 0.65);
  let rest: HabitatFixture | undefined;
  if (has("shelter")) {
    rest = add(
      "rest-main",
      species === "lion" || species === "penguin" ? "cave" : "shade",
      "rest",
      0.76,
      0.19,
      0.3,
      0.25,
      species === "giraffe" ? 5.7 : species === "elephant" ? 4.1 : 2.5,
      true,
      0.64,
      0.46,
      "shelter",
    );
  }
  let play: HabitatFixture | undefined;
  if (has("climbing"))
    play = add(
      "play-climbing",
      "climbing",
      "play",
      0.19,
      0.74,
      0.23,
      0.23,
      2.7,
      true,
      0.43,
      0.67,
      "climbing",
    );
  if (has("rubbing"))
    play = add(
      "play-rubbing",
      "log",
      "play",
      0.19,
      0.74,
      0.22,
      0.09,
      1.8,
      true,
      0.43,
      0.67,
      "rubbing",
    );
  if (has("foraging")) {
    const elevated = species === "elephant" || species === "giraffe";
    const f = add(
      "play-foraging",
      elevated ? "browse" : "foraging",
      "play",
      0.48,
      0.86,
      0.19,
      0.1,
      elevated ? (species === "giraffe" ? 4.3 : 2.4) : 0.13,
      elevated,
      0.47,
      0.65,
      "foraging",
    );
    play ??= f;
  }
  if (has("pool") && species === "elephant")
    add("mud-wallow", "mud", "landscape", 0.7, 0.88, 0.25, 0.1, 0.02, false, 0.6, 0.77, "pool");
  if (has("rocks"))
    add(
      "rocks-main",
      "rock",
      "rest",
      0.5,
      0.13,
      0.13,
      0.16,
      species === "lion" ? 2.1 : 1.2,
      true,
      0.48,
      0.37,
      "rocks",
    );
  if (has("nesting")) {
    const nest = add(
      "nest-main",
      "nest",
      "rest",
      0.23,
      0.8,
      0.2,
      0.16,
      species === "penguin" ? 0.6 : 0.35,
      true,
      0.38,
      0.68,
      "nesting",
    );
    rest ??= nest;
    play ??= nest;
  }
  if (has("planting")) {
    // Dense perimeter cover, kept away from drinking and feeding approaches.
    add(
      "planting-west",
      "planting",
      "landscape",
      0.065,
      0.44,
      0.08,
      0.33,
      species === "panda" ? 3.2 : species === "giraffe" ? 4.5 : 1.7,
      true,
      0.27,
      0.46,
      "planting",
    );
    add(
      "planting-north",
      "planting",
      "landscape",
      0.38,
      0.045,
      0.23,
      0.06,
      species === "panda" ? 2.9 : 1.2,
      true,
      0.38,
      0.28,
      "planting",
    );
  }
  const approach = (f: HabitatFixture) => point(f.approach.u, f.approach.v);
  const layout: HabitatLayout = {
    size: n,
    species,
    center: point(0.5, 0.5),
    food: approach(food),
    water: approach(water),
    shelter: rest ? approach(rest) : point(0.63, 0.37),
    enrichment: play ? approach(play) : point(0.35, 0.68),
    waterRadius:
      water.kind === "pool"
        ? { x: (water.width * n) / 2, y: (water.depth * n) / 2 }
        : { x: 0, y: 0 },
    fixtures,
    barrier,
    electric,
    electricInstalled,
    safety,
    ground,
  };
  cache.set(b, { key, layout });
  return layout;
}
/** Absolute tile position and dimensions of the visible fixture. */
export function fixtureWorld(b: Building, f: HabitatFixture) {
  const n = SPECIES[b.kind as Species].size;
  return {
    x: b.x - 0.5 + f.u * n,
    y: b.y - 0.5 + f.v * n,
    width: f.width * n,
    depth: f.depth * n,
    height: f.height,
    approach: { x: b.x - 0.5 + f.approach.u * n, y: b.y - 0.5 + f.approach.v * n },
  };
}
/** Includes the boundary. Positive radius is the animal's footprint, in tiles. */
export function habitatPointBlocked(b: Building, worldX: number, worldY: number, radiusTiles = 0) {
  const layout = habitatLayout(b),
    n = layout.size,
    r = Math.max(0, radiusTiles);
  if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return true;
  const u = worldX - b.x + 0.5,
    v = worldY - b.y + 0.5;
  if (u < 0.09 + r || v < 0.09 + r || u > n - 0.09 - r || v > n - 0.09 - r) return true;
  return layout.fixtures.some((f) => {
    if (!f.solid) return false;
    const dx = Math.abs(u - f.u * n),
      dy = Math.abs(v - f.v * n),
      hx = (f.width * n) / 2,
      hy = (f.depth * n) / 2;
    if (f.shape === "ellipse") return (dx / (hx + r)) ** 2 + (dy / (hy + r)) ** 2 < 1;
    // Rounded Minkowski rectangle, avoids overblocking diagonal approaches.
    return Math.hypot(Math.max(0, dx - hx), Math.max(0, dy - hy)) < r || (dx < hx && dy < hy);
  });
}

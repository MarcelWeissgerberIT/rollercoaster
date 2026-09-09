import type { Building, Guest, Park, Point } from "./simulation";

export const FOOD = {
  burger: { name: "Burger", color: "#dba544", supplies: 3, duration: 24, drink: false },
  hotdog: { name: "Hotdog", color: "#dc8055", supplies: 2.5, duration: 22, drink: false },
  icecream: { name: "Eis", color: "#efb6cf", supplies: 1.4, duration: 28, drink: false },
  popcorn: { name: "Popcorn", color: "#efd27e", supplies: 1.2, duration: 30, drink: false },
  drink: { name: "Limonade", color: "#a7d8c8", supplies: 1.5, duration: 18, drink: true },
  coffee: { name: "Kaffee", color: "#bc8d6b", supplies: 1.6, duration: 24, drink: true },
} as const;
export type FoodKind = keyof typeof FOOD;
export const isFood = (kind: string): kind is FoodKind => Object.hasOwn(FOOD, kind);
export type Food = { kind: FoodKind; remaining: number; total: number };
export const AMENITIES = {
  bench: { seats: 2, duration: 18, energy: 26, joy: 3 },
  picnic: { seats: 4, duration: 24, energy: 34, joy: 5 },
  playground: { seats: 8, duration: 32, energy: 12, joy: 12 },
} as const;
export type AmenityKind = keyof typeof AMENITIES;
export const isAmenity = (kind: string): kind is AmenityKind => Object.hasOwn(AMENITIES, kind);
export type Rest = { slot: number; remaining: number };
export function amenityRoom(s: Park, b: Building, g?: Guest) {
  if (!isAmenity(b.kind)) return -1;
  const used = new Set(
    s.guests.filter((v) => v.id !== g?.id && v.target === b.id && v.rest).map((v) => v.rest!.slot),
  );
  return (
    Array.from({ length: AMENITIES[b.kind].seats }, (_, i) => i).find((i) => !used.has(i)) ?? -1
  );
}
/** Visual seating keeps navigation on the reachable path outside the furniture footprint. */
export function restPose(
  b: Building,
  g: Guest,
  time: number,
): Point & { yaw: number; seated: boolean; height: number } {
  const slot = g.rest?.slot ?? 0;
  if (b.kind === "playground") {
    const f = (time * 0.065 + slot / 8) % 1;
    // Children climb the tower, then slide down the long chute.
    return {
      x: b.x + 0.3 + f * 1.35,
      y: b.y + 0.7 + f * 0.8,
      z: 0,
      yaw: -Math.PI * 0.7,
      seated: false,
      height: Math.max(0, 1 - f * 1.5) * 1.3,
    };
  }
  return {
    x: b.x + (slot % 2 ? 0.15 : -0.15),
    y: b.y + (b.kind === "picnic" ? (slot < 2 ? -0.19 : 0.19) : 0),
    yaw: b.kind === "picnic" && slot >= 2 ? 0 : Math.PI,
    seated: true,
    height: 0.8,
  };
}
export const PATH_STYLES = {
  garden: { name: "Sandweg", color: "#d9bb83", edge: "#ad925f", description: "Warm und natürlich" },
  stone: {
    name: "Naturstein",
    color: "#b7c4bf",
    edge: "#829a93",
    description: "Ruhige graugrüne Platten",
  },
  brick: {
    name: "Terrakotta",
    color: "#d3a298",
    edge: "#a9756c",
    description: "Warme Pflastersteine",
  },
  boardwalk: {
    name: "Holzsteg",
    color: "#b99b73",
    edge: "#816747",
    description: "Holzplanken für Zoo und Ufer",
  },
} as const;
export type PathStyle = keyof typeof PATH_STYLES;
export const pathStyleAt = (s: Park, x: number, y: number): PathStyle =>
  s.pathStyles?.[`${x},${y}`] ?? "garden";
export function validParkLife(s: Park) {
  if (
    s.pathStyles !== undefined &&
    (!s.pathStyles || typeof s.pathStyles !== "object" || Array.isArray(s.pathStyles))
  )
    return false;
  for (const [key, style] of Object.entries(s.pathStyles ?? {})) {
    const [x, y] = key.split(",").map(Number);
    if (
      `${x},${y}` !== key ||
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      s.tiles[y]?.[x] !== "path" ||
      !Object.hasOwn(PATH_STYLES, style)
    )
      return false;
  }
  // Walking reservations and occupied seats share one capacity budget.
  const reservedSeats = new Set<string>();
  const buildings = new Map(s.buildings.map((b) => [b.id, b]));
  for (const guest of s.guests) {
    if (!guest.rest) continue;
    const building = buildings.get(guest.target!);
    if (!building || !isAmenity(building.kind) || guest.rest.slot >= AMENITIES[building.kind].seats)
      return false;
    const seat = `${building.id}:${guest.rest.slot}`;
    if (reservedSeats.has(seat)) return false;
    reservedSeats.add(seat);
  }
  return s.guests.every(
    (g) =>
      (g.energy === undefined || (Number.isFinite(g.energy) && g.energy >= 0 && g.energy <= 100)) &&
      (!g.food ||
        (isFood(g.food.kind) &&
          Number.isFinite(g.food.remaining) &&
          g.food.remaining >= 0 &&
          g.food.remaining <= g.food.total &&
          g.food.total > 0 &&
          g.food.total <= 60)) &&
      (!g.rest ||
        (Number.isInteger(g.rest.slot) &&
          g.rest.slot >= 0 &&
          g.rest.slot < 8 &&
          Number.isFinite(g.rest.remaining) &&
          g.rest.remaining >= 0 &&
          g.rest.remaining <= 40)),
  );
}

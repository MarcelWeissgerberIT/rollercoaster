import { CATALOG, footprint, type Park, type Building } from "./simulation";
import { mapWidth, mapHeight } from "./grid";
import { prepareRoute } from "./motion";

export type BirdPhase = "flight" | "glide" | "landing" | "perched" | "takeoff";
export type BirdPerch = { buildingId: number; x: number; y: number; z: number };
export type BirdPose = {
  id: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  bank: number;
  phase: BirdPhase;
  wing: number;
  tipFold: number;
  headDip: number;
  headTurn: number;
  feet: number;
  opacity: number;
  perchBlend: number;
  perchId?: number;
};
export type BirdPoint = { x: number; y: number; z: number };
export const BIRD_COLORS = [
  { body: "#adb8ba", breast: "#e8e8d8", wing: "#647c86", tip: "#3c515b", beak: "#d39c4e" },
  { body: "#716959", breast: "#c9bca0", wing: "#514f43", tip: "#363e37", beak: "#bd944b" },
  { body: "#d6d9ce", breast: "#faf2dc", wing: "#839ba0", tip: "#445d68", beak: "#d5a553" },
] as const;
const smooth = (t: number) => {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
};
const mix = (a: number, b: number, u: number) => a + (b - a) * u;
const mixAngle = (a: number, b: number, u: number) =>
  a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * u;
const hash = (n: number) => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};
/** The same actual crown heights used by populatePark's tree models (metres → tiles). */
export function birdPerch(b: Building): BirdPerch | null {
  if (b.kind !== "tree" && b.kind !== "pine") return null;
  const variation = 0.85 + (b.id % 7) * 0.04;
  return {
    buildingId: b.id,
    x: b.x,
    y: b.y,
    z: (b.z ?? 0) + ((b.kind === "pine" ? 9.5 : 9.3) * variation) / 5,
  };
}
/** Curved approach with a flat flare at the crown; departure opens into a rising turn. */
export function birdApproach(
  perch: BirdPerch,
  cruise: number,
  progress: number,
  takeoff = false,
): BirdPoint {
  const u = smooth(progress),
    remaining = takeoff ? u : 1 - u,
    angle =
      hash(perch.buildingId * 17 + 31) * Math.PI * 2 + (takeoff ? Math.PI : 0) + u * Math.PI * 2,
    radius = 3.5 * remaining;
  return {
    x: perch.x + Math.cos(angle) * radius,
    y: perch.y + Math.sin(angle) * radius,
    z: perch.z + (cruise - perch.z) * remaining * remaining,
  };
}
function approachDirection(perch: BirdPerch, cruise: number, u: number, takeoff = false) {
  const a = birdApproach(perch, cruise, Math.max(0, u - 0.0001), takeoff),
    b = birdApproach(perch, cruise, Math.min(1, u + 0.0001), takeoff);
  return {
    heading: Math.atan2(b.y - a.y, b.x - a.x),
    pitch: Math.atan2(b.z - a.z, Math.hypot(b.x - a.x, b.y - a.y)),
  };
}
const trackIds = new WeakMap<object, number>();
let nextTrackId = 1;
const layouts = new WeakMap<object, { signature: string; perches: BirdPerch[]; cruise: number }>();
function birdLayout(park: Pick<Park, "buildings" | "terrain">) {
  const signature =
    park.buildings
      .map((b) => {
        if (b.track && !trackIds.has(b.track)) trackIds.set(b.track, nextTrackId++);
        return `${b.id}:${b.kind}:${b.x}:${b.y}:${b.z ?? 0}:${b.track ? trackIds.get(b.track) : 0}`;
      })
      .join(";") + JSON.stringify(park.terrain ?? {});
  const cached = layouts.get(park);
  if (cached?.signature === signature) return cached;
  const obstacles = new Map<string, Map<number, number>>();
  const block = (x: number, y: number, id: number, height: number) => {
    const key = `${x},${y}`,
      cell = obstacles.get(key) ?? new Map<number, number>();
    cell.set(id, Math.max(cell.get(id) ?? 0, height));
    obstacles.set(key, cell);
  };
  let cruise = 13;
  for (const [cell, z] of Object.entries(park.terrain ?? {})) {
    const [x, y] = cell.split(",").map(Number);
    block(x, y, -1, z);
    cruise = Math.max(cruise, z + 3);
  }
  for (const b of park.buildings)
    if (b.track) {
      for (const p of prepareRoute(b.track).points) {
        cruise = Math.max(cruise, (p.z ?? 0) + 3);
        for (let y = Math.ceil(p.y - 0.9); y <= Math.floor(p.y + 0.9); y++)
          for (let x = Math.ceil(p.x - 0.9); x <= Math.floor(p.x + 0.9); x++)
            block(x, y, b.id, (p.z ?? 0) + 0.3);
      }
    } else {
      const height =
        birdPerch(b)?.z ??
        (b.z ?? 0) +
          (b.kind === "drop"
            ? 12
            : b.kind === "wheel"
              ? 10
              : ["flowers", "bench", "bin", "picnic"].includes(b.kind)
                ? 0.4
                : (CATALOG[b.kind]?.size ?? 1) > 2
                  ? 7
                  : 2);
      cruise = Math.max(cruise, height + 2);
      for (const p of footprint(b)) block(p.x, p.y, b.id, height);
    }
  const clear = (perch: BirdPerch) => {
    for (const takeoff of [false, true])
      for (let step = 0; step <= 64; step++) {
        const p = birdApproach(perch, cruise, step / 64, takeoff);
        for (let y = Math.ceil(p.y - 0.68); y <= Math.floor(p.y + 0.68); y++)
          for (let x = Math.ceil(p.x - 0.68); x <= Math.floor(p.x + 0.68); x++)
            for (const [id, height] of obstacles.get(`${x},${y}`) ?? [])
              if (id !== perch.buildingId && height + 0.12 > p.z) return false;
      }
    return true;
  };
  const perches = park.buildings
    .flatMap((b) => {
      const p = birdPerch(b);
      return p && clear(p) ? [p] : [];
    })
    .sort((a, b) => a.buildingId - b.buildingId);
  const result = { signature, perches, cruise };
  layouts.set(park, result);
  return result;
}
export const birdPerches = (park: Pick<Park, "buildings" | "terrain">): BirdPerch[] =>
  birdLayout(park).perches;
const mixPoint = (a: BirdPoint, b: BirdPoint, u: number): BirdPoint => ({
  x: mix(a.x, b.x, u),
  y: mix(a.y, b.y, u),
  z: mix(a.z, b.z, u),
});

/** A few deterministic local birds. No random calls, saved counters or simulation mutations. */
export function parkBirds(park: Park, time = park.time): BirdPose[] {
  const width = mapWidth(park),
    height = mapHeight(park),
    count = Math.min(5, Math.max(3, Math.floor((width + height) / 20))),
    layout = birdLayout(park),
    perches = layout.perches,
    // Cruise above every designed coaster plus the tallest stock attractions.
    cruise = layout.cruise,
    at = Math.max(0, Number.isFinite(time) ? time : 0);
  return Array.from({ length: count }, (_, id) => {
    const period = 100 + id * 3,
      clock = at + id * 23 + 9,
      cycle = Math.floor(clock / period),
      local = clock - cycle * period,
      r = hash(id * 1789 + cycle * 37 + width * 3 + height * 7),
      ownPerches = perches.filter((_, i) => i % count === id),
      perch =
        cycle % 3 !== 2 && ownPerches.length
          ? ownPerches[Math.floor(r * ownPerches.length)]
          : undefined,
      entry = { x: -10, y: height * (0.2 + hash(id * 41 + cycle) * 0.6), z: cruise + id * 0.55 },
      exit = {
        x: width + 10,
        y: height * (0.2 + hash(id * 53 + cycle + 4) * 0.6),
        z: cruise + id * 0.55,
      },
      flightHeight = cruise + id * 0.55,
      approachStart = perch ? birdApproach(perch, flightHeight, 0) : mixPoint(entry, exit, 0.5),
      departureEnd = perch
        ? birdApproach(perch, flightHeight, 1, true)
        : mixPoint(entry, exit, 0.5),
      heading = Math.atan2(exit.y - entry.y, exit.x - entry.x);
    let point: BirdPoint,
      phase: BirdPhase = "flight",
      wing = Math.sin(clock * Math.PI * 6.2 + id) * 0.9,
      tipFold = 0.08,
      pitch = 0,
      bank = 0,
      feet = 0,
      opacity = 1,
      perchBlend = 0,
      facing = heading;
    if (!perch) {
      const u = Math.min(1, local / period);
      point = mixPoint(entry, exit, u);
      point.y += Math.sin(u * Math.PI * 2) * 1.7;
      point.z += Math.sin(u * Math.PI * 2) * 0.5;
      facing = Math.atan2(
        exit.y - entry.y + Math.cos(u * Math.PI * 2) * 1.7 * Math.PI * 2,
        exit.x - entry.x,
      );
      bank = Math.sin(u * Math.PI * 2) * -0.18;
      pitch = Math.cos(u * Math.PI * 2) * 0.07;
      opacity = smooth(local / 3) * smooth((period - local) / 3);
    } else if (local < 26) {
      point = mixPoint(entry, approachStart, smooth(local / 26));
      facing = mixAngle(
        Math.atan2(approachStart.y - entry.y, approachStart.x - entry.x),
        approachDirection(perch, flightHeight, 0).heading,
        smooth((local - 23) / 3),
      );
      opacity = smooth(local / 3);
    } else if (local < 36) {
      const u = (local - 26) / 10;
      phase = "landing";
      point = birdApproach(perch, flightHeight, u);
      const direction = approachDirection(perch, flightHeight, u);
      facing = direction.heading;
      feet = smooth((u - 0.65) / 0.25);
      tipFold = mix(0.08, 1, smooth((u - 0.85) / 0.15));
      wing *= 1 - smooth((u - 0.85) / 0.15);
      pitch = direction.pitch * smooth(u / 0.12) * smooth((1 - u) / 0.15);
      bank = 0.22 * Math.sin(u * Math.PI);
      perchBlend = smooth(1 - (point.z - perch.z) / 4);
    } else if (local < 56) {
      phase = "perched";
      point = perch;
      wing = 0;
      tipFold = 1;
      feet = 1;
      facing = approachDirection(perch, flightHeight, 1).heading;
      perchBlend = 1;
    } else if (local < 66) {
      const u = (local - 56) / 10;
      phase = "takeoff";
      point = birdApproach(perch, flightHeight, u, true);
      const direction = approachDirection(perch, flightHeight, u, true);
      facing = direction.heading;
      tipFold = mix(1, 0.08, smooth(u / 0.08));
      wing *= smooth(u / 0.08);
      feet = 1 - smooth(u / 0.18);
      pitch = direction.pitch * smooth(u / 0.12) * smooth((1 - u) / 0.15);
      bank = 0.24 * Math.sin(u * Math.PI);
      perchBlend = smooth(1 - (point.z - perch.z) / 4);
    } else {
      point = mixPoint(departureEnd, exit, smooth((local - 66) / (period - 66)));
      facing = mixAngle(
        approachDirection(perch, flightHeight, 1, true).heading,
        Math.atan2(exit.y - departureEnd.y, exit.x - departureEnd.x),
        smooth((local - 66) / 3),
      );
      opacity = smooth((period - local) / 3);
    }
    if (phase === "flight") {
      const g = local % 8,
        glide = smooth((g - 5.3) / 0.3) * (1 - smooth((g - 7.7) / 0.3));
      wing = mix(wing, -0.07, glide);
      tipFold = mix(tipFold, 0.1, glide);
      if (glide > 0.99) phase = "glide";
    }
    const peck = (clock + id * 0.7) % 6.4,
      settled = phase === "perched" ? smooth(local - 36) * smooth(56 - local) : 0,
      headDip =
        peck > 1.1 && peck < 1.75 ? Math.sin(((peck - 1.1) / 0.65) * Math.PI) * 0.85 * settled : 0,
      headTurn = Math.sin(clock * 0.72 + id) * 0.35 * settled;
    return {
      id,
      ...point,
      heading: facing,
      pitch,
      bank,
      phase,
      wing,
      tipFold,
      feet,
      opacity,
      perchBlend,
      headDip,
      headTurn,
      ...(perch ? { perchId: perch.buildingId } : {}),
    };
  });
}

/** Articulated local bird geometry, in metres: x sideways, y up, z forwards. */
export function birdAnatomy(pose: BirdPose) {
  const wings = [-1, 1].map((side) => {
    const span = 1 - pose.tipFold * 0.88,
      angle = pose.wing,
      wristAngle = angle + Math.max(0, -angle) * 0.6 + pose.tipFold * 0.2,
      shoulder = { x: side * 0.095, y: 0.18, z: 0.035 },
      elbow = {
        x: side * (0.095 + Math.cos(angle) * 0.27 * span),
        y: 0.18 + Math.sin(angle) * 0.27 * span,
        z: 0.04 - pose.tipFold * 0.08,
      },
      wrist = {
        x: elbow.x + side * Math.cos(wristAngle) * 0.29 * span,
        y: elbow.y + Math.sin(wristAngle) * 0.29 * span,
        z: -0.06 - pose.tipFold * 0.16,
      },
      tip = {
        x: wrist.x + side * Math.cos(wristAngle) * 0.15 * span,
        y: wrist.y + Math.sin(wristAngle) * 0.15 * span,
        z: -0.2 - pose.tipFold * 0.13,
      };
    return [
      shoulder,
      elbow,
      wrist,
      tip,
      { ...wrist, z: wrist.z - 0.16 },
      { ...elbow, z: elbow.z - 0.2 },
      { x: side * 0.09, y: 0.135, z: -0.19 },
    ];
  });
  return {
    wings,
    head: birdHeadPoint(pose, { x: 0, y: 0.06, z: 0.055 }),
    beak: birdHeadPoint(pose, { x: 0, y: 0.04, z: 0.23 }),
    tail: [
      { x: -0.075, y: 0.12, z: -0.17 },
      { x: 0.075, y: 0.12, z: -0.17 },
      { x: 0.06, y: 0.1, z: -0.36 },
      { x: -0.06, y: 0.1, z: -0.36 },
    ],
    feet: [-1, 1].map((side) => ({ x: side * 0.055, y: 0.085 * (1 - pose.feet), z: 0.03 })),
  };
}
export function birdHeadPoint(pose: BirdPose, point: BirdPoint): BirdPoint {
  const x = point.x * Math.cos(pose.headTurn) + point.z * Math.sin(pose.headTurn),
    z = -point.x * Math.sin(pose.headTurn) + point.z * Math.cos(pose.headTurn),
    y = point.y * Math.cos(pose.headDip) - z * Math.sin(pose.headDip);
  return {
    x,
    y: 0.18 + y,
    z: 0.12 + point.y * Math.sin(pose.headDip) + z * Math.cos(pose.headDip),
  };
}
/** Same heading, bank and pitch transform for both renderers. */
export function birdLocalWorld(pose: BirdPose, p: BirdPoint): BirdPoint {
  const side = p.x * Math.cos(pose.bank) - p.y * Math.sin(pose.bank),
    up = p.x * Math.sin(pose.bank) + p.y * Math.cos(pose.bank),
    height = up * Math.cos(pose.pitch) + p.z * Math.sin(pose.pitch),
    forward = -up * Math.sin(pose.pitch) + p.z * Math.cos(pose.pitch);
  return {
    x: pose.x + (forward * Math.cos(pose.heading) + side * Math.sin(pose.heading)) / 5,
    y: pose.y + (forward * Math.sin(pose.heading) - side * Math.cos(pose.heading)) / 5,
    z: pose.z + height / 5,
  };
}

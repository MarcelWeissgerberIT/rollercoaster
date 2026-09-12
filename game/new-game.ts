import { build, footprint, newPark, occupant, type Park, type ScenarioId } from "./simulation";
import { createFreePark } from "./free-play";
import { PARK_ENTRANCE } from "./grid";
import { ZOO_RESERVED } from "./campaigns";
import { terrainHeight } from "./terrain";

/** Only new games pass through here. Loading a park never regenerates its landscape. */
export function createLandscapePark(
  mode: "scenario" | "sandbox" = "scenario",
  scenario: ScenarioId = "waldhain",
  seed = Math.floor(Math.random() * 0x100000000),
): Park {
  const park = mode === "sandbox" ? createFreePark() : newPark(mode, scenario);
  shapeStartingLandscape(park, seed);
  return park;
}

function randomSource(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let n = Math.imul(value ^ (value >>> 15), 1 | value);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

/** Broad, seeded landforms with protected level building pads and connected starter paths. */
function shapeStartingLandscape(park: Park, seed: number) {
  const random = randomSource(seed),
    width = park.tiles[0].length,
    height = park.tiles.length,
    protectedGround = Array.from({ length: height }, () => Array<boolean>(width).fill(false)),
    natural = (kind: string) => ["tree", "pine", "flowers"].includes(kind);
  const protect = (x: number, y: number, radius = 0) => {
    for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy++)
      for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx++)
        protectedGround[yy][xx] = true;
  };

  // The first construction area is deliberately spacious; height is a choice, not an entrance tax.
  for (let y = 22; y <= Math.min(height - 1, PARK_ENTRANCE.y + 2); y++)
    for (let x = 10; x <= 20; x++) protect(x, y);
  protect(PARK_ENTRANCE.x, PARK_ENTRANCE.y, 2);
  for (const b of park.buildings)
    if (!natural(b.kind)) for (const p of footprint(b)) protect(p.x, p.y, 1);
  if (park.scenario === "zoo" && park.mode === "scenario")
    for (const r of ZOO_RESERVED)
      for (let y = r.y - 1; y <= r.frontage; y++)
        for (let x = r.x - 1; x <= r.x + r.size; x++) protect(x, y);

  // An unbuilt free park starts with a small natural lake, not an already operating theme park.
  if (park.mode === "sandbox") {
    const cx = 6 + Math.floor(random() * 3),
      cy = 8 + Math.floor(random() * 3);
    for (let y = cy - 3; y <= cy + 3; y++)
      for (let x = cx - 4; x <= cx + 4; x++) {
        const shoreline = ((x - cx) / 3.8) ** 2 + ((y - cy) / 2.7) ** 2;
        if (shoreline < 0.93 + Math.sin(x * 1.7 + y * 0.8) * 0.12 && !protectedGround[y][x])
          park.tiles[y][x] = "water";
      }
  }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) if (park.tiles[y][x] !== "grass") protect(x, y, 1);

  // Distance to level ground limits every transition to one five-metre terrace.
  const distance = protectedGround.map((row) => row.map((p) => (p ? 0 : width + height))),
    queue: { x: number; y: number }[] = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) if (distance[y][x] === 0) queue.push({ x, y });
  for (let at = 0; at < queue.length; at++) {
    const { x, y } = queue[at];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy;
      if (distance[ny]?.[nx] !== undefined && distance[ny][nx] > distance[y][x] + 1) {
        distance[ny][nx] = distance[y][x] + 1;
        queue.push({ x: nx, y: ny });
      }
    }
  }
  const relief = park.scenario === "summit" && park.mode === "scenario" ? 1.3 : 1,
    hills = [
      [0.12, 0.27, 4.6],
      [0.7, 0.1, 4.2],
      [0.88, 0.69, 3.8],
      [0.16, 0.81, 3.3],
    ].map(([x, y, peak]) => ({
      x: (x + (random() - 0.5) * 0.1) * width,
      y: (y + (random() - 0.5) * 0.1) * height,
      rx: width * (0.17 + random() * 0.035),
      ry: height * (0.17 + random() * 0.035),
      peak: peak * relief,
    })),
    levels = distance.map((row, y) =>
      row.map((d, x) => {
        const hill = Math.max(
          ...hills.map(
            (h) => h.peak * Math.exp(-0.75 * (((x - h.x) / h.rx) ** 2 + ((y - h.y) / h.ry) ** 2)),
          ),
        );
        return Math.min(d, Math.max(0, Math.floor(hill - 0.25)));
      }),
    );
  // Smoothing the discrete terraces also handles the stronger mountain scenario.
  for (let pass = 0; pass < 6; pass++)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ])
          if (levels[y + dy]?.[x + dx] !== undefined)
            levels[y][x] = Math.min(levels[y][x], levels[y + dy][x + dx] + 1);
  park.terrain = {};
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) if (levels[y][x]) park.terrain[`${x},${y}`] = levels[y][x];
  for (const b of park.buildings) if (natural(b.kind)) b.z = terrainHeight(park, b.x, b.y);

  // Forest patches follow the landforms, leaving the central meadow available for development.
  const balances = {
    cash: park.cash,
    expenses: park.expenses,
    dayExpenses: park.dayExpenses,
    mode: park.mode,
  };
  park.mode = "sandbox";
  park.cash = 1000000;
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const chance = random(),
        z = terrainHeight(park, x, y);
      if (z < 1 || protectedGround[y][x] || chance > 0.13 || occupant(park, x, y)) continue;
      // No dense sprite wall: adjacent new trees are spaced apart.
      if (park.buildings.some((b) => natural(b.kind) && Math.hypot(b.x - x, b.y - y) < 1.8))
        continue;
      build(park, z >= 2 || chance < 0.05 ? "pine" : "tree", x, y);
    }
  Object.assign(park, balances);
}

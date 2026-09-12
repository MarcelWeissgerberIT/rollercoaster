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

/** A wooded valley with rolling ridges, open shores and a generous construction meadow. */
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
  for (let y = 20; y <= Math.min(height - 1, PARK_ENTRANCE.y + 2); y++)
    for (let x = 9; x <= 22; x++) protect(x, y);
  protect(PARK_ENTRANCE.x, PARK_ENTRANCE.y, 2);
  for (const b of park.buildings)
    if (!natural(b.kind)) for (const p of footprint(b)) protect(p.x, p.y, 1);
  if (park.scenario === "zoo" && park.mode === "scenario")
    for (const r of ZOO_RESERVED)
      for (let y = r.y - 1; y <= r.frontage; y++)
        for (let x = r.x - 1; x <= r.x + r.size; x++) protect(x, y);

  // New parks replace the old evenly spaced border trees with seeded groves.
  park.buildings = park.buildings.filter((b) => b.kind !== "tree" && b.kind !== "pine");

  // A sheltered lake opens into the meadow instead of sitting inside a ring of
  // hills. A warped ellipse gives it coves and an uneven, coherent shoreline.
  if (park.mode === "sandbox") {
    const cx = 7 + random() * 1.5,
      cy = 8 + random() * 1.5,
      phase = random() * Math.PI * 2;
    for (let y = 2; y < 15; y++)
      for (let x = 2; x < 14; x++) {
        const dx = (x - cx) / 4.7,
          dy = (y - cy) / 3.6,
          angle = Math.atan2(dy, dx),
          shore = 1 + Math.sin(angle * 3 + phase) * 0.14 + Math.cos(angle * 2 - phase) * 0.13;
        if (Math.hypot(dx, dy) < shore && !protectedGround[y][x]) park.tiles[y][x] = "water";
      }
  }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (park.tiles[y][x] !== "grass") protect(x, y, park.tiles[y][x] === "water" ? 2 : 1);

  // Euclidean falloff avoids the square contour rings produced by grid distance.
  const protectedCells = protectedGround.flatMap((row, y) =>
      row.flatMap((p, x) => (p ? [{ x, y }] : [])),
    ),
    distance = protectedGround.map((row, y) =>
      row.map((p, x) =>
        p ? 0 : Math.sqrt(Math.min(...protectedCells.map((q) => (x - q.x) ** 2 + (y - q.y) ** 2))),
      ),
    ),
    relief = park.scenario === "summit" && park.mode === "scenario" ? 1.35 : 1,
    hills = [
      [0.78, 0.05, 3.7, 0.3, 0.22],
      [0.07, 0.76, 2.6, 0.22, 0.3],
      [0.96, 0.51, 2.6, 0.2, 0.3],
    ].map(([x, y, peak, rx, ry]) => ({
      x: (x + (random() - 0.5) * 0.08) * width,
      y: (y + (random() - 0.5) * 0.08) * height,
      rx: width * rx,
      ry: height * ry,
      peak: peak * relief,
    })),
    phase = random() * 6,
    levels = distance.map((row, y) =>
      row.map((d, x) => {
        const wx = x + Math.sin(y * 0.25 + phase) * 1.4,
          wy = y + Math.sin(x * 0.22 - phase) * 1.1,
          hill = Math.max(
            ...hills.map(
              (h) =>
                h.peak * Math.exp(-1.15 * (((wx - h.x) / h.rx) ** 2 + ((wy - h.y) / h.ry) ** 2)),
            ),
          );
        return Math.max(0, Math.floor(Math.min(d / 2.4, hill) + 0.35));
      }),
    );
  // Every corner shares at most a one-level change. Surface triangles connect
  // those construction levels as real slopes instead of five-metre cliff walls.
  for (let pass = 0; pass < 5; pass++)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
        ])
          if (levels[y + dy]?.[x + dx] !== undefined)
            levels[y][x] = Math.min(levels[y][x], levels[y + dy][x + dx] + 1);
  park.terrain = {};
  park.naturalTerrain = true;
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
  const groves = [
      [0.1, 0.12, 0.19, 0.22],
      [0.79, 0.16, 0.22, 0.23],
      [0.08, 0.7, 0.17, 0.22],
      [0.93, 0.61, 0.15, 0.24],
    ].map(([x, y, rx, ry]) => ({
      x: (x + (random() - 0.5) * 0.12) * width,
      y: (y + (random() - 0.5) * 0.12) * height,
      rx: rx * width,
      ry: ry * height,
    })),
    candidates = park.tiles.flatMap((row, y) =>
      row.flatMap((tile, x) =>
        tile === "grass" && !protectedGround[y][x] ? [{ x, y, order: random() }] : [],
      ),
    );
  candidates.sort((a, b) => a.order - b.order);
  for (const { x, y } of candidates) {
    const chance = random(),
      woodland = Math.max(
        ...groves.map((g) => Math.exp(-1.7 * (((x - g.x) / g.rx) ** 2 + ((y - g.y) / g.ry) ** 2))),
      ),
      density = 0.025 + woodland * 0.54;
    if (chance > density || occupant(park, x, y)) continue;
    const neighbors = park.buildings.filter(
      (b) => natural(b.kind) && Math.hypot(b.x - x, b.y - y) < 1.5,
    );
    if (neighbors.length >= 3 || (neighbors.length >= 2 && chance > 0.1)) continue;
    const z = terrainHeight(park, x, y);
    build(park, (z >= 2 && random() < 0.72) || random() < 0.24 ? "pine" : "tree", x, y);
  }
  Object.assign(park, balances);
}

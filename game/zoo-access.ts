import type { Building, Guest, Park, Point } from "./simulation";
import { connected } from "./walkways";
import { podPort, podSlots, usesPods } from "./pods";
import { ensureHabitat, isHabitat, SPECIES } from "./zoo";

const key = (p: Point) => `${p.x},${p.y}`;
const neighbors = (p: Point) => [
  { x: p.x + 1, y: p.y },
  { x: p.x - 1, y: p.y },
  { x: p.x, y: p.y + 1 },
  { x: p.x, y: p.y - 1 },
];
export function habitatViewingSpots(s: Park, b: Building, net = connected(s)): Point[] {
  if (!isHabitat(b.kind)) return [];
  const size = SPECIES[b.kind].size;
  return podSlots(size)
    .map((p) => podPort(b, size, p))
    .filter((p) => s.tiles[p.y]?.[p.x] === "path" && net.has(key(p)));
}

/** Spread visitors along the fence, including guests already walking to a spot. */
export function viewingDestination(s: Park, b: Building, g: Guest, net = connected(s)) {
  const spots = habitatViewingSpots(s, b, net);
  const others = s.guests.filter((v) => v.id !== g.id && v.target === b.id);
  const score = (p: Point) =>
    others.filter((v) => key(v.route.at(-1) ?? v) === key(p)).length * 6 +
    Math.hypot(g.x - p.x, g.y - p.y) * 0.15;
  return spots.sort((a, b) => score(a) - score(b))[0];
}

/** Old zoo paths had no ownership. Only convert a whole coloured component when
 * no other attraction uses it; public paths and shared ride infrastructure stay intact. */
export function migrateHabitatAccess(
  s: Park,
  sizes: Record<string, { size: number; capacity: number }>,
) {
  const legacy = s.buildings.filter(
    (b) => isHabitat(b.kind) && (b.habitat?.accessVersion !== 1 || b.pods),
  );
  if (!legacy.length) return;
  const protectedPorts = new Set(
    s.buildings
      .filter(
        (b) =>
          !isHabitat(b.kind) &&
          (usesPods(b.kind) || sizes[b.kind].capacity > 0 || b.kind === "keeperhut"),
      )
      .flatMap((b) =>
        (b.pods ? Object.values(b.pods) : podSlots(sizes[b.kind].size)).map((p) =>
          key(podPort(b, sizes[b.kind].size, p)),
        ),
      ),
  );
  const seen = new Set<string>();
  for (const b of legacy) {
    const size = sizes[b.kind].size;
    const starts = (b.pods ? Object.values(b.pods) : podSlots(size)).map((p) =>
      podPort(b, size, p),
    );
    for (const start of starts) {
      const color = s.tiles[start.y]?.[start.x];
      if ((color !== "queue" && color !== "exit") || seen.has(key(start))) continue;
      const component = [start];
      seen.add(key(start));
      for (let i = 0; i < component.length; i++)
        for (const p of neighbors(component[i]))
          if (s.tiles[p.y]?.[p.x] === color && !seen.has(key(p))) {
            seen.add(key(p));
            component.push(p);
          }
      if (!component.some((p) => protectedPorts.has(key(p))))
        for (const p of component) s.tiles[p.y][p.x] = "path";
    }
    delete b.pods;
    b.price = 0;
    ensureHabitat(b)!.accessVersion = 1;
    for (const g of s.guests) {
      if (g.transit) continue;
      if (
        (g.target === b.id || b.queue.includes(g.id) || b.riders.includes(g.id)) &&
        (g.state === "queue" || g.state === "ride")
      ) {
        // Resume on the outside path. Previously collected revenue remains historical.
        const observing = g.state === "ride";
        g.state = observing ? "observe" : "walk";
        g.target = b.id;
        g.route = [];
        g.timer = observing ? Math.max(0.1, b.cycle) : 0;
        g.servicePrice = undefined;
      }
    }
    b.queue = [];
    b.riders = [];
    b.cycle = 0;
  }
}

import { insideMap } from "./grid";
import { podPort, podSlots } from "./pods";
import {
  findRoute,
  leaveBuilding,
  occupant,
  paint,
  type Building,
  type Park,
  type Point,
} from "./simulation";
import { connected } from "./walkways";
import { ensureHabitat, isHabitat, SPECIES } from "./zoo";
import { habitatViewingSpots, viewingDestination } from "./zoo-access";

/** Empty grass or an existing public path immediately outside a fence side. */
export function habitatViewpointCandidates(s: Park, b: Building): Point[] {
  if (!isHabitat(b.kind)) return [];
  const size = SPECIES[b.kind].size;
  return podSlots(size)
    .map((p) => podPort(b, size, p))
    .filter(
      (p) =>
        insideMap(s, p.x, p.y) &&
        ["grass", "path"].includes(s.tiles[p.y][p.x]) &&
        !occupant(s, p.x, p.y),
    );
}

export function viewpointStatus(
  s: Park,
  b: Building,
): { point: Point | null; connected: boolean; label: string } {
  if (!isHabitat(b.kind)) return { point: null, connected: false, label: "Kein Tiergehege" };
  const point = b.habitat?.viewpoint ? { ...b.habitat.viewpoint } : null;
  const reachable = habitatViewingSpots(s, b).length > 0;
  return {
    point,
    connected: reachable,
    label: point
      ? reachable
        ? "Aussichtspunkt mit dem Parkeingang verbunden"
        : "Aussichtspunkt nicht erreichbar · mit einem normalen Parkweg verbinden"
      : reachable
        ? "Besucher beobachten die Tiere an den verbundenen Wegen am Zaun"
        : "Besucherweg fehlt · normalen Parkweg an den Gehegezaun bauen",
  };
}

/** Reuse normal guest routing, preserving transit passengers and guest positions. */
export function rerouteHabitatViewers(s: Park, b: Building) {
  const net = connected(s);
  for (const g of s.guests) {
    if (g.target !== b.id || g.transit || (g.state !== "walk" && g.state !== "observe")) continue;
    const destination = b.open && b.habitat?.count ? viewingDestination(s, b, g, net) : undefined;
    if (!destination) {
      leaveBuilding(s, b, g, net);
      g.timer = 1;
      continue;
    }
    g.state = "walk";
    g.timer = 0;
    g.route = findRoute(s, g, destination);
    g.thought = `Ich gehe zum Aussichtspunkt: ${b.name}.`;
  }
}

export function setHabitatViewpoint(s: Park, b: Building, p: Point): string | null {
  if (!s.buildings.includes(b) || !isHabitat(b.kind)) return "Wähle ein Tiergehege.";
  if (
    !p ||
    !Number.isInteger(p.x) ||
    !Number.isInteger(p.y) ||
    !habitatViewpointCandidates(s, b).some(
      (candidate) => candidate.x === p.x && candidate.y === p.y,
    )
  )
    return "Wähle freie Wiese oder einen normalen Parkweg direkt außen am Gehegezaun.";
  const unchanged =
    s.tiles[p.y][p.x] === "path" &&
    b.habitat?.viewpoint?.x === p.x &&
    b.habitat.viewpoint.y === p.y;
  // paint is atomic and applies the same €12 path price and accounting as the path tool.
  const error = paint(s, p.x, p.y, "path");
  if (error) return error;
  const habitat = ensureHabitat(b)!;
  habitat.viewpoint = { x: p.x, y: p.y };
  const reachable = viewpointStatus(s, b).connected;
  if (unchanged && reachable) return null;
  if (!reachable) b.open = false;
  rerouteHabitatViewers(s, b);
  return null;
}

export function clearHabitatViewpoint(s: Park, b: Building): string | null {
  if (!s.buildings.includes(b) || !isHabitat(b.kind)) return "Wähle ein Tiergehege.";
  if (!b.habitat?.viewpoint) return null;
  delete b.habitat.viewpoint;
  rerouteHabitatViewers(s, b);
  return null;
}

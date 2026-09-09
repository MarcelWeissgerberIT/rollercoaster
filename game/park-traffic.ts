/** A read-only snapshot. Destination shares are assignments, never causal attribution
 * of park arrivals. Building counters count visits (including repeat visits). */
import {
  CATALOG,
  access,
  expectedWait,
  isAttraction,
  isRide,
  rideAppeal,
  type Building,
  type Guest,
  type Park,
  type Point,
} from "./simulation";
import { connected } from "./walkways";
import { mapHeight, mapWidth } from "./grid";
import { hasOperator } from "./operations";
import { broken, condition } from "./maintenance";
import { FOOD, isAmenity, isFood } from "./park-life";
import { habitatSafety, isHabitat, welfare } from "./zoo";
import {
  isTransport,
  transportCapacity,
  transportClock,
  transportPose,
  transportSpeed,
  transitValid,
  type TransitLine,
} from "./transit";

export type TrafficMode = "crowd" | "queues" | "mood" | "litter";
export type TrafficCategory = "animals" | "rides" | "shops" | "other";
export type TrafficBuilding = {
  id: number;
  name: string;
  kind: string;
  category: TrafficCategory;
  point: Point;
  targeting: number;
  enRoute: number;
  waiting: number;
  active: number;
  share: number;
  served: number;
  visitShare: number;
  revenue: number;
  revenueShare: number;
  appeal: number;
  appealShare: number;
  available: boolean;
  reasons: string[];
  expectedWait: number;
};
export type TrafficGroup = {
  category: TrafficCategory;
  label: string;
  targeting: number;
  share: number;
  served: number;
  visitShare: number;
  revenue: number;
};
export type TrafficZone = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  point: Point;
  guests: number;
  waiting: number;
  observing: number;
  riding: number;
  walking: number;
  resting: number;
  leaving: number;
  happiness: number | null;
  unhappy: number;
  litter: number;
  targets: { id: number; name: string; count: number }[];
  reasons: string[];
};
export type TrafficReport = {
  totalGuests: number;
  totalTargeting: number;
  totalVisits: number;
  totalRevenue: number;
  groups: TrafficGroup[];
  buildings: TrafficBuilding[];
  zones: TrafficZone[];
};

const ZONE_SIZE = 3;
const nonnegative = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);
const percent = (n: number, total: number) => (total > 0 ? (100 * n) / total : 0);
const categoryOf = (b: Building): TrafficCategory =>
  isHabitat(b.kind)
    ? "animals"
    : isRide(b.kind)
      ? "rides"
      : isFood(b.kind) || b.kind === "balloon" || b.kind === "plush"
        ? "shops"
        : "other";
const destinationBuilding = (b: Building) =>
  isAttraction(b.kind) ||
  isFood(b.kind) ||
  isAmenity(b.kind) ||
  isTransport(b.kind) ||
  ["balloon", "plush", "toilet"].includes(b.kind);

/** Track rides occupy their track extent; their stored guest coordinates remain
 * at boarding and must not make that entrance look like a pedestrian crowd. */
function center(b: Building): Point {
  if (b.track?.length) {
    const xs = b.track.map((p) => p.x),
      ys = b.track.map((p) => p.y);
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
  }
  const offset = (CATALOG[b.kind].size - 1) / 2;
  return { x: b.x + offset, y: b.y + offset };
}

// A transport ride/queue is still en route to g.target, not using that attraction.
function destinationState(g: Guest): "enRoute" | "waiting" | "active" {
  if (g.transit) return "enRoute";
  if (g.state === "queue") return "waiting";
  if (["ride", "observe", "rest"].includes(g.state)) return "active";
  return "enRoute";
}

function stopWait(b: Building, line: TransitLine | undefined): number {
  if (!line || line.route.length < 2) return 0;
  const leg = (line.route.length - 1) / transportSpeed(line.kind) + 4,
    period = leg * 2,
    departure = line.a === b.id ? 4 : leg + 4,
    next = (((departure - transportClock(line)) % period) + period) % period;
  return next + Math.floor(b.queue.length / transportCapacity(line.kind)) * period;
}

export function parkTraffic(s: Park): TrafficReport {
  const width = mapWidth(s),
    height = mapHeight(s),
    // connected assumes a regular park containing the entrance. Empty snapshots
    // are useful while starting a new map, and must remain readable as well.
    net = s.tiles[29]?.[15] ? connected(s) : new Set<string>(),
    liveTargets = new Set(s.guests.filter((g) => g.state !== "leave").map((g) => g.target)),
    originals = new Map(s.buildings.map((b) => [b.id, b])),
    lines = new Map((s.transitLines ?? []).map((line) => [line.id, line])),
    buildings: TrafficBuilding[] = s.buildings
      .filter(
        (b) => destinationBuilding(b) || liveTargets.has(b.id) || b.served > 0 || b.revenue > 0,
      )
      .map((b) => {
        const reachable = !!access(s, b, net),
          staffed = hasOperator(b),
          occupied = !isHabitat(b.kind) || (b.habitat?.count ?? 0) > 0,
          safety = isHabitat(b.kind) ? habitatSafety(b) : undefined,
          line = (s.transitLines ?? []).find((l) => l.a === b.id || l.b === b.id),
          transportReady = !isTransport(b.kind) || !!(line?.enabled && transitValid(s, line)),
          available =
            destinationBuilding(b) &&
            b.open &&
            reachable &&
            staffed &&
            occupied &&
            safety?.status !== "closed" &&
            (!isAttraction(b.kind) || b.tested) &&
            !broken(b) &&
            s.trackEdit?.buildingId !== b.id &&
            transportReady,
          reasons: string[] = [];
        if (!b.open) reasons.push("Geschlossen.");
        if (!reachable) reasons.push("Kein erreichbarer Zugang vom Parkeingang.");
        if (!staffed) reasons.push("Kein Fahrpersonal zugewiesen.");
        if (isAttraction(b.kind) && !b.tested) reasons.push("Testfahrt fehlt.");
        if (broken(b)) reasons.push("Wegen des technischen Zustands außer Betrieb.");
        if (s.trackEdit?.buildingId === b.id) reasons.push("Strecke wird bearbeitet.");
        if (isTransport(b.kind) && !transportReady)
          reasons.push(
            line?.fault ??
              (line ? "Transportlinie nicht betriebsbereit." : "Keine Transportlinie verbunden."),
          );
        if (isHabitat(b.kind))
          reasons.push(
            occupied
              ? `Tierwohl: ${Math.round(welfare(b))} % bei ${b.habitat!.count} Tieren.`
              : "Noch keine Tiere im Gehege.",
          );
        else if (isRide(b.kind))
          reasons.push(`Technischer Zustand: ${Math.round(condition(b))} %.`);
        if (safety && safety.status !== "safe") reasons.push(`${safety.label}.`);
        reasons.push(`Aktueller Preis: ${b.price} €.`);
        return {
          id: b.id,
          name: b.name,
          kind: b.kind,
          category: categoryOf(b),
          point: center(b),
          targeting: 0,
          enRoute: 0,
          waiting: 0,
          active: 0,
          share: 0,
          served: nonnegative(b.served),
          visitShare: 0,
          revenue: nonnegative(b.revenue),
          revenueShare: 0,
          appeal: available && isAttraction(b.kind) ? nonnegative(rideAppeal(b, "family")) : 0,
          appealShare: 0,
          available,
          reasons,
          expectedWait:
            isHabitat(b.kind) || isAmenity(b.kind)
              ? 0
              : nonnegative(isTransport(b.kind) ? stopWait(b, line) : expectedWait(b)),
        };
      }),
    byId = new Map(buildings.map((b) => [b.id, b])),
    zones: TrafficZone[] = [],
    zoneById = new Map<string, TrafficZone>(),
    facts = new Map<string, Map<string, number>>(),
    needs = new Map<number, number>();

  for (let y = 0; y < height; y += ZONE_SIZE)
    for (let x = 0; x < width; x += ZONE_SIZE) {
      const w = Math.min(ZONE_SIZE, width - x),
        h = Math.min(ZONE_SIZE, height - y),
        z: TrafficZone = {
          id: `${x},${y}`,
          x,
          y,
          width: w,
          height: h,
          point: { x: x + (w - 1) / 2, y: y + (h - 1) / 2 },
          guests: 0,
          waiting: 0,
          observing: 0,
          riding: 0,
          walking: 0,
          resting: 0,
          leaving: 0,
          happiness: null,
          unhappy: 0,
          litter: 0,
          targets: [],
          reasons: [],
        };
      zones.push(z);
      zoneById.set(z.id, z);
      facts.set(z.id, new Map());
    }
  // World coordinates are tile centers. A zone beginning at tile 3 starts at
  // world x=2.5, matching both the rendered overlay and the map hit test.
  const zoneFor = (p: Point) => {
    const x = Math.round(p.x),
      y = Math.round(p.y);
    return x >= 0 && y >= 0 && x < width && y < height
      ? zoneById.get(
          `${Math.floor(x / ZONE_SIZE) * ZONE_SIZE},${Math.floor(y / ZONE_SIZE) * ZONE_SIZE}`,
        )
      : undefined;
  };
  const fact = (z: TrafficZone, label: string) => {
    const counts = facts.get(z.id)!;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  };

  for (const g of s.guests) {
    const target = g.state === "leave" || g.target === null ? undefined : byId.get(g.target),
      assignment = destinationState(g),
      line = g.transit && lines.get(g.transit.line);
    if (target) {
      target.targeting++;
      target[assignment]++;
      const b = originals.get(target.id)!;
      if (isFood(b.kind) && (FOOD[b.kind].drink ? g.thirst : g.hunger) > 70)
        needs.set(b.id, (needs.get(b.id) ?? 0) + 1);
    }
    let position: Point = g;
    if (g.state === "ride") {
      if (g.transit) {
        if (line && line.route.length >= 2) position = transportPose(line);
      } else if (target) position = target.point;
    }
    const z = zoneFor(position);
    if (!z) continue;
    z.guests++;
    z.happiness = (z.happiness ?? 0) + Math.max(0, Math.min(100, g.happiness));
    if (g.happiness < 40) z.unhappy++;
    const stateKey = {
      walk: "walking",
      queue: "waiting",
      ride: "riding",
      observe: "observing",
      rest: "resting",
      leave: "leaving",
    } as const;
    z[stateKey[g.state]]++;
    if (target) {
      let count = z.targets.find((t) => t.id === target.id);
      if (!count) {
        count = { id: target.id, name: target.name, count: 0 };
        z.targets.push(count);
      }
      count.count++;
      const action =
        assignment === "enRoute"
          ? "unterwegs zum Ziel"
          : assignment === "waiting"
            ? "warten bei"
            : g.state === "observe"
              ? "beobachten Tiere bei"
              : g.state === "rest"
                ? "ruhen/spielen bei"
                : "nutzen";
      fact(z, `${action} ${target.name}`);
    }
    if (g.transit && g.state === "queue") {
      const stop = originals.get(g.transit.from);
      fact(z, `warten am Transporthalt ${stop?.name ?? "(nicht mehr vorhanden)"}`);
    }
    if (g.transit && g.state === "ride") fact(z, "fahren aktuell im Transportfahrzeug");
  }
  for (const item of s.cleanliness?.litter ?? []) {
    const z = zoneFor(item);
    if (z) z.litter += nonnegative(item.amount);
  }
  const totalTargeting = buildings.reduce((n, b) => n + b.targeting, 0),
    totalVisits = buildings.reduce((n, b) => n + b.served, 0),
    totalRevenue = buildings.reduce((n, b) => n + b.revenue, 0),
    totalAppeal = buildings.reduce((n, b) => n + b.appeal, 0);
  for (const b of buildings) {
    b.share = percent(b.targeting, totalTargeting);
    b.visitShare = percent(b.served, totalVisits);
    b.revenueShare = percent(b.revenue, totalRevenue);
    b.appealShare = percent(b.appeal, totalAppeal);
    b.reasons.unshift(
      b.targeting
        ? `Beobachtet: ${b.targeting} Gäste mit diesem Ziel; ${b.enRoute} unterwegs, ${b.waiting} warten, ${b.active} nutzen/beobachten es.`
        : "Beobachtet: Aktuell hat kein Gast dieses Ziel.",
    );
    if (b.waiting > 0) b.reasons.push(`Geschätzte Wartezeit: ${Math.round(b.expectedWait)} s.`);
    const need = needs.get(b.id);
    if (need) {
      const source = originals.get(b.id)!;
      b.reasons.push(
        `Beobachtet: ${need} Gäste mit diesem Ziel haben ${isFood(source.kind) && FOOD[source.kind].drink ? "Durst" : "Hunger"} über 70 %.`,
      );
    }
  }
  for (const z of zones) {
    if (z.guests) z.happiness = z.happiness! / z.guests;
    z.targets.sort((a, b) => b.count - a.count || a.id - b.id);
    z.reasons.push(
      `Beobachtet: ${z.guests} Gäste; ${z.waiting} warten, ${z.observing} beobachten Tiere, ${z.riding} fahren/nutzen Angebote, ${z.walking} gehen, ${z.resting} ruhen/spielen, ${z.leaving} verlassen den Park.`,
    );
    for (const [label, count] of facts.get(z.id)!) z.reasons.push(`Beobachtet: ${count} ${label}.`);
    if (z.litter) z.reasons.push(`Beobachtet: ${z.litter} Müllteile am Boden.`);
    if (z.guests >= 8 && (z.waiting >= 4 || z.walking >= 6))
      z.reasons.push(
        "Hinweis: Möglichen Engpass vor Ort prüfen; Wege und alternative Ziele vergleichen.",
      );
    if (z.guests >= 3 && z.happiness! < 60)
      z.reasons.push(
        "Hinweis: Bei niedriger Laune Bedürfnisse, Wartezeiten und Preise der Gäste prüfen.",
      );
    if (z.litter >= 2)
      z.reasons.push("Hinweis: Erreichbare Mülleimer und Reinigungspersonal prüfen.");
  }
  const labels: Record<TrafficCategory, string> = {
      animals: "Tiere & Gehege",
      rides: "Fahrgeschäfte",
      shops: "Gastronomie & Shops",
      other: "Service & Transport",
    },
    groups = (Object.keys(labels) as TrafficCategory[]).map((category): TrafficGroup => {
      const list = buildings.filter((b) => b.category === category),
        targeting = list.reduce((n, b) => n + b.targeting, 0),
        served = list.reduce((n, b) => n + b.served, 0);
      return {
        category,
        label: labels[category],
        targeting,
        share: percent(targeting, totalTargeting),
        served,
        visitShare: percent(served, totalVisits),
        revenue: list.reduce((n, b) => n + b.revenue, 0),
      };
    });
  buildings.sort((a, b) => b.targeting - a.targeting || b.served - a.served || a.id - b.id);
  return {
    totalGuests: s.guests.length,
    totalTargeting,
    totalVisits,
    totalRevenue,
    groups,
    buildings,
    zones,
  };
}

/** Uses tile-center world coordinates, including clipped edge zones. */
export function trafficAt(report: TrafficReport, p: Point): TrafficZone | undefined {
  const x = Math.round(p.x),
    y = Math.round(p.y);
  return report.zones.find((z) => x >= z.x && y >= z.y && x < z.x + z.width && y < z.y + z.height);
}

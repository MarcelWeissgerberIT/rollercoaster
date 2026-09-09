import { isHabitat, welfare } from "./zoo";
import { condition, broken } from "./maintenance";
import {
  expectedWait,
  isRide,
  isAttraction,
  rideCapacity,
  trackStats,
  type Park,
  type Point,
} from "./simulation";
import { cleanlinessScore } from "./cleanliness";
export type ParkIssue = {
  id: string;
  kind: "dirt" | "wait" | "fun" | "mood" | "care" | "repair";
  point: Point;
  title: string;
  detail: string;
  severity: number;
  buildingId?: number;
};
export function parkInsights(s: Park) {
  const issues: ParkIssue[] = [],
    bins = s.buildings.filter((b) => b.kind === "bin");
  const zones = new Map<
    string,
    { x: number; y: number; dirt: number; guests: number; happiness: number }
  >();
  const zone = (p: Point) => {
    const x = Math.floor(p.x / 5) * 5,
      y = Math.floor(p.y / 5) * 5,
      key = `${x},${y}`;
    let z = zones.get(key);
    if (!z) {
      z = { x, y, dirt: 0, guests: 0, happiness: 0 };
      zones.set(key, z);
    }
    return z;
  };
  for (const item of s.cleanliness?.litter ?? []) zone(item).dirt += item.amount;
  for (const g of s.guests) {
    const z = zone(g);
    z.guests++;
    z.happiness += g.happiness;
  }
  for (const z of zones.values()) {
    if (z.dirt >= 2)
      issues.push({
        id: `dirt-${z.x}-${z.y}`,
        kind: "dirt",
        point: {
          x: Math.min(s.tiles[0].length - 1, z.x + 2),
          y: Math.min(s.tiles.length - 1, z.y + 2),
        },
        title: `Schmutz bei (${Math.min(s.tiles[0].length - 1, z.x + 2)}, ${Math.min(s.tiles.length - 1, z.y + 2)})`,
        detail: `${z.dirt} Müllteile in diesem Bereich. Mülleimer neben den Weg setzen und Reinigungspersonal prüfen.`,
        severity: Math.min(100, z.dirt * 8 + 20),
      });
    if (z.guests >= 3 && z.happiness / z.guests < 60)
      issues.push({
        id: `mood-${z.x}-${z.y}`,
        kind: "mood",
        point: {
          x: Math.min(s.tiles[0].length - 1, z.x + 2),
          y: Math.min(s.tiles.length - 1, z.y + 2),
        },
        title: "Unzufriedene Parkecke",
        detail: `${z.guests} Gäste · durchschnittlich ${Math.round(z.happiness / z.guests)} % Laune. Bedürfnisse, Wege und Preise prüfen.`,
        severity: 100 - z.happiness / z.guests,
      });
  }
  for (const b of s.buildings) {
    if (b.kind === "bin" && (b.binFill ?? 0) >= 16)
      issues.push({
        id: `bin-${b.id}`,
        kind: "dirt",
        point: b,
        title: "Mülleimer voll",
        detail:
          "Gäste können hier nichts mehr entsorgen. Eine Reinigungskraft muss den Eimer erreichen.",
        severity: 55,
        buildingId: b.id,
      });
    if (isHabitat(b.kind) && (b.habitat?.count ?? 0) > 0 && welfare(b) < 70)
      issues.push({
        id: `care-${b.id}`,
        kind: "care",
        point: b,
        title: `Tierpflege nötig · ${b.name}`,
        detail: `Tierwohl ${Math.round(welfare(b))} %. Prüfe Futter, Wasser, Sauberkeit und die Verbindung zur Tierpflegerstation.`,
        severity: 100 - welfare(b) + 20,
        buildingId: b.id,
      });
    if (isRide(b.kind) && condition(b) < 70)
      issues.push({
        id: `repair-${b.id}`,
        kind: "repair",
        point: b,
        title: `${broken(b) ? "Außer Betrieb" : "Reparaturbedarf"} · ${b.name}`,
        detail: `Zustand ${Math.round(condition(b))} %. Repariere die Attraktion in ihrer Verwaltung.`,
        severity: 100 - condition(b),
        buildingId: b.id,
      });
    if (!isAttraction(b.kind)) continue;
    const wait = expectedWait(b);
    if (b.queue.length && wait > 30)
      issues.push({
        id: `wait-${b.id}`,
        kind: "wait",
        point: b,
        title: `Lange Wartezeit · ${b.name}`,
        detail: `${Math.round(wait)} s geschätzt · ${b.queue.length} warten auf ${rideCapacity(b)} Plätze. Weitere Attraktionen eröffnen oder Nachfrage über den Preis verteilen.`,
        severity: Math.min(100, wait),
        buildingId: b.id,
      });
    if (b.track && b.open) {
      const stats = trackStats(b.track);
      if (+stats.excitement < 3.5 || +stats.intensity > 8)
        issues.push({
          id: `fun-${b.id}`,
          kind: "fun",
          point: b,
          title: `Fahrprofil prüfen · ${b.name}`,
          detail: `Fahrspaß ${stats.excitement}/10 · Intensität ${stats.intensity}/10. ${+stats.intensity > 8 ? "Sehr hohe Belastung kann Gäste abschrecken." : "Mehr Abwechslung kann die Fahrt attraktiver machen."}`,
          severity: +stats.intensity > 8 ? 65 : 38,
          buildingId: b.id,
        });
    }
  }
  issues.sort((a, b) => b.severity - a.severity);
  const waits = s.buildings.filter((b) => isAttraction(b.kind) && b.queue.length);
  return {
    issues: issues.slice(0, 12),
    cleanliness: cleanlinessScore(s),
    dirty: (s.cleanliness?.litter ?? []).reduce((n, l) => n + l.amount, 0),
    bins: bins.length,
    fullBins: bins.filter((b) => (b.binFill ?? 0) >= 16).length,
    unhappy: s.guests.filter((g) => g.happiness < 40).length,
    happy: s.guests.filter((g) => g.happiness >= 75).length,
    waiting: s.guests.filter((g) => g.state === "queue").length,
    avgWait: waits.length
      ? Math.round(
          waits.reduce((n, b) => n + expectedWait(b) * b.queue.length, 0) /
            waits.reduce((n, b) => n + b.queue.length, 0),
        )
      : 0,
  };
}

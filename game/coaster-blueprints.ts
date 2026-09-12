import type { CoasterType, Park, Point } from "./simulation";
import { prefabBlueprint } from "./prefabs";
import { terrainHeight } from "./terrain";
import { coasterMaxHeight } from "./track-limits";

export type CoasterBlueprintId = "classic" | "panorama" | "twister" | "extreme";
export type CoasterBlueprint = {
  id: CoasterBlueprintId;
  name: string;
  description: string;
  category: "compact" | "scenic" | "thrill" | "extreme";
  intensity: "Ruhig" | "Mittel" | "Hoch" | "Extrem";
  styles: readonly CoasterType[];
};
const styles: readonly CoasterType[] = ["steel", "wood", "launch", "giga", "inverted"];

/** Layout intent; the live force analysis still supplies the measured ride intensity. */
export const COASTER_BLUEPRINTS: readonly CoasterBlueprint[] = [
  {
    id: "classic",
    name: "Parkrunde",
    description: "Kompakter Rundkurs für den Einstieg, mit kurzem Hügel oder Looping.",
    category: "compact",
    intensity: "Mittel",
    styles,
  },
  {
    id: "panorama",
    name: "Panoramafahrt",
    description: "Weite Kurven, ein langer Aussichtshügel und zwei sanfte Kuppen auf dem Rückweg.",
    category: "scenic",
    intensity: "Ruhig",
    styles,
  },
  {
    id: "twister",
    name: "Wirbelwind",
    description:
      "Verschlungener L-Kurs mit Richtungswechsel, Doppel-Looping oder hoher Airtime-Kuppe.",
    category: "thrill",
    intensity: "Hoch",
    styles,
  },
  {
    id: "extreme",
    name: "Himmelsstürmer",
    description:
      "Großer Hufeisenkurs: maximaler Sturz für den Bahntyp, hohe Kuppen und ein langer Rückweg.",
    category: "extreme",
    intensity: "Extrem",
    styles,
  },
];

export function coasterBlueprints(style: CoasterType): readonly CoasterBlueprint[] {
  const intensities: Partial<
    Record<CoasterBlueprintId, Partial<Record<CoasterType, CoasterBlueprint["intensity"]>>>
  > = {
    classic: { giga: "Hoch", launch: "Hoch", inverted: "Hoch" },
    panorama: { giga: "Mittel", launch: "Hoch" },
    twister: { giga: "Extrem", launch: "Extrem" },
    extreme: { wood: "Hoch" },
  };
  return COASTER_BLUEPRINTS.filter((blueprint) => blueprint.styles.includes(style)).map(
    (blueprint) => ({
      ...blueprint,
      intensity: intensities[blueprint.id]?.[style] ?? blueprint.intensity,
      description:
        blueprint.id === "twister" && !["wood", "giga"].includes(style)
          ? "Beschleuniger, Doppel-Looping und zwei Kuppen auf einem verschlungenen L-Kurs."
          : blueprint.id === "extreme" && style === "launch"
            ? "Großer Hufeisenkurs mit beschleunigtem Anstieg, maximalem Sturz und hohem Looping."
            : blueprint.description,
    }),
  );
}

/** Station at the origin, unrotated; use the same geometry for cards and placement. */
export function coasterBlueprintPreview(
  style: CoasterType,
  id: CoasterBlueprintId = "classic",
): Point[] {
  return prefabBlueprint({ x: 0, y: 0 }, 0, style, id);
}

/** The station rests on the selected land; inverted cars need one rail-height of clearance. */
export function coasterStationOrigin(park: Park, point: Point, style: CoasterType): Point {
  return {
    ...point,
    z: Math.max(0, terrainHeight(park, point.x, point.y)) + (style === "inverted" ? 1 : 0),
  };
}

/** Shared by the placement ghost and commit so hills never bury the station. */
export function coasterBlueprintAtPark(
  park: Park,
  point: Point,
  rotation: number,
  style: CoasterType,
  id: CoasterBlueprintId = "classic",
): Point[] {
  const origin = coasterStationOrigin(park, point, style),
    track = prefabBlueprint(origin, rotation, style, id),
    stationHeight = origin.z ?? 0,
    maximum = coasterMaxHeight(style),
    peak = Math.max(...track.map((p) => p.z ?? 0));
  // Modern layouts already fit their relief above the station. Preserve the legacy
  // generator too, but compress classic hills when the selected ground leaves less room.
  // Ground above the style's limit stays invalid; never lower a station into the hill.
  if (peak <= maximum || stationHeight > maximum) return track;
  const scale = (maximum - stationHeight) / (peak - stationHeight);
  return track.map((p, i) => ({
    ...p,
    z:
      i === 0 || i === track.length - 1
        ? stationHeight
        : Math.round((stationHeight + ((p.z ?? 0) - stationHeight) * scale) * 1e6) / 1e6,
  }));
}

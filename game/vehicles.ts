import type { Building, CoasterType } from "./simulation";
export const VEHICLES = {
  classic: { name: "Klassik", detail: "Offener Zweisitzer mit runder Nase", sprite: "steel" },
  mine: { name: "Grubenlore", detail: "Hohe Seitenwände und Holzlatten", sprite: "wood" },
  sport: {
    name: "Sportrakete",
    detail: "Tandem-Zweisitzer mit Rennnase und Seitenflossen",
    sprite: "sport",
  },
} as const;
export type Vehicle = {
  model: keyof typeof VEHICLES;
  body: string;
  accent: string;
  seats: string;
  alternating: boolean;
};
export const PAINTS = [
  { name: "Koralle & Petrol", body: "#df543e", accent: "#197f8d", seats: "#f0ddb3" },
  { name: "Mitternacht", body: "#454caa", accent: "#e69bd6", seats: "#dde3f3" },
  { name: "Sonnenblitz", body: "#f2b72f", accent: "#247f7c", seats: "#fff0c7" },
  { name: "Drachenfeuer", body: "#d53259", accent: "#eab52d", seats: "#33394a" },
  { name: "Eisvogel", body: "#2bb8c3", accent: "#4472cf", seats: "#eaf6ea" },
];
export function vehicleFor(b: Pick<Building, "track" | "vehicle">): Vehicle {
  const style: CoasterType = b.track?.[0]?.style ?? "steel";
  return (
    b.vehicle ?? {
      model: style === "wood" ? "mine" : style === "launch" ? "sport" : "classic",
      body: style === "wood" ? "#b78637" : style === "launch" ? "#23a8bd" : "#df543e",
      accent: style === "wood" ? "#705032" : "#197f8d",
      seats: "#f0ddb3",
      alternating: false,
    }
  );
}
export function validVehicle(v: unknown): v is Vehicle {
  if (!v || typeof v !== "object") return false;
  const x = v as Vehicle;
  return (
    Object.hasOwn(VEHICLES, x.model) &&
    [x.body, x.accent, x.seats].every((c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)) &&
    typeof x.alternating === "boolean"
  );
}
export function wagonPaint(v: Vehicle, i = 0) {
  return v.alternating && i % 2 ? { ...v, body: v.accent, accent: v.body } : v;
}

export const carSeat = (v: Vehicle, seat: number) =>
  v.model === "sport" ? { x: 0, z: seat ? 0.55 : -0.38 } : { x: seat ? 0.4 : -0.4, z: 0.15 };

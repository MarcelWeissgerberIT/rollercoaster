export const MECHANISMS = {
  teacups: "Tanzende Tassen",
  spinner: "Orbitalwirbel",
  swing: "Wellenflug",
  drop: "Freifallturm",
  pirate: "Piratenschaukel",
} as const;
export const THEMES = {
  moon: "Mondreise",
  dragon: "Drachenreich",
  mushroom: "Pilzwald",
  star: "Sternenfest",
} as const;
export type AttractionDesign = {
  id: string;
  name: string;
  mechanism: keyof typeof MECHANISMS;
  theme: keyof typeof THEMES;
  color: string;
  speed: number;
  height: number;
  seats: number;
  seed: number;
  art?: string;
};
export function designStats(d: AttractionDesign) {
  return {
    cost: Math.round(1700 + d.height * 350 + d.seats * 85 + d.speed * 500),
    duration: Math.round(28 / d.speed),
    intensity: Math.min(
      9.5,
      (d.mechanism === "drop" ? 6 : d.mechanism === "pirate" ? 4 : 3) * d.speed + d.height * 0.5,
    ),
    appeal: Math.min(9.5, 3 + d.height * 0.4 + d.seats * 0.12 + d.speed * 1.2),
    size: 3,
  };
}
export function validDesign(v: unknown): v is AttractionDesign {
  if (!v || typeof v !== "object") return false;
  const d = v as AttractionDesign;
  return (
    typeof d.id === "string" &&
    d.id.length > 0 &&
    d.id.length <= 80 &&
    typeof d.name === "string" &&
    d.name.trim().length > 0 &&
    d.name.length <= 60 &&
    typeof d.mechanism === "string" &&
    Object.hasOwn(MECHANISMS, d.mechanism) &&
    typeof d.theme === "string" &&
    Object.hasOwn(THEMES, d.theme) &&
    /^#[a-f0-9]{6}$/i.test(d.color) &&
    Number.isFinite(d.speed) &&
    d.speed >= 0.6 &&
    d.speed <= 1.6 &&
    Number.isFinite(d.height) &&
    d.height >= 1 &&
    d.height <= 3 &&
    Number.isInteger(d.seats) &&
    d.seats >= 4 &&
    d.seats <= 16 &&
    Number.isInteger(d.seed) &&
    d.seed >= 0 &&
    d.seed <= 1e9 &&
    (d.art === undefined ||
      (typeof d.art === "string" &&
        d.art.length < 180000 &&
        /^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/.test(d.art)))
  );
}
export const DESIGN_LIBRARY_KEY = "coaster-grove-workshop-v1";
export function parseDesignLibrary(raw: string | null): AttractionDesign[] {
  try {
    const value = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? value.filter(validDesign).slice(0, 20) : [];
  } catch {
    return [];
  }
}

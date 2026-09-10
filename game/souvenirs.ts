import type { Guest } from "./simulation";

export type SouvenirGuest = Pick<Guest, "id"> & Partial<Pick<Guest, "souvenir">>;
export type BalloonShape = "round" | "star" | "heart" | "bear";
export type SouvenirStyle = {
  kind: "balloon" | "plush";
  shape: BalloonShape;
  color: string;
  accent: string;
  trim: "bow" | "scarf";
  foil: boolean;
};
const balloons = [
  "#f075a8",
  "#69cce0",
  "#f6cd64",
  "#9c87df",
  "#6dd4b7",
  "#f09a64",
  "#b5c9ef",
  "#ee858e",
];
const furs = ["#bf824e", "#edcf9c", "#704b3e", "#dac3e0", "#aecbc7", "#f0d2bb"];
const accents = ["#c95b75", "#438eac", "#dbb34f", "#8267b0", "#529e7f", "#d47743"];
/** Identity-based assortment: old parks and both renderers see the same item.
 * Buying a souvenir does not add a new source of simulation randomness. */
export function souvenirStyle(g: SouvenirGuest): SouvenirStyle | null {
  if (!g.souvenir) return null;
  const id = Math.max(0, Math.floor(g.id));
  return {
    kind: g.souvenir,
    shape: (["round", "star", "heart", "bear"] as const)[id % 4],
    color:
      g.souvenir === "balloon"
        ? balloons[Math.floor(id / 4) % balloons.length]
        : furs[id % furs.length],
    accent: accents[Math.floor(id / 3) % accents.length],
    trim: id % 2 ? "bow" : "scarf",
    foil: g.souvenir === "balloon" && id % 4 !== 0,
  };
}
/** Coordinates relative to the gripping hand, in metres, shared by Canvas and
 * the real 3D object. Only simulation/preview time drives tether movement. */
export function souvenirPose(g: SouvenirGuest, time: number) {
  const phase = time * 1.7 + (g.id % 37) * 0.63;
  return {
    x: Math.sin(phase) * 0.105,
    z: Math.cos(phase * 0.77) * 0.065,
    lift: 1.15 + Math.sin(phase * 0.61) * 0.035,
    roll: Math.sin(phase) * 0.085,
  };
}

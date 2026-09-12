import type { Guest } from "./simulation";
export const UMBRELLA_COLORS = ["#619b9a", "#ca8b84", "#9c92bb", "#d3ad62", "#789d7e", "#7d9dbb"];
export type UmbrellaSource = Pick<Guest, "id"> & Partial<Pick<Guest, "umbrella">>;
export type UmbrellaVertex = [number, number, number];
/** Panel geometry opens from the shaft; both renderers use these exact ribs. */
export function umbrellaPanels(g: UmbrellaSource) {
  const open = g.umbrella?.opened ?? 0,
    radius = 0.07 + 0.64 * open,
    top: UmbrellaVertex = [0, 0.9, 0],
    ringY = 0.39 + 0.18 * open;
  return Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4,
      b = ((i + 1) * Math.PI) / 4;
    return {
      color: i % 2 ? "#e4e8d6" : UMBRELLA_COLORS[g.umbrella?.color ?? 0],
      vertices: [
        top,
        [Math.cos(a) * radius, ringY, Math.sin(a) * radius],
        [Math.cos(b) * radius, ringY, Math.sin(b) * radius],
      ] as UmbrellaVertex[],
    };
  });
}

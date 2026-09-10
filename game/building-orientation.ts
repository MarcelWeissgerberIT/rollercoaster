import type { Building, Kind } from "./simulation";

export type BuildingOrientation = 0 | 1 | 2 | 3;
export const isRotatableFurniture = (kind: string): kind is "bench" | "picnic" =>
  kind === "bench" || kind === "picnic";
/** Only expose rotation where the rendered object actually has directional geometry. */
export const supportsBuildingRotation = (kind: Kind) =>
  kind === "coaster" || isRotatableFurniture(kind);
export const buildingOrientation = (b: Pick<Building, "orientation">): BuildingOrientation =>
  b.orientation ?? 0;
export function rotatedOrientation(
  b: Pick<Building, "orientation">,
  turns: number,
): BuildingOrientation {
  return ((((buildingOrientation(b) + turns) % 4) + 4) % 4) as BuildingOrientation;
}
/** Local offsets are in tiles; positive quarter turns match coaster construction rotation. */
export function furniturePoint(
  b: Pick<Building, "x" | "y" | "orientation">,
  dx: number,
  dy: number,
) {
  for (let i = 0; i < buildingOrientation(b); i++) [dx, dy] = [-dy, dx];
  return { x: b.x + dx, y: b.y + dy };
}

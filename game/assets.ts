import parkSprites from "./park-sprites.json";
import expansionSprites from "./expansion-sprites.json";
export const assetUrl = (name: string) =>
  `${import.meta.env?.BASE_URL ?? "/rollercoaster/"}assets/${name in parkSprites ? "park-v5" : name in expansionSprites ? "expansion-v4" : name.startsWith("walk-") ? "walk-v3" : "pixel-v2"}/${name}.png`;

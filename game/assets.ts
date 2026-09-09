import zooWalkSpecs from "./zoo-walk-sprites.json";
import zooV9Sprites from "./zoo-v9-sprites.json";
import lifeSprites from "./life-sprites.json";
import zooSprites from "./zoo-sprites.json";
import experienceSprites from "./experience-sprites.json";
import parkSprites from "./park-sprites.json";
import expansionSprites from "./expansion-sprites.json";
export const assetUrl = (name: string) =>
  `${import.meta.env?.BASE_URL ?? "/rollercoaster/"}assets/${name in zooWalkSpecs ? "zoo-walk-v10" : name in zooV9Sprites ? "zoo-v9" : name in lifeSprites ? "park-v8" : name in zooSprites ? "zoo-v7" : name in experienceSprites ? "experience-v6" : name in parkSprites ? "park-v5" : name in expansionSprites ? "expansion-v4" : name.startsWith("walk-") ? "walk-v3" : "pixel-v2"}/${name}.png`;

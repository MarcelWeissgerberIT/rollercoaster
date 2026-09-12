import type { CoasterType } from "./simulation";
export const coasterMaxHeight = (style: CoasterType | undefined) =>
  style === "giga" ? 20 : style === "inverted" ? 10 : style === "wood" ? 4 : 8;

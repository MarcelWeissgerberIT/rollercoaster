import { writeFileSync } from "node:fs";
import { moduleURL } from "./ts-loader.mjs";
const { weatherFaces } = await import(moduleURL("game/weather-objects.ts"));
for (const kind of ["shelter", "parasol", "fountain"]) {
  const factor = kind === "fountain" ? 1.6 : 1;
  const faces = weatherFaces(kind)
    .map((f) => ({
      ...f,
      depth: f.points.reduce((s, p) => s + p[0] + p[1] + p[2] * 1.6, 0) / f.points.length,
    }))
    .sort((a, b) => a.depth - b.depth);
  const polygons = faces
    .map(
      (f) =>
        `<polygon points="${f.points.map(([x, y, z]) => `${128 + (x - y) * 22 * factor},${183 + (x + y) * 11 * factor - z * 42 * factor}`).join(" ")}" fill="${f.color}" stroke="#42695c" stroke-width="1.1" stroke-linejoin="round"/>`,
    )
    .join("");
  writeFileSync(
    new URL(`../public/assets/weather/weather-${kind}.svg`, import.meta.url),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 232" role="img"><title>${kind === "shelter" ? "Regenpavillon" : kind === "parasol" ? "Schattenplatz" : "Trinkbrunnen"}</title>${polygons}</svg>`,
  );
}

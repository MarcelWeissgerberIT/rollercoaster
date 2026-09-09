import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const names = [
  "wheel",
  "carousel",
  "burger",
  "drink",
  "entrance",
  "toilet",
  "tree",
  "pine",
  "flowers",
  "bench",
  "guest1",
  "guest2",
  "guest3",
  "guest1-step",
  "guest2-step",
  "guest3-step",
  "car",
];
for (const name of names) {
  const bytes = readFileSync(new URL(`../public/assets/${name}.png`, import.meta.url));
  assert.equal(bytes.subarray(1, 4).toString(), "PNG", `${name} must be a PNG`);
  assert(bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0, `${name} has dimensions`);
}
console.log(`PASS: all ${names.length} required OpenArt sprites are present and valid PNGs`);

import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const manifest = JSON.parse(
  readFileSync(new URL("../art/pixel-v2/manifest.json", import.meta.url), "utf8"),
);
const active = manifest.assets.filter((x) => x.name !== "shrub");
for (const asset of active) {
  const name = asset.name.replace("env-", "");
  const bytes = readFileSync(new URL(`../public/assets/pixel-v2/${name}.png`, import.meta.url));
  assert.equal(bytes.subarray(1, 4).toString(), "PNG", name);
  assert.deepEqual(
    [bytes.readUInt32BE(16), bytes.readUInt32BE(20)],
    asset.canvas,
    `${name} frame must preserve its canvas`,
  );
  if (name.startsWith("guest")) {
    assert.deepEqual(asset.logicalCanvas, [24, 32], `${name} must share guest frame dimensions`);
    assert.deepEqual(asset.logicalPivot, [12, 28], `${name} must share guest foot anchor`);
    assert(
      asset.logicalVisibleDimensions[1] >= 22 && asset.logicalVisibleDimensions[1] <= 24,
      `${name} must preserve body scale`,
    );
  }
}
console.log(`PASS: ${active.length} OpenArt sprite frames, canvas sizes and shared guest anchors`);
const walks = JSON.parse(
  readFileSync(new URL("../art/walk-v3/manifest.json", import.meta.url), "utf8"),
);
assert.equal(walks.assets.length, 32);
for (const asset of walks.assets) {
  const bytes = readFileSync(
    new URL(`../public/assets/walk-v3/${asset.name}.png`, import.meta.url),
  );
  assert.equal(bytes.subarray(1, 4).toString(), "PNG");
  assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [96, 128]);
  assert.deepEqual(asset.logicalPivot, [12, 28]);
  assert.deepEqual(asset.logicalCanvas, [24, 32]);
}
console.log("PASS: 32 OpenArt walking frames with matching canvas sizes and foot anchors");

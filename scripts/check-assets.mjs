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

const expansion = JSON.parse(
  readFileSync(new URL("../art/expansion-v4/manifest.json", import.meta.url), "utf8"),
);
assert.equal(expansion.assets.length, 24);
for (const a of expansion.assets) {
  const bytes = readFileSync(
    new URL(`../public/assets/expansion-v4/${a.name}.png`, import.meta.url),
  );
  assert.equal(bytes.subarray(1, 4).toString(), "PNG");
  assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], a.canvas);
}
console.log("PASS: 24 OpenArt expansion sprites, including 12 directional coaster cars");

const park = JSON.parse(
  readFileSync(new URL("../game/park-sprites.json", import.meta.url), "utf8"),
);
assert.equal(Object.keys(park).length, 34);
for (const [name, spec] of Object.entries(park)) {
  const bytes = readFileSync(new URL(`../public/assets/park-v5/${name}.png`, import.meta.url));
  assert.equal(bytes.subarray(1, 4).toString(), "PNG");
  assert.deepEqual(
    [bytes.readUInt32BE(16), bytes.readUInt32BE(20)],
    [spec.width * 4, spec.height * 4],
  );
}
console.log("PASS: 34 OpenArt park, transport, souvenir and seated guest sprites");

const experience = JSON.parse(
  readFileSync(new URL("../game/experience-sprites.json", import.meta.url), "utf8"),
);
for (const [name, spec] of Object.entries(experience)) {
  const bytes = readFileSync(
    new URL(`../public/assets/experience-v6/${name}.png`, import.meta.url),
  );
  assert.equal(bytes.subarray(1, 4).toString(), "PNG");
  assert.deepEqual(
    [bytes.readUInt32BE(16), bytes.readUInt32BE(20)],
    [spec.width * 4, spec.height * 4],
  );
}
console.log(
  `PASS: ${Object.keys(experience).length} OpenArt sport cars, cleaning staff and litter bins`,
);

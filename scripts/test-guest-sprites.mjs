import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { moduleURL } from "./ts-loader.mjs";
const P = await import(moduleURL("game/guest-sprite.ts")),
  V = await import(moduleURL("game/visitors.ts")),
  S = await import(moduleURL("game/simulation.ts")),
  R = await import(moduleURL("game/render.ts")),
  M = await import(moduleURL("game/zoo-motion.ts"));
const root = new URL("../", import.meta.url),
  results = [];
function test(name, run) {
  try {
    results.push({ name, pass: true, evidence: run() });
  } catch (error) {
    results.push({ name, pass: false, error: error.message.slice(0, 1200) });
  }
  console.log(JSON.stringify(results.at(-1)));
}
function png(file) {
  const source = readFileSync(new URL(file, root)),
    width = source.readUInt32BE(16),
    height = source.readUInt32BE(20);
  assert.equal(source[24], 8);
  assert.equal(source[25], 6);
  assert.equal(source[28], 0);
  const chunks = [];
  for (let offset = 8; offset < source.length;) {
    const size = source.readUInt32BE(offset);
    if (source.toString("ascii", offset + 4, offset + 8) === "IDAT")
      chunks.push(source.subarray(offset + 8, offset + 8 + size));
    offset += size + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)),
    stride = width * 4,
    data = new Uint8ClampedArray(stride * height);
  const paeth = (a, b, c) => {
    const p = a + b - c,
      x = Math.abs(p - a),
      y = Math.abs(p - b),
      z = Math.abs(p - c);
    return x <= y && x <= z ? a : y <= z ? b : c;
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x,
        left = x >= 4 ? data[i - 4] : 0,
        up = y ? data[i - stride] : 0,
        corner = y && x >= 4 ? data[i - stride - 4] : 0;
      const filter = raw[y * (stride + 1)];
      data[i] =
        (raw[y * (stride + 1) + x + 1] +
          [0, left, up, Math.floor((left + up) / 2), paeth(left, up, corner)][filter]) &
        255;
    }
  return { width, height, data };
}
const digest = (data) => createHash("sha256").update(data).digest("hex");
function bounds(bitmap) {
  let minX = bitmap.width,
    minY = bitmap.height,
    maxX = -1,
    maxY = -1,
    count = 0;
  for (let y = 0; y < bitmap.height; y++)
    for (let x = 0; x < bitmap.width; x++)
      if (bitmap.data[(y * bitmap.width + x) * 4 + 3]) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        count++;
      }
  return { minX, minY, maxX, maxY, count };
}
function image(file) {
  const bitmap = png(file);
  return {
    bitmap,
    src: file,
    complete: true,
    naturalWidth: bitmap.width,
    naturalHeight: bitmap.height,
  };
}
let readbacks = 0;
const canvas = () => {
  const value = { width: 0, height: 0, bitmap: null };
  value.getContext = () => ({
    drawImage(im) {
      value.bitmap = { ...im.bitmap, data: im.bitmap.data.slice() };
    },
    getImageData() {
      readbacks++;
      return { data: value.bitmap.data.slice() };
    },
    putImageData(data) {
      value.bitmap = { width: value.width, height: value.height, data: data.data.slice() };
    },
  });
  return value;
};
globalThis.document = { createElement: canvas };
const person = (id, ageGroup = "adult") => ({
  id,
  skin: id % 3,
  appearance: V.appearanceSeed(id),
  ageGroup,
});

test("New heads preserve authored body alpha, dark outlines and gait in all four directions", () => {
  let changed = 0,
    preservedOutline = 0;
  for (const direction of ["se", "sw", "ne", "nw"])
    for (let frame = 0; frame < 4; frame++) {
      const im = image(`public/assets/walk-v3/walk-red-${direction}-${frame}.png`),
        before = digest(im.bitmap.data),
        painted = P.paintedGuest(im, person(24 + frame));
      for (let i = 0; i < im.bitmap.data.length; i += 4) {
        const original = im.bitmap.data;
        // Head/neck silhouettes intentionally change. The authored body, arms,
        // hands and legs below them must stay pixel-exact in transparency.
        if (Math.floor(i / 4 / im.bitmap.width) < 52) continue;
        assert.equal(painted.bitmap.data[i + 3], original[i + 3]);
        if (original[i + 3] < 16 || Math.max(original[i], original[i + 1], original[i + 2]) < 40) {
          assert.deepEqual(painted.bitmap.data.slice(i, i + 4), original.slice(i, i + 4));
          if (original[i + 3]) preservedOutline++;
        } else if (
          painted.bitmap.data[i] !== original[i] ||
          painted.bitmap.data[i + 1] !== original[i + 1]
        )
          changed++;
      }
      assert.equal(digest(im.bitmap.data), before, "Tinting mutated the source pose");
      assert.equal(bounds(painted.bitmap).maxY, bounds(im.bitmap).maxY, "Head edit moved the feet");
    }
  assert(changed > 5000);
  assert(preservedOutline > 50);
  return { changedPixels: changed, preservedOutlinePixels: preservedOutline };
});
test("Known material samples get separate shirt, skin, trousers and hair colours", () => {
  const bitmap = { width: 8, height: 100, data: new Uint8ClampedArray(8 * 100 * 4) };
  const points = [
    [0, 50, [180, 60, 30, 255]],
    [1, 70, [40, 60, 120, 255]],
    [2, 30, [205, 145, 80, 255]],
    [3, 10, [80, 45, 25, 255]],
    [4, 90, [230, 220, 210, 255]],
    [5, 50, [15, 20, 20, 255]],
  ];
  for (const [x, y, color] of points) bitmap.data.set(color, (y * 8 + x) * 4);
  const im = {
    bitmap,
    complete: true,
    naturalWidth: 8,
    naturalHeight: 100,
    src: "walk-red-se-0.png",
  };
  const a = P.paintedGuest(im, person(12)),
    b = P.paintedGuest(im, person(43));
  assert.notEqual(digest(a.bitmap.data), digest(b.bitmap.data));
  for (const [x, y] of points.slice(0, 4)) {
    const at = (y * 8 + x) * 4;
    assert.notDeepEqual(a.bitmap.data.slice(at, at + 3), bitmap.data.slice(at, at + 3));
  }
  assert.deepEqual(
    a.bitmap.data.slice((50 * 8 + 5) * 4, (50 * 8 + 5) * 4 + 4),
    new Uint8ClampedArray([15, 20, 20, 255]),
  );
});
test("Children retain larger relative heads while both age groups keep their feet on the same ground anchor", () => {
  const im = image("public/assets/walk-v3/walk-red-se-0.png"),
    captured = [];
  const ctx = {
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    drawImage(...args) {
      captured.push(args);
    },
  };
  const inspect = (g) => {
    captured.length = 0;
    P.drawWalkingGuest(ctx, im, g, 100, 100, 1);
    assert.equal(captured.length, 2);
    const [head, body] = captured,
      bottom = bounds(im.bitmap).maxY + 1;
    const foot = body[6] + ((bottom - body[2]) / body[4]) * body[8];
    assert(Math.abs(foot) < 1e-10, `Foot drifts from anchor: ${foot}`);
    assert(Math.abs(head[6] + head[8] - body[6]) < 1e-10, "Gap or overlap at neck split");
    return { head: head[8], body: body[8], width: head[7] };
  };
  const adult = inspect(person(60)),
    child = inspect(person(60, "child"));
  assert(child.head / child.body > (adult.head / adult.body) * 1.2);
  assert(child.head + child.body < (adult.head + adult.body) * 0.85);
  assert(child.width < adult.width);
});
test("A complete 220-guest working set stays cached without repeated pixel readbacks", () => {
  const im = image("public/assets/walk-v3/walk-red-sw-1.png"),
    guests = Array.from({ length: 220 }, (_, i) => person(8000 + i));
  const before = readbacks;
  const painted = guests.map((g) => P.paintedGuest(im, g));
  assert(readbacks - before <= 220);
  const warm = readbacks;
  for (let pass = 0; pass < 4; pass++)
    for (let i = 0; i < guests.length; i++) assert.equal(P.paintedGuest(im, guests[i]), painted[i]);
  assert.equal(readbacks, warm);
  return {
    coldReadbacks: warm - before,
    warmReadbacks: readbacks - warm,
    rawBytesPerPose: 220 * 96 * 128 * 4,
  };
});
test("Incomplete image loading falls back without attempting to read canvas pixels", () => {
  const im = { complete: false, naturalWidth: 0 },
    before = readbacks;
  assert.equal(P.paintedGuest(im, person(1)), im);
  assert.equal(readbacks, before);
});
const specs = JSON.parse(readFileSync(new URL("game/zoo-walk-sprites.json", root), "utf8"));
test("All sixteen elephant PNGs are distinct, transparent, unclipped and share a stable logical foot baseline", () => {
  assert.equal(Object.keys(specs).length, 16);
  const hashes = new Set(),
    boxes = [];
  for (const direction of ["se", "sw", "ne", "nw"])
    for (let frame = 0; frame < 4; frame++) {
      const name = `elephant-walk-${direction}-${frame}`,
        spec = specs[name],
        bitmap = png(`public/assets/zoo-walk-v10/${name}.png`),
        box = bounds(bitmap);
      assert(spec);
      assert.deepEqual([bitmap.width, bitmap.height], [spec.width * 4, spec.height * 4]);
      assert.deepEqual([spec.anchorX, spec.anchorY], [24, 36]);
      assert(box.count > 2000 && box.count < bitmap.width * bitmap.height * 0.85);
      assert(
        box.minX >= 4 &&
          box.minY >= 4 &&
          box.maxX < bitmap.width - 4 &&
          box.maxY < bitmap.height - 4,
        `${name}: clipped edge`,
      );
      assert(
        box.maxY + 1 <= spec.anchorY * 4 && box.maxY + 1 >= spec.anchorY * 4 - 8,
        `${name}: foot baseline drift`,
      );
      for (let i = 3; i < bitmap.data.length; i += 4)
        assert(bitmap.data[i] === 0 || bitmap.data[i] === 255, `${name}: matte/fringe alpha`);
      hashes.add(digest(bitmap.data));
      boxes.push(box);
    }
  assert.equal(hashes.size, 16);
  return {
    uniqueFrames: hashes.size,
    minVisiblePixels: Math.min(...boxes.map((b) => b.count)),
    maxVisiblePixels: Math.max(...boxes.map((b) => b.count)),
  };
});
const loaded = new Map();
globalThis.Image = class {
  set src(value) {
    this._src = value;
    try {
      const im = image(`public${value}`);
      this.bitmap = im.bitmap;
      this.complete = true;
      this.naturalWidth = im.naturalWidth;
      this.naturalHeight = im.naturalHeight;
      loaded.set(value.split("/").at(-1).replace(".png", ""), this);
      queueMicrotask(() => this.onload?.());
    } catch (e) {
      queueMicrotask(() => this.onerror?.(e));
    }
  }
  get src() {
    return this._src;
  }
};
await R.loadSprites();
test("Real sprite loader includes every authored elephant walking frame", () => {
  for (const name of Object.keys(specs))
    assert(loaded.get(name)?.complete && loaded.get(name).naturalWidth === 192, name);
});
const noop = () => {},
  gradient = { addColorStop: noop },
  draws = [];
const ctx = new Proxy(
  {
    globalAlpha: 1,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: () => ({ width: 20 }),
    drawImage: (im, ...args) => {
      assert(args.every(Number.isFinite));
      if (im.src?.includes("elephant-walk-")) draws.push({ name: im.src.split("/").at(-1), args });
    },
  },
  { get: (o, k) => (k in o ? o[k] : noop), set: (o, k, v) => ((o[k] = v), true) },
);
const s = S.newPark("sandbox");
s.buildings = [];
s.guests = [];
s.transitLines = [];
const b = {
  ...R.previewBuilding("elephant", 8, 8),
  habitat: {
    count: 1,
    food: 100,
    water: 100,
    clean: 100,
    health: 100,
    enrichment: false,
    shelter: false,
  },
};
s.buildings = [b];
const view = {
  zoom: 1,
  panX: 0,
  panY: 0,
  grid: false,
  hover: null,
  tool: "select",
  selected: null,
  draft: [],
  height: 0,
};
function renderAt(time, wall = 0) {
  s.time = time;
  draws.length = 0;
  R.draw(ctx, 1200, 800, s, view, wall);
  assert.equal(draws.length, 1);
  return structuredClone(draws[0]);
}
test("Actual 2D rendering changes all four gait frames during travel and holds them while the park is paused", () => {
  const frames = new Set();
  let walkingTime = 0;
  for (let t = 0; t < 180 && frames.size < 4; t += 0.3) {
    if (!M.animalPose(b, 0, t).walk) continue;
    walkingTime = t;
    frames.add(renderAt(t).name.match(/-(\d)\.png$/)[1]);
  }
  assert.equal(frames.size, 4);
  const before = renderAt(walkingTime);
  s.speed = 0;
  S.tick(s, 0.25);
  assert.equal(s.time, walkingTime);
  assert.deepEqual(renderAt(s.time, 999999), before);
  let stopped;
  for (let t = 0; t < 180; t += 0.3)
    if (!M.animalPose(b, 0, t).walk && !M.animalPose(b, 0, t + 0.2).walk) {
      stopped = t;
      break;
    }
  assert(stopped !== undefined);
  assert(renderAt(stopped).name.endsWith("-1.png"));
  assert(renderAt(stopped + 0.2).name.endsWith("-1.png"));
  return { gaitFrames: [...frames].sort() };
});
console.log(`${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exitCode = results.every((r) => r.pass) ? 0 : 1;

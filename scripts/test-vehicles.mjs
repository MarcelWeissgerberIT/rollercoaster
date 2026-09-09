import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { inflateSync } from "node:zlib";
// Run from the repository root, or pass its directory as the first argument.
const repo = resolve(process.argv[2] ?? process.cwd());
const { moduleURL } = await import(pathToFileURL(resolve(repo, "scripts/ts-loader.mjs")).href);
const [V, P, S, C, M] = await Promise.all(
  [
    "game/vehicles.ts",
    "game/vehicle-sprite.ts",
    "game/simulation.ts",
    "game/construction.ts",
    "game/coaster-car.ts",
  ].map((f) => import(moduleURL(f))),
);
const failures = [],
  report = {};
const test = (name, fn) => {
  try {
    fn();
    console.log("PASS " + name);
  } catch (e) {
    failures.push({ name, message: e.message });
    console.log("FAIL " + name + ": " + e.message);
  }
};
const pngCache = new Map();
function png(path) {
  if (pngCache.has(path)) return pngCache.get(path);
  const file = readFileSync(path),
    width = file.readUInt32BE(16),
    height = file.readUInt32BE(20),
    type = file[25];
  assert.equal(file[24], 8, `${path}: PNG bit depth`);
  assert.equal(file[28], 0, `${path}: interlace`);
  assert([2, 6].includes(type), `${path}: PNG colour type ${type}`);
  const channels = type === 6 ? 4 : 3,
    chunks = [];
  for (let offset = 8; offset < file.length;) {
    const n = file.readUInt32BE(offset),
      kind = file.toString("ascii", offset + 4, offset + 8);
    if (kind === "IDAT") chunks.push(file.subarray(offset + 8, offset + 8 + n));
    offset += n + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)),
    stride = width * channels,
    decoded = new Uint8Array(height * stride),
    data = new Uint8ClampedArray(width * height * 4);
  const paeth = (a, b, c) => {
    const p = a + b - c,
      pa = Math.abs(p - a),
      pb = Math.abs(p - b),
      pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    assert(filter <= 4, "PNG filter");
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x,
        left = x >= channels ? decoded[i - channels] : 0,
        up = y ? decoded[i - stride] : 0,
        corner = y && x >= channels ? decoded[i - stride - channels] : 0;
      const predictor = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, corner)][filter];
      decoded[i] = (raw[y * (stride + 1) + 1 + x] + predictor) & 255;
    }
  }
  for (let p = 0; p < width * height; p++) {
    data[p * 4] = decoded[p * channels];
    data[p * 4 + 1] = decoded[p * channels + 1];
    data[p * 4 + 2] = decoded[p * channels + 2];
    data[p * 4 + 3] = channels === 4 ? decoded[p * channels + 3] : 255;
  }
  const result = { width, height, data };
  pngCache.set(path, result);
  return result;
}
class Canvas {
  width = 0;
  height = 0;
  pixels = null;
  getContext() {
    return {
      drawImage: (image) => {
        this.pixels = new Uint8ClampedArray(image.bitmap?.data ?? image.pixels);
      },
      getImageData: () => ({ data: new Uint8ClampedArray(this.pixels) }),
      putImageData: (data) => {
        this.pixels = new Uint8ClampedArray(data.data);
      },
    };
  }
}
globalThis.document = { createElement: () => new Canvas() };
const image = (model, d = "se") => {
  const folder = model === "sport" ? "experience-v6" : "expansion-v4",
    name = model === "classic" ? "steel" : model === "mine" ? "wood" : "sport",
    bitmap = png(resolve(repo, `public/assets/${folder}/car-${name}-${d}.png`));
  return { complete: true, naturalWidth: bitmap.width, naturalHeight: bitmap.height, bitmap };
};
const vehicle = (model) => ({
  model,
  body: "#bc4072",
  accent: "#2198d3",
  seats: "#eadab3",
  alternating: false,
});
const changed = (a, b) => {
  let n = 0;
  for (let i = 0; i < a.length; i += 4)
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++;
  return n;
};
const counts = {};
for (const model of ["classic", "mine", "sport"])
  for (const direction of ["se", "sw", "nw", "ne"])
    test(`${model}/${direction}: paint channels and alpha`, () => {
      const im = image(model, direction),
        v = vehicle(model),
        base = P.paintedCar(im, v),
        out = {};
      for (let i = 3; i < base.pixels.length; i += 4)
        assert.equal(base.pixels[i], im.bitmap.data[i]);
      for (const key of ["body", "accent", "seats"])
        out[key] = changed(base.pixels, P.paintedCar(im, { ...v, [key]: "#18f52b" }).pixels) / 16;
      counts[`${model}/${direction}`] = out;
      assert(out.body >= 20, "body mask too small");
      assert(out.seats >= 20, "seat mask too small");
      assert(out.accent >= 20, `accent changes only ${out.accent} logical pixels`);
    });
report.paintPixels = counts;
test("Classic seat shadow follows seat color, not body", () => {
  const im = image("classic"),
    v = vehicle("classic"),
    base = P.paintedCar(im, v),
    seat = P.paintedCar(im, { ...v, seats: "#1d274b" }),
    body = P.paintedCar(im, { ...v, body: "#1d274b" });
  let i = -1;
  for (let p = 0; p < im.bitmap.data.length; p += 4)
    if (
      im.bitmap.data[p] === 212 &&
      im.bitmap.data[p + 1] === 186 &&
      im.bitmap.data[p + 2] === 128 &&
      im.bitmap.data[p + 3] > 128
    ) {
      i = p;
      break;
    }
  assert(i >= 0, "reference seat-shade pixel not found");
  assert.notDeepEqual(
    Array.from(base.pixels.slice(i, i + 3)),
    Array.from(seat.pixels.slice(i, i + 3)),
    "cream seat shadow ignores seat color",
  );
  assert.deepEqual(
    Array.from(base.pixels.slice(i, i + 3)),
    Array.from(body.pixels.slice(i, i + 3)),
    "cream seat shadow incorrectly follows body color",
  );
});
test("Color cache stable, bounded; alternating colors swap only body/accent", () => {
  const im = image("sport"),
    v = vehicle("sport"),
    first = P.paintedCar(im, v);
  assert.equal(P.paintedCar(im, { ...v }), first);
  assert.deepEqual(
    P.paintedCar(im, { ...v, alternating: true }, 1).pixels,
    P.paintedCar(im, { ...v, body: v.accent, accent: v.body }).pixels,
  );
  for (let n = 0; n < 60; n++)
    P.paintedCar(im, { ...v, body: "#" + (n + 300).toString(16).padStart(6, "0") });
  assert.notEqual(P.paintedCar(im, v), first, "cache failed to evict old palette");
  assert.deepEqual(first.pixels, P.paintedCar(im, v).pixels, "eviction changes output");
  const unloaded = { complete: false, naturalWidth: 0 };
  assert.equal(P.paintedCar(unloaded, v), unloaded);
});
test("Legacy defaults are safe and do not mutate the building", () => {
  for (const [style, model] of [
    ["steel", "classic"],
    ["wood", "mine"],
    ["launch", "sport"],
  ]) {
    const b = { track: [{ x: 0, y: 0, style }] };
    assert.equal(V.vehicleFor(b).model, model);
    assert.equal(Object.hasOwn(b, "vehicle"), false);
    assert(V.validVehicle(V.vehicleFor(b)));
  }
});
test("Vehicle validation rejects malformed values", () => {
  for (const v of [
    null,
    {},
    [],
    { ...vehicle("sport"), model: "unknown" },
    { ...vehicle("sport"), body: "red" },
    { ...vehicle("sport"), seats: "#fff" },
    { ...vehicle("sport"), accent: "#GGGGGG" },
    { ...vehicle("sport"), alternating: 1 },
  ])
    assert.equal(V.validVehicle(v), false);
});
test("3D models have unique two-seat mounts and actual palette materials", () => {
  for (const model of ["classic", "mine", "sport"])
    for (const index of [0, 1]) {
      const v = { ...vehicle(model), alternating: true },
        before = JSON.stringify(v),
        root = M.createCoasterCar(v, index),
        materials = new Set(),
        geometries = new Set();
      root.updateMatrixWorld(true);
      root.traverse((o) => {
        assert(o.matrixWorld.elements.every(Number.isFinite));
        if (o.isMesh) {
          assert(o.geometry.attributes.position.array.every(Number.isFinite));
          materials.add(o.material);
          geometries.add(o.geometry);
        }
      });
      const colors = new Set([...materials].map((m) => m.color.getHexString())),
        paint = V.wagonPaint(v, index);
      for (const c of [paint.body, paint.accent, paint.seats]) assert(colors.has(c.slice(1)));
      const a = V.carSeat(v, 0),
        b = V.carSeat(v, 1);
      assert(Math.hypot(a.x - b.x, a.z - b.z) > 0.7);
      if (model === "sport") {
        assert.equal(a.x, b.x);
        assert(a.z < b.z);
      }
      assert.equal(JSON.stringify(v), before);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    }
});
test("Vehicle edits undo legacy and custom palettes without rewinding live ride state", () => {
  const s = S.newPark("sandbox"),
    b = s.buildings.find((b) => b.kind === "coaster");
  assert(b);
  assert(S.validSave(structuredClone(s)));
  assert.equal(b.vehicle, undefined);
  const originalRiders = [...b.riders],
    originalTrack = b.track,
    cash = s.cash,
    duration = S.rideDuration(b),
    capacity = S.rideCapacity(b);
  const one = C.recordEdit(s, "paint", () => {
    b.vehicle = vehicle("sport");
  });
  assert(one);
  assert.equal(one.vehicles.length, 1);
  assert.equal(one.geometry.length, 0);
  assert(S.validSave(structuredClone(s)));
  const first = structuredClone(b.vehicle),
    two = C.recordEdit(s, "paint2", () => {
      b.vehicle.accent = "#345678";
    });
  assert(two);
  assert.deepEqual(two.vehicles[0].before, first);
  b.cycle = 7;
  b.served += 5;
  const served = b.served;
  C.undoEdits(s, [two]);
  assert.deepEqual(b.vehicle, first);
  assert.equal(b.cycle, 7);
  assert.equal(b.served, served);
  assert.deepEqual(b.riders, originalRiders);
  C.undoEdits(s, [one]);
  assert.equal(b.vehicle, undefined);
  assert.equal(b.track, originalTrack);
  assert.equal(s.cash, cash);
  assert.equal(S.rideDuration(b), duration);
  assert.equal(S.rideCapacity(b), capacity);
  assert(S.validSave(structuredClone(s)));
});
test("No-op palette does not create an undo record", () => {
  const s = S.newPark("sandbox"),
    b = s.buildings.find((b) => b.kind === "coaster");
  b.vehicle = vehicle("mine");
  const before = JSON.stringify(s);
  assert.equal(
    C.recordEdit(s, "no-op", () => {
      b.vehicle = { ...b.vehicle };
    }),
    null,
  );
  assert.equal(JSON.stringify(s), before);
});
test("Merged models retain every triangle when paint colors coincide", () => {
  const stats = (root) => {
    let meshes = 0,
      triangles = 0;
    const colors = new Set();
    root.traverse((o) => {
      if (o.isMesh) {
        meshes++;
        triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
        assert(o.geometry.attributes.normal.array.every(Number.isFinite));
        colors.add(o.material.color.getHexString());
      }
    });
    return { meshes, triangles, colors };
  };
  const dispose = (root) => {
    const mats = new Set();
    root.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        mats.add(o.material);
      }
    });
    mats.forEach((m) => m.dispose());
  };
  const output = {};
  for (const model of ["classic", "mine", "sport"]) {
    const normal = M.createCoasterCar(vehicle(model)),
      reference = stats(normal);
    assert(reference.meshes <= 5, model + ": too many material meshes");
    dispose(normal);
    output[model] = { meshes: reference.meshes, triangles: reference.triangles };
    for (const paint of [
      { body: "#4477aa", accent: "#4477aa" },
      { body: "#4477aa", seats: "#4477aa" },
      { body: "#4477aa", accent: "#4477aa", seats: "#4477aa" },
      { body: "#283a42", accent: "#283a42", seats: "#283a42" },
      { body: "#c3d7d8", accent: "#c3d7d8", seats: "#c3d7d8" },
    ]) {
      const v = { ...vehicle(model), ...paint },
        root = M.createCoasterCar(v),
        actual = stats(root);
      assert.equal(
        actual.triangles,
        reference.triangles,
        `${model}: shared color lost geometry ${JSON.stringify(paint)}`,
      );
      for (const c of [v.body, v.accent, v.seats])
        assert(actual.colors.has(c.slice(1)), model + ": material disappeared");
      assert(actual.meshes <= 5);
      dispose(root);
    }
  }
  report.mergedGeometry = output;
});
// Exercise actual rendering, including the optional legacy b.vehicle path.
const R = await import(moduleURL("game/render.ts")),
  loaded = new Map();
globalThis.Image = class {
  complete = false;
  naturalWidth = 0;
  naturalHeight = 0;
  set src(value) {
    this.url = value;
    try {
      this.bitmap = png(resolve(repo, "public", value.replace(/^\//, "")));
      this.complete = true;
      this.naturalWidth = this.width = this.bitmap.width;
      this.naturalHeight = this.height = this.bitmap.height;
      loaded.set(
        value
          .split("/")
          .at(-1)
          .replace(/\.png$/, ""),
        this,
      );
      queueMicrotask(() => this.onload?.());
    } catch (e) {
      queueMicrotask(() => this.onerror?.(e));
    }
  }
  get src() {
    return this.url;
  }
};
await R.loadSprites();
for (const style of ["steel", "wood", "launch"])
  test("Actual legacy " + style + " draw uses its resolved palette", () => {
    const park = S.newPark("sandbox"),
      b = park.buildings.find((b) => b.kind === "coaster");
    park.buildings = [b];
    park.guests = [];
    park.transitLines = [];
    b.track = b.track.map((p) => ({ ...p, style }));
    delete b.vehicle;
    const painted = [],
      noop = () => {},
      gradient = { addColorStop: noop },
      ctx = new Proxy(
        {
          globalAlpha: 1,
          createLinearGradient: () => gradient,
          createRadialGradient: () => gradient,
          measureText: () => ({ width: 20 }),
          drawImage: (im, ...args) => {
            assert(args.every(Number.isFinite));
            if (im instanceof Canvas) painted.push(im);
          },
        },
        {
          get: (o, k) => (k in o ? o[k] : noop),
          set: (o, k, v) => {
            o[k] = v;
            return true;
          },
        },
      );
    R.draw(
      ctx,
      1520,
      860,
      park,
      {
        zoom: 1,
        panX: 0,
        panY: 0,
        grid: false,
        hover: null,
        tool: "select",
        selected: null,
        draft: [],
        height: 0,
      },
      0,
    );
    assert.equal(
      painted.length,
      Math.ceil(S.rideCapacity(b) / 2),
      "legacy car bypasses paintedCar",
    );
    const v = V.vehicleFor(b),
      expected = new Set(
        ["se", "sw", "nw", "ne"].map((d) =>
          P.paintedCar(loaded.get(`car-${V.VEHICLES[v.model].sprite}-${d}`), v),
        ),
      );
    assert(
      painted.every((canvas) => expected.has(canvas)),
      "actual legacy draw uses different palette",
    );
    assert.equal(Object.hasOwn(b, "vehicle"), false, "draw mutates legacy save");
  });
report.failures = failures;
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;

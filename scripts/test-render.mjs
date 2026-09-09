import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
const repo = resolve(fileURLToPath(new URL("..", import.meta.url)));
const { moduleURL } = await import(pathToFileURL(resolve(repo, "scripts/ts-loader.mjs")).href);
const [S, R, G, A, T, Transit, W, THREE] = await Promise.all([
  import(moduleURL("game/simulation.ts")),
  import(moduleURL("game/render.ts")),
  import(moduleURL("game/guest-model.ts")),
  import(moduleURL("game/attraction-rig.ts")),
  import(moduleURL("game/transport-rig.ts")),
  import(moduleURL("game/transit.ts")),
  import(moduleURL("game/scene-world.ts")),
  import(pathToFileURL(resolve(repo, "node_modules/three/build/three.module.js")).href),
]);
const failures = [],
  report = {};
function probe(label, fn) {
  try {
    fn();
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
  }
}
// Decode local 8-bit RGBA/RGB PNGs. This makes hit tests use the actual assets' alpha,
// without browser/WebGL dependencies or writing to the repository.
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
const images = new Map();
globalThis.Image = class {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
  }
  set src(value) {
    this._src = value;
    try {
      this.bitmap = png(resolve(repo, "public", value.replace(/^\//, "")));
      this.naturalWidth = this.width = this.bitmap.width;
      this.naturalHeight = this.height = this.bitmap.height;
      this.complete = true;
      images.set(
        value
          .split("/")
          .at(-1)
          .replace(/\.png$/, ""),
        this,
      );
      queueMicrotask(() => this.onload?.());
    } catch (error) {
      queueMicrotask(() => this.onerror?.(error));
    }
  }
  get src() {
    return this._src;
  }
};
globalThis.document = {
  createElement: () => {
    let source;
    return {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: (im) => {
          source = im;
        },
        getImageData: () => ({ data: source.bitmap.data }),
      }),
    };
  },
};
await R.loadSprites();
delete globalThis.document;
report.assets = images.size;
const noop = () => {},
  gradient = { addColorStop: noop };
let imageCalls = 0;
const ctx = new Proxy(
  {
    globalAlpha: 1,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: () => ({ width: 20 }),
    drawImage: (im, ...args) => {
      assert(im?.complete && im.naturalWidth > 0, "invalid draw image");
      assert(args.every(Number.isFinite), "nonfinite draw coordinates");
      imageCalls++;
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
function park() {
  const s = S.newPark("sandbox");
  s.buildings = [];
  s.guests = [];
  s.transitLines = [];
  return s;
}
const view = () => ({
  zoom: 1,
  panX: 0,
  panY: 0,
  grid: false,
  hover: { x: 12, y: 17 },
  tool: "select",
  selected: null,
  draft: [],
  height: 0,
});
const guests = [
  { id: 207, skin: 2 },
  { id: 109, skin: 0 },
  { id: 514, skin: 1 },
].map((g, i) => ({
  ...g,
  x: 10 + i,
  y: 15,
  route: [],
  target: null,
  state: "ride",
  timer: 0,
  happiness: 80,
  hunger: 20,
  thirst: 20,
  rides: 1,
  thought: "",
}));
const design = (mechanism = "pirate", seats = 16) => ({
  id: "qa",
  name: "QA",
  mechanism,
  theme: "moon",
  color: "#ff7755",
  speed: 1.1,
  height: 2,
  seats,
  seed: 17,
});
const building = (kind, id = 1000) => ({
  ...R.previewBuilding(kind, 12, 17),
  id,
  open: true,
  riders: guests.map((g) => g.id),
  cycle: S.CATALOG[kind].duration * 0.5,
  ...(kind === "custom" ? { design: design() } : {}),
});
let drawProbes = 0;
for (const kind of Object.keys(S.CATALOG).filter((k) => k !== "coaster")) {
  for (const preview of [false, true])
    probe(`${kind}/${preview ? "preview" : "actual"}`, () => {
      const s = park(),
        v = view();
      s.guests = guests;
      s.buildings = preview ? [] : [building(kind)];
      v.tool = preview ? kind : "select";
      R.draw(ctx, 1520, 860, s, v, 0);
      drawProbes++;
      if (preview)
        assert.equal(v.hitTargets.length, 0, `${kind}: placement ghost owns hit targets`);
      else {
        assert(v.hitTargets.length > 0, `${kind}: no actual owner targets`);
        assert(
          v.hitTargets.every((t) => t.id === 1000),
          `${kind}: leaked owner`,
        );
      }
    });
}
assert.equal(
  drawProbes,
  Object.keys(S.CATALOG).filter((k) => k !== "coaster").length * 2,
  "a draw probe failed",
);
report.drawProbes = drawProbes;
// Test every opaque sampled sprite point against the inverse hit transform.
let alphaProbes = 0;
for (const kind of ["wheel", "pirate"])
  probe(`${kind}/actual-alpha-hit`, () => {
    const s = park(),
      v = view();
    s.tiles = s.tiles.map((row) => row.map(() => "path"));
    s.buildings = [building(kind)];
    for (const time of [0, 3, 9]) {
      s.time = time;
      R.draw(ctx, 1520, 860, s, v, time);
      const names =
        kind === "wheel"
          ? ["wheel-rim", "wheel-support", "wheel-cabin"]
          : ["pirate-frame", "pirate-ship"];
      for (const name of names) {
        const target = v.hitTargets.find((t) => t.name === name);
        assert(target, `${name}: missing target in actual draw`);
        const im = images.get(name);
        let checked = 0;
        for (let py = 3; py < im.height; py += 13)
          for (let px = 3; px < im.width; px += 13) {
            if (im.bitmap.data[(py * im.width + px) * 4 + 3] < 128) continue;
            let x =
                (((px + 0.5) / im.width) * target.spec.width - target.spec.anchorX) * target.scale,
              y =
                (((py + 0.5) / im.height) * target.spec.height - target.spec.anchorY) *
                target.scale;
            if (target.mirror) x = -x;
            if (target.transform) {
              const [a, b, c, d] = target.transform;
              [x, y] = [a * x + c * y, b * x + d * y];
            } else {
              const c = Math.cos(target.rotation),
                sn = Math.sin(target.rotation);
              [x, y] = [c * x - sn * y, sn * x + c * y];
            }
            assert.equal(
              R.hitBuildingAt(v, target.p.x + x, target.p.y + y),
              1000,
              `${name}: opaque pixel (${px},${py})`,
            );
            checked++;
            alphaProbes++;
          }
        assert(checked > 0, `${name}: no source pixels`);
      }
      assert.equal(R.hitBuildingAt(v, -5000, -5000), null, "empty world point");
    }
  });
report.alphaProbes = alphaProbes;
// Per-model geometry is two merged meshes; body/head colours must follow the
// actual guest ID and skin, including a nonsequential shuffled passenger list.
function finiteObject(root) {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    assert(o.matrixWorld.elements.every(Number.isFinite), `${o.type}: matrix`);
    if (o.isMesh) {
      assert(o.geometry?.attributes.position, `${o.name}: geometry`);
      assert(o.geometry.attributes.position.array.every(Number.isFinite), `${o.name}: vertices`);
    }
  });
}
function colours(model) {
  return ["body", "head"].map((name) =>
    Array.from(model.getObjectByName(name).geometry.getAttribute("color").array),
  );
}
const expected = guests.map((g) => {
  const model = G.createGuestModel(g);
  finiteObject(model);
  assert.equal(model.children.length, 2);
  return colours(model);
});
function checkSeats(rig, count, label) {
  assert.equal(rig.seats.length, count, `${label}: capacity`);
  assert.equal(rig.passengers.filter((p) => p.visible).length, 3, `${label}: occupancy`);
  for (let i = 0; i < 3; i++)
    assert.deepEqual(
      colours(rig.passengers[i]),
      expected[i],
      `${label}: colours ignore rider ID ${guests[i].id}`,
    );
  for (const fraction of [0, 0.25, 0.5, 0.75, 0.99999]) {
    rig.update(rig.duration * fraction);
    finiteObject(rig.root);
    const positions = rig.seats.map((seat) => {
      const p = seat.getWorldPosition(new THREE.Vector3()),
        q = seat.getWorldQuaternion(new THREE.Quaternion());
      assert(Math.abs(q.length() - 1) < 1e-6, `${label}: quaternion`);
      return p;
    });
    for (let i = 0; i < count; i++)
      for (let j = i + 1; j < count; j++)
        assert(
          positions[i].distanceTo(positions[j]) > 0.35,
          `${label}: overlapping seats ${i}/${j}`,
        );
  }
}
let rigProbes = 0;
for (const mechanism of ["teacups", "spinner", "swing", "drop", "pirate"])
  for (let capacity = 4; capacity <= 16; capacity++)
    probe(`custom/${mechanism}/${capacity}`, () => {
      const s = park();
      s.guests = guests;
      const b = building("custom");
      b.design = design(mechanism, capacity);
      checkSeats(A.createAttractionRig(b, s), capacity, `${mechanism}/${capacity}`);
      rigProbes++;
    });
for (const kind of ["wheel", "carousel", "swing", "drop", "pirate", "teacups", "spinner"])
  probe(`standard/${kind}`, () => {
    const s = park();
    s.guests = guests;
    const b = building(kind);
    checkSeats(A.createAttractionRig(b, s), S.rideCapacity(b), kind);
    rigProbes++;
  });
report.attractionRigs = rigProbes;
function line(kind) {
  return {
    id: 5000,
    kind,
    a: 7000,
    b: 7001,
    route: [
      ...Array.from({ length: 8 }, (_, i) => ({ x: 5 + i, y: 8 })),
      ...Array.from({ length: 7 }, (_, i) => ({ x: 12, y: 9 + i })),
    ],
    position: 0,
    direction: 1,
    wait: 4,
    passengers: guests.map((g) => g.id),
    trips: 0,
    served: 0,
    revenue: 0,
    enabled: true,
  };
}
let transportProbes = 0;
for (const kind of ["train", "shuttle"])
  for (const state of [
    { position: 0, direction: 1, wait: 4 },
    { position: 7.9, direction: 1, wait: 0 },
    { position: 14, direction: -1, wait: 2 },
    { position: 6.1, direction: -1, wait: 0 },
  ])
    probe(`transport/${kind}/${JSON.stringify(state)}`, () => {
      const s = park();
      s.guests = guests;
      const l = { ...line(kind), ...state },
        rig = T.createTransportRig(l, s);
      checkSeats(rig, Transit.transportCapacity(kind), kind);
      rig.update(0);
      for (let car = 0; car < (kind === "train" ? 4 : 1); car++) {
        const p = Transit.transportCarPose(l, car);
        assert(Math.abs(rig.root.children[car].position.x - p.x * 5) < 1e-6);
        assert(Math.abs(rig.root.children[car].position.z - p.y * 5) < 1e-6);
      }
      transportProbes++;
    });
report.transportProbes = transportProbes;
probe("crowd/colours-and-animation", () => {
  const crowd = G.createCrowd(guests),
    count = G.personParts(guests[0], false).length;
  assert.equal(crowd.mesh.count, guests.length * count);
  for (let i = 0; i < guests.length; i++) {
    const parts = G.personParts(guests[i], false);
    for (let j = 0; j < count; j++) {
      const actual = new THREE.Color(),
        expected = new THREE.Color(parts[j].color);
      crowd.mesh.getColorAt(i * count + j, actual);
      assert(actual.toArray().every((v, k) => Math.abs(v - expected.toArray()[k]) < 1e-6));
    }
    crowd.pose(i, i * 5, 3, Math.PI / 4, 1.5, true);
  }
  crowd.finish();
  assert(crowd.mesh.instanceMatrix.array.every(Number.isFinite));
  assert(crowd.mesh.instanceMatrix.version > 0);
  report.crowdParts = count;
  report.crowdInstances = crowd.mesh.count;
  const empty = G.createCrowd([]);
  empty.finish();
  assert.equal(empty.mesh.count, 0);
});
probe("createWorld/update/dispose", () => {
  const s = S.newPark("sandbox"),
    coaster = s.buildings.find((b) => b.kind === "coaster");
  s.guests = guests.map((g, i) => ({
    ...g,
    state: i === 0 ? "walk" : "ride",
    route: i === 0 ? [{ x: g.x + 2, y: g.y }] : [],
  }));
  s.buildings = Object.keys(S.CATALOG)
    .filter((k) => k !== "coaster")
    .map((k, i) => ({
      ...building(k, 1000 + i),
      x: 3 + (i % 5) * 5,
      y: 2 + Math.floor(i / 5) * 5,
    }));
  if (coaster) s.buildings.push(coaster);
  s.transitLines = [line("train"), { ...line("shuttle"), id: 5001, a: 7002, b: 7003 }];
  const snapshot = JSON.stringify(s),
    world = W.createWorld(s),
    geos = new Map(),
    materials = new Map(),
    instances = new Map();
  world.scene.traverse((o) => {
    if (o.isInstancedMesh) {
      instances.set(o, 0);
      o.addEventListener("dispose", () => instances.set(o, instances.get(o) + 1));
    }
    if (o.isMesh || o.isLine) {
      if (!geos.has(o.geometry)) {
        geos.set(o.geometry, 0);
        o.geometry.addEventListener("dispose", () =>
          geos.set(o.geometry, geos.get(o.geometry) + 1),
        );
      }
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        if (!materials.has(m)) {
          materials.set(m, 0);
          m.addEventListener("dispose", () => materials.set(m, materials.get(m) + 1));
        }
    }
  });
  for (const t of [0, 0.016, 2, 8, 15, 30]) {
    world.update(t);
    finiteObject(world.scene);
  }
  assert.equal(JSON.stringify(s), snapshot, "3D mutates park snapshot");
  world.dispose();
  for (const map of [geos, materials, instances])
    assert(
      [...map.values()].every((n) => n === 1),
      "resource not disposed exactly once",
    );
  report.world = {
    geometries: geos.size,
    materials: materials.size,
    instancedMeshes: instances.size,
    updates: 6,
  };
});
report.drawImageCalls = imageCalls;
report.failures = failures;
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;

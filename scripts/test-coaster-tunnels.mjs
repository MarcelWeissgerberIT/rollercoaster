import assert from "node:assert/strict";
import * as THREE from "three";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  T = await import(moduleURL("game/coaster-tunnels.ts")),
  Terrain = await import(moduleURL("game/terrain-scene.ts")),
  Tunnel = await import(moduleURL("game/coaster-tunnel-scene.ts")),
  Track = await import(moduleURL("game/track-canvas.ts")),
  Canvas = await import(moduleURL("game/coaster-tunnel-canvas.ts")),
  World = await import(moduleURL("game/scene-world.ts")),
  M = await import(moduleURL("game/motion.ts"));
let passed = 0;
const test = (name, run) => {
  run();
  console.log("PASS", name);
  passed++;
};
function park(style = "steel", z = 0) {
  const p = S.newPark("sandbox");
  p.tiles = Array.from({ length: 30 }, () => Array(30).fill("grass"));
  p.naturalTerrain = false;
  p.terrain = {};
  p.guests = [];
  p.scenery = [];
  p.elevatedPaths = [];
  p.buildings = [
    {
      id: 88,
      kind: "coaster",
      x: 3,
      y: 8,
      name: "Tunnel test",
      open: false,
      price: 4,
      served: 0,
      revenue: 0,
      queue: [],
      riders: [],
      cycle: 0,
      track: [
        [3, 8],
        [14, 8],
        [14, 13],
        [3, 13],
        [3, 8],
      ].map(([x, y]) => ({ x, y, z, style, smooth: true })),
    },
  ];
  for (let y = 6; y <= 10; y++) for (let x = 7; x <= 11; x++) p.terrain[`${x},${y}`] = 4;
  return p;
}
const near = (a, b, e = 1e-6) => assert(Math.abs(a - b) < e, `${a} != ${b}`);
const dispose = (scene) => {
  const geometries = new Set(),
    materials = new Set();
  scene.traverse((o) => {
    if (o.isMesh) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
      if (o.isInstancedMesh) o.dispose();
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
};

test("All coaster styles share exact entry/exit positions at the cliff, not tile centers", () => {
  for (const style of Object.keys(S.COASTER_TYPES)) {
    const layout = T.parkCoasterTunnels(park(style));
    assert.equal(layout.spans.length, 1);
    assert.equal(layout.portals.length, 2);
    near(layout.portals[0].frame.x, 6.5);
    near(layout.portals[1].frame.x, 11.5);
    near(layout.portals[0].frame.y, 8);
    near(layout.portals[0].frame.z, T.TUNNEL_RAIL_DATUM);
    assert(layout.portals[0].outward.x < -0.999);
    assert(layout.portals[1].outward.x > 0.999);
    assert(
      layout.spans[0].frames.length > 50,
      "A continuous multi-cell bore must retain its interior",
    );
  }
});

test("High track above a mountain does not create fake portals", () => {
  assert.equal(T.parkCoasterTunnels(park("steel", 5)).spans.length, 0);
});

test("JSON saves derive the same tunnels; live terrain edits invalidate the cached geometry", () => {
  const p = park(),
    before = T.parkCoasterTunnels(p);
  const restored = T.parkCoasterTunnels(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(restored.spans, before.spans);
  assert.strictEqual(T.parkCoasterTunnels(p), before);
  p.terrain = {};
  assert.equal(T.parkCoasterTunnels(p).spans.length, 0);
  p.terrain["9,8"] = 3;
  assert.equal(T.parkCoasterTunnels(p).portals.length, 2);
  delete p.terrain["9,8"];
  assert.equal(T.parkCoasterTunnels(p).portals.length, 0);
});

test("Natural surface cache follows path, water and building-pad changes without terrain edits", () => {
  const p = park();
  p.naturalTerrain = true;
  let previous = T.parkCoasterTunnels(p);
  for (const tile of ["path", "water", "grass"]) {
    p.tiles[8][6] = tile;
    const current = T.parkCoasterTunnels(p);
    assert.notStrictEqual(current, previous);
    previous = current;
  }
  p.buildings.push({ id: 89, kind: "bench", x: 6, y: 8, orientation: 0 });
  let current = T.parkCoasterTunnels(p);
  assert.notStrictEqual(current, previous);
  previous = current;
  p.buildings.at(-1).x = 5;
  current = T.parkCoasterTunnels(p);
  assert.notStrictEqual(current, previous);
});

test("Natural slopes meet a height intersection and a rising track retains its transported frame", () => {
  const p = park();
  p.naturalTerrain = true;
  p.terrain = {};
  for (let y = 5; y <= 11; y++)
    for (let x = 5; x <= 12; x++) p.terrain[`${x},${y}`] = Math.min(3, x - 4, 13 - x);
  p.buildings[0].track[1].z = 1.1;
  const { portals } = T.parkCoasterTunnels(p);
  assert.equal(portals.length, 2);
  assert(portals[0].frame.x > 3.5 && portals[0].frame.x < 5.5);
  assert(Math.abs((portals[0].frame.x % 1) - 0.5) > 0.02, "Natural crossing is inside the slope");
  assert(portals[0].frame.tangent.z > 0.05);
  const radius = T.TUNNEL_INNER_RADIUS;
  for (const portal of portals) {
    const point = T.tunnelRingPoint(portal.frame, 0.7);
    near(
      Math.hypot(point.x - portal.frame.x, point.y - portal.frame.y, point.z - portal.frame.z),
      radius,
    );
  }
});

test("A wholly buried closed loop has one uninterrupted lining and no artificial seam portals", () => {
  const p = park("wood", -1),
    layout = T.parkCoasterTunnels(p);
  assert.equal(layout.spans.length, 1);
  assert.equal(layout.portals.length, 0);
  assert(layout.spans[0].closed);
  const a = layout.spans[0].frames[0],
    b = layout.spans[0].frames.at(-1);
  near(a.x, b.x);
  near(a.y, b.y);
  near(a.z, b.z);
});

test("Underground ranges crossing the saved station seam merge into one physical tunnel", () => {
  const p = park();
  p.terrain = {};
  for (let y = 6; y <= 14; y++) for (let x = 1; x <= 5; x++) p.terrain[`${x},${y}`] = 3;
  const layout = T.parkCoasterTunnels(p);
  assert.equal(layout.spans.length, 1);
  assert.equal(layout.portals.length, 2);
  assert(layout.spans[0].end > M.prepareRoute(p.buildings[0].track).length);
});

test("Overlapping cuts merge but vertically separated tunnels retain their rock separator", () => {
  const f = T.parkCoasterTunnels(park()).spans[0].frames[20];
  assert.equal(T.tunnelVoidIntervals([f, { ...f, z: f.z + 0.2 }], f.x, f.y).length, 1);
  const stacked = T.tunnelVoidIntervals([f, { ...f, z: f.z + 2 }], f.x, f.y);
  assert.equal(stacked.length, 2);
  assert(stacked[1][0] > stacked[0][1]);
});

test("Terrain is physically removed around the front camera, including sloped turf and suspended cars", () => {
  for (const natural of [false, true]) {
    const p = park();
    p.naturalTerrain = natural;
    if (natural) {
      p.terrain = {};
      for (let y = 5; y <= 11; y++)
        for (let x = 5; x <= 13; x++) p.terrain[`${x},${y}`] = Math.min(4, x - 4, 14 - x);
      p.buildings[0].track[1].z = 1.1;
    }
    const scene = new THREE.Scene();
    Terrain.addTerrainScene(scene, p);
    scene.updateMatrixWorld(true);
    const solids = [];
    scene.traverse((o) => {
      if (o.isInstancedMesh) {
        const matrix = new THREE.Matrix4();
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, matrix);
          solids.push(matrix.clone().invert());
        }
      }
    });
    const layout = T.parkCoasterTunnels(p),
      camera = new THREE.Vector3();
    for (const span of layout.spans)
      for (let i = 2; i < span.frames.length - 2; i += 4) {
        const f = span.frames[i];
        for (const cameraHeight of [1.55, -0.55]) {
          camera.set(
            f.x * 5 + f.tangent.x * 1.15,
            f.z * 5 + f.up.z * cameraHeight + f.tangent.z * 1.15,
            f.y * 5 + f.tangent.y * 1.15,
          );
          for (const matrix of solids) {
            const local = camera.clone().applyMatrix4(matrix);
            assert(
              !(
                Math.abs(local.x) < 0.499 &&
                Math.abs(local.y) < 0.499 &&
                Math.abs(local.z) < 0.499
              ),
              `Earth intersects camera at ${camera.toArray()} natural=${natural}`,
            );
          }
          const ray = new THREE.Raycaster(
            camera,
            new THREE.Vector3(f.tangent.x, f.tangent.z, f.tangent.y),
            0.08,
            0.7,
          );
          assert.equal(
            ray.intersectObjects(scene.children, true).length,
            0,
            "No earth wall/turf closes the forward view",
          );
        }
      }
    dispose(scene);
  }
});

test("3D portals share 2D frames, contain an open annulus and never cap the bore", () => {
  const p = park(),
    scene = new THREE.Scene(),
    root = Tunnel.addCoasterTunnelScene(scene, p),
    layout = T.parkCoasterTunnels(p);
  scene.updateMatrixWorld(true);
  const portals = root.children.filter((o) => o.name.startsWith("coaster-tunnel-portal"));
  assert.equal(portals.length, 2);
  assert(root.children.some((o) => o.name === "tunnel-guide-lamp"));
  for (let i = 0; i < portals.length; i++) {
    assert.deepEqual(portals[i].userData.frame, layout.portals[i].frame);
    assert(portals[i].userData.openEnded);
    const f = layout.portals[i].frame,
      out = layout.portals[i].outward,
      ray = new THREE.Raycaster(
        new THREE.Vector3(
          (f.x + out.x * 0.4) * 5,
          (f.z + out.z * 0.4) * 5,
          (f.y + out.y * 0.4) * 5,
        ),
        new THREE.Vector3(-out.x, -out.z, -out.y),
        0,
        3,
      );
    assert.equal(
      ray.intersectObject(portals[i], true).length,
      0,
      "Portal center remains physically open",
    );
  }
  dispose(scene);
});

test("Raised-track 2D clipping ends exactly at the tunnel mouth and exposes all track in cutaway", () => {
  const p = park(),
    points = [],
    ctx = new Proxy(
      {},
      {
        get: (_, name) =>
          name === "moveTo" || name === "lineTo" ? (x, y) => points.push({ x, y }) : () => {},
        set: () => true,
      },
    ),
    project = Object.assign((x, y, z = 0) => ({ x, y: y - z }), { turn: 0 });
  const clipped = Track.trackCanvasLayers(ctx, p.buildings[0].track, project, 1, {
    visibleAt: (q) => !T.coasterPointBuried(p, q),
  });
  clipped.forEach((l) => l.draw());
  assert(
    points.some((q) => Math.abs(q.x - 6.5) < 0.01),
    "Rail is clipped at precise portal boundary",
  );
  assert(
    !points.some((q) => q.x > 7 && q.x < 11 && q.y > 7.6 && q.y < 8.1),
    "No buried rail painted over hillside",
  );
  const all = Track.trackCanvasLayers(ctx, p.buildings[0].track, project, 1);
  assert(all.length > clipped.length);
  for (let turn = 0; turn < 4; turn++)
    for (const portal of T.parkCoasterTunnels(p).portals)
      Canvas.drawCoasterTunnelPortal(ctx, portal, Object.assign(project, { turn }), 1);
});

test("Chase cameras ease into the bore before entry and stay inside until their full length clears", () => {
  const p = park(),
    span = T.parkCoasterTunnels(p).spans[0],
    length = M.prepareRoute(p.buildings[0].track).length;
  for (const d of [span.start, span.start - 1, span.end, span.end + 1])
    near(T.tunnelChaseBlend(p, 88, d, length, 12), 0);
  near(T.tunnelChaseBlend(p, 88, span.end + 7, length, 12), 1);
  const values = Array.from({ length: 21 }, (_, i) =>
    T.tunnelChaseBlend(p, 88, span.end + 3.4 + i / 10, length, 12),
  );
  assert(values.every((v, i) => v >= 0 && v <= 1 && (!i || v >= values[i - 1])));
});

test("Shared world keeps tunnels when the ridden coaster is excluded from park population", () => {
  const p = park(),
    world = World.createWorld(p, 88);
  assert(world.scene.getObjectByName("coaster-tunnels"));
  assert(!world.scene.getObjectByName("coaster-structure-88"));
  world.dispose();
});
console.log(`${passed} coaster tunnel tests passed`);

import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";

const [Track, Habitat, Bird, Birds, Furniture, Weather, Access, Layout, S, Zoo, Iso] =
  await Promise.all(
    [
      "track-canvas",
      "zoo-canvas",
      "bird-canvas",
      "birds",
      "furniture",
      "weather-objects",
      "access-canvas",
      "ride-access",
      "simulation",
      "zoo",
      "isometric-view",
    ].map((name) => import(moduleURL(`game/${name}.ts`))),
  );
let passed = 0;
const test = (name, run) => {
  run();
  passed++;
  console.log("PASS", name);
};
const close = (a, b) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function projectFor(turn) {
  const project = (x, y, z = 0) => {
    const q = Iso.rotateMapPoint(x, y, turn);
    return { x: (q.x - q.y) * 24, y: (q.x + q.y) * 12 - z * 24 };
  };
  project.turn = turn;
  return project;
}
function context() {
  const fills = [],
    arcs = [],
    texts = [],
    stack = [];
  let points = [];
  const state = { globalAlpha: 1, fillStyle: "", strokeStyle: "", lineWidth: 1 };
  const coordinate = (...values) =>
    assert(values.every(Number.isFinite), "finite canvas coordinate");
  const api = {
    save: () => stack.push({ ...state }),
    restore: () => Object.assign(state, stack.pop()),
    beginPath: () => {
      points = [];
    },
    moveTo: (x, y) => {
      coordinate(x, y);
      points.push({ x, y });
    },
    lineTo: (x, y) => {
      coordinate(x, y);
      points.push({ x, y });
    },
    fill: () => fills.push({ color: state.fillStyle, points: structuredClone(points) }),
    arc: (...args) => {
      coordinate(...args);
      arcs.push(args);
    },
    ellipse: (...args) => coordinate(...args),
    translate: (...args) => coordinate(...args),
    rotate: (...args) => coordinate(...args),
    fillText: (label, x, y) => {
      coordinate(x, y);
      texts.push({ label, x, y });
    },
    measureText: () => ({ width: 20 }),
  };
  const ctx = new Proxy(api, {
    get: (object, name) => (name in state ? state[name] : (object[name] ?? (() => {}))),
    set: (_object, name, value) => {
      state[name] = value;
      return true;
    },
  });
  return { ctx, fills, arcs, texts, stack };
}
const building = (kind, x = 12, y = 15) => ({
  id: 77,
  kind,
  x,
  y,
  name: kind,
  open: true,
  price: 0,
  served: 0,
  revenue: 0,
  queue: [],
  riders: [],
  cycle: 0,
  tested: true,
});

test("Opposite views reverse equal-height track occlusion without changing cached world routes", () => {
  const track = [
    { x: 7, y: 5, z: 1, style: "wood" },
    { x: 12, y: 5, z: 1, style: "wood" },
    { x: 12, y: 10, z: 1, style: "wood" },
    { x: 7, y: 10, z: 1, style: "wood" },
    { x: 7, y: 5, z: 1, style: "wood" },
  ];
  const original = JSON.stringify(track),
    geometry = Track.trackCanvasGeometry(track);
  const originalGeometry = JSON.stringify(geometry),
    views = [];
  for (let turn = 0; turn < 4; turn++) {
    const c = context();
    const layers = Track.trackCanvasLayers(c.ctx, track, projectFor(turn), 1);
    assert(layers.every((layer) => Number.isFinite(layer.depth)));
    layers.forEach((layer) => layer.draw());
    assert.equal(c.stack.length, 0);
    views.push(layers);
  }
  const spanStart = geometry.supports.length;
  for (let i = spanStart; i < views[0].length; i++)
    close(views[0][i].depth + views[2][i].depth, 0.07);
  for (let i = 0; i < spanStart; i++) close(views[1][i].depth + views[3][i].depth, -0.04);
  const first = spanStart,
    last = spanStart + Math.floor(geometry.spans.length / 2);
  assert(
    (views[0][first].depth - views[0][last].depth) *
      (views[2][first].depth - views[2][last].depth) <
      0,
  );
  assert.equal(JSON.stringify(track), original);
  assert.equal(JSON.stringify(geometry), originalGeometry);
  assert.equal(Track.trackCanvasGeometry(track), geometry);
});

test("Furniture selects the actual camera-facing slat surfaces in all camera and object orientations", () => {
  for (const kind of ["bench", "picnic"])
    for (let orientation = 0; orientation < 4; orientation++) {
      const b = { ...building(kind), orientation },
        before = JSON.stringify(b);
      for (let turn = 0; turn < 4; turn++) {
        const c = context(),
          project = projectFor(turn);
        const faces = Furniture.drawFurniture(c.ctx, b, project, 1);
        assert.equal(faces.length, Furniture.furnitureParts(kind).length * 3);
        assert(faces.flat().every((p) => Number.isFinite(p.x + p.y)));
        // Pick the rearmost real part independently and check that its first
        // vertical surface uses the near X boundary, not the old fixed +X side.
        const parts = Furniture.furnitureParts(kind)
          .map((part) => {
            const angle = (orientation * Math.PI) / 2,
              x = b.x + (part.x * Math.cos(angle) - part.y * Math.sin(angle)) / 5,
              y = b.y + (part.x * Math.sin(angle) + part.y * Math.cos(angle)) / 5;
            const ray = [
              [1, 1],
              [1, -1],
              [-1, -1],
              [-1, 1],
            ][turn];
            return { part, x, y, depth: x * ray[0] + y * ray[1] + part.z * 0.08 };
          })
          .sort((a, b) => a.depth - b.depth);
        const { part, x, y } = parts[0],
          xRadius = (orientation % 2 ? part.depth : part.width) / 10,
          yRadius = (orientation % 2 ? part.width : part.depth) / 10,
          nearX = x + [1, 1, -1, -1][turn] * xRadius,
          expected = project(nearX, y - yRadius);
        close(faces[0][0].x, expected.x);
        close(
          faces[0][0].y,
          expected.y - (part.z - part.height / 2) * Furniture.FURNITURE_HEIGHT_PIXELS,
        );
        // No slat or leg collapses into an edge in another camera quadrant.
        for (const face of c.fills) {
          const twiceArea = face.points.reduce((sum, p, i, all) => {
            const next = all[(i + 1) % all.length];
            return sum + p.x * next.y - next.x * p.y;
          }, 0);
          assert(Math.abs(twiceArea) > 0.001);
        }
        assert.equal(c.stack.length, 0);
      }
      assert.equal(JSON.stringify(b), before);
    }
});

test("Cabin foreground follows the camera, while doorway placement stays fixed", () => {
  const park = S.newPark("sandbox"),
    b = park.buildings.find((b) => b.kind === "wheel");
  assert(b);
  for (let side = 0; side < 4; side++) {
    b.pods = { entry: { side, offset: 1 }, exit: { side: (side + 2) % 4, offset: 1 } };
    const layout = Layout.accessLayout(park, b),
      before = JSON.stringify(layout);
    for (let turn = 0; turn < 4; turn++) {
      const project = projectFor(turn),
        c = context();
      Access.drawAccessCabin(c.ctx, layout, project, 1, "back", true);
      Access.drawAccessCabin(c.ctx, layout, project, 1, "front", true);
      const label = c.texts.find((text) => text.label === "BEDIENUNG");
      assert(label);
      const center = project(layout.cabin.x, layout.cabin.y);
      assert(
        label.y > center.y - 0.47 * 15 + 0.5,
        "foreground sign must remain on the viewer-facing wall",
      );
      for (const role of ["entry", "exit"])
        for (const open of [0, 0.5, 1])
          Access.drawAccessPod(c.ctx, layout[role], role, { open }, project, 1);
      assert.equal(c.stack.length, 0);
    }
    assert.equal(JSON.stringify(layout), before);
  }
});

test("Habitat fences reverse depth around fixed animals and stay above ground even on an expanded map", () => {
  for (const kind of Object.keys(Zoo.SPECIES)) {
    const b = building(kind, 80, 80);
    Zoo.ensureHabitat(b).count = 2;
    const before = JSON.stringify(b),
      depths = [];
    for (let turn = 0; turn < 4; turn++) {
      const c = context(),
        layers = Habitat.habitatSceneryLayers(b, {
          ctx: c.ctx,
          project: projectFor(turn),
          scale: 1,
        });
      assert(layers.slice(1).every((layer) => layer.depth > layers[0].depth));
      layers.forEach((layer) => layer.draw());
      assert.equal(c.stack.length, 0);
      depths.push(layers);
    }
    const fenceCount = Zoo.SPECIES[kind].size * 4;
    for (let i = 1; i <= fenceCount; i++) close(depths[0][i].depth + depths[2][i].depth, 0.36);
    assert.equal(JSON.stringify(b), before);
  }
});

test("Weather furniture sorts its entire mesh for each view without changing its shared 3D model", () => {
  for (const kind of ["shelter", "parasol", "fountain"]) {
    const geometry = Weather.weatherFaces(kind),
      before = JSON.stringify(geometry);
    const views = [];
    for (let turn = 0; turn < 4; turn++) {
      const c = context();
      const faces = Weather.drawWeatherObject(c.ctx, building(kind), projectFor(turn), 1);
      assert.equal(faces.length, geometry.length);
      assert(faces.flat().every((p) => Number.isFinite(p.x + p.y)));
      views.push(c.fills.map((face) => face.color));
    }
    assert.notDeepEqual(views[0], views[2], "rotating must also change the painter's order");
    assert.equal(JSON.stringify(geometry), before);
    assert.equal(Weather.weatherFaces(kind), geometry);
  }
});

test("Bird eyes and near wings turn with the view, not with the physical flight path", () => {
  const park = S.newPark("sandbox"),
    pose = Birds.parkBirds(park, 5)[0];
  assert(pose);
  pose.opacity = 1;
  const before = JSON.stringify(pose);
  for (let turn = 0; turn < 4; turn++) {
    const c = context(),
      project = projectFor(turn);
    Bird.drawBird(c.ctx, pose, project, 1);
    const right = Iso.viewFacing(project, Math.sin(pose.heading), -Math.cos(pose.heading));
    const world = Birds.birdLocalWorld(
      pose,
      Birds.birdHeadPoint(pose, {
        x: (right.x + right.y > 0 ? 1 : -1) * 0.073,
        y: 0.075,
        z: 0.1,
      }),
    );
    const eye = project(world.x, world.y, world.z);
    close(c.arcs.at(-1)[0], eye.x);
    close(c.arcs.at(-1)[1], eye.y);
    assert.equal(c.stack.length, 0);
  }
  assert.equal(JSON.stringify(pose), before);
});
console.log(`${passed}/${passed} rotated geometry tests passed`);

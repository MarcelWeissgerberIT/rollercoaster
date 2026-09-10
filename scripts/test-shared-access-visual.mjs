import assert from "node:assert/strict";
import * as THREE from "three";
import { moduleURL } from "./ts-loader.mjs";
const [S, Shared, Visual, Model, Access, Canvas, Pod, Walk, Iso, Operations] = await Promise.all(
  [
    "simulation",
    "shared-access",
    "shared-access-visual",
    "shared-access-model",
    "ride-access",
    "access-canvas",
    "pod-model",
    "guest-walk",
    "isometric-view",
    "operations",
  ].map((name) => import(moduleURL(`game/${name}.ts`))),
);
let passed = 0;
const test = (name, run) => {
  run();
  passed++;
  console.log("PASS", name);
};
const close = (a, b) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function fixture() {
  const s = S.newPark("sandbox"),
    b = s.buildings.find((b) => b.kind === "wheel");
  s.buildings = [b];
  s.guests = [];
  s.tiles = Array.from({ length: 30 }, () => Array(30).fill("grass"));
  s.crewPool = undefined;
  Object.assign(b, {
    x: 12,
    y: 16,
    queue: [],
    riders: [],
    sharedAccess: true,
    open: true,
    tested: true,
    pods: { entry: { side: 1, offset: 1 }, exit: { side: 0, offset: 1 } },
    operations: { staffed: true, rounds: 1, remainingRounds: 0, phase: "idle", phaseLeft: 0 },
  });
  for (let y = 20; y < 30; y++) s.tiles[y][15] = "path";
  for (const [x, y] of [
    [13, 19],
    [13, 20],
    [14, 20],
  ])
    s.tiles[y][x] = "queue";
  return { s, b };
}
function guest(id, x, y, state = "walk", target = 77) {
  return {
    id,
    name: `Guest ${id}`,
    x,
    y,
    state,
    target,
    route: [],
    timer: 0,
    happiness: 80,
    hunger: 20,
    thirst: 20,
    rides: 1,
    skin: 0,
    thought: "",
    profile: "family",
    wallet: 50,
    visited: [],
  };
}
const area = (points) =>
  Math.abs(
    points.reduce((sum, p, i) => {
      const q = points[(i + 1) % points.length];
      return sum + p.x * q.y - q.x * p.y;
    }, 0),
  ) / 2;
function inside(points, point) {
  let result = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i],
      b = points[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      result = !result;
  }
  return result;
}
function context() {
  const fills = [],
    lines = [],
    texts = [],
    stack = [];
  let points = [];
  const state = { globalAlpha: 1, fillStyle: "", strokeStyle: "", lineWidth: 1 };
  const api = {
    save: () => stack.push({ ...state }),
    restore: () => Object.assign(state, stack.pop()),
    beginPath: () => {
      points = [];
    },
    moveTo: (x, y) => {
      assert(Number.isFinite(x + y));
      points.push({ x, y });
    },
    lineTo: (x, y) => {
      assert(Number.isFinite(x + y));
      points.push({ x, y });
    },
    fill: () => fills.push({ color: state.fillStyle, points: structuredClone(points) }),
    stroke: () => lines.push({ color: state.strokeStyle, points: structuredClone(points) }),
    fillText: (label, x, y) => texts.push({ label, x, y }),
    measureText: () => ({ width: 20 }),
  };
  return {
    fills,
    lines,
    texts,
    stack,
    ctx: new Proxy(api, {
      get: (o, k) => (k in state ? state[k] : (o[k] ?? (() => {}))),
      set: (_o, k, v) => {
        state[k] = v;
        return true;
      },
    }),
  };
}
function project(turn) {
  const p = (x, y, z = 0) => {
    const q = Iso.rotateMapPoint(x, y, turn);
    return { x: (q.x - q.y) * 24, y: (q.x + q.y) * 12 - z * 24 };
  };
  p.turn = turn;
  return p;
}
function dispose(scene) {
  const geometries = new Set(),
    materials = new Set();
  scene.traverse((o) => {
    if (o.isMesh) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
    }
  });
  for (const value of [...geometries, ...materials]) value.dispose();
}

test("Shared paving follows the actual blue corridor and its L corner, keeping the public path intact", () => {
  const { s } = fixture(),
    before = JSON.stringify(s),
    tiles = Visual.sharedAccessTiles(s);
  assert.equal(tiles.length, 3);
  assert(!tiles.some((t) => s.tiles[t.cell.y][t.cell.x] === "path"));
  for (const tile of tiles) {
    close(area(tile.entry) + area(tile.exit), 1);
    assert(area(tile.entry) > 0 && area(tile.exit) > 0);
    for (const arrow of tile.arrows) {
      assert(inside(tile[arrow.role], arrow.center));
      assert(!inside(tile[arrow.role === "entry" ? "exit" : "entry"], arrow.center));
    }
    close(tile.arrows[0].direction.x, -tile.arrows[1].direction.x);
    close(tile.arrows[0].direction.y, -tile.arrows[1].direction.y);
    assert(
      tile.divider.every(
        (p) => Math.abs(p.x - tile.cell.x) <= 0.5 && Math.abs(p.y - tile.cell.y) <= 0.5,
      ),
    );
  }
  assert.equal(JSON.stringify(s), before);
});

test("Canvas and 3D paint identical lane polygons at each camera angle", () => {
  const { s } = fixture(),
    tiles = Visual.sharedAccessTiles(s),
    scene = new THREE.Scene();
  Model.addSharedAccessMarkings(scene, s);
  for (const tile of tiles) {
    const group = scene.getObjectByName(
      `shared-access-path-${tile.buildingId}-${tile.cell.x}-${tile.cell.y}`,
    );
    assert(group);
    for (const role of ["entry", "exit"]) {
      const mesh = group.getObjectByName(`shared-${role}-lane`);
      assert.deepEqual(mesh.userData.outline, tile[role]);
      assert(mesh.geometry.attributes.position.count >= 3);
    }
    assert.equal(group.children.filter((o) => o.name.endsWith("arrow")).length, 6);
    for (let turn = 0; turn < 4; turn++) {
      const c = context(),
        p = project(turn);
      Visual.drawSharedAccessTile(c.ctx, tile, p, 2);
      assert.equal(c.fills.length, 2);
      for (const [i, role] of ["entry", "exit"].entries())
        assert.deepEqual(
          c.fills[i].points,
          tile[role].map((q) => p(q.x, q.y)),
        );
      assert.equal(c.lines.length, 7);
      assert.equal(c.stack.length, 0);
    }
  }
  dispose(scene);
});

test("Two narrow staffed gates share one physical port and retain a separate control cabin", () => {
  const { s, b } = fixture(),
    layout = Access.accessLayout(s, b),
    before = JSON.stringify(s),
    lanes = Shared.getSharedAccessLanes(s, b),
    scene = new THREE.Scene();
  assert.deepEqual(layout.entry.port, layout.exit.port);
  close(Math.hypot(layout.entry.x - layout.exit.x, layout.entry.y - layout.exit.y), 0.44);
  for (const role of ["entry", "exit"]) {
    close(layout[role].x - lanes[role][0].x, -layout[role].dx * 0.68);
    close(layout[role].y - lanes[role][0].y, -layout[role].dy * 0.68);
  }
  assert.equal(new Set(Object.values(layout.posts).map((p) => `${p.x},${p.y}`)).size, 3);
  Pod.addAccessPods(scene, s);
  for (const role of ["entry", "exit"]) {
    const gate = scene.getObjectByName(`${role}-pod-${b.id}`);
    assert(gate);
    close(gate.scale.x, 0.46);
    close(gate.position.x, layout[role].x * 5);
    close(gate.position.z, layout[role].y * 5);
    assert(
      gate.getObjectByName("lane-label-0-0-0") ||
        gate.children.some((o) => o.name.startsWith("lane-label")),
    );
  }
  assert(scene.getObjectByName(`shared-access-divider-${b.id}`));
  assert(scene.getObjectByName(`control-cabin-${b.id}`));
  for (let turn = 0; turn < 4; turn++) {
    const c = context();
    for (const role of ["entry", "exit"])
      Canvas.drawAccessPod(
        c.ctx,
        layout[role],
        role,
        Access.gateMotion(s, b, role),
        project(turn),
        1,
        role === "entry" ? -1 : 1,
        undefined,
        true,
      );
    Canvas.drawSharedAccessDivider(c.ctx, layout, project(turn), 1);
    assert(c.texts.some((t) => t.label === "EIN"));
    assert(c.texts.some((t) => t.label === "AUS"));
    assert.equal(c.stack.length, 0);
  }
  assert.equal(JSON.stringify(s), before);
  dispose(scene);
});

test("Exit gates follow actual released guests while the entrance waits, including closure releases without visit history", () => {
  const { s, b } = fixture(),
    port = Access.accessLayout(s, b).entry.port,
    g = guest(901, port.x, port.y, "walk", b.id);
  g.sharedExit = b.id;
  s.guests = [g];
  Object.assign(b.operations, { phase: "boarding", phaseLeft: 1 });
  const before = JSON.stringify(s);
  assert.equal(Access.gateMotion(s, b, "entry").open, 0);
  assert(Access.gateMotion(s, b, "exit").open > 0.9);
  const scene = new THREE.Scene(),
    update = Pod.addAccessPods(scene, s);
  update();
  assert.equal(scene.getObjectByName(`entry-pod-${b.id}`).userData.gateOpen, 0);
  assert(scene.getObjectByName(`exit-pod-${b.id}`).userData.gateOpen > 0.9);
  assert.equal(JSON.stringify(s), before);
  Object.assign(b.operations, { phase: "unloading", phaseLeft: Operations.UNLOADING_SECONDS });
  assert.equal(Access.gateMotion(s, b, "exit").phaseProgress, 0);
  assert(Access.gateMotion(s, b, "exit").open > 0.9);
  update();
  assert(scene.getObjectByName(`exit-pod-${b.id}`).userData.gateOpen > 0.9);
  assert.equal(scene.getObjectByName(`entry-pod-${b.id}`).userData.gateOpen, 0);
  dispose(scene);
});

test("Walking and queued guests use the same physical lanes in the map and interpolated 3D preview", () => {
  const { s, b } = fixture(),
    port = Access.accessLayout(s, b).entry.port;
  const inbound = guest(911, 13, 19.4, "walk", b.id),
    outbound = guest(912, 13, 19.4, "walk", null);
  outbound.sharedExit = b.id;
  const queued = guest(913, port.x, port.y, "queue", b.id);
  b.queue = [queued.id];
  s.guests = [inbound, outbound, queued];
  for (const g of s.guests)
    assert.deepEqual(Walk.guestWalkPosition(s, g), Shared.sharedAccessGuestPosition(s, g));
  const pos = { x: 13.45, y: 20 };
  assert.deepEqual(
    Walk.guestWalkPosition(s, outbound, pos),
    Shared.sharedAccessGuestPosition(s, { ...outbound, ...pos }),
  );
  const blue = Walk.guestWalkPosition(s, inbound),
    red = Walk.guestWalkPosition(s, outbound);
  assert(Math.hypot(blue.x - red.x, blue.y - red.y) > 0.3);
});

test("Toggling shared presentation invalidates the access cache without moving the saved independent exit", () => {
  const { s, b } = fixture(),
    stored = JSON.stringify(b.pods),
    shared = Access.accessLayout(s, b);
  b.sharedAccess = false;
  const separate = Access.accessLayout(s, b);
  assert.notDeepEqual(shared.exit.port, separate.exit.port);
  assert.equal(JSON.stringify(b.pods), stored);
  assert.equal(Visual.sharedAccessTiles(s).length, 0);
  b.sharedAccess = true;
  assert.deepEqual(Access.accessLayout(s, b), shared);
});
test("Waiting guests face inward along their lane, around a corner and at direct gates in all four directions", () => {
  const { s, b } = fixture();
  s.guests = Array.from({ length: 6 }, (_, i) => guest(940 + i, 13, 19, "queue", b.id));
  b.queue = s.guests.map((g) => g.id);
  const before = JSON.stringify(s),
    first = Walk.guestQueueDirection(s, s.guests[0]),
    corner = Walk.guestQueueDirection(s, s.guests[4]);
  close(first.x, 0);
  close(first.y, -1);
  assert(
    corner.x < -0.95 && Math.abs(corner.y) < 0.25,
    "Past the bend, face back around the corner rather than toward the station through the grass",
  );
  for (const g of s.guests) {
    const direction = Walk.guestQueueDirection(s, g),
      position = Walk.guestWalkPosition(s, g);
    close(Math.hypot(direction.x, direction.y), 1);
    assert.deepEqual(Walk.guestQueueDirection(s, g, position), direction);
    const yaw = Math.atan2(-direction.x, -direction.y);
    close(-Math.sin(yaw), direction.x);
    close(-Math.cos(yaw), direction.y);
  }
  assert.equal(JSON.stringify(s), before);
  for (let side = 0; side < 4; side++) {
    b.pods.entry.side = side;
    s.tiles = s.tiles.map((row) => row.map(() => "path"));
    b.queue = b.queue.slice(0, 2);
    const outward = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ][side];
    for (const g of s.guests.slice(0, 2)) {
      const direction = Walk.guestQueueDirection(s, g);
      close(direction.x, -outward[0]);
      close(direction.y, -outward[1]);
    }
  }
  assert.equal(Walk.guestQueueDirection(s, { ...s.guests[0], state: "walk" }), undefined);
  b.sharedAccess = false;
  assert.equal(Walk.guestQueueDirection(s, s.guests[0]), undefined);
});
console.log(`${passed}/${passed} shared-access visual tests passed`);

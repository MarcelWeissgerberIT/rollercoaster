import assert from "node:assert/strict";
import * as THREE from "three";
import { moduleURL } from "./ts-loader.mjs";

const A = await import(moduleURL("game/staff-animation.ts")),
  M = await import(moduleURL("game/staff-model.ts")),
  V = await import(moduleURL("game/staff-visual.ts")),
  F = await import(moduleURL("game/staff.ts")),
  C = await import(moduleURL("game/cleanliness.ts")),
  S = await import(moduleURL("game/simulation.ts")),
  O = await import(moduleURL("game/operations.ts")),
  Canvas = await import(moduleURL("game/staff-canvas.ts"));
const actions = [
  "idle",
  "walk",
  "carry",
  "sweep",
  "empty",
  "deposit",
  "feed",
  "water",
  "inspect",
  "greet",
  "admit",
  "guide",
  "console",
];
let passed = 0;
function test(name, run) {
  run();
  console.log("PASS", name);
  passed++;
}
const motion = (changes = {}) => ({
  id: 2,
  role: "cleaner",
  action: "idle",
  time: 1,
  heading: 0.7,
  distance: 2,
  progress: 0.5,
  carried: 0,
  ...changes,
});
const part = (pose, id) => {
  const found = pose.find((p) => p.id === id);
  assert(found, `Missing articulated part ${id}`);
  return found;
};
const near = (a, b, message = "Coordinate mismatch") =>
  assert(Math.abs(a - b) < 1e-8, `${message}: ${a} != ${b}`);
function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
function resources(root) {
  const meshes = new Set(),
    geometries = new Set(),
    materials = new Set();
  root.traverse((object) => {
    if (!object.isMesh) return;
    meshes.add(object);
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      materials.add(material);
  });
  return { meshes, geometries, materials };
}
function dispose(root) {
  const r = resources(root);
  for (const g of r.geometries) g.dispose();
  for (const m of r.materials) m.dispose();
}
function modelState(root) {
  root.updateMatrixWorld(true);
  return root.children.map((o) => ({
    id: o.uuid,
    visible: o.visible,
    matrix: o.matrixWorld.toArray(),
    geometry: o.geometry.uuid,
    material: o.material.uuid,
  }));
}
function cleaningPark(kind = "deposit", progress = 0.5) {
  const s = {
      tiles: Array.from({ length: 6 }, (_, y) => Array(6).fill(y === 2 ? "path" : "grass")),
      buildings: [],
      guests: [],
      staff: 1,
      time: 7,
      speed: 1,
    },
    bin = { id: 20, x: 3, y: 3, kind: "bin", binFill: kind === "bin" ? 16 : 2 },
    total = kind === "bin" ? 3 : kind === "collection" ? 2.4 : 1.4,
    worker = {
      id: 1,
      x: 3,
      y: 2,
      route: [],
      mode: kind === "bin" ? "empty" : "deposit",
      target: {
        kind,
        id: kind === "collection" ? 0 : bin.id,
        ...(kind === "collection" ? { point: { x: 3, y: 2 } } : {}),
      },
      workLeft: total * (1 - progress),
      workTotal: total,
      retry: 0,
      carried: kind === "bin" ? 0 : 4,
      toCollection: kind === "collection",
      walked: 12,
      heading: Math.PI / 2,
      transferred: false,
      serviceTarget: kind === "collection" ? { x: 3, y: 2 } : { x: bin.x, y: bin.y },
    };
  if (kind !== "collection") s.buildings.push(bin);
  s.cleanliness = {
    version: 1,
    nextId: 2,
    litter: [],
    workers: [worker],
    cleaned: 0,
    emptied: 0,
    binned: 0,
    disposed: 0,
  };
  return { s, worker, bin, total, ref: { kind: "cleaner", id: 1 } };
}

test("Walking joints follow distance traveled and stop advancing when distance stops", () => {
  for (const action of ["walk", "carry"]) {
    const before = A.staffPose(motion({ action, distance: 0.1 })),
      after = A.staffPose(motion({ action, distance: 0.35 })),
      later = A.staffPose(motion({ action, distance: 0.1, time: 100 }));
    for (const id of ["thigh-1", "shin1", "shoe-1", "hand1"]) {
      assert.notDeepEqual(part(before, id), part(after, id), `${action}: ${id} must articulate`);
      assert.deepEqual(
        part(before, id),
        part(later, id),
        `${action}: ${id} must use walked distance`,
      );
    }
    assert.notDeepEqual(part(before, "shoe-1").a.slice(1), part(before, "shoe1").a.slice(1));
  }
});

test("Stationary work keeps feet planted instead of replaying a walking cycle", () => {
  for (const action of actions.filter((a) => a !== "walk" && a !== "carry")) {
    const before = A.staffPose(motion({ action, time: 0.1, distance: 0 })),
      after = A.staffPose(motion({ action, time: 1.7, distance: 8 }));
    for (const id of ["shin-1", "shin1", "shoe-1", "shoe1", "sole-1", "sole1"])
      assert.deepEqual(part(before, id), part(after, id), `${action}: ${id} slides while stopped`);
  }
});

test("Identical frozen inputs reproduce poses and model transforms without randomness or mutations", () => {
  const input = freeze(motion({ action: "sweep" })),
    snapshot = structuredClone(input),
    originalRandom = Math.random;
  Math.random = () => {
    throw new Error("Animation used simulation randomness");
  };
  let model;
  try {
    const first = A.staffPose(input),
      second = A.staffPose(input);
    assert.deepEqual(first, second);
    first[0].a[0] = 900;
    assert.deepEqual(A.staffPose(input), second, "Pose arrays must not share mutable state");
    // Three uses its own UUID generator; pose evaluation itself is the random-free contract.
    Math.random = originalRandom;
    model = M.createStaffModel(input);
    const before = modelState(model.root);
    model.update(input);
    assert.deepEqual(modelState(model.root), before);
    assert.deepEqual(input, snapshot);
  } finally {
    Math.random = originalRandom;
    if (model) dispose(model.root);
  }
});

test("Both sweeping hands remain on the broom handle throughout the sweep", () => {
  for (let time = 0; time < 4; time += 0.07) {
    const pose = A.staffPose(motion({ action: "sweep", time })),
      stick = part(pose, "broom-stick"),
      a = new THREE.Vector3(...stick.a),
      b = new THREE.Vector3(...stick.b),
      axis = b.clone().sub(a);
    for (const id of ["hand-1", "hand1"]) {
      const hand = new THREE.Vector3(...part(pose, id).a),
        t = hand.clone().sub(a).dot(axis) / axis.lengthSq(),
        closest = a.clone().addScaledVector(axis, t);
      assert(t > 0 && t < 1, `${id} grip extends past the handle`);
      assert(hand.distanceTo(closest) < 1e-8, `${id} detaches from the handle`);
    }
    near(part(pose, "broom-head").a[1], 0.065, "Broom must reach the ground");
  }
});

test("Work actions articulate the arms and their actual tools", () => {
  for (const [role, action, tool] of [
    ["cleaner", "sweep", "broom-head"],
    ["cleaner", "empty", "bag"],
    ["cleaner", "deposit", "bag"],
    ["keeper", "feed", "food0"],
    ["keeper", "water", "watering-can"],
    ["keeper", "inspect", "clipboard"],
    ["operator", "greet", "radio"],
    ["operator", "admit", "ticket-scanner"],
    ["operator", "guide", "radio"],
    ["operator", "console", "radio"],
  ]) {
    const initial = A.staffPose(motion({ role, action, time: 0, progress: 0.1, carried: 3 })),
      active = A.staffPose(motion({ role, action, time: 0.25, progress: 0.5, carried: 3 }));
    part(initial, tool);
    part(active, tool);
    assert.notDeepEqual(
      part(initial, "hand1").a,
      part(active, "hand1").a,
      `${action} has frozen hands`,
    );
    if (["sweep", "empty", "deposit", "feed", "water"].includes(action))
      assert.notDeepEqual(part(initial, tool).a, part(active, tool).a, `${action} tool is frozen`);
  }
  const hidden = A.staffPose(motion({ action: "deposit", carried: 4, hideBag: true }));
  assert(!hidden.some((p) => p.id === "bag" || p.id === "bag-tie"));
});

test("Activity mapping uses actual movement and waste load, including an operator at the console", () => {
  const s = S.newPark("sandbox"),
    b = s.buildings.find((b) => b.kind === "wheel"),
    operator = { kind: "operator", id: b.id },
    attendant = { ...operator, post: "entry" };
  O.ensureOperations(b);
  b.operations.phase = "checking";
  b.operations.phaseLeft = 1.35;
  assert.equal(F.staffLocation(s, attendant).carrying, "none");
  assert.equal(
    V.staffMotion(s, attendant).action,
    "walk",
    "The truthy string 'none' must not cause carrying",
  );
  b.operations.phase = "running";
  assert.equal(V.staffMotion(s, operator).action, "console");
  b.operations.phase = "boarding";
  b.operations.phaseLeft = 1;
  assert.equal(V.staffMotion(s, attendant).action, "admit");
  assert.equal(V.staffMotion(s, operator).action, "console");
  b.operations.phase = "unloading";
  b.operations.phaseLeft = 0.6;
  assert.equal(V.staffMotion(s, { ...operator, post: "exit" }).action, "guide");
  const fixture = cleaningPark(),
    w = fixture.worker;
  w.mode = "walk";
  w.target = null;
  w.route = [{ x: 4, y: 2 }];
  w.carried = 0;
  assert.equal(V.staffMotion(fixture.s, fixture.ref).action, "walk");
  w.carried = 3;
  assert.equal(V.staffMotion(fixture.s, fixture.ref).action, "carry");
  w.mode = "sweep";
  w.route = [];
  assert.equal(V.staffMotion(fixture.s, fixture.ref).action, "sweep");
  assert.equal(V.staffMotion(s, { kind: "cleaner", id: 99999 }), null);
});

test("Care progress selects feeding, watering, cleaning and qualified technical inspection", () => {
  const s = S.newPark("sandbox"),
    worker = {
      id: 3,
      x: 15,
      y: 20,
      route: [],
      mode: "care",
      targetId: null,
      workLeft: 9,
      workTotal: 10,
      walked: 5,
      retry: 0,
      homeId: 0,
    },
    ref = { kind: "keeper", id: worker.id };
  s.zoo ??= {};
  s.zoo.workers = [worker];
  for (const [left, action] of [
    [9, "feed"],
    [5, "water"],
    [1, "sweep"],
  ]) {
    worker.workLeft = left;
    assert.equal(V.staffMotion(s, ref).action, action);
  }
  worker.role = "technical";
  assert.equal(V.staffMotion(s, ref).action, "inspect");
  const snapshot = structuredClone(s);
  freeze(s);
  assert.deepEqual(V.staffMotion(s, ref), V.staffMotion(s, ref));
  assert.deepEqual(s, snapshot);
});

test("All roles and actions produce finite, positive geometry and valid articulated transforms", () => {
  for (const role of ["cleaner", "keeper", "operator"]) {
    const model = M.createStaffModel(motion({ role }));
    try {
      for (const action of actions)
        for (const progress of [0, 0.01, 0.5, 0.99, 1]) {
          const input = motion({
            role,
            action,
            progress,
            time: progress * 19,
            carried: 4,
            heading: progress * Math.PI * 2,
            distance: progress * 30,
          });
          for (const p of A.staffPose(input)) {
            assert(
              [...p.a, ...(p.b ?? []), ...p.size].every(Number.isFinite),
              `${role}/${action}/${p.id}`,
            );
            assert(p.size.every((n) => n > 0));
          }
          model.update(input);
          model.root.updateMatrixWorld(true);
          model.root.traverse((object) => {
            assert(object.matrixWorld.elements.every(Number.isFinite));
            if (object.isMesh)
              assert(object.geometry.attributes.position.array.every(Number.isFinite));
          });
        }
    } finally {
      dispose(model.root);
    }
  }
});

test("Repeated action changes reuse bounded meshes, geometries and materials", () => {
  for (const role of ["cleaner", "keeper", "operator"]) {
    const model = M.createStaffModel(motion({ role }));
    try {
      for (const action of actions) model.update(motion({ role, action, carried: 4 }));
      const warmed = resources(model.root),
        unionSize = warmed.meshes.size;
      assert(unionSize < 90, `${role} mesh count grew beyond one articulated person`);
      assert.equal(warmed.geometries.size, 2, "All parts should reuse two primitive geometries");
      assert(warmed.materials.size <= 32, `${role} allocates excessive materials`);
      assert.equal(
        new Set([...warmed.materials].map((m) => m.color.getHex())).size,
        warmed.materials.size,
        "Identical colors must share a material",
      );
      for (let frame = 0; frame < 500; frame++) {
        const action = actions[frame % actions.length],
          input = motion({
            role,
            action,
            time: frame * 0.03,
            progress: (frame % 100) / 100,
            distance: frame * 0.02,
            carried: frame % 8,
            hideBag: frame % 2 === 0,
          });
        model.update(input);
        assert.equal(
          model.root.children.filter((m) => m.visible).length,
          A.staffPose(input).length,
          "Unused tool meshes must be hidden when actions change",
        );
      }
      const after = resources(model.root);
      assert.deepEqual(after, warmed, `${role} replaced or leaked model resources while animating`);
      assert.equal(model.root.children.length, unionSize);
    } finally {
      dispose(model.root);
    }
  }
});

function recordingCanvas() {
  const ellipses = [],
    lines = [], pixels = [];
  let path = [];
  return {
    ellipses,
    lines,
    pixels,
    fillRect(x, y, width, height) { pixels.push({x, y, width, height, color: this.fillStyle}); },
    save() {},
    restore() {},
    beginPath() {
      path = [];
    },
    moveTo(x, y) {
      path.push([x, y]);
    },
    lineTo(x, y) {
      path.push([x, y]);
    },
    ellipse(x, y) {
      path.push([x, y]);
    },
    fill() {
      if (path.length === 1) ellipses.push({ color: this.fillStyle, point: path[0] });
    },
    stroke() {
      if (path.length === 2) lines.push({ color: this.strokeStyle, points: [...path] });
    },
  };
}
test("Canvas and 3D consume the same posed joints, tool positions and heading", () => {
  const x = 100,
    y = 200,
    scale = 1.6,
    project = (p) => [x + (p.x - p.z) * 9 * scale, y + ((p.x + p.z) * 4.5 - p.y * 15) * scale],
    same = (a, b) => a.length === b.length && a.every((n, i) => Math.abs(n - b[i]) < 1e-7);
  for (const action of ["walk", "sweep", "empty", "feed", "water", "admit", "guide", "console"]) {
    const input = motion({
        role: ["admit", "guide", "console"].includes(action)
          ? "operator"
          : ["feed", "water"].includes(action)
            ? "keeper"
            : "cleaner",
        action,
        carried: 3,
        heading: -1.2,
      }),
      model = M.createStaffModel(input),
      ctx = recordingCanvas();
    try {
      Canvas.drawStaff(ctx, input, x, y, scale);
      model.root.updateMatrixWorld(true);
      for (const p of A.staffPose(input)) {
        const mesh = model.root.getObjectByName(p.id);
        assert(mesh?.visible);
        // Heads now share depth-tested anatomy instead of flattening every
        // feature to a front-facing ellipse. The head suite checks that raster.
        if (p.head) { assert(ctx.pixels.length > 100); continue; }
        if (p.b) {
          const half = mesh.scale.y - p.size[0] * 0.45,
            a = project(mesh.localToWorld(new THREE.Vector3(0, -half / mesh.scale.y, 0))),
            b = project(mesh.localToWorld(new THREE.Vector3(0, half / mesh.scale.y, 0)));
          assert(
            ctx.lines.some(
              (line) =>
                line.color === p.color && same(line.points[0], a) && same(line.points[1], b),
            ),
            `${action}/${p.id}: canvas limb differs from the 3D joint segment`,
          );
        } else {
          const center = project(mesh.getWorldPosition(new THREE.Vector3()));
          assert(
            ctx.ellipses.some(
              (ellipse) => ellipse.color === p.color && same(ellipse.point, center),
            ),
            `${action}/${p.id}: canvas point differs from its 3D position`,
          );
        }
      }
    } finally {
      dispose(model.root);
    }
  }
});

test("Bin, deposit and collection transfers happen once before the return walk and conserve waste", () => {
  for (const kind of ["bin", "deposit", "collection"]) {
    const { s, worker, bin, total, ref } = cleaningPark(kind, 0.77),
      before = worker.carried + (kind === "collection" ? 0 : bin.binFill) + s.cleanliness.disposed,
      oldBin = bin.binFill,
      oldCarried = worker.carried;
    assert.equal(V.staffMotion(s, ref).action, kind === "bin" ? "empty" : "deposit");
    C.tickCleanliness(s, total * 0.005);
    assert.equal(worker.carried, oldCarried);
    assert.equal(bin.binFill, oldBin);
    C.tickCleanliness(s, total * 0.02);
    assert(worker.transferred, `${kind} did not transfer its load by return time`);
    assert(C.cleanerServicePose(s, worker).walking, `${kind} should walk back after service`);
    assert.equal(V.staffMotion(s, ref).action, kind === "bin" ? "carry" : "walk");
    assert.equal(worker.carried, kind === "bin" ? 16 : 0);
    if (kind === "collection") assert.equal(s.cleanliness.disposed, 4);
    else assert.equal(bin.binFill, kind === "bin" ? 0 : 6);
    const moved = {
      carried: worker.carried,
      bin: bin.binFill,
      disposed: s.cleanliness.disposed,
      emptied: s.cleanliness.emptied,
      binned: s.cleanliness.binned,
    };
    C.tickCleanliness(s, total * 0.1);
    assert.deepEqual(
      {
        carried: worker.carried,
        bin: bin.binFill,
        disposed: s.cleanliness.disposed,
        emptied: s.cleanliness.emptied,
        binned: s.cleanliness.binned,
      },
      moved,
      "Return animation transferred waste twice",
    );
    assert.equal(
      worker.carried + (kind === "collection" ? 0 : bin.binFill) + s.cleanliness.disposed,
      before,
    );
  }
});

console.log(`${passed} staff animation tests passed.`);

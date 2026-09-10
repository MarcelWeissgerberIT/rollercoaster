import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  R = await import(moduleURL("game/render.ts")),
  A = await import(moduleURL("game/ride-access.ts")),
  C = await import(moduleURL("game/access-canvas.ts")),
  B = await import(moduleURL("game/construction.ts")),
  P = await import(moduleURL("game/pods.ts"));
let passed = 0;
function test(name, run) {
  run();
  passed++;
  console.log("PASS", name);
}
function context() {
  const operations = [],
    stack = [],
    noop = () => {},
    gradient = { addColorStop: noop };
  let points = [];
  const state = {
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    lineCap: "",
  };
  const record = (kind, value = points) => {
    if (Math.abs(state.globalAlpha - 0.55) < 1e-8)
      operations.push({ kind, value: structuredClone(value), ...state });
  };
  const api = {
    save: () => stack.push({ ...state }),
    restore: () => Object.assign(state, stack.pop()),
    beginPath: () => {
      points = [];
    },
    closePath: () => points.push(["close"]),
    moveTo: (...p) => points.push(["move", ...p]),
    lineTo: (...p) => points.push(["line", ...p]),
    arc: (...p) => points.push(["arc", ...p]),
    ellipse: (...p) => points.push(["ellipse", ...p]),
    fill: () => record("fill"),
    stroke: () => record("stroke"),
    fillRect: (...p) => record("fillRect", p),
    strokeRect: (...p) => record("strokeRect", p),
    fillText: (...p) => record("text", p),
    measureText: () => ({ width: 20 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };
  return {
    operations,
    ctx: new Proxy(api, {
      get: (o, k) => (k in state ? state[k] : k in o ? o[k] : noop),
      set: (_, k, v) => ((state[k] = v), true),
    }),
  };
}
function fixture() {
  const s = S.newPark("sandbox");
  s.buildings = s.buildings.filter((b) => b.kind === "wheel");
  s.guests = [];
  s.staff = 0;
  s.cleanliness.workers = [];
  s.zoo = undefined;
  const b = s.buildings[0];
  assert(b);
  return { s, b, size: S.CATALOG[b.kind].size };
}
const view = (zoom = 1) => ({
  zoom,
  panX: 0,
  panY: 0,
  grid: false,
  hover: null,
  tool: "select",
  selected: null,
  draft: [],
  height: 0,
});
const center = (points) => ({
  x: points.reduce((n, p) => n + p.x, 0) / points.length,
  y: points.reduce((n, p) => n + p.y, 0) / points.length,
});
const boothSide = (layout) =>
  Math.sign(
    (layout.posts.entry.x - layout.entry.x) * layout.entry.tx +
      (layout.posts.entry.y - layout.entry.y) * layout.entry.ty,
  ) || -1;

test("Actual pod and cabin surfaces remain clickable in all four directions and at every tested zoom", () => {
  for (const side of [0, 1, 2, 3])
    for (const zoom of [0.65, 1, 3, 6]) {
      const { s, b } = fixture(),
        v = view(zoom),
        { ctx } = context();
      b.pods = { entry: { side, offset: 1 }, exit: { side: (side + 2) % 4, offset: 1 } };
      R.draw(ctx, 1520, 860, s, v, 0);
      const regions = v.hitTargets.filter((hit) => "polygons" in hit && hit.id === b.id);
      assert.equal(
        regions.length,
        4,
        "Two pods and both visible cabin layers need their actual surface regions",
      );
      for (const region of regions) {
        const isolated = { ...v, hitTargets: [region] };
        for (const polygon of region.polygons) {
          const point = center(polygon);
          assert.equal(
            R.hitBuildingAt(isolated, point.x, point.y),
            b.id,
            `side ${side}, zoom ${zoom}: visible surface missed`,
          );
          assert.equal(R.hitAccessPodAt(isolated, point.x, point.y), region.pod);
        }
      }
      // The original regression: only a fixed 12px central stripe was clickable.
      if (zoom >= 3)
        for (const role of ["entry", "exit"]) {
          const region = regions.find((hit) => hit.pod === role),
            layout = A.accessLayout(s, b),
            projected = R.projection(1520, 860, v).project(layout[role].x, layout[role].y);
          assert(
            region.polygons
              .map(center)
              .some(
                (point) =>
                  Math.abs(point.x - projected.x) > 6 &&
                  R.hitAccessPodAt(v, point.x, point.y) === role,
              ),
            `${role}, side ${side}, zoom ${zoom}: outer visible architecture must be selectable`,
          );
        }
      assert.equal(R.hitBuildingAt(v, -5000, -5000), null);
    }
});

test("Transparent gaps in an access bounding rectangle leave the underlying path clickable", () => {
  const { s, b } = fixture(),
    v = view(3),
    { ctx } = context();
  R.draw(ctx, 1520, 860, s, v, 0);
  const region = v.hitTargets.find((hit) => "polygons" in hit && hit.pod === "entry"),
    { left, right, top, bottom } = region.bounds;
  let gap;
  for (let y = top + 1; y < bottom - 1 && !gap; y += 2)
    for (let x = left + 1; x < right - 1; x += 2) {
      if (R.hitBuildingAt({ ...v, hitTargets: [region] }, x, y) === null) {
        gap = { x, y };
        break;
      }
    }
  assert(gap, "Detailed architecture must retain transparent areas inside its bounds");
  const path = { id: 999, a: { x: gap.x - 1, y: gap.y }, b: { x: gap.x + 1, y: gap.y } };
  assert.equal(R.hitBuildingAt({ ...v, hitTargets: [path, region] }, gap.x, gap.y), 999);
  assert.equal(R.hitAccessPodAt({ ...v, hitTargets: [path, region] }, gap.x, gap.y), undefined);
});

test("The top visible owner determines the pod role, including overlapping cabin walls of the same ride", () => {
  const { s } = fixture(),
    v = view(3),
    { ctx } = context();
  R.draw(ctx, 1520, 860, s, v, 0);
  const pod = v.hitTargets.find((hit) => "polygons" in hit && hit.pod === "entry"),
    point = center(pod.polygons[0]),
    front = {
      id: pod.id,
      polygons: [
        [
          { x: point.x - 2, y: point.y - 2 },
          { x: point.x + 2, y: point.y - 2 },
          { x: point.x + 2, y: point.y + 2 },
          { x: point.x - 2, y: point.y + 2 },
        ],
      ],
      bounds: { left: point.x - 2, right: point.x + 2, top: point.y - 2, bottom: point.y + 2 },
    };
  assert.equal(R.hitAccessPodAt({ ...v, hitTargets: [pod] }, point.x, point.y), "entry");
  assert.equal(R.hitBuildingAt({ ...v, hitTargets: [pod, front] }, point.x, point.y), pod.id);
  assert.equal(
    R.hitAccessPodAt({ ...v, hitTargets: [pod, front] }, point.x, point.y),
    undefined,
    "A cabin wall must not select a hidden pod behind it",
  );
});

test("Pod ghosts match the committed booth and cabin in every direction without registering hits or mutating the park", () => {
  for (const role of ["entry", "exit"])
    for (const side of [0, 1, 2, 3]) {
      const { s, b, size } = fixture();
      s.tiles = s.tiles.map((row) => row.map(() => "grass"));
      b.pods = {
        entry: { side: (side + 1) % 4, offset: 0 },
        exit: { side: (side + 2) % 4, offset: size - 1 },
      };
      const pending = { side, offset: size - 1 },
        candidate = { ...b, pods: { ...b.pods, [role]: pending } },
        unblocked = A.accessLayout(s, candidate);
      // Force the canonical layout to choose the alternate booth/cabin side.
      s.buildings.push({
        ...b,
        id: 999,
        kind: "tree",
        x: Math.round(unblocked.cabin.x),
        y: Math.round(unblocked.cabin.y),
        pods: undefined,
      });
      const plan = B.planPod(s, b, role, pending, true);
      assert.equal(plan.error, null);
      const before = structuredClone(s),
        v = view(3),
        normal = context();
      R.draw(normal.ctx, 1520, 860, s, v, 0);
      const hits = structuredClone(v.hitTargets),
        actual = context();
      v.tool = `pod-${role}`;
      v.podEdit = { id: b.id, role, clear: true };
      v.hover = P.podPort(b, size, pending);
      R.draw(actual.ctx, 1520, 860, s, v, 0);
      assert.deepEqual(v.hitTargets, hits, "Ghost geometry cannot intercept clicks");
      assert.deepEqual(s, before, "A pod hover cannot move the actual cabin or alter a save");
      const committed = structuredClone(s),
        committedBuilding = committed.buildings.find((item) => item.id === b.id);
      assert.equal(B.setAccessPod(committed, committedBuilding, role, pending, true), null);
      const layout = A.accessLayout(committed, committedBuilding),
        expected = context(),
        { project, scale } = R.projection(1520, 860, v),
        pose = layout[role];
      expected.ctx.globalAlpha = 0.55;
      const layers = [
        {
          depth: pose.x + pose.y + 0.15,
          draw: () =>
            C.drawAccessPod(
              expected.ctx,
              pose,
              role,
              A.gateMotion(committed, committedBuilding, role),
              project,
              scale,
              boothSide(layout),
            ),
        },
        {
          depth: layout.cabin.x + layout.cabin.y - 0.1,
          draw: () => C.drawAccessCabin(expected.ctx, layout, project, scale, "back", b.open),
        },
        {
          depth: layout.cabin.x + layout.cabin.y + 0.4,
          draw: () => C.drawAccessCabin(expected.ctx, layout, project, scale, "front", b.open),
        },
      ];
      layers.sort((a, b) => a.depth - b.depth).forEach((layer) => layer.draw());
      const geometry = (operations) => operations.map(({ kind, value }) => ({ kind, value }));
      assert(actual.operations.length > 100, "The hover must draw the full pod and cabin");
      assert.deepEqual(
        geometry(actual.operations),
        geometry(expected.operations),
        `${role}, side ${side}: preview geometry differs from committed layout`,
      );
    }
});

console.log(`${passed} access hit/preview tests passed.`);

import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const T = await import(moduleURL("game/track-canvas.ts"));
const M = await import(moduleURL("game/motion.ts"));
const S = await import(moduleURL("game/simulation.ts"));
const Support = await import(moduleURL("game/track-support.ts"));
let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("PASS", name);
  } catch (error) {
    console.error("FAIL", name, error.message);
    process.exit(1);
  }
}
const close = (a, b) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const project = (x, y, z = 0) => ({ x: (x - y) * 24, y: (x + y) * 12 - z * 24 });
const oval = (style = "steel") =>
  Array.from({ length: 81 }, (_, i) => {
    const a = (i / 80) * Math.PI * 2;
    return {
      x: 8 + Math.cos(a) * 5,
      y: 8 + Math.sin(a) * 3,
      z: 1.3 + Math.sin(a) * 0.8,
      smooth: true,
      style,
    };
  });
function canvas() {
  const strokes = [],
    fills = [],
    stack = [];
  let points = [];
  const ctx = {
    strokeStyle: "unchanged-stroke",
    fillStyle: "unchanged-fill",
    lineWidth: 3,
    lineCap: "butt",
    lineJoin: "miter",
    save() {
      stack.push([this.strokeStyle, this.fillStyle, this.lineWidth, this.lineCap, this.lineJoin]);
    },
    restore() {
      [this.strokeStyle, this.fillStyle, this.lineWidth, this.lineCap, this.lineJoin] = stack.pop();
    },
    beginPath() {
      points = [];
    },
    closePath() {},
    moveTo(x, y) {
      assert(Number.isFinite(x + y));
      points.push({ x, y });
    },
    lineTo(x, y) {
      assert(Number.isFinite(x + y));
      points.push({ x, y });
    },
    stroke() {
      assert(Number.isFinite(this.lineWidth) && this.lineWidth > 0);
      strokes.push({ points: [...points], color: this.strokeStyle, width: this.lineWidth });
    },
    fill() {
      fills.push({ points: [...points], color: this.fillStyle });
    },
  };
  return { ctx, strokes, fills, stack };
}
test("Static geometry uses precisely the motion route and remains cached without changing track data", () => {
  const track = oval(),
    original = JSON.stringify(track),
    route = M.prepareRoute(track),
    g = T.trackCanvasGeometry(track);
  assert.equal(T.trackCanvasGeometry(track), g);
  assert.equal(JSON.stringify(track), original);
  const merged = g.spans.flatMap((span, i) => (i ? span.frames.slice(1) : span.frames));
  assert.equal(merged.length, route.points.length);
  merged.forEach((frame, i) => {
    assert.equal(frame.point, route.points[i]);
    assert.equal(frame.right, route.rights[i]);
    assert.equal(frame.up, route.ups[i]);
  });
  assert(
    g.spans.length < route.points.length / 2,
    "Continuous strokes group small motion samples into longer spans",
  );
});
test("Two rails keep a 1.5-metre world gauge perpendicular to the train direction", () => {
  const track = [
      { x: 0, y: 0, z: 0, style: "steel" },
      { x: 4, y: 0, z: 0, style: "steel" },
    ],
    g = T.trackCanvasGeometry(track);
  const { ctx, strokes } = canvas();
  T.drawTrackSpan(ctx, g.spans[0], (x, y) => ({ x, y }), 1);
  const rails = strokes.filter((s) => s.color === S.COASTER_TYPES.steel.color);
  assert.equal(rails.length, 2);
  close(Math.abs(rails[0].points[0].y - rails[1].points[0].y) * 5, 1.5);
  close(rails[0].points[0].x, rails[1].points[0].x);
  for (const frame of g.spans.flatMap((s) => s.frames)) {
    close(Math.hypot(frame.right.x, frame.right.y, frame.right.z), 1);
    close(
      frame.right.x * frame.tangent.x +
        frame.right.y * frame.tangent.y +
        frame.right.z * frame.tangent.z,
      0,
    );
  }
});
test("Curved running rails meet exactly at every span boundary without alternating screen offsets", () => {
  const g = T.trackCanvasGeometry(oval()),
    previous = [];
  for (const span of g.spans) {
    const { ctx, strokes } = canvas();
    T.drawTrackSpan(ctx, span, project, 1);
    const rails = strokes.filter((s) => s.color === S.COASTER_TYPES.steel.color);
    assert.equal(rails.length, 2);
    rails.forEach((rail, side) => {
      if (previous[side]) {
        close(rail.points[0].x, previous[side].x);
        close(rail.points[0].y, previous[side].y);
      }
      previous[side] = rail.points.at(-1);
    });
  }
});
test("Sleepers use one global 1.2-metre interval, independent of tessellation, span or zoom", () => {
  const track = oval(),
    g = T.trackCanvasGeometry(track),
    ties = g.spans.flatMap((s) => s.ties),
    length = M.prepareRoute(track).length;
  close(ties[0].distance, 0.12);
  ties.slice(1).forEach((tie, i) => close(tie.distance - ties[i].distance, 0.24));
  assert(ties.length > 90);
  assert(ties.at(-1).distance <= length);
  const { ctx } = canvas();
  T.trackCanvasLayers(ctx, track, project, 3).forEach((l) => l.draw());
  assert.equal(T.trackCanvasGeometry(track), g);
});
test("Steel foundations, flange plates and timber cross braces are visible grounded geometry", () => {
  const track = oval(),
    base = T.trackCanvasGeometry(track).supports[0];
  const steel = canvas(),
    wood = canvas();
  T.drawTrackSupport(
    steel.ctx,
    { ...base, point: { ...base.point, z: 2 }, style: "steel" },
    project,
    1,
  );
  T.drawTrackSupport(
    wood.ctx,
    { ...base, point: { ...base.point, z: 2 }, style: "wood" },
    project,
    1,
  );
  assert.equal(steel.fills.length, 4);
  assert.equal(wood.fills.length, 4);
  assert(wood.strokes.length > steel.strokes.length, "Tall wood bents need repeated X braces");
  assert(steel.strokes.some((s) => s.color === "#426e70"));
  assert(wood.strokes.some((s) => s.color === S.COASTER_TYPES.wood.color));
  assert(
    T.trackCanvasGeometry(oval("wood")).supports.length >
      T.trackCanvasGeometry(oval("steel")).supports.length,
  );
});
test("Loop frames keep finite distinct rails and never plant a support through inverted track", () => {
  const track = Array.from({ length: 81 }, (_, i) => {
    const a = (i / 80) * Math.PI * 2;
    return {
      x: 4 + Math.sin(a) * 2,
      y: 5,
      z: 2 - Math.cos(a) * 2,
      smooth: true,
      inversion: true,
      style: "launch",
    };
  });
  const g = T.trackCanvasGeometry(track),
    { ctx, strokes } = canvas();
  T.trackCanvasLayers(ctx, track, project, 1).forEach((l) => l.draw());
  assert(g.spans.some((s) => s.frames.some((f) => f.up.z < -0.5)));
  assert(g.supports.every((s) => s.up.z >= 0.3));
  assert(strokes.some((s) => s.color === S.COASTER_TYPES.launch.color));
});
test("Every original sampled rail section is still a selectable centreline", () => {
  const track = oval(),
    route = M.prepareRoute(track),
    hits = [],
    { ctx } = canvas();
  T.trackCanvasLayers(ctx, track, project, 1, { onHit: (a, b) => hits.push([a, b]) }).forEach((l) =>
    l.draw(),
  );
  assert.equal(hits.length, route.points.length - 1);
  hits.forEach(([a, b], i) => {
    const p = route.points[i],
      q = route.points[i + 1];
    assert.deepEqual(a, project(p.x, p.y, p.z));
    assert.deepEqual(b, project(q.x, q.y, q.z));
  });
});
test("Depth layers retain elevations and interleave supports, track and the existing moving trains", () => {
  const track = oval(),
    g = T.trackCanvasGeometry(track),
    { ctx } = canvas(),
    layers = T.trackCanvasLayers(ctx, track, project, 1);
  assert.equal(layers.length, g.spans.length + g.supports.length);
  for (const span of g.spans) {
    const a = span.frames[0].point,
      b = span.frames.at(-1).point;
    close(span.depth, (a.x + a.y + b.x + b.y) / 2 + Math.max(a.z, b.z) * 0.035);
  }
  g.supports.forEach((s) => close(s.depth, s.point.x + s.point.y - 0.02));
});
test("Ghost previews omit physical supports, honor tie visibility and preserve canvas state", () => {
  const track = oval(),
    g = T.trackCanvasGeometry(track),
    { ctx, strokes, fills, stack } = canvas();
  const layers = T.trackCanvasLayers(ctx, track, project, 1, { ghost: true, ties: false });
  assert.equal(layers.length, g.spans.length);
  layers.forEach((l) => l.draw());
  assert.equal(fills.length, 0);
  assert(strokes.some((s) => s.color === "#ffe097"));
  assert.equal(stack.length, 0);
  assert.equal(ctx.strokeStyle, "unchanged-stroke");
  assert.equal(ctx.fillStyle, "unchanged-fill");
  assert.equal(ctx.lineWidth, 3);
});
test("Draft endpoints remain open, zero-length segments are harmless, and redraw is deterministic", () => {
  const a = { x: 1, y: 2, z: 0, style: "steel" },
    b = { x: 4, y: 3, z: 1, style: "steel" };
  const first = canvas(),
    second = canvas(),
    hits = [];
  T.drawTrackSegment(first.ctx, a, b, project, 1, {
    ghost: true,
    onHit: (x, y) => hits.push([x, y]),
  });
  T.drawTrackSegment(second.ctx, a, b, project, 1, { ghost: true });
  assert.deepEqual(first.strokes, second.strokes);
  assert.deepEqual(hits[0][0], project(a.x, a.y, a.z));
  assert.deepEqual(hits.at(-1)[1], project(b.x, b.y, b.z));
  assert.equal(T.trackCanvasGeometry([a, a]).spans.length, 0);
});
test("All pedestrian tile types keep full support and foundation areas clear", () => {
  const park = { tiles: Array.from({ length: 8 }, () => Array(8).fill("grass")) };
  for (const kind of ["path", "queue", "exit"]) {
    park.tiles[3][3] = kind;
    assert.equal(Support.trackSupportClear(park, 3, 3), false);
    assert.equal(
      Support.trackSupportClear(park, 2.11, 3),
      false,
      "A foundation touching the adjacent path is excluded",
    );
    assert.equal(
      Support.trackSupportClear(park, 2.09, 3),
      true,
      "An actually clear footing remains available",
    );
    assert.equal(Support.trackSupportClear(park, 5, 5), true);
  }
});
test("Painting a path removes its cached support layers immediately without removing rail", () => {
  const track = oval(),
    g = T.trackCanvasGeometry(track),
    park = { tiles: Array.from({ length: 18 }, () => Array(18).fill("grass")) },
    { ctx, fills } = canvas(),
    options = { groundPath: (x, y) => Support.groundPathAt(park, x, y) };
  const before = T.trackCanvasLayers(ctx, track, project, 1, options);
  const support = g.supports[0];
  park.tiles[Math.round(support.point.y)][Math.round(support.point.x)] = "path";
  const after = T.trackCanvasLayers(ctx, track, project, 1, options);
  assert(after.length < before.length);
  assert(after.length >= g.spans.length);
  assert.equal(
    T.trackCanvasGeometry(track),
    g,
    "Terrain filtering must not use a stale geometry cache",
  );
  const pathsOnly = T.trackCanvasLayers(ctx, track, project, 1, { groundPath: () => true });
  assert.equal(pathsOnly.length, g.spans.length);
  pathsOnly.forEach((layer) => layer.draw());
  assert.equal(fills.length, 0, "No support footings on a pedestrian surface");
});
console.log(`${passed}/${passed} track canvas tests passed`);

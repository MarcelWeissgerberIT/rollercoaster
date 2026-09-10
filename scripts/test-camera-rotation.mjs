import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const R = await import(moduleURL("game/render.ts"));
const C = await import(moduleURL("game/camera.ts"));
const S = await import(moduleURL("game/simulation.ts"));
const K = await import(moduleURL("game/construction.ts"));
let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log("PASS " + name);
};
const near = (a, b) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const W = 1613,
  H = 947;
const initial = { zoom: 2.3, panX: -412, panY: 182, cameraTurn: 0 };
test("Four turns preserve exact viewed ground point, zoom and original pan", () => {
  const anchor = { x: 963.3, y: 486.7 };
  let v = { ...initial };
  const world = R.projection(W, H, v).worldAt(anchor.x, anchor.y);
  for (let i = 1; i <= 4; i++) {
    v = C.rotateCameraAt(v, W, H, 1, anchor);
    assert.equal(v.cameraTurn, i % 4);
    assert.equal(v.zoom, initial.zoom);
    const q = R.projection(W, H, v).project(world.x, world.y);
    near(q.x, anchor.x);
    near(q.y, anchor.y);
  }
  near(v.panX, initial.panX);
  near(v.panY, initial.panY);
});
test("Left then right returns camera while camera coordinates never mutate park", () => {
  const park = S.newPark("waldhain"),
    before = JSON.stringify(park);
  const left = C.rotateCameraAt(initial, W, H, -1),
    back = C.rotateCameraAt(left, W, H, 1);
  assert.equal(left.cameraTurn, 3);
  near(back.panX, initial.panX);
  near(back.panY, initial.panY);
  assert.equal(JSON.stringify(park), before);
});
test("Ground selection round-trips on expanded maps at every view and zoom", () => {
  for (const turn of [0, 1, 2, 3])
    for (const zoom of [0.55, 1, 5]) {
      const p = R.projection(W, H, { ...initial, cameraTurn: turn, zoom });
      for (const [x, y] of [
        [0, 0],
        [29, 29],
        [15, 29],
        [61, 7],
        [7, 61],
        [45, 52],
      ]) {
        const q = p.project(x, y);
        assert.deepEqual(p.unproject(q.x, q.y), { x, y });
      }
    }
});
test("Building a path in a rotated view changes the selected world tile only", () => {
  for (const turn of [0, 1, 2, 3]) {
    const park = S.newPark("sandbox");
    park.buildings = [];
    park.cash = 1000;
    park.tiles = park.tiles.map((row) => row.map(() => "grass"));
    const view = R.projection(W, H, { ...initial, cameraTurn: turn });
    const pixel = view.project(8, 12),
      tile = view.unproject(pixel.x, pixel.y);
    K.place(park, "path", tile);
    assert.equal(park.tiles[12][8], "path");
    assert.equal(park.tiles.flat().filter((t) => t === "path").length, 1);
  }
});
test("Eye framing uses rotated attraction bounds and retains orientation", () => {
  const park = S.newPark("waldhain"),
    b = park.buildings.find((b) => b.kind === "coaster");
  const rect = { left: 420, right: 1550, top: 115, bottom: 815 };
  for (const turn of [0, 1, 2, 3]) {
    const v = C.focusBuildingCamera(park, b, { ...initial, cameraTurn: turn }, W, H, rect);
    assert.equal(v.cameraTurn, turn);
    const bounds = C.buildingVisualBounds(park, b, turn),
      scale = R.projection(W, H, v).scale;
    for (const x of [bounds.left, bounds.right])
      for (const y of [bounds.top, bounds.bottom]) {
        const sx = W * 0.53 + v.panX + x * scale,
          sy = H * 0.43 + v.panY + y * scale;
        assert(sx >= rect.left - 1e-7 && sx <= rect.right + 1e-7);
        assert(sy >= rect.top - 1e-7 && sy <= rect.bottom + 1e-7);
      }
  }
});
test("Zoom preserves pointer ground position after quarter turns", () => {
  const anchor = { x: 1291, y: 621 };
  for (const turn of [1, 2, 3]) {
    const v = { ...initial, cameraTurn: turn },
      p = R.projection(W, H, v).worldAt(anchor.x, anchor.y);
    const next = { ...v, ...C.zoomCameraAt(v, W, H, 3.7, anchor) },
      q = R.projection(W, H, next).project(p.x, p.y);
    near(q.x, anchor.x);
    near(q.y, anchor.y);
    assert.equal(next.cameraTurn, turn);
  }
});
console.log(`${passed}/${passed} camera rotation tests passed`);

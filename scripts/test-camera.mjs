import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
process.on("uncaughtException", (error) => {
  console.error(error.message);
  process.exit(1);
});
const S = await import(moduleURL("game/simulation.ts")),
  C = await import(moduleURL("game/camera.ts")),
  R = await import(moduleURL("game/render.ts")),
  M = await import(moduleURL("game/motion.ts"));
const tests = [];
const test = (name, run) => {
  try {
    run();
    tests.push({ name, pass: true });
  } catch (error) {
    tests.push({ name, pass: false, error: error.message });
  }
};
const view = { zoom: 1.4, panX: -381, panY: 126 };
function fixture(kind = "wheel", x = 16, y = 12) {
  const park = S.newPark("sandbox"),
    building = {
      ...park.buildings.find((b) => b.kind === "wheel"),
      id: 901,
      kind,
      x,
      y,
      track: undefined,
      pods: undefined,
    };
  park.buildings = [building];
  return { park, building };
}
function inRect(point, rect, message = "Visible attraction is covered by an overlay") {
  assert(
    point.x >= rect.left - 1e-7 &&
      point.x <= rect.right + 1e-7 &&
      point.y >= rect.top - 1e-7 &&
      point.y <= rect.bottom + 1e-7,
    `${message}: ${JSON.stringify(point)}`,
  );
}
function assertFrame(park, building, width, height, rect) {
  const before = JSON.stringify(park),
    target = C.focusBuildingCamera(park, building, view, width, height, rect),
    bounds = C.buildingVisualBounds(park, building),
    scale = R.projection(width, height, target).scale;
  assert.equal(JSON.stringify(park), before, "Framing mutated the simulation");
  for (const x of [bounds.left, bounds.right])
    for (const y of [bounds.top, bounds.bottom])
      inRect(
        { x: width * 0.53 + target.panX + x * scale, y: height * 0.43 + target.panY + y * scale },
        rect,
      );
  assert(
    Math.abs(
      width * 0.53 +
        target.panX +
        ((bounds.left + bounds.right) / 2) * scale -
        (rect.left + rect.right) / 2,
    ) < 1e-7,
  );
  assert(
    Math.abs(
      height * 0.43 +
        target.panY +
        ((bounds.top + bounds.bottom) / 2) * scale -
        (rect.top + rect.bottom) / 2,
    ) < 1e-7,
  );
  assert(target.zoom >= C.MIN_ZOOM && target.zoom <= C.MAX_ZOOM);
  return target;
}

test("Zoom reaches 500% and clamps malformed/extreme inputs", () => {
  assert.equal(C.MAX_ZOOM, 5);
  assert.equal(C.MIN_ZOOM, 0.55);
  assert.equal(C.clampZoom(12), 5);
  assert.equal(C.clampZoom(-3), 0.55);
  for (const value of [NaN, Infinity, -Infinity]) assert.equal(C.clampZoom(value), 1);
});

test("Eye focus gives a small shop a genuine close view", () => {
  const { park, building } = fixture("hotdog"),
    target = assertFrame(park, building, 1920, 1080, {
      left: 422,
      right: 1580,
      top: 116,
      bottom: 928,
    });
  assert.equal(target.zoom, 5, "Small objects should use the newly available close zoom");
});

test("Wheel top, cabins and ground fit between both sidebars", () => {
  const { park, building } = fixture(),
    rect = { left: 410, right: 1010, top: 110, bottom: 736 },
    target = assertFrame(park, building, 1365, 900, rect),
    p = R.projection(1365, 900, target),
    center = p.project(building.x + 1, building.y + 1);
  inRect({ x: center.x, y: center.y - 184 * p.scale }, rect, "Wheel top cropped");
  inRect({ x: center.x, y: center.y + 36 * p.scale }, rect);
});

test("Drop tower is framed above its anchor on a short laptop viewport", () => {
  const { park, building } = fixture("drop"),
    rect = { left: 395, right: 1035, top: 90, bottom: 595 },
    target = assertFrame(park, building, 1280, 720, rect),
    p = R.projection(1280, 720, target),
    center = p.project(building.x + 0.5, building.y + 0.5);
  inRect({ x: center.x, y: center.y - 208 * p.scale }, rect, "Tower top cropped");
});

test("Swinging pirate ship remains inside the focus through a full cycle", () => {
  const { park, building } = fixture("pirate"),
    rect = { left: 400, right: 1420, top: 112, bottom: 844 },
    target = assertFrame(park, building, 1720, 980, rect),
    p = R.projection(1720, 980, target),
    n = S.CATALOG.pirate.size,
    pivot = p.project(building.x + (n - 1) / 2, building.y + (n - 1) / 2, 114 / 24);
  for (let i = 0; i <= 200; i++) {
    const angle = -0.9 + (i * 1.8) / 200;
    for (const x of [-72, 72])
      for (const y of [-16, 128])
        inRect(
          {
            x: pivot.x + (x * Math.cos(angle) - y * Math.sin(angle)) * p.scale,
            y: pivot.y + (x * Math.sin(angle) + y * Math.cos(angle)) * p.scale,
          },
          rect,
          "Moving boat cropped",
        );
  }
});

test("Tall coaster loop, rotating cars, supports and station all fit", () => {
  const { park, building } = fixture("coaster"),
    rect = { left: 405, right: 1295, top: 100, bottom: 790 };
  building.track = [
    { x: 16, y: 12, z: 0, style: "steel", smooth: true },
    ...Array.from({ length: 41 }, (_, i) => {
      const a = (i * Math.PI * 2) / 40;
      return {
        x: 18 + i / 15,
        y: 15 + Math.sin(a) * 2.4,
        z: 1 + (1 - Math.cos(a)) * 5,
        smooth: true,
      };
    }),
    { x: 25, y: 19, z: 2, smooth: true },
    { x: 19, y: 23, z: 0, smooth: true },
    { x: 16, y: 12, z: 0, smooth: true },
  ];
  const target = assertFrame(park, building, 1600, 940, rect),
    p = R.projection(1600, 940, target);
  for (const point of M.prepareRoute(building.track).points) {
    const high = p.project(point.x, point.y, point.z);
    inRect({ x: high.x, y: high.y - 38 * p.scale }, rect, "Loop rider cropped");
    inRect(p.project(point.x, point.y), rect, "Support foot cropped");
  }
  assert(target.zoom < 2, "Tall loops must zoom out enough to show the full ride");
});

test("Expanded park location does not bias framing toward the original map center", () => {
  const { park, building } = fixture("coaster", 78, 73),
    rect = { left: 400, right: 1690, top: 108, bottom: 998 };
  park.tiles = Array.from({ length: 96 }, () => Array(96).fill("grass"));
  building.track = [
    { x: 78, y: 73, z: 0 },
    { x: 92, y: 73, z: 5 },
    { x: 92, y: 88, z: 0 },
    { x: 78, y: 88, z: 1 },
    { x: 78, y: 73, z: 0 },
  ];
  const target = assertFrame(park, building, 2048, 1200, rect);
  assert(target.panY < -1000, "Camera did not travel to the expanded park");
});

test("Every ride, habitat and shop gets a finite frame on compact and large screens", () => {
  for (const kind of Object.keys(S.CATALOG)) {
    const { park, building } = fixture(kind);
    for (const [width, height] of [
      [390, 844],
      [3444, 1908],
    ]) {
      const target = C.focusBuildingCamera(park, building, view, width, height, {
        left: 12,
        right: width - 12,
        top: 110,
        bottom: height - 180,
      });
      assert(Object.values(target).every(Number.isFinite), `${kind} generated a non-finite target`);
      assert(target.zoom >= C.MIN_ZOOM && target.zoom <= C.MAX_ZOOM);
    }
  }
});

test("Mouse zoom preserves the exact projected world point, including elevation", () => {
  for (const [w, h] of [
    [390, 844],
    [1365, 768],
    [3444, 1908],
  ]) {
    for (const desired of [0.55, 2.7, 5, 20]) {
      const anchor = R.projection(w, h, view).project(23.2, 15.8, 6.3),
        target = C.zoomCameraAt(view, w, h, desired, anchor),
        after = R.projection(w, h, target).project(23.2, 15.8, 6.3);
      assert(
        Math.hypot(after.x - anchor.x, after.y - anchor.y) < 1e-8,
        "Cursor jumped away from selected world point",
      );
    }
  }
});

test("Zoom limits do not cause pan drift on repeated button presses", () => {
  for (const zoom of [C.MIN_ZOOM, C.MAX_ZOOM]) {
    let camera = { ...view, zoom };
    for (let i = 0; i < 20; i++)
      camera = C.zoomCameraAt(camera, 1280, 720, zoom === C.MIN_ZOOM ? -1 : 20, { x: 933, y: 466 });
    assert(Math.abs(camera.panX - view.panX) < 1e-8 && Math.abs(camera.panY - view.panY) < 1e-8);
  }
});

test("Zero-size transitions, corrupt drafts and invalid safe areas remain finite", () => {
  const { park, building } = fixture("coaster");
  building.track = [{ x: NaN, y: 3, z: Infinity }];
  const invalidView = { zoom: NaN, panX: Infinity, panY: -Infinity };
  for (const target of [
    C.focusBuildingCamera(park, building, invalidView, 0, 0, {
      left: 500,
      right: 100,
      top: NaN,
      bottom: Infinity,
    }),
    C.zoomCameraAt(invalidView, 0, 0, Infinity, { x: NaN, y: Infinity }),
  ])
    assert(Object.values(target).every(Number.isFinite));
});

for (const result of tests)
  console.log(
    `${result.pass ? "PASS" : "FAIL"} ${result.name}${result.error ? `: ${result.error}` : ""}`,
  );
console.log(`${tests.filter((t) => t.pass).length}/${tests.length} camera checks passed`);
if (tests.some((t) => !t.pass)) process.exit(1);

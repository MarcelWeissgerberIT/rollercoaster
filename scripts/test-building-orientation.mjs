import assert from "node:assert/strict";
import * as THREE from "three";
import { moduleURL } from "./ts-loader.mjs";

const S = await import(moduleURL("game/simulation.ts"));
const C = await import(moduleURL("game/construction.ts"));
const O = await import(moduleURL("game/building-orientation.ts"));
const L = await import(moduleURL("game/park-life.ts"));
const F = await import(moduleURL("game/furniture.ts"));
const M = await import(moduleURL("game/furniture-model.ts"));
const FG = await import(moduleURL("game/furniture-guest.ts"));
const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, pass: true });
  } catch (error) {
    results.push({ name, pass: false, error: error.message });
  }
  console.log(JSON.stringify(results.at(-1)));
}
const near = (actual, expected) =>
  assert(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
function fixture() {
  const park = S.newPark("sandbox");
  const building = park.buildings.find((b) => b.kind === "bench");
  assert(building);
  return { park, building };
}

test("Rotation is offered only for actual directional geometry", () => {
  for (const kind of ["coaster", "bench", "picnic"]) assert(O.supportsBuildingRotation(kind));
  for (const kind of ["wheel", "burger", "lion", "bin", "tree", "train", "carousel"])
    assert(!O.supportsBuildingRotation(kind));
});
test("Quarter-turn relocation previews are pure, compose, and survive save/load", () => {
  const { park, building } = fixture();
  const before = JSON.stringify(park);
  const preview = C.planRelocation(park, building, building, 1);
  assert.equal(preview.error, null);
  assert.equal(preview.geometry.orientation, 1);
  assert(preview.changed);
  assert.equal(JSON.stringify(park), before);
  for (const turn of [1, 1, 1, 1])
    assert.equal(C.adjustBuilding(park, building, "move", building, turn), null);
  assert.equal(building.orientation, 0);
  assert.equal(C.planRelocation(park, building, building, 4).changed, false);
  assert.equal(C.adjustBuilding(park, building, "move", building, -1), null);
  assert.equal(building.orientation, 3);
  const loaded = JSON.parse(JSON.stringify(park));
  assert(S.validSave(loaded));
  assert.equal(loaded.buildings.find((b) => b.id === building.id).orientation, 3);
});
test("Undo restores furniture direction without rewinding the park clock or earnings", () => {
  const { park, building } = fixture();
  const previous = building.orientation;
  const record = C.recordEdit(park, "Bank drehen", () => {
    assert.equal(C.adjustBuilding(park, building, "move", building, 1), null);
  });
  assert(record?.geometry.some((g) => g.id === building.id));
  park.time += 12;
  building.revenue += 5;
  const time = park.time;
  assert.equal(C.undoEdits(park, [record]), null);
  assert.equal(building.orientation, previous);
  assert.equal(park.time, time);
  assert.equal(building.revenue, 5);
});
test("Invalid fractional/out-of-range orientations are rejected and legacy saves default to zero", () => {
  const { park, building } = fixture();
  delete building.orientation;
  assert.equal(O.buildingOrientation(building), 0);
  assert(S.validSave(park));
  for (const orientation of [-1, 4, 0.5, NaN, "1", null]) {
    building.orientation = orientation;
    assert(!S.validSave(park), `Rejected ${String(orientation)}`);
  }
});
test("Every occupied bench and picnic seat rotates with the furniture and faces its new direction", () => {
  const { building } = fixture();
  for (const kind of ["bench", "picnic"]) {
    building.kind = kind;
    for (let slot = 0; slot < (kind === "bench" ? 2 : 4); slot++) {
      const guest = { rest: { slot, remaining: 20 } };
      building.orientation = 0;
      const original = L.restPose(building, guest, 0);
      for (let orientation = 0; orientation < 4; orientation++) {
        building.orientation = orientation;
        const pose = L.restPose(building, guest, 5);
        const expected = O.furniturePoint(
          building,
          original.x - building.x,
          original.y - building.y,
        );
        near(pose.x, expected.x);
        near(pose.y, expected.y);
        near(pose.yaw, original.yaw - (orientation * Math.PI) / 2);
        assert.equal(pose.height, original.height);
        assert(pose.seated);
      }
    }
  }
});
test("3D slats/supports rotate into the same tile frame as their occupied seats", () => {
  const { building } = fixture();
  const cube = new THREE.BoxGeometry(1, 1, 1),
    material = new THREE.MeshBasicMaterial();
  for (const kind of ["bench", "picnic"]) {
    building.kind = kind;
    for (let orientation = 0; orientation < 4; orientation++) {
      building.orientation = orientation;
      const model = M.createFurnitureModel(building, cube, () => material);
      model.updateMatrixWorld(true);
      assert.equal(model.children.length, F.furnitureParts(kind).length);
      for (const [index, part] of F.furnitureParts(kind).entries()) {
        const actual = model.children[index].getWorldPosition(new THREE.Vector3());
        const expected = O.furniturePoint(building, part.x / 5, part.y / 5);
        near(actual.x, expected.x * 5);
        near(actual.z, expected.y * 5);
        near(actual.y, part.z);
      }
    }
  }
  cube.dispose();
  material.dispose();
});
test("Canvas furniture uses detailed geometry and matching clickable faces in every direction", () => {
  const { building } = fixture();
  const ctx = {
    globalAlpha: 1,
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {},
    stroke() {},
  };
  const project = (x, y) => ({ x: (x - y) * 24, y: (x + y) * 12 });
  const drawings = [];
  for (let orientation = 0; orientation < 4; orientation++) {
    building.orientation = orientation;
    const polygons = F.drawFurniture(ctx, building, project, 1);
    assert(polygons.length > 30);
    assert(
      polygons.every(
        (face) =>
          face.length === 4 && face.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
      ),
    );
    drawings.push(JSON.stringify(polygons));
  }
  assert.equal(new Set(drawings).size, 4);
});
test("Seated adults and children share a real cushion surface with natural low furniture heights", () => {
  const { building } = fixture();
  for (const kind of ["bench", "picnic"]) {
    building.kind = kind;
    const parts = F.furnitureParts(kind);
    assert(
      Math.max(...parts.map((p) => p.z + p.height / 2)) < 1,
      "Furniture stays below one metre",
    );
    for (let slot = 0; slot < (kind === "bench" ? 2 : 4); slot++) {
      const seat = F.furnitureSeat(kind, slot);
      assert(seat.height >= 0.44 && seat.height <= 0.52);
      // A person's hips span adjacent slats; the center can sit over the
      // intentional drainage gap. Check the contact area for both body sizes.
      for (const bodyScale of [1, 0.7]) {
        const width = 0.34 * bodyScale,
          depth = 0.24 * bodyScale;
        const supportedArea = parts.reduce((area, p) => {
          if (Math.abs(p.z + p.height / 2 - seat.height) > 1e-7) return area;
          const overlapX = Math.max(
            0,
            Math.min(seat.x + width / 2, p.x + p.width / 2) -
              Math.max(seat.x - width / 2, p.x - p.width / 2),
          );
          const overlapY = Math.max(
            0,
            Math.min(seat.y + depth / 2, p.y + p.depth / 2) -
              Math.max(seat.y - depth / 2, p.y - p.depth / 2),
          );
          return area + overlapX * overlapY;
        }, 0);
        assert(
          supportedArea / (width * depth) >= 0.65,
          "Hips need real wooden support below their footprint",
        );
      }
      for (const ageGroup of ["adult", "child"])
        for (let orientation = 0; orientation < 4; orientation++) {
          building.orientation = orientation;
          const pose = L.restPose(
            building,
            { id: 1, skin: 0, ageGroup, rest: { slot, remaining: 10 } },
            0,
          );
          const world = O.furniturePoint(building, seat.x / 5, seat.y / 5);
          near(pose.x, world.x);
          near(pose.y, world.y);
          near(pose.height, seat.height);
        }
    }
  }
});
test("Furniture guests retain the full seated legs and scale around their hip anchor", () => {
  const draws = [],
    scales = [],
    anchors = [],
    image = { naturalWidth: 80, naturalHeight: 96, complete: false };
  const ctx = {
    save() {},
    restore() {},
    translate(x, y) {
      anchors.push([x, y]);
    },
    scale(x, y) {
      scales.push([x, y]);
    },
    drawImage(...args) {
      draws.push(args);
    },
  };
  for (const ageGroup of ["adult", "child"])
    FG.drawFurnitureGuest(ctx, image, { id: 1, skin: 0, ageGroup }, 50, 70, 2);
  assert(
    draws.every((args) => args[4] === 96),
    "All 96 source rows are retained, including feet",
  );
  assert.deepEqual(
    anchors,
    [
      [50, 70],
      [50, 70],
    ],
    "Children sit on the same physical cushion",
  );
  assert(scales[1][0] < scales[0][0]);
});
if (results.some((r) => !r.pass)) process.exitCode = 1;
else console.log(`PASS ${results.length}/${results.length} building orientation checks`);

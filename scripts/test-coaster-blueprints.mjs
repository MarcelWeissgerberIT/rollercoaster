import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const S = await import(moduleURL("game/simulation.ts")),
  P = await import(moduleURL("game/prefabs.ts")),
  B = await import(moduleURL("game/coaster-blueprints.ts")),
  C = await import(moduleURL("game/construction.ts")),
  L = await import(moduleURL("game/track-limits.ts")),
  M = await import(moduleURL("game/motion.ts")),
  V = await import(moduleURL("game/ride-path.ts")),
  N = await import(moduleURL("game/new-game.ts")),
  T = await import(moduleURL("game/terrain.ts")),
  U = await import(moduleURL("game/coaster-tunnels.ts"));
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log("PASS", name);
  } catch (error) {
    failed++;
    console.error("FAIL", name, error.stack);
  }
}
function empty() {
  const park = S.newPark("sandbox");
  park.buildings = [];
  park.guests = [];
  park.terrain = {};
  park.tiles = Array.from({ length: 30 }, () => Array(30).fill("grass"));
  park.cash = 1e6;
  return park;
}
function fitted(style, id, rotation = 0) {
  const preview = P.prefabBlueprint({ x: 0, y: 0 }, rotation, style, id),
    footprint = S.trackFootprint(preview),
    origin = {
      x: 1 - Math.min(...footprint.map((p) => p.x)),
      y: 1 - Math.min(...footprint.map((p) => p.y)),
    };
  return { origin, track: P.prefabBlueprint(origin, rotation, style, id) };
}

test("All five styles expose four distinct, closed templates with style-aware category metadata", () => {
  assert.equal(new Set(B.COASTER_BLUEPRINTS.map((b) => b.id)).size, B.COASTER_BLUEPRINTS.length);
  for (const style of Object.keys(S.COASTER_TYPES)) {
    const options = B.coasterBlueprints(style),
      shapes = new Set();
    assert(options.length >= 3, style);
    assert.deepEqual(
      options.map((b) => b.category),
      ["compact", "scenic", "thrill", "extreme"],
    );
    for (const option of options) {
      assert(option.name && option.description && option.intensity);
      assert(option.styles.includes(style));
      const preview = B.coasterBlueprintPreview(style, option.id);
      assert.deepEqual(preview, P.prefabBlueprint({ x: 0, y: 0 }, 0, style, option.id));
      assert.deepEqual(preview[0], preview.at(-1));
      assert(P.isClosedTrack(preview));
      shapes.add(JSON.stringify(preview.map((p) => [p.x, p.y])));
    }
    assert.equal(shapes.size, options.length, style);
  }
  assert.equal(B.coasterBlueprints("launch").find((b) => b.id === "panorama").intensity, "Hoch");
  assert.equal(B.coasterBlueprints("wood").find((b) => b.id === "extreme").intensity, "Hoch");
});

test("Every template validates, fits a 30×30 park and places at the quoted cost in all rotations", () => {
  for (const style of Object.keys(S.COASTER_TYPES))
    for (const option of B.coasterBlueprints(style))
      for (let rotation = 0; rotation < 4; rotation++) {
        const park = empty(),
          { origin, track } = fitted(style, option.id, rotation),
          label = `${style}/${option.id}/${rotation}`;
        assert.equal(S.validateTrack(park, track), null, label);
        assert.equal(P.pieceError(park, [track[0]], track, true), null, label);
        const plan = C.planPlacement(park, "coaster", origin, track),
          before = park.cash;
        assert.equal(plan.error, null, label);
        assert.equal(plan.cost, S.trackCost(track));
        const result = C.place(park, "coaster", origin, track);
        assert(result.id, `${label}: ${result.error}`);
        assert.equal(before - park.cash, plan.cost);
        assert(S.validSave(JSON.parse(JSON.stringify(park))), label);
      }
});

test("Templates respect style heights and inversions; extreme layouts are substantially larger", () => {
  for (const style of Object.keys(S.COASTER_TYPES)) {
    const classic = B.coasterBlueprintPreview(style),
      extreme = B.coasterBlueprintPreview(style, "extreme");
    assert(S.trackStats(extreme).length > S.trackStats(classic).length * 2, style);
    assert.equal(Math.max(...extreme.map((p) => p.z)), L.coasterMaxHeight(style), style);
    for (const option of B.coasterBlueprints(style)) {
      const track = B.coasterBlueprintPreview(style, option.id);
      assert(track.length <= 2048);
      assert(track.every((p) => p.style === style && p.smooth && p.z >= 0));
      assert(track.every((p) => p.z <= L.coasterMaxHeight(style)));
      if (!S.COASTER_TYPES[style].loop)
        assert(
          track.every((p) => !p.inversion),
          style,
        );
      if (S.COASTER_TYPES[style].loop && ["twister", "extreme"].includes(option.id))
        assert(
          track.some((p) => p.inversion),
          style,
        );
    }
  }
});

test("Rotation and translation preserve the exact track, station height and segment lengths", () => {
  for (const style of Object.keys(S.COASTER_TYPES))
    for (const option of B.coasterBlueprints(style)) {
      const source = P.prefabBlueprint({ x: 0, y: 0, z: 1 }, 0, style, option.id);
      for (let rotation = 0; rotation < 4; rotation++) {
        const track = P.prefabBlueprint({ x: 13, y: 17, z: 1 }, rotation, style, option.id);
        assert.equal(source.length, track.length);
        for (let i = 0; i < track.length; i++) {
          let { x, y } = source[i];
          for (let r = 0; r < rotation; r++) [x, y] = [-y, x];
          assert(Math.abs(track[i].x - 13 - x) < 1e-6);
          assert(Math.abs(track[i].y - 17 - y) < 1e-6);
          assert.equal(track[i].z, source[i].z);
          assert(
            Math.cos(track[i].heading - source[i].heading - (rotation * Math.PI) / 2) > 0.99999,
          );
        }
        const last = track.at(-1),
          prev = track.at(-2);
        assert(Math.hypot(last.x - prev.x, last.y - prev.y, last.z - prev.z) < 0.3);
        assert(Math.cos(Math.atan2(last.y - prev.y, last.x - prev.x) - last.heading) > 0.995);
      }
    }
});

test("Catalog tracks produce finite simulation positions, speeds and forces for an entire ride", () => {
  for (const style of Object.keys(S.COASTER_TYPES))
    for (const option of B.coasterBlueprints(style)) {
      const track = B.coasterBlueprintPreview(style, option.id),
        route = M.prepareRoute(track),
        stats = S.trackStats(track);
      assert(Number.isFinite(route.duration) && route.duration > 0);
      assert(route.speeds.every((speed) => Number.isFinite(speed) && speed >= 0));
      assert(Object.values(stats).every((value) => Number.isFinite(Number(value))));
      for (let progress = 0; progress <= 1; progress += 0.01) {
        const position = M.routePosition(route, M.trainDistance(route, progress));
        assert([position.x, position.y, position.z].every(Number.isFinite));
      }
    }
});

test("Added inversion layouts power their approaches and clear loop tops without crawling", () => {
  for (const style of ["steel", "launch", "inverted"])
    for (const id of ["twister", "extreme"]) {
      const track = B.coasterBlueprintPreview(style, id),
        route = M.prepareRoute(track);
      assert(track.some((p) => p.drive?.kind === "boost"));
      assert(S.trackCost(track) > S.trackCost(track.map(({ drive, ...p }) => p)));
      route.points.forEach((point, i) => {
        if (point.inversion) assert(route.speeds[i] >= 8, `${style}/${id}: loop crawl`);
        if (route.phases[i] === "coast")
          assert(route.speeds[i] > 2.1, `${style}/${id}: coast crawl`);
      });
    }
});

test("3D ride frames complete every template with forward progress and continuous orientation", () => {
  for (const style of Object.keys(S.COASTER_TYPES))
    for (const { id } of B.coasterBlueprints(style)) {
      const path = V.makeRidePath(B.coasterBlueprintPreview(style, id));
      let previous = path.at(0),
        progress = 0;
      for (let time = 1 / 60; time <= path.duration; time += 1 / 60) {
        const nextProgress = path.progress(time),
          frame = path.at(nextProgress);
        assert(nextProgress > progress, `${style}/${id}: no forward progress`);
        assert(frame.position.toArray().every(Number.isFinite));
        assert(frame.quaternion.toArray().every(Number.isFinite));
        assert(frame.position.distanceTo(previous.position) < 1, `${style}/${id}: position jump`);
        assert(previous.quaternion.angleTo(frame.quaternion) < Math.PI / 6, `${style}/${id}: spin`);
        previous = frame;
        progress = nextProgress;
      }
      assert.equal(path.progress(path.duration), 1);
    }
});

test("All templates integrate with seeded natural terrain, derived tunnels and save/load", () => {
  const source = N.createLandscapePark("sandbox", "waldhain", 7712);
  let tunneled = 0;
  for (const style of Object.keys(S.COASTER_TYPES))
    for (const { id } of B.coasterBlueprints(style)) {
      let placed = false;
      rotations: for (let rotation = 0; rotation < 4; rotation++) {
        const preview = P.prefabBlueprint({ x: 0, y: 0 }, rotation, style, id),
          footprint = S.trackFootprint(preview),
          minX = Math.min(...footprint.map((p) => p.x)),
          maxX = Math.max(...footprint.map((p) => p.x)),
          minY = Math.min(...footprint.map((p) => p.y)),
          maxY = Math.max(...footprint.map((p) => p.y));
        for (let y = -minY; y < 30 - maxY; y++)
          for (let x = -minX; x < 30 - maxX; x++) {
            if (T.terrainHeight(source, x, y) > (preview[0].z ?? 0)) continue;
            if (footprint.some((p) => source.tiles[p.y + y]?.[p.x + x] !== "grass")) continue;
            const track = P.prefabBlueprint({ x, y }, rotation, style, id);
            if (C.planPlacement(source, "coaster", { x, y }, track, true).error) continue;
            const park = structuredClone(source),
              result = C.place(park, "coaster", { x, y }, track, true);
            assert(result.id, `${style}/${id}: ${result.error}`);
            const layout = U.parkCoasterTunnels(park);
            assert.equal(
              U.parkCoasterTunnels(park),
              layout,
              "Unchanged terrain should reuse tunnel geometry",
            );
            for (const span of layout.spans) {
              assert(span.end > span.start);
              assert(span.frames.length > 1);
              assert(
                span.frames.every((frame) => [frame.x, frame.y, frame.z].every(Number.isFinite)),
              );
            }
            if (layout.spans.length) tunneled++;
            const restored = JSON.parse(JSON.stringify(park));
            assert(S.validSave(restored));
            assert.equal(U.parkCoasterTunnels(restored).spans.length, layout.spans.length);
            placed = true;
            break rotations;
          }
      }
      assert(placed, `${style}/${id}: no natural-terrain placement`);
    }
  assert(tunneled >= 15, "The integration fixture must exercise buried track for most templates");
});

test("Park placement follows station ground, shares preview geometry and retains style height limits", () => {
  for (const style of Object.keys(S.COASTER_TYPES))
    for (const { id } of B.coasterBlueprints(style)) {
      const park = empty(),
        point = { x: 10, y: 10 };
      park.tiles = Array.from({ length: 54 }, () => Array(54).fill("grass"));
      park.terrain = { "10,10": 2 };
      const origin = B.coasterStationOrigin(park, point, style),
        preview = B.coasterBlueprintAtPark(park, point, 0, style, id),
        commit = B.coasterBlueprintAtPark(park, point, 0, style, id);
      assert.equal(origin.z, 2 + (style === "inverted" ? 1 : 0));
      assert.equal(preview[0].z, origin.z);
      assert(!U.coasterPointBuried(park, preview[0]));
      assert(preview.every((p) => p.z <= L.coasterMaxHeight(style)));
      assert.deepEqual(preview, commit);
      const plan = C.planPlacement(park, "coaster", point, preview),
        before = park.cash,
        built = C.place(park, "coaster", point, commit);
      assert.equal(plan.error, null, `${style}/${id}`);
      assert(built.id, `${style}/${id}: ${built.error}`);
      assert.equal(before - park.cash, plan.cost);
      assert.deepEqual(park.buildings.find((b) => b.id === built.id).track, preview);
    }
  for (const style of Object.keys(S.COASTER_TYPES)) {
    const park = empty(),
      point = { x: 8, y: 8 },
      maximum = L.coasterMaxHeight(style);
    park.terrain = { "8,8": maximum - (style === "inverted" ? 2 : 1) };
    const track = B.coasterBlueprintAtPark(park, point, 0, style, "classic");
    assert.equal(track[0].z, maximum - 1);
    assert(
      track.every((p) => p.z <= maximum),
      style,
    );
    assert.deepEqual(track[0], track.at(-1));
    park.terrain = { "8,8": maximum + 1 };
    const tooHigh = B.coasterBlueprintAtPark(park, point, 0, style, "extreme");
    assert(tooHigh[0].z > maximum, "Do not sink a station below impossible ground");
    assert(S.validateTrack(park, tooHigh));
    park.terrain = { "8,8": -2 };
    assert.equal(B.coasterStationOrigin(park, point, style).z, style === "inverted" ? 1 : 0);
  }
});

test("Obstacle, park edge and budget failures reject new layouts atomically", () => {
  for (const mode of ["water", "building", "bounds", "budget"])
    for (const id of ["panorama", "twister", "extreme"]) {
      const park = empty(),
        { origin, track } = fitted("steel", id);
      if (mode === "water") park.tiles[origin.y][origin.x] = "water";
      if (mode === "building") assert(S.build(park, "burger", origin.x, origin.y).id);
      if (mode === "budget") {
        park.unlimitedBudget = false;
        park.cash = S.trackCost(track) - 1;
      }
      const before = JSON.stringify(park),
        result =
          mode === "bounds"
            ? C.place(
                park,
                "coaster",
                { x: 29, y: 29 },
                P.prefabBlueprint({ x: 29, y: 29 }, 0, "steel", id),
              )
            : C.place(park, "coaster", origin, track);
      assert(result.error, `${mode}/${id}`);
      assert.equal(JSON.stringify(park), before);
    }
});

test("Omitted template selection preserves the existing classic prefab contract", () => {
  for (const style of Object.keys(S.COASTER_TYPES)) {
    const track = P.prefabBlueprint({ x: 8, y: 8 }, 0, style);
    assert.deepEqual(track, P.prefabBlueprint({ x: 8, y: 8 }, 0, style, "classic"));
    assert.equal(
      track.length,
      style === "wood" ? 193 : ["launch", "inverted"].includes(style) ? 257 : 225,
    );
    assert.equal(
      Math.max(...track.map((p) => p.z)),
      { steel: 1, wood: 1, launch: 4, inverted: 5, giga: 3 }[style],
    );
  }
});

if (failed) process.exit(1);

import assert from "node:assert/strict";
import * as THREE from "three";
import { moduleURL } from "./ts-loader.mjs";
process.on("uncaughtException", (error) => {
  console.error(error.message);
  process.exit(1);
});
const W = await import(moduleURL("game/weather.ts")),
  C = await import(moduleURL("game/calendar.ts")),
  Canvas = await import(moduleURL("game/weather-canvas.ts")),
  Scene = await import(moduleURL("game/weather-scene.ts"));
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("PASS", name);
}
const park = () => ({
  time: 0,
  mode: "sandbox",
  scenario: "waldhain",
  calendar: { version: 1, offsetSeconds: 0 },
  tiles: Array.from({ length: 30 }, (_, y) =>
    Array.from({ length: 30 }, (_, x) => (y === 15 || x === 15 ? "path" : "grass")),
  ),
});

test("Every season has sustained weather phases, and heat stays in summer", () => {
  const s = park(),
    kinds = new Set();
  for (let t = 10; t < 1200; t += 75) {
    const a = W.parkWeather(s, t),
      b = W.parkWeather(s, t + 35);
    kinds.add(a.kind);
    assert.equal(a.kind, b.kind);
    assert.equal(a.season, C.calendarOf(s, t).season);
    assert.equal(a.nextChange - a.phaseStart, 75);
    if (a.kind === "heat") {
      assert.equal(a.season, "summer");
      assert(a.temperature >= 30);
    }
    assert(a.temperature >= 2 && a.temperature <= 36);
  }
  assert.deepEqual([...kinds].sort(), ["cloud", "heat", "rain", "sun"]);
  assert.equal(W.parkWeather(s, 0).kind, "sun");
});

test("Save reload, pause and reads never reroll weather or mutate the park", () => {
  const s = park();
  s.time = 175.3;
  const before = JSON.stringify(s),
    original = Math.random;
  Math.random = () => {
    throw Error("Weather consumed simulation RNG");
  };
  try {
    const one = W.parkWeather(s);
    for (let i = 0; i < 20; i++) assert.deepEqual(W.parkWeather(s), one);
    assert.deepEqual(W.parkWeather(JSON.parse(before)), one);
    assert.equal(JSON.stringify(s), before);
  } finally {
    Math.random = original;
  }
});

test("Forecasts match the actual future phases rather than independent predictions", () => {
  const s = park();
  s.time = 63;
  const forecast = W.forecastWeather(s, 3);
  assert.equal(forecast.length, 3);
  for (const item of forecast) {
    const future = W.parkWeather(s, item.phaseStart + W.WEATHER_TRANSITION_SECONDS);
    assert.equal(item.kind, future.kind);
    assert.equal(item.temperature, future.temperature);
    assert.deepEqual(item, future);
  }
  assert.equal(W.forecastWeather(s, 0).length, 0);
  assert.equal(W.forecastWeather(s, 900).length, 5);
});

test("Rain and sunlight cross phase boundaries smoothly and puddles dry gradually", () => {
  const s = park(),
    start = 150,
    before = W.parkWeather(s, start - 0.001),
    edge = W.parkWeather(s, start),
    middle = W.parkWeather(s, start + 4),
    after = W.parkWeather(s, start + 8);
  assert(Math.abs(edge.rain - before.rain) < 0.001);
  assert(edge.rain < middle.rain && middle.rain < after.rain);
  assert(Math.abs(middle.rain - after.rain / 2) < 1e-9);
  const drying = W.parkWeather(s, 235),
    dry = W.parkWeather(s, 265);
  assert.equal(drying.rain, 0);
  assert(drying.wetness > 0.4);
  assert.equal(dry.wetness, 0);
  for (let t = 0; t < 2400; t += 0.73) {
    const w = W.parkWeather(s, t);
    for (const key of ["rain", "cloud", "heat", "wetness", "wind", "light"])
      assert(w[key] >= 0 && w[key] <= 1);
    assert(/^#[0-9a-f]{6}$/.test(w.skyColor));
    assert(/^#[0-9a-f]{6}$/.test(w.fogColor));
  }
});

test("Legacy calendar migration preserves the displayed season and forecast clock", () => {
  const s = park();
  delete s.calendar;
  s.time = 810;
  C.initCalendar(s);
  assert.equal(s.time, 810);
  assert.equal(C.calendarOf(s).season, "winter");
  assert.equal(W.parkWeather(s).season, "winter");
  assert(W.parkWeather(s).nextChange > s.time && W.parkWeather(s).nextChange <= s.time + 75);
  const next = W.forecastWeather(s)[0];
  assert.equal(next.season, C.calendarOf(s, next.phaseStart + 8).season);
});

test("Canvas rain is projected from the same world drops used in 3D and respects pause", () => {
  const s = park();
  s.time = 170;
  const calls = [],
    ctx = new Proxy(
      {},
      {
        get:
          (_target, property) =>
          (...args) =>
            calls.push([property, ...args]),
        set: (_target, property, value) => {
          calls.push([property, value]);
          return true;
        },
      },
    ),
    view = { zoom: 1.5, panX: 0, panY: 100 };
  Canvas.drawWeather(ctx, 1520, 860, s, view);
  const first = JSON.stringify(calls);
  assert(calls.some((c) => c[0] === "lineTo"));
  calls.length = 0;
  Canvas.drawWeather(ctx, 1520, 860, s, view);
  assert.equal(JSON.stringify(calls), first);
  const weather = W.parkWeather(s),
    drop = W.weatherDrop(0, s.time, 30, 30, weather.wind),
    p = {
      x: 1520 * 0.53 + (drop.x - drop.y) * 24 * 1.5,
      y: 860 * 0.43 + 100 + (drop.x + drop.y - 30) * 12 * 1.5 - drop.z * 24 * 1.5,
    };
  if (p.x >= -12 && p.x <= 1532 && p.y >= -24 && p.y <= 884)
    assert(calls.some((c) => c[0] === "moveTo" && Math.hypot(c[1] - p.x, c[2] - p.y) < 1e-7));
  s.time += 0.15;
  calls.length = 0;
  Canvas.drawWeather(ctx, 1520, 860, s, view);
  assert.notEqual(JSON.stringify(calls), first);
});

test("3D weather matches map conditions, animates actual rain geometry and freezes on pause", () => {
  const s = park();
  s.time = 170;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog("#ffffff", 230, 650);
  const ambient = new THREE.HemisphereLight("#ffffff", "#777777", 2.8),
    sun = new THREE.DirectionalLight("#ffffff", 2.3),
    rig = Scene.createWeatherScene(scene, s, { ambient, sun }),
    rain = rig.root.getObjectByName("weather-rain"),
    attr = rain.geometry.attributes.position;
  assert.deepEqual(rig.root.userData.weather, W.parkWeather(s));
  assert.equal(scene.background.getHexString(), W.parkWeather(s).skyColor.slice(1));
  assert(rain.visible && sun.intensity < 2.3 && ambient.intensity < 2.8);
  const first = attr.array.slice(),
    version = attr.version;
  rig.update(s.time);
  assert.deepEqual(attr.array, first);
  assert.equal(attr.version, version);
  const d = W.weatherDrop(0, s.time, 30, 30, W.parkWeather(s).wind);
  assert(Math.hypot(first[0] - d.x * 5, first[1] - d.z * 5, first[2] - d.y * 5) < 1e-4);
  rig.update(s.time + 0.2);
  assert.notDeepEqual(attr.array, first);
  assert(attr.array.every(Number.isFinite));
  rig.update(10);
  assert.equal(rain.visible, false);
  rig.dispose();
  assert.equal(scene.getObjectByName("park-weather"), undefined);
});

test("Weather scene releases each owned geometry and material exactly once", () => {
  const s = park(),
    scene = new THREE.Scene(),
    rig = Scene.createWeatherScene(scene, s),
    resources = new Map();
  rig.root.traverse((o) => {
    for (const r of [o.geometry, o.material])
      if (r && !resources.has(r)) {
        resources.set(r, 0);
        r.addEventListener("dispose", () => resources.set(r, resources.get(r) + 1));
      }
  });
  rig.dispose();
  assert.equal(resources.size, 4);
  assert([...resources.values()].every((count) => count === 1));
});
console.log(`${passed} weather checks passed.`);

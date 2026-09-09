import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const root = new URL("../", import.meta.url),
  cache = new Map();
function moduleURL(file) {
  if (cache.has(file)) return cache.get(file);
  let source = ts.transpileModule(readFileSync(new URL(file, root), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  source = source.replace(
    /from ['"](\.[^'"]+|three)['"]/g,
    (_, dep) =>
      `from '${dep === "three" ? import.meta.resolve("three") : moduleURL(new URL(dep + ".ts", new URL(file, root)).pathname.slice(root.pathname.length))}'`,
  );
  const url = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
  cache.set(file, url);
  return url;
}
const sim = await import(moduleURL("game/simulation.ts")),
  pre = await import(moduleURL("game/prefabs.ts")),
  construction = await import(moduleURL("game/construction.ts")),
  ride = await import(moduleURL("game/ride-path.ts")),
  audio = await import(moduleURL("game/audio.ts"));
function empty() {
  const s = sim.newPark();
  s.buildings = [];
  s.guests = [];
  s.tiles = s.tiles.map((r) => r.map(() => "grass"));
  s.cash = 1e6;
  return s;
}
function check(name, fn) {
  fn();
  console.log("PASS " + name);
}
check(
  "All coaster prefabs close with matching position and tangent in all four orientations",
  () => {
    for (const style of ["steel", "wood", "launch"])
      for (let rotation = 0; rotation < 4; rotation++) {
        const s = empty(),
          t = pre.prefabBlueprint({ x: 14, y: 14 }, rotation, style);
        assert.equal(sim.validateTrack(s, t), null, `${style}/${rotation}`);
        assert.deepEqual(t.at(-1), t[0]);
        const result = construction.place(s, "coaster", t[0], t);
        assert.ok(result.id);
        assert.ok(sim.validSave(JSON.parse(JSON.stringify(s))));
      }
  },
);
check(
  "Prefabs join automatically, preserve headings and charge geometry rather than samples",
  () => {
    const start = pre.startTrack({ x: 10, y: 10 });
    let t = pre.appendPiece(start, "rise");
    assert.equal(t.at(-1).z, 1);
    t = pre.appendPiece(t, "right");
    assert.deepEqual([t.at(-1).x, t.at(-1).y, t.at(-1).z], [14, 12, 1]);
    t = pre.appendPiece(t, "fall");
    assert.deepEqual([t.at(-1).x, t.at(-1).y, t.at(-1).z], [14, 14, 0]);
    assert.equal(sim.trackCost(construction.blueprint({ x: 0, y: 0 })), 4705);
  },
);
check("Auto-close returns continuous valid geometry without a station teleport", () => {
  const s = empty();
  let t = pre.startTrack({ x: 12, y: 12 });
  for (const p of ["straight", "rise", "fall", "right"]) t = pre.appendPiece(t, p);
  const closed = pre.closeTrack(s, t);
  assert.ok(closed.track, closed.error);
  assert.equal(sim.validateTrack(s, closed.track), null);
  let regression = pre.startTrack({ x: 12, y: 12 });
  for (const p of ["straight", "rise", "fall", "straight"])
    regression = pre.appendPiece(regression, p);
  const repaired = pre.closeTrack(s, regression);
  assert.ok(repaired.track, repaired.error);
  assert.equal(sim.validateTrack(s, repaired.track), null);
});
check("Self-crossings, underground pieces and occupied routes are rejected", () => {
  const s = empty();
  let t = pre.startTrack({ x: 12, y: 12 });
  const below = pre.appendPiece(t, "fall");
  assert.ok(pre.pieceError(s, t, below, true));
  const valid = pre.prefabBlueprint({ x: 12, y: 12 }, 0, "launch");
  const bad = valid.map((p) => ({ ...p, y: 12 }));
  assert.ok(sim.validateTrack(s, bad));
  s.tiles[12][13] = "water";
  assert.ok(pre.pieceError(s, t, pre.appendPiece(t, "straight"), true));
});
check(
  "3D frames are finite, orthonormal and continuous across the station, including inverted loop",
  () => {
    const t = pre.prefabBlueprint({ x: 14, y: 14 }, 0, "launch"),
      p = ride.makeRidePath(t);
    assert.ok(p.at(0).quaternion.angleTo(p.at(1).quaternion) < 1e-5);
    assert.ok(p.at(0).position.distanceTo(p.at(1).position) < 1e-5);
    let highest = { height: 0, up: 1 };
    for (let i = 0; i <= 1000; i++) {
      const f = p.at(i / 1000);
      assert.ok(Number.isFinite(f.position.length() + f.quaternion.length()));
      assert.ok(Math.abs(f.right.dot(f.up)) < 1e-6);
      if (f.position.y > highest.height) highest = { height: f.position.y, up: f.up.y };
    }
    assert.ok(highest.up < -0.8, JSON.stringify(highest));
    assert.equal(p.progress(0), 0);
    assert.ok(Math.abs(p.progress(p.duration) - 1) < 1e-6);
    const rotated = t.map((p) => ({ ...p, x: 30 - p.y, y: p.x })),
      q = ride.makeRidePath(rotated);
    assert.ok(Math.abs(p.length - q.length) < 1e-5);
  },
);
check("New attraction kinds save, build, connect and use ride queues", () => {
  for (const kind of ["swing", "drop", "pirate"]) {
    const s = empty(),
      r = sim.build(s, kind, 10, 10);
    assert.ok(r.id);
    assert.ok(sim.isRide(kind));
    assert.ok(sim.validSave(s));
    assert.equal(s.buildings[0].open, false);
  }
});
check("Audio preferences reject malformed data and preserve independent levels", () => {
  assert.deepEqual(audio.parseAudio("bad"), audio.DEFAULT_AUDIO);
  assert.deepEqual(audio.parseAudio('{"enabled":true,"master":2,"music":-4,"effects":0.3}'), {
    enabled: true,
    master: 1,
    music: 0,
    effects: 0.3,
  });
});
check("Audio stays locked before a gesture and disposes an outstanding unlock", () => {
  let count = 0,
    closed = 0,
    resume;
  const node = () => ({
    connect() {},
    disconnect() {},
    start() {},
    stop() {},
    gain: {
      value: 0,
      setTargetAtTime() {},
      setValueAtTime() {},
      linearRampToValueAtTime() {},
      exponentialRampToValueAtTime() {},
    },
    frequency: { value: 0, setTargetAtTime() {} },
    threshold: { value: 0 },
    ratio: { value: 0 },
  });
  globalThis.AudioContext = class {
    constructor() {
      count++;
      this.currentTime = 0;
      this.sampleRate = 8000;
      this.state = "suspended";
      this.destination = node();
    }
    createGain = node;
    createDynamicsCompressor = node;
    createBiquadFilter = node;
    createBufferSource = node;
    createBuffer() {
      return { getChannelData: () => new Float32Array(16000) };
    }
    resume() {
      return new Promise((r) => {
        resume = r;
      });
    }
    close() {
      closed++;
      return Promise.resolve();
    }
  };
  const engine = new audio.ParkAudio();
  engine.setSettings({ ...audio.DEFAULT_AUDIO, enabled: true });
  engine.effect("build");
  assert.equal(count, 0);
  void engine.unlock();
  assert.equal(count, 1);
  engine.dispose();
  resume();
  assert.equal(closed, 1);
  assert.equal(engine.state, "locked");
});

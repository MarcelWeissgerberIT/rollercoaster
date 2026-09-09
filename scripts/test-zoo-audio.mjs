import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
const { synthesizeAnimalCall, playAnimalCall, clearAnimalCallCache } = await import(
  moduleURL("game/zoo-audio.ts")
);

const results = [];
function test(name, fn) {
  try {
    const detail = fn();
    results.push({ name, pass: true, detail });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, pass: false, error: e.message });
    console.log("FAIL", name, e.message);
  }
}
function stats(pcm, sr) {
  let peak = 0,
    energy = 0,
    mean = 0,
    zc = 0;
  for (let i = 0; i < pcm.length; i++) {
    const n = pcm[i];
    assert(Number.isFinite(n));
    peak = Math.max(peak, Math.abs(n));
    energy += n * n;
    mean += n;
    if (i && n * pcm[i - 1] < 0) zc++;
  }
  return {
    seconds: pcm.length / sr,
    peak,
    rms: Math.sqrt(energy / pcm.length),
    mean: mean / pcm.length,
    zeroCrossings: zc,
  };
}
for (const species of ["zebra", "giraffe", "flamingo", "penguin"])
  test(`${species}: bounded finite deterministic PCM and nonidentical variants`, () => {
    const pcm = synthesizeAnimalCall(species, 48000, 2),
      metrics = stats(pcm, 48000);
    assert(metrics.peak <= 0.281);
    assert(metrics.rms > 0.008 && metrics.rms < 0.16);
    assert(Math.abs(metrics.mean) < 0.002);
    assert(metrics.seconds > 0.6 && metrics.seconds < 1.4);
    assert.equal(pcm[0], 0);
    assert.equal(pcm.at(-1), 0);
    assert.deepEqual(pcm, synthesizeAnimalCall(species, 48000, 2));
    assert.notDeepEqual(pcm, synthesizeAnimalCall(species, 48000, 3));
    for (const sr of [8000, 24000, 44100, 96000])
      assert(stats(synthesizeAnimalCall(species, sr, 19), sr).peak <= 0.281);
    return metrics;
  });
test("Sample-rate and species validation fail before producing malformed PCM", () => {
  for (const sr of [0, NaN, Infinity, 7999, 200000])
    assert.throws(() => synthesizeAnimalCall("zebra", sr));
  assert.throws(() => synthesizeAnimalCall("horse", 48000));
  assert.deepEqual(
    synthesizeAnimalCall("zebra", 48000, NaN),
    synthesizeAnimalCall("zebra", 48000, 0),
  );
});
function context(state = "running", fail) {
  const nodes = [];
  const ctx = {
    state,
    sampleRate: 24000,
    currentTime: 4,
    nodes,
    buffers: 0,
    createBuffer(ch, n, sr) {
      this.buffers++;
      return {
        getChannelData() {
          return new Float32Array(n);
        },
      };
    },
  };
  function node(kind) {
    if (fail === kind) throw Error("setup failure");
    const n = {
      kind,
      disconnects: 0,
      connects: [],
      onended: null,
      buffer: null,
      stopCalls: 0,
      started: false,
      connect(to) {
        if (fail === "connect" && kind === "pan") throw Error("connect failure");
        this.connects.push(to);
      },
      disconnect() {
        this.disconnects++;
      },
      stop() {
        this.stopCalls++;
      },
      start() {
        if (fail === "start") throw Error("start failure");
        this.started = true;
      },
      gain: {
        setValueAtTime(v) {
          this.value = v;
        },
      },
      pan: {
        setValueAtTime(v) {
          this.value = v;
        },
      },
    };
    nodes.push(n);
    return n;
  }
  ctx.createBufferSource = () => node("source");
  ctx.createGain = () => node("gain");
  ctx.createStereoPanner = () => node("pan");
  return ctx;
}
const output = { untouched: true };
test("BufferSource, gain and StereoPanner form the exact owned graph and clamp options", () => {
  const ctx = context(),
    handle = playAnimalCall(ctx, output, "penguin", { gain: 8, pan: -5, variant: 1 });
  const [source, gain, pan] = ctx.nodes;
  assert.deepEqual(source.connects, [gain]);
  assert.deepEqual(gain.connects, [pan]);
  assert.deepEqual(pan.connects, [output]);
  assert.equal(gain.gain.value, 1);
  assert.equal(pan.pan.value, -1);
  assert(source.started);
  handle.stop();
  assert(ctx.nodes.every((n) => n.disconnects === 1));
});
test("Natural end disconnects all nodes once and later stop is harmless", () => {
  const ctx = context(),
    handle = playAnimalCall(ctx, output, "zebra", { gain: 0.5, pan: 0.2, variant: 1 }),
    source = ctx.nodes[0];
  source.onended();
  handle.stop();
  handle.stop();
  assert(ctx.nodes.every((n) => n.disconnects === 1));
  assert.equal(source.onended, null);
  assert.equal(source.buffer, null);
  assert.equal(source.stopCalls, 0);
});
for (const state of ["running", "suspended"])
  test(`Explicit abort is synchronous and idempotent with ${state} context`, () => {
    const ctx = context(state),
      handle = playAnimalCall(ctx, output, "flamingo", { gain: 0.5, pan: 0, variant: 1 }),
      source = ctx.nodes[0];
    handle.stop();
    handle.stop();
    assert.equal(source.stopCalls, 1);
    assert.equal(source.onended, null);
    assert.equal(source.buffer, null);
    assert(ctx.nodes.every((n) => n.disconnects === 1));
  });
for (const fail of ["gain", "pan", "connect", "start"])
  test(`Partial setup failure at ${fail} releases already created nodes`, () => {
    const ctx = context("running", fail);
    assert.throws(() => playAnimalCall(ctx, output, "giraffe", { gain: 0.5, pan: 0, variant: 1 }));
    assert(ctx.nodes.every((n) => n.disconnects === 1));
  });
test("Silent gain and closed context allocate no audio nodes", () => {
  for (const [state, gain] of [
    ["closed", 1],
    ["running", 0],
    ["running", NaN],
  ]) {
    const ctx = context(state),
      h = playAnimalCall(ctx, output, "zebra", { gain, pan: 0, variant: 1 });
    h.stop();
    assert.equal(ctx.nodes.length, 0);
  }
});
test("AudioBuffer cache is bounded to 12 clips per context and supports explicit release", () => {
  const ctx = context();
  for (const species of ["zebra", "giraffe", "flamingo", "penguin"])
    for (let v = -3; v < 20; v++)
      playAnimalCall(ctx, output, species, { gain: 0.5, pan: 0, variant: v }).stop();
  assert.equal(ctx.buffers, 12);
  const other = context();
  playAnimalCall(other, output, "zebra", { gain: 0.5, pan: 0, variant: 0 }).stop();
  assert.equal(other.buffers, 1);
  assert.equal(ctx.buffers, 12);
  clearAnimalCallCache(ctx);
  playAnimalCall(ctx, output, "zebra", { gain: 0.5, pan: 0, variant: 0 }).stop();
  assert.equal(ctx.buffers, 13);
});
const summary = {
  passed: results.filter((x) => x.pass).length,
  failed: results.filter((x) => !x.pass).length,
  results,
};
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.failed ? 1 : 0;

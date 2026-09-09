/** Procedural, deliberately stylized zoo calls; these are not authentic recordings.
 * No scheduling, timers, global audio context or dependencies. Caller owns cadence,
 * mute/pause/visibility policy and its output bus. PCM has a soft onset/tail and a
 * bounded peak; stop() is an immediate, idempotent abort with synchronous cleanup. */
import type { Species } from "./zoo";
export type AnimalCallOptions = { gain: number; pan: number; variant: number };
export type AnimalCallHandle = { stop(): void };
const TAU = Math.PI * 2;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const duration: Record<Species, number> = {
  zebra: 1.15,
  giraffe: 1.28,
  flamingo: 0.78,
  penguin: 1.08,
};
const smooth = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
function pulse(t: number, start: number, end: number, attack = 0.025, release = 0.06) {
  if (t <= start || t >= end) return 0;
  return smooth((t - start) / attack) * smooth((end - t) / release);
}
/** Deterministic mono PCM at the requested rate. Same arguments produce the same
 * samples. It does not touch Web Audio, Math.random(), clocks or shared state. */
export function synthesizeAnimalCall(
  species: Species,
  sampleRate: number,
  variant = 0,
): Float32Array {
  if (!Object.hasOwn(duration, species)) throw new RangeError("Unknown animal species");
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000)
    throw new RangeError("Sample rate must be 8000..192000 Hz");
  const v = Number.isFinite(variant) ? Math.trunc(variant) : 0;
  let seed =
    ((v >>> 0) ^
      { zebra: 0x5932197, giraffe: 0x4fabd12, flamingo: 0x157e039, penguin: 0x17d912f }[
        species
      ]) >>>
    0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const lengthScale = 0.94 + random() * 0.12,
    pitchScale = 0.9 + random() * 0.2,
    phaseOffset = random() * TAU;
  const seconds = duration[species] * lengthScale,
    samples = new Float32Array(Math.ceil(seconds * sampleRate));
  const lowAlpha = 1 - Math.exp((-TAU * (species === "giraffe" ? 420 : 1900)) / sampleRate);
  const highAlpha = 1 - Math.exp((-TAU * 120) / sampleRate),
    dcAlpha = 1 - Math.exp((-TAU * 18) / sampleRate);
  let phase = 0,
    low = 0,
    slow = 0,
    dc = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate,
      u = t / lengthScale,
      noise = random() * 2 - 1;
    low += lowAlpha * (noise - low);
    slow += highAlpha * (low - slow);
    const breath = low - slow;
    let env = 0,
      fundamental = 100,
      rough = 0,
      air = 0.08,
      body = 0;
    if (species === "zebra") {
      env = pulse(u, 0.025, 0.4, 0.055, 0.09) * 0.78 + pulse(u, 0.46, 1.11, 0.025, 0.12);
      fundamental = u < 0.43 ? 150 + 130 * smooth(u / 0.4) : 330 - 180 * smooth((u - 0.46) / 0.65);
      rough = 0.24;
      air = 0.18;
    } else if (species === "giraffe") {
      env = pulse(u, 0.035, 1.24, 0.2, 0.23);
      fundamental = 86 - 17 * smooth(u / 1.28) + 3 * Math.sin(u * TAU * 1.1);
      rough = 0.025;
      air = 0.045;
    } else if (species === "flamingo") {
      env =
        pulse(u, 0.02, 0.22, 0.014, 0.05) * 0.85 +
        pulse(u, 0.29, 0.47, 0.014, 0.045) +
        pulse(u, 0.53, 0.745, 0.017, 0.07) * 0.8;
      const local = u < 0.25 ? u - 0.02 : u < 0.5 ? u - 0.29 : u - 0.53;
      fundamental =
        430 + 170 * Math.sin(clamp(local / 0.23, 0, 1) * Math.PI) - 140 * clamp(local / 0.23, 0, 1);
      rough = 0.08;
      air = 0.15;
    } else {
      env = pulse(u, 0.025, 0.38, 0.022, 0.11) * 0.9 + pulse(u, 0.46, 1.04, 0.032, 0.13);
      const local = u < 0.42 ? u - 0.025 : u - 0.46;
      fundamental =
        u < 0.42
          ? 250 + 60 * Math.sin(local * 10) - 110 * smooth(local / 0.35)
          : 390 - 175 * smooth(local / 0.58);
      rough = 0.17;
      air = 0.14;
    }
    const flutter = 1 + 0.018 * Math.sin(TAU * (species === "giraffe" ? 4 : 6.5) * u + phaseOffset);
    const f = fundamental * pitchScale * flutter;
    phase = (phase + (TAU * f) / sampleRate) % TAU;
    // Additive band-limited harmonics give each call a different resonant character.
    for (let h = 1; h <= 10 && h * f < sampleRate * 0.44; h++) {
      const hz = h * f;
      let weight: number;
      if (species === "giraffe") weight = h === 1 ? 1 : h === 2 ? 0.33 : h === 3 ? 0.12 : 0.025 / h;
      else if (species === "flamingo")
        weight =
          ((h % 2 ? 0.5 : 0.95) / h) * (0.3 + 1.2 * Math.exp(-Math.pow((hz - 1150) / 650, 2)));
      else if (species === "zebra")
        weight =
          (1 / h) *
          (0.3 +
            1.25 * Math.exp(-Math.pow((hz - 900) / 650, 2)) +
            0.5 * Math.exp(-Math.pow((hz - 1850) / 550, 2)));
      else
        weight =
          ((h % 2 ? 1 : 0.23) / Math.pow(h, 0.8)) *
          (0.45 + Math.exp(-Math.pow((hz - 750) / 500, 2)));
      body += weight * Math.sin(phase * h + 0.07 * h * Math.sin(u * 9 + phaseOffset));
    }
    const rasp =
      1 -
      rough +
      rough * Math.sin(TAU * (species === "zebra" ? 31 : species === "penguin" ? 22 : 13) * u);
    const volume = species === "giraffe" ? 0.13 : species === "flamingo" ? 0.24 : 0.27;
    let sample = Math.tanh((body * rasp + breath * air) * 1.5) * volume * env;
    // High-pass the final signal below 18Hz to suppress any DC bias.
    dc += dcAlpha * (sample - dc);
    sample -= dc;
    sample *= smooth(t / 0.012) * smooth((seconds - t) / 0.025);
    samples[i] = sample;
  }
  let peak = 0;
  for (const x of samples) peak = Math.max(peak, Math.abs(x));
  if (peak > 0.28) {
    const scale = 0.28 / peak;
    for (let i = 0; i < samples.length; i++) samples[i] *= scale;
  }
  samples[0] = 0;
  samples[samples.length - 1] = 0;
  return samples;
}
// Cache three variants of each species per context (maximum 12 mono clips).
// Weak keys allow a closed/discarded context and its cached audio to be collected.
const callBuffers = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
export function clearAnimalCallCache(ctx: BaseAudioContext): void {
  callBuffers.delete(ctx);
}
function callBuffer(ctx: BaseAudioContext, species: Species, variant: number): AudioBuffer {
  const value = Number.isFinite(variant) ? Math.trunc(variant) : 0;
  const slot = ((value % 3) + 3) % 3,
    key = `${species}:${slot}`;
  let bank = callBuffers.get(ctx);
  if (!bank) {
    bank = new Map();
    callBuffers.set(ctx, bank);
  }
  const cached = bank.get(key);
  if (cached) return cached;
  const pcm = synthesizeAnimalCall(species, ctx.sampleRate, slot);
  const buffer = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
  buffer.getChannelData(0).set(pcm);
  bank.set(key, buffer);
  return buffer;
}

/** One source -> gain -> StereoPanner -> caller's bus. All owned nodes disconnect
 * on natural end, explicit abort or partial setup failure; the caller bus is untouched. */
export function playAnimalCall(
  ctx: BaseAudioContext,
  output: AudioNode,
  species: Species,
  options: AnimalCallOptions,
): AnimalCallHandle {
  const volume = Number.isFinite(options.gain) ? clamp(options.gain, 0, 1) : 0;
  if (volume === 0 || ctx.state === "closed") return { stop() {} };
  const buffer = callBuffer(ctx, species, options.variant);
  let source: AudioBufferSourceNode | null = null,
    gain: GainNode | null = null,
    pan: StereoPannerNode | null = null,
    done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    if (source) {
      source.onended = null;
      try {
        source.disconnect();
      } catch {}
      try {
        source.buffer = null;
      } catch {}
      source = null;
    }
    if (gain) {
      try {
        gain.disconnect();
      } catch {}
      gain = null;
    }
    if (pan) {
      try {
        pan.disconnect();
      } catch {}
      pan = null;
    }
  };
  const stop = () => {
    if (done) return;
    if (source) {
      try {
        source.stop();
      } catch {}
    }
    cleanup();
  };
  try {
    source = ctx.createBufferSource();
    gain = ctx.createGain();
    pan = ctx.createStereoPanner();
    source.buffer = buffer;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    pan.pan.setValueAtTime(
      Number.isFinite(options.pan) ? clamp(options.pan, -1, 1) : 0,
      ctx.currentTime,
    );
    source.connect(gain);
    gain.connect(pan);
    pan.connect(output);
    source.onended = cleanup;
    source.start();
  } catch (error) {
    stop();
    throw error;
  }
  return { stop };
}

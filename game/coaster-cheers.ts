/** Procedural rider reactions. No files, speech synthesis, intervals or persistent oscillators. */
export type CheerKind = "drop" | "airtime" | "gforce";
type Vector = { x: number; y: number; z: number };
export type CheerFrame = {
  /** Monotonic ride time in seconds, not RAF/wall time. World axes: Y up; speed in m/s. */
  time: number;
  speed: number;
  tangent: Vector;
  up: Vector;
  phase: string;
  playing: boolean;
  visible: boolean;
  people: number;
  verticalG?: number;
};
export type CheerEvent = { kind: CheerKind; intensity: number };
const clamp = (v: number, low = 0, high = 1) => Math.max(low, Math.min(high, v));
const finiteVector = (p: Vector) => [p.x, p.y, p.z].every(Number.isFinite);

/** Separate, deterministic trigger logic: a continuous drop cannot scream forever. */
export class CheerDetector {
  private previous?: { time: number; speed: number; velocity: Vector };
  private warmup = 0;
  private g = 1;
  private descent = 0;
  private quiet = 0;
  private hold = 0;
  private candidate?: CheerKind;
  private armed = true;
  reset() {
    this.previous = undefined;
    this.warmup = this.descent = this.quiet = this.hold = 0;
    this.g = 1;
    this.candidate = undefined;
    this.armed = true;
  }
  update(frame: CheerFrame): CheerEvent | null {
    if (
      !frame.playing ||
      !frame.visible ||
      frame.people <= 0 ||
      !Number.isFinite(frame.time) ||
      !Number.isFinite(frame.speed) ||
      !finiteVector(frame.tangent) ||
      !finiteVector(frame.up)
    ) {
      this.reset();
      return null;
    }
    const speed = Math.max(0, frame.speed);
    const velocity = {
      x: frame.tangent.x * speed,
      y: frame.tangent.y * speed,
      z: frame.tangent.z * speed,
    };
    const previous = this.previous;
    const dt = previous ? frame.time - previous.time : 0;
    if (!previous || dt <= 0 || dt > 0.25 || Math.abs(speed - previous.speed) > 12) {
      this.reset();
      this.previous = { time: frame.time, speed, velocity };
      return null;
    }
    this.previous = { time: frame.time, speed, velocity };
    this.warmup += dt;
    const length = Math.hypot(frame.up.x, frame.up.y, frame.up.z) || 1;
    const support =
      (((velocity.x - previous.velocity.x) / dt) * frame.up.x +
        ((velocity.y - previous.velocity.y) / dt + 9.81) * frame.up.y +
        ((velocity.z - previous.velocity.z) / dt) * frame.up.z) /
      (9.81 * length);
    this.g += (clamp(frame.verticalG ?? support, -3, 8) - this.g) * (1 - Math.exp(-dt / 0.12));
    this.descent = velocity.y < -1 ? this.descent - velocity.y * dt : 0;
    const running = speed > 8 && !["station", "lift", "brake"].includes(frame.phase);
    const kind: CheerKind | undefined = !running
      ? undefined
      : velocity.y < -5 && this.descent > 2.5
        ? "drop"
        : this.g < 0.35
          ? "airtime"
          : this.g > 2.8
            ? "gforce"
            : undefined;
    if (!kind) {
      this.quiet += dt;
      this.candidate = undefined;
      this.hold = 0;
      if (this.quiet > 0.45) this.armed = true;
      return null;
    }
    this.quiet = 0;
    this.hold = this.candidate === kind ? this.hold + dt : dt;
    this.candidate = kind;
    if (this.warmup < 0.4 || !this.armed || this.hold < 0.18) return null;
    this.armed = false;
    return {
      kind,
      intensity: clamp(
        kind === "drop"
          ? -velocity.y / 16
          : kind === "airtime"
            ? (1 - this.g) / 1.4
            : (this.g - 1.8) / 3,
        0.45,
        1,
      ),
    };
  }
}

function random(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
function bandpass(sampleRate: number, frequency: number, q: number) {
  const w = (2 * Math.PI * frequency) / sampleRate,
    alpha = Math.sin(w) / (2 * q);
  const b0 = alpha / (1 + alpha),
    a1 = (-2 * Math.cos(w)) / (1 + alpha),
    a2 = (1 - alpha) / (1 + alpha);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  return (x: number) => {
    const y = b0 * (x - x2) - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  };
}
function blep(phase: number, delta: number) {
  if (phase < delta) {
    const t = phase / delta;
    return t + t - t * t - 1;
  }
  if (phase > 1 - delta) {
    const t = (phase - 1) / delta;
    return t * t + t + t + 1;
  }
  return 0;
}

/** 1–4 independent voiced/breathy vowels; every event ends within 2 seconds. */
export function makeCheerBuffer(
  context: BaseAudioContext,
  kind: CheerKind,
  voices = 3,
  seed = 1,
): AudioBuffer {
  const count = Math.round(clamp(voices, 1, 4)),
    sr = context.sampleRate;
  const duration = 2,
    buffer = context.createBuffer(2, Math.ceil(duration * sr), sr);
  const channels = [buffer.getChannelData(0), buffer.getChannelData(1)],
    rng = random(seed);
  for (let voice = 0; voice < count; voice++) {
    const delay = 0.025 + voice * 0.075 + rng() * 0.055;
    const length = (kind === "gforce" ? 0.78 : 1.05) + rng() * 0.35;
    const f0 = 175 + rng() * 170,
      rise = kind === "drop" ? 1.85 : 1.45 + rng() * 0.25;
    const f1 = bandpass(sr, (kind === "airtime" ? 560 : 790) + rng() * 180, 2.6);
    const f2 = bandpass(sr, 1180 + rng() * 430, 4.1);
    const f3 = bandpass(sr, 2500 + rng() * 350, 5.3);
    const pan = count === 1 ? 0 : -0.58 + (voice / (count - 1)) * 1.16;
    const gains = [Math.cos(((pan + 1) * Math.PI) / 4), Math.sin(((pan + 1) * Math.PI) / 4)];
    let phase = rng(),
      breath = 0,
      jitter = 0;
    const start = Math.floor(delay * sr),
      samples = Math.floor(length * sr);
    for (let i = 0; i < samples; i++) {
      const t = i / sr,
        u = i / samples;
      jitter += (rng() * 2 - 1 - jitter) * 0.014;
      const glide = 1 + (rise - 1) * Math.sin(Math.PI * Math.min(1, u * 1.2));
      const hz =
        f0 *
        glide *
        (1 + 0.017 * Math.sin(t * 2 * Math.PI * (5.1 + voice * 0.63)) + 0.012 * jitter);
      const delta = hz / sr;
      phase = (phase + delta) % 1;
      const pulse = 2 * phase - 1 - blep(phase, delta);
      const noise = rng() * 2 - 1;
      breath += (noise - breath) * 0.13;
      const voiced = pulse * 0.76 + (noise - breath) * 0.22;
      const vowel = f1(voiced) * 0.9 + f2(voiced) * 0.58 + f3(voiced) * 0.26;
      const attack = Math.sin((clamp(t / 0.075) * Math.PI) / 2) ** 2;
      const release = Math.sin((clamp((length - t) / 0.36) * Math.PI) / 2) ** 2;
      // A second syllable for a "woo-hoo" shape, never a metronomic loop.
      const syllable = kind === "airtime" ? 1 - 0.7 * Math.exp(-(((u - 0.44) / 0.075) ** 2)) : 1;
      const sample = (vowel + breath * 0.045) * attack * release * syllable * (1 - 0.23 * u);
      for (let c = 0; c < 2; c++) channels[c][start + i] += (sample * gains[c]) / Math.sqrt(count);
    }
  }
  let peak = 0;
  for (const channel of channels)
    for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
  const gain = peak ? 0.32 / peak : 0;
  for (const channel of channels) for (let i = 0; i < channel.length; i++) channel[i] *= gain;
  return buffer;
}

export class CoasterCheers {
  private detector = new CheerDetector();
  private voices = new Map<AudioBufferSourceNode, GainNode>();
  private cache = new Map<string, AudioBuffer>();
  private audible = false;
  private disposed = false;
  private nextAllowed = 0;
  private serial = 0;
  constructor(
    private context: BaseAudioContext,
    private destination: AudioNode,
  ) {}
  get activeVoices() {
    return this.voices.size;
  }
  /** Call immediately from settings/visibility changes; master/effects=0 also means false. */
  setAudible(value: boolean) {
    if (this.disposed) return;
    this.audible = value;
    if (!value) this.halt();
  }
  /** Call every coaster frame. Do not feed flat rides or transport motion to this helper. */
  update(frame: CheerFrame): CheerEvent | null {
    if (this.disposed) return null;
    if (!this.audible || !frame.playing || !frame.visible || this.context.state !== "running") {
      this.halt();
      return null;
    }
    const event = this.detector.update(frame),
      now = this.context.currentTime;
    if (!event || now < this.nextAllowed) return null;
    const count = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(frame.people))));
    const variant = this.serial++ % 4,
      key = `${event.kind}:${count}:${variant}`;
    let buffer = this.cache.get(key);
    if (!buffer) {
      buffer = makeCheerBuffer(this.context, event.kind, count, 71 + variant * 131 + count * 17);
      if (this.cache.size >= 6) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, buffer);
    }
    const source = this.context.createBufferSource(),
      gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value = 0.6 + event.intensity * 0.4;
    source.connect(gain);
    gain.connect(this.destination);
    this.voices.set(source, gain);
    source.onended = () => this.release(source);
    source.start(now);
    source.stop(now + buffer.duration);
    this.nextAllowed = now + 4.8 + (this.serial % 3) * 0.65;
    return event;
  }
  private release(source: AudioBufferSourceNode) {
    source.onended = null;
    source.disconnect();
    this.voices.get(source)?.disconnect();
    this.voices.delete(source);
  }
  /** Pause/hidden/mute/close: cancel already sounding and scheduled voices, no stale resume. */
  halt() {
    this.detector.reset();
    this.nextAllowed = Math.max(this.nextAllowed, this.context.currentTime + 0.65);
    for (const [source, gain] of this.voices) {
      gain.gain.cancelScheduledValues(this.context.currentTime);
      gain.gain.setValueAtTime(0, this.context.currentTime);
      source.onended = null;
      try {
        source.stop(this.context.currentTime);
      } catch {
        /* Already ended. */
      }
      this.release(source);
    }
  }
  dispose() {
    if (this.disposed) return;
    this.halt();
    this.disposed = true;
    this.audible = false;
    this.cache.clear();
  }
}

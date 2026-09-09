export type AudioSettings = { enabled: boolean; master: number; music: number; effects: number };
export const AUDIO_KEY = "coaster-grove-audio-v1";
export const DEFAULT_AUDIO: AudioSettings = {
  enabled: false,
  master: 0.55,
  music: 0.28,
  effects: 0.65,
};
export function parseAudio(raw: string | null): AudioSettings {
  try {
    const v = JSON.parse(raw || "{}"),
      out = { ...DEFAULT_AUDIO };
    out.enabled = v.enabled === true;
    for (const k of ["master", "music", "effects"] as const)
      if (typeof v[k] === "number" && Number.isFinite(v[k]))
        out[k] = Math.max(0, Math.min(1, v[k]));
    return out;
  } catch {
    return { ...DEFAULT_AUDIO };
  }
}
export type Sound = "build" | "cash" | "undo" | "save";
/** Original procedural score and effects. No network audio, no queued autoplay. */
export class ParkAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private effects?: GainNode;
  private wind?: GainNode;
  private filter?: BiquadFilterNode;
  private noise?: AudioBufferSourceNode;
  private timer?: ReturnType<typeof setInterval>;
  private voices = new Set<AudioScheduledSourceNode>();
  private disposed = false;
  private hidden = false;
  private active = true;
  private riding = false;
  private note = 0;
  private nextNote = 0;
  private lastFX = -10;
  settings = { ...DEFAULT_AUDIO };
  get state() {
    return this.context?.state ?? "locked";
  }
  setSettings(v: AudioSettings) {
    this.settings = { ...v };
    this.levels();
  }
  private levels() {
    const t = this.context?.currentTime ?? 0;
    this.master?.gain.setTargetAtTime(
      this.settings.enabled && !this.hidden ? this.settings.master : 0,
      t,
      0.04,
    );
    this.music?.gain.setTargetAtTime(
      this.settings.music * (this.active ? 1 : 0) * (this.riding ? 0.25 : 1),
      t,
      0.08,
    );
    this.effects?.gain.setTargetAtTime(this.settings.effects, t, 0.04);
  }
  async unlock() {
    if (this.disposed || !this.settings.enabled) return;
    if (!this.context) {
      const ctx = new AudioContext();
      this.context = ctx;
      const master = ctx.createGain(),
        music = ctx.createGain(),
        effects = ctx.createGain();
      master.gain.value = 0;
      music.gain.value = 0;
      effects.gain.value = 0;
      this.master = master;
      this.music = music;
      this.effects = effects;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -8;
      limiter.ratio.value = 8;
      music.connect(master);
      effects.connect(master);
      master.connect(limiter);
      limiter.connect(ctx.destination);
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate),
        data = buffer.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < data.length; i++) {
        previous = (previous + (Math.random() * 2 - 1) * 0.035) / 1.035;
        data[i] = previous * 3;
      }
      const noise = ctx.createBufferSource(),
        filter = ctx.createBiquadFilter(),
        wind = ctx.createGain();
      noise.buffer = buffer;
      noise.loop = true;
      filter.type = "lowpass";
      filter.frequency.value = 250;
      wind.gain.value = 0;
      noise.connect(filter);
      filter.connect(wind);
      wind.connect(effects);
      noise.start();
      this.noise = noise;
      this.filter = filter;
      this.wind = wind;
      this.nextNote = ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 40);
      this.levels();
    }
    const ctx = this.context;
    try {
      await ctx.resume();
      if (this.disposed || this.context !== ctx) return;
      if (this.hidden) await ctx.suspend();
    } catch {
      /* A later gesture can retry. */
    }
  }
  visibility(hidden: boolean) {
    this.hidden = hidden;
    this.levels();
    if (hidden) void this.context?.suspend().catch(() => {});
    else if (this.context && this.settings.enabled) {
      this.nextNote = this.context.currentTime + 0.1;
      void this.context.resume().catch(() => {});
    }
  }
  park(active: boolean) {
    if (active !== this.active) {
      this.active = active;
      this.levels();
    }
  }
  ride(speed: number, enabled: boolean) {
    if (this.riding !== enabled) {
      this.riding = enabled;
      this.levels();
    }
    const t = this.context?.currentTime ?? 0,
      v = enabled ? Math.min(1, Math.max(0, speed) / 22) : 0;
    this.wind?.gain.setTargetAtTime(v * 0.55, t, 0.12);
    this.filter?.frequency.setTargetAtTime(180 + v * 2400, t, 0.12);
  }
  private tone(
    hz: number,
    when: number,
    duration: number,
    volume: number,
    bus: GainNode,
    shape: OscillatorType = "sine",
  ) {
    const ctx = this.context;
    if (!ctx || this.disposed || this.voices.size > 24) return;
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    oscillator.type = shape;
    oscillator.frequency.value = hz;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(volume, when + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(gain);
    gain.connect(bus);
    this.voices.add(oscillator);
    oscillator.onended = () => {
      this.voices.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(when);
    oscillator.stop(when + duration + 0.02);
  }
  effect(kind: Sound) {
    const ctx = this.context;
    if (
      !ctx ||
      !this.effects ||
      ctx.state !== "running" ||
      !this.settings.enabled ||
      this.hidden ||
      ctx.currentTime - this.lastFX < 0.12
    )
      return;
    this.lastFX = ctx.currentTime;
    const notes =
      kind === "cash"
        ? [880, 1320]
        : kind === "build"
          ? [180, 360]
          : kind === "undo"
            ? [440, 260]
            : [523, 659, 784];
    notes.forEach((hz, i) =>
      this.tone(
        hz,
        ctx.currentTime + i * 0.055,
        0.16,
        0.12,
        this.effects!,
        kind === "build" ? "triangle" : "sine",
      ),
    );
  }
  private schedule() {
    const ctx = this.context;
    if (
      !ctx ||
      ctx.state !== "running" ||
      this.hidden ||
      !this.active ||
      !this.settings.enabled ||
      !this.music
    )
      return;
    if (this.nextNote < ctx.currentTime) this.nextNote = ctx.currentTime + 0.03;
    // Eight-bar, three-beat original park melody, independent of simulation speed.
    const melody = [
      72, 76, 79, 76, 74, 71, 69, 72, 76, 74, 71, 67, 65, 69, 72, 74, 72, 69, 67, 71, 74, 76, 74,
      71,
    ];
    while (this.nextNote < ctx.currentTime + 0.12) {
      const midi = melody[this.note % melody.length];
      this.tone(440 * 2 ** ((midi - 69) / 12), this.nextNote, 0.55, 0.1, this.music, "triangle");
      if (this.note % 3 === 0)
        this.tone(440 * 2 ** ((midi - 24 - 69) / 12), this.nextNote, 1.4, 0.12, this.music);
      this.note++;
      this.nextNote += 60 / 82;
    }
  }
  dispose() {
    this.disposed = true;
    clearInterval(this.timer);
    for (const source of this.voices) {
      source.onended = null;
      try {
        source.stop();
      } catch {}
      source.disconnect();
    }
    this.voices.clear();
    this.noise?.stop();
    this.noise?.disconnect();
    this.filter?.disconnect();
    this.wind?.disconnect();
    this.music?.disconnect();
    this.effects?.disconnect();
    this.master?.disconnect();
    void this.context?.close().catch(() => {});
    this.context = undefined;
  }
}

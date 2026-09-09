import { CoasterCheers, type CheerFrame } from "./coaster-cheers";
import { playAnimalCall, clearAnimalCallCache } from "./zoo-audio";
import type { Species } from "./zoo";
import type { RidePhase } from "./motion";
import type { CoasterType } from "./simulation";
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
  private cheers?: CoasterCheers;
  private animalVoice?: { stop(): void };
  private observing = false;
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
  private phase: RidePhase = "station";
  private speed = 0;
  private coasterType: CoasterType = "steel";
  private nextMechanic = 0;
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
    if (
      !this.settings.enabled ||
      this.hidden ||
      this.settings.master <= 0 ||
      this.settings.effects <= 0
    )
      this.stopAnimalCall();
    this.cheers?.setAudible(
      this.settings.enabled &&
        !this.hidden &&
        this.settings.master > 0 &&
        this.settings.effects > 0,
    );
    const t = this.context?.currentTime ?? 0;
    this.master?.gain.setTargetAtTime(
      this.settings.enabled && !this.hidden ? this.settings.master : 0,
      t,
      0.04,
    );
    this.music?.gain.setTargetAtTime(
      this.settings.music * (this.active ? 1 : 0) * (this.riding || this.observing ? 0.25 : 1),
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
      this.cheers = new CoasterCheers(ctx, effects);
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
  rideCheer(frame: CheerFrame | null) {
    if (frame) this.cheers?.update(frame);
    else this.cheers?.halt();
  }
  observeAnimals(active: boolean) {
    this.observing = active;
    if (!active) this.stopAnimalCall();
    this.levels();
  }
  animalCall(species: Species, gain = 1, pan = 0, variant = 0): boolean {
    const ctx = this.context;
    if (
      this.disposed ||
      !ctx ||
      !this.effects ||
      ctx.state !== "running" ||
      !this.settings.enabled ||
      this.hidden ||
      this.settings.master <= 0 ||
      this.settings.effects <= 0
    )
      return false;
    this.stopAnimalCall();
    this.animalVoice = playAnimalCall(ctx, this.effects, species, { gain, pan, variant });
    return true;
  }
  stopAnimalCall() {
    this.animalVoice?.stop();
    this.animalVoice = undefined;
  }
  visibility(hidden: boolean) {
    if (hidden) this.cheers?.halt();
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
  ride(speed: number, enabled: boolean, phase: RidePhase = "coast", style: CoasterType = "steel") {
    if (!enabled) this.cheers?.halt();
    this.phase = enabled ? phase : "station";
    this.speed = enabled ? Math.max(0, speed) : 0;
    this.coasterType = style;
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
    // A 32-bar theme: four distinct eight-bar phrases, harmony changes, rests and a quieter bridge.
    const phrases = [
      [
        72, 76, 79, 76, 74, 71, 69, 72, 76, 74, 71, 67, 65, 69, 72, 74, 72, 69, 67, 71, 74, 76, 74,
        71,
      ],
      [79, 0, 76, 81, 79, 76, 74, 77, 81, 79, 0, 74, 76, 79, 84, 83, 79, 76, 74, 71, 67, 72, 0, 0],
      [69, 72, 76, 0, 74, 72, 67, 71, 74, 0, 72, 71, 65, 69, 72, 0, 74, 76, 67, 71, 74, 0, 72, 0],
      [
        76, 79, 84, 83, 81, 79, 77, 74, 71, 72, 76, 79, 81, 77, 74, 79, 76, 72, 74, 71, 67, 72, 0,
        0,
      ],
    ];
    while (this.nextNote < ctx.currentTime + 0.12) {
      const section = Math.floor(this.note / 24) % 4,
        beat = this.note % 24,
        midi = phrases[section][beat],
        soft = section === 2;
      if (midi)
        this.tone(
          440 * 2 ** ((midi - 69) / 12),
          this.nextNote,
          soft ? 0.85 : 0.5,
          soft ? 0.065 : 0.09,
          this.music,
          "triangle",
        );
      if (this.note % 3 === 0) {
        const root = [48, 45, 53, 43][Math.floor(beat / 6) % 4];
        this.tone(440 * 2 ** ((root - 69) / 12), this.nextNote, 1.55, 0.085, this.music);
        for (const interval of [7, 12])
          this.tone(
            440 * 2 ** ((root + interval - 69) / 12),
            this.nextNote + 0.045,
            1.1,
            0.022,
            this.music,
          );
      }
      this.note++;
      this.nextNote += 60 / (soft ? 76 : 82);
    }
    if (this.effects && this.riding && this.speed > 0.1 && ctx.currentTime >= this.nextMechanic) {
      const t = ctx.currentTime,
        wood = this.coasterType === "wood";
      if (this.phase === "lift") {
        this.tone(185, t, 0.035, 0.06, this.effects, "square");
        this.tone(95, t + 0.045, 0.05, 0.045, this.effects, "triangle");
        this.nextMechanic = t + 0.16;
      } else if (this.phase === "launch") {
        this.tone(70 + this.speed * 13, t, 0.16, 0.07, this.effects, "sawtooth");
        this.nextMechanic = t + 0.11;
      } else if (this.phase === "brake") {
        this.tone(750 + this.speed * 18, t, 0.13, 0.025, this.effects, "triangle");
        this.tone(140, t, 0.08, 0.04, this.effects);
        this.nextMechanic = t + 0.12;
      } else {
        this.tone(
          wood ? 100 : 145,
          t,
          0.045,
          Math.min(0.075, this.speed * 0.003),
          this.effects,
          "triangle",
        );
        this.nextMechanic = t + Math.max(0.06, 3.7 / this.speed);
      }
    }
  }

  dispose() {
    this.stopAnimalCall();
    if (this.context) clearAnimalCallCache(this.context);
    this.cheers?.dispose();
    this.cheers = undefined;
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

"use client";

import type { Ambience, World3D } from "../../contracts/world3d";
import { createSynth, type SynthApi } from "../expedition/audio/synth";
import { mulberry32 } from "../../world3d/core/prng";

/*
 * The world's sound, all procedural WebAudio (no files to download): an ambience bed per World3D.audio.ambience (wind
 * and gusts, the river that swells as you walk to it, birds, night insects, a volcano's rumble), the story's soft music
 * pad (the Expedition's synth, keyed by the game's music mood), and short UI cues (a lesson page, a correct answer, a
 * relic). It starts on the first user gesture (browsers block audio before one) and follows the Sound setting.
 */

export type WorldCue = "open" | "page" | "correct" | "wrong" | "reward" | "relic" | "pet" | "gate" | "finale";

const CUE_IDS: Record<WorldCue, { id: string; gain?: number; pitch?: number }> = {
  open: { id: "ui_panel_in", gain: 0.5 },
  page: { id: "ui_page_turn", gain: 0.6 },
  correct: { id: "chord_true", gain: 0.7 },
  wrong: { id: "slab_set", gain: 0.5 },
  reward: { id: "ui_badge", gain: 0.6 },
  relic: { id: "relief_glint", gain: 0.55 },
  pet: { id: "pip_chirp", gain: 0.4, pitch: 1.3 },
  gate: { id: "stone_grind", gain: 0.6 },
  finale: { id: "beacon_ignite", gain: 0.8 },
};

interface Layers {
  wind: number;
  gusts: number;
  water: number;
  birds: number;
  insects: number;
  rumble: number;
}

const AMBIENCE: Record<Ambience, Layers> = {
  wind: { wind: 0.5, gusts: 0.6, water: 0, birds: 0.2, insects: 0, rumble: 0 },
  desert: { wind: 0.45, gusts: 0.5, water: 0, birds: 0.25, insects: 0.05, rumble: 0 },
  forest: { wind: 0.25, gusts: 0.3, water: 0, birds: 0.8, insects: 0.15, rumble: 0 },
  ocean: { wind: 0.35, gusts: 0.3, water: 0.5, birds: 0.35, insects: 0, rumble: 0 },
  river: { wind: 0.25, gusts: 0.25, water: 0.3, birds: 0.5, insects: 0.1, rumble: 0 },
  city: { wind: 0.2, gusts: 0.2, water: 0, birds: 0.3, insects: 0, rumble: 0.1 },
  cave: { wind: 0.15, gusts: 0.4, water: 0.1, birds: 0, insects: 0, rumble: 0.2 },
  night: { wind: 0.2, gusts: 0.2, water: 0, birds: 0, insects: 0.7, rumble: 0 },
  volcano: { wind: 0.4, gusts: 0.5, water: 0, birds: 0, insects: 0, rumble: 0.6 },
};

function noiseBuffer(ctx: AudioContext, seconds: number, brown: boolean): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const rand = mulberry32(brown ? 7 : 11);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = rand() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return buf;
}

export class WorldAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private synth: SynthApi | null = null;
  private waterGain: GainNode | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private enabled = true;
  private layers: Layers;
  private rand = mulberry32(2024);
  private night: boolean;

  constructor(
    private readonly world: Pick<World3D, "audio" | "atmosphere" | "biome">,
    private readonly musicMood: string,
  ) {
    this.layers = { ...AMBIENCE[world.audio.ambience] };
    this.night = world.atmosphere.mood === "night" || world.atmosphere.mood === "dusk";
    if (this.night) this.layers.insects = Math.max(this.layers.insects, 0.5);
    if (world.biome === "lunar") this.layers = { wind: 0, gusts: 0, water: 0, birds: 0, insects: 0, rumble: 0.08 };
  }

  /** Call from a user gesture (the Begin button). Safe to call twice. */
  start(): void {
    if (this.ctx || typeof window === "undefined") return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = this.enabled ? 0.9 : 0;
    master.connect(ctx.destination);
    this.master = master;
    this.synth = createSynth(ctx, master);
    this.synth.setPad(this.musicMood);
    this.bed();
  }

  private loopNoise(brown: boolean, filter: BiquadFilterType, freq: number, q: number, gain: number): { gain: GainNode; filter: BiquadFilterNode } {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 4, brown);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(this.master!);
    src.start();
    return { gain: g, filter: f };
  }

  /** The ambience bed: continuous layers plus scheduled calls. */
  private bed(): void {
    const ctx = this.ctx!;
    const L = this.layers;
    if (L.wind > 0) {
      const wind = this.loopNoise(true, "lowpass", 520, 0.7, 0.16 * L.wind);
      // gusts: a slow wandering LFO on the wind's cutoff and level
      if (L.gusts > 0) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.07;
        const depth = ctx.createGain();
        depth.gain.value = 260 * L.gusts;
        lfo.connect(depth).connect(wind.filter.frequency);
        const lvl = ctx.createGain();
        lvl.gain.value = 0.06 * L.gusts;
        lfo.connect(lvl).connect(wind.gain.gain);
        lfo.start();
      }
    }
    this.waterGain = this.loopNoise(false, "lowpass", 900, 0.5, 0).gain;
    if (L.rumble > 0) this.loopNoise(true, "lowpass", 90, 0.8, 0.35 * L.rumble);
    if (L.birds > 0) this.schedule(() => this.bird(), 2500, 9000 / L.birds);
    if (L.insects > 0) this.schedule(() => this.insects(), 800, 2600 / L.insects);
  }

  private schedule(fn: () => void, min: number, spread: number): void {
    const next = () => {
      const t = setTimeout(() => {
        fn();
        next();
      }, min + this.rand() * spread);
      this.timers.push(t);
    };
    next();
  }

  /** A bird: two or three quick descending chirps somewhere to the side. */
  private bird(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const pan = ctx.createStereoPanner();
    pan.pan.value = this.rand() * 1.6 - 0.8;
    pan.connect(this.master);
    const base = 2200 + this.rand() * 1600;
    const n = 2 + Math.floor(this.rand() * 2);
    for (let i = 0; i < n; i++) {
      const t0 = ctx.currentTime + i * (0.11 + this.rand() * 0.05);
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(base * (1 + 0.1 * this.rand()), t0);
      o.frequency.exponentialRampToValueAtTime(base * 0.62, t0 + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.035 * this.layers.birds, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
      o.connect(g).connect(pan);
      o.start(t0);
      o.stop(t0 + 0.12);
    }
  }

  /** Night insects: a short pulsed trill. */
  private insects(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = 4200 + this.rand() * 900;
    const am = ctx.createOscillator();
    am.frequency.value = 38 + this.rand() * 12;
    const amGain = ctx.createGain();
    amGain.gain.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.012 * this.layers.insects, t0 + 0.05);
    g.gain.linearRampToValueAtTime(0.0001, t0 + 0.6 + this.rand() * 0.5);
    am.connect(amGain).connect(g.gain);
    o.connect(g).connect(this.master);
    o.start(t0);
    am.start(t0);
    o.stop(t0 + 1.2);
    am.stop(t0 + 1.2);
  }

  /** Metres to the nearest water drive the river's level (a few times a second is plenty). */
  setWaterDistance(metres: number): void {
    if (!this.ctx || !this.waterGain) return;
    const near = Math.max(0, 1 - metres / 70);
    const level = (0.05 + 0.3 * this.layers.water) * near * near + 0.02 * this.layers.water;
    this.waterGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.4);
  }

  cue(name: WorldCue): void {
    const c = CUE_IDS[name];
    this.synth?.playCue(c.id, { gain: c.gain, pitch: c.pitch });
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.1);
  }

  dispose(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.synth?.close();
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}

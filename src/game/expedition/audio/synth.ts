/**
 * src/game/expedition/audio/synth.ts (S1) — renders the cue bank's recipes with WebAudio (docs/design/20 §2.12).
 * No samples, no bytes: every sound is oscillators, filtered noise and FM. Only `bus.ts` creates a Synth, and only
 * after a user gesture with sound enabled, so node (Vitest) and `EXPEDITION_SFX=off` never touch WebAudio.
 */
import { MUSIC_PADS, RECIPES, cueFor, repeatOffsets, type Voice } from "./cues";

export interface SynthApi {
  /** one-shot cue; false when the id is unmapped or a loop */
  playCue(id: string, opts?: { gain?: number; pitch?: number }): boolean;
  /** start (idempotent) a loop cue under `key` */
  startLoop(key: string, cueId: string): boolean;
  /** live params for a running loop; smoothed over 50 ms */
  setLoop(key: string, pitch: number, gain: number): void;
  stopLoop(key: string): void;
  loopKeys(): string[];
  /** the segment / cutscene music pad (null: silence) */
  setPad(cue: string | null): void;
  setMaster(gain: number): void;
  close(): void;
}

const SMOOTH_TAU = 0.05 / 3; // setTargetAtTime reaches ~95 % in 50 ms
const FLOOR = 0.0001;

export function createSynth(ctx: AudioContext, destination?: AudioNode): SynthApi {
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(destination ?? ctx.destination);

  let noise: AudioBuffer | null = null;
  const noiseBuffer = (): AudioBuffer => {
    if (noise) return noise;
    const len = ctx.sampleRate; // 1 s
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let seed = 0x2f6b1a3d;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0; // LCG: deterministic noise
      data[i] = (seed / 0xffffffff) * 2 - 1;
    }
    noise = buf;
    return buf;
  };

  function envelope(g: GainNode, t0: number, v: Extract<Voice, { durMs: number }>, peak: number, swell = false): number {
    const attack = Math.max(0.002, (("attackMs" in v ? v.attackMs : undefined) ?? 3) / 1000);
    const dur = Math.max(attack + 0.005, v.durMs / 1000);
    g.gain.setValueAtTime(FLOOR, t0);
    if (swell) {
      g.gain.linearRampToValueAtTime(peak, t0 + dur / 2);
      g.gain.linearRampToValueAtTime(FLOOR, t0 + dur);
    } else {
      g.gain.linearRampToValueAtTime(peak, t0 + attack);
      g.gain.exponentialRampToValueAtTime(FLOOR, t0 + dur);
    }
    return t0 + dur;
  }

  function voice(v: Voice, start: number, pitch: number, gainMul: number, out: AudioNode): void {
    const t0 = start + v.atMs / 1000;
    const g = ctx.createGain();
    g.connect(out);
    if (v.kind === "osc") {
      const o = ctx.createOscillator();
      o.type = v.wave;
      o.frequency.setValueAtTime(v.freq * pitch, t0);
      const end = envelope(g, t0, v, v.gain * gainMul);
      if (v.freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1, v.freqEnd * pitch), end);
      if (v.comb) {
        const delay = ctx.createDelay(0.1);
        delay.delayTime.value = v.comb.delayMs / 1000;
        const fb = ctx.createGain();
        fb.gain.value = v.comb.feedback;
        o.connect(g);
        g.connect(delay);
        delay.connect(fb);
        fb.connect(delay);
        delay.connect(out);
        o.onended = () => {
          fb.disconnect();
          delay.disconnect();
        };
      } else {
        o.connect(g);
      }
      o.start(t0);
      o.stop(end + 0.05);
    } else if (v.kind === "noise") {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer();
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = v.filter;
      f.frequency.setValueAtTime(v.freq * pitch, t0);
      if (v.q) f.Q.value = v.q;
      const end = envelope(g, t0, v, v.gain * gainMul, v.swell);
      if (v.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(1, v.freqEnd * pitch), end);
      src.connect(f);
      f.connect(g);
      src.start(t0);
      src.stop(end + 0.05);
    } else {
      const car = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      const f = v.freq * pitch;
      car.frequency.setValueAtTime(f, t0);
      mod.frequency.setValueAtTime(f * v.ratio, t0);
      const dur = v.durMs / 1000;
      modGain.gain.setValueAtTime(v.indexStart * f * v.ratio, t0);
      modGain.gain.linearRampToValueAtTime(Math.max(FLOOR, v.indexEnd * f * v.ratio), t0 + dur);
      mod.connect(modGain);
      modGain.connect(car.frequency);
      car.connect(g);
      const end = envelope(g, t0, v, v.gain * gainMul);
      car.start(t0);
      mod.start(t0);
      car.stop(end + 0.05);
      mod.stop(end + 0.05);
    }
  }

  interface Loop {
    oscs: OscillatorNode[];
    base: number[];
    gain: GainNode;
    cuePitch: number;
    cueGain: number;
  }
  const loops = new Map<string, Loop>();
  let pad: { oscs: OscillatorNode[]; gain: GainNode; cue: string } | null = null;

  return {
    playCue(id, opts) {
      const c = cueFor(id);
      if (!c) return false;
      const rec = RECIPES[c.recipe];
      if (rec.loop) return false;
      const now = ctx.currentTime + 0.005;
      const pitch = (c.pitch ?? 1) * (opts?.pitch ?? 1);
      const gain = (c.gain ?? 1) * (opts?.gain ?? 1);
      for (const off of repeatOffsets(id)) for (const v of rec.voices) voice(v, now + off / 1000, pitch, gain, master);
      return true;
    },
    startLoop(key, cueId) {
      if (loops.has(key)) return true;
      const c = cueFor(cueId);
      if (!c || !RECIPES[c.recipe].loop) return false;
      const g = ctx.createGain();
      g.gain.value = FLOOR;
      g.connect(master);
      const oscs: OscillatorNode[] = [];
      const base: number[] = [];
      for (const v of RECIPES[c.recipe].voices) {
        if (v.kind !== "osc") continue;
        const o = ctx.createOscillator();
        o.type = v.wave;
        o.frequency.value = v.freq * (c.pitch ?? 1);
        const vg = ctx.createGain();
        vg.gain.value = v.gain;
        o.connect(vg);
        vg.connect(g);
        o.start();
        oscs.push(o);
        base.push(v.freq);
      }
      loops.set(key, { oscs, base, gain: g, cuePitch: c.pitch ?? 1, cueGain: c.gain ?? 1 });
      return true;
    },
    setLoop(key, pitch, gain) {
      const l = loops.get(key);
      if (!l) return;
      const t = ctx.currentTime;
      l.oscs.forEach((o, i) => o.frequency.setTargetAtTime(Math.max(1, l.base[i] * l.cuePitch * pitch), t, SMOOTH_TAU));
      l.gain.gain.setTargetAtTime(Math.max(FLOOR, Math.min(1, gain * l.cueGain)), t, SMOOTH_TAU);
    },
    stopLoop(key) {
      const l = loops.get(key);
      if (!l) return;
      loops.delete(key);
      const t = ctx.currentTime;
      l.gain.gain.setTargetAtTime(FLOOR, t, SMOOTH_TAU);
      for (const o of l.oscs) o.stop(t + 0.2);
      setTimeout(() => l.gain.disconnect(), 300);
    },
    loopKeys() {
      return [...loops.keys()];
    },
    setPad(cue) {
      if (pad && pad.cue === cue) return;
      if (pad) {
        const old = pad;
        pad = null;
        const t = ctx.currentTime;
        old.gain.gain.setTargetAtTime(FLOOR, t, 0.4);
        for (const o of old.oscs) o.stop(t + 2);
        setTimeout(() => old.gain.disconnect(), 2200);
      }
      const spec = cue ? MUSIC_PADS[cue] : null;
      if (!cue || !spec) return;
      const g = ctx.createGain();
      g.gain.value = FLOOR;
      g.connect(master);
      const oscs = [spec.root, spec.third, spec.root * 1.5].map((f) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        o.connect(g);
        o.start();
        return o;
      });
      g.gain.setTargetAtTime(spec.gain, ctx.currentTime, 0.8);
      pad = { oscs, gain: g, cue };
    },
    setMaster(gain) {
      master.gain.setTargetAtTime(Math.max(FLOOR, gain), ctx.currentTime, SMOOTH_TAU);
    },
    close() {
      for (const k of [...loops.keys()]) this.stopLoop(k);
      this.setPad(null);
      void ctx.close().catch(() => undefined);
    },
  };
}

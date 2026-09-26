/**
 * src/game/expedition/audio/bus.ts (S1) — the audio bus: an external store (enabled, muted, unlocked, master gain)
 * plus the loop registry (docs/design/20 §2.12).
 *
 * Silent unless ALL of: `enabled` (the `sfx` prop: EXPEDITION_SFX ≠ off, and not `?mute=1`), not muted (HUD toggle N,
 * persisted in localStorage), and `unlock()` ran on a user gesture in a browser with WebAudio. In node (Vitest) there
 * is no AudioContext, so nothing is ever created. `AUDIO_MODE` (the ElevenLabs pipeline flag) is unrelated.
 */
import type { AudioParam } from "../../../world/types";
import { cueFor, isLoopCue } from "./cues";
import { createSynth, type SynthApi } from "./synth";

export const MUTE_STORAGE_KEY = "expedition:muted";

export interface AudioBusSnapshot {
  enabled: boolean;
  muted: boolean;
  unlocked: boolean;
  /** enabled && !muted && unlocked */
  audible: boolean;
  masterGain: number;
  version: number;
}

export interface MuteStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface AudioBusOptions {
  /** the `sfx` prop (EXPEDITION_SFX ≠ off) combined with `?mute=1` via `sfxEnabled()` */
  enabled: boolean;
  /** creates the AudioContext on the first gesture; default: the browser's AudioContext, or null (node) */
  createContext?: () => AudioContext | null;
  /** renders recipes; default: the WebAudio synth */
  createSynth?: (ctx: AudioContext) => SynthApi;
  /** mute persistence; default: window.localStorage when available */
  storage?: MuteStore | null;
  masterGain?: number;
}

/** EXPEDITION_SFX (server env → `sfx` prop) and `?mute=1` → whether the bus may make sound at all. */
export function sfxEnabled(sfxProp: boolean | undefined, search?: string | URLSearchParams | null): boolean {
  if (sfxProp === false) return false;
  if (search) {
    const params = typeof search === "string" ? new URLSearchParams(search) : search;
    const mute = params.get("mute");
    if (mute === "1" || mute === "true") return false;
  }
  return true;
}

function defaultContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: new () => AudioContext; webkitAudioContext?: new () => AudioContext };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

function defaultStorage(): MuteStore | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export class AudioBus {
  private readonly enabled: boolean;
  private muted: boolean;
  private masterGain: number;
  private ctx: AudioContext | null = null;
  private synth: SynthApi | null = null;
  private readonly makeContext: () => AudioContext | null;
  private readonly makeSynth: (ctx: AudioContext) => SynthApi;
  private readonly storage: MuteStore | null;
  private listeners = new Set<() => void>();
  private version = 0;
  private cached: AudioBusSnapshot | null = null;
  /** owner → loop keys it holds (`${owner}:${cue}`) */
  private owners = new Map<string, Set<string>>();
  private padCue: string | null = null;
  private played: string[] = [];

  constructor(opts: AudioBusOptions) {
    this.enabled = opts.enabled;
    this.makeContext = opts.createContext ?? defaultContext;
    this.makeSynth = opts.createSynth ?? ((ctx) => createSynth(ctx));
    this.storage = opts.storage === undefined ? defaultStorage() : opts.storage;
    this.masterGain = opts.masterGain ?? 0.8;
    let stored = false;
    try {
      stored = this.storage?.getItem(MUTE_STORAGE_KEY) === "1";
    } catch {
      stored = false;
    }
    this.muted = stored;
  }

  // -------------------------------------------------------------- store

  snapshot(): AudioBusSnapshot {
    if (this.cached && this.cached.version === this.version) return this.cached;
    const unlocked = this.synth !== null;
    this.cached = {
      enabled: this.enabled,
      muted: this.muted,
      unlocked,
      audible: this.enabled && !this.muted && unlocked,
      masterGain: this.masterGain,
      version: this.version,
    };
    return this.cached;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private changed(): void {
    this.version++;
    for (const fn of [...this.listeners]) fn();
  }

  // -------------------------------------------------------------- lifecycle

  /** Call from a user gesture (keydown, pointerdown). Creates the AudioContext once, only when enabled. */
  unlock(): void {
    if (!this.enabled) return;
    if (this.synth) {
      if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume().catch(() => undefined);
      return;
    }
    const ctx = this.makeContext();
    if (!ctx) return;
    this.ctx = ctx;
    this.synth = this.makeSynth(ctx);
    this.synth.setMaster(this.muted ? 0 : this.masterGain);
    if (this.padCue && !this.muted) this.synth.setPad(this.padCue);
    this.changed();
  }

  dispose(): void {
    this.synth?.close();
    this.synth = null;
    this.ctx = null;
    this.owners.clear();
    this.changed();
  }

  // -------------------------------------------------------------- mute

  setMuted(muted: boolean): void {
    if (muted === this.muted) return;
    this.muted = muted;
    try {
      this.storage?.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
    } catch {
      // storage blocked: the toggle still works for this session
    }
    if (this.synth) {
      this.synth.setMaster(muted ? 0 : this.masterGain);
      if (muted) {
        for (const k of this.synth.loopKeys()) this.synth.stopLoop(k);
        this.synth.setPad(null);
      } else if (this.padCue) {
        this.synth.setPad(this.padCue);
      }
    }
    if (muted) this.owners.clear();
    this.changed();
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private audible(): boolean {
    return this.enabled && !this.muted && this.synth !== null;
  }

  // -------------------------------------------------------------- sound

  /** A one-shot cue. Returns true only when it was actually scheduled. */
  play(cueId: string, opts?: { gain?: number; pitch?: number }): boolean {
    if (!this.audible() || !this.synth) return false;
    if (!cueFor(cueId) || isLoopCue(cueId)) return false;
    const ok = this.synth.playCue(cueId, opts);
    if (ok) this.played.push(cueId);
    return ok;
  }

  /**
   * The loops an owner (a station controller, a sandbox) wants this frame, from `meta.audio(pose)`. Starts new
   * ones, updates params (smoothed 50 ms), stops the ones no longer listed. Call with [] to release.
   */
  setLoops(owner: string, params: readonly AudioParam[]): void {
    const synth = this.synth;
    if (!this.audible() || !synth) return;
    const want = new Set<string>();
    for (const p of params) {
      if (!isLoopCue(p.cue)) continue;
      const key = `${owner}:${p.cue}`;
      want.add(key);
      if (synth.startLoop(key, p.cue)) synth.setLoop(key, p.pitch ?? 1, p.gain ?? 1);
    }
    const had = this.owners.get(owner);
    if (had) for (const k of had) if (!want.has(k)) synth.stopLoop(k);
    if (want.size > 0) this.owners.set(owner, want);
    else this.owners.delete(owner);
  }

  /** Release every loop of an owner (or all owners). */
  clearLoops(owner?: string): void {
    const owners = owner === undefined ? [...this.owners.keys()] : [owner];
    for (const o of owners) {
      const keys = this.owners.get(o);
      if (keys && this.synth) for (const k of keys) this.synth.stopLoop(k);
      this.owners.delete(o);
    }
  }

  /** Segment / cutscene music (a quiet pad); null is silence. Remembered while muted or locked. */
  music(cue: string | null): void {
    this.padCue = cue;
    if (this.audible() && this.synth) this.synth.setPad(cue);
  }

  /** Cue ids actually scheduled so far (debug, e2e: `__GAME_DEBUG__`). */
  playedCues(): readonly string[] {
    return this.played;
  }
}

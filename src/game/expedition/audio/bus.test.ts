import { describe, expect, it, vi } from "vitest";
import { AudioBus, MUTE_STORAGE_KEY, sfxEnabled, type MuteStore } from "./bus";
import type { SynthApi } from "./synth";

function fakeSynth() {
  const calls: string[] = [];
  const loops = new Set<string>();
  const synth: SynthApi = {
    playCue: (id) => (calls.push(`play:${id}`), true),
    startLoop: (key) => (loops.add(key), calls.push(`start:${key}`), true),
    setLoop: (key, p, g) => void calls.push(`set:${key}:${p}:${g}`),
    stopLoop: (key) => (loops.delete(key), void calls.push(`stop:${key}`)),
    loopKeys: () => [...loops],
    setPad: (cue) => void calls.push(`pad:${cue}`),
    setMaster: (g) => void calls.push(`master:${g}`),
    close: () => void calls.push("close"),
  };
  return { synth, calls, loops };
}
const memStore = (): MuteStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};
const fakeCtx = () => ({ state: "running", resume: () => Promise.resolve() }) as unknown as AudioContext;

describe("sfxEnabled", () => {
  it("EXPEDITION_SFX=off (sfx=false) and ?mute=1 silence the bus", () => {
    expect(sfxEnabled(true, "")).toBe(true);
    expect(sfxEnabled(undefined, null)).toBe(true);
    expect(sfxEnabled(false, "")).toBe(false);
    expect(sfxEnabled(true, "?mute=1")).toBe(false);
    expect(sfxEnabled(true, new URLSearchParams("express=1&mute=true"))).toBe(false);
  });
});

describe("AudioBus", () => {
  it("is silent in node: the default context factory creates nothing", () => {
    const bus = new AudioBus({ enabled: true, storage: null });
    bus.unlock();
    expect(bus.snapshot().unlocked).toBe(false);
    expect(bus.play("ui_select")).toBe(false);
    expect(bus.snapshot().audible).toBe(false);
  });

  it("never creates an AudioContext when disabled (EXPEDITION_SFX=off)", () => {
    const createContext = vi.fn(fakeCtx);
    const bus = new AudioBus({ enabled: false, storage: null, createContext });
    bus.unlock();
    expect(createContext).not.toHaveBeenCalled();
    expect(bus.play("ui_verify")).toBe(false);
    bus.setLoops("e1", [{ cue: "beam_hum", pitch: 1 }]);
    bus.music("calm");
    expect(bus.snapshot()).toMatchObject({ enabled: false, audible: false });
  });

  it("plays only after unlock, only mapped one-shots", () => {
    const f = fakeSynth();
    const bus = new AudioBus({ enabled: true, storage: null, createContext: fakeCtx, createSynth: () => f.synth });
    expect(bus.play("ui_select")).toBe(false); // before the gesture
    bus.unlock();
    expect(bus.snapshot().audible).toBe(true);
    expect(bus.play("ui_select")).toBe(true);
    expect(bus.play("not_a_cue")).toBe(false);
    expect(bus.play("beam_hum")).toBe(false); // loops go through setLoops
    expect(bus.playedCues()).toEqual(["ui_select"]);
  });

  it("mute persists, silences, stops loops and restores the pad", () => {
    const store = memStore();
    const f = fakeSynth();
    const bus = new AudioBus({ enabled: true, storage: store, createContext: fakeCtx, createSynth: () => f.synth });
    bus.unlock();
    bus.music("calm");
    bus.setLoops("e1", [{ cue: "beam_hum", pitch: 1.2, gain: 0.5 }]);
    expect(f.loops.has("e1:beam_hum")).toBe(true);
    expect(bus.toggleMute()).toBe(true);
    expect(store.data.get(MUTE_STORAGE_KEY)).toBe("1");
    expect(f.loops.size).toBe(0);
    expect(bus.play("ui_select")).toBe(false);
    bus.setLoops("e1", [{ cue: "beam_hum" }]);
    expect(f.loops.size).toBe(0);
    bus.toggleMute();
    expect(f.calls.filter((c) => c === "pad:calm").length).toBe(2);
    const again = new AudioBus({ enabled: true, storage: store, createContext: fakeCtx, createSynth: () => f.synth });
    expect(again.snapshot().muted).toBe(false);
    store.setItem(MUTE_STORAGE_KEY, "1");
    expect(new AudioBus({ enabled: true, storage: store }).snapshot().muted).toBe(true);
  });

  it("setLoops starts, updates and stops loops per owner", () => {
    const f = fakeSynth();
    const bus = new AudioBus({ enabled: true, storage: null, createContext: fakeCtx, createSynth: () => f.synth });
    bus.unlock();
    bus.setLoops("e3", [{ cue: "bell_hum", pitch: 2, gain: 0.3 }, { cue: "ui_select" }]);
    expect([...f.loops]).toEqual(["e3:bell_hum"]);
    expect(f.calls).toContain("set:e3:bell_hum:2:0.3");
    bus.setLoops("e3", [{ cue: "sync_hum" }]);
    expect([...f.loops]).toEqual(["e3:sync_hum"]);
    bus.setLoops("mb", [{ cue: "mb_tone", pitch: 1.5 }]);
    bus.clearLoops("e3");
    expect([...f.loops]).toEqual(["mb:mb_tone"]);
    bus.clearLoops();
    expect(f.loops.size).toBe(0);
  });

  it("notifies subscribers with stable snapshots", () => {
    const bus = new AudioBus({ enabled: true, storage: null });
    const s0 = bus.snapshot();
    expect(bus.snapshot()).toBe(s0);
    const fn = vi.fn();
    bus.subscribe(fn);
    bus.setMuted(true);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(bus.snapshot()).not.toBe(s0);
    bus.setMuted(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

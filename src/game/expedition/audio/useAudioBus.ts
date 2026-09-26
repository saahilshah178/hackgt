"use client";
/**
 * src/game/expedition/audio/useAudioBus.ts (S1) — React bindings for the audio bus (an external store).
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { AudioBus, AudioBusSnapshot } from "./bus";

const SILENT: AudioBusSnapshot = { enabled: false, muted: true, unlocked: false, audible: false, masterGain: 0, version: -1 };
const noop = () => () => undefined;

export function useAudioBusSnapshot(bus: AudioBus | null): AudioBusSnapshot {
  const subscribe = useCallback((fn: () => void) => (bus ? bus.subscribe(fn) : noop()), [bus]);
  const get = useCallback(() => (bus ? bus.snapshot() : SILENT), [bus]);
  return useSyncExternalStore(subscribe, get, get);
}

/** Unlocks the bus (creates the AudioContext) on the first user gesture; no-op when sound is disabled. */
export function useAudioUnlock(bus: AudioBus | null): void {
  useEffect(() => {
    if (!bus || typeof window === "undefined" || !bus.snapshot().enabled) return;
    const unlock = () => {
      bus.unlock();
      if (bus.snapshot().unlocked) {
        window.removeEventListener("pointerdown", unlock, true);
        window.removeEventListener("keydown", unlock, true);
      }
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, [bus]);
}

"use client";
/**
 * src/game/expedition/dialogue/useDialogue.ts (S1) — React bindings for the dialogue engine (an external store).
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { DialogueEngineApi, DialogueSnapshot } from "./types";

/** Subscribes to the engine; re-renders only when its snapshot version changes. */
export function useDialogueSnapshot(engine: DialogueEngineApi): DialogueSnapshot {
  const subscribe = useCallback((fn: () => void) => engine.subscribe(fn), [engine]);
  const get = useCallback(() => engine.snapshot(), [engine]);
  return useSyncExternalStore(subscribe, get, get);
}

/** Drives `engine.tick(performance.now())` every animation frame while mounted (typewriter + toast timers). */
export function useDialogueClock(engine: DialogueEngineApi, enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let raf = 0;
    const loop = () => {
      engine.tick(performance.now());
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [engine, enabled]);
}

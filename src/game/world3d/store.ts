"use client";

import { useSyncExternalStore } from "react";

/*
 * A tiny external store for the per-frame state of a world3d game (player pose, the nearest interaction target, npc
 * and animal positions). The render loop writes it without touching React; HUD components subscribe with a selector
 * and re-render only when their slice changes (the loop publishes at ~12 Hz, not 60).
 */

export interface Store<T> {
  get(): T;
  set(patch: Partial<T> | ((s: T) => Partial<T>)): void;
  subscribe(fn: () => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...next };
      listeners.forEach((l) => l());
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export function useStore<T extends object, S>(store: Store<T>, select: (s: T) => S): S {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(store.get()),
  );
}

export interface Pose {
  x: number;
  y: number;
  z: number;
  /** body yaw in radians (0 = facing +z) */
  yaw: number;
}

export type TargetKind = "npc" | "moment" | "collectible" | "animal" | "goal";

/** Something the player can press E on. */
export interface Target {
  kind: TargetKind;
  /** npc id, encounter id (landmark moments), collectible id, animal id, or the goal landmark id */
  id: string;
  /** the verb phrase after "E ·" ("Talk to Nebet", "Read the South Obelisk") */
  label: string;
  x: number;
  y: number;
  z: number;
}

export interface Live {
  player: Pose;
  /** camera yaw in radians (the compass and minimap rotate with it) */
  cameraYaw: number;
  target: Target | null;
  npcs: Record<string, Pose>;
  animals: { id: string; kind: string; x: number; y: number; z: number }[];
  /** frames per second, sampled once a second (the pause menu shows it) */
  fps: number;
  /** per npc: close enough for the name tag, and the bark they are saying (changes rarely) */
  npcUi: Record<string, { near: boolean; bark: string | null }>;
}

export function createLive(spawn: Pose): Store<Live> {
  return createStore<Live>({ player: spawn, cameraYaw: spawn.yaw + Math.PI, target: null, npcs: {}, animals: [], fps: 0, npcUi: {} });
}

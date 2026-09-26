/**
 * debug-api.ts (H1) — attaches the host half of `__GAME_DEBUG__` (docs/design/20 §2.10): `host.playerX` and the
 * `expedition` host hooks (`host()`, `walkTo`, `useLink`, `interact`, `freeze`, `skipCutscene`, plus host-only probes).
 * H2's debug.ts owns the rest of `expedition` (phase, dialogue, worldState, openPanel, …) and merges these fields; the
 * installer re-attaches if a later `installGameDebug` replaces the object. Dev builds or `?debug=1` only.
 */
import type { ExpeditionHostDebug, HostHandle } from "../types";

export interface HostDebugExtras {
  interact(): void;
  freeze(on: boolean): void;
  layers?(): { set: string; alpha: number; scrollFactor: number }[];
  facadeAlpha?(id: string): number | null;
  capturing?(): boolean;
  renderer: "webgl" | "dom";
}
export interface ExpeditionHostDebugApi {
  host(): ExpeditionHostDebug | null;
  walkTo(x: number, surface?: string): Promise<void>;
  useLink(id: string): Promise<void>;
  interact(): void;
  freeze(on: boolean): void;
  skipCutscene(): void;
  warpTo(encounterId: string | null): void;
  renderer(): "webgl" | "dom";
  layers(): { set: string; alpha: number; scrollFactor: number }[];
  facadeAlpha(id: string): number | null;
  capturing(): boolean;
}

type DebugRoot = Record<string, unknown> & { host?: Record<string, unknown>; expedition?: Record<string, unknown> };
/** Not a Window intersection: e2e specs declare their own global shape for __GAME_DEBUG__ (see src/game/debug.ts). */
type DebugHolder = { __GAME_DEBUG__?: DebugRoot };

export function debugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV !== "production") return true;
  try {
    return new URLSearchParams(window.location.search).get("debug") === "1";
  } catch {
    return false;
  }
}

export function makeHostDebugApi(handle: HostHandle, extras: HostDebugExtras): ExpeditionHostDebugApi {
  return {
    host: () => handle.debug?.() ?? null,
    walkTo: (x, surface) => handle.walkTo?.(x, surface) ?? Promise.resolve(),
    useLink: (id) => handle.useLink?.(id) ?? Promise.resolve(),
    interact: () => extras.interact(),
    freeze: (on) => extras.freeze(on),
    skipCutscene: () => handle.skipCutscene?.(),
    warpTo: (id) => handle.warpTo(id),
    renderer: () => extras.renderer,
    layers: () => extras.layers?.() ?? [],
    facadeAlpha: (id) => extras.facadeAlpha?.(id) ?? null,
    capturing: () => extras.capturing?.() ?? false,
  };
}

/** Installs (and keeps installed) the host debug fields; returns a cleanup. */
export function installHostDebug(api: ExpeditionHostDebugApi): () => void {
  if (!debugEnabled()) return () => {};
  const w = window as unknown as DebugHolder;
  const attach = () => {
    const root: DebugRoot = (w.__GAME_DEBUG__ ??= {});
    root.host = { ...(root.host ?? {}), playerX: () => api.host()?.playerX ?? 0 };
    const exp = root.expedition ?? {};
    if (exp.host !== api.host) {
      // H2: the client's half (phase, dialogue, openPanel, …) stays; the host's hooks win for the host keys, and
      // `freeze` also pauses the client's clocks (the typewriter) through the client's `freezeClient`.
      const clientFreeze = typeof exp.freezeClient === "function" ? (exp.freezeClient as (on: boolean) => void) : null;
      root.expedition = {
        ...exp,
        ...api,
        freeze: (on: boolean) => {
          api.freeze(on);
          clientFreeze?.(on);
        },
      };
    }
  };
  attach();
  const timer = window.setInterval(() => {
    const root = w.__GAME_DEBUG__;
    if (!root || root.expedition?.host !== api.host) attach();
  }, 500);
  return () => {
    window.clearInterval(timer);
    const root = w.__GAME_DEBUG__;
    if (root?.expedition?.host === api.host) {
      const rest = { ...root.expedition };
      for (const k of Object.keys(api)) delete rest[k];
      root.expedition = rest;
    }
  };
}

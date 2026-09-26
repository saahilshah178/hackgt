/**
 * src/world/sandboxes/placeholder.ts (W0, main) — a neutral live half for sandbox stubs: the console lights while
 * inputs move. SB (after the P0 freeze) replaces it with the Music Box tone, the plant-cell plasmolysis and the darkroom trays.
 */
import { lerpRecord } from "../ease";
import type { Described, PanelLive, SandboxMeta, SandboxPoseInput } from "../types";

export interface SandboxSlatePose {
  lit: number; // 0 dormant … 1 active
  values: number; // sum of the probe values (a cheap visible change)
  placed: number; // tokens placed
}

export function sandboxSlateLive<Config>(): Pick<
  SandboxMeta<Config, SandboxSlatePose, null>,
  "sim" | "pose" | "lerp" | "describe" | "panelLive" | "audio" | "footprint" | "frameBounds" | "debug"
> {
  return {
    sim: null,
    pose: (input: SandboxPoseInput<Config, null>): SandboxSlatePose => ({
      lit: input.draft ? 1 : 0.4,
      values: input.draft ? Object.values(input.draft.values).reduce((a, b) => a + b, 0) : 0,
      placed: input.draft ? Object.keys(input.draft.placed).length : 0,
    }),
    lerp: (a: SandboxSlatePose, b: SandboxSlatePose, t: number) => lerpRecord(a, b, t),
    describe: (pose: SandboxSlatePose): Described => ({
      chips: [],
      pins: [],
      srText: pose.lit > 0.5 ? "The machine hums as you play with it." : "The machine waits.",
      nearMiss: null,
    }),
    panelLive: (): PanelLive => ({ scrubX: null, readout: null, chips: [], highlights: [], liveCards: [] }),
    audio: () => [],
    footprint: () => ({ left: 140, right: 140, height: 240 }),
    frameBounds: () => ({ x: -420, y: -560, w: 840, h: 640 }),
    debug: (pose: SandboxSlatePose) => ({ ...pose }),
  };
}

/**
 * src/world/contraptions/placeholder.ts (W0, main) — "console_slate semantics" for stub metas.
 *
 * Every archetype ships in W0 with its REAL config/writer/validator/default half and this placeholder live half:
 * the world shows a lectern slate that mirrors the draft and a gate that opens on success. The K lanes replace
 * `...slateLive(...)` in their meta with the real pose/lerp/describe/panel/plan functions (§4, §7.4) and then stop
 * importing this file. Nothing here reads params or solutions.
 */
import { lerpRecord } from "../ease";
import type {
  Bounds,
  ContraptionMeta,
  ContraptionSkin,
  Described,
  FailurePlan,
  Footprint2D,
  HintRung,
  HintTarget,
  PanelLive,
  PanelStatic,
  PoseInput,
  StaticInput,
  SuccessPlan,
} from "../types";
import type { ProbeSpec } from "../../contracts/world";

/** The console-slate pose: slate brightness, what the slate mirrors, and the gate behind it. */
export interface SlatePose {
  slate: number; // 0 dormant … 1 lit
  mirrors: boolean; // a draft is shown on the slate
  complete: boolean; // the draft could be verified
  gate: number; // 0 closed … 1 open
  solved: boolean;
}

export const SLATE_FOOTPRINT: Footprint2D = { left: 140, right: 140, height: 240 };
export const SLATE_FRAME: Bounds = { x: -420, y: -560, w: 840, h: 640 };

function skinFor(skins: readonly ContraptionSkin[], skinId: string): ContraptionSkin | null {
  return skins.find((s) => s.id === skinId) ?? skins[0] ?? null;
}

export function slatePose(input: PoseInput<unknown, unknown>): SlatePose {
  const hasDraft = input.draft !== null;
  return {
    slate: input.solved ? 1 : hasDraft ? 0.9 : 0.45,
    mirrors: hasDraft,
    complete: input.draft?.complete ?? false,
    gate: input.solved ? 1 : 0,
    solved: input.solved,
  };
}

export function slateDescribe(pose: SlatePose): Described {
  const srText = pose.solved
    ? "The gate behind the console slate stands open."
    : pose.mirrors
      ? "The console slate mirrors your answer; the gate behind it waits."
      : "The console slate is dim; the gate behind it is closed.";
  return { chips: [], pins: [], srText, nearMiss: null };
}

export const EMPTY_PANEL_STATIC: PanelStatic = { cards: [], input: null, probe: null, recordPins: [] };
export const EMPTY_PANEL_LIVE: PanelLive = { scrubX: null, readout: null, chips: [], highlights: [], liveCards: [] };

/**
 * The live half of a meta with console-slate behaviour. `probeOf` lets a stub still expose its config's real probe
 * (probe specs are config data, so the Scrubber and record_lens work before the prefab is native).
 */
export function slateLive<Config>(
  skins: readonly ContraptionSkin[],
  probeOf: (config: Config) => ProbeSpec | null = () => null,
): Pick<
  ContraptionMeta<Config, SlatePose, null>,
  | "footprint" | "frameBounds" | "probe" | "clock" | "sim" | "pose" | "lerp" | "describe" | "panelStatic" | "panelLive"
  | "hintTargets" | "audio" | "failurePlan" | "successPlan" | "solvedPose" | "debug"
> {
  return {
    footprint: () => SLATE_FOOTPRINT,
    frameBounds: () => SLATE_FRAME,
    probe: (config: Config) => probeOf(config),
    clock: null,
    sim: null,
    pose: (input: PoseInput<Config, null>) => slatePose(input as PoseInput<unknown, unknown>),
    lerp: (from: SlatePose, to: SlatePose, t: number) => lerpRecord(from, to, t),
    describe: (pose: SlatePose) => slateDescribe(pose),
    panelStatic: (input: StaticInput<Config>): PanelStatic => ({ ...EMPTY_PANEL_STATIC, probe: probeOf(input.config) }),
    panelLive: (_stat: PanelStatic, input: PoseInput<Config, null>): PanelLive => ({ ...EMPTY_PANEL_LIVE, scrubX: input.probe }),
    hintTargets: (rung: HintRung, input: StaticInput<Config>): readonly HintTarget[] => skinFor(skins, input.skinId)?.hintTargets[rung - 1] ?? [],
    audio: () => [],
    failurePlan: (): FailurePlan => ({
      beats: [{ atMs: 0, anchor: "slate", action: "flash" }],
      durationMs: 800,
      cue: skins[0]?.cues.fail ?? "latch_slip",
    }),
    successPlan: (): SuccessPlan => ({
      beats: [
        { atMs: 0, anchor: "slate", action: "ignite" },
        { atMs: 500, anchor: "gate", action: "open" },
      ],
      cardEffects: [],
      durationMs: 1400,
      cue: skins[0]?.cues.succeed ?? "ui_badge",
    }),
    solvedPose: (input: PoseInput<Config, null>) => ({ ...slatePose(input as PoseInput<unknown, unknown>), gate: 1, slate: 1, solved: true }),
    debug: (pose: SlatePose) => ({ ...pose }),
  };
}

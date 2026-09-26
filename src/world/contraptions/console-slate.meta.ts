/**
 * console_slate — the universal fallback (docs/design/20 §4 row 13): a lectern whose slate mirrors the existing
 * widget (WidgetControl); the gate behind it lifts on success. It accepts every implemented mode, every layout and
 * every payoff animation so the fallback ladder (§0.1.6 rung 3) can swap any station onto it.
 * `modes` is filled by src/world/library.ts from the mechanics registry (metas may not import mechanics modes).
 * Owned by H1 (§7.2): the live half is native (no placeholder import); nothing here reads params or solutions.
 */
import { PAYOFF_ANIMS } from "../../contracts/world";
import { lerpRecord } from "../ease";
import type { ContraptionMeta, Described, FailurePlan, HintRung, HintTarget, PanelLive, PanelStatic, PoseInput, StaticInput, SuccessPlan } from "../types";
import { defineSkin } from "./skin-kit";
import { ConsoleSlateConfig } from "./console-slate.config";
export { ConsoleSlateConfig } from "./console-slate.config";

export const CONSOLE_SLATE_SKINS = [
  defineSkin({
    id: "lectern_slate",
    name: "Console Slate",
    ns: "shared",
    biomes: "any",
    nouns: ["console", "slate", "lectern", "gate"],
    parts: [["lectern", "K"], ["slate", "K"], ["gate", "K"], ["console", "K"]],
    anchors: ["slate", "gate", "console"],
    cues: { live: null, succeed: "ui_badge", fail: "latch_slip" },
    sensitiveSafe: true,
    hintAnchors: ["slate", "slate", "gate"],
  }),
] as const;

/** The slate pose: brightness, what it mirrors, the Verify invitation pulse, the aid lamp and the gate behind it. */
export interface ConsoleSlatePose {
  slate: number; // 0 dormant … 1 lit
  mirrors: boolean; // a draft is shown on the slate
  complete: boolean; // the draft could be verified
  pulse: number; // 0…1 glow while a complete draft waits for Verify
  aid: number; // 0…1 the hint lamp (aid tier / 2)
  gate: number; // 0 closed … 1 open
  solved: boolean;
}

export const CONSOLE_SLATE_FOOTPRINT = { left: 140, right: 140, height: 240 } as const;
export const CONSOLE_SLATE_FRAME = { x: -420, y: -560, w: 840, h: 640 } as const;
export const EMPTY_STATIC: PanelStatic = { cards: [], input: null, probe: null, recordPins: [] };

function skinFor(skinId: string) {
  return CONSOLE_SLATE_SKINS.find((s) => s.id === skinId) ?? CONSOLE_SLATE_SKINS[0];
}

export function consoleSlatePose(input: PoseInput<ConsoleSlateConfig, null>): ConsoleSlatePose {
  const hasDraft = input.draft !== null;
  const complete = input.draft?.complete ?? false;
  return {
    slate: input.solved ? 1 : hasDraft ? 0.9 : 0.45,
    mirrors: hasDraft,
    complete,
    pulse: complete && !input.solved && !input.reducedMotion ? 0.5 + 0.5 * Math.sin(2 * Math.PI * input.t) : 0,
    aid: input.aidTier / 2,
    gate: input.solved ? 1 : 0,
    solved: input.solved,
  };
}

export function consoleSlateDescribe(pose: ConsoleSlatePose, input: Pick<PoseInput<ConsoleSlateConfig, null>, "config">): Described {
  const srText = pose.solved
    ? "The gate behind the console slate stands open."
    : pose.complete
      ? "The console slate shows a complete answer; the gate waits for Verify."
      : pose.mirrors
        ? "The console slate mirrors your answer; the gate behind it waits."
        : "The console slate is dim; the gate behind it is closed.";
  const title = input.config.slateTitle;
  return { chips: [], pins: title ? [{ anchor: "slate", text: title, glyph: null }] : [], srText, nearMiss: null };
}

export const consoleSlateMeta: ContraptionMeta<ConsoleSlateConfig, ConsoleSlatePose> = {
  id: "console_slate",
  name: "Console Slate",
  modes: [], // every implemented mode: set by library.ts
  tier: "fallback",
  status: "demo",
  reusable: "any_subject",
  layouts: ["board", "scrub", "vault"],
  defaultLayout: "board",
  payoffs: PAYOFF_ANIMS,
  nearMissKeys: [],
  accessories: [],
  skins: CONSOLE_SLATE_SKINS,
  control: "widget",
  configSchema: ConsoleSlateConfig,
  validateConfig: () => [],
  defaultConfig: () => ConsoleSlateConfig.parse({}),
  writerConfigSchema: () => null,
  fromWriterConfig: () => ConsoleSlateConfig.parse({}),
  footprint: () => CONSOLE_SLATE_FOOTPRINT,
  frameBounds: () => CONSOLE_SLATE_FRAME,
  probe: () => null, // the widget is the whole input
  clock: { resetOn: ["open"] },
  sim: null,
  pose: consoleSlatePose,
  lerp: (from, to, t) => lerpRecord(from, to, t),
  describe: (pose, input) => consoleSlateDescribe(pose, input),
  panelStatic: (): PanelStatic => EMPTY_STATIC,
  panelLive: (): PanelLive => ({ scrubX: null, readout: null, chips: [], highlights: [], liveCards: [] }),
  hintTargets: (rung: HintRung, input: StaticInput<ConsoleSlateConfig>): readonly HintTarget[] => skinFor(input.skinId).hintTargets[rung - 1] ?? [],
  audio: () => [],
  failurePlan: (_d, input): FailurePlan => ({
    beats: [
      { atMs: 0, anchor: "slate", action: "flash" },
      { atMs: 180, anchor: "gate", action: input.reducedMotion ? "dim" : "wobble" },
    ],
    durationMs: 800,
    cue: skinFor("lectern_slate").cues.fail,
  }),
  successPlan: (_input, anim): SuccessPlan => ({
    beats: [
      { atMs: 0, anchor: "slate", action: "ignite" },
      { atMs: 450, anchor: "gate", action: anim === "vault_opens" || anim === "door_opens" ? "open" : "rise" },
    ],
    cardEffects: [],
    durationMs: 1400,
    cue: skinFor("lectern_slate").cues.succeed,
  }),
  solvedPose: (input) => ({ ...consoleSlatePose(input), slate: 1, gate: 1, pulse: 0, solved: true }),
  debug: (pose) => ({ ...pose }),
};

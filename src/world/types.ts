/**
 * src/world/types.ts — the PURE side of the Expedition layer (no Phaser, no React; ESLint enforces it).
 * Source of truth: docs/design/20-expedition-architecture.md (revision 3) §2.5.1–2.5.2 (metas, drafts, panel models,
 * PanelContext, StaticInput.skinId/record, PanelStatic.recordPins), §2.5.4 (Diagnosis), §2.5.5 (sandbox metas),
 * §1.5 (rule ids, ResolvedWorld), §2.4.6 (WorldState), §6.4 (BiomeKit incl. successPose).
 *
 * Main-owned (architecture §7.0). Lanes that need a change here report the exact diff to main.
 * Types that another lane implements live here so every lane compiles against one definition:
 *   - ResolvedWorld / ResolvedStation / ResolvedSandbox → implemented by V1 in src/world/resolve-world.ts
 *   - WorldState / WorldStateEvent / ReqCtx             → implemented by S1 in src/world/state/**
 *   - BiomeKit                                          → implemented by V1 in src/world/biomes.ts
 *   - DiagnoseArgs / Diagnosis / FailKey                → implemented by V1 in src/world/diagnose/**
 */
import type { z } from "zod";
import type { Domain, FamilyId, Issue, VoiceArchetype } from "../contracts/common";
import type { Encounter } from "../contracts/gamespec";
import type {
  Ambient,
  AmbientLight,
  AxisUnit,
  Emblem,
  HintTarget,
  LayerSet,
  LayoutMode,
  MisconceptionProbe,
  PayoffAnim,
  ProbeFormat,
  ProbeSpec,
  RecordStrip,
  Requirement,
  Sandbox,
  Sky,
  Station,
  TraversalLinkKind,
  WorldLine,
  WorldOverlay,
  Zone,
  Npc,
  NpcState,
  Quest,
} from "../contracts/world";
export type { HintTarget } from "../contracts/world"; // the zod type is the one definition (A7)

// ================================================================ keys, tiers

/** "tuner.oscillator": `${familyId}.${mode}`. */
export type ModeKey = `${FamilyId}.${string}`;
export type AidTier = 0 | 1 | 2;
export type HintsUsed = 0 | 1 | 2 | 3;
export type HintRung = 1 | 2 | 3;
// aidTierOf(hintsUsed, failedVerifies) lives in ./aid-tier.ts (the one definition, amendment 10).

// ================================================================ views of the ten showcase modes
// Mirrors of each mode's `present()` output (src/mechanics/families/**, which keep their View types private).
// Metas read views only through these shapes; tests/world-contract.test.ts checks them against the fixtures.

export interface OscillatorView {
  equation: string;
  ask: "period" | "frequency" | "amplitude" | "phase" | "midline";
  askLabel: string;
  wave: "sin" | "cos";
  amplitude: number;
  b: number;
  c: number;
  d: number;
  dial: { min: number; max: number; step: number; ticks: readonly { value: number; label: string }[]; unit: string };
}
export interface FormulaView {
  expression: string;
  outputName: string;
  outputUnit: string;
  fixed: readonly { name: string; value: number; unit: string }[];
  dial: { name: string; unit: string; min: number; max: number; step: number; ticks: readonly { value: number; label: string }[] };
  target: number;
  targetLabel: string;
}
export interface NumberLineView {
  scale: "linear" | "log";
  min: number;
  max: number;
  target: string;
  landmarks: readonly { value: number; fraction: number; label: string }[];
}
export interface MimicView {
  chests: readonly { statementIndex: number; text: string }[];
}
export interface PredictRevealView {
  scenario: string;
  options: readonly { optionIndex: number; text: string }[];
}
export interface LinearView {
  slots: number;
  planks: readonly { key: string; text: string }[]; // steps s0…, decoys d0…
}
export interface BinsView {
  bins: readonly { id: string; label: string }[];
  items: readonly { key: string; text: string }[]; // i0…
}
export interface TypeMatchView {
  categories: readonly { id: string; label: string }[];
  waves: readonly { waveIndex: number; text: string }[];
  secondsPerWave: number;
}
export interface PairsView {
  lefts: readonly { key: string; text: string }[]; // l0…
  rights: readonly { key: string; text: string }[]; // r0…, decoys x0…
}
export interface ChainView {
  nodes: readonly { key: string; text: string }[]; // n0…, decoys d0…
  edgeCount: number;
}
export interface EliminationView {
  question: string;
  hypotheses: readonly { id: string; text: string }[];
  clues: readonly { index: number; text: string }[];
}
export interface ShowcaseViews {
  "tuner.oscillator": OscillatorView;
  "tuner.formula": FormulaView;
  "mapper.number_line": NumberLineView;
  "truth_finder.mimic": MimicView;
  "truth_finder.predict_reveal": PredictRevealView;
  "sequencer.linear": LinearView;
  "sorter.bins": BinsView;
  "sorter.type_match": TypeMatchView;
  "linker.pairs": PairsView;
  "linker.chain": ChainView;
  "investigator.elimination": EliminationView;
}

// ================================================================ drafts (amendment 6)

/** Draft-input shapes per mode: what a control holds while the player works (possibly partial). */
export interface DraftInputs {
  "tuner.oscillator": { value: number };
  "tuner.formula": { value: number };
  "mapper.number_line": { value: number };
  "truth_finder.mimic": { statementIndex: number | null };
  "truth_finder.predict_reveal": { optionIndex: number | null };
  "sequencer.linear": { slots: readonly (string | null)[] }; // one entry per slot, null = empty
  "sorter.bins": { assignments: readonly { itemKey: string; binId: string }[] };
  "sorter.type_match": { answers: readonly { waveIndex: number; categoryId: string }[] };
  "linker.pairs": { links: readonly { leftKey: string; rightKey: string }[] };
  "linker.chain": { edges: readonly { fromKey: string; toKey: string }[] };
  "investigator.elimination": { hypothesisId: string | null };
}
/** The modes with a native DraftInputs shape (every other implemented mode drafts through its widget). */
export type DraftModeKey = keyof DraftInputs;

/** Live, possibly partial player input plus the UI-only channels. */
export interface Draft<D = unknown> {
  encounterId: string;
  modeKey: ModeKey;
  input: D; // a DraftInputs[...] shape (other modes: whatever the widget emits)
  complete: boolean; // toSubmitInput() would produce an Input grade() accepts → enables Verify
  focus: string | null; // keyboard/pointer focus: item key, statementIndex as string, socket key...
  hover: string | null; // hovered-but-not-chosen target (AimControl previews)
  probe: number | null; // the probe channel (amendment 3), ProbeSpec units
  settled: boolean; // pointer up, or 300 ms since the last key
  wave: { index: number; secondsLeft: number; secondsPerWave: number } | null; // WaveControl
  marks: readonly { clueIndex: number; hypothesisId: string }[] | null; // MatrixControl (UI-only)
  seq: number; // strictly increasing per encounter
}
// toSubmitInput(modeKey, input) lives in ./draft-inputs.ts.

// ================================================================ pose inputs, sims

export interface PoseInput<Config, Sim = null> {
  view: unknown; // mode.present(params, seed + index), memoized per encounter index. NEVER params or solution.
  draft: Draft | null; // null = nothing touched yet (idle pose)
  config: Config;
  probe: number | null; // draft?.probe ?? probeSpec.initial ?? probeSpec.min; null without a probe
  t: number; // seconds on the station clock (amendment 4); resets per meta.clock.resetOn
  aidTier: AidTier;
  hintsUsed: HintsUsed; // rung-3-only world actions
  sim: Sim | null; // current sim state, null when the meta has no sim
  solved: boolean; // true only after a correct Verify, or when settled solved (warp, autoSolve, re-entry)
  reducedMotion: boolean;
}
export type StaticInput<Config> = Pick<PoseInput<Config>, "view" | "config" | "aidTier" | "hintsUsed" | "reducedMotion"> & {
  skinId: string; // station.skin (A7): skin-specific hint anchors, card titles
  record: boolean; // the panel shows the RECORD card above this meta's cards (A6): put FILE first, fill recordPins
};

/** Numeric parameters a reference sim takes from its station config (ClaimHoldersConfig.referenceSim.params). */
export type SimParams = Readonly<Record<string, number>>;
export interface SimCtx {
  draft: Draft | null;
  probe: number | null;
  t: number;
  aidTier: AidTier;
}
/** Pure, seeded, fixed-step simulation (amendment 4). Holds MEASURABLE state only (F6): concentrations, flux,
    tracer path, phases. Cosmetic particles, cords and trails live in the prefab, seeded from the same seed. */
export interface SimSpec<Config, State> {
  init(seed: number, config: Config, view: unknown, ctx: SimCtx): State; // seed = spec.seed ^ hash32(encounterId)
  step(state: State, dt: number, ctx: SimCtx): State; // called at fixedDt, ≤ 4 steps per frame
  fixedDt: number; // 1 / 30
  resetOn: readonly ("open" | "probe_change" | "draft_change" | "settle")[];
  readout(state: State): Readonly<Record<string, number>>; // e.g. { cL: 4.1, cR: 0.9, flux: 1.8 }
}

// ================================================================ describe, skins, plans

export type FnColor = "f" | "g" | "h" | "accent" | "gold";
export interface ChipSpec {
  anchor: string;
  text: string;
  color: FnColor;
} // "g(T): 1.7π" at anchor "inner_hub"
export interface PinSpec {
  anchor: string;
  text: string | null;
  glyph: string | null;
}
export interface Described {
  chips: readonly ChipSpec[];
  pins: readonly PinSpec[];
  /** one-sentence world state for screen readers: "The inner notch is 40° from the doorway." */
  srText: string;
  /** a meta.nearMissKeys entry when the pose shows a known misconception state, else null (shown only after a failed Verify) */
  nearMiss: string | null;
}

export interface SnapshotPart {
  asset: string;
  dx: number;
  dy: number;
  rotateDeg?: number;
  alpha?: number;
}
/** One list of companion targets per hint rung (index 0 = rung 1). */
export type HintTargetTable = readonly [readonly HintTarget[], readonly HintTarget[], readonly HintTarget[]];
export interface SkinPart {
  slot: string; // "outer_ring"
  asset: string; // "<ns>.part.<skin>_<slot>" (§5.1); shared parts may point at another skin's key
  hero: boolean; // hand-authored (counts toward the 40-per-namespace cap) vs kit-generated
}
export interface ContraptionSkin {
  id: string; // "vesper_dial"
  name: string; // "Vesper Dial"
  biomes: readonly string[] | "any";
  nouns: readonly string[]; // accepted object nouns for R9
  parts: readonly SkinPart[]; // the art contract (§4.3); all preloaded
  /** anchor names the parts must carry (`id="anchor-<name>"`, §4.3 "Required anchors"); `_0…N` ranges are expanded */
  anchors: readonly string[];
  console: string; // default console asset key
  snapshot: { dormant: readonly SnapshotPart[]; solved: readonly SnapshotPart[] }; // DOM fallback (amendment 31)
  sensitiveSafe: boolean; // no shake, burst or strike fx (R10)
  cues: { live: string | null; succeed: string; fail: string }; // §2.12 cue ids (snake_case, Id-legal)
  /** default companion flights per rung [rung 1, rung 2, rung 3] (A7); a Station may override them */
  hintTargets: HintTargetTable;
}

export type FailAction =
  | "wobble" | "tip" | "sink" | "bounce" | "spark" | "jam" | "eject" | "dim" | "flash" | "unseat"
  | "grind" | "stall" | "scatter" | "snap" | "chevrons" | "hold_bright" | "spit_back";
export interface FailBeat {
  atMs: number;
  anchor: string;
  action: FailAction;
  params?: Readonly<Record<string, number | string>>;
}
export interface FailurePlan {
  beats: readonly FailBeat[];
  durationMs: number; // 600–1600 ms, non-punitive
  cue: string;
}
export type SuccessAction =
  | "lock" | "spin" | "open" | "ignite" | "print" | "stamp" | "flood" | "drain" | "rise" | "lower"
  | "swallow" | "cycle" | "light_sequence" | "dissolve" | "ride";
export interface SuccessBeat {
  atMs: number;
  anchor: string;
  action: SuccessAction;
  params?: Readonly<Record<string, number | string>>;
}
export interface SuccessPlan {
  beats: readonly SuccessBeat[];
  cardEffects: readonly { atMs: number; slot: number; effect: string; key: string | null }[]; // trig e4 stepEffects replay
  durationMs: number; // 1200–2500 (★34)
  cue: string;
}

export interface ConfigCtx {
  modeKey: ModeKey;
  encounter: Encounter; // prompt, hints, sourceRef, targetMisconception
  params: unknown; // validators and defaults MAY read params and solution (server / tests only)
  solution: unknown;
  view: unknown;
  texts: readonly string[]; // every string in params + prompt + hints + sourceRef.quote (date/number honesty checks)
  biome: string;
}
export interface WriterCtx {
  modeKey: ModeKey;
  view: unknown;
  itemKeys: readonly string[];
  domain: Domain;
}
export interface ConfigIssue {
  path: (string | number)[];
  message: string;
  severity: "error" | "warning";
}
export interface AudioParam {
  cue: string;
  pitch?: number;
  gain?: number;
} // continuous loops (bell hum ∝ |f(x)|)

export type ControlKind = "scrub" | "aim" | "slots" | "bins" | "waves" | "cables" | "tubes" | "matrix" | "widget";
export type ClockResetOn = "open" | "settle" | "probe_change" | "arena";
export interface Footprint2D {
  left: number;
  right: number;
  height: number;
}
export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The PURE half of a contraption. Imported by validators, the pipeline, tests, React and Phaser alike. */
export interface ContraptionMeta<Config = unknown, Pose = unknown, Sim = null> {
  id: string;
  name: string;
  modes: readonly ModeKey[];
  tier: "native" | "fallback";
  status: "demo" | "post_demo"; // amendment 38
  reusable: "any_subject" | readonly Domain[];
  layouts: readonly LayoutMode[];
  defaultLayout: LayoutMode;
  payoffs: readonly PayoffAnim[];
  nearMissKeys: readonly string[];
  accessories: readonly "record_lens"[];
  skins: readonly ContraptionSkin[];
  control: ControlKind;
  // ---- configuration (§4.2, §4.4)
  configSchema: z.ZodType<Config>;
  validateConfig(config: Config, ctx: ConfigCtx): readonly ConfigIssue[]; // honesty and presence checks
  defaultConfig(ctx: ConfigCtx): Config; // autoWorld (amendment 39)
  writerConfigSchema(ctx: WriterCtx): z.ZodType<unknown> | null; // strict-mode, LLM-facing; null = nothing to write
  fromWriterConfig(w: unknown, ctx: ConfigCtx): Config;
  // ---- geometry
  footprint(config: Config): Footprint2D; // around the console
  frameBounds(config: Config, view: unknown): Bounds; // relative to station.anchor (amendment 32)
  // ---- live
  probe(config: Config, view: unknown): ProbeSpec | null; // scalar modes return null: the Scrubber IS the input
  clock: { resetOn: readonly ClockResetOn[] } | null;
  sim: SimSpec<Config, Sim> | null;
  pose(input: PoseInput<Config, Sim>): Pose;
  lerp(from: Pose, to: Pose, t: number): Pose; // t in [0,1]; discrete fields snap at t ≥ 0.5
  describe(pose: Pose, input: PoseInput<Config, Sim>): Described;
  panelStatic(input: StaticInput<Config>): PanelStatic; // memoized per (encounter, aidTier, hintsUsed)
  panelLive(stat: PanelStatic, input: PoseInput<Config, Sim>): PanelLive;
  hintTargets(rung: HintRung, input: StaticInput<Config>): readonly HintTarget[];
  audio(pose: Pose, input: PoseInput<Config, Sim>): readonly AudioParam[];
  // ---- outcomes (pure; prefabs only play them)
  failurePlan(d: Diagnosis, input: PoseInput<Config, Sim>): FailurePlan; // acts ONLY on d.wrongKeys / d.failKey
  successPlan(input: PoseInput<Config, Sim>, anim: PayoffAnim): SuccessPlan; // input.draft = the solution draft, solved = true
  solvedPose(input: PoseInput<Config, Sim>): Pose; // settled solved state (warp, autoSolve, re-entry): D3
  debug(pose: Pose): Record<string, number | string | boolean>; // e.g. { ringAngle: 3.14, aligned: false }
}
/** Registry-level meta type (heterogeneous configs/poses/sims). Same pattern as AnyFamilyMode. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyContraptionMeta = ContraptionMeta<any, any, any>;

// ================================================================ panel models (§2.5.2)

export interface Tick {
  v: number;
  label: string | null;
  major: boolean;
}
export interface AxisModel {
  min: number;
  max: number;
  unit: AxisUnit;
  ticks: readonly Tick[];
  label: string | null;
}
export interface PlotModel {
  id: string;
  color: FnColor;
  style: "solid" | "dashed" | "ghost"; // ghost = 25 % alpha copy (the faint f behind g)
  segments: readonly (readonly [number, number])[][]; // split at NaN, ±∞ and jumps (graph-math.sample)
  endpoints: readonly { x: number; y: number; open: boolean }[];
}
/** GraphCard annotations (amendment 7). */
export type GraphAnnotation =
  | { kind: "bracket"; x0: number; y0: number; x1: number; y1: number; label: string; color: FnColor; orient: "vertical" | "horizontal" }
  | { kind: "shade"; x0: number; x1: number; y0: number | null; y1: number | null; color: FnColor; alpha: number; label: string | null }
  | { kind: "period_marker"; x: number; y: number; color: FnColor } // hollow circle: the trace is home, moving the same way
  | { kind: "live_dot"; x: number; y: number; color: FnColor } // "the lines are start and destination; the dots are now"
  | { kind: "hline"; y: number; label: string | null; style: "solid" | "dashed"; color: FnColor } // midline, y = 1/2, targets
  | { kind: "vline"; x: number; label: string | null; style: "solid" | "dashed"; color: FnColor }
  | { kind: "caption"; text: string } // "sin(x) = 1/2" typed during a success replay
  | { kind: "marker"; x: number; y: number; label: string | null; focusable: boolean }; // points of interest, orb targets
export type SchematicPrim =
  | { p: "line"; x1: number; y1: number; x2: number; y2: number; color: FnColor; w: number; dash: boolean }
  | { p: "poly"; points: readonly (readonly [number, number])[]; color: FnColor; fill: boolean; w: number }
  | { p: "circle"; cx: number; cy: number; r: number; color: FnColor; fill: boolean }
  | { p: "arc"; cx: number; cy: number; r: number; a0: number; a1: number; color: FnColor; w: number }
  | { p: "rect"; x: number; y: number; w: number; h: number; color: FnColor; fill: boolean }
  | { p: "text"; x: number; y: number; text: string; size: number; color: FnColor; anchor: "start" | "middle" | "end" };
export type CardModel =
  | {
      kind: "graph"; slot: number; title: string; tab: string; x: AxisModel; y: AxisModel; plots: readonly PlotModel[];
      annotations: readonly GraphAnnotation[];
      columns: readonly { id: string; x0: number; x1: number; state: "obscured" | "revealed" | "chosen" }[];
      targetLine: { y: number; label: string } | null; empty: boolean; sr: string;
    }
  | {
      kind: "timeline"; slot: number; title: string; tab: string; from: number; to: number; unit: "year" | "month";
      lanes: readonly { id: string; label: string }[];
      pins: readonly { key: string; at: number; label: string; lane: string | null; style: "earned" | "hint" | "draft" | "focus" | "dim"; spanTo: number | null }[];
      bands: readonly { from: number; to: number; label: string; color: FnColor }[];
      arrows: readonly { fromKey: string; toKey: string }[]; axisBreak: { from: number; to: number } | null; sr: string;
    }
  | {
      kind: "unit_circle"; slot: number; title: string; landmarks: readonly { angle: number; label: string }[];
      hairlineStep: number | null; point: { angle: number } | null; arc: { from: number; to: number; color: FnColor } | null;
      drops: { sin: boolean; cos: boolean }; level: number | null; shadeUpperHalf: boolean; mirror: { from: number; to: number } | null; sr: string;
    }
  | {
      kind: "bars"; slot: number; title: string; bars: readonly { id: string; label: string; value: number; max: number; color: FnColor }[];
      sparkline: { points: readonly number[]; max: number; color: FnColor } | null; timer: { fraction: number } | null;
      arrow: "in" | "out" | "both" | "none" | null; sr: string;
    }
  | { kind: "schematic"; slot: number; title: string; viewBox: readonly [number, number]; prims: readonly SchematicPrim[]; sr: string }
  | {
      kind: "link_board"; slot: number; title: string; lefts: readonly { key: string; label: string }[];
      rights: readonly { key: string; label: string; sub: string | null }[];
      links: readonly { leftKey: string; rightKey: string; state: "draft" | "seated" | "focus" }[]; sr: string;
    }
  | {
      kind: "claims"; slot: number; title: string; scenario: string | null;
      items: readonly { key: string; letter: string; text: string; glyph: string | null; state: "idle" | "hover" | "aimed" | "honest" | "struck" }[]; sr: string;
    }
  | {
      kind: "slot_rail"; slot: number; title: string; heading: string | null;
      slots: readonly { index: number; key: string | null; label: string | null; lamp: "off" | "on" }[]; anchorsRight: number; sr: string;
    }
  | {
      kind: "matrix"; slot: number; title: string; clues: readonly { index: number; text: string; date: string | null }[];
      hypotheses: readonly { id: string; text: string }[]; marks: readonly { clueIndex: number; hypothesisId: string }[];
      accused: string | null; shadeCounts: boolean; sr: string;
    }
  | { kind: "energy_cells"; slot: number; title: string; total: number; spent: number; projected: number; sr: string }
  | { kind: "document"; slot: number; title: string; body: string; stamp: string | null; sr: string }
  | {
      kind: "cause_graph"; slot: number; title: string; nodes: readonly { key: string; label: string; x: number; y: number }[];
      edges: readonly { fromKey: string; toKey: string; state: "draft" | "focus" }[]; sr: string;
    };
export type CardKind = CardModel["kind"];
export interface PanelStatic {
  cards: readonly CardModel[];
  /** the scalar input (scalar modes) — the Scrubber is the mode control */
  input: { symbol: string; min: number; max: number; step: number; unit: AxisUnit; format: ProbeFormat; ticks: readonly Tick[] } | null;
  /** the probe (non-scalar modes with a probe) — the Scrubber is the probe */
  probe: ProbeSpec | null;
  /** pins this meta adds to the panel-owned RECORD card (hint pins by aid tier, A6); [] when StaticInput.record is false */
  recordPins: readonly { key: string; at: number; label: string; style: "hint" | "dim" }[];
}
export interface PanelLive {
  scrubX: number | null; // orange line: the input value or the probe value
  readout: string | null; // "0.83π", "π/2 < θ < π", "MAR 1965", "stage 3 · flip out"
  chips: readonly { slot: number; value: number; text: string; color: FnColor }[]; // ride the card's left edge
  highlights: readonly { slot: number; key: string; state: "focus" | "hover" | "placed" | "struck" }[];
  liveCards: readonly CardModel[]; // replace the static card of the same slot (live dots, aimed trace, ledgers)
}
/** What the client tells the panel about the whole game (A6). Built by ExpeditionClient, passed to InstrumentPanel.
 * When `recordStrip` is non-null the panel renders recordCard(context, static.recordPins, live.scrubX) in display slot 0
 * (src/world/record-strip.ts) and the meta's cards below it; meta slot numbers stay meta-relative. */
export interface PanelContext {
  recordStrip: RecordStrip | null; // world.story.recordStrip (history games)
  solvedIds: readonly string[]; // progress.solvedIds, encounter order
  probeWindow: { start: number; end: number } | null; // the open station's ProbeSpec.window (fractional years), else null
}

// ================================================================ diagnosis (§2.5.4, amendment 11)

export type FailKey =
  | "over" | "under" // scalar modes: submitted value above / below the answer
  | "honest" | "wrong_option" // mimic, predict_reveal
  | "incomplete" | "decoy" | "order" // linear (and chain's decoy)
  | "wrong_bin" | "wrong_wave" | "wrong_link" | "wrong_hypothesis";
export const FAIL_KEYS: readonly FailKey[] = [
  "over", "under", "honest", "wrong_option", "incomplete", "decoy", "order", "wrong_bin", "wrong_wave", "wrong_link", "wrong_hypothesis",
];
export interface Diagnosis {
  correct: boolean;
  feedback: string; // grade().feedback, verbatim
  displayFeedback: string; // after feedbackNouns (display only; amendment 36)
  failKey: FailKey | null;
  wrongKeys: readonly string[]; // [0] = the item grade() names; never more than grade() discloses
  prefix: number | null; // ordered modes: length of the correct prefix
  disclosed: Readonly<Record<string, string | number>>; // facts the feedback already states: { bin: "protein" }, { clueIndex: 2 }
  nearMiss: string | null; // meta.describe(pose(submitted draft)).nearMiss
  probeKeys: readonly string[]; // MisconceptionProbes matched by the submitted input
}
export interface DiagnoseArgs {
  modeKey: ModeKey;
  params: unknown;
  view: unknown;
  solution: unknown;
  input: unknown;
  grade: { correct: boolean; feedback: string };
  probes: readonly MisconceptionProbe[];
  nearMiss: string | null;
  feedbackNouns: readonly { from: string; to: string }[];
}
// diagnose(args): Diagnosis and failKeysFor(modeKey) live in src/world/diagnose/index.ts (V1).

// ================================================================ sandboxes (§2.5.5, amendment 17)

export type SandboxInput =
  | { kind: "probe"; id: string; spec: ProbeSpec }
  | {
      kind: "tokens"; id: string; tokens: readonly { key: string; label: string; icon: string | null }[];
      targets: readonly { key: string; label: string }[];
    };
export interface SandboxDraft {
  values: Readonly<Record<string, number>>;
  placed: Readonly<Record<string, string>>;
  settled: boolean;
  seq: number;
}
export interface SandboxHistory {
  drafts: number; // input changes so far
  secondsActive: number;
  moved: ReadonlySet<string>; // input ids touched
  ranges: Readonly<Record<string, readonly [number, number]>>; // min/max visited per probe
  placedAll: boolean;
}
export interface SandboxPoseInput<Config, Sim> {
  config: Config;
  draft: SandboxDraft | null;
  t: number;
  sim: Sim | null;
  reducedMotion: boolean;
}
export interface SandboxMeta<Config = unknown, Pose = unknown, Sim = null> {
  id: string;
  name: string;
  tier: "sandbox";
  skins: readonly ContraptionSkin[];
  configSchema: z.ZodType<Config>;
  validateConfig(config: Config): readonly ConfigIssue[];
  inputs(config: Config): readonly SandboxInput[];
  goals: readonly string[]; // "explored", "plasmolysed", "turgid", "all_developed"
  goalMet(goal: string, h: SandboxHistory, pose: Pose): boolean;
  sim: SimSpec<Config, Sim> | null;
  pose(input: SandboxPoseInput<Config, Sim>): Pose;
  lerp(from: Pose, to: Pose, t: number): Pose;
  describe(pose: Pose, input: SandboxPoseInput<Config, Sim>): Described;
  panelStatic(config: Config): PanelStatic;
  panelLive(stat: PanelStatic, input: SandboxPoseInput<Config, Sim>): PanelLive;
  audio(pose: Pose, input: SandboxPoseInput<Config, Sim>): readonly AudioParam[]; // the Music Box tone
  footprint(config: Config): Footprint2D;
  frameBounds(config: Config): Bounds;
  debug(pose: Pose): Record<string, number | string | boolean>;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySandboxMeta = SandboxMeta<any, any, any>;

// ================================================================ resolved world (§1.5; implemented by V1 in resolve-world.ts)

export type WorldSource = "sidecar_id" | "sidecar_source" | "spec" | "auto";
export interface SpeakerInfo {
  id: string;
  name: string;
  role: string;
  voiceArchetype: VoiceArchetype | null;
  emblem: Emblem | null; // null: the player (no emblem) and narrator (caption style)
  portrait: string | null;
  kind: "character" | "extra" | "player" | "narrator";
}
/** id → speaker; built by src/world/speakers.ts from spec.characters ∪ cast.extras ∪ {player, narrator}. */
export type SpeakerDirectory = ReadonlyMap<string, SpeakerInfo>;
export interface ResolvedStation extends Station {
  index: number; // encounter index
  zoneIndex: number;
  modeKey: ModeKey;
  meta: AnyContraptionMeta; // from the library (functions; client-only object)
  parsedConfig: unknown; // meta.configSchema.parse(config)
  layout: LayoutMode; // override ?? meta.defaultLayout
  probe: ProbeSpec | null; // meta.probe(parsedConfig, view)
}
export interface ResolvedSandbox extends Sandbox {
  meta: AnySandboxMeta;
  parsedConfig: unknown;
}
export interface ResolvedWorld {
  overlay: WorldOverlay;
  source: WorldSource;
  zones: readonly Zone[];
  stations: readonly ResolvedStation[]; // encounter order
  stationByEncounter: ReadonlyMap<string, ResolvedStation>;
  sandboxes: readonly ResolvedSandbox[];
  speakers: SpeakerDirectory; // id -> {name, emblem, portrait, voiceArchetype}
  flagsDeclared: ReadonlySet<string>;
  feedbackNouns: (encounterId: string) => readonly { from: string; to: string }[];
  namespaces: readonly string[]; // ["shared", biome]: manifests to load
}

// ================================================================ world state (§2.4.6; implemented by S1 in state/**)

export interface WorldState {
  flags: ReadonlySet<string>;
  collected: ReadonlySet<string>; // collectible ids
  touched: ReadonlySet<string>; // prop ids with `touch`
  talked: ReadonlySet<string>; // "npcId:stateId"
  fired: ReadonlySet<string>; // trigger ids
  sandboxGoals: ReadonlySet<string>; // "sandboxId:goal"
  cosmetics: readonly string[]; // AssetKeys added to the protagonist costume
}
export type WorldStateEvent =
  | { type: "flag"; id: string; on: boolean }
  | { type: "collect"; id: string }
  | { type: "touch"; id: string }
  | { type: "talk"; npcId: string; stateId: string }
  | { type: "trigger"; id: string }
  | { type: "sandbox_goal"; sandboxId: string; goal: string }
  | { type: "cosmetic"; asset: string };
export interface ReqCtx {
  solvedIds: ReadonlySet<string>;
  state: WorldState;
}
/** Signatures S1 implements (state/world-state.ts, npc-state.ts, quests.ts, requirements.ts). */
export interface WorldStateApi {
  reduceWorldState(s: WorldState, e: WorldStateEvent): WorldState;
  requirementMet(req: Requirement | null, ctx: ReqCtx): boolean;
  activeNpcState(npc: Npc, ctx: ReqCtx): NpcState | null;
  questStatus(q: Quest, ctx: ReqCtx): { step: number; done: boolean };
  settleQuests(quests: readonly Quest[], ctx: ReqCtx): { events: WorldStateEvent[]; say: WorldLine[]; debrief: string[] };
}

// ================================================================ biome kits (§6.4; implemented by V1 in biomes.ts)

export interface GroundTemplate {
  surface: string; // AssetKey of the ground strip
  underside: string | null;
  baseY: number; // walk line of a flat preset, zone units
  roughness: number; // 0 = flat; the kit's heightfield jitter amplitude
}
export interface BiomeKit {
  id: string;
  name: string;
  domains: readonly Domain[];
  sensitive: boolean;
  paletteId: string; // key into BIOME_PALETTES
  zonePresets: readonly {
    light: AmbientLight;
    layerSet: LayerSet;
    sky: Sky;
    ambient: Ambient;
    ground: GroundTemplate;
    propSets: readonly string[];
    heroLandmark: string | null;
  }[];
  traversalTemplates: readonly { kind: TraversalLinkKind; dx: number; dy: number; apex?: number }[];
  companionDefault: string;
  emblemDefault: Emblem;
  vehicles: { lift: string; tram: string | null; vesicle: string | null };
  vista: string | null; // composed finale vista (group "vista")
  skinDefaults: { aimer: string; quarantineAnim: string; connector: string; layout: string; bays: string };
  sims: readonly string[]; // reference sims whose ghosts suit this biome's domains
  fictionalStaff: readonly string[]; // bodies/looks allowed for human NPCs when sensitive
  protectedNames: readonly string[]; // extra names the R10 lint treats as real people
  violenceLexicon: readonly string[]; // words that force document / photo_withheld plates (R10)
  /** the protagonist's pose at payoffs: sensitive kits use "show" (memorial payoffs), R10 enforces it (A11) */
  successPose: "cheer" | "show";
}

// ================================================================ validateWorld rule ids (§1.5; V1 implements the rules)

export const WORLD_RULE_IDS = [
  "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10", "R11", "R12", "R13", "R14", "R15", "R16", "W1", "W2", "W3",
] as const;
export type WorldRuleId = (typeof WORLD_RULE_IDS)[number];
/** One line per rule; severity is the default (R9's word budget and a few sub-checks are warnings inside V1). */
export const WORLD_RULES: Readonly<Record<WorldRuleId, { title: string; severity: "error" | "warning" }>> = {
  R1: { title: "assets exist in ASSET_INDEX, in shared or the world's biome namespace; group/kind checks", severity: "error" },
  R2: { title: "speakers resolve to spec.characters ∪ cast.extras ∪ {player, narrator}; extras unique and disjoint", severity: "error" },
  R3: { title: "zones: unique ids, ordered contiguous segments, interiors inside, exits resolve", severity: "error" },
  R4: { title: "stations are 1:1 with encounters, in encounter order by (zoneIndex, consoleX)", severity: "error" },
  R5: { title: "contraption supports the mode; skin, config, layout, payoff anim, accessories, fail/taunt keys legal", severity: "error" },
  R6: { title: "geometry inside the zone; payoff kind = PAYOFF_KIND_OF[anim]; blockers between consoles", severity: "error" },
  R7: { title: "cutscene ids and step references resolve; interactive steps only in skippable cutscenes", severity: "error" },
  R8: { title: "no answer leaks (token-boundary matcher) in station-scoped texts; world texts warn", severity: "error" },
  R9: { title: "text budgets: ≤ 140 chars per line; instruction names a noun; label lengths", severity: "error" },
  R10: { title: "history sensitivity: fictional staff, no real names, violent text only on document/photo plates", severity: "error" },
  R11: { title: "traversal links reference real surfaces; no link bypasses an unsolved blocker", severity: "error" },
  R12: { title: "side content ids unique; requirements and quest steps resolve; flags declared; npc look xor asset", severity: "error" },
  R13: { title: "purpose: meter non-decreasing; progress effects, map and record strip resolve; pin dates in texts", severity: "error" },
  R14: { title: "record_lens needs a year/month_year probe with a window; rail inside the zone", severity: "error" },
  R15: { title: "boss staging only on the boss; arenaTriggerX < consoleX; phases partition the item keys", severity: "error" },
  R16: { title: "every cue id used is in CUE_MAP (unmapped cues are silent)", severity: "warning" },
  W1: { title: "every zone with stations has a payoff with vertical ≠ none", severity: "warning" },
  W2: { title: "every zone offers ≥ 2 non-walk verbs besides its payoffs", severity: "warning" },
  W3: { title: "props and L5 layers do not overlap a station's footprint or frame bounds", severity: "warning" },
};
/** validateWorld(spec, world) returns the same split validateGameSpec uses; issue messages start with "R5: …". */
export interface ValidateWorldResult {
  issues: Issue[];
  warnings: Issue[];
}

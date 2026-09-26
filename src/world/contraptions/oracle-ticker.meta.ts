/**
 * oracle_ticker — truth_finder.predict_reveal (docs/design/20 §4 row 5, §4.2, §4.4; civil §5.3). A machine prints the
 * scenario; a selector knob points at the option (hover previews); the teletype retypes "FORECAST: …" on every change;
 * the wire hums while a forecast is set. After Verify it prints the sourced reveal (the grade feedback): on success the
 * wire glows, the barrier dissolves and the `payoffLamps` light one by one; on a miss the forecast line is stamped
 * NOT WHAT HAPPENED and the selector unlocks. KC1: the full pure half (live-reveal rule §2.5.6: the view only).
 */
import { z } from "zod";
import type { ProbeSpec } from "../../contracts/world";
import { clamp01, lerp } from "../ease";
import {
  fileCard,
  fileChip,
  fileDatePins,
  footprintMarks,
  lensU,
  probeWindowOf,
  yearReadout,
  type FileMarks,
  type MarkStyle,
  type TimelineCard,
} from "../record-strip";
import type {
  AudioParam,
  Bounds,
  CardModel,
  ConfigCtx,
  ConfigIssue,
  ContraptionMeta,
  Described,
  Diagnosis,
  FailBeat,
  FailurePlan,
  Footprint2D,
  HintRung,
  HintTarget,
  PanelLive,
  PanelStatic,
  PoseInput,
  PredictRevealView,
  StaticInput,
  SuccessBeat,
  SuccessPlan,
} from "../types";
import { coverExactlyOnce, dateAppearsIn, err, findYears, optionIndicesOf, probeRangeIssues, yearProbeFor } from "./config-parts";
import { defineSkin } from "./skin-kit";
import { probeFromWriter, wDate, wProbe, type WriterProbe } from "./writer-kit";
import { OracleTickerConfig } from "./oracle-ticker.config";
export { OracleTickerConfig, ORACLE_TICKER_SUCCESS_ONLY } from "./oracle-ticker.config";

const hint = (anchor: string, action: HintTarget["action"], holdMs: number): HintTarget => ({ anchor, action, holdMs });

export const ORACLE_TICKER_SKINS = [
  defineSkin({
    id: "wire_ticker",
    name: "Wire Ticker",
    ns: "archive_of_voices",
    nouns: ["ticker", "teletype", "wire", "selector", "knob", "kiosk", "tape"],
    parts: [
      ["kiosk", "K"], ["teletype", "H"], ["selector", "H"], ["telegraph_pole", "K"], ["school_barrier", "K"], ["walk_lamp", "K"], ["console", "K"],
    ],
    anchors: ["teletype", "knob", "wire_start", "wire_end", "lamps", "console"],
    cues: { live: null, succeed: "teletype", fail: "relay_click" },
    sensitiveSafe: true,
    // civil §5.3: rung 1 circles the barrier at the far end of the wire, rung 2 lands on the selector, rung 3 hovers the teletype
    hintTargets: [[hint("wire_end", "circle", 1800)], [hint("knob", "land", 2000)], [hint("teletype", "hover", 1500)]],
  }),
] as const;

interface OracleTickerWriter {
  fileDates: { date: string; label: string }[];
  probe: WriterProbe | null;
}

// ---------------------------------------------------------------- live constants (civil §5.3)

/** Knob stops are 40° apart around 0 (A/B/C → −40°, 0°, +40°). */
export const KNOB_STEP_DEG = 40;
/** Where the knob rests before a forecast is set (the dial's blank "OFF" stop). */
export const KNOB_REST_DEG = -75;
/** Tape typing speed (bible §7.3 "the type lifts"). */
export const TAPE_CPS = 45;
/** Telegraph-wire vibration amplitude while a forecast is set: y(x, t) = 2 px · sin(2π(3t − x/120)). */
export const WIRE_AMP_PX = 2;
export const TAPE_PREFIX = "FORECAST: ";
const LETTERS = "ABCDEF";

/** The archetype's pose (skins import this name). Display positions follow `view.options` order. */
export interface OracleTickerPose {
  knobDeg: number; // eased toward the stop of `position` (or KNOB_REST_DEG)
  position: number | null; // display position the knob points at (hover preview or the committed forecast)
  optionIndex: number | null; // the option at `position` (keyed, never display order)
  previewing: boolean; // the knob follows a hover, not the committed forecast
  committed: boolean; // draft.input.optionIndex is set
  tapeKey: string; // changes whenever the tape text changes ("" = idle): the prefab restarts its typing effect
  tapeText: string; // "FORECAST: <option text>"
  tapeChars: number; // characters typed so far (45 chars/s on the station clock, which resets on settle)
  wireAmp: number; // px
  wirePhase: number; // seconds (the prefab evaluates y(x) = wireAmp · sin(2π(3·wirePhase − x/120)))
  wireGlow: number; // 0…1, success only
  printed: boolean; // the reveal is printed (solved)
  lamps: number; // walk lamps lit, success only (config.payoffLamps)
  barrier: number; // 1 = the barrier stands, 0 = dissolved (solved)
  lensU: number | null; // the record_lens carriage's fraction along its rail (null without a probe)
  solved: boolean;
}

// ---------------------------------------------------------------- view readers

function optionsOf(view: unknown): readonly PredictRevealView["options"][number][] {
  const v = view as Partial<PredictRevealView> | null;
  return Array.isArray(v?.options) ? v.options.filter((o) => typeof o?.optionIndex === "number") : [];
}
function scenarioOf(view: unknown): string | null {
  const v = view as Partial<PredictRevealView> | null;
  return typeof v?.scenario === "string" ? v.scenario : null;
}
function indexOf(s: string | null | undefined): number | null {
  if (s === null || s === undefined || !/^\d+$/.test(s)) return null;
  return Number(s);
}
export function letterOf(position: number): string {
  return LETTERS[position] ?? String(position + 1);
}
/** The knob angle of a display position among `count` options (3 options → −40°, 0°, +40°). */
export function knobAngleFor(position: number, count: number): number {
  return (position - (count - 1) / 2) * KNOB_STEP_DEG;
}

interface Selection {
  optionIndex: number | null;
  position: number | null;
  previewing: boolean;
  committed: boolean;
}
function selectionOf(input: Pick<PoseInput<OracleTickerConfig>, "draft" | "view">): Selection {
  const opts = optionsOf(input.view);
  const posOf = (oi: number | null) => (oi === null ? -1 : opts.findIndex((o) => o.optionIndex === oi));
  const raw = (input.draft?.input as { optionIndex?: unknown } | null | undefined)?.optionIndex;
  const chosen = typeof raw === "number" && posOf(raw) >= 0 ? raw : null;
  const hover = indexOf(input.draft?.hover);
  const hovered = hover !== null && posOf(hover) >= 0 ? hover : null;
  const shown = hovered ?? chosen;
  const position = posOf(shown);
  return { optionIndex: shown, position: position >= 0 ? position : null, previewing: hovered !== null && hovered !== chosen, committed: chosen !== null };
}

// ---------------------------------------------------------------- pose

function poseOf(input: PoseInput<OracleTickerConfig>): OracleTickerPose {
  const opts = optionsOf(input.view);
  const sel = selectionOf(input);
  const text = sel.position === null ? "" : `${TAPE_PREFIX}${opts[sel.position].text}`;
  const chars = input.reducedMotion || input.solved ? text.length : Math.min(text.length, Math.max(0, Math.floor(TAPE_CPS * input.t)));
  const window = probeWindowOf(input.config.probe);
  return {
    knobDeg: sel.position === null ? KNOB_REST_DEG : knobAngleFor(sel.position, opts.length),
    position: sel.position,
    optionIndex: sel.optionIndex,
    previewing: sel.previewing,
    committed: sel.committed,
    tapeKey: sel.optionIndex === null ? "" : `option:${sel.optionIndex}`,
    tapeText: text,
    tapeChars: chars,
    wireAmp: sel.position === null || input.reducedMotion ? 0 : WIRE_AMP_PX,
    wirePhase: input.t,
    wireGlow: input.solved ? 1 : 0,
    printed: input.solved,
    lamps: input.solved ? input.config.payoffLamps : 0, // success-only
    barrier: input.solved ? 0 : 1,
    lensU: window && input.probe !== null ? lensU(window, input.probe) : null,
    solved: input.solved,
  };
}

function lerpPose(from: OracleTickerPose, to: OracleTickerPose, t: number): OracleTickerPose {
  const k = clamp01(t);
  const snap = k >= 0.5;
  const sameTape = from.tapeKey === to.tapeKey;
  return {
    ...(snap ? to : from),
    knobDeg: lerp(from.knobDeg, to.knobDeg, k),
    tapeKey: to.tapeKey,
    tapeText: to.tapeText,
    tapeChars: sameTape ? Math.round(lerp(from.tapeChars, to.tapeChars, k)) : to.tapeChars,
    wireAmp: lerp(from.wireAmp, to.wireAmp, k),
    wirePhase: to.wirePhase,
    wireGlow: lerp(from.wireGlow, to.wireGlow, k),
    lamps: Math.round(lerp(from.lamps, to.lamps, k)),
    barrier: lerp(from.barrier, to.barrier, k),
    lensU: from.lensU !== null && to.lensU !== null ? lerp(from.lensU, to.lensU, k) : to.lensU,
  };
}

function describePose(pose: OracleTickerPose): Described {
  const chips = [];
  if (pose.position !== null) chips.push({ anchor: "knob", text: `FORECAST ${letterOf(pose.position)}`, color: "accent" as const });
  if (pose.tapeChars > 0) chips.push({ anchor: "teletype", text: pose.tapeText.slice(0, pose.tapeChars), color: "f" as const });
  let srText: string;
  if (pose.solved) srText = "The wire is confirmed: the ticker has printed the record, the barrier is gone and the walk lamps are lit.";
  else if (pose.position === null) srText = "The prediction selector rests; the teletype waits for a forecast.";
  else
    srText = `The selector ${pose.previewing ? "previews" : "points at"} forecast ${letterOf(pose.position)}; the teletype types it and the wire hums.`;
  return { chips, pins: [], srText, nearMiss: null };
}

// ---------------------------------------------------------------- panel

const FILE_SLOT = 0;
function hasFile(input: Pick<StaticInput<OracleTickerConfig>, "record" | "config">): boolean {
  return input.record || input.config.fileDates.length > 0 || input.config.options.some((o) => o.footprint !== null);
}
function claimsSlot(input: Pick<StaticInput<OracleTickerConfig>, "record" | "config">): number {
  return hasFile(input) ? 1 : 0;
}

function fileFor(config: OracleTickerConfig, styleOf: (optionIndex: number) => MarkStyle): TimelineCard {
  const marks: FileMarks[] = config.options.flatMap((o) => (o.footprint ? [footprintMarks(String(o.optionIndex), o.footprint, styleOf(o.optionIndex))] : []));
  return fileCard({ slot: FILE_SLOT, window: probeWindowOf(config.probe), marks, pins: fileDatePins(config.fileDates) });
}

function claimsFor(view: unknown, slot: number, sel: Selection | null): Extract<CardModel, { kind: "claims" }> {
  const opts = optionsOf(view);
  const items = opts.map((o, i) => ({
    key: String(o.optionIndex),
    letter: letterOf(i),
    text: o.text,
    glyph: null,
    state: (sel && sel.position === i ? (sel.previewing ? "hover" : "aimed") : "idle") as "idle" | "hover" | "aimed",
  }));
  const chosen = sel && sel.position !== null ? ` Forecast ${letterOf(sel.position)} is ${sel.previewing ? "previewed" : "set"}.` : "";
  return {
    kind: "claims",
    slot,
    title: "FORECAST",
    scenario: scenarioOf(view),
    items,
    sr: `Scenario and ${opts.length} forecasts, ${opts.map((o, i) => `${letterOf(i)}: ${o.text}`).join("; ")}.${chosen}`,
  };
}

function panelStaticOf(input: StaticInput<OracleTickerConfig>): PanelStatic {
  const cards: CardModel[] = [];
  if (hasFile(input)) cards.push(fileFor(input.config, () => "dim"));
  cards.push(claimsFor(input.view, claimsSlot(input), null));
  return { cards, input: null, probe: input.config.probe, recordPins: [] };
}

function panelLiveOf(stat: PanelStatic, input: PoseInput<OracleTickerConfig>): PanelLive {
  const sel = selectionOf(input);
  const record = stat.cards.some((c) => c.slot === FILE_SLOT && c.kind === "timeline");
  const cslot = record ? 1 : 0;
  const liveCards: CardModel[] = [claimsFor(input.view, cslot, sel)];
  const chips: PanelLive["chips"][number][] = [];
  if (record) {
    const file = fileFor(input.config, (oi) => (oi === sel.optionIndex ? (sel.previewing ? "focus" : "draft") : "dim"));
    liveCards.unshift(file);
    if (input.probe !== null) chips.push({ slot: FILE_SLOT, value: input.probe, text: fileChip(file, input.probe).text, color: "g" });
  }
  const highlights: PanelLive["highlights"][number][] =
    sel.optionIndex === null ? [] : [{ slot: cslot, key: String(sel.optionIndex), state: sel.previewing ? "hover" : "placed" }];
  return {
    scrubX: input.probe,
    readout: yearReadout(input.config.probe?.format ?? "number", input.probe),
    chips,
    highlights,
    liveCards,
  };
}

// ---------------------------------------------------------------- outcomes

function failurePlanOf(d: Diagnosis, input: PoseInput<OracleTickerConfig>): FailurePlan {
  const picked = indexOf(d.wrongKeys[0]);
  const pos = picked === null ? -1 : optionsOf(input.view).findIndex((o) => o.optionIndex === picked);
  const beats: FailBeat[] = [
    // the ticker prints the reveal (the grade feedback, which already states it: predict-then-reveal pedagogy)
    { atMs: 0, anchor: "teletype", action: "flash", params: { print: "feedback" } },
  ];
  if (picked !== null) {
    beats.push({ atMs: 800, anchor: "teletype", action: "hold_bright", params: { stamp: "NOT WHAT HAPPENED", optionIndex: picked } });
    beats.push({ atMs: 1100, anchor: "knob", action: "unseat", params: { optionIndex: picked, position: pos } });
  }
  return { beats, durationMs: 1500, cue: ORACLE_TICKER_SKINS[0].cues.fail };
}

function successPlanOf(input: PoseInput<OracleTickerConfig>, anim: string): SuccessPlan {
  const sel = selectionOf(input);
  const n = input.config.payoffLamps;
  const step = n > 0 ? Math.min(180, Math.floor(1400 / n)) : 0;
  const beats: SuccessBeat[] = [
    { atMs: 0, anchor: "teletype", action: "print", params: { print: "feedback", optionIndex: sel.optionIndex ?? -1 } },
    { atMs: 600, anchor: "wire_start", action: "light_sequence", params: { to: "wire_end", color: "cyan" } },
    { atMs: 1000, anchor: "wire_end", action: "dissolve", params: { anim } },
  ];
  for (let i = 0; i < n; i++) beats.push({ atMs: 1000 + i * step, anchor: "lamps", action: "ignite", params: { index: i, cue: "lamp_chime" } });
  const durationMs = n > 0 ? Math.min(2500, Math.max(1800, 1000 + (n - 1) * step + 300)) : 1800;
  return { beats, cardEffects: [], durationMs, cue: ORACLE_TICKER_SKINS[0].cues.succeed };
}

function audioOf(pose: OracleTickerPose): readonly AudioParam[] {
  return pose.tapeText && pose.tapeChars < pose.tapeText.length ? [{ cue: "teletype", gain: 0.35 }] : [];
}

const FOOTPRINT: Footprint2D = { left: 320, right: 420, height: 520 };
const FRAME: Bounds = { x: -360, y: -640, w: 1800, h: 760 };

export const oracleTickerMeta: ContraptionMeta<OracleTickerConfig, OracleTickerPose> = {
  id: "oracle_ticker",
  name: "Oracle Ticker",
  modes: ["truth_finder.predict_reveal"],
  tier: "native",
  status: "demo",
  reusable: "any_subject",
  layouts: ["scrub"],
  defaultLayout: "scrub",
  payoffs: ["barrier_dissolves", "door_opens", "gate_lifts", "beam_restores"],
  nearMissKeys: [],
  accessories: ["record_lens"],
  skins: ORACLE_TICKER_SKINS,
  control: "aim",
  configSchema: OracleTickerConfig,
  validateConfig(config: OracleTickerConfig, ctx: ConfigCtx): readonly ConfigIssue[] {
    const out: ConfigIssue[] = [];
    if (config.options.length > 0) {
      out.push(...coverExactlyOnce(["options"], "optionIndex", optionIndicesOf(ctx.view), config.options.map((o) => o.optionIndex)));
    }
    config.fileDates.forEach((f, i) => {
      if (!dateAppearsIn(ctx.texts, f.date)) out.push(err(["fileDates", i, "date"], `file date ${f.date} does not appear in the prompt or scenario`));
    });
    out.push(...probeRangeIssues(["probe"], config.probe));
    if (config.probeWorld === "record_lens" && !config.probe) out.push(err(["probeWorld"], "record_lens needs a probe"));
    return out;
  },
  defaultConfig(ctx: ConfigCtx): OracleTickerConfig {
    const probe = ctx.biome === "archive_of_voices" ? yearProbeFor(ctx.texts.flatMap(findYears)) : null;
    return OracleTickerConfig.parse({ probe, probeWorld: probe ? "record_lens" : "none" });
  },
  writerConfigSchema: () =>
    z.object({
      fileDates: z.array(z.object({ date: wDate(), label: z.string() })).min(0).max(4),
      probe: wProbe(),
    }),
  fromWriterConfig(w: unknown): OracleTickerConfig {
    const wc = w as OracleTickerWriter;
    const probe = probeFromWriter(wc.probe);
    return OracleTickerConfig.parse({
      fileDates: wc.fileDates.map((f) => ({ date: f.date, label: f.label.slice(0, 40) || "record" })),
      probe,
      probeWorld: probe && (probe.format === "year" || probe.format === "month_year") ? "record_lens" : "none",
    });
  },
  footprint: () => FOOTPRINT,
  frameBounds: () => FRAME,
  probe: (config: OracleTickerConfig): ProbeSpec | null => config.probe,
  clock: { resetOn: ["open", "settle"] }, // the tape retypes after every settled change
  sim: null,
  pose: poseOf,
  lerp: lerpPose,
  describe: (pose: OracleTickerPose) => describePose(pose),
  panelStatic: panelStaticOf,
  panelLive: panelLiveOf,
  hintTargets: (rung: HintRung, input: StaticInput<OracleTickerConfig>): readonly HintTarget[] =>
    (ORACLE_TICKER_SKINS.find((s) => s.id === input.skinId) ?? ORACLE_TICKER_SKINS[0]).hintTargets[rung - 1],
  audio: (pose: OracleTickerPose) => audioOf(pose),
  failurePlan: failurePlanOf,
  successPlan: (input: PoseInput<OracleTickerConfig>, anim) => successPlanOf(input, anim),
  solvedPose: (input: PoseInput<OracleTickerConfig>) => poseOf({ ...input, solved: true }),
  debug: (pose: OracleTickerPose) => ({
    knobDeg: Math.round(pose.knobDeg * 100) / 100,
    position: pose.position ?? -1,
    optionIndex: pose.optionIndex ?? -1,
    previewing: pose.previewing,
    committed: pose.committed,
    tapeKey: pose.tapeKey,
    tapeChars: pose.tapeChars,
    wireAmp: pose.wireAmp,
    wireGlow: pose.wireGlow,
    lamps: pose.lamps,
    barrier: pose.barrier,
    lensU: pose.lensU ?? -1,
    solved: pose.solved,
  }),
};

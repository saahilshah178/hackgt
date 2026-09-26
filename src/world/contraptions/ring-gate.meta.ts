/**
 * ring_gate — tuner.oscillator (docs/design/20 §4 row 1, §2.5.7, §4.2, §4.4, §7.4; trig §5.2 "The Tidewheel Gate";
 * bible P3). Two notched rings in a wall: the mechanism runs for the dialled time T; the outer ring turns by the wave's
 * phase advance |b|·T and must come home to its notch; the inner disc rocks by the wave's value; a lap tally ratchets;
 * on release the rings replay 0 → T in max(0.6, T/π) s (the clock resets on `settle`). Larger multiples also bring
 * the notch home, so the tally and the near-miss `aligned_multiple` make "a period is ONE lap" visible (bible #36).
 *
 * KA2 (L6): the complete pure half. Live-reveal rule (§2.5.6): a continuous mode may show how close the world is; the
 * meta reads the VIEW only (equation parts b, c, d, A, ask and the dial), never params or the solution. `aligned` (the
 * locked predicate) mirrors oscillator.grade exactly: |value − answer| ≤ 0.03 × dial span (parity test, 400 samples).
 *
 * The rings generalize over every ask through the lap ratio r: period/phase/amplitude/midline r = value / answer,
 * frequency r = answer / value (the machine runs for one of YOUR cycles). One lap (r = 1) is the answer; r = 2 is the
 * doubled-period trap. amplitude/midline asks use the counterweight variant (a weight that rises with the value).
 *
 * Geometry is container-local (origin = station.anchor = the ring centre G, x right, y DOWN).
 */
import type { PayoffAnim } from "../../contracts/world";
import { dialSpan, OSCILLATOR_TOLERANCE } from "../diagnose/oscillator";
import { clamp, clamp01, lerp } from "../ease";
import { fmtNumber, formatPi, labelOnly, MINUS, niceTicks, sample } from "../graph-math";
import type {
  AudioParam,
  AxisModel,
  Bounds,
  CardModel,
  ChipSpec,
  ConfigCtx,
  ConfigIssue,
  ContraptionMeta,
  ContraptionSkin,
  Described,
  Diagnosis,
  FailBeat,
  FailurePlan,
  Footprint2D,
  GraphAnnotation,
  HintRung,
  HintTarget,
  OscillatorView,
  PanelLive,
  PanelStatic,
  PlotModel,
  PoseInput,
  SnapshotPart,
  StaticInput,
  SuccessBeat,
  SuccessPlan,
  Tick,
} from "../types";
import { err } from "./config-parts";
import { defineSkin, partKey } from "./skin-kit";
import { RingGateConfig } from "./ring-gate.config";
export { RingGateConfig } from "./ring-gate.config";

const PI = Math.PI;
const TWO_PI = 2 * PI;

// ================================================================ geometry constants (trig §5.2, anchor G)

export const OUTER_R = 204; // 2.4 H diameter (408), 34 wide
export const RING_W = 34;
export const INNER_R = 170; // 340 diameter
export const NOTCH_W = 150;
export const DOOR_W = 150;
export const DOOR_H = 221;
export const FIN_Y = -250;
export const FIN_GAP = 20; // closed half-gap between the fin halves
export const FIN_SPLIT = 24; // each half slides this far apart on success
export const TALLY_AT = { x: 0, y: -372 } as const;
export const TALLY_R = 44;
export const PAWL_PIVOT = { x: 96, y: -292 } as const;
export const PAWL_TIP = { x: 26, y: -OUTER_R - 6 } as const;
export const WALL = { x: -450, y: -556, w: 900, h: 760 } as const; // 900 × 760 (x 6950–7850, top y 280 for e2)
export const FLOOR_Y = OUTER_R; // the ring sits on the terrace
export const CANAL = { x0: -1500, x1: -WALL.x - 900, y: FLOOR_Y } as const;
/** The canal water front's speed on success (units/s). */
export const WATER_SPEED = 600;
/** A doubled (or larger) lap reads "home" within this many laps of an integer (= tol / P for trig e2). */
export const HOME_LAPS = 0.06;
/** Visual lap cap (a frequency near 0 would otherwise spin forever). */
export const MAX_TURNS = 6;

// ================================================================ skin (§4.3)

const RING_HINTS: readonly [readonly HintTarget[], readonly HintTarget[], readonly HintTarget[]] = [
  [{ anchor: "ring_center", action: "circle", holdMs: 1500 }],
  [{ anchor: "inner_hub", action: "land", holdMs: 1500 }],
  [{ anchor: "tally", action: "land", holdMs: 2000 }],
];

const RING_BASE = defineSkin({
  id: "ring_gate",
  name: "Tidewheel Gate",
  ns: "orrery_terraces",
  nouns: ["gate", "ring", "rings", "notch", "Tidewheel Gate", "latch timer", "wheel"],
  parts: [
    ["gate_wall", "H"], ["outer_ring", "H"], ["inner_disc", "H"], ["fin_l", "H"], ["fin_r", "H"],
    ["tally_wheel", "K"], ["pawl", "K"], ["canal", "K"], ["skiff", "K"], ["console", "K"],
  ],
  anchors: ["ring_center", "doorway", "tally", "pawl_tip", "fin_split", "inner_hub", "console"],
  cues: { live: null, succeed: "latch_clack", fail: "latch_slip" },
  hintTargets: RING_HINTS,
});

// ================================================================ the view (the answer as the view already implies it)

type Ask = OscillatorView["ask"];
export interface RingWave {
  ask: Ask;
  wave: "sin" | "cos";
  amplitude: number;
  b: number;
  c: number;
  d: number;
  dial: { min: number; max: number; step: number; ticks: readonly { value: number; label: string }[] };
  equation: string;
  /** the dialled quantity that locks the rings, computed from the view's equation parts (what the mode grades) */
  answer: number;
  /** the grade tolerance: 0.03 × the dial span */
  tol: number;
  /** the wave's period 2π/|b| */
  period: number;
  pi: boolean;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const fin = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const ASKS: readonly Ask[] = ["period", "frequency", "amplitude", "phase", "midline"];

export function waveOf(view: unknown): RingWave {
  const v = isObj(view) ? view : {};
  const dialRaw = isObj(v.dial) ? v.dial : {};
  const min = fin(dialRaw.min, 0);
  const max = fin(dialRaw.max, TWO_PI) > min ? fin(dialRaw.max, TWO_PI) : min + 1;
  const ticks = (Array.isArray(dialRaw.ticks) ? dialRaw.ticks : [])
    .filter(isObj)
    .map((t) => ({ value: fin(t.value, NaN), label: String(t.label ?? "") }))
    .filter((t) => Number.isFinite(t.value));
  const ask: Ask = ASKS.includes(v.ask as Ask) ? (v.ask as Ask) : "period";
  const b = fin(v.b, 1) || 1;
  const c = fin(v.c, 0);
  const amplitude = fin(v.amplitude, 1);
  const d = fin(v.d, 0);
  const period = TWO_PI / Math.abs(b);
  const answer = { period, frequency: 1 / period, amplitude, phase: c === 0 ? 0 : -c / b, midline: d }[ask];
  const dial = { min, max, step: fin(dialRaw.step, (max - min) / 100) || (max - min) / 100, ticks };
  return {
    ask,
    wave: v.wave === "cos" ? "cos" : "sin",
    amplitude,
    b,
    c,
    d,
    dial,
    equation: typeof v.equation === "string" ? v.equation : "",
    answer,
    tol: OSCILLATOR_TOLERANCE * dialSpan({ dial }),
    period,
    pi: ticks.some((t) => t.label.includes("π")),
  };
}

/** The locked predicate: |value − answer| ≤ 0.03 × dial span, exactly oscillator.grade's test. */
export function isAligned(w: RingWave, value: number): boolean {
  return Number.isFinite(value) && Math.abs(value - w.answer) <= w.tol;
}

/** Laps the mechanism runs for a dialled value (1 = the answer). */
export function lapsFor(w: RingWave, value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (w.ask === "frequency") return value > 0 ? Math.min(MAX_TURNS, w.answer / value) : MAX_TURNS;
  if (w.answer === 0) return 0;
  return clamp(value / w.answer, -MAX_TURNS, MAX_TURNS);
}

/** The wave's normalized value (y − d)/A at time t: sin or cos of b·t + c. */
export function unitWave(w: Pick<RingWave, "wave" | "b" | "c">, t: number): number {
  const arg = w.b * t + w.c;
  return w.wave === "cos" ? Math.cos(arg) : Math.sin(arg);
}
/** f(t) = A·wave(b·t + c) + d. */
export function waveValue(w: Pick<RingWave, "wave" | "b" | "c" | "amplitude" | "d">, t: number): number {
  return w.amplitude * unitWave(w, t) + w.d;
}

/** The tally's completed laps: floor(turns + 0.03) (trig §5.2 k(T)), never negative. */
export function tallyOf(turns: number): number {
  return Math.max(0, Math.floor(Math.abs(turns) + 0.03));
}

/** Wraps an angle into (−π, π]. */
export function wrapPi(a: number): number {
  let r = ((a + PI) % TWO_PI + TWO_PI) % TWO_PI - PI;
  if (r <= -PI) r += TWO_PI;
  return Object.is(r, -0) ? 0 : r;
}

/** Replay progress 0 → 1 over max(0.6, T/π) s after a release (T = the machine's run time). */
export function replayProgress(t: number, runTime: number): number {
  return clamp01(t / Math.max(0.6, Math.abs(runTime) / PI));
}

/** The largest ghost mismatch max|f(t) − f(t + T)| over the dial window (0 when T is a period). */
export function ghostOffset(w: RingWave, T: number, n = 256): number {
  let worst = 0;
  for (let i = 0; i <= n; i++) {
    const t = w.dial.min + ((w.dial.max - w.dial.min) * i) / n;
    worst = Math.max(worst, Math.abs(waveValue(w, t) - waveValue(w, t + T)));
  }
  return worst;
}

// ================================================================ pose

export interface RingGatePose {
  /** the dialled value the world runs (the draft's) */
  value: number;
  /** laps for the full run (value → ratio) */
  laps: number;
  /** unwrapped phase advance shown now (2π · laps · replay); the outer ring's clockwise rotation */
  phase: number;
  /** the outer ring angle, math convention: −(phase mod 2π) ∈ (−2π, 0] (§2.5.7) */
  outerAngle: number;
  /** the inner disc rock (math, counter-clockwise): (π/2)·(y − d)/A at the replayed time */
  innerAngle: number;
  /** laps shown now (phase / 2π) */
  turns: number;
  /** tally teeth advanced now */
  tally: number;
  /** the locked predicate (parity with grade) */
  aligned: boolean;
  /** the notch is home after ≥ 1 full lap (true at 2π too: the trap) */
  home: boolean;
  /** notch misalignment δ ∈ (−π, π] (a navy arc on the wall, no number) */
  misalign: number;
  /** release replay progress 0 → 1 */
  replay: number;
  /** machine lit: 0 before the control is touched */
  lit: number;
  /** fin halves split 0 → 1 (success) */
  fin: number;
  /** doorway light and flow 0 → 1 (success) */
  doorOpen: number;
  /** canal water 0 → 1 (success, flow water) */
  water: number;
  /** counterweight height 0 → 1 (variant counterweight) */
  weight: number;
  counterweight: boolean;
  /** the laps chip is shown in the world (aid tier ≥ lapsCardTier) */
  lapsChip: boolean;
  solved: boolean;
  /** |target − eased| phase distance (drives the ring-turn loop) */
  lag: number;
}

function draftValue(input: Pick<PoseInput<RingGateConfig>, "draft">): number | null {
  const v = (input.draft?.input as { value?: unknown } | undefined)?.value;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Derived ring fields for an (unwrapped) phase. */
export function ringFromPhase(w: Pick<RingWave, "wave" | "b" | "c">, phase: number): Pick<RingGatePose, "outerAngle" | "innerAngle" | "turns" | "tally" | "misalign"> {
  const turns = phase / TWO_PI;
  const m = ((phase % TWO_PI) + TWO_PI) % TWO_PI;
  const outerAngle = m === 0 ? 0 : -m;
  const tt = phase / Math.abs(w.b); // the machine's running time for that phase advance (signed)
  return {
    outerAngle,
    innerAngle: (PI / 2) * unitWave(w, tt),
    turns,
    tally: tallyOf(turns),
    misalign: wrapPi(phase),
  };
}

export function ringPose(input: PoseInput<RingGateConfig>): RingGatePose {
  if (input.solved) return ringSolvedPose(input);
  const w = waveOf(input.view);
  const d = draftValue(input);
  const value = clamp(d ?? w.dial.min, w.dial.min, w.dial.max);
  const laps = lapsFor(w, value);
  const runTime = laps * w.period;
  const replay = input.config.replayOnSettle && input.draft?.settled ? replayProgress(input.t, runTime) : 1;
  const phase = TWO_PI * laps * replay;
  const k = Math.round(laps);
  return {
    value,
    laps,
    phase,
    ...ringFromPhase(w, phase),
    aligned: isAligned(w, value),
    home: k >= 1 && Math.abs(laps - k) <= HOME_LAPS,
    replay,
    lit: input.draft ? 1 : 0,
    fin: 0,
    doorOpen: 0,
    water: 0,
    weight: input.config.variant === "counterweight" ? clamp01((value - w.dial.min) / (w.dial.max - w.dial.min)) : 0,
    counterweight: input.config.variant === "counterweight",
    lapsChip: input.aidTier >= input.config.lapsCardTier,
    solved: false,
    lag: 0,
  };
}

/** Settled solved state: the notch and cutout home at 6 o'clock after one lap, fins split, doorway flooded. */
export function ringSolvedPose(input: PoseInput<RingGateConfig>): RingGatePose {
  const w = waveOf(input.view);
  const value = clamp(draftValue(input) ?? w.answer, w.dial.min, w.dial.max);
  const phase = TWO_PI; // one lap, home
  return {
    value,
    laps: 1,
    phase,
    ...ringFromPhase(w, phase),
    innerAngle: 0,
    misalign: 0,
    aligned: true,
    home: true,
    replay: 1,
    lit: 1,
    fin: 1,
    doorOpen: 1,
    water: input.config.flow === "water" ? 1 : 0,
    weight: input.config.variant === "counterweight" ? clamp01((value - w.dial.min) / (w.dial.max - w.dial.min)) : 0,
    counterweight: input.config.variant === "counterweight",
    lapsChip: input.aidTier >= input.config.lapsCardTier,
    solved: true,
    lag: 0,
  };
}

export function ringLerp(from: RingGatePose, to: RingGatePose, t: number): RingGatePose {
  const k = clamp01(t);
  const late = k >= 0.5;
  const phase = lerp(from.phase, to.phase, k);
  const turns = phase / TWO_PI;
  const m = ((phase % TWO_PI) + TWO_PI) % TWO_PI;
  return {
    ...to,
    value: lerp(from.value, to.value, k),
    laps: lerp(from.laps, to.laps, k),
    phase,
    outerAngle: m === 0 ? 0 : -m,
    innerAngle: lerp(from.innerAngle, to.innerAngle, k),
    turns,
    tally: tallyOf(turns),
    misalign: wrapPi(phase),
    aligned: late ? to.aligned : from.aligned,
    home: late ? to.home : from.home,
    replay: lerp(from.replay, to.replay, k),
    lit: lerp(from.lit, to.lit, k),
    fin: lerp(from.fin, to.fin, k),
    doorOpen: lerp(from.doorOpen, to.doorOpen, k),
    water: lerp(from.water, to.water, k),
    weight: lerp(from.weight, to.weight, k),
    counterweight: to.counterweight,
    lapsChip: to.lapsChip,
    solved: late ? to.solved : from.solved,
    lag: Math.abs(to.phase - phase),
  };
}

// ================================================================ describe

const ROMAN = ["0", "I", "II", "III", "IIII", "V", "VI"] as const;
export function roman(n: number): string {
  return ROMAN[clamp(Math.round(n), 0, ROMAN.length - 1)];
}

/** The near-miss a pose shows (shown only after a failed Verify): computed on the FULL run, never the replay. */
export function nearMissOf(w: RingWave, value: number): string | null {
  if (isAligned(w, value)) return null;
  const laps = lapsFor(w, value);
  const k = Math.round(laps);
  if (k >= 2 && Math.abs(laps - k) <= HOME_LAPS) return "aligned_multiple";
  if (laps < 1) return "short_of_cycle";
  return null;
}

function describeRing(pose: RingGatePose, input: PoseInput<RingGateConfig>): Described {
  const w = waveOf(input.view);
  const y = w.amplitude * unitWaveFromAngle(pose.innerAngle) + w.d; // f at the machine's (replayed) time
  const chips: ChipSpec[] = [{ anchor: "inner_hub", text: `y: ${fmtNumber(y, 2)}`, color: "f" }];
  if (pose.lapsChip && input.config.tally) chips.push({ anchor: "rim", text: `laps: ${fmtNumber(pose.turns, 2)}`, color: "h" });
  const degOff = Math.round((Math.abs(pose.misalign) * 180) / PI);
  let srText: string;
  if (pose.solved) srText = "The rings are locked: the doorway stands open.";
  else if (!input.draft) srText = "The rings rest with the notch at home; the gate is closed.";
  else if (pose.replay < 1) srText = "The rings are replaying the time you set.";
  else if (pose.aligned) srText = "The notches line up: the doorway is clear.";
  else if (pose.home) srText = `The notch is home, but the tally reads ${roman(pose.tally)}.`;
  else srText = `The notch is ${degOff}° from home; the tally reads ${roman(pose.tally)}.`;
  return { chips, pins: [], srText, nearMiss: input.draft ? nearMissOf(w, pose.value) : null };
}

/** (y − d)/A back from the inner disc's rock angle (ψ = (π/2)·(y − d)/A). */
function unitWaveFromAngle(psi: number): number {
  return clamp(psi / (PI / 2), -1, 1);
}

// ================================================================ panel

const SYMBOL: Readonly<Record<Ask, string>> = { period: "T", frequency: "f", amplitude: "A", phase: "φ", midline: "d" };

export function scalarInputFor(w: RingWave): NonNullable<PanelStatic["input"]> {
  const majors = [...w.dial.ticks].sort((a, b) => a.value - b.value);
  const ticks: Tick[] = [];
  majors.forEach((t, i) => {
    ticks.push({ v: t.value, label: t.label.replace(/-/g, MINUS), major: true });
    const next = majors[i + 1];
    if (next) ticks.push({ v: (t.value + next.value) / 2, label: null, major: false });
  });
  return {
    symbol: SYMBOL[w.ask],
    min: w.dial.min,
    max: w.dial.max,
    step: w.dial.step,
    unit: w.pi ? "pi" : "number",
    format: w.pi ? "pi" : "number",
    ticks: ticks.length ? ticks : niceTicks(w.dial.min, w.dial.max, w.pi ? "pi" : "number"),
  };
}

/** The t axis of the f/ghost/laps cards: the dial window when the ask is a time (period), else one to two periods. */
function tAxis(w: RingWave): AxisModel {
  const timeAsk = w.ask === "period";
  const min = timeAsk ? w.dial.min : 0;
  const max = timeAsk ? w.dial.max : Math.max(w.period * 2, 1);
  const unit = timeAsk ? (w.pi ? "pi" : "number") : Number.isFinite(w.period / PI) && Math.abs(w.period / PI - Math.round(w.period / PI)) < 1e-9 ? "pi" : "number";
  return { min, max, unit, ticks: labelOnly(niceTicks(min, max, unit, 8), (t, _i, all) => t.v === all[all.length - 1].v), label: null };
}
function yAxis(w: RingWave): AxisModel {
  const reach = Math.abs(w.amplitude) + Math.abs(w.d);
  const yMax = Math.max(1.5, Math.ceil(reach * 1.25 * 2) / 2);
  return { min: -yMax, max: yMax, unit: "number", ticks: niceTicks(-yMax, yMax, "number", 4), label: null };
}

type GraphCard = Extract<CardModel, { kind: "graph" }>;

function fPlot(w: RingWave, x: AxisModel, style: PlotModel["style"], id = "f", shift = 0, color: PlotModel["color"] = "f"): PlotModel {
  return { id, color, style, segments: sample((t) => waveValue(w, t + shift), x.min, x.max, 320), endpoints: [] };
}

function fCard(w: RingWave, startMarker: boolean): GraphCard {
  const x = tAxis(w);
  const annotations: GraphAnnotation[] = [];
  if (w.d !== 0) annotations.push({ kind: "hline", y: w.d, label: "midline", style: "dashed", color: "f" });
  if (startMarker) annotations.push({ kind: "period_marker", x: x.min, y: waveValue(w, x.min), color: "f" });
  return {
    kind: "graph",
    slot: 0,
    title: w.equation || "f(t)",
    tab: "f(t)",
    x,
    y: yAxis(w),
    plots: [fPlot(w, x, "solid")],
    annotations,
    columns: [],
    targetLine: null,
    empty: false,
    sr: `f of t, ${w.equation}, a ${w.wave === "cos" ? "cosine" : "sine"} wave${startMarker ? "; a hollow marker shows where it starts, rising" : ""}; the orange line marks your ${SYMBOL[w.ask]}.`,
  };
}

/** The ghost card: a faint f and the green dashed f(t + T) for the dialled T (T = the machine's run time). */
export function ghostCard(w: RingWave, runTime: number): GraphCard {
  const x = tAxis(w);
  return {
    kind: "graph",
    slot: 1,
    title: "f(t + T)",
    tab: "g",
    x,
    y: yAxis(w),
    plots: [fPlot(w, x, "ghost"), fPlot(w, x, "dashed", "g", runTime, "g")],
    annotations: [],
    columns: [],
    targetLine: null,
    empty: false,
    sr: "A faint copy of f with the green wave shifted by the time you set; when the time is a period the two coincide.",
  };
}

function lapsCard(w: RingWave, empty: boolean): GraphCard {
  const x = tAxis(w);
  const lapsAt = (t: number) => (Math.abs(w.b) * t) / TWO_PI;
  const top = Math.max(1, Math.ceil(lapsAt(x.max)));
  const plots: PlotModel[] = [];
  const endpoints: { x: number; y: number; open: boolean }[] = [];
  const floorSegs: (readonly [number, number])[][] = [];
  if (!empty) {
    plots.push({ id: "laps", color: "h", style: "solid", segments: [[[x.min, lapsAt(x.min)], [x.max, lapsAt(x.max)]]], endpoints: [] });
    for (let k = 0; k <= top; k++) {
      const t0 = k * w.period;
      const t1 = Math.min(x.max, (k + 1) * w.period);
      if (t0 > x.max + 1e-9) break;
      floorSegs.push([[t0, k], [t1, k]]);
      endpoints.push({ x: t0, y: k, open: false });
      if (t1 < x.max - 1e-9 || Math.abs(t1 - (k + 1) * w.period) < 1e-9) endpoints.push({ x: t1, y: k, open: true });
    }
    plots.push({ id: "floor", color: "h", style: "ghost", segments: floorSegs, endpoints });
  }
  return {
    kind: "graph",
    slot: 2,
    title: "laps = bt / 2π",
    tab: "h",
    x,
    y: { min: 0, max: top, unit: "count", ticks: niceTicks(0, top, "count", 4), label: null },
    plots,
    annotations: [],
    columns: [],
    targetLine: null,
    empty,
    sr: empty ? "The laps card is still dark; it fills in with the second hint." : "Laps counted as the machine runs: one lap per period.",
  };
}

function panelStaticRing(input: StaticInput<RingGateConfig>): PanelStatic {
  const w = waveOf(input.view);
  const cards: CardModel[] = [fCard(w, input.aidTier >= input.config.startMarkerTier)];
  const turnAsk = w.ask === "period" || w.ask === "frequency";
  if (input.config.ghostCard && turnAsk) cards.push(ghostCard(w, 0));
  if (input.config.tally && turnAsk) cards.push({ ...lapsCard(w, input.aidTier < input.config.lapsCardTier), slot: cards.length });
  return { cards, input: scalarInputFor(w), probe: null, recordPins: [] };
}

function panelLiveRing(stat: PanelStatic, input: PoseInput<RingGateConfig>): PanelLive {
  const w = waveOf(input.view);
  const value = clamp(draftValue(input) ?? w.dial.min, w.dial.min, w.dial.max);
  const laps = lapsFor(w, value);
  const runTime = laps * w.period;
  const readout = w.pi ? formatPi(value) : fmtNumber(value, w.dial.step < 0.1 ? 2 : 1);
  const chips: PanelLive["chips"][number][] = [];
  const liveCards: CardModel[] = [];
  const touched = input.draft !== null || input.solved;
  for (const card of stat.cards) {
    if (card.kind !== "graph") continue;
    if (card.tab === "f(t)") {
      const tAt = w.ask === "period" ? value : runTime;
      const y = waveValue(w, tAt);
      chips.push({ slot: card.slot, value: y, text: fmtNumber(y, 2), color: "f" });
      if (touched && tAt >= card.x.min && tAt <= card.x.max) liveCards.push({ ...card, annotations: [...card.annotations, { kind: "live_dot", x: tAt, y, color: "f" }] });
    } else if (card.tab === "g") {
      if (touched) {
        const g = ghostCard(w, runTime);
        liveCards.push({ ...g, slot: card.slot, title: card.title });
      }
    } else if (card.tab === "h" && !card.empty) {
      chips.push({ slot: card.slot, value: laps, text: fmtNumber(laps, 2), color: "h" });
      if (touched && runTime <= card.x.max) liveCards.push({ ...card, annotations: [...card.annotations, { kind: "live_dot", x: runTime, y: laps, color: "h" }] });
    }
  }
  return { scrubX: value, readout, chips, highlights: [], liveCards };
}

// ================================================================ plans

function failurePlanRing(d: Diagnosis, input: PoseInput<RingGateConfig>): FailurePlan {
  const w = waveOf(input.view);
  const value = clamp(draftValue(input) ?? w.dial.min, w.dial.min, w.dial.max);
  const laps = lapsFor(w, value);
  const k = Math.round(laps);
  const slips = k >= 2 && Math.abs(laps - k) <= HOME_LAPS; // home, but the tally reads ≥ II
  const beats: FailBeat[] = [{ atMs: 0, anchor: "pawl_tip", action: "snap", params: { drop: 1 } }];
  if (slips) {
    beats.push({ atMs: 220, anchor: "tally", action: "grind", params: { tooth: k } });
    beats.push({ atMs: 420, anchor: "pawl_tip", action: "unseat", params: {} });
  } else {
    beats.push({ atMs: 220, anchor: "pawl_tip", action: "spark", params: { sparks: 8 } });
  }
  beats.push({ atMs: 380, anchor: "misalign", action: "flash", params: { dir: d.failKey === "over" ? 1 : d.failKey === "under" ? -1 : 0 } });
  beats.push({ atMs: 820, anchor: "misalign", action: "flash", params: {} });
  return { beats, durationMs: 1400, cue: slips ? "latch_slip" : "latch_clack" };
}

function successPlanRing(input: PoseInput<RingGateConfig>, anim: PayoffAnim): SuccessPlan {
  const beats: SuccessBeat[] = [
    { atMs: 0, anchor: "pawl_tip", action: "lock", params: { tooth: 1 } },
    { atMs: 100, anchor: "ring_center", action: "spin", params: { laps: 1, ms: 1200 } },
    { atMs: 1000, anchor: "fin_split", action: "open", params: { dx: FIN_SPLIT, ms: 400 } },
    { atMs: 1000, anchor: "doorway", action: "ignite", params: { ms: 400 } },
  ];
  const flow = input.config.flow;
  if (flow !== "none") beats.push({ atMs: 1300, anchor: "doorway", action: "flood", params: { flow, speed: WATER_SPEED, ms: 900 } });
  if (flow === "water") beats.push({ atMs: 1500, anchor: "skiff", action: "ride", params: { ms: 700 } });
  if (anim === "gate_lifts" || anim === "barrier_lifts") beats.push({ atMs: 1300, anchor: "doorway", action: "rise", params: { ms: 700 } });
  return { beats, cardEffects: [], durationMs: 2200, cue: "latch_click" };
}

// ================================================================ snapshots (DOM fallback, amendment 31)

/** DOM snapshot parts for a pose (the console is drawn by the host). */
export function ringSnapshot(pose: RingGatePose): SnapshotPart[] {
  const k = (slot: string) => partKey("orrery_terraces", "ring_gate", slot);
  const deg = (r: number) => Math.round(((r * 180) / PI) * 1000) / 1000;
  const split = Math.round(FIN_SPLIT * pose.fin);
  const parts: SnapshotPart[] = [
    { asset: k("gate_wall"), dx: 0, dy: WALL.y + WALL.h / 2 },
    { asset: k("canal"), dx: Math.round((CANAL.x0 + CANAL.x1) / 2), dy: CANAL.y + 12, alpha: pose.water > 0 ? 1 : 0.6 },
    { asset: k("outer_ring"), dx: 0, dy: 0, rotateDeg: deg(pose.phase % TWO_PI) },
    { asset: k("inner_disc"), dx: 0, dy: 0, rotateDeg: deg(-pose.innerAngle) },
    { asset: k("fin_l"), dx: -(FIN_GAP + 40) - split, dy: FIN_Y },
    { asset: k("fin_r"), dx: FIN_GAP + 40 + split, dy: FIN_Y },
    { asset: k("tally_wheel"), dx: TALLY_AT.x, dy: TALLY_AT.y, rotateDeg: deg((pose.tally * TWO_PI) / 6) },
    { asset: k("pawl"), dx: PAWL_PIVOT.x - 20, dy: PAWL_PIVOT.y + 30 },
  ];
  if (pose.water > 0) parts.push({ asset: k("skiff"), dx: -760, dy: CANAL.y - 10 });
  return parts;
}

export const SNAPSHOT_VIEW: OscillatorView = {
  equation: "y = sin(2t)",
  ask: "period",
  askLabel: "period",
  wave: "sin",
  amplitude: 1,
  b: 2,
  c: 0,
  d: 0,
  dial: { min: 0, max: TWO_PI, step: PI / 12, ticks: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ value: (i * PI) / 4, label: formatPi((i * PI) / 4).replace(MINUS, "-") })), unit: "" },
};
export const SNAPSHOT_CONFIG: RingGateConfig = RingGateConfig.parse({});
export function snapshotInput(solved: boolean): PoseInput<RingGateConfig> {
  return { view: SNAPSHOT_VIEW, draft: null, config: SNAPSHOT_CONFIG, probe: null, t: 0, aidTier: 0, hintsUsed: 0, sim: null, solved, reducedMotion: true };
}

export const RING_GATE_SKINS: readonly ContraptionSkin[] = [
  { ...RING_BASE, snapshot: { dormant: ringSnapshot(ringPose(snapshotInput(false))), solved: ringSnapshot(ringSolvedPose(snapshotInput(true))) } },
];

function skinFor(skinId: string): ContraptionSkin {
  return RING_GATE_SKINS.find((s) => s.id === skinId) ?? RING_GATE_SKINS[0];
}

// ================================================================ the meta

const COUNTERWEIGHT_ASKS: ReadonlySet<string> = new Set(["amplitude", "midline"]);
const FOOTPRINT: Footprint2D = { left: 140, right: 140, height: 240 };

export const ringGateMeta: ContraptionMeta<RingGateConfig, RingGatePose> = {
  id: "ring_gate",
  name: "Ring Gate",
  modes: ["tuner.oscillator"],
  tier: "native",
  status: "demo",
  reusable: "any_subject",
  layouts: ["scrub"],
  defaultLayout: "scrub",
  payoffs: ["door_opens", "gate_lifts", "barrier_lifts", "water_rises", "beam_restores"],
  nearMissKeys: ["aligned_multiple", "short_of_cycle"],
  accessories: [],
  skins: RING_GATE_SKINS,
  control: "scrub",
  configSchema: RingGateConfig,
  validateConfig(config: RingGateConfig, ctx: ConfigCtx): readonly ConfigIssue[] {
    const ask = (ctx.view as Partial<OscillatorView> | null)?.ask;
    const wantsCounterweight = typeof ask === "string" && COUNTERWEIGHT_ASKS.has(ask);
    if (config.variant === "counterweight" && !wantsCounterweight) {
      return [err(["variant"], `variant "counterweight" is only for amplitude/midline asks (this station asks ${String(ask)})`)];
    }
    if (config.variant === "notch" && wantsCounterweight) {
      return [err(["variant"], `ask "${String(ask)}" needs variant "counterweight" (the notch shows time, not height)`)];
    }
    return [];
  },
  defaultConfig(ctx: ConfigCtx): RingGateConfig {
    const ask = (ctx.view as Partial<OscillatorView> | null)?.ask;
    return RingGateConfig.parse({ variant: typeof ask === "string" && COUNTERWEIGHT_ASKS.has(ask) ? "counterweight" : "notch" });
  },
  writerConfigSchema: () => null, // derived entirely from the view and the biome (§4.4)
  fromWriterConfig(_w: unknown, ctx: ConfigCtx): RingGateConfig {
    return ringGateMeta.defaultConfig(ctx);
  },
  footprint: () => FOOTPRINT,
  frameBounds(): Bounds {
    return { x: -620, y: -640, w: 1180, h: 900 };
  },
  probe: () => null, // scalar mode: the Scrubber IS the input
  clock: { resetOn: ["open", "settle"] },
  sim: null,
  pose: ringPose,
  lerp: ringLerp,
  describe: describeRing,
  panelStatic: panelStaticRing,
  panelLive: panelLiveRing,
  hintTargets(rung: HintRung, input: StaticInput<RingGateConfig>): readonly HintTarget[] {
    return skinFor(input.skinId).hintTargets[rung - 1] ?? [];
  },
  audio(pose: RingGatePose): readonly AudioParam[] {
    const turn = clamp(pose.lag / PI, 0, 1);
    return [{ cue: "ring_turn", pitch: 0.7 + 0.9 * turn, gain: turn > 0.01 ? 0.12 + 0.4 * turn : 0 }];
  },
  failurePlan: failurePlanRing,
  successPlan: successPlanRing,
  solvedPose: ringSolvedPose,
  debug(pose: RingGatePose): Record<string, number | string | boolean> {
    const r3 = (v: number) => Math.round(v * 1000) / 1000;
    return {
      value: r3(pose.value),
      laps: r3(pose.laps),
      ringAngle: r3(pose.outerAngle),
      innerAngle: r3(pose.innerAngle),
      turns: r3(pose.turns),
      tally: pose.tally,
      aligned: pose.aligned,
      home: pose.home,
      misalign: r3(pose.misalign),
      replay: r3(pose.replay),
      lit: r3(pose.lit),
      fin: r3(pose.fin),
      doorOpen: r3(pose.doorOpen),
      water: r3(pose.water),
      weight: r3(pose.weight),
      solved: pose.solved,
    };
  },
};

/**
 * pendulum_sync — tuner.oscillator, ask period/frequency (docs/design/20 §4 row 3, §4.2, §7.4; trig §5.6 "The
 * Warden's Shield"; bible #36 and #39). A guardian swings its shield in real time; the player's counter-pendulum runs at
 * the dialled period T; the sync thread's brightness ½(1 + cos Δ) beats at |1/T₀ − 1/T|. Common-start reset on open and
 * on settle (and on the arena trigger for the shield's own clock).
 *
 * KA3 (L6): the complete pure half. Live-reveal rule (§2.5.6): a continuous mode may show how close the world is (the
 * thread's steadiness); the meta reads the VIEW only (b, c, d, A, ask and the dial), never params or the solution. The
 * locked predicate mirrors oscillator.grade exactly: |value − answer| ≤ 0.03 × dial span (parity test, 400 samples).
 *
 * "How far" and "how often" are independent (the boss's misconception): the shield sweeps A spans either way across the
 * door while the pendulum swings a small, fixed 14°; at T = T₀ the two move in lockstep anyway.
 *
 * Geometry is container-local (origin = station.anchor = the Star Door's centre at floor level, x right, y DOWN).
 */
import type { PayoffAnim } from "../../contracts/world";
import { clamp, clamp01, lerp } from "../ease";
import { fmtNumber, labelOnly, niceTicks, sample } from "../graph-math";
import { MIN_PENDULUM_PERIOD, pendulumBeat, pendulumPeriodOf, syncBrightness, wrapPhase, type PendulumBeatState } from "../sims/pendulum-beat";
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
} from "../types";
import { err, warn } from "./config-parts";
import { isAligned, scalarInputFor, waveOf, waveValue, type RingWave } from "./ring-gate.meta";
import { defineSkin, partKey } from "./skin-kit";
import { PendulumSyncConfig } from "./pendulum-sync.config";
export { PendulumSyncConfig } from "./pendulum-sync.config";

const PI = Math.PI;
const TWO_PI = 2 * PI;
const DEG = PI / 180;

// ================================================================ geometry (trig §5.6, anchor D = the door centre on the floor)

/** The protagonist's height H in zone units (shoulder 486 = 1200 − 4.2 H, trig §5.6). */
export const H_UNITS = 170;
/** Each Star Door leaf is 260 × 700; the doorway is the two leaves side by side. */
export const LEAF_W = 260;
export const DOOR_H = 700;
/** The Warden stands right of the door, facing left (x 5150 in the doc). */
export const WARDEN_X = 450;
export const WARDEN_H = 5.5 * H_UNITS; // 935
/** Its right shoulder (5020, 486) → local (320, −714). */
export const SHOULDER = { x: 320, y: -714 } as const;
/** The gauntlet that holds the haft sits above the door's centre: the shield hangs from it like a pendulum. */
export const PIVOT = { x: 0, y: -714 } as const;
/** Kneeling pulls the hand back toward the body and down by the kneel drop. */
export const KNEEL_DROP = 120;
export const PIVOT_KNEEL = { x: 300, y: PIVOT.y + KNEEL_DROP } as const;
/** The shield is 2.4 H across. */
export const SHIELD_R = 204;
/** The counter-pendulum pylon (x 3700 → −1000), 3 H tall, with its pivot on top. */
export const PYLON_X = -1000;
export const PYLON_H = 3 * H_UNITS; // 510
export const PYLON_PIVOT = { x: PYLON_X, y: -PYLON_H } as const;
/** asin() stays below this so the arm never snaps to horizontal. */
const MAX_SIN = 0.98;

// ================================================================ skin (§4.3)

const WARDEN_HINTS: readonly [readonly HintTarget[], readonly HintTarget[], readonly HintTarget[]] = [
  [{ anchor: "shield_boss", action: "circle", holdMs: 2000 }],
  [{ anchor: "pylon_pivot", action: "land", holdMs: 1500 }],
  [{ anchor: "bob", action: "ride", holdMs: 4000 }],
];

const WARDEN_BASE = defineSkin({
  id: "wardens_shield",
  name: "Warden's Shield",
  ns: "orrery_terraces",
  nouns: ["shield", "pendulum", "Warden", "counter-pendulum", "sync thread", "Star Door"],
  parts: [
    ["warden_body", "H"], ["warden_arm", "H"], ["shield", "H"], ["visor", "H"], ["star_door_l", "H"], ["star_door_r", "H"],
    ["counter_pylon", "K"], ["pendulum_arm", "K"], ["bob", "K"], ["span_tile", "K"], ["console", "K"],
  ],
  anchors: ["shoulder", "shield_boss", "bob", "pylon_pivot", "door_center", "visor", "console"],
  cues: { live: "sync_hum", succeed: "resonance_lock", fail: "thread_snap" },
  hintTargets: WARDEN_HINTS,
});

// ================================================================ pose

export interface PendulumSyncPose {
  /** the dialled value (the draft's, clamped to the dial); the dial minimum before the control is touched */
  value: number;
  /** a draft exists (the pendulum swings and the thread shows) */
  touched: boolean;
  /** the pendulum period implied by the value (s); null before a draft or for a non-positive frequency */
  T: number | null;
  /** the shield's period 2π/|b| (s) */
  T0: number;
  /** seconds on the shared clock (the sim's common start when it runs, else the station clock) */
  tau: number;
  /** raw phases (radians; snap in lerp) */
  phiS: number;
  phiP: number;
  /** the shield's displacement in spans: A·wave(b·τ + c) + d */
  shieldSpan: number;
  /** the haft angle from vertical (radians, + = the shield to the right): asin(s·U / L) */
  shieldAngle: number;
  /** the counter-pendulum's angle from vertical (radians): swingDeg · sin φp */
  pendAngle: number;
  /** wrap(φs − φp) ∈ (−π, π] */
  delta: number;
  /** sync brightness ½(1 + cos Δ) */
  B: number;
  /** |1/T₀ − 1/T| */
  beatHz: number;
  /** the thread sags (1 − B)·60 when B < 0.3 */
  sag: number;
  /** thread and pendulum lit: 0 untouched … 1 */
  lit: number;
  /** the locked predicate (parity with grade) */
  locked: boolean;
  /** success: the Warden kneels 0 → 1, the shield is lowered to its side 0 → 1, the Star Door opens 0 → 1 */
  kneel: number;
  lower: number;
  door: number;
  /** aid-tier gates (drift card at driftCardTier, peak dots at peakDotsTier) */
  driftCard: boolean;
  peakDots: boolean;
  solved: boolean;
}

function draftValue(input: Pick<PoseInput<PendulumSyncConfig>, "draft">): number | null {
  const v = (input.draft?.input as { value?: unknown } | undefined)?.value;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function periodAsk(w: RingWave): "period" | "frequency" {
  return w.ask === "frequency" ? "frequency" : "period";
}
/** The haft angle for a shield displacement of `span` spans. */
export function shieldAngleFor(span: number, config: Pick<PendulumSyncConfig, "spanUnitPx" | "shieldArmPx">): number {
  return Math.asin(clamp((span * config.spanUnitPx) / config.shieldArmPx, -MAX_SIN, MAX_SIN));
}
/** The pendulum's swing angle for a phase. */
export function pendAngleFor(phiP: number, config: Pick<PendulumSyncConfig, "swingDeg">): number {
  return config.swingDeg * DEG * Math.sin(phiP);
}
/** The shield's resting haft angle when the Warden kneels: the shield stands on the floor at the Warden's side. */
export function restAngle(config: Pick<PendulumSyncConfig, "shieldArmPx">): number {
  const down = -SHIELD_R - PIVOT_KNEEL.y; // the boss's height below the kneeling hand
  return Math.acos(clamp(down / config.shieldArmPx, -1, 1));
}

/** Pivot, haft angle and boss for a pose (container-local): the prefab and the snapshot use the same maths. */
export function shieldGeometry(
  pose: Pick<PendulumSyncPose, "shieldAngle" | "kneel" | "lower">,
  config: Pick<PendulumSyncConfig, "shieldArmPx">,
): { pivot: { x: number; y: number }; angle: number; boss: { x: number; y: number } } {
  const k = clamp01(pose.kneel);
  const pivot = { x: lerp(PIVOT.x, PIVOT_KNEEL.x, k), y: lerp(PIVOT.y, PIVOT_KNEEL.y, k) };
  const angle = lerp(pose.shieldAngle, restAngle(config), clamp01(pose.lower));
  const L = config.shieldArmPx;
  return { pivot, angle, boss: { x: pivot.x + L * Math.sin(angle), y: pivot.y + L * Math.cos(angle) } };
}
/** The pendulum's bob (container-local). */
export function bobAt(pendAngle: number, config: Pick<PendulumSyncConfig, "armPx">): { x: number; y: number } {
  return { x: PYLON_PIVOT.x + config.armPx * Math.sin(pendAngle), y: PYLON_PIVOT.y + config.armPx * Math.cos(pendAngle) };
}

/**
 * The shared clock and the phases at station time τ. With a sim state both phases come from the sim's common start
 * (its own t, extrapolated from `t0` while the sim is idle with the panel closed): φs = |b|·t and the integrated φp. Without
 * one the clock is τ and φp = 2πτ/T. The shield's displayed swing uses the same clock, so the thread's brightness always
 * matches the swings the player sees.
 */
export function phasesAt(
  w: Pick<RingWave, "b">,
  T: number | null,
  tau: number,
  sim: PendulumBeatState | null,
): { clock: number; phiS: number; phiP: number } {
  const clock = sim ? Math.max(sim.t, tau - sim.t0) : tau;
  const phiS = Math.abs(w.b) * clock;
  if (T === null) return { clock, phiS, phiP: sim ? sim.phiP : 0 };
  const rate = TWO_PI / Math.max(T, MIN_PENDULUM_PERIOD);
  if (sim) return { clock, phiS, phiP: sim.phiP + rate * (clock - sim.t) };
  return { clock, phiS, phiP: rate * clock };
}

function syncPose(input: PoseInput<PendulumSyncConfig, PendulumBeatState>): PendulumSyncPose {
  if (input.solved) return syncSolvedPose(input);
  const w = waveOf(input.view);
  const d = draftValue(input);
  const touched = d !== null;
  const value = clamp(d ?? w.dial.min, w.dial.min, w.dial.max);
  const T = touched ? pendulumPeriodOf(value, periodAsk(w)) : null;
  const { clock: tau, phiS, phiP } = phasesAt(w, T, Math.max(0, input.t), input.sim);
  const delta = wrapPhase(phiS - phiP);
  const B = T === null ? 0 : syncBrightness(delta);
  const shieldSpan = waveValue(w, tau);
  return {
    value,
    touched,
    T,
    T0: w.period,
    tau,
    phiS,
    phiP,
    shieldSpan,
    shieldAngle: shieldAngleFor(shieldSpan, input.config),
    pendAngle: T === null ? 0 : pendAngleFor(phiP, input.config),
    delta,
    B,
    beatHz: T === null ? 0 : Math.abs(1 / w.period - 1 / Math.max(T, MIN_PENDULUM_PERIOD)),
    sag: T !== null && B < 0.3 ? (1 - B) * 60 : 0,
    lit: touched ? 1 : 0,
    locked: touched && isAligned(w, value),
    kneel: 0,
    lower: 0,
    door: 0,
    driftCard: input.aidTier >= input.config.driftCardTier,
    peakDots: input.aidTier >= input.config.peakDotsTier,
    solved: false,
  };
}

/** Settled solved state: the thread gold and steady, the shield lowered beside the kneeling Warden, the door open. */
function syncSolvedPose(input: PoseInput<PendulumSyncConfig, PendulumBeatState>): PendulumSyncPose {
  const w = waveOf(input.view);
  const d = draftValue(input);
  const value = clamp(d ?? w.answer, w.dial.min, w.dial.max);
  const T = pendulumPeriodOf(value, periodAsk(w)) ?? w.period;
  return {
    value,
    touched: true,
    T,
    T0: w.period,
    tau: Math.max(0, input.t),
    phiS: 0,
    phiP: 0,
    shieldSpan: 0,
    shieldAngle: 0,
    pendAngle: 0,
    delta: 0,
    B: 1,
    beatHz: 0,
    sag: 0,
    lit: 1,
    locked: true,
    kneel: 1,
    lower: 1,
    door: 1,
    driftCard: input.aidTier >= input.config.driftCardTier,
    peakDots: input.aidTier >= input.config.peakDotsTier,
    solved: true,
  };
}

/** Continuous fields interpolate (angles directly, never the raw phases); discrete fields snap at t ≥ 0.5. */
export function syncLerp(from: PendulumSyncPose, to: PendulumSyncPose, t: number): PendulumSyncPose {
  const k = clamp01(t);
  const late = k >= 0.5;
  return {
    ...to,
    value: lerp(from.value, to.value, k),
    shieldSpan: lerp(from.shieldSpan, to.shieldSpan, k),
    shieldAngle: lerp(from.shieldAngle, to.shieldAngle, k),
    pendAngle: lerp(from.pendAngle, to.pendAngle, k),
    B: lerp(from.B, to.B, k),
    sag: lerp(from.sag, to.sag, k),
    lit: lerp(from.lit, to.lit, k),
    kneel: lerp(from.kneel, to.kneel, k),
    lower: lerp(from.lower, to.lower, k),
    door: lerp(from.door, to.door, k),
    touched: late ? to.touched : from.touched,
    locked: late ? to.locked : from.locked,
    solved: late ? to.solved : from.solved,
  };
}

// ================================================================ describe

const SYMBOL: Readonly<Record<"period" | "frequency", { symbol: string; unit: string }>> = {
  period: { symbol: "T", unit: "s" },
  frequency: { symbol: "f", unit: "Hz" },
};

/** Span-tile chip anchors: the two ends and the centre (every tile would crowd the projector). */
export function spanChipTiles(config: Pick<PendulumSyncConfig, "spanTiles">): number[] {
  const half = Math.floor(config.spanTiles / 2);
  return half > 0 ? [-half, 0, half] : config.spanTiles > 0 ? [0] : [];
}
export function spanAnchor(k: number): string {
  return k < 0 ? `span_m${-k}` : k > 0 ? `span_p${k}` : "span_0";
}

function describeSync(pose: PendulumSyncPose, input: PoseInput<PendulumSyncConfig, PendulumBeatState>): Described {
  const w = waveOf(input.view);
  const sym = SYMBOL[periodAsk(w)];
  const chips: ChipSpec[] = [];
  if (pose.touched) chips.push({ anchor: "pylon_pivot", text: `${sym.symbol}: ${fmtNumber(pose.value, w.dial.step < 0.1 ? 2 : 1)} ${sym.unit}`, color: "g" });
  if (w.equation) chips.push({ anchor: "shield_rim", text: w.equation, color: "f" });
  for (const k of spanChipTiles(input.config)) chips.push({ anchor: spanAnchor(k), text: fmtNumber(k, 0), color: "gold" });
  let srText: string;
  if (pose.solved) srText = "The sync thread burns gold; the Warden kneels and the Star Door stands open.";
  else if (!pose.touched) srText = "The Warden's shield sweeps across the Star Door; your counter-pendulum hangs still, waiting for a period.";
  else if (pose.beatHz < 1 / 60) srText = "The sync thread holds steady and bright: your pendulum and the shield swing in lockstep.";
  else {
    // qualitative, like the thread itself: a number here would let a listener solve for the target period
    const every = 1 / pose.beatHz;
    const pace = every > 20 ? "very slowly" : every > 8 ? "slowly" : every > 3 ? "steadily" : "quickly";
    srText = `The sync thread brightens and fades ${pace}: the two swings drift apart and back together.`;
  }
  return { chips, pins: [], srText, nearMiss: null };
}

// ================================================================ panel

type GraphCard = Extract<CardModel, { kind: "graph" }>;

/** The cards' time axis: the dial window when the dial IS a time (ask period), else two shield periods. */
function tAxis(w: RingWave): AxisModel {
  const timeDial = periodAsk(w) === "period";
  const min = timeDial ? w.dial.min : 0;
  const max = timeDial ? w.dial.max : Math.max(2 * w.period, 1);
  return { min, max, unit: "number", ticks: labelOnly(niceTicks(min, max, "number", 8), (t, _i, all) => t.v === all[all.length - 1].v), label: null };
}
function yAxis(w: RingWave): AxisModel {
  const reach = Math.abs(w.amplitude) + Math.abs(w.d);
  const yMax = Math.max(1.5, Math.ceil(reach * 1.25 * 2) / 2);
  return { min: -yMax, max: yMax, unit: "number", ticks: niceTicks(-yMax, yMax, "number", 4), label: null };
}
function driftAxis(): AxisModel {
  return { min: -2, max: 2, unit: "number", ticks: niceTicks(-2, 2, "number", 4), label: null };
}

/** The shield wave's peaks inside the dial window (the tier-2 peak dots). */
export function shieldPeaks(w: Pick<RingWave, "wave" | "b" | "c" | "amplitude" | "d" | "dial" | "ask" | "period">): number[] {
  if (w.b === 0) return [];
  const { min, max } = tAxis(w as RingWave);
  const target = (w.wave === "cos" ? 0 : PI / 2) + (w.amplitude < 0 ? PI : 0); // the argument where the value peaks
  const out: number[] = [];
  const kMin = Math.ceil((w.b * (w.b > 0 ? min : max) + w.c - target) / TWO_PI - 1e-9);
  for (let k = kMin; out.length < 12; k++) {
    const t = (target + TWO_PI * k - w.c) / w.b;
    if (t > max + 1e-9 && w.b > 0) break;
    if (t < min - 1e-9 && w.b < 0) break;
    if (t >= min - 1e-9 && t <= max + 1e-9) out.push(t);
  }
  return out.sort((a, b) => a - b);
}
/** The pendulum's own wave on the shield card's axes: sin(2πt/T) at amplitude 1. */
export function pendulumWave(T: number, t: number): number {
  return Math.sin((TWO_PI * t) / Math.max(T, MIN_PENDULUM_PERIOD));
}
/** Phase drift in cycles after t seconds: t·(1/T₀ − 1/T) (flat at T = T₀). */
export function driftAt(T0: number, T: number, t: number): number {
  return t * (1 / T0 - 1 / Math.max(T, MIN_PENDULUM_PERIOD));
}

function fPlot(w: RingWave, x: AxisModel, style: PlotModel["style"]): PlotModel {
  return { id: "f", color: "f", style, segments: sample((t) => waveValue(w, t), x.min, x.max, 320), endpoints: [] };
}

function shieldCard(w: RingWave, peakDots: boolean): GraphCard {
  const x = tAxis(w);
  const annotations: GraphAnnotation[] = [];
  if (w.d !== 0) annotations.push({ kind: "hline", y: w.d, label: "midline", style: "dashed", color: "f" });
  if (peakDots) for (const t of shieldPeaks(w)) annotations.push({ kind: "marker", x: t, y: waveValue(w, t), label: null, focusable: false });
  return {
    kind: "graph",
    slot: 0,
    title: "shield",
    tab: "f",
    x,
    y: yAxis(w),
    plots: [fPlot(w, x, "solid")],
    annotations,
    columns: [],
    targetLine: null,
    empty: false,
    sr: `The shield's swing, ${w.equation || "a sine wave"}, in spans over time${peakDots ? "; dots mark its peaks" : ""}; the orange line marks your ${SYMBOL[periodAsk(w)].symbol}.`,
  };
}
function pendulumCard(w: RingWave, T: number | null): GraphCard {
  const x = tAxis(w);
  const plots: PlotModel[] = [fPlot(w, x, "ghost")];
  if (T !== null) plots.push({ id: "g", color: "g", style: "solid", segments: sample((t) => pendulumWave(T, t), x.min, x.max, 320), endpoints: [] });
  return {
    kind: "graph",
    slot: 1,
    title: "pendulum",
    tab: "g",
    x,
    y: yAxis(w),
    plots,
    annotations: [],
    columns: [],
    targetLine: null,
    empty: false,
    sr: T === null ? "The pendulum card shows a faint copy of the shield's wave; set a period to draw your pendulum." : "Your pendulum's wave, small, over a faint copy of the shield's: the heights differ, the timing may not.",
  };
}
function driftCard(w: RingWave, T: number | null, unlocked: boolean): GraphCard {
  const x = tAxis(w);
  const plots: PlotModel[] = [];
  if (unlocked && T !== null) plots.push({ id: "h", color: "h", style: "solid", segments: sample((t) => driftAt(w.period, T, t), x.min, x.max, 64), endpoints: [] });
  return {
    kind: "graph",
    slot: 2,
    title: "drift",
    tab: "h",
    x,
    y: driftAxis(),
    plots,
    annotations: unlocked ? [{ kind: "hline", y: 0, label: null, style: "dashed", color: "h" }] : [],
    columns: [],
    targetLine: null,
    empty: !unlocked,
    sr: unlocked ? "Drift in cycles between the shield and your pendulum; a flat line means they stay together." : "The drift card is still dark; it fills in with the first hint or a missed Verify.",
  };
}

function panelStaticSync(input: StaticInput<PendulumSyncConfig>): PanelStatic {
  const w = waveOf(input.view);
  const cards: CardModel[] = [
    shieldCard(w, input.aidTier >= input.config.peakDotsTier),
    pendulumCard(w, null),
    driftCard(w, null, input.aidTier >= input.config.driftCardTier),
  ];
  return { cards, input: scalarInputFor(w), probe: null, recordPins: [] };
}

function panelLiveSync(stat: PanelStatic, input: PoseInput<PendulumSyncConfig, PendulumBeatState>): PanelLive {
  const w = waveOf(input.view);
  const d = draftValue(input);
  const value = clamp(d ?? (input.solved ? w.answer : w.dial.min), w.dial.min, w.dial.max);
  const touched = d !== null || input.solved;
  const T = touched ? pendulumPeriodOf(value, periodAsk(w)) : null;
  const readout = fmtNumber(value, w.dial.step < 0.1 ? 2 : 1);
  const chips: PanelLive["chips"][number][] = [];
  const liveCards: CardModel[] = [];
  const tAt = T ?? value; // the orange line: the dialled time
  for (const card of stat.cards) {
    if (card.kind !== "graph") continue;
    if (card.tab === "f") {
      const y = waveValue(w, tAt);
      chips.push({ slot: card.slot, value: y, text: fmtNumber(y, 2), color: "f" });
      if (touched && tAt >= card.x.min && tAt <= card.x.max) liveCards.push({ ...card, annotations: [...card.annotations, { kind: "live_dot", x: tAt, y, color: "f" }] });
    } else if (card.tab === "g") {
      if (T !== null) {
        const g = pendulumCard(w, T);
        const ann: GraphAnnotation[] = tAt >= card.x.min && tAt <= card.x.max ? [{ kind: "live_dot", x: tAt, y: pendulumWave(T, tAt), color: "g" }] : [];
        liveCards.push({ ...g, slot: card.slot, title: card.title, annotations: ann });
      }
    } else if (card.tab === "h" && !card.empty && T !== null) {
      const drift = driftAt(w.period, T, tAt);
      chips.push({ slot: card.slot, value: drift, text: fmtNumber(drift, 2), color: "h" });
      const h = driftCard(w, T, true);
      const ann: GraphAnnotation[] = [...h.annotations];
      if (tAt >= card.x.min && tAt <= card.x.max && Math.abs(drift) <= 2) ann.push({ kind: "live_dot", x: tAt, y: drift, color: "h" });
      liveCards.push({ ...h, slot: card.slot, title: card.title, annotations: ann });
    }
  }
  return { scrubX: value, readout, chips, highlights: [], liveCards };
}

// ================================================================ plans

function failurePlanSync(d: Diagnosis, input: PoseInput<PendulumSyncConfig, PendulumBeatState>): FailurePlan {
  const beats: FailBeat[] = [
    { atMs: 0, anchor: "thread", action: "snap", params: { spark: 1 } },
    { atMs: 0, anchor: "visor", action: "flash", params: { flare: 1 } },
    { atMs: 140, anchor: "shield_boss", action: "spark", params: { deflect: d.failKey === "under" ? -1 : 1 } },
  ];
  if (d.probeKeys.includes("reach")) beats.push({ atMs: 320, anchor: "span_0", action: "flash", params: { tiles: input.config.spanTiles, times: 2 } });
  if (d.probeKeys.includes("half")) beats.push({ atMs: 320, anchor: "bob", action: "flash", params: { times: 2 } });
  if (d.failKey === "over" || d.failKey === "under") beats.push({ atMs: 520, anchor: "bob", action: "wobble", params: { dir: d.failKey === "over" ? 1 : -1 } });
  beats.push({ atMs: 1150, anchor: "thread", action: "flash", params: { rejoin: 1 } });
  return { beats: beats.sort((a, b) => a.atMs - b.atMs), durationMs: 1600, cue: "thread_snap" };
}

function successPlanSync(_input: PoseInput<PendulumSyncConfig, PendulumBeatState>, anim: PayoffAnim): SuccessPlan {
  const beats: SuccessBeat[] = [
    { atMs: 0, anchor: "thread", action: "lock", params: { color: "gold", width: 8 } },
    { atMs: 0, anchor: "shield_boss", action: "cycle", params: { decay: 1, ms: 1000 } },
    { atMs: 1000, anchor: "shoulder", action: "lower", params: { kneel: 1, drop: KNEEL_DROP, bowDeg: 15, ms: 800 } },
    { atMs: 1600, anchor: "door_center", action: anim === "gate_lifts" || anim === "barrier_lifts" ? "rise" : "open", params: { ms: 800 } },
    { atMs: 1700, anchor: "door_center", action: "ignite", params: { ms: 700 } },
  ];
  return { beats, cardEffects: [], durationMs: 2500, cue: "resonance_lock" };
}

// ================================================================ snapshots (DOM fallback, amendment 31)

/** DOM snapshot parts for a pose (the console is drawn by the host). */
export function wardenSnapshot(pose: PendulumSyncPose, config: PendulumSyncConfig): SnapshotPart[] {
  const k = (slot: string) => partKey("orrery_terraces", "wardens_shield", slot);
  const deg = (r: number) => Math.round((r / DEG) * 1000) / 1000;
  const g = shieldGeometry(pose, config);
  const bob = bobAt(pose.pendAngle, config);
  const doorDx = Math.round(LEAF_W * pose.door);
  const kneel = Math.round(KNEEL_DROP * pose.kneel);
  const parts: SnapshotPart[] = [
    { asset: k("star_door_l"), dx: -LEAF_W / 2 - doorDx, dy: -DOOR_H / 2 },
    { asset: k("star_door_r"), dx: LEAF_W / 2 + doorDx, dy: -DOOR_H / 2 },
  ];
  const half = Math.floor(config.spanTiles / 2);
  for (let i = -half; i <= half && config.spanTiles > 0; i++) parts.push({ asset: k("span_tile"), dx: i * config.spanUnitPx, dy: -6 });
  parts.push(
    { asset: k("warden_body"), dx: WARDEN_X, dy: -WARDEN_H / 2 + kneel },
    { asset: k("visor"), dx: WARDEN_X - 30, dy: -840 + kneel, alpha: pose.solved ? 0.5 : 1 },
    { asset: k("warden_arm"), dx: Math.round((g.pivot.x + g.boss.x) / 2), dy: Math.round((g.pivot.y + g.boss.y) / 2), rotateDeg: deg(-g.angle) },
    { asset: k("shield"), dx: Math.round(g.boss.x), dy: Math.round(g.boss.y) },
    { asset: k("counter_pylon"), dx: PYLON_X, dy: -PYLON_H / 2 },
    { asset: k("pendulum_arm"), dx: Math.round((PYLON_PIVOT.x + bob.x) / 2), dy: Math.round((PYLON_PIVOT.y + bob.y) / 2), rotateDeg: deg(-pose.pendAngle) },
    { asset: k("bob"), dx: Math.round(bob.x), dy: Math.round(bob.y) },
  );
  return parts;
}

export const SNAPSHOT_VIEW: OscillatorView = {
  equation: "y = 3sin((π/2)t)",
  ask: "period",
  askLabel: "period",
  wave: "sin",
  amplitude: 3,
  b: PI / 2,
  c: 0,
  d: 0,
  dial: { min: 0, max: 8, step: 0.05, ticks: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((v) => ({ value: v, label: String(v) })), unit: "" },
};
export const SNAPSHOT_CONFIG: PendulumSyncConfig = PendulumSyncConfig.parse({});
export function snapshotInput(solved: boolean): PoseInput<PendulumSyncConfig, PendulumBeatState> {
  return { view: SNAPSHOT_VIEW, draft: null, config: SNAPSHOT_CONFIG, probe: null, t: 0, aidTier: 0, hintsUsed: 0, sim: null, solved, reducedMotion: true };
}

export const PENDULUM_SYNC_SKINS: readonly ContraptionSkin[] = [
  {
    ...WARDEN_BASE,
    snapshot: {
      dormant: wardenSnapshot(syncPose(snapshotInput(false)), SNAPSHOT_CONFIG),
      solved: wardenSnapshot(syncSolvedPose(snapshotInput(true)), SNAPSHOT_CONFIG),
    },
  },
];

function skinFor(skinId: string): ContraptionSkin {
  return PENDULUM_SYNC_SKINS.find((s) => s.id === skinId) ?? PENDULUM_SYNC_SKINS[0];
}

// ================================================================ the meta

const PERIODIC_ASKS: ReadonlySet<string> = new Set(["period", "frequency"]);
const FOOTPRINT: Footprint2D = { left: 160, right: 160, height: 260 };

export function validatePendulumSync(config: PendulumSyncConfig, ctx: ConfigCtx): ConfigIssue[] {
  const view = ctx.view as Partial<OscillatorView> | null;
  const ask = view?.ask;
  if (!(typeof ask === "string" && PERIODIC_ASKS.has(ask))) return [err(["view", "ask"], `pendulum_sync needs a period or frequency ask (got ${String(ask)})`)];
  const out: ConfigIssue[] = [];
  const reach = (Math.abs(typeof view?.amplitude === "number" ? view.amplitude : 1) + Math.abs(typeof view?.d === "number" ? view.d : 0)) * config.spanUnitPx;
  if (reach > MAX_SIN * config.shieldArmPx) out.push(warn(["shieldArmPx"], `the shield's sweep (${Math.round(reach)}) is longer than its arm (${config.shieldArmPx}); the arm will clamp`));
  const half = Math.floor(config.spanTiles / 2);
  if (config.spanTiles > 0 && half < Math.ceil(Math.abs(typeof view?.amplitude === "number" ? view.amplitude : 1))) {
    out.push(warn(["spanTiles"], `${config.spanTiles} span tiles do not reach the shield's ${Math.abs(view?.amplitude ?? 1)}-span sweep`));
  }
  return out;
}

export const pendulumSyncMeta: ContraptionMeta<PendulumSyncConfig, PendulumSyncPose, PendulumBeatState> = {
  id: "pendulum_sync",
  name: "Pendulum Sync",
  modes: ["tuner.oscillator"],
  tier: "native",
  status: "demo",
  reusable: "any_subject",
  layouts: ["scrub"],
  defaultLayout: "scrub",
  payoffs: ["door_opens", "gate_lifts", "barrier_lifts", "vault_opens"],
  nearMissKeys: [], // trig e6 uses station probes (reach, half) and fail keys (over, under)
  accessories: [],
  skins: PENDULUM_SYNC_SKINS,
  control: "scrub",
  configSchema: PendulumSyncConfig,
  validateConfig: (config, ctx) => validatePendulumSync(config, ctx),
  defaultConfig: () => PendulumSyncConfig.parse({}),
  writerConfigSchema: () => null, // derived entirely from the view (§4.4)
  fromWriterConfig: () => PendulumSyncConfig.parse({}),
  footprint: () => FOOTPRINT,
  frameBounds(): Bounds {
    // the console (−1150) and the pylon on the left, the Warden's full height and plinth on the right
    return { x: -1290, y: -1010, w: 1990, h: 1090 };
  },
  probe: () => null, // scalar mode: the Scrubber IS the input
  clock: { resetOn: ["open", "settle", "arena"] },
  sim: pendulumBeat,
  pose: syncPose,
  lerp: syncLerp,
  describe: describeSync,
  panelStatic: panelStaticSync,
  panelLive: panelLiveSync,
  hintTargets(rung: HintRung, input: StaticInput<PendulumSyncConfig>): readonly HintTarget[] {
    return skinFor(input.skinId).hintTargets[rung - 1] ?? [];
  },
  audio(pose: PendulumSyncPose): readonly AudioParam[] {
    if (pose.solved || pose.lit <= 0.01) return [];
    return [{ cue: "sync_hum", pitch: 0.6 + 0.8 * pose.B, gain: pose.lit * (0.04 + 0.12 * pose.B) }];
  },
  failurePlan: failurePlanSync,
  successPlan: successPlanSync,
  solvedPose: syncSolvedPose,
  debug(pose: PendulumSyncPose): Record<string, number | string | boolean> {
    const r3 = (v: number) => Math.round(v * 1000) / 1000;
    return {
      value: r3(pose.value),
      touched: pose.touched,
      T: pose.T === null ? -1 : r3(pose.T),
      T0: r3(pose.T0),
      tau: r3(pose.tau),
      shieldSpan: r3(pose.shieldSpan),
      shieldAngle: r3(pose.shieldAngle),
      pendAngle: r3(pose.pendAngle),
      delta: r3(pose.delta),
      B: r3(pose.B),
      beatHz: r3(pose.beatHz),
      sag: r3(pose.sag),
      locked: pose.locked,
      kneel: r3(pose.kneel),
      door: r3(pose.door),
      solved: pose.solved,
    };
  },
};

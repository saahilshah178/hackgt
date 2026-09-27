/**
 * emitter_rail — mapper.number_line (docs/design/20 §4 row 2, §4.2, §4.4, §7.4; trig §5.1 "The Vesper Dial"; bible
 * P7 / P2). A carriage rides a rail (an ARC for a 2π π-labelled line, straight otherwise, log for log scales); its beam
 * sweeps into the fog where the target hides; sin/cos gauges ride beside an arc; landmark studs and equally sticky
 * detents; gold chevrons after a miss show the direction and a distance band (1/2/3), never the target.
 *
 * KA2 (L6): the complete pure half. Live-reveal rule (§2.5.6): pose/describe/panelLive read the VIEW (min, max, scale,
 * landmarks and the target LABEL the mode already prints), the draft and the aid tier; never params or the solution.
 * `locked` (the beam-locked predicate) mirrors numberLine.grade exactly (parity test, 400 samples) and is never drawn
 * live: the beam ends in the same soft fog bloom at every angle, so there is no aim-by-eye shortcut.
 *
 * Geometry is container-local (origin = station.anchor = the dial centre C, x right, y DOWN):
 * carriage P(θ) = (r cos θ, −r sin θ) (θ grows counter-clockwise, over the top).
 */
import type { PayoffAnim } from "../../contracts/world";
import { evalExact } from "../../mechanics/util";
import { lineFraction } from "../diagnose/number-line";
import { clamp, clamp01, lerp } from "../ease";
import { fmtNumber, formatPi, MINUS, sample } from "../graph-math";
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
  HintRung,
  HintTarget,
  NumberLineView,
  PanelLive,
  PanelStatic,
  PoseInput,
  SnapshotPart,
  StaticInput,
  SuccessBeat,
  SuccessPlan,
  Tick,
} from "../types";
import { err, exprValue, warn } from "./config-parts";
import { defineSkin, partKey } from "./skin-kit";
import { EmitterRailConfig } from "./emitter-rail.config";
export { EmitterRailConfig } from "./emitter-rail.config";

const PI = Math.PI;
const TWO_PI = 2 * PI;

// ================================================================ constants (the mode's and the doc's)

/** numberLine's TOLERANCE (line fraction); pinned to grade() by the parity test. */
export const NUMBER_LINE_TOLERANCE = 0.015;
/** Fog band radius from the dial centre (trig §5.1: Vesper's Lens hides at radius 900). */
export const FOG_RADIUS = 900;
/** A beam outside the fog arc ends on the wall or floor within this length. */
export const WALL_BEAM = 420;
/** The fog arc spans [FOG_EDGE, π − FOG_EDGE] as seen from the dial centre. */
export const FOG_EDGE = 0.05;
/** A settled knob within this many radians of a stud eases onto it (for a π/12 detent; scaled for other steps). */
export const DETENT_CAPTURE_RAD = 0.05;
/** The carriage chip reads "θ = π" within this distance of a landmark. */
export const LANDMARK_EQ = 0.01;
/** Straight rails: the beam fires straight up into the fog band this far above the rail. */
export const STRAIGHT_FOG_Y = 560;
/** Plumb (sine) gauge x offset beyond the rail radius; slide (cosine) gauge y offset below it. */
export const PLUMB_DX = 80;
export const SLIDE_DY = 50;
/** Spoke ledges (the e1 payoff treads): width and rise per tread. */
export const LEDGE_W = 60;
export const LEDGE_RISE = 80;
export const LEDGE_COUNT = 5;

// ================================================================ skin (§4.3)

const VESPER_HINTS: readonly [readonly HintTarget[], readonly HintTarget[], readonly HintTarget[]] = [
  [{ anchor: "center", action: "circle", holdMs: 1500 }],
  [{ anchor: "beam_origin", action: "ride", holdMs: 3000 }],
  [{ anchor: "pin", action: "land", holdMs: 1500 }],
];

const VESPER_BASE = defineSkin({
  id: "vesper_dial",
  name: "Vesper Dial",
  ns: "orrery_terraces",
  nouns: ["dial", "rail", "carriage", "beam", "lens", "Vesper Dial"],
  parts: [
    ["disc", "H"], ["rail_ring", "K"], ["carriage", "H"], ["beam_cap", "K", "shared.part.beam_cap"], ["plumb_gauge", "K"],
    ["slide_gauge", "K"], ["fog_band", "K"], ["vesper_lens", "H"], ["spoke_ledge", "K"], ["console", "K"],
  ],
  anchors: ["center", "spoke_0…4", "beam_origin", "bob", "marker", "pin", "console"],
  cues: { live: "beam_hum", succeed: "node_ignite", fail: "beam_scatter" },
  hintTargets: VESPER_HINTS,
});

// ================================================================ the line (view readers)

export interface RailLine {
  scale: "linear" | "log";
  min: number;
  max: number;
  /** π-labelled landmarks */
  pi: boolean;
  landmarks: readonly { value: number; fraction: number; label: string }[];
  /** the target's value parsed from the view's printed label ("5π/6"), or null */
  target: number | null;
  targetLabel: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const fin = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

/** "5π/6" → 5π/6, "−π/2" → −π/2, "10^3" → 1000, "3/8" → 0.375 (the inverse of the mode's prettyExpr). */
export function parsePrettyValue(label: string): number | null {
  if (typeof label !== "string" || label.trim() === "") return null;
  const e = label
    .replace(/\s+/g, "")
    .replace(/[\u2212\u2013]/g, "-") // typographic minus, en dash (escaped: robust to the page encoding)
    .replace(/\u03c0/g, "pi")
    .replace(/(\d|\))(?=pi|sqrt|[a-df-zA-Z(])/g, "$1*")
    .replace(/pi(?=\d|\()/g, "pi*");
  return evalExact(e);
}

/** π-labelled and spanning exactly 2π (the arc rail's precondition). */
export function isTwoPiLine(view: Partial<NumberLineView> | null): boolean {
  if (!view || typeof view.min !== "number" || typeof view.max !== "number") return false;
  const piLabels = (view.landmarks ?? []).some((l) => l.label.includes("\u03c0"));
  return view.scale !== "log" && piLabels && Math.abs(view.max - view.min - TWO_PI) < 1e-6;
}

export function lineOf(view: unknown): RailLine {
  const v = isObj(view) ? view : {};
  const min = fin(v.min, 0);
  const max = fin(v.max, 1) > min ? fin(v.max, 1) : min + 1;
  const scale = v.scale === "log" ? "log" : "linear";
  const landmarks = (Array.isArray(v.landmarks) ? v.landmarks : [])
    .filter(isObj)
    .map((l) => ({ value: fin(l.value, NaN), fraction: fin(l.fraction, NaN), label: String(l.label ?? "").replace(/-/g, MINUS) }))
    .filter((l) => Number.isFinite(l.value))
    .sort((a, b) => a.value - b.value);
  const targetLabel = typeof v.target === "string" ? v.target : "";
  return { scale, min, max, pi: landmarks.some((l) => l.label.includes("π")), landmarks, target: parsePrettyValue(targetLabel), targetLabel };
}

/** The line fraction of a value (linear or log), as numberLine.grade computes it. */
export function fractionOf(line: Pick<RailLine, "scale" | "min" | "max">, value: number): number {
  return lineFraction(line, value);
}

/** The beam-locked predicate: |fraction(v) − fraction(target)| ≤ 0.015, exactly numberLine.grade's test. */
export function isLocked(line: RailLine, value: number): boolean {
  if (line.target === null || !Number.isFinite(value)) return false;
  const got = fractionOf(line, value);
  return Number.isFinite(got) && Math.abs(got - fractionOf(line, line.target)) <= NUMBER_LINE_TOLERANCE;
}

/** The input symbol: θ on π lines, x elsewhere. */
export function symbolOf(line: Pick<RailLine, "pi">): string {
  return line.pi ? "θ" : "x";
}

/**
 * The landmark bracket of a value (never a decimal): "π/2 < θ < π", "θ = π" within 0.01 of a landmark,
 * "θ < 0" / "θ > 2π" outside the labelled span. Without landmarks: the symbol alone.
 */
export function bracket(value: number, landmarks: RailLine["landmarks"], symbol = "θ", eq = LANDMARK_EQ): string {
  if (landmarks.length === 0 || !Number.isFinite(value)) return symbol;
  const on = landmarks.find((l) => Math.abs(l.value - value) <= eq);
  if (on) return `${symbol} = ${on.label}`;
  const right = landmarks.find((l) => l.value > value);
  const left = [...landmarks].reverse().find((l) => l.value < value);
  if (left && right) return `${left.label} < ${symbol} < ${right.label}`;
  if (right) return `${symbol} < ${right.label}`;
  return `${symbol} > ${left!.label}`;
}

/** The bracket in words for screen readers: "between π/2 and π", "on π", "before 0", "past 2π". */
export function bracketWords(value: number, landmarks: RailLine["landmarks"], eq = LANDMARK_EQ): string {
  if (landmarks.length === 0 || !Number.isFinite(value)) return "on the rail";
  const on = landmarks.find((l) => Math.abs(l.value - value) <= eq);
  if (on) return `on ${on.label}`;
  const right = landmarks.find((l) => l.value > value);
  const left = [...landmarks].reverse().find((l) => l.value < value);
  if (left && right) return `between ${left.label} and ${right.label}`;
  if (right) return `before ${right.label}`;
  return `past ${left!.label}`;
}

/** The detent step (radians or line units) from config.detent ("pi/12"), or null. */
export function detentStepOf(config: Pick<EmitterRailConfig, "detent">): number | null {
  if (config.detent === null) return null;
  const v = exprValue(config.detent);
  return v !== null && v > 0 ? v : null;
}

/** Capture distance for a detent step: 0.05 rad for π/12 studs, scaled with the step elsewhere. */
export function detentCapture(step: number): number {
  return DETENT_CAPTURE_RAD * (step / (PI / 12));
}

/**
 * Detent snap: a value within the capture distance of a stud (min + k·step) snaps onto it; every stud is equally
 * sticky, so it leaks nothing. Returns the stud index when snapped.
 */
export function detentSnap(value: number, step: number | null, min: number, max: number): { value: number; stud: number | null } {
  if (step === null || !(step > 0) || !Number.isFinite(value)) return { value, stud: null };
  const k = Math.round((value - min) / step);
  const stud = min + k * step;
  if (stud < min - 1e-9 || stud > max + 1e-9) return { value, stud: null };
  return Math.abs(value - stud) <= detentCapture(step) + 1e-12 ? { value: stud, stud: k } : { value, stud: null };
}

/**
 * The failure chevrons' distance band from the view's target (the pin already prints it): 1 = within one stud,
 * 2 = within one landmark gap, 3 = further. Measured in line fractions so log lines work too.
 */
export function distanceBand(line: RailLine, value: number, detentStep: number | null): 1 | 2 | 3 {
  if (line.target === null || !Number.isFinite(value)) return 3;
  const d = Math.abs(fractionOf(line, value) - fractionOf(line, line.target));
  const fr = line.landmarks.map((l) => fractionOf(line, l.value)).filter(Number.isFinite);
  const gap = fr.length >= 2 ? Math.min(...fr.slice(1).map((f, i) => Math.abs(f - fr[i]))) : 0.25;
  const stud = line.scale === "linear" && detentStep !== null ? detentStep / (line.max - line.min) : gap / 6;
  if (d <= stud + 1e-9) return 1;
  if (d <= gap + 1e-9) return 2;
  return 3;
}

// ================================================================ pose

export type RailKind = EmitterRailConfig["rail"];

export interface EmitterRailPose {
  rail: RailKind;
  /** rail radius (arc) or half-length (straight/log), container units */
  radius: number;
  /** the value the world shows (the detent applied when settled) */
  value: number;
  /** the draft's own value (what grade() sees) */
  raw: number;
  /** line fraction of `value`, 0…1 */
  u: number;
  /** arc: the carriage angle (= value, radians, counter-clockwise); straight/log: π/2 (the beam fires up) */
  theta: number;
  carriageX: number;
  carriageY: number;
  /** Phaser rotation (clockwise +) that turns the carriage's orb outward: π/2 − θ on arcs, 0 on straight rails */
  carriageRot: number;
  beamDirX: number;
  beamDirY: number;
  beamLen: number;
  /** the beam reaches the fog band (else it ends on the wall or floor) */
  beamToFog: boolean;
  sin: number;
  cos: number;
  /** plumb bob y (= −r sin θ) and cosine marker x (= r cos θ) */
  bobY: number;
  markerX: number;
  /** the gold sweep arc on the disc rim runs 0 → sweep ("the walk so far") */
  sweep: number;
  detented: boolean;
  stud: number | null;
  /** the beam-locked predicate (parity with grade; never drawn live) */
  locked: boolean;
  /** beam alpha: 0 before the control is touched, 1 with a draft or solved */
  lit: number;
  /** fog band alpha (0.85 → 0 on success); 0 without a hidden target */
  fog: number;
  /** Vesper's Lens glow (success only) */
  lens: number;
  /** disc rotation after success (math, counter-clockwise): the disc turns by the angle you set */
  discTurn: number;
  /** spoke ledges extension 0…1 (the payoff treads) */
  ledges: number;
  solved: boolean;
  /** |target − eased| value distance (drives the carriage-roll loop) */
  lag: number;
}

/** Carriage, beam and gauges for an angle (arc) or a fraction (straight/log). */
export function railGeometry(rail: RailKind, radius: number, theta: number, u: number): Pick<
  EmitterRailPose,
  "carriageX" | "carriageY" | "carriageRot" | "beamDirX" | "beamDirY" | "beamLen" | "beamToFog" | "sin" | "cos" | "bobY" | "markerX" | "sweep"
> {
  if (rail === "arc") {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const wrapped = ((theta % TWO_PI) + TWO_PI) % TWO_PI;
    const toFog = wrapped >= FOG_EDGE - 1e-12 && wrapped <= PI - FOG_EDGE + 1e-12;
    return {
      carriageX: radius * c,
      carriageY: -radius * s,
      carriageRot: PI / 2 - theta,
      beamDirX: c,
      beamDirY: -s,
      beamLen: toFog ? FOG_RADIUS - radius : WALL_BEAM,
      beamToFog: toFog,
      sin: s,
      cos: c,
      bobY: -radius * s,
      markerX: radius * c,
      sweep: theta,
    };
  }
  const x = -radius + 2 * radius * clamp01(u);
  return {
    carriageX: x,
    carriageY: 0,
    carriageRot: 0,
    beamDirX: 0,
    beamDirY: -1,
    beamLen: STRAIGHT_FOG_Y,
    beamToFog: true,
    sin: 0,
    cos: 0,
    bobY: 0,
    markerX: x,
    sweep: 0,
  };
}

function railOf(config: Pick<EmitterRailConfig, "rail">, line: RailLine): RailKind {
  if (config.rail === "arc") return "arc";
  return line.scale === "log" ? "log" : config.rail;
}

function draftValue(input: Pick<PoseInput<EmitterRailConfig>, "draft">): number | null {
  const v = (input.draft?.input as { value?: unknown } | undefined)?.value;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function buildPose(
  config: EmitterRailConfig,
  line: RailLine,
  raw: number,
  shown: number,
  extra: Pick<EmitterRailPose, "detented" | "stud" | "lit" | "fog" | "lens" | "discTurn" | "ledges" | "solved">,
): EmitterRailPose {
  const rail = railOf(config, line);
  const u = clamp01(fractionOf(line, shown));
  const theta = rail === "arc" ? shown : PI / 2;
  return {
    rail,
    radius: config.radius,
    value: shown,
    raw,
    u: Number.isFinite(u) ? u : 0,
    theta,
    ...railGeometry(rail, config.radius, theta, Number.isFinite(u) ? u : 0),
    locked: isLocked(line, raw),
    lag: 0,
    ...extra,
  };
}

function restFog(config: EmitterRailConfig): number {
  return config.hiddenTarget === "none" ? 0 : 0.85;
}

export function emitterPose(input: PoseInput<EmitterRailConfig>): EmitterRailPose {
  if (input.solved) return emitterSolvedPose(input);
  const line = lineOf(input.view);
  const d = draftValue(input);
  const raw = clamp(d ?? line.min, line.min, line.max);
  const snapped = input.draft?.settled ? detentSnap(raw, detentStepOf(input.config), line.min, line.max) : { value: raw, stud: null };
  return buildPose(input.config, line, raw, snapped.value, {
    detented: snapped.stud !== null && snapped.value !== raw,
    stud: snapped.stud,
    lit: input.draft ? 1 : 0,
    fog: restFog(input.config),
    lens: 0,
    discTurn: 0,
    ledges: 0,
    solved: false,
  });
}

/** Settled solved state (warp, autoSolve, re-entry, the end of the success plan). */
export function emitterSolvedPose(input: PoseInput<EmitterRailConfig>): EmitterRailPose {
  const line = lineOf(input.view);
  const d = draftValue(input);
  const v = clamp(d ?? line.target ?? line.min, line.min, line.max);
  const rail = railOf(input.config, line);
  const pose = buildPose(input.config, line, v, v, { detented: false, stud: null, lit: 1, fog: 0, lens: 1, discTurn: rail === "arc" ? v : 0, ledges: 1, solved: true });
  return { ...pose, locked: true };
}

export function emitterLerp(from: EmitterRailPose, to: EmitterRailPose, t: number): EmitterRailPose {
  if (from.rail !== to.rail || from.radius !== to.radius) return to;
  const k = clamp01(t);
  const value = lerp(from.value, to.value, k);
  const u = lerp(from.u, to.u, k);
  const theta = to.rail === "arc" ? value : to.theta;
  const late = k >= 0.5;
  return {
    ...to,
    value,
    raw: lerp(from.raw, to.raw, k),
    u,
    theta,
    ...railGeometry(to.rail, to.radius, theta, u),
    detented: late ? to.detented : from.detented,
    stud: late ? to.stud : from.stud,
    locked: late ? to.locked : from.locked,
    solved: late ? to.solved : from.solved,
    lit: lerp(from.lit, to.lit, k),
    fog: lerp(from.fog, to.fog, k),
    lens: lerp(from.lens, to.lens, k),
    discTurn: lerp(from.discTurn, to.discTurn, k),
    ledges: lerp(from.ledges, to.ledges, k),
    lag: Math.abs(to.value - value),
  };
}

// ================================================================ anchors shared with the prefab

/** Landmark label anchor for a landmark value (outside the rail on arcs, below it on straight rails). */
export function landmarkAnchor(rail: RailKind, radius: number, line: Pick<RailLine, "scale" | "min" | "max">, value: number): { x: number; y: number } {
  if (rail === "arc") return { x: (radius + 58) * Math.cos(value), y: -(radius + 58) * Math.sin(value) };
  return { x: -radius + 2 * radius * clamp01(fractionOf(line, value)), y: 52 };
}

/** Landmarks drawn once per position (on a 2π arc, 2π sits on 0: keep the first). */
export function distinctLandmarks(rail: RailKind, line: RailLine): RailLine["landmarks"] {
  if (rail !== "arc") return line.landmarks;
  const seen = new Set<number>();
  return line.landmarks.filter((l) => {
    const k = Math.round((((l.value % TWO_PI) + TWO_PI) % TWO_PI) * 1e6) % Math.round(TWO_PI * 1e6);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** The spoke ledge (payoff tread) positions: treads rising right of the disc from the console's ground. */
export function spokeAt(i: number, radius: number, groundLocal: number): { x: number; y: number } {
  return { x: radius - 12 + LEDGE_W * i + LEDGE_W / 2, y: groundLocal - LEDGE_RISE * (i + 1) };
}

/** The target pin sits 1.3 H above the disc top. */
export function pinAt(radius: number): { x: number; y: number } {
  return { x: 0, y: -(radius + 190) };
}

// ================================================================ describe

function describeEmitter(pose: EmitterRailPose, input: PoseInput<EmitterRailConfig>): Described {
  const line = lineOf(input.view);
  const sym = symbolOf(line);
  const chips: ChipSpec[] = [];
  const readoutText = input.config.readout === "bracket" ? bracket(pose.value, line.landmarks, sym) : `${sym}: ${valueText(line, pose.value)}`;
  chips.push({ anchor: "beam_origin", text: input.config.readout === "bracket" && !readoutText.includes("=") ? `${sym}: ${readoutText}` : readoutText, color: "f" });
  if (pose.rail === "arc") {
    if (input.config.gauges.includes("sin")) chips.push({ anchor: "bob", text: `sin ${sym}: ${fmtNumber(pose.sin, 2)}`, color: "g" });
    if (input.config.gauges.includes("cos")) chips.push({ anchor: "marker", text: `cos ${sym}: ${fmtNumber(pose.cos, 2)}`, color: "h" });
  }
  distinctLandmarks(pose.rail, line).forEach((l, i) => {
    if (l.label) chips.push({ anchor: `lm_${i}`, text: l.label, color: "f" });
  });
  const where = bracketWords(pose.value, line.landmarks);
  const beam = pose.beamToFog ? (input.config.hiddenTarget === "none" ? "the beam reaches the sky" : "the beam ends in the fog") : "the beam ends on the wall";
  const srText = pose.solved
    ? "The dial is aligned: the fog has cleared and the lens burns bright."
    : pose.lit === 0 && !input.draft
      ? "The dial is dormant; the carriage is parked at the start of the rail."
      : `The carriage is ${where} on the rail; ${beam}.`;
  return { chips, pins: [], srText, nearMiss: null };
}

function valueText(line: RailLine, v: number): string {
  return line.pi ? formatPi(v) : fmtNumber(v, 2);
}

// ================================================================ panel

const LABEL_MIN = (s: string) => s.replace(/-/g, MINUS);

/** The Scrubber spec: π lines step π/48 with the landmarks as majors and the studs as unlabelled minors. */
export function scalarInputFor(config: EmitterRailConfig, line: RailLine): NonNullable<PanelStatic["input"]> {
  const detent = detentStepOf(config);
  const majors: Tick[] = line.landmarks.map((l) => ({ v: l.value, label: LABEL_MIN(l.label), major: true }));
  const minorStep = detent ?? (line.pi ? PI / 12 : null);
  const minors: Tick[] = [];
  if (minorStep !== null && (line.max - line.min) / minorStep <= 96) {
    for (let k = 0; line.min + k * minorStep <= line.max + 1e-9; k++) {
      const v = line.min + k * minorStep;
      if (!majors.some((m) => Math.abs(m.v - v) < 1e-9)) minors.push({ v, label: null, major: false });
    }
  } else {
    majors.forEach((m, i) => {
      const next = majors[i + 1];
      if (next) minors.push({ v: (m.v + next.v) / 2, label: null, major: false });
    });
  }
  const span = line.max - line.min;
  const step = line.pi ? PI / 48 : niceStep(span / 100);
  return {
    symbol: symbolOf(line),
    min: line.min,
    max: line.max,
    step,
    unit: line.pi ? "pi" : "number",
    format: line.pi ? "pi" : "number",
    ticks: [...majors, ...minors].sort((a, b) => a.v - b.v),
  };
}

function niceStep(raw: number): number {
  const r = Math.abs(raw) || 0.01;
  const mag = 10 ** Math.floor(Math.log10(r));
  for (const m of [5, 2, 1]) if (m * mag <= r + 1e-12) return m * mag;
  return mag;
}

function axisX(input: NonNullable<PanelStatic["input"]>): AxisModel {
  const last = input.ticks.filter((t) => t.major).at(-1)?.v ?? input.max;
  return { min: input.min, max: input.max, unit: input.unit, ticks: input.ticks.map((t) => (t.major && t.v !== last ? { ...t, label: null } : t)), label: null };
}
const TRIG_Y: AxisModel = {
  min: -1.5,
  max: 1.5,
  unit: "number",
  ticks: [
    { v: -1, label: `${MINUS}1`, major: true },
    { v: 0, label: "0", major: true },
    { v: 1, label: "1", major: true },
  ],
  label: null,
};

type GraphCard = Extract<CardModel, { kind: "graph" }>;
type UnitCircleCard = Extract<CardModel, { kind: "unit_circle" }>;

function trigCard(slot: number, fn: "sin" | "cos", input: NonNullable<PanelStatic["input"]>, sym: string, empty: boolean): GraphCard {
  const f = fn === "sin" ? Math.sin : Math.cos;
  return {
    kind: "graph",
    slot,
    title: `${fn} ${sym}`,
    tab: fn === "sin" ? "g" : "h",
    x: axisX(input),
    y: TRIG_Y,
    plots: empty ? [] : [{ id: fn, color: fn === "sin" ? "g" : "h", style: "solid", segments: sample(f, input.min, input.max, 240).map((s) => s.map(([a, b]) => [a, b] as const)), endpoints: [] }],
    annotations: [],
    columns: [],
    targetLine: null,
    empty,
    sr: empty
      ? `The ${fn === "sin" ? "sine" : "cosine"} card is still dark; it fills in with the next hint.`
      : `${fn === "sin" ? "Sine" : "Cosine"} of ${sym} across the rail; the orange line marks your angle.`,
  };
}

function unitCircleCard(line: RailLine, config: EmitterRailConfig, aidTier: number): UnitCircleCard {
  const marks = distinctLandmarks("arc", line).map((l) => ({ angle: l.value, label: l.label }));
  const sixths = aidTier >= config.cards.sixthsTier;
  if (sixths) {
    for (let k = 0; k < 12; k++) {
      const a = (k * PI) / 6;
      if (!marks.some((m) => Math.abs((((m.angle - a) % TWO_PI) + TWO_PI) % TWO_PI) < 1e-6)) marks.push({ angle: a, label: "" });
    }
  }
  return {
    kind: "unit_circle",
    slot: 0,
    title: "UNIT CIRCLE",
    landmarks: marks,
    hairlineStep: detentStepOf(config) ?? PI / 12,
    point: null,
    arc: null,
    drops: { sin: config.gauges.includes("sin"), cos: config.gauges.includes("cos") },
    level: null,
    shadeUpperHalf: false,
    mirror: null,
    sr: sixths
      ? "The unit circle with every sixth of a half turn ticked; the orange arc is the angle you set."
      : "The unit circle; the orange arc is the angle you set.",
  };
}

function railCard(line: RailLine, input: NonNullable<PanelStatic["input"]>): GraphCard {
  return {
    kind: "graph",
    slot: 0,
    title: "RAIL",
    tab: input.symbol,
    x: { min: input.min, max: input.max, unit: input.unit, ticks: input.ticks, label: null },
    y: { min: -1, max: 1, unit: "number", ticks: [], label: null },
    plots: [],
    annotations: line.landmarks.map((l) => ({ kind: "marker" as const, x: l.value, y: 0, label: l.label, focusable: false })),
    columns: [],
    targetLine: null,
    empty: false,
    sr: `The rail from ${valueText(line, line.min)} to ${valueText(line, line.max)}; only the landmarks are labelled.`,
  };
}

function panelStaticEmitter(input: StaticInput<EmitterRailConfig>): PanelStatic {
  const line = lineOf(input.view);
  const scalar = scalarInputFor(input.config, line);
  const sym = scalar.symbol;
  const cards: CardModel[] = [];
  const arc = railOf(input.config, line) === "arc";
  if (arc && input.config.cards.unitCircle) {
    cards.push(unitCircleCard(line, input.config, input.aidTier));
    cards.push(trigCard(1, "sin", scalar, sym, false));
    cards.push(trigCard(2, "cos", scalar, sym, input.aidTier < input.config.cards.cosTier));
  } else if (arc) {
    cards.push(trigCard(0, "sin", scalar, sym, false));
    cards.push(trigCard(1, "cos", scalar, sym, input.aidTier < input.config.cards.cosTier));
  } else {
    cards.push(railCard(line, scalar));
  }
  return { cards, input: scalar, probe: null, recordPins: [] };
}

function panelLiveEmitter(stat: PanelStatic, input: PoseInput<EmitterRailConfig>): PanelLive {
  const line = lineOf(input.view);
  const raw = clamp(draftValue(input) ?? line.min, line.min, line.max);
  const sym = symbolOf(line);
  const readout = input.config.readout === "bracket" ? bracket(raw, line.landmarks, sym) : valueText(line, raw);
  const chips: PanelLive["chips"][number][] = [];
  const liveCards: CardModel[] = [];
  const touched = input.draft !== null || input.solved;
  for (const card of stat.cards) {
    if (card.kind === "unit_circle") {
      chips.push({ slot: card.slot, value: raw, text: readout, color: "accent" });
      if (touched) liveCards.push({ ...card, point: { angle: raw }, arc: { from: Math.min(0, raw), to: raw, color: input.solved ? "gold" : "accent" } });
    } else if (card.kind === "graph" && (card.tab === "g" || card.tab === "h") && !card.empty) {
      const fn = card.tab === "g" ? Math.sin : Math.cos;
      const y = fn(raw);
      chips.push({ slot: card.slot, value: y, text: fmtNumber(y, 2), color: card.tab });
      if (touched) liveCards.push({ ...card, annotations: [...card.annotations, { kind: "live_dot", x: raw, y, color: card.tab }] });
    }
  }
  return { scrubX: raw, readout, chips, highlights: [], liveCards };
}

// ================================================================ plans

function failurePlanEmitter(d: Diagnosis, input: PoseInput<EmitterRailConfig>): FailurePlan {
  const line = lineOf(input.view);
  const raw = clamp(draftValue(input) ?? line.min, line.min, line.max);
  const beats: FailBeat[] = [{ atMs: 0, anchor: "beam_end", action: "scatter", params: { sparks: 8 } }];
  if (input.config.chevrons) {
    const dir = d.failKey === "under" ? 1 : d.failKey === "over" ? -1 : line.target !== null && raw < line.target ? 1 : -1;
    beats.push({ atMs: 150, anchor: "beam_origin", action: "chevrons", params: { dir, count: distanceBand(line, raw, detentStepOf(input.config)), holdMs: 2000 } });
  }
  return { beats, durationMs: 1400, cue: "beam_scatter" };
}

function successPlanEmitter(input: PoseInput<EmitterRailConfig>, anim: PayoffAnim): SuccessPlan {
  const line = lineOf(input.view);
  const v = clamp(draftValue(input) ?? line.target ?? line.min, line.min, line.max);
  const arc = railOf(input.config, line) === "arc";
  const beats: SuccessBeat[] = [{ atMs: 0, anchor: "beam_origin", action: "ignite", params: { surge: 1.5 } }];
  if (input.config.hiddenTarget !== "none") beats.push({ atMs: 0, anchor: "fog", action: "dissolve", params: { ms: 800 } });
  beats.push({ atMs: 400, anchor: "lens", action: "ignite", params: { sparks: 12 } });
  beats.push({ atMs: 600, anchor: "lens", action: "light_sequence", params: { to: "center", ms: 400 } });
  if (arc) beats.push({ atMs: 1000, anchor: "center", action: "spin", params: { angle: v, ms: 1150 } });
  const ledges = anim === "stairs_rise" || anim === "steps_emerge" || anim === "ramp_forms" || anim === "bridge_forms";
  if (ledges) for (let i = 0; i < LEDGE_COUNT; i++) beats.push({ atMs: 1000 + 150 * i, anchor: `spoke_${i}`, action: "rise", params: { ms: 380 } });
  else beats.push({ atMs: 1000, anchor: "center", action: "open", params: { ms: 900 } });
  // trig §5.1 times it at 2.4 s; 2.2 s keeps the whole beat inside ★34's 2.5 s cap when frames run long
  return { beats, cardEffects: [], durationMs: 2200, cue: "node_ignite" };
}

// ================================================================ snapshots (DOM fallback, amendment 31)

/** DOM snapshot parts for a pose (hero and key kit parts at their pose transforms; the console is drawn by the host). */
export function vesperSnapshot(pose: EmitterRailPose): SnapshotPart[] {
  const k = (slot: string) => partKey("orrery_terraces", "vesper_dial", slot);
  const deg = (r: number) => Math.round(((r * 180) / PI) * 1000) / 1000;
  const parts: SnapshotPart[] = [
    { asset: k("disc"), dx: 0, dy: 0, rotateDeg: deg(-pose.discTurn) },
    { asset: k("rail_ring"), dx: 0, dy: 0 },
    { asset: k("plumb_gauge"), dx: Math.round(pose.radius + PLUMB_DX), dy: 0 },
    { asset: k("slide_gauge"), dx: 0, dy: Math.round(pose.radius + SLIDE_DY) },
    { asset: k("carriage"), dx: Math.round(pose.carriageX), dy: Math.round(pose.carriageY), rotateDeg: deg(pose.carriageRot) },
  ];
  if (pose.fog > 0) parts.push({ asset: k("fog_band"), dx: 0, dy: -Math.round(pose.radius + 330), alpha: Math.round(pose.fog * 100) / 100 });
  if (pose.lens > 0) parts.push({ asset: k("vesper_lens"), dx: 0, dy: -Math.round(pose.radius + 330), alpha: Math.round(pose.lens * 100) / 100 });
  if (pose.ledges > 0) for (let i = 0; i < LEDGE_COUNT; i++) {
    const at = spokeAt(i, pose.radius, pose.radius - 10);
    parts.push({ asset: k("spoke_ledge"), dx: Math.round(at.x), dy: Math.round(at.y) });
  }
  return parts;
}

/** The canonical e1-shaped input the skin's snapshots are baked from (a 2π π-line, radius 310, fog). */
export const SNAPSHOT_VIEW: NumberLineView = {
  scale: "linear",
  min: 0,
  max: TWO_PI,
  target: "π/2",
  landmarks: [0, 1, 2, 3, 4].map((i) => ({ value: (i * PI) / 2, fraction: i / 4, label: ["0", "π/2", "π", "3π/2", "2π"][i] })),
};
export const SNAPSHOT_CONFIG: EmitterRailConfig = EmitterRailConfig.parse({ rail: "arc", radius: 310, gauges: ["sin", "cos"], hiddenTarget: "fog", detent: "pi/12" });
export function snapshotInput(solved: boolean): PoseInput<EmitterRailConfig> {
  return { view: SNAPSHOT_VIEW, draft: null, config: SNAPSHOT_CONFIG, probe: null, t: 0, aidTier: 0, hintsUsed: 0, sim: null, solved, reducedMotion: true };
}

// ================================================================ the skin with baked snapshots

export const EMITTER_RAIL_SKINS: readonly ContraptionSkin[] = [
  {
    ...VESPER_BASE,
    snapshot: { dormant: vesperSnapshot(emitterPose(snapshotInput(false))), solved: vesperSnapshot(emitterSolvedPose(snapshotInput(true))) },
  },
];

function skinFor(skinId: string): ContraptionSkin {
  return EMITTER_RAIL_SKINS.find((s) => s.id === skinId) ?? EMITTER_RAIL_SKINS[0];
}

// ================================================================ the meta

const FOOTPRINT: Footprint2D = { left: 140, right: 140, height: 240 };

export const emitterRailMeta: ContraptionMeta<EmitterRailConfig, EmitterRailPose> = {
  id: "emitter_rail",
  name: "Emitter Rail",
  modes: ["mapper.number_line"],
  tier: "native",
  status: "demo",
  reusable: "any_subject",
  layouts: ["scrub"],
  defaultLayout: "scrub",
  payoffs: ["stairs_rise", "bridge_forms", "ramp_forms", "steps_emerge", "beam_restores", "door_opens"],
  nearMissKeys: [], // the authored misconceptions arrive as station probes (e1: `fullturn`)
  accessories: [],
  skins: EMITTER_RAIL_SKINS,
  control: "scrub",
  configSchema: EmitterRailConfig,
  validateConfig(config: EmitterRailConfig, ctx: ConfigCtx): readonly ConfigIssue[] {
    const view = ctx.view as Partial<NumberLineView> | null;
    const out: ConfigIssue[] = [];
    if (config.rail === "arc" && !isTwoPiLine(view)) out.push(err(["rail"], 'rail "arc" needs a π-labelled line that spans exactly 2π'));
    if (config.rail === "log" && view?.scale !== "log") out.push(err(["rail"], 'rail "log" needs a log-scale line'));
    if (config.gauges.length > 0 && config.rail !== "arc") out.push(err(["gauges"], "sin/cos gauges only fit arc rails"));
    if (config.detent !== null && exprValue(config.detent) === null) out.push(warn(["detent"], `detent "${config.detent}" does not evaluate`));
    return out;
  },
  defaultConfig(ctx: ConfigCtx): EmitterRailConfig {
    const view = ctx.view as Partial<NumberLineView> | null;
    if (isTwoPiLine(view)) return EmitterRailConfig.parse({ rail: "arc", cards: { unitCircle: true } });
    return EmitterRailConfig.parse({ rail: view?.scale === "log" ? "log" : "straight" });
  },
  writerConfigSchema: () => null, // derived entirely from the view and the biome (§4.4)
  fromWriterConfig(_w: unknown, ctx: ConfigCtx): EmitterRailConfig {
    return emitterRailMeta.defaultConfig(ctx);
  },
  footprint: () => FOOTPRINT,
  frameBounds(config: EmitterRailConfig): Bounds {
    const r = config.radius;
    // a hidden target: frame the inner edge of the fog band too, so the beam visibly sweeps into it
    const top = config.hiddenTarget === "none" ? r + 250 : Math.max(r + 250, FOG_RADIUS - 140);
    return { x: -r - 310, y: -top, w: 2 * r + 750, h: top + r + 60 };
  },
  probe: () => null, // scalar mode: the Scrubber IS the input
  clock: null,
  sim: null,
  pose: emitterPose,
  lerp: emitterLerp,
  describe: describeEmitter,
  panelStatic: panelStaticEmitter,
  panelLive: panelLiveEmitter,
  hintTargets(rung: HintRung, input: StaticInput<EmitterRailConfig>): readonly HintTarget[] {
    return skinFor(input.skinId).hintTargets[rung - 1] ?? [];
  },
  audio(pose: EmitterRailPose): readonly AudioParam[] {
    const roll = clamp(pose.lag * 3, 0, 1);
    return [
      { cue: "dial_carriage_roll", pitch: 0.8 + 0.8 * roll, gain: roll > 0.01 ? 0.15 + 0.35 * roll : 0 },
      { cue: "beam_hum", gain: 0.2 * pose.lit },
    ];
  },
  failurePlan: failurePlanEmitter,
  successPlan: successPlanEmitter,
  solvedPose: emitterSolvedPose,
  debug(pose: EmitterRailPose): Record<string, number | string | boolean> {
    const r3 = (v: number) => Math.round(v * 1000) / 1000;
    return {
      rail: pose.rail,
      value: r3(pose.value),
      raw: r3(pose.raw),
      theta: r3(pose.theta),
      u: r3(pose.u),
      carriageX: r3(pose.carriageX),
      carriageY: r3(pose.carriageY),
      beamLen: r3(pose.beamLen),
      beamToFog: pose.beamToFog,
      locked: pose.locked,
      detented: pose.detented,
      stud: pose.stud ?? -1,
      sin: r3(pose.sin),
      cos: r3(pose.cos),
      lit: r3(pose.lit),
      fog: r3(pose.fog),
      lens: r3(pose.lens),
      discTurn: r3(pose.discTurn),
      ledges: r3(pose.ledges),
      solved: pose.solved,
    };
  },
};

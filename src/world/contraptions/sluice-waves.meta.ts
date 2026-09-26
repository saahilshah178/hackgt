/**
 * sluice_waves — sorter.type_match (docs/design/20 §4 row 8, §4.2, §4.4, §7.4; cell §5.5 e5, §5.9 e9).
 * One cell per wave drifts down the canal to the Label Lock while its wave runs (x follows the wave timer); hovering or
 * focusing a valve renders the CLAIMED bath (solute density ρ_out = ρ_in·k) or the claimed flow (ghost water arrows);
 * committing opens the downstream leaf and sends the cell to that valve's basin; a timeout sends it to the Eddy.
 * Fates play live ONLY when the wave text states them (`showFate: true`, e5); otherwise V stays 1 until Verify (e9).
 * KB2: the complete live half (the W0 placeholder is gone).
 *
 * ## The pose contract (coordinates are zone units relative to station.anchor, y DOWN; the water surface is y = 0)
 * - `cells[]` in VIEW order (waves are never shuffled, so display index = waveIndex): `place` is upcoming (waiting
 *   upstream), lock (the current wave, drifting from the canal mouth to the lock), basin (committed to `valve`) or eddy
 *   (timed out). `volume` scales the wall (or outline), `protoplast` the inner body (plasmolysis pulls it from a rigid
 *   wall), `crenate` the shrink bumps, `strain` the strain ring.
 * - `claim`: the valve index the draft hovers or focuses (the claim render); `wheelAngle` turns the valve wheel to it;
 *   `bathDots` the solute dots the lock bath shows (the claim for a `densityK` valve, else the wave's stated outDots);
 *   `arrows` the ghost water arrows of an `arrows` valve (never on e5: arrows would do the reasoning).
 * - `leaf` opens briefly after each commit; `water` runs 0 → 1 through the payoff (the skin drains or fills by the
 *   station's payoff anim).
 *
 * ## Dynamic anchors every sluice_waves PoseView must expose (besides skin.anchors)
 * `cell_w<i>` (each cell's current position), `valve_<j>` (spoke plaque j, config valve order) and `basin_<j>` for every
 * valve (skins with more than three valves extend the §4.3 range). describe() and the plans use only these.
 */
import { z } from "zod";
import type { HintTarget, PayoffAnim } from "../../contracts/world";
import { clamp01, lerp, lerpAngle } from "../ease";
import type {
  AudioParam,
  Bounds,
  CardModel,
  ChipSpec,
  ConfigCtx,
  ConfigIssue,
  ContraptionMeta,
  Described,
  Diagnosis,
  Draft,
  FailBeat,
  FailurePlan,
  Footprint2D,
  HintRung,
  PanelLive,
  PanelStatic,
  PoseInput,
  StaticInput,
  SuccessBeat,
  SuccessPlan,
  TypeMatchView,
  WriterCtx,
} from "../types";
import { categoryIdsOf, coverExactlyOnce, err, viewTextOf, warn, waveIndicesOf } from "./config-parts";
import { defineSkin } from "./skin-kit";
import { SluiceCell, SluiceFate, SluiceWavesConfig } from "./sluice-waves.config";
export { SluiceCell, SluiceFate, SluiceWavesConfig } from "./sluice-waves.config";

// ---------------------------------------------------------------- skins (§4.3; hint flights from cell §5.5 / §5.9)

const ht = (anchor: string, action: HintTarget["action"], holdMs: number): HintTarget => ({ anchor, action, holdMs });

export const SLUICE_WAVES_SKINS = [
  defineSkin({
    id: "tonicity_sluices",
    name: "Tonicity Sluices",
    ns: "living_gate",
    nouns: ["sluice", "sluices", "lock", "Label Lock", "Barge Lock", "valve", "valves", "basin", "cell", "cells", "barge"],
    parts: [
      ["label_lock", "K"], ["lock_leaf", "K"], ["valve_wheel", "H"], ["basin", "K"], ["eddy", "K"],
      ["cell_rbc", "H"], ["cell_generic", "K"], ["cell_plant", "H"], ["cell_potato", "H"], ["cell_protoplast", "K"],
      ["barge", "K"], ["console", "K"],
    ],
    anchors: ["lock", "basin_0…2", "eddy", "valve", "barge_deck", "console"],
    cues: { live: "current_hum", succeed: "sluice_drain", fail: "water_rush" },
    // cell §5.5 / §5.9: rung 1 Pip hovers over the lock (the bath), rung 2 circles the current cell, rung 3 lands on the valve
    hintTargets: [[ht("lock", "hover", 1800)], [ht("lock", "circle", 1800)], [ht("valve", "land", 2000)]],
  }),
] as const;

// ---------------------------------------------------------------- config half (W0 validators, unchanged)

const FATE_WORDS: Readonly<Record<SluiceFate, RegExp>> = {
  swell: /\b(swell\w*|burst\w*|lys\w*)\b/i,
  shrink: /\b(shrink\w*|shrivel\w*|crenat\w*|shrunk\w*)\b/i,
  steady: /\b(steady|unchanged|same size|no net)\b/i,
  plasmolysis: /\b(plasmoly\w*|pulls? away|los(?:es|ing) turgor|wilt\w*)\b/i,
  strain: /\b(strain\w*|turgid|firm|about to burst)\b/i,
};

interface SluiceWavesWriter {
  waves: { waveIndex: number; cell: z.infer<typeof SluiceCell>; inDots: number; outDots: number; fate: z.infer<typeof SluiceFate> | null; showFate: boolean }[];
}

export function validateSluiceWaves(config: SluiceWavesConfig, ctx: ConfigCtx): ConfigIssue[] {
  const out: ConfigIssue[] = [];
  out.push(...coverExactlyOnce(["waves"], "waveIndex", waveIndicesOf(ctx.view), config.waves.map((w) => w.waveIndex)));
  out.push(...coverExactlyOnce(["valves"], "category id", categoryIdsOf(ctx.view), config.valves.map((v) => v.categoryId)));
  config.waves.forEach((w, i) => {
    if (!w.showFate && w.fate !== null) out.push(err(["waves", i, "fate"], "showFate: false requires fate: null (the fate would leak the answer)"));
    if (w.showFate && w.fate === null) out.push(err(["waves", i, "fate"], "showFate: true needs a fate"));
    if (w.showFate && w.fate !== null && !FATE_WORDS[w.fate].test(viewTextOf(ctx.view, `w${w.waveIndex}`))) {
      out.push(warn(["waves", i, "fate"], `the wave text does not state "${w.fate}"`));
    }
  });
  return out;
}

// ---------------------------------------------------------------- layout and small pure helpers

/** The generic layout (zone units relative to station.anchor; y down; the canal's water surface is y = 0). */
export const SLUICE_LAYOUT = {
  canalIn: { x: -160, y: -40 }, // the canal mouth: X_in, where each wave's cell starts
  lock: { x: 300, y: -40 }, // the Label Lock chamber centre: X_out
  lockW: 230,
  lockH: 170,
  valve: { x: 300, y: -330 }, // the valve wheel hub above the lock
  valveR: 110, // spoke length (the plaques ride the spoke ends)
  valveStepDeg: 60, // cell §5.5: the wheel turns to −60°, 0°, +60°
  basinX0: 540,
  basinSpacing: 130,
  basinY: -40,
  eddyGap: 150, // the Eddy sits one basin step past the last basin
  queueSpacing: 90, // upcoming cells wait upstream of the canal mouth
  queueMax: 3, // at most this many upcoming cells are shown in the queue (the rest wait out of frame)
  cellR: 34,
  bargeDeck: { x: 90, y: 70 }, // e9's barge lies in the low Barge Lock beside the quay
  drainDepth: 255, // e5: the trench drains 1.5 H
  fillRise: 340, // e9: the Barge Lock fills + 2 H
  leafWindow: 0.15, // the downstream leaf stays open for the first 15 % of the next wave after a commit
} as const;

export const cellAnchor = (waveIndex: number): string => `cell_w${waveIndex}`;
export const valveAnchor = (index: number): string => `valve_${index}`;
export const basinAnchor = (index: number): string => `basin_${index}`;

/** The wheel angle (radians, 0 = spoke straight up) of valve i of n: (i − (n − 1)/2)·60°. */
export function valveAngle(index: number, count: number): number {
  return ((index - (count - 1) / 2) * SLUICE_LAYOUT.valveStepDeg * Math.PI) / 180;
}
/** The plaque at the end of spoke i of n (container-local; y down, spokes point up and out). */
export function valvePlaqueXY(index: number, count: number): { x: number; y: number } {
  const a = valveAngle(index, count);
  const L = SLUICE_LAYOUT;
  return { x: L.valve.x + L.valveR * Math.sin(a), y: L.valve.y - L.valveR * Math.cos(a) };
}
export function basinXY(index: number): { x: number; y: number } {
  return { x: SLUICE_LAYOUT.basinX0 + SLUICE_LAYOUT.basinSpacing * index, y: SLUICE_LAYOUT.basinY };
}
export function eddyXY(valveCount: number): { x: number; y: number } {
  const last = basinXY(Math.max(0, valveCount - 1));
  return { x: last.x + SLUICE_LAYOUT.eddyGap, y: SLUICE_LAYOUT.basinY + 10 };
}
/** Cell x vs the wave timer (cell §5.5): x = X_in + (1 − secondsLeft/T)·(X_out − X_in); clamped to the canal. */
export function cellX(secondsLeft: number, secondsPerWave: number): number {
  const L = SLUICE_LAYOUT;
  const p = secondsPerWave > 0 ? clamp01(1 - secondsLeft / secondsPerWave) : 1;
  return L.canalIn.x + p * (L.lock.x - L.canalIn.x);
}
/** The claimed bath (cell §5.5 hover render): ρ_out = ρ_in·k. */
export function claimedOutDots(inDots: number, densityK: number): number {
  return inDots * densityK;
}
/** Short plaque text for a category id: hypotonic → HYPO, isotonic → ISO, hypertonic → HYPER, in → IN, none → NONE. */
export function plaqueText(categoryId: string): string {
  const t = categoryId.replace(/tonic$/, "").replace(/_/g, " ").toUpperCase();
  return t.length ? t : categoryId.toUpperCase();
}

export interface CellShape {
  volume: number; // wall / outline scale
  protoplast: number; // inner body scale (plasmolysis shrinks it away from the wall)
  crenate: number; // 0 … 1 shrink bumps
  strain: number; // 0 … 1 strain ring
}
export const REST_SHAPE: CellShape = { volume: 1, protoplast: 1, crenate: 0, strain: 0 };
/** cell §5.5: ΔV per fate (swell +0.45, shrink −0.30, plasmolysis protoplast −0.3, strain +0.55 with a ring). */
export const FATE_DV: Readonly<Record<SluiceFate, number>> = { swell: 0.45, shrink: -0.3, steady: 0, plasmolysis: -0.3, strain: 0.55 };
/** The cell's shape k of the way through its fate (V(t) = 1 + ΔV·k); null fate = rest. */
export function fateShape(fate: SluiceFate | null, k: number): CellShape {
  if (fate === null) return REST_SHAPE;
  const u = clamp01(k);
  const dv = FATE_DV[fate] * u;
  switch (fate) {
    case "swell":
      return { volume: 1 + dv, protoplast: 1 + dv, crenate: 0, strain: 0 };
    case "shrink":
      return { volume: 1 + dv, protoplast: 1 + dv, crenate: u, strain: 0 };
    case "steady":
      return REST_SHAPE;
    case "plasmolysis":
      return { volume: 1, protoplast: 1 + dv, crenate: 0, strain: 0 };
    case "strain":
      return { volume: 1 + dv, protoplast: 1 + dv, crenate: 0, strain: u };
  }
}
type Valve = SluiceWavesConfig["valves"][number];
type WaveCfg = SluiceWavesConfig["waves"][number];
/**
 * The fate a valve's CLAIM implies for a cell (used only for outcomes: the solution draft at success, the disclosed
 * category on a miss). densityK < 1 or arrows "in" → swell; = 1 or "both" → steady; > 1 or "out" → shrink (a walled
 * plant or potato cell plasmolyses instead). null when the valve renders nothing.
 */
export function valveFate(valve: Valve | undefined, cell: SluiceCell): SluiceFate | null {
  if (!valve) return null;
  let f: SluiceFate | null = null;
  if (valve.densityK !== null) f = valve.densityK < 0.999 ? "swell" : valve.densityK > 1.001 ? "shrink" : "steady";
  else if (valve.arrows === "in") f = "swell";
  else if (valve.arrows === "out") f = "shrink";
  else if (valve.arrows === "both") f = "steady";
  if (f === "shrink" && (cell === "plant" || cell === "potato")) return "plasmolysis";
  return f;
}
/** The fate an outcome plays for a wave: the stated fate when the text states it, else the one the valve implies. */
function outcomeFate(w: WaveCfg | undefined, valve: Valve | undefined): SluiceFate | null {
  if (w?.showFate && w.fate !== null) return w.fate;
  return w ? valveFate(valve, w.cell) : null;
}

// ---------------------------------------------------------------- draft readers

interface ViewWave {
  waveIndex: number;
  text: string;
}
function viewWaves(view: unknown): ViewWave[] {
  const v = view as Partial<TypeMatchView> | null;
  return Array.isArray(v?.waves) ? v.waves.map((w) => ({ waveIndex: Number(w.waveIndex), text: String(w.text ?? "") })) : [];
}
function viewCategories(view: unknown): { id: string; label: string }[] {
  const v = view as Partial<TypeMatchView> | null;
  return Array.isArray(v?.categories) ? v.categories.map((c) => ({ id: String(c.id), label: String(c.label ?? c.id) })) : [];
}
function secondsPerWaveOf(view: unknown): number {
  const v = view as Partial<TypeMatchView> | null;
  return typeof v?.secondsPerWave === "number" && v.secondsPerWave > 0 ? v.secondsPerWave : 8;
}
/** waveIndex → categoryId from the draft (last write wins; malformed rows ignored). */
export function answersOf(draft: Draft | null): Map<number, string> {
  const input = draft?.input as { answers?: unknown } | null | undefined;
  const out = new Map<number, string>();
  if (!Array.isArray(input?.answers)) return out;
  for (const a of input.answers as unknown[]) {
    if (!a || typeof a !== "object") continue;
    const { waveIndex, categoryId } = a as { waveIndex?: unknown; categoryId?: unknown };
    if (typeof waveIndex === "number" && Number.isInteger(waveIndex) && typeof categoryId === "string") out.set(waveIndex, categoryId);
  }
  return out;
}

// ---------------------------------------------------------------- the pose

export type SluicePlace = "upcoming" | "lock" | "basin" | "eddy";
export interface SluiceCellPose extends CellShape {
  waveIndex: number;
  key: string; // "w<i>" (the diagnose key)
  display: number;
  cell: SluiceCell;
  place: SluicePlace;
  valve: number | null; // the committed valve (config order) for basin cells
  tag: string | null; // the committed category id (the plaque slid onto the cell's tag)
  x: number;
  y: number;
  spin: number; // radians: eddy cells turn slowly
  inDots: number;
  outDots: number;
  current: boolean;
  visible: boolean;
}
export interface SluiceWavesPose {
  cells: SluiceCellPose[];
  current: number | null; // display index of the running wave
  progress: number; // 1 − secondsLeft/T of the running wave
  secondsLeft: number | null;
  claim: number | null; // valve index hovered / focused (the claim render)
  claimId: string | null;
  wheelAngle: number; // radians
  bathDots: number; // solute dots in the lock bath
  bathClaim: boolean; // the bath shows a claim (else the wave's stated outside)
  insideDots: number; // the running cell's inside solute
  arrows: "in" | "out" | "both" | "none"; // ghost water arrows (arrows valves only)
  leaf: number; // the downstream lock leaf 0 shut … 1 open
  saltOutline: boolean; // aid tier ≥ 1: salt dots get a white outline (they never move)
  answered: number;
  total: number;
  done: boolean;
  water: number; // payoff 0 … 1 (drain or fill, by the station's payoff anim)
  solved: boolean;
}

function upcomingXY(rank: number): { x: number; y: number } {
  const L = SLUICE_LAYOUT;
  return { x: L.canalIn.x - L.queueSpacing * (rank + 1), y: L.canalIn.y };
}

function computePose(input: PoseInput<SluiceWavesConfig, null>): SluiceWavesPose {
  const { config, view, draft, aidTier, t, reducedMotion, solved } = input;
  const waves = viewWaves(view);
  const T = secondsPerWaveOf(view);
  const cfgByIndex = new Map(config.waves.map((w) => [w.waveIndex, w]));
  const valveIdx = new Map(config.valves.map((v, i) => [v.categoryId, i]));
  const answers = answersOf(draft);
  const wave = draft?.wave ?? null;
  const done = !solved && draft !== null && wave === null && (draft.complete || waves.every((w) => answers.has(w.waveIndex)));
  const running = !solved && !done;
  const current = running ? Math.min(Math.max(0, wave?.index ?? 0), Math.max(0, waves.length - 1)) : null;
  const secondsLeft = running ? (wave ? Math.max(0, wave.secondsLeft) : T) : null;
  const progress = secondsLeft === null ? 1 : clamp01(1 - secondsLeft / (wave?.secondsPerWave ?? T));
  const L = SLUICE_LAYOUT;

  const cells: SluiceCellPose[] = waves.map((w, k) => {
    const c = cfgByIndex.get(w.waveIndex);
    const stated = c?.showFate ? c.fate : null; // the ONLY fate the live pose may animate (R2)
    const answer = answers.get(w.waveIndex) ?? null;
    const valve = answer !== null ? (valveIdx.get(answer) ?? null) : null;
    let place: SluicePlace;
    if (solved) place = valve !== null ? "basin" : "eddy";
    else if (current === null) place = valve !== null ? "basin" : "eddy";
    else if (k < current) place = valve !== null ? "basin" : "eddy";
    else if (k === current) place = "lock";
    else place = "upcoming";
    let pos: { x: number; y: number };
    let shape: CellShape;
    if (place === "lock") {
      pos = { x: cellX(secondsLeft ?? T, wave?.secondsPerWave ?? T), y: L.lock.y };
      shape = fateShape(stated, progress);
    } else if (place === "basin") {
      pos = basinXY(valve!);
      const fate = solved ? outcomeFate(c, config.valves[valve!]) : stated;
      shape = fateShape(fate, 1);
    } else if (place === "eddy") {
      pos = eddyXY(config.valves.length);
      shape = fateShape(stated, 1);
    } else {
      pos = upcomingXY(k - (current ?? 0) - 1);
      shape = REST_SHAPE;
    }
    const upRank = current === null ? -1 : k - current - 1;
    return {
      waveIndex: w.waveIndex,
      key: `w${w.waveIndex}`,
      display: k,
      cell: c?.cell ?? "generic",
      place,
      valve: place === "basin" ? valve : null,
      tag: place === "basin" || place === "eddy" ? answer : null,
      x: pos.x,
      y: pos.y,
      spin: place === "eddy" && !reducedMotion ? 0.8 * t : 0,
      inDots: c?.inDots ?? 0,
      outDots: c?.outDots ?? 0,
      current: place === "lock",
      // re-entry without a draft: the drained lock shows no cells; the upstream queue shows a few cells only
      visible: solved ? answers.size > 0 : place !== "upcoming" || upRank < L.queueMax,
      ...shape,
    };
  });

  const cur = current === null ? null : cells[current] ?? null;
  const hoverId = running ? (draft?.hover ?? draft?.focus ?? null) : null;
  const claim = hoverId !== null && valveIdx.has(hoverId) ? valveIdx.get(hoverId)! : null;
  const claimValve = claim === null ? undefined : config.valves[claim];
  const inside = cur?.inDots ?? cells[0]?.inDots ?? 0;
  const bathClaim = claimValve !== undefined && claimValve.densityK !== null;
  const bathDots = cur === null ? 0 : bathClaim ? Math.round(claimedOutDots(inside, claimValve!.densityK!)) : cur.outDots;
  const prev = current !== null && current > 0 ? cells[current - 1] : undefined;
  const leaf = solved ? 1 : prev?.place === "basin" && progress < L.leafWindow ? 1 : 0;
  const answered = cells.filter((c) => c.place === "basin").length;
  return {
    cells,
    current,
    progress,
    secondsLeft,
    claim,
    claimId: claim === null ? null : config.valves[claim]!.categoryId,
    wheelAngle: claim === null ? 0 : valveAngle(claim, config.valves.length),
    bathDots,
    bathClaim,
    insideDots: inside,
    arrows: claimValve?.arrows ?? "none",
    leaf,
    saltOutline: aidTier >= 1,
    answered,
    total: cells.length,
    done: done || solved,
    water: solved ? 1 : 0,
    solved,
  };
}

function lerpPose(from: SluiceWavesPose, to: SluiceWavesPose, t: number): SluiceWavesPose {
  const snap = t >= 0.5;
  const fromCells = new Map(from.cells.map((c) => [c.waveIndex, c]));
  return {
    ...(snap ? to : from),
    cells: to.cells.map((b) => {
      const a = fromCells.get(b.waveIndex) ?? b;
      return {
        ...(snap ? b : a),
        waveIndex: b.waveIndex,
        key: b.key,
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        volume: lerp(a.volume, b.volume, t),
        protoplast: lerp(a.protoplast, b.protoplast, t),
        crenate: lerp(a.crenate, b.crenate, t),
        strain: lerp(a.strain, b.strain, t),
        spin: lerp(a.spin, b.spin, t),
      };
    }),
    progress: lerp(from.progress, to.progress, t),
    wheelAngle: lerpAngle(from.wheelAngle, to.wheelAngle, t),
    bathDots: lerp(from.bathDots, to.bathDots, t),
    leaf: lerp(from.leaf, to.leaf, t),
    water: lerp(from.water, to.water, t),
  };
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function describePose(pose: SluiceWavesPose, input: PoseInput<SluiceWavesConfig, null>): Described {
  const { config, view } = input;
  const cats = new Map(viewCategories(view).map((c) => [c.id, c.label]));
  const chips: ChipSpec[] = config.valves.map((v, i) => ({
    anchor: valveAnchor(i),
    text: plaqueText(v.categoryId),
    color: pose.claim === i ? "accent" : "f",
  }));
  const cur = pose.current === null ? null : (pose.cells[pose.current] ?? null);
  const cfg = cur ? config.waves.find((w) => w.waveIndex === cur.waveIndex) : undefined;
  if (cur && cfg?.showFate) chips.push({ anchor: cellAnchor(cur.waveIndex), text: `V: ${pct(cur.volume)}`, color: "h" });
  const eddy = pose.cells.filter((c) => c.place === "eddy").length;
  let srText: string;
  if (pose.solved) srText = "The lock has emptied; every cell has played its true fate in its basin.";
  else if (pose.done) srText = `Every wave has passed: ${pose.answered} cell${pose.answered === 1 ? "" : "s"} in the basins${eddy ? `, ${eddy} in the eddy` : ""}.`;
  else if (cur) {
    const claimed = pose.claimId !== null ? `The ${cats.get(pose.claimId) ?? pose.claimId} valve is claimed` : "No valve is claimed";
    const bath = pose.bathClaim
      ? `: the bath would hold ${Math.round(pose.bathDots)} solute dots against ${pose.insideDots} inside the cell`
      : pose.arrows !== "none"
        ? `: ghost arrows show water moving ${pose.arrows === "both" ? "both ways, balanced" : pose.arrows}`
        : "";
    const secs = pose.secondsLeft === null ? "" : `, ${Math.ceil(pose.secondsLeft)} seconds left`;
    srText = `Wave ${cur.display + 1} of ${pose.total}: a cell drifts toward the lock${secs}. ${claimed}${bath}.`;
  } else srText = "The lock waits for the first cell.";
  return { chips, pins: [], srText, nearMiss: null };
}

// ---------------------------------------------------------------- panel

/** e9 renders claimed FLOW (arrows valves); e5 renders the claimed BATH (densityK valves). */
export function flowMode(config: SluiceWavesConfig): boolean {
  return config.valves.some((v) => v.arrows !== "none") && config.valves.every((v) => v.densityK === null);
}
/** One scale for the two solute gauges so outside and inside compare honestly. */
export function soluteMax(config: SluiceWavesConfig): number {
  const kMax = Math.max(1, ...config.valves.map((v) => v.densityK ?? 1));
  const m = Math.max(10, ...config.waves.map((w) => Math.max(w.outDots, w.inDots * kMax, w.inDots)));
  return Math.ceil(m / 5) * 5;
}
export const VOLUME_MAX = 1.6;
const SPARK_POINTS = 17;

type BarsCard = Extract<CardModel, { kind: "bars" }>;

function soluteCards(config: SluiceWavesConfig, pose: SluiceWavesPose | null, aidTier: number): BarsCard[] {
  const max = soluteMax(config);
  const out = pose ? Math.round(pose.bathDots * 10) / 10 : 0;
  const inside = pose?.insideDots ?? 0;
  const outLabel = aidTier >= 1 ? "bath" : pose?.bathClaim ? "claimed" : "outside";
  const outside: BarsCard = {
    kind: "bars",
    slot: 0,
    title: "solute outside",
    bars: [
      { id: "outside", label: outLabel, value: out, max, color: "f" },
      // tier 2: the cell's inside level beside the claim (cell §5.5 "an hline at the cell's inside level")
      ...(aidTier >= 2 ? [{ id: "inside_ref", label: "cell", value: inside, max, color: "g" as const }] : []),
    ],
    sparkline: null,
    timer: null,
    arrow: null,
    sr: pose?.bathClaim ? `Claimed solute outside: ${out}.` : `Solute outside: ${out}.`,
  };
  const insideCard: BarsCard = {
    kind: "bars",
    slot: 1,
    title: "solute inside",
    bars: [{ id: "inside", label: aidTier >= 1 ? "cell" : "inside", value: inside, max, color: "g" }],
    sparkline: null,
    timer: null,
    arrow: null,
    sr: `Solute inside the cell: ${inside}.`,
  };
  return [outside, insideCard];
}

function thirdCard(config: SluiceWavesConfig, pose: SluiceWavesPose | null, aidTier: number): BarsCard {
  if (flowMode(config)) {
    const max = soluteMax(config);
    const arrow = pose && pose.claim !== null ? pose.arrows : "none";
    return {
      kind: "bars",
      slot: 2,
      // tier 2 captions the gauge "toward more solute" (cell §5.9)
      title: aidTier >= 2 ? "claimed flow · toward more solute" : "claimed flow",
      bars: [
        { id: "outside", label: "outside", value: pose?.bathDots ?? 0, max, color: "f" },
        { id: "inside", label: "inside", value: pose?.insideDots ?? 0, max, color: "g" },
      ],
      sparkline: null,
      timer: pose && pose.secondsLeft !== null ? { fraction: pose.progress } : null,
      arrow,
      sr:
        arrow === "none"
          ? "No flow is claimed yet."
          : `The claimed flow: water ${arrow === "both" ? "moves both ways, balanced" : arrow === "in" ? "moves into the cell" : "moves out of the cell"}.`,
    };
  }
  const cur = pose && pose.current !== null ? pose.cells[pose.current] : undefined;
  const cfg = cur ? config.waves.find((w) => w.waveIndex === cur.waveIndex) : undefined;
  const stated = cfg?.showFate ? cfg.fate : null;
  const points: number[] = [];
  if (pose && pose.secondsLeft !== null) {
    for (let i = 0; i < SPARK_POINTS; i++) {
      const k = i / (SPARK_POINTS - 1);
      if (k > pose.progress + 1e-9) break;
      points.push(fateShape(stated, k).volume);
    }
  }
  const v = cur?.volume ?? 1;
  return {
    kind: "bars",
    slot: 2,
    title: "volume V(t)",
    bars: [{ id: "volume", label: "V", value: Math.round(v * 100) / 100, max: VOLUME_MAX, color: "h" }],
    sparkline: { points: points.length ? points : [1], max: VOLUME_MAX, color: "h" },
    timer: pose && pose.secondsLeft !== null ? { fraction: pose.progress } : null,
    arrow: null,
    sr: `Cell volume ${pct(v)} of its start.`,
  };
}

function panelStaticOf(input: StaticInput<SluiceWavesConfig>): PanelStatic {
  const { config, aidTier } = input;
  return { cards: [...soluteCards(config, null, aidTier), thirdCard(config, null, aidTier)], input: null, probe: null, recordPins: [] };
}

function panelLiveOf(_stat: PanelStatic, input: PoseInput<SluiceWavesConfig, null>): PanelLive {
  const pose = computePose(input);
  const { config, aidTier } = input;
  const cards: CardModel[] = [...soluteCards(config, pose, aidTier), thirdCard(config, pose, aidTier)];
  const chips: PanelLive["chips"][number][] = [];
  if (pose.current !== null) {
    chips.push({ slot: 0, value: pose.bathDots, text: String(Math.round(pose.bathDots)), color: "f" });
    chips.push({ slot: 1, value: pose.insideDots, text: String(pose.insideDots), color: "g" });
  }
  const readout = pose.solved
    ? null
    : pose.current !== null
      ? `wave ${pose.current + 1} of ${pose.total}`
      : pose.done
        ? `${pose.answered} of ${pose.total} routed`
        : null;
  return { scrubX: null, readout, chips, highlights: [], liveCards: cards };
}

// ---------------------------------------------------------------- hints, audio

function hintTargetsOf(rung: HintRung, input: StaticInput<SluiceWavesConfig>): readonly HintTarget[] {
  const skin = SLUICE_WAVES_SKINS.find((s) => s.id === input.skinId) ?? SLUICE_WAVES_SKINS[0];
  return skin.hintTargets[rung - 1] ?? [];
}

function audioOf(pose: SluiceWavesPose): readonly AudioParam[] {
  if (pose.current === null || pose.solved) return [];
  return [{ cue: "current_hum", pitch: 1 + 0.25 * pose.progress, gain: 0.25 }];
}

// ---------------------------------------------------------------- outcomes

/**
 * The failure plan acts on `wrongKeys[0]` ONLY (`w<i>`, the first wave grade() names): that wave's cell floats back
 * into the Label Lock and its tag blinks; then, because the feedback names that wave's category (`disclosed`), the
 * lock may render that category's bath (e5: its density) or play that one cell's true fate (e9). Nothing else moves.
 */
function failurePlanOf(d: Diagnosis, input: PoseInput<SluiceWavesConfig, null>): FailurePlan {
  const { config } = input;
  const cue = SLUICE_WAVES_SKINS[0].cues.fail;
  const m = /^w(\d+)$/.exec(d.wrongKeys[0] ?? "");
  if (d.failKey !== "wrong_wave" || !m) return { beats: [{ atMs: 0, anchor: "lock", action: "flash" }], durationMs: 700, cue };
  const waveIndex = Number(m[1]);
  const at = cellAnchor(waveIndex);
  const beats: FailBeat[] = [
    { atMs: 0, anchor: at, action: "spit_back", params: { to: "lock", wave: waveIndex } },
    { atMs: 450, anchor: at, action: "flash", params: { tag: 1, blinks: 3, wave: waveIndex } },
  ];
  const disclosed = typeof d.disclosed.category === "string" ? d.disclosed.category : null;
  const j = disclosed === null ? -1 : config.valves.findIndex((v) => v.categoryId === disclosed);
  if (j >= 0) {
    const w = config.waves.find((x) => x.waveIndex === waveIndex);
    const valve = config.valves[j]!;
    const params: Record<string, number | string> = { wave: waveIndex, valve: j };
    if (valve.densityK !== null && w) params.dots = Math.round(claimedOutDots(w.inDots, valve.densityK));
    const fate = outcomeFate(w, valve);
    if (fate !== null) params.fate = fate;
    beats.push({ atMs: 800, anchor: at, action: "hold_bright", params });
  }
  return { beats, durationMs: 1500, cue };
}

/**
 * The success plan (≈ 2.2 s): the basin gates open, every cell drifts into the basin of the SOLUTION draft's answer and
 * plays its true fate (the stated one, or the one its category implies), then the water drains (steps_emerge) or
 * fills (water_rises) and the lock opens.
 */
function successPlanOf(input: PoseInput<SluiceWavesConfig, null>, anim: PayoffAnim): SuccessPlan {
  const { config, view, draft } = input;
  const answers = answersOf(draft);
  const valveIdx = new Map(config.valves.map((v, i) => [v.categoryId, i]));
  const beats: SuccessBeat[] = [];
  config.valves.forEach((_, j) => beats.push({ atMs: 0, anchor: basinAnchor(j), action: "open" }));
  viewWaves(view).forEach((w, k) => {
    const a = answers.get(w.waveIndex);
    const j = a === undefined ? undefined : valveIdx.get(a);
    const cfg = config.waves.find((x) => x.waveIndex === w.waveIndex);
    const fate = j === undefined ? null : outcomeFate(cfg, config.valves[j]);
    const params: Record<string, number | string> = { wave: w.waveIndex };
    if (j !== undefined) params.valve = j;
    if (fate !== null) params.fate = fate;
    beats.push({ atMs: 150 + 90 * k, anchor: cellAnchor(w.waveIndex), action: "cycle", params });
  });
  const tWater = 900;
  if (anim === "steps_emerge") beats.push({ atMs: tWater, anchor: "lock", action: "drain", params: { depth: SLUICE_LAYOUT.drainDepth, ms: 1400 } });
  else if (anim === "water_rises") beats.push({ atMs: tWater, anchor: "barge_deck", action: "rise", params: { rise: SLUICE_LAYOUT.fillRise, ms: 1300 } });
  else beats.push({ atMs: tWater, anchor: "lock", action: "open", params: { anim } });
  return { beats, cardEffects: [], durationMs: anim === "water_rises" ? 2300 : 2200, cue: SLUICE_WAVES_SKINS[0].cues.succeed };
}

// ---------------------------------------------------------------- geometry

function extentRight(config: SluiceWavesConfig): number {
  return eddyXY(config.valves.length).x + 140;
}

// ---------------------------------------------------------------- the meta

export const sluiceWavesMeta: ContraptionMeta<SluiceWavesConfig, SluiceWavesPose> = {
  id: "sluice_waves",
  name: "Sluice Waves",
  modes: ["sorter.type_match"],
  tier: "native",
  status: "demo",
  reusable: "any_subject",
  layouts: ["scrub"],
  defaultLayout: "scrub",
  payoffs: ["steps_emerge", "water_rises", "lift_moves", "gate_lifts"],
  nearMissKeys: [],
  accessories: [],
  skins: SLUICE_WAVES_SKINS,
  control: "waves",
  configSchema: SluiceWavesConfig,
  validateConfig: (config: SluiceWavesConfig, ctx: ConfigCtx): readonly ConfigIssue[] => validateSluiceWaves(config, ctx),
  defaultConfig(ctx: ConfigCtx): SluiceWavesConfig {
    return SluiceWavesConfig.parse({
      waves: waveIndicesOf(ctx.view).map((waveIndex) => ({ waveIndex, cell: "generic", inDots: 10, outDots: 10, fate: null, showFate: false })),
      valves: categoryIdsOf(ctx.view).map((categoryId) => ({ categoryId })),
    });
  },
  writerConfigSchema: (ctx: WriterCtx) =>
    ctx.itemKeys.length === 0
      ? null
      : z.object({
          waves: z
            .array(
              z.object({
                waveIndex: z.number().int().min(0).max(9),
                cell: SluiceCell,
                inDots: z.number().int().min(0).max(60),
                outDots: z.number().int().min(0).max(80),
                fate: SluiceFate.nullable().describe("Only when the wave text itself states what happens to the cell; otherwise null"),
                showFate: z.boolean().describe("true only when the wave text states the fate"),
              }),
            )
            .min(ctx.itemKeys.length)
            .max(ctx.itemKeys.length),
        }),
  fromWriterConfig(w: unknown, ctx: ConfigCtx): SluiceWavesConfig {
    const wc = w as SluiceWavesWriter;
    return SluiceWavesConfig.parse({
      waves: wc.waves.map((v) => ({ ...v, fate: v.showFate ? v.fate : null })),
      valves: categoryIdsOf(ctx.view).map((categoryId) => ({ categoryId })),
    });
  },
  // ---- geometry
  footprint(config: SluiceWavesConfig): Footprint2D {
    return { left: 160, right: extentRight(config) + 420, height: 720 };
  },
  frameBounds(config: SluiceWavesConfig): Bounds {
    const x0 = -560;
    return { x: x0, y: -560, w: extentRight(config) - x0, h: 880 };
  },
  // ---- live
  probe: () => null, // the wave timer is the continuous element (cell §5.5)
  clock: { resetOn: ["open"] },
  sim: null,
  pose: (input) => computePose(input),
  lerp: (from, to, t) => lerpPose(from, to, t),
  describe: (pose, input) => describePose(pose, input),
  panelStatic: (input) => panelStaticOf(input),
  panelLive: (stat, input) => panelLiveOf(stat, input),
  hintTargets: (rung, input) => hintTargetsOf(rung, input),
  audio: (pose) => audioOf(pose),
  failurePlan: (d, input) => failurePlanOf(d, input),
  successPlan: (input, anim) => successPlanOf(input, anim),
  solvedPose: (input) => computePose({ ...input, solved: true }),
  debug(pose: SluiceWavesPose) {
    const cur = pose.current === null ? null : pose.cells[pose.current];
    return {
      current: pose.current ?? -1,
      progress: Math.round(pose.progress * 1000) / 1000,
      answered: pose.answered,
      total: pose.total,
      done: pose.done,
      claim: pose.claimId ?? "",
      bathDots: Math.round(pose.bathDots * 10) / 10,
      arrows: pose.arrows,
      volume: cur ? Math.round(cur.volume * 1000) / 1000 : 1,
      cells: pose.cells.map((c) => `${c.key}:${c.place}${c.valve !== null ? c.valve : ""}`).join("|"),
      leaf: Math.round(pose.leaf * 100) / 100,
      water: Math.round(pose.water * 100) / 100,
      solved: pose.solved,
    };
  },
};

/**
 * step_bridge — sequencer.linear (docs/design/20 §4 row 6, §4.2, §4.4; trig §5.4, cell §5.10, civil §5.2/§5.9).
 * Placed planks fly to bays: floating sockets (floating_steps), slabs rising from water (walking_road), deck sections
 * under an arch (timeline_bridge), or a stage rail whose probe plays the player's own order through the membrane-fold
 * stage physics (endocytosis_lift). KA1: the complete pure half, the contract every skin draws from.
 *
 * Live-reveal rule (§2.5.6): the world shows what each placement does, never whether it is right. Every placed plank
 * looks the same (the decoy included); `stepEffects` is success-only (the no-leak test permutes it); the civil e9 world
 * bay lamps stay off below `bayLampsTier` for every draft and cursor (amendment 26). The stage-rail playback is the
 * designed claim render: it plays the player's own order through the physics (cell §5.10).
 */
import { z } from "zod";
import { asTuple } from "../../contracts/slices";
import type { PayoffAnim } from "../../contracts/world";
import { clamp, ease, lerp } from "../ease";
import type { Vec2 } from "../geom";
import type {
  AudioParam,
  Bounds,
  CardModel,
  ChipSpec,
  ConfigCtx,
  ConfigIssue,
  ContraptionMeta,
  ContraptionSkin,
  Described,
  Diagnosis,
  Draft,
  FailBeat,
  FailurePlan,
  Footprint2D,
  GraphAnnotation,
  HintRung,
  HintTarget,
  PanelLive,
  PanelStatic,
  PoseInput,
  SchematicPrim,
  SnapshotPart,
  StaticInput,
  SuccessBeat,
  SuccessPlan,
  WriterCtx,
} from "../types";
import {
  dateAppearsIn,
  dateParts,
  err,
  exprEvaluatesOver,
  findDates,
  fracYearOf,
  plankKeysOf,
  probeRangeIssues,
  subsetOf,
  viewRows,
  viewTextOf,
  warn,
  yearProbeFor,
} from "./config-parts";
import { defineSkin, partKey } from "./skin-kit";
import { GLYPH_LIBRARY, probeFromWriter, wDate, wProbe, type WriterProbe } from "./writer-kit";
import { StepBridgeConfig, StepEffect, type StageId } from "./step-bridge.config";
import { FOLD_START, foldStage, type FoldState } from "../sims";
import {
  axisModel,
  evalExpr,
  fmtNum,
  formatProbe,
  lerpArray,
  lerpMaybe,
  MONTHS,
  piTickLabel,
  probeU,
  samplePlot,
  skinById,
  withExtraTargets,
} from "./claim-holders.meta";
export { StageId, StepBridgeConfig, StepEffect, STEP_BRIDGE_SUCCESS_ONLY } from "./step-bridge.config";

// ================================================================ skins (§4.3)

const ht = (anchor: string, action: HintTarget["action"], holdMs: number): HintTarget => ({ anchor, action, holdMs });

/**
 * DOM-fallback snapshot of the Solving Span (amendment 31, §4.3), laid out like the KA3 prefab on trig e4 (chasm lips
 * at ±452; container-local, the bridge line on y = 0): dormant = the empty sockets, four stones in the cradle, the dark
 * pylons, the lip relief and the chasm edges; solved = the four stones seated in their sockets.
 */
export function floatingStepsSnapshots(): ContraptionSkin["snapshot"] {
  const k = (slot: string) => partKey("orrery_terraces", "floating_steps", slot);
  const sockets = [-360, -140, 80, 300].map((x, j): SnapshotPart => ({ asset: k("socket"), dx: x, dy: j === 0 || j === 3 ? 46 : 38 }));
  const fixed: SnapshotPart[] = [
    { asset: k("chasm_edge"), dx: -497, dy: 260 },
    { asset: k("chasm_edge"), dx: 497, dy: 260 },
    { asset: k("relief"), dx: -700, dy: 100 },
    { asset: k("cradle"), dx: -580, dy: -170 },
    { asset: k("pylon"), dx: 512, dy: -150 },
    { asset: k("pylon"), dx: 652, dy: -150 },
    ...sockets,
  ];
  const inCradle = [0, 1, 2, 3].map((i): SnapshotPart => ({ asset: k("stone"), dx: -580, dy: -40 - 66 * i }));
  const seated = [-360, -140, 80, 300].map((x, j): SnapshotPart => ({ asset: k("stone"), dx: x, dy: j === 0 || j === 3 ? 34 : 26 }));
  return { dormant: [...fixed, ...inCradle], solved: [...fixed, ...seated] };
}

export const STEP_BRIDGE_SKINS = [
  { ...defineSkin({
    id: "floating_steps",
    name: "Floating Steps",
    ns: "orrery_terraces",
    nouns: ["span", "steps", "stones", "sockets", "bridge", "Solving Span", "plank", "planks"],
    parts: [
      ["socket", "K"], ["stone", "K"], ["glyph", "H"], ["cradle", "K"], ["pylon", "K"], ["chasm_edge", "K"], ["relief", "K"], ["console", "K"],
    ],
    anchors: ["socket_0…3", "cradle_0…4", "pylon_a", "pylon_b", "lip_relief", "console"],
    cues: { live: "stud_tick", succeed: "stone_lock_thunk", fail: "stone_grind" },
    // trig §5.4: rung 1 land on socket 1; rung 2 circle the lip relief; rung 3 hover at the far pylon
    hintTargets: [[ht("socket_0", "land", 1500)], [ht("lip_relief", "circle", 2000)], [ht("pylon_b", "hover", 2000)]],
  }), snapshot: floatingStepsSnapshots() },
  defineSkin({
    id: "walking_road",
    name: "Walking Road",
    ns: "archive_of_voices",
    nouns: ["road", "route", "slabs", "slab", "bus", "Walking Road", "day counter"],
    parts: [["slab", "K"], ["city_bus", "H"], ["bus_stop", "K"], ["day_counter", "K"], ["flood_band", "K"], ["console", "K"]],
    anchors: ["bay_0…3", "day_counter", "route_sign", "console"],
    cues: { live: "stud_tick", succeed: "slab_set", fail: "stone_grind" },
    sensitiveSafe: true,
    // civil §5.2: rung 1 land on bay 0 then bay 3; rung 2 land on the DAY counter; rung 3 hover at the route sign
    hintTargets: [[ht("bay_0", "land", 1000), ht("bay_3", "land", 1000)], [ht("day_counter", "land", 1800)], [ht("route_sign", "hover", 2000)]],
  }),
  defineSkin({
    id: "timeline_bridge",
    name: "Timeline Bridge",
    ns: "archive_of_voices",
    nouns: ["bridge", "span", "deck", "bays", "arch", "Timeline Bridge"],
    parts: [["arch_bridge", "H"], ["deck_section", "K"], ["bay_lamp", "K"], ["lectern", "K"], ["streetcar", "H"], ["console", "K"]],
    anchors: ["bay_0…3", "arch_rail", "crown", "console"],
    cues: { live: "stud_tick", succeed: "stone_lock_thunk", fail: "stone_grind" },
    sensitiveSafe: true,
    // civil §5.9: rung 1 ride the lens carriage along the arch; rung 2 land on the crown; rung 3 hover over the last bay
    hintTargets: [[ht("arch_rail", "ride", 2400)], [ht("crown", "land", 1800)], [ht("bay_3", "hover", 2000)]],
  }),
  defineSkin({
    id: "endocytosis_lift",
    name: "Endocytosis Lift",
    ns: "living_gate",
    nouns: ["lift", "vesicle", "pit", "collar", "stage lamps", "Endocytosis Lift", "membrane"],
    parts: [
      ["clathrin_cell", "K"], ["dynamin_collar", "H"], ["halcyon", "H"], ["stage_lamp", "K"], ["vesicle", "K"], ["console", "K"],
    ],
    anchors: ["pit_center", "collar", "lamp_0…3", "sub", "console"],
    cues: { live: "current_hum", succeed: "tube_whoosh", fail: "pod_crack" },
    // cell §5.10: rung 1 circle the pit; rung 2 hover at the collar; rung 3 land on the sub
    hintTargets: [[ht("pit_center", "circle", 2000)], [ht("collar", "hover", 1800)], [ht("sub", "land", 2000)]],
  }),
] as const;

const BIOME_BAYS: Readonly<Record<string, StepBridgeConfig["bays"]>> = {
  orrery_terraces: "floating",
  living_gate: "floating", // stage_rail needs authored stages (cell e10), so defaults never pick it
  archive_of_voices: "flat_road",
};

// ================================================================ membrane-fold stage physics (stage_rail)

export type StageOutcome = "ok" | "dimple" | "empty_vesicle" | "empty_rail" | "bounce";

/** One stage through the membrane physics (KB1's src/world/sims/membrane-fold.ts). */
export function applyStage(s: FoldState, stage: StageId): FoldState {
  return foldStage(s, stage);
}
/** What a stage visibly did, judged only from the states before and after it. */
export function stageOutcome(stage: StageId, before: FoldState, after: FoldState): StageOutcome {
  switch (stage) {
    case "touch":
      return "ok";
    case "fold":
      return after.wrap >= 0.75 && before.wrap < 0.75 ? "ok" : "dimple";
    case "pinch":
      return after.detached && !before.detached ? "ok" : "empty_vesicle";
    case "carry":
      return after.detached && after.travel >= 1 - 1e-9 ? "ok" : "empty_rail";
    case "dissolve_bounce":
      return "bounce";
  }
}
export interface StageStep {
  slot: number;
  key: string;
  stageId: StageId;
  before: FoldState;
  after: FoldState;
  outcome: StageOutcome;
}
/** The stage map key → stageId from the config. */
export function stageMapOf(config: StepBridgeConfig): ReadonlyMap<string, StageId> {
  return new Map(config.stages.map((s) => [s.key, s.stageId]));
}
/** The player's order through the physics: states[0] = flat, states[j + 1] = after slot j (empty slots carry over). */
export function stageRun(slots: readonly (string | null)[], stages: ReadonlyMap<string, StageId>): { states: FoldState[]; steps: StageStep[] } {
  const states: FoldState[] = [FOLD_START];
  const steps: StageStep[] = [];
  let s = FOLD_START;
  slots.forEach((key, slot) => {
    const stageId = key ? stages.get(key) : undefined;
    if (key && stageId) {
      const after = applyStage(s, stageId);
      steps.push({ slot, key, stageId, before: s, after, outcome: stageOutcome(stageId, s, after) });
      s = after;
    }
    states.push(s);
  });
  return { states, steps };
}
/** True when an order ends with the vesicle detached and carried all the way (travel = 1). */
export function orderCarries(order: readonly string[], stages: ReadonlyMap<string, StageId>): boolean {
  const { states } = stageRun(order, stages);
  const end = states[states.length - 1];
  return end.detached && end.travel >= 1 - 1e-9;
}
/** requirement glyph shown on a stage lamp at aid tier ≥ 1 (cell §5.10) */
export const STAGE_REQUIRES: Readonly<Record<StageId, StageId | null>> = { touch: null, fold: "touch", pinch: "fold", carry: "pinch", dissolve_bounce: null };

// ================================================================ validation (§4.4)

/** Ordered selections of `k` distinct keys (k-permutations); stops after `cap`. */
function* kPermutations(keys: readonly string[], k: number): Generator<string[]> {
  const used = new Array<boolean>(keys.length).fill(false);
  const cur: string[] = [];
  function* rec(): Generator<string[]> {
    if (cur.length === k) {
      yield [...cur];
      return;
    }
    for (let i = 0; i < keys.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      cur.push(keys[i]);
      yield* rec();
      cur.pop();
      used[i] = false;
    }
  }
  yield* rec();
}
function permutationCount(n: number, k: number): number {
  let p = 1;
  for (let i = 0; i < k; i++) p *= n - i;
  return p;
}
const PERMUTATION_CAP = 50_000;

export function validateStepBridge(config: StepBridgeConfig, ctx: ConfigCtx): ConfigIssue[] {
  const out: ConfigIssue[] = [];
  const keys = plankKeysOf(ctx.view);
  out.push(...subsetOf(["items"], "item key", keys, config.items.map((i) => i.key)));
  config.items.forEach((it, i) => {
    const text = viewTextOf(ctx.view, it.key);
    if (it.meta.printedDate !== null && !dateAppearsIn([text], it.meta.printedDate)) {
      out.push(err(["items", i, "meta", "printedDate"], `printed date ${it.meta.printedDate} does not appear in "${text}"`));
    }
    if (it.meta.madeYear !== null && !new RegExp(`(^|[^0-9])${it.meta.madeYear}([^0-9]|$)`).test(text)) {
      out.push(err(["items", i, "meta", "madeYear"], `made year ${it.meta.madeYear} does not appear in the item text`));
    }
  });
  out.push(...subsetOf(["stepEffects"], "step effect key", keys, config.stepEffects.map((s) => s.key)));
  if (config.bays === "stage_rail") {
    const staged = stageMapOf(config);
    keys.forEach((k) => {
      if (!staged.has(k)) out.push(err(["stages"], `stage_rail bays need a stage for every plank; "${k}" has none`));
    });
    config.stages.forEach((s, i) => {
      if (s.key.startsWith("d") && s.stageId !== "dissolve_bounce") out.push(err(["stages", i, "stageId"], `decoy "${s.key}" must use the dissolve_bounce stage`));
    });
    // the physics must make the task honest: only the solution order carries the vesicle (cell §5.10)
    const order = (ctx.solution as { order?: unknown } | null)?.order;
    const slots = Number((ctx.view as { slots?: unknown } | null)?.slots ?? keys.length);
    if (Array.isArray(order) && order.every((k) => typeof k === "string") && keys.every((k) => staged.has(k))) {
      const sol = order as string[];
      if (!orderCarries(sol, staged)) out.push(err(["stages"], "membraneFold(solution.order) must end detached with travel = 1"));
      if (permutationCount(keys.length, slots) <= PERMUTATION_CAP) {
        const solKey = sol.join(",");
        for (const p of kPermutations(keys, slots)) {
          if (p.join(",") !== solKey && orderCarries(p, staged)) {
            out.push(err(["stages"], `the order ${p.join(", ")} also carries the vesicle; only the solution order may`));
            break;
          }
        }
      } else out.push(warn(["stages"], "too many orders to prove that only the solution carries the vesicle"));
    }
  } else if (config.stages.length > 0) {
    out.push(err(["stages"], "stages are only for stage_rail bays"));
  }
  if (config.dayCounter) {
    const yearish = config.probe && (config.probe.format === "year" || config.probe.format === "month_year");
    if (!yearish || !config.probe?.window) out.push(err(["dayCounter"], "dayCounter needs a year probe with a window"));
  }
  if (config.relief) {
    if (!exprEvaluatesOver(config.relief.expr, 0, 2 * Math.PI)) out.push(warn(["relief", "expr"], `relief "${config.relief.expr}" does not evaluate over [0, 2π]`));
    if (!exprEvaluatesOver(config.relief.line, 0, 2 * Math.PI)) out.push(warn(["relief", "line"], `relief line "${config.relief.line}" does not evaluate`));
  }
  out.push(...probeRangeIssues(["probe"], config.probe));
  if (config.probeWorld !== "none" && !config.probe) out.push(err(["probeWorld"], `probeWorld "${config.probeWorld}" needs a probe`));
  if (config.probeWorld === "relief_marker" && !config.relief) out.push(err(["probeWorld"], "relief_marker needs a relief"));
  if (config.probeWorld === "day_counter" && !config.dayCounter) out.push(err(["probeWorld"], "day_counter needs a dayCounter"));
  if (config.probeWorld === "playback" && config.bays !== "stage_rail") out.push(err(["probeWorld"], "playback needs stage_rail bays"));
  return out;
}

// ================================================================ writer schema (§4.4)

interface StepBridgeWriter {
  items: { key: string; printedDate: string | null; glyph: string | null }[];
  stepEffects: { key: string; effect: z.infer<typeof StepEffect> }[];
  probe: WriterProbe | null;
}

export function stepBridgeWriterSchema(ctx: WriterCtx) {
  const keys = z.enum(asTuple(ctx.itemKeys, "plank keys"));
  return z.object({
    items: z
      .array(
        z.object({
          key: keys,
          printedDate: wDate().nullable(),
          glyph: z.enum(asTuple(GLYPH_LIBRARY, "glyphs")).nullable().describe("What the step SAYS, never whether it belongs"),
        }),
      )
      .min(ctx.itemKeys.length)
      .max(ctx.itemKeys.length),
    stepEffects: z.array(z.object({ key: keys, effect: StepEffect })).min(0).max(8),
    probe: wProbe(),
  });
}

// ================================================================ geometry (zone units relative to station.anchor, y down)

/** Bay (socket, slab, deck section, stage lamp) position j of n. floating: trig e4's sockets on a gentle arc. */
export function bayPos(bays: StepBridgeConfig["bays"], n: number, j: number): Vec2 {
  const c = j - (n - 1) / 2;
  switch (bays) {
    case "floating":
      return { x: -30 + c * 220, y: j > 0 && j < n - 1 ? -8 : 0 }; // n = 4: x −360, −140, 80, 300
    case "flat_road":
      return { x: c * 250, y: 0 }; // 260-wide slabs over a 1000-wide flood
    case "arch":
      return { x: c * 200, y: 0 }; // deck bays at the crown
    case "stage_rail":
      return { x: -560 + j * 100, y: -180 }; // stage lamps on the Lift frame
  }
}
/** Cradle bay i (floating: the brass rack beside the console; other skins: the shore/palette row). */
export function cradlePos(bays: StepBridgeConfig["bays"], i: number): Vec2 {
  return bays === "floating" ? { x: -650, y: -60 - 75 * i } : { x: -620 + 60 * i, y: 40 };
}
/** The prefab anchor for bay j. */
export function bayAnchor(bays: StepBridgeConfig["bays"], j: number): string {
  return bays === "floating" ? `socket_${j}` : bays === "stage_rail" ? `lamp_${j}` : `bay_${j}`;
}
/** Relief band on the chasm lip (trig §5.4): 480 wide over [0, 2π], 40 units per y unit; relative to `lip_relief`. */
export const RELIEF_BAND = { width: 480, unitsPerY: 40 } as const;

/** Roots of relief.expr − relief.line over [x0, x1] (numerical, from the card's own equation; never the solution). */
export function reliefCrossings(expr: string, line: string, x0 = 0, x1 = 2 * Math.PI, samples = 720): number[] {
  const g = (x: number) => {
    const a = evalExpr(expr, x);
    const b = evalExpr(line, x);
    return a === null || b === null ? null : a - b;
  };
  const out: number[] = [];
  let px = x0;
  let pv = g(x0);
  for (let i = 1; i <= samples; i++) {
    const x = x0 + ((x1 - x0) * i) / samples;
    const v = g(x);
    if (pv !== null && v !== null) {
      if (pv === 0) out.push(px);
      else if (pv * v < 0) {
        let lo = px;
        let hi = x;
        let vlo = pv;
        for (let it = 0; it < 80; it++) {
          const mid = (lo + hi) / 2;
          const vm = g(mid);
          if (vm === null) break;
          if (vlo * vm <= 0) hi = mid;
          else {
            lo = mid;
            vlo = vm;
          }
        }
        out.push((lo + hi) / 2);
      }
    }
    px = x;
    pv = v;
  }
  return out;
}

/** DAY = clamp(round((probe − epoch) · 365.25), 0, max), epoch as a fractional year (civil §5.2). */
export function dayCounterOf(probe: number, epoch: string, max: number): number {
  const e = fracYearOf(epoch) ?? probe;
  return clamp(Math.round((probe - e) * 365.25), 0, max);
}
/** "1965-03-07" → "MAR 7 1965", "1956-12" → "DEC 1956", "1954" → "1954". */
export function formatPrintedDate(date: string): string {
  const p = dateParts(date);
  if (!p) return date;
  if (p.month === null) return String(p.year);
  return p.day === null ? `${MONTHS[p.month - 1]} ${p.year}` : `${MONTHS[p.month - 1]} ${p.day} ${p.year}`;
}
function prettyExpr(expr: string): string {
  return expr.replace(/\*/g, " ").replace(/\s+/g, " ").trim();
}

// ================================================================ pose

export interface StagePose {
  k: number; // playback position 0…n
  depth: number;
  wrap: number;
  neck: number;
  detached: boolean;
  travel: number;
  bounced: boolean;
  slot: number | null; // the slot whose stage is playing (⌈k⌉ − 1)
  outcome: StageOutcome | null; // what that stage did
  atpSpent: number; // fold/pinch stages entered so far (the ATP card ticks)
}

/** The archetype's pose (skins import this name). Bays are in slot order; planks in `view.planks` display order. */
export interface StepBridgePose {
  bays: StepBridgeConfig["bays"];
  n: number; // bays (view.slots)
  placed: readonly (string | null)[]; // plank key per bay
  bayFill: readonly number[]; // 0 empty … 1 placed: the stone seats, the slab rises, the deck slides in (all identical)
  plankBay: readonly (number | null)[]; // per display plank: the bay it sits in, null = in its cradle
  focus: string | null; // focused or hovered plank key
  complete: boolean;
  guide: number; // the faint dotted "ready" guide when every bay is filled (never a verdict)
  bayLamps: readonly number[]; // world lamps per bay (civil e9): ALL 0 below bayLampsTier
  routeLamps: number; // placed count (walking_road shelter lamps; neutral completion)
  probeU: number | null;
  marker: { x: number; y: number; value: number } | null; // relief plumb bob, relative to `lip_relief`
  glint: number | null; // index of the relief crossing the marker is passing
  day: number | null; // the DAY counter
  stage: StagePose | null; // stage_rail playback
  stageLamps: readonly (string | null)[]; // stage_rail: the icon of each filled slot's plank
  stageReqs: readonly (StageId | null)[]; // aid tier ≥ 1: each filled stage's requirement glyph
  gate: number; // payoff 0 … 1
  solved: boolean;
}

function planksOf(view: unknown): { key: string; text: string }[] {
  return viewRows(view, "planks");
}
function slotCountOf(view: unknown): number {
  const n = Number((view as { slots?: unknown } | null)?.slots);
  return Number.isInteger(n) && n > 0 ? n : Math.max(0, planksOf(view).length - 1);
}
/** The draft's slots padded to n (null = empty); unknown shapes read as empty. */
export function slotsOf(draft: Draft | null, n: number): (string | null)[] {
  const raw = (draft?.input as { slots?: unknown } | null | undefined)?.slots;
  const arr = Array.isArray(raw) ? raw : [];
  return Array.from({ length: n }, (_, j) => (typeof arr[j] === "string" ? (arr[j] as string) : null));
}
function itemOf(config: StepBridgeConfig, key: string | null) {
  return key === null ? null : (config.items.find((i) => i.key === key) ?? null);
}
function printedAt(config: StepBridgeConfig, key: string | null): number | null {
  const d = itemOf(config, key)?.meta.printedDate ?? null;
  return d === null ? null : fracYearOf(d);
}

/** Stage playback pose at k: blends S⌊k⌋ → S⌈k⌉ (ease-in-out); booleans switch at the midpoint. */
export function stagePoseAt(config: StepBridgeConfig, slots: readonly (string | null)[], k: number): StagePose {
  const run = stageRun(slots, stageMapOf(config));
  const kk = clamp(k, 0, slots.length);
  const i0 = Math.floor(kk);
  const i1 = Math.min(slots.length, Math.ceil(kk));
  const f = ease("in_out_cubic", kk - i0);
  const a = run.states[i0];
  const b = run.states[i1];
  const slot = kk > 0 ? Math.min(slots.length - 1, Math.ceil(kk) - 1) : null;
  const step = slot === null ? null : (run.steps.find((s) => s.slot === slot) ?? null);
  const atpSpent = run.steps.filter((s) => (s.stageId === "fold" || s.stageId === "pinch") && kk > s.slot).length;
  return {
    k: kk,
    depth: lerp(a.depth, b.depth, f),
    wrap: lerp(a.wrap, b.wrap, f),
    neck: lerp(a.neck, b.neck, f),
    detached: f >= 0.5 ? b.detached : a.detached,
    travel: lerp(a.travel, b.travel, f),
    bounced: f >= 0.5 ? b.bounced : a.bounced,
    slot,
    outcome: step?.outcome ?? null,
    atpSpent,
  };
}
const SOLVED_STAGE = (n: number, atp: number): StagePose => ({ k: n, depth: 1, wrap: 300 / 360, neck: 1, detached: true, travel: 1, bounced: false, slot: n - 1, outcome: "ok", atpSpent: atp });

function stepPose(input: PoseInput<StepBridgeConfig, null>): StepBridgePose {
  const { config, view, draft } = input;
  const n = slotCountOf(view);
  const placed = slotsOf(draft, n);
  const planks = planksOf(view);
  const filled = placed.filter((k) => k !== null).length;
  const complete = filled === n && n > 0;
  const probe = input.probe;
  // relief marker (trig e4): the plumb bob rides the relief; glints where relief = line (the card's own equation)
  let marker: StepBridgePose["marker"] = null;
  let glint: number | null = null;
  if (config.relief && config.probeWorld === "relief_marker" && probe !== null) {
    const value = evalExpr(config.relief.expr, probe) ?? 0;
    marker = { x: (probe * RELIEF_BAND.width) / (2 * Math.PI) - RELIEF_BAND.width / 2, y: -RELIEF_BAND.unitsPerY * value, value };
    const half = (config.probe?.step ?? 0.065) / 2;
    const hit = reliefCrossings(config.relief.expr, config.relief.line).findIndex((c) => Math.abs(c - probe) <= half + 1e-9);
    glint = hit >= 0 ? hit : null;
  }
  // civil e9 bay lamps: the world sweep runs only at aid tier ≥ bayLampsTier (amendment 26)
  const sweep = config.probeWorld === "bay_lamps" && input.aidTier >= config.bayLampsTier && probe !== null;
  const bayLamps = placed.map((key) => {
    if (input.solved) return 1;
    if (!sweep) return 0;
    const at = printedAt(config, key);
    return at !== null && at <= probe! + 1e-9 ? 1 : 0;
  });
  const day = config.dayCounter && probe !== null ? dayCounterOf(probe, config.dayCounter.epoch, config.dayCounter.max) : null;
  let stage: StagePose | null = null;
  if (config.bays === "stage_rail") {
    const foldPinch = config.stages.filter((s) => s.stageId === "fold" || s.stageId === "pinch").length;
    stage = input.solved && !draft ? SOLVED_STAGE(n, foldPinch) : stagePoseAt(config, placed, input.solved ? n : (probe ?? 0));
  }
  const stageById = new Map(config.stages.map((s) => [s.key, s]));
  const focusKey = draft?.hover ?? draft?.focus ?? null;
  return {
    bays: config.bays,
    n,
    placed,
    bayFill: placed.map((k) => (k !== null || input.solved ? 1 : 0)),
    plankBay: planks.map((p) => {
      const j = placed.indexOf(p.key);
      return j >= 0 ? j : null;
    }),
    focus: focusKey,
    complete,
    guide: complete || input.solved ? 1 : 0,
    bayLamps,
    routeLamps: input.solved ? n : filled,
    probeU: probeU(probe, config.probe),
    marker,
    glint,
    day,
    stage,
    stageLamps: config.bays === "stage_rail" ? placed.map((k) => (k ? (stageById.get(k)?.icon ?? null) : null)) : placed.map(() => null),
    stageReqs:
      config.bays === "stage_rail" && input.aidTier >= 1
        ? placed.map((k) => {
            const st = k ? stageById.get(k) : undefined;
            return st ? STAGE_REQUIRES[st.stageId] : null;
          })
        : placed.map(() => null),
    gate: input.solved ? 1 : 0,
    solved: input.solved,
  };
}

function lerpStage(a: StagePose | null, b: StagePose | null, t: number): StagePose | null {
  if (!a || !b) return t >= 0.5 ? b : a;
  const s = t >= 0.5;
  return {
    k: lerp(a.k, b.k, t),
    depth: lerp(a.depth, b.depth, t),
    wrap: lerp(a.wrap, b.wrap, t),
    neck: lerp(a.neck, b.neck, t),
    detached: s ? b.detached : a.detached,
    travel: lerp(a.travel, b.travel, t),
    bounced: s ? b.bounced : a.bounced,
    slot: s ? b.slot : a.slot,
    outcome: s ? b.outcome : a.outcome,
    atpSpent: s ? b.atpSpent : a.atpSpent,
  };
}
function lerpStepPose(a: StepBridgePose, b: StepBridgePose, t: number): StepBridgePose {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const s = t >= 0.5;
  return {
    bays: s ? b.bays : a.bays,
    n: s ? b.n : a.n,
    placed: s ? b.placed : a.placed,
    bayFill: lerpArray(a.bayFill, b.bayFill, t),
    plankBay: s ? b.plankBay : a.plankBay,
    focus: s ? b.focus : a.focus,
    complete: s ? b.complete : a.complete,
    guide: lerp(a.guide, b.guide, t),
    bayLamps: lerpArray(a.bayLamps, b.bayLamps, t),
    routeLamps: s ? b.routeLamps : a.routeLamps,
    probeU: lerpMaybe(a.probeU, b.probeU, t),
    marker: a.marker && b.marker ? { x: lerp(a.marker.x, b.marker.x, t), y: lerp(a.marker.y, b.marker.y, t), value: lerp(a.marker.value, b.marker.value, t) } : s ? b.marker : a.marker,
    glint: s ? b.glint : a.glint,
    day: s ? b.day : a.day,
    stage: lerpStage(a.stage, b.stage, t),
    stageLamps: s ? b.stageLamps : a.stageLamps,
    stageReqs: s ? b.stageReqs : a.stageReqs,
    gate: lerp(a.gate, b.gate, t),
    solved: s ? b.solved : a.solved,
  };
}

// ================================================================ describe

function stepDescribe(pose: StepBridgePose, input: PoseInput<StepBridgeConfig, null>): Described {
  const { config, view } = input;
  const chips: ChipSpec[] = [];
  const planks = planksOf(view);
  if (pose.marker && config.relief) chips.push({ anchor: "lip_relief", text: `${prettyExpr(config.relief.expr)}: ${fmtNum(pose.marker.value)}`, color: "f" });
  if (pose.day !== null) chips.push({ anchor: "day_counter", text: `DAY ${pose.day}`, color: "accent" });
  pose.placed.forEach((key, j) => {
    if (key === null) return;
    const item = itemOf(config, key);
    const anchor = bayAnchor(config.bays, j);
    if (config.bays === "arch") {
      const d = item?.meta.printedDate;
      if (d) chips.push({ anchor, text: formatPrintedDate(d), color: "f" }); // the date PRINTED in the plank (civil §5.9)
    } else if (config.bays === "flat_road") {
      chips.push({ anchor, text: viewTextOf(view, key).slice(0, 28), color: "f" });
    } else if (config.bays !== "floating") {
      const label = item?.meta.label;
      if (label) chips.push({ anchor, text: label, color: "f" });
    }
  });
  if (config.bays === "floating") {
    // KA3: the glyph stones sit 220 apart (84 px at board-layout zoom), so only the stone you point at is labelled,
    // in its socket or its cradle bay; the panel's stone column carries every text.
    planks.forEach((p, i) => {
      if (pose.focus !== p.key) return;
      const label = itemOf(config, p.key)?.meta.label;
      const j = pose.plankBay[i];
      if (label) chips.push({ anchor: j === null ? `cradle_${i}` : bayAnchor(config.bays, j), text: label, color: "f" });
    });
  }
  if (pose.stage) {
    chips.push({ anchor: "collar", text: `stage: ${fmtNum(pose.stage.k, 1)}`, color: "f" });
    chips.push({ anchor: "pit_center", text: `depth: ${fmtNum(pose.stage.depth * 1.3, 1)} H`, color: "g" });
  }
  const filled = pose.placed.filter((k) => k !== null).length;
  let srText: string;
  if (pose.solved) srText = "Every bay is locked; the way across is open.";
  else if (pose.stage && pose.stage.k > 0) {
    const what: Record<StageOutcome, string> = {
      ok: "the stage plays through",
      dimple: "the membrane dimples and relaxes: nothing to fold around",
      empty_vesicle: "an empty micro-vesicle pinches off and the sub stays outside",
      empty_rail: "the rail lights, but nothing is on it",
      bounce: "the sub presses into the heads and springs back",
    };
    srText = `Playback at stage ${fmtNum(pose.stage.k, 1)}: ${pose.stage.outcome ? what[pose.stage.outcome] : "the membrane is flat"}.`;
  } else srText = `${filled} of ${pose.n} bays hold a plank${pose.complete ? "; the span is ready to test" : ""}.`;
  if (pose.day !== null) srText += ` The day counter reads ${pose.day}.`;
  if (pose.marker) srText += ` The marker reads ${fmtNum(pose.marker.value)}${pose.glint !== null ? " and glints at a crossing" : ""}.`;
  if (pose.bayLamps.some((l) => l > 0) && !pose.solved) srText += ` ${pose.bayLamps.filter((l) => l > 0).length} bay lamps are lit.`;
  return { chips, pins: [], srText, nearMiss: null };
}

// ================================================================ panel models

type CardId = "file" | "rail" | "circle" | "relief" | "pit" | "atp";
function stepLayout(config: StepBridgeConfig, record: boolean): CardId[] {
  const extras: CardId[] = config.relief ? ["circle", "relief"] : config.bays === "stage_rail" ? ["pit", "atp"] : [];
  const dated = config.items.some((i) => i.meta.printedDate !== null) || config.probeWorld === "bay_lamps" || config.probeWorld === "record_lens";
  if (record) return (["file", "rail", ...extras] as CardId[]).slice(0, 4);
  return ([...(["rail"] as CardId[]), ...extras, ...(dated ? (["file"] as CardId[]) : [])]).slice(0, 4);
}
function recordFromStatic(stat: PanelStatic, config: StepBridgeConfig): boolean {
  const withRecord = stepLayout(config, true);
  if (withRecord.join() === stepLayout(config, false).join()) return false;
  return stat.cards.length === withRecord.length && stat.cards[0]?.kind === "timeline";
}

type SlotRailCard = Extract<CardModel, { kind: "slot_rail" }>;
function railCard(slot: number, config: StepBridgeConfig, view: unknown, placed: readonly (string | null)[]): SlotRailCard {
  const title = config.bays === "stage_rail" ? "stage rail" : config.bays === "floating" ? "SPAN" : "DECK";
  const filled = placed.filter((k) => k !== null).length;
  return {
    kind: "slot_rail",
    slot,
    title,
    heading: config.pageOrderHeading,
    slots: placed.map((key, index) => ({
      index,
      key,
      label: key === null ? null : (itemOf(config, key)?.meta.label ?? (viewTextOf(view, key).slice(0, 40) || null)),
      lamp: key === null ? ("off" as const) : ("on" as const), // on = filled (completion only)
    })),
    anchorsRight: config.anchors,
    sr: `${placed.length} slots, ${filled} filled${config.anchors ? `, ${config.anchors} anchors on the far bank` : ""}.`,
  };
}
function reliefAmp(config: StepBridgeConfig): number {
  if (!config.relief) return 1;
  let m = 0;
  for (let i = 0; i < 97; i++) {
    const v = evalExpr(config.relief.expr, (2 * Math.PI * i) / 96);
    if (v !== null) m = Math.max(m, Math.abs(v));
  }
  return m || 1;
}
function unitCircleCard(slot: number, config: StepBridgeConfig, aidTier: number): CardModel {
  const line = config.relief ? evalExpr(config.relief.line, 0) : null;
  const level = aidTier >= 2 && line !== null ? clamp(line / reliefAmp(config), -1, 1) : null;
  return {
    kind: "unit_circle",
    slot,
    title: "UNIT CIRCLE",
    landmarks: [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle) => ({ angle, label: piTickLabel(angle) })),
    hairlineStep: null,
    point: null,
    arc: null,
    drops: { sin: false, cos: false },
    level,
    shadeUpperHalf: false,
    mirror: null,
    sr: level === null ? "The unit circle, nothing marked yet." : `The unit circle with a level line at y = ${fmtNum(level)}.`,
  };
}
function reliefCard(slot: number, config: StepBridgeConfig, aidTier: number): CardModel {
  const r = config.relief!;
  const amp = reliefAmp(config);
  const y: [number, number] = [-(amp + 0.5), amp + 0.5];
  const f = samplePlot("relief", "f", "solid", (x) => evalExpr(r.expr, x), 0, 2 * Math.PI, y[1] - y[0]);
  const g = samplePlot("line", "g", "dashed", (x) => evalExpr(r.line, x), 0, 2 * Math.PI, y[1] - y[0]);
  const ann: GraphAnnotation[] = [];
  if (aidTier >= 1) {
    const xs = [0, ...reliefCrossings(r.expr, r.line), 2 * Math.PI];
    for (let i = 0; i + 1 < xs.length; i++) {
      const mid = (xs[i] + xs[i + 1]) / 2;
      const a = evalExpr(r.expr, mid);
      const b = evalExpr(r.line, mid);
      if (a !== null && b !== null && a > b) ann.push({ kind: "shade", x0: xs[i], x1: xs[i + 1], y0: b, y1: null, color: "g", alpha: 0.2, label: null });
    }
  }
  const title = `${prettyExpr(r.expr)} = ${prettyExpr(r.line)}`;
  return {
    kind: "graph",
    slot,
    title,
    tab: title,
    x: axisModel(0, 2 * Math.PI, "pi", "x"),
    y: axisModel(y[0], y[1], "number", null),
    plots: [f, g],
    annotations: ann,
    columns: [],
    targetLine: null,
    empty: false,
    sr: `f = ${r.expr} in white and y = ${r.line} dashed green, x from 0 to 2π.`,
  };
}
function pitCard(slot: number, stage: StagePose | null, aidTier: number): CardModel {
  const s = stage ?? { k: 0, depth: 0, wrap: 0, neck: 0, detached: false, travel: 0, bounced: false, slot: null, outcome: null, atpSpent: 0 };
  const W = 400;
  const top = 70;
  const dip = 110 * s.depth;
  const halfW = 60 + 40 * s.depth * (1 - 0.6 * s.neck);
  const pts: [number, number][] = [
    [0, top], [W / 2 - 130, top], [W / 2 - halfW, top + dip * 0.5], [W / 2 - halfW * (1 - 0.7 * s.neck), top + dip],
    [W / 2 + halfW * (1 - 0.7 * s.neck), top + dip], [W / 2 + halfW, top + dip * 0.5], [W / 2 + 130, top], [W, top],
  ];
  const prims: SchematicPrim[] = [{ p: "poly", points: s.detached ? [[0, top], [W, top]] : pts, color: "f", fill: false, w: 3 }];
  const subY = top - 20 + dip * 0.8 + s.travel * 90 - (s.bounced ? 10 : 0);
  if (s.detached) prims.push({ p: "circle", cx: W / 2, cy: subY, r: 34, color: "g", fill: false });
  prims.push({ p: "circle", cx: W / 2, cy: subY, r: 18, color: "gold", fill: true });
  if (s.outcome === "empty_vesicle") prims.push({ p: "circle", cx: W / 2 + 90, cy: top + 30, r: 12, color: "g", fill: false });
  if (aidTier >= 2) prims.push({ p: "text", x: 12, y: 222, text: `ω = ${Math.round(s.wrap * 360)}°`, size: 20, color: "h", anchor: "start" });
  return { kind: "schematic", slot, title: "pit", viewBox: [W, 240], prims, sr: `The pit, depth ${fmtNum(s.depth * 1.3, 1)} H${s.detached ? ", vesicle detached" : ""}${s.travel > 0.5 ? ", carried down" : ""}.` };
}
function atpCard(slot: number, config: StepBridgeConfig, placed: readonly (string | null)[], stage: StagePose | null): CardModel {
  const stages = stageMapOf(config);
  const costly = (k: string | null) => {
    const id = k ? stages.get(k) : undefined;
    return id === "fold" || id === "pinch";
  };
  const total = Math.max(2, config.stages.filter((s) => s.stageId === "fold" || s.stageId === "pinch").length);
  const projected = placed.filter(costly).length;
  const spent = stage?.atpSpent ?? 0;
  return { kind: "energy_cells", slot, title: "ATP", total, spent, projected, sr: `ATP: ${spent} spent of ${total}, ${projected} projected by the plates placed.` };
}
function stepFileCard(slot: number, config: StepBridgeConfig, placed: readonly (string | null)[], aidTier: number): CardModel {
  // amendment 26: at tier 0 the FILE card shows WHICH dates are on the deck, never WHERE (no bay connectors)
  const connectors = config.probeWorld !== "bay_lamps" || aidTier >= config.bayLampsTier;
  const lanes = connectors && config.probeWorld === "bay_lamps" ? placed.map((_, j) => ({ id: `bay_${j}`, label: `BAY ${j + 1}` })) : [];
  const pins: Extract<CardModel, { kind: "timeline" }>["pins"][number][] = [];
  const seen: { key: string; at: number; date: string; bay: number }[] = [];
  placed.forEach((key, j) => {
    const d = itemOf(config, key)?.meta.printedDate;
    const at = d ? fracYearOf(d) : null;
    if (key && d && at !== null) seen.push({ key, at, date: d, bay: j });
  });
  // tier 0: date order, so the pin list itself never encodes the bay order
  if (lanes.length === 0) seen.sort((a, b) => a.at - b.at || a.date.localeCompare(b.date));
  for (const s of seen) {
    pins.push({ key: `item:${s.key}`, at: s.at, label: formatPrintedDate(s.date), lane: lanes.length ? `bay_${s.bay}` : null, style: "draft", spanTo: null });
  }
  const w = config.probe?.window ?? null;
  const ats = pins.map((p) => p.at);
  const from = w ? w.start : ats.length ? Math.floor(Math.min(...ats)) - 1 : 1950;
  const to = w ? w.end : ats.length ? Math.ceil(Math.max(...ats)) + 1 : 1970;
  const early = ats.filter((a) => a < from);
  return {
    kind: "timeline",
    slot,
    title: "FILE",
    tab: "FILE",
    from,
    to,
    unit: "year",
    lanes,
    pins,
    bands: [],
    arrows: [],
    axisBreak: early.length ? { from: Math.min(...early), to: from } : null,
    sr: `FILE: ${pins.length} printed ${pins.length === 1 ? "date" : "dates"} on the deck${lanes.length ? ", each joined to its bay" : ""}.`,
  };
}
function stepCards(config: StepBridgeConfig, view: unknown, record: boolean, aidTier: number, placed: readonly (string | null)[], stage: StagePose | null): CardModel[] {
  return stepLayout(config, record).map((c, slot): CardModel => {
    switch (c) {
      case "file":
        return stepFileCard(slot, config, placed, aidTier);
      case "rail":
        return railCard(slot, config, view, placed);
      case "circle":
        return unitCircleCard(slot, config, aidTier);
      case "relief":
        return reliefCard(slot, config, aidTier);
      case "pit":
        return pitCard(slot, stage, aidTier);
      case "atp":
        return atpCard(slot, config, placed, stage);
    }
  });
}

function stepPanelStatic(input: StaticInput<StepBridgeConfig>): PanelStatic {
  const { config, view } = input;
  const n = slotCountOf(view);
  const empty = Array.from({ length: n }, () => null);
  return {
    cards: stepCards(config, view, input.record, input.aidTier, empty, config.bays === "stage_rail" ? stagePoseAt(config, empty, 0) : null),
    input: null,
    probe: config.probe,
    recordPins: [], // step_bridge has no hint pins; RECORD's earned pins are the panel's (A6)
  };
}
function stepPanelLive(stat: PanelStatic, input: PoseInput<StepBridgeConfig, null>): PanelLive {
  const { config, view } = input;
  const record = recordFromStatic(stat, config);
  const layout = stepLayout(config, record);
  const n = slotCountOf(view);
  const placed = slotsOf(input.draft, n);
  const stage = config.bays === "stage_rail" ? stagePoseAt(config, placed, input.probe ?? 0) : null;
  const liveCards = stepCards(config, view, record, input.aidTier, placed, stage);
  const chips: PanelLive["chips"][number][] = [];
  const x = input.probe;
  const reliefSlot = layout.indexOf("relief");
  if (x !== null && reliefSlot >= 0 && config.relief) {
    const f = evalExpr(config.relief.expr, x);
    const g = evalExpr(config.relief.line, x);
    if (f !== null) chips.push({ slot: reliefSlot, value: f, text: fmtNum(f), color: "f" });
    if (g !== null) chips.push({ slot: reliefSlot, value: g, text: fmtNum(g), color: "g" });
  }
  const railSlot = layout.indexOf("rail");
  const highlights: PanelLive["highlights"][number][] = placed.flatMap((key, j) => (key ? [{ slot: railSlot, key: `slot_${j}`, state: "placed" as const }] : []));
  const focus = input.draft?.focus ?? input.draft?.hover ?? null;
  if (focus) highlights.push({ slot: railSlot, key: focus, state: input.draft?.focus ? "focus" : "hover" });
  let readout: string | null = null;
  if (x !== null && config.probe) {
    readout = formatProbe(x, config.probe);
    if (config.dayCounter) readout += ` · DAY ${dayCounterOf(x, config.dayCounter.epoch, config.dayCounter.max)}`;
  }
  return { scrubX: x, readout, chips, highlights, liveCards };
}

// ================================================================ hints, audio, plans

function stepHintTargets(rung: HintRung, input: StaticInput<StepBridgeConfig>): readonly HintTarget[] {
  const skin = skinById(STEP_BRIDGE_SKINS, input.skinId);
  const base = skin?.hintTargets[rung - 1] ?? [];
  const has = (a: string) => skin?.anchors.includes(a) ?? false;
  const extra: HintTarget[] = [];
  const c = input.config;
  if (rung === 2 && c.relief && has("lip_relief")) extra.push(ht("lip_relief", "circle", 2000));
  if (rung === 2 && c.dayCounter && has("day_counter")) extra.push(ht("day_counter", "land", 1800));
  if (rung === 1 && c.probeWorld === "bay_lamps" && has("arch_rail")) extra.push(ht("arch_rail", "ride", 2400));
  return withExtraTargets(base, extra);
}

function stepAudio(pose: StepBridgePose): AudioParam[] {
  if (pose.stage && pose.stage.k > 0 && !pose.solved) return [{ cue: "current_hum", pitch: 1 + 0.1 * pose.stage.k, gain: 0.05 }];
  return [];
}

const FAIL_CUE: Readonly<Record<StepBridgeConfig["bays"], string>> = { floating: "stone_grind", flat_road: "stone_grind", arch: "stone_grind", stage_rail: "pod_crack" };
const SUCCEED_CUE: Readonly<Record<StepBridgeConfig["bays"], string>> = { floating: "stone_lock_thunk", flat_road: "slab_set", arch: "stone_lock_thunk", stage_rail: "tube_whoosh" };
const TIP_DEG: Readonly<Record<StepBridgeConfig["bays"], number>> = { floating: 20, flat_road: 12, arch: 12, stage_rail: 0 };

function stepFailurePlan(d: Diagnosis, input: PoseInput<StepBridgeConfig, null>): FailurePlan {
  const { config, view } = input;
  const n = slotCountOf(view);
  const placed = slotsOf(input.draft, n);
  const beats: FailBeat[] = [];
  const A = (j: number) => bayAnchor(config.bays, j);
  const wrong = d.wrongKeys[0] ?? null;
  if (d.failKey === "order") {
    const p = clamp(d.prefix ?? 0, 0, n - 1);
    for (let j = 0; j < p; j++) beats.push({ atMs: j * 100, anchor: A(j), action: "hold_bright", params: { lock: 1, seam: "gold" } });
    if (config.bays === "floating" && config.anchors >= 2) {
      // one solution is not enough, visibly: x₁ glows faintly once the prefix covers step 2, x₂ stays dark and slack
      if (p >= 2) beats.push({ atMs: p * 100, anchor: "pylon_a", action: "flash", params: { glow: 0.4 } });
      beats.push({ atMs: p * 100, anchor: "pylon_b", action: "dim", params: { slack: 1 } });
    }
    if (config.bays === "stage_rail") {
      beats.push({ atMs: 0, anchor: "pit_center", action: "stall", params: { playTo: p + 1 } });
      beats.push({ atMs: 900, anchor: A(p), action: "jam", params: { slot: p } });
    } else {
      beats.push({ atMs: 400, anchor: A(p), action: "tip", params: { slot: p, deg: TIP_DEG[config.bays], key: wrong ?? "" } });
      beats.push({ atMs: 550, anchor: A(p), action: "grind", params: { slot: p } });
      beats.push({ atMs: 800, anchor: A(p), action: "sink", params: { slot: p } });
    }
    for (let j = p + 1; j < n; j++) beats.push({ atMs: 400, anchor: A(j), action: "dim", params: { alpha: 0.5 } });
  } else if (d.failKey === "decoy" && wrong !== null) {
    const j = placed.indexOf(wrong);
    const at = j >= 0 ? A(j) : "console";
    if (config.bays === "stage_rail") {
      beats.push({ atMs: 0, anchor: "pit_center", action: "stall", params: { playTo: j + 1 } });
      beats.push({ atMs: 700, anchor: "sub", action: "bounce", params: { rise: 0.2 } });
    } else {
      // post-Verify only: stepEffects' decoy effect (trig e4 missCircle) may play here (outside the no-leak scope)
      const effect = config.stepEffects.find((s) => s.key === wrong)?.effect ?? "";
      const circleSlot = stepLayout(config, false).indexOf("circle");
      beats.push({
        atMs: 200,
        anchor: at,
        action: config.bays === "arch" ? "sink" : "scatter",
        params: { slot: j, mode: config.bays === "floating" ? "crumble" : config.bays === "arch" ? "shorten" : "dissolve", cardEffect: effect, cardSlot: circleSlot },
      });
    }
  } else {
    const j = placed.indexOf(null);
    beats.push({ atMs: 0, anchor: A(Math.max(0, j)), action: "wobble", params: { amp: 3 } });
  }
  return { beats: beats.sort((a, b) => a.atMs - b.atMs), durationMs: config.bays === "floating" ? 1600 : 1400, cue: FAIL_CUE[config.bays] };
}

const EFFECT_CARD: Readonly<Record<z.infer<typeof StepEffect>, readonly CardId[]>> = {
  scaleEquation: ["relief"],
  markAngle: ["circle", "relief"],
  shadeQuadrants: ["circle"],
  markSolutions: ["relief"],
  missCircle: ["circle"],
};
const PAYOFF_ACTION: Readonly<Partial<Record<PayoffAnim, SuccessBeat["action"]>>> = {
  bridge_forms: "rise", stairs_rise: "rise", steps_emerge: "rise", ramp_forms: "rise", vesicle_carries: "ride",
};

function stepSuccessPlan(input: PoseInput<StepBridgeConfig, null>, anim: PayoffAnim): SuccessPlan {
  const { config, view } = input;
  const n = slotCountOf(view);
  const placed = slotsOf(input.draft, n);
  const layout = stepLayout(config, false);
  const beats: SuccessBeat[] = [];
  const cardEffects: SuccessPlan["cardEffects"][number][] = [];
  const A = (j: number) => bayAnchor(config.bays, j);
  const stepMs = config.bays === "floating" ? 500 : config.bays === "flat_road" ? 120 : config.bays === "arch" ? 150 : 500;
  let end: number;
  if (config.bays === "stage_rail") {
    beats.push({ atMs: 0, anchor: "pit_center", action: "cycle", params: { fromK: 0, toK: n, msPerStage: 500 } });
    placed.forEach((_, j) => beats.push({ atMs: j * 500, anchor: A(j), action: "ignite" }));
    beats.push({ atMs: 1000, anchor: "collar", action: "lock", params: { spark: "gold" } });
    end = n * 500;
  } else {
    placed.forEach((key, j) => {
      beats.push({ atMs: j * stepMs, anchor: A(j), action: "lock", params: { slot: j } });
      const eff = key ? config.stepEffects.find((s) => s.key === key) : undefined; // success-only
      if (eff && eff.effect !== "missCircle") {
        for (const card of EFFECT_CARD[eff.effect]) {
          const slot = layout.indexOf(card);
          if (slot >= 0) cardEffects.push({ atMs: j * stepMs, slot, effect: eff.effect, key });
        }
      }
    });
    end = n * stepMs;
    if (config.bays === "floating" && config.anchors > 0) {
      beats.push({ atMs: Math.max(0, end - stepMs), anchor: "pylon_a", action: "ignite" });
      if (config.anchors > 1) beats.push({ atMs: Math.max(0, end - stepMs) + 200, anchor: "pylon_b", action: "ignite" });
    }
    if (config.dayCounter) beats.push({ atMs: 0, anchor: "day_counter", action: "light_sequence", params: { from: 0, to: config.dayCounter.max, ms: end + 1200 } });
    if (config.bays === "flat_road") beats.push({ atMs: end + 600, anchor: "route_sign", action: "ignite" });
    if (config.bays === "arch") beats.push({ atMs: end + 100, anchor: "arch_rail", action: "light_sequence", params: { lamps: "bays_then_arch" } });
  }
  const payoffAt = Math.min(end + 200, 2200);
  beats.push({ atMs: payoffAt, anchor: config.bays === "stage_rail" ? "sub" : A(n - 1), action: PAYOFF_ACTION[anim] ?? "rise", params: { anim } });
  const durationMs = clamp(Math.max(end + 500, config.bays === "flat_road" ? 2200 : 1200), 1200, 2500);
  return { beats: beats.sort((a, b) => a.atMs - b.atMs), cardEffects, durationMs, cue: SUCCEED_CUE[config.bays] };
}

// ================================================================ geometry for the host

const FRAME: Readonly<Record<StepBridgeConfig["bays"], Bounds>> = {
  floating: { x: -960, y: -460, w: 1680, h: 780 }, // relief band (−940) … far pylons (+652); KA3
  flat_road: { x: -760, y: -520, w: 1520, h: 700 },
  arch: { x: -760, y: -700, w: 1520, h: 900 },
  stage_rail: { x: -720, y: -520, w: 1300, h: 900 },
};
function stepFootprint(config: StepBridgeConfig): Footprint2D {
  const f = FRAME[config.bays];
  return { left: Math.min(-f.x, 700), right: Math.min(f.x + f.w, 700), height: 260 };
}

function stepDebug(pose: StepBridgePose): Record<string, number | string | boolean> {
  const out: Record<string, number | string | boolean> = {
    bays: pose.bays,
    placed: pose.placed.map((k) => k ?? "_").join(","),
    filled: pose.placed.filter((k) => k !== null).length,
    complete: pose.complete,
    guide: pose.guide,
    bayLamps: pose.bayLamps.map((l) => (l >= 0.5 ? "1" : "0")).join(""),
    routeLamps: pose.routeLamps,
    markerY: pose.marker?.y ?? 0,
    markerValue: pose.marker?.value ?? 0,
    glint: pose.glint ?? -1,
    day: pose.day ?? -1,
    gate: pose.gate,
    solved: pose.solved,
  };
  if (pose.stage) {
    out.stageK = pose.stage.k;
    out.depth = pose.stage.depth;
    out.wrap = pose.stage.wrap;
    out.detached = pose.stage.detached;
    out.travel = pose.stage.travel;
    out.bounced = pose.stage.bounced;
    out.outcome = pose.stage.outcome ?? "";
  }
  return out;
}

// ================================================================ meta

export const stepBridgeMeta: ContraptionMeta<StepBridgeConfig, StepBridgePose> = {
  id: "step_bridge",
  name: "Step Bridge",
  modes: ["sequencer.linear"],
  tier: "native",
  status: "demo",
  reusable: "any_subject",
  layouts: ["board", "scrub"],
  defaultLayout: "board",
  payoffs: ["bridge_forms", "stairs_rise", "steps_emerge", "ramp_forms", "vesicle_carries"],
  nearMissKeys: [],
  accessories: ["record_lens"],
  skins: STEP_BRIDGE_SKINS,
  control: "slots",
  configSchema: StepBridgeConfig,
  validateConfig: (config, ctx) => validateStepBridge(config, ctx),
  defaultConfig(ctx: ConfigCtx): StepBridgeConfig {
    const items = plankKeysOf(ctx.view).map((key) => ({ key, meta: { printedDate: findDates(viewTextOf(ctx.view, key))[0] ?? null } }));
    const dated = items.filter((i) => i.meta.printedDate !== null);
    const years = dated.map((i) => Math.floor(fracYearOf(i.meta.printedDate!) ?? 0)).filter((y) => y > 0);
    const probe = dated.length >= 2 ? yearProbeFor(years) : null;
    return StepBridgeConfig.parse({
      bays: BIOME_BAYS[ctx.biome] ?? "floating",
      items,
      probe,
      probeWorld: probe ? "record_lens" : "none",
    });
  },
  writerConfigSchema: (ctx) => (ctx.itemKeys.length > 0 ? stepBridgeWriterSchema(ctx) : null),
  fromWriterConfig(w: unknown, ctx: ConfigCtx): StepBridgeConfig {
    const wc = w as StepBridgeWriter;
    const probe = probeFromWriter(wc.probe);
    return StepBridgeConfig.parse({
      bays: BIOME_BAYS[ctx.biome] ?? "floating",
      items: wc.items.map((i) => ({ key: i.key, meta: { printedDate: i.printedDate, glyph: i.glyph } })),
      stepEffects: wc.stepEffects,
      probe,
      probeWorld: probe && (probe.format === "year" || probe.format === "month_year") ? "record_lens" : "none",
    });
  },
  footprint: stepFootprint,
  frameBounds: (config) => FRAME[config.bays],
  probe: (config) => config.probe,
  clock: null,
  sim: null,
  pose: stepPose,
  lerp: lerpStepPose,
  describe: stepDescribe,
  panelStatic: stepPanelStatic,
  panelLive: stepPanelLive,
  hintTargets: stepHintTargets,
  audio: (pose) => stepAudio(pose),
  failurePlan: stepFailurePlan,
  successPlan: stepSuccessPlan,
  solvedPose: (input) => stepPose({ ...input, solved: true }),
  debug: stepDebug,
};

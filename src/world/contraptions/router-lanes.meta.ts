/**
 * router_lanes — sorter.bins (docs/design/20 §4 row 7, §4.2, §4.4, §7.4; cell §5.2, §5.6, §5.11; civil §5.8, §5.10).
 * Items drift, then queue at the chosen lane / maw / drawer: counts only, never correctness before Verify (§2.5.6);
 * the hydration lens at aid tier ≥ lensTier; the ATP projection; feature shutters (history); boss phases reveal
 * batches. KB1: the complete live half for EVERY skin — the contract KB2 (cell skins) and KC3 (civil skins) draw from.
 *
 * ## The pose contract (skins read these fields; coordinates are zone units relative to station.anchor, y DOWN)
 * - `items[]` in VIEW display order. `lane` is the config lane index the draft assigns (null = drifting); `q`/`n` its
 *   queue position and its lane's count; `x`/`y` the generic layout (drift in the tide, or the queue formula
 *   `x = X_lane + 56·(q − (n − 1)/2)`, `y = −90`). A skin with its own lane anchors may re-place a queued item with
 *   `queueX(anchor.x, q, n)`. `visible` is false for boss batches not yet revealed (`withBossPhases`).
 * - `lanes[]` in config order: `count` (the only number a lane ever shows), `open` (focus on that bin: maws part 12°,
 *   drawers pull out), `turn` (the claim-render ring turn: 30° per queued item), `meter` (the civil VU needle,
 *   −50° + 100°·count / items), `shutter` (feature plate: aid tier ≥ 1 in `shutters` configs, or solved), `energy`.
 * - `eyeAngle`/`eyeTracking`: the Gatekeeper pupil faces the focused item from `ROUTER_LAYOUT.eye` (recompute with
 *   `eyeAngleFor(eye, item)` from a skin anchor). `listenTurn`: the gate's inner ring turns 10° toward the newest item.
 * - `energy`: `{reserve, projected}` (the ATP card and the pipe); `pipeGlow = 0.2 + 0.1·nActive` (maws) and
 *   `intakeGlow = 0.2 + 0.15·nActive` (the Pump Gate).
 *
 * ## Dynamic anchors every router_lanes PoseView must expose (besides skin.anchors)
 * `lane_<i>` (lane i's mouth / maw / drawer, config order), `item_<key>` (the item's current position, updated in
 * applyPose), `energy` (the ATP port or pipe top) and `payoff` (what the success plan opens). describe() and the plans
 * use only these, because pose/describe/plans do not know the skin (PoseInput carries no skinId).
 */
import { z } from "zod";
import { asTuple } from "../../contracts/slices";
import type { HintTarget, PayoffAnim, ProbeSpec } from "../../contracts/world";
import { clamp01, lerp, lerpAngle } from "../ease";
import { fileCard, probeWindowOf, yearReadout, type TimelineCard, type TimelinePin } from "../record-strip";
import type {
  AidTier,
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
  HintTargetTable,
  PanelLive,
  PanelStatic,
  PoseInput,
  StaticInput,
  SuccessAction,
  SuccessBeat,
  SuccessPlan,
  WriterCtx,
} from "../types";
import {
  binIdsOf,
  coverExactlyOnce,
  dateAppearsIn,
  datePrecision,
  err,
  findDates,
  findYears,
  fracYearOf,
  itemKeysOf,
  probeRangeIssues,
  viewRows,
  viewTextOf,
  warn,
  yearProbeFor,
} from "./config-parts";
import { defineSkin } from "./skin-kit";
import { probeFromWriter, wDate, wProbe, type WriterProbe } from "./writer-kit";
import { RouterLanesConfig } from "./router-lanes.config";
export { RouterLanesConfig, ROUTER_LANES_SUCCESS_ONLY } from "./router-lanes.config";

// ---------------------------------------------------------------- skins (§4.3; hint flights from the game docs)

const ht = (anchor: string, action: HintTarget["action"], holdMs: number): HintTarget => ({ anchor, action, holdMs });

export const ROUTER_LANES_SKINS = [
  defineSkin({
    id: "membrane_router",
    name: "Crossing Gate",
    ns: "living_gate",
    nouns: ["gate", "Crossing Gate", "lane", "lanes", "oil road", "cargo", "rocker", "membrane"],
    parts: [
      ["crossing_gate", "H"], ["gate_fin", "H"], ["gate_ring_outer", "K"], ["gate_ring_inner", "K"], ["oil_road", "K"],
      ["molecule_glyph", "K"], ["carrier_rocker", "H"], ["lane_mouth", "K"], ["console", "K"],
    ],
    anchors: ["lane_diffuses", "lane_protein", "gate_ring", "rocker_pivot", "console"],
    cues: { live: null, succeed: "latch_clack", fail: "boing_soft" },
    // cell §5.2: rung 1 Pip flies to the gate ring (lens on), rung 2 hovers over the Oil Road, rung 3 circles the gate lane
    hintTargets: [[ht("gate_ring", "hover", 1800)], [ht("lane_diffuses", "hover", 1800)], [ht("lane_protein", "circle", 2000)]],
  }),
  defineSkin({
    id: "carrier_lanes",
    name: "Carrier Door",
    ns: "living_gate",
    nouns: ["door", "Carrier Door", "lane", "lanes", "cargo", "pump gate", "threshold"],
    parts: [["carrier_door", "H"], ["glide_gate", "K"], ["pump_gate", "H"], ["ramp_wedge", "K"], ["cargo_glyph", "K"], ["console", "K"]],
    anchors: ["lane_passive", "lane_active", "door_pocket", "atp_port", "console"],
    cues: { live: null, succeed: "latch_clack", fail: "boing_soft" },
    // cell §5.6: circles the Glide Gate's ramp, hovers at the ATP port, lands on the Pump Gate lane
    hintTargets: [[ht("lane_passive", "circle", 1800)], [ht("atp_port", "hover", 1800)], [ht("lane_active", "land", 2000)]],
  }),
  defineSkin({
    id: "gatekeeper_maws",
    name: "Gatekeeper",
    ns: "living_gate",
    nouns: ["Gatekeeper", "maw", "maws", "vault", "cargo", "eye"],
    parts: [
      ["gatekeeper_body", "H"], ["maw_oil", "H"], ["maw_channel", "H"], ["maw_pump", "H"], ["eye_ring", "H"], ["eye_pupil", "K"],
      ["atp_pipe", "K"], ["cargo_glyph", "K", "living_gate.part.carrier_lanes_cargo_glyph"], ["console", "K"],
    ],
    anchors: ["maw_simple", "maw_facilitated", "maw_active", "eye", "pipe_top", "console"],
    cues: { live: null, succeed: "gatekeeper_rumble", fail: "boing_soft" },
    // cell §5.11: flies to the eye (lens on), hovers at the Pump Maw, circles the pipe top
    hintTargets: [[ht("eye", "hover", 1800)], [ht("maw_active", "hover", 1800)], [ht("pipe_top", "circle", 2000)]],
  }),
  defineSkin({
    id: "filing_cabinets",
    name: "Filing Cabinets",
    ns: "archive_of_voices",
    nouns: ["cabinets", "cabinet", "drawer", "drawers", "files", "slips", "stairwell"],
    parts: [["cabinet", "K"], ["meter", "K"], ["shutter", "K"], ["slip", "K"], ["pneumatic_drop", "K"], ["stairwell", "K"], ["console", "K"]],
    anchors: ["drawer_0…1", "meter_0…1", "shutter_0…1", "table", "stairwell", "console"],
    cues: { live: null, succeed: "drawer_thunk", fail: "drawer_thunk" },
    sensitiveSafe: true,
    // civil §5.8: rung 1 circles both shutters, rung 2 the meters, rung 3 hovers over the sorting table
    hintTargets: [
      [ht("shutter_0", "circle", 1500), ht("shutter_1", "circle", 1500)],
      [ht("meter_0", "circle", 1500), ht("meter_1", "circle", 1500)],
      [ht("table", "hover", 2000)],
    ],
  }),
  defineSkin({
    id: "provenance_drawers",
    name: "Provenance Drawers",
    ns: "archive_of_voices",
    nouns: ["drawers", "drawer", "stacks", "shelving", "documents", "sources"],
    parts: [
      ["document", "H"], ["compact_shelving", "K"], ["crank", "K"],
      ["meter", "K", "archive_of_voices.part.filing_cabinets_meter"], ["shutter", "K", "archive_of_voices.part.filing_cabinets_shutter"],
      ["console", "K"],
    ],
    anchors: ["drawer_0…1", "meter_0…1", "shutter_0…1", "table", "console"],
    cues: { live: null, succeed: "drawer_thunk", fail: "drawer_thunk" },
    sensitiveSafe: true,
    // civil §5.10: rung 1 circles the shutters (the events band appears), rung 2 the spilled documents, rung 3 drawer 0
    hintTargets: [
      [ht("shutter_0", "circle", 1500), ht("shutter_1", "circle", 1500)],
      [ht("table", "circle", 1800)],
      [ht("drawer_0", "hover", 2000)],
    ],
  }),
] as const;

// ---------------------------------------------------------------- config half (W0, unchanged)

const DOWN_WORDS = /\b(high\s*(?:→|->|to)\s*low|down\s+(?:its|the|a)\s+gradient|downhill)\b/i;
const UP_WORDS = /\b(against|pumped|uphill|low\s*(?:→|->|to)\s*high)\b/i;

export function validateRouterLanes(config: RouterLanesConfig, ctx: ConfigCtx): ConfigIssue[] {
  const out: ConfigIssue[] = [];
  out.push(...coverExactlyOnce(["items"], "item key", itemKeysOf(ctx.view), config.items.map((i) => i.key)));
  out.push(...coverExactlyOnce(["lanes"], "bin id", binIdsOf(ctx.view), config.lanes.map((l) => l.binId)));
  config.items.forEach((it, i) => {
    const text = viewTextOf(ctx.view, it.key);
    if (it.meta.printedDate !== null && !dateAppearsIn([text], it.meta.printedDate)) {
      out.push(err(["items", i, "meta", "printedDate"], `printed date ${it.meta.printedDate} does not appear in "${text}"`));
    }
    if (it.meta.madeYear !== null && !findYears(text).includes(it.meta.madeYear)) {
      out.push(err(["items", i, "meta", "madeYear"], `made year ${it.meta.madeYear} does not appear in "${text}"`));
    }
    if (it.from !== null && it.to !== null) {
      if (DOWN_WORDS.test(text) && !(it.from > it.to)) out.push(warn(["items", i], "the text says down the gradient, so from should exceed to"));
      if (UP_WORDS.test(text) && !(it.from < it.to)) out.push(warn(["items", i], "the text says against the gradient, so from should be below to"));
    }
  });
  if (config.eventsBand) {
    for (const d of [config.eventsBand.from, config.eventsBand.to]) {
      if (!dateAppearsIn(ctx.texts, d)) out.push(err(["eventsBand"], `events band date ${d} does not appear in the encounter texts`));
    }
  }
  out.push(...probeRangeIssues(["probe"], config.probe));
  if (config.probeWorld === "record_lens" && !config.probe) out.push(err(["probeWorld"], "record_lens needs a probe"));
  return out;
}

interface RouterLanesWriter {
  items: { key: string; printedDate: string | null; madeYear: number | null; polar: boolean | null; charged: boolean | null; from: number | null; to: number | null }[];
  probe: WriterProbe | null;
}

export function routerLanesWriterSchema(ctx: WriterCtx) {
  return z.object({
    items: z
      .array(
        z.object({
          key: z.enum(asTuple(ctx.itemKeys, "item keys")),
          printedDate: wDate().nullable(),
          madeYear: z.number().int().min(1000).max(2100).nullable(),
          polar: z.boolean().nullable(),
          charged: z.boolean().nullable(),
          from: z.number().int().min(0).max(10).nullable(),
          to: z.number().int().min(0).max(10).nullable(),
        }),
      )
      .min(ctx.itemKeys.length)
      .max(ctx.itemKeys.length),
    probe: wProbe(),
  });
}

function defaultLanes(view: unknown) {
  return binIdsOf(view).map((binId) => ({ binId, laneId: binId }));
}

// ---------------------------------------------------------------- layout constants and small pure helpers

/** The generic layout every skin can start from (zone units, relative to station.anchor = ground under the yard). */
export const ROUTER_LAYOUT = {
  laneSpacing: 420, // lane mouths, centred on the anchor
  queueY: -90, // cell §5.2: queue above the lane mouth
  queueSpacing: 56, // cell §5.2: 56·(q − (n − 1)/2)
  driftSpacing: 150, // cell §5.2: 150 per display index
  driftY: -300,
  driftAmpX: 20,
  driftAmpY: 16,
  eye: { x: 0, y: -700 }, // the Gatekeeper's eye-ring (skins pass their own anchor to eyeAngleFor)
  mawOpenDeg: 12, // cell §5.11: a focused maw's jaw plates part 12°
  ringTurnDeg: 30, // cell §5.11: the Channel Maw's ring turns 30° per queued item
  listenDeg: 10, // cell §5.2: the gate ring turns 10° toward the newest queued molecule
  meterMinDeg: -50,
  meterSpanDeg: 100, // civil §5.8: needle = −50° + 100°·count / items
} as const;

export const laneAnchor = (index: number): string => `lane_${index}`;
export const itemAnchor = (key: string): string => `item_${key}`;
export const ENERGY_ANCHOR = "energy";
export const PAYOFF_ANCHOR = "payoff";

/** X of lane i of n lanes in the generic layout. */
export function laneX(index: number, laneCount: number): number {
  return ROUTER_LAYOUT.laneSpacing * (index - (laneCount - 1) / 2);
}
/** The queue formula (cell §5.2): x = X_lane + 56·(q − (n − 1)/2). */
export function queueX(laneCenterX: number, q: number, n: number): number {
  return laneCenterX + ROUTER_LAYOUT.queueSpacing * (q - (n - 1) / 2);
}
/** Drift in the tide for display index k of N (cell §5.2 formula, centred on the anchor); reduced motion holds still. */
export function driftXY(k: number, count: number, t: number, reducedMotion: boolean): { x: number; y: number } {
  const L = ROUTER_LAYOUT;
  const wobble = reducedMotion ? 0 : 1;
  return {
    x: L.driftSpacing * (k - (count - 1) / 2) + wobble * L.driftAmpX * Math.sin(0.6 * t + k),
    y: L.driftY + wobble * L.driftAmpY * Math.sin(0.9 * t + 2 * k),
  };
}
/** The pupil angle from an eye position to a target: atan2(target.y − eye.y, target.x − eye.x) (y down). */
export function eyeAngleFor(eye: { x: number; y: number }, target: { x: number; y: number }): number {
  return Math.atan2(target.y - eye.y, target.x - eye.x);
}
/** Pipe glow for n active cargo with a per-cargo coefficient (maws 0.1, the Pump Gate 0.15), capped at 1. */
export function intakeGlow(nActive: number, perItem = 0.1): number {
  return clamp01(0.2 + perItem * nActive);
}

/** The draft's assignments, last write per item wins (a moved item goes to the END of its new queue). */
export function assignmentsOf(draft: Draft | null): { itemKey: string; binId: string }[] {
  const input = draft?.input as { assignments?: unknown } | null | undefined;
  const list = Array.isArray(input?.assignments) ? (input.assignments as unknown[]) : [];
  const map = new Map<string, string>();
  for (const a of list) {
    if (!a || typeof a !== "object") continue;
    const { itemKey, binId } = a as { itemKey?: unknown; binId?: unknown };
    if (typeof itemKey !== "string" || typeof binId !== "string") continue;
    map.delete(itemKey);
    map.set(itemKey, binId);
  }
  return [...map].map(([itemKey, binId]) => ({ itemKey, binId }));
}

/**
 * The lane whose cargo spends ATP when `energy` is configured: the first lane whose laneId or binId names a pump,
 * active transport or ATP (cell: `pump_gate`, `pump_maw`, bin `active`), else the last lane. null without energy.
 */
export function energyLaneIndex(config: Pick<RouterLanesConfig, "energy" | "lanes">): number | null {
  if (!config.energy) return null;
  const i = config.lanes.findIndex((l) => /pump|active|atp/.test(l.laneId) || /pump|active|atp/.test(l.binId));
  return i >= 0 ? i : config.lanes.length - 1;
}

/** "OIL ROAD: 3" / "3 FILED": a lane chip carries its COUNT only, never a capacity (R2, §2.5.6). */
export function laneChipText(lane: { laneId: string }, count: number): string {
  if (/^drawer_\d+$/.test(lane.laneId)) return `${count} FILED`;
  return `${lane.laneId.replace(/_/g, " ").toUpperCase()}: ${count}`;
}

// ---------------------------------------------------------------- boss phases (amendment 18: presentation only)

export interface BossPhaseLike {
  id: string;
  itemKeys: readonly string[];
}
export interface BossBatchState {
  /** item keys the panel and the world show now (items outside every phase are always shown) */
  visibleKeys: readonly string[];
  /** index of the newest revealed batch (−1 without phases) */
  batch: number;
  batches: number;
  allVisible: boolean;
  /** every VISIBLE item is placed (the RouterControl's per-batch readiness) */
  batchPlaced: boolean;
}

/**
 * Which batches are revealed: batch i + 1 appears once every item of batches 0…i is placed; a batch that already has
 * a placed item stays revealed (placements can move, and un-filing never hides cargo already on the board).
 */
export function bossBatchState(phases: readonly BossPhaseLike[], placedKeys: Iterable<string>, allItemKeys: readonly string[] = []): BossBatchState {
  const placed = new Set(placedKeys);
  const phased = new Set(phases.flatMap((p) => p.itemKeys));
  const loose = allItemKeys.filter((k) => !phased.has(k));
  if (phases.length === 0) {
    return { visibleKeys: [...allItemKeys], batch: -1, batches: 0, allVisible: true, batchPlaced: allItemKeys.every((k) => placed.has(k)) };
  }
  let revealed = 1;
  for (let i = 0; i < phases.length - 1; i++) {
    if (phases.slice(0, i + 1).every((p) => p.itemKeys.every((k) => placed.has(k)))) revealed = i + 2;
    else break;
  }
  phases.forEach((p, i) => {
    if (p.itemKeys.some((k) => placed.has(k))) revealed = Math.max(revealed, i + 1);
  });
  const visibleKeys = [...loose, ...phases.slice(0, revealed).flatMap((p) => p.itemKeys)];
  return {
    visibleKeys,
    batch: revealed - 1,
    batches: phases.length,
    allVisible: revealed === phases.length,
    batchPlaced: visibleKeys.every((k) => placed.has(k)),
  };
}

/** Verify enables only when EVERY item of the view is assigned (boss phases included: one Input, one grade()). */
export function routerDraftComplete(itemKeys: readonly string[], assignments: readonly { itemKey: string; binId: string }[], binIds?: readonly string[]): boolean {
  const bins = binIds ? new Set(binIds) : null;
  const given = new Set(assignments.filter((a) => !bins || bins.has(a.binId)).map((a) => a.itemKey));
  return itemKeys.length > 0 && itemKeys.every((k) => given.has(k));
}

/** The pose with boss batches applied (the prefab or controller calls this with station.boss.phases). */
export function withBossPhases(pose: RouterLanesPose, phases: readonly BossPhaseLike[]): RouterLanesPose {
  if (phases.length === 0) return pose;
  const st = bossBatchState(
    phases,
    pose.items.filter((i) => i.lane !== null).map((i) => i.key),
    pose.items.map((i) => i.key),
  );
  const show = new Set(st.visibleKeys);
  return {
    ...pose,
    items: pose.items.map((i) => ({ ...i, visible: i.visible && show.has(i.key) })),
    batch: st.batch,
    batches: st.batches,
  };
}

// ---------------------------------------------------------------- the pose

export interface RouterItemPose {
  key: string;
  display: number; // index in view.items (display order)
  label: string; // meta.label, else the view text (≤ 24 chars): the focus chip
  glyph: string | null; // meta.glyph (what the item IS, never where it belongs)
  lane: number | null; // config lane index the draft assigns; null = drifting in the tide
  q: number; // queue position in its lane (0 when drifting)
  n: number; // its lane's count (0 when drifting)
  x: number;
  y: number;
  visible: boolean;
  focus: boolean;
  newest: boolean; // the most recently placed item
  shell: number; // hydration shell alpha: 1 when the lens is on and the item is polar or charged
  ramp: number | null; // gradient ramp slope m = (to − from)/10 as the text states; null = a flat plinth
  stampYear: number | null; // made-year stamp once filed (stamp: made_year)
  passed: number; // 0 → 1 once solved: the item has gone through its lane
}
export interface RouterLanePose {
  binId: string;
  laneId: string;
  index: number;
  x: number;
  count: number;
  open: number; // 0..1: focus on this bin (a maw's jaws part 12°, a drawer pulls out)
  turn: number; // radians: the claim-render ring turn (30° per queued item)
  meter: number; // degrees: −50 + 100·count / items
  shutter: number; // 0 closed … 1 open (feature plate visible)
  energy: boolean; // this lane spends ATP
  year: number | null; // civil lane year (the FILE card pins filed slips there)
}
export interface RouterLanesPose {
  items: RouterItemPose[];
  lanes: RouterLanePose[];
  placed: number;
  total: number;
  complete: boolean; // every item assigned (Verify)
  focusKey: string | null; // the focused item key
  focusLane: number | null; // the focused bin's lane index
  lens: number; // Pip's hydration lens 0/1
  rampArrows: boolean; // slope arrows on the ramps (aid tier ≥ 1 without a lens, ≥ 2 with one)
  eyeAngle: number; // radians (π/2 = looking down at the console)
  eyeTracking: boolean;
  listenTurn: number; // radians, ± 10° toward the newest item
  energy: { reserve: number; projected: number } | null;
  activeCount: number; // items in the energy lane
  pipeGlow: number; // 0.2 + 0.1·nActive (0 without energy)
  intakeGlow: number; // 0.2 + 0.15·nActive (0 without energy)
  batch: number; // boss: newest revealed batch (−1 without phases)
  batches: number;
  probe: number | null; // the year cursor (record lens)
  gate: number; // payoff 0 … 1 (1 when solved; the W0 stub skins read this)
  solved: boolean;
}

interface ViewItem {
  key: string;
  text: string;
}

function viewItems(view: unknown): ViewItem[] {
  return viewRows(view, "items");
}
function binLabels(view: unknown): Map<string, string> {
  return new Map(viewRows(view, "bins", "id", "label").map((r) => [r.key, r.text]));
}
function shortLabel(text: string): string {
  const t = text.trim();
  return t.length <= 24 ? t : `${t.slice(0, 23).trimEnd()}…`;
}

function computePose(input: PoseInput<RouterLanesConfig, null>): RouterLanesPose {
  const { config, view, draft, aidTier, t, reducedMotion, solved } = input;
  const items = viewItems(view);
  const byKey = new Map(config.items.map((c) => [c.key, c]));
  const laneOf = new Map(config.lanes.map((l, i) => [l.binId, i]));
  const L = config.lanes.length;
  const energyLane = energyLaneIndex(config);

  // queues per lane, in the draft's order
  const queues: string[][] = config.lanes.map(() => []);
  const itemSet = new Set(items.map((i) => i.key));
  const assignments = assignmentsOf(draft).filter((a) => itemSet.has(a.itemKey) && laneOf.has(a.binId));
  for (const a of assignments) queues[laneOf.get(a.binId)!]!.push(a.itemKey);
  const laneIdx = new Map<string, number>();
  queues.forEach((q, i) => q.forEach((k) => laneIdx.set(k, i)));
  const newestKey = assignments.at(-1)?.itemKey ?? null;

  const focus = draft?.focus ?? null;
  const focusKey = focus !== null && itemSet.has(focus) ? focus : null;
  const focusLane = focus !== null ? config.lanes.findIndex((l) => l.binId === focus || l.laneId === focus) : -1;
  const lensOn = config.lens === "hydration" && aidTier >= config.lensTier;

  const poseItems: RouterItemPose[] = items.map((vi, k) => {
    const c = byKey.get(vi.key);
    const lane = laneIdx.get(vi.key) ?? null;
    const queue = lane === null ? [] : queues[lane]!;
    const q = lane === null ? 0 : queue.indexOf(vi.key);
    const n = queue.length;
    const pos = lane === null ? driftXY(k, items.length, t, reducedMotion) : { x: queueX(laneX(lane, L), q, n), y: ROUTER_LAYOUT.queueY };
    const polarOrCharged = c?.polar === true || c?.charged === true;
    const ramp = c && c.from !== null && c.to !== null ? (c.to - c.from) / 10 : null;
    return {
      key: vi.key,
      display: k,
      label: c?.meta.label ?? shortLabel(vi.text),
      glyph: c?.meta.glyph ?? null,
      lane,
      q,
      n,
      x: pos.x,
      y: pos.y,
      visible: true,
      focus: vi.key === focusKey,
      newest: vi.key === newestKey,
      shell: lensOn && polarOrCharged ? 1 : 0,
      ramp,
      stampYear: config.stamp === "made_year" && lane !== null ? (c?.meta.madeYear ?? null) : null,
      passed: solved ? 1 : 0,
    };
  });

  const shutterOpen = solved || (config.shutters && aidTier >= 1) ? 1 : 0;
  const total = poseItems.length;
  const lanes: RouterLanePose[] = config.lanes.map((l, i) => {
    const count = queues[i]!.length;
    return {
      binId: l.binId,
      laneId: l.laneId,
      index: i,
      x: laneX(i, L),
      count,
      open: i === focusLane ? 1 : 0,
      turn: (count * ROUTER_LAYOUT.ringTurnDeg * Math.PI) / 180,
      meter: ROUTER_LAYOUT.meterMinDeg + (ROUTER_LAYOUT.meterSpanDeg * count) / Math.max(1, total),
      shutter: config.shutters ? shutterOpen : 0,
      energy: i === energyLane,
      year: l.year,
    };
  });

  const activeCount = energyLane === null ? 0 : queues[energyLane]!.length;
  const focusItem = poseItems.find((i) => i.focus) ?? null;
  const newest = poseItems.find((i) => i.newest) ?? null;
  const placed = poseItems.filter((i) => i.lane !== null).length;
  return {
    items: poseItems,
    lanes,
    placed,
    total,
    complete: total > 0 && placed === total,
    focusKey,
    focusLane: focusLane >= 0 ? focusLane : null,
    lens: lensOn ? 1 : 0,
    rampArrows: poseItems.some((i) => i.ramp !== null) && aidTier >= (config.lens === "hydration" ? 2 : 1),
    eyeAngle: focusItem ? eyeAngleFor(ROUTER_LAYOUT.eye, focusItem) : Math.PI / 2,
    eyeTracking: focusItem !== null,
    listenTurn: newest ? ((newest.x >= 0 ? 1 : -1) * ROUTER_LAYOUT.listenDeg * Math.PI) / 180 : 0,
    energy: config.energy ? { reserve: config.energy.reserve, projected: Math.min(config.energy.reserve, activeCount) } : null,
    activeCount,
    pipeGlow: config.energy ? intakeGlow(activeCount, 0.1) : 0,
    intakeGlow: config.energy ? intakeGlow(activeCount, 0.15) : 0,
    batch: -1,
    batches: 0,
    probe: input.probe,
    gate: solved ? 1 : 0,
    solved,
  };
}

function lerpPose(from: RouterLanesPose, to: RouterLanesPose, t: number): RouterLanesPose {
  const snap = t >= 0.5;
  const fromItems = new Map(from.items.map((i) => [i.key, i]));
  const fromLanes = new Map(from.lanes.map((l) => [l.binId, l]));
  return {
    ...(snap ? to : from),
    items: to.items.map((b) => {
      const a = fromItems.get(b.key) ?? b;
      return {
        ...(snap ? b : a),
        key: b.key,
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        shell: lerp(a.shell, b.shell, t),
        passed: lerp(a.passed, b.passed, t),
      };
    }),
    lanes: to.lanes.map((b) => {
      const a = fromLanes.get(b.binId) ?? b;
      return {
        ...(snap ? b : a),
        binId: b.binId,
        x: lerp(a.x, b.x, t),
        open: lerp(a.open, b.open, t),
        turn: lerp(a.turn, b.turn, t),
        meter: lerp(a.meter, b.meter, t),
        shutter: lerp(a.shutter, b.shutter, t),
      };
    }),
    lens: lerp(from.lens, to.lens, t),
    eyeAngle: lerpAngle(from.eyeAngle, to.eyeAngle, t),
    listenTurn: lerp(from.listenTurn, to.listenTurn, t),
    pipeGlow: lerp(from.pipeGlow, to.pipeGlow, t),
    intakeGlow: lerp(from.intakeGlow, to.intakeGlow, t),
    gate: lerp(from.gate, to.gate, t),
  };
}

function describePose(pose: RouterLanesPose, view: unknown): Described {
  const chips: ChipSpec[] = pose.lanes.map((l) => ({ anchor: laneAnchor(l.index), text: laneChipText(l, l.count), color: "f" }));
  const focus = pose.items.find((i) => i.focus && i.visible);
  if (focus) chips.push({ anchor: itemAnchor(focus.key), text: focus.label, color: "accent" });
  if (pose.energy && pose.energy.projected > 0) chips.push({ anchor: ENERGY_ANCHOR, text: `ATP −${pose.energy.projected}`, color: "gold" });
  const labels = binLabels(view);
  const laneWords = pose.lanes.map((l) => `${labels.get(l.binId) ?? l.laneId.replace(/_/g, " ")} holds ${l.count}`).join(", ");
  const drifting = pose.items.filter((i) => i.visible && i.lane === null).length;
  const srText = pose.solved
    ? "Every item has passed through its lane; the way is open."
    : pose.placed === 0
      ? `Nothing is queued yet; ${drifting} item${drifting === 1 ? "" : "s"} drift above the lanes.`
      : `${laneWords}; ${drifting} still drifting.${focus ? ` Focused: ${focus.label}.` : ""}`;
  return { chips, pins: [], srText, nearMiss: null };
}

// ---------------------------------------------------------------- panel

function fileNeeded(config: RouterLanesConfig, record: boolean): boolean {
  const yearProbe = config.probe !== null && (config.probe.format === "year" || config.probe.format === "month_year");
  return record || yearProbe || config.items.some((i) => i.meta.printedDate !== null || i.meta.madeYear !== null);
}

interface Slots {
  file: number | null;
  atp: number | null;
}
function slotsOf(config: RouterLanesConfig, record: boolean): Slots {
  let n = 0;
  const file = fileNeeded(config, record) ? n++ : null;
  const atp = config.energy ? n++ : null;
  return { file, atp };
}

function eventsBandOf(config: RouterLanesConfig, aidTier: AidTier): TimelineCard["bands"] {
  const b = config.eventsBand;
  if (!b || aidTier < config.eventsBandTier) return [];
  const from = fracYearOf(b.from);
  const to0 = fracYearOf(b.to);
  if (from === null || to0 === null) return [];
  const prec = datePrecision(b.to);
  const to = to0 + (prec === "year" ? 1 : prec === "month" ? 1 / 12 : 0);
  return [{ from, to, label: b.label, color: "h" }];
}

function staticFilePins(config: RouterLanesConfig, view: unknown): TimelinePin[] {
  const out: TimelinePin[] = [];
  for (const it of config.items) {
    const at = it.meta.printedDate ? fracYearOf(it.meta.printedDate) : null;
    if (at === null) continue;
    out.push({ key: `printed:${it.key}`, at, label: it.meta.label ?? shortLabel(viewTextOf(view, it.key)), lane: null, style: "dim", spanTo: null });
  }
  return out;
}

function buildFileCard(config: RouterLanesConfig, view: unknown, aidTier: AidTier, slot: number, filed: readonly TimelinePin[]): TimelineCard {
  const labels = binLabels(view);
  const window = probeWindowOf(config.probe);
  const card = fileCard({ slot, window, marks: [], pins: [...staticFilePins(config, view), ...filed] });
  const bands = [...card.bands, ...eventsBandOf(config, aidTier)];
  const lanes = config.lanes.map((l) => ({ id: l.binId, label: labels.get(l.binId) ?? l.binId }));
  const byLane = config.lanes
    .map((l) => `${labels.get(l.binId) ?? l.binId}: ${filed.filter((p) => p.lane === l.binId).length} filed`)
    .join("; ");
  const band = bands.length ? ` Shaded: ${bands.map((b) => b.label).join(", ")}.` : "";
  return { ...card, lanes, bands, sr: `FILE. ${byLane}.${band}` };
}

/** FILE pins for filed items: at the lane's year (e8) or, with stamp made_year, the item's made year (e10). */
function filedPins(config: RouterLanesConfig, pose: RouterLanesPose): TimelinePin[] {
  const byKey = new Map(config.items.map((c) => [c.key, c]));
  const out: TimelinePin[] = [];
  for (const it of pose.items) {
    if (it.lane === null || !it.visible) continue;
    const lane = config.lanes[it.lane]!;
    const made = config.stamp === "made_year" ? (byKey.get(it.key)?.meta.madeYear ?? null) : null;
    const at = made !== null ? made + 0.5 : lane.year;
    if (at === null) continue;
    out.push({ key: `filed:${it.key}`, at, label: it.label, lane: lane.binId, style: it.focus ? "focus" : "draft", spanTo: null });
  }
  return out;
}

function energyCard(config: RouterLanesConfig, slot: number, projected: number): CardModel {
  const reserve = config.energy?.reserve ?? 0;
  return {
    kind: "energy_cells",
    slot,
    title: "ATP",
    total: reserve,
    spent: 0,
    projected,
    sr: projected > 0 ? `ATP: ${reserve} cells; your routing would spend ${projected}.` : `ATP: ${reserve} cells; nothing would be spent yet.`,
  };
}

function panelStaticOf(input: StaticInput<RouterLanesConfig>): PanelStatic {
  const { config, view, aidTier } = input;
  const slots = slotsOf(config, input.record);
  const cards: CardModel[] = [];
  if (slots.file !== null) cards.push(buildFileCard(config, view, aidTier, slots.file, []));
  if (slots.atp !== null) cards.push(energyCard(config, slots.atp, 0));
  return { cards, input: null, probe: config.probe, recordPins: [] };
}

function panelLiveOf(stat: PanelStatic, input: PoseInput<RouterLanesConfig, null>): PanelLive {
  const { config } = input;
  const pose = computePose(input);
  const fileSlot = stat.cards.find((c) => c.kind === "timeline")?.slot ?? null;
  const atpSlot = stat.cards.find((c) => c.kind === "energy_cells")?.slot ?? null;
  const liveCards: CardModel[] = [];
  const highlights: PanelLive["highlights"][number][] = [];
  const chips: PanelLive["chips"][number][] = [];
  if (fileSlot !== null) {
    const filed = filedPins(config, pose);
    liveCards.push(buildFileCard(config, input.view, input.aidTier, fileSlot, filed));
    for (const p of filed) highlights.push({ slot: fileSlot, key: p.key, state: p.style === "focus" ? "focus" : "placed" });
  }
  if (atpSlot !== null && pose.energy) {
    liveCards.push(energyCard(config, atpSlot, pose.energy.projected));
    chips.push({ slot: atpSlot, value: pose.energy.projected, text: `−${pose.energy.projected}`, color: "gold" });
  }
  const probe = config.probe;
  const readout = probe ? (yearReadout(probe.format, input.probe) ?? formatProbeValue(probe, input.probe)) : null;
  return { scrubX: probe ? input.probe : null, readout, chips, highlights, liveCards };
}

function formatProbeValue(probe: ProbeSpec, v: number | null): string | null {
  if (v === null || !Number.isFinite(v)) return null;
  const txt = probe.format === "integer" || probe.format === "stage" ? String(Math.round(v)) : String(Math.round(v * 100) / 100);
  return probe.unit ? `${txt} ${probe.unit}` : txt;
}

// ---------------------------------------------------------------- hints

function hintTargetsOf(rung: HintRung, input: StaticInput<RouterLanesConfig>): readonly HintTarget[] {
  const skin = ROUTER_LANES_SKINS.find((s) => s.id === input.skinId) ?? ROUTER_LANES_SKINS[0];
  const table: HintTargetTable = skin.hintTargets;
  const base = [...(table[rung - 1] ?? [])];
  // shutters open at tier 1, so rung 1 always visits every shutter the skin has (config-driven, A7)
  if (rung === 1 && input.config.shutters) {
    input.config.lanes.forEach((_, i) => {
      const a = `shutter_${i}`;
      if (skin.anchors.includes(a) && !base.some((h) => h.anchor === a)) base.push(ht(a, "circle", 1500));
    });
  }
  return base;
}

// ---------------------------------------------------------------- outcomes

const SENSITIVE_CUE = "drawer_thunk";

function isMawLane(lane: { laneId: string } | undefined): boolean {
  return lane !== undefined && /maw/.test(lane.laneId);
}

/**
 * The failure plan acts on `wrongKeys[0]` ONLY (the item grade() names), using where the player put it:
 *   drawers (shutters) → it bounces back to the table and ONLY the disclosed bin's shutter opens;
 *   a maw lane → it is spat back (a 4 px, 200 ms rumble); the energy lane → the ATP spark fizzles and it rolls away;
 *   a non-energy lane of an energy config → it creeps up, stalls and slides back;
 *   otherwise polar/charged cargo bounces off the heads and nonpolar cargo is refused by the ring (eject).
 * `incomplete` (Verify normally prevents it) flashes the console.
 */
function failurePlanOf(d: Diagnosis, input: PoseInput<RouterLanesConfig, null>): FailurePlan {
  const { config } = input;
  const cue = config.shutters ? SENSITIVE_CUE : "boing_soft";
  const key = d.wrongKeys[0];
  if (d.failKey !== "wrong_bin" || key === undefined) {
    return { beats: [{ atMs: 0, anchor: "console", action: "flash" }], durationMs: 700, cue };
  }
  const pose = computePose(input);
  const item = pose.items.find((i) => i.key === key);
  const laneIndex = item?.lane ?? null;
  const lane = laneIndex === null ? undefined : config.lanes[laneIndex];
  const cfg = config.items.find((i) => i.key === key);
  const at = itemAnchor(key);
  const la = laneIndex === null ? "console" : laneAnchor(laneIndex);
  const beats: FailBeat[] = [];
  if (config.shutters) {
    beats.push({ atMs: 0, anchor: at, action: "bounce", params: { to: "table" } });
    const disclosed = typeof d.disclosed.bin === "string" ? config.lanes.findIndex((l) => l.binId === d.disclosed.bin) : -1;
    if (disclosed >= 0) beats.push({ atMs: 350, anchor: `shutter_${disclosed}`, action: "flash", params: { shutter: "open", lane: disclosed } });
  } else if (isMawLane(lane)) {
    beats.push({ atMs: 0, anchor: la, action: "flash" });
    beats.push({ atMs: 120, anchor: at, action: "spit_back", params: { shakePx: 4, shakeMs: 200, bubbles: 1 } });
  } else if (config.energy && lane !== undefined && pose.lanes[laneIndex!]?.energy) {
    beats.push({ atMs: 0, anchor: la, action: "spark", params: { fizzle: 1 } });
    beats.push({ atMs: 300, anchor: at, action: "eject", params: { dir: "down_ramp" } });
  } else if (config.energy) {
    beats.push({ atMs: 0, anchor: at, action: "stall", params: { dir: "up_ramp" } });
    beats.push({ atMs: 500, anchor: at, action: "sink", params: { dir: "slide_back" } });
  } else if (cfg?.polar === true || cfg?.charged === true || cfg?.polar == null) {
    beats.push({ atMs: 0, anchor: at, action: "bounce", params: { off: "heads" } });
    beats.push({ atMs: 0, anchor: la, action: "flash" });
  } else {
    beats.push({ atMs: 0, anchor: la, action: "flash", params: { notches: 1 } });
    beats.push({ atMs: 150, anchor: at, action: "eject", params: { notch: -1 } });
  }
  return { beats, durationMs: 1200, cue };
}

const PAYOFF_ACTION: Readonly<Partial<Record<PayoffAnim, SuccessAction>>> = {
  ramp_forms: "rise",
  stairs_rise: "rise",
  stairwell_opens: "open",
  door_carries: "ride",
  vault_opens: "open",
  gate_lifts: "rise",
  door_opens: "open",
  barrier_lifts: "rise",
};

/**
 * The success plan (1.2–2.5 s). Reads `items[].vehicle` — the ONLY reader of the success-only field: carrier → ride,
 * channel → spin, pump → rise with a gold spark (and the ATP card spends one cell), none → dissolve through the oil.
 * Maws swallow in turn (200 ms apart); drawers take their items, slam and show their feature plates.
 */
function successPlanOf(input: PoseInput<RouterLanesConfig, null>, anim: PayoffAnim): SuccessPlan {
  const { config } = input;
  const pose = computePose({ ...input, solved: false });
  const byKey = new Map(config.items.map((c) => [c.key, c]));
  const order = pose.lanes.flatMap((l) =>
    pose.items.filter((i) => i.lane === l.index).sort((a, b) => a.q - b.q),
  );
  const n = Math.max(1, order.length);
  const spacing = Math.min(200, Math.floor(1300 / n));
  const beats: SuccessBeat[] = [];
  const cardEffects: SuccessPlan["cardEffects"][number][] = [];
  const atpSlot = slotsOf(config, false).atp;
  order.forEach((it, i) => {
    const atMs = 100 + i * spacing;
    const lane = config.lanes[it.lane!];
    const vehicle = byKey.get(it.key)?.vehicle ?? "none";
    if (config.shutters) {
      beats.push({ atMs, anchor: itemAnchor(it.key), action: "swallow", params: { lane: it.lane! } });
      return;
    }
    if (isMawLane(lane)) beats.push({ atMs, anchor: laneAnchor(it.lane!), action: "swallow" });
    const action: SuccessAction = vehicle === "carrier" ? "ride" : vehicle === "channel" ? "spin" : vehicle === "pump" ? "rise" : "dissolve";
    beats.push({ atMs, anchor: itemAnchor(it.key), action, params: vehicle === "pump" ? { spark: 1 } : { spark: 0 } });
    if (vehicle === "pump" && atpSlot !== null) cardEffects.push({ atMs, slot: atpSlot, effect: "spend", key: it.key });
  });
  const tLanes = 100 + order.length * spacing + 100;
  if (config.shutters) {
    config.lanes.forEach((_, i) => {
      beats.push({ atMs: tLanes, anchor: laneAnchor(i), action: "lock" });
      beats.push({ atMs: tLanes + 150, anchor: `shutter_${i}`, action: "open" });
    });
  }
  const tPayoff = Math.min(1900, tLanes + 300);
  beats.push({ atMs: tPayoff, anchor: PAYOFF_ANCHOR, action: PAYOFF_ACTION[anim] ?? "open", params: { anim } });
  const durationMs = Math.max(1200, Math.min(2500, tPayoff + 600));
  const cue = config.shutters ? SENSITIVE_CUE : config.lanes.some(isMawLane) ? "gatekeeper_rumble" : "latch_clack";
  return { beats, cardEffects, durationMs, cue };
}

// ---------------------------------------------------------------- geometry

function halfWidth(config: RouterLanesConfig, view: unknown): number {
  const lanes = ROUTER_LAYOUT.laneSpacing * ((config.lanes.length - 1) / 2) + 300;
  const drift = ROUTER_LAYOUT.driftSpacing * ((Math.max(viewItems(view).length, config.items.length) - 1) / 2) + 120;
  return Math.max(560, lanes, drift);
}

// ---------------------------------------------------------------- the meta

export const routerLanesMeta: ContraptionMeta<RouterLanesConfig, RouterLanesPose> = {
  id: "router_lanes",
  name: "Router Lanes",
  modes: ["sorter.bins"],
  tier: "native",
  status: "demo",
  reusable: "any_subject",
  layouts: ["board"],
  defaultLayout: "board",
  payoffs: ["ramp_forms", "door_carries", "stairwell_opens", "stairs_rise", "vault_opens", "gate_lifts", "door_opens"],
  nearMissKeys: [],
  accessories: ["record_lens"],
  skins: ROUTER_LANES_SKINS,
  control: "bins",
  configSchema: RouterLanesConfig,
  validateConfig: (config, ctx) => validateRouterLanes(config, ctx),
  defaultConfig(ctx: ConfigCtx): RouterLanesConfig {
    const items = itemKeysOf(ctx.view).map((key) => {
      const text = viewTextOf(ctx.view, key);
      return { key, meta: { printedDate: findDates(text)[0] ?? null } };
    });
    const years = items.map((i) => (i.meta.printedDate ? Math.floor(fracYearOf(i.meta.printedDate) ?? 0) : 0)).filter((y) => y > 0);
    const probe = ctx.biome === "archive_of_voices" && years.length >= 2 ? yearProbeFor(years) : null;
    return RouterLanesConfig.parse({
      items,
      lanes: defaultLanes(ctx.view),
      shutters: ctx.biome === "archive_of_voices", // sensitive biomes (§4.4 defaults)
      probe,
      probeWorld: probe ? "record_lens" : "none",
    });
  },
  writerConfigSchema: (ctx) => (ctx.itemKeys.length > 0 ? routerLanesWriterSchema(ctx) : null),
  fromWriterConfig(w: unknown, ctx: ConfigCtx): RouterLanesConfig {
    const wc = w as RouterLanesWriter;
    const probe = probeFromWriter(wc.probe);
    return RouterLanesConfig.parse({
      items: wc.items.map((i) => ({
        key: i.key,
        meta: { printedDate: i.printedDate, madeYear: i.madeYear },
        polar: i.polar,
        charged: i.charged,
        from: i.from,
        to: i.to,
      })),
      lanes: defaultLanes(ctx.view),
      lens: wc.items.some((i) => i.polar !== null || i.charged !== null) ? "hydration" : "none",
      shutters: ctx.biome === "archive_of_voices",
      probe,
      probeWorld: probe && (probe.format === "year" || probe.format === "month_year") ? "record_lens" : "none",
    });
  },
  // ---- geometry
  footprint(config: RouterLanesConfig): Footprint2D {
    return { left: 160, right: 2 * halfWidth(config, null), height: 900 };
  },
  frameBounds(config: RouterLanesConfig, view: unknown): Bounds {
    const hw = halfWidth(config, view);
    return { x: -hw, y: -820, w: 2 * hw, h: 920 };
  },
  // ---- live
  probe: (config) => config.probe,
  clock: { resetOn: ["open"] },
  sim: null,
  pose: (input) => computePose(input),
  lerp: (from, to, t) => lerpPose(from, to, t),
  describe: (pose, input) => describePose(pose, input.view),
  panelStatic: (input) => panelStaticOf(input),
  panelLive: (stat, input) => panelLiveOf(stat, input),
  hintTargets: (rung, input) => hintTargetsOf(rung, input),
  audio: () => [],
  failurePlan: (d, input) => failurePlanOf(d, input),
  successPlan: (input, anim) => successPlanOf(input, anim),
  solvedPose: (input) => computePose({ ...input, solved: true }),
  debug(pose: RouterLanesPose) {
    return {
      placed: pose.placed,
      total: pose.total,
      complete: pose.complete,
      visible: pose.items.filter((i) => i.visible).length,
      batch: pose.batch,
      batches: pose.batches,
      lens: pose.lens,
      activeCount: pose.activeCount,
      projected: pose.energy?.projected ?? 0,
      focus: pose.focusKey ?? (pose.focusLane !== null ? `lane_${pose.focusLane}` : ""),
      eyeAngle: Math.round(pose.eyeAngle * 1000) / 1000,
      lanes: pose.lanes.map((l) => `${l.binId}:${l.count}`).join("|"),
      gate: pose.gate,
      solved: pose.solved,
    };
  },
};

/**
 * claim_holders — truth_finder.mimic (docs/design/20 §4 row 4, §4.2, §4.4; trig §5.3/§5.5, cell §5.P/§5.1–§5.7,
 * civil §5.1/§5.4). 3–4 holders with plaques; an aimer (Tuning Lens, probe emitter, arc or pendant lamp) swings its
 * beam to the aimed holder; claim renders: trace slates (math), ghosts over a live reference sim (science), footprints
 * on the FILE card (history). KA1: the complete pure half, the contract every skin (KA trig, KB specimen_pods, KC
 * witness_projector) draws from.
 *
 * Live-reveal rule (§2.5.6): pose/describe/panelLive see the view, the draft, the probe, the aid tier and the sim
 * state; never params or the solution. `quarantineAnim` is read by successPlan only (the no-leak test permutes it).
 *
 * The file also exports a small pure "panel kit" (axes, ticks, sampling, probe formatting) that step-bridge.meta.ts
 * reuses; P1's src/world/graph-math.ts may supersede it later.
 */
import { z } from "zod";
import type { AxisUnit, PayoffAnim, ProbeSpec } from "../../contracts/world";
import { evalExactAt } from "../../mechanics/util";
import { clamp, clamp01, lerp, lerpAngle } from "../ease";
import type { Vec2 } from "../geom";
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
  Draft,
  FailBeat,
  FailurePlan,
  FnColor,
  Footprint2D,
  GraphAnnotation,
  HintRung,
  HintTarget,
  PanelLive,
  PanelStatic,
  PlotModel,
  PoseInput,
  SimSpec,
  StaticInput,
  SuccessBeat,
  SuccessPlan,
  Tick,
  WriterCtx,
} from "../types";
import {
  coverExactlyOnce,
  dateParts,
  err,
  exprEvaluatesOver,
  exprValue,
  findYears,
  fracYearOf,
  probeRangeIssues,
  statementIndicesOf,
  viewRows,
  warn,
  yearAppearsIn,
  yearProbeFor,
} from "./config-parts";
import { defineSkin } from "./skin-kit";
import { probeFromWriter, wDate, wEnumOrNull, wExpr, wProbe, type WriterProbe } from "./writer-kit";
import { ClaimHoldersConfig, type Aimer, type QuarantineAnim, type RefSimId } from "./claim-holders.config";
import { ghostIdsForDomain, REF_SIM_GHOSTS, REF_SIMS, simIdsForDomain } from "../sims";
export { ClaimHoldersConfig, CLAIM_HOLDERS_SUCCESS_ONLY, RefSimId } from "./claim-holders.config";

// ================================================================ panel kit (pure; shared with step-bridge.meta.ts)

export const LETTERS = ["A", "B", "C", "D", "E", "F"] as const;
export const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

/** "2" → 2, "chest_2" → 2, null → null: the trailing index of a hover/focus key. */
export function indexFromKey(key: string | null | undefined): number | null {
  if (key === null || key === undefined) return null;
  const m = /(\d+)$/.exec(key);
  return m ? Number(m[1]) : null;
}
/** Fixed decimals without "-0.00". */
export function fmtNum(v: number, digits = 2): string {
  const z0 = Math.abs(v) < 0.5 * 10 ** -digits ? 0 : v;
  return z0.toFixed(digits);
}
/** 0.8333π → "0.83π", π → "π", 2π → "2π", 0 → "0". */
export function fmtPi(v: number): string {
  const r = v / Math.PI;
  if (Math.abs(r) < 0.005) return "0";
  const s = r.toFixed(2).replace(/\.?0+$/, "");
  return `${s === "1" ? "" : s === "-1" ? "−" : s}π`;
}
/** Tick label for a multiple of π/2: "π/2", "π", "3π/2", "2π". */
export function piTickLabel(v: number): string {
  const n = Math.round(v / (Math.PI / 2));
  if (n === 0) return "0";
  if (n % 2 === 0) {
    const m = n / 2;
    return m === 1 ? "π" : m === -1 ? "−π" : `${m}π`;
  }
  return n === 1 ? "π/2" : n === -1 ? "−π/2" : `${n}π/2`;
}
/** Fractional year → "MAR 1965" (month m = year + (m − 1)/12). */
export function monthYear(v: number): string {
  const y = Math.floor(v + 1e-6);
  const m = clamp(Math.floor((v - y) * 12 + 1e-6), 0, 11);
  return `${MONTHS[m]} ${y}`;
}
/** Decimals implied by a step (0.1 → 1, 0.5 → 1, 1 → 0). */
export function decimalsOf(step: number): number {
  if (!(step > 0)) return 2;
  return Math.max(0, Math.min(3, Math.ceil(-Math.log10(step) - 1e-9)));
}
/** The Scrubber readout for a probe value: "0.5π", "MAR 1965", "2.4 nm", "stage 3 · slot 3". */
export function formatProbe(v: number, spec: Pick<ProbeSpec, "format" | "unit" | "step" | "stops">): string {
  const dec = decimalsOf(spec.step);
  switch (spec.format) {
    case "pi":
      return fmtPi(v);
    case "month_year":
      return monthYear(v);
    case "year":
      return String(Math.round(v));
    case "integer":
      return `${Math.round(v)}${spec.unit ? ` ${spec.unit}` : ""}`;
    case "percent":
      return `${v.toFixed(dec)}%`;
    case "stage": {
      const stop = spec.stops.find((s) => Math.abs(s.v - v) < spec.step / 2 + 1e-9);
      return stop ? `stage ${fmtNum(v, 1)} · ${stop.label}` : `stage ${fmtNum(v, 1)}`;
    }
    default:
      return `${fmtNum(v, dec)}${spec.unit ? ` ${spec.unit}` : ""}`;
  }
}
/** The card axis unit for a probe. */
export function axisUnitOf(spec: Pick<ProbeSpec, "format" | "unit">): AxisUnit {
  switch (spec.format) {
    case "pi":
      return "pi";
    case "year":
    case "month_year":
      return "year";
    case "percent":
      return "percent";
    case "stage":
      return "stage";
    case "integer":
      return "count";
    default:
      if (spec.unit === "nm") return "nm";
      if (spec.unit === "mM") return "mM";
      if (spec.unit === "%") return "percent";
      if (spec.unit.includes("/s")) return "rate";
      if (spec.unit === "s") return "seconds";
      return "number";
  }
}
function trimNum(v: number): string {
  const s = v.toFixed(Math.abs(v) >= 10 || Number.isInteger(v) ? 0 : Math.abs(v) >= 1 ? 1 : 2);
  return s.replace(/\.0+$/, "");
}
/** Labelled major ticks for an axis (π multiples, whole years, or a 1/2/5 step). */
export function ticksFor(min: number, max: number, unit: AxisUnit): Tick[] {
  const span = max - min;
  if (!(span > 0) || !Number.isFinite(span)) return [];
  let step: number;
  let label: (v: number) => string;
  if (unit === "pi") {
    step = span <= 2.2 * Math.PI ? Math.PI / 2 : Math.PI;
    label = piTickLabel;
  } else if (unit === "year" || unit === "month") {
    step = span > 20 ? 5 : span > 8 ? 2 : 1;
    label = (v) => String(Math.round(v));
  } else if (unit === "stage" || unit === "count") {
    step = Math.max(1, Math.ceil(span / 8));
    label = (v) => String(Math.round(v));
  } else {
    const raw = span / 5;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const norm = raw / mag;
    step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
    label = trimNum;
  }
  const out: Tick[] = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + 1e-9 && out.length < 40; v += step) {
    const vv = Math.abs(v) < 1e-12 ? 0 : v;
    out.push({ v: vv, label: label(vv), major: true });
  }
  return out;
}
export function axisModel(min: number, max: number, unit: AxisUnit, label: string | null = null): AxisModel {
  return { min, max, unit, ticks: ticksFor(min, max, unit), label };
}
/** `expr` (free symbol x) at x, or null. */
export function evalExpr(expr: string, x: number): number | null {
  return evalExactAt(expr, { x });
}
/** A sampled plot, split at non-finite values and at jumps larger than 25 % of the y range. */
export function samplePlot(
  id: string,
  color: FnColor,
  style: PlotModel["style"],
  fn: (x: number) => number | null,
  x0: number,
  x1: number,
  yRange: number,
  n = 160,
): PlotModel {
  const segments: [number, number][][] = [];
  let seg: [number, number][] = [];
  let prev: number | null = null;
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / (n - 1);
    const y = fn(x);
    if (y === null || !Number.isFinite(y) || (prev !== null && Math.abs(y - prev) > 0.25 * Math.max(yRange, 1e-9))) {
      if (seg.length > 1) segments.push(seg);
      seg = [];
    }
    if (y !== null && Number.isFinite(y)) seg.push([x, y]);
    prev = y !== null && Number.isFinite(y) ? y : null;
  }
  if (seg.length > 1) segments.push(seg);
  return { id, color, style, segments, endpoints: [] };
}
/** Probe position 0…1 inside its range. */
export function probeU(probe: number | null, spec: ProbeSpec | null): number | null {
  if (probe === null || !spec || !(spec.max > spec.min)) return null;
  return clamp01((probe - spec.min) / (spec.max - spec.min));
}
/** The lerp of a number | null field: numbers interpolate, null snaps at t ≥ 0.5. */
export function lerpMaybe(a: number | null, b: number | null, t: number): number | null {
  if (a !== null && b !== null) return lerp(a, b, t);
  return t >= 0.5 ? b : a;
}
export function lerpArray(a: readonly number[], b: readonly number[], t: number): number[] {
  if (a.length !== b.length) return [...(t >= 0.5 ? b : a)];
  return a.map((v, i) => lerp(v, b[i], t));
}
export function lerpNumRecord(a: Readonly<Record<string, number>>, b: Readonly<Record<string, number>>, t: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const va = a[k];
    const vb = b[k];
    out[k] = va !== undefined && vb !== undefined ? lerp(va, vb, t) : ((t >= 0.5 ? vb : va) ?? vb ?? va ?? 0);
  }
  return out;
}
/** A skin by id (falls back to the first). */
export function skinById(skins: readonly ContraptionSkin[], skinId: string): ContraptionSkin | null {
  return skins.find((s) => s.id === skinId) ?? skins[0] ?? null;
}
/** Skin hint targets for a rung plus extra targets whose anchors the skin does not already use. */
export function withExtraTargets(base: readonly HintTarget[], extra: readonly HintTarget[]): HintTarget[] {
  const seen = new Set(base.map((t) => t.anchor));
  return [...base, ...extra.filter((t) => !seen.has(t.anchor))];
}

// ================================================================ skins (§4.3 + the round-2 slots)

const ht = (anchor: string, action: HintTarget["action"], holdMs: number): HintTarget => ({ anchor, action, holdMs });

export const CLAIM_HOLDERS_SKINS = [
  defineSkin({
    id: "resonance_pillars",
    name: "Resonance Pillars",
    ns: "orrery_terraces",
    nouns: ["singer", "singers", "pillar", "pillars", "automaton", "bell", "slate", "Tuning Lens", "lens"],
    parts: [
      ["automaton_a", "H"], ["automaton_b", "H"], ["automaton_c", "H"], ["bell", "K"], ["faceplate", "K"], ["slate", "K"], ["plaque", "K"],
      ["lens_pedestal", "H"], ["lens_head", "H"], ["echo_lift", "K"], ["lift_chain", "K"], ["mimic_crab", "H"], ["console", "K"],
    ],
    anchors: ["holder_0…2", "slate_0…2", "lens", "lift", "chest_hinge", "console"],
    cues: { live: "bell_hum", succeed: "chord_true", fail: "bell_honest" },
    // trig §5.3: rung 1 circle the lens; rung 2 hover each slate in turn; rung 3 land on the lens
    hintTargets: [[ht("lens", "circle", 1500)], [ht("slate_0", "hover", 700), ht("slate_1", "hover", 700), ht("slate_2", "hover", 700)], [ht("lens", "land", 1500)]],
  }),
  defineSkin({
    id: "treasury_pillars",
    name: "Treasury Pillars",
    ns: "orrery_terraces",
    nouns: ["singer", "singers", "pillar", "pillars", "chest", "treasury", "bell", "slate", "Tuning Lens", "lens"],
    parts: [
      ["automaton_a", "H", "orrery_terraces.part.resonance_pillars_automaton_a"],
      ["automaton_b", "H", "orrery_terraces.part.resonance_pillars_automaton_b"],
      ["automaton_c", "H", "orrery_terraces.part.resonance_pillars_automaton_c"],
      ["bell", "K", "orrery_terraces.part.resonance_pillars_bell"],
      ["faceplate", "K", "orrery_terraces.part.resonance_pillars_faceplate"],
      ["slate", "K", "orrery_terraces.part.resonance_pillars_slate"],
      ["plaque", "K", "orrery_terraces.part.resonance_pillars_plaque"],
      ["lens_pedestal", "H", "orrery_terraces.part.resonance_pillars_lens_pedestal"],
      ["lens_head", "H", "orrery_terraces.part.resonance_pillars_lens_head"],
      ["mimic_crab", "H", "orrery_terraces.part.resonance_pillars_mimic_crab"],
      ["chest_body", "H"], ["chest_lid", "H"], ["rim_step", "K"], ["console", "K"],
    ],
    anchors: ["holder_0…2", "slate_0…2", "lens", "lift", "chest_hinge", "console"],
    cues: { live: "bell_hum", succeed: "chord_true", fail: "bell_honest" },
    hintTargets: [[ht("lens", "circle", 1500)], [ht("slate_0", "hover", 700), ht("slate_1", "hover", 700), ht("slate_2", "hover", 700)], [ht("lens", "land", 1500)]],
  }),
  defineSkin({
    id: "specimen_pods",
    name: "Specimen Pods",
    ns: "living_gate",
    nouns: ["pod", "pods", "specimen", "capsule", "emitter", "probe", "Mimic Mote", "mote"],
    parts: [
      ["pod", "H"], ["letter_plate", "K"], ["probe_emitter", "H"], ["mimic_mote", "H"],
      ["probe_well", "K"], ["needle", "H"], ["ion", "K"],
      ["dye_tank", "K"], ["balance_beam", "H"],
      ["basin", "K"], ["test_cell", "H"], ["raft_lock", "K"],
      ["low_tank", "K"], ["high_tank", "K"], ["flume_pump", "H"], ["lantern", "K"],
      ["console", "K"],
    ],
    anchors: ["pod_0…2", "emitter", "apparatus", "ghost_origin", "console"],
    cues: { live: "current_hum", succeed: "pod_crack", fail: "bell_honest" },
    // cell §5.1–§5.7: rung 1 circle the apparatus; rung 2 hover where the ghosts project; rung 3 land on the apparatus
    hintTargets: [[ht("apparatus", "circle", 2000)], [ht("ghost_origin", "hover", 1800)], [ht("apparatus", "land", 2000)]],
  }),
  defineSkin({
    id: "witness_projector",
    name: "Witness Projector",
    ns: "archive_of_voices",
    nouns: ["projector", "slide", "slides", "lamp", "lens", "panel", "witness"],
    parts: [
      ["arc_lamp", "H"], ["pendant_lamp", "H"], ["witness_lens", "K"], ["projection_panel", "K"], ["retract_stamp", "K"],
      ["steps", "K"], ["menu_board", "K"], ["console", "K"],
    ],
    anchors: ["lamp_pivot", "panel_0…2", "lens_0…2", "steps", "console"],
    cues: { live: null, succeed: "slide_retract", fail: "bell_honest" },
    sensitiveSafe: true,
    // civil §5.1/§5.4: rung 1 circle the panels in display order; rung 2 land on the lamp; rung 3 hover at the console
    hintTargets: [[ht("panel_0", "circle", 900), ht("panel_1", "circle", 900), ht("panel_2", "circle", 900)], [ht("lamp_pivot", "land", 1800)], [ht("console", "hover", 2000)]],
  }),
] as const;

/** aimer / quarantine animation per biome (BIOME_KITS.skinDefaults supersedes this once V1 lands). */
const BIOME_AIMER: Readonly<Record<string, { aimer: Aimer; quarantineAnim: QuarantineAnim }>> = {
  orrery_terraces: { aimer: "tuning_lens", quarantineAnim: "mimic_crab" },
  living_gate: { aimer: "probe_emitter", quarantineAnim: "ridge_thaw" },
  archive_of_voices: { aimer: "arc_lamp", quarantineAnim: "retract_stamp" },
};
function aimerFor(biome: string) {
  return BIOME_AIMER[biome] ?? BIOME_AIMER.orrery_terraces;
}

// ================================================================ validation (§4.4)

function referenceDomain(config: ClaimHoldersConfig): [number, number] {
  if (!config.reference) return [0, 2 * Math.PI];
  const lo = exprValue(config.reference.xMin);
  const hi = exprValue(config.reference.xMax);
  return lo !== null && hi !== null && lo < hi ? [lo, hi] : [0, 2 * Math.PI];
}

function mimicIndexOf(solution: unknown): number | null {
  const m = (solution as { mimicIndex?: unknown } | null)?.mimicIndex;
  return typeof m === "number" ? m : null;
}

export function validateClaimHolders(config: ClaimHoldersConfig, ctx: ConfigCtx): ConfigIssue[] {
  const out: ConfigIssue[] = [];
  out.push(...coverExactlyOnce(["holders"], "statementIndex", statementIndicesOf(ctx.view), config.holders.map((h) => h.statementIndex)));

  // traces evaluate over the reference domain; brackets and markers stay inside the card range
  const [x0, x1] = referenceDomain(config);
  if (config.reference) {
    if (!exprEvaluatesOver(config.reference.expr, x0, x1)) out.push(err(["reference", "expr"], `reference "${config.reference.expr}" does not evaluate over its domain`));
    if (!(config.reference.yMin < config.reference.yMax)) out.push(err(["reference", "yMin"], "reference yMin must be below yMax"));
  }
  const yRange = config.reference ? [config.reference.yMin, config.reference.yMax] : null;
  const inX = (v: number) => v >= x0 - 1e-9 && v <= x1 + 1e-9;
  const inY = (v: number) => !yRange || (v >= yRange[0] - 1e-9 && v <= yRange[1] + 1e-9);
  config.holders.forEach((h, i) => {
    if (!h.trace) return;
    h.trace.fns.forEach((f, j) => {
      if (!exprEvaluatesOver(f.expr, x0, x1)) out.push(err(["holders", i, "trace", "fns", j, "expr"], `trace "${f.expr}" evaluates at fewer than 90 % of 64 samples`));
    });
    h.trace.brackets.forEach((b, j) => {
      const [bx0, by0, bx1, by1] = [b.x0, b.y0, b.x1, b.y1].map(exprValue);
      if ([bx0, by0, bx1, by1].some((v) => v === null)) {
        out.push(err(["holders", i, "trace", "brackets", j], "bracket coordinates must evaluate"));
        return;
      }
      if (!inX(bx0!) || !inX(bx1!) || !inY(by0!) || !inY(by1!)) out.push(err(["holders", i, "trace", "brackets", j], "bracket lies outside the card range"));
    });
    h.trace.markers.forEach((m, j) => {
      const [mx, my] = [m.x, m.y].map(exprValue);
      if (mx === null || my === null) out.push(err(["holders", i, "trace", "markers", j], "marker coordinates must evaluate"));
      else if (!inX(mx) || !inY(my)) out.push(err(["holders", i, "trace", "markers", j], "marker lies outside the card range"));
    });
  });
  const styleSets = new Set(config.holders.filter((h) => h.trace).map((h) => h.trace!.fns.map((f) => f.style).sort().join(",")));
  if (styleSets.size > 1) out.push(warn(["holders"], "holders use different trace style sets; a lone style can read as a tell"));

  // ghosts: registry membership and honesty
  const ghosts = config.holders.filter((h) => h.ghost !== null);
  if (ghosts.length > 0) {
    if (!config.referenceSim) out.push(err(["referenceSim"], "ghosts need a referenceSim"));
    else {
      const registry = REF_SIM_GHOSTS[config.referenceSim.id];
      const mimic = mimicIndexOf(ctx.solution);
      config.holders.forEach((h, i) => {
        if (h.ghost === null) return;
        const tag = registry[h.ghost];
        if (!tag) {
          out.push(err(["holders", i, "ghost"], `ghost "${h.ghost}" is not in ${config.referenceSim!.id}'s registry`));
          return;
        }
        if (mimic === null) return;
        const want = h.statementIndex === mimic ? "contradicts" : "matches";
        if (tag !== want) out.push(err(["holders", i, "ghost"], `ghost honesty: statement ${h.statementIndex}'s ghost "${h.ghost}" ${tag} the sim, but it must ${want === "matches" ? "match" : "contradict"}`));
      });
    }
  }

  // footprints: all or none; years present in the encounter texts (±1)
  const withFp = config.holders.filter((h) => h.footprint !== null).length;
  if (withFp !== 0 && withFp !== config.holders.length) out.push(err(["holders"], "footprints are all-or-none: give every holder one, or none"));
  config.holders.forEach((h, i) => {
    if (!h.footprint) return;
    for (const d of [h.footprint.from, h.footprint.to]) {
      const p = d ? dateParts(d) : null;
      if (p && !yearAppearsIn(ctx.texts, p.year, 1)) out.push(err(["holders", i, "footprint"], `footprint year ${p.year} does not appear in the encounter texts`));
    }
  });
  config.hintPins.forEach((pin, i) => {
    const p = dateParts(pin.date);
    if (p && !yearAppearsIn(ctx.texts, p.year, 1)) out.push(warn(["hintPins", i], `hint pin year ${p.year} is not in the encounter texts`));
  });
  out.push(...probeRangeIssues(["probe"], config.probe));
  if (config.probeWorld === "record_lens" && config.probe && config.probe.format !== "year" && config.probe.format !== "month_year") {
    out.push(err(["probeWorld"], "record_lens needs a year or month_year probe"));
  }
  if (config.probeWorld === "trace_slate" && !config.reference) out.push(err(["probeWorld"], "trace_slate needs a reference"));
  if (config.probeWorld !== "none" && !config.probe) out.push(err(["probeWorld"], `probeWorld "${config.probeWorld}" needs a probe`));
  return out;
}

// ================================================================ writer schema (§4.4)

interface ClaimHoldersWriter {
  holders: {
    statementIndex: number;
    trace: { fns: { expr: string; style: "solid" | "dashed" }[]; brackets: { x0: string; y0: string; x1: string; y1: string; label: string }[] } | null;
    ghost: string | null;
    footprint: { kind: "pin" | "band" | "arrow"; from: string; to: string | null; label: string } | null;
  }[];
  referenceSim: RefSimId | null;
  probe: WriterProbe | null;
}

export function claimHoldersWriterSchema(ctx: WriterCtx) {
  return z.object({
    holders: z
      .array(
        z.object({
          statementIndex: z.number().int().min(0).max(5),
          trace: z
            .object({
              fns: z.array(z.object({ expr: wExpr(), style: z.enum(["solid", "dashed"]) })).min(1).max(2),
              brackets: z.array(z.object({ x0: wExpr(), y0: wExpr(), x1: wExpr(), y1: wExpr(), label: z.string() })).min(0).max(2),
            })
            .nullable()
            .describe("Math claims only: draw literally what the claim says. Never style the false claim differently"),
          ghost: wEnumOrNull(ghostIdsForDomain(ctx.domain), "ghosts"),
          footprint: z
            .object({ kind: z.enum(["pin", "band", "arrow"]), from: wDate(), to: wDate().nullable(), label: z.string() })
            .nullable()
            .describe("History claims: where the claim puts itself on the timeline. Give every holder one, or none"),
        }),
      )
      .min(ctx.itemKeys.length)
      .max(ctx.itemKeys.length),
    referenceSim: wEnumOrNull(simIdsForDomain(ctx.domain), "sims"),
    probe: wProbe(),
  });
}

// ================================================================ geometry (zone units relative to station.anchor, y down)

/** Where an aimer and its holders stand, and which prefab anchors carry them. Skins may re-derive angles from their
    own anchors with `aimAngleFrom`; the pose's `aimAngle` uses this standard rig. */
export interface AimRig {
  aimer: Vec2; // lens / emitter / lamp pivot
  cx: number; // centre x of the holder row
  spacing: number;
  holderY: number; // the surface the beam hits (slate, pod, panel)
  cord: number | null; // pendant lamps swing on a cord
  aimAnchor: string;
  holderAnchor: string; // `${holderAnchor}${slot}`
  surfaceAnchor: string; // `${surfaceAnchor}${slot}` (slate, pod, panel)
  holderNoun: string;
  aimerNoun: string;
  liveCue: string | null;
  succeedCue: string;
}
export const AIM_RIGS: Readonly<Record<Aimer, AimRig>> = {
  tuning_lens: {
    aimer: { x: 0, y: -20 }, cx: 0, spacing: 420, holderY: -240, cord: null, aimAnchor: "lens", holderAnchor: "holder_", surfaceAnchor: "slate_",
    holderNoun: "singer", aimerNoun: "Tuning Lens", liveCue: "bell_hum", succeedCue: "chord_true",
  },
  probe_emitter: {
    aimer: { x: -560, y: -180 }, cx: -330, spacing: 130, holderY: -90, cord: null, aimAnchor: "emitter", holderAnchor: "pod_", surfaceAnchor: "pod_",
    holderNoun: "pod", aimerNoun: "probe emitter", liveCue: "current_hum", succeedCue: "pod_crack",
  },
  arc_lamp: {
    aimer: { x: 0, y: -70 }, cx: 0, spacing: 200, holderY: -330, cord: null, aimAnchor: "lamp_pivot", holderAnchor: "lens_", surfaceAnchor: "panel_",
    holderNoun: "slide", aimerNoun: "Proof Lamp", liveCue: null, succeedCue: "slide_retract",
  },
  pendant_lamp: {
    aimer: { x: 0, y: -420 }, cx: 0, spacing: 240, holderY: -260, cord: 300, aimAnchor: "lamp_pivot", holderAnchor: "panel_", surfaceAnchor: "panel_",
    holderNoun: "slide", aimerNoun: "counter lamp", liveCue: null, succeedCue: "slide_retract",
  },
};
/** Holder surface position of display slot `slot` of `n`. */
export function holderPos(rig: AimRig, n: number, slot: number): Vec2 {
  return { x: rig.cx + (slot - (n - 1) / 2) * rig.spacing, y: rig.holderY };
}
/** Turning aimers: the world angle atan2(dy, dx); pendant lamps: the swing angle asin(dx / cord) clamped to ±0.9. */
export function aimAngleFrom(rig: Pick<AimRig, "aimer" | "cord">, target: Vec2): number {
  if (rig.cord !== null) return Math.asin(clamp((target.x - rig.aimer.x) / rig.cord, -0.9, 0.9));
  return Math.atan2(target.y - rig.aimer.y, target.x - rig.aimer.x);
}
/** The pose angle: toward the aimed holder, else a slow ±6° searching sweep around the row's centre (civil §5.1). */
export function aimAngleAt(rig: AimRig, n: number, slot: number | null, t: number, reducedMotion: boolean): number {
  if (slot !== null) return aimAngleFrom(rig, holderPos(rig, n, slot));
  const centre = aimAngleFrom(rig, { x: rig.cx, y: rig.holderY });
  return reducedMotion ? centre : centre + ((6 * Math.PI) / 180) * Math.sin(2 * Math.PI * 0.2 * t);
}

// ================================================================ reference-sim wrapper (the specimen_pods apparatus)

/** claim_holders' sim: the station's reference sim (config.referenceSim), re-initialised per that sim's own resetOn
    (probe_change, draft_change); the wrapper keeps the params so a re-init uses the station's values. */
export interface ClaimHoldersSim {
  id: RefSimId;
  seed: number;
  params: Readonly<Record<string, number>>;
  probe: number | null;
  seq: number;
  state: unknown;
}
export const claimHoldersSim: SimSpec<ClaimHoldersConfig, ClaimHoldersSim | null> = {
  init(seed, config, view, ctx) {
    if (!config.referenceSim) return null;
    const params = config.referenceSim.params;
    return { id: config.referenceSim.id, seed, params, probe: ctx.probe, seq: ctx.draft?.seq ?? 0, state: REF_SIMS[config.referenceSim.id].init(seed, params, view, ctx) };
  },
  step(s, dt, ctx) {
    if (!s) return s;
    const inner = REF_SIMS[s.id];
    const seq = ctx.draft?.seq ?? s.seq;
    const reset = (ctx.probe !== s.probe && inner.resetOn.includes("probe_change")) || (seq !== s.seq && inner.resetOn.includes("draft_change"));
    const base = reset ? inner.init(s.seed, s.params, null, ctx) : s.state;
    return { ...s, probe: ctx.probe, seq, state: inner.step(base, dt, ctx) };
  },
  fixedDt: 1 / 30,
  resetOn: ["open"],
  readout(s) {
    return s ? REF_SIMS[s.id].readout(s.state) : {};
  },
};

// ================================================================ pose

/** The archetype's pose (skins import this name). Display slots follow `view.chests` order, never statement order. */
export interface ClaimHoldersPose {
  n: number; // holders shown
  aimed: number | null; // display slot the aimer points at (hover/focus preview, else the committed pick)
  committed: number | null; // display slot of draft.input.statementIndex
  preview: boolean; // aimed by hover/focus without committing
  aimAngle: number; // radians: turning aimers atan2 in world space; pendant_lamp the swing angle from vertical
  beam: number; // 0 off … 1 full (a preview beam runs at 0.7)
  holderGlow: readonly number[]; // per display slot: aimed 1, others 0.6, nothing aimed 0.8 (× 0.6 outside the scenario)
  ghost: string | null; // the aimed holder's claim ghost (science) while it projects
  ghostAlpha: number;
  scenarioOk: boolean; // probe > scenarioMin (or no scenarioMin)
  probeU: number | null; // probe position in its range
  playheadX: number | null; // trace_slate: the probe x
  traceY: number | null; // trace_slate: the aimed claim's first function at x
  refY: number | null; // trace_slate: the reference at x
  bell: number; // |f(x)| / max(|yMin|, |yMax|): bell glow and hum pitch (the aimed trace, else the reference)
  apparatus: Readonly<Record<string, number>>; // probe-world fields (needleTipY, dyeN, beamTilt, volume, strokeHz, lensU, …) + sim_<readout>
  highlight: boolean; // aid tier ≥ secondaryTier: the apparatus key-feature ring
  quarantined: number | null; // display slot of the exposed mimic (solved poses only)
  gate: number; // payoff 0 closed … 1 open
  solved: boolean;
}

interface Chest {
  statementIndex: number;
  text: string;
}
/** The view's claims in display order. */
export function chestsOf(view: unknown): Chest[] {
  return viewRows(view, "chests", "statementIndex", "text").map((r) => ({ statementIndex: Number(r.key), text: r.text }));
}
/** Display slot of a statementIndex in the view, or null. */
export function slotOfStatement(view: unknown, statementIndex: number | null): number | null {
  if (statementIndex === null) return null;
  const i = chestsOf(view).findIndex((c) => c.statementIndex === statementIndex);
  return i >= 0 ? i : null;
}

export interface AimState {
  aimed: number | null;
  committed: number | null;
  preview: boolean;
  aimedIndex: number | null; // statementIndex of the aimed holder
}
/** Hover and focus preview without committing (amendment 33); input.statementIndex commits. */
export function aimStateOf(view: unknown, draft: Draft | null): AimState {
  const input = draft?.input as { statementIndex?: unknown } | null | undefined;
  const committedIndex = typeof input?.statementIndex === "number" ? input.statementIndex : null;
  const previewIndex = indexFromKey(draft?.hover) ?? indexFromKey(draft?.focus);
  const committed = slotOfStatement(view, committedIndex);
  const previewSlot = slotOfStatement(view, previewIndex);
  const aimed = previewSlot ?? committed;
  const preview = previewSlot !== null && previewSlot !== committed;
  const chests = chestsOf(view);
  return { aimed, committed, preview, aimedIndex: aimed === null ? null : (chests[aimed]?.statementIndex ?? null) };
}

type Family = "math" | "science" | "history" | "text";
function familyOf(config: ClaimHoldersConfig): Family {
  if (config.reference || config.holders.some((h) => h.trace)) return "math";
  if (config.referenceSim || config.holders.some((h) => h.ghost)) return "science";
  if (config.holders.some((h) => h.footprint) || config.fileDates.length > 0 || config.probeWorld === "record_lens" || config.hintPins.length > 0) return "history";
  return "text";
}
function scenarioOkOf(config: ClaimHoldersConfig, probe: number | null): boolean {
  return config.scenarioMin === null || (probe !== null && probe > config.scenarioMin);
}
function refBound(config: ClaimHoldersConfig): number {
  return config.reference ? Math.max(Math.abs(config.reference.yMin), Math.abs(config.reference.yMax), 1e-9) : 1;
}
function simParam(config: ClaimHoldersConfig, key: string, fallback: number): number {
  const v = config.referenceSim?.params[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
/** Osmotic volume V/V₀ = b + (1 − b)·C_in / max(s, 0.3), clamped to [0.55, 1.6] (cell §5.4). */
export function osmoticVolume(s: number, cIn = 2, b = 0.3): number {
  return clamp(b + ((1 - b) * cIn) / Math.max(s, 0.3), 0.55, 1.6);
}
/** Pump-flume steady state: ΔC = min(0.96 r, 9.6), C_high = 5 + ΔC/2, C_low = 5 − ΔC/2 (cell §5.7). */
export function flumeSteady(r: number): { dC: number; cHigh: number; cLow: number } {
  const dC = Math.min(0.96 * Math.max(r, 0), 9.6);
  return { dC, cHigh: 5 + dC / 2, cLow: 5 - dC / 2 };
}
/** Bilayer polarity P(d) = σ(8(1 − d)) + σ(8(d − 4)) (cell §5.1). */
export function bilayerPolar(d: number): number {
  const s = (z0: number) => 1 / (1 + Math.exp(-z0));
  return s(8 * (1 - d)) + s(8 * (d - 4));
}

function apparatusOf(config: ClaimHoldersConfig, probe: number | null, simReadout: Readonly<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(simReadout)) if (Number.isFinite(v)) out[`sim_${k}`] = v;
  const p = probe ?? config.probe?.initial ?? config.probe?.min ?? 0;
  switch (config.probeWorld) {
    case "needle": {
      out.depth = p;
      out.needleTipY = 41.6 * p; // px per nm = 208 / 5
      out.ionHeld = p > 0.9 ? 1 : 0;
      out.part = Math.min(p, 1); // head parting strength
      break;
    }
    case "dye_load": {
      out.dyeN = Math.min(100, Math.round(10 * p));
      const cL = simReadout.cL ?? p;
      const cR = simReadout.cR ?? 0;
      out.beamTilt = (clamp(2.2 * (cL - cR), -18, 18) * Math.PI) / 180;
      out.floatL = 6 * cL;
      out.floatR = 6 * cR;
      break;
    }
    case "bath_salt": {
      const cIn = simParam(config, "cIn", 2);
      const v = osmoticVolume(p, cIn, simParam(config, "b", 0.3));
      out.salt = p;
      out.volume = v;
      out.crenation = v < 0.8 ? (6 * (0.8 - v)) / 0.25 : 0;
      out.stretch = v > 1.3 ? 1 : 0;
      out.waterFlux = 6 * (p - cIn); // + outward
      out.saltCubes = Math.min(80, Math.round(8 * p));
      break;
    }
    case "atp_feed": {
      const ss = flumeSteady(p);
      out.atp = p;
      out.strokeHz = 0.4 * p;
      out.pipeGlow = 0.15 + 0.08 * p;
      out.cHighTarget = ss.cHigh;
      out.cLowTarget = ss.cLow;
      break;
    }
    case "record_lens": {
      const w = config.probe?.window;
      out.lensU = w && w.end > w.start ? clamp01((p - w.start) / (w.end - w.start)) : (probeU(p, config.probe) ?? 0);
      break;
    }
    default:
      break;
  }
  return out;
}

function claimPose(input: PoseInput<ClaimHoldersConfig, ClaimHoldersSim | null>): ClaimHoldersPose {
  const { config, view, draft } = input;
  const rig = AIM_RIGS[config.aimer];
  const n = chestsOf(view).length;
  const aim = aimStateOf(view, draft);
  const family = familyOf(config);
  const scenarioOk = scenarioOkOf(config, input.probe);
  const holder = aim.aimedIndex === null ? null : (config.holders.find((h) => h.statementIndex === aim.aimedIndex) ?? null);
  const trace = config.probeWorld === "trace_slate" && config.reference;
  const x = trace && input.probe !== null ? input.probe : null;
  const refY = x !== null && config.reference ? evalExpr(config.reference.expr, x) : null;
  const traceExpr = holder?.trace?.fns[0]?.expr ?? null;
  const traceY = x !== null && traceExpr ? evalExpr(traceExpr, x) : null;
  const bellSrc = aim.aimed !== null ? traceY : refY;
  const readout = input.sim ? claimHoldersSim.readout(input.sim) : {};
  const dim = family === "science" && !scenarioOk ? 0.6 : 1;
  const ghost = family === "science" && scenarioOk && holder?.ghost ? holder.ghost : null;
  return {
    n,
    aimed: aim.aimed,
    committed: aim.committed,
    preview: aim.preview,
    aimAngle: aimAngleAt(rig, n, aim.aimed, input.t, input.reducedMotion),
    beam: aim.aimed === null ? 0 : aim.preview ? 0.7 : 1,
    holderGlow: Array.from({ length: n }, (_, i) => (input.solved ? 1 : (aim.aimed === null ? 0.8 : i === aim.aimed ? 1 : 0.6) * dim)),
    ghost,
    ghostAlpha: ghost ? 0.45 : 0,
    scenarioOk,
    probeU: probeU(input.probe, config.probe),
    playheadX: x,
    traceY,
    refY,
    bell: bellSrc === null ? 0 : clamp01(Math.abs(bellSrc) / refBound(config)),
    apparatus: apparatusOf(config, input.probe, readout),
    highlight: input.aidTier >= config.secondaryTier,
    quarantined: input.solved ? aim.committed : null,
    gate: input.solved ? 1 : 0,
    solved: input.solved,
  };
}

function lerpClaimPose(a: ClaimHoldersPose, b: ClaimHoldersPose, t: number): ClaimHoldersPose {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const s = t >= 0.5;
  return {
    n: s ? b.n : a.n,
    aimed: s ? b.aimed : a.aimed,
    committed: s ? b.committed : a.committed,
    preview: s ? b.preview : a.preview,
    aimAngle: lerpAngle(a.aimAngle, b.aimAngle, t),
    beam: lerp(a.beam, b.beam, t),
    holderGlow: lerpArray(a.holderGlow, b.holderGlow, t),
    ghost: s ? b.ghost : a.ghost,
    ghostAlpha: lerp(a.ghostAlpha, b.ghostAlpha, t),
    scenarioOk: s ? b.scenarioOk : a.scenarioOk,
    probeU: lerpMaybe(a.probeU, b.probeU, t),
    playheadX: lerpMaybe(a.playheadX, b.playheadX, t),
    traceY: lerpMaybe(a.traceY, b.traceY, t),
    refY: lerpMaybe(a.refY, b.refY, t),
    bell: lerp(a.bell, b.bell, t),
    apparatus: lerpNumRecord(a.apparatus, b.apparatus, t),
    highlight: s ? b.highlight : a.highlight,
    quarantined: s ? b.quarantined : a.quarantined,
    gate: lerp(a.gate, b.gate, t),
    solved: s ? b.solved : a.solved,
  };
}

// ================================================================ describe

function claimDescribe(pose: ClaimHoldersPose, input: PoseInput<ClaimHoldersConfig, ClaimHoldersSim | null>): Described {
  const { config } = input;
  const rig = AIM_RIGS[config.aimer];
  const chips: ChipSpec[] = [];
  const letter = pose.aimed === null ? null : LETTERS[pose.aimed];
  if (letter) chips.push({ anchor: rig.aimAnchor, text: `aim: ${rig.holderNoun} ${letter}`, color: "f" });
  if (config.probeWorld === "trace_slate" && pose.aimed !== null && pose.traceY !== null) {
    chips.push({ anchor: `${rig.surfaceAnchor}${pose.aimed}`, text: `|y|: ${fmtNum(Math.abs(pose.traceY))}`, color: "h" });
  }
  const spec = config.probe;
  const probe = input.probe;
  const a = pose.apparatus;
  if (spec && probe !== null && config.probeWorld !== "trace_slate" && config.probeWorld !== "record_lens" && config.probeWorld !== "none") {
    chips.push({ anchor: "apparatus", text: `${spec.symbol}: ${formatProbe(probe, spec)}`, color: "f" });
  }
  if (config.probeWorld === "dye_load" && a.sim_cL !== undefined && a.sim_cR !== undefined) {
    chips.push({ anchor: "apparatus", text: `C_L: ${fmtNum(a.sim_cL, 1)} mM`, color: "f" });
    chips.push({ anchor: "apparatus", text: `C_R: ${fmtNum(a.sim_cR, 1)} mM`, color: "g" });
    if (a.sim_flux !== undefined) chips.push({ anchor: "ghost_origin", text: `J: ${a.sim_flux >= 0 ? "+" : ""}${fmtNum(a.sim_flux, 1)}/s`, color: "h" });
  }
  if (config.probeWorld === "bath_salt" && a.volume !== undefined) chips.push({ anchor: "apparatus", text: `V: ${Math.round(a.volume * 100)}%`, color: "h" });
  if (config.probeWorld === "atp_feed" && a.atp !== undefined) chips.push({ anchor: "apparatus", text: `ATP: ${fmtNum(a.atp, a.atp % 1 === 0 ? 0 : 1)}/s`, color: "gold" });

  let srText: string;
  if (pose.solved) srText = `The mimic is exposed; the ${rig.aimerNoun} rests and the way ahead is open.`;
  else if (letter) {
    srText = `The ${rig.aimerNoun} ${pose.preview ? "previews" : "aims at"} ${rig.holderNoun} ${letter}.`;
    if (config.probeWorld === "trace_slate" && pose.traceY !== null && pose.playheadX !== null) {
      srText += ` Its slate reads |y| = ${fmtNum(Math.abs(pose.traceY))} at x = ${fmtPi(pose.playheadX)}.`;
    }
    if (pose.ghost) srText += ` Its claim's ghost projects over the apparatus.`;
  } else srText = `The ${rig.aimerNoun} is searching; ${pose.n} ${rig.holderNoun}s wait to be aimed at.`;
  if (!pose.scenarioOk && !pose.solved) srText += " The claims are outside their scenario at this setting.";
  return { chips, pins: [], srText, nearMiss: null };
}

// ================================================================ panel models

interface Layout {
  cards: readonly ("file" | "claims" | "reference" | "claim" | "overlay" | "sim0" | "sim1" | "sim2")[];
}
function layoutOf(config: ClaimHoldersConfig, record: boolean): Layout {
  const fam = familyOf(config);
  const simCards = config.referenceSim ? SIM_CARDS[config.referenceSim.id].cards.length : 0;
  const sims = (["sim0", "sim1", "sim2"] as const).slice(0, simCards);
  let cards: Layout["cards"];
  if (fam === "math") cards = config.reference ? ["claims", "reference", "claim", "overlay"] : ["claims", "claim"];
  else if (fam === "science") cards = [...sims, "claims"];
  else if (fam === "history") cards = ["file", "claims"];
  else cards = ["claims"];
  if (record && !cards.includes("file")) cards = (["file", ...cards] as Layout["cards"][number][]).slice(0, 4); // FILE first under RECORD (A6)
  return { cards };
}
function slotOf(layout: Layout, card: Layout["cards"][number]): number {
  return layout.cards.indexOf(card);
}

interface SimCard {
  title: string;
  color: FnColor;
  y: [number, number];
  yUnit: AxisUnit;
  fn: (x: number, config: ClaimHoldersConfig) => number;
  chip: (v: number) => string;
}
interface SimCardSet {
  cards: readonly SimCard[];
  /** tier-2 overlay annotations per card index, as a function of the probe value */
  overlay: (x: number, config: ClaimHoldersConfig) => readonly { card: number; a: GraphAnnotation }[];
  /** live dots from the sim readout: card index, y */
  dots: (x: number, readout: Readonly<Record<string, number>>) => readonly { card: number; y: number; color: FnColor }[];
}
const mM = (v: number) => `${fmtNum(v, 1)} mM`;
export const SIM_CARDS: Readonly<Record<RefSimId, SimCardSet>> = {
  bilayer_probe: {
    cards: [
      { title: "polar(d)", color: "f", y: [0, 1], yUnit: "number", fn: (d) => bilayerPolar(d), chip: (v) => `polar ${fmtNum(v)}` },
      { title: "ΔG ion(d)", color: "g", y: [0, 40], yUnit: "number", fn: (d) => 40 * (1 - bilayerPolar(d)), chip: (v) => `ΔG ${Math.round(v)}` },
    ],
    overlay: () => [
      { card: 0, a: { kind: "shade", x0: 0, x1: 1, y0: null, y1: null, color: "f", alpha: 0.15, label: "heads" } },
      { card: 0, a: { kind: "shade", x0: 4, x1: 5, y0: null, y1: null, color: "f", alpha: 0.15, label: "heads" } },
    ],
    dots: () => [],
  },
  diffusion_tank: {
    cards: [
      { title: "C_L start", color: "f", y: [0, 10], yUnit: "mM", fn: (a) => a, chip: mM },
      { title: "C_eq", color: "g", y: [0, 10], yUnit: "mM", fn: (a) => a / 2, chip: mM },
      { title: "J₀", color: "h", y: [0, 4], yUnit: "rate", fn: (a) => 0.35 * a, chip: (v) => `${fmtNum(v, 1)}/s` },
    ],
    overlay: (a) => [{ card: 0, a: { kind: "hline", y: a / 2, label: "where it's headed", style: "dashed", color: "g" } }],
    dots: (a, r) => [
      ...(r.cL !== undefined ? [{ card: 0, y: r.cL, color: "f" as const }] : []),
      ...(r.cR !== undefined ? [{ card: 1, y: r.cR, color: "g" as const }] : []),
    ].filter((d) => Number.isFinite(d.y) && a >= 0),
  },
  osmotic_cell: {
    cards: [
      { title: "salt outside", color: "f", y: [0, 10], yUnit: "percent", fn: (s) => s, chip: (v) => `${fmtNum(v, 1)}%` },
      { title: "salt inside", color: "g", y: [0, 10], yUnit: "percent", fn: (_s, c) => simParam(c, "cIn", 2), chip: (v) => `${fmtNum(v, 1)}%` },
      { title: "V/V₀(s)", color: "h", y: [0, 1.6], yUnit: "number", fn: (s, c) => osmoticVolume(s, simParam(c, "cIn", 2), simParam(c, "b", 0.3)), chip: (v) => fmtNum(v) },
    ],
    overlay: (_s, c) => [
      { card: 0, a: { kind: "vline", x: simParam(c, "cIn", 2), label: "isotonic", style: "dashed", color: "h" } },
      { card: 2, a: { kind: "vline", x: simParam(c, "cIn", 2), label: "isotonic", style: "dashed", color: "h" } },
    ],
    dots: () => [],
  },
  pump_flume: {
    cards: [
      { title: "C_high(r)", color: "f", y: [0, 10], yUnit: "mM", fn: (r) => flumeSteady(r).cHigh, chip: mM },
      { title: "C_low(r)", color: "g", y: [0, 10], yUnit: "mM", fn: (r) => flumeSteady(r).cLow, chip: mM },
      { title: "ATP spent/s", color: "gold", y: [0, 10], yUnit: "rate", fn: (r) => Math.max(r, 0), chip: (v) => `${fmtNum(v, 1)}/s` },
    ],
    overlay: () => [{ card: 0, a: { kind: "marker", x: 0, y: 5, label: "no ATP", focusable: false } }],
    dots: (_r, rd) => [
      ...(rd.cHigh !== undefined ? [{ card: 0, y: rd.cHigh, color: "f" as const }] : []),
      ...(rd.cLow !== undefined ? [{ card: 1, y: rd.cLow, color: "g" as const }] : []),
    ].filter((d) => Number.isFinite(d.y)),
  },
};
/** Claim renders that also draw on a card (the claim's prediction, `ghost` plot style; cell §5.7). */
export const GHOST_CURVES: Readonly<Record<string, { card: number; fn: (x: number) => number }>> = {
  downhill_boost: { card: 0, fn: (r) => 5 - flumeSteady(r).dC / 2 },
};

type GraphCard = Extract<CardModel, { kind: "graph" }>;
type TimelineCardModel = Extract<CardModel, { kind: "timeline" }>;
type ClaimsCardModel = Extract<CardModel, { kind: "claims" }>;

function probeAxis(config: ClaimHoldersConfig): { x0: number; x1: number; unit: AxisUnit; label: string | null } {
  const p = config.probe;
  if (p) return { x0: p.min, x1: p.max, unit: axisUnitOf(p), label: p.symbol };
  return { x0: 0, x1: 10, unit: "number", label: null };
}
function refDomain(config: ClaimHoldersConfig): { x0: number; x1: number; unit: AxisUnit } {
  const [x0, x1] = referenceDomain(config);
  return { x0, x1, unit: config.reference?.xUnit === "number" ? "number" : "pi" };
}
function midlineOf(config: ClaimHoldersConfig): number {
  if (!config.reference) return 0;
  const { x0, x1 } = refDomain(config);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < 64; i++) {
    const y = evalExpr(config.reference.expr, x0 + ((x1 - x0) * i) / 63);
    if (y !== null) {
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
  }
  const mid = Number.isFinite(lo) ? (lo + hi) / 2 : 0;
  return Math.abs(mid) < 1e-6 ? 0 : Math.round(mid * 1000) / 1000;
}
function graph(slot: number, title: string, x: { x0: number; x1: number; unit: AxisUnit; label?: string | null }, y: [number, number], yUnit: AxisUnit, plots: PlotModel[], annotations: GraphAnnotation[], sr: string, empty = false): GraphCard {
  return {
    kind: "graph",
    slot,
    title,
    tab: title,
    x: axisModel(x.x0, x.x1, x.unit, x.label ?? null),
    y: axisModel(y[0], y[1], yUnit, null),
    plots,
    annotations,
    columns: [],
    targetLine: null,
    empty,
    sr,
  };
}

function claimsCard(slot: number, config: ClaimHoldersConfig, view: unknown, aim: AimState | null): ClaimsCardModel {
  const chests = chestsOf(view);
  const spec = config.probe;
  const scenario = config.scenarioMin !== null && spec ? `claims apply when ${spec.symbol} > ${config.scenarioMin}${spec.unit ? ` ${spec.unit}` : ""}` : null;
  const items = chests.map((c, i) => ({
    key: String(c.statementIndex),
    letter: LETTERS[i] ?? String(i + 1),
    text: c.text,
    glyph: null,
    state: (aim && aim.committed === i ? "aimed" : aim && aim.preview && aim.aimed === i ? "hover" : "idle") as ClaimsCardModel["items"][number]["state"],
  }));
  const aimedText = aim && aim.aimed !== null ? ` Aimed: ${LETTERS[aim.aimed]}.` : "";
  return { kind: "claims", slot, title: "claims", scenario, items, sr: `${chests.length} claims, one is the mimic.${aimedText}` };
}

function referenceCard(slot: number, config: ClaimHoldersConfig, aidTier: number): GraphCard {
  const ref = config.reference!;
  const dom = refDomain(config);
  const yr = ref.yMax - ref.yMin;
  const plot = samplePlot("reference", "f", "solid", (x) => evalExpr(ref.expr, x), dom.x0, dom.x1, yr);
  const mid = midlineOf(config);
  const ann: GraphAnnotation[] = [{ kind: "hline", y: mid, label: aidTier >= config.secondaryTier ? "midline" : null, style: "dashed", color: "h" }];
  return graph(slot, "reference", dom, [ref.yMin, ref.yMax], "number", [plot], ann, `Reference y = ${ref.expr}, x from ${fmtPi(dom.x0)} to ${fmtPi(dom.x1)}.`);
}

function claimTraceCard(slot: number, config: ClaimHoldersConfig, aimedIndex: number | null, aidTier: number): GraphCard {
  const dom = refDomain(config);
  const yLim: [number, number] = config.reference ? [config.reference.yMin, config.reference.yMax] : [-4, 4];
  const holder = aimedIndex === null ? null : config.holders.find((h) => h.statementIndex === aimedIndex);
  const trace = holder?.trace ?? null;
  if (!trace) return graph(slot, "claim", dom, yLim, "number", [], [], "No claim aimed yet: the claim card is empty.", true);
  const plots = trace.fns.map((f, j) => samplePlot(`claim_${j}`, f.color, f.style, (x) => evalExpr(f.expr, x), dom.x0, dom.x1, yLim[1] - yLim[0]));
  const ann: GraphAnnotation[] = [];
  for (const b of trace.brackets) {
    const [x0, y0, x1, y1] = [b.x0, b.y0, b.x1, b.y1].map((e) => exprValue(e) ?? 0);
    ann.push({ kind: "bracket", x0, y0, x1, y1, label: b.label, color: "g", orient: Math.abs(x1 - x0) < 1e-9 ? "vertical" : "horizontal" });
  }
  if (config.reference) ann.push({ kind: "hline", y: midlineOf(config), label: aidTier >= config.secondaryTier ? "midline" : null, style: "dashed", color: "h" });
  return graph(slot, "claim", dom, yLim, "number", plots, ann, `The aimed claim drawn literally: ${trace.fns.map((f) => f.expr).join(" and ")}; ${trace.brackets.map((b) => b.label).join(", ") || "no brackets"}.`);
}

function overlayCard(slot: number, config: ClaimHoldersConfig, aimedIndex: number | null, aidTier: number): GraphCard {
  const dom = refDomain(config);
  const yLim: [number, number] = config.reference ? [config.reference.yMin, config.reference.yMax] : [-4, 4];
  const unlocked = aidTier >= config.overlayTier;
  const markers = config.holders.some((h) => (h.trace?.markers.length ?? 0) > 0);
  if (markers) {
    const trace = aimedIndex === null ? null : (config.holders.find((h) => h.statementIndex === aimedIndex)?.trace ?? null);
    if (!unlocked || !trace) return graph(slot, "period marks", dom, yLim, "number", [], [], "Period marks: empty.", true);
    const plot = samplePlot("marks_trace", "h", "ghost", (x) => evalExpr(trace.fns[0].expr, x), dom.x0, dom.x1, yLim[1] - yLim[0]);
    const ann: GraphAnnotation[] = trace.markers.map((m) => {
      const x = exprValue(m.x) ?? 0;
      const y = exprValue(m.y) ?? 0;
      return m.kind === "period" ? { kind: "period_marker" as const, x, y, color: "h" as const } : { kind: "marker" as const, x, y, label: m.kind, focusable: false };
    });
    return graph(slot, "period marks", dom, yLim, "number", [plot], ann, `${trace.markers.length} period marks on the aimed trace.`);
  }
  if (!unlocked || !config.reference) return graph(slot, "|y|", dom, [0, yLim[1]], "number", [], [], "The |y| card is empty.", true);
  const ref = config.reference;
  const plot = samplePlot("abs_ref", "h", "solid", (x) => {
    const y = evalExpr(ref.expr, x);
    return y === null ? null : Math.abs(y);
  }, dom.x0, dom.x1, yLim[1]);
  let peak = 0;
  let peakX = dom.x0;
  for (const s of plot.segments) for (const [x, y] of s) if (y > peak) [peak, peakX] = [y, x];
  const ann: GraphAnnotation[] = [{ kind: "marker", x: peakX, y: peak, label: trimNum(Math.round(peak * 100) / 100), focusable: false }];
  return graph(slot, "|y|", dom, [0, Math.max(Math.abs(yLim[0]), Math.abs(yLim[1]))], "number", [plot], ann, `|y| of the reference, peak ${trimNum(Math.round(peak * 100) / 100)}.`);
}

function simCard(slot: number, index: number, config: ClaimHoldersConfig, aidTier: number, x: number | null, readout: Readonly<Record<string, number>>, ghost: string | null): GraphCard {
  const set = SIM_CARDS[config.referenceSim!.id];
  const def = set.cards[index];
  const ax = probeAxis(config);
  const plots = [samplePlot(`sim_${index}`, def.color, "solid", (v) => def.fn(v, config), ax.x0, ax.x1, def.y[1] - def.y[0])];
  const g = ghost ? GHOST_CURVES[ghost] : undefined;
  if (g && g.card === index) plots.push(samplePlot(`ghost_${ghost}`, "g", "ghost", g.fn, ax.x0, ax.x1, def.y[1] - def.y[0]));
  const px = x ?? config.probe?.initial ?? ax.x0;
  const ann: GraphAnnotation[] = aidTier >= config.overlayTier ? set.overlay(px, config).filter((o) => o.card === index).map((o) => o.a) : [];
  if (x !== null) for (const d of set.dots(x, readout)) if (d.card === index) ann.push({ kind: "live_dot", x, y: d.y, color: d.color });
  return graph(slot, def.title, ax, def.y, def.yUnit, plots, ann, `${def.title} against ${ax.label ?? "the probe"}.`);
}

function fileCard(slot: number, config: ClaimHoldersConfig, aimedIndex: number | null, hintsUsed: number, record: boolean): TimelineCardModel {
  const pins: TimelineCardModel["pins"][number][] = [];
  const bands: TimelineCardModel["bands"][number][] = [];
  const arrows: TimelineCardModel["arrows"][number][] = [];
  config.fileDates.forEach((f, i) => {
    const at = fracYearOf(f.date);
    if (at !== null) pins.push({ key: `file:${i}`, at, label: f.label, lane: null, style: "earned", spanTo: null });
  });
  for (const h of config.holders) {
    const fp = h.footprint;
    if (!fp) continue;
    const aimed = h.statementIndex === aimedIndex;
    const style = aimed ? ("draft" as const) : ("dim" as const);
    const from = fracYearOf(fp.from);
    const to = fp.to ? fracYearOf(fp.to) : null;
    if (from === null) continue;
    const key = `fp:${h.statementIndex}`;
    if (fp.kind === "arrow" && to !== null) {
      pins.push({ key: `${key}:from`, at: from, label: fp.label, lane: null, style, spanTo: null });
      pins.push({ key: `${key}:to`, at: to, label: fp.label, lane: null, style, spanTo: null });
      arrows.push({ fromKey: `${key}:from`, toKey: `${key}:to` });
    } else {
      pins.push({ key, at: from, label: fp.label, lane: null, style, spanTo: fp.kind === "band" ? to : null });
      if (aimed && fp.kind === "band" && to !== null) bands.push({ from, to, label: fp.label, color: "g" });
    }
  }
  if (!record) {
    config.hintPins.forEach((p, i) => {
      const at = fracYearOf(p.date);
      if (at !== null && hintsUsed >= p.rung) pins.push({ key: `hint:${i}`, at, label: p.label, lane: null, style: "hint", spanTo: null });
    });
  }
  const w = config.probe?.window ?? null;
  const ats = pins.map((p) => p.at);
  const from = w ? w.start : ats.length ? Math.floor(Math.min(...ats)) - 1 : 1950;
  const to = w ? w.end : ats.length ? Math.ceil(Math.max(...ats)) + 1 : 1970;
  const early = ats.filter((a) => a < from);
  const axisBreak = early.length ? { from: Math.min(...early), to: from } : null;
  const aimedFp = aimedIndex === null ? null : config.holders.find((h) => h.statementIndex === aimedIndex)?.footprint;
  const sr = `FILE, ${Math.round(from)} to ${Math.round(to)}: ${pins.length} marks${aimedFp ? `; the aimed claim sits at ${aimedFp.from}${aimedFp.to ? `–${aimedFp.to}` : ""}` : ""}.`;
  return { kind: "timeline", slot, title: "FILE", tab: "FILE", from, to, unit: "year", lanes: [], pins, bands, arrows, axisBreak, sr };
}

function buildCards(
  config: ClaimHoldersConfig,
  view: unknown,
  record: boolean,
  aidTier: number,
  hintsUsed: number,
  aim: AimState | null,
  x: number | null,
  readout: Readonly<Record<string, number>>,
  ghost: string | null,
): CardModel[] {
  const layout = layoutOf(config, record);
  const aimedIndex = aim?.aimedIndex ?? null;
  return layout.cards.map((c, slot): CardModel => {
    switch (c) {
      case "file":
        return fileCard(slot, config, aimedIndex, hintsUsed, record);
      case "claims":
        return claimsCard(slot, config, view, aim);
      case "reference":
        return referenceCard(slot, config, aidTier);
      case "claim":
        return claimTraceCard(slot, config, aimedIndex, aidTier);
      case "overlay":
        return overlayCard(slot, config, aimedIndex, aidTier);
      default:
        return simCard(slot, Number(c.slice(3)), config, aidTier, x, readout, ghost);
    }
  });
}

function claimPanelStatic(input: StaticInput<ClaimHoldersConfig>): PanelStatic {
  const { config } = input;
  const recordPins = input.record
    ? config.hintPins.flatMap((p, i) => {
        const at = fracYearOf(p.date);
        return at !== null && input.hintsUsed >= p.rung ? [{ key: `hint:${i}`, at, label: p.label, style: "hint" as const }] : [];
      })
    : [];
  return {
    cards: buildCards(config, input.view, input.record, input.aidTier, input.hintsUsed, null, null, {}, null),
    input: null,
    probe: config.probe,
    recordPins,
  };
}

/** Whether panelStatic ran with StaticInput.record (panelLive only sees the static model). */
function recordFromStatic(stat: PanelStatic, config: ClaimHoldersConfig): boolean {
  if (stat.recordPins.length > 0) return true;
  const withRecord = layoutOf(config, true).cards;
  if (withRecord.join() === layoutOf(config, false).cards.join()) return false; // same cards either way; no hint pin unlocked
  return stat.cards.length === withRecord.length && stat.cards[0]?.kind === "timeline";
}

function claimPanelLive(stat: PanelStatic, input: PoseInput<ClaimHoldersConfig, ClaimHoldersSim | null>): PanelLive {
  const { config, view } = input;
  const record = recordFromStatic(stat, config);
  const layout = layoutOf(config, record);
  const aim = aimStateOf(view, input.draft);
  const scenarioOk = scenarioOkOf(config, input.probe);
  const holder = aim.aimedIndex === null ? null : config.holders.find((h) => h.statementIndex === aim.aimedIndex);
  const ghost = familyOf(config) === "science" && scenarioOk && holder?.ghost ? holder.ghost : null;
  const readout = input.sim ? claimHoldersSim.readout(input.sim) : {};
  const x = input.probe;
  const liveCards = buildCards(config, view, record, input.aidTier, input.hintsUsed, aim, x, readout, ghost);
  const chips: PanelLive["chips"][number][] = [];
  if (x !== null) {
    const refSlot = slotOf(layout, "reference");
    if (refSlot >= 0 && config.reference) {
      const y = evalExpr(config.reference.expr, x);
      if (y !== null) chips.push({ slot: refSlot, value: y, text: fmtNum(y), color: "f" });
    }
    const claimSlot = slotOf(layout, "claim");
    const tExpr = holder?.trace?.fns[0]?.expr;
    if (claimSlot >= 0 && tExpr) {
      const y = evalExpr(tExpr, x);
      if (y !== null) chips.push({ slot: claimSlot, value: y, text: fmtNum(y), color: "g" });
    }
    const ovSlot = slotOf(layout, "overlay");
    if (ovSlot >= 0 && config.reference && input.aidTier >= config.overlayTier) {
      const y = evalExpr(tExpr ?? config.reference.expr, x);
      if (y !== null) chips.push({ slot: ovSlot, value: Math.abs(y), text: fmtNum(Math.abs(y)), color: "h" });
    }
    if (config.referenceSim) {
      SIM_CARDS[config.referenceSim.id].cards.forEach((def, i) => {
        const slot = slotOf(layout, `sim${i}` as Layout["cards"][number]);
        const v = def.fn(x, config);
        if (slot >= 0 && Number.isFinite(v)) chips.push({ slot, value: v, text: def.chip(v), color: def.color });
      });
    }
  }
  const claimsSlot = slotOf(layout, "claims");
  const highlights: PanelLive["highlights"][number][] = [];
  if (aim.aimedIndex !== null) highlights.push({ slot: claimsSlot, key: String(aim.aimedIndex), state: aim.preview ? "hover" : "focus" });
  const readoutText = x !== null && config.probe ? formatProbe(x, config.probe) : aim.aimed !== null ? `aim: ${LETTERS[aim.aimed]}` : null;
  return { scrubX: x, readout: readoutText, chips, highlights, liveCards };
}

// ================================================================ hints, audio, plans

function claimHintTargets(rung: HintRung, input: StaticInput<ClaimHoldersConfig>): readonly HintTarget[] {
  const skin = skinById(CLAIM_HOLDERS_SKINS, input.skinId);
  const base = skin?.hintTargets[rung - 1] ?? [];
  const extra: HintTarget[] = [];
  // config-driven additions (A7): science apparatus on rung 1 when a skin has no apparatus target
  if (rung === 1 && input.config.referenceSim && skin?.anchors.includes("apparatus")) extra.push(ht("apparatus", "circle", 2000));
  return withExtraTargets(base, extra);
}

function claimAudio(pose: ClaimHoldersPose, input: PoseInput<ClaimHoldersConfig, ClaimHoldersSim | null>): AudioParam[] {
  const rig = AIM_RIGS[input.config.aimer];
  if (!rig.liveCue) return [];
  if (input.config.probeWorld === "trace_slate") return [{ cue: rig.liveCue, pitch: pitchHzOf(pose.bell), gain: 0.15 }];
  if (pose.beam > 0) return [{ cue: rig.liveCue, pitch: 1, gain: 0.08 * pose.beam }];
  return [];
}
/** The bell hum: pitchHz = 220 · 2^(|f(x)| / max(|yMin|, |yMax|)) (trig §5.3/§5.5). */
export function pitchHzOf(bell: number): number {
  return 220 * 2 ** bell;
}

function claimFailurePlan(d: Diagnosis, input: PoseInput<ClaimHoldersConfig, ClaimHoldersSim | null>): FailurePlan {
  const { config, view } = input;
  const rig = AIM_RIGS[config.aimer];
  const key = d.wrongKeys[0];
  const slot = key === undefined ? null : slotOfStatement(view, Number(key));
  const beats: FailBeat[] = [];
  if (slot !== null) {
    beats.push({ atMs: 0, anchor: `${rig.surfaceAnchor}${slot}`, action: "hold_bright", params: { slot, holdMs: 2000 } });
    beats.push({ atMs: 0, anchor: `${rig.holderAnchor}${slot}`, action: "flash", params: { slot, glyph: "bell" } });
    const holder = config.holders.find((h) => String(h.statementIndex) === key);
    if (holder?.ghost && config.referenceSim) beats.push({ atMs: 100, anchor: "ghost_origin", action: "flash", params: { ghost: holder.ghost, register: 1, alpha: 0.8 } });
  }
  beats.push({ atMs: 200, anchor: rig.aimAnchor, action: "dim", params: { flicker: 1 } });
  const sim = config.referenceSim?.id;
  if (sim === "bilayer_probe") beats.push({ atMs: 300, anchor: "apparatus", action: "wobble", params: { amp: 2, ms: 200 } });
  if (sim === "diffusion_tank") beats.push({ atMs: 300, anchor: "apparatus", action: "flash", params: { trail: 1, ms: 1000 } });
  if (sim === "osmotic_cell") beats.push({ atMs: 300, anchor: "apparatus", action: "flash", params: { cubes: 3 } });
  if (sim === "pump_flume") beats.push({ atMs: 300, anchor: "apparatus", action: "stall", params: { strokes: 1 } });
  return { beats, durationMs: 1200, cue: "bell_honest" };
}

function payoffAnchorOf(aimer: Aimer, anim: PayoffAnim): string {
  if (aimer === "tuning_lens") return anim === "lift_moves" ? "lift" : "chest_hinge";
  if (aimer === "probe_emitter") return "apparatus";
  return anim === "stairs_rise" ? "steps" : "console";
}
const PAYOFF_ACTION: Readonly<Partial<Record<PayoffAnim, SuccessBeat["action"]>>> = {
  lift_moves: "rise", stairs_rise: "rise", ramp_forms: "rise", barrier_lifts: "rise", water_rises: "flood", door_opens: "open",
  bridge_forms: "rise", beam_restores: "ignite", steps_emerge: "rise", gate_lifts: "rise", vesicle_carries: "ride",
};

function claimSuccessPlan(input: PoseInput<ClaimHoldersConfig, ClaimHoldersSim | null>, anim: PayoffAnim): SuccessPlan {
  const { config, view } = input;
  const rig = AIM_RIGS[config.aimer];
  const aim = aimStateOf(view, input.draft);
  const k = aim.committed;
  const n = chestsOf(view).length;
  const others = Array.from({ length: n }, (_, i) => i).filter((i) => i !== k);
  const at = (i: number | null) => (i === null ? rig.aimAnchor : `${rig.holderAnchor}${i}`);
  const surf = (i: number | null) => (i === null ? rig.aimAnchor : `${rig.surfaceAnchor}${i}`);
  const beats: SuccessBeat[] = [{ atMs: 0, anchor: rig.aimAnchor, action: "ignite", params: { color: "gold" } }];
  const q: QuarantineAnim = config.quarantineAnim; // success-only
  let payoffAt = 1400;
  let durationMs = 2400;
  switch (q) {
    case "mimic_crab":
      beats.push({ atMs: 0, anchor: at(k), action: "ignite", params: { crack: 1, cue: "mimic_hiss" } });
      beats.push({ atMs: 200, anchor: at(k), action: "open", params: { part: "faceplate" } });
      beats.push({ atMs: 600, anchor: at(k), action: "dissolve", params: { prop: "mimic_crab", scuttle: 1 } });
      others.forEach((i, j) => beats.push({ atMs: 1400 + j * 60, anchor: at(i), action: "cycle", params: { chord: 1 } }));
      break;
    case "ridge_thaw":
    case "tank_dilate":
    case "raft_lock_flood":
    case "lanterns_ignite":
      beats.push({ atMs: 0, anchor: surf(k), action: q === "raft_lock_flood" ? "flood" : q === "lanterns_ignite" ? "ignite" : q === "tank_dilate" ? "open" : "stamp", params: { quarantine: q } });
      beats.push({ atMs: 250, anchor: surf(k), action: "dissolve", params: { prop: "mimic_mote" } });
      others.forEach((i) => beats.push({ atMs: 400, anchor: surf(i), action: "spin", params: { deg: 30 } }));
      if (q === "lanterns_ignite") beats.push({ atMs: 900, anchor: "apparatus", action: "light_sequence", params: { count: 12, staggerMs: 80 } });
      payoffAt = 900;
      break;
    case "retract_stamp":
      beats.push({ atMs: 300, anchor: surf(k), action: "stamp", params: { text: "RETRACTED", rotateDeg: -8 } });
      beats.push({ atMs: 700, anchor: at(k), action: "lower", params: { flutter: 1 } });
      others.forEach((i) => beats.push({ atMs: 1100, anchor: surf(i), action: "light_sequence", params: { merge: 1 } }));
      beats.push({ atMs: 1200, anchor: payoffAnchorOf(config.aimer, anim), action: "print", params: { sweepMs: 800 } });
      payoffAt = 1300;
      durationMs = 2100;
      break;
  }
  beats.push({ atMs: payoffAt, anchor: payoffAnchorOf(config.aimer, anim), action: PAYOFF_ACTION[anim] ?? "open", params: { anim } });
  beats.sort((a, b) => a.atMs - b.atMs);
  const claimSlot = slotOf(layoutOf(config, false), "claim");
  const cardEffects = claimSlot >= 0 && aim.aimedIndex !== null ? [{ atMs: 600, slot: claimSlot, effect: "shatter_bracket", key: String(aim.aimedIndex) }] : [];
  return { beats, cardEffects, durationMs, cue: rig.succeedCue };
}

// ================================================================ geometry for the host

function claimFootprint(config: ClaimHoldersConfig): Footprint2D {
  const rig = AIM_RIGS[config.aimer];
  const half = rig.spacing * 1.5 + 140;
  return { left: Math.max(half - rig.cx, -rig.aimer.x + 120), right: Math.max(half + rig.cx, rig.aimer.x + 120), height: Math.abs(Math.min(rig.holderY, rig.aimer.y)) + 200 };
}
function claimFrameBounds(config: ClaimHoldersConfig, view: unknown): Bounds {
  const rig = AIM_RIGS[config.aimer];
  const n = Math.max(2, chestsOf(view).length || 3);
  const xs = [rig.aimer.x, holderPos(rig, n, 0).x, holderPos(rig, n, n - 1).x];
  const x0 = Math.min(...xs) - 260;
  const x1 = Math.max(...xs) + 260;
  const y0 = Math.min(rig.aimer.y, rig.holderY) - 320;
  return { x: x0, y: y0, w: x1 - x0, h: 120 - y0 };
}

function claimDebug(pose: ClaimHoldersPose): Record<string, number | string | boolean> {
  const out: Record<string, number | string | boolean> = {
    aimed: pose.aimed ?? -1,
    committed: pose.committed ?? -1,
    preview: pose.preview,
    aimAngle: pose.aimAngle,
    beam: pose.beam,
    ghost: pose.ghost ?? "",
    ghostAlpha: pose.ghostAlpha,
    scenarioOk: pose.scenarioOk,
    slatePlayhead: pose.playheadX ?? -1,
    traceY: pose.traceY ?? 0,
    bell: pose.bell,
    highlight: pose.highlight,
    quarantined: pose.quarantined ?? -1,
    gate: pose.gate,
    solved: pose.solved,
  };
  for (const [k, v] of Object.entries(pose.apparatus)) out[k] = v;
  return out;
}

// ================================================================ meta

export const claimHoldersMeta: ContraptionMeta<ClaimHoldersConfig, ClaimHoldersPose, ClaimHoldersSim | null> = {
  id: "claim_holders",
  name: "Claim Holders",
  modes: ["truth_finder.mimic"],
  tier: "native",
  status: "demo",
  reusable: "any_subject",
  layouts: ["board", "scrub"],
  defaultLayout: "board",
  payoffs: ["lift_moves", "stairs_rise", "ramp_forms", "barrier_lifts", "water_rises", "door_opens", "bridge_forms", "beam_restores"],
  nearMissKeys: [],
  accessories: ["record_lens"],
  skins: CLAIM_HOLDERS_SKINS,
  control: "aim",
  configSchema: ClaimHoldersConfig,
  validateConfig: (config, ctx) => validateClaimHolders(config, ctx),
  defaultConfig(ctx: ConfigCtx): ClaimHoldersConfig {
    // text-only claims (amendment 39); history biomes get a year probe spanning the years in the texts ± 1.
    // TODO(w1): the §4.4 evidence card (slot 1 = `document` with encounter.sourceRef.quote) needs a config field to
    // carry the quote (metas never see the encounter at runtime); proposed ClaimHoldersConfig.evidence in the KA1 report.
    const years = ctx.biome === "archive_of_voices" ? ctx.texts.flatMap(findYears) : [];
    const probe = yearProbeFor(years);
    return ClaimHoldersConfig.parse({
      holders: statementIndicesOf(ctx.view).map((statementIndex) => ({ statementIndex })),
      probe,
      probeWorld: probe ? "record_lens" : "none",
      ...aimerFor(ctx.biome),
    });
  },
  writerConfigSchema: (ctx) => claimHoldersWriterSchema(ctx),
  fromWriterConfig(w: unknown, ctx: ConfigCtx): ClaimHoldersConfig {
    const wc = w as ClaimHoldersWriter;
    const probe = probeFromWriter(wc.probe);
    return ClaimHoldersConfig.parse({
      holders: wc.holders.map((h) => ({
        statementIndex: h.statementIndex,
        trace: h.trace ? { fns: h.trace.fns.map((f) => ({ expr: f.expr, style: f.style })), brackets: h.trace.brackets } : null,
        ghost: h.ghost,
        footprint: h.footprint,
      })),
      referenceSim: wc.referenceSim ? { id: wc.referenceSim } : null,
      probe,
      probeWorld: probe && (probe.format === "year" || probe.format === "month_year") ? "record_lens" : "none",
      ...aimerFor(ctx.biome),
    });
  },
  footprint: claimFootprint,
  frameBounds: claimFrameBounds,
  probe: (config) => config.probe,
  clock: { resetOn: ["open"] },
  sim: claimHoldersSim,
  pose: claimPose,
  lerp: lerpClaimPose,
  describe: claimDescribe,
  panelStatic: claimPanelStatic,
  panelLive: claimPanelLive,
  hintTargets: claimHintTargets,
  audio: claimAudio,
  failurePlan: claimFailurePlan,
  successPlan: claimSuccessPlan,
  solvedPose: (input) => claimPose({ ...input, solved: true }),
  debug: claimDebug,
};

/**
 * claim_holders — truth_finder.mimic (docs/design/20 §4 row 4, §4.2, §4.4). 3–4 holders with plaques; an aimer swings
 * its beam; claim renders: trace slates (math), ghosts over a live reference sim (science), footprints on the FILE
 * card (history). W0 stub: REAL config/writer/validators/defaults; console-slate live half (KA replaces it).
 */
import { z } from "zod";
import type { ConfigCtx, ConfigIssue, ContraptionMeta, WriterCtx } from "../types";
import {
  coverExactlyOnce,
  dateParts,
  err,
  exprEvaluatesOver,
  exprValue,
  findYears,
  probeRangeIssues,
  statementIndicesOf,
  warn,
  yearAppearsIn,
  yearProbeFor,
} from "./config-parts";
import { slateLive, type SlatePose } from "./placeholder";
import { defineSkin } from "./skin-kit";
import { probeFromWriter, wDate, wEnumOrNull, wExpr, wProbe, type WriterProbe } from "./writer-kit";
import { ClaimHoldersConfig, type Aimer, type QuarantineAnim, type RefSimId } from "./claim-holders.config";
import { ghostIdsForDomain, REF_SIM_GHOSTS, simIdsForDomain } from "../sims";
export { ClaimHoldersConfig, CLAIM_HOLDERS_SUCCESS_ONLY, RefSimId } from "./claim-holders.config";

// ---------------------------------------------------------------- skins (§4.3 + the round-2 slots)

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
    hintAnchors: ["lens", "slate_0", "holder_0"],
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
    hintAnchors: ["lens", "slate_0", "chest_hinge"],
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
    hintAnchors: ["apparatus", "ghost_origin", "pod_0"],
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
    hintAnchors: ["lamp_pivot", "panel_0", "lens_0"],
  }),
] as const;

/** aimer / quarantine animation per biome (BIOME_KITS.skinDefaults supersedes this once V1 lands). */
const BIOME_AIMER: Readonly<Record<string, { aimer: z.infer<typeof Aimer>; quarantineAnim: z.infer<typeof QuarantineAnim> }>> = {
  orrery_terraces: { aimer: "tuning_lens", quarantineAnim: "mimic_crab" },
  living_gate: { aimer: "probe_emitter", quarantineAnim: "ridge_thaw" },
  archive_of_voices: { aimer: "arc_lamp", quarantineAnim: "retract_stamp" },
};
function aimerFor(biome: string) {
  return BIOME_AIMER[biome] ?? BIOME_AIMER.orrery_terraces;
}

// ---------------------------------------------------------------- validation (§4.4)

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
      const inX = (v: number) => v >= x0 - 1e-9 && v <= x1 + 1e-9;
      const inY = (v: number) => !yRange || (v >= yRange[0] - 1e-9 && v <= yRange[1] + 1e-9);
      if (!inX(bx0!) || !inX(bx1!) || !inY(by0!) || !inY(by1!)) out.push(err(["holders", i, "trace", "brackets", j], "bracket lies outside the card range"));
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
  if (config.probeWorld !== "none" && !config.probe) out.push(err(["probeWorld"], `probeWorld "${config.probeWorld}" needs a probe`));
  return out;
}

// ---------------------------------------------------------------- writer schema (§4.4)

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

// ---------------------------------------------------------------- meta

/** The archetype's pose. W0 placeholder = the console-slate pose; the owning lane redefines it (skins import this name). */
export type ClaimHoldersPose = SlatePose;

export const claimHoldersMeta: ContraptionMeta<ClaimHoldersConfig, ClaimHoldersPose> = {
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
    // text-only claims (amendment 39); history biomes get a year probe spanning the years in the texts ± 1
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
  ...slateLive<ClaimHoldersConfig>(CLAIM_HOLDERS_SKINS, (c) => c.probe),
};

/**
 * step_bridge — sequencer.linear (docs/design/20 §4 row 6, §4.2, §4.4). Placed planks fly to bays: floating sockets,
 * slabs from water, deck sections, or a stage rail whose probe plays the player's own order through the
 * membrane-fold physics. W0 stub: REAL config/writer/validators/defaults; console-slate live half (KA replaces it).
 * TODO(KA1, with KB1's membrane-fold sim): the stage_rail check "membraneFold(solution.order) ends detached && travel = 1 and no other permutation
 * does" needs src/world/sims/membrane-fold.ts; add it to validateStepBridge when the sim lands.
 */
import { z } from "zod";
import { asTuple } from "../../contracts/slices";
import type { ConfigCtx, ConfigIssue, ContraptionMeta, WriterCtx } from "../types";
import {
  dateAppearsIn,
  err,
  exprEvaluatesOver,
  findDates,
  fracYearOf,
  plankKeysOf,
  probeRangeIssues,
  subsetOf,
  viewTextOf,
  warn,
  yearProbeFor,
} from "./config-parts";
import { slateLive, type SlatePose } from "./placeholder";
import { defineSkin } from "./skin-kit";
import { GLYPH_LIBRARY, probeFromWriter, wDate, wProbe, type WriterProbe } from "./writer-kit";
import { StepBridgeConfig, StepEffect } from "./step-bridge.config";
export { StageId, StepBridgeConfig, StepEffect, STEP_BRIDGE_SUCCESS_ONLY } from "./step-bridge.config";

export const STEP_BRIDGE_SKINS = [
  defineSkin({
    id: "floating_steps",
    name: "Floating Steps",
    ns: "orrery_terraces",
    nouns: ["span", "steps", "stones", "sockets", "bridge", "Solving Span", "plank", "planks"],
    parts: [
      ["socket", "K"], ["stone", "K"], ["glyph", "H"], ["cradle", "K"], ["pylon", "K"], ["chasm_edge", "K"], ["relief", "K"], ["console", "K"],
    ],
    anchors: ["socket_0…3", "cradle_0…4", "pylon_a", "pylon_b", "lip_relief", "console"],
    cues: { live: "stud_tick", succeed: "stone_lock_thunk", fail: "stone_grind" },
    hintAnchors: ["cradle_0", "socket_0", "pylon_a"],
  }),
  defineSkin({
    id: "walking_road",
    name: "Walking Road",
    ns: "archive_of_voices",
    nouns: ["road", "route", "slabs", "slab", "bus", "Walking Road", "day counter"],
    parts: [["slab", "K"], ["city_bus", "H"], ["bus_stop", "K"], ["day_counter", "K"], ["flood_band", "K"], ["console", "K"]],
    anchors: ["bay_0…3", "day_counter", "route_sign", "console"],
    cues: { live: "stud_tick", succeed: "slab_set", fail: "stone_grind" },
    sensitiveSafe: true,
    hintAnchors: ["route_sign", "day_counter", "bay_0"],
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
    hintAnchors: ["crown", "arch_rail", "bay_0"],
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
    hintAnchors: ["pit_center", "lamp_0", "collar"],
  }),
] as const;

const BIOME_BAYS: Readonly<Record<string, StepBridgeConfig["bays"]>> = {
  orrery_terraces: "floating",
  living_gate: "floating", // stage_rail needs authored stages (cell e10), so defaults never pick it
  archive_of_voices: "flat_road",
};

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
    const staged = new Set(config.stages.map((s) => s.key));
    keys.forEach((k) => {
      if (!staged.has(k)) out.push(err(["stages"], `stage_rail bays need a stage for every plank; "${k}" has none`));
    });
    config.stages.forEach((s, i) => {
      if (s.key.startsWith("d") && s.stageId !== "dissolve_bounce") out.push(err(["stages", i, "stageId"], `decoy "${s.key}" must use the dissolve_bounce stage`));
    });
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
  return out;
}

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

/** The archetype's pose. W0 placeholder = the console-slate pose; the owning lane redefines it (skins import this name). */
export type StepBridgePose = SlatePose;

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
  ...slateLive<StepBridgeConfig>(STEP_BRIDGE_SKINS, (c) => c.probe),
};

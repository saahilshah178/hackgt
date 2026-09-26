/**
 * emitter_rail — mapper.number_line (docs/design/20 §4 row 2, §4.2). A carriage rides a rail (arc for a 2π
 * π-labelled line, straight otherwise, log for log scales); its beam sweeps; the target hides in fog/dark/water.
 * W0 stub: REAL config/validators/defaults; console-slate live half (KA replaces it).
 */
import type { ConfigCtx, ConfigIssue, ContraptionMeta, NumberLineView } from "../types";
import { err, exprValue, warn } from "./config-parts";
import { slateLive, type SlatePose } from "./placeholder";
import { defineSkin } from "./skin-kit";
import { EmitterRailConfig } from "./emitter-rail.config";
export { EmitterRailConfig } from "./emitter-rail.config";

export const EMITTER_RAIL_SKINS = [
  defineSkin({
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
    hintAnchors: ["center", "marker", "beam_origin"],
  }),
] as const;

const TWO_PI = 2 * Math.PI;

/** π-labelled and spanning exactly 2π (the arc rail's precondition). */
export function isTwoPiLine(view: Partial<NumberLineView> | null): boolean {
  if (!view || typeof view.min !== "number" || typeof view.max !== "number") return false;
  const piLabels = (view.landmarks ?? []).some((l) => /π/.test(l.label));
  return view.scale !== "log" && piLabels && Math.abs(view.max - view.min - TWO_PI) < 1e-6;
}

/** The archetype's pose. W0 placeholder = the console-slate pose; the owning lane redefines it (skins import this name). */
export type EmitterRailPose = SlatePose;

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
  nearMissKeys: [], // KA adds keys once describe() detects them (station probes carry the authored ones)
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
  writerConfigSchema: () => null,
  fromWriterConfig(_w: unknown, ctx: ConfigCtx): EmitterRailConfig {
    return emitterRailMeta.defaultConfig(ctx);
  },
  ...slateLive<EmitterRailConfig>(EMITTER_RAIL_SKINS),
};

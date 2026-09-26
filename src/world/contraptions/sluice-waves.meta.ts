/**
 * sluice_waves — sorter.type_match (docs/design/20 §4 row 8, §4.2, §4.4). One cell per wave drifts to the lock;
 * hovering a valve renders the claimed bath or flow; committing floods the lock and sends the cell to a basin.
 * W0 stub: REAL config/writer/validators/defaults; console-slate live half (KB replaces it).
 */
import { z } from "zod";
import type { ConfigCtx, ConfigIssue, ContraptionMeta, WriterCtx } from "../types";
import { categoryIdsOf, coverExactlyOnce, err, viewTextOf, warn, waveIndicesOf } from "./config-parts";
import { slateLive, type SlatePose } from "./placeholder";
import { defineSkin } from "./skin-kit";
import { SluiceCell, SluiceFate, SluiceWavesConfig } from "./sluice-waves.config";
export { SluiceCell, SluiceFate, SluiceWavesConfig } from "./sluice-waves.config";

export const SLUICE_WAVES_SKINS = [
  defineSkin({
    id: "tonicity_sluices",
    name: "Tonicity Sluices",
    ns: "living_gate",
    nouns: ["sluice", "sluices", "lock", "valve", "valves", "basin", "cell", "cells"],
    parts: [
      ["label_lock", "K"], ["lock_leaf", "K"], ["valve_wheel", "H"], ["basin", "K"], ["eddy", "K"],
      ["cell_rbc", "H"], ["cell_generic", "K"], ["cell_plant", "H"], ["cell_potato", "H"], ["cell_protoplast", "K"],
      ["barge", "K"], ["console", "K"],
    ],
    anchors: ["lock", "basin_0…2", "eddy", "valve", "barge_deck", "console"],
    cues: { live: "current_hum", succeed: "sluice_drain", fail: "water_rush" },
    hintAnchors: ["lock", "valve", "basin_0"],
  }),
] as const;

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

/** The archetype's pose. W0 placeholder = the console-slate pose; the owning lane redefines it (skins import this name). */
export type SluiceWavesPose = SlatePose;

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
  validateConfig(config: SluiceWavesConfig, ctx: ConfigCtx): readonly ConfigIssue[] {
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
  },
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
  ...slateLive<SluiceWavesConfig>(SLUICE_WAVES_SKINS),
};

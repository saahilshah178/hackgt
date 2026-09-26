/**
 * oracle_ticker — truth_finder.predict_reveal (docs/design/20 §4 row 5, §4.2, §4.4). A machine prints the scenario; a
 * selector knob points at the option; after Verify it prints the sourced reveal. W0 stub: REAL
 * config/writer/validators/defaults; console-slate live half (KC replaces it).
 */
import { z } from "zod";
import type { ConfigCtx, ConfigIssue, ContraptionMeta } from "../types";
import { coverExactlyOnce, dateAppearsIn, err, findYears, optionIndicesOf, probeRangeIssues, yearProbeFor } from "./config-parts";
import { slateLive, type SlatePose } from "./placeholder";
import { defineSkin } from "./skin-kit";
import { probeFromWriter, wDate, wProbe, type WriterProbe } from "./writer-kit";
import { OracleTickerConfig } from "./oracle-ticker.config";
export { OracleTickerConfig, ORACLE_TICKER_SUCCESS_ONLY } from "./oracle-ticker.config";

export const ORACLE_TICKER_SKINS = [
  defineSkin({
    id: "wire_ticker",
    name: "Wire Ticker",
    ns: "archive_of_voices",
    nouns: ["ticker", "teletype", "wire", "selector", "knob", "kiosk", "tape"],
    parts: [
      ["kiosk", "K"], ["teletype", "H"], ["selector", "H"], ["telegraph_pole", "K"], ["school_barrier", "K"], ["walk_lamp", "K"], ["console", "K"],
    ],
    anchors: ["teletype", "knob", "wire_start", "wire_end", "lamps", "console"],
    cues: { live: null, succeed: "teletype", fail: "relay_click" },
    sensitiveSafe: true,
    hintAnchors: ["teletype", "knob", "wire_end"],
  }),
] as const;

interface OracleTickerWriter {
  fileDates: { date: string; label: string }[];
  probe: WriterProbe | null;
}

/** The archetype's pose. W0 placeholder = the console-slate pose; the owning lane redefines it (skins import this name). */
export type OracleTickerPose = SlatePose;

export const oracleTickerMeta: ContraptionMeta<OracleTickerConfig, OracleTickerPose> = {
  id: "oracle_ticker",
  name: "Oracle Ticker",
  modes: ["truth_finder.predict_reveal"],
  tier: "native",
  status: "demo",
  reusable: "any_subject",
  layouts: ["scrub"],
  defaultLayout: "scrub",
  payoffs: ["barrier_dissolves", "door_opens", "gate_lifts", "beam_restores"],
  nearMissKeys: [],
  accessories: ["record_lens"],
  skins: ORACLE_TICKER_SKINS,
  control: "aim",
  configSchema: OracleTickerConfig,
  validateConfig(config: OracleTickerConfig, ctx: ConfigCtx): readonly ConfigIssue[] {
    const out: ConfigIssue[] = [];
    if (config.options.length > 0) {
      out.push(...coverExactlyOnce(["options"], "optionIndex", optionIndicesOf(ctx.view), config.options.map((o) => o.optionIndex)));
    }
    config.fileDates.forEach((f, i) => {
      if (!dateAppearsIn(ctx.texts, f.date)) out.push(err(["fileDates", i, "date"], `file date ${f.date} does not appear in the prompt or scenario`));
    });
    out.push(...probeRangeIssues(["probe"], config.probe));
    if (config.probeWorld === "record_lens" && !config.probe) out.push(err(["probeWorld"], "record_lens needs a probe"));
    return out;
  },
  defaultConfig(ctx: ConfigCtx): OracleTickerConfig {
    const probe = ctx.biome === "archive_of_voices" ? yearProbeFor(ctx.texts.flatMap(findYears)) : null;
    return OracleTickerConfig.parse({ probe, probeWorld: probe ? "record_lens" : "none" });
  },
  writerConfigSchema: () =>
    z.object({
      fileDates: z.array(z.object({ date: wDate(), label: z.string() })).min(0).max(4),
      probe: wProbe(),
    }),
  fromWriterConfig(w: unknown): OracleTickerConfig {
    const wc = w as OracleTickerWriter;
    const probe = probeFromWriter(wc.probe);
    return OracleTickerConfig.parse({
      fileDates: wc.fileDates.map((f) => ({ date: f.date, label: f.label.slice(0, 40) || "record" })),
      probe,
      probeWorld: probe && (probe.format === "year" || probe.format === "month_year") ? "record_lens" : "none",
    });
  },
  ...slateLive<OracleTickerConfig>(ORACLE_TICKER_SKINS, (c) => c.probe),
};

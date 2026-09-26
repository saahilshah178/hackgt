/**
 * switchboard — linker.pairs (docs/design/20 §4 row 9, §4.2, §4.4). Verlet cords seat between jacks; jack and step lamps
 * light WHITE (seated, not correct) before Verify; a document's lines fill. W0 stub: REAL
 * config/writer/validators/defaults; console-slate live half (KC replaces it).
 */
import { z } from "zod";
import type { ConfigCtx, ConfigIssue, ContraptionMeta } from "../types";
import { err, findYears, probeRangeIssues, viewRows, yearProbeFor } from "./config-parts";
import { slateLive, type SlatePose } from "./placeholder";
import { defineSkin } from "./skin-kit";
import { probeFromWriter, wProbe, type WriterProbe } from "./writer-kit";
import { SwitchboardConfig } from "./switchboard.config";
export { SwitchboardConfig } from "./switchboard.config";

export const SWITCHBOARD_SKINS = [
  defineSkin({
    id: "switchboard",
    name: "Switchboard",
    ns: "archive_of_voices",
    nouns: ["switchboard", "cords", "cord", "jacks", "jack", "program", "steps"],
    parts: [
      ["switchboard_cabinet", "H"], ["jack", "K"], ["plug", "K"], ["program_sheet", "K"], ["step_lamp", "K"], ["steps", "K"], ["console", "K"],
    ],
    anchors: ["left_0…3", "right_0…4", "sheet", "steps", "console"],
    cues: { live: null, succeed: "cord_seat", fail: "relay_click" },
    sensitiveSafe: true,
    hintAnchors: ["sheet", "left_0", "right_0"],
  }),
] as const;

const STOPWORDS: ReadonlySet<string> = new Set([
  "a", "an", "and", "the", "of", "to", "in", "on", "at", "by", "for", "with", "from", "into", "as", "is", "was", "were",
  "be", "it", "its", "that", "this", "or", "but", "not", "no", "their", "his", "her", "they", "he", "she", "we", "you",
]);
function contentTokens(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => !STOPWORDS.has(t)));
}
/**
 * True when hint 3 names a decoy right (docs/design/20 §4.4): its full text, or at least two of its non-stopword tokens
 * (civil O8: e7's "signed the act" shares `signed`, `act` with "Signed the Civil Rights Act into law").
 */
export function hintNamesDecoy(hint3: string, view: unknown): boolean {
  const h = hint3.toLowerCase();
  const hintTokens = contentTokens(hint3);
  return viewRows(view, "rights")
    .filter((r) => r.key.startsWith("x"))
    .some((r) => {
      const t = r.text.trim().toLowerCase();
      if (t.length > 0 && h.includes(t)) return true;
      let shared = 0;
      for (const tok of contentTokens(r.text)) if (hintTokens.has(tok)) shared++;
      return shared >= 2;
    });
}

interface SwitchboardWriter {
  documentTitle: string | null;
  probe: WriterProbe | null;
}

/** The archetype's pose. W0 placeholder = the console-slate pose; the owning lane redefines it (skins import this name). */
export type SwitchboardPose = SlatePose;

export const switchboardMeta: ContraptionMeta<SwitchboardConfig, SwitchboardPose> = {
  id: "switchboard",
  name: "Switchboard",
  modes: ["linker.pairs"],
  tier: "native",
  status: "demo",
  reusable: "any_subject",
  layouts: ["board"],
  defaultLayout: "board",
  payoffs: ["stairs_rise", "steps_emerge", "bridge_forms", "door_opens"],
  nearMissKeys: [],
  accessories: ["record_lens"],
  skins: SWITCHBOARD_SKINS,
  control: "cables",
  configSchema: SwitchboardConfig,
  validateConfig(config: SwitchboardConfig, ctx: ConfigCtx): readonly ConfigIssue[] {
    const out: ConfigIssue[] = [];
    if (config.decoyDimRung !== null && !hintNamesDecoy(ctx.encounter.hints[2] ?? "", ctx.view)) {
      out.push(err(["decoyDimRung"], "decoyDimRung is only allowed when the fixture's third hint names the decoy"));
    }
    out.push(...probeRangeIssues(["probe"], config.probe));
    if (config.probeWorld === "record_lens" && !config.probe) out.push(err(["probeWorld"], "record_lens needs a probe"));
    return out;
  },
  defaultConfig(ctx: ConfigCtx): SwitchboardConfig {
    const probe = ctx.biome === "archive_of_voices" ? yearProbeFor(ctx.texts.flatMap(findYears)) : null;
    return SwitchboardConfig.parse({ probe, probeWorld: probe ? "record_lens" : "none" });
  },
  writerConfigSchema: () =>
    z.object({
      documentTitle: z.string().nullable().describe("The title printed on the program sheet, in caps, or null"),
      probe: wProbe(),
    }),
  fromWriterConfig(w: unknown): SwitchboardConfig {
    const wc = w as SwitchboardWriter;
    const probe = probeFromWriter(wc.probe);
    return SwitchboardConfig.parse({
      document: wc.documentTitle ? { title: wc.documentTitle.slice(0, 80) } : null,
      probe,
      probeWorld: probe && (probe.format === "year" || probe.format === "month_year") ? "record_lens" : "none",
    });
  },
  ...slateLive<SwitchboardConfig>(SWITCHBOARD_SKINS, (c) => c.probe),
};

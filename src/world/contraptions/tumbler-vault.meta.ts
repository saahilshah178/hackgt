/**
 * tumbler_vault — investigator.elimination (docs/design/20 §4 row 12, §4.2, §4.4). A vault door with hypothesis
 * tumblers that rotate by the player's OWN strikes (MatrixControl marks, UI-only); the last unstruck tumbler glows.
 * W0 stub: REAL config/writer/validators/defaults; console-slate live half (KC replaces it).
 */
import { z } from "zod";
import type { ConfigCtx, ConfigIssue, ContraptionMeta, WriterCtx } from "../types";
import { clueIndicesOf, clueTextOf, dateAppearsIn, err, findDates, probeRangeIssues, subsetOf } from "./config-parts";
import { slateLive, type SlatePose } from "./placeholder";
import { defineSkin } from "./skin-kit";
import { wDate } from "./writer-kit";
import { TumblerVaultConfig } from "./tumbler-vault.config";
export { TumblerVaultConfig } from "./tumbler-vault.config";

export const TUMBLER_VAULT_SKINS = [
  defineSkin({
    id: "tumbler_vault",
    name: "Editor's Vault",
    ns: "archive_of_voices",
    nouns: ["vault", "tumblers", "tumbler", "bolts", "door", "Editor's Vault"],
    parts: [["vault_door", "H"], ["tumbler", "H"], ["bolt", "K"], ["handwheel", "K"], ["voice_grille", "K"], ["press_organ", "H"], ["console", "K"]],
    anchors: ["tumbler_0…3", "bolt_0…3", "grille", "hub", "console"],
    cues: { live: null, succeed: "bolt_slide", fail: "tumbler_grind" },
    sensitiveSafe: true,
    hintAnchors: ["hub", "tumbler_0", "grille"],
  }),
] as const;

interface TumblerVaultWriter {
  clues: { index: number; date: string | null }[];
}

/** The archetype's pose. W0 placeholder = the console-slate pose; the owning lane redefines it (skins import this name). */
export type TumblerVaultPose = SlatePose;

export const tumblerVaultMeta: ContraptionMeta<TumblerVaultConfig, TumblerVaultPose> = {
  id: "tumbler_vault",
  name: "Tumbler Vault",
  modes: ["investigator.elimination"],
  tier: "native",
  status: "demo",
  reusable: "any_subject",
  layouts: ["vault"],
  defaultLayout: "vault",
  payoffs: ["vault_opens", "door_opens", "gate_lifts"],
  nearMissKeys: [],
  accessories: [],
  skins: TUMBLER_VAULT_SKINS,
  control: "matrix",
  configSchema: TumblerVaultConfig,
  validateConfig(config: TumblerVaultConfig, ctx: ConfigCtx): readonly ConfigIssue[] {
    const out: ConfigIssue[] = [];
    out.push(...subsetOf(["clues"], "clue index", clueIndicesOf(ctx.view), config.clues.map((c) => c.index)));
    config.clues.forEach((c, i) => {
      if (c.date !== null && !dateAppearsIn([clueTextOf(ctx.view, c.index)], c.date)) {
        out.push(err(["clues", i, "date"], `clue ${c.index}'s date ${c.date} does not appear in its text`));
      }
    });
    if (config.miniStrip && !(config.miniStrip.start < config.miniStrip.end)) out.push(err(["miniStrip"], "miniStrip start must be before its end"));
    out.push(...probeRangeIssues(["probe"], config.probe));
    return out;
  },
  defaultConfig(ctx: ConfigCtx): TumblerVaultConfig {
    return TumblerVaultConfig.parse({
      clues: clueIndicesOf(ctx.view).map((index) => ({ index, date: findDates(clueTextOf(ctx.view, index))[0] ?? null })),
    });
  },
  writerConfigSchema: (ctx: WriterCtx) =>
    ctx.itemKeys.length === 0
      ? null
      : z.object({
          clues: z.array(z.object({ index: z.number().int().min(0).max(9), date: wDate().nullable() })).min(0).max(10),
        }),
  fromWriterConfig(w: unknown): TumblerVaultConfig {
    return TumblerVaultConfig.parse({ clues: (w as TumblerVaultWriter).clues });
  },
  ...slateLive<TumblerVaultConfig>(TUMBLER_VAULT_SKINS, (c) => c.probe),
};

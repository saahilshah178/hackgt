/**
 * console_slate — the universal fallback (docs/design/20 §4 row 13): a lectern whose slate mirrors the existing
 * widget (WidgetControl); the gate behind it lifts on success. It accepts every implemented mode, every layout and
 * every payoff animation so the fallback ladder (§0.1.6 rung 3) can swap any station onto it.
 * `modes` is filled by src/world/library.ts from the mechanics registry (metas may not import mechanics modes).
 */
import { PAYOFF_ANIMS } from "../../contracts/world";
import type { ContraptionMeta } from "../types";
import { slateLive, type SlatePose } from "./placeholder";
import { defineSkin } from "./skin-kit";
import { ConsoleSlateConfig } from "./console-slate.config";
export { ConsoleSlateConfig } from "./console-slate.config";

export const CONSOLE_SLATE_SKINS = [
  defineSkin({
    id: "lectern_slate",
    name: "Console Slate",
    ns: "shared",
    biomes: "any",
    nouns: ["console", "slate", "lectern", "gate"],
    parts: [["lectern", "K"], ["slate", "K"], ["gate", "K"], ["console", "K"]],
    anchors: ["slate", "gate", "console"],
    cues: { live: null, succeed: "ui_badge", fail: "latch_slip" },
    sensitiveSafe: true,
    hintAnchors: ["slate", "slate", "gate"],
  }),
] as const;

/** The archetype's pose. W0 placeholder = the console-slate pose; the owning lane redefines it (skins import this name). */
export type ConsoleSlatePose = SlatePose;

export const consoleSlateMeta: ContraptionMeta<ConsoleSlateConfig, ConsoleSlatePose> = {
  id: "console_slate",
  name: "Console Slate",
  modes: [], // every implemented mode: set by library.ts
  tier: "fallback",
  status: "demo",
  reusable: "any_subject",
  layouts: ["board", "scrub", "vault"],
  defaultLayout: "board",
  payoffs: PAYOFF_ANIMS,
  nearMissKeys: [],
  accessories: [],
  skins: CONSOLE_SLATE_SKINS,
  control: "widget",
  configSchema: ConsoleSlateConfig,
  validateConfig: () => [],
  defaultConfig: () => ConsoleSlateConfig.parse({}),
  writerConfigSchema: () => null,
  fromWriterConfig: () => ConsoleSlateConfig.parse({}),
  ...slateLive<ConsoleSlateConfig>(CONSOLE_SLATE_SKINS),
};

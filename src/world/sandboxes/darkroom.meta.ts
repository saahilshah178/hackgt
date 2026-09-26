/**
 * darkroom — the Editor's Darkroom (civil S8; docs/design/20 §2.4b, §4.2). A token tray of held negatives →
 * developing trays; goal `all_developed`. W0 stub: REAL config/validators/inputs/goals; neutral live half
 * (S1 replaces it).
 */
import { defineSkin } from "../contraptions/skin-kit";
import { err } from "../contraptions/config-parts";
import type { ConfigIssue, SandboxMeta } from "../types";
import { sandboxSlateLive, type SandboxSlatePose } from "./placeholder";
import { DarkroomConfig } from "./darkroom.config";
export { DarkroomConfig } from "./darkroom.config";

export const DARKROOM_SKINS = [
  defineSkin({
    id: "darkroom_trays",
    name: "Editor's Darkroom",
    ns: "archive_of_voices",
    nouns: ["darkroom", "trays", "tray", "negatives", "enlarger"],
    parts: [["tray", "K"], ["enlarger", "H"], ["safelight", "K"], ["line", "K"], ["console", "K"]],
    anchors: ["tray_0…2", "enlarger", "line", "console"],
    cues: { live: null, succeed: "page_turn", fail: "latch_slip" },
    sensitiveSafe: true,
  }),
] as const;

/** The sandbox's pose. W0 placeholder; SB redefines it (skins import this name). */
export type DarkroomPose = SandboxSlatePose;

export const darkroomMeta: SandboxMeta<DarkroomConfig, DarkroomPose> = {
  id: "darkroom",
  name: "Darkroom",
  tier: "sandbox",
  skins: DARKROOM_SKINS,
  configSchema: DarkroomConfig,
  validateConfig(config: DarkroomConfig): readonly ConfigIssue[] {
    return new Set(config.negatives).size === config.negatives.length ? [] : [err(["negatives"], "negative ids must be unique")];
  },
  inputs: (config) => [
    {
      kind: "tokens",
      id: "negatives",
      tokens: config.negatives.map((key) => ({ key, label: key.replace(/_/g, " "), icon: null })),
      targets: Array.from({ length: config.trays }, (_, i) => ({ key: `tray_${i}`, label: `Tray ${i + 1}` })),
    },
  ],
  goals: ["all_developed"],
  goalMet: (goal, h) => goal === "all_developed" && h.placedAll,
  panelStatic: () => ({ cards: [], input: null, probe: null, recordPins: [] }),
  ...sandboxSlateLive<DarkroomConfig>(),
};

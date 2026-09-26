/**
 * plant_garden — the Plant Cell Garden (cell S4 alcove; docs/design/20 §2.4b, §4.2). A salt scrubber 0–5 %; the
 * protoplast pulls from the wall above 2 % (osmotic_cell sim); goals `plasmolysed` then `turgid`.
 * W0 stub: REAL config/validators/inputs/goals; neutral live half (S1 replaces it with the sim).
 */
import { defineSkin } from "../contraptions/skin-kit";
import { probeRangeIssues } from "../contraptions/config-parts";
import type { SandboxMeta } from "../types";
import { sandboxSlateLive, type SandboxSlatePose } from "./placeholder";
import { PlantGardenConfig } from "./plant-garden.config";
export { PlantGardenConfig } from "./plant-garden.config";

/** Salt above this (percent) plasmolyses the protoplast (§2.4b). */
export const PLASMOLYSIS_THRESHOLD = 2;

export const PLANT_GARDEN_SKINS = [
  defineSkin({
    id: "plant_pool",
    name: "Plant Cell Garden",
    ns: "living_gate",
    nouns: ["garden", "plant cell", "pool", "salt hopper", "cell"],
    parts: [["pool", "K"], ["plant_cell", "H"], ["salt_hopper", "K"], ["console", "K"]],
    anchors: ["pool", "cell", "hopper", "console"],
    cues: { live: "current_hum", succeed: "lantern_lit", fail: "boing_soft" },
  }),
] as const;

/** The sandbox's pose. W0 placeholder; SB redefines it (skins import this name). */
export type PlantGardenPose = SandboxSlatePose;

export const plantGardenMeta: SandboxMeta<PlantGardenConfig, PlantGardenPose> = {
  id: "plant_garden",
  name: "Plant Cell Garden",
  tier: "sandbox",
  skins: PLANT_GARDEN_SKINS,
  configSchema: PlantGardenConfig,
  validateConfig: (config) => probeRangeIssues(["salt"], config.salt),
  inputs: (config) => [{ kind: "probe", id: "salt", spec: config.salt }],
  goals: ["plasmolysed", "turgid"],
  goalMet(goal, h) {
    const r = h.ranges.salt;
    if (!r) return false;
    if (goal === "plasmolysed") return r[1] > PLASMOLYSIS_THRESHOLD;
    if (goal === "turgid") return r[1] > PLASMOLYSIS_THRESHOLD && r[0] < 1; // recovered after plasmolysis
    return false;
  },
  panelStatic: (config) => ({ cards: [], input: null, probe: config.salt, recordPins: [] }),
  ...sandboxSlateLive<PlantGardenConfig>(),
};

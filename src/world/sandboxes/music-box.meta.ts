/**
 * music_box — the Astronomer's Music Box (trig S5 grotto; docs/design/20 §2.4b, §4.2). Scrubbers A ∈ [0.5, 3] and
 * b ∈ [0.5, 4]; one graph card y = A·sin(b t); goal `explored` = both scrubbers moved and 5 s of play.
 * W0 stub: REAL config/validators/inputs/goals; neutral live half (S1 replaces it with the 220·b Hz tone).
 */
import { defineSkin } from "../contraptions/skin-kit";
import { err, exprValue, probeRangeIssues } from "../contraptions/config-parts";
import type { ConfigIssue, SandboxMeta } from "../types";
import { sandboxSlateLive, type SandboxSlatePose } from "./placeholder";
import { MusicBoxConfig } from "./music-box.config";
export { MusicBoxConfig } from "./music-box.config";

export const MUSIC_BOX_SKINS = [
  defineSkin({
    id: "astronomer_box",
    name: "Astronomer's Music Box",
    ns: "orrery_terraces",
    nouns: ["music box", "box", "crank", "comb"],
    parts: [["music_box", "H"], ["crank", "K"], ["comb", "K"], ["console", "K"]],
    anchors: ["box", "crank", "comb", "console"],
    cues: { live: "mb_tone", succeed: "chord_true", fail: "latch_slip" },
  }),
] as const;

/** The sandbox's pose. W0 placeholder; SB redefines it (skins import this name). */
export type MusicBoxPose = SandboxSlatePose;

export const musicBoxMeta: SandboxMeta<MusicBoxConfig, MusicBoxPose> = {
  id: "music_box",
  name: "Music Box",
  tier: "sandbox",
  skins: MUSIC_BOX_SKINS,
  configSchema: MusicBoxConfig,
  validateConfig(config: MusicBoxConfig): readonly ConfigIssue[] {
    const out: ConfigIssue[] = [...probeRangeIssues(["amplitude"], config.amplitude), ...probeRangeIssues(["rate"], config.rate)];
    const x = exprValue(config.xMax);
    if (x === null || !(x > 0)) out.push(err(["xMax"], `xMax "${config.xMax}" must evaluate to a positive number`));
    return out;
  },
  inputs: (config) => [
    { kind: "probe", id: "amplitude", spec: config.amplitude },
    { kind: "probe", id: "rate", spec: config.rate },
  ],
  goals: ["explored"],
  goalMet: (goal, h) => goal === "explored" && h.moved.has("amplitude") && h.moved.has("rate") && h.secondsActive >= 5,
  panelStatic: (config) => ({ cards: [], input: null, probe: config.amplitude, recordPins: [] }),
  ...sandboxSlateLive<MusicBoxConfig>(),
};

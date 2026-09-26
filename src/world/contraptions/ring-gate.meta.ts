/**
 * ring_gate — tuner.oscillator (docs/design/20 §4 row 1, §2.5.7, §4.2). Two notched rings in a wall: the outer ring
 * turns by b·T, the inner disc rocks by the wave's value, a lap tally ratchets; release replays 0 → T.
 * W0 stub: REAL config/validators/defaults; console-slate live half (KA replaces it, §7.4 row "ring-gate").
 */
import type { ConfigCtx, ConfigIssue, ContraptionMeta, OscillatorView } from "../types";
import { err } from "./config-parts";
import { slateLive, type SlatePose } from "./placeholder";
import { defineSkin } from "./skin-kit";
import { RingGateConfig } from "./ring-gate.config";
export { RingGateConfig } from "./ring-gate.config";

export const RING_GATE_SKINS = [
  defineSkin({
    id: "ring_gate",
    name: "Tidewheel Gate",
    ns: "orrery_terraces",
    nouns: ["gate", "ring", "rings", "notch", "Tidewheel Gate", "latch timer", "wheel"],
    parts: [
      ["gate_wall", "H"], ["outer_ring", "H"], ["inner_disc", "H"], ["fin_l", "H"], ["fin_r", "H"],
      ["tally_wheel", "K"], ["pawl", "K"], ["canal", "K"], ["skiff", "K"], ["console", "K"],
    ],
    anchors: ["ring_center", "doorway", "tally", "pawl_tip", "fin_split", "inner_hub", "console"],
    cues: { live: null, succeed: "latch_clack", fail: "latch_slip" },
    hintAnchors: ["ring_center", "tally", "pawl_tip"],
  }),
] as const;

const COUNTERWEIGHT_ASKS: ReadonlySet<string> = new Set(["amplitude", "midline"]);

/** The archetype's pose. W0 placeholder = the console-slate pose; the owning lane redefines it (skins import this name). */
export type RingGatePose = SlatePose;

export const ringGateMeta: ContraptionMeta<RingGateConfig, RingGatePose> = {
  id: "ring_gate",
  name: "Ring Gate",
  modes: ["tuner.oscillator"],
  tier: "native",
  status: "demo",
  reusable: "any_subject",
  layouts: ["scrub"],
  defaultLayout: "scrub",
  payoffs: ["door_opens", "gate_lifts", "barrier_lifts", "water_rises", "beam_restores"],
  nearMissKeys: ["aligned_multiple", "short_of_cycle"],
  accessories: [],
  skins: RING_GATE_SKINS,
  control: "scrub",
  configSchema: RingGateConfig,
  validateConfig(config: RingGateConfig, ctx: ConfigCtx): readonly ConfigIssue[] {
    const ask = (ctx.view as Partial<OscillatorView> | null)?.ask;
    const wantsCounterweight = typeof ask === "string" && COUNTERWEIGHT_ASKS.has(ask);
    if (config.variant === "counterweight" && !wantsCounterweight) {
      return [err(["variant"], `variant "counterweight" is only for amplitude/midline asks (this station asks ${String(ask)})`)];
    }
    if (config.variant === "notch" && wantsCounterweight) {
      return [err(["variant"], `ask "${String(ask)}" needs variant "counterweight" (the notch shows time, not height)`)];
    }
    return [];
  },
  defaultConfig(ctx: ConfigCtx): RingGateConfig {
    const ask = (ctx.view as Partial<OscillatorView> | null)?.ask;
    return RingGateConfig.parse({ variant: typeof ask === "string" && COUNTERWEIGHT_ASKS.has(ask) ? "counterweight" : "notch" });
  },
  writerConfigSchema: () => null, // derived entirely from the view and the biome (§4.4)
  fromWriterConfig(_w: unknown, ctx: ConfigCtx): RingGateConfig {
    return ringGateMeta.defaultConfig(ctx);
  },
  ...slateLive<RingGateConfig>(RING_GATE_SKINS),
};

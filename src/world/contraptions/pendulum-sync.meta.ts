/**
 * pendulum_sync — tuner.oscillator, ask period/frequency (docs/design/20 §4 row 3, §4.2). A guardian swings in real
 * time; the player's counter-pendulum runs at the dialled T; the sync thread's brightness ½(1 + cos Δ) beats at
 * |1/T₀ − 1/T|. W0 stub: REAL config/validators/defaults; console-slate live half (KA replaces it with the
 * pendulum-beat sim).
 */
import type { ConfigCtx, ConfigIssue, ContraptionMeta, OscillatorView } from "../types";
import { err } from "./config-parts";
import { slateLive, type SlatePose } from "./placeholder";
import { defineSkin } from "./skin-kit";
import { PendulumSyncConfig } from "./pendulum-sync.config";
export { PendulumSyncConfig } from "./pendulum-sync.config";

export const PENDULUM_SYNC_SKINS = [
  defineSkin({
    id: "wardens_shield",
    name: "Warden's Shield",
    ns: "orrery_terraces",
    nouns: ["shield", "pendulum", "Warden", "counter-pendulum", "sync thread", "Star Door"],
    parts: [
      ["warden_body", "H"], ["warden_arm", "H"], ["shield", "H"], ["visor", "H"], ["star_door_l", "H"], ["star_door_r", "H"],
      ["counter_pylon", "K"], ["pendulum_arm", "K"], ["bob", "K"], ["span_tile", "K"], ["console", "K"],
    ],
    anchors: ["shoulder", "shield_boss", "bob", "pylon_pivot", "door_center", "visor", "console"],
    cues: { live: "sync_hum", succeed: "resonance_lock", fail: "thread_snap" },
    hintAnchors: ["shield_boss", "bob", "pylon_pivot"],
  }),
] as const;

const PERIODIC_ASKS: ReadonlySet<string> = new Set(["period", "frequency"]);

/** The archetype's pose. W0 placeholder = the console-slate pose; the owning lane redefines it (skins import this name). */
export type PendulumSyncPose = SlatePose;

export const pendulumSyncMeta: ContraptionMeta<PendulumSyncConfig, PendulumSyncPose> = {
  id: "pendulum_sync",
  name: "Pendulum Sync",
  modes: ["tuner.oscillator"],
  tier: "native",
  status: "demo",
  reusable: "any_subject",
  layouts: ["scrub"],
  defaultLayout: "scrub",
  payoffs: ["door_opens", "gate_lifts", "barrier_lifts", "vault_opens"],
  nearMissKeys: [], // trig e6 uses station probes (reach, half) and fail keys (over, under)
  accessories: [],
  skins: PENDULUM_SYNC_SKINS,
  control: "scrub",
  configSchema: PendulumSyncConfig,
  validateConfig(_config: PendulumSyncConfig, ctx: ConfigCtx): readonly ConfigIssue[] {
    const ask = (ctx.view as Partial<OscillatorView> | null)?.ask;
    return typeof ask === "string" && PERIODIC_ASKS.has(ask) ? [] : [err(["view", "ask"], `pendulum_sync needs a period or frequency ask (got ${String(ask)})`)];
  },
  defaultConfig: () => PendulumSyncConfig.parse({}),
  writerConfigSchema: () => null,
  fromWriterConfig: () => PendulumSyncConfig.parse({}),
  ...slateLive<PendulumSyncConfig>(PENDULUM_SYNC_SKINS),
};

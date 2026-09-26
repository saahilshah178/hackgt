/**
 * stage_machine — linker.pairs with a stage probe (docs/design/20 §4 row 10, §4.2, §4.4). A machine with typed
 * sockets; linked cartridges load their counts (neutral "loaded: …" labels, never "?"); the stage scrubber plays the
 * cycle through what you loaded. Never auto-picked (needs authored semantics). W0 stub: REAL
 * config/writer/validators/defaults; console-slate live half (KB replaces it).
 */
import { z } from "zod";
import type { ConfigCtx, ConfigIssue, ContraptionMeta, WriterCtx } from "../types";
import { coverExactlyOnce, err, leftKeysOf, probeRangeIssues, rightKeysOf, viewTextOf } from "./config-parts";
import { slateLive, type SlatePose } from "./placeholder";
import { defineSkin } from "./skin-kit";
import { StageMachineConfig } from "./stage-machine.config";
export { StageMachineConfig, StageSemantic } from "./stage-machine.config";

export const STAGE_MACHINE_SKINS = [
  defineSkin({
    id: "pump_rewiring",
    name: "Sodium Pump",
    ns: "living_gate",
    nouns: ["pump", "Sodium Pump", "sockets", "cartridges", "drum", "stage", "cycle"],
    parts: [
      ["pump_housing", "H"], ["drum", "H"], ["jaw_upper", "H"], ["jaw_lower", "K"], ["cartridge", "K"], ["socket", "K"],
      ["beacon_tower", "K"], ["hall_gate", "K"], ["console", "K"],
    ],
    anchors: ["socket_0…3", "cartridge_0…4", "drum", "atp_port", "beacon", "crank", "console"],
    cues: { live: "current_hum", succeed: "beacon_ignite", fail: "tumbler_grind" },
    hintAnchors: ["drum", "socket_0", "cartridge_0"],
  }),
] as const;

function digitIn(text: string, n: number): boolean {
  return new RegExp(`(^|[^0-9])${n}([^0-9]|$)`).test(text);
}

export function validateStageMachine(config: StageMachineConfig, ctx: ConfigCtx): ConfigIssue[] {
  const out: ConfigIssue[] = [];
  out.push(...coverExactlyOnce(["lefts"], "left key", leftKeysOf(ctx.view), config.lefts.map((l) => l.key)));
  out.push(...coverExactlyOnce(["rights"], "right key", rightKeysOf(ctx.view), config.rights.map((r) => r.key)));
  config.rights.forEach((r, i) => {
    const text = viewTextOf(ctx.view, r.key);
    if (r.semantic.kind === "count") {
      if (!digitIn(text, r.semantic.n)) out.push(err(["rights", i, "semantic", "n"], `count ${r.semantic.n} does not appear as a digit in "${text}"`));
      const dirOk = r.semantic.dir === "out" ? /\bout\b/i.test(text) : /\b(in|into)\b/i.test(text);
      if (!dirOk) out.push(err(["rights", i, "semantic", "dir"], `direction "${r.semantic.dir}" is not stated in "${text}"`));
    } else if (r.semantic.kind === "atp") {
      if (!digitIn(text, r.semantic.n)) out.push(err(["rights", i, "semantic", "n"], `ATP count ${r.semantic.n} does not appear in "${text}"`));
    }
  });
  const s = config.stages;
  if (s.format !== "stage") out.push(err(["stages", "format"], 'the stage scrubber must use format "stage"'));
  if (!Number.isInteger(s.min) || !Number.isInteger(s.max)) out.push(err(["stages"], "stage min and max must be integers"));
  else {
    const stops = new Set(s.stops.map((x) => x.v));
    for (let k = s.min; k <= s.max; k++) if (!stops.has(k)) out.push(err(["stages", "stops"], `stage ${k} has no named stop`));
  }
  out.push(...probeRangeIssues(["stages"], s));
  return out;
}

interface StageMachineWriter {
  lefts: { key: string; stage: number; socketKind: "ion" | "energy" | "beacon"; ion: "Na" | "K" | null }[];
  rights: { key: string; kind: "count" | "atp" | "beacon"; n: number | null; dir: "in" | "out" | null }[];
}

/** The archetype's pose. W0 placeholder = the console-slate pose; the owning lane redefines it (skins import this name). */
export type StageMachinePose = SlatePose;

export const stageMachineMeta: ContraptionMeta<StageMachineConfig, StageMachinePose> = {
  id: "stage_machine",
  name: "Stage Machine",
  modes: ["linker.pairs"],
  tier: "native",
  status: "demo",
  reusable: "any_subject",
  layouts: ["scrub"],
  defaultLayout: "scrub",
  payoffs: ["gate_lifts", "door_opens", "barrier_lifts", "beam_restores"],
  nearMissKeys: [],
  accessories: [],
  skins: STAGE_MACHINE_SKINS,
  control: "cables",
  configSchema: StageMachineConfig,
  validateConfig: (config, ctx) => validateStageMachine(config, ctx),
  defaultConfig(ctx: ConfigCtx): StageMachineConfig {
    // never auto-picked (§4.4); this default is only a structurally valid starting point for authors
    const lefts = leftKeysOf(ctx.view);
    const max = Math.max(1, lefts.length - 1);
    return StageMachineConfig.parse({
      lefts: lefts.map((key, stage) => ({ key, stage, socketKind: "beacon" })),
      rights: rightKeysOf(ctx.view).map((key) => ({ key, semantic: { kind: "beacon" } })),
      stages: {
        symbol: "k",
        label: "stage",
        min: 0,
        max,
        step: 1,
        format: "stage",
        stops: Array.from({ length: max + 1 }, (_, v) => ({ v, label: `stage ${v}` })),
      },
      ledger: "none",
    });
  },
  writerConfigSchema: (ctx: WriterCtx) =>
    ctx.itemKeys.length === 0
      ? null
      : z.object({
          lefts: z
            .array(z.object({ key: z.string(), stage: z.number().int().min(0).max(12), socketKind: z.enum(["ion", "energy", "beacon"]), ion: z.enum(["Na", "K"]).nullable() }))
            .min(1)
            .max(6),
          rights: z
            .array(
              z.object({
                key: z.string(),
                kind: z.enum(["count", "atp", "beacon"]),
                n: z.number().int().min(0).max(9).nullable(),
                dir: z.enum(["in", "out"]).nullable(),
              }),
            )
            .min(1)
            .max(8),
        }),
  fromWriterConfig(w: unknown, ctx: ConfigCtx): StageMachineConfig {
    const wc = w as StageMachineWriter;
    const base = stageMachineMeta.defaultConfig(ctx);
    const maxStage = Math.max(1, ...wc.lefts.map((l) => l.stage));
    return StageMachineConfig.parse({
      lefts: wc.lefts,
      rights: wc.rights.map((r) => ({
        key: r.key,
        semantic:
          r.kind === "count" ? { kind: "count", n: r.n ?? 0, dir: r.dir ?? "in" } : r.kind === "atp" ? { kind: "atp", n: r.n ?? 0 } : { kind: "beacon" },
      })),
      stages: { ...base.stages, max: maxStage, stops: Array.from({ length: maxStage + 1 }, (_, v) => ({ v, label: `stage ${v}` })) },
      ledger: "charge",
    });
  },
  ...slateLive<StageMachineConfig>(STAGE_MACHINE_SKINS, (c) => c.stages),
};

/**
 * cause_tubes — linker.chain (docs/design/20 §4 row 11, §4.2, §4.4). Wires or tubes grow between housings placed by
 * DISPLAY index (never causal order); a completion gauge; after Verify a current or capsule runs the chain.
 * W0 stub: REAL config/writer/validators/defaults; console-slate live half (KC replaces it).
 */
import { z } from "zod";
import { asTuple } from "../../contracts/slices";
import type { ConfigCtx, ConfigIssue, ContraptionMeta, WriterCtx } from "../types";
import {
  dateAppearsIn,
  err,
  findDates,
  fracYearOf,
  nodeKeysOf,
  probeRangeIssues,
  subsetOf,
  viewTextOf,
  yearProbeFor,
} from "./config-parts";
import { slateLive, type SlatePose } from "./placeholder";
import { defineSkin } from "./skin-kit";
import { probeFromWriter, wDate, wProbe, type WriterProbe } from "./writer-kit";
import { CauseTubesConfig } from "./cause-tubes.config";
export { CauseTubesConfig } from "./cause-tubes.config";

export const CAUSE_TUBES_SKINS = [
  defineSkin({
    id: "relay_line",
    name: "Relay Line",
    ns: "archive_of_voices",
    nouns: ["relay", "circuit", "junction boxes", "boxes", "wires", "line", "board"],
    parts: [["junction_box", "K"], ["departures_board", "K"], ["divider_rail", "K"], ["rolling_gate", "K"], ["console", "K"]],
    anchors: ["box_0…5", "board", "gate", "gauge", "console"],
    cues: { live: "current_hum", succeed: "beacon_ignite", fail: "fuse_pop" },
    sensitiveSafe: true,
    hintAnchors: ["board", "box_0", "gauge"],
  }),
  defineSkin({
    id: "broadcast_relay",
    name: "Broadcast Relay",
    ns: "archive_of_voices",
    nouns: ["mast", "relay", "circuit", "dishes", "stations", "broadcast"],
    parts: [["mast", "K"], ["relay_dish", "H"], ["lift_cage", "K"], ["console", "K"]],
    anchors: ["station_0…5", "lift", "top", "console"],
    cues: { live: "current_hum", succeed: "beacon_ignite", fail: "fuse_pop" },
    sensitiveSafe: true,
    hintAnchors: ["top", "station_0", "lift"],
  }),
  defineSkin({
    id: "big_board",
    name: "Big Board",
    ns: "archive_of_voices",
    nouns: ["board", "Big Board", "tubes", "canisters", "capsule", "launcher"],
    parts: [["board_wall", "K"], ["canister", "H"], ["launcher", "K"], ["console", "K"]],
    anchors: ["canister_0…6", "launcher", "console"],
    cues: { live: null, succeed: "tube_whoosh", fail: "fuse_pop" },
    sensitiveSafe: true,
    hintAnchors: ["launcher", "canister_0", "canister_1"],
  }),
] as const;

const BIOME_TUBES: Readonly<Record<string, Pick<CauseTubesConfig, "connector" | "layout" | "carrier">>> = {
  archive_of_voices: { connector: "catenary", layout: "canopy_row", carrier: "current" },
  living_gate: { connector: "tube", layout: "ring", carrier: "capsule" },
  orrery_terraces: { connector: "tube", layout: "ring", carrier: "current" },
};
function tubesFor(biome: string) {
  return BIOME_TUBES[biome] ?? BIOME_TUBES.orrery_terraces;
}

interface CauseTubesWriter {
  nodes: { key: string; printedDate: string | null }[];
  probe: WriterProbe | null;
}

/** The archetype's pose. W0 placeholder = the console-slate pose; the owning lane redefines it (skins import this name). */
export type CauseTubesPose = SlatePose;

export const causeTubesMeta: ContraptionMeta<CauseTubesConfig, CauseTubesPose> = {
  id: "cause_tubes",
  name: "Cause Tubes",
  modes: ["linker.chain"],
  tier: "native",
  status: "demo",
  reusable: "any_subject",
  layouts: ["board"],
  defaultLayout: "board",
  payoffs: ["gate_lifts", "lift_moves", "door_opens", "bridge_forms", "beam_restores"],
  nearMissKeys: [],
  accessories: ["record_lens"],
  skins: CAUSE_TUBES_SKINS,
  control: "tubes",
  configSchema: CauseTubesConfig,
  validateConfig(config: CauseTubesConfig, ctx: ConfigCtx): readonly ConfigIssue[] {
    const out: ConfigIssue[] = [];
    out.push(...subsetOf(["nodes"], "node key", nodeKeysOf(ctx.view), config.nodes.map((n) => n.key)));
    config.nodes.forEach((n, i) => {
      const text = viewTextOf(ctx.view, n.key);
      if (n.meta.printedDate !== null && !dateAppearsIn([text], n.meta.printedDate)) {
        out.push(err(["nodes", i, "meta", "printedDate"], `printed date ${n.meta.printedDate} does not appear in "${text}"`));
      }
    });
    out.push(...probeRangeIssues(["probe"], config.probe));
    if (config.probeWorld === "record_lens" && !config.probe) out.push(err(["probeWorld"], "record_lens needs a probe"));
    return out;
  },
  defaultConfig(ctx: ConfigCtx): CauseTubesConfig {
    const nodes = nodeKeysOf(ctx.view).map((key) => ({ key, meta: { printedDate: findDates(viewTextOf(ctx.view, key))[0] ?? null } }));
    const years = nodes.map((n) => (n.meta.printedDate ? Math.floor(fracYearOf(n.meta.printedDate) ?? 0) : 0)).filter((y) => y > 0);
    const probe = years.length >= 2 ? yearProbeFor(years) : null;
    return CauseTubesConfig.parse({ nodes, ...tubesFor(ctx.biome), probe, probeWorld: probe ? "record_lens" : "none" });
  },
  writerConfigSchema: (ctx: WriterCtx) =>
    ctx.itemKeys.length === 0
      ? null
      : z.object({
          nodes: z
            .array(z.object({ key: z.enum(asTuple(ctx.itemKeys, "node keys")), printedDate: wDate().nullable() }))
            .min(ctx.itemKeys.length)
            .max(ctx.itemKeys.length),
          probe: wProbe(),
        }),
  fromWriterConfig(w: unknown, ctx: ConfigCtx): CauseTubesConfig {
    const wc = w as CauseTubesWriter;
    const probe = probeFromWriter(wc.probe);
    return CauseTubesConfig.parse({
      nodes: wc.nodes.map((n) => ({ key: n.key, meta: { printedDate: n.printedDate } })),
      ...tubesFor(ctx.biome),
      probe,
      probeWorld: probe && (probe.format === "year" || probe.format === "month_year") ? "record_lens" : "none",
    });
  },
  ...slateLive<CauseTubesConfig>(CAUSE_TUBES_SKINS, (c) => c.probe),
};

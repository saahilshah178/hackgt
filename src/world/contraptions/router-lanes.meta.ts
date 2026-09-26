/**
 * router_lanes — sorter.bins (docs/design/20 §4 row 7, §4.2, §4.4). Items drift, then queue at the chosen lane/maw/
 * drawer (counts only, no correctness before Verify); boss phases reveal batches. W0 stub: REAL
 * config/writer/validators/defaults; console-slate live half (KB replaces it).
 */
import { z } from "zod";
import { asTuple } from "../../contracts/slices";
import type { ConfigCtx, ConfigIssue, ContraptionMeta, WriterCtx } from "../types";
import {
  binIdsOf,
  coverExactlyOnce,
  dateAppearsIn,
  err,
  findDates,
  findYears,
  fracYearOf,
  itemKeysOf,
  probeRangeIssues,
  viewTextOf,
  warn,
  yearProbeFor,
} from "./config-parts";
import { slateLive, type SlatePose } from "./placeholder";
import { defineSkin } from "./skin-kit";
import { probeFromWriter, wDate, wProbe, type WriterProbe } from "./writer-kit";
import { RouterLanesConfig } from "./router-lanes.config";
export { RouterLanesConfig, ROUTER_LANES_SUCCESS_ONLY } from "./router-lanes.config";

export const ROUTER_LANES_SKINS = [
  defineSkin({
    id: "membrane_router",
    name: "Crossing Gate",
    ns: "living_gate",
    nouns: ["gate", "Crossing Gate", "lane", "lanes", "oil road", "cargo", "rocker", "membrane"],
    parts: [
      ["crossing_gate", "H"], ["gate_fin", "H"], ["gate_ring_outer", "K"], ["gate_ring_inner", "K"], ["oil_road", "K"],
      ["molecule_glyph", "K"], ["carrier_rocker", "H"], ["lane_mouth", "K"], ["console", "K"],
    ],
    anchors: ["lane_diffuses", "lane_protein", "gate_ring", "rocker_pivot", "console"],
    cues: { live: null, succeed: "latch_clack", fail: "boing_soft" },
    hintAnchors: ["gate_ring", "lane_diffuses", "rocker_pivot"],
  }),
  defineSkin({
    id: "carrier_lanes",
    name: "Carrier Door",
    ns: "living_gate",
    nouns: ["door", "Carrier Door", "lane", "lanes", "cargo", "pump gate", "threshold"],
    parts: [["carrier_door", "H"], ["glide_gate", "K"], ["pump_gate", "H"], ["ramp_wedge", "K"], ["cargo_glyph", "K"], ["console", "K"]],
    anchors: ["lane_passive", "lane_active", "door_pocket", "atp_port", "console"],
    cues: { live: null, succeed: "latch_clack", fail: "boing_soft" },
    hintAnchors: ["door_pocket", "lane_passive", "atp_port"],
  }),
  defineSkin({
    id: "gatekeeper_maws",
    name: "Gatekeeper",
    ns: "living_gate",
    nouns: ["Gatekeeper", "maw", "maws", "vault", "cargo", "eye"],
    parts: [
      ["gatekeeper_body", "H"], ["maw_oil", "H"], ["maw_channel", "H"], ["maw_pump", "H"], ["eye_ring", "H"], ["eye_pupil", "K"],
      ["atp_pipe", "K"], ["cargo_glyph", "K", "living_gate.part.carrier_lanes_cargo_glyph"], ["console", "K"],
    ],
    anchors: ["maw_simple", "maw_facilitated", "maw_active", "eye", "pipe_top", "console"],
    cues: { live: null, succeed: "gatekeeper_rumble", fail: "boing_soft" },
    hintAnchors: ["eye", "maw_simple", "pipe_top"],
  }),
  defineSkin({
    id: "filing_cabinets",
    name: "Filing Cabinets",
    ns: "archive_of_voices",
    nouns: ["cabinets", "cabinet", "drawer", "drawers", "files", "slips", "stairwell"],
    parts: [["cabinet", "K"], ["meter", "K"], ["shutter", "K"], ["slip", "K"], ["pneumatic_drop", "K"], ["stairwell", "K"], ["console", "K"]],
    anchors: ["drawer_0…1", "meter_0…1", "shutter_0…1", "table", "stairwell", "console"],
    cues: { live: null, succeed: "drawer_thunk", fail: "drawer_thunk" },
    sensitiveSafe: true,
    hintAnchors: ["table", "shutter_0", "drawer_0"],
  }),
  defineSkin({
    id: "provenance_drawers",
    name: "Provenance Drawers",
    ns: "archive_of_voices",
    nouns: ["drawers", "drawer", "stacks", "shelving", "documents", "sources"],
    parts: [
      ["document", "H"], ["compact_shelving", "K"], ["crank", "K"],
      ["meter", "K", "archive_of_voices.part.filing_cabinets_meter"], ["shutter", "K", "archive_of_voices.part.filing_cabinets_shutter"],
      ["console", "K"],
    ],
    anchors: ["drawer_0…1", "meter_0…1", "shutter_0…1", "table", "console"],
    cues: { live: null, succeed: "drawer_thunk", fail: "drawer_thunk" },
    sensitiveSafe: true,
    hintAnchors: ["table", "shutter_0", "drawer_0"],
  }),
] as const;

const DOWN_WORDS = /\b(high\s*(?:→|->|to)\s*low|down\s+(?:its|the|a)\s+gradient|downhill)\b/i;
const UP_WORDS = /\b(against|pumped|uphill|low\s*(?:→|->|to)\s*high)\b/i;

export function validateRouterLanes(config: RouterLanesConfig, ctx: ConfigCtx): ConfigIssue[] {
  const out: ConfigIssue[] = [];
  out.push(...coverExactlyOnce(["items"], "item key", itemKeysOf(ctx.view), config.items.map((i) => i.key)));
  out.push(...coverExactlyOnce(["lanes"], "bin id", binIdsOf(ctx.view), config.lanes.map((l) => l.binId)));
  config.items.forEach((it, i) => {
    const text = viewTextOf(ctx.view, it.key);
    if (it.meta.printedDate !== null && !dateAppearsIn([text], it.meta.printedDate)) {
      out.push(err(["items", i, "meta", "printedDate"], `printed date ${it.meta.printedDate} does not appear in "${text}"`));
    }
    if (it.meta.madeYear !== null && !findYears(text).includes(it.meta.madeYear)) {
      out.push(err(["items", i, "meta", "madeYear"], `made year ${it.meta.madeYear} does not appear in "${text}"`));
    }
    if (it.from !== null && it.to !== null) {
      if (DOWN_WORDS.test(text) && !(it.from > it.to)) out.push(warn(["items", i], "the text says down the gradient, so from should exceed to"));
      if (UP_WORDS.test(text) && !(it.from < it.to)) out.push(warn(["items", i], "the text says against the gradient, so from should be below to"));
    }
  });
  if (config.eventsBand) {
    for (const d of [config.eventsBand.from, config.eventsBand.to]) {
      if (!dateAppearsIn(ctx.texts, d)) out.push(err(["eventsBand"], `events band date ${d} does not appear in the encounter texts`));
    }
  }
  out.push(...probeRangeIssues(["probe"], config.probe));
  if (config.probeWorld === "record_lens" && !config.probe) out.push(err(["probeWorld"], "record_lens needs a probe"));
  return out;
}

interface RouterLanesWriter {
  items: { key: string; printedDate: string | null; madeYear: number | null; polar: boolean | null; charged: boolean | null; from: number | null; to: number | null }[];
  probe: WriterProbe | null;
}

export function routerLanesWriterSchema(ctx: WriterCtx) {
  return z.object({
    items: z
      .array(
        z.object({
          key: z.enum(asTuple(ctx.itemKeys, "item keys")),
          printedDate: wDate().nullable(),
          madeYear: z.number().int().min(1000).max(2100).nullable(),
          polar: z.boolean().nullable(),
          charged: z.boolean().nullable(),
          from: z.number().int().min(0).max(10).nullable(),
          to: z.number().int().min(0).max(10).nullable(),
        }),
      )
      .min(ctx.itemKeys.length)
      .max(ctx.itemKeys.length),
    probe: wProbe(),
  });
}

function defaultLanes(view: unknown) {
  return binIdsOf(view).map((binId) => ({ binId, laneId: binId }));
}

/** The archetype's pose. W0 placeholder = the console-slate pose; the owning lane redefines it (skins import this name). */
export type RouterLanesPose = SlatePose;

export const routerLanesMeta: ContraptionMeta<RouterLanesConfig, RouterLanesPose> = {
  id: "router_lanes",
  name: "Router Lanes",
  modes: ["sorter.bins"],
  tier: "native",
  status: "demo",
  reusable: "any_subject",
  layouts: ["board"],
  defaultLayout: "board",
  payoffs: ["ramp_forms", "door_carries", "stairwell_opens", "stairs_rise", "vault_opens", "gate_lifts", "door_opens"],
  nearMissKeys: [],
  accessories: ["record_lens"],
  skins: ROUTER_LANES_SKINS,
  control: "bins",
  configSchema: RouterLanesConfig,
  validateConfig: (config, ctx) => validateRouterLanes(config, ctx),
  defaultConfig(ctx: ConfigCtx): RouterLanesConfig {
    const items = itemKeysOf(ctx.view).map((key) => {
      const text = viewTextOf(ctx.view, key);
      return { key, meta: { printedDate: findDates(text)[0] ?? null } };
    });
    const years = items.map((i) => (i.meta.printedDate ? Math.floor(fracYearOf(i.meta.printedDate) ?? 0) : 0)).filter((y) => y > 0);
    const probe = ctx.biome === "archive_of_voices" && years.length >= 2 ? yearProbeFor(years) : null;
    return RouterLanesConfig.parse({
      items,
      lanes: defaultLanes(ctx.view),
      shutters: ctx.biome === "archive_of_voices", // sensitive biomes (§4.4 defaults)
      probe,
      probeWorld: probe ? "record_lens" : "none",
    });
  },
  writerConfigSchema: (ctx) => (ctx.itemKeys.length > 0 ? routerLanesWriterSchema(ctx) : null),
  fromWriterConfig(w: unknown, ctx: ConfigCtx): RouterLanesConfig {
    const wc = w as RouterLanesWriter;
    const probe = probeFromWriter(wc.probe);
    return RouterLanesConfig.parse({
      items: wc.items.map((i) => ({
        key: i.key,
        meta: { printedDate: i.printedDate, madeYear: i.madeYear },
        polar: i.polar,
        charged: i.charged,
        from: i.from,
        to: i.to,
      })),
      lanes: defaultLanes(ctx.view),
      lens: wc.items.some((i) => i.polar !== null || i.charged !== null) ? "hydration" : "none",
      shutters: ctx.biome === "archive_of_voices",
      probe,
      probeWorld: probe && (probe.format === "year" || probe.format === "month_year") ? "record_lens" : "none",
    });
  },
  ...slateLive<RouterLanesConfig>(ROUTER_LANES_SKINS, (c) => c.probe),
};

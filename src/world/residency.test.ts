/**
 * src/world/residency.test.ts — assetsForZone (docs/design/20 §5.7): every asset source category lands in the zone that
 * uses it and nowhere else; the cast is in every zone; results are sorted and unique.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WorldFile, type WorldOverlay } from "../contracts/world";
import { assetsForZone } from "./residency";

const ROOT = path.resolve(import.meta.dirname, "../..");
const base = WorldFile.parse(JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/worlds/trig.world.json"), "utf8"))).world;

/** A two-zone world with one of every asset-bearing thing in zone "b" (fields the function reads; cast via unknown). */
function world(): WorldOverlay {
  const w = structuredClone(base);
  const z0 = w.zones[0];
  const zb = { ...structuredClone(z0), id: "b", entryCutsceneId: "enter_b" };
  zb.layerSets = [{ id: "b_set", layers: [...z0.layerSets[0].layers.slice(0, 2), { ...z0.layerSets[0].layers[0], asset: "orrery_terraces.layer.b_only" }] }];
  zb.ground = { ...zb.ground, surface: "orrery_terraces.ground.b_surface", underside: "orrery_terraces.ground.b_under" };
  zb.platforms = [{ id: "p1", points: [[0, 900], [100, 900]], asset: "orrery_terraces.prop.b_platform", requires: null }];
  zb.interiors = [{ id: "i1", x0: 10, x1: 20, facade: "orrery_terraces.prop.b_facade", facadeAt: [0, 0], segment: null }];
  zb.segments = zb.segments.map((sg) => ({ ...sg, ambient: { ...sg.ambient, dapple: "orrery_terraces.fx.b_dapple" } }));
  (zb as unknown as { hub: unknown }).hub = { asset: "orrery_terraces.prop.b_hub" };
  (zb as unknown as { links: unknown[] }).links = [
    { kind: "ladder", asset: "orrery_terraces.prop.b_ladder" },
    { kind: "ride", vehicle: "orrery_terraces.prop.b_gondola" },
  ];
  zb.exits = [];
  w.zones = [z0, zb as typeof z0];
  const extra = w as unknown as Record<string, unknown[]>;
  extra.props = [{ zoneId: "b", asset: "orrery_terraces.prop.b_lamp", states: [{ state: "lit", asset: "orrery_terraces.prop.b_lamp_lit" }], touch: { litAsset: "orrery_terraces.fx.b_touch" } }];
  extra.npcs = [{ asset: "orrery_terraces.npc.b_bot", look: null, states: [{ zoneId: "b" }] }];
  extra.plaques = [{ zoneId: "b", asset: "orrery_terraces.doc.b_plaque" }];
  extra.collectibles = [{ zoneId: "b", asset: "orrery_terraces.prop.b_shard" }];
  extra.triggers = [{ zoneId: "b", cutsceneId: "trig_b" }];
  extra.quests = [{ reward: { cosmetic: "orrery_terraces.costume.b_trim" } }];
  extra.cutscenes = [
    { id: "enter_b", steps: [{ do: "vista", asset: "orrery_terraces.vista.b_vista" }] },
    { id: "trig_b", steps: [{ do: "ride", vehicle: "orrery_terraces.prop.b_skiff" }] },
    { id: "elsewhere", steps: [{ do: "vista", asset: "orrery_terraces.vista.never" }] },
    { id: "into_b", steps: [{ do: "enter_zone", zoneId: "b" }, { do: "vista", asset: "orrery_terraces.vista.enters_b" }] },
  ];
  w.story = { ...w.story, introCutsceneId: "none_intro", finaleCutsceneId: "none_finale" };
  return w;
}

describe("assetsForZone", () => {
  it("collects every asset-bearing thing of the zone", () => {
    const keys = assetsForZone(world(), "b");
    for (const k of [
      "orrery_terraces.layer.b_only",
      "orrery_terraces.ground.b_surface",
      "orrery_terraces.ground.b_under",
      "orrery_terraces.prop.b_platform",
      "orrery_terraces.prop.b_facade",
      "orrery_terraces.fx.b_dapple",
      "orrery_terraces.prop.b_hub",
      "orrery_terraces.prop.b_ladder",
      "orrery_terraces.prop.b_gondola",
      "orrery_terraces.prop.b_lamp",
      "orrery_terraces.prop.b_lamp_lit",
      "orrery_terraces.fx.b_touch",
      "orrery_terraces.npc.b_bot",
      "orrery_terraces.doc.b_plaque",
      "orrery_terraces.prop.b_shard",
      "orrery_terraces.costume.b_trim",
      "orrery_terraces.vista.b_vista",
      "orrery_terraces.prop.b_skiff",
      "orrery_terraces.vista.enters_b",
    ])
      expect(keys, k).toContain(k);
    expect(keys).not.toContain("orrery_terraces.vista.never");
    expect([...keys].sort()).toEqual(keys);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("keeps zone-local things out of other zones but puts the cast in every zone", () => {
    const w = world();
    const a = assetsForZone(w, w.zones[0].id);
    expect(a).not.toContain("orrery_terraces.prop.b_lamp");
    expect(a).not.toContain("orrery_terraces.vista.b_vista");
    for (const k of [w.cast.protagonist.look.atlas, w.cast.guide.companion.asset, ...w.cast.protagonist.look.costume.map((c) => c.asset)]) {
      expect(a).toContain(k);
      expect(assetsForZone(w, "b")).toContain(k);
    }
  });
  it("loads the intro's assets with the first zone and the finale's with the last station's zone", () => {
    const w = world();
    const extra = w as unknown as Record<string, unknown[]>;
    extra.cutscenes = [...extra.cutscenes, { id: "intro_x", steps: [{ do: "ride", vehicle: "orrery_terraces.prop.intro_car" }] }, { id: "finale_x", steps: [{ do: "vista", asset: "orrery_terraces.vista.finale" }] }];
    w.story = { ...w.story, introCutsceneId: "intro_x", finaleCutsceneId: "finale_x" };
    const first = w.zones[0].id;
    expect(assetsForZone(w, first)).toContain("orrery_terraces.prop.intro_car");
    expect(assetsForZone(w, "b")).not.toContain("orrery_terraces.prop.intro_car");
    w.stations = w.stations.map((st, i) => (i === w.stations.length - 1 ? { ...st, zoneId: "b" } : st));
    expect(assetsForZone(w, "b")).toContain("orrery_terraces.vista.finale");
    if (w.stations.length > 1) expect(assetsForZone(w, first)).not.toContain("orrery_terraces.vista.finale");
  });
  it("includes the stations' skin parts and consoles of the zone", () => {
    if (base.stations.length === 0) return;
    const st = base.stations[0];
    const keys = assetsForZone(base, st.zoneId);
    expect(keys.some((k) => k.includes(".part."))).toBe(true);
  });
  it("returns [] for an unknown zone", () => {
    expect(assetsForZone(world(), "nope")).toEqual([]);
  });
});

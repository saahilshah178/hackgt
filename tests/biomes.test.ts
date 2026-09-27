import { describe, expect, it } from "vitest";
import { DOMAINS } from "../src/contracts/common";
import { ASSET_NAMESPACES, Emblem } from "../src/contracts/world";
import { BIOME_IDS, BIOME_KITS, biomeKitOf, isBiomeId, rankBiomes, skinDefaultsFor, successPoseFor } from "../src/world/biomes";
import { SIM_IDS } from "../src/world/sims/index";

describe("BIOME_KITS", () => {
  it("has the three showcase kits, keyed by their own ids and namespaces", () => {
    expect([...BIOME_IDS].sort()).toEqual(["archive_of_voices", "living_gate", "orrery_terraces"]);
    for (const id of BIOME_IDS) {
      const kit = BIOME_KITS[id]!;
      expect(kit.id).toBe(id);
      expect(ASSET_NAMESPACES).toContain(id);
      expect(kit.zonePresets.length).toBeGreaterThan(0);
      expect(Emblem.safeParse(kit.emblemDefault).success).toBe(true);
      expect(kit.companionDefault.startsWith(`${id}.companion.`)).toBe(true);
      for (const p of kit.zonePresets) for (const l of p.layerSet.layers) expect(l.asset.startsWith(`${id}.`)).toBe(true);
    }
  });
  it("successPose per kit: the archive shows, never cheers (A11, R10)", () => {
    expect(BIOME_KITS.archive_of_voices!.successPose).toBe("show");
    expect(BIOME_KITS.archive_of_voices!.sensitive).toBe(true);
    expect(BIOME_KITS.orrery_terraces!.successPose).toBe("cheer");
    expect(BIOME_KITS.living_gate!.successPose).toBe("cheer");
    for (const kit of Object.values(BIOME_KITS)) if (kit.sensitive) expect(kit.successPose).toBe("show");
    expect(successPoseFor("archive_of_voices")).toBe("show");
    expect(successPoseFor("unknown")).toBe("cheer");
  });
  it("sensitive kits carry fictional staff, protected names and a violence lexicon", () => {
    const k = BIOME_KITS.archive_of_voices!;
    expect(k.fictionalStaff.every((a) => a.startsWith("shared.char."))).toBe(true);
    expect(k.protectedNames).toContain("Rosa Parks");
    expect(k.violenceLexicon).toContain("firebombed");
  });
  it("reference sims exist", () => {
    for (const kit of Object.values(BIOME_KITS)) for (const s of kit.sims) expect(SIM_IDS as readonly string[]).toContain(s);
  });
  it("skin defaults agree with the metas' biome tables", () => {
    expect(skinDefaultsFor("archive_of_voices")).toMatchObject({ aimer: "arc_lamp", quarantineAnim: "retract_stamp", connector: "catenary", layout: "canopy_row", bays: "flat_road" });
    expect(skinDefaultsFor("living_gate")).toMatchObject({ aimer: "probe_emitter", quarantineAnim: "ridge_thaw" });
    expect(skinDefaultsFor("nowhere")).toEqual(BIOME_KITS.orrery_terraces!.skinDefaults);
    expect(isBiomeId("toString")).toBe(false);
    expect(biomeKitOf("living_gate")?.name).toBe("Inside a Cell");
  });
});

describe("rankBiomes", () => {
  it("exact domain match first, then the general ordering; total over every domain", () => {
    expect(rankBiomes("math")[0]).toBe("orrery_terraces");
    expect(rankBiomes("biology")[0]).toBe("living_gate");
    expect(rankBiomes("history")[0]).toBe("archive_of_voices");
    expect(rankBiomes("general")).toEqual(["orrery_terraces", "living_gate", "archive_of_voices"]);
    for (const d of DOMAINS) expect([...rankBiomes(d)].sort()).toEqual([...BIOME_IDS].sort());
  });
});

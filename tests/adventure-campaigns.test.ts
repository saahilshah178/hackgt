import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { GameSpec } from "../src/contracts/gamespec";
import { getAdventureCampaign } from "../src/game/adventure/campaigns";

const showcases = [
  ["trig-dungeon", 6, "observatory"],
  ["cell-transport-dungeon", 11, "cell"],
  ["civil-rights-mystery", 12, "archive"],
  ["trig-platformer", 6, "observatory"],
  ["wave2-dungeon", 9, "station"],
] as const;

function fixture(name: string): GameSpec {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8")) as GameSpec;
}

describe("authored adventure campaigns", () => {
  it.each(showcases)("covers every %s encounter with distinct, substantive mission content", (name, count, kind) => {
    const spec = fixture(name);
    const before = JSON.stringify(spec);
    const campaign = getAdventureCampaign(spec);
    expect(campaign).not.toBeNull();
    expect(campaign!.kind).toBe(kind);
    expect(campaign!.chapters.map((entry) => entry.id)).toEqual(spec.encounters.map((entry) => entry.id));
    expect(campaign!.chapters).toHaveLength(count);
    for (const key of ["objective", "apparatus", "briefing", "discovery", "consequence", "name"] as const) {
      const values = campaign!.chapters.map((entry) => entry[key]);
      expect(new Set(values).size).toBe(count);
      const minimum = key === "apparatus" || key === "name" ? 15 : key === "objective" ? 45 : 80;
      for (const value of values) expect(value.length).toBeGreaterThan(minimum);
    }
    for (const key of ["title", "subtitle", "role", "companion", "companionRole", "intro", "finale"] as const) {
      expect(campaign![key].trim().length).toBeGreaterThan(2);
    }
    expect(campaign!.intro.length).toBeGreaterThan(200);
    expect(campaign!.finale.length).toBeGreaterThan(200);
    expect(campaign!.chapters.some((entry) => entry.name.startsWith("Act I ·"))).toBe(true);
    expect(campaign!.chapters.some((entry) => entry.name.startsWith("Act II ·"))).toBe(true);
    expect(campaign!.chapters.some((entry) => entry.name.startsWith("Act III ·"))).toBe(true);
    expect(JSON.stringify(spec)).toBe(before);
  });

  it("authors all 44 showcase encounters and gives the skywalk its own fiction", () => {
    expect(showcases.reduce((sum, [, count]) => sum + count, 0)).toBe(44);
    const dungeon = getAdventureCampaign(fixture("trig-dungeon"))!;
    const platformer = getAdventureCampaign(fixture("trig-platformer"))!;
    expect(platformer.role).not.toBe(dungeon.role);
    for (let index = 0; index < dungeon.chapters.length; index++) {
      expect(platformer.chapters[index].briefing).not.toBe(dungeon.chapters[index].briefing);
      expect(platformer.chapters[index].consequence).not.toBe(dungeon.chapters[index].consequence);
    }
  });

  it("supports the existing history dungeon with the same evidence-led archive", () => {
    const campaign = getAdventureCampaign(fixture("civil-rights-dungeon"))!;
    expect(campaign.id).toBe("history_demo_001");
    expect(campaign.chapters).toHaveLength(12);
    expect(campaign.companionRole).toContain("Fictional historian");
    expect(campaign.intro).toContain("supplied historical evidence");
    expect(campaign.intro).toContain("simplified classroom account");
    for (const entry of campaign.chapters) expect(entry.briefing).not.toMatch(/^Mara:/);
  });

  it("returns null for generated specs even when they share a subject or fixture encounters", () => {
    const spec = fixture("trig-dungeon");
    expect(getAdventureCampaign({ ...spec, id: "generated-trig-123" })).toBeNull();
    expect(getAdventureCampaign({ ...spec, id: "fixture-trig-dungeon" })).toBeNull();
  });

  it("falls back when a known fixture has missing, unknown, or duplicate encounter IDs", () => {
    const spec = fixture("trig-dungeon");
    expect(getAdventureCampaign({ ...spec, encounters: spec.encounters.slice(1) })).toBeNull();
    expect(getAdventureCampaign({ ...spec, encounters: spec.encounters.map((entry, index) => index ? entry : { ...entry, id: "new-encounter" }) })).toBeNull();
    expect(getAdventureCampaign({ ...spec, encounters: spec.encounters.map((entry, index) => index ? entry : spec.encounters[1]) })).toBeNull();
  });

  it("follows encounter order and protects the authored manifest from caller mutations", () => {
    const spec = fixture("cell-transport-dungeon");
    const reversed = { ...spec, encounters: [...spec.encounters].reverse() };
    expect(getAdventureCampaign(reversed)!.chapters.map((entry) => entry.id)).toEqual(reversed.encounters.map((entry) => entry.id));
    const first = getAdventureCampaign(spec)!;
    const original = first.chapters[0].objective;
    first.chapters[0].objective = "Changed by caller";
    expect(getAdventureCampaign(spec)!.chapters[0].objective).toBe(original);
  });
});

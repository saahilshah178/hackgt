import { describe, expect, it } from "vitest";
import { Cast } from "../contracts/world";
import { buildSpeakerDirectory, desaturateHex, lineFromSlot, speakerFor, speakerIdsOf } from "./speakers";

const spec = {
  characters: [
    { id: "cog", name: "Cog", role: "guide", voiceArchetype: "cheerful_sidekick" as const },
    { id: "warden", name: "The Warden", role: "boss", voiceArchetype: "gruff_guard" as const },
    { id: "ilse", name: "Ilse", role: "astronomer", voiceArchetype: "wise_mentor" as const },
  ],
};
const cast = Cast.parse({
  protagonist: { name: "Wren", look: { atlas: "shared.char.wren" } },
  guide: { characterId: "cog", emblem: { glyph: "owl", ring: "#C69A6B", accent: "#8FE0EA" }, portrait: "orrery_terraces.companion.cog_bust", companion: { asset: "orrery_terraces.companion.cog" } },
  speakers: [{ characterId: "warden", emblem: { glyph: "orrery", ring: "#3E3F74", accent: "#F2A65A" } }],
  extras: [{ id: "brasswick", name: "Brasswick", role: "scholar", voiceArchetype: "nervous_scholar", emblem: { glyph: "gear", ring: "#C69A6B", accent: "#8FE0EA" } }],
});

describe("the speaker directory", () => {
  const dir = buildSpeakerDirectory(spec, { cast });
  it("covers spec.characters ∪ cast.extras ∪ {player, narrator}", () => {
    expect([...dir.keys()].sort()).toEqual(["brasswick", "cog", "ilse", "narrator", "player", "warden"]);
    expect(speakerIdsOf(spec, { cast })).toEqual(new Set(dir.keys()));
  });
  it("guide, listed speakers, unlisted characters, extras, player and narrator", () => {
    expect(dir.get("cog")).toMatchObject({ kind: "character", emblem: cast.guide.emblem, portrait: "orrery_terraces.companion.cog_bust" });
    expect(dir.get("warden")?.emblem?.glyph).toBe("orrery");
    const ilse = dir.get("ilse")!;
    expect(ilse.emblem?.glyph).toBe("owl");
    expect(ilse.emblem?.ring).not.toBe(cast.guide.emblem.ring); // desaturated
    expect(dir.get("brasswick")).toMatchObject({ kind: "extra", name: "Brasswick", voiceArchetype: "nervous_scholar" });
    expect(dir.get("player")).toMatchObject({ kind: "player", name: "Wren", emblem: null });
    expect(dir.get("narrator")).toMatchObject({ kind: "narrator", emblem: null, voiceArchetype: "narrator" });
  });
  it("falls back to the narrator and fills guide slots", () => {
    expect(speakerFor(dir, "nobody").id).toBe("narrator");
    expect(lineFromSlot({ speakerId: null, text: "Hi", mood: "neutral" }, "cog")).toEqual({ speakerId: "cog", text: "Hi", mood: "neutral" });
    expect(lineFromSlot({ speakerId: "warden", text: "Ha", mood: "wry" }, "cog").speakerId).toBe("warden");
  });
  it("desaturates toward grey", () => {
    expect(desaturateHex("#FF0000", 0)).toBe("#363636");
    expect(desaturateHex("#FF0000", 1)).toBe("#FF0000");
    expect(desaturateHex("bad")).toBe("bad");
  });
});

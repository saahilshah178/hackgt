import { describe, expect, it } from "vitest";
import { clampSentences, clampText, shortName, toId, toRef } from "../src/pipeline/world3d/text";
import { mapSizeFor, walkBudgetMetres } from "../src/pipeline/world3d/checks";
import { chooseLook } from "../src/pipeline/world3d/fallback";

/*
 * Small pieces of the world3d pipeline (docs/design/60 §2.5): id normalization, text fitting, the map size and walking
 * budget per game length, and the fallback composer's choice of look by subject.
 */

describe("world3d pipeline helpers", () => {
  it("normalizes any string to a stored id and keeps the reserved words", () => {
    expect(toId("Great Pyramid!")).toBe("great_pyramid");
    expect(toId("  ")).toBe("item");
    expect(toId("2nd gate")).toBe("x_2nd_gate");
    expect(toId("Ünïcode Café")).toBe("unicode_cafe");
    expect(toId("a".repeat(80))).toHaveLength(48);
    expect(toRef("Narrator")).toBe("narrator");
    expect(toRef("spawn")).toBe("spawn");
    expect(toRef("Nebet the Scribe")).toBe("nebet_the_scribe");
  });

  it("fits text at word and sentence boundaries", () => {
    expect(clampText("short", 10)).toBe("short");
    const cut = clampText("the quick brown fox jumps over the lazy dog", 20);
    expect(cut.length).toBeLessThanOrEqual(20);
    expect(cut.endsWith("…")).toBe(true);
    expect(clampSentences("One. Two two. Three three three.", 14)).toBe("One. Two two.");
    expect(shortName("Brown v. Board of Education (1954)")).toBe("Brown v. Board of Education");
  });

  it("sizes the map and the walk by game length", () => {
    expect([5, 10, 15].map(mapSizeFor)).toEqual([420, 560, 700]);
    expect(walkBudgetMetres(10)).toBe(1056);
  });

  it("picks a look that fits the subject", () => {
    expect(chooseLook("history", "The pharaohs of the Nile").biome).toBe("desert");
    expect(chooseLook("history", "Ancient Rome and the Republic").style).toBe("classical");
    expect(chooseLook("history", "The Civil Rights Movement, 1954-1968").goal.kind).toBe("palace");
    expect(chooseLook("biology", "Cell transport: osmosis and diffusion").biome).toBe("wetland");
    expect(chooseLook("biology", "Coral reef ecosystems").biome).toBe("tropical");
    expect(chooseLook("earth_space", "Volcanoes and plate tectonics").biome).toBe("volcanic");
    expect(chooseLook("earth_space", "The phases of the Moon").biome).toBe("lunar");
    expect(chooseLook("earth_space", "Glaciers and climate").biome).toBe("alpine");
    expect(chooseLook("math", "Trigonometric functions: sine waves, period and amplitude").goal.kind).toBe("lighthouse");
    expect(chooseLook("physics", "Newton's laws of motion").style).toBe("futuristic");
    expect(chooseLook(null, "Knitting for beginners").style).toBe("rustic");
  });
});

import { describe, expect, it } from "vitest";
import { applyFeedbackNouns, feedbackNounsFor, matchCase } from "./feedback-nouns";

describe("applyFeedbackNouns", () => {
  it("replaces whole words, preserving case", () => {
    const swaps = [{ from: "chest", to: "singer" }];
    expect(applyFeedbackNouns("That chest was honest: it holds.", swaps)).toBe("That singer was honest: it holds.");
    expect(applyFeedbackNouns("Chest two. CHEST three.", swaps)).toBe("Singer two. SINGER three.");
    expect(applyFeedbackNouns("The chestnut and treasure-chest", swaps)).toBe("The chestnut and treasure-singer");
    expect(applyFeedbackNouns("chests", swaps)).toBe("chests");
  });
  it("longest `from` first, never re-matching replaced text", () => {
    const swaps = [
      { from: "chest", to: "box" },
      { from: "mimic chest", to: "false singer" },
      { from: "box", to: "crate" },
    ];
    expect(applyFeedbackNouns("The mimic chest and the chest and a box.", swaps)).toBe("The false singer and the box and a crate.");
  });
  it("leaves text alone without swaps", () => {
    expect(applyFeedbackNouns("Unchanged.", [])).toBe("Unchanged.");
    expect(matchCase("x", "y")).toBe("y");
  });
});

describe("feedbackNounsFor", () => {
  it("applies null-station entries everywhere and listed ones only to their stations", () => {
    const nouns = [
      { from: "chest", to: "singer", stations: null },
      { from: "bin", to: "lane", stations: ["e2_selectivity"] },
    ];
    expect(feedbackNounsFor(nouns, "e2_selectivity")).toEqual([{ from: "chest", to: "singer" }, { from: "bin", to: "lane" }]);
    expect(feedbackNounsFor(nouns, "e3_diffusion")).toEqual([{ from: "chest", to: "singer" }]);
  });
});

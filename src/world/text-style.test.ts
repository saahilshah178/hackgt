import { describe, expect, it } from "vitest";
import { hintLadderProblems, textStyleProblems } from "./text-style";

describe("textStyleProblems (docs/WRITING.md)", () => {
  it("passes short, plain lines", () => {
    expect(textStyleProblems("Too far. The wheel went past the start. Try less time.")).toEqual([]);
    expect(textStyleProblems("One period is 2π ÷ 2. What's that?")).toEqual([]);
  });

  it("flags em dashes, semicolons and clause-joining colons", () => {
    expect(textStyleProblems("It spins — fast.")).toHaveLength(1);
    expect(textStyleProblems("Only big marks have labels; count the rest.")).toHaveLength(1);
    expect(textStyleProblems("A radian is a walk, not a turn: π is halfway.")).toHaveLength(1);
  });

  it("does not flag colons inside times or ratios", () => {
    expect(textStyleProblems("Meet at 7:30. Mix it 1:2.")).toEqual([]);
  });

  it("flags buzzwords and very long sentences", () => {
    expect(textStyleProblems("Let's delve into the orrery.")).toEqual(['uses "delve"; say it in everyday words']);
    const long = "This sentence keeps going and going with far too many words for a young player to follow along with easily and happily.";
    expect(textStyleProblems(long)[0]).toMatch(/-word sentence/);
  });
});

describe("hintLadderProblems (docs/HINTS.md)", () => {
  const prompt = "Set the timer to one full turn of the wheel.";

  it("passes a specific, climbing ladder", () => {
    expect(
      hintLadderProblems(
        [
          "Look at the 2 inside sin(2t). It makes this wheel spin faster than plain sin(t).",
          "One period is 2π divided by the number next to t. Here that's 2π ÷ 2.",
          "Plain sin(t) takes 2π. Twice as fast means half of 2π.",
        ],
        prompt,
      ),
    ).toEqual([]);
  });

  it("flags vague hints, repeats of the prompt and repeated hints", () => {
    const out = hintLadderProblems(["Think about what a period really means.", "Set the timer to one full turn of the wheel!", "Look at the 2.", "Look at the 2."], prompt);
    expect(out).toEqual([
      expect.stringMatching(/^hint 1 is too vague/),
      expect.stringMatching(/^hint 2 repeats the prompt/),
      expect.stringMatching(/^hint 4 repeats an earlier hint/),
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { Intake } from "../src/contracts/knowledge";

const items = [0, 1, 2].map((i) => ({
  prompt: `Q${i}?`,
  choices: ["a", "b", "c", "d"],
  correctIndex: 1,
  conceptId: "c1",
}));

const base = {
  goal: "learn" as const,
  minutes: 10 as const,
  genre: "auto" as const,
  confidence: { u1: 3 },
};

describe("Intake.preCheck.answers", () => {
  it("accepts -1 as a skipped (\"not sure\") answer", () => {
    const r = Intake.safeParse({ ...base, preCheck: { items, answers: [-1, 1, 3] } });
    expect(r.success).toBe(true);
  });
  it("rejects indices outside -1..3", () => {
    expect(Intake.safeParse({ ...base, preCheck: { items, answers: [-2, 1, 3] } }).success).toBe(false);
    expect(Intake.safeParse({ ...base, preCheck: { items, answers: [0, 4, 3] } }).success).toBe(false);
  });
});

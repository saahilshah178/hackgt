import { describe, expect, it } from "vitest";
import { PRECHECK_SYSTEM as INTAKE_PRECHECK_SYSTEM } from "../src/pipeline/agents/precheck.prompt";
import { ASSESSMENT_SYSTEM, CHALLENGE_SYSTEM, DIRECTOR_SYSTEM, NARRATIVE_SYSTEM, PRECHECK_SYSTEM } from "../src/pipeline/prompts";
import { styleGuides } from "../src/pipeline/style-guides";

describe("docs/WRITING.md and docs/HINTS.md reach every writer agent", () => {
  const { writing, hints } = styleGuides();

  it("every player-facing writer gets the writing standard, after its mock-dispatch opening", () => {
    const writers: [string, string][] = [
      [DIRECTOR_SYSTEM, "You are the Director"],
      [CHALLENGE_SYSTEM, "You are the Challenge Writer"],
      [NARRATIVE_SYSTEM, "You are the Narrative Writer"],
      [ASSESSMENT_SYSTEM, "You are the Assessment Writer"],
      [PRECHECK_SYSTEM, "You are the Pre-check Writer"],
      [INTAKE_PRECHECK_SYSTEM, "You are the Pre-check Writer"],
    ];
    for (const [system, opening] of writers) {
      expect(system.startsWith(opening)).toBe(true);
      expect(system).toContain(writing);
    }
  });

  it("only the Challenge Writer (the one agent that writes hints) gets the hint standard", () => {
    expect(CHALLENGE_SYSTEM).toContain(hints);
    expect(NARRATIVE_SYSTEM).not.toContain(hints);
  });
});

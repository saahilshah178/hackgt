import type { Mcq } from "../../contracts/knowledge";
import type { AssessmentItemSlice } from "../../contracts/slices";

/** Converts an already-shuffled Mcq (as authored in a fixture Intake) back into a pre-check item shape. */
export function mcqToItem(m: Mcq): AssessmentItemSlice {
  return {
    conceptId: m.conceptId,
    prompt: m.prompt,
    correct: m.choices[m.correctIndex],
    distractors: m.choices.filter((_, i) => i !== m.correctIndex),
  };
}

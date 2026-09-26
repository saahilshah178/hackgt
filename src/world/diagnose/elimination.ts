/** investigator.elimination: accused ≠ survivor → wrong_hypothesis, wrongKeys [id, clue:i]; disclosed {clueIndex}. */
import { CORRECT, arr, field, isObj, miss, str, textAt, type ModeDiagnoser } from "./shared";

export const eliminationDiagnoser: ModeDiagnoser = {
  modeKey: "investigator.elimination",
  failKeys: ["wrong_hypothesis"],
  mirror({ params, solution, input }) {
    const id = str(input, "hypothesisId") ?? "";
    if (id === str(solution, "survivorId")) return CORRECT;
    const by = field(solution, "eliminatedBy");
    const clueIndex = isObj(by) && typeof by[id] === "number" ? (by[id] as number) : undefined;
    const hyp = arr(params, "hypotheses").find((h) => field(h, "id") === id);
    const hypText = typeof field(hyp, "text") === "string" ? (field(hyp, "text") as string) : undefined;
    if (clueIndex === undefined) {
      return hypText === undefined ? miss("wrong_hypothesis", "Pick one of the hypotheses.") : miss("wrong_hypothesis", hypText, [id]);
    }
    const clue = textAt(params, "clues", clueIndex, "text") ?? "";
    return miss("wrong_hypothesis", clue, [id, `clue:${clueIndex}`], { disclosed: { clueIndex } });
  },
};

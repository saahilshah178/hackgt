/** truth_finder.predict_reveal: picked ≠ correct → wrong_option, wrongKeys [optionIndex]; needle = its explanation. */
import { CORRECT, miss, num, textAt, type ModeDiagnoser } from "./shared";

export const predictRevealDiagnoser: ModeDiagnoser = {
  modeKey: "truth_finder.predict_reveal",
  failKeys: ["wrong_option"],
  mirror({ params, solution, input }) {
    const picked = num(input, "optionIndex");
    if (picked !== null && picked === num(solution, "correctIndex")) return CORRECT;
    const explanation = picked === null ? undefined : textAt(params, "options", picked, "explanation");
    if (explanation === undefined) return miss("wrong_option", "Pick one of the options.");
    return miss("wrong_option", explanation, [String(picked)]);
  },
};

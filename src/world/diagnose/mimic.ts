/** truth_finder.mimic: picked ≠ mimic → honest, wrongKeys [statementIndex]; needle = that statement's explanation. */
import { CORRECT, miss, num, textAt, type ModeDiagnoser } from "./shared";

export const mimicDiagnoser: ModeDiagnoser = {
  modeKey: "truth_finder.mimic",
  failKeys: ["honest"],
  mirror({ params, solution, input }) {
    const picked = num(input, "statementIndex");
    if (picked !== null && picked === num(solution, "mimicIndex")) return CORRECT;
    const explanation = picked === null ? undefined : textAt(params, "statements", picked, "explanation");
    if (explanation === undefined) return miss("honest", "Pick one of the chests.");
    return miss("honest", explanation, [String(picked)]);
  },
};

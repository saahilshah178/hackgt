/** sorter.type_match: first wave missing or wrong → wrong_wave, wrongKeys [w<i>]; disclosed {category}. */
import { CORRECT, arr, field, miss, textAt, type ModeDiagnoser } from "./shared";

export const typeMatchDiagnoser: ModeDiagnoser = {
  modeKey: "sorter.type_match",
  failKeys: ["wrong_wave"],
  mirror({ params, solution, input }) {
    const answers = arr(solution, "answers").map(String);
    const given = new Map(arr(input, "answers").map((a) => [field(a, "waveIndex"), field(a, "categoryId")]));
    const wrongAt = answers.findIndex((expected, i) => given.get(i) !== expected);
    if (wrongAt === -1) return CORRECT;
    const text = textAt(params, "waves", wrongAt, "text") ?? `wave ${wrongAt}`;
    return miss("wrong_wave", text, [`w${wrongAt}`], { disclosed: { category: answers[wrongAt] } });
  },
};

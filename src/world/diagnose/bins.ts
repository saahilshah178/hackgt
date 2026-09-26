/** sorter.bins: any unplaced → first wrong key in i0, i1… order (incomplete / wrong_bin; disclosed {bin}). */
import { CORRECT, arr, field, isObj, keyIndex, miss, textAt, type ModeDiagnoser } from "./shared";

export const binsDiagnoser: ModeDiagnoser = {
  modeKey: "sorter.bins",
  failKeys: ["incomplete", "wrong_bin"],
  mirror({ params, solution, input }) {
    const want = field(solution, "assignments");
    const assignments: Record<string, unknown> = isObj(want) ? want : {};
    const given = new Map(arr(input, "assignments").map((a) => [String(field(a, "itemKey")), String(field(a, "binId"))]));
    const keys = Object.keys(assignments);
    if (keys.some((k) => !given.has(k))) return miss("incomplete", `Place all ${keys.length} items`);
    const wrongKey = keys.find((k) => given.get(k) !== assignments[k]);
    if (!wrongKey) return CORRECT;
    const i = keyIndex(wrongKey);
    const text = textAt(params, "items", i, "text") ?? wrongKey;
    const bin = textAt(params, "items", i, "binId") ?? String(assignments[wrongKey]);
    return miss("wrong_bin", text, [wrongKey], { disclosed: { bin } });
  },
};

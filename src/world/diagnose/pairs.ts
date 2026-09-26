/** linker.pairs: any unlinked → first wrong left in l0, l1… order (incomplete / wrong_link; disclosed {given}). */
import { CORRECT, arr, field, isObj, keyIndex, miss, textAt, type ModeDiagnoser } from "./shared";

export const pairsDiagnoser: ModeDiagnoser = {
  modeKey: "linker.pairs",
  failKeys: ["incomplete", "wrong_link"],
  mirror({ params, solution, input }) {
    const want = field(solution, "links");
    const links: Record<string, unknown> = isObj(want) ? want : {};
    const given = new Map(arr(input, "links").map((l) => [String(field(l, "leftKey")), String(field(l, "rightKey"))]));
    const keys = Object.keys(links);
    if (keys.some((k) => !given.has(k))) return miss("incomplete", `Link all ${keys.length} pairs.`);
    const wrongKey = keys.find((k) => given.get(k) !== links[k]);
    if (!wrongKey) return CORRECT;
    const left = textAt(params, "pairs", keyIndex(wrongKey), "left") ?? wrongKey;
    return miss("wrong_link", left, [wrongKey], { disclosed: { given: given.get(wrongKey) ?? "" } });
  },
};

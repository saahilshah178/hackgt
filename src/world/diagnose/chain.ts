/** linker.chain: decoy edge → first solution edge not given (decoy / wrong_link, prefix = that edge's index) → incomplete. */
import { CORRECT, arr, field, keyIndex, miss, textAt, type ModeDiagnoser } from "./shared";

function textForKey(params: unknown, key: string): string {
  const i = keyIndex(key);
  return (key.startsWith("d") ? textAt(params, "decoys", i) : textAt(params, "nodes", i)) ?? key;
}

export const chainDiagnoser: ModeDiagnoser = {
  modeKey: "linker.chain",
  failKeys: ["decoy", "wrong_link", "incomplete"],
  mirror({ params, solution, input }) {
    const edges = arr(solution, "edges").map((e) => ({ from: String(field(e, "from")), to: String(field(e, "to")) }));
    const got = arr(input, "edges").map((e) => ({ fromKey: String(field(e, "fromKey")), toKey: String(field(e, "toKey")) }));
    // edgeSetEquals, exactly as the mode does it
    if (edges.length === got.length) {
      const a = new Set(edges.map((e) => `${e.from}->${e.to}`));
      const b = new Set(got.map((e) => `${e.fromKey}->${e.toKey}`));
      if (a.size === b.size && [...a].every((e) => b.has(e))) return CORRECT;
    }
    const decoyEdge = got.find((e) => e.fromKey.startsWith("d") || e.toKey.startsWith("d"));
    if (decoyEdge) {
      const bad = decoyEdge.fromKey.startsWith("d") ? decoyEdge.fromKey : decoyEdge.toKey;
      return miss("decoy", textForKey(params, bad), [bad]);
    }
    const given = new Map(got.map((e) => [e.fromKey, e.toKey]));
    const at = edges.findIndex((e) => given.get(e.from) !== e.to);
    if (at !== -1) return miss("wrong_link", textForKey(params, edges[at].from), [edges[at].from], { prefix: at });
    return miss("incomplete", "Link every node");
  },
};

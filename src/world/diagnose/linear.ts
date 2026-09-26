/** sequencer.linear: length → decoy → first wrong slot (incomplete / decoy / order; prefix = wrongAt). */
import { CORRECT, arr, keyIndex, miss, textAt, type ModeDiagnoser } from "./shared";

function textForKey(params: unknown, key: string): string {
  const i = keyIndex(key);
  return (key.startsWith("d") ? textAt(params, "decoys", i) : textAt(params, "steps", i)) ?? key;
}

export const linearDiagnoser: ModeDiagnoser = {
  modeKey: "sequencer.linear",
  failKeys: ["incomplete", "decoy", "order"],
  mirror({ params, solution, input }) {
    const order = arr(solution, "order").map(String);
    const keys = arr(input, "keys").map(String);
    if (keys.length !== order.length) return miss("incomplete", `Fill all ${order.length} slots.`);
    const decoy = keys.find((k) => k.startsWith("d"));
    if (decoy) return miss("decoy", textForKey(params, decoy), [decoy]);
    const wrongAt = keys.findIndex((k, i) => k !== order[i]);
    if (wrongAt === -1) return CORRECT;
    return miss("order", `Slot ${wrongAt + 1}`, [keys[wrongAt]], { prefix: wrongAt });
  },
};

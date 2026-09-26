/**
 * src/world/hint-targets.ts — the one resolution rule for companion hint flights (docs/design/20 §2.5.1, A7).
 * W0 ships the final signature and rule; V1 owns the file (+ test) from T0 + 2.
 *   hintTargetsFor(st, meta, rung, input) = st.hintTargets?.[rung − 1] ?? meta.hintTargets(rung, input)
 * A meta's hintTargets starts from skinOf(input.skinId).hintTargets[rung − 1] and may add config-driven targets.
 */
import type { Station } from "../contracts/world";
import type { AnyContraptionMeta, HintRung, HintTarget, StaticInput } from "./types";

export function hintTargetsFor(
  st: Pick<Station, "hintTargets">,
  meta: Pick<AnyContraptionMeta, "hintTargets">,
  rung: HintRung,
  input: StaticInput<unknown>,
): readonly HintTarget[] {
  return st.hintTargets?.[rung - 1] ?? meta.hintTargets(rung, input);
}

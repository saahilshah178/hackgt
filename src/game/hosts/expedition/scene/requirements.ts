/**
 * scene/requirements.ts (pure, H1) — the host's entry point to requirement checks (platforms, links, segment variants,
 * NPC states, props, triggers). The semantics live in S1's src/world/state/** (docs/design/20 §2.4.4–§2.4.6); this
 * module re-exports them plus two host conveniences.
 */
import type { ReqCtx, WorldState } from "../../../../world/types";
import { emptyWorldState } from "../../../../world/state/world-state";

export { requirementMet } from "../../../../world/state/requirements";
export { activeNpcState } from "../../../../world/state/npc-state";

export const EMPTY_WORLD_STATE: WorldState = emptyWorldState();

export function reqCtxOf(solvedIds: Iterable<string>, state: WorldState | null | undefined): ReqCtx {
  return { solvedIds: new Set(solvedIds), state: state ?? EMPTY_WORLD_STATE };
}

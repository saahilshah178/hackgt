/**
 * src/world/state/npc-state.ts (S1) — NPC state selection (docs/design/20 §2.4.4, amendment 16).
 * The active state is the LAST `NpcState` whose `requires` holds. A `pose: "hidden"` state is still returned
 * (the host hides the actor); `null` means no state holds and the NPC is absent.
 */
import type { Npc, NpcState } from "../../contracts/world";
import type { ReqCtx } from "../types";
import { requirementMet } from "./requirements";
import { talkKey } from "./world-state";

export function activeNpcState(npc: Npc, ctx: ReqCtx): NpcState | null {
  for (let i = npc.states.length - 1; i >= 0; i--) {
    const st = npc.states[i];
    if (requirementMet(st.requires, ctx)) return st;
  }
  return null;
}

/** True when the NPC is present and visible in `zoneId` (the active state is there and not hidden). */
export function npcVisibleIn(npc: Npc, zoneId: string, ctx: ReqCtx): boolean {
  const st = activeNpcState(npc, ctx);
  return st !== null && st.zoneId === zoneId && st.pose !== "hidden";
}

/**
 * Whether pressing E on the NPC should queue its lines: a non-repeatable state that was already talked through
 * still answers (the host replays the last line) but no longer re-records `talk` or `setFlag`.
 */
export function npcStateTalked(npc: Npc, state: NpcState, ctx: ReqCtx): boolean {
  return ctx.state.talked.has(talkKey(npc.id, state.id));
}

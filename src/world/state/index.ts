/**
 * src/world/state (S1) — the world-state API (docs/design/20 §2.4.6). Implements `WorldStateApi` (src/world/types.ts).
 */
import type { WorldStateApi } from "../types";
import { activeNpcState } from "./npc-state";
import { questStatus, settleQuests } from "./quests";
import { requirementMet } from "./requirements";
import { reduceWorldState } from "./world-state";

export * from "./world-state";
export * from "./requirements";
export * from "./npc-state";
export * from "./quests";
export * from "./bonus";

/** The one object satisfying the main-owned `WorldStateApi` signature (compile-time check). */
export const WORLD_STATE_API: WorldStateApi = { reduceWorldState, requirementMet, activeNpcState, questStatus, settleQuests };

/**
 * src/world/state/world-state.ts (S1) — the pure world-state reducer (docs/design/20 §2.4.6).
 * Flags, collected, touched, talked, fired triggers, sandbox goals and cosmetics. Never persisted across reloads
 * (the runner is not either), so it can never disagree with runner progress.
 * Pure: relative imports only, no DOM, no clocks.
 */
import type { WorldState, WorldStateEvent } from "../types";

export type { ReqCtx, WorldState, WorldStateEvent } from "../types";

const EMPTY_SET: ReadonlySet<string> = new Set<string>();

/** A fresh world state. `flags` may be seeded (tests, dev warps). */
export function emptyWorldState(seed?: { flags?: Iterable<string> }): WorldState {
  return {
    flags: seed?.flags ? new Set(seed.flags) : EMPTY_SET,
    collected: EMPTY_SET,
    touched: EMPTY_SET,
    talked: EMPTY_SET,
    fired: EMPTY_SET,
    sandboxGoals: EMPTY_SET,
    cosmetics: [],
  };
}

function withAdded(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (set.has(id)) return set;
  const next = new Set(set);
  next.add(id);
  return next;
}

function withRemoved(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!set.has(id)) return set;
  const next = new Set(set);
  next.delete(id);
  return next;
}

/** The key recorded for a finished NPC conversation. */
export function talkKey(npcId: string, stateId: string): string {
  return `${npcId}:${stateId}`;
}

/** The key recorded for a reached sandbox goal. */
export function sandboxGoalKey(sandboxId: string, goal: string): string {
  return `${sandboxId}:${goal}`;
}

/**
 * Applies one event. Immutable; returns the SAME object when the event changes nothing, so React's
 * `useReducer` skips the re-render and `Object.is` comparisons stay cheap.
 */
export function reduceWorldState(s: WorldState, e: WorldStateEvent): WorldState {
  switch (e.type) {
    case "flag": {
      const flags = e.on ? withAdded(s.flags, e.id) : withRemoved(s.flags, e.id);
      return flags === s.flags ? s : { ...s, flags };
    }
    case "collect": {
      const collected = withAdded(s.collected, e.id);
      return collected === s.collected ? s : { ...s, collected };
    }
    case "touch": {
      const touched = withAdded(s.touched, e.id);
      return touched === s.touched ? s : { ...s, touched };
    }
    case "talk": {
      const talked = withAdded(s.talked, talkKey(e.npcId, e.stateId));
      return talked === s.talked ? s : { ...s, talked };
    }
    case "trigger": {
      const fired = withAdded(s.fired, e.id);
      return fired === s.fired ? s : { ...s, fired };
    }
    case "sandbox_goal": {
      const sandboxGoals = withAdded(s.sandboxGoals, sandboxGoalKey(e.sandboxId, e.goal));
      return sandboxGoals === s.sandboxGoals ? s : { ...s, sandboxGoals };
    }
    case "cosmetic": {
      if (s.cosmetics.includes(e.asset)) return s;
      return { ...s, cosmetics: [...s.cosmetics, e.asset] };
    }
  }
}

/** Applies events in order (same-object return when nothing changed). */
export function reduceAll(s: WorldState, events: readonly WorldStateEvent[]): WorldState {
  let out = s;
  for (const e of events) out = reduceWorldState(out, e);
  return out;
}

/** Plain arrays for `__GAME_DEBUG__.expedition.worldState()` (sorted, JSON-safe). */
export function worldStateDebug(s: WorldState): { flags: string[]; collected: string[]; touched: string[] } {
  return { flags: [...s.flags].sort(), collected: [...s.collected].sort(), touched: [...s.touched].sort() };
}

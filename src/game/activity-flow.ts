import type { Encounter, GameSpec } from "../contracts/gamespec";

export type PlayStyle = "top-down" | "puzzle" | "investigation" | "management" | "narrative" | "side-view";

/** Presentation is always flat 2D. Only the platformer requires an avatar. */
export function playStyle(spec: Pick<GameSpec, "genre" | "concepts">): PlayStyle {
  switch (spec.genre) {
    case "dungeon": return "top-down";
    case "platformer": return "side-view";
    case "puzzle": return "puzzle";
    case "strategy": return "management";
    case "mystery": return spec.concepts.filter(c => c.knowledgeType === "argument").length > spec.concepts.length / 2
      ? "narrative" : "investigation";
  }
}

/** Independent lessons can be approached in any order; learning dependencies still matter. */
export function requirementsFor(encounters: readonly Encounter[], index: number): string[] {
  const encounter = encounters[index];
  if (!encounter) return [];
  if (encounter.role === "boss") return encounters.filter(e => e.id !== encounter.id).map(e => e.id);
  const earlier = encounters.slice(0, index);
  return earlier.filter(e => e.conceptIds.some(id => encounter.conceptIds.includes(id)) &&
    (e.role === "teach" || encounter.role === "review")).map(e => e.id);
}

export function availableEncounters(spec: Pick<GameSpec, "encounters">, completed: ReadonlySet<string>): Encounter[] {
  return spec.encounters.filter((e, i) => !completed.has(e.id) && requirementsFor(spec.encounters, i).every(id => completed.has(id)));
}

export interface GardenState { day: number; water: number; growth: number; harvest: number }
export const INITIAL_GARDEN: GardenState = { day: 1, water: 2, growth: 0, harvest: 0 };
/** A renewable, untimed resource loop: waiting can never permanently block a lesson. */
export function gardenTurn(state: GardenState, action: "rest" | "tend" | "harvest" | "compost"): GardenState {
  if (action === "rest") return { ...state, day: state.day + 1, water: Math.min(4, state.water + 2) };
  if (action === "tend" && state.water > 0) return { ...state, water: state.water - 1, growth: state.growth + 1 };
  if (action === "harvest" && state.growth > 0) return { ...state, growth: state.growth - 1, harvest: state.harvest + 1 };
  if (action === "compost" && state.harvest > 0 && state.water < 4) return { ...state, harvest: state.harvest - 1, water: Math.min(4, state.water + 2) };
  return state;
}

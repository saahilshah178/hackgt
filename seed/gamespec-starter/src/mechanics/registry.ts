import type { Genre } from "../contracts/common";
import { chronoBridge } from "./chrono-bridge";
import { mimicChest } from "./mimic-chest";
import { numberLineLeap } from "./number-line-leap";
import { phaseGate } from "./phase-gate";
import type { AnyMechanic } from "./types";

/**
 * Adding a mechanic = one file implementing MechanicDefinition + one line here.
 * Library elements that aren't built yet can be registered with implemented: false;
 * the Director never sees them, but the registry documents the roadmap.
 */
export const MECHANICS: readonly AnyMechanic[] = [phaseGate, mimicChest, chronoBridge, numberLineLeap];

const byId = new Map(MECHANICS.map((m) => [m.id, m]));

export function getMechanic(id: string): AnyMechanic | undefined {
  return byId.get(id);
}

/** Mechanics the Director may use in a genre: implemented and skinned for that genre. */
export function mechanicsFor(genre: Genre): AnyMechanic[] {
  return MECHANICS.filter((m) => m.implemented && m.genres[genre] !== undefined);
}

/** One line per usable mechanic, fed to the Director (and shared by every agent's prompt prefix). */
export function directorMenu(genre: Genre): string {
  return mechanicsFor(genre)
    .map((m) => {
      const skin = m.genres[genre]!;
      return `- ${m.id} [widget: ${m.widget}; sockets: ${skin.sockets.join("/")}; teaches: ${m.knowledgeTypes.join(", ")}] ${m.directorBlurb} In this genre: ${skin.skin}.`;
    })
    .join("\n");
}

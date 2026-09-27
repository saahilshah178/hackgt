import type { Genre } from "../src/contracts/common";
import type { BlueprintSlice, ChallengeSlice, NarrativeSlice } from "../src/contracts/slices";
import { getCard } from "../src/library";
import { BOSS_SOCKET } from "../src/library/genres";
import type { Slices } from "../src/pipeline/assemble";
import { socketsFor } from "../src/mechanics/registry";

/*
 * Re-skins a showcase's slices as another genre, the way "Regenerate as <genre>" does in mock mode: the same
 * knowledge map, intake and assessment, the genre's own sockets (the first one each card's family supports in that
 * genre; the boss gets the genre's boss socket), plus optional per-genre title/theme/premise/cast/narrative and
 * encounter swaps, so a board genre can showcase mechanics beyond the base game's dial and multiple-choice modes.
 */

export type BlueprintEncounter = BlueprintSlice["encounters"][number];

export interface Regenre {
  id: string;
  createdAt: string;
  genre: Genre;
  title: string;
  theme: BlueprintSlice["theme"];
  premise: string;
  characters?: BlueprintSlice["characters"];
  /** replaces the base encounter list (sockets are still re-derived for the genre) */
  encounters?: BlueprintEncounter[];
  /** added to / replacing the base challenges, keyed by encounter id */
  challenges?: Record<string, ChallengeSlice>;
  narrative?: NarrativeSlice;
}

export function socketFor(e: Pick<BlueprintEncounter, "teachingMechanicId" | "role">, genre: Genre): string {
  if (e.role === "boss") return BOSS_SOCKET[genre];
  const card = getCard(e.teachingMechanicId);
  if (!card) throw new Error(`unknown card ${e.teachingMechanicId}`);
  const socket = socketsFor(card.family, genre, BOSS_SOCKET[genre]).find((s) => s !== BOSS_SOCKET[genre]);
  if (!socket) throw new Error(`${card.family} has no ${genre} socket`);
  return socket;
}

export function regenre(base: Slices, o: Regenre): Slices {
  const encounters = (o.encounters ?? base.blueprint.encounters).map((e) => ({ ...e, socket: socketFor(e, o.genre) }));
  const ids = new Set(encounters.map((e) => e.id));
  const challenges = Object.fromEntries(Object.entries({ ...base.challenges, ...o.challenges }).filter(([id]) => ids.has(id)));
  const narrative = o.narrative ?? base.narrative;
  return {
    ...base,
    id: o.id,
    createdAt: o.createdAt,
    intake: { ...base.intake, genre: o.genre },
    blueprint: {
      ...base.blueprint,
      genre: o.genre,
      title: o.title,
      theme: o.theme,
      premise: o.premise,
      characters: o.characters ?? base.blueprint.characters,
      encounters,
    },
    challenges,
    narrative: { ...narrative, beats: narrative.beats.filter((b) => ids.has(b.encounterId)) },
  };
}

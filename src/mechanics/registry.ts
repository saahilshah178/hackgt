import type { FamilyId, Genre } from "../contracts/common";
import { accumulator } from "./families/accumulator";
import { balance } from "./families/balance";
import { builder } from "./families/builder";
import { explainer } from "./families/explainer";
import { functionWorld } from "./families/function_world";
import { investigator } from "./families/investigator";
import { linker } from "./families/linker";
import { mapper } from "./families/mapper";
import { recall } from "./families/recall";
import { sequencer } from "./families/sequencer";
import { simulator } from "./families/simulator";
import { sorter } from "./families/sorter";
import { transformer } from "./families/transformer";
import { truthFinder } from "./families/truth_finder";
import { tuner } from "./families/tuner";
import type { AnyFamilyMode, MechanicFamily } from "./types";

/**
 * All 15 families (LIBRARY §4 plus explainer), in wave order. Adding a mode = one file in the family folder + one entry in
 * its `modes`. Modes that aren't built yet are `stubMode`s (implemented: false): cards can reference them
 * and the wishlist shows them, but the Director never sees them.
 */
export const FAMILIES: readonly MechanicFamily[] = [
  // wave 1
  truthFinder,
  sequencer,
  tuner,
  mapper,
  sorter,
  linker,
  investigator,
  // wave 2
  functionWorld,
  balance,
  simulator,
  builder,
  transformer,
  accumulator,
  recall,
  // explain the concept back (progress by teaching)
  explainer,
];

const byId = new Map<string, MechanicFamily>(FAMILIES.map((f) => [f.id, f]));

export function getFamily(id: string): MechanicFamily | undefined {
  return byId.get(id);
}

export function modeKey(familyId: string, mode: string): string {
  return `${familyId}.${mode}`;
}

export function getMode(familyId: string, mode: string): AnyFamilyMode | undefined {
  return byId.get(familyId)?.modes[mode];
}

export function isImplemented(familyId: string, mode: string): boolean {
  return getMode(familyId, mode)?.implemented === true;
}

/** Every registered family·mode with its implemented flag. */
export function allModes(): { family: MechanicFamily; mode: AnyFamilyMode; key: string }[] {
  return FAMILIES.flatMap((family) =>
    Object.values(family.modes).map((mode) => ({ family, mode, key: modeKey(family.id, mode.id) })),
  );
}

export function implementedModes(): { family: MechanicFamily; mode: AnyFamilyMode; key: string }[] {
  return allModes().filter((m) => m.mode.implemented);
}

/** Sockets a family can mount on in a genre. The boss socket is universal: any family can host the finale. */
export function socketsFor(familyId: FamilyId, genre: Genre, bossSocket: string): readonly string[] {
  const skin = byId.get(familyId)?.genres[genre];
  if (!skin) return [];
  return skin.sockets.includes(bossSocket) ? skin.sockets : [...skin.sockets, bossSocket];
}

/** Families the Director may use in a genre: skinned for it and with at least one implemented mode. */
export function familiesFor(genre: Genre): MechanicFamily[] {
  return FAMILIES.filter((f) => f.genres[genre] !== undefined && Object.values(f.modes).some((m) => m.implemented));
}

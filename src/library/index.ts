import { GENRES, type Genre } from "../contracts/common";
import { TeachingMechanic } from "../contracts/library";
import { getFamily, getMode } from "../mechanics/registry";
import { GENERAL_CARDS } from "./catalog/general";
import { MATH_CARDS } from "./catalog/math";
import { BOSS_SOCKET } from "./genres";

/** Every card in the library. Domain files are appended here as they are encoded. */
export const CARDS: readonly TeachingMechanic[] = [...GENERAL_CARDS, ...MATH_CARDS];

const byId = new Map(CARDS.map((c) => [c.id, c]));

export function getCard(id: string): TeachingMechanic | undefined {
  return byId.get(id);
}

/** True when the card's family·mode exists and is implemented. */
export function isCardImplemented(card: TeachingMechanic): boolean {
  return getMode(card.family, card.mode)?.implemented === true;
}

/** True when the card's family has a socket in the genre (the boss socket always counts). */
export function cardPlaysIn(card: TeachingMechanic, genre: Genre): boolean {
  return getFamily(card.family)?.genres[genre] !== undefined;
}

/** Cards the Director could use in a genre. `includeUnimplemented` returns catalog-only cards too (for the wishlist). */
export function cardsFor(genre: Genre, opts: { includeUnimplemented?: boolean } = {}): TeachingMechanic[] {
  return CARDS.filter((c) => cardPlaysIn(c, genre) && (opts.includeUnimplemented || isCardImplemented(c)));
}

export interface CatalogIssue {
  cardId: string;
  message: string;
}

/** Structural + referential validation of the catalog (also run by `pnpm library:report` and tests). */
export function validateCatalog(cards: readonly TeachingMechanic[] = CARDS): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const seen = new Set<string>();
  for (const card of cards) {
    const parsed = TeachingMechanic.safeParse(card);
    if (!parsed.success) {
      parsed.error.issues.forEach((i) => issues.push({ cardId: card.id ?? "?", message: `${i.path.join(".")}: ${i.message}` }));
      continue;
    }
    if (seen.has(card.id)) issues.push({ cardId: card.id, message: "duplicate id" });
    seen.add(card.id);
    const family = getFamily(card.family);
    if (!family) {
      issues.push({ cardId: card.id, message: `unknown family "${card.family}"` });
      continue;
    }
    if (!family.modes[card.mode]) issues.push({ cardId: card.id, message: `unknown mode "${card.family}.${card.mode}"` });
    if (card.genreNotes) {
      for (const g of Object.keys(card.genreNotes)) {
        if (!(GENRES as readonly string[]).includes(g)) issues.push({ cardId: card.id, message: `invalid genre "${g}" in genreNotes` });
      }
    }
    if (card.lockedParams) {
      const mode = family.modes[card.mode];
      if (mode) {
        const shape = (mode.paramsSchema as { shape?: Record<string, unknown> }).shape ?? {};
        for (const k of Object.keys(card.lockedParams)) {
          if (!(k in shape)) issues.push({ cardId: card.id, message: `lockedParams.${k} is not a param of ${card.family}.${card.mode}` });
        }
      }
    }
  }
  return issues;
}

export { BOSS_SOCKET };

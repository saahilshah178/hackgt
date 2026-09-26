import { GENRES, type Genre } from "../contracts/common";
import { TeachingMechanic } from "../contracts/library";
import { getFamily, getMode } from "../mechanics/registry";
import { ART_CARDS } from "./catalog/art";
import { BIOLOGY_CARDS } from "./catalog/biology";
import { BUSINESS_CARDS } from "./catalog/business";
import { CHEMISTRY_CARDS } from "./catalog/chemistry";
import { CIVICS_CARDS } from "./catalog/civics";
import { CS_CARDS } from "./catalog/cs";
import { EARTH_SPACE_CARDS } from "./catalog/earth_space";
import { ECONOMICS_CARDS } from "./catalog/economics";
import { ENGINEERING_CARDS } from "./catalog/engineering";
import { FINANCE_CARDS } from "./catalog/finance";
import { GENERAL_CARDS } from "./catalog/general";
import { GEOGRAPHY_CARDS } from "./catalog/geography";
import { HEALTH_CARDS } from "./catalog/health";
import { HISTORY_CARDS } from "./catalog/history";
import { LANGUAGE_CARDS } from "./catalog/language";
import { LAW_CARDS } from "./catalog/law";
import { LITERATURE_CARDS } from "./catalog/literature";
import { MATH_CARDS } from "./catalog/math";
import { MUSIC_CARDS } from "./catalog/music";
import { PHILOSOPHY_CARDS } from "./catalog/philosophy";
import { PHYSICS_CARDS } from "./catalog/physics";
import { PSYCHOLOGY_CARDS } from "./catalog/psychology";
import { WRITING_CARDS } from "./catalog/writing";
import { BOSS_SOCKET, genreAdapterMatrix } from "./genres";

/** Every card in the library: LIBRARY §6 (every domain) and §7 (general). */
export const CARDS: readonly TeachingMechanic[] = [
  ...GENERAL_CARDS,
  ...MATH_CARDS,
  ...PHYSICS_CARDS,
  ...CHEMISTRY_CARDS,
  ...BIOLOGY_CARDS,
  ...EARTH_SPACE_CARDS,
  ...CS_CARDS,
  ...ENGINEERING_CARDS,
  ...HEALTH_CARDS,
  ...HISTORY_CARDS,
  ...CIVICS_CARDS,
  ...GEOGRAPHY_CARDS,
  ...ECONOMICS_CARDS,
  ...FINANCE_CARDS,
  ...PSYCHOLOGY_CARDS,
  ...PHILOSOPHY_CARDS,
  ...LITERATURE_CARDS,
  ...WRITING_CARDS,
  ...LANGUAGE_CARDS,
  ...MUSIC_CARDS,
  ...ART_CARDS,
  ...BUSINESS_CARDS,
  ...LAW_CARDS,
];

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

export { BOSS_SOCKET, genreAdapterMatrix };
export { retrieveCards } from "./retrieval";
export type { RetrievalQuery, ScoredCard } from "./retrieval";

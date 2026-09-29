import type { Genre } from "../contracts/common";

/**
 * The genres a student can choose, be recommended or be auto-assigned (2026-09-27: the dungeon crawler, the logic
 * board and the side-view obstacle course were withdrawn; their hosts stay only for old games and fixtures). The 3D
 * open world (2026-09-29) is chosen explicitly only: AUTO_GENRES in genres.ts leaves it out.
 * Client-safe, so the intake and debrief pages use the same list the server resolves against.
 */
export const OFFERED_GENRES: readonly Genre[] = ["mystery", "strategy", "explorer", "story", "world3d"];

/**
 * Client-safe genre labels (no registry import, so pages can use them without pulling in every mechanic family).
 * The long descriptions live in GENRE_INFO (src/library/genres.ts); tests keep the two names in sync.
 */
export const GENRE_LABELS: Record<Genre, { name: string; perspective: string; blurb: string }> = {
  dungeon: { name: "Dungeon crawler", perspective: "Side view", blurb: "Room by room: fight, loot, open the way." },
  mystery: {
    name: "Point-and-click investigation",
    perspective: "Scenes + inventory",
    blurb: "Search scenes for clues, combine clues into leads, crack them, accuse.",
  },
  platformer: { name: "Side-view obstacle course", perspective: "Side view", blurb: "Run and jump to the exit." },
  puzzle: {
    name: "Logic board",
    perspective: "Grid, no avatar",
    blurb: "Rotate circuit tiles to route power; sealed tiles are challenges.",
  },
  strategy: {
    name: "Cozy management sim",
    perspective: "Town view, no avatar",
    blurb: "Fulfil villagers' requests day by day and grow the town.",
  },
  explorer: {
    name: "Top-down explorer",
    perspective: "Bird's-eye maze",
    blurb: "Explore a maze in any order; stations open new wings; dodge sentries.",
  },
  story: {
    name: "Narrative adventure",
    perspective: "Text + choices",
    blurb: "A branching story where explaining ideas moves the plot.",
  },
  world3d: {
    name: "3D open world",
    perspective: "Third-person 3D",
    blurb: "Roam a living 3D world toward one goal; characters and places hold the challenges.",
  },
};

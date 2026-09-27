import { GENRES, type FamilyId, type Genre, type KnowledgeType } from "../contracts/common";
import { FAMILIES } from "../mechanics/registry";
import { OFFERED_GENRES } from "./genre-labels";

export { OFFERED_GENRES };

/*
 * Genre definitions (LIBRARY §1, §1.1, §5). Sockets are the mount points a genre host provides;
 * every level is assembled from the prefab chunks below, so it is solvable by construction.
 * The family × genre adapter matrix (socket + skin per family) lives on each family in src/mechanics.
 */

export const SOCKETS = {
  dungeon: ["door", "altar", "chest", "enemy", "forge", "shop", "boss"],
  mystery: ["conversation", "evidence", "corkboard", "cross_exam", "archive", "lab", "accusation"],
  platformer: ["gap", "gate", "moving_platform", "switch", "pickup", "boss"],
  puzzle: ["tile_board", "pipe_board", "beam_board", "conveyor", "lock", "goal_pad", "boss"],
  strategy: ["production_line", "market", "policy_dial", "research_node", "event_card", "ledger", "crisis"],
  explorer: ["locked_gate", "terminal", "shrine", "bridge", "sentry", "cache", "heart"],
  story: ["dialogue", "choice", "letter", "debate", "journal", "trial", "climax"],
} as const satisfies Record<Genre, readonly string[]>;

/** The socket the final (boss) encounter must use in each genre. */
export const BOSS_SOCKET: Record<Genre, string> = {
  dungeon: "boss",
  mystery: "accusation",
  platformer: "boss",
  puzzle: "boss",
  strategy: "crisis",
  explorer: "heart",
  story: "climax",
};

export interface GenreInfo {
  name: string;
  coreLoop: string;
  bestAt: string;
  buildTier: number;
}

export const GENRE_INFO: Record<Genre, GenreInfo> = {
  dungeon: {
    name: "Dungeon crawler",
    coreLoop: "Room by room: fight, loot, open the way. A failed run restarts, reweighted toward what you missed.",
    bestAt: "categories, facts, quantities, procedures; universal",
    buildTier: 1,
  },
  mystery: {
    name: "Point-and-click investigation",
    coreLoop:
      "Search each scene for clues, combine two clues into a lead, crack the lead to earn a deduction, then name the answer at the accusation.",
    bestAt: "history, literature, civics, law, biology, arguments",
    buildTier: 2,
  },
  platformer: {
    name: "Side-view obstacle course",
    coreLoop: "Run and jump to the exit.",
    bestAt: "functions, physics, magnitudes, sequences",
    buildTier: 3,
  },
  puzzle: {
    name: "Logic board",
    coreLoop:
      "No avatar: rotate circuit tiles to route power from the source to the core. Sealed tiles are challenges, and a seal only opens once power reaches it.",
    bestAt: "procedures, logic, transformations, quantities, CS",
    buildTier: 4,
  },
  strategy: {
    name: "Cozy management sim",
    coreLoop:
      "Day by day, villagers bring requests. Fulfil them to earn coins and spend the coins growing the town. No fail state; wrong answers only cost time.",
    bestAt: "systems, economics, ecology, categories, stoichiometry",
    buildTier: 5,
  },
  explorer: {
    name: "Top-down explorer",
    coreLoop:
      "A bird's-eye maze you explore in any order: stations open gates and bridges to new wings, sentries patrol the corridors, and the heart of the maze opens last.",
    bestAt: "spatial layouts, systems, facts, processes with places",
    buildTier: 6,
  },
  story: {
    name: "Narrative adventure",
    coreLoop:
      "A branching text story with no map: your choices pick the path, and explaining ideas to the characters is what moves the plot forward.",
    bestAt: "arguments, causes and consequences, history, literature, ethics",
    buildTier: 7,
  },
};

/** Genre hosts that exist in src/game/hosts. Flip a genre on when its host lands. A requested genre plays only if it is here. */
export const IMPLEMENTED_GENRES: readonly Genre[] = ["dungeon", "mystery", "platformer", "puzzle", "strategy", "explorer", "story"];

/**
 * Genres played by a board host (src/game/genre): non-linear progression through the free-order runner, no
 * left-to-right room strip. The rest play on the legacy side-view hosts (or the Expedition when a world resolves).
 */
export const BOARD_GENRES: readonly Genre[] = ["mystery", "puzzle", "strategy", "explorer", "story"];

/**
 * Genres the auto-selector may choose when the intake says "auto". Platformer is explicit-request only: its host has
 * trigger-only obstacles, and the quantitative/spatial weights would otherwise send most math uploads to it.
 */
export const AUTO_GENRES: readonly Genre[] = OFFERED_GENRES;

/**
 * LIBRARY §1.1: knowledge type → genre weight, extended so each knowledge type has a home that is not a side-scroller:
 * sequences and procedures → the logic board, systems and categories → the cozy sim, spatial → the top-down explorer,
 * causal → the investigation, arguments → the narrative adventure.
 */
export const GENRE_WEIGHTS: Record<KnowledgeType, Record<Genre, number>> = {
  fact: { dungeon: 3, mystery: 2, platformer: 1, puzzle: 1, strategy: 1, explorer: 2, story: 2 },
  category: { dungeon: 2, mystery: 2, platformer: 1, puzzle: 2, strategy: 3, explorer: 2, story: 1 },
  sequence: { dungeon: 1, mystery: 2, platformer: 2, puzzle: 3, strategy: 1, explorer: 2, story: 2 },
  causal: { dungeon: 1, mystery: 3, platformer: 0, puzzle: 1, strategy: 2, explorer: 1, story: 2 },
  system: { dungeon: 1, mystery: 1, platformer: 1, puzzle: 2, strategy: 3, explorer: 2, story: 1 },
  quantitative: { dungeon: 1, mystery: 0, platformer: 3, puzzle: 3, strategy: 2, explorer: 1, story: 0 },
  spatial: { dungeon: 2, mystery: 1, platformer: 3, puzzle: 2, strategy: 1, explorer: 3, story: 0 },
  procedure: { dungeon: 2, mystery: 1, platformer: 1, puzzle: 3, strategy: 2, explorer: 2, story: 1 },
  argument: { dungeon: 0, mystery: 3, platformer: 0, puzzle: 0, strategy: 1, explorer: 0, story: 4 },
};

/**
 * Auto-genre selection: sum the Director's concept weights per knowledge type, score each candidate
 * genre (AUTO_GENRES by default) with the table, take the best (ties break in GENRES order, so dungeon wins ties).
 */
export function autoSelectGenre(
  weightByKnowledgeType: Partial<Record<KnowledgeType, number>>,
  implemented: readonly Genre[] = AUTO_GENRES,
): { genre: Genre; scores: Record<Genre, number> } {
  const scores = Object.fromEntries(GENRES.map((g) => [g, 0])) as Record<Genre, number>;
  for (const [kt, w] of Object.entries(weightByKnowledgeType) as [KnowledgeType, number][]) {
    for (const g of GENRES) scores[g] += (w ?? 0) * GENRE_WEIGHTS[kt][g];
  }
  const candidates = GENRES.filter((g) => implemented.includes(g));
  if (candidates.length === 0) throw new Error("no implemented genres");
  let best = candidates[0];
  for (const g of candidates) if (scores[g] > scores[best]) best = g;
  return { genre: best, scores };
}

export interface ChunkDef {
  id: string;
  kind: "start" | "connector" | "room" | "boss";
  /** Socket this prefab provides, or null for chunks with no encounter. */
  socket: string | null;
}

/**
 * Hand-built prefab chunks per genre host. The generator arranges these; it never draws tiles,
 * so every level is solvable by construction. Add variants freely; ids must stay stable.
 */
export const CHUNKS: Record<Genre, ChunkDef[]> = {
  dungeon: [
    { id: "d_start", kind: "start", socket: null },
    { id: "d_hall", kind: "connector", socket: null },
    { id: "d_door_room_a", kind: "room", socket: "door" },
    { id: "d_door_room_b", kind: "room", socket: "door" },
    { id: "d_altar_room", kind: "room", socket: "altar" },
    { id: "d_treasury", kind: "room", socket: "chest" },
    { id: "d_arena", kind: "room", socket: "enemy" },
    { id: "d_forge", kind: "room", socket: "forge" },
    { id: "d_shop", kind: "room", socket: "shop" },
    { id: "d_boss_hall", kind: "boss", socket: "boss" },
  ],
  mystery: [
    { id: "m_arrival", kind: "start", socket: null },
    { id: "m_street", kind: "connector", socket: null },
    { id: "m_parlor", kind: "room", socket: "conversation" },
    { id: "m_study", kind: "room", socket: "evidence" },
    { id: "m_office", kind: "room", socket: "corkboard" },
    { id: "m_courtroom", kind: "room", socket: "cross_exam" },
    { id: "m_archive", kind: "room", socket: "archive" },
    { id: "m_lab", kind: "room", socket: "lab" },
    { id: "m_finale", kind: "boss", socket: "accusation" },
  ],
  platformer: [
    { id: "p_start", kind: "start", socket: null },
    { id: "p_run", kind: "connector", socket: null },
    { id: "p_chasm", kind: "room", socket: "gap" },
    { id: "p_gatehouse", kind: "room", socket: "gate" },
    { id: "p_lift_shaft", kind: "room", socket: "moving_platform" },
    { id: "p_switchyard", kind: "room", socket: "switch" },
    { id: "p_cache", kind: "room", socket: "pickup" },
    { id: "p_summit", kind: "boss", socket: "boss" },
  ],
  puzzle: [
    { id: "z_title", kind: "start", socket: null },
    { id: "z_break", kind: "connector", socket: null },
    { id: "z_grid", kind: "room", socket: "tile_board" },
    { id: "z_pipes", kind: "room", socket: "pipe_board" },
    { id: "z_mirrors", kind: "room", socket: "beam_board" },
    { id: "z_belt", kind: "room", socket: "conveyor" },
    { id: "z_vault", kind: "room", socket: "lock" },
    { id: "z_pads", kind: "room", socket: "goal_pad" },
    { id: "z_final", kind: "boss", socket: "boss" },
  ],
  strategy: [
    { id: "s_founding", kind: "start", socket: null },
    { id: "s_season", kind: "connector", socket: null },
    { id: "s_factory", kind: "room", socket: "production_line" },
    { id: "s_market", kind: "room", socket: "market" },
    { id: "s_council", kind: "room", socket: "policy_dial" },
    { id: "s_academy", kind: "room", socket: "research_node" },
    { id: "s_courier", kind: "room", socket: "event_card" },
    { id: "s_treasury", kind: "room", socket: "ledger" },
    { id: "s_crisis", kind: "boss", socket: "crisis" },
  ],
  explorer: [
    { id: "e_entrance", kind: "start", socket: null },
    { id: "e_corridor", kind: "connector", socket: null },
    { id: "e_gatehouse", kind: "room", socket: "locked_gate" },
    { id: "e_console_room", kind: "room", socket: "terminal" },
    { id: "e_shrine", kind: "room", socket: "shrine" },
    { id: "e_chasm", kind: "room", socket: "bridge" },
    { id: "e_checkpoint", kind: "room", socket: "sentry" },
    { id: "e_storeroom", kind: "room", socket: "cache" },
    { id: "e_heart", kind: "boss", socket: "heart" },
  ],
  story: [
    { id: "n_prologue", kind: "start", socket: null },
    { id: "n_interlude", kind: "connector", socket: null },
    { id: "n_conversation", kind: "room", socket: "dialogue" },
    { id: "n_crossroads", kind: "room", socket: "choice" },
    { id: "n_letter", kind: "room", socket: "letter" },
    { id: "n_town_hall", kind: "room", socket: "debate" },
    { id: "n_journal", kind: "room", socket: "journal" },
    { id: "n_hearing", kind: "room", socket: "trial" },
    { id: "n_climax", kind: "boss", socket: "climax" },
  ],
};

export function chunkById(genre: Genre, id: string): ChunkDef | undefined {
  return CHUNKS[genre].find((c) => c.id === id);
}

export interface AdapterCell {
  sockets: readonly string[];
  skin: string;
}

/**
 * LIBRARY §5: the family × genre adapter matrix, read directly off each family's `genres` (the
 * source of truth in `src/mechanics/families/<family>/index.ts`). `null` where a family has no
 * adapter for that genre. Used by the `/library` page.
 */
export function genreAdapterMatrix(): Record<FamilyId, Partial<Record<Genre, AdapterCell | null>>> {
  const matrix = {} as Record<FamilyId, Partial<Record<Genre, AdapterCell | null>>>;
  for (const family of FAMILIES) {
    const row: Partial<Record<Genre, AdapterCell | null>> = {};
    for (const genre of GENRES) {
      const skin = family.genres[genre];
      row[genre] = skin ? { sockets: skin.sockets, skin: skin.skin } : null;
    }
    matrix[family.id] = row;
  }
  return matrix;
}

import type { Genre } from "../contracts/common";

/** Places in a genre's world where a mechanic can be mounted. */
export const SOCKETS = {
  dungeon: ["door", "altar", "chest", "enemy", "boss"],
  platformer: ["gap", "gate", "moving_platform", "switch", "boss"],
  mystery: ["conversation", "evidence", "corkboard", "cross_exam", "accusation"],
  puzzle: ["tile_puzzle", "pipe", "beam", "goal_pad", "boss"],
} as const satisfies Record<Genre, readonly string[]>;

/** The socket the final (boss) encounter must use in each genre. */
export const BOSS_SOCKET: Record<Genre, string> = {
  dungeon: "boss",
  platformer: "boss",
  mystery: "accusation",
  puzzle: "boss",
};

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
    { id: "d_boss_hall", kind: "boss", socket: "boss" },
  ],
  platformer: [
    { id: "p_start", kind: "start", socket: null },
    { id: "p_run", kind: "connector", socket: null },
    { id: "p_chasm", kind: "room", socket: "gap" },
    { id: "p_gatehouse", kind: "room", socket: "gate" },
    { id: "p_lift_shaft", kind: "room", socket: "moving_platform" },
    { id: "p_switchyard", kind: "room", socket: "switch" },
    { id: "p_summit", kind: "boss", socket: "boss" },
  ],
  mystery: [
    { id: "m_arrival", kind: "start", socket: null },
    { id: "m_street", kind: "connector", socket: null },
    { id: "m_parlor", kind: "room", socket: "conversation" },
    { id: "m_study", kind: "room", socket: "evidence" },
    { id: "m_office", kind: "room", socket: "corkboard" },
    { id: "m_courtroom", kind: "room", socket: "cross_exam" },
    { id: "m_finale", kind: "boss", socket: "accusation" },
  ],
  puzzle: [
    { id: "z_title", kind: "start", socket: null },
    { id: "z_break", kind: "connector", socket: null },
    { id: "z_grid", kind: "room", socket: "tile_puzzle" },
    { id: "z_pipes", kind: "room", socket: "pipe" },
    { id: "z_mirrors", kind: "room", socket: "beam" },
    { id: "z_pads", kind: "room", socket: "goal_pad" },
    { id: "z_final", kind: "boss", socket: "boss" },
  ],
};

export function chunkById(genre: Genre, id: string): ChunkDef | undefined {
  return CHUNKS[genre].find((c) => c.id === id);
}

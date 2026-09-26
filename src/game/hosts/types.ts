import type { Encounter, GameSpec } from "../../contracts/gamespec";
import type { ChunkDef } from "../../library/genres";
import type { Palette } from "../engine/palettes";

/** One prefab chunk placed in the level, with its definition and (if any) the encounter it hosts. */
export interface RoomPlacement {
  index: number;
  chunkId: string;
  def: ChunkDef;
  encounter: Encounter | null;
}

export interface HostProps {
  spec: GameSpec;
  rooms: RoomPlacement[];
  palette: Palette;
  /** True while a widget/consequence overlay is open: the host must stop accepting movement input. */
  frozen: boolean;
  /** Called when the player's avatar touches the socket of a room whose encounter is the current one. */
  onReachSocket: (encounterId: string) => void;
  /** Called once, after the last room, when the player reaches the end (informational only). */
  onReachEnd?: () => void;
}

/** Imperative controls GameClient uses regardless of which host (Phaser or DOM) is mounted. */
export interface HostHandle {
  /** Instantly places the player in the room for this encounter (or the start room when null). Used by skipTo/autoSolve. */
  warpTo: (encounterId: string | null) => void;
  /** Live value from an open dial/place widget, so the host can animate the in-world object (LIBRARY §2). */
  setLiveValue?: (value: unknown) => void;
  /** Plays the in-world success consequence for the encounter mode just cleared (LIBRARY §5 dungeon skins). */
  celebrate?: (mode: string) => void;
}

export function buildRooms(spec: GameSpec, chunkById: (genre: GameSpec["genre"], id: string) => ChunkDef | undefined): RoomPlacement[] {
  const byId = new Map(spec.encounters.map((e) => [e.id, e]));
  return spec.layout.chunks.map((c, index) => {
    const def = chunkById(spec.genre, c.chunkId);
    if (!def) throw new Error(`layout references unknown chunk "${c.chunkId}" for genre "${spec.genre}"`);
    return { index, chunkId: c.chunkId, def, encounter: c.encounterId ? (byId.get(c.encounterId) ?? null) : null };
  });
}

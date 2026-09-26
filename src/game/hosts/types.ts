import type { Encounter, GameSpec } from "../../contracts/gamespec";
import type { ChunkDef } from "../../library/genres";
import type { AidTier, Diagnosis, Draft, HintRung, HintsUsed, ResolvedWorld, SandboxDraft, WorldState } from "../../world/types";
import type { Palette } from "../engine/palettes";
import type { SayRequest } from "../expedition/dialogue/types";

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
  // ---- Expedition (docs/design/20 §2.10; present only when a world resolved, so legacy hosts ignore them) ----
  world?: ResolvedWorld;
  progress?: ExpeditionProgress;
  layout?: LayoutState;
  /** flags, collected, touched (NPC states, platforms, links, props) */
  worldState?: WorldState;
  /** drives ambient particles when the meter asks for it */
  meterValue?: number | null;
  express?: boolean;
  onInteract?: (target: InteractTarget) => void;
  /** host asks the dialogue engine to speak (NPCs, triggers, cutscenes) */
  onSay?: (req: SayRequest) => void;
  onHostEvent?: (e: HostEvent) => void;
}

/** Imperative controls GameClient uses regardless of which host (Phaser or DOM) is mounted. */
export interface HostHandle {
  /** Instantly places the player in the room for this encounter (or the start room when null). Used by skipTo/autoSolve. */
  warpTo: (encounterId: string | null) => void;
  /** Live value from an open dial/place widget, so the host can animate the in-world object (LIBRARY §2). */
  setLiveValue?: (value: unknown) => void;
  /** Plays the in-world success consequence for the encounter mode just cleared (LIBRARY §5 dungeon skins). */
  celebrate?: (mode: string) => void;
  // ---- Expedition (docs/design/20 §2.10) ----
  bindDraft?: (encounterId: string, draft: Draft | null) => void;
  setAidTier?: (encounterId: string, tier: AidTier, hintsUsed: HintsUsed) => void;
  /** amendment 10: companion flight + meta world reaction */
  onHint?: (encounterId: string, rung: HintRung) => void;
  /** success or fail animation */
  resolveEncounter?: (encounterId: string, diagnosis: Diagnosis) => Promise<void>;
  openSandbox?: (sandboxId: string) => void;
  bindSandboxDraft?: (sandboxId: string, draft: SandboxDraft | null) => void;
  closeSandbox?: () => void;
  playCutscene?: (id: string) => Promise<void>;
  skipCutscene?: () => void;
  /** express + debug; uses links on the way */
  walkTo?: (x: number, surface?: string) => Promise<void>;
  /** debug + e2e */
  useLink?: (linkId: string) => Promise<void>;
  debug?: () => ExpeditionHostDebug;
}

// ---------------------------------------------------------------- Expedition host types (docs/design/20 §2.10)

export interface ExpeditionProgress {
  solvedIds: readonly string[];
  currentId: string | null;
}
/** CSS px of the visible world area (the part of the stage the panel does not cover). */
export interface SafeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type LayoutKind = "explore" | "scrub" | "board" | "vault" | "sandbox";
export interface LayoutState {
  mode: LayoutKind;
  safeRect: SafeRect;
  focus: { kind: "station"; encounterId: string } | { kind: "sandbox"; sandboxId: string } | null;
}
export type LinkVerb = "hop" | "climb" | "ladder" | "drop" | "timed_hop" | "ride";
export type InteractTarget =
  | { kind: "station"; encounterId: string }
  | { kind: "sandbox"; sandboxId: string }
  | { kind: "npc"; npcId: string; stateId: string }
  | { kind: "plaque"; plaqueId: string }
  | { kind: "collectible"; collectibleId: string }
  | { kind: "touch"; propId: string }
  | { kind: "vehicle"; encounterId: string }
  | { kind: "link"; linkId: string; verb: LinkVerb }
  | { kind: "exit"; exitId: string };
export type HostEvent =
  | { type: "ready" }
  | { type: "load_progress"; fraction: number }
  | { type: "zone_entered"; zoneId: string }
  | { type: "near"; target: InteractTarget | null }
  | { type: "approach"; encounterId: string } // first entry into approachRadius
  | { type: "arena"; encounterId: string } // boss arena trigger crossed
  | { type: "trigger"; triggerId: string }
  | { type: "link_used"; linkId: string; landed: "to" | "missTo" }
  | { type: "cutscene"; id: string; state: "start" | "end" }
  | { type: "back" } // Esc pressed in-canvas
  | { type: "flag"; id: string; on: boolean } // cutscene set_state flag (the client's world-state reducer owns flags)
  | { type: "sandbox_goal"; sandboxId: string; goal: string } // first time meta.goalMet holds (client records sandbox_goal + reward)
  | { type: "cue"; cue: string } // cutscene sfx step → the client's audio bus
  | { type: "music"; cue: string | null }; // cutscene music step
export interface ExpeditionHostDebug {
  ready: boolean;
  zoneId: string;
  segmentId: string;
  playerX: number;
  playerY: number;
  surface: string;
  cameraX: number;
  cameraY: number;
  zoom: number;
  textures: number; // resident texture count (A4: drops after a zone swap)
  near: InteractTarget | null;
  links: readonly { id: string; kind: string; inRange: boolean; open: boolean | null }[];
  contraption: (encounterId?: string) => Record<string, number | string | boolean> | null;
  cutscene: string | null;
  fps: number;
  drawObjects: number;
}

export function buildRooms(spec: GameSpec, chunkById: (genre: GameSpec["genre"], id: string) => ChunkDef | undefined): RoomPlacement[] {
  const byId = new Map(spec.encounters.map((e) => [e.id, e]));
  return spec.layout.chunks.map((c, index) => {
    const def = chunkById(spec.genre, c.chunkId);
    if (!def) throw new Error(`layout references unknown chunk "${c.chunkId}" for genre "${spec.genre}"`);
    return { index, chunkId: c.chunkId, def, encounter: c.encounterId ? (byId.get(c.encounterId) ?? null) : null };
  });
}

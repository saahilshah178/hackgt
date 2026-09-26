/**
 * src/game/expedition/client/express.ts (H2, pure) — the express policy (`?express=1`, docs/design/20 §0.1.5, §2.13).
 *
 * Express removes walking and waiting, never grading, hints, failures or payoff animations:
 *   - after ASSETS_READY and after every PAYOFF_DONE the client walks the player to the current station's console
 *     (the host walks at 2× in express and auto-uses links on the way; payoff traversals still animate), then
 *     dispatches INTERACT_STATION;
 *   - a station in another zone is reached through the zone's exit toward it, or the vehicle a solved `ride` payoff
 *     left behind; when walking fails repeatedly the client warps (the demo must never stall);
 *   - every cutscene except the finale is trimmed after its first completed `say` (the host trims when express was on
 *     at the start; `trimCutscene` lets the client trim one that started before express was switched on);
 *   - completed lines advance on their own after a short read (the rehearsal needs no key presses, and queued
 *     toasts never hold up the next cutscene line);
 *   - ambient/hint triggers (host), station approach toasts and sandboxes are off.
 * `nextExpressAction(phase, progress, world, player)` is the whole decision; ExpeditionClient executes it.
 */
import type { Phase } from "./machine";

export interface ExpressStation {
  encounterId: string;
  zoneId: string;
  consoleX: number;
  consoleSurface: string;
  payoff: { kind: "terrain" | "ride" | "remove_blocker" | "carry"; rideCutsceneId: string | null };
}
export interface ExpressZone {
  id: string;
  exits: readonly { x: number; surface: string; toZoneId: string }[];
}
export interface ExpressWorld {
  /** encounter order */
  stations: readonly ExpressStation[];
  /** zone order (the expedition's path) */
  zones: readonly ExpressZone[];
  finaleCutsceneId: string | null;
}
export interface ExpressProgress {
  solvedIds: readonly string[];
  currentId: string | null;
}
export interface PlayerSpot {
  zoneId: string;
  x: number;
  surface: string;
}

export type ExpressAction =
  | { kind: "walkTo"; x: number; surface: string; reason: "station" | "exit"; encounterId: string }
  | { kind: "ride"; encounterId: string; cutsceneId: string }
  | { kind: "interact"; encounterId: string }
  | { kind: "warp"; encounterId: string }
  | { kind: "trimCutscene"; cutsceneId: string }
  | null;

/** The player stands this far left of the console when express walks to it (inside the 90-unit interact radius). */
export const EXPRESS_CONSOLE_OFFSET = 40;
/** Close enough to the console to interact. */
export const EXPRESS_INTERACT_RANGE = 80;
/** Walks toward one target before express gives up and warps. */
export const EXPRESS_MAX_WALKS = 3;
/** How long a completed blocking line stays before express advances it. */
export const EXPRESS_READ_MS = 900;
/** …and a completed non-blocking line (bar or toast). */
export const EXPRESS_TOAST_MS = 1200;

export interface ExpressOptions {
  /** failed walks toward the current target so far (the client counts; a success resets it) */
  attempts?: number;
  /** encounters whose ride payoff the player has already ridden */
  ridden?: ReadonlySet<string>;
}

/** Every cutscene is trimmed in express except the finale. */
export function expressTrims(cutsceneId: string, finaleCutsceneId: string | null): boolean {
  return cutsceneId !== finaleCutsceneId;
}

/** The console spot express walks to. */
export function consoleSpot(st: Pick<ExpressStation, "consoleX" | "consoleSurface">): { x: number; surface: string } {
  return { x: Math.max(0, st.consoleX - EXPRESS_CONSOLE_OFFSET), surface: st.consoleSurface };
}

export function atConsole(player: PlayerSpot, st: Pick<ExpressStation, "zoneId" | "consoleX" | "consoleSurface">): boolean {
  return player.zoneId === st.zoneId && player.surface === st.consoleSurface && Math.abs(player.x - st.consoleX) <= EXPRESS_INTERACT_RANGE;
}

/** The zone the player should head for next on the way from `from` to `to` (zone order is the expedition's path). */
export function nextZoneToward(world: Pick<ExpressWorld, "zones">, from: string, to: string): string | null {
  const order = world.zones.map((z) => z.id);
  const i = order.indexOf(from);
  const j = order.indexOf(to);
  if (i < 0 || j < 0 || i === j) return null;
  return order[i + (j > i ? 1 : -1)] ?? null;
}

/**
 * The vehicle the latest solved station of `zoneId` left behind (a `ride` payoff with a ride cutscene) that the
 * player has not ridden yet: the payoff traversal comes first (§0.1.5).
 */
export function pendingRide(
  world: Pick<ExpressWorld, "stations">,
  progress: ExpressProgress,
  zoneId: string,
  ridden: ReadonlySet<string> = new Set(),
): { kind: "ride"; encounterId: string; cutsceneId: string } | null {
  const solved = new Set(progress.solvedIds);
  for (let i = world.stations.length - 1; i >= 0; i--) {
    const st = world.stations[i];
    if (st.zoneId !== zoneId || !solved.has(st.encounterId)) continue;
    if (st.payoff.kind === "ride" && st.payoff.rideCutsceneId && !ridden.has(st.encounterId)) {
      return { kind: "ride", encounterId: st.encounterId, cutsceneId: st.payoff.rideCutsceneId };
    }
    return null; // only the latest solved station's vehicle is the way on
  }
  return null;
}

/** How the player leaves `zoneId` toward `targetZoneId`: a ride left by a solved station, else an exit. */
export function routeOut(
  world: ExpressWorld,
  progress: ExpressProgress,
  zoneId: string,
  targetZoneId: string,
  ridden: ReadonlySet<string> = new Set(),
): { kind: "ride"; encounterId: string; cutsceneId: string } | { kind: "exit"; x: number; surface: string } | null {
  const ride = pendingRide(world, progress, zoneId, ridden);
  if (ride) return ride;
  const zone = world.zones.find((z) => z.id === zoneId);
  if (!zone) return null;
  const direct = zone.exits.find((e) => e.toZoneId === targetZoneId);
  const step = nextZoneToward(world, zoneId, targetZoneId);
  const exit = direct ?? zone.exits.find((e) => e.toZoneId === step) ?? null;
  return exit ? { kind: "exit", x: exit.x + 1, surface: exit.surface } : null;
}

/**
 * What express does next, or null (nothing to do: a panel is open, the payoff is playing, the run is over, or the
 * host has not reported the player yet).
 */
export function nextExpressAction(phase: Phase, progress: ExpressProgress, world: ExpressWorld, player: PlayerSpot | null, opts: ExpressOptions = {}): ExpressAction {
  if (phase.kind === "intro" || phase.kind === "cutscene") {
    return expressTrims(phase.cutsceneId, world.finaleCutsceneId) ? { kind: "trimCutscene", cutsceneId: phase.cutsceneId } : null;
  }
  if (phase.kind !== "explore") return null;
  const id = progress.currentId;
  if (!id) return null;
  const st = world.stations.find((s) => s.encounterId === id);
  if (!st) return null;
  if (!player) return null;
  if ((opts.attempts ?? 0) >= EXPRESS_MAX_WALKS) return { kind: "warp", encounterId: id };
  const ridden = opts.ridden ?? new Set<string>();
  if (player.zoneId !== st.zoneId) {
    const out = routeOut(world, progress, player.zoneId, st.zoneId, ridden);
    if (!out) return { kind: "warp", encounterId: id };
    if (out.kind === "ride") return { kind: "ride", encounterId: out.encounterId, cutsceneId: out.cutsceneId };
    return { kind: "walkTo", x: out.x, surface: out.surface, reason: "exit", encounterId: id };
  }
  if (atConsole(player, st)) return { kind: "interact", encounterId: id };
  // same zone: a lift the previous station raised comes first (trig e3's Echo Lift carries the player up to e4)
  const ride = pendingRide(world, progress, player.zoneId, ridden);
  if (ride) return ride;
  const spot = consoleSpot(st);
  return { kind: "walkTo", x: spot.x, surface: spot.surface, reason: "station", encounterId: id };
}

/**
 * Express auto-advance for the dialogue bar: the delay before a completed line is advanced, or null (not express,
 * nothing showing, or still typing). Blocking lines would otherwise wait for Space; non-blocking bar lines and toasts
 * would hold the one queue for their full read time (≥ 2.5 s each) and delay the next cutscene's line behind them.
 */
export function expressAdvanceDelay(express: boolean, active: { typing: boolean; blocking: boolean } | null): number | null {
  if (!express || !active || active.typing) return null;
  return active.blocking ? EXPRESS_READ_MS : EXPRESS_TOAST_MS;
}

/** Side content express turns off (§0.1.5): station approach toasts, NPC approach lines, sandboxes, quests. */
export function expressAllows(what: "approach_line" | "sandbox" | "quest" | "npc_line", express: boolean): boolean {
  return !express || what === "npc_line";
}

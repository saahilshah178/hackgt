/**
 * src/game/expedition/client/session.ts (H2, pure) — the derived values ExpeditionClient computes from the runner,
 * the phase and the resolved world: progress (D3: world state always follows the runner), the panel layout and the
 * camera's safe rect (§3.1), the PanelContext (A6), the Brief sheet, the dialogue bar layout, the express world view
 * and the boss batch lines. No React, no Phaser; relative imports only.
 */
import type { GameSpec } from "../../../contracts/gamespec";
import type { WorldLine } from "../../../contracts/world";
import type { PanelContext, ResolvedStation, ResolvedWorld } from "../../../world/types";
import type { ExpeditionProgress, LayoutKind, LayoutState, SafeRect } from "../../hosts/types";
import { unlockedHints } from "../dialogue/station-dialogue";
import type { ExpressWorld } from "./express";
import { encounterOf, type Phase } from "./machine";

export interface Viewport {
  w: number;
  h: number;
}

/** Runner progress as the host's `progress` prop: every encounter before the runner's index is solved (D3). */
export function progressOf(spec: Pick<GameSpec, "encounters">, index: number | null): ExpeditionProgress {
  const n = spec.encounters.length;
  const i = index === null ? n : Math.max(0, Math.min(n, index));
  return { solvedIds: spec.encounters.slice(0, i).map((e) => e.id), currentId: spec.encounters[i]?.id ?? null };
}

/** Same progress, same object: keeps the host's `progress` prop reference-stable across unrelated renders. */
export function sameProgress(a: ExpeditionProgress, b: ExpeditionProgress): boolean {
  return a.currentId === b.currentId && a.solvedIds.length === b.solvedIds.length && a.solvedIds.every((id, i) => id === b.solvedIds[i]);
}

/** Phones and portrait screens get the bottom-sheet panel (§3.1). */
export function isCompact(vp: Viewport): boolean {
  return vp.w < 768 || vp.h > vp.w;
}

/** The panel layout the phase shows. */
export function layoutModeOf(phase: Phase, world: Pick<ResolvedWorld, "stationByEncounter">): LayoutKind {
  if (phase.kind === "sandbox") return "sandbox";
  const id = encounterOf(phase);
  if (!id) return "explore";
  return world.stationByEncounter.get(id)?.layout ?? "scrub";
}

/**
 * The visible world area (CSS px) the camera frames the contraption in (§3.1): explore 100 %; scrub and sandbox the
 * left 58 % above the dialogue band (85 %); board the left 45 % above its 20 % band; vault the whole stage (the
 * modal floats over a dim). Compact screens: the top 40 % above the bottom sheet.
 */
export function safeRectFor(mode: LayoutKind, vp: Viewport): SafeRect {
  const w = Math.max(0, Math.round(vp.w));
  const h = Math.max(0, Math.round(vp.h));
  if (mode === "explore") return { x: 0, y: 0, w, h };
  if (isCompact(vp)) return { x: 0, y: 0, w, h: Math.round(h * 0.4) };
  switch (mode) {
    case "scrub":
    case "sandbox":
      return { x: 0, y: 0, w: Math.round(w * 0.58), h: Math.round(h * 0.85) };
    case "board":
      return { x: 0, y: 0, w: Math.round(w * 0.45), h: Math.round(h * 0.8) };
    case "vault":
      return { x: 0, y: 0, w, h };
  }
}

/**
 * The HUD's right inset (CSS px) while a side panel is open (w1a fix 6): the top-right controls (? and mute) sit on the
 * world side instead of over the panel's first card label. The world side is `safeRect.w` wide; value chips and the
 * scrubber's readout tab overhang the panel's left edge into it, so the controls keep a chip allowance of up to 170 px,
 * shrinking on narrow stages so they never crowd the zone title at the top left (~360 px). Explore, the vault modal
 * and compact screens (bottom sheet) keep the default corner (0).
 */
export const HUD_CHIP_ALLOWANCE = 170;
/** the ? and mute buttons (two 48 px pills + gap + the 20 px margin) and the zone title's reach from the left */
const HUD_CONTROLS_W = 136;
const HUD_TITLE_CLEAR = 380;
export function hudInsetRight(mode: LayoutKind, vp: Viewport, panelOpen: boolean): number {
  if (!panelOpen || mode === "explore" || mode === "vault" || isCompact(vp)) return 0;
  const world = safeRectFor(mode, vp).w;
  const panel = Math.max(0, Math.round(vp.w) - world);
  const allowance = Math.max(16, Math.min(HUD_CHIP_ALLOWANCE, world - HUD_CONTROLS_W - HUD_TITLE_CLEAR));
  return panel + allowance;
}

export function layoutFor(phase: Phase, world: Pick<ResolvedWorld, "stationByEncounter">, vp: Viewport): LayoutState {
  const mode = layoutModeOf(phase, world);
  const id = encounterOf(phase);
  const focus: LayoutState["focus"] =
    phase.kind === "sandbox" ? { kind: "sandbox", sandboxId: phase.sandboxId } : id && mode !== "explore" ? { kind: "station", encounterId: id } : null;
  return { mode, safeRect: safeRectFor(mode, vp), focus };
}

export function sameLayout(a: LayoutState, b: LayoutState): boolean {
  const fa = a.focus ? `${a.focus.kind}:${"encounterId" in a.focus ? a.focus.encounterId : a.focus.sandboxId}` : "";
  const fb = b.focus ? `${b.focus.kind}:${"encounterId" in b.focus ? b.focus.encounterId : b.focus.sandboxId}` : "";
  return a.mode === b.mode && fa === fb && a.safeRect.x === b.safeRect.x && a.safeRect.y === b.safeRect.y && a.safeRect.w === b.safeRect.w && a.safeRect.h === b.safeRect.h;
}

/** A6: the RECORD card's inputs — the record strip, the solved ids and the open station's probe window. */
export function panelContextOf(world: Pick<ResolvedWorld, "overlay">, solvedIds: readonly string[], open: Pick<ResolvedStation, "probe"> | null): PanelContext {
  const w = open?.probe?.window ?? null;
  return {
    recordStrip: world.overlay.story.recordStrip,
    solvedIds,
    probeWindow: w ? { start: w.start, end: w.end } : null,
  };
}

/** The dialogue bar's geometry for the phase. */
export function barLayoutOf(phase: Phase, world: Pick<ResolvedWorld, "stationByEncounter">): "explore" | "scrub" | "board" | "vault" | "sandbox" | "cutscene" {
  if (phase.kind === "intro" || phase.kind === "cutscene" || phase.kind === "finale") return "cutscene";
  const mode = layoutModeOf(phase, world);
  return mode === "explore" ? "explore" : mode;
}

/** The HUD's hotkey mode. */
export function hudModeOf(phase: Phase): "explore" | "panel" | "cutscene" {
  if (phase.kind === "explore" || phase.kind === "loading" || phase.kind === "finished") return "explore";
  if (phase.kind === "intro" || phase.kind === "cutscene" || phase.kind === "finale") return "cutscene";
  return "panel";
}

/** The Brief sheet (§2.6): the fixture prompt verbatim, then the guide rungs unlocked so far and the fixture hints. */
export function briefOf(
  prompt: string,
  st: Pick<ResolvedStation, "encounterId" | "dialogue" | "boss">,
  hintsUsed: number,
  fixtureHints: readonly string[],
  guideId: string,
): { prompt: string; plaque: string | null; hints: string[] } {
  const u = unlockedHints(st, hintsUsed, fixtureHints, guideId);
  const hints = u.guide.map((g) => g.text);
  for (const f of u.fixture) if (!hints.includes(f)) hints.push(f);
  return { prompt, plaque: null, hints };
}

/** "Hint (1 of 3 used)"; "No hints left" once the ladder is spent. */
export function hintLabelOf(hintsUsed: number, available: number): string {
  if (available <= 0) return "No hints for this station";
  if (hintsUsed >= available) return `No hints left (${available} of ${available} used)`;
  return `Hint (${hintsUsed} of ${available} used)`;
}

/** What express needs of the world (a narrow view, so the policy stays testable). */
export function expressWorldOf(world: Pick<ResolvedWorld, "stations" | "zones" | "overlay">): ExpressWorld {
  return {
    finaleCutsceneId: world.overlay.story.finaleCutsceneId,
    zones: world.zones.map((z) => ({ id: z.id, exits: z.exits.map((e) => ({ x: e.x, surface: e.surface, toZoneId: e.toZoneId })) })),
    stations: world.stations.map((s) => ({
      encounterId: s.encounterId,
      zoneId: s.zoneId,
      consoleX: s.consoleX,
      consoleSurface: s.consoleSurface,
      payoff: { kind: s.payoff.kind, rideCutsceneId: s.payoff.rideCutsceneId },
    })),
  };
}

/**
 * The boss batch whose line should be spoken now: the first phase with an unplaced item. Returns the index only when
 * it moved past `lastSpoken` (a line is spoken once per batch; the first batch's line plays when the panel opens).
 */
export function bossBatchToSay(placed: ReadonlySet<string>, phases: readonly { itemKeys: readonly string[] }[], lastSpoken: number): number | null {
  if (phases.length === 0) return null;
  let i = phases.findIndex((p) => !p.itemKeys.every((k) => placed.has(k)));
  if (i < 0) i = phases.length - 1;
  return i > lastSpoken ? i : null;
}

/** The end screen's outro: the finale cutscene already speaks the authored outro (civil O12), so only a world without
 * a finale falls back to `spec.narrative.outro`. */
export function outroFor(spec: Pick<GameSpec, "narrative">, world: Pick<ResolvedWorld, "overlay"> | null): { speakerId: string; text: string }[] {
  if (world && world.overlay.cutscenes.some((c) => c.id === world.overlay.story.finaleCutsceneId)) return [];
  return spec.narrative.outro;
}

/** Quest reward lines → one story-priority bar request's worth of authored lines (the caller wraps them). */
export function rewardLines(lines: readonly WorldLine[]): WorldLine[] {
  return lines.filter((l) => l.text.trim().length > 0);
}

/** The zone name for the HUD's <h1>. */
export function zoneNameOf(world: Pick<ResolvedWorld, "zones">, zoneId: string | null): { id: string; name: string } | null {
  const z = (zoneId ? world.zones.find((x) => x.id === zoneId) : undefined) ?? world.zones[0];
  return z ? { id: z.id, name: z.name } : null;
}

/** The zone the game opens in: the first zone, or the current station's zone when resuming mid-run. */
export function startZoneOf(world: Pick<ResolvedWorld, "zones" | "stationByEncounter">, progress: ExpeditionProgress): string | null {
  const cur = progress.currentId ? world.stationByEncounter.get(progress.currentId) : undefined;
  if (cur && progress.solvedIds.length > 0) return cur.zoneId;
  return world.zones[0]?.id ?? null;
}

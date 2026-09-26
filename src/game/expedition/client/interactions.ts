/**
 * src/game/expedition/client/interactions.ts (H2, pure) — what pressing E on a world target does (docs/design/20
 * §2.4.3, §2.4.4, §2.4.7). The host reports the target (`onInteract`); this module decides the lines, world-state
 * events and cues, and ExpeditionClient applies them. No React, no Phaser.
 *
 * | target      | effect                                                                                           |
 * | station     | the current one opens the panel; a solved one replays its success and after lines (a review)     |
 * | sandbox     | opens the sandbox (off in express)                                                               |
 * | npc         | the active state's lines (bar, story); when they finish: `talk` + `setFlag`                       |
 * | plaque      | the text in "document" style (+ the source page line); withheld photos show the caption only     |
 * | collectible | its title and text, a `collect` event, mirrored to the debrief bonus                             |
 * | touch       | its lines and cue, a `touch` event                                                               |
 * | vehicle     | its station's ride cutscene                                                                      |
 */
import { NARRATOR_SPEAKER, type WorldLine } from "../../../contracts/world";
import { activeNpcState } from "../../../world/state/npc-state";
import type { ResolvedWorld, WorldState, WorldStateEvent } from "../../../world/types";
import type { InteractTarget } from "../../hosts/types";
import { sayRequest } from "../dialogue/lines";
import { replaySay } from "../dialogue/station-dialogue";
import type { SayRequest } from "../dialogue/types";

export type InteractPlan =
  | { kind: "none" }
  | { kind: "open_panel"; encounterId: string }
  | { kind: "replay"; say: SayRequest | null }
  | { kind: "sandbox"; sandboxId: string }
  | { kind: "npc"; say: SayRequest | null; after: WorldStateEvent[] }
  | { kind: "plaque"; say: SayRequest }
  | { kind: "collect"; say: SayRequest; events: WorldStateEvent[]; collectibleId: string }
  | { kind: "touch"; say: SayRequest | null; events: WorldStateEvent[]; cue: string | null }
  | { kind: "ride"; encounterId: string; cutsceneId: string };

export interface InteractCtx {
  world: Pick<ResolvedWorld, "overlay" | "stationByEncounter" | "sandboxes">;
  solvedIds: readonly string[];
  currentId: string | null;
  state: WorldState;
  guideId: string;
  express: boolean;
}

const NONE: InteractPlan = { kind: "none" };

function sourcePageLine(ref: { page: number } | null): string {
  return ref ? ` (source, p. ${ref.page})` : "";
}

export function planInteract(t: InteractTarget, ctx: InteractCtx): InteractPlan {
  const ov = ctx.world.overlay;
  const solved = new Set(ctx.solvedIds);
  switch (t.kind) {
    case "station": {
      if (t.encounterId === ctx.currentId) return { kind: "open_panel", encounterId: t.encounterId };
      const st = ctx.world.stationByEncounter.get(t.encounterId);
      if (st && solved.has(t.encounterId)) return { kind: "replay", say: replaySay(st, ctx.guideId) };
      return NONE;
    }
    case "sandbox": {
      if (ctx.express) return NONE;
      return ctx.world.sandboxes.some((s) => s.id === t.sandboxId) ? { kind: "sandbox", sandboxId: t.sandboxId } : NONE;
    }
    case "npc": {
      const npc = ov.npcs.find((n) => n.id === t.npcId);
      if (!npc) return NONE;
      const st = activeNpcState(npc, { solvedIds: solved, state: ctx.state }) ?? npc.states.find((s) => s.id === t.stateId) ?? null;
      if (!st) return NONE;
      const after: WorldStateEvent[] = [{ type: "talk", npcId: npc.id, stateId: st.id }];
      if (st.setFlag) after.push({ type: "flag", id: st.setFlag, on: true });
      const lines: WorldLine[] = st.lines.map((l) => ({ ...l, speakerId: l.speakerId || npc.speakerId }));
      return { kind: "npc", say: sayRequest(`npc:${npc.id}:${st.id}`, lines, "line", ctx.guideId, { channel: "bar", priority: "story" }), after };
    }
    case "plaque": {
      const pq = ov.plaques.find((p) => p.id === t.plaqueId);
      if (!pq) return NONE;
      const text = pq.kind === "photo_withheld" ? `${pq.title}. ${pq.text}` : `${pq.title}: ${pq.text}${sourcePageLine(pq.sourceRef)}`;
      const say = sayRequest(`plaque:${pq.id}`, [{ speakerId: NARRATOR_SPEAKER, text, mood: "neutral" }], "document", ctx.guideId, { channel: "bar", priority: "story" });
      return say ? { kind: "plaque", say } : NONE;
    }
    case "collectible": {
      const c = ov.collectibles.find((x) => x.id === t.collectibleId);
      if (!c || ctx.state.collected.has(c.id)) return NONE;
      const text = `${c.title}: ${c.text}${sourcePageLine(c.sourceRef)}`;
      const say = sayRequest(`collect:${c.id}`, [{ speakerId: NARRATOR_SPEAKER, text, mood: "neutral" }], c.sourceRef ? "document" : "narration", ctx.guideId, {
        channel: "bar",
        priority: "story",
      });
      return say ? { kind: "collect", say, events: [{ type: "collect", id: c.id }], collectibleId: c.id } : NONE;
    }
    case "touch": {
      const p = ov.props.find((x) => x.id === t.propId);
      if (!p || !p.touch || ctx.state.touched.has(t.propId)) return NONE;
      return {
        kind: "touch",
        say: sayRequest(`touch:${t.propId}`, p.touch.lines, "line", ctx.guideId, { channel: "toast", priority: "story" }),
        events: [{ type: "touch", id: t.propId }],
        cue: p.touch.cue,
      };
    }
    case "vehicle": {
      const st = ctx.world.stationByEncounter.get(t.encounterId);
      const id = st?.payoff.rideCutsceneId ?? null;
      return st && id && solved.has(t.encounterId) ? { kind: "ride", encounterId: t.encounterId, cutsceneId: id } : NONE;
    }
    case "link":
    case "exit":
      return NONE; // the host runs traversal and exits itself
  }
}

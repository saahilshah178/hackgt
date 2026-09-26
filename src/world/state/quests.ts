/**
 * src/world/state/quests.ts (S1) — quest progress and settlement (docs/design/20 §2.4.6).
 * Steps complete IN ORDER: `step` counts the leading steps that hold. A quest is settled (rewarded) once; its
 * `reward.flag` marks it, so `settleQuests` is idempotent.
 */
import type { Quest, QuestStep, WorldLine } from "../../contracts/world";
import type { ReqCtx, WorldStateEvent } from "../types";

export function questStepDone(step: QuestStep, ctx: ReqCtx): boolean {
  const s = ctx.state;
  switch (step.kind) {
    case "talk": {
      if (step.stateId) return s.talked.has(`${step.npcId}:${step.stateId}`);
      const prefix = `${step.npcId}:`;
      for (const k of s.talked) if (k.startsWith(prefix)) return true;
      return false;
    }
    case "collect":
      return step.ids.every((id) => s.collected.has(id));
    case "touch":
      return step.propIds.every((id) => s.touched.has(id));
    case "afterSeal":
      return ctx.solvedIds.has(step.encounterId);
    case "visit":
      return s.fired.has(step.triggerId);
  }
}

export function questStatus(q: Quest, ctx: ReqCtx): { step: number; done: boolean } {
  let step = 0;
  while (step < q.steps.length && questStepDone(q.steps[step], ctx)) step++;
  return { step, done: step === q.steps.length };
}

/** True once the quest's reward was applied. */
export function questRewarded(q: Quest, ctx: ReqCtx): boolean {
  return ctx.state.flags.has(q.reward.flag);
}

/**
 * After every event or solve: events for newly completed quests (flag, collect, cosmetic) + their reward lines
 * and debrief lines. Apply the events with `reduceAll`; the caller says the lines (story priority).
 */
export function settleQuests(
  quests: readonly Quest[],
  ctx: ReqCtx,
): { events: WorldStateEvent[]; say: WorldLine[]; debrief: string[] } {
  const events: WorldStateEvent[] = [];
  const say: WorldLine[] = [];
  const debrief: string[] = [];
  for (const q of quests) {
    if (questRewarded(q, ctx)) continue;
    if (!questStatus(q, ctx).done) continue;
    events.push({ type: "flag", id: q.reward.flag, on: true });
    if (q.reward.collectibleId) events.push({ type: "collect", id: q.reward.collectibleId });
    if (q.reward.cosmetic) events.push({ type: "cosmetic", asset: q.reward.cosmetic });
    say.push(...q.reward.lines);
    if (q.reward.debriefLine) debrief.push(q.reward.debriefLine);
  }
  return { events, say, debrief };
}

/**
 * src/game/expedition/dialogue/lines.ts (S1) — authored lines (WorldLine, LineSlot) → engine lines and requests.
 * Ids are `${source}:${index}` so a replayed request dedupes against itself (§2.7). Pure.
 */
import type { LineSlot, WorldLine } from "../../../contracts/world";
import type { Channel, DialogueKind, DialogueLine, Priority, SayRequest } from "./types";

type Authored = WorldLine | LineSlot | { speakerId: string | null; text: string; mood?: WorldLine["mood"] };

/** One authored line → an engine line. A LineSlot's null speaker is the guide. */
export function toDialogueLine(l: Authored, id: string, kind: DialogueKind, guideId: string): DialogueLine {
  return { id, speakerId: l.speakerId ?? guideId, text: l.text, kind, mood: l.mood ?? "neutral" };
}

export function toDialogueLines(
  source: string,
  lines: readonly Authored[],
  kind: DialogueKind | ((l: Authored, i: number) => DialogueKind),
  guideId: string,
  offset = 0,
): DialogueLine[] {
  return lines.map((l, i) => toDialogueLine(l, `${source}:${i + offset}`, typeof kind === "function" ? kind(l, i) : kind, guideId));
}

export interface RequestOptions {
  channel: Channel;
  priority: Priority;
  blocking?: boolean;
}

/** A say request from authored lines; null when there is nothing to say. */
export function sayRequest(
  source: string,
  lines: readonly Authored[],
  kind: DialogueKind | ((l: Authored, i: number) => DialogueKind),
  guideId: string,
  opts: RequestOptions,
): SayRequest | null {
  if (lines.length === 0) return null;
  return {
    lines: toDialogueLines(source, lines, kind, guideId),
    channel: opts.channel,
    priority: opts.priority,
    blocking: opts.channel === "toast" ? false : (opts.blocking ?? false),
    source,
  };
}

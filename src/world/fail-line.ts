/**
 * src/world/fail-line.ts (V1) — the lines a failed Verify speaks (docs/design/20 §2.5.4).
 *
 * Returns [boss taunt?, guide line]. Line 2 of the dialogue bar shows d.displayFeedback as a margin note.
 * Key precedence: the first matched probe > the near-miss > the fail key > the default line; the boss taunt comes
 * first and uses the same key (else the attempt-cycled `taunts.fail`). Pure.
 */
import { NARRATOR_SPEAKER, type LineSlot, type Station, type WorldLine } from "../contracts/world";
import type { Diagnosis } from "./types";

/** The candidate keys in precedence order: probe keys, then the near-miss, then the fail key. */
export function failKeyCandidates(d: Pick<Diagnosis, "probeKeys" | "nearMiss" | "failKey">): string[] {
  const out: string[] = [...d.probeKeys];
  if (d.nearMiss) out.push(d.nearMiss);
  if (d.failKey) out.push(d.failKey);
  return out;
}

function firstByKey<T>(table: readonly { key: string; line: T }[], keys: readonly string[]): { key: string; line: T } | null {
  for (const k of keys) {
    const hit = table.find((e) => e.key === k);
    if (hit) return hit;
  }
  return null;
}

/** The key whose authored line will play (the first candidate with a byKey entry), or null for the default line. */
export function failLineKey(st: Pick<Station, "dialogue">, d: Pick<Diagnosis, "probeKeys" | "nearMiss" | "failKey">): string | null {
  return firstByKey(st.dialogue.fail.byKey, failKeyCandidates(d))?.key ?? null;
}

function toLine(slot: Pick<LineSlot, "speakerId" | "text" | "mood">, guideId: string): WorldLine {
  return { speakerId: slot.speakerId ?? guideId, text: slot.text, mood: slot.mood };
}

/**
 * Lines for a failed Verify: [boss taunt?, guide line]. `attempt` counts failed Verifies at this station from 0.
 * `guideId` fills LineSlots whose speakerId is null (pass world.cast.guide.characterId).
 */
export function failLines(
  st: Pick<Station, "dialogue" | "boss">,
  d: Pick<Diagnosis, "probeKeys" | "nearMiss" | "failKey">,
  attempt: number,
  guideId: string = NARRATOR_SPEAKER,
): WorldLine[] {
  const keys = failKeyCandidates(d);
  const guideSlot = firstByKey(st.dialogue.fail.byKey, keys)?.line ?? st.dialogue.fail.default;
  const out: WorldLine[] = [];
  if (st.boss) {
    const byKey = firstByKey(st.boss.taunts.byKey, keys)?.line;
    const cycle = st.boss.taunts.fail;
    const n = cycle.length;
    const taunt = byKey ?? (n > 0 ? cycle[((Math.floor(attempt) % n) + n) % n] : undefined);
    if (taunt) out.push({ ...taunt, speakerId: st.boss.speakerId }); // spoken by the boss voice
  }
  out.push(toLine(guideSlot, guideId));
  return out;
}

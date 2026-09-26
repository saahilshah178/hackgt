/**
 * src/world/speakers.ts (V1) — the speaker directory (docs/design/20 §1.5 R2, amendment 1, decision 14).
 *
 * Speakers are spec.characters ∪ cast.extras ∪ {"player", "narrator"}. The dialogue bar reads names, emblems and
 * portraits from here. A spec character without a `cast.speakers` entry (and not the guide) wears the guide's
 * emblem desaturated. Pure.
 */
import type { GameSpec } from "../contracts/gamespec";
import { NARRATOR_SPEAKER, PLAYER_SPEAKER, type Emblem, type LineSlot, type WorldLine, type WorldOverlay } from "../contracts/world";
import type { SpeakerDirectory, SpeakerInfo } from "./types";

export { NARRATOR_SPEAKER, PLAYER_SPEAKER };
export const RESERVED_SPEAKERS: readonly string[] = [PLAYER_SPEAKER, NARRATOR_SPEAKER];

/** #rrggbb → the same colour at `amount` saturation toward its luminance grey (0 = grey, 1 = unchanged). */
export function desaturateHex(hex: string, amount = 0.25): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h as string, 16)) as [number, number, number];
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const mix = (c: number) => Math.round(l + (c - l) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}
export function desaturateEmblem(e: Emblem, amount = 0.25): Emblem {
  return { ...e, ring: desaturateHex(e.ring, amount), accent: desaturateHex(e.accent, amount) };
}

/** Every legal speaker id for a spec + overlay (R2). */
export function speakerIdsOf(spec: Pick<GameSpec, "characters">, world: Pick<WorldOverlay, "cast">): Set<string> {
  return new Set([...spec.characters.map((c) => c.id), ...world.cast.extras.map((x) => x.id), ...RESERVED_SPEAKERS]);
}

export function buildSpeakerDirectory(spec: Pick<GameSpec, "characters">, world: Pick<WorldOverlay, "cast">): SpeakerDirectory {
  const { cast } = world;
  const dir = new Map<string, SpeakerInfo>();
  for (const c of spec.characters) {
    const isGuide = c.id === cast.guide.characterId;
    const entry = cast.speakers.find((s) => s.characterId === c.id);
    dir.set(c.id, {
      id: c.id,
      name: c.name,
      role: c.role,
      voiceArchetype: c.voiceArchetype,
      emblem: isGuide ? cast.guide.emblem : (entry?.emblem ?? desaturateEmblem(cast.guide.emblem)),
      portrait: isGuide ? cast.guide.portrait : (entry?.portrait ?? null),
      kind: "character",
    });
  }
  for (const x of cast.extras) {
    if (dir.has(x.id)) continue; // R2 reports the collision; the spec character wins
    dir.set(x.id, { id: x.id, name: x.name, role: x.role, voiceArchetype: x.voiceArchetype, emblem: x.emblem, portrait: x.portrait, kind: "extra" });
  }
  if (!dir.has(PLAYER_SPEAKER)) {
    dir.set(PLAYER_SPEAKER, { id: PLAYER_SPEAKER, name: cast.protagonist.name, role: "you", voiceArchetype: null, emblem: null, portrait: null, kind: "player" });
  }
  if (!dir.has(NARRATOR_SPEAKER)) {
    dir.set(NARRATOR_SPEAKER, { id: NARRATOR_SPEAKER, name: "Narrator", role: "narrator", voiceArchetype: "narrator", emblem: null, portrait: null, kind: "narrator" });
  }
  return dir;
}

/** The speaker for an id, falling back to the narrator (never throws; R2 guarantees ids resolve on valid worlds). */
export function speakerFor(dir: SpeakerDirectory, id: string): SpeakerInfo {
  return dir.get(id) ?? (dir.get(NARRATOR_SPEAKER) as SpeakerInfo);
}

/** A station dialogue slot as a WorldLine: speakerId null = the guide. */
export function lineFromSlot(slot: Pick<LineSlot, "speakerId" | "text" | "mood">, guideId: string): WorldLine {
  return { speakerId: slot.speakerId ?? guideId, text: slot.text, mood: slot.mood };
}

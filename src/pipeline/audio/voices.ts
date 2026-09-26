import type { VoiceArchetype } from "../../contracts/common";
import { getEnv } from "../../server/env";

/**
 * voiceArchetype -> ElevenLabs premade voice id. These are ElevenLabs' long-standing premade library
 * voices; override any of them with ELEVENLABS_VOICE_MAP (JSON) without touching code.
 */
export const DEFAULT_VOICES: Record<VoiceArchetype, string> = {
  narrator: "JBFqnCBsd6RMkjVDRZzb", // George: warm, steady narrator
  wise_mentor: "onwK4e9ZLuTAKqWW03F9", // Daniel: measured, authoritative
  gruff_guard: "VR6AewLTigWG4xSOukaG", // Arnold: crisp, commanding
  cheerful_sidekick: "EXAVITQu4vr4xnSDxMaL", // Bella/Sarah: bright, friendly
  sly_villain: "TX3LPaxmHKxFdv7VOQHJ", // Liam: smooth, cool
  nervous_scholar: "pNInz6obpgDQGcFmaJgB", // Adam: quick, earnest
};

export function voiceFor(archetype: VoiceArchetype): string {
  const raw = getEnv().ELEVENLABS_VOICE_MAP;
  if (raw) {
    try {
      const map = JSON.parse(raw) as Partial<Record<VoiceArchetype, string>>;
      if (typeof map[archetype] === "string" && map[archetype]) return map[archetype];
    } catch {
      // ignore a malformed override; fall through to the default
    }
  }
  return DEFAULT_VOICES[archetype];
}

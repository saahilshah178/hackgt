/**
 * The narrow client surface the audio pipeline needs. The real implementation wraps
 * @elevenlabs/elevenlabs-js (client.ts); tests inject fakes. Every method resolves to raw audio bytes.
 */
export interface AudioClient {
  tts(voiceId: string, text: string, modelId: string): Promise<Uint8Array>;
  sfx(text: string, durationSeconds: number, loop: boolean): Promise<Uint8Array>;
  music(prompt: string, lengthMs: number): Promise<Uint8Array>;
  dialogue(inputs: { text: string; voiceId: string }[], modelId: string): Promise<Uint8Array>;
}

/** Model ids verified against elevenlabs.io/docs/models on 2026-09-25. */
export const TTS_MODEL_FLASH = "eleven_flash_v2_5";
export const DIALOGUE_MODEL = "eleven_v3";
export const AUDIO_FORMAT = "mp3_44100_128" as const;

/** Ship text-only if voice lines aren't done by then (MEGAPROMPT P8). */
export const AUDIO_DEADLINE_MS = 25_000;
export const AUDIO_CONCURRENCY = 4;

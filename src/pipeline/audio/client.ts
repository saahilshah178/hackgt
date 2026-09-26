import { getEnv } from "../../server/env";
import { AUDIO_FORMAT, type AudioClient } from "./types";

/** Drains a web ReadableStream (what the SDK returns) into one Uint8Array. */
export async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

let cached: AudioClient | null | undefined;

/**
 * The live ElevenLabs client, or null when audio is off or the key is missing. Never throws: audio is
 * optional and the game ships text-only without it. The SDK is imported lazily so mock mode never loads it.
 */
export async function getAudioClient(): Promise<AudioClient | null> {
  if (cached !== undefined) return cached;
  const env = getEnv();
  if (env.AUDIO_MODE !== "live" || !env.ELEVENLABS_API_KEY) {
    cached = null;
    return cached;
  }
  const { ElevenLabsClient } = await import("@elevenlabs/elevenlabs-js");
  const client = new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY });
  cached = {
    tts: async (voiceId, text, modelId) => readAll(await client.textToSpeech.convert(voiceId, { text, modelId, outputFormat: AUDIO_FORMAT })),
    sfx: async (text, durationSeconds, loop) => readAll(await client.textToSoundEffects.convert({ text, durationSeconds, loop, outputFormat: AUDIO_FORMAT })),
    music: async (prompt, lengthMs) => readAll(await client.music.compose({ prompt, musicLengthMs: lengthMs, forceInstrumental: true, outputFormat: AUDIO_FORMAT })),
    dialogue: async (inputs, modelId) => readAll(await client.textToDialogue.convert({ inputs, modelId, outputFormat: AUDIO_FORMAT })),
  };
  return cached;
}

/** Test hook. */
export function resetAudioClient(): void {
  cached = undefined;
}

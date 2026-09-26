import { createHash } from "node:crypto";
import pLimit from "p-limit";
import type { GameSpec } from "../../contracts/gamespec";
import type { StorageDriver } from "../../contracts/storage";
import { getEnv } from "../../server/env";
import { getAudioClient } from "./client";
import { musicTrackFor } from "./manifest";
import { AUDIO_CONCURRENCY, AUDIO_DEADLINE_MS, DIALOGUE_MODEL, TTS_MODEL_FLASH, type AudioClient } from "./types";
import { voiceFor } from "./voices";

/*
 * S7 audio builder (code + ElevenLabs, optional). Synthesizes every narrative line with a Flash model at
 * concurrency 4, caches by hash of text + voice id, and gives up cleanly at the deadline: whatever finished
 * ships, the rest stays text-only. With AUDIO_MODE=off this is a synchronous no-op that returns empty audio.
 */

export interface VoiceLine {
  lineKey: string;
  text: string;
  speakerId: string;
}

/** Every spoken line in a spec with a stable key: intro:<i>, outro:<i>, beat:<encounterId>:<when>. */
export function narrativeLines(spec: GameSpec): VoiceLine[] {
  return [
    ...spec.narrative.intro.map((l, i) => ({ lineKey: `intro:${i}`, text: l.text, speakerId: l.speakerId })),
    ...spec.narrative.outro.map((l, i) => ({ lineKey: `outro:${i}`, text: l.text, speakerId: l.speakerId })),
    ...spec.narrative.beats.map((b) => ({ lineKey: `beat:${b.encounterId}:${b.when}`, text: b.text, speakerId: b.speakerId })),
  ];
}

export function audioHash(text: string, voiceId: string, modelId: string): string {
  return createHash("sha1").update(`${modelId}\n${voiceId}\n${text}`).digest("hex");
}

export interface AttachAudioOptions {
  storage: StorageDriver;
  client?: AudioClient | null;
  deadlineMs?: number;
  concurrency?: number;
  now?: () => number;
  onProgress?: (note: string) => void;
}

export const EMPTY_AUDIO: GameSpec["audio"] = { musicTrackId: null, voice: [] };

/** Returns the spec's `audio` block. Never throws; never blocks longer than the deadline. */
export async function buildAudio(spec: GameSpec, o: AttachAudioOptions): Promise<GameSpec["audio"]> {
  const env = getEnv();
  const musicTrackId = musicTrackFor(spec.theme.musicMood);
  if (env.AUDIO_MODE !== "live") return { musicTrackId, voice: [] };
  const client = o.client === undefined ? await getAudioClient() : o.client;
  if (!client) return { musicTrackId, voice: [] };

  const now = o.now ?? Date.now;
  const deadline = now() + (o.deadlineMs ?? AUDIO_DEADLINE_MS);
  const limit = pLimit(o.concurrency ?? AUDIO_CONCURRENCY);
  const voices = new Map(spec.characters.map((c) => [c.id, voiceFor(c.voiceArchetype)]));
  const done: GameSpec["audio"]["voice"] = [];
  let cached = 0;
  let synthesized = 0;

  const jobs = narrativeLines(spec).map((line) =>
    limit(async () => {
      if (now() > deadline) return;
      const voiceId = voices.get(line.speakerId) ?? voiceFor("narrator");
      const path = `audio/voice/${audioHash(line.text, voiceId, TTS_MODEL_FLASH)}.mp3`;
      try {
        const existing = await o.storage.getBlob(path);
        if (existing) {
          cached++;
          done.push({ lineKey: line.lineKey, url: o.storage.blobUrl(path) });
          return;
        }
        const bytes = await client.tts(voiceId, line.text, TTS_MODEL_FLASH);
        if (now() > deadline) return; // too late to ship; the blob is still cached for next time
        await o.storage.putBlob(path, bytes, "audio/mpeg");
        synthesized++;
        done.push({ lineKey: line.lineKey, url: o.storage.blobUrl(path) });
      } catch (err) {
        o.onProgress?.(`Audio: skipped ${line.lineKey} (${err instanceof Error ? err.message : String(err)})`);
      }
    }),
  );

  const timer = new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, deadline - now())));
  await Promise.race([Promise.allSettled(jobs).then(() => undefined), timer]);

  if (env.AUDIO_DIALOGUE === "1" && now() < deadline) {
    const intro = spec.narrative.intro;
    const speakers = new Set(intro.map((l) => l.speakerId));
    if (intro.length >= 2 && speakers.size >= 2) {
      try {
        const inputs = intro.map((l) => ({ text: l.text, voiceId: voices.get(l.speakerId) ?? voiceFor("narrator") }));
        const key = audioHash(inputs.map((i) => `${i.voiceId}:${i.text}`).join("\n"), "dialogue", DIALOGUE_MODEL);
        const path = `audio/dialogue/${key}.mp3`;
        if (!(await o.storage.getBlob(path))) await o.storage.putBlob(path, await client.dialogue(inputs, DIALOGUE_MODEL), "audio/mpeg");
        done.push({ lineKey: "intro:dialogue", url: o.storage.blobUrl(path) });
      } catch (err) {
        o.onProgress?.(`Audio: intro dialogue skipped (${err instanceof Error ? err.message : String(err)})`);
      }
    }
  }

  const total = narrativeLines(spec).length;
  o.onProgress?.(
    done.length === total
      ? `Audio: ${total} lines ready (${cached} cached, ${synthesized} new)`
      : `Audio: ${done.length} of ${total} lines ready by the deadline; the rest ship text-only`,
  );
  done.sort((a, b) => a.lineKey.localeCompare(b.lineKey));
  return { musicTrackId, voice: done };
}

/** Convenience for the orchestrator: returns a copy of the spec with audio attached. */
export async function attachAudio(spec: GameSpec, o: AttachAudioOptions): Promise<GameSpec> {
  return { ...spec, audio: await buildAudio(spec, o) };
}

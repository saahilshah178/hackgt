import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fixture from "../fixtures/trig-dungeon.json";
import type { GameSpec } from "../src/contracts/gamespec";
import { audioHash, buildAudio, narrativeLines } from "../src/pipeline/audio";
import { musicTrackFor } from "../src/pipeline/audio/manifest";
import type { AudioClient } from "../src/pipeline/audio/types";
import { DEFAULT_VOICES, voiceFor } from "../src/pipeline/audio/voices";
import { resetEnvCache } from "../src/server/env";
import { LocalDriver } from "../src/server/storage/local";

const spec = fixture as unknown as GameSpec;

function fakeClient(delayMs = 0, fail: string[] = []): AudioClient & { calls: string[] } {
  const calls: string[] = [];
  const bytes = (s: string) => new TextEncoder().encode(`mp3:${s}`);
  return {
    calls,
    tts: async (_voice, text) => {
      calls.push(text);
      if (fail.includes(text)) throw new Error("boom");
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      return bytes(text);
    },
    sfx: async (text) => bytes(text),
    music: async (prompt) => bytes(prompt),
    dialogue: async (inputs) => bytes(inputs.map((i) => i.text).join("|")),
  };
}

describe("audio pipeline", () => {
  let dir: string;
  let storage: LocalDriver;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "qf-audio-"));
    process.env.DATA_DIR = dir;
    process.env.AUDIO_MODE = "off";
    delete process.env.AUDIO_DIALOGUE;
    resetEnvCache();
    storage = new LocalDriver(dir);
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.AUDIO_MODE;
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_VOICE_MAP;
    delete process.env.AUDIO_DIALOGUE;
    resetEnvCache();
  });

  it("lists every narrative line with a stable key", () => {
    const lines = narrativeLines(spec);
    expect(lines.map((l) => l.lineKey)).toEqual([
      "intro:0",
      "intro:1",
      "intro:2",
      "outro:0",
      "beat:e1_radians:before",
      "beat:e1_radians:after",
      "beat:e2_period:before",
      "beat:e2_period:after",
      "beat:e3_amplitude:before",
      "beat:e3_amplitude:after",
      "beat:e4_solve:before",
      "beat:e4_solve:after",
      "beat:e5_period_review:before",
      "beat:e5_period_review:after",
      "beat:e6_boss:before",
      "beat:e6_boss:after",
    ]);
  });

  it("is a no-op with AUDIO_MODE=off (no client calls, no blobs)", async () => {
    const client = fakeClient();
    const audio = await buildAudio(spec, { storage, client });
    expect(audio).toEqual({ musicTrackId: null, voice: [] });
    expect(client.calls).toEqual([]);
  });

  it("synthesizes every line once, caches by hash, and reuses the cache on the next game", async () => {
    process.env.AUDIO_MODE = "live";
    process.env.ELEVENLABS_API_KEY = "test";
    resetEnvCache();
    const client = fakeClient();
    const notes: string[] = [];
    const first = await buildAudio(spec, { storage, client, onProgress: (n) => notes.push(n) });
    const lineCount = narrativeLines(spec).length;
    expect(first.voice).toHaveLength(lineCount);
    expect(first.voice[0].url).toMatch(/^\/api\/blobs\/audio\/voice\/[0-9a-f]{40}\.mp3$/);
    expect(client.calls).toHaveLength(lineCount);
    expect(notes.at(-1)).toMatch(new RegExp(`${lineCount} lines ready \\(0 cached, ${lineCount} new\\)`));
    const second = await buildAudio(spec, { storage, client: fakeClient() });
    expect(second.voice).toEqual(first.voice); // all from cache: the second client is never called
  });

  it("ships whatever finished by the deadline and keeps going text-only for the rest", async () => {
    process.env.AUDIO_MODE = "live";
    process.env.ELEVENLABS_API_KEY = "test";
    resetEnvCache();
    const client = fakeClient(60);
    const notes: string[] = [];
    const audio = await buildAudio(spec, { storage, client, deadlineMs: 100, concurrency: 1, onProgress: (n) => notes.push(n) });
    expect(audio.voice.length).toBeGreaterThanOrEqual(1);
    expect(audio.voice.length).toBeLessThan(narrativeLines(spec).length);
    expect(notes.at(-1)).toMatch(/by the deadline/);
  });

  it("a failing line is skipped with a note; the others still ship", async () => {
    process.env.AUDIO_MODE = "live";
    process.env.ELEVENLABS_API_KEY = "test";
    resetEnvCache();
    const notes: string[] = [];
    const audio = await buildAudio(spec, { storage, client: fakeClient(0, [spec.narrative.outro[0].text]), onProgress: (n) => notes.push(n) });
    expect(audio.voice.map((v) => v.lineKey)).not.toContain("outro:0");
    expect(audio.voice).toHaveLength(narrativeLines(spec).length - 1);
    expect(notes.some((n) => /skipped outro:0/.test(n))).toBe(true);
  });

  it("adds a two-speaker intro dialogue only behind the flag and only with two speakers", async () => {
    process.env.AUDIO_MODE = "live";
    process.env.ELEVENLABS_API_KEY = "test";
    process.env.AUDIO_DIALOGUE = "1";
    resetEnvCache();
    const single = await buildAudio(spec, { storage, client: fakeClient() });
    expect(single.voice.some((v) => v.lineKey === "intro:dialogue")).toBe(false); // trig intro has one speaker
    const two: GameSpec = { ...spec, narrative: { ...spec.narrative, intro: [spec.narrative.intro[0], { speakerId: "warden", text: "Timing is everything." }] } };
    const dual = await buildAudio(two, { storage, client: fakeClient() });
    expect(dual.voice.some((v) => v.lineKey === "intro:dialogue")).toBe(true);
  });

  it("maps archetypes to premade voices with an env override", () => {
    expect(voiceFor("narrator")).toBe(DEFAULT_VOICES.narrator);
    process.env.ELEVENLABS_VOICE_MAP = JSON.stringify({ narrator: "custom_voice" });
    resetEnvCache();
    expect(voiceFor("narrator")).toBe("custom_voice");
    expect(voiceFor("gruff_guard")).toBe(DEFAULT_VOICES.gruff_guard);
    process.env.ELEVENLABS_VOICE_MAP = "{not json";
    resetEnvCache();
    expect(voiceFor("narrator")).toBe(DEFAULT_VOICES.narrator);
  });

  it("hashes text + voice + model and reads the music track from the manifest", () => {
    expect(audioHash("a", "v", "m")).not.toBe(audioHash("a", "w", "m"));
    expect(musicTrackFor("curious", null)).toBeNull();
    expect(musicTrackFor("boss", { generatedAt: "", sfx: [], music: [{ id: "boss_reactor", mood: "boss", file: "music/boss_reactor.mp3", lengthMs: 1, prompt: "" }] })).toBe("boss_reactor");
  });
});

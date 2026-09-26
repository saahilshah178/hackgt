import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pLimit from "p-limit";
import type { MusicMood } from "../src/contracts/common";
import { getAudioClient } from "../src/pipeline/audio/client";
import { loadManifest, manifestPath, type AudioManifest } from "../src/pipeline/audio/manifest";
import { getEnv, loadLocalEnvFile } from "../src/server/env";

/*
 * Generates the shared audio library once: ~8 music loops by mood and ~25 SFX through the ElevenLabs
 * Music and Sound Effects APIs, into public/audio/{music,sfx}/ + public/audio/manifest.json.
 * Runs only with a key (AUDIO_MODE=live); skips files that already exist, so re-runs are cheap.
 * Run: pnpm audio:library
 */

const MUSIC: { id: string; mood: MusicMood; prompt: string; lengthMs: number }[] = [
  { id: "curious_gears", mood: "curious", prompt: "Playful curious exploration loop, music box and soft synth, light percussion, seamless loop, video game dungeon ambience", lengthMs: 45_000 },
  { id: "curious_lab", mood: "curious", prompt: "Inquisitive light electronic loop with marimba and gentle pads, hopeful, seamless loop", lengthMs: 45_000 },
  { id: "tense_corridor", mood: "tense", prompt: "Tense low pulsing synth loop, sparse percussion, suspenseful dungeon exploration, seamless loop", lengthMs: 45_000 },
  { id: "playful_market", mood: "playful", prompt: "Bright playful chiptune-inspired loop, bouncy bass, cheerful melody, seamless loop", lengthMs: 45_000 },
  { id: "noir_archive", mood: "noir", prompt: "Noir detective jazz loop, muted trumpet, brushed drums, upright bass, rainy night mood, seamless loop", lengthMs: 45_000 },
  { id: "boss_reactor", mood: "boss", prompt: "Driving boss battle loop, heavy drums, brass stabs, urgent tempo, heroic, seamless loop", lengthMs: 45_000 },
  { id: "calm_observatory", mood: "calm", prompt: "Calm ambient loop, soft piano and warm pads, slow, reflective, seamless loop", lengthMs: 45_000 },
  { id: "calm_debrief", mood: "calm", prompt: "Gentle uplifting acoustic guitar and pad loop for a results screen, warm and encouraging, seamless loop", lengthMs: 45_000 },
];

const SFX: { id: string; prompt: string; durationSeconds: number; loop?: boolean }[] = [
  { id: "ui_select", prompt: "Soft UI click, short, clean", durationSeconds: 0.5 },
  { id: "ui_back", prompt: "Soft UI cancel blip, short", durationSeconds: 0.5 },
  { id: "ui_hint", prompt: "Gentle magical chime, a helpful sidekick hint", durationSeconds: 1.2 },
  { id: "footstep_stone", prompt: "Single footstep on stone dungeon floor", durationSeconds: 0.5 },
  { id: "door_unlock", prompt: "Heavy stone door unlocking and sliding open", durationSeconds: 2.5 },
  { id: "door_locked", prompt: "Locked door thud, dull and short", durationSeconds: 1 },
  { id: "chest_open", prompt: "Wooden treasure chest creaking open with a sparkle", durationSeconds: 2 },
  { id: "mimic_bite", prompt: "Monster chest snapping its jaws, cartoonish", durationSeconds: 1.2 },
  { id: "rings_lock", prompt: "Brass rings clicking into alignment, mechanical satisfying lock", durationSeconds: 1.5 },
  { id: "rings_drift", prompt: "Brass mechanism whirring out of sync, wobbly", durationSeconds: 1.5 },
  { id: "plank_place", prompt: "Wooden plank dropping into place", durationSeconds: 0.8 },
  { id: "bridge_complete", prompt: "Wooden bridge locking together with a triumphant creak", durationSeconds: 2 },
  { id: "arrow_hit", prompt: "Arrow thudding into a wooden target", durationSeconds: 0.8 },
  { id: "arrow_miss", prompt: "Arrow whooshing past and clattering on stone", durationSeconds: 1 },
  { id: "chain_lightning", prompt: "Crackling chain lightning arcing between targets", durationSeconds: 1.5 },
  { id: "sort_correct", prompt: "Item dropping into a bin with a confirming ding", durationSeconds: 0.8 },
  { id: "sort_wrong", prompt: "Item bouncing off a bin with a dull buzz", durationSeconds: 0.8 },
  { id: "enemy_appear", prompt: "Small monster appearing with a magical pop", durationSeconds: 1 },
  { id: "enemy_defeat", prompt: "Cartoon monster poof, defeated", durationSeconds: 1 },
  { id: "correct", prompt: "Bright success chord, short, satisfying", durationSeconds: 1.2 },
  { id: "wrong", prompt: "Soft descending wrong-answer tone, not harsh", durationSeconds: 1 },
  { id: "mastery_up", prompt: "Rising sparkle, a meter filling up", durationSeconds: 1.2 },
  { id: "boss_intro", prompt: "Ominous deep gong with rumbling reverb", durationSeconds: 3 },
  { id: "victory", prompt: "Triumphant short fanfare, brass and drums", durationSeconds: 3 },
  { id: "torch_loop", prompt: "Torch flame crackling loop", durationSeconds: 5, loop: true },
];

loadLocalEnvFile();
const env = getEnv();
if (env.AUDIO_MODE !== "live" || !env.ELEVENLABS_API_KEY) {
  console.log("AUDIO_MODE is off or ELEVENLABS_API_KEY is missing; nothing to do. See FIRST_RUN.md step 5.");
  process.exit(0);
}
const client = (await getAudioClient())!;
const root = resolve(process.cwd(), "public/audio");
mkdirSync(resolve(root, "music"), { recursive: true });
mkdirSync(resolve(root, "sfx"), { recursive: true });
const manifest: AudioManifest = loadManifest() ?? { generatedAt: "", music: [], sfx: [] };
const limit = pLimit(2);
let made = 0;
let skipped = 0;

const musicJobs = MUSIC.map((m) =>
  limit(async () => {
    const file = `music/${m.id}.mp3`;
    if (existsSync(resolve(root, file))) {
      skipped++;
    } else {
      const bytes = await client.music(m.prompt, m.lengthMs);
      writeFileSync(resolve(root, file), bytes);
      made++;
      console.log(`music ${m.id}: ${bytes.byteLength} bytes`);
    }
    if (!manifest.music.some((x) => x.id === m.id)) manifest.music.push({ id: m.id, mood: m.mood, file, lengthMs: m.lengthMs, prompt: m.prompt });
  }),
);
const sfxJobs = SFX.map((s) =>
  limit(async () => {
    const file = `sfx/${s.id}.mp3`;
    if (existsSync(resolve(root, file))) {
      skipped++;
    } else {
      const bytes = await client.sfx(s.prompt, s.durationSeconds, s.loop ?? false);
      writeFileSync(resolve(root, file), bytes);
      made++;
      console.log(`sfx ${s.id}: ${bytes.byteLength} bytes`);
    }
    if (!manifest.sfx.some((x) => x.id === s.id)) manifest.sfx.push({ id: s.id, file, prompt: s.prompt, durationSeconds: s.durationSeconds, loop: s.loop ?? false });
  }),
);
const results = await Promise.allSettled([...musicJobs, ...sfxJobs]);
const failed = results.filter((r) => r.status === "rejected");
failed.forEach((r) => console.error("failed:", (r as PromiseRejectedResult).reason instanceof Error ? (r as PromiseRejectedResult).reason.message : String((r as PromiseRejectedResult).reason)));
manifest.generatedAt = new Date().toISOString();
writeFileSync(manifestPath(), JSON.stringify(manifest, null, 2) + "\n");
console.log(`done: ${made} generated, ${skipped} already present, ${failed.length} failed → ${manifestPath()}`);
console.log("Credit note: music is billed per generated second (8 × 45 s), SFX per generated second (~40 s total); expect a few thousand credits for the whole library.");
process.exit(failed.length ? 1 : 0);

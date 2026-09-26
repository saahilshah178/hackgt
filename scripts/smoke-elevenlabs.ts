import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getEnv, loadLocalEnvFile } from "../src/server/env";
import { getAudioClient } from "../src/pipeline/audio/client";
import { TTS_MODEL_FLASH } from "../src/pipeline/audio/types";
import { voiceFor } from "../src/pipeline/audio/voices";

/*
 * One short Text to Speech call to confirm the key, its permissions, and the Flash model id.
 * Run: pnpm smoke:elevenlabs   (needs AUDIO_MODE=live and ELEVENLABS_API_KEY in .env.local; FIRST_RUN.md step 5)
 */
loadLocalEnvFile();
process.env.AUDIO_MODE = "live";
let env;
try {
  env = getEnv();
} catch (err) {
  console.error(String(err instanceof Error ? err.message : err));
  process.exit(1);
}
const client = await getAudioClient();
if (!client) {
  console.error("Missing ELEVENLABS_API_KEY. Set it in .env.local; see FIRST_RUN.md step 5.");
  process.exit(1);
}
const t0 = Date.now();
try {
  const bytes = await client.tts(voiceFor("narrator"), "The vault door only opens for someone who can read its rhythm.", TTS_MODEL_FLASH);
  const dir = resolve(process.cwd(), env.DATA_DIR, "blobs", "audio");
  mkdirSync(dir, { recursive: true });
  const out = resolve(dir, "smoke.mp3");
  writeFileSync(out, bytes);
  console.log(`ok: ${bytes.byteLength} bytes in ${Date.now() - t0} ms (${TTS_MODEL_FLASH}) → ${out}`);
} catch (err) {
  const e = err as { statusCode?: number; message?: string; body?: unknown };
  console.error(`FAILED after ${Date.now() - t0} ms${e.statusCode ? ` (HTTP ${e.statusCode})` : ""}: ${e.message ?? String(err)}`);
  if (e.statusCode === 401) console.error("→ 401: the API key is wrong or lacks the Text to Speech permission. FIRST_RUN.md step 5.1.");
  if (e.statusCode === 402 || e.statusCode === 429) console.error("→ out of credits or rate limited; check the ElevenLabs usage page.");
  process.exit(1);
}

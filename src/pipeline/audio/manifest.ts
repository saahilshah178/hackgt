import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { MusicMood } from "../../contracts/common";

/** public/audio/manifest.json, written by `pnpm audio:library`. Absent until the library has been generated. */
export interface AudioManifest {
  generatedAt: string;
  music: { id: string; mood: MusicMood; file: string; lengthMs: number; prompt: string }[];
  sfx: { id: string; file: string; prompt: string; durationSeconds: number; loop: boolean }[];
}

export function manifestPath(): string {
  return resolve(process.cwd(), "public/audio/manifest.json");
}

export function loadManifest(): AudioManifest | null {
  const p = manifestPath();
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as AudioManifest;
  } catch {
    return null;
  }
}

/** The library track id for a mood, or null when the library isn't built. Deterministic: first match wins. */
export function musicTrackFor(mood: MusicMood, manifest: AudioManifest | null = loadManifest()): string | null {
  return manifest?.music.find((m) => m.mood === mood)?.id ?? null;
}

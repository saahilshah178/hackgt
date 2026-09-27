import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

/*
 * Server-only, zod-validated environment. Never import this from a client component:
 * secrets stay on the server, and nothing secret is ever exposed as NEXT_PUBLIC_*.
 *
 * Mock mode (LLM_MODE=mock, STORAGE_DRIVER=local, AUDIO_MODE=off) needs no variables at all.
 * Every failure names the missing variable AND the FIRST_RUN.md step that sets it.
 */

if (typeof window !== "undefined") {
  throw new Error("src/server/env.ts was imported in the browser; it must only run on the server");
}

const empty = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optional = () => z.preprocess(empty, z.string().optional());

export const EnvSchema = z.object({
  LLM_MODE: z.preprocess(empty, z.enum(["mock", "live"]).default("mock")),
  STORAGE_DRIVER: z.preprocess(empty, z.enum(["local", "supabase"]).default("local")),
  AUDIO_MODE: z.preprocess(empty, z.enum(["off", "live"]).default("off")),
  OPENAI_API_KEY: optional(),
  SMART_MODEL: z.preprocess(empty, z.string().default("gpt-6-sol")),
  FAST_MODEL: z.preprocess(empty, z.string().default("gpt-6-luna")),
  CODER_MODEL: z.preprocess(empty, z.string().default("gpt-6-astra")),
  ELEVENLABS_API_KEY: optional(),
  NEXT_PUBLIC_SUPABASE_URL: optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optional(),
  SUPABASE_SECRET_KEY: optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: optional(),
  /** JSON object overriding the voiceArchetype -> ElevenLabs voice id map (see src/pipeline/audio/voices.ts). */
  ELEVENLABS_VOICE_MAP: optional(),
  /** "1" enables the two-speaker Text to Dialogue intro when AUDIO_MODE=live (stretch flag). */
  AUDIO_DIALOGUE: z.preprocess(empty, z.enum(["0", "1"]).default("0")),
  /**
   * Absolute or cwd-relative folder for the LocalDriver. Defaults to .data/, or /tmp on Vercel, where the
   * deployment folder (/var/task) is read-only and /tmp is the only writable path.
   */
  DATA_DIR: z.preprocess(empty, z.string().default(process.env.VERCEL ? "/tmp/eduxpert-data" : ".data")),
  /** "1" silences the mixed-modes warning (e.g. LLM_MODE=mock with STORAGE_DRIVER=supabase). */
  ALLOW_MIXED_MODES: z.preprocess(empty, z.enum(["0", "1"]).default("0")),
  /** Expedition's procedural WebAudio cue bank (docs/design/20 §2.12): "off" silences it (Playwright sets it). Not a secret. */
  EXPEDITION_SFX: z.preprocess(empty, z.enum(["on", "off"]).default("on")),
});
export type Env = z.infer<typeof EnvSchema>;

export type Stage = "llm" | "audio" | "storage" | "gemini";

/** Which variables each live stage needs, and where FIRST_RUN.md explains how to get them. */
export const REQUIREMENTS: { stage: Stage; when: (e: Env) => boolean; vars: (keyof Env)[]; step: string; label: string }[] = [
  { stage: "llm", when: (e) => e.LLM_MODE === "live", vars: ["OPENAI_API_KEY"], step: "FIRST_RUN.md step 3 (OpenAI)", label: "LLM_MODE=live" },
  { stage: "audio", when: (e) => e.AUDIO_MODE === "live", vars: ["ELEVENLABS_API_KEY"], step: "FIRST_RUN.md step 5 (ElevenLabs)", label: "AUDIO_MODE=live" },
  {
    stage: "storage",
    when: (e) => e.STORAGE_DRIVER === "supabase",
    vars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"],
    step: "FIRST_RUN.md step 6 (Supabase)",
    label: "STORAGE_DRIVER=supabase",
  },
];

export class EnvError extends Error {
  constructor(
    readonly missing: { name: string; step: string; label: string }[],
    readonly issues: string[] = [],
  ) {
    super(
      [
        ...missing.map((m) => `Missing ${m.name} (needed because ${m.label}). Set it in .env.local; see ${m.step}.`),
        ...issues,
      ].join("\n"),
    );
    this.name = "EnvError";
  }
}

/**
 * For tsx scripts: Next.js loads .env.local itself, plain Node does not.
 * Node >= 21 ships process.loadEnvFile; this never throws when the file is absent.
 */
export function loadLocalEnvFile(file = ".env.local"): boolean {
  // Turbopack's build-time trace flags this as "dynamic filesystem access" that could pull the whole
  // project into the server bundle; it's actually always cwd + a fixed filename, so opt out per the
  // warning's own suggested fix.
  const path = resolve(/* turbopackIgnore: true */ process.cwd(), file);
  if (!existsSync(path)) return false;
  try {
    process.loadEnvFile(path);
    return true;
  } catch {
    return false;
  }
}

export interface EnvReport {
  env: Env;
  modes: { llm: Env["LLM_MODE"]; storage: Env["STORAGE_DRIVER"]; audio: Env["AUDIO_MODE"] };
  /** Variables that are missing for the modes currently selected. */
  missing: { name: string; step: string; label: string }[];
  /** Per stage: what would be needed to switch it live, and which of those are already set. */
  stages: { stage: Stage; label: string; step: string; vars: { name: string; set: boolean }[]; active: boolean }[];
  issues: string[];
  /** Non-blocking: e.g. LLM_MODE=mock with a live storage/audio driver. Never affects getEnv()/exit codes. */
  warnings: string[];
}

/** Mock LLM calls but a live downstream service is a likely misconfiguration (accidentally hitting Supabase/ElevenLabs from a mock run). Silenced by ALLOW_MIXED_MODES=1. */
function mixedModeWarnings(env: Env): string[] {
  if (env.LLM_MODE !== "mock" || env.ALLOW_MIXED_MODES === "1") return [];
  const warnings: string[] = [];
  if (env.STORAGE_DRIVER === "supabase") {
    warnings.push("mock mode with a live service: LLM_MODE=mock but STORAGE_DRIVER=supabase; set ALLOW_MIXED_MODES=1 to silence");
  }
  if (env.AUDIO_MODE === "live") {
    warnings.push("mock mode with a live service: LLM_MODE=mock but AUDIO_MODE=live; set ALLOW_MIXED_MODES=1 to silence");
  }
  return warnings;
}

/** Non-throwing inspection used by `pnpm doctor` and the smoke scripts. */
/**
 * The Vercel Marketplace Supabase integration names its keys differently from FIRST_RUN.md step 6; accept its names
 * when ours are unset so a provisioned project works without renaming anything.
 */
const ALIASES: [keyof Env, string[]][] = [
  ["NEXT_PUBLIC_SUPABASE_URL", ["SUPABASE_URL"]],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"]],
  ["SUPABASE_SECRET_KEY", ["SUPABASE_SERVICE_ROLE_KEY"]],
];

function withAliases(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out = { ...source };
  for (const [name, alts] of ALIASES) {
    if (out[name]?.trim()) continue;
    const alt = alts.find((a) => out[a]?.trim());
    if (alt) out[name] = out[alt];
  }
  return out;
}

export function inspectEnv(source: NodeJS.ProcessEnv = process.env): EnvReport {
  const parsed = EnvSchema.safeParse(withAliases(source));
  const issues = parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  const env: Env = parsed.success ? parsed.data : EnvSchema.parse({});
  const missing: EnvReport["missing"] = [];
  const stages = REQUIREMENTS.map((r) => {
    const active = r.when(env);
    const vars = r.vars.map((name) => ({ name, set: env[name] !== undefined }));
    if (active) vars.filter((v) => !v.set).forEach((v) => missing.push({ name: v.name, step: r.step, label: r.label }));
    return { stage: r.stage, label: r.label, step: r.step, vars, active };
  });
  return {
    env,
    modes: { llm: env.LLM_MODE, storage: env.STORAGE_DRIVER, audio: env.AUDIO_MODE },
    missing,
    stages,
    issues,
    warnings: mixedModeWarnings(env),
  };
}

let cached: Env | undefined;

/** Validated env for the selected modes. Throws EnvError naming the variable and the FIRST_RUN.md step. */
export function getEnv(): Env {
  if (cached) return cached;
  const report = inspectEnv();
  if (report.issues.length > 0 || report.missing.length > 0) throw new EnvError(report.missing, report.issues);
  cached = report.env;
  return cached;
}

/** Test hook: forget the cached env so a test can change process.env. */
export function resetEnvCache(): void {
  cached = undefined;
}

export const isMockLLM = () => getEnv().LLM_MODE === "mock";
export const isLocalStorage = () => getEnv().STORAGE_DRIVER === "local";
export const isAudioOff = () => getEnv().AUDIO_MODE === "off";

/**
 * The play page's `sfx` prop (EXPEDITION_SFX ≠ off). Non-throwing: the page must render in every mode, so this reads
 * the one variable instead of calling getEnv(); anything but "off" leaves the cue bank on.
 */
export function expeditionSfxOn(source: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return EnvSchema.shape.EXPEDITION_SFX.safeParse(source.EXPEDITION_SFX).data !== "off";
}

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
  /** Absolute or cwd-relative folder for the LocalDriver. Defaults to .data/ */
  DATA_DIR: z.preprocess(empty, z.string().default(".data")),
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
  const path = resolve(process.cwd(), file);
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
}

/** Non-throwing inspection used by `pnpm doctor` and the smoke scripts. */
export function inspectEnv(source: NodeJS.ProcessEnv = process.env): EnvReport {
  const parsed = EnvSchema.safeParse(source);
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

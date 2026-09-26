import { afterEach, describe, expect, it } from "vitest";
import { inspectEnv } from "../src/server/env";

/*
 * Mixed-modes guard: LLM_MODE=mock alongside a LIVE downstream service (STORAGE_DRIVER=supabase or
 * AUDIO_MODE=live) is a likely misconfiguration (accidentally hitting a live service from a mock run).
 * inspectEnv() surfaces it as a non-blocking warning (never affects getEnv()/exit codes), silenced by
 * ALLOW_MIXED_MODES=1. Surfaced by scripts/doctor.ts.
 */

const ENV_KEYS = ["LLM_MODE", "STORAGE_DRIVER", "AUDIO_MODE", "ALLOW_MIXED_MODES", "OPENAI_API_KEY", "SUPABASE_SECRET_KEY"] as const;
const saved: Record<string, string | undefined> = {};

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
    delete saved[key];
  }
});

function set(env: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    if (env[key] !== undefined) process.env[key] = env[key];
    else delete process.env[key];
  }
}

describe("inspectEnv: mixed-modes guard", () => {
  it("warns when LLM_MODE=mock with STORAGE_DRIVER=supabase", () => {
    set({ LLM_MODE: "mock", STORAGE_DRIVER: "supabase" });
    const report = inspectEnv();
    expect(report.warnings).toContainEqual(expect.stringMatching(/mock mode with a live service/));
    expect(report.warnings.join(" ")).toMatch(/STORAGE_DRIVER=supabase/);
  });

  it("warns when LLM_MODE=mock with AUDIO_MODE=live", () => {
    set({ LLM_MODE: "mock", AUDIO_MODE: "live" });
    expect(inspectEnv().warnings).toContainEqual(expect.stringMatching(/AUDIO_MODE=live/));
  });

  it("is silenced by ALLOW_MIXED_MODES=1", () => {
    set({ LLM_MODE: "mock", STORAGE_DRIVER: "supabase", ALLOW_MIXED_MODES: "1" });
    expect(inspectEnv().warnings).toEqual([]);
  });

  it("has no warnings for plain mock mode", () => {
    set({ LLM_MODE: "mock", STORAGE_DRIVER: "local", AUDIO_MODE: "off" });
    expect(inspectEnv().warnings).toEqual([]);
  });

  it("has no warnings for fully live mode", () => {
    set({ LLM_MODE: "live", STORAGE_DRIVER: "supabase", AUDIO_MODE: "live" });
    expect(inspectEnv().warnings).toEqual([]);
  });

  it("never blocks: a mixed-modes warning never becomes a zod issue", () => {
    set({ LLM_MODE: "mock", STORAGE_DRIVER: "supabase" });
    const report = inspectEnv();
    expect(report.issues).toEqual([]); // parsing the env itself is fine; this is a warning, not a validation error
    expect(report.warnings.length).toBeGreaterThan(0);
  });
});

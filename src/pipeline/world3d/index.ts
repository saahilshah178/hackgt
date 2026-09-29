import type { LanguageModel } from "ai";
import type { GameSpec } from "../../contracts/gamespec";
import type { Intake, KnowledgeMap } from "../../contracts/knowledge";
import type { CriticReport, World3D } from "../../contracts/world3d";
import { isMockLLM } from "../../server/env";
import { emit } from "../events";
import { GenerationError } from "../generate";
import type { Progress } from "../llm";
import { getCriticModel, getModel, modelIdOf } from "../models";
import { repairNote } from "../prompts";
import { validateGameSpec } from "../validate/validate-gamespec";
import { runArchitect, type ArchitectResult } from "./architect";
import { checkWorld, type WorldCheck } from "./checks";
import { criticRepairLines, runStoryCritic, runWorldCritic, toCriticReport, type CriticKind, type CriticVerdict } from "./critics";
import { composeFallbackDetailed } from "./fallback";

/*
 * S10: the 3D open world for a world3d GameSpec (docs/design/60 §2.5). Runs in the orchestrator after the blind solver
 * (the encounters are final) and before audio.
 *
 *   live:  Astra drafts (CODER tier) → code composes and checks, repairing up to 2 rounds → the story and world critics
 *          review in parallel (SMART tier or CRITIC_MODEL) → a failing critic's issues go back to Astra for ONE more
 *          round, re-checked by code, then reviewed again → the world, with the critics' reports and the composer's
 *          fixes in provenance.
 *   mock:  the deterministic composer (fallback.ts) builds the world from the spec; no model is called.
 *   any Architect failure (repairs exhausted, network): the composer's world, with a note on the job stream.
 */

export interface World3DModels {
  fast: LanguageModel;
  smart: LanguageModel;
  /** the World Architect's model (CODER tier); defaults to getModel("coder") */
  coder?: LanguageModel;
  /** the critics' model; defaults to CRITIC_MODEL, else the SMART tier */
  critic?: LanguageModel;
}

export interface BuildWorld3DArgs {
  spec: GameSpec;
  km: KnowledgeMap;
  intake: Intake;
  models: World3DModels;
  jobId: string;
  /** run the Architect even in mock mode (tests and dev scripts inject mock models) */
  forceArchitect?: boolean;
  onProgress?: (p: Progress) => void;
}

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** The spec with `world3d` set, validated. Non-world3d specs pass through unchanged. */
export async function buildWorld3D(a: BuildWorld3DArgs): Promise<GameSpec> {
  if (a.spec.genre !== "world3d") return a.spec;
  const note = (p: Progress) => {
    a.onProgress?.(p);
    emit(a.jobId, p);
  };

  let world: World3D;
  if (isMockLLM() && !a.forceArchitect) {
    world = composerWorld(a, note, "mock mode");
  } else {
    try {
      world = await designWorld(a, note);
    } catch (err) {
      world = composerWorld(a, note, `the World Architect failed (${errMsg(err)})`);
    }
  }

  const result = validateGameSpec({ ...a.spec, world3d: world });
  if (result.ok) return result.spec;
  if (world.provenance?.source === "astra") {
    // checked worlds validate; this is a last line of defence against a rule the checks and the validator disagree on
    const fb = composerWorld(a, note, `the Architect's world failed validation (${result.issues[0]?.message ?? "?"})`);
    const again = validateGameSpec({ ...a.spec, world3d: fb });
    if (again.ok) return again.spec;
    throw new GenerationError(again.issues);
  }
  throw new GenerationError(result.issues);
}

/** The deterministic composer's world, with a progress note saying why and how it went. */
function composerWorld(a: BuildWorld3DArgs, note: (p: Progress) => void, why: string): World3D {
  const t0 = Date.now();
  const mock = why === "mock mode";
  note({ agent: "world_architect", status: mock ? "start" : "fallback", note: mock ? "composing the 3D world from the game (mock mode)" : `${why}; composing the world from the game instead` });
  const r = composeFallbackDetailed(a.spec, a.km);
  const w = r.world;
  const checks = r.check.issues.length === 0 ? "all checks passed" : `${r.check.issues.length} check(s) still failing: ${r.check.issues[0]?.message}`;
  note({
    agent: "world_architect",
    status: "done",
    ms: Date.now() - t0,
    note: `composed a ${w.biome} world: ${w.landmarks.length} landmarks, ${w.npcs.length} characters, ${w.moments.length} moments; ${checks}`,
  });
  return w;
}

/** The live path: Astra → checks → critics → one critic repair round → final world. Throws when Astra fails outright. */
async function designWorld(a: BuildWorld3DArgs, note: (p: Progress) => void): Promise<World3D> {
  const coder = a.models.coder ?? getModel("coder");
  const coderId = modelIdOf(coder);
  const critic = a.models.critic ? { model: a.models.critic, id: modelIdOf(a.models.critic) } : getCriticModel();
  const base = { spec: a.spec, km: a.km, intake: a.intake, model: coder, modelId: coderId, jobId: a.jobId, onProgress: a.onProgress };

  let draft: ArchitectResult = await runArchitect(base);
  note({ agent: "world_architect", status: "done", note: summarize(draft) });

  let full = checkWorld(a.spec, draft.world, { withScatter: true });
  let verdicts = await runCritics(a, full, critic.model, note);
  const rounds: Record<CriticKind, number> = { story: 0, world: 0 };
  const failing = verdicts.filter((v) => !v.pass);
  if (failing.length > 0) {
    const lines = failing.flatMap(criticRepairLines);
    try {
      draft = await runArchitect({ ...base, notes: repairNote(lines, draft.slice), maxRepairs: 1 });
      for (const v of failing) rounds[v.kind] = 1;
      note({ agent: "world_architect", status: "done", note: `revised after the critics: ${summarize(draft)}` });
      full = checkWorld(a.spec, draft.world, { withScatter: true });
      verdicts = await runCritics(a, full, critic.model, note);
    } catch (err) {
      note({ agent: "world_architect", status: "fallback", note: `the critics' repair round failed (${errMsg(err)}); keeping the checked draft` });
    }
  }

  const reviews: CriticReport[] = verdicts.map((v) => toCriticReport(v, critic.id, rounds[v.kind]));
  return { ...draft.world, provenance: { source: "astra", model: coderId, reviews, fixes: draft.world.provenance?.fixes ?? [] } };
}

/** Both critics in parallel; one that fails outright is skipped with a note (the world still ships). */
async function runCritics(a: BuildWorld3DArgs, check: WorldCheck, model: LanguageModel, note: (p: Progress) => void): Promise<CriticVerdict[]> {
  const args = { spec: a.spec, km: a.km, intake: a.intake, check, model, jobId: a.jobId, onProgress: a.onProgress };
  const safe = (kind: CriticKind, run: Promise<CriticVerdict>) =>
    run.then(
      (v) => {
        const verdict = v.pass ? "passed" : `${v.issues.length} issue${v.issues.length === 1 ? "" : "s"} sent to the World Architect`;
        note({ agent: `${kind}_critic`, status: v.pass ? "done" : "repair", note: `${kind} critic: ${v.mean.toFixed(1)}/5, ${verdict}` });
        return v;
      },
      (err: unknown) => {
        note({ agent: `${kind}_critic`, status: "failed", note: `${kind} critic unavailable (${errMsg(err)}); skipped` });
        return null;
      },
    );
  const out = await Promise.all([safe("story", runStoryCritic(args)), safe("world", runWorldCritic(args))]);
  return out.filter((v): v is CriticVerdict => v !== null);
}

function summarize(d: ArchitectResult): string {
  const w = d.world;
  const fixes = w.provenance?.fixes.length ?? 0;
  return `${w.biome} world: ${w.landmarks.length} landmarks, ${w.npcs.length} characters, ${w.moments.length} moments${fixes ? `; code fixed ${fixes} thing${fixes === 1 ? "" : "s"}` : ""}`;
}

export { composeFallbackWorld } from "./fallback";
export { fromSlice, worldToSlice, WORLD_ARCHITECT_SYSTEM } from "./architect";
export { STORY_CRITIC_SYSTEM, WORLD_CRITIC_SYSTEM, CRITIC_MIN_SCORE, CRITIC_PASS_MEAN } from "./critics";

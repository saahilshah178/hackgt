import type { Genre } from "../../contracts/common";
import type { Encounter, GameSpec } from "../../contracts/gamespec";
import type { Intake, KnowledgeMap } from "../../contracts/knowledge";
import { challengeSchema, type BlueprintEncounter, type BlueprintSlice, type ChallengeSlice } from "../../contracts/slices";
import { getCard } from "../../library";
import { getMode } from "../../mechanics/registry";
import type { AnyFamilyMode } from "../../mechanics/types";
import { isMockLLM } from "../../server/env";
import { assembleEncounter } from "../assemble";
import { emit } from "../events";
import { fallbackMimic, GenerationError, type Models } from "../generate";
import { layoutFromEncounters } from "../layout";
import { runAgent, type Progress } from "../llm";
import { CHALLENGE_SYSTEM, challengePrompt, repairNote, sharedContext } from "../prompts";
import { checkChallenge } from "../validate/checks";
import { validateGameSpec } from "../validate/validate-gamespec";

/*
 * S9 blind solve: for every blindSolvable encounter, a FAST model answers using ONLY what the player
 * sees (mode.blind.describe / mode.blind.schema), mapped back through mode.blind.toInput and compared
 * against mode.grade(). Disagreement -> regenerate the encounter once through the Challenge Writer
 * with a repair note -> re-run blind solve -> if it still disagrees, replace with the Mimic Chest
 * fallback (or drop, for the boss this throws instead — a boss with no fallback fails the job).
 * See MEGAPROMPT §3 (S9) and instructions.md's pipeline-dev brief (P6, "Blind solve").
 */

export const BLIND_SOLVER_SYSTEM = `You are the Blind Solver. You answer one puzzle from an educational game using ONLY what the player sees below: no answer key, no hints, no source material. Think it through and give your best honest answer; never guess randomly.`;

export interface BlindSolveArgs {
  spec: GameSpec;
  km: KnowledgeMap;
  intake: Intake;
  models: Models;
  jobId: string;
  onProgress?: (p: Progress) => void;
}

/** Builds a minimal BlueprintEncounter/BlueprintSlice from an assembled Encounter/GameSpec, enough to
 *  drive challengePrompt() for a targeted regeneration (the full Director blueprint isn't kept past
 *  generateGame(), so this reconstructs only what the prompt actually reads). */
function toBlueprintEncounter(e: Encounter, designNote: string): BlueprintEncounter {
  return {
    id: e.id,
    conceptIds: e.conceptIds,
    teachingMechanicId: e.teachingMechanicId,
    socket: e.socket,
    role: e.role,
    difficulty: e.difficulty,
    targetMisconception: e.targetMisconception,
    designNote,
  };
}

function toBlueprintSlice(spec: GameSpec): BlueprintSlice {
  return {
    genre: spec.genre,
    title: spec.title,
    theme: spec.theme,
    premise: spec.premise,
    characters: spec.characters,
    encounters: [],
  };
}

function toChallengeSlice(e: Encounter): ChallengeSlice {
  return { prompt: e.prompt, params: e.params, hints: e.hints, wrongFeedback: e.wrongFeedback, debriefLine: e.debriefLine, sourceRef: e.sourceRef };
}

/** Runs one encounter's blind solve. In mock mode the LLM is skipped: the "solver" is handed the key. */
export async function blindSolveOne(
  mode: AnyFamilyMode,
  e: Pick<Encounter, "id" | "params" | "prompt">,
  seed: number,
  models: Models,
  jobId: string,
  onProgress?: (p: Progress) => void,
): Promise<boolean> {
  if (!mode.blindSolvable || !mode.blind) return true; // not applicable: treat as agreeing
  const view = mode.present(e.params, seed);
  if (isMockLLM()) {
    const input = mode.solutionInput(e.params, mode.resolve(e.params));
    return mode.grade(e.params, input).correct;
  }
  const output = await runAgent({
    jobId,
    agent: `blind:${e.id}`,
    tier: "fast",
    model: models.fast,
    schema: mode.blind.schema,
    system: BLIND_SOLVER_SYSTEM,
    prompt: `${e.prompt}\n\n${mode.blind.describe(e.params, view)}`,
    onProgress,
  });
  const input = mode.blind.toInput(e.params, view, output);
  return mode.grade(e.params, input).correct;
}

/** Regenerates one encounter's challenge through the writer, with a repair note aimed at ambiguity. */
async function regenerate(spec: GameSpec, e: Encounter, a: BlindSolveArgs): Promise<Encounter | null> {
  const card = getCard(e.teachingMechanicId);
  const mode = card && getMode(card.family, card.mode);
  if (!card || !mode) return null;
  const shared = sharedContext(a.km, a.intake, spec.genre);
  const bp = toBlueprintSlice(spec);
  const be = toBlueprintEncounter(e, "Rewrite this so the challenge is unambiguous even without the answer key.");
  const note = repairNote(
    ["a solver without the key could not reach the intended answer; make the prompt and options unambiguous"],
    toChallengeSlice(e),
  );
  try {
    const slice = await runAgent({
      jobId: a.jobId,
      agent: `challenge:${e.id}`,
      tier: "smart",
      model: a.models.smart,
      schema: challengeSchema(mode.paramsSchema, Object.keys(card.lockedParams ?? {})),
      system: CHALLENGE_SYSTEM,
      prompt: challengePrompt(shared, bp, be, card, mode, note),
      check: (s) => checkChallenge(mode, s, card.lockedParams),
      maxRepairs: 1,
      onProgress: a.onProgress,
    });
    return assembleEncounter(be, card, mode, slice);
  } catch {
    return null;
  }
}

/** Replaces an encounter with the Mimic Chest fallback, reassembled to the Encounter shape. */
function replaceWithFallback(km: KnowledgeMap, e: Encounter, genre: Genre): Encounter | null {
  const fb = fallbackMimic(km, toBlueprintEncounter(e, ""), genre);
  if (!fb) return null;
  const card = getCard(fb.encounter.teachingMechanicId);
  const mode = card && getMode(card.family, card.mode);
  if (!card || !mode) return null;
  return assembleEncounter(fb.encounter, card, mode, fb.slice);
}

/**
 * Runs blind solve over every blindSolvable encounter in an already-assembled, already-validated
 * GameSpec. Returns the same spec when nothing needed to change; otherwise reassembles the layout and
 * re-validates. Every catch is reported as a "Verifier: ..." progress note for the Forge screen.
 */
export async function blindSolveAndFix(a: BlindSolveArgs): Promise<GameSpec> {
  const spec = a.spec;
  const encounters: Encounter[] = [...spec.encounters];
  let changed = false;

  // Every runAgent() call inside blindSolveOne()/regenerate() auto-emits to the job's event bus
  // (llm.ts); these notes are generated directly by this loop, so they need the same treatment to
  // reach the SSE stream (GET /api/jobs/:id/stream) — not just callers that pass onProgress.
  const note = (p: Progress) => {
    a.onProgress?.(p);
    emit(a.jobId, p);
  };

  for (let i = 0; i < encounters.length; i++) {
    const e = encounters[i];
    const mode = getMode(e.familyId, e.mode);
    if (!mode || !mode.blindSolvable || !mode.blind) continue;
    const seed = spec.seed + i;

    const agree = await blindSolveOne(mode, e, seed, a.models, a.jobId, a.onProgress);
    if (agree) continue;

    note({ agent: "verifier", status: "repair", note: `Verifier: blind solver disagreed with "${e.id}"; regenerating` });
    const regenerated = await regenerate(spec, e, a);
    const agreeAfterRegen = regenerated ? await blindSolveOne(mode, regenerated, seed, a.models, a.jobId, a.onProgress) : false;
    if (regenerated && agreeAfterRegen) {
      encounters[i] = regenerated;
      changed = true;
      continue;
    }

    const fallback = replaceWithFallback(a.km, e, spec.genre);
    if (fallback) {
      encounters[i] = fallback;
      changed = true;
      note({ agent: "verifier", status: "fallback", note: `Verifier: replaced ${e.id}, the blind solver disagreed` });
    } else if (e.role === "boss") {
      throw new Error(`Verifier: the boss encounter "${e.id}" failed blind-solve and has no fallback`);
    } else {
      note({ agent: "verifier", status: "failed", note: `Verifier: "${e.id}" failed blind-solve and could not be replaced; left as-is` });
    }
  }

  if (!changed) return spec;
  const layout = layoutFromEncounters(spec.genre, encounters);
  const result = validateGameSpec({ ...spec, encounters, layout });
  if (!result.ok) throw new GenerationError(result.issues);
  return result.spec;
}

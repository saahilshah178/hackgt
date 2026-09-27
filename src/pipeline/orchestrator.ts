import type { GenreOrAuto } from "../contracts/common";
import { selectConcepts, type Intake, type KnowledgeMap } from "../contracts/knowledge";
import type { GameRecord, JobRecord } from "../contracts/storage";
import { emptyMastery, updateMastery } from "../contracts/telemetry";
import { newId } from "../server/ids";
import { getStorage } from "../server/storage";
import { loadMatches } from "./agents/intake";
import { blindSolveAndFix } from "./agents/blind-solver";
import { attachAudio } from "./audio";
import { emit, close } from "./events";
import { generateGame, resolveGenre, type Models } from "./generate";
import { focusConcepts } from "./personalize";
import { getModels } from "./models";

/*
 * P6 orchestrator: turns { sourceId, intake } into a running job (S6-S9 back half) without blocking
 * the HTTP request. See instructions.md §9 (POST /api/games, /api/jobs/:id/stream) and MEGAPROMPT §3.
 * The job runs on intake.conceptIds when the student ticked a subset (selectConcepts); the matcher's
 * results always cover the whole map (loadMatches), so they need no filtering (the Director's menu is
 * built per concept in the job's map). intake.profile (the clarify step) personalizes S6 onward.
 */

export interface StartGameJobArgs {
  sourceId: string;
  intake: Intake;
  /** legacy: outline titles from the old "too big" checklist; unused now that the student ticks concepts (intake.conceptIds) */
  sections?: string[];
  /** overrides intake.genre (used by regenerate) */
  genreOverride?: GenreOrAuto;
  /** regenerate only: lower the 2 weakest units' confidence by 1 before generating */
  focusWeak?: boolean;
  /** regenerate only: the game whose telemetry decides "weakest" for focusWeak (falls back to lowest confidence) */
  previousGameId?: string;
  /** regenerate only: emitted as the job's first progress event, before the Director even starts */
  firstNote?: string;
}

/** MEGAPROMPT §8: mastery per unit, averaged from the concepts it contains, from a game's telemetry. */
async function weakestUnitsByTelemetry(km: KnowledgeMap, gameId: string): Promise<string[] | null> {
  const events = await getStorage().getTelemetry(gameId);
  if (events.length === 0) return null;
  let state = emptyMastery(km.concepts.map((c) => c.id));
  for (const event of events) state = updateMastery(state, event);
  const byUnit = new Map<string, number[]>();
  for (const c of km.concepts) {
    const m = state[c.id];
    if (m) byUnit.set(c.unitId, [...(byUnit.get(c.unitId) ?? []), m.score]);
  }
  if (byUnit.size === 0) return null;
  return [...byUnit.entries()]
    .map(([unitId, scores]) => ({ unitId, avg: scores.reduce((a, b) => a + b, 0) / scores.length }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 2)
    .map((x) => x.unitId);
}

function weakestUnitsByConfidence(km: KnowledgeMap, intake: Intake): string[] {
  return km.units
    .map((u) => ({ unitId: u.id, level: intake.confidence[u.id] ?? 3 }))
    .sort((a, b) => a.level - b.level)
    .slice(0, 2)
    .map((u) => u.unitId);
}

/** Lowers the 2 weakest units' confidence by 1 (floor 1), mutating a copy of intake.confidence. */
async function applyFocusWeak(km: KnowledgeMap, intake: Intake, previousGameId?: string): Promise<Intake> {
  const weakest = (previousGameId ? await weakestUnitsByTelemetry(km, previousGameId) : null) ?? weakestUnitsByConfidence(km, intake);
  const confidence = { ...intake.confidence };
  for (const unitId of weakest) confidence[unitId] = Math.max(1, (confidence[unitId] ?? 3) - 1);
  return { ...intake, confidence };
}

async function runJob(args: {
  jobId: string;
  gameId: string;
  sourceId: string;
  km: KnowledgeMap;
  intake: Intake;
  models: Models;
}): Promise<void> {
  const { jobId, gameId, sourceId, km, intake, models } = args;
  const storage = getStorage();
  const now = () => new Date().toISOString();
  try {
    await storage.putJob({ id: jobId, sourceId, status: "running", gameId: null, error: null, createdAt: now(), updatedAt: now() });

    const matches = await loadMatches(sourceId, jobId);
    // No onProgress here: every runAgent() call auto-emits to this jobId's event bus (llm.ts), and
    // generateGame()/blindSolveAndFix()'s own non-runAgent notes (verifier, fallback, genre choice)
    // emit directly too (see the `note()` helpers in generate.ts and blind-solver.ts) — passing a
    // second emit(jobId, e) here would just duplicate every event on the SSE stream.

    // Genre first, on everything the student ticked: the same ranking the intake page showed them.
    const resolved = resolveGenre(km, intake, matches);
    // More concepts than this game length holds: play the ones the student needs most (and say which were left out).
    const { km: focused, dropped } = focusConcepts(km, intake);
    if (dropped.length > 0) {
      emit(jobId, {
        agent: "focus",
        status: "done",
        note: `${km.concepts.length} concepts is more than a ${intake.minutes}-minute game holds: focusing on the ${focused.concepts.length} you need most (left out: ${dropped.map((c) => c.name).join(", ")})`,
      });
    }

    const { spec: generated } = await generateGame({ gameId, jobId, km: focused, intake, matches, models, resolved });
    const verified = await blindSolveAndFix({ spec: generated, km: focused, intake, models, jobId });

    // S7 audio (optional): a no-op with AUDIO_MODE=off; with a key it voices the narrative lines within a
    // 25 s deadline and ships whatever finished (the rest stays text-only). Never fails the job.
    const t0 = Date.now();
    emit(jobId, { agent: "audio", status: "start" });
    const spec = await attachAudio(verified, { storage, onProgress: (note) => emit(jobId, { agent: "audio", status: "repair", note }) }).catch(() => verified);
    emit(jobId, { agent: "audio", status: "done", ms: Date.now() - t0, note: spec.audio.voice.length ? `${spec.audio.voice.length} voice lines` : "text-only (audio off)" });

    const record: GameRecord = { id: gameId, sourceId, jobId, createdAt: now(), spec };
    await storage.putGame(record);
    await storage.putJob({ id: jobId, sourceId, status: "done", gameId, error: null, createdAt: now(), updatedAt: now() });
    close(jobId, { done: true, gameId, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit(jobId, { agent: "verifier", status: "failed", note: message });
    await storage.putJob({ id: jobId, sourceId, status: "failed", gameId: null, error: message, createdAt: now(), updatedAt: now() });
    close(jobId, { done: true, gameId: null, error: message });
  }
}

/**
 * Creates a JobRecord, persists the intake, and fires off the S6-S9 back half without awaiting it
 * (the caller — POST /api/games or /api/games/:id/regenerate — gets { jobId } back immediately and
 * the browser watches progress over /api/jobs/:id/stream).
 */
export async function startGameJob(a: StartGameJobArgs): Promise<{ jobId: string }> {
  const storage = getStorage();
  const full = await storage.getKnowledgeMap(a.sourceId);
  if (!full) throw new Error(`No knowledge map for source "${a.sourceId}"; run intake prep first.`);
  // A long upload yields far more concepts than one game holds: the job sees only the ticked ones.
  const km = selectConcepts(full, a.intake.conceptIds);

  const jobId = newId("job");
  const gameId = newId("game");
  if (a.firstNote) emit(jobId, { agent: "director", status: "start", note: a.firstNote });

  let intake: Intake = a.genreOverride ? { ...a.intake, genre: a.genreOverride } : a.intake;
  if (a.focusWeak) intake = await applyFocusWeak(km, intake, a.previousGameId);

  const now = () => new Date().toISOString();
  await storage.putIntake(a.sourceId, intake);
  await storage.putJob({ id: jobId, sourceId: a.sourceId, status: "queued", gameId: null, error: null, createdAt: now(), updatedAt: now() });

  // runJob() has its own try/catch that reports failures through the job record and the event bus, but
  // a throw from ITS OWN catch block (e.g. storage.putJob() failing while already handling an error)
  // would otherwise be an unhandled rejection on this fire-and-forget promise; log it as a last resort.
  void runJob({ jobId, gameId, sourceId: a.sourceId, km, intake, models: getModels() }).catch((err: unknown) => {
    console.error(`[orchestrator] job ${jobId} failed outside its own error handling:`, err);
  });

  return { jobId };
}

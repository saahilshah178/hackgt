import { NextResponse } from "next/server";
import { z } from "zod";
import { GenreOrAuto } from "../../../../../contracts/common";
import type { Intake } from "../../../../../contracts/knowledge";
import { startGameJob } from "../../../../../pipeline/orchestrator";
import { isFixtureId, materializeFixtureGame } from "../../../../../server/fixtures";
import { getStorage } from "../../../../../server/storage";

/*
 * POST /api/games/[id]/regenerate: reuses the KnowledgeMap, intake and matches already on file for
 * the game's source (S6-S9 only; no re-ingest). Body: { genre, focusWeak? }. See instructions.md §9.
 */

const Body = z.object({ genre: GenreOrAuto, focusWeak: z.boolean().optional() });

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

/** Falls back to what the stored spec remembers about the intake (assessment.pre carries the full
 *  pre-check Mcqs, so nothing is lost even without a stored Intake record). */
function intakeFromSpec(spec: { intake: { goal: Intake["goal"]; minutes: Intake["minutes"]; requestedGenre: Intake["genre"]; confidence: { unitId: string; level: number }[]; preCheckAnswers: number[] }; assessment: { pre: Intake["preCheck"]["items"] } }): Intake {
  return {
    goal: spec.intake.goal,
    minutes: spec.intake.minutes,
    genre: spec.intake.requestedGenre,
    confidence: Object.fromEntries(spec.intake.confidence.map((c) => [c.unitId, c.level])),
    preCheck: { items: spec.assessment.pre, answers: spec.intake.preCheckAnswers },
  };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  const storage = getStorage();
  const record = (await storage.getGame(id)) ?? (isFixtureId(id) ? await materializeFixtureGame(id) : null);
  if (!record) return jsonError(404, `No game with id "${id}".`);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError(400, "Expected a JSON body.");
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return jsonError(400, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));

  const intake = (await storage.getIntake(record.sourceId)) ?? intakeFromSpec(record.spec);

  try {
    const { jobId } = await startGameJob({
      sourceId: record.sourceId,
      intake,
      genreOverride: parsed.data.genre,
      focusWeak: parsed.data.focusWeak,
      previousGameId: id,
      firstNote: `Regenerating as ${parsed.data.genre}`,
    });
    return NextResponse.json({ jobId }, { status: 202 });
  } catch (err) {
    return jsonError(500, err instanceof Error ? err.message : String(err));
  }
}

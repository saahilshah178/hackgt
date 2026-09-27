import { NextResponse } from "next/server";
import { z } from "zod";
import { LearnerProfile, selectConcepts } from "../../../../../contracts/knowledge";
import { storedMatches } from "../../../../../pipeline/agents/intake";
import { recommendGenres } from "../../../../../pipeline/personalize";
import { getStorage } from "../../../../../server/storage";

/*
 * POST /api/sources/[id]/recommend: genres ranked for this learner, from the concepts they ticked, their
 * confidence, the clarify step's profile, and the library components the matcher mapped to each concept.
 * Body: { conceptIds?, confidence, profile? } -> { recommendations: GenreRecommendation[], pending }. The first
 * entry is what "Pick for me" plays (resolveGenre uses the same function). See instructions.md §9.
 */

const Body = z.object({
  conceptIds: z.array(z.string().min(1)).max(5000).optional(),
  confidence: z.record(z.string(), z.number().int().min(1).max(5)),
  profile: LearnerProfile.optional(),
});

const MATCH_WAIT_MS = 8_000;

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError(400, "Expected a JSON body.");
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return jsonError(400, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));

  const full = await getStorage().getKnowledgeMap(id);
  if (!full) return jsonError(404, `No knowledge map for source "${id}"; run intake prep first.`);
  try {
    const km = selectConcepts(full, parsed.data.conceptIds);
    // Never starts the matcher (a whole book is one paid call per concept): the intake's background run is
    // normally done by the time the student reaches this step. Not ready = no ranking yet; "Pick for me"
    // still resolves server-side once the job has the matches.
    const matches = await storedMatches(id, MATCH_WAIT_MS);
    if (!matches) return NextResponse.json({ recommendations: [], pending: true });
    const recommendations = recommendGenres(km, { confidence: parsed.data.confidence, profile: parsed.data.profile }, matches);
    return NextResponse.json({ recommendations, pending: false });
  } catch (err) {
    return jsonError(500, err instanceof Error ? err.message : String(err));
  }
}

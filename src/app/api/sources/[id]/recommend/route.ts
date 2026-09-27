import { NextResponse } from "next/server";
import { z } from "zod";
import { LearnerProfile, selectConcepts } from "../../../../../contracts/knowledge";
import { loadMatches } from "../../../../../pipeline/agents/intake";
import { recommendGenres } from "../../../../../pipeline/personalize";
import { getStorage } from "../../../../../server/storage";

/*
 * POST /api/sources/[id]/recommend: genres ranked for this learner, from the concepts they ticked, their
 * confidence, the clarify step's profile, and the library components the matcher mapped to each concept.
 * Body: { conceptIds?, confidence, profile? } -> { recommendations: GenreRecommendation[] }. The first
 * entry is what "Pick for me" plays (resolveGenre uses the same function). See instructions.md §9.
 */

const Body = z.object({
  conceptIds: z.array(z.string().min(1)).max(5000).optional(),
  confidence: z.record(z.string(), z.number().int().min(1).max(5)),
  profile: LearnerProfile.optional(),
});

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
    const matches = await loadMatches(id, `recommend_${id}`);
    const recommendations = recommendGenres(km, { confidence: parsed.data.confidence, profile: parsed.data.profile }, matches);
    return NextResponse.json({ recommendations });
  } catch (err) {
    return jsonError(500, err instanceof Error ? err.message : String(err));
  }
}

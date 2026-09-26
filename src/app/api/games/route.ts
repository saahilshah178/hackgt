import { NextResponse } from "next/server";
import { z } from "zod";
import { Intake } from "../../../contracts/knowledge";
import { prepareIntake } from "../../../pipeline/agents/intake";
import { startGameJob } from "../../../pipeline/orchestrator";
import { getStorage } from "../../../server/storage";

/*
 * POST /api/games: kicks off S6-S9 as a background job (instructions.md §9). Body: { sourceId,
 * intake, sections? }. Returns 202 { jobId } immediately; the browser watches progress over
 * GET /api/jobs/:id/stream. GET lists every generated game (GameSummary[]).
 */

const Body = z.object({
  sourceId: z.string().min(1),
  intake: Intake,
  sections: z.array(z.string()).optional(),
});

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError(400, "Expected a JSON body.");
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return jsonError(400, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));

  const storage = getStorage();
  const source = await storage.getSource(parsed.data.sourceId);
  if (!source) return jsonError(404, `No source with id "${parsed.data.sourceId}".`);

  // The KnowledgeMap comes from intake prep (GET /api/sources/:id/intake). Rather than 409ing when a
  // client skips straight to POST /api/games, run it now: it's idempotent and cheap in mock mode.
  if (!(await storage.getKnowledgeMap(parsed.data.sourceId))) {
    try {
      await prepareIntake(parsed.data.sourceId);
    } catch (err) {
      return jsonError(500, err instanceof Error ? err.message : String(err));
    }
  }

  try {
    const { jobId } = await startGameJob({ sourceId: parsed.data.sourceId, intake: parsed.data.intake, sections: parsed.data.sections });
    return NextResponse.json({ jobId }, { status: 202 });
  } catch (err) {
    return jsonError(500, err instanceof Error ? err.message : String(err));
  }
}

export async function GET(): Promise<Response> {
  const games = await getStorage().listGames();
  return NextResponse.json(games);
}

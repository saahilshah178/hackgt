import { NextResponse } from "next/server";
import { z } from "zod";
import { Intake } from "../../../contracts/knowledge";
import { GatekeeperRejectedError, loadStoredPreCheck, prepareIntake } from "../../../pipeline/agents/intake";
import { startGameJob } from "../../../pipeline/orchestrator";
import { getStorage } from "../../../server/storage";

/*
 * POST /api/games: kicks off S6-S9 as a background job (instructions.md §9). Body: { sourceId,
 * intake, sections? }. Returns 202 { jobId } immediately; the browser watches progress over
 * GET /api/jobs/:id/stream. GET lists every generated game (GameSummary[]).
 * intake.conceptIds (optional) narrows the job to the concepts the student ticked; the pre-check
 * items are then looked up for that same selection (POST /api/sources/:id/precheck wrote them).
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
      if (err instanceof GatekeeperRejectedError) {
        return NextResponse.json({ error: err.message, step: "gatekeeper" }, { status: 422 });
      }
      return jsonError(500, err instanceof Error ? err.message : String(err));
    }
  }

  // The client sends the whole Intake back, including preCheck.items (with correctIndex) — never
  // trust that: a modified correctIndex would let a student report a perfect pre-check score
  // regardless of what they actually answered. Load the real items from the server's own prep record
  // (or the record written for this selection) when one exists and keep only the client's `answers`;
  // when there's no prep record (a fixture or a test that built an Intake by hand, skipping GET
  // /api/sources/:id/intake), the client's items are all there is, so accept them as before.
  const storedPreCheck = await loadStoredPreCheck(parsed.data.sourceId, parsed.data.intake.conceptIds);
  const intake = storedPreCheck
    ? { ...parsed.data.intake, preCheck: { items: storedPreCheck, answers: parsed.data.intake.preCheck.answers } }
    : parsed.data.intake;

  try {
    const { jobId } = await startGameJob({ sourceId: parsed.data.sourceId, intake, sections: parsed.data.sections });
    return NextResponse.json({ jobId }, { status: 202 });
  } catch (err) {
    return jsonError(500, err instanceof Error ? err.message : String(err));
  }
}

export async function GET(): Promise<Response> {
  const games = await getStorage().listGames();
  return NextResponse.json(games);
}

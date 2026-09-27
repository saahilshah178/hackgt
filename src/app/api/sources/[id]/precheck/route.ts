import { NextResponse } from "next/server";
import { z } from "zod";
import { preparePreCheckForSelection } from "../../../../../pipeline/agents/intake";

/*
 * POST /api/sources/[id]/precheck: three pre-check questions for the concepts the student ticked on
 * the intake page. Body: { conceptIds: string[] }. The whole-map prep items come back for an empty or
 * complete selection; any other selection is written once and cached per selection, and POST
 * /api/games looks the same items up again from intake.conceptIds (never trusting the client's copy).
 * See instructions.md §9.
 */

const Body = z.object({ conceptIds: z.array(z.string().min(1)).max(5000) });

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

  try {
    const result = await preparePreCheckForSelection(id, parsed.data.conceptIds);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /^No (knowledge map|intake prep)/.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

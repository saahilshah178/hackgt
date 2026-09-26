import { NextResponse } from "next/server";
import { prepareIntake } from "../../../../../pipeline/agents/intake";

/*
 * GET /api/sources/[id]/intake: runs S1 gatekeeper -> S2 curriculum (+ quote verification) -> S3
 * pre-check once, caches the result, and starts S4 matcher in the background. See instructions.md §9.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  try {
    const result = await prepareIntake(id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /^No source with id/.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

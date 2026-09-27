import { NextResponse } from "next/server";
import { GatekeeperRejectedError, matcherJob, prepareIntake } from "../../../../../pipeline/agents/intake";
import { keepAlive } from "../../../../../server/keep-alive";

/*
 * GET /api/sources/[id]/intake: runs S1 gatekeeper -> S2 curriculum (+ quote verification) -> S3
 * pre-check once, caches the result, and starts S4 matcher in the background. See instructions.md §9.
 * M6: when the gatekeeper says the material isn't educational or is too small, stop right there with
 * 422 { error, step: "gatekeeper" } (the intake page shows `error`); tooBig keeps going since the
 * outline checklist handles it.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  try {
    const result = await prepareIntake(id);
    // Keep a serverless function alive until the background matcher finishes (see startGameJob).
    const matcher = matcherJob(id);
    if (matcher) keepAlive(matcher);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof GatekeeperRejectedError) {
      return NextResponse.json({ error: err.message, step: "gatekeeper" }, { status: 422 });
    }
    const message = err instanceof Error ? err.message : String(err);
    const status = /^No source with id/.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

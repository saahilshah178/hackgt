import { NextResponse } from "next/server";
import { getStorage } from "../../../../server/storage";

/** GET /api/jobs/[id]: the stored JobRecord. See instructions.md §9. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  const job = await getStorage().getJob(id);
  if (!job) return NextResponse.json({ error: `No job with id "${id}".` }, { status: 404 });
  return NextResponse.json(job);
}

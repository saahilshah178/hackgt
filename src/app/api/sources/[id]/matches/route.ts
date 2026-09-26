import { NextResponse } from "next/server";
import { getStorage } from "../../../../../server/storage";

/**
 * GET /api/sources/[id]/matches: the S4 matcher's output per concept, computed in the background by
 * prepareIntake(). Returns 202 { pending: true } while it's still running. See instructions.md §9.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  const storage = getStorage();
  const source = await storage.getSource(id);
  if (!source) return NextResponse.json({ error: `No source with id "${id}".` }, { status: 404 });
  const matches = await storage.getMatch(id);
  if (matches) return NextResponse.json(matches);
  return NextResponse.json({ pending: true }, { status: 202 });
}

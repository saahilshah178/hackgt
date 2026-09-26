import { NextResponse } from "next/server";
import { getStorage } from "../../../../server/storage";

/** GET /api/games/[id]: the stored GameRecord (spec inside). See instructions.md §9. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  const record = await getStorage().getGame(id);
  if (!record) return NextResponse.json({ error: `No game with id "${id}".` }, { status: 404 });
  return NextResponse.json(record);
}

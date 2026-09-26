import { NextResponse } from "next/server";
import { getStorage } from "../../../../server/storage";

/** GET /api/sources/[id]: the stored SourceRecord plus its page count. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  const storage = getStorage();
  const source = await storage.getSource(id);
  if (!source) return NextResponse.json({ error: `No source with id "${id}".` }, { status: 404 });
  const pages = await storage.getPages(id);
  // instructions.md §9: SourceRecord & { pageCount } — a flat spread, not { source, pageCount }.
  return NextResponse.json({ ...source, pageCount: pages.length });
}

import { NextResponse } from "next/server";
import { LocalDriver } from "../../../../server/storage/local";
import { getStorage } from "../../../../server/storage";

/*
 * GET /api/blobs/<path...>: streams a blob written by LocalDriver.putBlob (PDFs, generated audio).
 * Only meaningful for the local driver: SupabaseDriver serves its buckets directly via blobUrl().
 */

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await context.params;
  const joined = path.join("/");
  const storage = getStorage();
  if (!(storage instanceof LocalDriver)) {
    return NextResponse.json({ error: "Blob streaming is only available with STORAGE_DRIVER=local." }, { status: 404 });
  }
  const bytes = await storage.getBlob(joined);
  if (!bytes) return NextResponse.json({ error: `No blob at "${joined}".` }, { status: 404 });
  const ext = joined.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
  return new Response(new Uint8Array(bytes), { headers: { "content-type": contentType, "cache-control": "public, max-age=31536000, immutable" } });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import type { SourceRecord } from "../../../contracts/storage";
import { countPages, extractPages, splitTextIntoPages } from "../../../server/ingest";
import { newId } from "../../../server/ids";
import { getStorage } from "../../../server/storage";

/*
 * POST /api/sources: the app's one upload endpoint (S0 Ingest). Accepts:
 *   - multipart/form-data with a "file" field (PDF, <= 40 pages)
 *   - application/json { text, title? }
 *   - application/json { topic }
 * Extracts per-page text (unpdf for PDFs, a ~1800-char splitter for pasted text; a topic has no
 * pages at all), stores the SourceRecord + pages (+ the PDF blob) through getStorage(), and returns
 * { sourceId, kind, title, pageCount }.
 */

export const MAX_PDF_PAGES = 40;

const TextBody = z.object({ text: z.string().min(1), title: z.string().min(1).nullable().optional() });
const TopicBody = z.object({ topic: z.string().min(1) });

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return jsonError(400, "Could not parse multipart form data.");
    }
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError(400, 'Expected a "file" field with a PDF upload.');
    if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return jsonError(400, "Only PDF uploads are supported.");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    // unpdf/pdf.js transfers (detaches) the buffer it's given, so each call needs its own copy.
    let pageCount: number;
    try {
      pageCount = await countPages(bytes.slice());
    } catch {
      return jsonError(400, "Could not read that file as a PDF.");
    }
    if (pageCount > MAX_PDF_PAGES) {
      return jsonError(413, `That PDF has ${pageCount} pages; the limit is ${MAX_PDF_PAGES}. Try a shorter excerpt.`);
    }

    const id = newId("src");
    const pages = await extractPages(bytes.slice(), id);
    const title = file.name.replace(/\.pdf$/i, "") || "Untitled upload";
    const blobPath = `sources/${id}.pdf`;

    const storage = getStorage();
    await storage.putBlob(blobPath, bytes, "application/pdf");
    await storage.putPages(id, pages);
    const record: SourceRecord = {
      id,
      kind: "pdf",
      title,
      filename: file.name,
      pageCount,
      byteLength: bytes.byteLength,
      createdAt: new Date().toISOString(),
      blobPath,
      topic: null,
    };
    await storage.putSource(record);
    return NextResponse.json({ sourceId: id, kind: record.kind, title: record.title, pageCount });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Expected multipart/form-data or a JSON body.");
  }

  const asTopic = TopicBody.safeParse(body);
  if (asTopic.success) {
    const id = newId("src");
    const storage = getStorage();
    await storage.putPages(id, []);
    const record: SourceRecord = {
      id,
      kind: "topic",
      title: asTopic.data.topic,
      filename: null,
      pageCount: 0,
      byteLength: 0,
      createdAt: new Date().toISOString(),
      blobPath: null,
      topic: asTopic.data.topic,
    };
    await storage.putSource(record);
    return NextResponse.json({ sourceId: id, kind: record.kind, title: record.title, pageCount: 0 });
  }

  const asText = TextBody.safeParse(body);
  if (asText.success) {
    const id = newId("src");
    const pages = splitTextIntoPages(id, asText.data.text);
    const storage = getStorage();
    await storage.putPages(id, pages);
    const title = asText.data.title ?? (asText.data.text.slice(0, 60).trim() || "Pasted notes");
    const record: SourceRecord = {
      id,
      kind: "text",
      title,
      filename: null,
      pageCount: pages.length,
      byteLength: Buffer.byteLength(asText.data.text, "utf8"),
      createdAt: new Date().toISOString(),
      blobPath: null,
      topic: null,
    };
    await storage.putSource(record);
    return NextResponse.json({ sourceId: id, kind: record.kind, title: record.title, pageCount: pages.length });
  }

  return jsonError(400, 'Expected { text, title? } or { topic } (or multipart/form-data with a "file" field).');
}

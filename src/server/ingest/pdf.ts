import { extractText, getDocumentProxy } from "unpdf";
import type { PageRecord } from "../../contracts/storage";

/**
 * Note: pdf.js detaches (transfers) the ArrayBuffer backing whatever Uint8Array it's given, so
 * calling extractPages/countPages twice on the SAME bytes fails on the second call. Callers that
 * need both (e.g. counting pages before extracting) must pass a fresh copy to each, e.g. `bytes.slice()`.
 */

/** Below this many characters, a page is flagged low-text (likely scanned; a vision pass could fill it in). */
export const LOW_TEXT_THRESHOLD = 40;

/** Per-page text extraction for an uploaded PDF (S0 Ingest). */
export async function extractPages(data: Uint8Array, sourceId: string): Promise<PageRecord[]> {
  const doc = await getDocumentProxy(data);
  const { text } = await extractText(doc, { mergePages: false });
  return text.map((pageText, i) => ({
    sourceId,
    page: i + 1,
    text: pageText,
    lowText: pageText.trim().length < LOW_TEXT_THRESHOLD,
  }));
}

/** Total page count without extracting text; used to reject uploads over the 40-page cap early. */
export async function countPages(data: Uint8Array): Promise<number> {
  const doc = await getDocumentProxy(data);
  return doc.numPages;
}

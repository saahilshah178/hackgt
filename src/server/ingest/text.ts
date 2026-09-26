import type { PageRecord } from "../../contracts/storage";

/** Target page length for pasted text uploads (no natural page breaks to follow). */
export const TEXT_PAGE_SIZE = 1800;

/**
 * Splits pasted text into ~TEXT_PAGE_SIZE-character "pages", breaking on paragraph or sentence
 * boundaries where possible so a quote is unlikely to be cut in half.
 */
export function splitTextIntoPages(sourceId: string, text: string, pageSize = TEXT_PAGE_SIZE): PageRecord[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];

  const pages: string[] = [];
  let rest = trimmed;
  while (rest.length > pageSize) {
    const window = rest.slice(0, pageSize);
    const breakAt = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf(". "), window.lastIndexOf("\n"));
    const cut = breakAt > pageSize * 0.5 ? breakAt + 1 : pageSize;
    pages.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest.length > 0) pages.push(rest);

  return pages.map((pageText, i) => ({ sourceId, page: i + 1, text: pageText, lowText: pageText.length < 40 }));
}

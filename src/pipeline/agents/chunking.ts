import type { OutlineEntry } from "../../contracts/knowledge";
import type { CurriculumSlice } from "../../contracts/slices";
import type { PageRecord } from "../../contracts/storage";

/*
 * Long-document support for the front half (S1 gatekeeper, S2 curriculum). There is no page cap on
 * uploads any more, so a whole textbook can come in. Three pure helpers keep the agent prompts bounded:
 *
 *   digestPages()  -> what the Gatekeeper reads: the first few pages complete, then only the opening
 *                     of every later page (headings live there), within a character budget.
 *   chunkPages()   -> how the Curriculum agent reads: section-aligned parts (from the gatekeeper's
 *                     outline when it has one, else fixed windows), each small enough for one call.
 *   mergeCurriculumSlices() -> one CurriculumSlice from the per-part replies, with unit/concept ids
 *                     kept unique across parts and cross-references remapped.
 *
 * Short material (the three sample PDFs, a pasted chapter) is untouched: under the budget, digestPages
 * returns the pages as-is and chunkPages returns a single part, so mock fixtures and prompts are
 * byte-identical to before.
 */

export interface PageView {
  page: number;
  text: string;
}

export interface DigestOptions {
  /** Total characters the gatekeeper prompt may carry before later pages get digested. */
  charBudget?: number;
  /** How many leading pages stay complete (the "is this educational?" call mostly needs these). */
  fullPages?: number;
  /** Cap on a complete page's characters. */
  maxFullPageChars?: number;
  /** Preferred head length per digested page (shrinks when the budget is tight). */
  perPageChars?: number;
}

export interface DigestResult {
  pages: PageView[];
  /** true when later pages were cut down to their openings */
  digested: boolean;
  /** how many leading pages are complete (only meaningful when digested) */
  fullPages: number;
  /** characters kept per digested page (only meaningful when digested) */
  perPageChars: number;
  totalChars: number;
}

export const DIGEST_DEFAULTS: Required<DigestOptions> = { charBudget: 120_000, fullPages: 3, maxFullPageChars: 6_000, perPageChars: 320 };

/** Cuts `text` to at most `max` characters, preferring a whitespace boundary, with an ellipsis when cut. */
function head(text: string, max: number): string {
  const t = text.trim().replace(/[ \t]+/g, " ");
  if (t.length <= max) return t;
  const window = t.slice(0, max);
  const at = window.lastIndexOf(" ");
  return `${(at > max * 0.6 ? window.slice(0, at) : window).trimEnd()} ...`;
}

export function digestPages(pages: readonly PageView[], o: DigestOptions = {}): DigestResult {
  const opt = { ...DIGEST_DEFAULTS, ...o };
  const sorted = [...pages].sort((a, b) => a.page - b.page);
  const totalChars = sorted.reduce((n, p) => n + p.text.length, 0);
  if (totalChars <= opt.charBudget) {
    return { pages: sorted.map((p) => ({ page: p.page, text: p.text })), digested: false, fullPages: sorted.length, perPageChars: 0, totalChars };
  }

  const full = sorted.slice(0, opt.fullPages).map((p) => ({ page: p.page, text: head(p.text, opt.maxFullPageChars) }));
  const rest = sorted.slice(opt.fullPages);
  const spent = full.reduce((n, p) => n + p.text.length, 0);
  const perPage = rest.length === 0 ? 0 : Math.max(60, Math.min(opt.perPageChars, Math.floor((opt.charBudget - spent) / rest.length)));
  const digested = rest.map((p) => ({ page: p.page, text: p.text.trim().length === 0 ? "(no text on this page)" : head(p.text, perPage) }));
  return { pages: [...full, ...digested], digested: true, fullPages: full.length, perPageChars: perPage, totalChars };
}

// ---------------------------------------------------------------- chunking for the curriculum agent

export interface PageChunk {
  /** 0-based position in the document */
  index: number;
  /** the outline title this part starts at, or null for an untitled window */
  title: string | null;
  pageStart: number;
  pageEnd: number;
  pages: PageRecord[];
  chars: number;
}

export interface ChunkOptions {
  /** most characters one curriculum call reads */
  maxChars?: number;
  /** most pages one curriculum call reads */
  maxPages?: number;
  /** parts smaller than this are folded into a neighbor */
  minChars?: number;
}

/*
 * A part is about one chapter's worth: 40k characters (roughly 10k tokens, what the original single-call
 * design read for a <= 40-page chapter). The first live run on a real textbook showed that 6-page parts
 * each produce 4-5 units, so a whole book turned into hundreds of slivers; minChars folds the gatekeeper's
 * fine-grained section cuts back up toward that chapter size.
 */
export const CHUNK_DEFAULTS: Required<ChunkOptions> = { maxChars: 40_000, maxPages: 40, minChars: 25_000 };

interface Segment {
  title: string | null;
  pages: PageRecord[];
}

const charsOf = (pages: readonly PageRecord[]) => pages.reduce((n, p) => n + p.text.length, 0);

/** Splits one segment into windows that respect both limits (a single oversized page stays alone). */
function windows(seg: Segment, opt: Required<ChunkOptions>): Segment[] {
  if (seg.pages.length <= opt.maxPages && charsOf(seg.pages) <= opt.maxChars) return [seg];
  const out: Segment[] = [];
  let cur: PageRecord[] = [];
  for (const p of seg.pages) {
    const fits = cur.length < opt.maxPages && charsOf(cur) + p.text.length <= opt.maxChars;
    if (cur.length > 0 && !fits) {
      out.push({ title: seg.title, pages: cur });
      cur = [];
    }
    cur.push(p);
  }
  if (cur.length > 0) out.push({ title: seg.title, pages: cur });
  return out.map((w, i) => (out.length > 1 && w.title ? { ...w, title: `${w.title} (part ${i + 1})` } : w));
}

/**
 * Cuts the pages into parts for the curriculum agent. With an outline, each distinct pageStart is a
 * cut (pages before the first cut form an untitled lead-in); without one, fixed windows. Every part
 * then respects maxPages/maxChars, and parts under minChars are folded into a neighbor.
 */
export function chunkPages(pages: readonly PageRecord[], outline: readonly OutlineEntry[] = [], o: ChunkOptions = {}): PageChunk[] {
  const opt = { ...CHUNK_DEFAULTS, ...o };
  const sorted = [...pages].sort((a, b) => a.page - b.page);
  if (sorted.length === 0) return [];
  const finish = (segs: Segment[]): PageChunk[] =>
    segs.map((s, index) => ({
      index,
      title: s.title,
      pageStart: s.pages[0].page,
      pageEnd: s.pages[s.pages.length - 1].page,
      pages: s.pages,
      chars: charsOf(s.pages),
    }));

  if (sorted.length <= opt.maxPages && charsOf(sorted) <= opt.maxChars) return finish([{ title: null, pages: sorted }]);

  // 1. section-aligned segments from the outline's start pages
  const first = sorted[0].page;
  const last = sorted[sorted.length - 1].page;
  const titleAt = new Map<number, string>();
  for (const e of [...outline].sort((a, b) => a.pageStart - b.pageStart)) {
    if (e.pageStart >= first && e.pageStart <= last && !titleAt.has(e.pageStart)) titleAt.set(e.pageStart, e.title);
  }
  let segments: Segment[] = [];
  let cur: Segment = { title: null, pages: [] };
  for (const p of sorted) {
    if (titleAt.has(p.page) && cur.pages.length > 0) {
      segments.push(cur);
      cur = { title: null, pages: [] };
    }
    if (titleAt.has(p.page) && cur.pages.length === 0) cur.title = titleAt.get(p.page) ?? null;
    cur.pages.push(p);
  }
  if (cur.pages.length > 0) segments.push(cur);

  // 2. size limits per part
  segments = segments.flatMap((s) => windows(s, opt));

  // 3. fold tiny parts into a neighbor when the merged part still fits
  const fits = (a: Segment, b: Segment) => a.pages.length + b.pages.length <= opt.maxPages && charsOf(a.pages) + charsOf(b.pages) <= opt.maxChars;
  const folded: Segment[] = [];
  for (const s of segments) {
    const prev = folded[folded.length - 1];
    if (prev && (charsOf(s.pages) < opt.minChars || charsOf(prev.pages) < opt.minChars) && fits(prev, s)) {
      folded[folded.length - 1] = { title: prev.title ?? s.title, pages: [...prev.pages, ...s.pages] };
    } else {
      folded.push(s);
    }
  }
  return finish(folded);
}

// ---------------------------------------------------------------- merging per-part curricula

const SNAKE_MAX = 48;

function uniqueId(base: string, taken: { has(id: string): boolean }): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `_${n}`;
    const id = `${base.slice(0, SNAKE_MAX - suffix.length)}${suffix}`;
    if (!taken.has(id)) return id;
  }
}

function mostCommon<T>(values: readonly T[], fallback: T): T {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | undefined;
  let bestN = 0;
  for (const [v, n] of counts) {
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best ?? fallback;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export interface CurriculumPart {
  chunk: Pick<PageChunk, "index" | "title" | "pageStart" | "pageEnd">;
  slice: CurriculumSlice;
}

/**
 * One CurriculumSlice from several per-part replies. Ids stay unique across parts: a unit or concept
 * whose id AND name already exist is treated as the same thing (units are reused, duplicate concepts
 * dropped); a colliding id with a different name is renamed with a numeric suffix. unitId and
 * prerequisite references inside each part follow the renames; a prerequisite that points outside
 * the merged map is dropped. `title` is the source's own title (a whole book, not one part's).
 */
export function mergeCurriculumSlices(parts: readonly CurriculumPart[], title: string): CurriculumSlice {
  if (parts.length === 1) return parts[0].slice;
  const ordered = [...parts].sort((a, b) => a.chunk.index - b.chunk.index);
  const slices = ordered.map((p) => p.slice);

  const units: CurriculumSlice["units"] = [];
  const unitById = new Map<string, CurriculumSlice["units"][number]>();
  const concepts: CurriculumSlice["concepts"] = [];
  const conceptById = new Map<string, CurriculumSlice["concepts"][number]>();

  for (const slice of slices) {
    const unitMap = new Map<string, string>();
    for (const u of slice.units) {
      const existing = unitById.get(u.id);
      if (!existing) {
        units.push({ id: u.id, name: u.name });
        unitById.set(u.id, { id: u.id, name: u.name });
        unitMap.set(u.id, u.id);
      } else if (sameName(existing.name, u.name)) {
        unitMap.set(u.id, existing.id);
      } else {
        const id = uniqueId(u.id, unitById);
        units.push({ id, name: u.name });
        unitById.set(id, { id, name: u.name });
        unitMap.set(u.id, id);
      }
    }

    const conceptMap = new Map<string, string>();
    const added: CurriculumSlice["concepts"] = [];
    for (const c of slice.concepts) {
      const unitId = unitMap.get(c.unitId) ?? c.unitId;
      const existing = conceptById.get(c.id);
      if (!existing) {
        const copy = { ...c, unitId };
        concepts.push(copy);
        conceptById.set(c.id, copy);
        conceptMap.set(c.id, c.id);
        added.push(copy);
      } else if (sameName(existing.name, c.name)) {
        conceptMap.set(c.id, existing.id); // duplicate of something an earlier part already produced
      } else {
        const id = uniqueId(c.id, conceptById);
        const copy = { ...c, id, unitId };
        concepts.push(copy);
        conceptById.set(id, copy);
        conceptMap.set(c.id, id);
        added.push(copy);
      }
    }
    for (const c of added) {
      const seen = new Set<string>();
      c.prerequisites = c.prerequisites
        .map((p) => conceptMap.get(p) ?? p)
        .filter((p) => {
          if (p === c.id || !conceptById.has(p) || seen.has(p)) return false;
          seen.add(p);
          return true;
        });
    }
  }

  const used = new Set(concepts.map((c) => c.unitId));
  const outlineSeen = new Set<string>();
  const outline = slices
    .flatMap((s) => s.outline)
    .sort((a, b) => a.pageStart - b.pageStart || a.pageEnd - b.pageEnd)
    .filter((o) => {
      const key = `${o.pageStart}:${o.title.trim().toLowerCase()}`;
      if (outlineSeen.has(key)) return false;
      outlineSeen.add(key);
      return true;
    });

  return {
    title: title.trim().slice(0, 80) || slices[0].title,
    domain: mostCommon(
      slices.map((s) => s.domain),
      slices[0].domain,
    ),
    topic: slices[0].topic,
    level: mostCommon(
      slices.map((s) => s.level),
      slices[0].level,
    ),
    outline,
    units: units.filter((u) => used.has(u.id)),
    concepts,
  };
}

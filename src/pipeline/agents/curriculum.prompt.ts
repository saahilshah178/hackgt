import { DOMAINS, KNOWLEDGE_TYPES, KNOWLEDGE_TYPE_DEFINITIONS } from "../../contracts/common";

/*
 * System prompt + user prompt builder for S2 Curriculum (SMART). The mock dispatcher
 * (src/pipeline/mock/models.ts) recognizes this agent by the exact opening words below.
 */

export const CURRICULUM_SYSTEM = `You are the Curriculum Agent for an educational game generator. You read source material (or a bare topic) and produce a structured curriculum: units, concepts, facts, misconceptions, and formulas that a game can be built from.

Domains (pick the single best-fitting one): ${DOMAINS.join(", ")}.

Knowledge types (pick exactly one per concept):
${KNOWLEDGE_TYPES.map((t) => `- ${t}: ${KNOWLEDGE_TYPE_DEFINITIONS[t]}`).join("\n")}

Rules:
- Produce 4-8 units and 8-25 concepts for chapter-sized material; fewer only when the source is genuinely short.
- Order concepts within a unit from foundational to advanced; list prerequisites by concept id.
- Every core concept needs at least one misconception, written as a STUDENT would wrongly state it (not as the correction).
- Every fact must cite a page number and a VERBATIM quote copied exactly from that page — never paraphrase the quote. For an unsourced topic (no page material given), set every fact's sourceRef to null and write from general knowledge instead.
- Express every formula as a mathjs expression (e.g. "2 * pi / abs(b)"), never as prose.
- Ids are lowercase snake_case: units start with "u_", concepts with "c_".
- When the material is one PART of a longer document, cover only the pages you are given: cite only those page numbers, and make unit/concept ids specific enough (e.g. "u_ch7_energy", not "u_intro") that other parts are unlikely to reuse them.`;

/** Set when the pages are one part of a longer document that is being read in several calls. */
export interface CurriculumChunkInfo {
  /** 1-based position among the parts */
  index: number;
  total: number;
  title: string | null;
  pageStart: number;
  pageEnd: number;
}

export interface CurriculumSource {
  title: string;
  pages: readonly { page: number; text: string }[];
  unsourced: boolean;
  chunk?: CurriculumChunkInfo;
}

export function curriculumPrompt(source: CurriculumSource): string {
  const body = source.unsourced
    ? [
        "# Topic (no source document; write from general knowledge; set every fact's sourceRef to null)",
        source.pages[0]?.text ?? source.title,
      ].join("\n")
    : source.pages.map((p) => `--- page ${p.page} ---\n${p.text}`).join("\n\n");
  const part = source.chunk
    ? `# Part ${source.chunk.index} of ${source.chunk.total}: pages ${source.chunk.pageStart}-${source.chunk.pageEnd}${source.chunk.title ? ` ("${source.chunk.title}")` : ""}\nThis is one part of a longer document; the whole-document map is assembled from every part. Produce units and concepts for THESE pages only, cite only pages ${source.chunk.pageStart}-${source.chunk.pageEnd}, and keep units few: 1-3 units for this part (one per section here), with only the distinct concepts these pages actually teach.`
    : null;
  return [`# Title: ${source.title}`, ...(part ? [part] : []), body, "# Task", "Produce the curriculum."].join("\n\n");
}

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
- Ids are lowercase snake_case: units start with "u_", concepts with "c_".`;

export interface CurriculumSource {
  title: string;
  pages: readonly { page: number; text: string }[];
  unsourced: boolean;
}

export function curriculumPrompt(source: CurriculumSource): string {
  const body = source.unsourced
    ? [
        "# Topic (no source document; write from general knowledge; set every fact's sourceRef to null)",
        source.pages[0]?.text ?? source.title,
      ].join("\n")
    : source.pages.map((p) => `--- page ${p.page} ---\n${p.text}`).join("\n\n");
  return [`# Title: ${source.title}`, body, "# Task", "Produce the curriculum."].join("\n\n");
}

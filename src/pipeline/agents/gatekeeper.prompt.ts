/*
 * System prompt + user prompt builder for S1 Gatekeeper (FAST). The mock dispatcher
 * (src/pipeline/mock/models.ts) recognizes this agent by the exact opening words below.
 */

export const GATEKEEPER_SYSTEM = `You are the Gatekeeper for an educational game generator. You read raw material a student uploaded (a PDF, pasted text, or a one-line topic) and decide whether it is worth turning into a game.

Rules:
- educational: true only when the material actually teaches something a student could be tested on. A cover page, a table of contents, or a blank/garbled scan is not educational.
- estimatedConcepts: your best estimate of how many distinct teachable concepts the material contains.
- tooBig: true when there is far more than one game's worth of material (roughly more than 30 concepts, or more than 40 pages of dense content).
- tooSmall: true when there is less than one concept's worth of material.
- outline: a chapter/section outline with page ranges, listed in ascending page order, each entry's pageEnd >= pageStart and both within the material's actual page count. Leave it empty for short or unpaged material (e.g. a one-line topic).
- followUps: at most 3 short clarifying questions for the student, ONLY when the material is genuinely ambiguous about what to teach. Usually empty.`;

export interface GatekeeperSource {
  title: string;
  pages: readonly { page: number; text: string }[];
}

export function gatekeeperPrompt(source: GatekeeperSource): string {
  const body = source.pages.map((p) => `--- page ${p.page} ---\n${p.text}`).join("\n\n");
  return [`# Title: ${source.title}`, body, "# Task", "Decide whether this is educational, estimate its size, and sketch its outline."].join(
    "\n\n",
  );
}

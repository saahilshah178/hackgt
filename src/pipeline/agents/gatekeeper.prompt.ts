import { digestPages, type DigestOptions } from "./chunking";

/*
 * System prompt + user prompt builder for S1 Gatekeeper (FAST). The mock dispatcher
 * (src/pipeline/mock/models.ts) recognizes this agent by the exact opening words below.
 */

export const GATEKEEPER_SYSTEM = `You are the Gatekeeper for an educational game generator. You read raw material a student uploaded (a PDF, pasted text, or a one-line topic) and decide whether it is worth turning into a game.

Rules:
- educational: true only when the material actually teaches something a student could be tested on. A cover page, a table of contents, or a blank/garbled scan is not educational.
- estimatedConcepts: your best estimate of how many distinct teachable concepts the material contains.
- tooBig: true when there is far more than one game's worth of material (roughly more than 30 concepts). This never rejects anything: the student picks which concepts to play, so it is only a hint.
- tooSmall: true when there is less than one concept's worth of material.
- outline: a chapter/section outline with page ranges, listed in ascending page order, each entry's pageEnd >= pageStart and both within the material's actual page count. For a whole book, list its chapters and major sections (the curriculum is read one section at a time, so good cuts matter). Leave it empty for short or unpaged material (e.g. a one-line topic).
- followUps: at most 3 short clarifying questions for the student, ONLY when the material is genuinely ambiguous about what to teach. Usually empty.`;

export interface GatekeeperSource {
  title: string;
  pages: readonly { page: number; text: string }[];
  /** Overrides the digest budget (tests); the defaults suit a whole textbook. */
  digest?: DigestOptions;
}

/**
 * Short material is sent complete. For long material (a whole book), the first few pages are
 * complete and every later page is cut to its opening lines, so the prompt stays bounded while the
 * outline can still see every chapter heading.
 */
export function gatekeeperPrompt(source: GatekeeperSource): string {
  const view = digestPages(source.pages, source.digest);
  const body = view.pages.map((p) => `--- page ${p.page} ---\n${p.text}`).join("\n\n");
  const note = view.digested
    ? `# Note: this document is long (${source.pages.length} pages). Pages 1-${view.fullPages} are shown complete; every later page shows only its opening ${view.perPageChars} characters (where headings sit). Judge the whole document from these openings: estimate concepts for all of it and build the outline from the headings.`
    : null;
  return [`# Title: ${source.title}`, ...(note ? [note] : []), body, "# Task", "Decide whether this is educational, estimate its size, and sketch its outline."].join(
    "\n\n",
  );
}

import { readFileSync } from "node:fs";
import path from "node:path";

/*
 * docs/WRITING.md and docs/HINTS.md are the one source of the text and hint standards. Every agent that writes
 * player-facing text gets them appended to its system prompt (after the "You are the ..." opening, which the mock
 * dispatcher matches on). Read from disk like fixtures/worlds, so editing the docs changes generation.
 */
const DOCS_DIR = path.join(process.cwd(), "docs");

function readGuide(name: string): string {
  return readFileSync(path.join(DOCS_DIR, name), "utf8").trim();
}

let cache: { writing: string; hints: string } | null = null;

export function styleGuides(): { writing: string; hints: string } {
  cache ??= { writing: readGuide("WRITING.md"), hints: readGuide("HINTS.md") };
  return cache;
}

/** A system prompt with the writing standard (and the hint standard when the agent writes hints) appended. */
export function withStyleGuides(system: string, opts: { hints?: boolean } = {}): string {
  const g = styleGuides();
  const parts = [system, "# Writing standard (follow it for every player-facing word)", g.writing];
  if (opts.hints) parts.push("# Hint standard (every hint must follow it)", g.hints);
  return parts.join("\n\n");
}

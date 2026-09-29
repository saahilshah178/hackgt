/*
 * Registry of recorded fixture responses that the mock model (mock/models.ts) serves instead of
 * calling a real LLM. One "sample" per source document (trig, cell transport, civil rights); an
 * unrecognized upload in mock mode maps to "trig" (MEGAPROMPT §8).
 */

export interface MockSampleResponses {
  /** The fixture KnowledgeMap the canned replies were written against (lets the mock adapt to the live job). */
  km?: import("../../contracts/knowledge").KnowledgeMap;
  gatekeeper?: unknown;
  curriculum?: unknown;
  matcher?: unknown;
  precheck?: unknown;
  director?: unknown;
  narrative?: unknown;
  assessment?: unknown;
  blindSolver?: unknown;
  /** Challenge Writer replies, keyed by ENCOUNTER_ID (the Director assigns these ids). */
  challenges?: Record<string, unknown>;
  /** A recorded matcher shortlist (per concept): mock mode uses it instead of the retrieval scorer's top 3. */
  matches?: import("../../contracts/match").MatchResult[];
  /** A recorded 3D world for world3d games (docs/design/60): used in mock mode when it covers every encounter. */
  world3d?: import("../../contracts/world3d").World3D;
}

const registry = new Map<string, MockSampleResponses>();

export function registerMockSample(sampleId: string, responses: MockSampleResponses): void {
  registry.set(sampleId, responses);
}

export function getMockSample(sampleId: string): MockSampleResponses | undefined {
  return registry.get(sampleId);
}

export function listMockSamples(): string[] {
  return [...registry.keys()];
}

export interface ResolveHint {
  sourceId?: string;
  title?: string;
  text?: string;
}

/** Keyword -> sample id. First sample whose keyword list matches the hint wins; default is "trig". */
const KEYWORDS: Record<string, string[]> = {
  trig: ["trig", "trigonometric", "sine", "cosine", "radian", "amplitude"],
  cell: ["cell transport", "osmosis", "diffusion", "membrane", "endocytosis", "exocytosis"],
  civil_rights: ["civil rights", "montgomery", "voting rights act", "brown v. board", "selma", "freedom rides"],
  egypt: ["ancient egypt", "old kingdom", "pharaoh", "hieroglyphs", "mummification", "great pyramid", "khufu", "giza"],
};

/**
 * Word-boundary substring match: a plain `includes()` would let a short keyword like "sine" match
 * inside an unrelated word (e.g. DOMAINS includes "business", which contains "sine"), which matters
 * once every agent's system prompt embeds shared lists like the Domain enum.
 */
function containsKeyword(haystack: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(haystack);
}

/**
 * Matches a job's source against the registry by keyword; unknown input falls back to "trig".
 * `matched` is false exactly when nothing in the hint matched any registered sample's keywords, i.e.
 * the caller is about to be served a fixture (trig) that has nothing to do with its actual content —
 * useful for callers that need to treat that fixture's page-bound details as advisory (see
 * prepareIntake's mock-mode handling of short/topic uploads).
 */
export function resolveMockSampleDetailed(hint: ResolveHint): { sampleId: string; matched: boolean } {
  const haystack = [hint.sourceId, hint.title, hint.text].filter(Boolean).join(" ").toLowerCase();
  for (const [sampleId, words] of Object.entries(KEYWORDS)) {
    if (registry.has(sampleId) && words.some((w) => containsKeyword(haystack, w))) return { sampleId, matched: true };
  }
  return { sampleId: "trig", matched: false };
}

export function resolveMockSample(hint: ResolveHint): string {
  return resolveMockSampleDetailed(hint).sampleId;
}

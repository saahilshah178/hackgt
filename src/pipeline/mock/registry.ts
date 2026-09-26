/*
 * Registry of recorded fixture responses that the mock model (mock/models.ts) serves instead of
 * calling a real LLM. One "sample" per source document (trig, cell transport, civil rights); an
 * unrecognized upload in mock mode maps to "trig" (MEGAPROMPT §8).
 */

export interface MockSampleResponses {
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
};

/** Matches a job's source against the registry by keyword; unknown input falls back to "trig". */
export function resolveMockSample(hint: ResolveHint): string {
  const haystack = [hint.sourceId, hint.title, hint.text].filter(Boolean).join(" ").toLowerCase();
  for (const [sampleId, words] of Object.entries(KEYWORDS)) {
    if (registry.has(sampleId) && words.some((w) => haystack.includes(w))) return sampleId;
  }
  return "trig";
}

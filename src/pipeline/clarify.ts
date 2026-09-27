import { conceptWeight, type Intake, type KnowledgeMap, type LearnerProfile } from "../contracts/knowledge";

/*
 * The intake's clarify step ("what trips you up?"). Pure and client-safe: it imports only contracts, so
 * the intake page builds the probes itself from the knowledge map it already holds. No model call.
 *
 * A probe shows a few statements about one concept, mixing its listed misconception beliefs with one
 * true statement, and asks which sound true. Ticking a belief is a sharper signal than asking the
 * student to diagnose themselves; ticking nothing or the true one says the concept is fine.
 */

export interface ProbeStatement {
  /** stable within the probe: "b0", "b1", … for beliefs, "t" for the true statement */
  id: string;
  text: string;
  isBelief: boolean;
}

export interface ClarifyProbe {
  conceptId: string;
  conceptName: string;
  statements: ProbeStatement[];
}

export interface ProbeAnswer {
  /** statement ids the student ticked as "sounds true" */
  ticked: string[];
  unsure: boolean;
}

/** Enough to keep the step near a minute. */
export const MAX_PROBES = 5;
const MAX_BELIEFS_PER_PROBE = 2;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Deterministic order per concept, so the page never reshuffles on a re-render. */
function seededOrder<T>(items: readonly T[], seed: string): T[] {
  return items
    .map((item, i) => ({ item, k: hash(`${seed}:${i}`) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.item);
}

/**
 * Probes for the selected concepts that have misconceptions to test, highest Director weight first
 * (core and low-confidence concepts), map order breaking ties. `conceptIds` empty or absent = the whole map.
 */
export function clarifyProbes(
  km: KnowledgeMap,
  intake: Pick<Intake, "confidence">,
  conceptIds?: readonly string[],
  max = MAX_PROBES,
): ClarifyProbe[] {
  const keep = conceptIds && conceptIds.length > 0 ? new Set(conceptIds) : null;
  const candidates = km.concepts
    .map((c, order) => ({ c, order, w: conceptWeight(c, intake) }))
    .filter(({ c }) => (!keep || keep.has(c.id)) && c.misconceptions.length > 0)
    .sort((a, b) => b.w - a.w || a.order - b.order)
    .slice(0, max);
  return candidates.map(({ c }) => {
    const beliefs = c.misconceptions.slice(0, MAX_BELIEFS_PER_PROBE).map((m, i) => ({ id: `b${i}`, text: m.belief, isBelief: true }));
    const truth = c.facts[0]?.statement ?? c.misconceptions[0].correction;
    return { conceptId: c.id, conceptName: c.name, statements: seededOrder([...beliefs, { id: "t", text: truth, isBelief: false }], c.id) };
  });
}

function cleanInterests(interests: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of interests) {
    const v = raw.trim().replace(/\s+/g, " ").slice(0, 40);
    if (v && !out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v);
  }
  return out.slice(0, 6);
}

/** Folds the clarify step's answers into a LearnerProfile (only flagged concepts become struggles). */
export function profileFromAnswers(
  probes: readonly ClarifyProbe[],
  answers: Readonly<Record<string, ProbeAnswer | undefined>>,
  rest: { interests: readonly string[]; purpose: LearnerProfile["purpose"]; note: string },
): LearnerProfile {
  const struggles: LearnerProfile["struggles"] = [];
  for (const p of probes) {
    const a = answers[p.conceptId];
    if (!a) continue;
    const beliefs = p.statements.filter((s) => s.isBelief && a.ticked.includes(s.id)).map((s) => s.text);
    if (beliefs.length > 0 || a.unsure) struggles.push({ conceptId: p.conceptId, beliefs, unsure: a.unsure });
  }
  return { struggles, interests: cleanInterests(rest.interests), purpose: rest.purpose, note: rest.note.trim().slice(0, 400) };
}

/** True when the profile says nothing at all (the student skipped every question). */
export function isEmptyProfile(p: LearnerProfile | undefined): boolean {
  return !p || (p.struggles.length === 0 && p.interests.length === 0 && p.purpose === null && p.note === "");
}

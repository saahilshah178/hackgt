import type { KnowledgeMap, Mcq } from "../../contracts/knowledge";
import type { GatekeeperSlice } from "../../contracts/slices";
import type { PageRecord, SourceRecord } from "../../contracts/storage";
import { hashString, seededShuffle } from "../../mechanics/util";
import { isMockLLM } from "../../server/env";
import { verifyKnowledgeMapQuotes, type DroppedFact } from "../../server/ingest";
import { getStorage } from "../../server/storage";
import { emit } from "../events";
import { curriculumToKnowledgeMap, runCurriculum } from "./curriculum";
import { runGatekeeper } from "./gatekeeper";
import { runMatcher } from "./matcher";
import { runPrecheck } from "./precheck";

/*
 * prepareIntake(sourceId): the whole front half (S1 gatekeeper -> S2 curriculum + quote
 * verification -> S3 pre-check), then kicks off S4 matcher in the background. Idempotent: a second
 * call returns the previously stored result instead of re-running the agents. See instructions.md §9
 * (GET /api/sources/:id/intake) and MEGAPROMPT §3/§4.
 */

export interface IntakeResult {
  source: { id: string; kind: SourceRecord["kind"]; title: string; pageCount: number };
  gatekeeper: GatekeeperSlice;
  knowledgeMap: KnowledgeMap;
  dropped: DroppedFact[];
  preCheck: Mcq[];
  mock: boolean;
}

/** The JSON side record persisted at prep/<sourceId>.json, checked before re-running the agents. */
interface PrepSideRecord {
  gatekeeper: GatekeeperSlice;
  preCheck: Mcq[];
  dropped: DroppedFact[];
  mock: boolean;
  preparedAt: string;
}

const prepPath = (sourceId: string) => `prep/${sourceId}.json`;
const jobIdFor = (sourceId: string) => `intake:${sourceId}`;

// One background matcher job per source, kept in memory so a repeated GET (or a restart of the
// matcher after a process reload finds the prep already cached) never starts it twice.
const matcherJobs = new Map<string, Promise<void>>();

function startMatcher(sourceId: string, km: KnowledgeMap, jobId: string): void {
  if (matcherJobs.has(sourceId)) return;
  const job = runMatcher(km, { jobId })
    .then((matches) => getStorage().putMatch(sourceId, matches))
    .catch((err: unknown) => {
      // TODO(overnight): a persistently failing matcher never resolves GET /matches (stays 202
      // forever); surface this in the Forge screen once S6+ progress UI exists.
      emit(jobId, { agent: "matcher", status: "failed", note: err instanceof Error ? err.message : String(err) });
    });
  matcherJobs.set(sourceId, job);
}

/** Test hook: the in-flight (or already settled) background matcher promise for a source, if started. */
export function matcherJob(sourceId: string): Promise<void> | undefined {
  return matcherJobs.get(sourceId);
}

/** Test hook: forget in-memory matcher job state (a fresh process would start clean anyway). */
export function resetMatcherJobs(): void {
  matcherJobs.clear();
}

/** The 3 concepts likely weakest for a learner: core concepts first, hardest first. */
function pickWeakestConceptIds(km: KnowledgeMap): string[] {
  const core = km.concepts.filter((c) => c.importance === "core");
  const pool = core.length >= 3 ? core : km.concepts;
  return [...pool]
    .sort((a, b) => b.difficulty - a.difficulty || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map((c) => c.id);
}

interface PreCheckItemLike {
  conceptId: string;
  prompt: string;
  correct: string;
  distractors: readonly string[];
}

/** Shuffles each item's choices with a seed derived from the source id, mirroring assemble.ts's pattern. */
function toMcqs(sourceId: string, items: readonly PreCheckItemLike[]): Mcq[] {
  const seed = hashString(sourceId);
  return items.map((item, i) => {
    const choices = seededShuffle([item.correct, ...item.distractors], seed + 101 + i);
    return { conceptId: item.conceptId, prompt: item.prompt, choices, correctIndex: choices.indexOf(item.correct) };
  });
}

// TODO(overnight): a topic or short paste (1-3 pages) that doesn't match any keyword in
// src/pipeline/mock/registry.ts falls back to the trig mock sample (MEGAPROMPT §8), but that
// fixture's gatekeeper/curriculum outline references pages 1-4. checkGatekeeper/checkCurriculum's
// page-bound checks then fail every repair attempt against a canned mock reply that can never
// change, and prepareIntake throws. Long uploads (>= 4 pages) are unaffected (see
// tests/pipeline-agents.test.ts). A real fix would add a minimal 1-page mock sample for this case,
// or make the page-bound checks advisory (like the curriculum "soft:" rule) when the model is mocked.

async function loadPages(source: SourceRecord): Promise<{ pages: PageRecord[]; unsourced: boolean; pageCount: number }> {
  if (source.kind === "topic") {
    const text = source.topic ?? source.title;
    return { pages: [{ sourceId: source.id, page: 1, text, lowText: false }], unsourced: true, pageCount: 1 };
  }
  const pages = await getStorage().getPages(source.id);
  return { pages, unsourced: false, pageCount: pages.length };
}

export async function prepareIntake(sourceId: string): Promise<IntakeResult> {
  const storage = getStorage();
  const source = await storage.getSource(sourceId);
  if (!source) throw new Error(`No source with id "${sourceId}".`);
  const jobId = jobIdFor(sourceId);

  const cachedRaw = await storage.getBlob(prepPath(sourceId));
  if (cachedRaw) {
    const km = await storage.getKnowledgeMap(sourceId);
    if (km) {
      const cached = JSON.parse(Buffer.from(cachedRaw).toString("utf8")) as PrepSideRecord;
      startMatcher(sourceId, km, jobId);
      return {
        source: { id: source.id, kind: source.kind, title: source.title, pageCount: source.pageCount },
        gatekeeper: cached.gatekeeper,
        knowledgeMap: km,
        dropped: cached.dropped,
        preCheck: cached.preCheck,
        mock: cached.mock,
      };
    }
  }

  const { pages, unsourced, pageCount } = await loadPages(source);

  const gatekeeper = await runGatekeeper({ jobId, title: source.title, pages, pageCount });
  const slice = await runCurriculum({ jobId, title: source.title, pages, pageCount, unsourced });

  let km = curriculumToKnowledgeMap(slice, sourceId, unsourced);
  let dropped: DroppedFact[] = [];
  if (!unsourced) {
    const verified = verifyKnowledgeMapQuotes(km, pages);
    km = verified.km;
    dropped = verified.dropped;
  }
  await storage.putKnowledgeMap(km);

  const weakest = pickWeakestConceptIds(km);
  const preCheckSlice = await runPrecheck({ jobId, km, weakestConceptIds: weakest });
  const preCheck = toMcqs(sourceId, preCheckSlice.items);

  const mock = isMockLLM();
  const record: PrepSideRecord = { gatekeeper, preCheck, dropped, mock, preparedAt: new Date().toISOString() };
  await storage.putBlob(prepPath(sourceId), new TextEncoder().encode(JSON.stringify(record)), "application/json");

  startMatcher(sourceId, km, jobId);

  return {
    source: { id: source.id, kind: source.kind, title: source.title, pageCount: source.pageCount },
    gatekeeper,
    knowledgeMap: km,
    dropped,
    preCheck,
    mock,
  };
}

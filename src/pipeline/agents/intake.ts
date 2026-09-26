import type { KnowledgeMap, Mcq } from "../../contracts/knowledge";
import type { GatekeeperSlice } from "../../contracts/slices";
import type { PageRecord, SourceRecord } from "../../contracts/storage";
import { hashString, seededShuffle } from "../../mechanics/util";
import { isMockLLM } from "../../server/env";
import { verifyKnowledgeMapQuotes, type DroppedFact } from "../../server/ingest";
import { getStorage } from "../../server/storage";
import { emit } from "../events";
import { resolveMockSampleDetailed } from "../mock/registry";
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

/**
 * M6: the gatekeeper says this material can't become a game — not educational, or not enough of it.
 * The route (GET /api/sources/[id]/intake) turns this into 422 { error, step: "gatekeeper" }, which
 * the intake page shows as `error`. `tooBig` is NOT rejected here: the outline checklist handles it.
 */
export class GatekeeperRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GatekeeperRejectedError";
  }
}

function rejectionReason(gatekeeper: Pick<GatekeeperSlice, "educational" | "tooSmall">): string | null {
  if (!gatekeeper.educational) return "This doesn't look like educational material we can turn into a game.";
  if (gatekeeper.tooSmall) return "There's not enough material here for a full game yet; try adding more.";
  return null;
}

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

/**
 * The pre-check items (question + choices + correctIndex) as this server actually wrote them during
 * intake prep, or null when no prep record exists for this source (fixtures/tests that build an
 * Intake by hand without going through GET /api/sources/:id/intake first).
 *
 * POST /api/games trusts only the client's `answers`, never its `items`: an item's `correctIndex`
 * chosen by the client could otherwise let a student report a perfect pre-check score regardless of
 * what they actually answered.
 */
export async function loadStoredPreCheck(sourceId: string): Promise<Mcq[] | null> {
  const raw = await getStorage().getBlob(prepPath(sourceId));
  if (!raw) return null;
  const cached = JSON.parse(Buffer.from(raw).toString("utf8")) as PrepSideRecord;
  return cached.preCheck;
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
      const rejected = rejectionReason(cached.gatekeeper);
      if (rejected) throw new GatekeeperRejectedError(rejected);
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

  // In mock mode, an upload short enough (or a bare topic) that no fixture's keywords match it falls
  // back to the trig sample (src/pipeline/mock/registry.ts), whose canned gatekeeper/curriculum reply
  // references trig's own page range. That reply can never change, so its page-bound checks (outline
  // ranges, fact page numbers) are treated as advisory instead of hard failures here — otherwise every
  // repair attempt fails the same way and prepareIntake throws (see tests/pipeline-agents.test.ts).
  const pageBoundAdvisory = isMockLLM() && !resolveMockSampleDetailed({ sourceId: source.id, title: source.title, text: pages[0]?.text }).matched;

  const gatekeeper = await runGatekeeper({ jobId, title: source.title, pages, pageCount, pageBoundAdvisory });
  const rejected = rejectionReason(gatekeeper);
  if (rejected) throw new GatekeeperRejectedError(rejected);
  const slice = await runCurriculum({ jobId, title: source.title, pages, pageCount, unsourced, pageBoundAdvisory });

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

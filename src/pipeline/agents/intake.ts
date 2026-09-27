import { selectConcepts, type KnowledgeMap, type Mcq } from "../../contracts/knowledge";
import type { GatekeeperSlice, PreCheckSlice } from "../../contracts/slices";
import type { PageRecord, SourceRecord } from "../../contracts/storage";
import { hashString, seededShuffle } from "../../mechanics/util";
import { isMockLLM } from "../../server/env";
import { verifyKnowledgeMapQuotes, type DroppedFact } from "../../server/ingest";
import { getStorage } from "../../server/storage";
import { emit } from "../events";
import { resolveMockSampleDetailed } from "../mock/registry";
import { curriculumToKnowledgeMap, runCurriculumChunked } from "./curriculum";
import { runGatekeeper } from "./gatekeeper";
import { runMatcher } from "./matcher";
import { derivePreCheck, runPrecheck } from "./precheck";

/*
 * prepareIntake(sourceId): the whole front half (S1 gatekeeper -> S2 curriculum + quote
 * verification -> S3 pre-check), then kicks off S4 matcher in the background. Idempotent: a second
 * call returns the previously stored result instead of re-running the agents. See instructions.md §9
 * (GET /api/sources/:id/intake) and MEGAPROMPT §3/§4.
 *
 * There is no page cap on uploads: a whole textbook is read by the curriculum agent in section-aligned
 * parts (runCurriculumChunked) and the student then ticks the concepts to play. Because the prep
 * pre-check covers the whole map, a ticked subset gets its own three questions from
 * preparePreCheckForSelection (POST /api/sources/:id/precheck), cached per selection.
 */

/**
 * M6: the gatekeeper says this material can't become a game — not educational, or not enough of it.
 * The route (GET /api/sources/[id]/intake) turns this into 422 { error, step: "gatekeeper" }, which
 * the intake page shows as `error`. `tooBig` is NOT rejected here: the student picks concepts instead.
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
  /** how many curriculum calls the document took (1 = read in one go) */
  parts: number;
}

/** The JSON side record persisted at prep/<sourceId>.json, checked before re-running the agents. */
interface PrepSideRecord {
  gatekeeper: GatekeeperSlice;
  preCheck: Mcq[];
  dropped: DroppedFact[];
  mock: boolean;
  preparedAt: string;
  /** absent on records written before chunked reading existed */
  parts?: number;
}

/** A pre-check written for one ticked subset of the concepts, at prep/<sourceId>.precheck.<key>.json. */
interface SelectionPreCheckRecord {
  conceptIds: string[];
  preCheck: Mcq[];
  /** true when the Pre-check Writer failed and code derived the items instead */
  derived: boolean;
  preparedAt: string;
}

const prepPath = (sourceId: string) => `prep/${sourceId}.json`;
const selectionPreCheckPath = (sourceId: string, key: string) => `prep/${sourceId}.precheck.${key}.json`;
const jobIdFor = (sourceId: string) => `intake:${sourceId}`;

/** Stable key for a set of concept ids (order-insensitive), used to cache a selection's pre-check. */
export function selectionKey(conceptIds: readonly string[]): string {
  const ids = [...new Set(conceptIds)].sort();
  return `${ids.length}_${(hashString(ids.join("\n")) >>> 0).toString(36)}`;
}

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

async function readJson<T>(path: string): Promise<T | null> {
  const raw = await getStorage().getBlob(path);
  return raw ? (JSON.parse(Buffer.from(raw).toString("utf8")) as T) : null;
}

/**
 * The pre-check items (question + choices + correctIndex) as this server actually wrote them, or
 * null when no prep record exists for this source (fixtures/tests that build an Intake by hand
 * without going through GET /api/sources/:id/intake first). With `conceptIds`, the items written for
 * that selection (preparePreCheckForSelection) when there are any, else the whole-map prep items.
 *
 * POST /api/games trusts only the client's `answers`, never its `items`: an item's `correctIndex`
 * chosen by the client could otherwise let a student report a perfect pre-check score regardless of
 * what they actually answered.
 */
export async function loadStoredPreCheck(sourceId: string, conceptIds?: readonly string[]): Promise<Mcq[] | null> {
  if (conceptIds && conceptIds.length > 0) {
    const forSelection = await readJson<SelectionPreCheckRecord>(selectionPreCheckPath(sourceId, selectionKey(conceptIds)));
    if (forSelection) return forSelection.preCheck;
  }
  const cached = await readJson<PrepSideRecord>(prepPath(sourceId));
  return cached ? cached.preCheck : null;
}

/** The 3 concepts likely weakest for a learner: core concepts first, hardest first. */
export function pickWeakestConceptIds(km: KnowledgeMap): string[] {
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
export function toMcqs(sourceId: string, items: readonly PreCheckItemLike[]): Mcq[] {
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

  const cached = await readJson<PrepSideRecord>(prepPath(sourceId));
  if (cached) {
    const km = await storage.getKnowledgeMap(sourceId);
    if (km) {
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
        parts: cached.parts ?? 1,
      };
    }
  }

  const { pages, unsourced, pageCount } = await loadPages(source);

  // In mock mode, an upload short enough (or a bare topic) that no fixture's keywords match it falls
  // back to the trig sample (src/pipeline/mock/registry.ts), whose canned gatekeeper/curriculum reply
  // references trig's own page range. That reply can never change, so its page-bound checks (outline
  // ranges, fact page numbers) are treated as advisory instead of hard failures here — otherwise every
  // repair attempt fails the same way and prepareIntake throws (see tests/pipeline-agents.test.ts).
  const mock = isMockLLM();
  const pageBoundAdvisory = mock && !resolveMockSampleDetailed({ sourceId: source.id, title: source.title, text: pages[0]?.text }).matched;

  const gatekeeper = await runGatekeeper({ jobId, title: source.title, pages, pageCount, pageBoundAdvisory });
  const rejected = rejectionReason(gatekeeper);
  if (rejected) throw new GatekeeperRejectedError(rejected);
  // Mock replies are canned per sample, so reading a long upload in parts would only repeat the same
  // fixture; one call keeps mock mode deterministic. Live mode chunks by the gatekeeper's outline.
  const { slice, parts } = await runCurriculumChunked({
    jobId,
    title: source.title,
    pages,
    pageCount,
    unsourced,
    outline: gatekeeper.outline,
    pageBoundAdvisory,
    chunking: mock ? false : undefined,
  });

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

  const record: PrepSideRecord = { gatekeeper, preCheck, dropped, mock, preparedAt: new Date().toISOString(), parts };
  await storage.putBlob(prepPath(sourceId), new TextEncoder().encode(JSON.stringify(record)), "application/json");

  startMatcher(sourceId, km, jobId);

  return {
    source: { id: source.id, kind: source.kind, title: source.title, pageCount: source.pageCount },
    gatekeeper,
    knowledgeMap: km,
    dropped,
    preCheck,
    mock,
    parts,
  };
}

export interface SelectionPreCheck {
  preCheck: Mcq[];
  /** the selection these items were written for (unknown ids dropped; the whole map when nothing was ticked) */
  conceptIds: string[];
  /** true when the Pre-check Writer failed and code derived the items instead */
  derived: boolean;
  /** true when the items came from storage rather than a fresh call */
  cached: boolean;
}

/**
 * Three pre-check questions for the concepts the student ticked. Nothing ticked, or everything,
 * means the whole-map items from prep. Any other selection is written once (the Pre-check Writer on
 * the sub-map, or derivePreCheck when it fails) and cached under a key of the sorted ids, which is
 * what POST /api/games looks up again through loadStoredPreCheck(sourceId, intake.conceptIds).
 */
export async function preparePreCheckForSelection(sourceId: string, conceptIds: readonly string[]): Promise<SelectionPreCheck> {
  const storage = getStorage();
  const km = await storage.getKnowledgeMap(sourceId);
  if (!km) throw new Error(`No knowledge map for source "${sourceId}"; run intake prep first.`);
  const known = new Set(km.concepts.map((c) => c.id));
  const selected = [...new Set(conceptIds)].filter((id) => known.has(id));

  if (selected.length === 0 || selected.length === km.concepts.length) {
    const original = await loadStoredPreCheck(sourceId);
    if (!original) throw new Error(`No intake prep for source "${sourceId}" yet.`);
    return { preCheck: original, conceptIds: km.concepts.map((c) => c.id), derived: false, cached: true };
  }

  const key = selectionKey(selected);
  const path = selectionPreCheckPath(sourceId, key);
  const cached = await readJson<SelectionPreCheckRecord>(path);
  if (cached) return { preCheck: cached.preCheck, conceptIds: cached.conceptIds, derived: cached.derived, cached: true };

  const sub = selectConcepts(km, selected);
  const weakest = pickWeakestConceptIds(sub);
  let slice: PreCheckSlice;
  let derived = false;
  try {
    slice = await runPrecheck({ jobId: `precheck:${sourceId}:${key}`, km: sub, weakestConceptIds: weakest });
  } catch {
    slice = derivePreCheck(sub, weakest);
    derived = true;
  }
  const preCheck = toMcqs(`${sourceId}:${key}`, slice.items);
  const record: SelectionPreCheckRecord = { conceptIds: selected, preCheck, derived, preparedAt: new Date().toISOString() };
  await storage.putBlob(path, new TextEncoder().encode(JSON.stringify(record)), "application/json");
  return { preCheck, conceptIds: selected, derived, cached: false };
}

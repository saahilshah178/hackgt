import { z } from "zod";
import { GameSpec } from "./gamespec";
import { Intake, KnowledgeMap } from "./knowledge";
import { MatchResult } from "./match";
import { ProgressEvent } from "./progress";
import { TelemetryEvent } from "./telemetry";

export const SourceKind = z.enum(["pdf", "text", "topic"]);
export type SourceKind = z.infer<typeof SourceKind>;

export const SourceRecord = z.object({
  id: z.string().min(1),
  kind: SourceKind,
  title: z.string().min(1),
  filename: z.string().nullable(),
  pageCount: z.number().int().min(0),
  byteLength: z.number().int().min(0),
  createdAt: z.iso.datetime(),
  /** blob path of the original upload, or null for text/topic */
  blobPath: z.string().nullable(),
  /** the raw topic string when kind = topic */
  topic: z.string().nullable(),
});
export type SourceRecord = z.infer<typeof SourceRecord>;

export const PageRecord = z.object({
  sourceId: z.string().min(1),
  page: z.number().int().min(1),
  text: z.string(),
  /** flagged when the text layer is thin (scanned page); a vision pass could fill it in */
  lowText: z.boolean(),
});
export type PageRecord = z.infer<typeof PageRecord>;

export const GameRecord = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  jobId: z.string().nullable(),
  createdAt: z.iso.datetime(),
  spec: GameSpec,
});
export type GameRecord = z.infer<typeof GameRecord>;

export const GameSummary = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  title: z.string(),
  genre: z.string(),
  createdAt: z.iso.datetime(),
  encounterCount: z.number().int().min(0),
});
export type GameSummary = z.infer<typeof GameSummary>;

export const JobStatus = z.enum(["queued", "running", "done", "failed"]);
export const JobRecord = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  status: JobStatus,
  gameId: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type JobRecord = z.infer<typeof JobRecord>;

/** Persisted intake per source (the latest one wins); regenerate reuses it. */
export type StoredIntake = Intake;

/**
 * Everything the app persists goes through one of these. LocalDriver (JSON + files under .data/)
 * is the default; SupabaseDriver mirrors it onto Postgres + Storage. Both are server-only.
 */
export interface StorageDriver {
  readonly name: "local" | "supabase";
  putSource(source: SourceRecord): Promise<void>;
  getSource(id: string): Promise<SourceRecord | null>;
  putPages(sourceId: string, pages: PageRecord[]): Promise<void>;
  getPages(sourceId: string): Promise<PageRecord[]>;
  putKnowledgeMap(km: KnowledgeMap): Promise<void>;
  getKnowledgeMap(sourceId: string): Promise<KnowledgeMap | null>;
  putIntake(sourceId: string, intake: Intake): Promise<void>;
  getIntake(sourceId: string): Promise<Intake | null>;
  putMatch(sourceId: string, matches: MatchResult[]): Promise<void>;
  getMatch(sourceId: string): Promise<MatchResult[] | null>;
  putGame(game: GameRecord): Promise<void>;
  getGame(id: string): Promise<GameRecord | null>;
  listGames(): Promise<GameSummary[]>;
  putJob(job: JobRecord): Promise<void>;
  getJob(id: string): Promise<JobRecord | null>;
  appendEvents(jobId: string, events: ProgressEvent[]): Promise<void>;
  getEvents(jobId: string): Promise<ProgressEvent[]>;
  appendTelemetry(gameId: string, events: TelemetryEvent[]): Promise<void>;
  getTelemetry(gameId: string): Promise<TelemetryEvent[]>;
  /** Stores bytes at a path like "sources/<id>.pdf" or "audio/<hash>.mp3"; returns the path. */
  putBlob(path: string, data: Uint8Array, contentType: string): Promise<string>;
  /** Reads a stored blob back (server side), or null when absent. Also used for small JSON side records such as intake prep. */
  getBlob(path: string): Promise<Uint8Array | null>;
  /** Public URL the browser can fetch for a stored blob path. */
  blobUrl(path: string): string;
}

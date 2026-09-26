import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Intake, KnowledgeMap } from "../../contracts/knowledge";
import type { MatchResult } from "../../contracts/match";
import type { ProgressEvent } from "../../contracts/progress";
import type { GameRecord, GameSummary, JobRecord, PageRecord, SourceRecord, StorageDriver } from "../../contracts/storage";
import type { TelemetryEvent } from "../../contracts/telemetry";
import { getEnv } from "../env";

/*
 * SupabaseDriver: mirrors LocalDriver onto the tables + buckets in supabase/schema.sql. Complete but
 * UNTESTED tonight (MEGAPROMPT §5, §8): STORAGE_DRIVER stays "local" for the whole demo, so this is
 * never instantiated in tests or in the running app unless someone explicitly opts in with real keys.
 * Uses the secret key server-side only; never imported from a client component.
 */

function toSourceRow(s: SourceRecord) {
  return {
    id: s.id,
    kind: s.kind,
    title: s.title,
    filename: s.filename,
    page_count: s.pageCount,
    byte_length: s.byteLength,
    blob_path: s.blobPath,
    topic: s.topic,
    created_at: s.createdAt,
  };
}
function fromSourceRow(r: Record<string, unknown>): SourceRecord {
  return {
    id: r.id as string,
    kind: r.kind as SourceRecord["kind"],
    title: r.title as string,
    filename: (r.filename as string | null) ?? null,
    pageCount: r.page_count as number,
    byteLength: r.byte_length as number,
    blobPath: (r.blob_path as string | null) ?? null,
    topic: (r.topic as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

function toPageRow(sourceId: string, p: PageRecord) {
  return { source_id: sourceId, page: p.page, text: p.text, low_text: p.lowText };
}
function fromPageRow(r: Record<string, unknown>): PageRecord {
  return { sourceId: r.source_id as string, page: r.page as number, text: r.text as string, lowText: r.low_text as boolean };
}

function fromGameRow(r: Record<string, unknown>): GameRecord {
  return {
    id: r.id as string,
    sourceId: r.source_id as string,
    jobId: (r.job_id as string | null) ?? null,
    createdAt: r.created_at as string,
    spec: r.spec as GameRecord["spec"],
  };
}

function fromJobRow(r: Record<string, unknown>): JobRecord {
  return {
    id: r.id as string,
    sourceId: r.source_id as string,
    status: r.status as JobRecord["status"],
    gameId: (r.game_id as string | null) ?? null,
    error: (r.error as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export class SupabaseDriver implements StorageDriver {
  readonly name = "supabase" as const;
  private readonly client: SupabaseClient;
  private readonly publicUrl: string;

  constructor() {
    const env = getEnv();
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
      throw new Error(
        "SupabaseDriver requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY. Set them in .env.local; see FIRST_RUN.md step 6 (Supabase).",
      );
    }
    this.publicUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    this.client = createClient(this.publicUrl, env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private table(name: string) {
    return this.client.from(name);
  }

  private ok<T>(res: { data: T | null; error: { message: string } | null }, action: string): T | null {
    if (res.error) throw new Error(`SupabaseDriver.${action}: ${res.error.message}`);
    return res.data;
  }

  async putSource(source: SourceRecord): Promise<void> {
    this.ok(await this.table("sources").upsert(toSourceRow(source)), "putSource");
  }
  async getSource(id: string): Promise<SourceRecord | null> {
    const { data, error } = await this.table("sources").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`SupabaseDriver.getSource: ${error.message}`);
    return data ? fromSourceRow(data) : null;
  }

  async putPages(sourceId: string, pages: PageRecord[]): Promise<void> {
    await this.table("pages").delete().eq("source_id", sourceId);
    if (pages.length === 0) return;
    this.ok(await this.table("pages").insert(pages.map((p) => toPageRow(sourceId, p))), "putPages");
  }
  async getPages(sourceId: string): Promise<PageRecord[]> {
    const { data, error } = await this.table("pages").select("*").eq("source_id", sourceId).order("page");
    if (error) throw new Error(`SupabaseDriver.getPages: ${error.message}`);
    return (data ?? []).map(fromPageRow);
  }

  async putKnowledgeMap(km: KnowledgeMap): Promise<void> {
    this.ok(await this.table("knowledge_maps").upsert({ source_id: km.sourceId, km, updated_at: new Date().toISOString() }), "putKnowledgeMap");
  }
  async getKnowledgeMap(sourceId: string): Promise<KnowledgeMap | null> {
    const { data, error } = await this.table("knowledge_maps").select("km").eq("source_id", sourceId).maybeSingle();
    if (error) throw new Error(`SupabaseDriver.getKnowledgeMap: ${error.message}`);
    return (data?.km as KnowledgeMap | undefined) ?? null;
  }

  async putIntake(sourceId: string, intake: Intake): Promise<void> {
    this.ok(await this.table("intakes").upsert({ source_id: sourceId, intake, updated_at: new Date().toISOString() }), "putIntake");
  }
  async getIntake(sourceId: string): Promise<Intake | null> {
    const { data, error } = await this.table("intakes").select("intake").eq("source_id", sourceId).maybeSingle();
    if (error) throw new Error(`SupabaseDriver.getIntake: ${error.message}`);
    return (data?.intake as Intake | undefined) ?? null;
  }

  async putMatch(sourceId: string, matches: MatchResult[]): Promise<void> {
    this.ok(await this.table("matches").upsert({ source_id: sourceId, matches, updated_at: new Date().toISOString() }), "putMatch");
  }
  async getMatch(sourceId: string): Promise<MatchResult[] | null> {
    const { data, error } = await this.table("matches").select("matches").eq("source_id", sourceId).maybeSingle();
    if (error) throw new Error(`SupabaseDriver.getMatch: ${error.message}`);
    return (data?.matches as MatchResult[] | undefined) ?? null;
  }

  async putGame(game: GameRecord): Promise<void> {
    this.ok(
      await this.table("games").upsert({ id: game.id, source_id: game.sourceId, job_id: game.jobId, spec: game.spec, created_at: game.createdAt }),
      "putGame",
    );
  }
  async getGame(id: string): Promise<GameRecord | null> {
    const { data, error } = await this.table("games").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`SupabaseDriver.getGame: ${error.message}`);
    return data ? fromGameRow(data) : null;
  }
  async listGames(): Promise<GameSummary[]> {
    const { data, error } = await this.table("games").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(`SupabaseDriver.listGames: ${error.message}`);
    return (data ?? []).map(fromGameRow).map((g) => ({
      id: g.id,
      sourceId: g.sourceId,
      title: g.spec.title,
      genre: g.spec.genre,
      createdAt: g.createdAt,
      encounterCount: g.spec.encounters.length,
    }));
  }

  async putJob(job: JobRecord): Promise<void> {
    this.ok(
      await this.table("jobs").upsert({
        id: job.id,
        source_id: job.sourceId,
        status: job.status,
        game_id: job.gameId,
        error: job.error,
        created_at: job.createdAt,
        updated_at: job.updatedAt,
      }),
      "putJob",
    );
  }
  async getJob(id: string): Promise<JobRecord | null> {
    const { data, error } = await this.table("jobs").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`SupabaseDriver.getJob: ${error.message}`);
    return data ? fromJobRow(data) : null;
  }

  async appendEvents(jobId: string, events: ProgressEvent[]): Promise<void> {
    if (events.length === 0) return;
    this.ok(
      await this.table("events").insert(
        events.map((e) => ({ job_id: jobId, agent: e.agent, status: e.status, ms: e.ms ?? null, note: e.note ?? null, at: e.at ?? new Date().toISOString() })),
      ),
      "appendEvents",
    );
  }
  async getEvents(jobId: string): Promise<ProgressEvent[]> {
    const { data, error } = await this.table("events").select("*").eq("job_id", jobId).order("at");
    if (error) throw new Error(`SupabaseDriver.getEvents: ${error.message}`);
    return (data ?? []).map((r) => ({
      jobId,
      agent: r.agent as string,
      status: r.status as ProgressEvent["status"],
      ms: (r.ms as number | null) ?? undefined,
      note: (r.note as string | null) ?? undefined,
      at: r.at as string,
    }));
  }

  async appendTelemetry(gameId: string, events: TelemetryEvent[]): Promise<void> {
    if (events.length === 0) return;
    this.ok(
      await this.table("telemetry").insert(
        events.map((e) => ({
          game_id: gameId,
          encounter_id: e.encounterId,
          concept_ids: e.conceptIds,
          teaching_mechanic_id: e.teachingMechanicId,
          attempt: e.attempt,
          correct: e.correct,
          hints_used: e.hintsUsed,
          ms: e.ms,
          at: e.at,
        })),
      ),
      "appendTelemetry",
    );
  }
  async getTelemetry(gameId: string): Promise<TelemetryEvent[]> {
    const { data, error } = await this.table("telemetry").select("*").eq("game_id", gameId).order("at");
    if (error) throw new Error(`SupabaseDriver.getTelemetry: ${error.message}`);
    return (data ?? []).map((r) => ({
      gameId,
      encounterId: r.encounter_id as string,
      conceptIds: r.concept_ids as string[],
      teachingMechanicId: r.teaching_mechanic_id as string,
      attempt: r.attempt as number,
      correct: r.correct as boolean,
      hintsUsed: r.hints_used as number,
      ms: r.ms as number,
      at: r.at as string,
    }));
  }

  async putBlob(path: string, data: Uint8Array, contentType: string): Promise<string> {
    const bucket = path.startsWith("audio/") ? "audio" : "sources";
    const key = path.startsWith("audio/") ? path.slice("audio/".length) : path;
    const { error } = await this.client.storage.from(bucket).upload(key, data, { contentType, upsert: true });
    if (error) throw new Error(`SupabaseDriver.putBlob: ${error.message}`);
    return path;
  }

  blobUrl(path: string): string {
    const bucket = path.startsWith("audio/") ? "audio" : "sources";
    const key = path.startsWith("audio/") ? path.slice("audio/".length) : path;
    return `${this.publicUrl}/storage/v1/object/public/${bucket}/${key}`;
  }
}

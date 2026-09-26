import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { Intake, KnowledgeMap } from "../../contracts/knowledge";
import type { MatchResult } from "../../contracts/match";
import type { ProgressEvent } from "../../contracts/progress";
import type { GameRecord, GameSummary, JobRecord, PageRecord, SourceRecord, StorageDriver } from "../../contracts/storage";
import type { TelemetryEvent } from "../../contracts/telemetry";
import { getEnv } from "../env";

/*
 * Default StorageDriver: plain JSON files (plus raw blobs) under DATA_DIR (".data/" by default,
 * gitignored). Every write is atomic (temp file + rename) so a crash mid-write never corrupts a
 * record. Layout:
 *   .data/sources/<id>.json          SourceRecord
 *   .data/pages/<sourceId>.json      PageRecord[]
 *   .data/knowledge-maps/<sourceId>.json
 *   .data/intakes/<sourceId>.json
 *   .data/matches/<sourceId>.json
 *   .data/games/<id>.json            GameRecord
 *   .data/jobs/<id>.json             JobRecord
 *   .data/events/<jobId>.jsonl       ProgressEvent, one JSON object per line
 *   .data/telemetry/<gameId>.jsonl   TelemetryEvent, one JSON object per line
 *   .data/blobs/<path>               raw bytes (PDFs, audio, ...), served by /api/blobs/[...path]
 */

function isSafeRelativePath(path: string): boolean {
  if (path.startsWith("/") || path.includes("..")) return false;
  return path.length > 0;
}

export class LocalDriver implements StorageDriver {
  readonly name = "local" as const;
  private readonly root: string;

  constructor(root?: string) {
    this.root = resolve(root ?? getEnv().DATA_DIR);
  }

  private path(...parts: string[]): string {
    return join(this.root, ...parts);
  }

  /** Writes JSON atomically: write to a sibling temp file, then rename over the target. */
  private async writeJson(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const tmp = join(dirname(path), `.tmp-${randomBytes(6).toString("hex")}`);
    await writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
    await rename(tmp, path);
  }

  private async readJson<T>(path: string): Promise<T | null> {
    try {
      return JSON.parse(await readFile(path, "utf8")) as T;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  /** Appends one JSON-lines record atomically relative to concurrent readers (write temp, then rename over a merged file). */
  private async appendJsonl(path: string, lines: unknown[]): Promise<void> {
    if (lines.length === 0) return;
    await mkdir(dirname(path), { recursive: true });
    const existing = await readFile(path, "utf8").catch((err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return "";
      throw err;
    });
    const addition = lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
    const tmp = join(dirname(path), `.tmp-${randomBytes(6).toString("hex")}`);
    await writeFile(tmp, existing + addition, "utf8");
    await rename(tmp, path);
  }

  private async readJsonl<T>(path: string): Promise<T[]> {
    const text = await readFile(path, "utf8").catch((err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return "";
      throw err;
    });
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l) as T);
  }

  async putSource(source: SourceRecord): Promise<void> {
    await this.writeJson(this.path("sources", `${source.id}.json`), source);
  }
  async getSource(id: string): Promise<SourceRecord | null> {
    return this.readJson(this.path("sources", `${id}.json`));
  }

  async putPages(sourceId: string, pages: PageRecord[]): Promise<void> {
    await this.writeJson(this.path("pages", `${sourceId}.json`), pages);
  }
  async getPages(sourceId: string): Promise<PageRecord[]> {
    return (await this.readJson<PageRecord[]>(this.path("pages", `${sourceId}.json`))) ?? [];
  }

  async putKnowledgeMap(km: KnowledgeMap): Promise<void> {
    await this.writeJson(this.path("knowledge-maps", `${km.sourceId}.json`), km);
  }
  async getKnowledgeMap(sourceId: string): Promise<KnowledgeMap | null> {
    return this.readJson(this.path("knowledge-maps", `${sourceId}.json`));
  }

  async putIntake(sourceId: string, intake: Intake): Promise<void> {
    await this.writeJson(this.path("intakes", `${sourceId}.json`), intake);
  }
  async getIntake(sourceId: string): Promise<Intake | null> {
    return this.readJson(this.path("intakes", `${sourceId}.json`));
  }

  async putMatch(sourceId: string, matches: MatchResult[]): Promise<void> {
    await this.writeJson(this.path("matches", `${sourceId}.json`), matches);
  }
  async getMatch(sourceId: string): Promise<MatchResult[] | null> {
    return this.readJson(this.path("matches", `${sourceId}.json`));
  }

  async putGame(game: GameRecord): Promise<void> {
    await this.writeJson(this.path("games", `${game.id}.json`), game);
  }
  async getGame(id: string): Promise<GameRecord | null> {
    return this.readJson(this.path("games", `${id}.json`));
  }
  async listGames(): Promise<GameSummary[]> {
    const dir = this.path("games");
    const files = await readdir(dir).catch((err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    });
    const games = await Promise.all(
      files.filter((f) => f.endsWith(".json")).map((f) => this.readJson<GameRecord>(join(dir, f))),
    );
    return games
      .filter((g): g is GameRecord => g !== null)
      .map((g) => ({
        id: g.id,
        sourceId: g.sourceId,
        title: g.spec.title,
        genre: g.spec.genre,
        createdAt: g.createdAt,
        encounterCount: g.spec.encounters.length,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async putJob(job: JobRecord): Promise<void> {
    await this.writeJson(this.path("jobs", `${job.id}.json`), job);
  }
  async getJob(id: string): Promise<JobRecord | null> {
    return this.readJson(this.path("jobs", `${id}.json`));
  }

  async appendEvents(jobId: string, events: ProgressEvent[]): Promise<void> {
    await this.appendJsonl(this.path("events", `${jobId}.jsonl`), events);
  }
  async getEvents(jobId: string): Promise<ProgressEvent[]> {
    return this.readJsonl(this.path("events", `${jobId}.jsonl`));
  }

  async appendTelemetry(gameId: string, events: TelemetryEvent[]): Promise<void> {
    await this.appendJsonl(this.path("telemetry", `${gameId}.jsonl`), events);
  }
  async getTelemetry(gameId: string): Promise<TelemetryEvent[]> {
    return this.readJsonl(this.path("telemetry", `${gameId}.jsonl`));
  }

  async putBlob(path: string, data: Uint8Array, _contentType: string): Promise<string> {
    if (!isSafeRelativePath(path)) throw new Error(`LocalDriver.putBlob: unsafe path "${path}"`);
    const full = this.path("blobs", path);
    await mkdir(dirname(full), { recursive: true });
    const tmp = join(dirname(full), `.tmp-${randomBytes(6).toString("hex")}`);
    await writeFile(tmp, data);
    await rename(tmp, full);
    return path;
  }

  /** Reads back a blob written by putBlob; used by the /api/blobs/[...path] route handler. */
  async getBlob(path: string): Promise<Uint8Array | null> {
    if (!isSafeRelativePath(path)) return null;
    try {
      return await readFile(this.path("blobs", path));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  blobUrl(path: string): string {
    return `/api/blobs/${path}`;
  }
}

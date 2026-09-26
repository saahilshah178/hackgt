import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GameRecord } from "../contracts/storage";
import type { Intake } from "../contracts/knowledge";
import type { GameSpec } from "../contracts/gamespec";
import { getMockSample, listMockSamples } from "../pipeline/mock/registry";
import "../pipeline/mock/models"; // registers the mock samples (their knowledge maps) as a side effect
import { validateGameSpec } from "../pipeline/validate/validate-gamespec";
import { getStorage } from "./storage";

/*
 * Showcase games ship as fixtures (fixtures/<name>.json) and play without any storage. "Regenerate as
 * <genre>" and "Focus on my weak spots" need the game's knowledge map, intake and matches on file, so the
 * first time a fixture game is regenerated we materialize it: the spec becomes a stored GameRecord and the
 * knowledge map comes from the mock sample recorded against the same sourceId.
 */

export function isFixtureId(id: string): boolean {
  return id.startsWith("fixture-");
}

export async function loadFixtureSpec(id: string): Promise<GameSpec | null> {
  if (!isFixtureId(id)) return null;
  const name = id.slice("fixture-".length);
  for (const file of [`${name}.json`, `${name}-dungeon.json`]) {
    try {
      const raw = await readFile(path.join(process.cwd(), "fixtures", file), "utf8");
      const r = validateGameSpec(JSON.parse(raw));
      if (r.ok) return r.spec;
    } catch {
      // try the next name
    }
  }
  return null;
}

/** The intake the fixture was generated from, rebuilt from what the spec remembers. */
export function intakeFromSpec(spec: GameSpec): Intake {
  return {
    goal: spec.intake.goal,
    minutes: spec.intake.minutes,
    genre: spec.intake.requestedGenre,
    confidence: Object.fromEntries(spec.intake.confidence.map((c) => [c.unitId, c.level])),
    preCheck: { items: spec.assessment.pre, answers: spec.intake.preCheckAnswers },
  };
}

/** Stores a fixture game (and its knowledge map, source and intake) so the regular game routes can work on it. */
export async function materializeFixtureGame(id: string): Promise<GameRecord | null> {
  const spec = await loadFixtureSpec(id);
  if (!spec) return null;
  const storage = getStorage();
  const existing = await storage.getGame(id);
  if (existing) return existing;
  const km = listMockSamples()
    .map((s) => getMockSample(s)?.km)
    .find((k) => k?.sourceId === spec.source.sourceId);
  if (!km) return null;
  const now = new Date().toISOString();
  if (!(await storage.getSource(km.sourceId))) {
    await storage.putSource({ id: km.sourceId, kind: "text", title: km.title, filename: null, pageCount: km.outline.at(-1)?.pageEnd ?? 0, byteLength: 0, createdAt: now, blobPath: null, topic: null });
  }
  if (!(await storage.getKnowledgeMap(km.sourceId))) await storage.putKnowledgeMap(km);
  if (!(await storage.getIntake(km.sourceId))) await storage.putIntake(km.sourceId, intakeFromSpec(spec));
  const record: GameRecord = { id, sourceId: km.sourceId, jobId: null, createdAt: spec.createdAt, spec };
  await storage.putGame(record);
  return record;
}

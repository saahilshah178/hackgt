import { z } from "zod";

export const SCHEMA_VERSION = 1 as const;

export const GENRES = ["dungeon", "platformer", "mystery", "puzzle"] as const;
export const Genre = z.enum(GENRES);
export type Genre = z.infer<typeof Genre>;

export const KnowledgeType = z.enum([
  "fact",
  "category",
  "sequence",
  "causal",
  "quantitative",
  "spatial",
  "procedure",
  "argument",
]);
export type KnowledgeType = z.infer<typeof KnowledgeType>;

/** The seven input widgets. Every mechanic uses exactly one. */
export const Widget = z.enum(["dial", "pick", "sort", "order", "place", "link", "type"]);
export type Widget = z.infer<typeof Widget>;

export const EncounterRole = z.enum(["teach", "practice", "review", "boss"]);
export type EncounterRole = z.infer<typeof EncounterRole>;

export const PaletteId = z.enum(["ember", "tide", "moss", "dusk", "parchment", "neon"]);
export const MusicMood = z.enum(["curious", "tense", "playful", "noir", "boss", "calm"]);
export const VoiceArchetype = z.enum([
  "narrator",
  "wise_mentor",
  "gruff_guard",
  "cheerful_sidekick",
  "sly_villain",
  "nervous_scholar",
]);

/** Stable ids are lowercase snake_case. Enforced on the stored spec, not in LLM-facing schemas. */
export const Id = z.string().regex(/^[a-z][a-z0-9_]{0,47}$/, "ids must be lowercase snake_case");

/**
 * Where a claim came from in the uploaded file. The quote must appear verbatim on that page;
 * ingest checks this in code before the fact ever reaches a game.
 * (No string-length rules here: this schema is also sent to the model, see slices.ts.)
 */
export const SourceRef = z.object({
  page: z.number().int().min(1).max(5000),
  quote: z.string().describe("Verbatim quote (under 300 characters) from that page that supports the claim"),
});
export type SourceRef = z.infer<typeof SourceRef>;

/** Which agent (or code) owns each slice of the spec. Validation issues are routed back to the owner. */
export type Owner = "director" | "challenge_writer" | "narrative" | "assessment" | "code";

export interface Issue {
  path: (string | number)[];
  message: string;
  owner: Owner;
  encounterId?: string;
}

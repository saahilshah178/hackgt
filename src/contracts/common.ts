import { z } from "zod";

export const SCHEMA_VERSION = 2 as const;

// ---------------------------------------------------------------- enums (MEGAPROMPT §5)

export const GENRES = ["dungeon", "mystery", "platformer", "puzzle", "strategy"] as const;
export const Genre = z.enum(GENRES);
export type Genre = z.infer<typeof Genre>;
export const GenreOrAuto = z.enum(["auto", ...GENRES]);
export type GenreOrAuto = z.infer<typeof GenreOrAuto>;

export const KNOWLEDGE_TYPES = [
  "fact",
  "category",
  "sequence",
  "causal",
  "system",
  "quantitative",
  "spatial",
  "procedure",
  "argument",
] as const;
export const KnowledgeType = z.enum(KNOWLEDGE_TYPES);
export type KnowledgeType = z.infer<typeof KnowledgeType>;

/** One-line definitions, used verbatim in the curriculum agent's system prompt. */
export const KNOWLEDGE_TYPE_DEFINITIONS: Record<KnowledgeType, string> = {
  fact: "a discrete piece of information to remember (a date, a term, a value)",
  category: "membership rules: what belongs to which class and why",
  sequence: "an ordered series of steps, stages, or events",
  causal: "how one thing produces another; causes, effects, mechanisms",
  system: "interacting parts whose behavior emerges from feedback and flows",
  quantitative: "numbers, formulas, magnitudes, and how they change together",
  spatial: "positions, shapes, regions, and geometric relationships",
  procedure: "a method to execute correctly, step by step, to reach a result",
  argument: "claims, evidence, reasoning, and how to evaluate them",
};

export const DOMAINS = [
  "math",
  "physics",
  "chemistry",
  "biology",
  "earth_space",
  "cs",
  "engineering",
  "health",
  "history",
  "civics",
  "geography",
  "economics",
  "finance",
  "psychology",
  "philosophy",
  "literature",
  "writing",
  "language",
  "music",
  "art",
  "business",
  "law",
  "general",
  "other",
] as const;
export const Domain = z.enum(DOMAINS);
export type Domain = z.infer<typeof Domain>;

/** The eight input widgets (LIBRARY §2). Every family mode uses exactly one. */
export const WIDGETS = ["dial", "pick", "sort", "order", "place", "link", "build", "type"] as const;
export const Widget = z.enum(WIDGETS);
export type Widget = z.infer<typeof Widget>;

/** The fourteen mechanic families (LIBRARY §4). Families are code; cards are data. */
export const FAMILY_IDS = [
  "tuner",
  "function_world",
  "accumulator",
  "balance",
  "transformer",
  "sequencer",
  "sorter",
  "truth_finder",
  "linker",
  "mapper",
  "simulator",
  "builder",
  "investigator",
  "recall",
] as const;
export const FamilyId = z.enum(FAMILY_IDS);
export type FamilyId = z.infer<typeof FamilyId>;

export const EncounterRole = z.enum(["teach", "practice", "review", "boss"]);
export type EncounterRole = z.infer<typeof EncounterRole>;

export const Importance = z.enum(["core", "supporting"]);
export type Importance = z.infer<typeof Importance>;

export const PaletteId = z.enum(["ember", "tide", "moss", "dusk", "parchment", "neon"]);
export type PaletteId = z.infer<typeof PaletteId>;
export const MusicMood = z.enum(["curious", "tense", "playful", "noir", "boss", "calm"]);
export type MusicMood = z.infer<typeof MusicMood>;
export const VoiceArchetype = z.enum([
  "narrator",
  "wise_mentor",
  "gruff_guard",
  "cheerful_sidekick",
  "sly_villain",
  "nervous_scholar",
]);
export type VoiceArchetype = z.infer<typeof VoiceArchetype>;

/** Stable ids are lowercase snake_case. Enforced on stored documents, never in LLM-facing schemas. */
export const ID_PATTERN = /^[a-z][a-z0-9_]{0,47}$/;
export const Id = z.string().regex(ID_PATTERN, "ids must be lowercase snake_case");

/**
 * Where a claim came from in the uploaded file. The quote must appear verbatim on that page;
 * ingest checks this in code before the fact ever reaches a game.
 * (No string-length rules here: this schema is also sent to the model.)
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

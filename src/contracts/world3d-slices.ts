import { z } from "zod";
import { VoiceArchetype } from "./common";
import { asTuple } from "./slices";
import {
  Ambience,
  ArchStyle,
  Biome,
  ClothColor,
  ClusterKind,
  CoastSide,
  Headwear,
  HeldProp,
  HudTheme,
  LandmarkRole,
  Material,
  NpcBehavior,
  Outfit,
  PathStyle,
  RewardKind,
  ScatterKind,
  ScatterZone,
  SkinTone,
  SkyMood,
  StructureKind,
  TerrainFeatureKind,
  WaterKind,
  Weather,
  WildlifeKind,
  type World3D,
} from "./world3d";

/*
 * LLM-FACING schemas for the 3D open world (docs/design/60-world3d.md §2.5): the World Architect's slice and the two
 * critics' verdicts. Same rules as src/contracts/slices.ts (OpenAI strict structured outputs): every field required,
 * .nullable() not .optional(), no z.record, single-value z.enum not z.literal, no string min/max/regex, every integer
 * bounded, .describe() is prompt text. tests/strict-schemas.test.ts walks the generated JSON Schema.
 *
 * The Architect's slice mirrors the stored World3D (src/contracts/world3d.ts) minus what code owns: version, seed,
 * provenance and terrain.size (code picks the size from the game length and bounds every point to ±size/2). Ids the
 * model must reference from the job (encounters, concepts, cast) are enums; ids it invents (landmarks, npcs, clusters,
 * collectibles) are free strings that code normalizes and checks (src/world3d/core/validate.ts).
 */

// ---------------------------------------------------------------- World Architect (CODER tier)

type Stored = World3D;
type Pt = { x: number; z: number };

export interface World3DArchitectSlice {
  biome: Stored["biome"];
  setting: Stored["setting"];
  terrain: Omit<Stored["terrain"], "size">;
  atmosphere: Stored["atmosphere"];
  landmarks: Stored["landmarks"];
  clusters: Stored["clusters"];
  scatter: Stored["scatter"];
  paths: Stored["paths"];
  wildlife: Stored["wildlife"];
  npcs: Stored["npcs"];
  quest: Stored["quest"];
  moments: { encounterId: string; anchor: { npcId: string | null; landmarkId: string | null }; objective: string; approach: { speaker: string; text: string }[]; success: { speaker: string; text: string }[]; reward: Stored["moments"][number]["reward"]; opens: string | null }[];
  collectibles: { label: string; items: { id: string; at: Pt; title: string; fact: string; conceptId: string | null }[] };
  spawn: Stored["spawn"];
  opening: Stored["opening"];
  ui: Stored["ui"];
  audio: Stored["audio"];
}

export interface World3DArchitectArgs {
  /** the game's encounter ids (one moment each; acts list them) */
  encounterIds: readonly string[];
  /** the game's concept ids (npc topics, collectibles) */
  conceptIds: readonly string[];
  /** the Director's cast (npc.characterId) */
  characterIds: readonly string[];
  /** edge length of the square map in metres; every point is bounded to ±size/2 */
  size: number;
}

export function world3dArchitectSchema(args: World3DArchitectArgs): z.ZodType<World3DArchitectSlice> {
  const half = args.size / 2;
  const coord = (axis: string) => z.number().min(-half).max(half).describe(`metres from the map centre along ${axis}`);
  const point = () => z.object({ x: coord("x (east +)"), z: coord("z (SOUTH +)") });
  const encounterId = z.enum(asTuple(args.encounterIds, "encounter ids"));
  const conceptId = z.enum(asTuple(args.conceptIds, "concept ids"));
  const characterId = args.characterIds.length > 0 ? z.enum(asTuple(args.characterIds, "character ids")).nullable() : z.null();
  const yaw = (what: string) => z.number().min(0).max(360).describe(`${what} in degrees: 0 = facing south (+z), 90 = east, 180 = north, 270 = west`);
  const line = z.object({
    speaker: z.string().describe('An npc id from your npcs, "narrator" (a caption) or "you" (the player)'),
    text: z.string().describe("20 words max, in the speaker's voice. Never state or hint at an answer"),
  });

  const feature = z.object({
    kind: TerrainFeatureKind,
    at: point(),
    radius: z.number().min(8).max(400).describe("footprint radius in metres"),
    height: z.number().min(-120).max(220).describe("peak height in metres (negative digs: valley, crater, basin)"),
  });
  const landmark = z.object({
    id: z.string().describe("unique lowercase snake_case id"),
    kind: StructureKind,
    name: z.string().describe("shown on the HUD: under 24 characters"),
    at: point(),
    rotation: yaw("which way its front door faces"),
    scale: z.number().min(0.2).max(4).describe("1 = the kind's natural size (see the catalog)"),
    material: Material,
    style: ArchStyle,
    role: LandmarkRole.describe('"goal" exactly once (the quest destination), "hub" where the story starts, "poi" for places with a moment, "decor" otherwise'),
    description: z.string().describe("one or two sentences for the codex, under 200 characters"),
  });
  const cluster = z.object({
    id: z.string().describe("unique lowercase snake_case id"),
    kind: ClusterKind,
    at: point(),
    radius: z.number().min(8).max(160),
    count: z.number().int().min(1).max(30).describe("how many pieces code scatters"),
    material: Material,
    style: ArchStyle,
  });
  const scatter = z.object({
    kind: ScatterKind,
    density: z.number().min(0).max(1),
    zone: ScatterZone,
    landmarkId: z.string().nullable().describe("around_landmark only: that landmark's id; null otherwise"),
  });
  const path = z.object({
    from: z.string().describe('"spawn" or a landmark id'),
    to: z.string().describe("a landmark id"),
    style: PathStyle,
  });
  const wildlife = z.object({
    kind: WildlifeKind,
    count: z.number().int().min(1).max(40),
    zone: ScatterZone,
    landmarkId: z.string().nullable().describe("around_landmark only: that landmark's id; null otherwise"),
  });
  const npc = z.object({
    id: z.string().describe("unique lowercase snake_case id"),
    characterId: characterId.describe("the cast member this npc embodies, or null for a world-only character"),
    name: z.string().describe("under 24 characters"),
    role: z.string().describe("a few words, e.g. Master scribe of the House of Life"),
    at: point(),
    facing: yaw("which way they face"),
    look: z.object({
      skin: SkinTone,
      outfit: Outfit,
      color: ClothColor,
      accent: ClothColor,
      headwear: Headwear,
      held: HeldProp,
      height: z.number().min(0.85).max(1.15).describe("0.85..1.15 of an average adult"),
    }),
    behavior: NpcBehavior,
    voiceArchetype: VoiceArchetype,
    greeting: z.string().describe("the first thing they say when the player walks up, under 180 characters"),
    barks: z.array(z.string().describe("an ambient line heard in passing, under 100 characters")).min(0).max(3),
    persona: z
      .string()
      .describe("who they are, how they talk, what they know and care about, grounded in the student's facts; under 500 characters; never shown verbatim"),
    topics: z.array(conceptId).min(0).max(8).describe("concept ids they can talk about in free chat"),
  });
  const moment = z.object({
    encounterId,
    anchor: z
      .object({ npcId: z.string().nullable(), landmarkId: z.string().nullable() })
      .describe("exactly one of npcId / landmarkId is set; it must match the encounter's socket"),
    objective: z.string().describe('the quest-log line while this moment is open, under 70 characters ("Ask Nebet how the flood feeds the fields")'),
    approach: z.array(line).min(1).max(3).describe("1-3 lines when the player arrives: set the scene and give a reason to take the challenge"),
    success: z.array(line).min(1).max(2).describe("1-2 lines after a correct answer: the world changes"),
    reward: z.object({
      kind: RewardKind,
      name: z.string().describe("under 24 characters"),
      description: z.string().describe("one short sentence, under 140 characters"),
    }),
    opens: z.string().nullable().describe("a gate, tomb or bridge landmark id that opens when this moment is solved, or null"),
  });

  return z.object({
    biome: Biome,
    setting: z.object({
      era: z.string().describe('e.g. "Old Kingdom Egypt, c. 2560 BCE", under 80 characters'),
      place: z.string().describe('e.g. "The Giza plateau above the Nile", under 80 characters'),
      style: ArchStyle,
    }),
    terrain: z.object({
      relief: z.number().min(0).max(1).describe("0 = flat plain, 1 = rugged mountains; 0.2-0.4 keeps the ground walkable"),
      features: z.array(feature).min(0).max(12),
      water: z.object({
        kind: WaterKind,
        level: z.number().min(-40).max(60).describe("water surface height in metres; 0 is usual"),
        course: z.array(point()).min(0).max(24).describe("river only: 2-24 points from one map edge to another; empty otherwise"),
        width: z.number().min(4).max(80).describe("river width in metres"),
        coast: CoastSide.nullable().describe("ocean only: the map edge the sea lies along; null otherwise"),
      }),
    }),
    atmosphere: z.object({
      mood: SkyMood,
      weather: Weather,
      fog: z.number().min(0).max(1),
      wind: z.number().min(0).max(1),
    }),
    landmarks: z.array(landmark).min(2).max(24),
    clusters: z.array(cluster).min(0).max(6),
    scatter: z.array(scatter).min(0).max(10),
    paths: z.array(path).min(0).max(24).describe("walkways linking the spawn, the hub, every anchored landmark and the goal"),
    wildlife: z.array(wildlife).min(0).max(6),
    npcs: z.array(npc).min(1).max(12),
    quest: z.object({
      goal: z.object({
        title: z.string().describe("what the player must do, under 48 characters"),
        description: z.string().describe("one or two sentences, under 200 characters"),
        landmarkId: z.string().describe('the id of the one landmark with role "goal"'),
      }),
      acts: z
        .array(
          z.object({
            id: z.string().describe("snake_case, e.g. act_1"),
            title: z.string().describe("under 40 characters"),
            summary: z.string().describe("one sentence, under 160 characters"),
            encounterIds: z.array(encounterId).min(1).max(args.encounterIds.length),
          }),
        )
        .min(1)
        .max(4)
        .describe("2-4 acts in story order; every encounter in exactly one act; the finale in the last"),
    }),
    moments: z
      .array(moment)
      .min(args.encounterIds.length)
      .max(args.encounterIds.length)
      .describe("exactly one per encounter"),
    collectibles: z.object({
      label: z.string().describe('what they are called in this world, e.g. "Scarab amulets"'),
      items: z
        .array(
          z.object({
            id: z.string().describe("unique lowercase snake_case id"),
            at: point(),
            title: z.string().describe("under 24 characters"),
            fact: z.string().describe("a TRUE fun fact from the student's material, under 200 characters"),
            conceptId: conceptId.nullable(),
          }),
        )
        .min(0)
        .max(12),
    }),
    spawn: z.object({ at: point(), facing: yaw("the player's starting direction (toward the goal)") }),
    opening: z.object({
      caption: z.string().describe('the title card under the game title, e.g. "Giza · c. 2560 BCE"'),
      flyover: z.array(z.string()).min(1).max(5).describe("landmark ids the opening camera flies past, ending on the goal"),
    }),
    ui: z.object({ hudTheme: HudTheme, accent: ClothColor }),
    audio: z.object({ ambience: Ambience }),
  }) as unknown as z.ZodType<World3DArchitectSlice>;
}

// ---------------------------------------------------------------- Critics (SMART tier, or CRITIC_MODEL)

export const STORY_CRITERIA = [
  "goal_clarity",
  "coherence_and_stakes",
  "character_voice",
  "learning_woven_in",
  "factual_accuracy",
  "fun_vs_focus",
  "pacing",
  "age_appropriate",
] as const;
export type StoryCriterion = (typeof STORY_CRITERIA)[number];

export const WORLD_CRITERIA = ["navigation_clarity", "composition", "visual_coherence", "hud_readability", "travel_pacing", "performance_budget"] as const;
export type WorldCriterion = (typeof WORLD_CRITERIA)[number];

export interface CriticScore {
  score: number;
  note: string;
}
export interface CriticIssue {
  /** what the fix applies to: "moments[e3_selma].approach", "npc nebet", "landmark obelisk_1", "quest.goal" */
  target: string;
  problem: string;
  fix: string;
}
export interface StoryCriticSlice {
  scores: Record<StoryCriterion, CriticScore>;
  issues: CriticIssue[];
  pass: boolean;
}
export interface WorldCriticSlice {
  scores: Record<WorldCriterion, CriticScore>;
  issues: CriticIssue[];
  pass: boolean;
}

function criticSchema(criteria: readonly string[]) {
  const score = z.object({
    score: z.number().int().min(1).max(5).describe("1 = broken, 3 = acceptable, 5 = excellent"),
    note: z.string().describe("one short sentence: why this score"),
  });
  return z.object({
    scores: z.object(Object.fromEntries(criteria.map((c) => [c, score]))),
    issues: z
      .array(
        z.object({
          target: z.string().describe('what to change, e.g. "moments[e3_selma].approach", "npc nebet", "landmark obelisk_1", "quest.goal"'),
          problem: z.string().describe("what is wrong, concretely"),
          fix: z.string().describe("the change the World Architect should make"),
        }),
      )
      .min(0)
      .max(12)
      .describe("concrete, fixable issues, most important first; empty when there is nothing worth changing"),
    pass: z.boolean().describe("true when this world is ready to ship to a student as it is"),
  });
}

export function storyCriticSchema(): z.ZodType<StoryCriticSlice> {
  return criticSchema(STORY_CRITERIA) as unknown as z.ZodType<StoryCriticSlice>;
}

export function worldCriticSchema(): z.ZodType<WorldCriticSlice> {
  return criticSchema(WORLD_CRITERIA) as unknown as z.ZodType<WorldCriticSlice>;
}

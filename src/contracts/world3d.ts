import { z } from "zod";
import { Id, VoiceArchetype } from "./common";

/*
 * World3D: the open-world 3D layer of a `world3d` GameSpec (docs/design/60-world3d.md).
 *
 * The GameSpec still owns the learning: encounters (graded by the mechanic families), lessons, narrative and
 * assessment. The World3D says WHERE and HOW that learning happens in a 3D place: the terrain, sky, landmarks,
 * characters, the quest that gives the player one clear goal, and a "moment" per encounter that anchors its challenge
 * to a character or a landmark and frames it in the story.
 *
 * Like the rest of the product it is DATA, never generated code. The World Architect (the CODER tier, gpt-6-astra)
 * writes the LLM-facing slice (src/contracts/world3d-slices.ts); code composes, checks and repairs it into this stored
 * form; the renderer (src/world3d, src/game/world3d) is a pure function of it plus the seed. Everything spatial is in
 * metres on the ground plane: `x` grows east, `z` grows SOUTH (three.js convention), the origin is the map centre,
 * and every point lies inside ±terrain.size/2.
 *
 * This is the STORED schema (fixtures, jsonb): lengths and regexes are fine here.
 */

export const WORLD3D_VERSION = 1 as const;

// ---------------------------------------------------------------- vocabularies (the 3D component library's menu)

/** Ground cover, palette and default scatter of the whole map (src/world3d/core/biomes.ts). */
export const BIOMES = [
  "desert",
  "grassland",
  "forest",
  "tropical",
  "alpine",
  "volcanic",
  "arctic",
  "canyon",
  "wetland",
  "coast",
  "lunar",
] as const;
export const Biome = z.enum(BIOMES);
export type Biome = z.infer<typeof Biome>;

/** Curated sky + light rigs (sun angle, colour grade, fog colour); the LLM picks a mood, code owns the colours. */
export const SKY_MOODS = ["dawn", "morning", "midday", "golden_hour", "dusk", "overcast", "storm", "night"] as const;
export const SkyMood = z.enum(SKY_MOODS);
export type SkyMood = z.infer<typeof SkyMood>;

export const WEATHERS = ["clear", "haze", "mist", "light_rain", "snow", "dust", "ash"] as const;
export const Weather = z.enum(WEATHERS);
export type Weather = z.infer<typeof Weather>;

/** Shapes added to the base noise terrain. Negative `height` digs (valley, crater, basin). */
export const TERRAIN_FEATURES = ["mountain", "hill", "ridge", "valley", "crater", "plateau", "mesa", "dunes", "volcano", "basin"] as const;
export const TerrainFeatureKind = z.enum(TERRAIN_FEATURES);
export type TerrainFeatureKind = z.infer<typeof TerrainFeatureKind>;

export const WATER_KINDS = ["none", "river", "lake", "ocean"] as const;
export const WaterKind = z.enum(WATER_KINDS);
export type WaterKind = z.infer<typeof WaterKind>;

/** Which map edge the ocean lies along (ocean only). */
export const COAST_SIDES = ["north", "south", "east", "west"] as const;
export const CoastSide = z.enum(COAST_SIDES);
export type CoastSide = z.infer<typeof CoastSide>;

/**
 * Procedural structures in the 3D component library (src/world3d/kit/structures). Each is built from primitives with
 * PBR materials, so any of them can take any material and architectural style.
 */
export const STRUCTURE_KINDS = [
  "pyramid",
  "step_pyramid",
  "obelisk",
  "temple",
  "colonnade",
  "ruins",
  "tower",
  "lighthouse",
  "keep",
  "wall",
  "gate",
  "arch",
  "bridge",
  "house",
  "hut",
  "tent",
  "market_stall",
  "statue",
  "sphinx",
  "monolith",
  "stone_circle",
  "observatory",
  "windmill",
  "well",
  "dock",
  "boat",
  "shrine",
  "cave_mouth",
  "campfire",
  "research_station",
  "greenhouse",
  "amphitheater",
  "aqueduct",
  "tomb",
  "palace",
  "workshop",
  "library",
  "beacon",
] as const;
export const StructureKind = z.enum(STRUCTURE_KINDS);
export type StructureKind = z.infer<typeof StructureKind>;

export const MATERIALS = [
  "sandstone",
  "limestone",
  "marble",
  "granite",
  "basalt",
  "brick",
  "adobe",
  "plaster",
  "wood",
  "thatch",
  "metal",
  "glass",
  "ice",
  "crystal",
  "gold",
] as const;
export const Material = z.enum(MATERIALS);
export type Material = z.infer<typeof Material>;

export const ARCH_STYLES = [
  "ancient_egypt",
  "classical",
  "medieval",
  "east_asian",
  "mesoamerican",
  "nordic",
  "rustic",
  "industrial",
  "modern",
  "futuristic",
] as const;
export const ArchStyle = z.enum(ARCH_STYLES);
export type ArchStyle = z.infer<typeof ArchStyle>;

/** What a landmark is for: `goal` is the quest's destination (exactly one), `hub` is where the story starts. */
export const LANDMARK_ROLES = ["goal", "hub", "poi", "decor"] as const;
export const LandmarkRole = z.enum(LANDMARK_ROLES);
export type LandmarkRole = z.infer<typeof LandmarkRole>;

/** Groups code expands into many small structures (a village of houses, a farm of fields, a harbour of boats). */
export const CLUSTER_KINDS = ["village", "camp", "farmland", "ruins_field", "market", "grove", "quarry", "harbor"] as const;
export const ClusterKind = z.enum(CLUSTER_KINDS);
export type ClusterKind = z.infer<typeof ClusterKind>;

/** Instanced vegetation and rocks. */
export const SCATTER_KINDS = [
  "palm",
  "conifer",
  "broadleaf",
  "birch",
  "dead_tree",
  "bush",
  "reeds",
  "tall_grass",
  "flowers",
  "cactus",
  "rock",
  "boulder",
  "crystal",
  "mushroom",
  "coral",
  "ice_shard",
  "crop",
] as const;
export const ScatterKind = z.enum(SCATTER_KINDS);
export type ScatterKind = z.infer<typeof ScatterKind>;

export const SCATTER_ZONES = ["everywhere", "near_water", "lowlands", "highlands", "around_landmark", "along_paths"] as const;
export const ScatterZone = z.enum(SCATTER_ZONES);
export type ScatterZone = z.infer<typeof ScatterZone>;

export const PATH_STYLES = ["dirt", "stone", "sand", "grass", "boardwalk"] as const;
export const PathStyle = z.enum(PATH_STYLES);
export type PathStyle = z.infer<typeof PathStyle>;

/** Ambient creatures: the non-educational life of the world (and a little fun: some can be petted or followed). */
export const WILDLIFE_KINDS = ["cat", "dog", "goat", "camel", "horse", "bird_flock", "butterflies", "fireflies", "fish", "ibis"] as const;
export const WildlifeKind = z.enum(WILDLIFE_KINDS);
export type WildlifeKind = z.infer<typeof WildlifeKind>;

// ---- characters

export const NPC_BEHAVIORS = ["idle", "work", "wander", "sit", "guard", "wave", "study"] as const;
export const NpcBehavior = z.enum(NPC_BEHAVIORS);
export type NpcBehavior = z.infer<typeof NpcBehavior>;

export const SKIN_TONES = ["tone1", "tone2", "tone3", "tone4", "tone5", "tone6", "tone7", "tone8"] as const;
export const SkinTone = z.enum(SKIN_TONES);
export type SkinTone = z.infer<typeof SkinTone>;

export const OUTFITS = ["tunic", "robe", "toga", "kilt", "armor", "work_clothes", "coat", "dress", "lab_coat", "uniform", "cloak"] as const;
export const Outfit = z.enum(OUTFITS);
export type Outfit = z.infer<typeof Outfit>;

export const HEADWEAR = ["none", "hood", "wide_hat", "cap", "helmet", "headdress", "turban", "scarf", "crown", "hard_hat", "wreath"] as const;
export const Headwear = z.enum(HEADWEAR);
export type Headwear = z.infer<typeof Headwear>;

export const HELD_PROPS = ["none", "staff", "scroll", "lantern", "tool", "book", "basket", "spear", "tablet", "torch"] as const;
export const HeldProp = z.enum(HELD_PROPS);
export type HeldProp = z.infer<typeof HeldProp>;

/** Named cloth colours; code maps them to curated PBR albedos so outfits never clash with the grade. */
export const CLOTH_COLORS = [
  "linen",
  "cream",
  "ochre",
  "terracotta",
  "crimson",
  "indigo",
  "teal",
  "emerald",
  "olive",
  "charcoal",
  "brown",
  "gold",
  "violet",
  "sky",
] as const;
export const ClothColor = z.enum(CLOTH_COLORS);
export type ClothColor = z.infer<typeof ClothColor>;

// ---- presentation

/** The diegetic skin for dialogue, challenge and journal panels (src/game/world3d/ui/themes.ts). */
export const HUD_THEMES = ["papyrus", "stone", "parchment", "glass", "tech", "wood", "ice"] as const;
export const HudTheme = z.enum(HUD_THEMES);
export type HudTheme = z.infer<typeof HudTheme>;

export const AMBIENCES = ["wind", "desert", "forest", "ocean", "river", "city", "cave", "night", "volcano"] as const;
export const Ambience = z.enum(AMBIENCES);
export type Ambience = z.infer<typeof Ambience>;

export const REWARD_KINDS = ["key", "relic", "map_fragment", "tool", "insight", "blessing"] as const;
export const RewardKind = z.enum(REWARD_KINDS);
export type RewardKind = z.infer<typeof RewardKind>;

/**
 * The world3d genre's sockets (src/library/genres.ts SOCKETS.world3d): how an encounter is framed in the world.
 * conversation = talk it through with a character; inscription = a carving, sign or tablet to read, decode or complete;
 * artifact = objects to examine, sort or assemble; device = an instrument or mechanism to operate; vista = survey the
 * land from an overlook; seal = a sealed gate, bridge or door that opens on success; finale = the goal (boss).
 */
export const WORLD3D_SOCKETS = ["conversation", "inscription", "artifact", "device", "vista", "seal", "finale"] as const;
export type World3DSocket = (typeof WORLD3D_SOCKETS)[number];

// ---------------------------------------------------------------- stored shapes

/** A point on the ground plane, metres from the map centre (`z` grows south). */
export const Point = z.object({ x: z.number().finite(), z: z.number().finite() });
export type Point = z.infer<typeof Point>;

/** Who says a line: an npc id, "narrator" (caption, no speaker) or "you" (the player's own words). */
export const SpeakerRef = z.union([Id, z.literal("narrator"), z.literal("you")]);
export const WorldLine = z.object({ speaker: SpeakerRef, text: z.string().min(1).max(220) });
export type WorldLine = z.infer<typeof WorldLine>;

export const TerrainFeature = z.object({
  kind: TerrainFeatureKind,
  at: Point,
  /** footprint radius in metres */
  radius: z.number().min(8).max(400),
  /** peak height (or depth, when negative) in metres */
  height: z.number().min(-120).max(220),
});
export type TerrainFeature = z.infer<typeof TerrainFeature>;

export const Terrain = z.object({
  /** edge length of the square map in metres (code picks it from the game length) */
  size: z.number().int().min(240).max(1200),
  /** 0 = flat plain, 1 = rugged mountains (scales the base noise) */
  relief: z.number().min(0).max(1),
  features: z.array(TerrainFeature).max(16),
  water: z.object({
    kind: WaterKind,
    /** water surface height in metres (terrain around 0; lower than most land) */
    level: z.number().min(-40).max(60),
    /** river only: its course from one map edge to another, 2-24 points; empty for the other kinds */
    course: z.array(Point).max(24),
    /** river width in metres (ignored for lake/ocean/none) */
    width: z.number().min(4).max(80),
    /** ocean only: the coast side; null otherwise */
    coast: CoastSide.nullable(),
  }),
});
export type Terrain = z.infer<typeof Terrain>;

export const Landmark = z.object({
  id: Id,
  kind: StructureKind,
  name: z.string().min(1).max(40),
  at: Point,
  /** yaw in degrees, 0 = facing south (towards +z) */
  rotation: z.number().min(0).max(360),
  /** 1 = the kind's natural size (a pyramid is ~140 m across at 1; a well ~3 m) */
  scale: z.number().min(0.2).max(4),
  material: Material,
  style: ArchStyle,
  role: LandmarkRole,
  /** one or two sentences the codex and hover card show */
  description: z.string().min(1).max(240),
});
export type Landmark = z.infer<typeof Landmark>;

export const Cluster = z.object({
  id: Id,
  kind: ClusterKind,
  at: Point,
  radius: z.number().min(8).max(160),
  /** how many pieces code scatters (houses, fields, stalls, boats, stones) */
  count: z.number().int().min(1).max(30),
  material: Material,
  style: ArchStyle,
});
export type Cluster = z.infer<typeof Cluster>;

export const Scatter = z.object({
  kind: ScatterKind,
  /** 0..1 of the kind's maximum density */
  density: z.number().min(0).max(1),
  zone: ScatterZone,
  /** around_landmark only: which landmark; null otherwise */
  landmarkId: Id.nullable(),
});
export type Scatter = z.infer<typeof Scatter>;

export const WorldPath = z.object({
  /** landmark ids (or "spawn") at the two ends; code routes the path over the terrain */
  from: z.union([Id, z.literal("spawn")]),
  to: Id,
  style: PathStyle,
});
export type WorldPath = z.infer<typeof WorldPath>;

export const Wildlife = z.object({
  kind: WildlifeKind,
  count: z.number().int().min(1).max(40),
  zone: ScatterZone,
  landmarkId: Id.nullable(),
});
export type Wildlife = z.infer<typeof Wildlife>;

export const NpcLook = z.object({
  skin: SkinTone,
  outfit: Outfit,
  color: ClothColor,
  accent: ClothColor,
  headwear: Headwear,
  held: HeldProp,
  /** 0.85..1.15 of average adult height; children and giants are out of scope */
  height: z.number().min(0.85).max(1.15),
});
export type NpcLook = z.infer<typeof NpcLook>;

export const Npc = z.object({
  id: Id,
  /** the GameSpec character this npc embodies (the Director's cast), or null for a world-only character */
  characterId: Id.nullable(),
  name: z.string().min(1).max(32),
  role: z.string().min(1).max(60),
  at: Point,
  /** yaw in degrees, 0 = facing south */
  facing: z.number().min(0).max(360),
  look: NpcLook,
  behavior: NpcBehavior,
  voiceArchetype: VoiceArchetype,
  /** first thing they say when the player walks up */
  greeting: z.string().min(1).max(220),
  /** short ambient lines heard in passing (0-3) */
  barks: z.array(z.string().min(1).max(120)).max(3),
  /** who they are, how they talk, what they know and care about (drives free chat; never shown verbatim) */
  persona: z.string().min(1).max(600),
  /** concept ids they can talk about in free chat */
  topics: z.array(Id).max(8),
});
export type Npc = z.infer<typeof Npc>;

export const Reward = z.object({ kind: RewardKind, name: z.string().min(1).max(40), description: z.string().min(1).max(160) });
export type Reward = z.infer<typeof Reward>;

/**
 * One per encounter: where its challenge lives and how the story frames it. The encounter's socket says what kind of
 * place it is (conversation, inscription, ...); the anchor says which npc or landmark hosts it.
 */
export const Moment = z.object({
  encounterId: Id,
  /** exactly one of npcId / landmarkId is set */
  anchor: z.object({ npcId: Id.nullable(), landmarkId: Id.nullable() }),
  /** the quest-log line while this moment is open ("Ask Nebet how the flood feeds the fields") */
  objective: z.string().min(1).max(90),
  /** spoken or narrated when the player arrives, leading into the challenge (1-3 lines) */
  approach: z.array(WorldLine).min(1).max(3),
  /** after a correct answer (1-2 lines) */
  success: z.array(WorldLine).min(1).max(2),
  reward: Reward,
  /** a landmark (gate, bridge, seal) that opens when this moment is solved, or null */
  opens: Id.nullable(),
});
export type Moment = z.infer<typeof Moment>;

/** A story chapter: which moments belong to it. Acts play in order; moments inside an act follow the unlock graph. */
export const Act = z.object({
  id: Id,
  title: z.string().min(1).max(48),
  summary: z.string().min(1).max(200),
  encounterIds: z.array(Id).min(1),
});
export type Act = z.infer<typeof Act>;

export const Collectible = z.object({
  id: Id,
  at: Point,
  title: z.string().min(1).max(48),
  /** a fun, true fact tied to the material */
  fact: z.string().min(1).max(220),
  conceptId: Id.nullable(),
});
export type Collectible = z.infer<typeof Collectible>;

/** An LLM critic's verdict, stored so the play page and the forge can show that the world was reviewed. */
export const CriticReport = z.object({
  critic: z.enum(["story", "world", "vision"]),
  model: z.string().min(1),
  pass: z.boolean(),
  /** rubric scores, 1-5 */
  scores: z.array(z.object({ criterion: z.string().min(1), score: z.number().min(1).max(5), note: z.string() })),
  issues: z.array(z.string()),
  /** how many repair rounds the architect ran for this critic */
  rounds: z.number().int().min(0).max(5),
});
export type CriticReport = z.infer<typeof CriticReport>;

export const World3D = z.object({
  version: z.literal(WORLD3D_VERSION),
  /** every procedural choice (noise, scatter, cluster layout, wildlife) derives from this */
  seed: z.number().int().nonnegative(),
  biome: Biome,
  setting: z.object({
    /** "Old Kingdom Egypt, c. 2560 BCE" */
    era: z.string().min(1).max(80),
    /** "The Giza plateau above the Nile" */
    place: z.string().min(1).max(80),
    style: ArchStyle,
  }),
  terrain: Terrain,
  atmosphere: z.object({
    mood: SkyMood,
    weather: Weather,
    /** 0 = crystal clear, 1 = thick */
    fog: z.number().min(0).max(1),
    /** 0 = still, 1 = gale (grass, trees, particles, cloth) */
    wind: z.number().min(0).max(1),
  }),
  landmarks: z.array(Landmark).min(2).max(32),
  clusters: z.array(Cluster).max(10),
  scatter: z.array(Scatter).max(14),
  paths: z.array(WorldPath).max(32),
  wildlife: z.array(Wildlife).max(8),
  npcs: z.array(Npc).min(1).max(12),
  quest: z.object({
    goal: z.object({ title: z.string().min(1).max(64), description: z.string().min(1).max(240), landmarkId: Id }),
    acts: z.array(Act).min(1).max(4),
  }),
  moments: z.array(Moment).min(1),
  collectibles: z.object({
    /** what they are called in this world ("Scarab amulets") */
    label: z.string().min(1).max(32),
    items: z.array(Collectible).max(20),
  }),
  spawn: z.object({ at: Point, facing: z.number().min(0).max(360) }),
  opening: z.object({
    /** the title card under the game title ("Giza · 2560 BCE") */
    caption: z.string().min(1).max(120),
    /** landmarks the opening camera flies past, in order, ending on the goal */
    flyover: z.array(Id).min(1).max(5),
  }),
  ui: z.object({ hudTheme: HudTheme, accent: ClothColor }),
  audio: z.object({ ambience: Ambience }),
  /** who built it and what the LLM critics said (absent in hand-authored fixtures) */
  provenance: z
    .object({
      source: z.enum(["astra", "composer", "fixture"]),
      model: z.string().nullable(),
      reviews: z.array(CriticReport),
      /** code fixes applied while composing (moved an npc off a cliff, added a bridge, ...) */
      fixes: z.array(z.string()),
    })
    .optional(),
});
export type World3D = z.infer<typeof World3D>;

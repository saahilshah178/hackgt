import type { LanguageModel } from "ai";
import type { GameSpec } from "../../contracts/gamespec";
import type { Intake, KnowledgeMap } from "../../contracts/knowledge";
import {
  AMBIENCES,
  ARCH_STYLES,
  CLUSTER_KINDS,
  HUD_THEMES,
  MATERIALS,
  PATH_STYLES,
  SCATTER_ZONES,
  SKY_MOODS,
  WEATHERS,
  WORLD3D_VERSION,
  type World3D,
} from "../../contracts/world3d";
import { world3dArchitectSchema, type World3DArchitectSlice } from "../../contracts/world3d-slices";
import { buildProgression } from "../../game/runner/progression";
import { getCard } from "../../library";
import { BIOMES } from "../../world3d/core/biomes";
import { BIOME_SCATTER, CLUSTERS, STRUCTURES, WILDLIFE } from "../../world3d/core/catalog";
import { runAgent, type Progress } from "../llm";
import { sharedContext } from "../prompts";
import { checkWorld, issueLines, mapSizeFor, walkBudgetMetres, type WorldCheck } from "./checks";
import { clampText, toId, toRef } from "./text";

/*
 * S10 World Architect (docs/design/60 §2.5 step 1-2): Astra (the CODER tier, gpt-6-astra) writes the World3D slice from
 * the finished game (premise, cast, every encounter with its socket and challenge text, never the solution), the
 * student's facts and lessons, the component catalog and the map size. Code converts the slice to the stored World3D
 * (`fromSlice`: ids normalized, texts fitted to the stored limits, seed and size from the spec), composes it and runs
 * every referential and spatial rule; problems go back to Astra as repair notes, up to MAX_WORLD_REPAIRS rounds.
 */

export const WORLD_ARCHITECT_SYSTEM = `You are the World Architect of an educational game generator. The game is already designed: its story, cast and challenges are final. You build the 3D open world it is played in: the terrain, sky, landmarks and characters, the quest with ONE clear goal, and one "moment" per encounter that anchors its challenge to a character or a place and frames it in the story. Code composes what you write (snaps it to the ground, routes the paths, adds bridges, scatters plants) and checks it; problems come back to you as repair notes.

Coordinates: metres on the ground plane. x grows EAST, z grows SOUTH, the origin is the map centre, every point lies within ±size/2 (the task gives the size). Rotation and facing are degrees: 0 faces south (+z), 90 east, 180 north, 270 west.

The goal
- Exactly one landmark has role "goal": a big, recognisable structure (a pyramid, temple, lighthouse, observatory, keep, palace or tower, scaled up if needed) that the player can SEE from the spawn. Put the spawn 150-300 m from it with open ground between them, and keep hills and mountains behind the goal or off to the side, never in the line of sight.
- quest.goal points at that landmark; its title says in plain words what the player must do there.
- The finale (the boss encounter) is anchored to the goal landmark and belongs to the last act. The opening flyover ends on the goal.

Moments: exactly one per encounter
- Anchor each to exactly one npc (anchor.npcId) or one landmark (anchor.landmarkId), matching its socket: conversation -> an npc; inscription -> an obelisk, monolith, tomb or library; artifact -> a workshop, market stall or shrine; device -> an observatory, windmill, workshop or well; vista -> a tower, lighthouse or a landmark on high ground; seal -> a gate, tomb or bridge (and set opens to the landmark that opens); finale -> the goal.
- objective: the quest-log line, under 70 characters: a concrete action that names the person or place ("Ask Nebet how the flood feeds the fields").
- approach: 1-3 lines, 20 words max each, that set the scene, weave the concept into the story and give the player a reason to take on the challenge. success: 1-2 lines that show the world changing.
- NEVER state, hint at or confirm an answer, a computed value or which option is correct, in any line, name, fact or persona.
- reward: something from this world (key, relic, map fragment, tool, insight, blessing) with a name under 24 characters.

Acts
- 2-4 acts that follow the story arc: teach before test, then escalate toward the finale. Respect the unlock order in the task (never put an encounter in an act before one it requires). Every encounter in exactly one act.

Characters
- Every cast member appears as an npc with its characterId; add world-only npcs (characterId null) so every conversation moment has someone to talk to. At most 12 npcs, names under 24 characters.
- persona: who they are, how they talk, what they know and care about, grounded in the student's facts from the context (it drives free chat and is never shown). topics: the concept ids they can talk about.
- greeting (under 180 characters) and barks (under 100) in their own voice.

The place
- Choose biome, style, materials, mood and weather that flatter the setting and era and agree with each other (an Egyptian plateau: desert + ancient_egypt + limestone/sandstone at golden_hour; a Moon base: lunar + futuristic + metal at night).
- The hub (where the story starts) stands near the spawn. Keep consecutive moments within about 120 m of each other and the whole route inside the walking budget the task gives. Landmark footprints (radius × scale, in the catalog) at least 10 m apart.
- paths link the spawn, the hub, every anchored landmark and the goal (from "spawn" or a landmark id, to a landmark id).
- Nothing important in water or on a steep slope. Bridges go on the river course, docks on the shore, boats on the water.
- A little fun that stays on topic: animals to pet (cat, dog, goat, camel, horse), a vista, a boat, playful barks. Collectibles are TRUE fun facts taken from the student's material (never invented), each tied to a concept.
- Keep it lean: about 8-16 landmarks, up to 4 clusters, up to 8 scatter entries.
- ids: lowercase snake_case, unique across landmarks, clusters, npcs and collectibles; "spawn", "narrator" and "you" are reserved. A line's speaker is an npc id, "narrator" or "you".
- Write for a student: plain words, warm, age-appropriate.`;

/** Code-side repair rounds after Astra's first draft (docs/design/60 §2.5 step 2). */
export const MAX_WORLD_REPAIRS = 2;

// ---------------------------------------------------------------- prompt

function catalogText(): string {
  const structures = Object.entries(STRUCTURES).map(
    ([k, s]) => `- ${k}: radius ${s.radius} m, height ${s.height} m at scale 1, ${s.placement}${s.walkable ? ", walk-through" : ""}. ${s.describe}`,
  );
  const clusters = CLUSTER_KINDS.map((k) => {
    const p = CLUSTERS[k].pieces;
    return `${k} (${Array.isArray(p) ? [...new Set(p)].join(", ") : p})`;
  });
  const biomes = Object.entries(BIOMES).map(
    ([k, b]) => `- ${k} (${b.label}): natural scatter ${BIOME_SCATTER[k as keyof typeof BIOME_SCATTER].join(", ")}; wildlife ${b.defaultWildlife.join(", ") || "none"}; ambience ${b.ambience}`,
  );
  const wildlife = Object.entries(WILDLIFE).map(([k, w]) => `${k}${w.interactive ? " (pettable)" : ""}`);
  return [
    "## Structures (kind: footprint and height at scale 1, placement: what it is)",
    ...structures,
    `## Clusters (code expands them into pieces): ${clusters.join("; ")}`,
    "## Biomes",
    ...biomes,
    `## Sky moods: ${SKY_MOODS.join(", ")}. Weathers: ${WEATHERS.join(", ")}.`,
    `## Wildlife: ${wildlife.join(", ")}. Scatter zones: ${SCATTER_ZONES.join(", ")}.`,
    `## Materials: ${MATERIALS.join(", ")}. Styles: ${ARCH_STYLES.join(", ")}. Path styles: ${PATH_STYLES.join(", ")}.`,
    `## HUD themes (the dialogue and challenge panels' skin): ${HUD_THEMES.join(", ")}. Ambiences: ${AMBIENCES.join(", ")}.`,
  ].join("\n");
}

function encounterLines(spec: GameSpec): string[] {
  return spec.encounters.map((e) => {
    const card = getCard(e.teachingMechanicId);
    const acts = card ? ` The player ${card.playerAction}.` : "";
    const miss = e.targetMisconception ? ` It attacks the misconception "${e.targetMisconception}".` : "";
    return `- ${e.id} [${e.role}, socket ${e.socket}, concepts ${e.conceptIds.join(" + ")}, ${e.familyId}.${e.mode}]${acts} Challenge text: ${JSON.stringify(e.prompt)}.${miss}`;
  });
}

function unlockLines(spec: GameSpec): string[] {
  const p = buildProgression(spec);
  return p.nodes.map((n) => `- ${n.id}${n.isBoss ? " (finale)" : ""}: ${n.requires.length > 0 ? `requires ${n.requires.join(", ")}` : "open from the start"}`);
}

function storyLines(spec: GameSpec): string[] {
  const name = (id: string) => spec.characters.find((c) => c.id === id)?.name ?? id;
  return [
    ...spec.narrative.intro.map((l) => `- intro, ${name(l.speakerId)}: ${JSON.stringify(l.text)}`),
    ...spec.narrative.beats.map((b) => `- ${b.when} ${b.encounterId}, ${name(b.speakerId)}: ${JSON.stringify(b.text)}`),
    ...spec.narrative.outro.map((l) => `- outro, ${name(l.speakerId)}: ${JSON.stringify(l.text)}`),
  ];
}

function lessonLines(spec: GameSpec): string[] {
  return (spec.lessons ?? []).map((l) => {
    const name = spec.concepts.find((c) => c.id === l.conceptId)?.name ?? l.conceptId;
    return `- ${l.conceptId} (${name}): ${l.bigIdea} Key points: ${l.keyPoints.map((k) => k.text).join(" | ")}`;
  });
}

/** The Architect's prompt: the shared context first (prompt caching), then the game, the catalog, the map and the task. */
export function architectPrompt(spec: GameSpec, km: KnowledgeMap, intake: Intake): string {
  const size = mapSizeFor(spec.targetMinutes);
  const half = size / 2;
  const boss = spec.encounters.find((e) => e.role === "boss");
  const cast = spec.characters.map((c) => `- ${c.id}: ${c.name}, ${c.role} (${c.voiceArchetype})`);
  return [
    sharedContext(km, intake, "world3d"),
    `# Game: ${spec.title}\n${spec.premise}\nSetting: ${spec.theme.setting}. Tone: ${spec.theme.tone}. Music: ${spec.theme.musicMood}.`,
    `# Cast (each becomes an npc with that characterId)\n${cast.join("\n")}`,
    `# Encounters (each needs exactly one moment; the challenge text is what the player is asked, NOT the answer)\n${encounterLines(spec).join("\n")}`,
    `# Unlock order (an encounter opens once the ones it requires are solved)\n${unlockLines(spec).join("\n")}`,
    `# Story already written (keep your lines consistent with it)\n${storyLines(spec).join("\n")}`,
    `# Lessons (the big idea per concept: ground personas, dialogue and collectibles in these)\n${lessonLines(spec).join("\n")}`,
    `# Component catalog\n${catalogText()}`,
    `# Map\nThe map is ${size} m square: x and z both run from -${half} to ${half} (x east, z SOUTH, origin at the centre). This is a ${spec.targetMinutes}-minute game: the straight-line walk from the spawn through every moment in act order should stay under about ${Math.round(walkBudgetMetres(spec.targetMinutes) * 0.8)} m.`,
    `# Task\nDesign the World3D for this game.${boss ? ` The finale is ${boss.id}: anchor it to the goal landmark and put it in the last act.` : ""}`,
  ].join("\n\n");
}

// ---------------------------------------------------------------- slice <-> stored world

/** Stored-schema text limits (src/contracts/world3d.ts). */
const MAX = {
  era: 80,
  place: 80,
  landmarkName: 40,
  landmarkDescription: 240,
  npcName: 32,
  npcRole: 60,
  greeting: 220,
  bark: 120,
  persona: 600,
  line: 220,
  objective: 90,
  rewardName: 40,
  rewardDescription: 160,
  actTitle: 48,
  actSummary: 200,
  goalTitle: 64,
  goalDescription: 240,
  collectLabel: 32,
  collectTitle: 48,
  fact: 220,
  caption: 120,
} as const;

export interface FromSliceContext {
  seed: number;
  size: number;
  /** provenance.model: the Architect's model id */
  model: string | null;
}

/**
 * The stored World3D from an Architect slice: ids normalized to lowercase snake_case (every reference the same way, so
 * consistent references stay consistent), empty or over-long texts fitted to the stored limits (each recorded as a fix),
 * seed and map size from code. Referential and spatial problems are left for the checks to report.
 */
export function fromSlice(slice: World3DArchitectSlice, ctx: FromSliceContext): World3D {
  const fixes: string[] = [];
  const fit = (text: string, max: number, what: string, fallback: string) => {
    const t = text.trim();
    if (t.length === 0) {
      fixes.push(`filled the empty ${what}`);
      return clampText(fallback, max);
    }
    if (t.length > max) {
      fixes.push(`shortened the ${what} to ${max} characters`);
      return clampText(t, max);
    }
    return t;
  };
  const ref = (id: string | null) => (id === null || id.trim() === "" ? null : toId(id));
  const aroundOnly = (zone: string, id: string | null) => (zone === "around_landmark" ? ref(id) : null);
  const line = (l: { speaker: string; text: string }, what: string) => ({ speaker: toRef(l.speaker), text: fit(l.text, MAX.line, what, "…") });

  const water = slice.terrain.water;
  return {
    version: WORLD3D_VERSION,
    seed: ctx.seed,
    biome: slice.biome,
    setting: {
      era: fit(slice.setting.era, MAX.era, "era", "Long ago"),
      place: fit(slice.setting.place, MAX.place, "place", "A place worth exploring"),
      style: slice.setting.style,
    },
    terrain: {
      size: ctx.size,
      relief: slice.terrain.relief,
      features: slice.terrain.features.slice(0, 16),
      water: { ...water, course: water.kind === "river" ? water.course : [], coast: water.kind === "ocean" ? water.coast : null },
    },
    atmosphere: slice.atmosphere,
    landmarks: slice.landmarks.map((l) => ({
      ...l,
      id: toId(l.id, "landmark"),
      name: fit(l.name, MAX.landmarkName, `name of landmark "${l.id}"`, l.kind.replace(/_/g, " ")),
      description: fit(l.description, MAX.landmarkDescription, `description of landmark "${l.id}"`, l.name || l.kind),
    })),
    clusters: slice.clusters.map((c) => ({ ...c, id: toId(c.id, "cluster") })),
    scatter: slice.scatter.map((s) => ({ ...s, landmarkId: aroundOnly(s.zone, s.landmarkId) })),
    paths: slice.paths.map((p) => ({ from: toRef(p.from) === "spawn" ? "spawn" : toId(p.from), to: toId(p.to), style: p.style })),
    wildlife: slice.wildlife.map((w) => ({ ...w, landmarkId: aroundOnly(w.zone, w.landmarkId) })),
    npcs: slice.npcs.map((n) => ({
      ...n,
      id: toId(n.id, "npc"),
      name: fit(n.name, MAX.npcName, `name of npc "${n.id}"`, n.id),
      role: fit(n.role, MAX.npcRole, `role of npc "${n.id}"`, "Local"),
      greeting: fit(n.greeting, MAX.greeting, `greeting of npc "${n.id}"`, "Hello, traveller."),
      barks: n.barks.filter((b) => b.trim().length > 0).map((b, i) => fit(b, MAX.bark, `bark ${i + 1} of npc "${n.id}"`, "…")),
      persona: fit(n.persona, MAX.persona, `persona of npc "${n.id}"`, `${n.name}, ${n.role}.`),
      topics: [...new Set(n.topics)],
    })),
    quest: {
      goal: {
        title: fit(slice.quest.goal.title, MAX.goalTitle, "goal title", "Reach the goal"),
        description: fit(slice.quest.goal.description, MAX.goalDescription, "goal description", "Reach the goal."),
        landmarkId: toId(slice.quest.goal.landmarkId, "goal"),
      },
      acts: slice.quest.acts.map((a, i) => ({
        id: toId(a.id, `act_${i + 1}`),
        title: fit(a.title, MAX.actTitle, `title of act ${i + 1}`, `Part ${i + 1}`),
        summary: fit(a.summary, MAX.actSummary, `summary of act ${i + 1}`, `Part ${i + 1} of the story.`),
        encounterIds: a.encounterIds,
      })),
    },
    moments: slice.moments.map((m) => ({
      encounterId: m.encounterId,
      anchor: { npcId: ref(m.anchor.npcId), landmarkId: ref(m.anchor.landmarkId) },
      objective: fit(m.objective, MAX.objective, `objective of ${m.encounterId}`, "Solve the challenge here"),
      approach: m.approach.map((l, i) => line(l, `approach line ${i + 1} of ${m.encounterId}`)),
      success: m.success.map((l, i) => line(l, `success line ${i + 1} of ${m.encounterId}`)),
      reward: {
        kind: m.reward.kind,
        name: fit(m.reward.name, MAX.rewardName, `reward name of ${m.encounterId}`, "A reward"),
        description: fit(m.reward.description, MAX.rewardDescription, `reward description of ${m.encounterId}`, "Earned here."),
      },
      opens: ref(m.opens),
    })),
    collectibles: {
      label: fit(slice.collectibles.label, MAX.collectLabel, "collectibles label", "Keepsakes"),
      items: slice.collectibles.items.slice(0, 20).map((c) => ({
        ...c,
        id: toId(c.id, "collectible"),
        title: fit(c.title, MAX.collectTitle, `title of collectible "${c.id}"`, "Keepsake"),
        fact: fit(c.fact, MAX.fact, `fact of collectible "${c.id}"`, "…"),
      })),
    },
    spawn: slice.spawn,
    opening: { caption: fit(slice.opening.caption, MAX.caption, "opening caption", slice.setting.place), flyover: slice.opening.flyover.map((id) => toId(id)) },
    ui: slice.ui,
    audio: slice.audio,
    provenance: { source: "astra", model: ctx.model, reviews: [], fixes },
  };
}

/** The Architect slice a stored world corresponds to (drops version, seed, provenance and terrain.size). */
export function worldToSlice(w: World3D): World3DArchitectSlice {
  return {
    biome: w.biome,
    setting: w.setting,
    terrain: { relief: w.terrain.relief, features: w.terrain.features, water: w.terrain.water },
    atmosphere: w.atmosphere,
    landmarks: w.landmarks,
    clusters: w.clusters,
    scatter: w.scatter,
    paths: w.paths,
    wildlife: w.wildlife,
    npcs: w.npcs,
    quest: w.quest,
    moments: w.moments,
    collectibles: w.collectibles,
    spawn: w.spawn,
    opening: w.opening,
    ui: w.ui,
    audio: w.audio,
  };
}

// ---------------------------------------------------------------- the call

export interface ArchitectArgs {
  spec: GameSpec;
  km: KnowledgeMap;
  intake: Intake;
  model: LanguageModel;
  modelId: string;
  jobId: string;
  /** extra instructions appended to the prompt (the critics' repair note) */
  notes?: string;
  maxRepairs?: number;
  onProgress?: (p: Progress) => void;
}

export interface ArchitectResult {
  slice: World3DArchitectSlice;
  /** the checked, corrected world (provenance.fixes = slice fixes + composer fixes) */
  world: World3D;
  check: WorldCheck;
}

/**
 * One Architect draft, repaired until the code checks pass (runAgent's repair loop: every check failure becomes a repair
 * note with the previous answer). Throws AgentError when the world still fails after `maxRepairs` rounds.
 */
export async function runArchitect(a: ArchitectArgs): Promise<ArchitectResult> {
  const size = mapSizeFor(a.spec.targetMinutes);
  const passed = new Map<World3DArchitectSlice, { world: World3D; check: WorldCheck }>();
  const check = (slice: World3DArchitectSlice): string[] => {
    const draft = fromSlice(slice, { seed: a.spec.seed, size, model: a.modelId });
    const result = checkWorld(a.spec, draft);
    if (result.issues.length > 0) {
      const lines = issueLines(result.issues);
      const fixed = result.composed.fixes.slice(0, 6);
      return fixed.length > 0 ? [...lines, `(for reference, code already fixed: ${fixed.join("; ")})`] : lines;
    }
    const fixes = [...(draft.provenance?.fixes ?? []), ...result.composed.fixes];
    passed.set(slice, { world: { ...result.world, provenance: { source: "astra", model: a.modelId, reviews: [], fixes } }, check: result });
    return [];
  };
  const slice = await runAgent({
    jobId: a.jobId,
    agent: "world_architect",
    tier: "coder",
    model: a.model,
    schema: world3dArchitectSchema({
      encounterIds: a.spec.encounters.map((e) => e.id),
      conceptIds: a.spec.concepts.map((c) => c.id),
      characterIds: a.spec.characters.map((c) => c.id),
      size,
    }),
    system: WORLD_ARCHITECT_SYSTEM,
    prompt: architectPrompt(a.spec, a.km, a.intake) + (a.notes ?? ""),
    check,
    maxRepairs: a.maxRepairs ?? MAX_WORLD_REPAIRS,
    onProgress: a.onProgress,
  });
  const ok = passed.get(slice);
  // runAgent only returns an output whose check passed, and the check recorded it
  if (!ok) throw new Error("world_architect: the accepted draft has no recorded check");
  return { slice, world: ok.world, check: ok.check };
}

import type { LanguageModel } from "ai";
import type { GameSpec } from "../../contracts/gamespec";
import type { Intake, KnowledgeMap } from "../../contracts/knowledge";
import type { CriticReport, World3D } from "../../contracts/world3d";
import {
  STORY_CRITERIA,
  WORLD_CRITERIA,
  storyCriticSchema,
  worldCriticSchema,
  type CriticIssue,
  type CriticScore,
} from "../../contracts/world3d-slices";
import { getMode } from "../../mechanics/registry";
import { worldDigest } from "../../world3d/core/digest";
import { bannedValuesFor } from "../../world/answer-leak";
import { runAgent, type Progress } from "../llm";
import { sharedContext } from "../prompts";
import type { WorldCheck } from "./checks";

/*
 * The two LLM critics (docs/design/60 §2.5 step 3). They run in parallel on the SMART tier (or CRITIC_MODEL, so the
 * reviewer can be a different model from the author) and score a checked world against a rubric:
 *   - the Story Critic reads the world's words next to the student's facts and the challenges' answers (to spot leaks);
 *   - the World Critic reads a code-made digest (src/world3d/core/digest.ts): an ASCII map, sightlines, travel, density
 *     and every HUD string with its length.
 * Code, not the model, decides the verdict: every score ≥ CRITIC_MIN_SCORE and the mean ≥ CRITIC_PASS_MEAN. A failing
 * critic's issues go back to the Architect for one more round (src/pipeline/world3d/index.ts).
 */

export const CRITIC_MIN_SCORE = 3;
export const CRITIC_PASS_MEAN = 3.6;

export const STORY_CRITIC_SYSTEM = `You are the Story Critic for an educational 3D open-world game. A student will play it to learn from their own material. You review the world's story: the goal, the acts, the characters and every line they say, the moments that frame each challenge, and the collectibles' facts. Score each criterion from 1 (broken) to 5 (excellent); 3 is acceptable. Be specific and fair: a score below 3 must come with an issue that says how to fix it.

Rubric
- goal_clarity: the player always knows what they are ultimately trying to do and where; the goal title is plain and concrete.
- coherence_and_stakes: the setting, cast and moments tell one story with a reason to care; nothing contradicts the premise or the lines already written.
- character_voice: each character sounds like a distinct person (their role and voice), and their personas give free chat something real to draw on.
- learning_woven_in: every challenge feels like an action in the story at that place (reading the carving, asking the keeper, tuning the device), not trivia stapled on; the approach lines motivate it.
- factual_accuracy: every claim (dialogue, personas, descriptions, collectible facts) agrees with the student's facts in the context. Flag any claim that contradicts them, anything invented and presented as fact, and ANY line, name or fact that gives away or hints at a challenge's answer (the answers are listed for this purpose only).
- fun_vs_focus: there is some play and delight (animals, vistas, a boat, playful barks, fun facts), and none of it pulls the player away from the goal or off the topic.
- pacing: concepts are taught before they are tested, acts escalate toward the finale, and the finale at the goal pays the story off.
- age_appropriate: plain words, a warm tone, nothing frightening or inappropriate beyond what the material itself covers.

Issues: at most 12, most important first. target names the thing to change ("moments[e3_selma].approach", "npc nebet", "collectible scarab_2", "quest.goal"); problem says what is wrong; fix says exactly what to write or change. pass is true only if you would ship this story to a student as it is.`;

export const WORLD_CRITIC_SYSTEM = `You are the World Critic for an educational 3D open-world game. You cannot see the world, so code gives you a digest: an ASCII top-down map, a legend of every landmark and character, what the checks measured (sightline to the goal, reachability, the walk between moments), what the renderer will draw, and every HUD string with its length. Score each criterion from 1 (broken) to 5 (excellent); 3 is acceptable. Be specific: a score below 3 must come with an issue that says how to fix it.

Rubric
- navigation_clarity: the goal is visible from the spawn and reads as the destination; paths connect the spawn, the hub, the moments and the goal; landmarks work as waypoints; nothing important is cut off.
- composition: variety of landmark kinds and sizes, sensible spacing (not crowded, not empty), good sightlines and at least one vista; the hub near the spawn; big things framed against open ground.
- visual_coherence: biome, sky mood, weather, materials and architectural style agree with each other and with the era and setting.
- hud_readability: every HUD string is short, specific and in plain language; nothing over its budget (marked "!"); objectives say what to do and where.
- travel_pacing: the walk between moments fits the game's length with no long empty hops (over about 120 m) or zig-zags; the route builds toward the goal.
- performance_budget: landmark, cluster piece, scatter and wildlife counts are reasonable for a laptop (a few thousand solid props at most; tens of thousands of grass blades are fine).

Issues: at most 12, most important first. target names the thing to change ("landmark obelisk_1", "npc ipi", "moments[e2].objective", "atmosphere", "paths"); problem says what is wrong; fix says exactly what to change (with coordinates when moving something). pass is true only if you would ship this world as it is.`;

export type CriticKind = "story" | "world";

export interface CriticVerdict {
  kind: CriticKind;
  pass: boolean;
  mean: number;
  scores: { criterion: string; score: number; note: string }[];
  issues: CriticIssue[];
}

/** The pass rule, in code: every score ≥ CRITIC_MIN_SCORE and the mean ≥ CRITIC_PASS_MEAN. */
export function criticPasses(scores: readonly number[]): boolean {
  if (scores.length === 0) return false;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  return scores.every((s) => s >= CRITIC_MIN_SCORE) && mean >= CRITIC_PASS_MEAN;
}

function verdict(kind: CriticKind, criteria: readonly string[], slice: { scores: Record<string, CriticScore>; issues: CriticIssue[] }): CriticVerdict {
  const scores = criteria.map((criterion) => ({ criterion, score: slice.scores[criterion]?.score ?? 1, note: slice.scores[criterion]?.note ?? "" }));
  const values = scores.map((s) => s.score);
  const mean = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
  return { kind, pass: criticPasses(values), mean: Math.round(mean * 10) / 10, scores, issues: slice.issues };
}

/** The stored form (world3d.provenance.reviews). */
export function toCriticReport(v: CriticVerdict, model: string, rounds: number): CriticReport {
  return { critic: v.kind, model, pass: v.pass, scores: v.scores, issues: v.issues.map((i) => `${i.target}: ${i.problem} Fix: ${i.fix}`), rounds };
}

/** A critic's issues as repair-note lines for the Architect. */
export function criticRepairLines(v: CriticVerdict): string[] {
  const low = v.scores.filter((s) => s.score < CRITIC_MIN_SCORE).map((s) => `[${v.kind} critic] ${s.criterion} scored ${s.score}/5: ${s.note}`);
  return [...low, ...v.issues.map((i) => `[${v.kind} critic] ${i.target}: ${i.problem} Fix: ${i.fix}`)];
}

// ---------------------------------------------------------------- prompts

/** What each challenge's answer is, so the Story Critic can spot a line that gives it away (never sent to the Architect). */
function answerLines(spec: GameSpec): string[] {
  return spec.encounters.map((e) => {
    const mode = getMode(e.familyId, e.mode);
    const values = mode ? bannedValuesFor(mode, e.params, e.solution) : [];
    const answer = values.length > 0 ? values.map((v) => JSON.stringify(v)).join(", ") : JSON.stringify(e.solution).slice(0, 200);
    return `- ${e.id} [${e.socket}] asks ${JSON.stringify(e.prompt)}; answer: ${answer}`;
  });
}

function storyText(w: World3D): string {
  const npcName = (id: string) => w.npcs.find((n) => n.id === id)?.name ?? id;
  const speaker = (s: string) => (s === "narrator" || s === "you" ? s : npcName(s));
  const where = (m: World3D["moments"][number]) =>
    m.anchor.npcId ? `with ${npcName(m.anchor.npcId)}` : `at ${w.landmarks.find((l) => l.id === m.anchor.landmarkId)?.name ?? m.anchor.landmarkId}`;
  const order = w.quest.acts.flatMap((a) => a.encounterIds);
  const moments = [...w.moments].sort((a, b) => order.indexOf(a.encounterId) - order.indexOf(b.encounterId));
  const goal = w.landmarks.find((l) => l.id === w.quest.goal.landmarkId);
  return [
    `Setting: ${w.setting.era}; ${w.setting.place} (${w.biome}, ${w.setting.style}, ${w.atmosphere.mood}).`,
    `Opening caption: ${JSON.stringify(w.opening.caption)}`,
    `Goal: ${JSON.stringify(w.quest.goal.title)} at ${goal?.name ?? w.quest.goal.landmarkId} (${goal?.kind ?? "?"}). ${w.quest.goal.description}`,
    "Acts:",
    ...w.quest.acts.map((a) => `- ${a.id} ${JSON.stringify(a.title)}: ${a.summary} [${a.encounterIds.join(", ")}]`),
    "Characters:",
    ...w.npcs.map(
      (n) =>
        `- ${n.id} "${n.name}", ${n.role} (${n.voiceArchetype}${n.characterId ? `, plays cast member ${n.characterId}` : ""}). Persona: ${n.persona} Greeting: ${JSON.stringify(n.greeting)}. Barks: ${n.barks.map((b) => JSON.stringify(b)).join(" / ") || "none"}. Topics: ${n.topics.join(", ") || "none"}.`,
    ),
    "Moments in act order:",
    ...moments.map((m) =>
      [
        `- ${m.encounterId} ${where(m)}. Objective: ${JSON.stringify(m.objective)}`,
        ...m.approach.map((l) => `    approach, ${speaker(l.speaker)}: ${JSON.stringify(l.text)}`),
        ...m.success.map((l) => `    success, ${speaker(l.speaker)}: ${JSON.stringify(l.text)}`),
        `    reward: ${m.reward.kind} ${JSON.stringify(m.reward.name)}: ${m.reward.description}${m.opens ? ` (opens ${m.opens})` : ""}`,
      ].join("\n"),
    ),
    `Collectibles ("${w.collectibles.label}"):`,
    ...w.collectibles.items.map((c) => `- ${c.id} ${JSON.stringify(c.title)}: ${c.fact}${c.conceptId ? ` [${c.conceptId}]` : ""}`),
    "Landmarks:",
    ...w.landmarks.map((l) => `- ${l.id} "${l.name}" (${l.kind}, ${l.role}): ${l.description}`),
  ].join("\n");
}

export function storyCriticPrompt(spec: GameSpec, km: KnowledgeMap, intake: Intake, world: World3D): string {
  const cast = spec.characters.map((c) => `- ${c.id}: ${c.name}, ${c.role} (${c.voiceArchetype})`).join("\n");
  return [
    sharedContext(km, intake, "world3d"),
    `# Game: ${spec.title}\n${spec.premise}\nSetting: ${spec.theme.setting}. Tone: ${spec.theme.tone}.\n# Cast\n${cast}`,
    `# Challenges and their answers (for spotting leaks only: no line in the world may state or hint at these)\n${answerLines(spec).join("\n")}`,
    `# The world's story\n${storyText(world)}`,
    "# Task\nScore this story against the rubric and list the issues worth fixing.",
  ].join("\n\n");
}

export function worldCriticPrompt(spec: GameSpec, check: WorldCheck): string {
  return [
    `# Game: ${spec.title} (${spec.targetMinutes} minutes). Setting: ${spec.theme.setting}. Tone: ${spec.theme.tone}.`,
    worldDigest(spec, check.composed, check.report),
    "# Task\nScore this world against the rubric and list the issues worth fixing.",
  ].join("\n\n");
}

// ---------------------------------------------------------------- the calls

export interface CriticArgs {
  spec: GameSpec;
  km: KnowledgeMap;
  intake: Intake;
  /** the checked world, composed WITH scatter (the digest counts it) */
  check: WorldCheck;
  model: LanguageModel;
  jobId: string;
  onProgress?: (p: Progress) => void;
}

export async function runStoryCritic(a: CriticArgs): Promise<CriticVerdict> {
  const slice = await runAgent({
    jobId: a.jobId,
    agent: "story_critic",
    tier: "smart",
    model: a.model,
    schema: storyCriticSchema(),
    system: STORY_CRITIC_SYSTEM,
    prompt: storyCriticPrompt(a.spec, a.km, a.intake, a.check.world),
    onProgress: a.onProgress,
  });
  return verdict("story", STORY_CRITERIA, slice);
}

export async function runWorldCritic(a: CriticArgs): Promise<CriticVerdict> {
  const slice = await runAgent({
    jobId: a.jobId,
    agent: "world_critic",
    tier: "smart",
    model: a.model,
    schema: worldCriticSchema(),
    system: WORLD_CRITIC_SYSTEM,
    prompt: worldCriticPrompt(a.spec, a.check),
    onProgress: a.onProgress,
  });
  return verdict("world", WORLD_CRITERIA, slice);
}

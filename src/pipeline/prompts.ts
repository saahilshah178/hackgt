import type { Genre } from "../contracts/common";
import { conceptWeight, type Intake, type KnowledgeMap } from "../contracts/knowledge";
import type { TeachingMechanic } from "../contracts/library";
import type { BlueprintEncounter, BlueprintSlice, DirectorMenuFamily } from "../contracts/slices";
import { GENRE_INFO } from "../library/genres";
import { getFamily } from "../mechanics/registry";
import type { AnyFamilyMode } from "../mechanics/types";

/**
 * Identical for every agent in a job and placed FIRST in each prompt, so provider prompt caching
 * can reuse it across the parallel calls. Anything call-specific goes after it.
 */
export function sharedContext(km: KnowledgeMap, intake: Intake, genre: Genre): string {
  const units = km.units.map((u) => ({ id: u.id, name: u.name, learnerConfidence: intake.confidence[u.id] ?? 3 }));
  const concepts = km.concepts.map((c) => ({
    id: c.id,
    unit: c.unitId,
    name: c.name,
    type: c.knowledgeType,
    importance: c.importance,
    weight: conceptWeight(c, intake),
    summary: c.summary,
    objective: c.learningObjective,
    facts: c.facts.map((f) => (f.sourceRef ? `${f.statement} [p.${f.sourceRef.page}: "${f.sourceRef.quote}"]` : f.statement)),
    misconceptions: c.misconceptions.map((m) => `${m.belief} -> actually: ${m.correction}`),
    formulas: c.formulas.map((f) => `${f.label}: ${f.mathjs}`),
  }));
  return [
    `# Source: ${km.title} (${km.subject.domain} / ${km.subject.topic}, ${km.level})${km.unsourced ? " [UNSOURCED: from general knowledge]" : ""}`,
    `# Learner: goal=${intake.goal}, minutes=${intake.minutes}. Confidence is 1 (lost) to 5 (solid). Weight = (core ? 2 : 1) × (6 − confidence); higher weight = needs more practice.`,
    `# Genre: ${genre}`,
    `# How this genre plays: ${GENRE_INFO[genre].name}. ${GENRE_INFO[genre].coreLoop} Write the title, setting, premise, cast and every line for this perspective (not every genre has a walking hero).`,
    "# Units",
    JSON.stringify(units),
    "# Concepts",
    JSON.stringify(concepts, null, 1),
  ].join("\n");
}

/** The Director's menu: per family, its sockets in this genre and the shortlisted cards. */
export function directorMenu(families: readonly DirectorMenuFamily[], genre: Genre): string {
  return families
    .filter((f) => f.cards.length > 0)
    .map((f) => {
      const fam = getFamily(f.familyId);
      const skin = fam?.genres[genre]?.skin ?? "";
      const cards = f.cards
        .map(
          (c) =>
            `  - ${c.id} [${c.family}.${c.mode}, ${fam?.modes[c.mode]?.widget ?? "?"} widget] "${c.concept}": ${c.playerAction}. Breaks: "${c.misconception}".${c.genreNotes?.[genre] ? ` In this genre: ${c.genreNotes[genre]}.` : ""}`,
        )
        .join("\n");
      return `- family ${f.familyId} (${fam?.name ?? f.familyId}); sockets: ${f.sockets.join("/")}; look: ${skin}\n${cards}`;
    })
    .join("\n");
}

export const DIRECTOR_SYSTEM = `You are the Director of an educational game generator. You design the game's structure; other agents write the details.

Design rules:
- Every encounter makes the player USE the concept to win. If a player could win while ignoring the concept, choose another card.
- Weight toward weak concepts (high weight): each weak concept appears 2-3 times through DIFFERENT families; strong concepts once.
- Order: teach before practice; include one "review" of an earlier concept after at least two other encounters.
- The last encounter is the boss: it combines the 2-3 weakest concepts and uses the boss socket.
- Target a listed misconception whenever the card allows it (targetMisconception must be copied exactly from the concept's list, or null).
- Theme the whole game around the subject (e.g. cell biology -> a submarine inside a cell). 1-3 characters, one of them a helper.
- designNote tells the challenge writer what the encounter should make the player think about. Be specific.
- Vary how the player acts (each card lists its widget). With 5 or more encounters use at least 3 different widgets, and let multiple choice ("pick") and single sliders ("dial") together be at most a third of the encounters whenever the menu offers other cards for those concepts. Prefer sorting, ordering, linking, placing, building, typing and explaining.
- When the menu has an explain card (explainer.teach_back), use it for the weakest causal or process concept: explaining it in the player's own words is how they prove they understand it.`;

export const CHALLENGE_SYSTEM = `You are the Challenge Writer for one encounter of an educational game. You fill in the mechanic's params and all player-facing text.

Rules:
- Ground the challenge in the listed facts. If a fact has a [p.N: "quote"], copy that page and quote into sourceRef exactly; for unsourced topics use null.
- Build wrong options and wrongFeedback from the concept's listed misconceptions, especially the encounter's target misconception.
- Never write computed values (answers, periods, positions) as literal text. Use the mechanic's {{placeholders}}; code fills them in from the params.
- The prompt and first hint must not give the answer away. Hints climb: nudge -> method -> nearly the answer.
- The debriefLine names the concept outright and connects it to what the player just did.
- Keep every text short, concrete, and in the game's voice.`;

export const NARRATIVE_SYSTEM = `You are the Narrative Writer. Write short spoken lines that frame the game: an intro, an outro, and optional beats before/after encounters.
- 20 words max per line; lines will be voiced, so write for the ear.
- Characters stay in voice. The helper character gives encouragement, never answers.
- Never state a correct answer or a computed value.`;

export const ASSESSMENT_SYSTEM = `You are the Assessment Writer. Write the 3 post-check multiple-choice items for after the game.
- Cover the same concepts as the pre-check items listed in the prompt, with NEW questions (not rewordings).
- One unambiguous correct answer; three distractors drawn from real misconceptions.`;

export const PRECHECK_SYSTEM = `You are the Pre-check Writer. Write 3 quick multiple-choice items that measure the learner's weakest concepts before the game.
- One unambiguous correct answer; three distractors drawn from real misconceptions.
- Short prompts a student can answer in 20 seconds each.`;

export function directorPrompt(shared: string, menu: string, minEncounters: number, maxEncounters: number): string {
  return `${shared}\n\n# Cards available in this genre (choose only from these)\n${menu}\n\n# Task\nDesign the game blueprint with ${minEncounters}-${maxEncounters} encounters.`;
}

export function challengePrompt(
  shared: string,
  bp: BlueprintSlice,
  e: BlueprintEncounter,
  card: TeachingMechanic,
  mode: AnyFamilyMode,
  attemptNotes = "",
): string {
  const locked = card.lockedParams ? `\nLocked by the card (already set, do not write them): ${JSON.stringify(card.lockedParams)}` : "";
  return [
    shared,
    `# Game: ${bp.title}. ${bp.premise} Setting: ${bp.theme.setting}. Tone: ${bp.theme.tone}.`,
    `# Card: ${card.id} (${card.family}.${card.mode})\nConcept: ${card.concept}\nPlayer does: ${card.playerAction}\nMisconception it breaks: ${card.misconception}${card.authoringNotes ? `\nAuthoring notes: ${card.authoringNotes}` : ""}${locked}`,
    `# Mode: ${mode.name}\n${mode.authoringGuide}`,
    `# Your encounter\nENCOUNTER_ID: ${e.id}`,
    JSON.stringify(e, null, 1),
    attemptNotes,
  ].join("\n\n");
}

export function narrativePrompt(shared: string, bp: BlueprintSlice): string {
  const plan = bp.encounters.map((e) => `${e.id} (${e.role}, ${e.teachingMechanicId}): ${e.designNote}`).join("\n");
  const cast = bp.characters.map((c) => `${c.id}: ${c.name}, ${c.role} (${c.voiceArchetype})`).join("\n");
  return `${shared}\n\n# Game: ${bp.title}\n${bp.premise}\n# Cast\n${cast}\n# Encounters\n${plan}`;
}

export function assessmentPrompt(shared: string, preCheck: readonly { conceptId: string; prompt: string }[]): string {
  const pre = preCheck.map((q) => `- [${q.conceptId}] ${q.prompt}`).join("\n");
  return `${shared}\n\n# Pre-check items already asked (same concepts, do NOT reuse these questions)\n${pre}\n\n# Task\nWrite the post-check.`;
}

export function preCheckPrompt(shared: string, weakestConceptIds: readonly string[]): string {
  return `${shared}\n\n# Task\nWrite 3 pre-check items, one each for the weakest concepts: ${weakestConceptIds.join(", ")}.`;
}

/** Appended to a prompt when an agent's previous answer failed checks. */
export function repairNote(problems: readonly string[], previous?: unknown): string {
  const prev = previous === undefined ? "" : `\nYour previous answer:\n${JSON.stringify(previous)}`;
  return `\n\n# Fix these problems and answer again\n- ${problems.join("\n- ")}${prev}`;
}

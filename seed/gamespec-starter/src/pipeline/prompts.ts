import type { Genre } from "../contracts/common";
import type { Intake, KnowledgeMap } from "../contracts/knowledge";
import type { BlueprintEncounter, BlueprintSlice } from "../contracts/slices";
import { directorMenu } from "../mechanics/registry";

/**
 * Identical for every agent in a job and placed FIRST in each prompt, so provider prompt caching
 * can reuse it across the parallel calls. Anything call-specific goes after it.
 */
export function sharedContext(km: KnowledgeMap, intake: Intake, genre: Genre): string {
  const concepts = km.concepts.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.knowledgeType,
    summary: c.summary,
    learnerConfidence: intake.confidence[c.id] ?? 3,
    facts: c.facts.map((f) => (f.sourceRef ? `${f.statement} [p.${f.sourceRef.page}: "${f.sourceRef.quote}"]` : f.statement)),
    misconceptions: c.misconceptions.map((m) => `${m.belief} -> actually: ${m.correction}`),
  }));
  return [
    `# Source: ${km.title} (${km.subject}, ${km.level})${km.unsourced ? " [UNSOURCED: from general knowledge]" : ""}`,
    `# Learner: goal=${intake.goal}, minutes=${intake.minutes}. Confidence is 1 (lost) to 5 (solid).`,
    `# Genre: ${genre}`,
    "# Concepts",
    JSON.stringify(concepts, null, 1),
    "# Mechanics available in this genre",
    directorMenu(genre),
  ].join("\n");
}

export const DIRECTOR_SYSTEM = `You are the Director of an educational game generator. You design the game's structure; other agents write the details.

Design rules:
- Every encounter makes the player USE the concept to win. If a player could win while ignoring the concept, choose another mechanic.
- Weight toward weak concepts (low confidence): each weak concept appears 2-3 times through DIFFERENT mechanics; strong concepts once.
- Order: teach before practice; include one "review" of an earlier concept after at least two other encounters.
- The last encounter is the boss: it combines the 2-3 weakest concepts and uses the boss socket.
- Theme the whole game around the subject (e.g. cell biology -> a submarine inside a cell). 1-3 characters, one of them a helper.
- designNote tells the challenge writer what the encounter should make the player think about. Be specific.`;

export const CHALLENGE_SYSTEM = `You are the Challenge Writer for one encounter of an educational game. You fill in the mechanic's params and all player-facing text.

Rules:
- Ground the challenge in the listed facts. If a fact has a [p.N: "quote"], copy that page and quote into sourceRef exactly; for unsourced topics use null.
- Build wrong options and wrongFeedback from the concept's listed misconceptions.
- Never write computed values (answers, periods, positions) as literal text. Use the mechanic's {{placeholders}}; code fills them in from the params.
- The prompt and first hint must not give the answer away. Hints climb: nudge -> method -> nearly the answer.
- The debriefLine names the concept outright and connects it to what the player just did.
- Keep every text short, concrete, and in the game's voice.`;

export const NARRATIVE_SYSTEM = `You are the Narrative Writer. Write short spoken lines that frame the game: an intro, an outro, and optional beats before/after encounters.
- 20 words max per line; lines will be voiced, so write for the ear.
- Characters stay in voice. The helper character gives encouragement, never answers.
- Never state a correct answer or a computed value.`;

export const ASSESSMENT_SYSTEM = `You are the Assessment Writer. Write 3 pre-check and 3 post-check multiple-choice items covering the learner's weakest concepts.
- One unambiguous correct answer; three distractors drawn from real misconceptions.
- Post-check items test the same concepts with NEW questions, not rewordings of the pre-check.`;

export function directorPrompt(shared: string, minEncounters: number, maxEncounters: number): string {
  return `${shared}\n\n# Task\nDesign the game blueprint with ${minEncounters}-${maxEncounters} encounters.`;
}

export function challengePrompt(shared: string, bp: BlueprintSlice, e: BlueprintEncounter, attemptNotes = ""): string {
  return [
    shared,
    `# Game: ${bp.title}. ${bp.premise} Setting: ${bp.theme.setting}. Tone: ${bp.theme.tone}.`,
    `# Your encounter\nENCOUNTER_ID: ${e.id}`,
    JSON.stringify(e, null, 1),
    attemptNotes,
  ].join("\n\n");
}

export function narrativePrompt(shared: string, bp: BlueprintSlice): string {
  const plan = bp.encounters.map((e) => `${e.id} (${e.role}, ${e.mechanicId}): ${e.designNote}`).join("\n");
  const cast = bp.characters.map((c) => `${c.id}: ${c.name}, ${c.role} (${c.voiceArchetype})`).join("\n");
  return `${shared}\n\n# Game: ${bp.title}\n${bp.premise}\n# Cast\n${cast}\n# Encounters\n${plan}`;
}

export function assessmentPrompt(shared: string): string {
  return `${shared}\n\n# Task\nWrite the pre-check and post-check.`;
}

/** Appended to a prompt when an agent's previous answer failed checks. */
export function repairNote(problems: readonly string[], previous?: unknown): string {
  const prev = previous === undefined ? "" : `\nYour previous answer:\n${JSON.stringify(previous)}`;
  return `\n\n# Fix these problems and answer again\n- ${problems.join("\n- ")}${prev}`;
}

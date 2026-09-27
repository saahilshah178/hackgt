import type { Genre } from "../../contracts/common";
import type { KnowledgeMap } from "../../contracts/knowledge";
import type { BlueprintEncounter, BlueprintSlice, ChallengeSlice, NarrativeSlice } from "../../contracts/slices";
import { getCard } from "../../library";
import { BOSS_SOCKET } from "../../library/genres";
import { hashString } from "../../mechanics/util";
import { socketsFor } from "../../mechanics/registry";
import { fallbackMimic } from "../generate";

/*
 * Genre-agnostic mock mode. The canned Director/Challenge/Narrative replies were recorded against one
 * knowledge map, one intake and one matcher shortlist. A live mock job differs in three ways the strict
 * schema would reject: the encounter range (minutes), the card enum (the real matcher's picks), and the
 * misconception enum. So the mock Director ADAPTS its canned blueprint to the constraints it can read
 * from the prompt, pads with Mimic Chests built from the sample's knowledge map, and the mock Challenge
 * Writer serves those padded encounters the same way the pipeline's own fallback would.
 */

export interface DirectorConstraints {
  genre: Genre;
  min: number;
  max: number;
  cardIds: Set<string>;
  conceptIds: Set<string>;
}

/** Reads the constraints the Director schema was built from, straight out of the prompt text. */
export function parseDirectorConstraints(prompt: string, km: KnowledgeMap): DirectorConstraints {
  const genre = (/# Genre: (\w+)/.exec(prompt)?.[1] ?? "dungeon") as Genre;
  const range = /with (\d+)-(\d+) encounters/.exec(prompt);
  const min = range ? Number(range[1]) : 5;
  const max = range ? Number(range[2]) : 7;
  const menu = prompt.split("# Cards available in this genre")[1] ?? "";
  const cardIds = new Set([...menu.matchAll(/^\s+- ([a-z][a-z0-9_]*) \[/gm)].map((m) => m[1]));
  // The job's concepts are the shared context's "# Concepts" JSON block (one `"id": "c_x"` per concept).
  // A student who ticked a subset on the intake page runs the job on that subset (Intake.conceptIds),
  // so the canned blueprint must adapt to those ids, not the sample's full map.
  const known = new Set(km.concepts.map((c) => c.id));
  const block = prompt.split("# Concepts")[1]?.split("# Cards available in this genre")[0] ?? "";
  const listed = [...block.matchAll(/"id":\s*"([a-z][a-z0-9_]*)"/g)].map((m) => m[1]).filter((id) => known.has(id));
  const conceptIds = new Set(listed.length > 0 ? listed : km.concepts.map((c) => c.id));
  return { genre, min, max, cardIds, conceptIds };
}

/*
 * M5: mock state used to be keyed by sample id, so two concurrent jobs on the same sample (e.g. two
 * browser tabs both generating from the trig fixture) could race — the second job's Director call
 * would overwrite the first job's adapted blueprint in this memo, and the first job's challenge/
 * narrative writer calls would then read back the WRONG job's encounters. sharedContext() (prompts.ts)
 * is byte-identical for every writer call within one job (it's placed first in every prompt so a real
 * provider's prompt caching can reuse it), so hashing that shared block gives a per-job key that every
 * agent's prompt in that job can recompute independently, without threading a jobId through prompts
 * (prompts must stay identical between mock and live).
 */
const SHARED_CONTEXT_MARKERS = ["\n\n# Game:", "# Cards available in this genre"];

/** Extracts the shared-context block (everything before the first per-call marker) from a prompt's user text. */
function sharedContextBlock(userText: string): string {
  const indices = SHARED_CONTEXT_MARKERS.map((m) => userText.indexOf(m)).filter((i) => i >= 0);
  return indices.length > 0 ? userText.slice(0, Math.min(...indices)) : userText;
}

/** The per-job memo key: a hash of the prompt's shared-context block, recomputable from any agent's prompt in the same job. */
export function sharedContextKey(userText: string): string {
  return `sc_${hashString(sharedContextBlock(userText))}`;
}

const memo = new Map<string, BlueprintSlice>();

/** The blueprint the mock Director last produced for this job's shared context (so the mock writers can stay consistent). */
export function lastAdaptedBlueprint(key: string): BlueprintSlice | undefined {
  return memo.get(key);
}

function legalSocket(cardId: string, genre: Genre, boss: boolean): string | null {
  const card = getCard(cardId);
  if (!card) return null;
  const sockets = socketsFor(card.family, genre, BOSS_SOCKET[genre]);
  if (boss) return sockets.includes(BOSS_SOCKET[genre]) ? BOSS_SOCKET[genre] : null;
  return sockets.find((s) => s !== BOSS_SOCKET[genre]) ?? null;
}

export function adaptBlueprint(key: string, canned: BlueprintSlice, km: KnowledgeMap, c: DirectorConstraints): BlueprintSlice {
  const beliefs = new Set(km.concepts.flatMap((x) => x.misconceptions.map((m) => m.belief)));
  const mimicOk = c.cardIds.has("mimic_chest");
  const fixTarget = (t: string | null) => (t !== null && beliefs.has(t) ? t : null);

  // 1. keep canned encounters the schema can represent; fix their sockets and misconceptions
  let encounters: BlueprintEncounter[] = [];
  for (const e of canned.encounters) {
    if (!c.cardIds.has(e.teachingMechanicId) || !e.conceptIds.every((id) => c.conceptIds.has(id))) continue;
    const socket = legalSocket(e.teachingMechanicId, c.genre, e.role === "boss");
    if (!socket) continue;
    encounters.push({ ...e, socket, targetMisconception: fixTarget(e.targetMisconception) });
  }
  const bossIdx = encounters.findIndex((e) => e.role === "boss");
  let boss: BlueprintEncounter | null = bossIdx >= 0 ? encounters.splice(bossIdx, 1)[0] : null;
  encounters = encounters.filter((e) => e.role !== "boss");

  // only the job's concepts (a ticked subset, or the whole sample) get mimics and coverage
  const inJob = km.concepts.map((x) => x.id).filter((id) => c.conceptIds.has(id));
  const concepts = inJob.length > 0 ? inJob : km.concepts.map((x) => x.id);
  const mimicFor = (conceptId: string, role: BlueprintEncounter["role"], n: number): BlueprintEncounter | null => {
    if (!mimicOk) return null;
    const socket = legalSocket("mimic_chest", c.genre, role === "boss");
    if (!socket) return null;
    const concept = km.concepts.find((x) => x.id === conceptId);
    return {
      id: `mx_${conceptId}_${n}`,
      conceptIds: [conceptId],
      teachingMechanicId: "mimic_chest",
      socket,
      role,
      difficulty: 1,
      targetMisconception: concept?.misconceptions[0]?.belief ?? null,
      designNote: `Mock-mode filler: a Mimic Chest on ${concept?.name ?? conceptId} built from the notes.`,
    };
  };

  // 2. every concept needs a teaching encounter before anything else uses it
  let n = 0;
  const seen = new Set<string>();
  const ordered: BlueprintEncounter[] = [];
  for (const e of encounters) {
    const fresh = e.conceptIds.filter((id) => !seen.has(id));
    const role: BlueprintEncounter["role"] = fresh.length > 0 ? "teach" : e.role === "review" && ordered.length >= 2 ? "review" : e.role === "review" ? "practice" : e.role;
    ordered.push({ ...e, role });
    e.conceptIds.forEach((id) => seen.add(id));
  }
  for (const id of concepts) {
    if (seen.has(id)) continue;
    const m = mimicFor(id, "teach", n++);
    if (m) {
      ordered.push(m);
      seen.add(id);
    }
  }

  // 3. the boss: canned if representable, else a Mimic Chest on the first two concepts
  if (!boss || !c.cardIds.has(boss.teachingMechanicId)) {
    const m = mimicFor(concepts[0], "boss", n++);
    boss = m ? { ...m, conceptIds: concepts.slice(0, Math.min(2, concepts.length)), difficulty: 3 } : null;
  }
  if (boss) {
    for (const id of boss.conceptIds) {
      if (seen.has(id)) continue;
      const m = mimicFor(id, "teach", n++);
      if (m) {
        ordered.push(m);
        seen.add(id);
      }
    }
  }

  // 4. count: pad with practice mimics on already-taught concepts, or trim from the end (keeping coverage)
  const target = { min: c.min, max: c.max };
  let i = 0;
  while (ordered.length + 1 < target.min) {
    const m = mimicFor(concepts[i % concepts.length], "practice", n++);
    if (!m) break;
    ordered.push(m);
    i++;
  }
  while (ordered.length + 1 > target.max) {
    const idx = [...ordered.keys()].reverse().find((k) => ordered[k].role !== "teach" || ordered.filter((e) => e.conceptIds.some((id) => ordered[k].conceptIds.includes(id))).length > 1);
    if (idx === undefined) break;
    ordered.splice(idx, 1);
  }

  const result: BlueprintSlice = { ...canned, genre: c.genre, encounters: boss ? [...ordered, boss] : ordered };
  memo.set(key, result);
  return result;
}

/** A challenge for a padded (mx_*) encounter: the pipeline's own verified-facts Mimic Chest, or a plain one. */
export function mimicChallengeFor(km: KnowledgeMap, e: BlueprintEncounter, genre: Genre): ChallengeSlice {
  const fb = fallbackMimic(km, e, genre);
  if (fb) return fb.slice;
  const concept = km.concepts.find((x) => x.id === e.conceptIds[0]);
  const name = concept?.name ?? "this idea";
  const lie = concept?.misconceptions[0]?.belief ?? `${name} plays no part in ${km.subject.topic}.`;
  return {
    prompt: `Three claims about ${name}. One of them is false. Find it.`,
    params: {
      statements: [
        { text: concept?.summary ?? `${name} is part of ${km.subject.topic}.`, isTrue: true, explanation: "This matches the notes." },
        { text: lie, isTrue: false, explanation: concept?.misconceptions[0]?.correction ?? `The notes treat ${name} as central to ${km.subject.topic}.` },
        { text: concept?.learningObjective ?? `Understanding ${name} is a goal of these notes.`, isTrue: true, explanation: "This is the stated objective." },
      ],
    },
    hints: [`Think about what ${name} really means.`, "Two claims agree with your notes. Which one doesn't?", "The false claim is: {{mimic}}"],
    wrongFeedback: "That claim holds up. Look for the one that contradicts your notes.",
    debriefLine: `The false claim was "{{mimic}}".`,
    sourceRef: null,
  };
}

/** Narrative beats may only reference encounters that exist in the adapted blueprint. */
export function adaptNarrative(canned: NarrativeSlice, blueprint: BlueprintSlice | undefined): NarrativeSlice {
  if (!blueprint) return canned;
  const ids = new Set(blueprint.encounters.map((e) => e.id));
  const speakers = new Set(blueprint.characters.map((ch) => ch.id));
  const ok = (s: string) => speakers.has(s);
  return {
    intro: canned.intro.filter((l) => ok(l.speakerId)),
    outro: canned.outro.filter((l) => ok(l.speakerId)),
    beats: canned.beats.filter((b) => ids.has(b.encounterId) && ok(b.speakerId)),
  };
}

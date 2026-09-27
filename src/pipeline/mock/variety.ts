import type { KnowledgeMap } from "../../contracts/knowledge";
import type { BlueprintEncounter, BlueprintSlice, ChallengeSlice } from "../../contracts/slices";
import { getCard } from "../../library";
import { BOSS_SOCKET } from "../../library/genres";
import { varietyProblems } from "../../library/variety";
import { getMode, socketsFor } from "../../mechanics/registry";

/** Source-grounded constructive tasks for offline generation, not more MCQ padding. */
export function constructiveChallenge(km: KnowledgeMap, encounter: BlueprintEncounter): ChallengeSlice | null {
  const selected = km.concepts.filter(c => encounter.conceptIds.includes(c.id));
  const primary = selected[0];
  if (!primary) return null;
  const base = {
    hints: ["Compare each claim with what the source teaches.", "Focus on the precise relationship, not shared words.", "Use the defining fact to check each connection."],
    wrongFeedback: "One relationship contradicts the source. Reconsider the meaning of each claim.",
    sourceRef: primary.facts[0]?.sourceRef ?? null,
  };
  if (encounter.teachingMechanicId === "evidence_sort") {
    const facts = selected.flatMap(c => [...c.facts.map(f => f.statement), ...c.misconceptions.map(m => m.correction), c.summary]
      .map(text => ({ text, binId: "supported", why: "This agrees with the source." })));
    const errors = selected.flatMap(c => c.misconceptions.map(m => ({ text: m.belief, binId: "contradicted", why: m.correction })));
    const items = [...new Map([...errors.slice(0, 3), ...facts].map(item => [item.text.toLowerCase(), item])).values()].slice(0, 10);
    if (!facts.length || !errors.length || items.length < 4) return null;
    return { ...base, prompt: `Organize the evidence about ${primary.name}.`, params: {
      bins: [
        { id: "supported", label: "Supported by the source", feature: "Matches a fact or explanation in the source" },
        { id: "contradicted", label: "Contradicted by the source", feature: "Contains a listed misconception" },
      ], items,
    }, debriefLine: `You separated supported evidence from misconceptions about ${primary.name}.` };
  }
  if (encounter.teachingMechanicId === "concept_links") {
    const pairs = selected.flatMap(c => c.misconceptions.map(m => ({ left: m.belief, right: m.correction, why: "Look for the correction that addresses this specific mistaken relationship." })));
    // Additional source concepts provide enough distinct pairs for the reusable linker mechanic.
    for (const concept of km.concepts.filter(c => !selected.includes(c))) {
      if (pairs.length >= 3) break;
      pairs.push(...concept.misconceptions.map(m => ({ left: m.belief, right: m.correction, why: "Match the precise error to its explanation." })));
    }
    const unique = pairs.filter((pair, i) => pairs.findIndex(p => p.left === pair.left || p.right === pair.right) === i).slice(0, 6);
    if (unique.length < 3) return null;
    return { ...base, prompt: "Build a reasoning web: connect each misconception to the explanation that resolves it.",
      params: { pairs: unique, decoyRights: [] }, debriefLine: "You connected specific misconceptions to explanations grounded in the source." };
  }
  return null;
}

export function diversifyMockBlueprint(bp: BlueprintSlice, km: KnowledgeMap, cardIds: ReadonlySet<string>): BlueprintSlice {
  const encounters = bp.encounters.map(e => ({ ...e }));
  const menu = [...cardIds].map(getCard).filter((c): c is NonNullable<typeof c> => !!c);
  if (bp.genre === "puzzle" || bp.genre === "strategy") {
    const first = getCard(encounters[0]?.teachingMechanicId);
    const action = first && getMode(first.family, first.mode)?.widget;
    if (action === "pick" || action === "dial") {
      for (const id of ["evidence_sort", "concept_links"]) {
        if (!cardIds.has(id)) continue;
        const card = getCard(id)!;
        const socket = socketsFor(card.family, bp.genre, BOSS_SOCKET[bp.genre]).find(s => s !== BOSS_SOCKET[bp.genre]);
        const candidate = { ...encounters[0], teachingMechanicId: id, socket: socket ?? encounters[0].socket };
        if (socket && constructiveChallenge(km, candidate)) { encounters[0] = candidate; break; }
      }
    }
  }
  const problems = () => varietyProblems(encounters.map(e => getCard(e.teachingMechanicId)!), menu);
  // Replace repeated passive encounters from the end, preserving the original teaching examples where possible.
  for (let i = encounters.length - 2; i >= 0 && problems().length; i--) {
    const card = getCard(encounters[i].teachingMechanicId);
    const widget = card && getMode(card.family, card.mode)?.widget;
    const actionAt = (index: number) => {
      const neighbor = encounters[index] && getCard(encounters[index].teachingMechanicId);
      return neighbor && getMode(neighbor.family, neighbor.mode)?.widget;
    };
    const repeated = [i - 2, i - 1, i].some(start => start >= 0 && start + 2 < encounters.length &&
      actionAt(start) === widget && actionAt(start + 1) === widget && actionAt(start + 2) === widget);
    if (widget !== "pick" && widget !== "dial" && !repeated) continue;
    for (const id of [i % 2 ? "concept_links" : "evidence_sort", i % 2 ? "evidence_sort" : "concept_links"]) {
      if (!cardIds.has(id)) continue;
      const alternative = getCard(id)!;
      const nextWidget = getMode(alternative.family, alternative.mode)?.widget;
      if (nextWidget === widget) continue;
      const repeatsNeighbor = [i - 2, i - 1, i].some(start => start >= 0 && start + 2 < encounters.length &&
        [start, start + 1, start + 2].every(index => index === i || actionAt(index) === nextWidget));
      if (repeatsNeighbor) continue;
      const socket = socketsFor(alternative.family, bp.genre, BOSS_SOCKET[bp.genre]).find(s => s !== BOSS_SOCKET[bp.genre]);
      const candidate = { ...encounters[i], teachingMechanicId: id, socket: socket ?? encounters[i].socket };
      if (socket && constructiveChallenge(km, candidate)) { encounters[i] = candidate; break; }
    }
  }
  return { ...bp, encounters };
}

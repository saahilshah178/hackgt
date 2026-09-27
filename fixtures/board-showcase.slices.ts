import type { Slices } from "../src/pipeline/assemble";
import { cellSlices } from "./cell-transport.slices";
import { historySlices } from "./civil-rights.slices";
import type { ChallengeSlice } from "../src/contracts/slices";
import { regenre, type BlueprintEncounter } from "./regenre";
import { TEACH_BACK_CHALLENGES } from "./teach-back.challenges";
import { trigSlices } from "./trig.slices";

/*
 * The board-genre showcase: the three sample topics played in genres that are NOT a left-to-right walk. Each one
 * progresses its own way (routing power on a logic board, running a town day by day, combining clues in a case
 * file, walking a bird's-eye map, choosing story branches), on the braided free-order graph from
 * src/game/runner/progression.ts. Built by `pnpm fixtures:build`; never hand-edit the JSON.
 */


/** The base encounters with some swapped to a different card (same id, concepts, role and misconception). */
function swapCards(base: readonly BlueprintEncounter[], swaps: Record<string, Partial<BlueprintEncounter>>): BlueprintEncounter[] {
  return base.map((e) => (swaps[e.id] ? { ...e, ...swaps[e.id] } : e));
}

// ---------------------------------------------------------------- swapped-in challenges (non-dial, non-MCQ)

/** An explain-it-back encounter from fixtures/teach-back.challenges.ts, by concept. */
function teachBack(conceptId: string): { card: string; slice: ChallengeSlice } {
  const t = TEACH_BACK_CHALLENGES.find((c) => c.conceptId === conceptId);
  if (!t) throw new Error(`no teach-back challenge for ${conceptId}`);
  return { card: t.cardId, slice: t.slice };
}
const trigPeriodExplain = teachBack("c_period");
const cellOsmosisExplain = teachBack("c_osmosis");
const civilMontgomeryExplain = teachBack("c_montgomery");

/** Trig amplitude as matching: link each wave to its swing (was a multiple-choice mimic). */
const trigAmplitudePairs: ChallengeSlice = {
  prompt: "Four conduits hum on four different waves. Link each wave to how far it swings from its midline.",
  params: {
    pairs: [
      { left: "y = 3sin(x)", right: "3", why: "Amplitude is |A| = 3." },
      { left: "y = −2cos(x)", right: "2", why: "The minus sign flips the wave; the swing is |−2| = 2." },
      { left: "y = 0.5sin(4x)", right: "0.5", why: "The 4 changes the period, not the swing." },
      { left: "y = sin(x) + 4", right: "1", why: "Adding 4 moves the midline up; the swing is still 1." },
    ],
    decoyRights: ["6"],
  },
  hints: [
    "Amplitude is measured from the midline, not from peak to trough.",
    "Only the number multiplying sin or cos sets the swing; take its absolute value.",
    "Ignore the number inside the brackets and anything added on the end.",
  ],
  wrongFeedback: "Check what each number does: the multiplier sets the swing, the number inside sets the speed, and a number added on the end only moves the midline.",
  debriefLine: "Amplitude is |A|: you linked {{pairCount}} waves to their swing, ignoring period changes and midline shifts.",
  sourceRef: { page: 2, quote: "The amplitude of y = A sin x is |A|." },
};

/** Diffusion as a sequence: random motion → net flow → equilibrium (was a multiple-choice mimic). */
const cellDiffusionSteps: ChallengeSlice = {
  prompt: "A drop of dye lands in still water. Put what happens next in order. One step is a myth.",
  params: {
    steps: [
      "Every dye particle jiggles randomly, bumping into water molecules",
      "More particles start in the crowded spot, so more of them happen to wander out than in",
      "The result is a net flow from high concentration to low",
      "The dye spreads until its concentration is even everywhere",
      "Particles keep moving, but in and out now balance: no net flow",
    ],
    decoys: ["The particles head for the empty water because they need more space"],
  },
  hints: [
    "Start with what each single particle is doing, before any spreading happens.",
    "No particle has a goal: the spreading is what random motion adds up to.",
    "Motion doesn't stop at the end; only the net flow does.",
  ],
  wrongFeedback: "Diffusion has no purpose behind it: follow random motion to a net flow, and remember the motion never stops, only the imbalance does.",
  debriefLine: "Diffusion: {{count}} steps from random jiggling to an even spread, with no particle trying to go anywhere.",
  sourceRef: { page: 2, quote: "Because it is driven by the random motion of the particles themselves, diffusion requires no energy from the cell." },
};

/** Active transport as a causal chain: ATP → sodium gradient → glucose pulled uphill (was a multiple-choice mimic). */
const cellActiveChain: ChallengeSlice = {
  prompt: "The glucose carrier has to pull sugar uphill. Connect each link in the chain that powers it.",
  params: {
    nodes: [
      "The sodium-potassium pump spends ATP to push sodium out of the cell",
      "Sodium becomes far more concentrated outside than inside",
      "Sodium flowing back in, down its gradient, drives a co-transporter",
      "The co-transporter drags glucose in with it, against glucose's gradient",
      "Glucose builds up inside the cell, above the level outside",
    ],
    decoys: ["Glucose diffuses in on its own because the cell needs it"],
  },
  hints: [
    "Start with the only step that spends ATP directly.",
    "Something has to be pushed uphill first so it can flow back downhill.",
    "Sodium's return trip is what pays for glucose's climb.",
  ],
  wrongFeedback: "Uphill transport is always paid for somewhere: follow the energy from ATP, to the sodium gradient, to the carrier.",
  debriefLine: "Active transport runs on energy: ATP builds a sodium gradient, and that gradient drags glucose uphill.",
  sourceRef: { page: 3, quote: "Active transport moves substances against their concentration gradient, from low concentration to high, and requires energy from ATP." },
};

/** The burst-cell case as a causal chain: hypotonic drip → osmosis → lysis (was a timed category pick). */
const cellTonicityChain: ChallengeSlice = {
  prompt: "The drip bag, the swollen cells, the torn membranes. Rebuild the case: connect each event to what it caused.",
  params: {
    nodes: [
      "The patient receives a drip of nearly pure water",
      "The fluid around the red blood cells becomes hypotonic to them",
      "Water moves into the cells by osmosis",
      "The cells swell, with no cell wall to hold them in",
      "The stretched membranes tear and the cells burst",
    ],
    decoys: ["Salt rushes into the cells and drags water in after it"],
  },
  hints: [
    "Begin with what went into the patient.",
    "Name the solution relative to the cell before you move any water.",
    "Less solute outside means water flows in.",
  ],
  wrongFeedback: "Tonicity describes the solution relative to the cell: follow the water from the low-solute side to the high-solute side.",
  debriefLine: "Tonicity as a chain: a hypotonic drip sent water into the cells until they burst.",
  sourceRef: { page: 2, quote: "In a hypertonic solution the cell loses water and shrinks." },
};

/** Brown v. Board as fill-in-the-blank from the source sentence (was a multiple-choice mimic). */
const civilBrownCloze: ChallengeSlice = {
  prompt: "A torn clipping from May 1954 is missing its key word. Restore the Court's reasoning.",
  params: {
    sentence: "In Brown v. Board of Education (1954) the Supreme Court ruled unanimously that separate educational facilities are inherently ___.",
    answers: ["unequal"],
    wordBank: ["equal", "illegal", "expensive"],
    hint: "The ruling rejected the idea behind 'separate but equal'.",
  },
  hints: [
    "Think about the doctrine Brown overturned: 'separate but …'.",
    "The Court said separation itself was the problem, whatever the buildings looked like.",
    "The word is the opposite of the one in 'separate but equal'.",
  ],
  wrongFeedback: "Brown wasn't about money or law on paper: the Court said that separating children was itself the harm.",
  debriefLine: "Brown v. Board: separate schools are inherently {{answer}}, which overturned 'separate but equal', though enforcement took years.",
  sourceRef: { page: 1, quote: "In Brown v. Board of Education (1954) the Supreme Court ruled unanimously that separate educational facilities are inherently unequal." },
};

/** Trig on the logic board: no avatar, rotate conduit tiles so the resonance reaches each sealed tile. */
export const trigPuzzleSlices: Slices = regenre(trigSlices, {
  id: "trig_puzzle_001",
  createdAt: "2026-09-26T20:00:00.000Z",
  genre: "puzzle",
  title: "The Resonance Circuit",
  encounters: swapCards(trigSlices.blueprint.encounters, {
    e3_amplitude: { teachingMechanicId: "grapple_anchors" },
    e5_period_review: { teachingMechanicId: trigPeriodExplain.card },
  }),
  challenges: { e3_amplitude: trigAmplitudePairs, e5_period_review: trigPeriodExplain.slice },
  theme: {
    setting: "The observatory's brass circuit board, where every conduit carries a sine wave",
    tone: "calm, precise, satisfying clicks",
    paletteId: "tide",
    musicMood: "curious",
  },
  premise:
    "The observatory's orrery has gone dark. Its circuit board carries resonance from the source crystal to the core, but the conduits are twisted and five seals block the way. Route the wave and break every seal by reading its rhythm.",
  characters: [
    { id: "cog", name: "Cog", role: "brass owl who whistles when a conduit connects", voiceArchetype: "cheerful_sidekick" },
    { id: "warden", name: "The Core", role: "the orrery's heart, sealed until the circuit is whole", voiceArchetype: "gruff_guard" },
  ],
  narrative: {
    intro: [
      { speakerId: "cog", text: "The board is dead cold. Twist the conduits so the wave can flow, and when it touches a seal, crack it." },
    ],
    outro: [{ speakerId: "cog", text: "Hear that hum? The whole circuit resonates. The orrery turns again." }],
    beats: [
      { encounterId: "e2_period", when: "before", speakerId: "cog", text: "This seal pulses on a sine wave. Watch how fast, not how far." },
      { encounterId: "e6_boss", when: "before", speakerId: "warden", text: "Only a true period reaches my core." },
      { encounterId: "e6_boss", when: "after", speakerId: "warden", text: "Resonance accepted. The circuit is whole." },
    ],
  },
});

/** Cell transport as a cozy sim: the cell is a little town, molecules are villagers with requests. */
export const cellCozySlices: Slices = regenre(cellSlices, {
  id: "cell_cozy_001",
  createdAt: "2026-09-26T20:00:00.000Z",
  genre: "strategy",
  title: "Membrane Market",
  encounters: swapCards(cellSlices.blueprint.encounters, {
    e3_diffusion: { teachingMechanicId: "chrono_bridge" },
    e4_osmosis: { teachingMechanicId: cellOsmosisExplain.card },
    e7_active: { teachingMechanicId: "domino_engine" },
  }),
  challenges: { e3_diffusion: cellDiffusionSteps, e4_osmosis: cellOsmosisExplain.slice, e7_active: cellActiveChain },
  theme: {
    setting: "A sleepy harbour town built inside a cell, with the membrane as its sea wall and gates",
    tone: "cozy, warm, gently funny",
    paletteId: "moss",
    musicMood: "calm",
  },
  premise:
    "You have inherited the harbour office of a small cell-town. Every morning molecules queue at the sea wall with requests: let me in, let me out, pump me uphill. Answer them well, earn coins, and grow the town before the Harvest Festival.",
  characters: [
    { id: "pilot", name: "Mayor Ora", role: "the cheerful mayor who hands you each day's requests", voiceArchetype: "cheerful_sidekick" },
    { id: "gatekeeper", name: "Old Pump", role: "the sodium-potassium pump who runs the festival gate", voiceArchetype: "gruff_guard" },
  ],
  narrative: {
    intro: [{ speakerId: "pilot", text: "Morning, harbourmaster! The queue at the sea wall is already long. Nothing crosses without a reason." }],
    outro: [{ speakerId: "pilot", text: "Look at the town lit up for the festival. Everyone crossed the right way, at the right cost." }],
    beats: [
      { encounterId: "e2_selectivity", when: "before", speakerId: "pilot", text: "Watch the small ones. Small doesn't mean welcome." },
      { encounterId: "e11_boss", when: "before", speakerId: "gatekeeper", text: "Festival gate's mine. Show me you know what costs energy." },
      { encounterId: "e11_boss", when: "after", speakerId: "gatekeeper", text: "Sorted true. Light the lanterns." },
    ],
  },
});

/** Cell transport as a point-and-click case: why did the red blood cell burst? */
export const cellCasefileSlices: Slices = regenre(cellSlices, {
  id: "cell_casefile_001",
  createdAt: "2026-09-26T20:00:00.000Z",
  genre: "mystery",
  title: "The Case of the Burst Cell",
  encounters: swapCards(cellSlices.blueprint.encounters, {
    e3_diffusion: { teachingMechanicId: "chrono_bridge" },
    e4_osmosis: { teachingMechanicId: cellOsmosisExplain.card },
    e5_tonicity: { teachingMechanicId: "domino_engine" },
  }),
  challenges: { e3_diffusion: cellDiffusionSteps, e4_osmosis: cellOsmosisExplain.slice, e5_tonicity: cellTonicityChain },
  theme: {
    setting: "A hospital lab at night: a ruptured red blood cell, a drip bag, a microscope and a cold cup of coffee",
    tone: "noir, curious, a little dry",
    paletteId: "dusk",
    musicMood: "noir",
  },
  premise:
    "A patient's red blood cells are bursting after a transfusion. Search the lab for clues, pair clues into leads, and crack each lead until you can name what really happened at the membrane.",
  characters: [
    { id: "pilot", name: "Dr. Ora", role: "night-shift pathologist and your partner on the case", voiceArchetype: "wise_mentor" },
    { id: "gatekeeper", name: "The Pump", role: "the prime suspect, a sodium-potassium pump that never stops working", voiceArchetype: "sly_villain" },
  ],
  narrative: {
    intro: [{ speakerId: "pilot", text: "Three cells burst in an hour. Something crossed that membrane that shouldn't have. Let's look around." }],
    outro: [{ speakerId: "pilot", text: "Case closed: the membrane did exactly what physics told it to. We just had to read it." }],
    beats: [
      { encounterId: "e2_selectivity", when: "before", speakerId: "pilot", text: "Small isn't the same as welcome. Remember that." },
      { encounterId: "e11_boss", when: "before", speakerId: "gatekeeper", text: "You think I did it? Prove what costs energy and what doesn't." },
      { encounterId: "e11_boss", when: "after", speakerId: "gatekeeper", text: "Fine. I only pump. Everything else simply flowed." },
    ],
  },
});

/** Civil rights as a narrative adventure: letters, meetings and choices on the road from 1954 to 1965. */
export const civilStorySlices: Slices = regenre(historySlices, {
  id: "history_story_001",
  createdAt: "2026-09-26T20:00:00.000Z",
  genre: "story",
  title: "Letters to Selma",
  encounters: swapCards(historySlices.blueprint.encounters, {
    e1_brown: { teachingMechanicId: "context_reconstruction" },
    e2_montgomery: { teachingMechanicId: civilMontgomeryExplain.card },
  }),
  challenges: { e1_brown: civilBrownCloze, e2_montgomery: civilMontgomeryExplain.slice },
  theme: {
    setting: "A young reporter's notebook, 1954 to 1965: kitchens, church basements, lunch counters and courthouse steps",
    tone: "earnest, human, respectful of the real people involved",
    paletteId: "parchment",
    musicMood: "calm",
  },
  premise:
    "Your editor has sent you south with a notebook and one instruction: understand how it happened, not just what happened. Each chapter, the people you meet ask you to explain what you have seen, and your answers decide where the story goes next.",
  characters: [
    { id: "archivist", name: "Ida", role: "a veteran organiser who reads your notebook", voiceArchetype: "wise_mentor" },
    { id: "editor", name: "The Editor", role: "the voice on the telephone waiting for your final story", voiceArchetype: "narrator" },
  ],
  narrative: {
    intro: [
      { speakerId: "editor", text: "Anyone can list the dates. I want to know why it happened, and I want it by 1965." },
    ],
    outro: [{ speakerId: "archivist", text: "You didn't just write down what happened. You understood how people made it happen." }],
    beats: [
      { encounterId: "e2_montgomery", when: "before", speakerId: "archivist", text: "Folks will tell you she was just tired. Ask who was ready when she said no." },
      { encounterId: "e12_boss", when: "before", speakerId: "editor", text: "Deadline. Tell me which explanation holds up." },
      { encounterId: "e12_boss", when: "after", speakerId: "editor", text: "That's the story. Run it." },
    ],
  },
});

/** Civil rights as a top-down map: travel a bird's-eye South, city to city, opening the roads between them. */
export const civilExplorerSlices: Slices = regenre(historySlices, {
  id: "history_explorer_001",
  createdAt: "2026-09-26T20:00:00.000Z",
  genre: "explorer",
  title: "The Road to Selma",
  encounters: swapCards(historySlices.blueprint.encounters, { e1_brown: { teachingMechanicId: "context_reconstruction" } }),
  challenges: { e1_brown: civilBrownCloze },
  theme: {
    setting: "A bird's-eye map of the South, 1954 to 1965: highways, bus depots, churches and courthouses",
    tone: "purposeful, respectful, quietly hopeful",
    paletteId: "ember",
    musicMood: "curious",
  },
  premise:
    "Roads on this map only open once you understand what happened at the place they lead from. Travel from Topeka to Selma in whatever order you choose, and piece together how a decade of organising changed the law.",
  characters: [
    { id: "archivist", name: "Ida", role: "an organiser who rides along and reads the map with you", voiceArchetype: "wise_mentor" },
    { id: "editor", name: "The Editor", role: "waiting at the end of the road in Montgomery", voiceArchetype: "narrator" },
  ],
  narrative: {
    intro: [{ speakerId: "archivist", text: "Every road on this map was opened by people who organised. Let's see how." }],
    outro: [{ speakerId: "archivist", text: "Selma to Montgomery. You walked the whole road and you know why it mattered." }],
    beats: [
      { encounterId: "e2_montgomery", when: "before", speakerId: "archivist", text: "Montgomery. Ask who was ready when she said no." },
      { encounterId: "e12_boss", when: "before", speakerId: "editor", text: "Last stop. Which explanation of the movement holds up?" },
      { encounterId: "e12_boss", when: "after", speakerId: "editor", text: "That's the road, and that's the story." },
    ],
  },
});

export const BOARD_SHOWCASE: { slices: Slices; file: string }[] = [
  { slices: trigPuzzleSlices, file: "trig-puzzle.json" },
  { slices: cellCozySlices, file: "cell-transport-cozy.json" },
  { slices: cellCasefileSlices, file: "cell-transport-casefile.json" },
  { slices: civilStorySlices, file: "civil-rights-story.json" },
  { slices: civilExplorerSlices, file: "civil-rights-explorer.json" },
];

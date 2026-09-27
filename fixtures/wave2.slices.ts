import type { ChallengeSlice, BlueprintSlice } from "../src/contracts/slices";
import type { Slices } from "../src/pipeline/assemble";
import { trigIntake, trigKnowledgeMap } from "./trig.knowledge-map";
import { WAVE2A } from "./wave2a.encounters";

/*
 * Smoke fixture for the wave-2 widgets: one encounter per wave-2 mode that exists tonight, mounted in a
 * Dungeon on the trig knowledge map (topical coherence is not the point; every mode being playable is).
 * Built into fixtures/wave2-dungeon.json by `pnpm fixtures:build`.
 */

const byCard = Object.fromEntries(WAVE2A.map((w) => [w.cardId, w.slice])) as Record<string, ChallengeSlice>;

const mine: Record<string, ChallengeSlice> = {
  protein_factory: {
    prompt: "The door's password is written in mRNA. Turn each codon, a group of three letters, into its amino acid.",
    params: {
      tableName: "codon table (mRNA codon → amino acid)",
      table: [
        { from: "AUG", to: "Met" },
        { from: "UUU", to: "Phe" },
        { from: "GGC", to: "Gly" },
        { from: "CCU", to: "Pro" },
        { from: "AAA", to: "Lys" },
        { from: "UAA", to: "Stop" },
      ],
      input: ["AUG", "GGC", "AAA", "UAA"],
      direction: "forward",
      tokenLabel: "codon",
      outputLabel: "amino acid",
      showTable: true,
    },
    hints: [
      "There are four codons here, starting with AUG. Each one gives you one amino acid.",
      "Find AUG in the table's left column. The amino acid next to it goes first.",
      "Look up GGC, then AAA, then UAA the same way. Keep them in that order.",
    ],
    wrongFeedback: "Check each codon in the table again. The chain has to keep the codons' order.",
    debriefLine: "Those {{count}} codons made {{output}}. Each group of three letters codes for one amino acid.",
    sourceRef: null,
  },
  function_factory: {
    prompt: "This machine changes every number the same way. Watch it, then guess what it gives for {{query}}.",
    params: { rule: "2*x + 3", examples: ["1", "2", "5"], ask: "output", query: "10", ruleOptions: [], inputLabel: "input", outputLabel: "output" },
    hints: [
      "Compare 1 → 5 with 2 → 7. One more going in gives two more coming out.",
      "So the machine doubles the number first. Double 1 is 2. What gets you from 2 to 5?",
      "Double it, then add 3. Check that on 5 → 13, then try it on {{query}}.",
    ],
    wrongFeedback: "The machine uses one rule for every number. Test your rule on all three examples.",
    debriefLine: "The machine doubles each number and adds 3. So {{query}} gives {{answer}}.",
    sourceRef: null,
  },
  state_containers: {
    prompt: "The golem runs these lines from top to bottom. What does it print?",
    params: {
      program: ["x = 3", "y = x * 2 + 1", "if y > 6: x = x + 10 else: x = 0", "a = [4, 7, 9]", "print a[0]", "print x"],
      ask: "output",
      variable: "",
      options: ["4 13", "7 13", "4 3", "7 0"],
    },
    hints: [
      "The if line decides what x becomes. It depends on whether y is bigger than 6.",
      "Work out y first. With x = 3, y is 3 × 2 + 1.",
      "a[0] is the first item, because lists count from 0. Then print x as it is after the if line.",
    ],
    wrongFeedback: "Go one line at a time. x = x + 10 means add 10 to x and keep the new value.",
    debriefLine: "A variable holds a value that can change line by line. Tracing all {{lines}} lines gave {{answer}}.",
    sourceRef: null,
  },
  rune_recall: {
    prompt: "Type what each rune on the shield means before it fades. Missed runes come back.",
    params: {
      items: [
        { prompt: "sin θ on the unit circle", answers: ["y-coordinate", "y coordinate", "the y-coordinate", "y"], hint: "the up-and-down one" },
        { prompt: "period of sin(bx)", answers: ["2π/|b|", "2pi/|b|", "2π/b", "2pi/b"], hint: "a fraction with 2π on top" },
        { prompt: "amplitude of A sin x", answers: ["|A|", "A", "abs(A)"], hint: "the number in front" },
        { prompt: "π radians in degrees", answers: ["180", "180°", "180 degrees"], hint: "half a turn" },
      ],
      secondsPerItem: 10,
      direction: "term → value",
    },
    hints: [
      "Each rune shows a small clue under it. For π radians, the clue is \"half a turn\".",
      "For the period of sin(bx), start from 2π. The b inside changes how fast it repeats.",
      "For A sin x, the number in front sets the height. For sin θ, pick between x and y.",
    ],
    wrongFeedback: "That's not it. Check the clue under the rune. It'll come back so you can try again.",
    debriefLine: "You recalled {{count}} trig facts ({{direction}}). Pulling facts from memory helps them stick.",
    sourceRef: null,
  },
  context_clues: {
    prompt: "The Warden's last riddle is a sentence from your notes with one word missing. Fill in the gap.",
    params: {
      sentence: "The value of A stretches the graph vertically but leaves the ___ unchanged.",
      answers: ["period"],
      wordBank: ["amplitude", "frequency", "midline"],
      hint: "It's how long one full wave takes, measured side to side.",
    },
    hints: [
      "Look at the word \"vertically\". A only changes the graph up and down.",
      "So the missing word is something measured side to side, left to right.",
      "Amplitude and midline are both about height, so skip them. You want the length of one full wave.",
    ],
    wrongFeedback: "The sentence says A leaves this word alone. A changes height, so look for a side-to-side word.",
    debriefLine: "Your notes say A leaves the {{answer}} alone. That's why amplitude and period are set by different numbers.",
    sourceRef: { page: 2, quote: "The value of A stretches the graph vertically but leaves the period unchanged." },
  },
};

export const wave2Blueprint: BlueprintSlice = {
  genre: "dungeon",
  title: "The Nine-Room Test Dungeon",
  theme: { setting: "A test dungeon with a different kind of puzzle in every room", tone: "brisk", paletteId: "neon", musicMood: "playful" },
  premise: "Nine rooms, each with a different kind of puzzle. Solve them all.",
  characters: [{ id: "cog", name: "Cog", role: "test proctor", voiceArchetype: "cheerful_sidekick" }],
  encounters: [
    { id: "w1_slope", conceptIds: ["c_period"], teachingMechanicId: "slope_scanner", socket: "altar", role: "teach", difficulty: 2, targetMisconception: null, designNote: "function_world.slope" },
    { id: "w2_equation", conceptIds: ["c_solve"], teachingMechanicId: "balance_chamber", socket: "altar", role: "teach", difficulty: 2, targetMisconception: null, designNote: "balance.equation" },
    { id: "w3_chem", conceptIds: ["c_radians"], teachingMechanicId: "atom_conservation", socket: "altar", role: "teach", difficulty: 2, targetMisconception: null, designNote: "balance.chem_equation" },
    { id: "w4_ledger", conceptIds: ["c_amplitude"], teachingMechanicId: "budget_balance", socket: "altar", role: "teach", difficulty: 2, targetMisconception: null, designNote: "balance.ledger" },
    { id: "w5_encode", conceptIds: ["c_radians"], teachingMechanicId: "protein_factory", socket: "forge", role: "practice", difficulty: 2, targetMisconception: null, designNote: "transformer.encode" },
    { id: "w6_machine", conceptIds: ["c_period"], teachingMechanicId: "function_factory", socket: "forge", role: "practice", difficulty: 1, targetMisconception: null, designNote: "transformer.function_machine" },
    { id: "w7_trace", conceptIds: ["c_solve"], teachingMechanicId: "state_containers", socket: "forge", role: "practice", difficulty: 2, targetMisconception: null, designNote: "transformer.trace" },
    { id: "w8_recall", conceptIds: ["c_amplitude"], teachingMechanicId: "rune_recall", socket: "enemy", role: "review", difficulty: 2, targetMisconception: null, designNote: "recall.rapid" },
    { id: "w9_boss", conceptIds: ["c_period", "c_amplitude"], teachingMechanicId: "context_clues", socket: "boss", role: "boss", difficulty: 3, targetMisconception: null, designNote: "recall.cloze" },
  ],
};

export const wave2Slices: Slices = {
  id: "wave2_smoke_001",
  createdAt: "2026-09-26T04:00:00.000Z",
  km: trigKnowledgeMap,
  intake: trigIntake,
  blueprint: wave2Blueprint,
  challenges: {
    w1_slope: byCard.slope_scanner,
    w2_equation: byCard.balance_chamber,
    w3_chem: byCard.atom_conservation,
    w4_ledger: byCard.budget_balance,
    w5_encode: mine.protein_factory,
    w6_machine: mine.function_factory,
    w7_trace: mine.state_containers,
    w8_recall: mine.rune_recall,
    w9_boss: mine.context_clues,
  },
  narrative: {
    intro: [{ speakerId: "cog", text: "Welcome to the test dungeon. Each of these nine rooms has a different puzzle." }],
    outro: [{ speakerId: "cog", text: "You solved all nine rooms. The test dungeon is clear!" }],
    beats: [],
  },
  assessment: {
    post: [
      { conceptId: "c_period", prompt: "What is the period of y = sin(4x)?", correct: "π/2", distractors: ["8π", "4", "π/4"] },
      { conceptId: "c_amplitude", prompt: "What is the amplitude of y = 0.5 cos x?", correct: "0.5", distractors: ["1", "2", "0.25"] },
      { conceptId: "c_solve", prompt: "How many solutions does cos x = 0 have on [0, 2π)?", correct: "2", distractors: ["1", "4", "0"] },
    ],
  },
};

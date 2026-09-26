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
    prompt: "The forge door is carved with mRNA. Translate the codons into the password, one amino acid per codon.",
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
    hints: ["Read three bases at a time; each triplet is one codon.", "Look each codon up in the table; the order of the chain follows the order of the codons.", "The chain reads: {{output}}"],
    wrongFeedback: "Each codon maps to exactly one amino acid, and the chain keeps the codons' order.",
    debriefLine: "Translation: {{count}} codons became the chain {{output}} because each codon codes for one amino acid, not each base.",
    sourceRef: null,
  },
  function_factory: {
    prompt: "A machine at the bench eats numbers. Watch what it does, then predict its output for {{query}}.",
    params: { rule: "2*x + 3", examples: ["1", "2", "5"], ask: "output", query: "10", ruleOptions: [], inputLabel: "input", outputLabel: "output" },
    hints: ["Compare each input with its output: what single step turns one into the other?", "The step is the same for every pair; test your guess on all three.", "Apply the same step to {{query}}: the machine gives {{answer}}."],
    wrongFeedback: "A function applies the same rule to every input; check your rule against all the pairs the machine showed.",
    debriefLine: "A function is a rule, not a formula you're told: from {{examples}} you recovered the machine and predicted {{answer}} for {{query}}.",
    sourceRef: null,
  },
  state_containers: {
    prompt: "The golem's scroll runs these lines. What does it print at the end?",
    params: {
      program: ["x = 3", "y = x * 2 + 1", "if y > 6: x = x + 10 else: x = 0", "a = [4, 7, 9]", "print a[0]", "print x"],
      ask: "output",
      variable: "",
      options: ["4 13", "7 13", "4 3", "7 0"],
    },
    hints: ["Run each line in order and write down every container's value as it changes.", "a[0] is the FIRST item; lists count from zero.", "The scroll prints {{answer}}."],
    wrongFeedback: "Trace one line at a time: x = x + 1 is an instruction to update the container, not an equation to solve.",
    debriefLine: "Variables are containers that change line by line; tracing {{lines}} lines gave {{answer}}.",
    sourceRef: null,
  },
  rune_recall: {
    prompt: "Runes flash on the enemy's shield. Type each rune's meaning before it fades; missed runes return.",
    params: {
      items: [
        { prompt: "sin θ on the unit circle", answers: ["y-coordinate", "y coordinate", "the y-coordinate", "y"], hint: "vertical, not horizontal" },
        { prompt: "period of sin(bx)", answers: ["2π/|b|", "2pi/|b|", "2π/b", "2pi/b"], hint: "a fraction with 2π on top" },
        { prompt: "amplitude of A sin x", answers: ["|A|", "A", "abs(A)"], hint: "the coefficient in front" },
        { prompt: "π radians in degrees", answers: ["180", "180°", "180 degrees"], hint: "half a turn" },
      ],
      secondsPerItem: 10,
      direction: "term → value",
    },
    hints: ["Say the definition out loud before you type.", "Missed runes come back: use the hint the shield shows.", "First rune: {{first}}"],
    wrongFeedback: "Recognizing a formula isn't the same as recalling it; the runes come back until you can produce each one.",
    debriefLine: "Rapid recall on {{count}} trig facts ({{direction}}): retrieval practice, not rereading, is what makes them stick.",
    sourceRef: null,
  },
  context_clues: {
    prompt: "The Warden's last riddle is a sentence from your notes with one word missing. Fill it.",
    params: {
      sentence: "The value of A stretches the graph vertically but leaves the ___ unchanged.",
      answers: ["period"],
      wordBank: ["amplitude", "frequency", "midline"],
      hint: "It's the horizontal length of one full cycle.",
    },
    hints: ["Read the whole sentence: what could A leave unchanged?", "A is the vertical stretch; the missing word is a horizontal property.", "The word is {{answer}}."],
    wrongFeedback: "Use the surrounding words: 'stretches vertically but leaves … unchanged' points at a horizontal property.",
    debriefLine: "Cloze: the notes say A leaves the {{answer}} unchanged, which is exactly why amplitude and period are separate dials.",
    sourceRef: { page: 2, quote: "The value of A stretches the graph vertically but leaves the period unchanged." },
  },
};

export const wave2Blueprint: BlueprintSlice = {
  genre: "dungeon",
  title: "The Wave-Two Proving Ground",
  theme: { setting: "A test dungeon where every wave-2 mechanic has a room", tone: "brisk", paletteId: "neon", musicMood: "playful" },
  premise: "Nine rooms, nine different mechanics. Clear them all.",
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
    intro: [{ speakerId: "cog", text: "Nine rooms, nine machines. Show me you can drive them all." }],
    outro: [{ speakerId: "cog", text: "Every machine answered to you. Proving ground cleared." }],
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

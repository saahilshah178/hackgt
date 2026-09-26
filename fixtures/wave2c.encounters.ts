import type { ChallengeSlice } from "../src/contracts/slices";

/**
 * One realistic encounter per wave-2c `builder` mode (P9 part 4, mechanics-dev), each on a real catalog
 * card, following docs/overnight/wave1-modes.md's conventions and this brief's param shapes exactly.
 * Consumed by tests/wave2c.test.ts, which assembles each into a mini GameSpec and autoSolves it.
 */
export const WAVE2C: { cardId: string; slice: ChallengeSlice }[] = [
  {
    cardId: "logic_factory",
    slice: {
      prompt: "The generator room needs a circuit with 2 inputs, A and B, that matches the scrawled truth table exactly. Wire it with AND, OR, and NOT gates.",
      params: {
        inputs: ["A", "B"],
        target: [
          { inputs: [false, false], output: false },
          { inputs: [false, true], output: true },
          { inputs: [true, false], output: true },
          { inputs: [true, true], output: false },
        ],
        gates: ["AND", "OR", "NOT"],
        maxGates: 5,
      },
      hints: [
        "The output is true exactly when the two inputs disagree.",
        "You can build \"disagree\" from an OR of the inputs, an AND of the inputs negated, and a final AND of those two.",
        "This circuit needs {{minGates}} gates from this palette.",
      ],
      wrongFeedback: "Test your wiring against every row of the table, not just the ones you tried first.",
      debriefLine: "The generator hums to life: this table needs at least {{minGates}} gates from AND/OR/NOT.",
      sourceRef: null,
    },
  },
  {
    cardId: "molecule_builder",
    slice: {
      prompt: "Assemble a molecule of methane, CH4, from the atom bin: 1 carbon and 4 hydrogens. Every bond must respect each atom's valence.",
      params: {
        atoms: [
          { element: "C", count: 1 },
          { element: "H", count: 4 },
        ],
        target: "CH4",
      },
      hints: [
        "Carbon forms 4 bonds total; hydrogen forms exactly 1.",
        "With only 1 carbon available, every hydrogen has to bond directly to it.",
        "The finished molecule is {{target}} with all {{atomCount}} atoms in one connected structure.",
      ],
      wrongFeedback: "Check each atom's total bond count against its valence: carbon needs 4, hydrogen needs 1.",
      debriefLine: "That's methane ({{target}}): one carbon single-bonded to all 4 hydrogens.",
      sourceRef: { page: 3, quote: "Carbon's valence of four lets it form four single bonds, as in methane, CH4." },
    },
  },
  {
    cardId: "punnett_forge",
    slice: {
      prompt: "Breed two heterozygous purple-flowered familiars (Bb x Bb) and fill the Punnett square to see what their offspring could look like.",
      params: {
        trait: "flower color",
        dominantAllele: "B",
        recessiveAllele: "b",
        dominantPhenotype: "purple flowers",
        recessivePhenotype: "white flowers",
        parent1: "Bb",
        parent2: "Bb",
        ask: "square",
      },
      hints: [
        "Each parent contributes one allele per gamete: Bb can pass either B or b.",
        "Cross parent 1's two gametes (rows) against parent 2's two gametes (columns).",
        "The finished square reads {{cellsAnswer}}.",
      ],
      wrongFeedback: "Each box combines one gamete from the row parent with one gamete from the column parent; recheck which alleles those are.",
      debriefLine: "The square fills in as {{cellsAnswer}}, giving a {{fraction}} chance of purple flowers.",
      sourceRef: { page: 7, quote: "A Punnett square crosses each parent's possible gametes to predict offspring genotype ratios." },
    },
  },
  {
    cardId: "code_golem",
    slice: {
      prompt: "Program the golem to walk from S to G around the wall, using at most 12 blocks of forward, left, and right.",
      params: {
        grid: ["S....", "#....", "#....", "#....", "....G"],
        commands: ["forward", "left", "right"],
        maxBlocks: 12,
        mustCollectGems: false,
      },
      hints: [
        "The wall runs straight down the left side; you'll need to go around it.",
        "Turn right to face across the room once you're clear of the wall.",
        "A working program uses {{minBlocks}} blocks.",
      ],
      wrongFeedback: "Trace your program step by step from S; note exactly where it hits a wall or stops short of G.",
      debriefLine: "The golem reaches G in {{minBlocks}} blocks, tracing the room's open edge.",
      sourceRef: null,
    },
  },
  {
    cardId: "orbital_filling",
    slice: {
      prompt: "Fill the orbital slots for iron (Fe, Z = 26) in order, obeying the Aufbau principle and the Pauli exclusion limit on every subshell.",
      params: { element: "Iron", atomicNumber: 26 },
      hints: [
        "Fill subshells by increasing energy, not by increasing shell number: 4s fills before 3d.",
        "Each subshell has a hard capacity: s holds 2, p holds 6, d holds 10.",
        "The full configuration is {{config}}.",
      ],
      wrongFeedback: "Check both the order of subshells and each one's electron count against the Aufbau and Pauli rules.",
      debriefLine: "Iron's ground-state configuration is {{config}}, with 4s filling before the lower-energy-adjacent 3d finishes.",
      sourceRef: { page: 2, quote: "The Aufbau principle fills orbitals in order of increasing energy, which places 4s below 3d despite its smaller principal quantum number." },
    },
  },
  {
    cardId: "rhythm_bridge",
    slice: {
      prompt: "This measure is in 4/4 time. Fill its 4 slots with quarter, half, and whole notes so the beats add up to exactly 4.",
      params: {
        rows: 1,
        cols: 4,
        pieces: [
          { id: "quarter", label: "Quarter note", cells: 1 },
          { id: "half", label: "Half note", cells: 2 },
          { id: "whole", label: "Whole note", cells: 4 },
        ],
        rules: [{ kind: "row_sum_equals", value: "4" }],
        target: "",
      },
      hints: [
        "A quarter note is worth 1 beat, a half note 2 beats, a whole note 4 beats.",
        "You don't have to fill every slot with a note; empty slots just don't add beats.",
        "One measure that works is {{layout}}.",
      ],
      wrongFeedback: "Add up the beat values you've placed in the measure and compare the total to the time signature.",
      debriefLine: "One valid measure is {{layout}}: the beat values sum to exactly 4.",
      sourceRef: null,
    },
  },
  {
    cardId: "spell_syntax",
    slice: {
      prompt: "Cast the spell by arranging these Spanish word tiles into a correctly ordered sentence.",
      params: {
        tiles: ["Yo", "como", "una", "manzana"],
        accepted: [["Yo", "como", "una", "manzana"]],
        rules: ["subject-verb-object order"],
      },
      hints: [
        "Spanish sentences here follow the same subject-verb-object shape as English.",
        "\"Yo\" is the subject; find the verb that means \"eat\".",
        "The finished spell reads \"{{answer}}\".",
      ],
      wrongFeedback: "Check which tile should come first: Spanish subject-verb-object order matches English here.",
      debriefLine: "The spell casts as \"{{answer}}\": subject, verb, article, object.",
      sourceRef: null,
    },
  },
];

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
      prompt: "Wire a circuit with inputs A and B that matches the truth table exactly. Use AND, OR and NOT gates.",
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
        "Look at the table. The output is true only when A and B are different.",
        "Start with A OR B. That's true in every row except when both are false.",
        "Now block the row where both are true. A NOT after A AND B catches that row.",
      ],
      wrongFeedback: "Test your circuit on every row of the table. One row still gives the wrong output.",
      debriefLine: "The generator starts up! This table needs at least {{minGates}} gates from AND, OR and NOT.",
      sourceRef: null,
    },
  },
  {
    cardId: "molecule_builder",
    slice: {
      prompt: "Build methane, CH4, from 1 carbon and 4 hydrogens. Give each atom the right number of bonds.",
      params: {
        atoms: [
          { element: "C", count: 1 },
          { element: "H", count: 4 },
        ],
        target: "CH4",
      },
      hints: [
        "Carbon makes 4 bonds. Hydrogen makes just 1.",
        "There's only 1 carbon here. So every hydrogen has to bond to it.",
        "Check that the carbon has all 4 bonds used. Then check that no hydrogen has 2.",
      ],
      wrongFeedback: "Count each atom's bonds. Carbon needs 4 and hydrogen needs 1.",
      debriefLine: "That's methane ({{target}}). One carbon holds on to all 4 hydrogens.",
      sourceRef: { page: 3, quote: "Carbon's valence of four lets it form four single bonds, as in methane, CH4." },
    },
  },
  {
    cardId: "punnett_forge",
    slice: {
      prompt: "Cross two purple-flowered Bb plants. Fill in the Punnett square, the grid of every possible offspring.",
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
        "Each Bb parent can pass on either B or b. Put one parent's two letters along the top.",
        "Put the other parent's B and b down the side. Each box gets one letter from each.",
        "The top-left box gets B from both parents. Fill the other three boxes the same way.",
      ],
      wrongFeedback: "Each box takes one letter from its row and one from its column. Check those letters again.",
      debriefLine: "The square fills in as {{cellsAnswer}}. That's a {{fraction}} chance of purple flowers.",
      sourceRef: { page: 7, quote: "A Punnett square crosses each parent's possible gametes to predict offspring genotype ratios." },
    },
  },
  {
    cardId: "code_golem",
    slice: {
      prompt: "Program the golem to walk from S to G around the wall. Use at most 12 blocks.",
      params: {
        grid: ["S....", "#....", "#....", "#....", "....G"],
        commands: ["forward", "left", "right"],
        maxBlocks: 12,
        mustCollectGems: false,
      },
      hints: [
        "The golem starts at S facing up. The wall runs down the left side, right under S.",
        "Turn right first, so the golem faces along the open top row.",
        "The top row and the right-hand column are both open. That path needs only two turns.",
      ],
      wrongFeedback: "Trace your program one block at a time from S. Find where it hits a wall or stops short of G.",
      debriefLine: "The golem reaches G in {{minBlocks}} blocks, going along the open edge of the room.",
      sourceRef: null,
    },
  },
  {
    cardId: "orbital_filling",
    slice: {
      prompt: "Place iron's 26 electrons in the orbital slots. Fill the lowest-energy slots first, and don't overfill any.",
      params: { element: "Iron", atomicNumber: 26 },
      hints: [
        "Watch the 4s and 3d slots. 4s fills before 3d, even though 3 is the smaller number.",
        "An s slot holds 2 electrons and a p holds 6. A d holds 10.",
        "By the end of 4s you've placed 20 electrons. The rest go into 3d.",
      ],
      wrongFeedback: "Check the order of the slots, and how many electrons each one holds.",
      debriefLine: "Iron's electrons fill as {{config}}. Notice that 4s filled before 3d.",
      sourceRef: { page: 2, quote: "The Aufbau principle fills orbitals in order of increasing energy, which places 4s below 3d despite its smaller principal quantum number." },
    },
  },
  {
    cardId: "rhythm_bridge",
    slice: {
      prompt: "This measure is in 4/4 time, so it needs exactly 4 beats. Fill it with quarter, half and whole notes.",
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
        "A quarter note is 1 beat. A half note is 2, and a whole note is 4.",
        "You don't have to fill every slot. Empty slots just add no beats.",
        "Place one note at a time and keep a running total. Stop the moment it hits 4.",
      ],
      wrongFeedback: "Add up the beats you've placed. The total has to be exactly 4.",
      debriefLine: "One measure that works is {{layout}}. Its beats add up to exactly 4.",
      sourceRef: null,
    },
  },
  {
    cardId: "spell_syntax",
    slice: {
      prompt: "Put these Spanish word tiles in the right order to cast the spell.",
      params: {
        tiles: ["Yo", "como", "una", "manzana"],
        accepted: [["Yo", "como", "una", "manzana"]],
        rules: ["subject-verb-object order"],
      },
      hints: [
        "\"Yo\" means \"I\". It's the one doing the action.",
        "Here Spanish uses the same order as English. The doer comes first, then the action.",
        "\"Como\" means \"eat\", and \"una manzana\" means \"an apple\".",
      ],
      wrongFeedback: "Check which tile goes first. Here, Spanish uses the same order as English.",
      debriefLine: "The spell reads \"{{answer}}\". That's \"I eat an apple\", in the same order as English.",
      sourceRef: null,
    },
  },
];

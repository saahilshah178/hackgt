import type { ChallengeSlice } from "../src/contracts/slices";

/**
 * One realistic encounter per wave-2a mode (P9 part A), each on a real catalog card, following
 * docs/overnight/wave2-modes.md's (mechanics-dev brief) param shapes exactly. Consumed by
 * tests/wave2a.test.ts, which assembles each into a mini GameSpec and autoSolves it.
 */
export const WAVE2A: { cardId: string; slice: ChallengeSlice }[] = [
  {
    cardId: "slope_scanner",
    slice: {
      prompt: "Slide the scanner along the hill and mark the spot where it's steepest.",
      params: {
        pieces: [{ expr: "exp(-x^2)", from: "-inf", to: "inf", openLeft: false, openRight: false }],
        xMin: "0",
        xMax: "3",
        ask: "steepest",
        a: null,
      },
      hints: [
        "The hill is highest at x = 0, but it's flat up there. Look further down the slope.",
        "Watch the tilted line as you slide right from x = 0. It leans more, then less again.",
        "The line leans the most somewhere between x = 0.5 and x = 1.",
      ],
      wrongFeedback: "That spot isn't the steepest. Find where the tilted line leans the most.",
      debriefLine: "A curve's steepness changes as you go. The steepest spot here was at {{answer}}.",
      sourceRef: { page: 5, quote: "The derivative measures how steeply a curve rises or falls at each point, and that steepness itself varies along the curve." },
    },
  },
  {
    cardId: "balance_chamber",
    slice: {
      prompt: "Do the same thing to both pans until x is alone. Then the door opens.",
      params: {
        left: "3*x + 5",
        right: "20",
      },
      hints: [
        "The x side has 3x and a + 5. Get rid of the + 5 first.",
        "Take 5 away from both pans. That leaves 3x on one side and 15 on the other.",
        "Now split both pans into 3 equal parts. One part of 15 is x.",
      ],
      wrongFeedback: "Whatever you do to one pan, do to the other. Moving the + 5 across means taking 5 from both sides.",
      debriefLine: "The pans balanced with x = {{x}}. You kept both sides equal at every step.",
      sourceRef: { page: 2, quote: "Solving 3x + 5 = 20 means applying the same operation to both sides until x stands alone: subtract 5, then divide by 3." },
    },
  },
  {
    cardId: "atom_conservation",
    slice: {
      prompt: "Set the big numbers in front of each molecule so every atom balances. Then the reactor starts.",
      params: {
        reactants: ["C3H8", "O2"],
        products: ["CO2", "H2O"],
      },
      hints: [
        "C3H8 has 3 carbons and 8 hydrogens. Balance those two first, and leave oxygen for last.",
        "Each CO2 holds one carbon, and each H2O holds two hydrogens. Match the 3 carbons and 8 hydrogens.",
        "That's 3 CO2 and 4 H2O. Count the oxygens on the right, then split them into pairs for O2.",
      ],
      wrongFeedback: "Only change the big numbers in front. Changing the small numbers makes a different substance.",
      debriefLine: "Balanced with {{coefficients}}, reactants first. Every atom you started with is still there.",
      sourceRef: { page: 8, quote: "Balancing C3H8 + O2 -> CO2 + H2O requires the coefficients 1, 5, 3, and 4 so every carbon, hydrogen, and oxygen atom is conserved." },
    },
  },
  {
    cardId: "budget_balance",
    slice: {
      prompt: "Balance the monthly budget. Every dollar that comes in has to go somewhere.",
      params: {
        nodes: [
          { id: "income", label: "Monthly income" },
          { id: "savings", label: "Savings" },
        ],
        flows: [
          { from: null, to: "income", label: "Paycheck", value: "2000" },
          { from: "income", to: null, label: "Rent and bills", value: "1400" },
          { from: "income", to: "savings", label: "Transfer to savings", value: null },
          { from: "savings", to: null, label: "Savings withdrawal", value: null },
        ],
      },
      hints: [
        "Look at \"Monthly income\". $2000 comes in, and all of it has to leave.",
        "$1400 goes to rent and bills. The rest moves to savings, so take 1400 from 2000.",
        "Savings has nowhere else to send money. So the withdrawal matches what went into savings.",
      ],
      wrongFeedback: "Some money isn't tracked yet. Every dollar in has to match a dollar out.",
      debriefLine: "Now it balances. {{missing}}.",
      sourceRef: { page: 3, quote: "A budget balances only when every dollar of income is tracked against an expense or a savings transfer." },
    },
  },
];

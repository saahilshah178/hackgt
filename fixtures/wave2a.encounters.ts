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
      prompt: "Cross the ridge with your tangent scanner and mark where the terrain is steepest.",
      params: {
        pieces: [{ expr: "exp(-x^2)", from: "-inf", to: "inf", openLeft: false, openRight: false }],
        xMin: "0",
        xMax: "3",
        ask: "steepest",
        a: null,
      },
      hints: [
        "The tangent tilts more where the terrain changes height fastest, not where it's highest.",
        "Scan slowly from x = 0 outward and watch how tilted the tangent line gets.",
        "The tangent is tilted furthest from flat somewhere between x = 0 and x = 1.",
      ],
      wrongFeedback: "Steepest means the biggest tilt on the tangent, not the highest point on the ridge.",
      debriefLine: "A curve's slope changes from point to point: the steepest spot here was {{answer}}.",
      sourceRef: { page: 5, quote: "The derivative measures how steeply a curve rises or falls at each point, and that steepness itself varies along the curve." },
    },
  },
  {
    cardId: "balance_chamber",
    slice: {
      prompt: "Apply the same operation to both pans until x stands alone and the chamber unlocks.",
      params: {
        left: "3*x + 5",
        right: "20",
      },
      hints: [
        "Whatever you do to one pan, do to the other, or the scale tips.",
        "Clear the constant off the x side first, then clear its coefficient.",
        "Subtract 5 from both sides, then divide both sides by 3.",
      ],
      wrongFeedback: "Moving a term across the equals sign is really applying the same operation to both sides, and that flips its sign.",
      debriefLine: "Balance chamber solved: x = {{x}}.",
      sourceRef: { page: 2, quote: "Solving 3x + 5 = 20 means applying the same operation to both sides until x stands alone: subtract 5, then divide by 3." },
    },
  },
  {
    cardId: "atom_conservation",
    slice: {
      prompt: "Set the coefficients so every atom token balances and the reactor starts.",
      params: {
        reactants: ["C3H8", "O2"],
        products: ["CO2", "H2O"],
      },
      hints: [
        "Balance carbon and hydrogen first; oxygen is easiest to fix last since it appears in both products.",
        "Three carbons and eight hydrogens on the left mean 3 CO2 and 4 H2O on the right.",
        "That makes 10 oxygen atoms needed on the right, so O2 needs a coefficient of 5.",
      ],
      wrongFeedback: "Changing a subscript would make a different substance; only the coefficients out front may change.",
      debriefLine: "Balanced: {{coefficients}} (reactants then products) conserves every atom.",
      sourceRef: { page: 8, quote: "Balancing C3H8 + O2 -> CO2 + H2O requires the coefficients 1, 5, 3, and 4 so every carbon, hydrogen, and oxygen atom is conserved." },
    },
  },
  {
    cardId: "budget_balance",
    slice: {
      prompt: "Balance the monthly ledger: every dollar that comes in must be accounted for going out.",
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
        "Every dollar that enters \"Monthly income\" has to leave it somehow: rent, bills, or savings.",
        "$2000 comes in and $1400 goes straight to rent and bills, so the rest goes to savings.",
        "Whatever reaches \"Savings\" with nowhere else to go must leave as the withdrawal.",
      ],
      wrongFeedback: "A budget only balances when every regular expense, not just the big ones, is tracked against income.",
      debriefLine: "Budget balanced: {{missing}}.",
      sourceRef: { page: 3, quote: "A budget balances only when every dollar of income is tracked against an expense or a savings transfer." },
    },
  },
];

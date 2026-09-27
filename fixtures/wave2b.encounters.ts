import type { ChallengeSlice } from "../src/contracts/slices";

/**
 * One realistic encounter per wave-2b mode (P9 parts 3 and 6, mechanics-dev), each on a real catalog card,
 * following docs/overnight/wave1-modes.md's conventions and this brief's param shapes exactly. Consumed by
 * tests/wave2b.test.ts, which assembles each into a mini GameSpec and autoSolves it.
 */
export const WAVE2B: { cardId: string; slice: ChallengeSlice }[] = [
  {
    cardId: "membrane_balance",
    slice: {
      prompt: "This cell sits in water with more solute, or dissolved stuff, outside than inside. Guess what happens, then watch.",
      params: {
        system: {
          variables: [{ name: "cell_volume", initial: "100", unit: "% of normal", min: 0, max: 200 }],
          rules: [{ target: "cell_volume", expr: "cell_volume + (80 - cell_volume)*0.1" }],
          ticks: 20,
        },
        scenario: "A cell is placed in a solution with a higher solute concentration outside than inside.",
        watch: "cell_volume",
        question: "What happens to the cell?",
        options: [
          { text: "Water moves out of the cell, and the cell shrinks", asserts: "decreases", explanation: "Water crosses the membrane toward the side with more solute. The solute mostly can't cross, so water leaves and the cell shrinks." },
          { text: "Salt moves into the cell to even things out, and the cell stays the same size", asserts: "stays", explanation: "The membrane lets water through far more easily than salt. So the water moves, and the salt mostly stays put." },
        ],
        comparison: "decreases",
        threshold: "50",
      },
      hints: [
        "The membrane lets water through easily. The solute mostly can't get through.",
        "Water moves toward the side with more solute. Here, that's outside the cell.",
        "So water heads out of the cell. Decide what losing water does to its size.",
      ],
      wrongFeedback: "The solute can't cross easily here. Ask which side the water gets pulled toward.",
      debriefLine: "That's osmosis. Water crossed the membrane toward more solute, so the cell shrank.",
      sourceRef: { page: 4, quote: "In osmosis, water moves across a selectively permeable membrane toward the side with the higher solute concentration." },
    },
  },
  {
    cardId: "feedback_controller",
    slice: {
      prompt: "Blood sugar, or glucose, keeps rising after a meal. Set the insulin to keep it in the safe range.",
      params: {
        system: {
          variables: [
            { name: "glucose", initial: "150", unit: "mg/dL", min: 0, max: 400 },
            { name: "insulin", initial: "0", unit: "units", min: 0, max: 200 },
          ],
          rules: [{ target: "glucose", expr: "glucose + 5 - 0.5*insulin" }],
          ticks: 20,
        },
        control: { variable: "insulin", min: "0", max: "20", step: "1" },
        target: { variable: "glucose", low: "100", high: "180" },
        ticks: 20,
        budget: 2,
      },
      hints: [
        "Without insulin, glucose climbs by 5 every step. It won't settle on its own.",
        "Each unit of insulin pulls glucose down by half a unit every step. Too much and it drops too low.",
        "You need just enough insulin to cancel that rise of 5. Half of what number is 5?",
      ],
      wrongFeedback: "One burst of insulin won't hold it. The rise keeps coming every step, so the insulin has to keep going too.",
      debriefLine: "Keeping {{target}} in the safe range takes steady help from {{control}}. One push isn't enough.",
      sourceRef: { page: 6, quote: "Hormonal control in homeostasis is a continuous feedback loop, releasing and easing off as the level shifts." },
    },
  },
  {
    cardId: "prediction_stabilizer",
    slice: {
      prompt: "Flip a fair coin hundreds of times. Watch where the average number of heads settles.",
      params: {
        system: {
          variables: [{ name: "heads_count", initial: "0", unit: "", min: 0, max: 1 }],
          rules: [{ target: "heads_count", expr: "rand() < 0.5 ? 1 : 0" }],
          ticks: 2,
        },
        watch: "heads_count",
        trials: 800,
        statistic: "mean",
        threshold: "0.5",
        question: "Where does the average settle after many flips?",
        options: [
          { text: "It settles in close to 0.5, no matter what happened on recent flips", isCorrect: true, explanation: "Each flip is separate from the others. Over many flips, the average moves toward the real 50% chance." },
          { text: "After a run of heads, tails becomes more likely to even things out", isCorrect: false, explanation: "The coin can't remember. Past flips never change the odds of the next one." },
        ],
        ranges: [
          { optionIndex: 0, low: "0.4", high: "0.6" },
          { optionIndex: 1, low: "0.6", high: null },
        ],
      },
      hints: [
        "A fair coin lands heads half the time. Each flip ignores the flips before it.",
        "A streak of heads doesn't make tails \"due\". The coin can't remember the streak.",
        "With 800 flips, a few streaks barely move the average. Watch how the line flattens out.",
      ],
      wrongFeedback: "\"Due for tails\" would mean the coin remembers. A fair coin's odds never change.",
      debriefLine: "After {{trials}} flips, you got {{statistic}}. {{correct}}.",
      sourceRef: { page: 9, quote: "Independent trials have no memory; the law of large numbers stabilizes the average only over many trials, not by any single trial 'correcting' the last." },
    },
  },
  {
    cardId: "tile_the_region",
    slice: {
      prompt: "Place 8 blocks under the curved ceiling and estimate how much area they cover.",
      params: {
        expr: "x^2",
        a: "0",
        b: "2",
        n: 8,
        method: "right",
        ask: "estimate",
      },
      hints: [
        "Each block gets its height from the curve y = x² at the block's right edge.",
        "The blocks split 0 to 2 into 8 equal parts. So each one is 0.25 wide.",
        "Add up height times 0.25 for all 8 blocks. The last block is 2² = 4 tall.",
      ],
      wrongFeedback: "Check which edge sets each block's height. Here it's the right edge, where the curve is higher.",
      debriefLine: "Your right-edge estimate was {{sum}}. The true area is {{exact}}, so the blocks poke out a little above the curve.",
      sourceRef: { page: 5, quote: "A Riemann sum approximates the area under a curve using rectangles whose heights come from sample points across the interval." },
    },
  },
  {
    cardId: "fill_the_reservoir",
    slice: {
      prompt: "Water flows in at a rate of x² per unit of time, starting at x = 0. Close the gate when the tank holds exactly the target amount.",
      params: {
        expr: "x^2",
        a: "0",
        target: "1",
        bMin: "1",
        bMax: "2",
      },
      hints: [
        "The water in the tank so far is the area under the curve from 0 to your gate.",
        "The area under x² from 0 to b is b³ ÷ 3. Set that equal to the target of 1.",
        "So b³ needs to be 3. Find the number that cubes to 3.",
      ],
      wrongFeedback: "Check the area under the curve up to your gate. It should come out to exactly the target.",
      debriefLine: "Closing the gate at b = {{b}} holds exactly {{target}}. That's the area under the curve up to there.",
      sourceRef: { page: 6, quote: "The definite integral gives exact area under a curve even when no simple geometric formula applies." },
    },
  },
];

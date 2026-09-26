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
      prompt: "The cell sits in a solution with more solute outside than in. Predict what happens to it, then watch.",
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
          { text: "Water leaves the cell down its own concentration gradient, and the cell shrinks", asserts: "decreases", explanation: "Water crosses the semipermeable membrane toward the higher solute concentration; the solute itself mostly can't cross, so water leaves and the cell shrinks." },
          { text: "Salt moves into the cell to even out the concentrations, and the cell stays the same size", asserts: "stays", explanation: "The membrane is far more permeable to water than to solute, so it's water, not salt, that moves." },
        ],
        comparison: "decreases",
        threshold: "50",
      },
      hints: [
        "Water crosses a semipermeable membrane far more easily than solute does.",
        "Water moves toward the side with MORE solute, trying to dilute it.",
        "Outside has more solute, so water leaves the cell down its own gradient.",
      ],
      wrongFeedback: "It isn't the solute that crosses the membrane easily here; think about which side water is drawn toward.",
      debriefLine: "Osmosis in action: {{outcome}}, because {{correct}}",
      sourceRef: { page: 4, quote: "In osmosis, water moves across a selectively permeable membrane toward the side with the higher solute concentration." },
    },
  },
  {
    cardId: "feedback_controller",
    slice: {
      prompt: "Blood glucose keeps climbing after a meal. Release insulin at the right moments to hold it in the safe range.",
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
        "Left alone, glucose keeps rising after the meal; it won't level off by itself.",
        "Insulin pulls glucose back down; too little and it keeps climbing, too much and it may crash.",
        "A single, steady dose of insulin can offset the meal's steady rise and hold glucose flat.",
      ],
      wrongFeedback: "Homeostasis isn't an on/off switch: releasing insulin once and stopping won't offset a rise that keeps happening every tick.",
      debriefLine: "Keeping {{target}} in band takes ongoing feedback from {{control}}, not a single push.",
      sourceRef: { page: 6, quote: "Hormonal control in homeostasis is a continuous feedback loop, releasing and easing off as the level shifts." },
    },
  },
  {
    cardId: "prediction_stabilizer",
    slice: {
      prompt: "Flip the fair coin hundreds of times and watch where the running average of heads settles.",
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
          { text: "It settles in close to 0.5, no matter what happened on recent flips", isCorrect: true, explanation: "Each flip is independent; the law of large numbers pulls the running average toward the true 50% odds, not toward 'catching up' on past results." },
          { text: "After a run of heads, tails becomes more likely to even things out", isCorrect: false, explanation: "The coin has no memory: past flips never change the odds of the next one." },
        ],
        ranges: [
          { optionIndex: 0, low: "0.4", high: "0.6" },
          { optionIndex: 1, low: "0.6", high: null },
        ],
      },
      hints: [
        "Each flip is completely independent of every flip before it.",
        "The coin has no memory, so a streak of heads doesn't make tails \"due\".",
        "Over many independent flips, the average drifts toward the true 50% odds.",
      ],
      wrongFeedback: "\"Due for tails\" assumes the coin remembers past flips; a fair coin's odds never change based on history.",
      debriefLine: "Across {{trials}} trials, {{statistic}}: {{correct}}",
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
        "Each block's height comes from the curve at the right edge of its slice.",
        "Add up height times width for all 8 blocks; width is the same for each one.",
        "The blocks are narrow: (2-0)/8 = 0.25 wide each.",
      ],
      wrongFeedback: "Left sums and right sums don't always over- or underestimate the same way; it depends on whether the curve is rising or falling.",
      debriefLine: "The right-sum estimate was {{sum}}, close to the true area of {{exact}}.",
      sourceRef: { page: 5, quote: "A Riemann sum approximates the area under a curve using rectangles whose heights come from sample points across the interval." },
    },
  },
  {
    cardId: "fill_the_reservoir",
    slice: {
      prompt: "Water flows in at a rate of x^2 per unit time starting from x = 0. Close the gate where the reservoir holds exactly the target volume.",
      params: {
        expr: "x^2",
        a: "0",
        target: "1",
        bMin: "1",
        bMax: "2",
      },
      hints: [
        "The reservoir's volume is the area under the rate curve from a to your gate position b.",
        "There's no simple shape formula here; the definite integral gives the exact area even for a curved boundary.",
        "Try gate positions between 1 and 2 and see how the accumulated area grows as b grows.",
      ],
      wrongFeedback: "A curved boundary doesn't mean you need a special shape formula; the definite integral handles any shape.",
      debriefLine: "Closing the gate at b = {{b}} holds exactly the target volume of {{target}}.",
      sourceRef: { page: 6, quote: "The definite integral gives exact area under a curve even when no simple geometric formula applies." },
    },
  },
];

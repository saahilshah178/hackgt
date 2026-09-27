import type { ChallengeSlice } from "../src/contracts/slices";

/**
 * One realistic encounter per wave-1b mode (P4 part B), each on a real catalog card, following
 * docs/overnight/wave1-modes.md's param shapes exactly. Consumed by tests/wave1b.test.ts, which
 * assembles each into a mini GameSpec and autoSolves it.
 */
export const WAVE1B: { cardId: string; slice: ChallengeSlice }[] = [
  {
    cardId: "formula_engine",
    slice: {
      prompt: "Set the push, or force, so the sled speeds up at the target acceleration. Its mass stays the same.",
      params: {
        expression: "F / m",
        outputName: "acceleration",
        outputUnit: "m/s^2",
        inputs: [
          { name: "F", unit: "N", min: 0, max: 100 },
          { name: "m", unit: "kg", min: 1, max: 20 },
        ],
        controlled: "F",
        fixed: [{ name: "m", value: "5" }],
        solution: "20",
      },
      hints: [
        "The mass is fixed at {{m}}. Only the force can change.",
        "Acceleration is force divided by mass. So force is acceleration times mass.",
        "The target is {{target}}. Multiply that by {{m}}.",
      ],
      wrongFeedback: "Check F = m × a. Multiply the target acceleration by the mass to get the force you need.",
      debriefLine: "F = ma. With a mass of {{m}}, a force of {{controlled}} gives {{target}}.",
      sourceRef: { page: 1, quote: "Newton's second law: the acceleration of an object is directly proportional to the net force acting on it and inversely proportional to its mass (F = ma)." },
    },
  },
  {
    cardId: "oracle_of_consequence",
    slice: {
      prompt: "A steel ball and a feather drop at the same time in a vacuum, with all the air pumped out. Which lands first?",
      params: {
        scenario: "A steel ball and a feather are released at the same instant inside a vacuum chamber with all the air pumped out.",
        options: [
          { text: "They land at the same instant", isCorrect: true, explanation: "With no air pushing back, gravity speeds up everything the same." },
          { text: "The steel ball lands first because it is heavier", isCorrect: false, explanation: "Weight doesn't change how fast things fall. That idea comes from air pushing back, and there's no air here." },
          { text: "The feather lands first because it is lighter", isCorrect: false, explanation: "Lighter things fall just as fast as heavier ones in a vacuum." },
        ],
        reveal: "In the vacuum chamber, the ball and feather hit the floor at the same instant.",
        revealSource: "computed",
      },
      hints: [
        "Outside, a feather drifts down slowly. It's the air that slows it.",
        "Here the air is pumped out. So only gravity pulls on the ball and the feather.",
        "Gravity speeds up light and heavy things the same. That rules out the heavy ball winning.",
      ],
      wrongFeedback: "There's no air to slow the feather. Gravity alone pulls on both, and it pulls them the same.",
      debriefLine: "{{correct}}. With no air, gravity speeds up every mass the same.",
      sourceRef: { page: 1, quote: "In the absence of air resistance, all objects fall with the same acceleration due to gravity, regardless of their mass." },
    },
  },
  {
    cardId: "cycle_wheel",
    slice: {
      prompt: "The seasons wheel is scrambled. Put the stages in order so each one leads to the next.",
      params: {
        stages: [
          "Days lengthen and the ground warms toward the summer peak",
          "Peak daylight passes and the ground slowly begins to cool",
          "Days shorten and the ground cools toward the winter low",
          "The lowest point passes and daylight begins to lengthen again",
        ],
        decoys: ["The cycle stops permanently once winter ends"],
      },
      hints: [
        "A cycle has no real start. Pick the warming stage and ask what comes after it.",
        "After the summer peak, days start getting shorter. Find the stage where cooling begins.",
        "One card says the cycle stops after winter. Seasons keep going, so leave it out.",
      ],
      wrongFeedback: "Check what really comes next. Seasons don't skip a stage or go backward.",
      debriefLine: "You closed the seasons cycle. All {{count}} stages lead into each other.",
      sourceRef: { page: 1, quote: "The seasonal cycle repeats indefinitely: warming toward summer, cooling toward winter, and back again." },
    },
  },
  {
    cardId: "periodic_landscape",
    slice: {
      prompt: "Rank these elements by atomic radius, which is how big each atom is. Put the largest first.",
      params: {
        property: "atomic radius",
        direction: "descending",
        items: [
          { text: "Potassium (K)", value: "227", label: "227 pm" },
          { text: "Sodium (Na)", value: "186", label: "186 pm" },
          { text: "Chlorine (Cl)", value: "99", label: "99 pm" },
          { text: "Fluorine (F)", value: "42", label: "42 pm" },
        ],
      },
      hints: [
        "Potassium and sodium sit in the same column of the periodic table. So do chlorine and fluorine.",
        "Atoms get bigger going down a column. They get smaller going right across a row.",
        "Potassium is one row below sodium. Now compare chlorine and fluorine the same way.",
      ],
      wrongFeedback: "Compare rows and columns. Atoms get bigger going down and smaller going right.",
      debriefLine: "{{first}} is the biggest and {{last}} is the smallest. Atoms grow down a column and shrink across a row.",
      sourceRef: { page: 1, quote: "Atomic radius increases down a group and decreases across a period from left to right." },
    },
  },
  {
    cardId: "intersection_hunt",
    slice: {
      prompt: "Two laser paths cross the grid. Mark the one point both pass through.",
      params: {
        xMin: "-5",
        xMax: "5",
        yMin: "-5",
        yMax: "5",
        gridStep: "1",
        labels: "decimal",
        targetX: "2",
        targetY: "3",
        xLabel: "x",
        yLabel: "y",
        overlay: "two straight laser paths crossing once",
      },
      hints: [
        "Find where the two lasers meet. That's the only point on both paths.",
        "Start at the middle, where x and y are both 0. Count squares right, then up.",
        "The crossing sits exactly on a grid corner, to the right of the middle and above it.",
      ],
      wrongFeedback: "That point misses one of the paths. Check both x and y.",
      debriefLine: "The lasers cross at ({{x}}, {{y}}). That one point works for both equations.",
      sourceRef: { page: 1, quote: "A solution to a system of equations must satisfy every equation in the system simultaneously, which corresponds to the point where their graphs intersect." },
    },
  },
];

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
      prompt: "Same push, different mass. Set the force so the sled hits the target acceleration.",
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
        "Newton's second law relates force, mass, and acceleration.",
        "acceleration = force / mass, so force = acceleration × mass.",
        "The mass is fixed at {{m}}; solve F = a × m for the target acceleration.",
      ],
      wrongFeedback: "Check F = m·a: multiply the target acceleration by the fixed mass to get the needed force.",
      debriefLine: "F = ma: with mass {{m}}, a force of {{controlled}} gives {{target}}.",
      sourceRef: { page: 1, quote: "Newton's second law: the acceleration of an object is directly proportional to the net force acting on it and inversely proportional to its mass (F = ma)." },
    },
  },
  {
    cardId: "oracle_of_consequence",
    slice: {
      prompt: "A steel ball and a feather are dropped together in a vacuum chamber. Which lands first?",
      params: {
        scenario: "A steel ball and a feather are released at the same instant inside a vacuum chamber with all the air pumped out.",
        options: [
          { text: "They land at the same instant", isCorrect: true, explanation: "With no air resistance, gravity accelerates every mass equally." },
          { text: "The steel ball lands first because it is heavier", isCorrect: false, explanation: "Weight doesn't change gravitational acceleration; that intuition comes from air resistance, which is absent here." },
          { text: "The feather lands first because it is lighter", isCorrect: false, explanation: "Lighter objects fall exactly as fast as heavier ones in a vacuum." },
        ],
        reveal: "In the vacuum chamber, the ball and feather hit the floor at the same instant.",
        revealSource: "computed",
      },
      hints: [
        "Air resistance is what usually slows a feather down, not gravity itself.",
        "Remove the air, and only gravity acts on both objects.",
        "Gravitational acceleration doesn't depend on mass: g is the same for both.",
      ],
      wrongFeedback: "In a vacuum there is no air resistance to slow the feather, so gravity alone decides the fall, equally for both.",
      debriefLine: "Free fall in a vacuum: {{correct}}, because gravitational acceleration doesn't depend on mass.",
      sourceRef: { page: 1, quote: "In the absence of air resistance, all objects fall with the same acceleration due to gravity, regardless of their mass." },
    },
  },
  {
    cardId: "cycle_wheel",
    slice: {
      prompt: "The seasonal cycle wheel is scrambled. Set the stages so each feeds the next.",
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
        "There's no fixed 'first' stage: pick any point and follow what happens next.",
        "Each stage should describe what makes the following stage happen.",
        "After the coolest point, the only way to go is back toward warming.",
      ],
      wrongFeedback: "Check what actually follows each stage: a season doesn't skip ahead or reverse without passing through its neighbor.",
      debriefLine: "You closed the seasonal cycle of {{count}} stages.",
      sourceRef: { page: 1, quote: "The seasonal cycle repeats indefinitely: warming toward summer, cooling toward winter, and back again." },
    },
  },
  {
    cardId: "periodic_landscape",
    slice: {
      prompt: "Rank these elements by atomic radius, largest first.",
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
        "Atomic radius shrinks moving right across a period and grows moving down a group.",
        "Potassium and sodium are both in group 1; chlorine and fluorine are both halogens.",
        "Potassium is a period below sodium, and both are far larger than the halogens.",
      ],
      wrongFeedback: "Compare rows and columns: radius grows down a group and shrinks across a period left to right.",
      debriefLine: "Periodic trend in {{property}}: {{first}} is largest, {{last}} smallest, from left-to-right shrinkage and top-to-bottom growth.",
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
        "A system's solution must satisfy both equations at once.",
        "That's exactly where the two lines cross on the grid.",
        "Count grid lines from the origin: the crossing sits a few steps right and a few steps up.",
      ],
      wrongFeedback: "Check both axes: the point where the lasers cross must satisfy both paths simultaneously.",
      debriefLine: "The lasers cross at {{x}}, {{y}}: the one point that solves both equations.",
      sourceRef: { page: 1, quote: "A solution to a system of equations must satisfy every equation in the system simultaneously, which corresponds to the point where their graphs intersect." },
    },
  },
];

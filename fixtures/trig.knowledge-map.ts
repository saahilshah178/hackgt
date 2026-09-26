import type { Intake, KnowledgeMap } from "../src/contracts/knowledge";
import type { MatchResult } from "../src/contracts/match";

/** What the curriculum agent (S2) produces for samples/trig-notes.pdf, after quote verification. */
export const trigKnowledgeMap: KnowledgeMap = {
  sourceId: "src_trig_ch4",
  title: "Precalculus Ch. 4: Trigonometric Functions",
  subject: { domain: "math", topic: "Trigonometric functions" },
  level: "High school / intro college",
  unsourced: false,
  outline: [
    { title: "4.1 Radian measure", pageStart: 1, pageEnd: 1 },
    { title: "4.2 Graphs of sine and cosine", pageStart: 2, pageEnd: 3 },
    { title: "4.3 Solving trigonometric equations", pageStart: 4, pageEnd: 4 },
  ],
  units: [
    { id: "u_angles", name: "Angles and radians", conceptIds: ["c_radians"] },
    { id: "u_graphs", name: "Graphs of sine and cosine", conceptIds: ["c_period", "c_amplitude"] },
    { id: "u_equations", name: "Trigonometric equations", conceptIds: ["c_solve"] },
  ],
  concepts: [
    {
      id: "c_radians",
      unitId: "u_angles",
      name: "Radian measure",
      summary: "Angles measured by arc length on the unit circle; one full turn is 2π.",
      knowledgeType: "quantitative",
      learningObjective: "The student can locate an angle in radians on the unit circle and convert between degrees and radians.",
      importance: "core",
      difficulty: 1,
      prerequisites: [],
      keywords: ["radian", "radians", "angle", "pi", "degrees", "unit circle", "arc length"],
      facts: [
        { statement: "One full revolution is 2π radians.", sourceRef: { page: 1, quote: "One complete revolution corresponds to 2π radians." } },
        { statement: "π radians is half a revolution, or 180°.", sourceRef: { page: 1, quote: "An angle of π radians corresponds to half a revolution." } },
      ],
      misconceptions: [{ belief: "π radians is a full circle.", correction: "π radians is half a circle; a full circle is 2π." }],
      formulas: [{ label: "degrees to radians", mathjs: "d * pi / 180", variables: [{ name: "d", unit: "deg", min: 0, max: 360 }] }],
    },
    {
      id: "c_period",
      unitId: "u_graphs",
      name: "Period of sin(bx) and cos(bx)",
      summary: "The horizontal length of one full cycle, 2π/|b|.",
      knowledgeType: "quantitative",
      learningObjective: "The student can compute the period of y = sin(bx) or cos(bx) and explain why a larger b shortens it.",
      importance: "core",
      difficulty: 2,
      prerequisites: ["c_radians"],
      keywords: ["period", "sine", "cosine", "sinusoid", "wave", "cycle", "b", "horizontal compression"],
      facts: [
        { statement: "The period of y = sin(bx) is 2π/|b|.", sourceRef: { page: 3, quote: "The period of y = sin(bx) is 2π/|b|." } },
        { statement: "Increasing b makes the graph repeat more often.", sourceRef: { page: 3, quote: "Larger values of b compress the graph horizontally." } },
      ],
      misconceptions: [
        { belief: "sin(2x) has period 4π, twice as long as sin(x).", correction: "A bigger b squeezes the wave, so sin(2x) has period π." },
      ],
      formulas: [{ label: "period", mathjs: "2 * pi / abs(b)", variables: [{ name: "b", unit: "rad/unit", min: 0.1, max: 8 }] }],
    },
    {
      id: "c_amplitude",
      unitId: "u_graphs",
      name: "Amplitude",
      summary: "|A| in y = A·sin(x): the height of the wave above its midline.",
      knowledgeType: "quantitative",
      learningObjective: "The student can read the amplitude from an equation or graph and distinguish it from the peak-to-trough distance.",
      importance: "supporting",
      difficulty: 1,
      prerequisites: [],
      keywords: ["amplitude", "height", "peak", "trough", "midline", "vertical stretch"],
      facts: [
        { statement: "The amplitude of y = A sin x is |A|.", sourceRef: { page: 2, quote: "The amplitude of y = A sin x is |A|." } },
        { statement: "Changing A does not change the period.", sourceRef: { page: 2, quote: "The value of A stretches the graph vertically but leaves the period unchanged." } },
      ],
      misconceptions: [{ belief: "Amplitude is the distance from peak to trough.", correction: "Peak-to-trough is twice the amplitude; amplitude is |A|." }],
      formulas: [],
    },
    {
      id: "c_solve",
      unitId: "u_equations",
      name: "Solving sin(x) = k on [0, 2π)",
      summary: "Isolate the sine, find the reference angle, then use the quadrants where sine has that sign.",
      knowledgeType: "procedure",
      learningObjective: "The student can find every solution of a basic sine equation on one period.",
      importance: "core",
      difficulty: 2,
      prerequisites: ["c_radians"],
      keywords: ["solve", "trig equation", "reference angle", "quadrant", "inverse sine", "solutions"],
      facts: [
        { statement: "First isolate the trigonometric function.", sourceRef: { page: 4, quote: "To solve a trigonometric equation, first isolate the trigonometric function." } },
        { statement: "Sine is positive in quadrants I and II.", sourceRef: { page: 4, quote: "The sine function is positive in the first and second quadrants." } },
      ],
      misconceptions: [{ belief: "sin(x) = 1/2 has only one solution on [0, 2π).", correction: "It has two: π/6 in quadrant I and 5π/6 in quadrant II." }],
      formulas: [],
    },
  ],
};

/** What the intake screen collected: confidence per unit, plus the FAST pre-check (already shuffled by code) and the student's answers. */
export const trigIntake: Intake = {
  goal: "review",
  minutes: 5,
  genre: "dungeon",
  confidence: { u_angles: 4, u_graphs: 2, u_equations: 2 },
  preCheck: {
    items: [
      { conceptId: "c_period", prompt: "What is the period of y = sin(3x)?", choices: ["6π", "2π/3", "3", "π/3"], correctIndex: 1 },
      { conceptId: "c_amplitude", prompt: "What is the amplitude of y = -4cos(x)?", choices: ["-4", "8", "4", "2"], correctIndex: 2 },
      { conceptId: "c_radians", prompt: "How many degrees is 3π/4 radians?", choices: ["135°", "45°", "270°", "75°"], correctIndex: 0 },
    ],
    answers: [0, 2, 0],
  },
};

/** What the matcher (S4) produces per concept: implemented picks plus a wishlist of good cards whose family isn't built yet. */
export const trigMatches: MatchResult[] = [
  {
    conceptId: "c_radians",
    picks: [
      { teachingMechanicId: "radian_rune_line", score: 9.2, reason: "Radians become distance along the unrolled circle.", targetsMisconception: "π radians is a full circle." },
      { teachingMechanicId: "number_line_leap", score: 5.1, reason: "Generic magnitude placement.", targetsMisconception: null },
      { teachingMechanicId: "mimic_chest", score: 3.0, reason: "Universal fallback.", targetsMisconception: "π radians is a full circle." },
    ],
    wishlist: [{ teachingMechanicId: "arc_builder", score: 6.4 }],
  },
  {
    conceptId: "c_period",
    picks: [
      { teachingMechanicId: "phase_gate", score: 9.8, reason: "Dialing the period forces 2π/|b|.", targetsMisconception: "sin(2x) has period 4π, twice as long as sin(x)." },
      { teachingMechanicId: "pulse_matcher", score: 6.0, reason: "Frequency as the reciprocal of period.", targetsMisconception: null },
      { teachingMechanicId: "mimic_chest", score: 3.0, reason: "Universal fallback.", targetsMisconception: "sin(2x) has period 4π, twice as long as sin(x)." },
    ],
    wishlist: [],
  },
  {
    conceptId: "c_amplitude",
    picks: [
      { teachingMechanicId: "oscillation_reach", score: 8.7, reason: "Setting the swing height isolates |A|.", targetsMisconception: "Amplitude is the distance from peak to trough." },
      { teachingMechanicId: "mimic_chest", score: 3.0, reason: "Universal fallback.", targetsMisconception: "Amplitude is the distance from peak to trough." },
    ],
    wishlist: [],
  },
  {
    conceptId: "c_solve",
    picks: [
      { teachingMechanicId: "trig_solve_bridge", score: 9.5, reason: "The procedure's order is the puzzle.", targetsMisconception: "sin(x) = 1/2 has only one solution on [0, 2π)." },
      { teachingMechanicId: "chrono_bridge", score: 5.0, reason: "Generic ordering.", targetsMisconception: null },
      { teachingMechanicId: "mimic_chest", score: 3.0, reason: "Universal fallback.", targetsMisconception: "sin(x) = 1/2 has only one solution on [0, 2π)." },
    ],
    wishlist: [],
  },
];

import type { Intake, KnowledgeMap } from "../src/contracts/knowledge";

export const trigKnowledgeMap: KnowledgeMap = {
  sourceId: "src_trig_ch4",
  title: "Precalculus Ch. 4: Trigonometric Functions",
  subject: "Mathematics",
  level: "High school / intro college",
  unsourced: false,
  concepts: [
    {
      id: "c_radians",
      name: "Radian measure",
      summary: "Angles measured by arc length on the unit circle; one full turn is 2π.",
      knowledgeType: "quantitative",
      difficulty: 1,
      prerequisites: [],
      facts: [
        { statement: "One full revolution is 2π radians.", sourceRef: { page: 211, quote: "One complete revolution corresponds to 2π radians." } },
        { statement: "π radians is half a revolution, or 180°.", sourceRef: { page: 212, quote: "An angle of π radians corresponds to half a revolution." } },
      ],
      misconceptions: [{ belief: "π radians is a full circle.", correction: "π radians is half a circle; a full circle is 2π." }],
      formulas: [{ label: "degrees to radians", mathjs: "d * pi / 180", variables: [{ name: "d", unit: "deg", min: 0, max: 360 }] }],
    },
    {
      id: "c_period",
      name: "Period of sin(bx) and cos(bx)",
      summary: "The horizontal length of one full cycle, 2π/|b|.",
      knowledgeType: "quantitative",
      difficulty: 2,
      prerequisites: ["c_radians"],
      facts: [
        { statement: "The period of y = sin(bx) is 2π/|b|.", sourceRef: { page: 231, quote: "The period of y = sin(bx) is 2π/|b|." } },
        { statement: "Increasing b makes the graph repeat more often.", sourceRef: { page: 232, quote: "Larger values of b compress the graph horizontally." } },
      ],
      misconceptions: [
        { belief: "sin(2x) has period 4π, twice as long as sin(x).", correction: "A bigger b squeezes the wave, so sin(2x) has period π." },
      ],
      formulas: [{ label: "period", mathjs: "2 * pi / abs(b)", variables: [{ name: "b", unit: "rad/unit", min: 0.1, max: 8 }] }],
    },
    {
      id: "c_amplitude",
      name: "Amplitude",
      summary: "|A| in y = A·sin(x): the height of the wave above its midline.",
      knowledgeType: "quantitative",
      difficulty: 1,
      prerequisites: [],
      facts: [
        { statement: "The amplitude of y = A sin x is |A|.", sourceRef: { page: 229, quote: "The amplitude of y = A sin x is |A|." } },
        { statement: "Changing A does not change the period.", sourceRef: { page: 230, quote: "The value of A stretches the graph vertically but leaves the period unchanged." } },
      ],
      misconceptions: [{ belief: "Amplitude is the distance from peak to trough.", correction: "Peak-to-trough is twice the amplitude; amplitude is |A|." }],
      formulas: [],
    },
    {
      id: "c_solve",
      name: "Solving sin(x) = k on [0, 2π)",
      summary: "Isolate the sine, find the reference angle, then use the quadrants where sine has that sign.",
      knowledgeType: "procedure",
      difficulty: 2,
      prerequisites: ["c_radians"],
      facts: [
        { statement: "First isolate the trigonometric function.", sourceRef: { page: 247, quote: "To solve a trigonometric equation, first isolate the trigonometric function." } },
        { statement: "Sine is positive in quadrants I and II.", sourceRef: { page: 248, quote: "The sine function is positive in the first and second quadrants." } },
      ],
      misconceptions: [{ belief: "sin(x) = 1/2 has only one solution on [0, 2π).", correction: "It has two: π/6 in quadrant I and 5π/6 in quadrant II." }],
      formulas: [],
    },
  ],
};

export const trigIntake: Intake = {
  goal: "exam",
  minutes: 8,
  genre: "dungeon",
  confidence: { c_radians: 4, c_period: 2, c_amplitude: 3, c_solve: 2 },
};

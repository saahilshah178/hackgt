import type { AssessmentSlice, BlueprintSlice, ChallengeSlice, NarrativeSlice } from "../src/contracts/slices";
import type { Slices } from "../src/pipeline/assemble";
import { trigIntake, trigKnowledgeMap } from "./trig.knowledge-map";

/** What the Director returns. */
export const trigBlueprint: BlueprintSlice = {
  genre: "dungeon",
  title: "The Sky Clock",
  theme: {
    setting: "An old observatory tower with a broken sky clock",
    tone: "mysterious but playful",
    paletteId: "ember",
    musicMood: "curious",
  },
  premise:
    "The astronomer's star chart is at the top of a broken sky clock. Fix each machine as you climb to reach it.",
  characters: [
    { id: "cog", name: "Cog", role: "brass owl companion", voiceArchetype: "cheerful_sidekick" },
    { id: "warden", name: "The Warden", role: "clockwork guardian of the chart", voiceArchetype: "gruff_guard" },
  ],
  encounters: [
    { id: "e1_radians", conceptIds: ["c_radians"], teachingMechanicId: "radian_rune_line", socket: "altar", role: "teach", difficulty: 1, targetMisconception: "π radians is a full circle.", designNote: "Make the player see radians as distance along an unrolled circle." },
    { id: "e2_period", conceptIds: ["c_period"], teachingMechanicId: "phase_gate", socket: "door", role: "teach", difficulty: 1, targetMisconception: "sin(2x) has period 4π, twice as long as sin(x).", designNote: "First contact with period = 2π/|b|, using an integer b." },
    { id: "e3_amplitude", conceptIds: ["c_amplitude"], teachingMechanicId: "mimic_chest", socket: "chest", role: "teach", difficulty: 1, targetMisconception: "Amplitude is the distance from peak to trough.", designNote: "Target the peak-to-trough misconception." },
    { id: "e4_solve", conceptIds: ["c_solve"], teachingMechanicId: "trig_solve_bridge", socket: "door", role: "teach", difficulty: 2, targetMisconception: "sin(x) = 1/2 has only one solution on [0, 2π).", designNote: "The order of moves for solving 2sin(x) = 1, with a tempting wrong first move." },
    { id: "e5_period_review", conceptIds: ["c_period"], teachingMechanicId: "mimic_chest", socket: "chest", role: "review", difficulty: 2, targetMisconception: "sin(2x) has period 4π, twice as long as sin(x).", designNote: "Spaced review of period, attacking the 'bigger b means longer period' error." },
    { id: "e6_boss", conceptIds: ["c_period", "c_amplitude"], teachingMechanicId: "phase_gate", socket: "boss", role: "boss", difficulty: 3, targetMisconception: null, designNote: "Combine both: a large amplitude the player must ignore when finding a non-integer b's period." },
  ],
};

/** What each challenge writer returns, keyed by encounter id. Note the {{placeholders}}: no computed values. Locked params (ask, scale, labels) are absent: code merges them. */
export const trigChallenges: Record<string, ChallengeSlice> = {
  e1_radians: {
    prompt: "This line is one full turn of a circle, laid out flat from 0 to 2π. Step onto {{target}}.",
    params: { min: "0", max: "2*pi", target: "5*pi/6", landmarkStep: "pi/2" },
    hints: [
      "Find π first. The line ends at 2π, so π is only halfway along.",
      "5π/6 is five sixths of π. Split the part from 0 to π into six equal steps.",
      "It's past the π/2 mark and short of π, closer to π.",
    ],
    wrongFeedback: "Not there. π sits halfway along the line, so count sixths of π from 0.",
    debriefLine: "Radians measure how far you go around a circle. {{target}} is 5/12 of one full turn.",
    sourceRef: { page: 1, quote: "An angle of π radians corresponds to half a revolution." },
  },
  e2_period: {
    prompt: "The door's rings spin on {{equation}}. Set the dial to one period, the time for one full turn.",
    params: { wave: "sin", amplitude: 1, b: "2", c: "0", d: 0 },
    hints: [
      "Look at the 2 inside sin(2t). It makes these rings spin faster than plain sin(t).",
      "One period is 2π divided by the number next to t. Here that's 2π ÷ 2.",
      "Plain sin(t) takes 2π. Twice as fast means half of 2π.",
    ],
    wrongFeedback: "The 2 makes the rings spin faster. So one turn takes less time than 2π.",
    debriefLine: "The period of {{equation}} is {{period}}. That's 2π divided by {{b}}, the number next to t.",
    sourceRef: { page: 3, quote: "The period of y = sin(bx) is 2π/|b|." },
  },
  e3_amplitude: {
    prompt: "Three chests make claims about amplitude, how high a wave goes above its middle. Point your lantern at the one that's lying.",
    params: {
      statements: [
        { text: "The amplitude of y = 3sin(x) is 3", isTrue: true, explanation: "Amplitude is the size of the number in front. Here that's 3." },
        { text: "The amplitude of y = 3sin(x) is 6, from top to bottom", isTrue: false, explanation: "Top to bottom is 6, but that's twice the amplitude. The amplitude is 3." },
        { text: "Multiplying sin(x) by 3 doesn't change its period", isTrue: true, explanation: "The 3 makes the wave taller. Only the number next to x changes the period." },
      ],
    },
    hints: [
      "Two claims give a different amplitude for 3sin(x). They can't both be right.",
      "Amplitude goes from the middle line up to the top. For 3sin(x), the top is at 3.",
      "The claim about the period is true. Compare the other two.",
    ],
    wrongFeedback: "That one's true. Look for the claim that measures the whole swing.",
    debriefLine: "The mimic said \"{{mimic}}\". But amplitude only goes from the middle to the top, so it's 3.",
    sourceRef: { page: 2, quote: "The amplitude of y = A sin x is |A|." },
  },
  e4_solve: {
    prompt: "Put the planks in order to solve 2sin(x) = 1 for x between 0 and 2π. One plank doesn't belong.",
    params: {
      steps: [
        "Get sin(x) by itself, so sin(x) = 1/2",
        "Find the reference angle, sin(π/6) = 1/2",
        "Sine is positive in the top half, quadrants I and II",
        "Write both answers, x = π/6 and x = 5π/6",
      ],
      decoys: ["Take the inverse sine of 2 first"],
    },
    hints: [
      "The 2 in 2sin(x) is in the way. Get rid of it before you look for any angle.",
      "Once sin(x) = 1/2, find the smallest angle with that sine. Then check where else sine is positive.",
      "The inverse sine of 2 plank doesn't fit. No angle has a sine of 2.",
    ],
    wrongFeedback: "That order doesn't work. You can't find the angle until sin(x) is by itself.",
    debriefLine: "You solved 2sin(x) = 1 in {{count}} steps. Sine is positive twice around the circle, so there were two answers.",
    sourceRef: { page: 4, quote: "To solve a trigonometric equation, first isolate the trigonometric function." },
  },
  e5_period_review: {
    prompt: "Three chests make claims about periods, and one is lying. Point your lantern at it.",
    params: {
      statements: [
        { text: "y = sin(2x) repeats every π, twice as often as sin(x)", isTrue: true, explanation: "2π ÷ 2 = π." },
        { text: "y = sin(2x) has period 4π, twice as long as sin(x)", isTrue: false, explanation: "The 2 makes the wave faster, so the period shrinks to π." },
        { text: "y = cos(x/2) has period 4π, twice as long as cos(x)", isTrue: true, explanation: "2π ÷ (1/2) = 4π." },
      ],
    },
    hints: [
      "Two chests give sin(2x) different periods. The 2 makes that wave go faster.",
      "Period is 2π divided by the number next to x. For sin(2x), that's 2π ÷ 2.",
      "The chest about cos(x/2) is telling the truth. Compare the other two.",
    ],
    wrongFeedback: "That chest is telling the truth. Check each claim by dividing 2π by the number next to x.",
    debriefLine: "The mimic said \"{{mimic}}\". But a bigger number next to x makes the period shorter.",
    sourceRef: { page: 3, quote: "Larger values of b compress the graph horizontally." },
  },
  e6_boss: {
    prompt: "The Warden's shield swings on {{equation}}. Match its period, the time for one full swing, to get past.",
    params: { wave: "sin", amplitude: 3, b: "pi/2", c: "0", d: 0 },
    hints: [
      "The 3 in front only makes the shield swing wider. It doesn't change the timing.",
      "Period is 2π divided by the number next to t. Here that's 2π ÷ (π/2).",
      "Dividing by π/2 is the same as multiplying by 2/π. The π's cancel, leaving 2 × 2.",
    ],
    wrongFeedback: "The 3 makes it swing wider. The timing comes from the π/2 next to t.",
    debriefLine: "The shield's amplitude was 3 and its period was {{period}}. Only the π/2 next to t set the period.",
    sourceRef: { page: 2, quote: "The value of A stretches the graph vertically but leaves the period unchanged." },
  },
};

/** What the narrative writer returns. */
export const trigNarrative: NarrativeSlice = {
  intro: [
    { speakerId: "cog", text: "The star chart is at the top. Fix each machine, and we can climb." },
  ],
  outro: [{ speakerId: "cog", text: "You got the star chart. Every machine on the way up is moving again." }],
  beats: [
    { encounterId: "e2_period", when: "before", speakerId: "cog", text: "Those rings spin on a sine wave. Watch how fast they turn." },
    { encounterId: "e6_boss", when: "before", speakerId: "warden", text: "Nobody gets past me with the wrong timing." },
    { encounterId: "e6_boss", when: "after", speakerId: "warden", text: "Your timing matches mine. You may pass." },
  ],
};

/** What the assessment writer returns: the post-check only (the pre-check came from the intake). Code shuffles the choices. */
export const trigAssessment: AssessmentSlice = {
  post: [
    { conceptId: "c_period", prompt: "What is the period of y = cos(x/3)?", correct: "6π", distractors: ["2π/3", "π/3", "3"] },
    { conceptId: "c_amplitude", prompt: "Which equation swings twice as high as y = sin(x)?", correct: "y = 2sin(x)", distractors: ["y = sin(2x)", "y = sin(x) + 2", "y = sin(x/2)"] },
    { conceptId: "c_radians", prompt: "Which angle is a quarter turn?", correct: "π/2", distractors: ["π", "2π", "π/4"] },
  ],
};

export const trigSlices: Slices = {
  id: "trig_demo_001",
  createdAt: "2026-09-26T02:00:00.000Z",
  km: trigKnowledgeMap,
  intake: trigIntake,
  blueprint: trigBlueprint,
  challenges: trigChallenges,
  narrative: trigNarrative,
  assessment: trigAssessment,
};

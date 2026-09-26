import type { AssessmentSlice, BlueprintSlice, ChallengeSlice, NarrativeSlice } from "../src/contracts/slices";
import type { Slices } from "../src/pipeline/assemble";
import { trigIntake, trigKnowledgeMap } from "./trig.knowledge-map";

/** What the Director returns. */
export const trigBlueprint: BlueprintSlice = {
  genre: "dungeon",
  title: "The Clockwork Crypt",
  theme: {
    setting: "A crypt of brass gears beneath an abandoned observatory",
    tone: "mysterious but playful",
    paletteId: "ember",
    musicMood: "curious",
  },
  premise:
    "The astronomer sealed her star chart behind machines that only move for someone who can read their rhythms. Tune the crypt to reach it.",
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
    prompt: "The altar's rune line runs from 0 to 2π. Step onto {{target}}.",
    params: { min: "0", max: "2*pi", target: "5*pi/6", landmarkStep: "pi/2" },
    hints: [
      "A full turn is 2π, so π sits exactly halfway along the line.",
      "5π/6 is a little less than π. Count in sixths of π.",
      "It sits between {{between}}, closer to the right one.",
    ],
    wrongFeedback: "Radians measure distance around the circle: π is half a turn, so fractions of π land proportionally along the line.",
    debriefLine: "The rune line was the unit circle unrolled: {{target}} is 5/12 of a full turn.",
    sourceRef: { page: 1, quote: "An angle of π radians corresponds to half a revolution." },
  },
  e2_period: {
    prompt: "The vault door's rings spin on {{equation}}. Set the dial to one full period so the rings lock.",
    params: { wave: "sin", amplitude: 1, b: "2", c: "0", d: 0 },
    hints: [
      "A period is how long the rings take to come back to where they started.",
      "For y = sin(b·t), one period lasts 2π/|b|.",
      "Here b = {{b}}: divide 2π by {{b}}.",
    ],
    wrongFeedback: "Doubling b doesn't double the period, it halves it: the rings spin faster, so each cycle is shorter.",
    debriefLine: "The door followed {{equation}}; its period is {{period}}, because 2π/|b| with b = {{b}}.",
    sourceRef: { page: 3, quote: "The period of y = sin(bx) is 2π/|b|." },
  },
  e3_amplitude: {
    prompt: "Three chests, three claims about amplitude. One is a mimic. Point your lantern at the lie.",
    params: {
      statements: [
        { text: "The amplitude of y = 3sin(x) is 3", isTrue: true, explanation: "Amplitude is |A|, the number in front." },
        { text: "The amplitude of y = 3sin(x) is 6, peak to trough", isTrue: false, explanation: "Peak-to-trough is 6, but that's twice the amplitude; the amplitude is |A| = 3." },
        { text: "Multiplying sin(x) by 3 leaves its period unchanged", isTrue: true, explanation: "A stretches the wave vertically; only b changes the period." },
      ],
    },
    hints: [
      "Amplitude is measured from the midline, not across the whole swing.",
      "Peak-to-trough is twice the amplitude.",
      "The mimic claims: {{mimic}}",
    ],
    wrongFeedback: "That chest is honest. Look for the claim that measures the whole swing.",
    debriefLine: "The mimic's claim, \"{{mimic}}\", confused the full swing with the amplitude, which is |A|.",
    sourceRef: { page: 2, quote: "The amplitude of y = A sin x is |A|." },
  },
  e4_solve: {
    prompt: "The glyph door opens only if its planks show how to solve 2sin(x) = 1 on [0, 2π). One plank doesn't belong.",
    params: {
      steps: [
        "Isolate the sine: sin(x) = 1/2",
        "Find the reference angle: sin(π/6) = 1/2",
        "Sine is positive in quadrants I and II",
        "Write both solutions: x = π/6 and x = 5π/6",
      ],
      decoys: ["Take the inverse sine of 2 first"],
    },
    hints: [
      "Get the sine by itself before anything else.",
      "Which angle in quadrant I has a sine of 1/2?",
      "Sine is positive in two quadrants, which is why there are two answers.",
    ],
    wrongFeedback: "Order matters: you can't find the angle until the sine is alone.",
    debriefLine: "You solved 2sin(x) = 1 in {{count}} moves: isolate, reference angle, quadrants, both solutions.",
    sourceRef: { page: 4, quote: "To solve a trigonometric equation, first isolate the trigonometric function." },
  },
  e5_period_review: {
    prompt: "The treasury's chests remember the vault door. One of them is lying about periods.",
    params: {
      statements: [
        { text: "y = sin(2x) repeats every π, twice as often as sin(x)", isTrue: true, explanation: "2π/|b| = 2π/2 = π." },
        { text: "y = sin(2x) has period 4π, twice that of sin(x)", isTrue: false, explanation: "A bigger b squeezes the wave: the period shrinks to π." },
        { text: "y = cos(x/2) has period 4π, stretched out", isTrue: true, explanation: "2π/(1/2) = 4π." },
      ],
    },
    hints: [
      "Period = 2π/|b|. Check each claim with it.",
      "A bigger b means a faster wave and a shorter period.",
      "The mimic claims: {{mimic}}",
    ],
    wrongFeedback: "That chest is telling the truth. Test each claim with 2π/|b|.",
    debriefLine: "Review: the mimic claimed \"{{mimic}}\", but a bigger b shrinks the period.",
    sourceRef: { page: 3, quote: "Larger values of b compress the graph horizontally." },
  },
  e6_boss: {
    prompt: "The Warden's shield spins on {{equation}}. Match its period to break through, and don't let the big swing fool you.",
    params: { wave: "sin", amplitude: 3, b: "pi/2", c: "0", d: 0 },
    hints: [
      "The 3 in front sets how far the shield swings, not how fast.",
      "Period = 2π/|b|, and here b = {{b}}.",
      "Divide 2π by π/2: the π's cancel.",
    ],
    wrongFeedback: "The amplitude doesn't change the timing. Only b does.",
    debriefLine: "The Warden's shield followed {{equation}}: amplitude 3 (how far), period {{period}} (how fast).",
    sourceRef: { page: 2, quote: "The value of A stretches the graph vertically but leaves the period unchanged." },
  },
};

/** What the narrative writer returns. */
export const trigNarrative: NarrativeSlice = {
  intro: [
    { speakerId: "cog", text: "Hoo! The astronomer's crypt runs on rhythm. Read the rhythm, and every door will open." },
  ],
  outro: [{ speakerId: "cog", text: "Her star chart! You read every rhythm in the crypt." }],
  beats: [
    { encounterId: "e2_period", when: "before", speakerId: "cog", text: "Those rings spin on a sine wave. Watch how fast, not how far." },
    { encounterId: "e6_boss", when: "before", speakerId: "warden", text: "None pass whose timing is false." },
    { encounterId: "e6_boss", when: "after", speakerId: "warden", text: "Your timing is true. Pass, reader of rhythms." },
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

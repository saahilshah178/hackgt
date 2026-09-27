/**
 * Learn phase for the trig dungeon only (The Sky Clock, trig_demo_001). The side-scroller shares this world
 * file, so the lessons are applied here, after the world is chosen, and never written back into it.
 *
 * The first four stops are taught on the way in: Cog talks while you walk, Brasswick says it in his own words,
 * and a plaque states the rule. The six machines themselves stay the Clockwork Crypt puzzles. After the chasm,
 * the walk stops explaining. Hints on a wrong answer are left as they are.
 */
import type { NpcState, Plaque, Requirement, Trigger, WorldLine, WorldOverlay } from "../../../contracts/world";

export const TRIG_DUNGEON_SPEC_ID = "trig_demo_001";

const say = (speakerId: string, text: string): WorldLine => ({ speakerId, text, mood: "neutral" });

function req(solved: string | null, flag: string | null = null): Requirement {
  return { solved, flag, notFlag: null, collected: [] };
}

const WALK: Trigger[] = [
  {
    id: "learn_radians",
    zoneId: "z1_sunward",
    x: 2500,
    surface: "ground",
    radius: 320,
    kind: "arrival",
    once: true,
    requires: req(null, "cog_awake"),
    setFlag: null,
    cue: null,
    cutsceneId: null,
    lines: [
      say("cog", "A radian is a walk around a circle, not a clock tick. One full lap of any circle is 2π."),
      say("cog", "π sets you down exactly halfway. Straight up from sunrise is a quarter of the lap: π/2."),
    ],
  },
  {
    id: "learn_period",
    zoneId: "z1_sunward",
    x: 6000,
    surface: "ground",
    radius: 280,
    kind: "arrival",
    once: true,
    requires: req("e1_radians"),
    setFlag: null,
    cue: null,
    cutsceneId: null,
    lines: [
      say("cog", "How soon a wave comes home is its period. For sin(b·t) or cos(b·t), that wait is 2π divided by |b|."),
      say("cog", "The number in front, like the 3 in 3sin(t), only changes how high it climbs. It never changes the wait."),
    ],
  },
  {
    id: "learn_amplitude",
    zoneId: "z2_crystal",
    x: 360,
    surface: "ground",
    radius: 220,
    kind: "arrival",
    once: true,
    requires: req("e2_period"),
    setFlag: null,
    cue: null,
    cutsceneId: null,
    lines: [
      say("cog", "Amplitude is how far the wave climbs from its middle. It is the number written in front of sin or cos."),
      say("cog", "A minus sign flips the wave upside down. The climb is still the size of that number, not twice it."),
    ],
  },
  {
    id: "learn_solve",
    zoneId: "z2_crystal",
    x: 3120,
    surface: "ground",
    radius: 200,
    kind: "arrival",
    once: true,
    requires: req("e3_amplitude"),
    setFlag: null,
    cue: null,
    cutsceneId: null,
    lines: [
      say("cog", "To solve sin(x) = k, clear any number in front of the sine first. Then find the angle whose sine is k."),
      say("cog", "On one full lap that angle happens twice: once on the way up, and once on the way back down."),
    ],
  },
  {
    id: "learn_quiz",
    zoneId: "z2_crystal",
    x: 5600,
    surface: "ground",
    radius: 360,
    kind: "arrival",
    once: true,
    requires: req("e4_solve"),
    setFlag: null,
    cue: null,
    cutsceneId: null,
    lines: [
      say("cog", "That's the last lesson I'll give you unasked. The machines ahead are quizzes. The rule is yours now."),
    ],
  },
];

const NOTES: Plaque[] = [
  {
    id: "note_radians",
    zoneId: "z1_sunward",
    x: 3200,
    surface: "ground",
    asset: "orrery_terraces.prop.plaque_post",
    kind: "plaque",
    title: "Ilse's note: radians",
    text: "A full circle is 2π radians, and π is halfway. 5π/6 is five of the six equal steps from sunrise to that halfway mark, so it sits just short of π.",
    sourceRef: null,
    requires: req(null, "cog_awake"),
  },
  {
    id: "note_period",
    zoneId: "z1_sunward",
    x: 6500,
    surface: "ground",
    asset: "orrery_terraces.prop.plaque_post",
    kind: "plaque",
    title: "Ilse's note: period",
    text: "The period of y = sin(bt) or y = cos(bt) is 2π/|b|. Read b from inside the parentheses. The Tidewheel is sin(2t), so divide 2π by 2.",
    sourceRef: null,
    requires: req("e1_radians"),
  },
  {
    id: "note_amplitude",
    zoneId: "z2_crystal",
    x: 1180,
    surface: "ground",
    asset: "orrery_terraces.prop.plaque_post",
    kind: "plaque",
    title: "Ilse's note: amplitude",
    text: "Amplitude is the distance from the midline to a peak. Peak to trough is twice the amplitude. A negative sign flips the wave and does not change the amplitude.",
    sourceRef: null,
    requires: req("e2_period"),
  },
  {
    id: "note_solve",
    zoneId: "z2_crystal",
    x: 3580,
    surface: "ground",
    asset: "orrery_terraces.prop.plaque_post",
    kind: "plaque",
    title: "Ilse's note: two answers",
    text: "For 2sin(x) = 1, divide first: sin(x) = 1/2. The reference angle is π/6. Sine is positive in quadrants I and II, so the answers are π/6 and π − π/6.",
    sourceRef: null,
    requires: req("e3_amplitude"),
  },
];

function brasswick(id: string, zoneId: string, x: number, solved: string | null, lines: WorldLine[]): NpcState {
  return {
    id,
    requires: solved ? req(solved) : null,
    zoneId,
    x,
    surface: "ground",
    lines,
    pose: solved ? "talk" : "work",
    follow: "none",
    repeatable: true,
    setFlag: null,
    anim: solved ? null : "arm_short",
  };
}

const BRASSWICK: NpcState[] = [
  brasswick("before", "z1_sunward", 3660, null, [
    say("brasswick", "Oh! A visitor. The dial ahead does not speak in hours. It speaks in walks around a circle."),
    say("brasswick", "Begin at sunrise. The mark for halfway round is written π. The star we need sits a little before it."),
  ]),
  brasswick("after_radians", "z1_sunward", 5800, "e1_radians", [
    say("brasswick", "My arm keeps returning too soon. The Tidewheel used to decide how long one swing takes to come home."),
    say("brasswick", "Look at the number inside the sine, not at how far I reach. That inner number is what hurries me."),
  ]),
  brasswick("after_period", "z2_crystal", 860, "e2_period", [
    say("brasswick", "The water is back, but watch my reach. How high I sweep is not how fast I come back."),
    say("brasswick", "Gardeners call that height the amplitude: from the middle of the swing out to the tip. A flip does not change it."),
  ]),
  brasswick("after_amplitude", "z2_crystal", 3360, "e3_amplitude", [
    say("brasswick", "The chasm wants both places the sine matches, not the first one you spot on the way up."),
    say("brasswick", "Clear the number in front of the sine before you go hunting the angle. Then the circle gives you two."),
  ]),
];

/** Lessons for the dungeon crawler. Any other spec, including the side-scroller, gets the world unchanged. */
export function withTrigLearnPhase(specId: string, world: WorldOverlay): WorldOverlay {
  if (specId !== TRIG_DUNGEON_SPEC_ID) return world;
  const next = structuredClone(world);

  const wick = next.npcs.find((n) => n.id === "brasswick");
  if (wick) wick.states = BRASSWICK;

  next.triggers = [...next.triggers, ...WALK];
  next.plaques = [...next.plaques, ...NOTES];
  return next;
}

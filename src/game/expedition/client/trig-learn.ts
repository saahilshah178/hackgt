/**
 * Learn phase for the trig dungeon only (The Clockwork Crypt, trig_demo_001). The side-scroller shares this world
 * file, so the lessons are applied here, after the world is chosen, and never written back into it.
 *
 * The first four machines are taught on the way in: Cog talks while you walk, Brasswick says it in his own words,
 * a plaque states the rule, then the machine asks you to use it. After the chasm, the walk stops explaining and the
 * last two machines are quizzes. Hints on a wrong answer are left as they are.
 */
import type { NpcState, Plaque, Requirement, Trigger, WorldLine, WorldOverlay } from "../../../contracts/world";

export const TRIG_DUNGEON_SPEC_ID = "trig_demo_001";

const say = (speakerId: string, text: string): WorldLine => ({ speakerId, text, mood: "neutral" });

function req(solved: string | null, flag: string | null = null): Requirement {
  return { solved, flag, notFlag: null, collected: [] };
}

function station(world: WorldOverlay, id: string) {
  return world.stations.find((s) => s.encounterId === id) ?? null;
}

/** Drop a card that repeats another view of the same wave. The control and one reference stay. */
function hideCards(world: WorldOverlay, encounterId: string, slots: readonly number[]) {
  const st = station(world, encounterId);
  if (!st) return;
  for (const slot of slots) {
    const card = st.panel.cards.find((c) => c.slot === slot);
    if (card) card.hidden = true;
    else st.panel.cards.push({ slot, title: null, x: null, y: null, hidden: true });
  }
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

  const e1 = station(next, "e1_radians");
  if (e1) {
    e1.dialogue.approach = [
      say("cog", "The Vesper Dial counts radians, not hours. Sunrise is 0, and one full lap of the rail is 2π."),
      say("cog", "Fog hides the lens, so we aim by the bearing. π would be halfway. We need a little less than that."),
    ];
    e1.dialogue.instruction = {
      speakerId: "cog",
      text: "Swing the carriage to 5π/6: five of the six steps from sunrise to the halfway mark.",
      mood: "neutral",
    };
  }

  const e2 = station(next, "e2_period");
  if (e2) {
    e2.dialogue.approach = [
      say("cog", "The Tidewheel Gate runs on y = sin(2t). The 2 inside is b, and one period is 2π divided by |b|."),
      say("cog", "Ignore how tall the wave is. Set the wait until the ring has come home once, moving the same way."),
    ];
    e2.dialogue.instruction = {
      speakerId: "cog",
      text: "Set the latch timer to one period of the ring. Divide 2π by the 2 in sin(2t).",
      mood: "neutral",
    };
  }

  const e3 = station(next, "e3_amplitude");
  if (e3) {
    e3.dialogue.approach = [
      say("cog", "Amplitude is the climb from the middle, not from peak to trough. The Echo Choir sings that law."),
      say("cog", "One singer measures the whole swing and calls that the amplitude. Aim the Tuning Lens at the lie."),
    ];
    e3.dialogue.instruction = {
      speakerId: "cog",
      text: "Aim the Tuning Lens at each singer. Expose the one whose amplitude claim measures the whole swing.",
      mood: "neutral",
    };
  }

  const e4 = station(next, "e4_solve");
  if (e4) {
    e4.dialogue.approach = [
      say("cog", "Isolate the sine, find the reference angle, then both places on the lap. That order builds the span."),
      say("cog", "Two pylons, two answers. One glyph stone does not belong in that order."),
    ];
  }

  const e5 = station(next, "e5_period_review");
  if (e5) {
    e5.dialogue.approach = [
      say("cog", "The Chime Treasury. One singer is wrong about a period, and I won't reteach the rule."),
      say("cog", "Read the traces and expose the mimic."),
    ];
  }

  // One picture of the angle, not a second sine graph beside the circle.
  hideCards(next, "e1_radians", [1]);
  // The stones are the puzzle and the circle is the reference. The equation plot repeats both.
  hideCards(next, "e4_solve", [2]);
  // The pendulum card already ghosts the shield wave. The shield card is that wave again.
  hideCards(next, "e6_boss", [0]);

  const wick = next.npcs.find((n) => n.id === "brasswick");
  if (wick) wick.states = BRASSWICK;

  next.triggers = [...next.triggers, ...WALK];
  next.plaques = [...next.plaques, ...NOTES];
  return next;
}

import type { ChallengeSlice } from "../src/contracts/slices";

/**
 * One realistic encounter per wave-1a mode (P4 part A), each on a real catalog card, following
 * docs/overnight/wave1-modes.md's param shapes exactly. Consumed by tests/wave1a.test.ts, which
 * assembles each into a mini GameSpec and autoSolves it.
 */
export const WAVE1A: { cardId: string; slice: ChallengeSlice }[] = [
  {
    cardId: "membrane_router",
    slice: {
      prompt: "Sort each molecule. Can it cross the cell's membrane alone, or does it need a transport protein?",
      params: {
        bins: [
          { id: "diffuses", label: "Crosses the membrane alone", feature: "small and nonpolar, so it slips through the fatty middle" },
          { id: "protein", label: "Needs a transport protein", feature: "charged, polar, or too big to slip through the fatty middle" },
        ],
        items: [
          { text: "Oxygen (O2)", binId: "diffuses", why: "Small and nonpolar." },
          { text: "Carbon dioxide (CO2)", binId: "diffuses", why: "Small and nonpolar." },
          { text: "Sodium ion (Na+)", binId: "protein", why: "Tiny, but its charge keeps it out." },
          { text: "Glucose", binId: "protein", why: "Big and polar, so it needs a carrier protein." },
          { text: "A steroid hormone", binId: "diffuses", why: "It dissolves in fat, so it slips straight through." },
        ],
      },
      hints: [
        "Na+ is smaller than O2, but it can't cross alone. So size isn't what decides.",
        "Ask if the molecule has a charge or is polar. The fatty middle of the membrane keeps those out.",
        "The steroid hormone is big, but it dissolves in fat. Check which group that fits.",
      ],
      wrongFeedback: "Check charge and polarity before size. A charged particle needs a protein, even a tiny one.",
      debriefLine: "The membrane lets small nonpolar things through. You sorted {{itemCount}} molecules by that rule.",
      sourceRef: { page: 1, quote: "Ions and large polar molecules such as glucose cross only through transport proteins." },
    },
  },
  {
    cardId: "type_matched_weapon",
    slice: {
      prompt: "Tag each passing cell with its liquid's tonicity. That's how much solute, or dissolved stuff, it has compared to the cell.",
      params: {
        categories: [
          { id: "hypotonic", label: "Hypotonic" },
          { id: "isotonic", label: "Isotonic" },
          { id: "hypertonic", label: "Hypertonic" },
        ],
        waves: [
          { text: "A red blood cell in pure water, swelling", categoryId: "hypotonic", why: "Less solute outside than inside, so water flows in." },
          { text: "A cell in seawater, shrivelling", categoryId: "hypertonic", why: "More solute outside, so water flows out." },
          { text: "A cell in a solution matching its own solute level, unchanged", categoryId: "isotonic", why: "Same solute on both sides, so water doesn't move overall." },
          { text: "A plant cell in salty soil water, losing turgor", categoryId: "hypertonic", why: "More solute outside pulls water out." },
        ],
        secondsPerWave: 8,
      },
      hints: [
        "Look at what each cell is doing. Swelling or shrivelling tells you which way water moved.",
        "Water moves toward more solute. Hyper means more solute outside, and hypo means less.",
        "The cell in pure water is swelling, so water came in. Which label means less solute outside?",
      ],
      wrongFeedback: "Check which way the water moved. Hypertonic means more solute outside, so the cell loses water.",
      debriefLine: "You tagged each liquid by its solute compared to the cell. That's tonicity.",
      sourceRef: { page: 2, quote: "In a hypertonic solution the cell loses water and shrinks." },
    },
  },
  {
    cardId: "grapple_anchors",
    slice: {
      prompt: "The sodium-potassium pump needs rewiring. Link each part of one cycle to its number.",
      params: {
        pairs: [
          { left: "Sodium ions moved per cycle", right: "3, out of the cell", why: "Three Na+ leave." },
          { left: "Potassium ions moved per cycle", right: "2, into the cell", why: "Two K+ enter." },
          { left: "Energy spent per cycle", right: "1 ATP", why: "One ATP powers each cycle." },
        ],
        decoyRights: ["2, out of the cell"],
      },
      hints: [
        "The sodium and potassium counts aren't the same. One of them is bigger.",
        "More sodium leaves than potassium comes in. Watch the words \"out of\" and \"into\" too.",
        "One card says \"2, out of the cell\". Potassium moves in, so don't use that one for it.",
      ],
      wrongFeedback: "The pump is lopsided. It moves more sodium out than potassium in.",
      debriefLine: "You linked {{pairCount}} facts about one turn of the sodium-potassium pump.",
      sourceRef: { page: 3, quote: "Each cycle of the sodium-potassium pump moves three sodium ions out of the cell and two potassium ions in, at the cost of one ATP." },
    },
  },
  {
    cardId: "domino_engine",
    slice: {
      prompt: "Put the causes in order so each one leads to the next, ending at the Boston Tea Party.",
      params: {
        nodes: [
          "Parliament taxes tea imports without colonial consent",
          "Colonists boycott British tea and organize resistance",
          "Ships carrying taxed tea arrive in Boston harbor",
          "The Sons of Liberty dump the tea into the harbor",
        ],
        decoys: ["The colonies declare independence"],
      },
      hints: [
        "Start with the tea tax. The colonists never agreed to it, and that set things off.",
        "Next is how the colonists pushed back, before any tea ships showed up.",
        "The colonies declared independence years after the Tea Party. Leave that card out.",
      ],
      wrongFeedback: "Check that each event really caused the next one. Just coming later isn't enough.",
      debriefLine: "You chained {{nodeCount}} causes, from the tea tax to the Tea Party.",
      sourceRef: { page: 1, quote: "Parliament's tax on tea, imposed without colonial consent, triggered a boycott that culminated in the Boston Tea Party." },
    },
  },
  {
    cardId: "evidence_board",
    slice: {
      prompt: "Three ideas, two clues. Cross off ideas until one explains the jammed vault door.",
      params: {
        question: "What jammed the vault door?",
        hypotheses: [
          { id: "dust", text: "Dust built up in the gears" },
          { id: "sabotage", text: "Someone deliberately sabotaged it" },
          { id: "power", text: "A power failure locked the mechanism" },
        ],
        clues: [
          { text: "The gears were freshly oiled and spotless the morning it jammed.", eliminates: ["dust"] },
          { text: "The backup generator kept running the whole time.", eliminates: ["power"] },
        ],
      },
      hints: [
        "Each clue crosses off one idea. Start with the clue about the gears.",
        "Clean, freshly oiled gears can't be clogged with dust. Cross that idea off.",
        "Two ideas are left now. The clue about the backup generator splits them.",
      ],
      wrongFeedback: "One of the clues rules that idea out. Check it against both clues again.",
      debriefLine: "The evidence points to \"{{survivor}}\". Every other idea failed a clue.",
      sourceRef: { page: 4, quote: "Investigators ruled out mechanical failure and power loss before concluding the door had been deliberately jammed." },
    },
  },
];

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
      prompt: "Route each molecule: crosses the bilayer alone, or needs a transport protein.",
      params: {
        bins: [
          { id: "diffuses", label: "Crosses the bilayer alone", feature: "small and nonpolar, so it dissolves through the lipid interior" },
          { id: "protein", label: "Needs a transport protein", feature: "polar or charged, or too large to slip between the lipids" },
        ],
        items: [
          { text: "Oxygen (O2)", binId: "diffuses", why: "Small and nonpolar." },
          { text: "Carbon dioxide (CO2)", binId: "diffuses", why: "Small and nonpolar." },
          { text: "Sodium ion (Na+)", binId: "protein", why: "Tiny but charged: the nonpolar interior repels it." },
          { text: "Glucose", binId: "protein", why: "Large and polar; it uses a carrier protein." },
          { text: "A steroid hormone", binId: "diffuses", why: "Lipid-soluble, so it dissolves straight through." },
        ],
      },
      hints: [
        "Size is a clue but not the rule.",
        "Ask: is it polar or charged? Charge is what the lipid interior repels.",
        "Na+ is smaller than O2 and still cannot cross alone.",
      ],
      wrongFeedback: "Look at polarity and charge before size: a charged particle needs a protein even if it's small.",
      debriefLine: "Selective permeability: you sorted {{itemCount}} molecules by polarity and charge, not size.",
      sourceRef: { page: 1, quote: "Ions and large polar molecules such as glucose cross only through transport proteins." },
    },
  },
  {
    cardId: "type_matched_weapon",
    slice: {
      prompt: "Cells drift past in different solutions. Hit each one with the right tonicity label before it passes.",
      params: {
        categories: [
          { id: "hypotonic", label: "Hypotonic" },
          { id: "isotonic", label: "Isotonic" },
          { id: "hypertonic", label: "Hypertonic" },
        ],
        waves: [
          { text: "A red blood cell in pure water, swelling", categoryId: "hypotonic", why: "Less solute outside than inside: water flows in." },
          { text: "A cell in seawater, shrivelling", categoryId: "hypertonic", why: "More solute outside: water flows out." },
          { text: "A cell in a solution matching its own solute level, unchanged", categoryId: "isotonic", why: "Equal solute: no net water movement." },
          { text: "A plant cell in salty soil water, losing turgor", categoryId: "hypertonic", why: "More solute outside pulls water out." },
        ],
        secondsPerWave: 8,
      },
      hints: [
        "The label describes the solution relative to the cell, not the cell itself.",
        "Hyper means more solute outside; water leaves. Hypo means less; water enters.",
        "Swelling means water came in: the solution had less solute.",
      ],
      wrongFeedback: "Hypertonic means more solute (less water) outside, so the cell loses water.",
      debriefLine: "Tonicity: you labeled each solution by its solute level relative to the cell.",
      sourceRef: { page: 2, quote: "In a hypertonic solution the cell loses water and shrinks." },
    },
  },
  {
    cardId: "grapple_anchors",
    slice: {
      prompt: "The sodium-potassium pump needs rewiring. Link each part of one cycle to its value.",
      params: {
        pairs: [
          { left: "Sodium ions moved per cycle", right: "3, out of the cell", why: "Three Na+ leave." },
          { left: "Potassium ions moved per cycle", right: "2, into the cell", why: "Two K+ enter." },
          { left: "Energy spent per cycle", right: "1 ATP", why: "One ATP powers each cycle." },
        ],
        decoyRights: ["2, out of the cell"],
      },
      hints: [
        "The counts are not equal; that asymmetry matters.",
        "More positive charge leaves than enters each cycle.",
        "3 out, 2 in, 1 ATP.",
      ],
      wrongFeedback: "The pump is lopsided on purpose: it moves more sodium out than potassium in.",
      debriefLine: "The sodium-potassium pump: you linked {{pairCount}} facts about one cycle.",
      sourceRef: { page: 3, quote: "Each cycle of the sodium-potassium pump moves three sodium ions out of the cell and two potassium ions in, at the cost of one ATP." },
    },
  },
  {
    cardId: "domino_engine",
    slice: {
      prompt: "Chain the causes so they topple through to the Boston Tea Party.",
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
        "Start with the policy that provoked the protest.",
        "Each link is what the previous event provoked, not just what happened after it.",
        "The dumped tea was a direct response to ships arriving in the harbor.",
      ],
      wrongFeedback: "Check what each event actually provoked, not just what came later in time.",
      debriefLine: "You chained {{nodeCount}} causes from the tax to the Tea Party.",
      sourceRef: { page: 1, quote: "Parliament's tax on tea, imposed without colonial consent, triggered a boycott that culminated in the Boston Tea Party." },
    },
  },
  {
    cardId: "evidence_board",
    slice: {
      prompt: "Three suspects, two clues. Eliminate until one explanation for the jammed vault door stands.",
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
        "Read each clue and cross off any hypothesis it rules out.",
        "Two clues, two eliminations: only one hypothesis takes no hits.",
        "Clean gears rule out dust; steady power rules out a failure.",
      ],
      wrongFeedback: "Check your pick against both clues again: one of them rules it out directly.",
      debriefLine: "The evidence pointed to \"{{survivor}}\": every rival hypothesis failed a clue.",
      sourceRef: { page: 4, quote: "Investigators ruled out mechanical failure and power loss before concluding the door had been deliberately jammed." },
    },
  },
];

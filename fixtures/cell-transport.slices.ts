import type { AssessmentSlice, BlueprintSlice, ChallengeSlice, NarrativeSlice } from "../src/contracts/slices";
import type { Slices } from "../src/pipeline/assemble";
import { cellIntake, cellKnowledgeMap } from "./cell-transport.knowledge-map";

/*
 * Showcase game 2 (P11): cell transport as a Dungeon. Uses wave-1 modes (sorter.bins, sorter.type_match,
 * linker.pairs) whose param shapes follow docs/overnight/wave1-modes.md, plus the four seed modes.
 * Built into fixtures/cell-transport-dungeon.json by `pnpm fixtures:build` once P4 lands.
 */

export const cellBlueprint: BlueprintSlice = {
  genre: "dungeon",
  title: "The Membrane Vault",
  theme: {
    setting: "A submarine crew shrunk to the size of a molecule, exploring the sealed vaults of a living cell",
    tone: "curious, brisk, a little claustrophobic",
    paletteId: "tide",
    musicMood: "curious",
  },
  premise:
    "The cell's gates only open for crews who understand what crosses a membrane, how, and at what cost. Get the crew from the outside world to the nucleus.",
  characters: [
    { id: "pilot", name: "Pilot Ora", role: "the submarine's guide", voiceArchetype: "cheerful_sidekick" },
    { id: "gatekeeper", name: "The Gatekeeper", role: "an ancient pump protein guarding the last vault", voiceArchetype: "gruff_guard" },
  ],
  encounters: [
    { id: "e1_bilayer", conceptIds: ["c_bilayer"], teachingMechanicId: "mimic_chest", socket: "chest", role: "teach", difficulty: 1, targetMisconception: "The membrane is a solid wall with holes in it.", designNote: "Establish the bilayer as a fluid lipid double layer, not a wall." },
    { id: "e2_selectivity", conceptIds: ["c_selectivity"], teachingMechanicId: "membrane_router", socket: "enemy", role: "teach", difficulty: 2, targetMisconception: "Anything small passes freely.", designNote: "Route molecules to simple diffusion, protein, or blocked; a small ion must be blocked." },
    { id: "e3_diffusion", conceptIds: ["c_diffusion"], teachingMechanicId: "mimic_chest", socket: "chest", role: "teach", difficulty: 1, targetMisconception: "Particles move toward empty space on purpose.", designNote: "Random motion produces net flow; nothing is 'trying' to spread." },
    { id: "e4_osmosis", conceptIds: ["c_osmosis"], teachingMechanicId: "mimic_chest", socket: "chest", role: "teach", difficulty: 2, targetMisconception: "Salt crosses the membrane instead of water.", designNote: "It is the water that moves, toward the saltier side." },
    { id: "e5_tonicity", conceptIds: ["c_tonicity"], teachingMechanicId: "type_matched_weapon", socket: "enemy", role: "teach", difficulty: 2, targetMisconception: "Hypertonic means the solution has more water.", designNote: "Each incoming cell-in-solution must be hit with the right tonicity label; hypertonic means more solute." },
    { id: "e6_facilitated", conceptIds: ["c_facilitated"], teachingMechanicId: "membrane_router", socket: "enemy", role: "teach", difficulty: 2, targetMisconception: "If a protein is involved, the cell must be spending energy.", designNote: "Sort passive-with-protein from active; proteins alone don't mean ATP." },
    { id: "e7_active", conceptIds: ["c_active_transport"], teachingMechanicId: "mimic_chest", socket: "chest", role: "teach", difficulty: 2, targetMisconception: "Transport always goes down the gradient.", designNote: "Pumps go uphill and it costs ATP." },
    { id: "e8_pump", conceptIds: ["c_sodium_potassium"], teachingMechanicId: "grapple_anchors", socket: "enemy", role: "teach", difficulty: 2, targetMisconception: "The pump moves equal numbers of ions each way.", designNote: "Match ions to directions and counts: 3 Na+ out, 2 K+ in, 1 ATP." },
    { id: "e9_osmosis_review", conceptIds: ["c_osmosis"], teachingMechanicId: "type_matched_weapon", socket: "enemy", role: "review", difficulty: 2, targetMisconception: "Salt crosses the membrane instead of water.", designNote: "Spaced review: for each scenario, which way does water move?" },
    { id: "e10_bulk", conceptIds: ["c_bulk_transport"], teachingMechanicId: "chrono_bridge", socket: "door", role: "teach", difficulty: 2, targetMisconception: "Vesicle transport is passive because the cargo isn't pumped.", designNote: "Order the steps of endocytosis; the decoy is 'the cargo diffuses through the bilayer'." },
    { id: "e11_boss", conceptIds: ["c_active_transport", "c_facilitated"], teachingMechanicId: "membrane_router", socket: "boss", role: "boss", difficulty: 3, targetMisconception: "Transport always goes down the gradient.", designNote: "The Gatekeeper: sort a mixed cargo into simple diffusion, facilitated diffusion, and active transport." },
  ],
};

export const cellChallenges: Record<string, ChallengeSlice> = {
  e1_bilayer: {
    prompt: "Three chests describe the vault's outer wall. One is a mimic. Which claim about the membrane is false?",
    params: {
      statements: [
        { text: "The membrane is a double layer of phospholipids", isTrue: true, explanation: "Hydrophilic heads face the water on both sides; hydrophobic tails point inward." },
        { text: "The membrane is a rigid wall with fixed holes in it", isTrue: false, explanation: "It is fluid: lipids and proteins drift, and substances cross by dissolving through or via proteins." },
        { text: "The membrane's interior is nonpolar and blocks most ions", isTrue: true, explanation: "Charged particles cannot dissolve in the hydrophobic interior." },
      ],
    },
    hints: ["Think about what the membrane is made of, not what it looks like in a diagram.", "Lipids with hydrophobic tails form a layer that flows, not a wall.", "The mimic claims: {{mimic}}"],
    wrongFeedback: "That chest is honest. Look for the claim that treats the membrane as a solid, fixed structure.",
    debriefLine: "The mimic said \"{{mimic}}\": the phospholipid bilayer is a fluid double layer, which is why it needs proteins for polar traffic.",
    sourceRef: { page: 1, quote: "The plasma membrane is a phospholipid bilayer: the hydrophilic heads face the water on both sides and the hydrophobic tails point inward." },
  },
  e2_selectivity: {
    prompt: "Molecules approach the membrane. Route each one: through the bilayer on its own, through a transport protein, or blocked entirely.",
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
        { text: "Chloride ion (Cl-)", binId: "protein", why: "Charged, so it needs a channel." },
      ],
    },
    hints: ["Size is a clue but not the rule.", "Ask: is it polar or charged? Charge is what the lipid interior repels.", "Na+ is smaller than O2 and still cannot cross alone."],
    wrongFeedback: "Look at polarity and charge before size: a small ion is blocked, a bigger nonpolar molecule slips through.",
    debriefLine: "Selective permeability: you sorted {{itemCount}} molecules by polarity and charge, not size; that is the rule the bilayer follows.",
    sourceRef: { page: 1, quote: "Ions and large polar molecules such as glucose cross only through transport proteins." },
  },
  e3_diffusion: {
    prompt: "A cloud of dye spreads through the chamber. Three chests explain why. One is lying.",
    params: {
      statements: [
        { text: "Each dye particle moves randomly, bumping into others", isTrue: true, explanation: "Random thermal motion is the only driver." },
        { text: "The dye particles head for the empty side on purpose", isTrue: false, explanation: "No particle steers; net flow to low concentration is the statistical result of random motion." },
        { text: "Net movement runs from high to low concentration", isTrue: true, explanation: "More particles start on the crowded side, so more cross from there." },
      ],
    },
    hints: ["Think about one single particle. Does it know where the crowd is?", "Random moves from a crowded side produce a net flow without any intention.", "The mimic claims: {{mimic}}"],
    wrongFeedback: "That chest is honest. Look for the claim that gives the particles a goal.",
    debriefLine: "Diffusion: the mimic said \"{{mimic}}\", but net flow down the gradient is just what random motion adds up to.",
    sourceRef: { page: 2, quote: "Because it is driven by the random motion of the particles themselves, diffusion requires no energy from the cell." },
  },
  e4_osmosis: {
    prompt: "A cell floats in salty water. Three chests predict what happens. Point your lantern at the lie.",
    params: {
      statements: [
        { text: "Water leaves the cell, moving toward the saltier side", isTrue: true, explanation: "Water diffuses toward the higher solute concentration." },
        { text: "Salt rushes into the cell until both sides match", isTrue: false, explanation: "Dissolved ions cannot cross the bilayer; it is the water that moves." },
        { text: "The cell shrinks as it loses water", isTrue: true, explanation: "Losing water lowers the cell's volume." },
      ],
    },
    hints: ["Which substance can actually cross a lipid bilayer: the water or the dissolved salt?", "Osmosis is water moving toward the side with more solute.", "The mimic claims: {{mimic}}"],
    wrongFeedback: "That chest is honest. Look for the claim that has the salt doing the moving.",
    debriefLine: "Osmosis: the mimic said \"{{mimic}}\", but the salt stays put and the water moves toward it.",
    sourceRef: { page: 2, quote: "Water moves toward the side with the higher solute concentration, where the water concentration is lower." },
  },
  e5_tonicity: {
    prompt: "Cells drift past in different solutions. Hit each one with the right label before it passes.",
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
        { text: "A cell in a dilute drink, about to burst", categoryId: "hypotonic", why: "Water rushes in from the low-solute solution." },
      ],
      secondsPerWave: 8,
    },
    hints: ["The label describes the solution relative to the cell, not the cell.", "Hyper means more solute outside; water leaves. Hypo means less; water enters.", "Swelling means water came in: the solution had less solute."],
    wrongFeedback: "Hypertonic means more solute (less water) outside, so the cell loses water and shrinks.",
    debriefLine: "Tonicity: you labeled each solution by its solute level relative to the cell, and predicted swell, stay, or shrink.",
    sourceRef: { page: 2, quote: "In a hypertonic solution the cell loses water and shrinks." },
  },
  e6_facilitated: {
    prompt: "More cargo at the gates. Route each case: passive (no ATP, even with a protein) or active (ATP against the gradient).",
    params: {
      bins: [
        { id: "passive", label: "Passive: no ATP", feature: "moves down its gradient, with or without a protein's help" },
        { id: "active", label: "Active: costs ATP", feature: "moves against its gradient, so a pump must spend energy" },
      ],
      items: [
        { text: "Glucose entering through a carrier protein, from high to low", binId: "passive", why: "Facilitated diffusion: a protein path, no energy." },
        { text: "Water through an aquaporin channel", binId: "passive", why: "A channel just speeds diffusion." },
        { text: "Na+ pumped out of a cell that already has little Na+", binId: "active", why: "Against the gradient: needs ATP." },
        { text: "K+ leaking out through an open channel, from high to low", binId: "passive", why: "Down the gradient through a channel." },
        { text: "Protons pushed into a compartment that is already acidic", binId: "active", why: "Uphill, so it costs energy." },
      ],
    },
    hints: ["Ignore whether a protein is present. Ask which way the substance moves relative to its gradient.", "Down the gradient is always passive, protein or not.", "Only the cases moving toward the more crowded side cost ATP."],
    wrongFeedback: "A protein alone doesn't mean energy is spent. Passive transport can use channels and carriers; only moving against the gradient needs ATP.",
    debriefLine: "Facilitated diffusion: you sorted {{itemCount}} cases by direction relative to the gradient, which is what decides passive vs active.",
    sourceRef: { page: 3, quote: "Facilitated diffusion uses channel or carrier proteins, but it is still passive: the molecules move down their gradient and the cell spends no energy." },
  },
  e7_active: {
    prompt: "The pump room hums. Three chests describe active transport. One is a mimic.",
    params: {
      statements: [
        { text: "Active transport moves substances against their gradient", isTrue: true, explanation: "From low concentration to high." },
        { text: "Active transport costs the cell ATP", isTrue: true, explanation: "Pumps use energy to push uphill." },
        { text: "Transport always runs down the gradient, so pumps just speed it up", isTrue: false, explanation: "Pumps run uphill; that is exactly why they need ATP." },
      ],
    },
    hints: ["Why would a cell ever spend ATP on transport?", "If everything ran downhill, no energy would be needed.", "The mimic claims: {{mimic}}"],
    wrongFeedback: "That chest is honest. Look for the claim that says transport can only go downhill.",
    debriefLine: "Active transport: the mimic said \"{{mimic}}\"; pumps move substances uphill and pay for it in ATP.",
    sourceRef: { page: 3, quote: "Active transport moves substances against their concentration gradient, from low concentration to high, and requires energy from ATP." },
  },
  e8_pump: {
    prompt: "The sodium-potassium pump needs rewiring. Link each part of one cycle to its value.",
    params: {
      pairs: [
        { left: "Sodium ions moved per cycle", right: "3, out of the cell", why: "Three Na+ leave." },
        { left: "Potassium ions moved per cycle", right: "2, into the cell", why: "Two K+ enter." },
        { left: "Energy spent per cycle", right: "1 ATP", why: "One ATP powers each cycle." },
        { left: "Cells that depend on it most", right: "Nerve and muscle cells", why: "They rely on the ion gradients." },
      ],
      decoyRights: ["2, out of the cell"],
    },
    hints: ["The counts are not equal; that asymmetry matters.", "More positive charge leaves than enters each cycle.", "3 out, 2 in, 1 ATP."],
    wrongFeedback: "The pump is lopsided on purpose: it moves more sodium out than potassium in, which leaves the inside slightly negative.",
    debriefLine: "The sodium-potassium pump: you linked {{pairCount}} facts: 3 Na+ out, 2 K+ in, 1 ATP, and the cells that depend on it.",
    sourceRef: { page: 3, quote: "Each cycle of the sodium-potassium pump moves three sodium ions out of the cell and two potassium ions in, at the cost of one ATP." },
  },
  e9_osmosis_review: {
    prompt: "Review wave: for each cell, which way does the water move? Answer before it drifts by.",
    params: {
      categories: [
        { id: "in", label: "Water moves in" },
        { id: "out", label: "Water moves out" },
        { id: "none", label: "No net movement" },
      ],
      waves: [
        { text: "Cell with 2% salt inside, in a 10% salt bath", categoryId: "out", why: "More solute outside pulls water out." },
        { text: "Cell with 2% salt inside, in distilled water", categoryId: "in", why: "Water flows toward the solute-rich cell." },
        { text: "Cell with 0.9% salt inside, in 0.9% saline", categoryId: "none", why: "Isotonic: no net flow." },
        { text: "Potato cells in a sugar syrup", categoryId: "out", why: "Syrup has far more solute than the cells." },
      ],
      secondsPerWave: 8,
    },
    hints: ["Compare the solute levels inside and outside.", "Water goes toward the side with more solute.", "Equal solute means no net movement at all."],
    wrongFeedback: "Water moves toward the higher solute concentration; the salt itself stays where it is.",
    debriefLine: "Osmosis review: you predicted the direction of water for four cells from the solute levels alone.",
    sourceRef: { page: 2, quote: "Osmosis is the diffusion of water across a selectively permeable membrane." },
  },
  e10_bulk: {
    prompt: "The great door only opens if the planks show how a large particle gets INTO the cell. One plank doesn't belong.",
    params: {
      steps: [
        "The particle touches the outside of the membrane",
        "The membrane folds inward around the particle",
        "The pocket pinches off, forming a vesicle inside the cell",
        "The vesicle carries the particle to its destination",
      ],
      decoys: ["The particle dissolves through the bilayer on its own"],
    },
    hints: ["Something too big for any protein channel has to be wrapped.", "The membrane does the wrapping, then closes the pocket.", "Start at the moment of contact and end with the vesicle moving."],
    wrongFeedback: "Order matters: the membrane cannot pinch off a vesicle before it has folded around the cargo.",
    debriefLine: "Endocytosis: you put the {{count}} steps in order, and every one of them costs ATP, which is why bulk transport is active.",
    sourceRef: { page: 4, quote: "In endocytosis the membrane folds inward around the cargo and pinches off to form a vesicle inside the cell." },
  },
  e11_boss: {
    prompt: "The Gatekeeper dumps a mixed cargo at your feet. Sort every item by how it crosses the membrane, or the nucleus stays sealed.",
    params: {
      bins: [
        { id: "simple", label: "Simple diffusion", feature: "small and nonpolar; crosses the bilayer alone, down its gradient" },
        { id: "facilitated", label: "Facilitated diffusion", feature: "polar or charged; uses a channel or carrier, still down its gradient, no ATP" },
        { id: "active", label: "Active transport", feature: "moves against its gradient through a pump that spends ATP" },
      ],
      items: [
        { text: "O2 entering a cell that has used up its oxygen", binId: "simple", why: "Nonpolar, downhill, no protein." },
        { text: "Glucose entering a muscle cell via a carrier, from high to low", binId: "facilitated", why: "Protein-assisted but downhill." },
        { text: "Na+ pumped out against its gradient", binId: "active", why: "Uphill: ATP." },
        { text: "Water entering through an aquaporin", binId: "facilitated", why: "Channel-assisted diffusion." },
        { text: "CO2 leaving a cell that produces it", binId: "simple", why: "Nonpolar and downhill." },
        { text: "K+ pumped into a cell that already has lots of K+", binId: "active", why: "Against the gradient." },
        { text: "Cl- entering through an open channel, from high to low", binId: "facilitated", why: "Charged, needs a channel, still downhill." },
      ],
    },
    hints: ["First ask: which way relative to the gradient? Then ask: can it cross the lipid alone?", "Uphill is always active. Downhill with a protein is facilitated.", "Only small nonpolar molecules cross alone."],
    wrongFeedback: "Two questions decide it: direction relative to the gradient (uphill needs ATP) and whether the molecule can dissolve through lipid (nonpolar) or needs a protein.",
    debriefLine: "Boss: you sorted {{itemCount}} cargo items into simple diffusion, facilitated diffusion, and active transport by direction and polarity, the whole unit in one room.",
    sourceRef: { page: 3, quote: "If a cell runs out of ATP, its pumps stop and the gradients they maintain slowly dissipate." },
  },
};

export const cellNarrative: NarrativeSlice = {
  intro: [{ speakerId: "pilot", text: "Shrink complete. That wall ahead is the membrane. Nothing gets through it without a reason." }],
  outro: [{ speakerId: "pilot", text: "The nucleus! You got the whole crew through by knowing what crosses, how, and at what cost." }],
  beats: [
    { encounterId: "e2_selectivity", when: "before", speakerId: "pilot", text: "Watch the small ones. Small doesn't mean welcome." },
    { encounterId: "e11_boss", when: "before", speakerId: "gatekeeper", text: "I have pumped for a billion years. Show me you know what costs energy." },
    { encounterId: "e11_boss", when: "after", speakerId: "gatekeeper", text: "Sorted true. Pass, molecule-wise crew." },
  ],
};

export const cellAssessment: AssessmentSlice = {
  post: [
    { conceptId: "c_osmosis", prompt: "A freshwater fish cell sits in fresh water, which has far less solute than the cell. What happens?", correct: "Water enters the cell", distractors: ["Water leaves the cell", "Salt enters the cell", "Nothing moves"] },
    { conceptId: "c_active_transport", prompt: "A cell moves calcium ions from a low concentration inside to a higher one outside. This is…", correct: "Active transport, using ATP", distractors: ["Simple diffusion", "Facilitated diffusion", "Osmosis"] },
    { conceptId: "c_selectivity", prompt: "Why can't Na+ cross the bilayer on its own even though it is tiny?", correct: "It is charged, and the lipid interior is nonpolar", distractors: ["It is too large", "The membrane has no holes", "Sodium is toxic to the cell"] },
  ],
};

export const cellSlices: Slices = {
  id: "cell_demo_001",
  createdAt: "2026-09-26T03:00:00.000Z",
  km: cellKnowledgeMap,
  intake: cellIntake,
  blueprint: cellBlueprint,
  challenges: cellChallenges,
  narrative: cellNarrative,
  assessment: cellAssessment,
};

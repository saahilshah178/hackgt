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
  title: "Inside a Cell",
  theme: {
    setting: "A tiny submarine crew on the outside of a living cell, heading for the nucleus",
    tone: "curious, brisk, a little claustrophobic",
    paletteId: "tide",
    musicMood: "curious",
  },
  premise:
    "Your crew shrank and is stuck on the outside of a cell. Open each gate as you walk inward to reach the nucleus.",
  characters: [
    { id: "pilot", name: "Pilot Ora", role: "the submarine's guide", voiceArchetype: "cheerful_sidekick" },
    { id: "gatekeeper", name: "The Gatekeeper", role: "a very old pump protein who guards the last vault", voiceArchetype: "gruff_guard" },
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
    prompt: "Three chests describe the membrane, the thin skin around the cell. One is a mimic. Find its false claim.",
    params: {
      statements: [
        { text: "The membrane is a double layer of fat molecules called phospholipids", isTrue: true, explanation: "Their heads like water, so they face out on both sides. Their oily tails point inward." },
        { text: "The membrane is a stiff wall with fixed holes in it", isTrue: false, explanation: "It flows like a film of oil. Its parts drift around, and things cross through it or through proteins." },
        { text: "The middle of the membrane is oily and blocks most ions", isTrue: true, explanation: "Ions are charged bits. They can't mix into the oily middle." },
      ],
    },
    hints: [
      "Look at what each chest says the membrane is made of. Check whether it could bend and flow.",
      "The membrane is fat molecules with oily tails. Oil can't hold a stiff shape, so it flows.",
      "The chest about the oily middle blocking ions is true. Compare the other two.",
    ],
    wrongFeedback: "That chest tells the truth. Look for the claim that makes the membrane stiff.",
    debriefLine: "The mimic said \"{{mimic}}\". Really, the membrane is a bilayer, a double layer of fat that flows like oil.",
    sourceRef: { page: 1, quote: "The plasma membrane is a phospholipid bilayer: the hydrophilic heads face the water on both sides and the hydrophobic tails point inward." },
  },
  e2_selectivity: {
    prompt: "Sort the molecules waiting at the membrane. Can each one slip through the fat alone, or does it need a transport protein?",
    params: {
      bins: [
        { id: "diffuses", label: "Crosses the bilayer alone", feature: "small and nonpolar (no charged ends), so it mixes into the oily middle" },
        { id: "protein", label: "Needs a transport protein", feature: "polar or charged, so the oily middle pushes it away, or too big to squeeze through" },
      ],
      items: [
        { text: "Oxygen (O2)", binId: "diffuses", why: "Small and nonpolar." },
        { text: "Carbon dioxide (CO2)", binId: "diffuses", why: "Small and nonpolar." },
        { text: "Sodium ion (Na+)", binId: "protein", why: "Tiny, but it's charged. The oily middle pushes it away." },
        { text: "Glucose", binId: "protein", why: "Big and polar. It rides a carrier protein." },
        { text: "A steroid hormone", binId: "diffuses", why: "It's made from fat, so it mixes straight through." },
        { text: "Chloride ion (Cl-)", binId: "protein", why: "It's charged, so it needs a channel, a protein tunnel." },
      ],
    },
    hints: [
      "Na+ and Cl- are tiny, smaller than some molecules on the list. Size alone won't tell you their group.",
      "Check each one for a charge, like the + in Na+. The oily middle pushes charged things away.",
      "The steroid hormone is the one people get wrong. Check if it's charged or made from fat.",
    ],
    wrongFeedback: "Check for a charge before you check size. A tiny ion still gets blocked by the oily middle.",
    debriefLine: "You sorted {{itemCount}} molecules by whether they're charged or polar. The membrane picks what gets through, and that's called selective permeability.",
    sourceRef: { page: 1, quote: "Ions and large polar molecules such as glucose cross only through transport proteins." },
  },
  e3_diffusion: {
    prompt: "A cloud of dye is spreading through the tank. Three chests explain why. One of them is lying.",
    params: {
      statements: [
        { text: "Each dye particle moves at random, bumping into others", isTrue: true, explanation: "Random jiggling is the only thing moving them." },
        { text: "The dye particles head for the empty side on purpose", isTrue: false, explanation: "No particle can steer. More end up on the empty side just by chance." },
        { text: "Overall, the dye spreads from where it's crowded to where it isn't", isTrue: true, explanation: "More particles start on the crowded side, so more cross from there." },
      ],
    },
    hints: [
      "Pick one dye particle and follow it. Does it ever seem to know where the empty side is?",
      "Each particle moves at random. More start on the crowded side, so more happen to cross from there.",
      "The chest about particles bumping at random is true. Compare the other two.",
    ],
    wrongFeedback: "That chest tells the truth. Look for the claim that gives the dye a goal.",
    debriefLine: "The mimic said \"{{mimic}}\". Diffusion is random moves spreading things out, with no plan at all.",
    sourceRef: { page: 2, quote: "Because it is driven by the random motion of the particles themselves, diffusion requires no energy from the cell." },
  },
  e4_osmosis: {
    prompt: "A cell floats in very salty water. Three chests predict what happens. Point your lantern at the one that's lying.",
    params: {
      statements: [
        { text: "Water leaves the cell, moving toward the saltier side", isTrue: true, explanation: "Water moves toward the side with more stuff dissolved in it." },
        { text: "Salt rushes into the cell until both sides match", isTrue: false, explanation: "Salt can't get through the fat layer. The water is what moves." },
        { text: "The cell shrinks as it loses water", isTrue: true, explanation: "Losing water makes the cell smaller." },
      ],
    },
    hints: [
      "Two things could cross here, the water or the salt. Only one of them gets through the fat layer.",
      "Water moves toward the side with more salt in it. Here that's the water outside the cell.",
      "The chest about the cell shrinking is true. Compare the other two.",
    ],
    wrongFeedback: "That chest tells the truth. Look for the claim where the salt does the moving.",
    debriefLine: "The mimic said \"{{mimic}}\". Osmosis means water crosses toward the saltier side, while the salt stays put.",
    sourceRef: { page: 2, quote: "Water moves toward the side with the higher solute concentration, where the water concentration is lower." },
  },
  e5_tonicity: {
    prompt: "Cells drift past in different liquids. Label each liquid by how much is dissolved in it compared to the cell.",
    params: {
      categories: [
        { id: "hypotonic", label: "Hypotonic" },
        { id: "isotonic", label: "Isotonic" },
        { id: "hypertonic", label: "Hypertonic" },
      ],
      waves: [
        { text: "A red blood cell in pure water, swelling", categoryId: "hypotonic", why: "Less is dissolved outside than inside, so water flows in." },
        { text: "A cell in seawater, shrinking", categoryId: "hypertonic", why: "More is dissolved outside, so water flows out." },
        { text: "A cell in a liquid that matches its own salt level, unchanged", categoryId: "isotonic", why: "It's the same on both sides, so water doesn't move either way overall." },
        { text: "A plant cell in salty soil water, wilting", categoryId: "hypertonic", why: "More salt outside pulls water out." },
        { text: "A cell in a watery drink, about to burst", categoryId: "hypotonic", why: "Water rushes in from the watery drink." },
      ],
      secondsPerWave: 8,
    },
    hints: [
      "Each label is about the liquid around the cell. Compare how much is dissolved outside with inside.",
      "Hyper means more dissolved outside, so water leaves. Hypo means less, so water comes in.",
      "The cell in pure water is the one people mix up. Pure water has almost nothing dissolved in it.",
    ],
    wrongFeedback: "Hypertonic means more stuff dissolved outside, and less water. So the cell loses water and shrinks.",
    debriefLine: "You labeled each liquid by comparing it with the cell. That comparison is called tonicity.",
    sourceRef: { page: 2, quote: "In a hypertonic solution the cell loses water and shrinks." },
  },
  e6_facilitated: {
    prompt: "More cargo is waiting at the gates. Sort each one as passive (free) or active (costs ATP, the cell's energy).",
    params: {
      bins: [
        { id: "passive", label: "Passive, no ATP", feature: "moves from crowded to less crowded (down its gradient), with or without a protein" },
        { id: "active", label: "Active, costs ATP", feature: "moves from less crowded to more crowded (against its gradient), so a pump spends energy" },
      ],
      items: [
        { text: "Glucose entering through a carrier protein, from high to low", binId: "passive", why: "A protein helps, but it's still downhill. No energy needed." },
        { text: "Water through an aquaporin channel", binId: "passive", why: "The channel just lets water through faster." },
        { text: "Na+ pumped out of a cell that already has little Na+", binId: "active", why: "It's pushed toward the crowded side. That needs ATP." },
        { text: "K+ leaking out through an open channel, from high to low", binId: "passive", why: "It flows toward the less crowded side." },
        { text: "Protons (H+) pushed into a space that's already packed with them", binId: "active", why: "Uphill, so it costs energy." },
      ],
    },
    hints: [
      "Look at the glucose. It uses a carrier protein, but check which way it's moving.",
      "Ask if each one moves toward the crowded side or away from it. Only moving toward it costs ATP.",
      "Water through the aquaporin often lands in the wrong group. Ask if anything has to push it.",
    ],
    wrongFeedback: "Using a protein doesn't mean spending energy. Only moving toward the crowded side needs ATP.",
    debriefLine: "You sorted {{itemCount}} cases by which way they moved. A protein helping something downhill for free is called facilitated diffusion.",
    sourceRef: { page: 3, quote: "Facilitated diffusion uses channel or carrier proteins, but it is still passive: the molecules move down their gradient and the cell spends no energy." },
  },
  e7_active: {
    prompt: "The pump room hums. Three chests describe active transport, which means moving things with a pump. One is a mimic.",
    params: {
      statements: [
        { text: "Active transport moves things toward the more crowded side", isTrue: true, explanation: "It pushes things from where there are few to where there are many." },
        { text: "Active transport costs the cell ATP", isTrue: true, explanation: "Pumps use energy to push uphill." },
        { text: "Things only ever move toward the less crowded side, so pumps just speed them up", isTrue: false, explanation: "Pumps push things uphill. That's why they need ATP." },
      ],
    },
    hints: [
      "Look at the chest about ATP. Why would a cell spend energy just to move something?",
      "Things drift toward the less crowded side for free. Paying ATP only makes sense for going the other way.",
      "The chest about ATP is true. Compare the other two.",
    ],
    wrongFeedback: "That chest tells the truth. Look for the claim that says things only go downhill.",
    debriefLine: "The mimic said \"{{mimic}}\". Active transport pumps things uphill, and the cell pays in ATP.",
    sourceRef: { page: 3, quote: "Active transport moves substances against their concentration gradient, from low concentration to high, and requires energy from ATP." },
  },
  e8_pump: {
    prompt: "The sodium-potassium pump swaps sodium and potassium across the membrane. Rewire it by matching each part of one cycle to its value.",
    params: {
      pairs: [
        { left: "Sodium ions moved per cycle", right: "3, out of the cell", why: "Three Na+ leave." },
        { left: "Potassium ions moved per cycle", right: "2, into the cell", why: "Two K+ come in." },
        { left: "Energy spent per cycle", right: "1 ATP", why: "One ATP powers each cycle." },
        { left: "Cells that depend on it most", right: "Nerve and muscle cells", why: "They use the difference in ions to send signals." },
      ],
      decoyRights: ["2, out of the cell"],
    },
    hints: [
      "Look at the counts for sodium and potassium. They aren't the same number.",
      "Sodium goes out and potassium comes in. More ions leave than come in each cycle.",
      "One of the 'out of the cell' cards is a trap. Only sodium leaves, and the counts aren't equal.",
    ],
    wrongFeedback: "The pump is lopsided. More sodium goes out than potassium comes in, which leaves the inside a bit negative.",
    debriefLine: "You matched {{pairCount}} facts about the sodium-potassium pump. Each cycle sends 3 Na+ out and 2 K+ in, using 1 ATP.",
    sourceRef: { page: 3, quote: "Each cycle of the sodium-potassium pump moves three sodium ions out of the cell and two potassium ions in, at the cost of one ATP." },
  },
  e9_osmosis_review: {
    prompt: "Review time! Pick which way water moves for each cell before it drifts by.",
    params: {
      categories: [
        { id: "in", label: "Water moves in" },
        { id: "out", label: "Water moves out" },
        { id: "none", label: "No net movement" },
      ],
      waves: [
        { text: "Cell with 2% salt inside, in a 10% salt bath", categoryId: "out", why: "More salt outside pulls water out." },
        { text: "Cell with 2% salt inside, in distilled water", categoryId: "in", why: "Water flows toward the saltier cell." },
        { text: "Cell with 0.9% salt inside, in 0.9% saline", categoryId: "none", why: "Same salt on both sides, so water moves both ways equally." },
        { text: "Potato cells in a sugar syrup", categoryId: "out", why: "Syrup has far more sugar than the cells." },
      ],
      secondsPerWave: 8,
    },
    hints: [
      "Each card gives the salt inside the cell and in the bath around it. Compare those two.",
      "Water moves toward the side with more salt or sugar. The salt itself stays put.",
      "The potato cells are easy to get wrong. Syrup has far more sugar in it than a potato.",
    ],
    wrongFeedback: "Water moves toward the side with more salt. The salt itself stays where it is.",
    debriefLine: "Osmosis review. You worked out which way water moves in four cells, just from the salt levels.",
    sourceRef: { page: 2, quote: "Osmosis is the diffusion of water across a selectively permeable membrane." },
  },
  e10_bulk: {
    prompt: "The big door only opens if the planks show how a large particle gets into the cell. One plank doesn't belong.",
    params: {
      steps: [
        "The particle touches the outside of the membrane",
        "The membrane folds inward around the particle",
        "The pocket pinches off into a bubble called a vesicle",
        "The vesicle carries the particle where it needs to go",
      ],
      decoys: ["The particle dissolves through the bilayer on its own"],
    },
    hints: [
      "Start with the particle outside the cell. Nothing can happen until it touches the membrane.",
      "The membrane has to wrap around the particle before it can close the pocket.",
      "Once the pocket pinches off, the particle is inside a bubble. What happens to that bubble last?",
    ],
    wrongFeedback: "Check the order. The membrane can't pinch off a pocket before it wraps around the particle.",
    debriefLine: "That's endocytosis, the cell swallowing something big. All {{count}} steps cost ATP, so it counts as active transport.",
    sourceRef: { page: 4, quote: "In endocytosis the membrane folds inward around the cargo and pinches off to form a vesicle inside the cell." },
  },
  e11_boss: {
    prompt: "The Gatekeeper dumps mixed cargo at your feet. Sort each item by how it crosses the membrane.",
    params: {
      bins: [
        { id: "simple", label: "Simple diffusion", feature: "small and nonpolar, crosses the fat layer alone, downhill" },
        { id: "facilitated", label: "Facilitated diffusion", feature: "polar or charged, uses a channel or carrier, still downhill with no ATP" },
        { id: "active", label: "Active transport", feature: "pushed uphill through a pump that spends ATP" },
      ],
      items: [
        { text: "O2 entering a cell that has used up its oxygen", binId: "simple", why: "Nonpolar and downhill, with no protein." },
        { text: "Glucose entering a muscle cell through a carrier, from high to low", binId: "facilitated", why: "A protein helps, but it's downhill." },
        { text: "Na+ pumped out against its gradient", binId: "active", why: "Uphill, so it needs ATP." },
        { text: "Water entering through an aquaporin", binId: "facilitated", why: "Water uses a channel to cross." },
        { text: "CO2 leaving a cell that makes it", binId: "simple", why: "Nonpolar and downhill." },
        { text: "K+ pumped into a cell that already has lots of K+", binId: "active", why: "Pushed uphill." },
        { text: "Cl- entering through an open channel, from high to low", binId: "facilitated", why: "It's charged, so it needs a channel. It's still downhill." },
      ],
    },
    hints: [
      "Look for 'pumped' and 'from high to low' in the cargo. Those words tell you which way each moves.",
      "Anything pushed uphill is active. If it's downhill, ask if it can slip through the fat alone.",
      "Water through the aquaporin is the tricky one. Check if it uses a protein.",
    ],
    wrongFeedback: "Ask two things. Is it going uphill? If not, can it slip through the fat alone?",
    debriefLine: "You sorted {{itemCount}} cargo items by direction and charge. That covers simple diffusion, facilitated diffusion and active transport.",
    sourceRef: { page: 3, quote: "If a cell runs out of ATP, its pumps stop and the gradients they maintain slowly dissipate." },
  },
};

export const cellNarrative: NarrativeSlice = {
  intro: [{ speakerId: "pilot", text: "We've shrunk. That shiny film is the cell's skin. Open the gates and we can get to the nucleus." }],
  outro: [{ speakerId: "pilot", text: "We made it to the nucleus. You opened every gate on the way in." }],
  beats: [
    { encounterId: "e2_selectivity", when: "before", speakerId: "pilot", text: "Careful with the small ones. Being small doesn't mean they get in." },
    { encounterId: "e11_boss", when: "before", speakerId: "gatekeeper", text: "I have pumped for a billion years. Show me you know what costs energy." },
    { encounterId: "e11_boss", when: "after", speakerId: "gatekeeper", text: "Hrrm. All sorted right. You may pass." },
  ],
};

export const cellAssessment: AssessmentSlice = {
  post: [
    { conceptId: "c_osmosis", prompt: "A freshwater fish cell sits in fresh water, which has far less salt than the cell. What happens?", correct: "Water enters the cell", distractors: ["Water leaves the cell", "Salt enters the cell", "Nothing moves"] },
    { conceptId: "c_active_transport", prompt: "A cell moves calcium from inside, where there's little, to outside, where there's lots. What kind of transport is this?", correct: "Active transport, using ATP", distractors: ["Simple diffusion", "Facilitated diffusion", "Osmosis"] },
    { conceptId: "c_selectivity", prompt: "Na+ is tiny. Why can't it cross the bilayer on its own?", correct: "It's charged, and the middle of the bilayer is oily", distractors: ["It is too large", "The membrane has no holes", "Sodium is toxic to the cell"] },
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

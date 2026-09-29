import type { AssessmentSlice, BlueprintSlice, ChallengeSlice, NarrativeSlice, TutorSlice } from "../src/contracts/slices";
import type { Slices } from "../src/pipeline/assemble";
import { egyptIntake, egyptKnowledgeMap } from "./ancient-egypt.knowledge-map";

/*
 * The 3D open-world demo (docs/design/60 §3): Old Kingdom Egypt as a world3d game. Ten encounters across seven mechanic
 * modes (sequencer.linear, sorter.bins, linker.pairs, truth_finder.mimic, linker.chain, explainer.teach_back,
 * investigator.elimination), each anchored in the world by fixtures/ancient-egypt.world3d.ts. Written the way the
 * pipeline's agents would write them; the fixture builder assembles and validates the GameSpec (never hand-edit the JSON).
 */

export const egyptBlueprint: BlueprintSlice = {
  genre: "world3d",
  title: "The Scribe of the Nile",
  theme: {
    setting: "Giza in the reign of Khufu, c. 2560 BCE: the Great Pyramid stands finished but for its golden capstone",
    tone: "warm, wondrous, grounded in real archaeology",
    paletteId: "parchment",
    musicMood: "curious",
  },
  premise:
    "Khufu's pyramid awaits its golden capstone, but its inscription is lost. As Hemiunu's apprentice scribe, learn from the people of Giza and carve the true story of how Egypt raised it before the sun sets.",
  characters: [
    { id: "hemiunu", name: "Hemiunu", role: "the king's architect and vizier, your master", voiceArchetype: "wise_mentor" },
    { id: "nebet", name: "Nebet", role: "master scribe of the House of Life", voiceArchetype: "nervous_scholar" },
    { id: "meryt", name: "Meryt", role: "embalmer and priestess of Anubis", voiceArchetype: "cheerful_sidekick" },
    { id: "ipi", name: "Ipi", role: "keeper of the Nilometer", voiceArchetype: "gruff_guard" },
  ],
  encounters: [
    { id: "e1_flood", conceptIds: ["c_flood"], teachingMechanicId: "chrono_bridge", socket: "inscription", role: "teach", difficulty: 1, targetMisconception: "Egyptian farmers watered their fields with rain.", designNote: "Order the farming year from the flood to the harvest; the rain decoy tempts the non-Egyptian idea of farming." },
    { id: "e2_society", conceptIds: ["c_social_pyramid"], teachingMechanicId: "era_sorter", socket: "artifact", role: "teach", difficulty: 1, targetMisconception: null, designNote: "Sort the people of Giza into the bands of the temple relief: rulers and officials, priests and scribes, artisans and farmers." },
    { id: "e3_signs", conceptIds: ["c_hieroglyphs"], teachingMechanicId: "who_said_it", socket: "conversation", role: "teach", difficulty: 2, targetMisconception: "Every hieroglyph is a picture of the thing it means.", designNote: "Match the scribe's terms to what they are; the decoy is the 'every sign is a picture' idea." },
    { id: "e4_builders", conceptIds: ["c_builders"], teachingMechanicId: "mimic_chest", socket: "conversation", role: "teach", difficulty: 1, targetMisconception: "The pyramids were built by slaves.", designNote: "Three true claims about the workers from the evidence, one false: the slave story." },
    { id: "e5_construction", conceptIds: ["c_construction"], teachingMechanicId: "domino_engine", socket: "conversation", role: "teach", difficulty: 2, targetMisconception: "The blocks were carried from far away to Giza.", designNote: "Chain a block from the Giza quarry to its place on the pyramid; decoy: shipping it in from far away." },
    { id: "e6_flood_explain", conceptIds: ["c_flood"], teachingMechanicId: "explain_the_cause", socket: "conversation", role: "practice", difficulty: 2, targetMisconception: "Egyptian farmers watered their fields with rain.", designNote: "Explain to a worried young farmer why a good flood is a good year: silt, water and the harvest." },
    { id: "e7_mummy", conceptIds: ["c_mummification"], teachingMechanicId: "chrono_bridge", socket: "inscription", role: "teach", difficulty: 1, targetMisconception: "Embalmers removed the heart along with the other organs.", designNote: "Order the embalming steps painted on the wall; the decoy removes the heart." },
    { id: "e8_gods", conceptIds: ["c_gods"], teachingMechanicId: "who_said_it", socket: "conversation", role: "teach", difficulty: 1, targetMisconception: "Anubis was the god who judged the dead.", designNote: "Match each god to their role; Osiris judges, Anubis guides." },
    { id: "e9_review", conceptIds: ["c_social_pyramid"], teachingMechanicId: "mimic_chest", socket: "seal", role: "review", difficulty: 2, targetMisconception: "Most Egyptians were slaves.", designNote: "The causeway gate's seal: three true claims about Egyptian society and the false 'most were slaves'." },
    { id: "e10_capstone", conceptIds: ["c_builders", "c_flood", "c_construction"], teachingMechanicId: "evidence_board", socket: "finale", role: "boss", difficulty: 3, targetMisconception: "The pyramids were built by slaves.", designNote: "What truly raised the pyramid? Eliminate the slave, foreign-stone and single-season stories with the evidence until the paid crews fed by the Nile stand." },
  ],
};

export const egyptChallenges: Record<string, ChallengeSlice> = {
  e1_flood: {
    prompt: "The Nilometer's wall shows the farming year in four carvings, and a fifth that doesn't belong. Set the year in order.",
    params: {
      steps: [
        "Akhet: the Nile floods and the fields lie under water",
        "The water draws back and leaves a layer of black silt",
        "Peret: farmers plant wheat and barley in the damp silt",
        "Shemu: the crops are cut and stored before the next flood",
      ],
      decoys: ["The spring rains soak the fields so the seed can sprout"],
    },
    hints: [
      "Everything here starts with the river, not the sky.",
      "Nothing can be planted while the fields are under water. What has to happen to the water first?",
      "The year runs flood, silt, planting, harvest. It starts with: {{first}}",
    ],
    wrongFeedback: "Not quite. In Egypt almost no rain falls: the year follows the river rising and falling.",
    debriefLine: "The Nile's year: Akhet flood, black silt, Peret planting, Shemu harvest, with no rain needed.",
    sourceRef: { page: 1, quote: "Akhet was the season of the flood, when the fields lay under water." },
  },
  e2_society: {
    prompt: "The temple relief shows Egypt in three bands. Place each person of Giza in the band where they belong.",
    params: {
      bins: [
        { id: "rulers", label: "Pharaoh and officials", feature: "They rule, govern and judge: the god-king, the vizier and the nobles." },
        { id: "learned", label: "Priests and scribes", feature: "They serve the gods or keep the written records that run the kingdom." },
        { id: "workers", label: "Artisans and farmers", feature: "They make goods or grow the food; farmers are the large majority." },
      ],
      items: [
        { text: "Khufu, god-king on earth", binId: "rulers", why: "The pharaoh stands at the very top and keeps ma'at." },
        { text: "Hemiunu, the vizier who collects the taxes", binId: "rulers", why: "The vizier runs the government under the pharaoh." },
        { text: "A priest who tends the temple's offerings", binId: "learned", why: "Priests serve the gods, just below the nobles." },
        { text: "Nebet, who writes the harvest records", binId: "learned", why: "Scribes keep the written records that hold the kingdom together." },
        { text: "A stone carver shaping a statue", binId: "workers", why: "Skilled artisans make goods for the kingdom." },
        { text: "A merchant trading cedar wood", binId: "workers", why: "Traders sit with the artisans, below the scribes." },
        { text: "Tjeti, who plants barley in the silt", binId: "workers", why: "Farmers grow the food and are most of the people." },
      ],
    },
    hints: [
      "Ask what each person spends their day doing: ruling, writing and praying, or making and growing.",
      "Reading and writing lifts a person above the artisans. Who in this list writes for a living?",
      "Khufu and the vizier rule; the priest and Nebet serve and record; the carver, merchant and farmer work.",
    ],
    wrongFeedback: "Someone is in the wrong band. Think about what that person does all day, not how rich they might be.",
    debriefLine: "Egypt's social pyramid: the pharaoh and officials rule, priests and scribes serve and record, and artisans and farmers, most of all people, do the work.",
    sourceRef: { page: 2, quote: "Farmers made up the large majority of the population." },
  },
  e3_signs: {
    prompt: "Nebet slides five words across the table. Match each one to what it means before the ink dries.",
    params: {
      pairs: [
        { left: "Logogram", right: "A sign that stands for a whole word", why: "'Logo' means word: one sign, one word." },
        { left: "Phonogram", right: "A sign that stands for a sound", why: "'Phono' means sound: signs you sound out, like letters." },
        { left: "Cartouche", right: "An oval ring drawn around a pharaoh's name", why: "It protects and marks a royal name." },
        { left: "Papyrus", right: "Paper made from reeds that grow along the Nile", why: "Scribes wrote everyday records on it in ink." },
        { left: "Rosetta Stone", right: "One decree carved in hieroglyphs, demotic and Greek", why: "The Greek let Champollion read the hieroglyphs in 1822." },
      ],
      decoyRights: ["A small picture that always shows the very object it means"],
    },
    hints: [
      "Two of the words are built from Greek roots: 'logo' is word, 'phono' is sound.",
      "One of the answers is a trap: not every sign is a picture of its meaning.",
      "The Rosetta Stone had three scripts; the cartouche circles a king's name.",
    ],
    wrongFeedback: "One match is off. Remember that many signs stand for sounds, not for the thing they show.",
    debriefLine: "Hieroglyphs mix logograms (words) and phonograms (sounds); cartouches circle royal names, papyrus holds the records, and the Rosetta Stone unlocked them.",
    sourceRef: { page: 2, quote: "Some signs are logograms that stand for a whole word, while others are phonograms that stand for sounds." },
  },
  e4_builders: {
    prompt: "Khenu the baker has heard four stories about the pyramid's builders. One of them is false. Which?",
    params: {
      statements: [
        { text: "The crews were paid in rations of bread and beer", isTrue: true, explanation: "The workers' village had bakeries and breweries to feed them." },
        { text: "Workers who died were buried in tombs beside the pyramid", isTrue: true, explanation: "An honor no slave would have received." },
        { text: "Slaves in chains were forced to haul every block", isTrue: false, explanation: "The evidence shows paid, fed crews, honored with tombs, not slaves." },
        { text: "Many builders were farmers waiting out the flood", isTrue: true, explanation: "Their fields were under water during Akhet, so they worked on the pyramid." },
      ],
    },
    hints: [
      "Think about what archaeologists found beside the pyramid: bakeries, breweries, sleeping halls and tombs.",
      "Would anyone build honored tombs for slaves next to the king's pyramid?",
      "The false story is: {{mimic}}",
    ],
    wrongFeedback: "That story holds up against the evidence. Look for the one the workers' village and their tombs contradict.",
    debriefLine: "The false story was \"{{mimic}}\": the pyramids were built by paid, fed crews, many of them farmers, buried with honor beside their work.",
    sourceRef: { page: 3, quote: "Workers who died on the job were buried in tombs close to the pyramid, an honor no slave would have received." },
  },
  e5_construction: {
    prompt: "Senbi the overseer tests every new scribe: chain the journey of one block from the rock to the pyramid.",
    params: {
      nodes: [
        "Cut a limestone block from the Giza quarry with copper tools",
        "Lever the block onto a wooden sledge",
        "Pour water on the sand in front of the sledge",
        "Haul the sledge up a ramp of mud brick and rubble",
        "Set the block in its place on the rising pyramid",
      ],
      decoys: ["Ship the block to Giza from a quarry across the sea"],
    },
    hints: [
      "Start where the stone starts: the quarry is right here at Giza.",
      "Wet sand makes the sledge slide, so the water must come before the hard pull.",
      "Cut, load, wet the sand, drag up the ramp, set in place.",
    ],
    wrongFeedback: "The block got lost on the way. Most of this stone never left Giza: follow it from the quarry to the ramp.",
    debriefLine: "A Great Pyramid block: quarried at Giza with copper tools, loaded on a sledge, slid over wetted sand and hauled up ramps into place.",
    sourceRef: { page: 3, quote: "Workers cut limestone blocks with copper tools, dragged them on wooden sledges and pulled them up ramps of mud brick and rubble." },
  },
  e6_flood_explain: {
    prompt: "Tjeti, a young farmer, can't see why the village cheers at the Nilometer. Explain it in your own words.",
    params: {
      listener: "Tjeti, a young farmer worried about this year's flood",
      question: "Why does the whole village cheer when the Nilometer shows a good flood?",
      ideas: [
        {
          label: "what the water leaves behind",
          keywords: ["silt", "black soil", "black land", "fertile", "rich soil", "mud", "kemet", "nutrients", "good soil"],
          followUp: "But the water goes away again. What's left on our fields when it does?",
          exemplar: "When the flood goes down it leaves rich black silt that makes the soil fertile.",
        },
        {
          label: "how the crops drink",
          keywords: ["water the crops", "waters the fields", "soaks", "damp", "wet", "irrigation", "irrigate", "canals", "basins", "moist"],
          followUp: "And the crops need to drink. Where does their water come from, out here?",
          exemplar: "The flood soaks the fields, and canals carry the water to fields farther away.",
        },
        {
          label: "what a good year means for everyone",
          keywords: ["harvest", "food", "enough to eat", "grain", "wheat", "barley", "taxes", "hunger", "bread", "crops grow"],
          followUp: "So what does a good flood mean when Shemu comes, for us and for the king?",
          exemplar: "A good flood means a big harvest, enough food for everyone and grain for the taxes.",
        },
      ],
      required: 2,
      misconceptions: [
        {
          keywords: ["rainfall", "rainy season", "rain waters", "the rain", "storms"],
          correction: "Rain? Look up, friend. Hardly a drop falls here all year. So where does our water come from?",
        },
      ],
      wordBank: ["silt", "fertile", "water", "canals", "harvest", "taxes"],
    },
    hints: [
      "Think about what is on the fields after the water drains away.",
      "It almost never rains here. The river is the only water, and the silt is the only fertilizer.",
      "Say that the flood leaves fertile black silt and waters the fields, so the harvest is big and everyone eats.",
    ],
    wrongFeedback: "Tjeti still looks worried. Think about what the flood leaves behind and what that means at harvest time.",
    debriefLine: "A good flood leaves fertile black silt and waters the fields, so the harvest feeds Egypt and fills the tax stores.",
    sourceRef: { page: 1, quote: "When the water drew back it left a layer of rich black silt behind." },
  },
  e7_mummy: {
    prompt: "The House of Purification's wall shows how a body is prepared for eternity. Put the paintings in order.",
    params: {
      steps: [
        "Remove the internal organs and seal them in canopic jars",
        "Cover the body in natron salt to dry it for forty days",
        "Wrap the body in layers of linen with protective amulets",
        "Place the wrapped mummy in its coffin",
      ],
      decoys: ["Take out the heart and store it in a jar of its own"],
    },
    hints: [
      "The whole work takes about seventy days, and drying is most of it.",
      "Nothing can be wrapped until it is dry. And one organ never leaves the body.",
      "Organs out into jars, natron to dry, linen and amulets, then the coffin.",
    ],
    wrongFeedback: "The embalmers would frown. Remember what must stay inside the body, and what must happen before any wrapping.",
    debriefLine: "Mummification: organs into canopic jars (the heart stays for the weighing), 40 days of natron, linen and amulets, then the coffin.",
    sourceRef: { page: 4, quote: "Next they covered the body with natron, a natural salt, for about 40 days to dry it out." },
  },
  e8_gods: {
    prompt: "Meryt quizzes you before the offerings: match each god to the work they do.",
    params: {
      pairs: [
        { left: "Ra", right: "Sails the sun across the sky each day", why: "He is the sun god." },
        { left: "Osiris", right: "Rules the afterlife and judges the dead", why: "The king of the underworld sits in judgment." },
        { left: "Isis", right: "Goddess of magic and protection", why: "Her spells protect the living and the dead." },
        { left: "Anubis", right: "Jackal-headed guardian of embalming and guide of souls", why: "He watches over the embalmers and leads souls to judgment." },
        { left: "Thoth", right: "Ibis-headed god of writing and wisdom", why: "Every scribe's patron." },
      ],
      decoyRights: ["Falcon-headed protector of kingship"],
    },
    hints: [
      "Each god's head gives a clue: the jackal watches over the dead's bodies, the ibis over the scribes.",
      "Guiding a soul to judgment is not the same as judging it.",
      "Osiris judges; Anubis guides and guards the embalming.",
    ],
    wrongFeedback: "One god is doing someone else's job. Who judges the dead, and who only leads them there?",
    debriefLine: "Ra the sun, Osiris judge of the dead, Isis magic, Anubis embalming and guide of souls, Thoth writing and wisdom.",
    sourceRef: { page: 4, quote: "Osiris ruled the afterlife and judged the dead." },
  },
  e9_review: {
    prompt: "The causeway gate is sealed with four claims about Egypt's people. Break the one false seal.",
    params: {
      statements: [
        { text: "The vizier ran the government and collected the taxes", isTrue: true, explanation: "He served just beneath the pharaoh." },
        { text: "A farmer's son who learned to write could become a scribe", isTrue: true, explanation: "Writing was the way up in Egyptian society." },
        { text: "Most Egyptians were slaves owned by the nobles", isTrue: false, explanation: "Farmers were the large majority; enslaved people were few." },
        { text: "The pharaoh was believed to be a god on earth", isTrue: true, explanation: "His duty was to keep ma'at, the balance of the world." },
      ],
    },
    hints: [
      "Think back to the temple relief: which band held the most people?",
      "Enslaved people existed, usually prisoners of war. Were they most of Egypt?",
      "The false seal reads: {{mimic}}",
    ],
    wrongFeedback: "That seal is true. Look for the claim about who most Egyptians were.",
    debriefLine: "The false seal was \"{{mimic}}\": farmers were most of Egypt, and enslaved people were a small part of it.",
    sourceRef: { page: 2, quote: "Farmers made up the large majority of the population." },
  },
  e10_capstone: {
    prompt: "The capstone must name what truly raised this pyramid. Weigh the evidence of Giza until one answer stands.",
    params: {
      question: "What truly raised the Great Pyramid of Khufu?",
      hypotheses: [
        { id: "slaves", text: "Enslaved captives, driven by whips, who were left where they fell" },
        { id: "foreign", text: "Blocks shipped whole from distant lands and set by foreign engineers" },
        { id: "one_season", text: "The king's household, working through a single season" },
        { id: "crews", text: "Paid Egyptian crews, many of them farmers in the flood season, using sledges and ramps" },
      ],
      clues: [
        { text: "A workers' village with bakeries and breweries lies beside the pyramid", eliminates: ["slaves"] },
        { text: "Workers who died were honored with tombs close to the pyramid", eliminates: ["slaves"] },
        { text: "Most of the stone was quarried at Giza itself", eliminates: ["foreign"] },
        { text: "The pyramid holds about 2.3 million stone blocks", eliminates: ["one_season"] },
        { text: "Many laborers were farmers who came while the flood covered their fields", eliminates: ["slaves"] },
      ],
    },
    hints: [
      "Test each story against the village, the tombs and the quarry right here.",
      "2.3 million blocks is far more than one household could move in one season.",
      "Only one story survives every clue: {{survivor}}",
    ],
    wrongFeedback: "A story you kept is broken by one of the clues. Read each clue against each story again.",
    debriefLine: "The capstone's truth: {{survivor}}. The Nile's harvest fed them, and Egypt's organization made it possible.",
    sourceRef: { page: 3, quote: "The pyramids were not built by slaves." },
  },
};

export const egyptNarrative: NarrativeSlice = {
  intro: [
    { speakerId: "hemiunu", text: "Scribe! The pyramid is finished but for its capstone, and the capstone must carry the truth." },
    { speakerId: "hemiunu", text: "Walk the land. Learn from its people. Bring me the words before the sun sets." },
  ],
  outro: [
    { speakerId: "hemiunu", text: "The capstone rises, and its words are true: the river fed Egypt, and Egypt built for eternity." },
    { speakerId: "nebet", text: "Your signs were steady. The House of Life will want you back." },
  ],
  beats: [],
};

export const egyptAssessment: AssessmentSlice = {
  post: [
    { conceptId: "c_builders", prompt: "Which find shows the pyramid builders were not slaves?", correct: "Their honored tombs right beside the pyramid", distractors: ["The size of the blocks", "The gold on the capstone", "The height of the pyramid"] },
    { conceptId: "c_flood", prompt: "What made the land beside the Nile so good for farming?", correct: "The black silt the flood left behind", distractors: ["Heavy spring rains", "Sand blown in from the desert", "Water carried up from wells"] },
    { conceptId: "c_hieroglyphs", prompt: "A phonogram is a hieroglyph that…", correct: "Stands for a sound", distractors: ["Always shows the object it means", "Circles a pharaoh's name", "Can only be carved in stone"] },
  ],
};

export const egyptTutor: TutorSlice = {
  lessons: [
    {
      conceptId: "c_flood",
      explanation: "Egypt gets almost no rain, so its farms live on the river. Every summer the Nile overflows, soaks the valley and then drains away, leaving rich black silt. Farmers plant in that damp silt and harvest before the next flood.",
      example: "In a good year the Nilometer shows a flood of the right height: the fields get water and silt, the harvest is big, and the tax scribes collect plenty of grain.",
    },
    {
      conceptId: "c_social_pyramid",
      explanation: "Picture society as a pyramid. The pharaoh sits at the top as a god on earth. Below him the vizier runs the government, then nobles and priests, then scribes, then artisans and traders, and at the wide base the farmers, who are most of the people.",
      example: "A farmer's son who learns hieroglyphs can become a scribe and move up a level, because writing runs the kingdom.",
    },
    {
      conceptId: "c_hieroglyphs",
      explanation: "Hieroglyphs have more than 700 signs. Some are logograms that mean a whole word; others are phonograms that stand for sounds, like our letters. A pharaoh's name is drawn inside an oval called a cartouche.",
      example: "A sign shaped like a mouth can be read as the sound 'r', not as the word 'mouth'. That is a phonogram at work.",
    },
    {
      conceptId: "c_builders",
      explanation: "The pyramids were built by paid crews, not slaves. Beside the pyramids archaeologists found a workers' village with bakeries and breweries, and tombs where workers who died were buried with honor.",
      example: "A farmer whose field is under the flood in Akhet joins a crew for the season, eats bread and beer rations, and goes home to plant when the water drains.",
    },
    {
      conceptId: "c_construction",
      explanation: "Most blocks were cut right at Giza with copper tools. Workers loaded them onto wooden sledges, poured water on the sand to make them slide, and hauled them up ramps. White Tura limestone made the smooth outer casing.",
      example: "Wet sand is firmer than dry sand, so a sledge that would dig into dry sand glides over wet sand with far fewer workers pulling.",
    },
    {
      conceptId: "c_mummification",
      explanation: "Mummification took about 70 days. Embalmers removed the organs into canopic jars but left the heart, dried the body in natron salt for about 40 days, then wrapped it in linen with amulets.",
      example: "The heart stays because in the afterlife it will be weighed against the feather of Ma'at, so the dead need it.",
    },
    {
      conceptId: "c_gods",
      explanation: "Each god had a job. Ra sailed the sun across the sky, Osiris ruled the afterlife and judged the dead, Isis worked magic and protection, Anubis watched over embalming and guided souls, and Thoth was the god of writing.",
      example: "At death, Anubis leads the soul to the Hall of Two Truths, where the heart is weighed and Osiris gives the judgment.",
    },
  ],
};

export const egyptSlices: Slices = {
  id: "egypt_world3d_001",
  createdAt: "2026-09-29T12:00:00.000Z",
  km: egyptKnowledgeMap,
  intake: egyptIntake,
  blueprint: egyptBlueprint,
  challenges: egyptChallenges,
  narrative: egyptNarrative,
  assessment: egyptAssessment,
  tutor: egyptTutor,
};

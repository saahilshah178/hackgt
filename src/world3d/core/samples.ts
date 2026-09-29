import type { World3D } from "../../contracts/world3d";

/*
 * Sample worlds for the /dev/kit3d gallery, the core tests and the renderer's development. They are complete World3D
 * documents, but their moments/acts reference placeholder encounter ids (e1…); a real game's world is written against
 * its own GameSpec. The Nile sample is the first draft of the demo's geography (docs/design/60 §3).
 */

const npcLook = (skin: World3D["npcs"][number]["look"]["skin"], outfit: World3D["npcs"][number]["look"]["outfit"], color: World3D["npcs"][number]["look"]["color"], accent: World3D["npcs"][number]["look"]["accent"], headwear: World3D["npcs"][number]["look"]["headwear"], held: World3D["npcs"][number]["look"]["held"], height = 1) => ({ skin, outfit, color, accent, headwear, held, height });

export const NILE_SAMPLE: World3D = {
  version: 1,
  seed: 2560,
  biome: "desert",
  setting: { era: "Old Kingdom Egypt, c. 2560 BCE", place: "The Giza plateau above the Nile", style: "ancient_egypt" },
  terrain: {
    size: 560,
    relief: 0.35,
    features: [
      { kind: "plateau", at: { x: -130, z: -50 }, radius: 175, height: 13 },
      { kind: "dunes", at: { x: -215, z: 175 }, radius: 110, height: 7 },
      { kind: "hill", at: { x: -40, z: 230 }, radius: 70, height: 8 },
      { kind: "ridge", at: { x: -240, z: -210 }, radius: 90, height: 16 },
    ],
    water: {
      kind: "river",
      level: 0,
      course: [
        { x: 170, z: -280 },
        { x: 190, z: -150 },
        { x: 165, z: -20 },
        { x: 200, z: 110 },
        { x: 215, z: 280 },
      ],
      width: 46,
      coast: null,
    },
  },
  atmosphere: { mood: "golden_hour", weather: "haze", fog: 0.35, wind: 0.3 },
  landmarks: [
    { id: "great_pyramid", kind: "pyramid", name: "The Great Pyramid", at: { x: -115, z: -110 }, rotation: 0, scale: 1.2, material: "limestone", style: "ancient_egypt", role: "goal", description: "Khufu's pyramid, cased in polished white limestone. Its gilded capstone waits to be raised." },
    { id: "second_pyramid", kind: "pyramid", name: "The Queen's Pyramid", at: { x: -215, z: 55 }, rotation: 0, scale: 0.6, material: "limestone", style: "ancient_egypt", role: "decor", description: "A smaller pyramid for a royal wife of Khufu." },
    { id: "sphinx", kind: "sphinx", name: "The Great Sphinx", at: { x: -30, z: 20 }, rotation: 90, scale: 1, material: "sandstone", style: "ancient_egypt", role: "poi", description: "A lion's body with a king's face, carved from the bedrock, watching the sunrise." },
    { id: "valley_temple", kind: "temple", name: "The Valley Temple", at: { x: 45, z: 60 }, rotation: 90, scale: 1, material: "granite", style: "ancient_egypt", role: "hub", description: "Where the king's funeral boat will land, and where the causeway to the pyramid begins." },
    { id: "obelisk_north", kind: "obelisk", name: "North Obelisk", at: { x: 80, z: 44 }, rotation: 90, scale: 1, material: "granite", style: "ancient_egypt", role: "decor", description: "A granite needle carved with the king's names." },
    { id: "obelisk_south", kind: "obelisk", name: "South Obelisk", at: { x: 80, z: 76 }, rotation: 90, scale: 1, material: "granite", style: "ancient_egypt", role: "poi", description: "Its carvings are half worn away by sand." },
    { id: "nilometer", kind: "well", name: "The Nilometer", at: { x: 128, z: -62 }, rotation: 90, scale: 1.6, material: "limestone", style: "ancient_egypt", role: "poi", description: "Steps down into the river, marked in cubits, to measure the flood." },
    { id: "house_of_life", kind: "library", name: "The House of Life", at: { x: 55, z: -120 }, rotation: 180, scale: 1, material: "limestone", style: "ancient_egypt", role: "poi", description: "The temple school where scribes copy and study the sacred texts." },
    { id: "embalmers", kind: "workshop", name: "The House of Purification", at: { x: -70, z: 120 }, rotation: 45, scale: 1.2, material: "adobe", style: "ancient_egypt", role: "poi", description: "Where the embalmers prepare the dead for the journey to the afterlife." },
    { id: "mastaba", kind: "tomb", name: "Mastaba of the Overseer", at: { x: -160, z: 150 }, rotation: 45, scale: 1.3, material: "limestone", style: "ancient_egypt", role: "decor", description: "A flat-roofed tomb for a high official." },
  ],
  clusters: [
    { id: "workers_village", kind: "village", at: { x: 10, z: 185 }, radius: 55, count: 12, material: "adobe", style: "ancient_egypt" },
    { id: "fields", kind: "farmland", at: { x: 120, z: 175 }, radius: 55, count: 6, material: "adobe", style: "ancient_egypt" },
    { id: "harbor", kind: "harbor", at: { x: 150, z: 45 }, radius: 40, count: 3, material: "wood", style: "ancient_egypt" },
    { id: "palm_grove", kind: "grove", at: { x: 120, z: -175 }, radius: 40, count: 10, material: "wood", style: "ancient_egypt" },
    { id: "quarry", kind: "quarry", at: { x: -215, z: -215 }, radius: 28, count: 1, material: "limestone", style: "ancient_egypt" },
  ],
  scatter: [
    { kind: "palm", density: 0.8, zone: "near_water", landmarkId: null },
    { kind: "reeds", density: 0.9, zone: "near_water", landmarkId: null },
    { kind: "tall_grass", density: 0.5, zone: "near_water", landmarkId: null },
    { kind: "bush", density: 0.3, zone: "lowlands", landmarkId: null },
    { kind: "rock", density: 0.4, zone: "everywhere", landmarkId: null },
    { kind: "boulder", density: 0.3, zone: "highlands", landmarkId: null },
    { kind: "palm", density: 0.5, zone: "around_landmark", landmarkId: "valley_temple" },
  ],
  paths: [
    { from: "spawn", to: "valley_temple", style: "stone" },
    { from: "valley_temple", to: "sphinx", style: "stone" },
    { from: "sphinx", to: "great_pyramid", style: "stone" },
    { from: "spawn", to: "nilometer", style: "dirt" },
    { from: "valley_temple", to: "house_of_life", style: "dirt" },
    { from: "valley_temple", to: "embalmers", style: "dirt" },
    { from: "great_pyramid", to: "second_pyramid", style: "sand" },
  ],
  wildlife: [
    { kind: "cat", count: 6, zone: "around_landmark", landmarkId: "valley_temple" },
    { kind: "ibis", count: 5, zone: "near_water", landmarkId: null },
    { kind: "camel", count: 2, zone: "around_landmark", landmarkId: "great_pyramid" },
    { kind: "bird_flock", count: 14, zone: "near_water", landmarkId: null },
    { kind: "fish", count: 10, zone: "near_water", landmarkId: null },
  ],
  npcs: [
    { id: "hemiunu", characterId: null, name: "Hemiunu", role: "Royal architect and vizier", at: { x: -105, z: 0 }, facing: 180, look: npcLook("tone5", "robe", "linen", "gold", "headdress", "scroll", 1.05), behavior: "study", voiceArchetype: "wise_mentor", greeting: "Ah, the new scribe. The capstone rises at dawn, and its words are still missing.", barks: ["Every block, measured twice.", "The sun sets. We are running out of light."], persona: "The king's architect: precise, proud, patient with those who try.", topics: [] },
    { id: "nebet", characterId: null, name: "Nebet", role: "Master scribe of the House of Life", at: { x: 55, z: -92 }, facing: 0, look: npcLook("tone4", "dress", "linen", "teal", "none", "tablet"), behavior: "idle", voiceArchetype: "nervous_scholar", greeting: "Mind the ink! Oh, it's you. Have you practised your signs?", barks: ["A scribe never goes hungry.", "Reed, ink, papyrus. That is all you need."], persona: "A sharp, kind teacher of hieroglyphs.", topics: [] },
    { id: "ipi", characterId: null, name: "Ipi", role: "Keeper of the Nilometer", at: { x: 112, z: -62 }, facing: 90, look: npcLook("tone6", "kilt", "linen", "ochre", "scarf", "staff"), behavior: "work", voiceArchetype: "gruff_guard", greeting: "The river is rising. Can you read the marks?", barks: ["Sixteen cubits, and we eat well.", "Too high, and the villages drown."], persona: "A weathered farmer who reads the river.", topics: [] },
  ],
  quest: {
    goal: { title: "Raise the capstone of the Great Pyramid", description: "Restore the lost inscription and bring it to Hemiunu at the pyramid before dawn.", landmarkId: "great_pyramid" },
    acts: [{ id: "act_1", title: "The river's gift", summary: "Learn how the Nile makes Egypt possible.", encounterIds: ["e1"] }],
  },
  moments: [
    {
      encounterId: "e1",
      anchor: { npcId: null, landmarkId: "great_pyramid" },
      objective: "Bring the restored inscription to the Great Pyramid",
      approach: [{ speaker: "narrator", text: "The capstone glints in the last light." }],
      success: [{ speaker: "narrator", text: "The capstone rises." }],
      reward: { kind: "blessing", name: "Ma'at restored", description: "The world is in balance." },
      opens: null,
    },
  ],
  collectibles: {
    label: "Scarab amulets",
    items: [
      { id: "scarab_1", at: { x: 20, z: -20 }, title: "Scarab of the dawn", fact: "Egyptians linked the scarab beetle to Khepri, the god who rolled the sun across the sky.", conceptId: null },
      { id: "scarab_2", at: { x: -180, z: -40 }, title: "Scarab of the plateau", fact: "The Great Pyramid was the tallest human-made structure on Earth for about 3,800 years.", conceptId: null },
    ],
  },
  spawn: { at: { x: 118, z: 28 }, facing: 239 },
  opening: { caption: "Giza · the Fourth Dynasty · c. 2560 BCE", flyover: ["valley_temple", "sphinx", "great_pyramid"] },
  ui: { hudTheme: "papyrus", accent: "gold" },
  audio: { ambience: "desert" },
};

export const ALPINE_SAMPLE: World3D = {
  ...NILE_SAMPLE,
  seed: 77,
  biome: "alpine",
  setting: { era: "The present day", place: "A glacier valley research camp", style: "modern" },
  terrain: {
    size: 480,
    relief: 0.8,
    features: [
      { kind: "mountain", at: { x: -150, z: -170 }, radius: 170, height: 150 },
      { kind: "mountain", at: { x: 180, z: -140 }, radius: 140, height: 120 },
      { kind: "basin", at: { x: 20, z: 40 }, radius: 110, height: 16 },
    ],
    water: { kind: "lake", level: 2, course: [], width: 10, coast: null },
  },
  atmosphere: { mood: "morning", weather: "clear", fog: 0.2, wind: 0.4 },
  landmarks: [
    { id: "observatory", kind: "observatory", name: "Summit Observatory", at: { x: -90, z: -120 }, rotation: 160, scale: 1, material: "metal", style: "modern", role: "goal", description: "Where the glacier's data comes together." },
    { id: "station", kind: "research_station", name: "Base Camp", at: { x: 90, z: 150 }, rotation: 200, scale: 1, material: "metal", style: "modern", role: "hub", description: "Warm coffee and cold data." },
    { id: "dock", kind: "dock", name: "Sampling Jetty", at: { x: 40, z: 120 }, rotation: 0, scale: 1, material: "wood", style: "modern", role: "poi", description: "Where the lake samples are taken." },
    { id: "cabin", kind: "house", name: "Warden's Cabin", at: { x: 150, z: 60 }, rotation: 250, scale: 1, material: "wood", style: "nordic", role: "poi", description: "The warden logs the snowfall here." },
  ],
  clusters: [{ id: "camp", kind: "camp", at: { x: 120, z: 190 }, radius: 25, count: 5, material: "wood", style: "modern" }],
  scatter: [
    { kind: "conifer", density: 0.7, zone: "lowlands", landmarkId: null },
    { kind: "tall_grass", density: 0.6, zone: "lowlands", landmarkId: null },
    { kind: "flowers", density: 0.4, zone: "lowlands", landmarkId: null },
    { kind: "boulder", density: 0.5, zone: "highlands", landmarkId: null },
  ],
  paths: [
    { from: "spawn", to: "station", style: "dirt" },
    { from: "station", to: "observatory", style: "stone" },
  ],
  wildlife: [
    { kind: "goat", count: 5, zone: "highlands", landmarkId: null },
    { kind: "butterflies", count: 12, zone: "lowlands", landmarkId: null },
  ],
  npcs: [NILE_SAMPLE.npcs[0]].map((n) => ({ ...n, id: "ana", name: "Dr. Ana Ruiz", role: "Glaciologist", at: { x: 80, z: 170 }, look: npcLook("tone3", "coat", "crimson", "charcoal", "cap", "tablet") })),
  quest: {
    goal: { title: "Reach the summit observatory", description: "Carry the lake readings up to the observatory.", landmarkId: "observatory" },
    acts: NILE_SAMPLE.quest.acts,
  },
  moments: [{ ...NILE_SAMPLE.moments[0], anchor: { npcId: null, landmarkId: "observatory" } }],
  collectibles: { label: "Ice cores", items: [] },
  spawn: { at: { x: 150, z: 210 }, facing: 200 },
  opening: { caption: "Glacier valley · today", flyover: ["station", "observatory"] },
  ui: { hudTheme: "glass", accent: "sky" },
  audio: { ambience: "wind" },
};

export const LUNAR_SAMPLE: World3D = {
  ...NILE_SAMPLE,
  seed: 1969,
  biome: "lunar",
  setting: { era: "July 1969", place: "The Sea of Tranquility", style: "futuristic" },
  terrain: {
    size: 420,
    relief: 0.5,
    features: [
      { kind: "crater", at: { x: -80, z: -60 }, radius: 70, height: 18 },
      { kind: "crater", at: { x: 120, z: 90 }, radius: 45, height: 10 },
      { kind: "crater", at: { x: 60, z: -140 }, radius: 30, height: 7 },
      { kind: "hill", at: { x: -160, z: 140 }, radius: 90, height: 20 },
    ],
    water: { kind: "none", level: 0, course: [], width: 10, coast: null },
  },
  atmosphere: { mood: "night", weather: "clear", fog: 0, wind: 0 },
  landmarks: [
    { id: "lander", kind: "research_station", name: "Eagle", at: { x: 0, z: 40 }, rotation: 0, scale: 0.6, material: "gold", style: "futuristic", role: "goal", description: "The lunar module, legs deep in the dust." },
    { id: "flag", kind: "beacon", name: "The Flag", at: { x: 30, z: 70 }, rotation: 0, scale: 0.3, material: "metal", style: "modern", role: "poi", description: "Planted on the first walk." },
  ],
  clusters: [],
  scatter: [
    { kind: "rock", density: 0.8, zone: "everywhere", landmarkId: null },
    { kind: "boulder", density: 0.5, zone: "everywhere", landmarkId: null },
  ],
  paths: [],
  wildlife: [],
  npcs: [NILE_SAMPLE.npcs[0]].map((n) => ({ ...n, id: "buzz", name: "Mission control", role: "CAPCOM", at: { x: 10, z: 70 }, look: npcLook("tone2", "uniform", "linen", "sky", "helmet", "none") })),
  quest: { goal: { title: "Return to the Eagle", description: "Collect the samples and get back to the lander.", landmarkId: "lander" }, acts: NILE_SAMPLE.quest.acts },
  moments: [{ ...NILE_SAMPLE.moments[0], anchor: { npcId: null, landmarkId: "lander" } }],
  collectibles: { label: "Moon rocks", items: [] },
  spawn: { at: { x: 90, z: 150 }, facing: 220 },
  opening: { caption: "Sea of Tranquility · July 1969", flyover: ["lander"] },
  ui: { hudTheme: "tech", accent: "sky" },
  audio: { ambience: "night" },
};

export const SAMPLE_WORLDS: Record<string, World3D> = { nile: NILE_SAMPLE, alpine: ALPINE_SAMPLE, lunar: LUNAR_SAMPLE };

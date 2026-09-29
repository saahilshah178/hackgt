import type { VoiceArchetype } from "../../contracts/common";
import type { Encounter, GameSpec } from "../../contracts/gamespec";
import type { KnowledgeMap } from "../../contracts/knowledge";
import {
  CLOTH_COLORS,
  SKIN_TONES,
  WORLD3D_VERSION,
  type Ambience,
  type ArchStyle,
  type Biome,
  type ClothColor,
  type ClusterKind,
  type Headwear,
  type HeldProp,
  type HudTheme,
  type Landmark,
  type Material,
  type Moment,
  type Npc,
  type NpcBehavior,
  type Outfit,
  type PathStyle,
  type RewardKind,
  type Scatter,
  type SkyMood,
  type StructureKind,
  type TerrainFeature,
  type Weather,
  type Wildlife,
  type World3D,
  type WorldLine,
} from "../../contracts/world3d";
import { buildProgression } from "../../game/runner/progression";
import { BIOMES } from "../../world3d/core/biomes";
import { STRUCTURES, WILDLIFE } from "../../world3d/core/catalog";
import { pick, range, subRng } from "../../world3d/core/prng";
import { pickTeacher } from "../lessons";
import { checkWorld, mapSizeFor, walkBudgetMetres, type WorldCheck } from "./checks";
import { clampSentences, clampText, listWords, shortName, toId } from "./text";

/*
 * The deterministic world composer (docs/design/60 §2.5 step 4): a complete World3D from the GameSpec alone, no LLM.
 * Mock mode always uses it, and the live pipeline falls back to it when the World Architect fails, so a world3d job
 * never fails for lack of a world.
 *
 * The look comes from the subject (the knowledge map's domain when given, else keywords in the title, setting and
 * concepts): an Egyptian desert for pharaohs, a classical grassland for Rome, a wetland for osmosis, a coast with a
 * lighthouse for waves and trigonometry, a capitol on a plain for civics and modern history, and so on. The layout is a
 * route from the spawn (south) to the goal (north, on a low hill, in plain sight): the hub beside the spawn, then one
 * stop per encounter in act order, alternating sides of the route, with a lateral swing sized so the walk fits the
 * game's length. Conversation moments get a character; the other sockets get a fitting landmark; the finale is the
 * goal. Every line comes from the narrative beats and the encounters' prompts (never an answer), collectibles from the
 * student's verified facts. The result is composed and checked; if a check fails, the next attempt flattens the relief,
 * tightens the route and raises the goal, until it passes.
 */

type AnchorSocket = "inscription" | "artifact" | "device" | "vista" | "seal";
type WaterPlan = "river" | "ocean" | "lake" | "none";

interface Look {
  key: string;
  biome: Biome;
  style: ArchStyle;
  mood: SkyMood;
  weather: Weather;
  fog: number;
  wind: number;
  hud: HudTheme;
  accent: ClothColor;
  ambience: Ambience | null;
  era: string;
  material: Material;
  soft: Material;
  water: WaterPlan;
  path: PathStyle;
  goal: { kind: StructureKind; scale: number; material: Material; name: string; description: string };
  hub: { kind: StructureKind; scale: number; name: string; description: string };
  cluster: ClusterKind | null;
  /** a second cluster for texture (fields by the river, a market street, a grove), fractions of the map size */
  extra: { kind: ClusterKind; x: number; z: number } | null;
  /** decorative landmarks off the route (fractions of the map size), for a fuller skyline */
  decor: Decor[];
  /** the short place name on the opening card ("The Nile valley") */
  place: string;
  collect: string;
  /** one collectible ("Scarab amulet") */
  collectOne: string;
  names: string[];
  roles: string[];
  outfits: Outfit[];
  headwear: Headwear[];
  held: HeldProp[];
  kinds: Record<AnchorSocket, StructureKind[]>;
  /** decorative terrain, kept off the spawn → goal corridor (S = map size) */
  features: (S: number) => TerrainFeature[];
}

interface Decor {
  kind: StructureKind;
  x: number;
  z: number;
  scale: number;
  name: string;
  description: string;
}

const ANCIENT: Look["kinds"] = { inscription: ["obelisk", "tomb", "monolith"], artifact: ["workshop", "market_stall", "shrine"], device: ["well", "workshop", "windmill"], vista: ["tower"], seal: ["gate", "tomb"] };
const CLASSICAL: Look["kinds"] = { inscription: ["monolith", "library", "tomb"], artifact: ["market_stall", "shrine", "workshop"], device: ["well", "windmill", "observatory"], vista: ["tower"], seal: ["gate"] };
const MODERN: Look["kinds"] = { inscription: ["monolith", "library"], artifact: ["workshop", "market_stall", "shrine"], device: ["observatory", "windmill", "well"], vista: ["tower"], seal: ["gate"] };
const RUSTIC: Look["kinds"] = { inscription: ["monolith", "tomb"], artifact: ["workshop", "market_stall", "shrine"], device: ["windmill", "well", "workshop"], vista: ["tower"], seal: ["gate", "tomb"] };

const feature = (kind: TerrainFeature["kind"], x: number, z: number, radius: number, height: number): TerrainFeature => ({
  kind,
  at: { x: Math.round(x), z: Math.round(z) },
  radius: Math.round(Math.max(8, radius)),
  height: Math.round(height),
});

const LOOKS: Record<string, Look> = {
  egypt: {
    key: "egypt",
    biome: "desert",
    style: "ancient_egypt",
    mood: "golden_hour",
    weather: "haze",
    fog: 0.3,
    wind: 0.3,
    hud: "papyrus",
    accent: "gold",
    ambience: null,
    era: "Ancient Egypt",
    material: "limestone",
    soft: "adobe",
    water: "river",
    path: "stone",
    goal: { kind: "pyramid", scale: 1, material: "limestone", name: "The Great Pyramid", description: "A mountain of polished limestone, its capstone catching the last of the sun. Everything here leads to it." },
    hub: { kind: "temple", scale: 0.7, name: "The Valley Temple", description: "Where the causeway begins and every journey to the pyramid starts." },
    cluster: "village",
    extra: { kind: "farmland", x: 0.24, z: -0.1 },
    decor: [
      { kind: "sphinx", x: -0.2, z: 0.1, scale: 0.8, name: "The Sphinx", description: "A lion's body with a king's face, carved from the bedrock, watching the sunrise." },
      { kind: "obelisk", x: 0.2, z: 0.14, scale: 1, name: "The Sun Needle", description: "A granite needle carved with the king's names." },
      { kind: "pyramid", x: -0.22, z: -0.2, scale: 0.45, name: "The Queen's Pyramid", description: "A smaller pyramid for a royal wife." },
    ],
    place: "The Nile valley",
    collect: "Scarab amulets",
    collectOne: "Scarab amulet",
    names: ["Nebet", "Ipi", "Merit", "Kha", "Tiye", "Senu", "Hori", "Nefer", "Paser", "Baki"],
    roles: ["Scribe", "Farmer", "Stonemason", "Priestess", "Potter", "Fisher", "Overseer", "Baker"],
    outfits: ["kilt", "dress", "robe", "tunic"],
    headwear: ["headdress", "scarf", "none", "wide_hat"],
    held: ["scroll", "tool", "basket", "staff", "tablet"],
    kinds: ANCIENT,
    features: (S) => [feature("dunes", -0.36 * S, -0.02 * S, 0.12 * S, 6), feature("ridge", -0.36 * S, -0.38 * S, 0.1 * S, 12)],
  },
  classical: {
    key: "classical",
    biome: "grassland",
    style: "classical",
    mood: "morning",
    weather: "clear",
    fog: 0.2,
    wind: 0.3,
    hud: "parchment",
    accent: "crimson",
    ambience: null,
    era: "Classical antiquity",
    material: "marble",
    soft: "brick",
    water: "none",
    path: "stone",
    goal: { kind: "temple", scale: 1.5, material: "marble", name: "The Temple on the Hill", description: "White marble columns on the high ground, visible from every road. The journey ends on its steps." },
    hub: { kind: "colonnade", scale: 0.9, name: "The Agora", description: "The market square where everyone meets, argues and trades news." },
    cluster: "village",
    extra: { kind: "market", x: 0.22, z: 0.04 },
    decor: [
      { kind: "statue", x: 0.19, z: 0.2, scale: 1.2, name: "The Founder's Statue", description: "The city's founder in bronze, one hand raised toward the temple." },
      { kind: "amphitheater", x: -0.24, z: -0.14, scale: 0.8, name: "The Theatre", description: "Stone seats in a half circle, where plays and speeches draw the whole city." },
    ],
    place: "The old city",
    collect: "Old coins",
    collectOne: "Old coin",
    names: ["Lydia", "Nikos", "Iris", "Theon", "Daphne", "Leon", "Cassia", "Timon", "Phoebe"],
    roles: ["Philosopher", "Merchant", "Sculptor", "Scribe", "Olive farmer", "Magistrate", "Potter"],
    outfits: ["toga", "tunic", "robe", "dress"],
    headwear: ["wreath", "none", "hood"],
    held: ["scroll", "book", "basket", "staff", "tablet"],
    kinds: CLASSICAL,
    features: (S) => [feature("hill", -0.38 * S, 0.02 * S, 0.12 * S, 12), feature("hill", 0.36 * S, -0.1 * S, 0.1 * S, 10)],
  },
  medieval: {
    key: "medieval",
    biome: "grassland",
    style: "medieval",
    mood: "morning",
    weather: "mist",
    fog: 0.35,
    wind: 0.4,
    hud: "parchment",
    accent: "indigo",
    ambience: null,
    era: "The Middle Ages",
    material: "granite",
    soft: "wood",
    water: "river",
    path: "dirt",
    goal: { kind: "keep", scale: 1.4, material: "granite", name: "The Old Keep", description: "A grey stone keep on the rise, banners snapping on its turrets. The road ends at its gate." },
    hub: { kind: "house", scale: 1.5, name: "The Crossroads Inn", description: "Warm fire, loud stories, and the first person who can point you the right way." },
    cluster: "village",
    extra: { kind: "farmland", x: 0.22, z: 0.12 },
    decor: [
      { kind: "windmill", x: -0.22, z: 0.16, scale: 1, name: "The Mill", description: "Its sails turn all day, grinding the valley's grain." },
      { kind: "stone_circle", x: -0.2, z: -0.16, scale: 0.9, name: "The Standing Ring", description: "Stones older than the keep itself. Nobody agrees who raised them." },
    ],
    place: "The valley",
    collect: "Wax seals",
    collectOne: "Wax seal",
    names: ["Aldric", "Maud", "Edwin", "Rowan", "Agnes", "Hugh", "Elspeth", "Wat", "Isolde"],
    roles: ["Blacksmith", "Herbalist", "Monk", "Miller", "Guard", "Weaver", "Scribe"],
    outfits: ["tunic", "cloak", "work_clothes", "dress", "robe"],
    headwear: ["hood", "cap", "none", "scarf"],
    held: ["tool", "book", "lantern", "staff", "basket"],
    kinds: RUSTIC,
    features: (S) => [feature("hill", -0.38 * S, 0.02 * S, 0.12 * S, 12), feature("ridge", -0.34 * S, -0.38 * S, 0.1 * S, 14)],
  },
  civic: {
    key: "civic",
    biome: "grassland",
    style: "classical",
    mood: "morning",
    weather: "clear",
    fog: 0.15,
    wind: 0.25,
    hud: "parchment",
    accent: "indigo",
    ambience: "city",
    era: "The twentieth century",
    material: "marble",
    soft: "brick",
    water: "none",
    path: "stone",
    goal: { kind: "palace", scale: 1.1, material: "marble", name: "The Capitol", description: "A domed hall of white stone at the top of the long avenue, where laws are argued and made." },
    hub: { kind: "library", scale: 0.9, name: "The Town Library", description: "Newspapers, letters and records: where every question in town starts." },
    cluster: "village",
    extra: { kind: "market", x: 0.22, z: 0.02 },
    decor: [
      { kind: "statue", x: 0.19, z: 0.2, scale: 1.1, name: "The Memorial", description: "A bronze figure on a granite plinth, names carved around its base." },
      { kind: "amphitheater", x: -0.22, z: -0.12, scale: 0.7, name: "The Open-Air Stage", description: "Stone steps around a stage where the town gathers for speeches and songs." },
    ],
    place: "The capital",
    collect: "Press clippings",
    collectOne: "Press clipping",
    names: ["Ada", "Marcus", "June", "Otis", "Clara", "Henry", "Mae", "Louis", "Hattie"],
    roles: ["Librarian", "Reporter", "Teacher", "Lawyer", "Organizer", "Shopkeeper", "Student"],
    outfits: ["coat", "dress", "work_clothes", "uniform"],
    headwear: ["cap", "wide_hat", "none", "scarf"],
    held: ["book", "scroll", "none", "tablet", "basket"],
    kinds: CLASSICAL,
    features: (S) => [feature("hill", -0.38 * S, 0.02 * S, 0.12 * S, 10), feature("hill", 0.37 * S, -0.12 * S, 0.1 * S, 8)],
  },
  tropical: {
    key: "tropical",
    biome: "tropical",
    style: "modern",
    mood: "morning",
    weather: "haze",
    fog: 0.3,
    wind: 0.5,
    hud: "glass",
    accent: "emerald",
    ambience: null,
    era: "The present day",
    material: "wood",
    soft: "thatch",
    water: "ocean",
    path: "sand",
    goal: { kind: "research_station", scale: 2.3, material: "metal", name: "The Field Station", description: "The island's research station, antennas humming. Every sample and every answer ends up here." },
    hub: { kind: "greenhouse", scale: 1, name: "The Greenhouse", description: "Warm, damp and green: where the island's living things are studied up close." },
    cluster: "camp",
    extra: { kind: "grove", x: -0.2, z: -0.1 },
    decor: [
      { kind: "hut", x: -0.2, z: 0.06, scale: 1.2, name: "The Old Hut", description: "A thatched hut where the first researchers slept." },
      { kind: "campfire", x: -0.17, z: 0.17, scale: 1.2, name: "The Beach Fire", description: "Where the team swaps stories after dark." },
    ],
    place: "The island",
    collect: "Specimen cards",
    collectOne: "Specimen card",
    names: ["Amara", "Leilani", "Tomas", "Priya", "Kai", "Marisol", "Ren", "Nia", "Iko"],
    roles: ["Biologist", "Botanist", "Lab tech", "Diver", "Ranger", "Student"],
    outfits: ["lab_coat", "work_clothes", "coat", "dress"],
    headwear: ["wide_hat", "cap", "none"],
    held: ["tablet", "book", "basket", "tool", "none"],
    kinds: MODERN,
    features: (S) => [feature("hill", -0.36 * S, -0.3 * S, 0.14 * S, 16), feature("hill", -0.38 * S, 0.22 * S, 0.1 * S, 9)],
  },
  wetland: {
    key: "wetland",
    biome: "wetland",
    style: "rustic",
    mood: "morning",
    weather: "mist",
    fog: 0.4,
    wind: 0.2,
    hud: "wood",
    accent: "olive",
    ambience: null,
    era: "The present day",
    material: "wood",
    soft: "thatch",
    water: "lake",
    path: "boardwalk",
    goal: { kind: "tower", scale: 1.5, material: "wood", name: "The Heron Tower", description: "A tall timber lookout over the marsh. From the top, the whole wetland makes sense." },
    hub: { kind: "research_station", scale: 1, name: "The Marsh Station", description: "A small station on stilts where the marsh's water and life are measured every day." },
    cluster: "camp",
    extra: { kind: "grove", x: 0.2, z: -0.1 },
    decor: [
      { kind: "hut", x: 0.2, z: 0.15, scale: 1.2, name: "The Reed Hut", description: "A hut of reeds and mud where the warden keeps spare boots." },
      { kind: "dock", x: -0.2, z: 0.02, scale: 1, name: "The Jetty", description: "A short jetty over the pond, for dipping nets and sample jars." },
    ],
    place: "The marsh",
    collect: "Field notes",
    collectOne: "Field note",
    names: ["Wren", "Otto", "Fern", "Bram", "Ivy", "Linnea", "Reed", "Hazel", "Tobin"],
    roles: ["Ecologist", "Water tester", "Birder", "Warden", "Student", "Microscopist"],
    outfits: ["work_clothes", "coat", "lab_coat"],
    headwear: ["wide_hat", "cap", "hood", "none"],
    held: ["tablet", "book", "tool", "lantern", "none"],
    kinds: RUSTIC,
    features: (S) => [feature("basin", -0.32 * S, 0.02 * S, 0.12 * S, 8), feature("hill", 0.36 * S, -0.32 * S, 0.1 * S, 6)],
  },
  volcanic: {
    key: "volcanic",
    biome: "volcanic",
    style: "modern",
    mood: "dusk",
    weather: "ash",
    fog: 0.4,
    wind: 0.35,
    hud: "stone",
    accent: "terracotta",
    ambience: null,
    era: "The present day",
    material: "basalt",
    soft: "metal",
    water: "none",
    path: "dirt",
    goal: { kind: "observatory", scale: 1.8, material: "metal", name: "The Volcano Observatory", description: "Instruments on the high ground listen to the mountain breathe. The last readings are needed here." },
    hub: { kind: "research_station", scale: 1, name: "Base Camp", description: "Hot coffee, cold rock samples and the day's plan pinned to the wall." },
    cluster: "camp",
    extra: { kind: "quarry", x: -0.24, z: -0.3 },
    decor: [
      { kind: "ruins", x: -0.22, z: -0.1, scale: 1, name: "The Buried Village", description: "Walls half swallowed by an old lava flow." },
      { kind: "beacon", x: 0.18, z: 0.12, scale: 1, name: "The Warning Beacon", description: "It lights when the mountain stirs." },
    ],
    place: "The volcano",
    collect: "Rock samples",
    collectOne: "Rock sample",
    names: ["Ines", "Koa", "Mara", "Teo", "Sefa", "Rhea", "Bo", "Dara", "Luka"],
    roles: ["Volcanologist", "Geologist", "Pilot", "Seismologist", "Ranger", "Student"],
    outfits: ["work_clothes", "coat", "lab_coat", "uniform"],
    headwear: ["hard_hat", "cap", "none"],
    held: ["tool", "tablet", "none", "lantern"],
    kinds: MODERN,
    features: (S) => [feature("volcano", 0.33 * S, -0.37 * S, 0.16 * S, 50), feature("hill", -0.37 * S, 0.2 * S, 0.1 * S, 10)],
  },
  lunar: {
    key: "lunar",
    biome: "lunar",
    style: "futuristic",
    mood: "night",
    weather: "clear",
    fog: 0,
    wind: 0,
    hud: "tech",
    accent: "sky",
    ambience: null,
    era: "The near future",
    material: "metal",
    soft: "glass",
    water: "none",
    path: "dirt",
    goal: { kind: "research_station", scale: 2.3, material: "gold", name: "Tranquility Base", description: "The main base, lights blinking against the black sky. The mission ends at its airlock." },
    hub: { kind: "greenhouse", scale: 1, name: "The Hab Garden", description: "A glass dome of green in the grey dust, where the crew meets." },
    cluster: null,
    extra: null,
    decor: [
      { kind: "beacon", x: -0.18, z: 0.12, scale: 1, name: "The Relay Mast", description: "It carries every word back to Earth." },
      { kind: "observatory", x: 0.2, z: -0.1, scale: 0.8, name: "The Radio Dish", description: "Listening to the sky with no air in the way." },
    ],
    place: "The Moon",
    collect: "Moon rocks",
    collectOne: "Moon rock",
    names: ["Vega", "Ito", "Nadia", "Sol", "Rook", "Ada", "Zane", "Mira", "Juno"],
    roles: ["Commander", "Engineer", "Geologist", "Medic", "Pilot", "Botanist"],
    outfits: ["uniform"],
    headwear: ["helmet"],
    held: ["tablet", "tool", "none", "lantern"],
    kinds: MODERN,
    features: (S) => [feature("crater", -0.3 * S, -0.12 * S, 0.09 * S, 10), feature("crater", 0.3 * S, 0.15 * S, 0.08 * S, 8), feature("crater", 0.32 * S, -0.34 * S, 0.06 * S, 6)],
  },
  alpine: {
    key: "alpine",
    biome: "alpine",
    style: "modern",
    mood: "morning",
    weather: "clear",
    fog: 0.2,
    wind: 0.45,
    hud: "glass",
    accent: "sky",
    ambience: null,
    era: "The present day",
    material: "metal",
    soft: "wood",
    water: "lake",
    path: "dirt",
    goal: { kind: "observatory", scale: 1.8, material: "metal", name: "The Summit Observatory", description: "A white dome on the high ground where every measurement comes together." },
    hub: { kind: "research_station", scale: 1, name: "Base Camp", description: "Warm coffee, cold data and a map of the valley on the wall." },
    cluster: "camp",
    extra: { kind: "grove", x: -0.2, z: -0.08 },
    decor: [
      { kind: "house", x: -0.22, z: 0.12, scale: 1.2, name: "The Warden's Cabin", description: "The warden logs the snowfall here every morning." },
      { kind: "windmill", x: 0.18, z: -0.05, scale: 1, name: "The Wind Turbine", description: "It keeps the station's lights on through the night." },
    ],
    place: "The glacier valley",
    collect: "Ice cores",
    collectOne: "Ice core",
    names: ["Ana", "Sven", "Kiri", "Jonas", "Elin", "Tarek", "Noor", "Pim", "Astrid"],
    roles: ["Glaciologist", "Engineer", "Mountain guide", "Physicist", "Student", "Meteorologist"],
    outfits: ["coat", "work_clothes", "lab_coat"],
    headwear: ["cap", "hood", "none", "scarf"],
    held: ["tablet", "tool", "book", "none"],
    kinds: MODERN,
    features: (S) => [feature("mountain", -0.38 * S, -0.43 * S, 0.19 * S, 70), feature("mountain", 0.4 * S, -0.4 * S, 0.17 * S, 60), feature("basin", 0.32 * S, 0.2 * S, 0.1 * S, 10)],
  },
  coast: {
    key: "coast",
    biome: "coast",
    style: "modern",
    mood: "morning",
    weather: "clear",
    fog: 0.2,
    wind: 0.5,
    hud: "glass",
    accent: "teal",
    ambience: null,
    era: "The present day",
    material: "granite",
    soft: "wood",
    water: "ocean",
    path: "grass",
    goal: { kind: "lighthouse", scale: 1.4, material: "granite", name: "The Lighthouse", description: "A tall white tower on the headland. Its lamp has gone dark, and only you can bring it back." },
    hub: { kind: "house", scale: 1.5, name: "The Keeper's House", description: "Charts on the walls, tide tables on the desk and a kettle always on." },
    cluster: "village",
    extra: null,
    decor: [
      { kind: "windmill", x: -0.2, z: 0.05, scale: 1, name: "The Old Windmill", description: "Its sails creak in the sea wind." },
      { kind: "house", x: -0.18, z: -0.12, scale: 1.2, name: "The Coastguard Hut", description: "Binoculars, a radio and a logbook of every ship that passes." },
    ],
    place: "The headland",
    collect: "Sea glass",
    collectOne: "Sea glass",
    names: ["Marin", "Cole", "Isla", "Finn", "Nora", "Wade", "Coral", "Skye", "Rafe"],
    roles: ["Harbour master", "Surveyor", "Fisher", "Engineer", "Sailor", "Student"],
    outfits: ["coat", "work_clothes", "tunic", "dress"],
    headwear: ["cap", "wide_hat", "scarf", "none"],
    held: ["tool", "lantern", "book", "tablet", "none"],
    kinds: { ...MODERN, vista: ["tower"] },
    features: (S) => [feature("hill", -0.36 * S, -0.25 * S, 0.13 * S, 14), feature("hill", -0.38 * S, 0.25 * S, 0.1 * S, 8)],
  },
  rustic: {
    key: "rustic",
    biome: "grassland",
    style: "rustic",
    mood: "morning",
    weather: "clear",
    fog: 0.2,
    wind: 0.35,
    hud: "wood",
    accent: "emerald",
    ambience: null,
    era: "Long ago",
    material: "wood",
    soft: "thatch",
    water: "river",
    path: "dirt",
    goal: { kind: "tower", scale: 1.5, material: "granite", name: "The Old Watchtower", description: "A stone tower on the hill, seen for miles. Whatever this place is hiding, the answer waits at the top." },
    hub: { kind: "windmill", scale: 1.1, name: "The Mill", description: "The heart of the village, sails turning in the wind." },
    cluster: "village",
    extra: { kind: "farmland", x: 0.22, z: 0.1 },
    decor: [
      { kind: "stone_circle", x: -0.2, z: -0.14, scale: 0.9, name: "The Stone Ring", description: "Old stones in a ring on the hillside; the children say they hum at night." },
      { kind: "well", x: -0.16, z: 0.14, scale: 1.5, name: "The Wishing Well", description: "Everyone drops a pebble and makes a wish." },
    ],
    place: "The village",
    collect: "Lucky stones",
    collectOne: "Lucky stone",
    names: ["Tam", "Bess", "Olin", "Rue", "Hollis", "Wynn", "Maple", "Jory", "Pell"],
    roles: ["Miller", "Shepherd", "Beekeeper", "Carpenter", "Teacher", "Traveller"],
    outfits: ["work_clothes", "tunic", "dress", "cloak"],
    headwear: ["wide_hat", "cap", "scarf", "none"],
    held: ["tool", "basket", "staff", "book", "none"],
    kinds: RUSTIC,
    features: (S) => [feature("hill", -0.38 * S, 0.02 * S, 0.12 * S, 12), feature("ridge", -0.34 * S, -0.38 * S, 0.1 * S, 14)],
  },
};

/** Which look fits the subject: the knowledge map's domain when known, then keywords (docs/design/60 §2.5 step 4). */
export function chooseLook(domain: string | null, text: string): Look {
  const t = text.toLowerCase();
  const has = (re: RegExp) => re.test(t);
  const egypt = /egypt|pharaoh|\bnile\b|pyramid|mummif|hieroglyph/;
  const classical = /\bgreek|greece|\brome\b|roman|athen|sparta|classical|antiquity|\bancient\b/;
  const medieval = /medieval|castle|knight|feudal|middle ages|viking/;
  if (domain === null) {
    if (has(egypt)) return LOOKS.egypt;
    if (has(classical)) return LOOKS.classical;
    if (has(medieval)) return LOOKS.medieval;
  }
  switch (domain) {
    case "history":
    case "civics":
    case "law":
    case "economics":
    case "literature":
    case "philosophy":
      if (has(egypt)) return LOOKS.egypt;
      if (has(classical)) return LOOKS.classical;
      if (has(medieval)) return LOOKS.medieval;
      return LOOKS.civic;
    case "biology":
    case "health":
      if (has(/wetland|marsh|swamp|pond|osmosis|diffusion|water|frog|amphib|river/)) return LOOKS.wetland;
      return LOOKS.tropical;
    case "earth_space":
    case "geography":
    case "chemistry":
      if (has(/volcan|lava|magma|tecton|earthquake|igneous|rock cycle/)) return LOOKS.volcanic;
      if (has(/\bmoon\b|lunar|space|planet|solar|orbit|\bstars?\b|astronom|galax|apollo/)) return LOOKS.lunar;
      return LOOKS.alpine;
    case "physics":
    case "math":
    case "engineering":
    case "cs":
      if (has(/wave|\bsine\b|cosine|trig|oscillat|\btides?\b|\blight\b|optic|sound|period|amplitude/)) return LOOKS.coast;
      return { ...LOOKS.alpine, style: "futuristic", collect: "Field notes" };
    default:
      if (has(/wave|\bsine\b|trig|oscillat/)) return LOOKS.coast;
      if (has(/volcan|lava/)) return LOOKS.volcanic;
      if (has(/\bmoon\b|lunar|planet|orbit/)) return LOOKS.lunar;
      if (has(/cell|biolog|organism|ecosystem/)) return LOOKS.tropical;
      return LOOKS.rustic;
  }
}

// ---------------------------------------------------------------- layout

interface Tuning {
  relief: number;
  /** multiplier on the route's sideways swing */
  lateral: number;
  goalHill: number;
  goalScale: number;
  water: boolean;
  features: boolean;
}

/** Each failed check makes the next attempt plainer: flatter, tighter, a bigger goal, finally no water or features. */
const ATTEMPTS: Tuning[] = [
  { relief: 0.25, lateral: 1, goalHill: 8, goalScale: 1, water: true, features: true },
  { relief: 0.15, lateral: 0.8, goalHill: 12, goalScale: 1.2, water: true, features: true },
  { relief: 0.08, lateral: 0.6, goalHill: 14, goalScale: 1.35, water: true, features: false },
  { relief: 0, lateral: 0.5, goalHill: 16, goalScale: 1.5, water: false, features: false },
];

const MIN_SWING = 14;
const deg = (r: number) => Math.round(((((r * 180) / Math.PI) % 360) + 360) % 360);
const yawToward = (from: { x: number; z: number }, to: { x: number; z: number }) => deg(Math.atan2(to.x - from.x, to.z - from.z));
const r1 = (v: number) => Math.round(v * 10) / 10;

interface Route {
  spawn: { x: number; z: number };
  goal: { x: number; z: number; scale: number; radius: number };
  slots: { x: number; z: number; side: number }[];
  swing: number;
}

/** The spawn → goal route with one slot per non-finale moment, its swing sized to the walking budget. */
function planRoute(S: number, minutes: number, n: number, look: Look, tuning: Tuning): Route {
  const half = S / 2;
  const spawn = { x: 0, z: r1(0.36 * S) };
  const info = STRUCTURES[look.goal.kind];
  const sizeFactor = info.radius >= 20 ? Math.min(1.2, Math.max(0.8, S / 560)) : 1;
  let scale = Math.min(4, look.goal.scale * sizeFactor * tuning.goalScale);
  scale = Math.min(scale, (0.2 * S) / info.radius);
  const radius = info.radius * scale;
  const budget = walkBudgetMetres(minutes) * 0.72;
  const zStart = spawn.z - 0.1 * S;
  const lead = 0.06 * S + 10;

  const tour = (goalZ: number, a: number) => {
    const zEnd = goalZ + radius + lead;
    const dz = n > 1 ? (zStart - zEnd) / (n - 1) : 0;
    const first = Math.hypot(a, spawn.z - zStart);
    const between = n > 1 ? (n - 1) * Math.hypot(dz, 2 * a) : 0;
    const last = Math.hypot(a, zEnd - goalZ);
    return first + between + last;
  };
  let goalZ = Math.max(-0.3 * S, -half + radius + 10);
  const aMax = Math.max(MIN_SWING, 0.1 * S * tuning.lateral);
  // the goal stays at least 0.3 S from the spawn (the checks warn below 0.18 S)
  while (tour(goalZ, MIN_SWING) > budget && spawn.z - goalZ > 0.3 * S + radius) goalZ += 0.03 * S;
  let a = aMax;
  while (a > MIN_SWING && tour(goalZ, a) > budget) a -= 2;
  a = Math.max(MIN_SWING, a);

  const zEnd = goalZ + radius + lead;
  const slots = Array.from({ length: n }, (_, k) => {
    const t = n > 1 ? k / (n - 1) : 0.5;
    const side = k % 2 === 0 ? -1 : 1;
    return { x: r1(side * a), z: r1(zStart + (zEnd - zStart) * t), side };
  });
  return { spawn, goal: { x: 0, z: r1(goalZ), scale: Math.round(scale * 100) / 100, radius }, slots, swing: a };
}

// ---------------------------------------------------------------- story order

/** 2-4 acts from the unlock graph's depth tiers (so no act asks for something a later act teaches); the finale ends the last. */
function planActs(spec: GameSpec): { ids: string[]; title: string; summary: string }[] {
  const p = buildProgression(spec);
  const regular = p.nodes.filter((n) => !n.isBoss).sort((a, b) => a.depth - b.depth || a.index - b.index);
  const total = spec.encounters.length;
  const k = Math.max(1, Math.min(total <= 4 ? 2 : total <= 8 ? 3 : 4, regular.length));
  const chunks: string[][] = Array.from({ length: k }, () => []);
  regular.forEach((node, i) => chunks[Math.min(k - 1, Math.floor((i * k) / regular.length))].push(node.id));
  if (p.bossId) chunks[k - 1].push(p.bossId);
  const conceptName = new Map(spec.concepts.map((c) => [c.id, shortName(c.name, 60)]));
  const unitName = new Map(spec.units.map((u) => [u.id, u.name]));
  const unitOf = new Map(spec.concepts.map((c) => [c.id, c.unitId]));
  const used = new Set<string>();
  return chunks.map((ids, i) => {
    const encounters = ids.map((id) => spec.encounters.find((e) => e.id === id)!);
    const concepts = [...new Set(encounters.flatMap((e) => e.conceptIds))];
    const units = concepts.map((c) => unitOf.get(c)).filter((u): u is string => !!u);
    const top = mostCommon(units);
    const unit = top ? unitName.get(top) : undefined;
    const last = i === chunks.length - 1;
    let title = unit && !used.has(unit) ? unit : last ? "The final step" : `Part ${["I", "II", "III", "IV"][i]}`;
    used.add(title);
    title = clampText(title, 40);
    const names = listWords(concepts.slice(0, 4).map((c) => conceptName.get(c) ?? c));
    const summary = clampText(last ? `Bring it all together: ${names}.` : i === 0 ? `Get your bearings and learn ${names}.` : `Go deeper: ${names}.`, 160);
    return { ids, title, summary };
  });
}

function mostCommon(items: readonly string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const x of items) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
}

// ---------------------------------------------------------------- characters and lines

const VOICE: Record<VoiceArchetype, string> = {
  narrator: "Speaks like a calm storyteller, unhurried and vivid.",
  wise_mentor: "Speaks calmly and patiently, in short, wise sentences, and asks good questions.",
  gruff_guard: "Blunt and gruff, few words, but fair and secretly proud of anyone who tries.",
  cheerful_sidekick: "Upbeat and chatty, quick to encourage and to crack a small joke.",
  sly_villain: "Smooth and teasing, loves a challenge and never gives anything away.",
  nervous_scholar: "Precise and a little flustered, loves details and gets excited about evidence.",
};

const BARKS: Record<VoiceArchetype, string[]> = {
  narrator: ["The wind carries old stories here.", "Every stone here remembers something."],
  wise_mentor: ["Patience. Understanding takes a moment.", "Look closely; the details matter."],
  gruff_guard: ["Keep to the path.", "No shortcuts here."],
  cheerful_sidekick: ["What a day to learn something new!", "I bet you'll figure it out."],
  sly_villain: ["Clever isn't the same as right.", "Tick, tock."],
  nervous_scholar: ["Where did I put that note…", "Facts first, guesses later."],
};

function greetingFor(v: VoiceArchetype, topic: string | null, goalName: string): string {
  if (!topic) return `You made it this far. The last step waits at ${embed(goalName)}.`;
  switch (v) {
    case "wise_mentor":
      return `Welcome. Sit a moment; ${topic} is worth understanding properly.`;
    case "cheerful_sidekick":
      return `Oh, hello! Have you come about ${topic}? I love this part.`;
    case "gruff_guard":
      return `Hm. Another one asking about ${topic}. Let's see what you've got.`;
    case "nervous_scholar":
      return `Ah! Careful with the notes. You're here about ${topic}, yes?`;
    case "sly_villain":
      return `So you think you understand ${topic}? We'll see.`;
    default:
      return `Every place here has a story. Mine is about ${topic}.`;
  }
}

/** "The Great Pyramid" → "the Great Pyramid" inside a sentence. */
function embed(name: string): string {
  return name.replace(/^The /, "the ");
}

function firstName(name: string): string {
  return name.split(/\s+/).find((w) => !w.endsWith(".")) ?? name;
}

const SCENE: Record<AnchorSocket | "finale", (place: string) => string> = {
  inscription: (p) => `Worn carvings cover ${embed(p)}. Someone left a message here.`,
  artifact: (p) => `Objects lie waiting at ${embed(p)}, each with a story to tell.`,
  device: (p) => `The mechanism at ${embed(p)} creaks, waiting for a steady hand.`,
  vista: (p) => `From ${embed(p)} the whole land opens up below you.`,
  seal: (p) => `${p} is sealed tight. There must be a way through.`,
  finale: (p) => `${p} towers above you. This is where the journey ends.`,
};

const SUCCESS: Record<AnchorSocket | "finale", (place: string) => string> = {
  inscription: () => "The carving's meaning comes clear, and the stone seems to glow.",
  artifact: () => "Everything clicks into place. The finds make sense at last.",
  device: () => "The mechanism hums to life, steady and true.",
  vista: () => "The route ahead unfolds below you, clear as a map.",
  seal: (p) => `With a deep rumble, ${embed(p)} swings open.`,
  finale: (p) => `Light pours from ${embed(p)}. You did it.`,
};

const CHEER: Record<VoiceArchetype, string> = {
  narrator: "The answer settles into place, and the story moves on.",
  wise_mentor: "Exactly. You reasoned that through yourself, and that is what matters.",
  gruff_guard: "Hm. Not bad. Not bad at all.",
  cheerful_sidekick: "Yes! I knew you'd get it! On to the next one!",
  sly_villain: "Well played. I'll admit it, you're sharper than you look.",
  nervous_scholar: "Oh! Yes, yes, that's it! The evidence agrees!",
};

const REWARDS: Record<AnchorSocket | "finale", { kind: RewardKind; name: string }> = {
  inscription: { kind: "map_fragment", name: "Map fragment" },
  artifact: { kind: "relic", name: "Found relic" },
  device: { kind: "tool", name: "Tuned instrument" },
  vista: { kind: "map_fragment", name: "Lookout map" },
  seal: { kind: "key", name: "Gate key" },
  finale: { kind: "blessing", name: "The final prize" },
};

const DESCRIBE: Record<AnchorSocket, (topic: string) => string> = {
  inscription: (t) => `Carvings cover every face, recording what people here knew about ${t}.`,
  artifact: (t) => `Objects connected to ${t} are gathered here, waiting to be examined.`,
  device: (t) => `A working mechanism the locals rely on; running it right takes ${t}.`,
  vista: (t) => `A lookout with a view over the whole land, and of how ${t} fits together.`,
  seal: (t) => `Sealed shut. It opens only for someone who truly understands ${t}.`,
};

const OBJECTIVE: Record<AnchorSocket | "finale", (place: string) => string> = {
  inscription: (p) => `Read the carvings at ${embed(p)}`,
  artifact: (p) => `Examine the finds at ${embed(p)}`,
  device: (p) => `Work the mechanism at ${embed(p)}`,
  vista: (p) => `Survey the land from ${embed(p)}`,
  seal: (p) => `Open ${embed(p)}`,
  finale: (p) => `Reach ${embed(p)} and finish the quest`,
};

const NAME_WORDS = ["Old", "High", "Sun", "Quiet", "Twin", "Far", "Low", "Hidden", "Great", "Little", "North", "East"];
const KIND_LABEL: Partial<Record<StructureKind, string>> = { market_stall: "Market Stall", monolith: "Standing Stone", well: "Well", tomb: "Tomb", gate: "Gate" };

function socketOf(e: Encounter): AnchorSocket | "conversation" | "finale" {
  if (e.role === "boss") return "finale";
  if (e.socket === "inscription" || e.socket === "artifact" || e.socket === "device" || e.socket === "vista" || e.socket === "seal") return e.socket;
  return "conversation";
}

// ---------------------------------------------------------------- the composer

export interface FallbackResult {
  world: World3D;
  check: WorldCheck;
  attempts: number;
}

/** A deterministic, checked world for a world3d GameSpec (see the file comment). */
export function composeFallbackWorld(spec: GameSpec, km?: KnowledgeMap): World3D {
  return composeFallbackDetailed(spec, km).world;
}

/** The same, with the final check and the number of attempts it took. */
export function composeFallbackDetailed(spec: GameSpec, km?: KnowledgeMap): FallbackResult {
  const text = [km?.subject.topic, km?.title, spec.title, spec.theme.setting, spec.premise, spec.source.title, ...spec.concepts.map((c) => c.name)].join(" ");
  const look = chooseLook(km?.subject.domain ?? null, text);
  let best: FallbackResult | null = null;
  for (let i = 0; i < ATTEMPTS.length; i++) {
    const draft = buildWorld(spec, km, look, ATTEMPTS[i]);
    const check = checkWorld(spec, draft);
    const world: World3D = { ...check.world, provenance: { source: "composer", model: null, reviews: [], fixes: check.composed.fixes } };
    const result = { world, check, attempts: i + 1 };
    if (check.issues.length === 0) return result;
    if (!best || check.issues.length < best.check.issues.length) best = result;
  }
  return best!;
}

function buildWorld(spec: GameSpec, km: KnowledgeMap | undefined, look: Look, tuning: Tuning): World3D {
  const S = mapSizeFor(spec.targetMinutes);
  const half = S / 2;
  const seed = spec.seed;
  const acts = planActs(spec);
  const order = acts.flatMap((a) => a.ids);
  const byId = new Map(spec.encounters.map((e) => [e.id, e]));
  const boss = spec.encounters.find((e) => e.role === "boss") ?? null;
  const routeIds = order.filter((id) => id !== boss?.id);
  const route = planRoute(S, spec.targetMinutes, routeIds.length, look, tuning);
  const conceptById = new Map(spec.concepts.map((c) => [c.id, c]));
  const topicOf = (e: Encounter) => shortName(conceptById.get(e.conceptIds[0])?.name ?? e.conceptIds[0], 60);
  const water: WaterPlan = tuning.water ? look.water : "none";

  // ---- the goal, the hub and a village
  const goalId = toId(`goal_${look.goal.kind}`);
  const hubInfo = STRUCTURES[look.hub.kind];
  const hubRadius = hubInfo.radius * look.hub.scale;
  const hubAt = { x: r1(hubRadius + 24), z: r1(route.spawn.z + 0.02 * S) };
  const hubId = toId(`hub_${look.hub.kind}`);
  const landmarks: Landmark[] = [
    {
      id: goalId,
      kind: look.goal.kind,
      name: look.goal.name,
      at: { x: route.goal.x, z: route.goal.z },
      rotation: 0,
      scale: route.goal.scale,
      material: look.goal.material,
      style: look.style,
      role: "goal",
      description: look.goal.description,
    },
    {
      id: hubId,
      kind: look.hub.kind,
      name: look.hub.name,
      at: hubAt,
      rotation: yawToward(hubAt, route.spawn),
      scale: look.hub.scale,
      material: look.material,
      style: look.style,
      role: "hub",
      description: look.hub.description,
    },
  ];

  // ---- characters: the cast first (the teacher by the hub), extras for conversation moments
  const teacherId = pickTeacher(spec.characters);
  const taken = new Set<string>([goalId, hubId]);
  const npcs: Npc[] = [];
  const npcFor = new Map<string, Npc>();
  const rngFor = (label: string) => subRng(seed, `fallback:${label}`);
  const makeNpc = (id: string, characterId: string | null, name: string, role: string, voice: VoiceArchetype, at: { x: number; z: number }, behavior: NpcBehavior): Npc => {
    const rng = rngFor(`npc:${id}`);
    const color = pick(rng, CLOTH_COLORS);
    const accent = pick(rng, CLOTH_COLORS.filter((c) => c !== color));
    return {
      id,
      characterId,
      name: clampText(name, 24),
      role: clampText(role, 60),
      at,
      facing: yawToward(at, route.spawn),
      look: { skin: pick(rng, SKIN_TONES), outfit: pick(rng, look.outfits), color, accent, headwear: pick(rng, look.headwear), held: pick(rng, look.held), height: r1(range(rng, 0.92, 1.08) * 100) / 100 },
      behavior,
      voiceArchetype: voice,
      greeting: "",
      barks: [],
      persona: "",
      topics: [],
    };
  };
  const uniqueId = (raw: string) => {
    let id = toId(raw, "npc");
    for (let k = 2; taken.has(id); k++) id = toId(`${raw}_${k}`);
    taken.add(id);
    return id;
  };
  const teacherSpot = { x: r1(hubAt.x - hubRadius - 5), z: r1(hubAt.z - 3) };
  const goalSpot = { x: r1(route.goal.x - route.goal.radius - 10), z: r1(route.goal.z + route.goal.radius * 0.5 + 6) };
  let atGoal = 0;
  for (const c of spec.characters) {
    const teacher = c.id === teacherId;
    const at = teacher ? teacherSpot : { x: r1(goalSpot.x + 5 * atGoal), z: r1(goalSpot.z + 3 * atGoal++) };
    npcs.push(makeNpc(uniqueId(c.id), c.id, c.name, c.role, c.voiceArchetype, { ...at }, teacher ? "wave" : "idle"));
  }
  const npcOfCharacter = (characterId: string) => npcs.find((n) => n.characterId === characterId);
  const teacherNpc = (teacherId && npcOfCharacter(teacherId)) || npcs[0];

  // ---- one anchor per route slot: an npc for conversations, a landmark for everything else
  const kindCount = new Map<StructureKind, number>();
  const nameUsed = new Set<string>(landmarks.map((l) => l.name));
  const landmarkName = (kind: StructureKind) => {
    const label = KIND_LABEL[kind] ?? kind.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
    for (const w of NAME_WORDS) {
      const name = `The ${w} ${label}`;
      if (!nameUsed.has(name)) {
        nameUsed.add(name);
        return name;
      }
    }
    return `The ${label}`;
  };
  const extraNames = look.names.filter((n) => !spec.characters.some((c) => c.name === n));
  let extraIndex = 0;
  let teacherUsed = false;
  const anchorOf = new Map<string, { npcId: string | null; landmarkId: string | null; place: string }>();
  const anchorLandmarks: string[] = [];
  routeIds.forEach((id, k) => {
    const e = byId.get(id)!;
    const socket = socketOf(e);
    const slot = route.slots[k];
    const topic = topicOf(e);
    if (socket === "conversation") {
      let npc: Npc | undefined;
      if (!teacherUsed && teacherNpc) {
        npc = teacherNpc;
        npc.at = { x: slot.x, z: slot.z };
        teacherUsed = true;
      } else if (npcs.length < 12 && extraIndex < extraNames.length) {
        const name = extraNames[extraIndex];
        const role = look.roles[extraIndex % look.roles.length];
        const voices: VoiceArchetype[] = ["cheerful_sidekick", "nervous_scholar", "gruff_guard", "wise_mentor"];
        npc = makeNpc(uniqueId(`npc_${name}`), null, name, role, voices[extraIndex % voices.length], { x: slot.x, z: slot.z }, (["idle", "work", "study"] as const)[extraIndex % 3]);
        extraIndex++;
        npcs.push(npc);
      } else {
        const hosts = npcs.filter((n) => n.characterId === null);
        npc = hosts[k % Math.max(1, hosts.length)] ?? teacherNpc;
      }
      npc.topics = [...new Set([...npc.topics, ...e.conceptIds])].slice(0, 8);
      npcFor.set(id, npc);
      anchorOf.set(id, { npcId: npc.id, landmarkId: null, place: npc.name });
      return;
    }
    const socketKey = socket as AnchorSocket;
    const kinds = look.kinds[socketKey];
    const used = [...kindCount.values()].reduce((a, b) => a + b, 0);
    const kind = kinds[(used + k) % kinds.length];
    kindCount.set(kind, (kindCount.get(kind) ?? 0) + 1);
    const lid = uniqueId(`${kind}_${kindCount.get(kind)}`);
    const small = STRUCTURES[kind].radius < 3.5;
    const at = { x: slot.x, z: slot.z };
    const prev = k > 0 ? route.slots[k - 1] : route.spawn;
    const name = landmarkName(kind);
    landmarks.push({
      id: lid,
      kind,
      name,
      at,
      rotation: yawToward(at, prev),
      scale: small ? 1.3 : 1,
      material: kind === "market_stall" || kind === "shrine" ? look.soft : look.material,
      style: look.style,
      role: "poi",
      description: DESCRIBE[socketKey](topic),
    });
    anchorLandmarks.push(lid);
    anchorOf.set(id, { npcId: null, landmarkId: lid, place: name });
  });
  if (boss) anchorOf.set(boss.id, { npcId: null, landmarkId: goalId, place: look.goal.name });

  // ---- decor: a boat on the water, a dock on the coast
  if (water === "river" || water === "ocean") {
    const boatAt = water === "river" ? { x: r1(0.37 * S), z: r1(-0.05 * S) } : { x: r1(0.44 * S), z: r1(-0.1 * S) };
    landmarks.push({ id: uniqueId("boat_1"), kind: "boat", name: "The Little Boat", at: boatAt, rotation: 0, scale: 1, material: "wood", style: look.style, role: "decor", description: "A small boat bobbing on the water. Someone keeps it ready for a trip." });
  }
  if (water === "ocean") {
    landmarks.push({ id: uniqueId("dock_1"), kind: "dock", name: "The Jetty", at: { x: r1(0.3 * S), z: r1(0.08 * S) }, rotation: 90, scale: 1, material: "wood", style: look.style, role: "decor", description: "A timber jetty where the boats tie up." });
  }

  for (const d of look.decor) {
    if (d.kind === "dock" && water === "none") continue;
    landmarks.push({
      id: uniqueId(`${d.kind}_decor`),
      kind: d.kind,
      name: d.name,
      at: { x: r1(d.x * S), z: r1(d.z * S) },
      rotation: yawToward({ x: d.x * S, z: d.z * S }, route.spawn),
      scale: d.scale,
      material: d.kind === "hut" || d.kind === "campfire" || d.kind === "dock" ? look.soft : look.material,
      style: look.style,
      role: "decor",
      description: d.description,
    });
  }

  // ---- lines, personas and topics
  const lessonOf = new Map((spec.lessons ?? []).map((l) => [l.conceptId, l]));
  const speakerFor = (characterId: string) => npcOfCharacter(characterId)?.id ?? "narrator";
  const beats = (id: string, when: "before" | "after"): WorldLine[] =>
    spec.narrative.beats.filter((b) => b.encounterId === id && b.when === when).map((b) => ({ speaker: speakerFor(b.speakerId), text: clampSentences(b.text, 180) }));
  const moments: Moment[] = order.map((id) => {
    const e = byId.get(id)!;
    const socket = socketOf(e);
    const anchor = anchorOf.get(id)!;
    const topic = topicOf(e);
    const prompt = clampSentences(e.prompt, 180);
    const npc = npcFor.get(id);
    let objective: string;
    let approach: WorldLine[];
    let success: WorldLine[];
    let reward: Moment["reward"];
    if (socket === "conversation" && npc) {
      objective = `Talk to ${npc.name} about ${topic}`;
      if (objective.length > 70) objective = `Talk to ${npc.name}`;
      approach = [...beats(id, "before").slice(0, 2), { speaker: npc.id, text: prompt }];
      success = [...beats(id, "after").slice(0, 1), { speaker: npc.id, text: CHEER[npc.voiceArchetype] }].slice(0, 2);
      reward = { kind: "insight", name: clampText(`${firstName(npc.name)}'s advice`, 24), description: clampText(`What ${firstName(npc.name)} helped you see about ${topic}.`, 160) };
    } else {
      const key = socket === "conversation" ? "inscription" : socket;
      objective = clampText(OBJECTIVE[key](anchor.place), 70);
      approach = [{ speaker: "narrator", text: SCENE[key](anchor.place) }, ...beats(id, "before").slice(0, 1), { speaker: "narrator", text: prompt }];
      success = [...beats(id, "after").slice(0, 1), { speaker: "narrator", text: SUCCESS[key](anchor.place) }].slice(0, 2);
      reward = { ...REWARDS[key], description: clampText(`Earned by working out ${listWords(e.conceptIds.map((c) => shortName(conceptById.get(c)?.name ?? c, 60)))}.`, 160) };
    }
    return {
      encounterId: id,
      anchor: { npcId: anchor.npcId, landmarkId: anchor.landmarkId },
      objective,
      approach: approach.slice(0, 3),
      success,
      reward,
      opens: socket === "seal" ? anchor.landmarkId : null,
    };
  });

  const place = clampText(spec.theme.setting, 80);
  for (const n of npcs) {
    const hosted = moments.filter((m) => m.anchor.npcId === n.id).map((m) => byId.get(m.encounterId)!);
    if (n.id === teacherNpc?.id) n.topics = spec.concepts.slice(0, 8).map((c) => c.id);
    const topics = n.topics.map((t) => conceptById.get(t)).filter((c): c is NonNullable<typeof c> => !!c);
    const topicNames = topics.map((c) => shortName(c.name, 60));
    const idea = topics[0] ? (lessonOf.get(topics[0].id)?.bigIdea ?? topics[0].learningObjective) : "";
    const character = n.characterId ? spec.characters.find((c) => c.id === n.characterId) : undefined;
    const knows = topicNames.length > 0 ? ` Knows ${listWords(topicNames.slice(0, 4))}${topicNames.length > 4 ? " and more" : ""}. ${idea}` : "";
    n.persona = clampText(
      `${n.name} (${character ? character.role : n.role.toLowerCase()}) lives in ${embed(look.place)}. ${VOICE[n.voiceArchetype]} Loves helping newcomers think things through, but never just hands over an answer.${knows}`,
      600,
    );
    const firstHosted = hosted[0];
    const ownBeat =
      (firstHosted && spec.narrative.beats.find((b) => b.encounterId === firstHosted.id && b.when === "before" && b.speakerId === n.characterId)) ||
      (n.characterId ? spec.narrative.intro.find((l) => l.speakerId === n.characterId) : undefined);
    n.greeting = clampSentences(ownBeat?.text ?? greetingFor(n.voiceArchetype, topicNames[0] ?? null, look.goal.name), 180);
    n.barks = BARKS[n.voiceArchetype].slice(0, 2);
  }

  // ---- collectibles: true facts from the student's material, beside the route
  const facts: { conceptId: string; fact: string }[] = [];
  for (const c of spec.concepts) {
    const fromKm = km?.concepts.find((x) => x.id === c.id)?.facts.map((f) => f.statement) ?? [];
    const fromLesson = lessonOf.get(c.id)?.keyPoints.map((p) => p.text) ?? [];
    const pool = fromKm.length > 0 ? fromKm : fromLesson.length > 0 ? fromLesson : (c.keyFacts ?? []);
    pool.slice(0, 2).forEach((fact) => facts.push({ conceptId: c.id, fact }));
  }
  const want = Math.min(20, facts.length, 3 + Math.round((spec.targetMinutes / 5) * 2));
  const byConcept = new Map<string, number>();
  const ordered = [...facts.filter((_, i) => i % 2 === 0), ...facts.filter((_, i) => i % 2 === 1)];
  const items = ordered.slice(0, want).map((f, k) => {
    const slot = route.slots[k % Math.max(1, route.slots.length)] ?? route.spawn;
    const side = "side" in slot ? -slot.side : 1;
    const nth = (byConcept.get(f.conceptId) ?? 0) + 1;
    byConcept.set(f.conceptId, nth);
    const name = shortName(conceptById.get(f.conceptId)?.name ?? f.conceptId, 60);
    const title = nth > 1 ? `${name} II` : name;
    const offset = route.swing + 26 + (k % 3) * 8;
    return {
      id: `find_${k + 1}`,
      at: { x: r1(Math.max(-half + 12, Math.min(half - 12, side * offset))), z: r1(slot.z + (k % 2 === 0 ? -10 : 10)) },
      title: title.length <= 24 ? title : `${look.collectOne} ${k + 1}`,
      fact: clampSentences(f.fact, 220),
      conceptId: f.conceptId,
    };
  });

  // ---- terrain, water, paths, scatter, wildlife
  const features: TerrainFeature[] = tuning.features ? look.features(S).filter((f) => water !== "none" || f.kind !== "basin") : [];
  features.push(feature("hill", route.goal.x, route.goal.z, route.goal.radius + 0.12 * S, tuning.goalHill));
  const riverX = 0.37 * S;
  const terrainWater: World3D["terrain"]["water"] =
    water === "river"
      ? {
          kind: "river",
          level: 0,
          course: [
            { x: r1(riverX + 0.03 * S), z: -half },
            { x: r1(riverX - 0.02 * S), z: r1(-0.2 * S) },
            { x: r1(riverX + 0.02 * S), z: r1(0.1 * S) },
            { x: r1(riverX - 0.01 * S), z: half },
          ],
          width: Math.round(Math.min(44, Math.max(20, S * 0.06))),
          coast: null,
        }
      : water === "ocean"
        ? { kind: "ocean", level: 0, course: [], width: 10, coast: "east" }
        : water === "lake"
          ? { kind: "lake", level: 0, course: [], width: 10, coast: null }
          : { kind: "none", level: 0, course: [], width: 10, coast: null };

  const chain = [hubId, ...anchorLandmarks, goalId];
  const paths: World3D["paths"] = [{ from: "spawn", to: hubId, style: look.path }];
  for (let i = 0; i + 1 < chain.length && paths.length < 32; i++) paths.push({ from: chain[i], to: chain[i + 1], style: look.path });

  const hasWater = water !== "none";
  const scatter: Scatter[] = BIOMES[look.biome].defaultScatter
    .filter((s) => hasWater || (s.kind !== "reeds" && s.kind !== "coral"))
    .map((s) => ({ kind: s.kind, density: s.density, zone: s.kind === "reeds" || s.kind === "coral" ? "near_water" : "everywhere", landmarkId: null }));
  const flowery = BIOMES[look.biome].defaultScatter.some((s) => s.kind === "flowers") ? "flowers" : look.biome === "lunar" ? "rock" : "bush";
  scatter.push({ kind: flowery, density: 0.6, zone: "around_landmark", landmarkId: hubId });

  const WILD_COUNT: Record<string, number> = { cat: 4, dog: 3, goat: 5, camel: 2, horse: 3, bird_flock: 12, butterflies: 10, fireflies: 12, fish: 8, ibis: 5 };
  const wildlife: Wildlife[] = BIOMES[look.biome].defaultWildlife
    .filter((k) => hasWater || (k !== "fish" && k !== "ibis"))
    .slice(0, 8)
    .map((k) => ({
      kind: k,
      count: WILD_COUNT[k] ?? 4,
      zone: WILDLIFE[k].interactive ? "around_landmark" : k === "fish" || k === "ibis" ? "near_water" : "everywhere",
      landmarkId: WILDLIFE[k].interactive ? hubId : null,
    }));

  const clusters: World3D["clusters"] = [];
  if (look.cluster) {
    clusters.push({ id: uniqueId(look.cluster), kind: look.cluster, at: { x: r1(-0.24 * S), z: r1(route.spawn.z - 0.02 * S) }, radius: Math.round(0.05 * S + 12), count: 4 + Math.round(spec.targetMinutes / 5), material: look.soft, style: look.style });
  }
  if (look.extra && (tuning.water || look.extra.kind !== "farmland" || look.water === "none")) {
    clusters.push({ id: uniqueId(look.extra.kind), kind: look.extra.kind, at: { x: r1(look.extra.x * S), z: r1(look.extra.z * S) }, radius: Math.round(0.05 * S + 8), count: look.extra.kind === "farmland" ? 4 : 6, material: look.soft, style: look.style });
  }

  const flyMiddle = anchorLandmarks.length > 0 ? [anchorLandmarks[Math.floor(anchorLandmarks.length / 2)]] : [];
  const year = /\b(\d{3,4})\s*(BCE|BC|CE|AD)\b/i.exec(`${spec.title} ${spec.theme.setting}`) ?? /\b(1[0-9]{3}|20[0-9]{2})\b/.exec(`${spec.title} ${spec.theme.setting} ${spec.premise}`);
  const era = year ? (year[2] ? `c. ${year[1]} ${year[2].toUpperCase()}` : year[1]) : look.era;
  const caption = clampText(`${look.place} · ${era}`, 120);

  return {
    version: WORLD3D_VERSION,
    seed,
    biome: look.biome,
    setting: { era, place, style: look.style },
    terrain: { size: S, relief: tuning.relief, features, water: terrainWater },
    atmosphere: { mood: look.mood, weather: look.weather, fog: look.fog, wind: look.wind },
    landmarks,
    clusters,
    scatter: scatter.slice(0, 14),
    paths,
    wildlife,
    npcs,
    quest: {
      goal: { title: clampText(`Reach ${embed(look.goal.name)}`, 48), description: clampSentences(spec.premise, 240), landmarkId: goalId },
      acts: acts.map((a, i) => ({ id: `act_${i + 1}`, title: a.title, summary: a.summary, encounterIds: a.ids })),
    },
    moments,
    collectibles: { label: look.collect, items },
    spawn: { at: route.spawn, facing: yawToward(route.spawn, route.goal) },
    opening: { caption, flyover: [...new Set([hubId, ...flyMiddle, goalId])] },
    ui: { hudTheme: look.hud, accent: look.accent },
    audio: { ambience: look.ambience ?? BIOMES[look.biome].ambience },
    provenance: { source: "composer", model: null, reviews: [], fixes: [] },
  };
}

/**
 * src/world/biomes.ts (V1) — the biome kits (docs/design/20 §6.4, A11) and the ranking autoWorld uses.
 *
 * A kit is everything code needs to dress a world for a subject without a hand-authored side-car: zone presets
 * (layers, sky, ambient, ground template, prop sets, one hero landmark), traversal templates, the companion and
 * emblem defaults, vehicles, the finale vista, per-archetype skin defaults, the protagonist's success pose, and the
 * sensitivity data R10 lints against. New kits (forest observatory, harbour, desert) are art plus one entry here.
 * Asset keys follow §5.1 (`<ns>.<group>.<name>`); kit presets point at `<ns>.kit.*` stand-ins the art lane builds.
 * Pure.
 */
import type { Domain } from "../contracts/common";
import { Ambient, Emblem, LayerSet, Sky, type AmbientLight } from "../contracts/world";
import type { BiomeKit, GroundTemplate } from "./types";

export type { BiomeKit, GroundTemplate } from "./types";

type Preset = BiomeKit["zonePresets"][number];

function sky(stops: readonly string[], haze: string, alpha: number): Sky {
  return Sky.parse({ stops: stops.map((color, i) => ({ at: i / (stops.length - 1), color })), haze: { color: haze, alpha } });
}
/** A kit zone preset: the default six-depth layer stack of `<ns>.kit.<name>_*` strips (A2 builds them). */
function preset(
  ns: string,
  name: string,
  light: AmbientLight,
  stops: readonly string[],
  haze: string,
  particles: Ambient["particles"],
  shadowColor: string,
  heroLandmark: string | null,
  propSets: readonly string[],
  ground: Partial<GroundTemplate> = {},
): Preset {
  const k = (s: string) => `${ns}.kit.${name}_${s}`;
  return {
    light,
    layerSet: LayerSet.parse({
      id: name,
      layers: [
        { asset: k("far"), depth: "L1_far", scrollFactor: 0.15, y: 420 },
        { asset: k("midfar"), depth: "L2_midfar", scrollFactor: 0.35, y: 600 },
        { asset: k("mid"), depth: "L3_mid", scrollFactor: 0.6, y: 720 },
        { asset: k("fore"), depth: "L5_fore", scrollFactor: 1.3, y: 1380, alpha: 0.7, blurPx: 2 },
        { asset: k("light"), depth: "L6_light", scrollFactor: 1, y: 0, alpha: 0.18, blend: "add" },
      ],
    }),
    sky: sky(stops, haze, 0.22),
    ambient: Ambient.parse({ light, particles, particleCount: particles === "none" ? 0 : 18, shadowColor }),
    ground: { surface: k("ground"), underside: k("underside"), baseY: 1240, roughness: 24, ...ground },
    propSets,
    heroLandmark,
  };
}

const TRAVERSAL_COMMON: BiomeKit["traversalTemplates"] = [
  { kind: "hop", dx: 260, dy: -120, apex: 140 },
  { kind: "climb", dx: 0, dy: -320 },
  { kind: "ladder", dx: 0, dy: -420 },
  { kind: "drop", dx: 180, dy: 260 },
];

export const BIOME_KITS: Readonly<Record<string, BiomeKit>> = {
  orrery_terraces: {
    id: "orrery_terraces",
    name: "The Sky Clock",
    domains: ["math", "physics", "engineering", "earth_space", "cs"],
    sensitive: false,
    paletteId: "orrery_terraces",
    zonePresets: [
      preset("orrery_terraces", "terrace_day", "day", ["#D8D4CF", "#E8DCD2", "#F4E7DA"], "#FFFFFF", "pollen", "#6E7F9A", "orrery_terraces.layer.orrery_tower", ["brass_dressing", "crystal_clusters"]),
      preset("orrery_terraces", "crystal_peach", "peach", ["#E9C6B8", "#F2D3C2", "#F8E4D2"], "#FBEBDD", "motes", "#7A6E9A", "orrery_terraces.prop.crystal_falls", ["crystal_clusters", "aqueduct_ruins"], { roughness: 40 }),
      preset("orrery_terraces", "dome_dusk", "dusk", ["#3E3F74", "#6C5B8E", "#C98C8A"], "#F2A65A", "stars", "#3E3F74", "orrery_terraces.prop.star_door", ["brass_dressing"], { roughness: 8 }),
    ],
    traversalTemplates: [...TRAVERSAL_COMMON, { kind: "timed_hop", dx: 300, dy: 0, apex: 120 }],
    companionDefault: "orrery_terraces.companion.cog",
    emblemDefault: Emblem.parse({ glyph: "owl", ring: "#C69A6B", accent: "#8FE0EA" }),
    vehicles: { lift: "orrery_terraces.prop.gondola", tram: null, vesicle: null },
    vista: "orrery_terraces.vista.canyon",
    skinDefaults: { aimer: "tuning_lens", quarantineAnim: "mimic_crab", connector: "tube", layout: "ring", bays: "floating" },
    sims: ["pendulum_beat"],
    fictionalStaff: [],
    protectedNames: [],
    violenceLexicon: [],
    successPose: "cheer",
  },
  living_gate: {
    id: "living_gate",
    name: "Inside a Cell",
    domains: ["biology", "chemistry", "health"],
    sensitive: false,
    paletteId: "living_gate",
    zonePresets: [
      preset("living_gate", "shore_aqua", "aqua", ["#0E3B4A", "#1F6E7A", "#6FC8C0"], "#BDF2E6", "bubbles", "#1B4E5C", "living_gate.prop.poro_statue", ["glycocalyx_fronds", "lipid_pebbles"]),
      preset("living_gate", "trench_amber", "amber", ["#3A2A1E", "#7A5230", "#E0A45E"], "#F6D29A", "spores", "#4A3424", "living_gate.prop.flume_pump", ["channel_proteins", "lipid_pebbles"], { roughness: 36 }),
      preset("living_gate", "pore_night", "night", ["#101A33", "#233A66", "#4E7BB5"], "#9FC6FF", "motes", "#1A2744", "living_gate.prop.nuclear_pore", ["pore_filaments"], { roughness: 12 }),
    ],
    traversalTemplates: [...TRAVERSAL_COMMON, { kind: "ride", dx: 900, dy: 0 }],
    companionDefault: "living_gate.companion.pip",
    emblemDefault: Emblem.parse({ glyph: "cell", ring: "#3FA7A0", accent: "#F2C14E" }),
    vehicles: { lift: "living_gate.prop.echo_lift", tram: "living_gate.prop.kinesin_tram", vesicle: "living_gate.prop.vesicle" },
    vista: null,
    skinDefaults: { aimer: "probe_emitter", quarantineAnim: "ridge_thaw", connector: "tube", layout: "ring", bays: "floating" },
    sims: ["bilayer_probe", "diffusion_tank", "osmotic_cell", "pump_flume", "membrane_fold"],
    fictionalStaff: [],
    protectedNames: [],
    violenceLexicon: [],
    successPose: "cheer",
  },
  archive_of_voices: {
    id: "archive_of_voices",
    name: "The Civil Rights Files",
    domains: ["history", "civics", "law", "literature", "writing", "economics", "geography", "philosophy", "language", "art", "music"],
    sensitive: true,
    paletteId: "archive_of_voices",
    zonePresets: [
      preset("archive_of_voices", "square_afternoon", "peach", ["#B9A3D6", "#D9AFCF", "#E9B8C4", "#F6D9BE"], "#F6D9BE", "dust", "#6E6A8F", "archive_of_voices.prop.courthouse", ["street_furniture", "paper_drift"]),
      preset("archive_of_voices", "stacks_interior", "interior", ["#2B2433", "#4A3B4F", "#7A6070"], "#E8C9A0", "scraps", "#3A3040", "archive_of_voices.prop.record_engine", ["filing_cabinets", "paper_drift"], { roughness: 0 }),
      preset("archive_of_voices", "bridge_dawn", "dawn", ["#5B6C8F", "#A8A0B8", "#E8C4A8", "#F6DDC0"], "#F6DDC0", "rain", "#4F5A73", "archive_of_voices.part.timeline_bridge_arch", ["street_furniture"], { roughness: 16 }),
    ],
    traversalTemplates: TRAVERSAL_COMMON,
    companionDefault: "archive_of_voices.companion.wick",
    emblemDefault: Emblem.parse({ glyph: "lantern", ring: "#B98A4E", accent: "#6ED2F2" }),
    vehicles: { lift: "archive_of_voices.prop.book_lift", tram: null, vesicle: null },
    vista: "archive_of_voices.vista.dawn",
    skinDefaults: { aimer: "arc_lamp", quarantineAnim: "retract_stamp", connector: "catenary", layout: "canopy_row", bays: "flat_road" },
    sims: [],
    // bodies/looks allowed for human NPCs (civil §0 rule 5: fictional present-day archive staff only)
    fictionalStaff: ["shared.char.nell", "shared.char.ida", "shared.char.otis", "shared.char.hattie", "shared.char.dolores", "shared.char.theo"],
    // people the fixture texts name only by surname or in passing; the R10 lint treats these as real people too
    protectedNames: [
      "Rosa Parks", "Martin Luther King", "King", "Parks", "Emmett Till", "Medgar Evers", "Malcolm X", "John Lewis", "Diane Nash",
      "Fred Shuttlesworth", "Ella Baker", "Bayard Rustin", "Thurgood Marshall", "Earl Warren", "Lyndon Johnson", "Johnson",
      "John F. Kennedy", "Kennedy", "Eisenhower", "Orval Faubus", "Faubus", "George Wallace", "Bull Connor", "Jo Ann Robinson",
      "E. D. Nixon", "Claudette Colvin", "Fannie Lou Hamer", "Elizabeth Eckford", "Linda Brown", "Oliver Brown", "Ruby Bridges",
    ],
    violenceLexicon: [
      "attack", "attacked", "attacks", "beaten", "beating", "bomb", "bombed", "bombing", "burned", "firebombed", "murder",
      "murdered", "killed", "killing", "lynched", "lynching", "assault", "assaulted", "clubbed", "shot", "shooting", "violence",
      "violent", "hoses", "dogs", "tear gas", "bloody", "blood", "riot", "mob",
    ],
    successPose: "show",
  },
};

export const BIOME_IDS: readonly string[] = Object.keys(BIOME_KITS);

export function isBiomeId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(BIOME_KITS, id);
}
export function biomeKitOf(id: string): BiomeKit | undefined {
  return isBiomeId(id) ? BIOME_KITS[id] : undefined;
}

/** When no kit lists a domain: the general ordering (neutral, then science, then the sensitive archive). */
const GENERAL_ORDER: readonly string[] = ["orrery_terraces", "living_gate", "archive_of_voices"];

/** Biome ids for a domain: exact domain matches first (kit order), then the rest in the general ordering. */
export function rankBiomes(domain: Domain): string[] {
  const exact = BIOME_IDS.filter((id) => BIOME_KITS[id]?.domains.includes(domain));
  const rest = GENERAL_ORDER.filter((id) => !exact.includes(id));
  return [...exact, ...rest];
}

/** The per-archetype skin defaults of a biome (falls back to orrery_terraces for unknown ids). */
export function skinDefaultsFor(biome: string): BiomeKit["skinDefaults"] {
  return (biomeKitOf(biome) ?? (BIOME_KITS.orrery_terraces as BiomeKit)).skinDefaults;
}
/** The protagonist's pose on every success (A11): "show" in sensitive kits. */
export function successPoseFor(biome: string): BiomeKit["successPose"] {
  return biomeKitOf(biome)?.successPose ?? "cheer";
}

import type { Biome, ClusterKind, ScatterKind, StructureKind, WildlifeKind } from "../../contracts/world3d";

/*
 * The 3D component library's catalog: the dimensions and placement rules of every structure, scatter and creature kind
 * at scale 1. It is the contract between the pure core (pads, collision, sightlines, spacing, the critic's digest) and
 * the renderers in src/world3d/kit: a structure builder must fit inside its footprint radius and reach roughly its
 * height, so what the checks reason about is what the player sees.
 */

/** Where a structure may stand: on land, on the shoreline (half in water), on the water, or spanning water (bridges). */
export type Placement = "land" | "shore" | "water" | "span";

export interface StructureInfo {
  /** footprint radius in metres at scale 1 (the pad code flattens, the collision circle, the spacing check) */
  radius: number;
  /** rough height in metres at scale 1 (sightlines, the beacon, the camera) */
  height: number;
  placement: Placement;
  /** can the player walk into / onto it (arches, bridges, docks, colonnades, amphitheatres, stone circles) */
  walkable: boolean;
  /** one line the Architect's prompt uses to explain the kind */
  describe: string;
}

export const STRUCTURES: Record<StructureKind, StructureInfo> = {
  pyramid: { radius: 70, height: 90, placement: "land", walkable: false, describe: "smooth-sided pyramid, ~140 m base at scale 1 (Giza's Great Pyramid ≈ scale 1.6)" },
  step_pyramid: { radius: 38, height: 34, placement: "land", walkable: false, describe: "stepped pyramid with a stair and a shrine on top (Djoser, Maya)" },
  obelisk: { radius: 3, height: 22, placement: "land", walkable: false, describe: "tall tapering stone needle on a plinth" },
  temple: { radius: 22, height: 14, placement: "land", walkable: false, describe: "columned temple with a stepped base and a pediment or pylon front" },
  colonnade: { radius: 16, height: 9, placement: "land", walkable: true, describe: "two rows of columns under a lintel, walk through" },
  ruins: { radius: 14, height: 6, placement: "land", walkable: true, describe: "broken walls, fallen columns and rubble" },
  tower: { radius: 6, height: 24, placement: "land", walkable: false, describe: "round or square watchtower with a crenellated top" },
  lighthouse: { radius: 7, height: 30, placement: "land", walkable: false, describe: "tall lighthouse with a glowing lantern room" },
  keep: { radius: 14, height: 22, placement: "land", walkable: false, describe: "fortified square keep with corner turrets" },
  wall: { radius: 20, height: 6, placement: "land", walkable: false, describe: "a 40 m straight stretch of defensive wall" },
  gate: { radius: 8, height: 10, placement: "land", walkable: true, describe: "gatehouse or pylon gate with doors that open when its seal is solved" },
  arch: { radius: 6, height: 9, placement: "land", walkable: true, describe: "free-standing triumphal or natural stone arch" },
  bridge: { radius: 18, height: 3, placement: "span", walkable: true, describe: "36 m bridge that spans a river; place it on the river course" },
  house: { radius: 5, height: 6, placement: "land", walkable: false, describe: "small dwelling in the setting's style" },
  hut: { radius: 3.5, height: 4, placement: "land", walkable: false, describe: "simple round hut with a thatched or hide roof" },
  tent: { radius: 4, height: 3.5, placement: "land", walkable: false, describe: "cloth tent or pavilion" },
  market_stall: { radius: 2.5, height: 3, placement: "land", walkable: false, describe: "awning stall with goods on a counter" },
  statue: { radius: 3, height: 8, placement: "land", walkable: false, describe: "standing figure on a pedestal" },
  sphinx: { radius: 18, height: 12, placement: "land", walkable: false, describe: "recumbent lion body with a human head, ~36 m long" },
  monolith: { radius: 2, height: 7, placement: "land", walkable: false, describe: "single standing stone or stele that can carry an inscription" },
  stone_circle: { radius: 12, height: 4.5, placement: "land", walkable: true, describe: "ring of standing stones with lintels" },
  observatory: { radius: 9, height: 12, placement: "land", walkable: false, describe: "domed observatory with a slit and a telescope" },
  windmill: { radius: 5, height: 14, placement: "land", walkable: false, describe: "windmill with turning sails" },
  well: { radius: 1.8, height: 2.2, placement: "land", walkable: false, describe: "stone well with a winch" },
  dock: { radius: 10, height: 1.5, placement: "shore", walkable: true, describe: "timber jetty reaching into the water; place it on the shoreline" },
  boat: { radius: 6, height: 7, placement: "water", walkable: false, describe: "sailing boat moored on the water (felucca, longship, dinghy by style)" },
  shrine: { radius: 3, height: 4, placement: "land", walkable: false, describe: "small roadside shrine or altar with offerings" },
  cave_mouth: { radius: 8, height: 8, placement: "land", walkable: false, describe: "rocky cave entrance set into a slope" },
  campfire: { radius: 1.5, height: 1, placement: "land", walkable: false, describe: "fire ring with logs and a warm glow" },
  research_station: { radius: 10, height: 6, placement: "land", walkable: false, describe: "modular research station with antennas and lights" },
  greenhouse: { radius: 8, height: 5, placement: "land", walkable: false, describe: "glass greenhouse with plants inside" },
  amphitheater: { radius: 25, height: 8, placement: "land", walkable: true, describe: "semicircular stepped seating around a stage" },
  aqueduct: { radius: 30, height: 14, placement: "land", walkable: false, describe: "60 m run of arched aqueduct" },
  tomb: { radius: 8, height: 5, placement: "land", walkable: false, describe: "rock-cut or mastaba tomb with a sealed doorway" },
  palace: { radius: 28, height: 16, placement: "land", walkable: false, describe: "large palace with courtyards and a grand entrance" },
  workshop: { radius: 6, height: 6, placement: "land", walkable: false, describe: "craft workshop with tools, a bench and a kiln or forge" },
  library: { radius: 12, height: 10, placement: "land", walkable: false, describe: "hall of scrolls or books with a columned porch" },
  beacon: { radius: 2, height: 12, placement: "land", walkable: false, describe: "fire beacon or signal mast that lights up" },
};

/** Default interaction reach around a structure's footprint (metres beyond its radius). */
export const INTERACT_MARGIN = 5;
/** Interaction reach around an npc (metres). */
export const NPC_REACH = 3.2;
/** Minimum gap (metres) between two landmarks' footprints. */
export const LANDMARK_GAP = 6;

export interface ClusterInfo {
  /** what the cluster is made of: structure kinds code draws from */
  pieces: readonly StructureKind[] | "fields" | "trees" | "stones";
  /** footprint radius of one piece */
  pieceRadius: number;
}

export const CLUSTERS: Record<ClusterKind, ClusterInfo> = {
  village: { pieces: ["house", "house", "hut", "well", "market_stall"], pieceRadius: 5 },
  camp: { pieces: ["tent", "tent", "campfire"], pieceRadius: 4 },
  farmland: { pieces: "fields", pieceRadius: 12 },
  ruins_field: { pieces: ["ruins", "monolith", "statue"], pieceRadius: 6 },
  market: { pieces: ["market_stall", "market_stall", "tent"], pieceRadius: 3 },
  grove: { pieces: "trees", pieceRadius: 3 },
  quarry: { pieces: "stones", pieceRadius: 4 },
  harbor: { pieces: ["dock", "boat", "boat"], pieceRadius: 8 },
};

export interface ScatterInfo {
  /** instances per 10 000 m² (one hectare) at density 1 */
  perHectare: number;
  /** size range (metres, overall height) at scale 1 */
  size: [number, number];
  /** collides with the player (trees, boulders) or is walk-through (grass, flowers, reeds) */
  solid: boolean;
  /** max slope (0 flat .. 1 vertical) it grows on */
  maxSlope: number;
}

export const SCATTER: Record<ScatterKind, ScatterInfo> = {
  palm: { perHectare: 14, size: [7, 13], solid: true, maxSlope: 0.35 },
  conifer: { perHectare: 30, size: [8, 18], solid: true, maxSlope: 0.6 },
  broadleaf: { perHectare: 22, size: [7, 14], solid: true, maxSlope: 0.45 },
  birch: { perHectare: 26, size: [8, 14], solid: true, maxSlope: 0.45 },
  dead_tree: { perHectare: 6, size: [4, 9], solid: true, maxSlope: 0.6 },
  bush: { perHectare: 60, size: [0.8, 2], solid: false, maxSlope: 0.6 },
  reeds: { perHectare: 900, size: [1.2, 2.4], solid: false, maxSlope: 0.3 },
  tall_grass: { perHectare: 5000, size: [0.4, 1], solid: false, maxSlope: 0.55 },
  flowers: { perHectare: 900, size: [0.2, 0.5], solid: false, maxSlope: 0.45 },
  cactus: { perHectare: 10, size: [1.5, 5], solid: true, maxSlope: 0.4 },
  rock: { perHectare: 40, size: [0.4, 1.4], solid: false, maxSlope: 1 },
  boulder: { perHectare: 5, size: [2, 6], solid: true, maxSlope: 1 },
  crystal: { perHectare: 12, size: [1, 4], solid: true, maxSlope: 0.8 },
  mushroom: { perHectare: 120, size: [0.2, 0.8], solid: false, maxSlope: 0.5 },
  coral: { perHectare: 80, size: [0.5, 1.5], solid: false, maxSlope: 0.5 },
  ice_shard: { perHectare: 10, size: [1.5, 6], solid: true, maxSlope: 0.8 },
  crop: { perHectare: 1400, size: [0.5, 1.2], solid: false, maxSlope: 0.2 },
};

/** Per-kind instance caps so a greedy density never melts a laptop (the Medium tier halves the walk-through kinds). */
export const SCATTER_CAP: Record<ScatterKind, number> = {
  palm: 600,
  conifer: 1500,
  broadleaf: 1200,
  birch: 1200,
  dead_tree: 300,
  bush: 2500,
  reeds: 12000,
  tall_grass: 60000,
  flowers: 12000,
  cactus: 500,
  rock: 3000,
  boulder: 400,
  crystal: 600,
  mushroom: 4000,
  coral: 3000,
  ice_shard: 500,
  crop: 20000,
};

export interface WildlifeInfo {
  /** ground animals walk; flocks fly; swarms hover; fish swim */
  motion: "walk" | "fly" | "swarm" | "swim";
  /** the player can press E to interact (pet the cat, feed the goat) */
  interactive: boolean;
  size: number;
}

export const WILDLIFE: Record<WildlifeKind, WildlifeInfo> = {
  cat: { motion: "walk", interactive: true, size: 0.45 },
  dog: { motion: "walk", interactive: true, size: 0.7 },
  goat: { motion: "walk", interactive: true, size: 0.9 },
  camel: { motion: "walk", interactive: true, size: 2.2 },
  horse: { motion: "walk", interactive: true, size: 1.8 },
  bird_flock: { motion: "fly", interactive: false, size: 0.4 },
  butterflies: { motion: "swarm", interactive: false, size: 0.1 },
  fireflies: { motion: "swarm", interactive: false, size: 0.05 },
  fish: { motion: "swim", interactive: false, size: 0.5 },
  ibis: { motion: "walk", interactive: false, size: 0.8 },
};

/** Which scatter kinds look natural in which biome (a warning, not an error, when the Architect strays). */
export const BIOME_SCATTER: Record<Biome, readonly ScatterKind[]> = {
  desert: ["palm", "bush", "reeds", "rock", "boulder", "cactus", "dead_tree", "tall_grass", "crop"],
  grassland: ["broadleaf", "birch", "bush", "tall_grass", "flowers", "rock", "boulder", "crop", "reeds"],
  forest: ["conifer", "broadleaf", "birch", "bush", "tall_grass", "flowers", "mushroom", "rock", "boulder", "dead_tree", "reeds"],
  tropical: ["palm", "broadleaf", "bush", "tall_grass", "flowers", "rock", "boulder", "coral", "reeds"],
  alpine: ["conifer", "birch", "bush", "tall_grass", "flowers", "rock", "boulder", "dead_tree"],
  volcanic: ["dead_tree", "rock", "boulder", "bush", "crystal", "tall_grass"],
  arctic: ["conifer", "dead_tree", "rock", "boulder", "ice_shard", "bush"],
  canyon: ["cactus", "bush", "dead_tree", "rock", "boulder", "tall_grass", "conifer"],
  wetland: ["reeds", "broadleaf", "dead_tree", "bush", "tall_grass", "flowers", "mushroom", "birch"],
  coast: ["palm", "broadleaf", "bush", "tall_grass", "flowers", "rock", "boulder", "coral", "reeds", "conifer"],
  lunar: ["rock", "boulder", "crystal"],
};

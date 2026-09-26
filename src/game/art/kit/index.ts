/**
 * src/game/art/kit/index.ts — the procedural SVG kit (docs/design/02 §3a, 20 §5.4): the 31 generators, the typed
 * registry `KIT`, `runKit()` and the named compositions in `recipes.ts`. Pure; relative imports only.
 */
import { compose, scatter, type ComposeP, type ScatterP } from "./gen-compose";
import { glowSprite, grainTile, hexGridPanel, type GlowSpriteP, type GrainTileP, type HexGridPanelP } from "./gen-fx";
import {
  arch,
  ashlarWall,
  awning,
  brickWall,
  column,
  facade,
  railing,
  ringStack,
  shelving,
  stairs,
  truss,
  type ArchP,
  type AwningP,
  type ColumnP,
  type FacadeP,
  type MasonryP,
  type RailingP,
  type RingStackP,
  type ShelvingP,
  type StairsP,
  type TrussP,
} from "./gen-architecture";
import { gauge, groundStrip, lectern, linkStrip, plate, type GaugeP, type GroundStripP, type LecternP, type LinkStripP, type PlateP } from "./gen-parts";
import { canopy, crystalCluster, ridgeBand, skyline, type CanopyP, type CrystalClusterP, type RidgeBandP, type SkylineP } from "./gen-silhouettes";
import { cloudBand, skyWash, type CloudBandP, type SkyWashP } from "./gen-sky";
import { bilayerTile, lipidColonnade, molecule, waterBand, type BilayerTileP, type LipidColonnadeP, type MoleculeP, type WaterBandP } from "./gen-water";
import { registerKit } from "./registry";
import type { KitGenerator, KitName } from "./types";

/** Parameter type per generator (02 §3a.2). */
export interface KitParamMap {
  skyWash: SkyWashP;
  cloudBand: CloudBandP;
  ridgeBand: RidgeBandP;
  skyline: SkylineP;
  canopy: CanopyP;
  crystalCluster: CrystalClusterP;
  column: ColumnP;
  arch: ArchP;
  ringStack: RingStackP;
  brickWall: MasonryP;
  ashlarWall: MasonryP;
  stairs: StairsP;
  railing: RailingP;
  awning: AwningP;
  facade: FacadeP;
  truss: TrussP;
  shelving: ShelvingP;
  waterBand: WaterBandP;
  bilayerTile: BilayerTileP;
  lipidColonnade: LipidColonnadeP;
  molecule: MoleculeP;
  groundStrip: GroundStripP;
  plate: PlateP;
  linkStrip: LinkStripP;
  gauge: GaugeP;
  lectern: LecternP;
  glowSprite: GlowSpriteP;
  grainTile: GrainTileP;
  hexGridPanel: HexGridPanelP;
  compose: ComposeP;
  scatter: ScatterP;
}

export const KIT: { readonly [K in KitName]: KitGenerator<KitParamMap[K]> } = {
  skyWash,
  cloudBand,
  ridgeBand,
  skyline,
  canopy,
  crystalCluster,
  column,
  arch,
  ringStack,
  brickWall,
  ashlarWall,
  stairs,
  railing,
  awning,
  facade,
  truss,
  shelving,
  waterBand,
  bilayerTile,
  lipidColonnade,
  molecule,
  groundStrip,
  plate,
  linkStrip,
  gauge,
  lectern,
  glowSprite,
  grainTile,
  hexGridPanel,
  compose,
  scatter,
};
for (const g of Object.values(KIT)) registerKit(g as KitGenerator<unknown>);

export { runKit, parseKitParams, mergeParams, kitGenerator } from "./registry";
export { resolveTokens, resolveTokenExpr, tokensIn, parseColor, toHex, toNumber, TokenError, type PaletteTokens } from "./tokens";
export { fnv1a32, hash8, mulberry32, rng, subSeed } from "./rng";
export { reprefixIds } from "./svg";
export * from "./types";

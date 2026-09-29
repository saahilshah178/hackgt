import type { StructureKind } from "../../../../contracts/world3d";
import type { KindBuilder } from "../model";
import { beacon, gate, keep, lighthouse, tower, wall } from "./defense";
import { campfire, house, hut, marketStall, tent, well, workshop } from "./dwellings";
import { arch, monolith, obelisk, pyramid, sphinx, statue, stepPyramid, stoneCircle } from "./monuments";
import { amphitheater, colonnade, library, observatory, palace, ruins, shrine, temple, tomb } from "./sacred";
import { caveMouth, greenhouse, researchStation, windmill } from "./tech";
import { aqueduct, boat, bridge, dock } from "./water";

/*
 * One builder per StructureKind. The Record type makes a missing kind a compile error, so the catalog, the contract
 * and the kit can never drift apart.
 */

export const BUILDERS: Record<StructureKind, KindBuilder> = {
  pyramid,
  step_pyramid: stepPyramid,
  obelisk,
  temple,
  colonnade,
  ruins,
  tower,
  lighthouse,
  keep,
  wall,
  gate,
  arch,
  bridge,
  house,
  hut,
  tent,
  market_stall: marketStall,
  statue,
  sphinx,
  monolith,
  stone_circle: stoneCircle,
  observatory,
  windmill,
  well,
  dock,
  boat,
  shrine,
  cave_mouth: caveMouth,
  campfire,
  research_station: researchStation,
  greenhouse,
  amphitheater,
  aqueduct,
  tomb,
  palace,
  workshop,
  library,
  beacon,
};

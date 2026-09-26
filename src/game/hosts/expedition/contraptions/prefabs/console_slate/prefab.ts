/**
 * console_slate prefab core (docs/design/20 §2.5.5). Owned by H1 (L2). Dispatches to one file per skin through the
 * static skins/index.ts, so a skin can be owned by a different lane than this core.
 */
import type { ConsoleSlateConfig } from "@/world/contraptions/console-slate.config";
import { CONTRAPTION_LIBRARY } from "@/world/library";
import type { ContraptionMeta } from "@/world/types";
import type { ConsoleSlatePose } from "@/world/contraptions/console-slate.meta";
import { definePrefab } from "../../types";
import { skinPrefabFor } from "./skins";

export const prefab = definePrefab<ConsoleSlateConfig, ConsoleSlatePose, null>({
  meta: CONTRAPTION_LIBRARY.console_slate as ContraptionMeta<ConsoleSlateConfig, ConsoleSlatePose>, // the library copy: `modes` = every implemented mode
  create: (scene, phaser, props) => skinPrefabFor(props.station.skin).create(scene, phaser, props),
});
export default prefab;

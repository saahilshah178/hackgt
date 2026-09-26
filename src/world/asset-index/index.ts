/**
 * src/world/asset-index/index.ts — the static merge of the per-namespace generated indexes (docs/design/20 §5.1).
 * Art owners regenerate only their own `<ns>.generated.ts`; this file never changes when art lands.
 */
import { ASSET_INDEX_ARCHIVE_OF_VOICES } from "./archive_of_voices.generated";
import { ASSET_INDEX_LIVING_GATE } from "./living_gate.generated";
import { ASSET_INDEX_ORRERY_TERRACES } from "./orrery_terraces.generated";
import { ASSET_INDEX_SHARED } from "./shared.generated";
import type { AssetIndex, AssetIndexEntry } from "./types";

export type { AssetIndex, AssetIndexEntry } from "./types";

export const ASSET_INDEX_BY_NAMESPACE: Readonly<Record<string, AssetIndex>> = {
  shared: ASSET_INDEX_SHARED,
  orrery_terraces: ASSET_INDEX_ORRERY_TERRACES,
  living_gate: ASSET_INDEX_LIVING_GATE,
  archive_of_voices: ASSET_INDEX_ARCHIVE_OF_VOICES,
};

export const ASSET_INDEX: AssetIndex = {
  ...ASSET_INDEX_SHARED,
  ...ASSET_INDEX_ORRERY_TERRACES,
  ...ASSET_INDEX_LIVING_GATE,
  ...ASSET_INDEX_ARCHIVE_OF_VOICES,
};

/** "orrery_terraces" from "orrery_terraces.part.ring_gate_outer_ring". */
export function namespaceOf(key: string): string {
  const dot = key.indexOf(".");
  return dot < 0 ? key : key.slice(0, dot);
}
/** "part" from "orrery_terraces.part.ring_gate_outer_ring". */
export function groupOf(key: string): string | null {
  return key.split(".")[1] ?? null;
}
export function assetEntry(key: string): AssetIndexEntry | undefined {
  return ASSET_INDEX[key];
}
export function assetExists(key: string): boolean {
  return key in ASSET_INDEX;
}
/** Anchor (design px) of an asset, or null when the asset or anchor is unknown. */
export function assetAnchor(key: string, anchor: string): readonly [number, number] | null {
  return ASSET_INDEX[key]?.anchors[anchor] ?? null;
}

/**
 * Entry shape of the per-namespace generated asset index (docs/design/20 §5.1, R1): what validators need to know
 * about an asset without touching the filesystem. Written by `pnpm art:build` from each manifest entry.
 */
export interface AssetIndexEntry {
  ns: string; // "shared" | a biome id
  kind: "svg" | "puppet" | "atlas";
  width: number; // design units (atlas: displayWidth)
  height: number;
  anchors: Readonly<Record<string, readonly [number, number]>>; // design units, from id="anchor-<name>"
  source: string; // "hero" | "kit:<generator>" | "rig:<body>" (AssetSource)
  zone: string; // ZoneTag: "all" or a zone id (per-zone residency, §5.7)
  poses?: readonly string[]; // atlas entries: the packed pose names
  anims?: readonly string[]; // puppet entries: the PuppetAnim ids (R1 checks idle/talk/cue)
}
export type AssetIndex = Readonly<Record<string, AssetIndexEntry>>;

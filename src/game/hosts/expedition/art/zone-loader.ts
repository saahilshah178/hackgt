/**
 * art/zone-loader.ts (H1) — the art seam the host codes against (docs/design/20 §5.7). Two implementations:
 * - StubZoneLoader (./stub-loader.ts): kit-coloured stand-ins painted at runtime (no files), used until the art lane's
 *   manifest loader ships and whenever a manifest is missing;
 * - the manifest loader (src/game/art/manifest-loader.ts, A1), adapted to this interface in ./select-loader.ts.
 * Residency (A4): only "all" + the current zone's set are resident; `unloadZone` runs after the transition wipe.
 */
import type Phaser from "phaser";
import type { WorldOverlay } from "../../../../contracts/world";
import type { FrameAnchors } from "../actors/costume";

export interface XYPoint {
  x: number;
  y: number;
}
export interface AssetInfo {
  key: string;
  kind: "svg" | "atlas" | "puppet";
  w: number; // design units
  h: number;
  pivot: readonly [number, number];
  anchors: Readonly<Record<string, XYPoint>>;
  /** scale to apply to an Image of this texture to get design units (1 / k) */
  scale: number;
}
export interface RigInfo {
  key: string;
  texture: string; // Phaser texture key; frames are pose names
  poses: ReadonlySet<string>;
  anchors(pose: string): FrameAnchors | null;
  displayW: number;
  displayH: number;
  /** sprite scale so a frame shows at displayW × displayH */
  scale: number;
}
export interface ZoneArtLoader {
  readonly name: string;
  loadZone(scene: Phaser.Scene, world: WorldOverlay, zoneId: string, onProgress?: (fraction: number) => void): Promise<void>;
  unloadZone(scene: Phaser.Scene, world: WorldOverlay, prevZoneId: string, nextZoneId: string): void;
  /** the Phaser texture key of a resident asset, or null */
  texture(key: string): string | null;
  info(key: string): AssetInfo | null;
  rig(key: string): RigInfo | null;
  /** resident texture count owned by this loader */
  resident(): number;
  destroy(scene: Phaser.Scene): void;
}

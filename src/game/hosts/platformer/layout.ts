/**
 * Pure layout helpers for the Platformer host (P10.2). No Phaser/DOM dependency, so this is unit
 * tested directly (LIBRARY §1 platformer: "a side-scrolling strip", one chunk per encounter,
 * left -> right). Kept separate from PlatformerScene.ts so the math is checkable without booting Phaser.
 */

/** Width in world pixels of one ground segment (one prefab chunk from `buildRooms`). */
export const SEGMENT_WIDTH = 300;

/** Ground top y (world coords); everything below this to `GROUND_THICKNESS` is solid ground. */
export const GROUND_Y = 380;
export const GROUND_THICKNESS = 40;

/** The left edge x of the i-th segment. */
export function segmentX(index: number, width: number = SEGMENT_WIDTH): number {
  return index * width;
}

/** The horizontal center of the i-th segment: where its ground-standing obstacle/prop is placed. */
export function segmentCenterX(index: number, width: number = SEGMENT_WIDTH): number {
  return index * width + width / 2;
}

/** Total strip width for `count` segments, used for camera/world bounds. */
export function totalStripWidth(count: number, width: number = SEGMENT_WIDTH): number {
  return count * width;
}

/** The segment index whose [x, x+width) range contains world x, clamped to the strip. */
export function segmentIndexAt(x: number, count: number, width: number = SEGMENT_WIDTH): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.floor(x / width)));
}

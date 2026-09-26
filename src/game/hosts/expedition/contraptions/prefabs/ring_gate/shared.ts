/**
 * ring_gate prefab shared helpers (docs/design/20 §2.5.5, §7). Owned by KA (L6) with the prefab core; skin files
 * import it read-only. The drawing and playback primitives are the lane's common kit (emitter_rail/shared.ts, also
 * KA's); this module re-exports them plus the ring geometry the skins place parts on.
 */
export { stubBox, type StubBoxOptions } from "../_stub";
export {
  Anims,
  chevron,
  dashedLine,
  drawLectern,
  easeInOutSine,
  easeOutCubic,
  fillPoly,
  hexOf,
  linear,
  mathArc,
  mix,
  orreryColors,
  setAnchor,
  softStroke,
  waitMs,
  type OrreryColors,
} from "../emitter_rail/shared";

export const ARCHETYPE_ID = "ring_gate";
/** Kept for the W0 seam's callers. */
export const STUB_COLOR = 0x265c6a;

/** Screen (Phaser, clockwise) angle of the notch for a phase: 6 o'clock (π/2) turned clockwise by the phase. */
export function notchScreenAngle(phase: number): number {
  return Math.PI / 2 + phase;
}

/** Roman tally strokes for tooth k (0 → a ring, 1–4 → strokes, 5 → V): what the build would engrave. */
export function tallyStrokes(k: number): "ring" | 1 | 2 | 3 | 4 | "V" {
  if (k <= 0) return "ring";
  if (k >= 5) return "V";
  return k as 1 | 2 | 3 | 4;
}

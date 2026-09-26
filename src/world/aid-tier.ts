import type { AidTier, HintsUsed } from "./types";

/**
 * The one definition of the aid tier (docs/design/20 §2.5.1, amendment 10):
 * aidTier = min(2, max(hintsUsed, failedVerifies > 0 ? 1 : 0)).
 * Tier 0 = no help yet; tier 1 = after the first hint or the first failed Verify; tier 2 = after the second hint.
 * It reaches pose(), panelStatic() and panelLive() so hints and misses change the world, not just the text.
 */
export function aidTierOf(hintsUsed: HintsUsed, failedVerifies: number): AidTier {
  const fromFails = failedVerifies > 0 ? 1 : 0;
  return Math.min(2, Math.max(hintsUsed, fromFails)) as AidTier;
}

/** Clamps any count to the HintsUsed range (the runner's hint counter can be read as a plain number). */
export function toHintsUsed(n: number): HintsUsed {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(3, Math.floor(n)) as HintsUsed;
}

/** True when a card or overlay gated at `tier` is unlocked at `current`. */
export function tierUnlocked(tier: AidTier, current: AidTier): boolean {
  return current >= tier;
}

/**
 * art/palette-shim.ts (H1) — palette tokens for the host's drawing, from A1's palette module (shared first, the biome
 * overriding), plus a numeric token helper for Phaser tints.
 */
import { paletteTokensFor } from "../../../art/palette";

export function paletteFor(biome: string): Readonly<Record<string, string>> {
  return paletteTokensFor(biome);
}
/** "#rrggbb" token → 0xrrggbb (fallback when missing or not a plain hex). */
export function tokenInt(palette: Readonly<Record<string, string>>, token: string, fallback = 0x8a96a0): number {
  const v = palette[token];
  return v && /^#[0-9a-fA-F]{6}$/.test(v) ? parseInt(v.slice(1), 16) : fallback;
}

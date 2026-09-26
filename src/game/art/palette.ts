/**
 * src/game/art/palette.ts — the ONLY place colours are assembled (docs/design/20 §5.7, bible §2).
 *
 * `BIOME_PALETTES[ns]` = the shared tokens (UI, fx, the rig recolour defaults) overlaid by the namespace's own
 * token file (`palettes/<ns>.ts`), so a biome can override any shared token. `UI_TOKENS` is bible §2.3 (identical in
 * every game). The Phaser side reads numeric colours through `tokenNumber()`; the art build resolves `{{tokens}}`
 * against `paletteTokensFor(ns)`.
 */
import { parseColor, resolveTokenExpr, toHex, toNumber, type PaletteTokens } from "./kit/tokens";
import { ARCHIVE_OF_VOICES_PALETTE } from "./palettes/archive_of_voices";
import { LIVING_GATE_PALETTE } from "./palettes/living_gate";
import { ORRERY_TERRACES_PALETTE } from "./palettes/orrery_terraces";
import { SHARED_PALETTE } from "./palettes/shared";

export type BiomeId = "orrery_terraces" | "living_gate" | "archive_of_voices";
export const BIOME_IDS: readonly BiomeId[] = ["orrery_terraces", "living_gate", "archive_of_voices"];
/** Token path → "#rrggbb" or "rgba(...)" (assignable to the host's `BiomePalette`). */
export type BiomePalette = PaletteTokens;

const UI_KEYS = Object.keys(SHARED_PALETTE.tokens).filter((k) => /^(ui|fn|orb|pencil)\./.test(k));
/** Bible §2.3: the instrument panel's tokens, identical in all games. */
export const UI_TOKENS: PaletteTokens = Object.freeze(Object.fromEntries(UI_KEYS.map((k) => [k, SHARED_PALETTE.tokens[k]])));

export const SHARED_TOKENS: PaletteTokens = SHARED_PALETTE.tokens;

export const BIOME_PALETTES: Readonly<Record<BiomeId, BiomePalette>> = Object.freeze({
  orrery_terraces: Object.freeze({ ...SHARED_PALETTE.tokens, ...ORRERY_TERRACES_PALETTE.tokens }),
  living_gate: Object.freeze({ ...SHARED_PALETTE.tokens, ...LIVING_GATE_PALETTE.tokens }),
  archive_of_voices: Object.freeze({ ...SHARED_PALETTE.tokens, ...ARCHIVE_OF_VOICES_PALETTE.tokens }),
});

export function isBiomeId(ns: string): ns is BiomeId {
  return (BIOME_IDS as readonly string[]).includes(ns);
}

/** The token table a namespace's art resolves against: shared for `shared` (and unknown `gen_*` namespaces). */
export function paletteTokensFor(ns: string): PaletteTokens {
  return isBiomeId(ns) ? BIOME_PALETTES[ns] : SHARED_PALETTE.tokens;
}

/** "#rrggbb" for a token expression (`stone.lit`, `stone.lit|haze:0.4`); throws on an unknown token. */
export function tokenHex(ns: string, expr: string): string {
  return toHex(resolveTokenExpr(expr, paletteTokensFor(ns)));
}
/** 0xRRGGBB for Phaser tints; `fallback` when the token is unknown (never throws at runtime). */
export function tokenNumber(ns: string, expr: string, fallback = 0xffffff): number {
  try {
    return toNumber(resolveTokenExpr(expr, paletteTokensFor(ns)));
  } catch {
    return fallback;
  }
}
/** Alpha of a token (rgba tokens), 1 for plain hex. */
export function tokenAlpha(ns: string, token: string): number {
  const raw = paletteTokensFor(ns)[token];
  return raw ? (parseColor(raw)?.a ?? 1) : 1;
}

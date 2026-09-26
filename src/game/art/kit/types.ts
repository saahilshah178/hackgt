/**
 * src/game/art/kit/types.ts — the procedural SVG kit contract (docs/design/02 §3a.1, 20 §5.4).
 *
 * Library-code rules: relative imports only; no fs, DOM, Math.random or Date. The same (params, seed) gives
 * byte-identical output (`art:build --check` relies on it). Generators emit `{{token.path}}` paint (resolved by
 * `resolveTokens()`), never raw hex, and never `<text>`: spec-independent labels go in `engrave[]` (02 §3e).
 */
import { z } from "zod";

/**
 * A palette token path such as "stone.lit", optionally followed by modifiers resolved at build time:
 * `|haze:0.4` (mix toward the `haze` token), `|mix:<token>:<t>`, `|dim:<t>` (toward `shadow`), `|light:<t>`
 * (toward white), `|alpha:<a>` (multiplies the paint opacity). Emitted as {{stone.lit|haze:0.4}}.
 */
export type Tok = string;
export const TOK_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*(\|[a-z]+(:[a-z0-9_.]+)*)*$/;
export const TokZ = z.string().regex(TOK_PATTERN, "tokens look like stone.lit or stone.lit|haze:0.4");

/** Three-tone ramp for the upper-left key light (bible §5.3). */
export const RampZ = z.strictObject({ lit: TokZ, base: TokZ, shade: TokZ });
export type Ramp = z.infer<typeof RampZ>;

/** Finish defaults (critique F2), baked into every generator's output unless disabled. */
export const FinishZ = z.strictObject({
  ao: z.boolean(), // AO gradient at the base: {{shadow}} at 30 % → 0 over 0.12·h
  rim: z.boolean(), // a 1.5 px rim-light stroke on upper-left edges in the ramp's lit token
  haze: z.number().min(0).max(1), // 0..1 lerp of every fill toward {{haze}} (L1 0.4, L2 0.2)
});
export type Finish = z.infer<typeof FinishZ>;
export const FINISH_DEFAULT: Finish = { ao: true, rim: true, haze: 0 };

export type EngraveFace = "caps" | "serif" | "serif_italic";
export interface EngraveReq {
  id: string;
  text: string;
  face: EngraveFace;
  size: number;
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  fill: Tok;
  rotate: number;
}

export interface KitResult {
  svg: string; // <svg viewBox="0 0 w h" width=w height=h> with {{tokens}}, no <text>
  w: number; // design size, world px (1 H = 170)
  h: number;
  pivot: [number, number]; // fractions
  anchors: Record<string, [number, number]>; // design px; names are Id-legal
  tileWidth: number | null; // non-null ⇒ left/right edges match exactly (seamless in X)
  engrave: EngraveReq[]; // spec-independent labels only (02 §3e); empty for PDF games
  /** Extra textures a generator emits beside the main one, written as `<key>.<suffix>` (waterBand `a`/`b`
   *  scroll pair, the arc_meter `needle`). Suffixes are Id-legal. */
  extras?: Record<string, KitResult>;
}

export interface KitGenerator<P> {
  name: KitName;
  schema: z.ZodType<P>; // validates a fragment entry's params (merged over `defaults`); base of writerConfigSchema (02 §6)
  defaults: P; // tokens default to bible §2 names; biome palettes remap them
  generate(params: P, seed: number): KitResult;
}

export const KIT_NAMES = [
  "skyWash", "cloudBand", "ridgeBand", "skyline", "canopy", "crystalCluster", "column", "arch",
  "ringStack", "brickWall", "ashlarWall", "stairs", "railing", "awning", "facade", "truss", "shelving",
  "waterBand", "bilayerTile", "lipidColonnade", "molecule", "groundStrip", "plate", "linkStrip", "gauge",
  "lectern", "glowSprite", "grainTile", "hexGridPanel", "compose", "scatter",
] as const;
export type KitName = (typeof KIT_NAMES)[number];
export const KitNameZ = z.enum(KIT_NAMES);

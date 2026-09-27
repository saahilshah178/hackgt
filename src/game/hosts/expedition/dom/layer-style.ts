/**
 * dom/layer-style.ts (pure, H3) — how the reduced DOM host draws a parallax layer's blend (§2.11 frame budget). A CSS
 * `mix-blend-mode` on the 13 000 px light layers that move every frame cost the fallback about 30 fps (measured: 25 → 58
 * on trig z1 at 1600 × 900), so the DOM host draws every layer with normal compositing and trades the blend for a lower
 * alpha: additive light and multiplied dapple read as a soft veil instead. The WebGL host keeps the real blend modes.
 */
export type LayerBlend = "normal" | "add" | "multiply" | "screen";

/** Alpha multiplier that stands in for a blend mode under normal compositing. */
export const BLEND_ALPHA: Readonly<Record<LayerBlend, number>> = { normal: 1, add: 0.55, screen: 0.6, multiply: 0.5 };

/** The opacity the DOM host gives a layer (before the segment crossfade weight). */
export function domLayerAlpha(blend: LayerBlend | undefined, alpha: number): number {
  const a = Math.max(0, Math.min(1, alpha));
  return Math.round(a * BLEND_ALPHA[blend ?? "normal"] * 1000) / 1000;
}

"use client";

import type { FnColor } from "@/world/types";

/**
 * A value chip (§3.2, bible §3.5): dark `ui.card.deep` box, 2 px border in the function's colour, 30–34 px text
 * (≥ 22 px at 1280 w), centred on the card's LEFT edge at y(value) so it overhangs the panel edge into the world by
 * half its width: the bridge between panel and world. `top` is the chip centre in card px (graph-math chipY).
 */
export function ValueChip({ text, color, top, label }: { text: string; color: FnColor; top: number; label?: string }) {
  return (
    <div className="xp-chip" data-color={color} data-testid="value-chip" style={{ top }} aria-hidden={label ? undefined : true} aria-label={label}>
      {text}
    </div>
  );
}

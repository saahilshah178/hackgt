"use client";

import { useId } from "react";

/**
 * The panel's hex-grid texture (bible §3.2): flat-top hexes about 40 px across, 1 px `ui.hex` strokes, drawn as one
 * SVG <pattern> over the whole panel. Decorative: aria-hidden, no pointer events.
 */
export function HexGrid({ size = 40, className = "xp-hexgrid", stroke = "var(--ui-hex)" }: { size?: number; className?: string; stroke?: string }) {
  const id = useId().replace(/:/g, "");
  const w = size;
  const h = (size * Math.sqrt(3)) / 2;
  const d = `M0 ${h / 2} L${w / 4} 0 L${(3 * w) / 4} 0 L${w} ${h / 2} L${(3 * w) / 4} ${h} L${w / 4} ${h} Z M${w} ${h / 2} L${1.5 * w} ${h / 2}`;
  return (
    <svg className={className} aria-hidden focusable="false">
      <defs>
        <pattern id={`hex-${id}`} width={1.5 * w} height={h} patternUnits="userSpaceOnUse">
          <path d={d} fill="none" stroke={stroke} strokeWidth={1} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#hex-${id})`} />
    </svg>
  );
}

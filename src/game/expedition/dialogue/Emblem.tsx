"use client";
/**
 * src/game/expedition/dialogue/Emblem.tsx (S1) — the speaker emblem (bible §3.9): a dark circle with three concentric
 * rings, the inner two broken like a labyrinth, and the speaker's glyph at the centre. Decorative (aria-hidden):
 * the speaker's name is printed as text beside it.
 */
import type { Emblem as EmblemSpec } from "../../../contracts/world";
import { GLYPH_BOX, emblemRings, glyphPath } from "./emblem-glyphs";

const FALLBACK: EmblemSpec = { glyph: "labyrinth", ring: "#E8F6F8", accent: "#9FE6F2", gaps: 2 };

export interface EmblemProps {
  emblem: EmblemSpec | null;
  size?: number;
  /** speakers without their own emblem use the guide's, desaturated (§1.3 Cast.speakers) */
  desaturate?: boolean;
  className?: string;
}

export function Emblem({ emblem, size = 64, desaturate = false, className }: EmblemProps) {
  const e = emblem ?? FALLBACK;
  const rings = emblemRings(size, e.gaps);
  const glyphScale = (size * 0.36) / GLYPH_BOX;
  const glyphOffset = (size - GLYPH_BOX * glyphScale) / 2;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      focusable="false"
      style={desaturate ? { filter: "grayscale(0.85)" } : undefined}
      data-testid="dialogue-emblem"
      data-glyph={e.glyph}
    >
      <circle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill="#0B1F27" stroke="rgba(159,230,242,0.45)" strokeWidth={1} />
      {rings.map((ring) =>
        ring.arcs.map((d, i) => (
          <path
            key={`${ring.role}-${i}`}
            d={d}
            fill="none"
            stroke={ring.role === "outer" ? "#FFFFFF" : e.ring}
            strokeWidth={ring.role === "outer" ? 1.5 : 2}
            strokeLinecap="round"
          />
        )),
      )}
      <g transform={`translate(${glyphOffset} ${glyphOffset}) scale(${glyphScale})`}>
        <path d={glyphPath(e.glyph)} fill="none" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <circle cx={size / 2} cy={size * 0.04 + 3} r={2} fill={e.accent} />
    </svg>
  );
}

/** The (i) info button's face: a white "i" in a double ring (bible §3.9). */
export function InfoGlyph({ size = 64, warm = false }: { size?: number; warm?: boolean }) {
  const c = size / 2;
  const ring = warm ? "#E7A08C" : "#FFFFFF";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
      <circle cx={c} cy={c} r={c - 2} fill="#0B1F27" stroke={ring} strokeWidth={2} />
      <circle cx={c} cy={c} r={c - 8} fill="none" stroke={ring} strokeOpacity={0.6} strokeWidth={1.5} />
      <circle cx={c} cy={c - size * 0.16} r={size * 0.045} fill="#FFFFFF" />
      <rect x={c - size * 0.04} y={c - size * 0.07} width={size * 0.08} height={size * 0.26} rx={size * 0.03} fill="#FFFFFF" />
    </svg>
  );
}

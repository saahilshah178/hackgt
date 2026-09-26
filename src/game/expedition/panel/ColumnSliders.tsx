"use client";

import { fmtNumber } from "@/world/graph-math";
import { OrbGlyph } from "./OrbPalette";

/**
 * Vertical slider columns (§3.2, bible §3.7; the f·g patch bridge, function_world, post-demo): tall narrow columns
 * under x positions of interest, each with an orb knob that slides vertically and orange "−" / "+" buttons. Each
 * column is a keyboard `role="slider"` (↑/↓ one step, Shift × 10).
 */
export function ColumnSliders({
  columns,
  min,
  max,
  step,
  onChange,
}: {
  columns: readonly { key: string; label: string; value: number }[];
  min: number;
  max: number;
  step: number;
  onChange: (key: string, value: number) => void;
}) {
  const clampV = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  return (
    <div className="xp-cols" role="group" aria-label="Slider columns">
      {columns.map((c) => {
        const u = max > min ? (c.value - min) / (max - min) : 0;
        return (
          <div key={c.key} className="xp-col">
            <div
              className="xp-col-track"
              role="slider"
              tabIndex={0}
              aria-label={c.label}
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={c.value}
              aria-valuetext={fmtNumber(c.value, 1)}
              onKeyDown={(e) => {
                const k = e.key === "ArrowUp" || e.key === "ArrowRight" ? 1 : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -1 : 0;
                if (!k) return;
                e.preventDefault();
                onChange(c.key, clampV(c.value + k * step * (e.shiftKey ? 10 : 1)));
              }}
            >
              <div style={{ position: "absolute", left: "50%", top: `${(1 - u) * 100}%`, transform: "translate(-50%, -50%)" }}>
                <OrbGlyph fill="full" size={34} />
              </div>
            </div>
            <div className="xp-col-btns">
              <button type="button" className="xp-col-btn" aria-label={`${c.label}: decrease`} onClick={() => onChange(c.key, clampV(c.value - step))}>
                −
              </button>
              <button type="button" className="xp-col-btn" aria-label={`${c.label}: increase`} onClick={() => onChange(c.key, clampV(c.value + step))}>
                +
              </button>
            </div>
            <span className="xp-hint">{c.label}</span>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { ProbeSpec } from "@/contracts/world";
import { formatProbe } from "@/world/graph-math";
import { SETTLE_MS, scrubKeyOf, settleValue, stepValue, valueAtFraction, type ScalarInput } from "./controls/scrub.logic";
import { useElementSize, usePanelMetrics } from "./metrics";

/** Keeps an end label inside its box: centred on its tick unless that would spill past an edge. */
export function edgeAnchor(x: number, halfWidth: number, width: number): { x: number; textAnchor: "start" | "middle" | "end" } {
  if (x + halfWidth > width - 4) return { x: width - 4, textAnchor: "end" };
  if (x - halfWidth < 4) return { x: 4, textAnchor: "start" };
  return { x, textAnchor: "middle" };
}

export function fractionOf(value: number, r: Pick<ScalarInput, "min" | "max">): number {
  const span = r.max - r.min;
  return span > 0 ? Math.min(1, Math.max(0, (value - r.min) / span)) : 0;
}

export interface ScrubberProps {
  range: ScalarInput;
  value: number;
  /** PanelLive.readout when the meta supplies one ("π/2 < θ < π", "stage 3 · flip out"); else formatProbe */
  readout?: string | null;
  /** the orange tab ("T", "θ", "YEAR") */
  symbol: string;
  /** accessible name ("period T", "record year") */
  label: string;
  probe?: ProbeSpec | null;
  disabled?: boolean;
  describedBy?: string;
  /** settled = pointer released, or 300 ms after the last key (§3.2) */
  onChange: (value: number, settled: boolean) => void;
  testId?: string;
}

function Knob() {
  return (
    <svg className="xp-knob" viewBox="0 0 28 34" aria-hidden focusable="false">
      <path d="M14 1 C 17 8, 26 15, 26 22 A 12 12 0 1 1 2 22 C 2 15, 11 8, 14 1 Z" fill="var(--ui-accent)" stroke="var(--ui-accent-deep)" strokeWidth={2} />
      <path d="M14 7 C 16 12, 21 17, 21 22" fill="none" stroke="var(--ui-accent-hi)" strokeWidth={2} strokeLinecap="round" opacity={0.8} />
    </svg>
  );
}

/**
 * The orange input scrubber's ruler row (§3.2, bible §3.4): a dark ruler strip whose plot x-range matches every
 * card's (the metrics insets), ticks from the input's AxisModel or the probe (stage stops as labelled detents), the
 * orange teardrop knob, and to its LEFT (overhanging into the world) the orange input tab and the dark readout box.
 * `role="slider"` with aria-valuemin/max/now/valuetext; ←/→ one step, Shift × 10, PgUp/PgDn one major tick,
 * Home/End; `settled` 300 ms after the last key or on pointer up. The orange line across the cards is drawn by the
 * panel at the same x (fractionOf).
 */
export function Scrubber({ range, value, readout, symbol, label, probe = null, disabled = false, describedBy, onChange, testId = "scrubber" }: ScrubberProps) {
  const m = usePanelMetrics();
  const [ref, size] = useElementSize<HTMLDivElement>({ w: 640, h: 64 });
  const [dragging, setDragging] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  const w = size.w;
  const h = size.h;
  const x0 = m.insetL;
  const x1 = Math.max(x0 + 10, w - m.insetR);
  const xOf = (v: number) => x0 + fractionOf(v, range) * (x1 - x0);
  const text = readout ?? formatProbe(value, { format: range.format, unit: probe?.unit ?? "", stops: probe?.stops ?? [], step: range.step });
  const fs = m.fsTick;
  const majors = range.ticks.filter((t) => t.major && t.v >= range.min - 1e-9 && t.v <= range.max + 1e-9);
  const room = (x1 - x0) / Math.max(1, majors.length - 1);
  const longest = majors.reduce((n, t) => Math.max(n, t.label?.length ?? 0), 1);
  const every = Math.max(1, Math.ceil((fs * (0.62 * longest + 0.9)) / Math.max(1, room)));

  const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const u = (e.clientX - r.left - x0) / Math.max(1, x1 - x0);
    return valueAtFraction(u, range);
  };
  const settleSoon = (v: number) => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      onChange(settleValue(latest.current ?? v, probe), true);
    }, SETTLE_MS);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const action = scrubKeyOf(e.key);
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    const next = stepValue(value, action, e.shiftKey, range);
    latest.current = next;
    onChange(next, false);
    settleSoon(next);
  };

  return (
    <div className="xp-ruler-row" data-testid={`${testId}-row`}>
      <div className="xp-readout-group" aria-hidden>
        <div className="xp-input-tab" data-testid={`${testId}-tab`}>
          {symbol}
        </div>
        <div className="xp-readout" data-testid={`${testId}-readout`}>
          {text}
        </div>
      </div>
      <div
        ref={ref}
        className="xp-ruler"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={range.min}
        aria-valuemax={range.max}
        aria-valuenow={Number(value.toFixed(6))}
        aria-valuetext={text}
        aria-disabled={disabled || undefined}
        aria-describedby={describedBy}
        data-testid={testId}
        data-dragging={dragging || undefined}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          if (disabled || e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.focus();
          setDragging(true);
          const v = fromPointer(e);
          latest.current = v;
          onChange(v, false);
        }}
        onPointerMove={(e) => {
          if (!dragging) return;
          const v = fromPointer(e);
          if (v !== latest.current) {
            latest.current = v;
            onChange(v, false);
          }
        }}
        onPointerUp={(e) => {
          if (!dragging) return;
          setDragging(false);
          e.currentTarget.releasePointerCapture(e.pointerId);
          onChange(settleValue(latest.current, probe), true);
        }}
        onPointerCancel={() => {
          if (dragging) {
            setDragging(false);
            onChange(settleValue(latest.current, probe), true);
          }
        }}
      >
        {size.measured ? (
          <>
            <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden focusable="false">
              {range.ticks
                .filter((t) => t.v >= range.min - 1e-9 && t.v <= range.max + 1e-9)
                .map((t) => (
                  <line key={`t${t.v}`} x1={xOf(t.v)} x2={xOf(t.v)} y1={4} y2={t.major ? 18 : 11} stroke="var(--ui-line)" strokeWidth={t.major ? 2 : 1.5} />
                ))}
              {majors.map((t, i) =>
                t.label && (i % every === 0 || i === majors.length - 1) ? (
                  <text
                    key={`l${t.v}`}
                    className="xp-svg-text"
                    {...edgeAnchor(xOf(t.v), (t.label.length * 0.62 * fs) / 2, w)}
                    y={Math.min(h - 8, 18 + fs + 4)}
                    fontSize={fs}
                    fontWeight={700}
                  >
                    {t.label}
                  </text>
                ) : null,
              )}
            </svg>
            <div style={{ position: "absolute", left: xOf(value), top: 0 }}>
              <Knob />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

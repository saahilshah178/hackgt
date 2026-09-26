"use client";

import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

/**
 * Pixel metrics shared by every card, the scrub line and the ruler, so a card's plot x-range and the ruler's x-range
 * are the same pixels (the orange line crosses every card at one x). Derived from the panel's measured width; the
 * floors keep projector legibility at 1280 × 720 (tick labels ≥ 18 px, chips ≥ 22 px, readout ≥ 28 px).
 */
export interface PanelMetrics {
  width: number;
  fsTick: number;
  fsChip: number;
  fsReadout: number;
  /** left gutter of every plot (y tick labels) and of the ruler */
  insetL: number;
  /** right gutter of every plot (arrowhead, far x label) and of the ruler */
  insetR: number;
}

const clampN = (lo: number, v: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function metricsFor(panelWidth: number): PanelMetrics {
  const w = panelWidth > 0 ? panelWidth : 806;
  const fsTick = Math.round(clampN(18, 0.0275 * w, 24));
  return {
    width: w,
    fsTick,
    fsChip: Math.round(clampN(22, 0.039 * w, 34)),
    fsReadout: Math.round(clampN(28, 0.044 * w, 36)),
    insetL: Math.round(fsTick * 2.7 + 14),
    insetR: Math.round(fsTick * 1.3 + 14),
  };
}

export const PanelMetricsContext = createContext<PanelMetrics>(metricsFor(806));

export function usePanelMetrics(): PanelMetrics {
  return useContext(PanelMetricsContext);
}

/**
 * Content-box size of an element (ResizeObserver); `fallback` until measured. `size.measured` stays false on the
 * server and during hydration, so measured SVG geometry (float trigonometry that differs in the last digit between
 * Node and the browser) is only rendered on the client and never causes a hydration mismatch.
 */
export function useElementSize<T extends HTMLElement>(fallback: { w: number; h: number }): [RefObject<T | null>, { w: number; h: number; measured: boolean }] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ ...fallback, measured: false });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setSize((s) => (s.measured && Math.abs(s.w - w) < 0.5 && Math.abs(s.h - h) < 0.5 ? s : { w, h, measured: true }));
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

/** Panel typography and metrics for panel parts rendered outside an InstrumentPanel (the dev gallery). */
export function PanelScope({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  const [ref, size] = useElementSize<HTMLDivElement>({ w: 806, h: 600 });
  return (
    <div ref={ref} className={`xp-scope${className ? ` ${className}` : ""}`} style={style}>
      <PanelMetricsContext.Provider value={metricsFor(size.w)}>{children}</PanelMetricsContext.Provider>
    </div>
  );
}

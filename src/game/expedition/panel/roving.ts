"use client";

import { useCallback, useRef, useState, type KeyboardEvent } from "react";

/**
 * Roving focus for a list of panel items (§3.5 key map): W / ↑ previous, S / ↓ next (← / → too when `horizontal`),
 * Home / End, 1–9 quick-select (calls `onQuick`). One item is tabbable (tabIndex 0), the rest are -1.
 */
export function useRoving(count: number, opts: { horizontal?: boolean; onQuick?: (index: number) => void; onMove?: (index: number) => void } = {}) {
  const [index, setIndex] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);
  const { horizontal = false, onQuick, onMove } = opts;

  const focusAt = useCallback(
    (i: number) => {
      if (count <= 0) return;
      const next = Math.max(0, Math.min(count - 1, i));
      setIndex(next);
      refs.current[next]?.focus();
      onMove?.(next);
    },
    [count, onMove],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const k = e.key;
      const prev = k === "ArrowUp" || k === "w" || k === "W" || (horizontal && (k === "ArrowLeft" || k === "a" || k === "A"));
      const next = k === "ArrowDown" || k === "s" || k === "S" || (horizontal && (k === "ArrowRight" || k === "d" || k === "D"));
      if (prev) {
        e.preventDefault();
        focusAt(index - 1);
      } else if (next) {
        e.preventDefault();
        focusAt(index + 1);
      } else if (k === "Home") {
        e.preventDefault();
        focusAt(0);
      } else if (k === "End") {
        e.preventDefault();
        focusAt(count - 1);
      } else if (/^[1-9]$/.test(k) && onQuick) {
        const i = Number(k) - 1;
        if (i < count) {
          e.preventDefault();
          focusAt(i);
          onQuick(i);
        }
      }
    },
    [count, focusAt, horizontal, index, onQuick],
  );

  const itemProps = useCallback(
    (i: number) => ({
      ref: (el: HTMLElement | null) => {
        refs.current[i] = el;
      },
      tabIndex: i === Math.min(index, Math.max(0, count - 1)) ? 0 : -1,
      onFocus: () => {
        if (i !== index) setIndex(i);
        onMove?.(i);
      },
    }),
    [count, index, onMove],
  );

  return { index, setIndex, focusAt, onKeyDown, itemProps };
}

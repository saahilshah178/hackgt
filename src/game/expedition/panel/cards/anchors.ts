"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

export interface AnchorBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
  cx: number;
  cy: number;
}

/**
 * Boxes (relative to `container`) of every descendant carrying `data-anchor="<key>"`, re-measured when `dep`
 * changes and on resize. Cable, tube and arrow overlays draw between them.
 */
export function useAnchors(container: RefObject<HTMLElement | null>, dep: string): ReadonlyMap<string, AnchorBox> {
  const [boxes, setBoxes] = useState<ReadonlyMap<string, AnchorBox>>(new Map());
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const read = () => {
      const base = root.getBoundingClientRect();
      const out = new Map<string, AnchorBox>();
      root.querySelectorAll<HTMLElement>("[data-anchor]").forEach((el) => {
        const r = el.getBoundingClientRect();
        const left = r.left - base.left + root.scrollLeft;
        const top = r.top - base.top + root.scrollTop;
        out.set(el.dataset.anchor ?? "", { left, right: left + r.width, top, bottom: top + r.height, cx: left + r.width / 2, cy: top + r.height / 2 });
      });
      setBoxes(out);
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(root);
    return () => ro.disconnect();
  }, [container, dep]);
  return boxes;
}

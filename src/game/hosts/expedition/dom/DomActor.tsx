"use client";
/**
 * dom/DomActor.tsx (H1) — the protagonist (or an NPC) as a CSS sprite of the rig sheet (docs/design/20 §2.2 reduced DOM
 * host). Position, frame and flip are written imperatively by the host's rAF loop through `setActor` (no React state
 * per frame).
 */
import { forwardRef } from "react";
import { RIG_DISPLAY_H, RIG_DISPLAY_W } from "../actors/costume";
import type { RigSheet } from "./stub-urls";

export const DomActor = forwardRef<HTMLDivElement, { sheet: RigSheet; label: string; testId?: string }>(function DomActor({ sheet, label, testId }, ref) {
  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      data-testid={testId}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: RIG_DISPLAY_W,
        height: RIG_DISPLAY_H,
        backgroundImage: `url(${sheet.url})`,
        backgroundRepeat: "no-repeat",
        willChange: "transform",
        zIndex: 75,
      }}
    />
  );
});

/** Writes an actor's position (feet), frame and facing into its element. */
export function setActor(el: HTMLDivElement | null, sheet: RigSheet, x: number, y: number, frame: string, facing: 1 | -1): void {
  if (!el) return;
  const i = Math.max(0, sheet.poses.indexOf(frame));
  const col = i % sheet.cols;
  const row = Math.floor(i / sheet.cols);
  el.style.backgroundPosition = `${-col * RIG_DISPLAY_W}px ${-row * RIG_DISPLAY_H}px`;
  el.style.transform = `translate(${(x - RIG_DISPLAY_W / 2).toFixed(1)}px, ${(y - RIG_DISPLAY_H).toFixed(1)}px) scaleX(${facing})`;
}

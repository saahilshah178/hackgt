"use client";

import { forwardRef, type ReactNode } from "react";
import type { FnColor } from "@/world/types";

/** FnColor → CSS colour (bible §2.3: f white, g green, h blue; accent = the orange input; gold = earned). */
export const FN_VAR: Readonly<Record<FnColor, string>> = {
  f: "var(--fn-f)",
  g: "var(--fn-g)",
  h: "var(--fn-h)",
  accent: "var(--ui-accent)",
  gold: "var(--glow-gold)",
};

/**
 * A card in its slot (bible §3.3): the 2 px bordered `ui.card` interior with its glow, the outer 1 px frame offset
 * 6 px, the label tab at the top-right (half outside the top edge), an optional caps title at the top-left, and an
 * overlay layer (value chips) that is NOT clipped so chips can overhang the panel edge into the world.
 */
export const CardFrame = forwardRef<
  HTMLDivElement,
  {
    tab?: string | null;
    title?: string | null;
    grow?: 0 | 1 | 2;
    kind: string;
    children: ReactNode;
    overlay?: ReactNode;
    testId?: string;
    className?: string;
    /** value-carrying cards reach back into the chip gutter */
    gutter?: boolean;
    /** extra data attributes on the slot (layout hints for CSS) */
    data?: Readonly<Record<`data-${string}`, string | undefined>>;
  }
>(function CardFrame({ tab, title, grow = 1, kind, children, overlay, testId, className, gutter = false, data }, ref) {
  return (
    <div className="xp-slot" data-grow={grow} data-card={kind} data-testid={testId ?? `card-${kind}`} data-gutter={gutter || undefined} {...data}>
      <div ref={ref} className={`xp-card${className ? ` ${className}` : ""}`}>
        {children}
      </div>
      {title ? (
        <div className="xp-card-title" aria-hidden>
          {title}
        </div>
      ) : null}
      {tab ? (
        <div className="xp-tab" aria-hidden>
          {tab}
        </div>
      ) : null}
      {overlay}
    </div>
  );
});

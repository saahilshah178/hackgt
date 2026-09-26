"use client";

import { MatrixCard } from "../cards/MatrixCard";
import type { ControlProps } from "../types";
import * as L from "./matrix.logic";
import { useLogicState } from "./use-logic";

/** MatrixControl (§3.3; civil e12): strike toggles are the player's own notation (draft.marks, UI-only); accusing
 * one explanation commits the input. */
export function MatrixControl(p: ControlProps & { shadeCounts?: boolean; initialMarks?: readonly { clueIndex: number; hypothesisId: string }[] | null }) {
  const emit = (next: L.MatrixState, focus: string | null = null) =>
    p.onChange({ input: L.toDraftInput(next), complete: L.complete(next), focus, hover: null, settled: true, wave: null, marks: L.marksOf(next) });
  const [s, apply] = useLogicState(() => L.fromDraftInput(p.initialInput, p.view, p.initialMarks ?? null), (next) => emit(next));
  const card = L.matrixCardOf(p.view, s, p.surface, p.shadeCounts ?? false);
  return (
    <MatrixCard
      model={card}
      interaction={{
        onToggle: (ci, h) => apply((st) => L.toggleMark(st, ci, h)),
        onAccuse: (h) => apply((st) => L.accuse(st, h)),
        onFocusKey: () => undefined,
        describedBy: p.describedBy,
        disabled: p.disabled,
      }}
    />
  );
}

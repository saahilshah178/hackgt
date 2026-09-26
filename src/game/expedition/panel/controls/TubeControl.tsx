"use client";

import { useState } from "react";
import { CauseGraphCard } from "../cards/CauseGraphCard";
import type { ControlProps } from "../types";
import * as L from "./tubes.logic";
import { useLogicState } from "./use-logic";

/** TubeControl (§3.3): linker.chain on the cause tubes. Pick a housing, then the one it caused; a tube grows
 * between them and the completion gauge fills (edges / edgeCount). */
export function TubeControl(p: ControlProps) {
  const [focus, setFocus] = useState<string | null>(null);
  const emit = (next: L.TubesState) =>
    p.onChange({ input: L.toDraftInput(next), complete: L.complete(next, p.view), focus: next.from ?? focus, hover: null, settled: true, wave: null, marks: null });
  const [s, apply] = useLogicState(() => L.fromDraftInput(p.initialInput, p.view), emit);
  const card = L.causeGraphCardOf(p.view, s, p.surface, s.from ?? focus);
  const total = L.edgeCountOf(p.view);
  return (
    <>
      <CauseGraphCard
        model={card}
        interaction={{
          from: s.from,
          onNode: (k) => apply((st) => L.pickNode(st, k)),
          onRemove: (k) => apply((st) => L.removeEdge(st, k)),
          onFocusKey: setFocus,
          describedBy: p.describedBy,
          disabled: p.disabled,
        }}
      />
      <div className="xp-hint" data-testid="tube-gauge" aria-live="polite" style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
        <span aria-hidden style={{ display: "inline-flex", gap: 4 }}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} style={{ width: 22, height: 10, border: "1.5px solid var(--ui-line)", background: i < s.edges.length ? "var(--ui-line)" : "transparent" }} />
          ))}
        </span>
        {s.edges.length} of {total} tubes laid{s.from ? " · choose where this one leads" : ""}
      </div>
    </>
  );
}

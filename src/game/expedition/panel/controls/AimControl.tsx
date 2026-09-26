"use client";

import { useMemo } from "react";
import { ClaimsCard } from "../cards/ClaimsCard";
import type { ControlProps } from "../types";
import * as L from "./aim.logic";
import { useLogicState } from "./use-logic";

/** AimControl (§3.3): truth_finder.mimic / predict_reveal. Hover and focus emit drafts (the world previews the
 * hovered holder); choosing commits the index. */
export function AimControl(p: ControlProps) {
  const model = useMemo(() => L.aimModelOf(p.modeKey, p.view), [p.modeKey, p.view]);
  const [s, apply] = useLogicState(
    () => L.initialAim(p.modeKey, p.initialInput),
    (next) => p.onChange({ input: L.toDraftInput(next), complete: L.complete(next), ...L.channels(next), settled: true, wave: null, marks: null }),
  );
  const card = L.claimsCardOf(model, s, p.surface);
  const idx = (key: string | null) => (key === null ? null : Number(key));
  return (
    <ClaimsCard
      model={card}
      interaction={{
        onHover: (key) => apply((st) => L.hover(st, idx(key))),
        onFocusItem: (key) => apply((st) => L.focus(st, idx(key))),
        onChoose: (key) => apply((st) => L.choose(st, Number(key))),
        describedBy: p.describedBy,
        disabled: p.disabled,
      }}
    />
  );
}

"use client";

import { useState } from "react";
import { LinkBoardCard } from "../cards/LinkBoardCard";
import type { ControlProps } from "../types";
import * as L from "./cables.logic";
import { useLogicState } from "./use-logic";

/** CableControl (§3.3): linker.pairs on the switchboard / stage machine. A cord seats between a socket and a
 * cartridge; lamps light white (seated, not correct). */
export function CableControl(p: ControlProps) {
  const [focus, setFocus] = useState<string | null>(null);
  const emit = (next: L.CablesState) =>
    p.onChange({ input: L.toDraftInput(next), complete: L.complete(next, p.view), focus: next.selectedLeft ?? focus, hover: null, settled: true, wave: null, marks: null });
  const [s, apply] = useLogicState(() => L.fromDraftInput(p.initialInput, p.view), emit);
  const card = L.linkBoardCardOf(p.view, s, p.surface, s.selectedLeft ?? focus);
  return (
    <LinkBoardCard
      model={card}
      interaction={{
        selectedLeft: s.selectedLeft,
        selectedRight: s.selectedRight,
        onLeft: (k) => apply((st) => L.pickLeft(st, k)),
        onRight: (k) => apply((st) => L.pickRight(st, k)),
        onUnlink: (k) => apply((st) => L.unlink(st, k)),
        onFocusKey: setFocus,
        describedBy: p.describedBy,
        disabled: p.disabled,
      }}
    />
  );
}

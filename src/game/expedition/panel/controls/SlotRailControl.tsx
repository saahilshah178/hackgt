"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { SlotRailCard } from "../cards/SlotRailCard";
import { useRoving } from "../roving";
import type { ControlProps } from "../types";
import * as L from "./slots.logic";
import { useLogicState } from "./use-logic";

/**
 * SlotRailControl (§3.3): sequencer.linear. The tray holds the loose planks: Enter (or a click) on a plank lays it
 * in the first empty slot; Enter on a filled slot lifts its plank back to the tray. The world link flies the placed
 * plank to its bay; `complete` once every slot is filled.
 */
export function SlotRailControl(p: ControlProps) {
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const emit = (next: L.SlotsState, focus: string | null) =>
    p.onChange({ input: L.toDraftInput(next), complete: L.complete(next), focus, hover: null, settled: true, wave: null, marks: null });
  const [s, apply] = useLogicState(() => L.fromDraftInput(p.initialInput, p.view), (next) => emit(next, focusKey));
  const tray = L.trayOf(p.view, s);
  // a placed plank leaves the tray, so keyboard focus moves to the next loose plank (or to the rail when none remain)
  const boxRef = useRef<HTMLDivElement | null>(null);
  const pendingFocus = useRef<string | null>(null);
  useLayoutEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    pendingFocus.current = null;
    boxRef.current?.querySelector<HTMLElement>(key === "@rail" ? '[data-testid="slot-0"]' : `[data-key="${key}"]`)?.focus();
  });
  const placeFromTray = (key: string) => {
    const i = tray.findIndex((t) => t.key === key);
    const nextKey = tray[i + 1]?.key ?? tray[i - 1]?.key ?? null;
    apply((st) => L.place(st, key));
    pendingFocus.current = nextKey ?? "@rail";
  };
  const roving = useRoving(tray.length, { horizontal: false });
  const card = L.slotRailCardOf(p.view, s, p.surface);
  return (
    <div ref={boxRef} className="xp-row" data-testid="slot-rail-control">
      <SlotRailCard
        model={card}
        interaction={{
          holding: null,
          describedBy: p.describedBy,
          disabled: p.disabled,
          onFocusSlot: (i) => {
            const k = i === null ? null : `slot:${i}`;
            setFocusKey(k);
          },
          onSlot: (i) => apply((st) => L.remove(st, i)),
        }}
      />
      <div className="xp-slot" data-grow={1} data-card="tray" data-testid="plank-tray" style={{ flexGrow: 1 }}>
        <div className="xp-card">
          <div className="xp-card-html">
            <div className="xp-caps" style={{ marginBottom: 8 }} id={`${p.describedBy}-tray`}>
              Planks · Enter lays a plank in the next empty slot
            </div>
            <ul className="xp-items" aria-labelledby={`${p.describedBy}-tray`} onKeyDown={roving.onKeyDown}>
              {tray.map((pl, i) => {
                const rp = roving.itemProps(i);
                return (
                  <li key={pl.key}>
                    <button
                      type="button"
                      className="xp-token"
                      style={{ width: "100%" }}
                      data-testid={i === 0 ? "widget-first-option" : undefined}
                      data-key={pl.key}
                      disabled={p.disabled}
                      ref={rp.ref}
                      tabIndex={rp.tabIndex}
                      onFocus={() => {
                        rp.onFocus();
                        setFocusKey(pl.key);
                      }}
                      onClick={() => placeFromTray(pl.key)}
                    >
                      {pl.text}
                    </button>
                  </li>
                );
              })}
              {tray.length === 0 ? <li className="xp-hint">Every plank is on the rail.</li> : null}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

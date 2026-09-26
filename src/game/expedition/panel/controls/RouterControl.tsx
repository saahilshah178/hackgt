"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRoving } from "../roving";
import type { ControlProps } from "../types";
import * as L from "./bins.logic";
import { useLogicState } from "./use-logic";

/**
 * RouterControl (§3.3): sorter.bins. Pick an item (Enter / click), then a lane (click its header, or press 1–9 on
 * the item itself). The item queues at that lane (no correctness shown); lane chips carry counts only. Boss phases
 * reveal the next batch when the current one is placed; Verify needs every item.
 */
export function RouterControl(p: ControlProps) {
  const bins = L.binsOf(p.view);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const emit = (next: L.BinsState, focus: string | null) =>
    p.onChange({ input: L.toDraftInput(next), complete: L.complete(next, p.view), focus, hover: null, settled: true, wave: null, marks: null });
  const [s, apply] = useLogicState(() => L.fromDraftInput(p.initialInput, p.view), (next) => emit(next, next.selected ?? focusKey));
  const visible = L.visibleItems(p.view, s, p.phases);
  const unrouted = visible.filter((it) => L.binOf(s, it.key) === null);
  const counts = L.countsOf(p.view, s);
  const totalItems = L.itemsOf(p.view).length;
  const hidden = totalItems - visible.length;
  const roving = useRoving(visible.length, {
    onQuick: undefined,
    onMove: (i) => {
      const k = visible[i]?.key ?? null;
      setFocusKey(k);
      if (k) p.onChange({ input: L.toDraftInput(s), complete: L.complete(s, p.view), focus: k, hover: null, settled: true, wave: null, marks: null });
    },
  });
  // a routed token re-mounts inside its lane, so keyboard focus moves on to the next unrouted item (or stays put)
  const boardRef = useRef<HTMLDivElement | null>(null);
  const pendingFocus = useRef<string | null>(null);
  useLayoutEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    pendingFocus.current = null;
    boardRef.current?.querySelector<HTMLElement>(`[data-key="${key}"]`)?.focus();
  });
  const routeTo = (itemKey: string, binId: string) => {
    const next = L.assign(s, itemKey, binId);
    const nextVisible = L.visibleItems(p.view, next, p.phases);
    const after = nextVisible.find((it) => L.binOf(next, it.key) === null && it.key !== itemKey);
    apply(() => next);
    pendingFocus.current = after?.key ?? itemKey;
  };
  const token = (it: L.BinItem, i: number) => {
    const rp = roving.itemProps(i);
    const lane = L.binOf(s, it.key);
    return (
      <button
        key={it.key}
        type="button"
        className="xp-token"
        style={{ width: "100%" }}
        aria-pressed={s.selected === it.key}
        aria-label={`${it.text}${lane ? `, routed to ${bins.find((b) => b.id === lane)?.label}` : ", not routed"}. Press 1 to ${bins.length} to route.`}
        data-testid={i === 0 ? "widget-first-option" : undefined}
        data-key={it.key}
        disabled={p.disabled}
        ref={rp.ref}
        tabIndex={rp.tabIndex}
        onFocus={rp.onFocus}
        onClick={() => apply((st) => L.select(st, it.key))}
        onKeyDown={(e) => {
          if (/^[1-9]$/.test(e.key)) {
            const b = bins[Number(e.key) - 1];
            if (b) {
              e.preventDefault();
              routeTo(it.key, b.id);
            }
          }
        }}
      >
        {it.text}
      </button>
    );
  };
  return (
    <div ref={boardRef} className="xp-slot" data-grow={2} data-card="router" data-testid="router-board" style={{ flexGrow: 2 }}>
      <div className="xp-card">
        <div className="xp-card-html" aria-describedby={p.describedBy}>
          <div role="group" aria-label="Cargo" onKeyDown={roving.onKeyDown}>
            <div className="xp-caps" style={{ marginBottom: 8 }}>
              Cargo {s.selected ? "· now choose a lane" : "· pick an item, then a lane (or press 1–9)"}
            </div>
            <div className="xp-items xp-cargo" style={{ marginBottom: 14 }}>
              {unrouted.map((it) => token(it, visible.indexOf(it)))}
              {unrouted.length === 0 ? <div className="xp-hint">{hidden > 0 ? "Batch placed. The next batch is on its way." : "Every item is routed."}</div> : null}
            </div>
            <div className="xp-grid-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, bins.length)}, minmax(0, 1fr))` }}>
              {bins.map((b, bi) => (
                <section key={b.id} className="xp-lane" data-focus={s.selected !== null || undefined} aria-label={`${b.label}: ${counts[b.id] ?? 0} items`} style={{ minHeight: "clamp(120px, 24cqh, 260px)" }}>
                  <button
                    type="button"
                    className="xp-token"
                    style={{ justifyContent: "space-between", fontWeight: 600, borderColor: s.selected ? "var(--ui-line)" : undefined }}
                    disabled={p.disabled}
                    aria-disabled={s.selected === null || undefined}
                    aria-label={`Route ${s.selected ? "the picked item" : "an item"} to ${b.label} (${counts[b.id] ?? 0} so far)`}
                    onClick={() => s.selected && routeTo(s.selected, b.id)}
                    data-testid={`lane-${b.id}`}
                  >
                    <span>
                      <span aria-hidden className="xp-count" style={{ marginRight: 8 }}>
                        {bi + 1}
                      </span>
                      {b.label}
                    </span>
                    <span className="xp-count" aria-hidden>
                      {counts[b.id] ?? 0}
                    </span>
                  </button>
                  {visible
                    .filter((it) => L.binOf(s, it.key) === b.id)
                    .map((it) => token(it, visible.indexOf(it)))}
                </section>
              ))}
            </div>
            {hidden > 0 ? (
              <div className="xp-hint" style={{ marginTop: 10 }}>
                {hidden} more {hidden === 1 ? "item arrives" : "items arrive"} when this batch is placed.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

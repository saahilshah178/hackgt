"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { WidgetProps } from "./Dial";

/** Matches mode bins' View (src/mechanics/families/sorter/bins.ts). */
export interface SortView {
  bins: { id: string; label: string }[];
  items: { key: string; text: string }[];
}
export interface SortInput {
  assignments: { itemKey: string; binId: string }[];
}

/** Pure: the item -> bin map the player has built -> the input grade() expects. */
export function assignmentsToInput(assignments: Record<string, string>): SortInput {
  return { assignments: Object.entries(assignments).map(([itemKey, binId]) => ({ itemKey, binId })) };
}

/**
 * sort: 2-4 labeled bins and an item list. Keyboard: focus an item (arrows), press 1-4 to place it in
 * that bin, Backspace to unplace. Clicking a bin also assigns the focused item. Submits only once every
 * item is placed.
 */
export function Sort({ view, onSubmit, disabled }: WidgetProps<SortView, SortInput>) {
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [focusIndex, setFocusIndex] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    refs.current[focusIndex]?.focus();
  }, [focusIndex]);

  const assign = (itemKey: string, binId: string) => {
    setAssignments((a) => ({ ...a, [itemKey]: binId }));
  };
  const unassign = (itemKey: string) => {
    setAssignments((a) => {
      const next = { ...a };
      delete next[itemKey];
      return next;
    });
  };

  const allPlaced = view.items.every((it) => assignments[it.key]);
  const binLabel = (id: string) => view.bins.find((b) => b.id === id)?.label ?? id;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Sort every item into a bin. Press 1-{view.bins.length} to place the focused item, Backspace to unplace it.
      </p>
      <div className="flex flex-wrap gap-3" aria-label="Bins" data-testid="sort-bins">
        {view.bins.map((b) => (
          <div
            key={b.id}
            className="flex min-h-20 min-w-40 flex-col gap-1 rounded-lg border-2 border-dashed p-2"
            data-testid={`sort-bin-${b.id}`}
          >
            <span className="text-sm font-semibold uppercase tracking-wide opacity-80" style={{ fontSize: 14 }}>
              {b.label}
            </span>
            {view.items
              .filter((it) => assignments[it.key] === b.id)
              .map((it) => (
                <span key={it.key} className="text-sm" style={{ fontSize: 15 }}>
                  {it.text}
                </span>
              ))}
          </div>
        ))}
      </div>
      <div
        role="listbox"
        aria-label="Items to sort"
        className="flex flex-wrap gap-2"
        onKeyDown={(e) => {
          const item = view.items[focusIndex];
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            setFocusIndex((f) => Math.min(view.items.length - 1, f + 1));
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            setFocusIndex((f) => Math.max(0, f - 1));
          } else if (e.key === "Backspace" && item) {
            e.preventDefault();
            unassign(item.key);
          } else if (item && /^[1-9]$/.test(e.key)) {
            const bin = view.bins[Number(e.key) - 1];
            if (bin) {
              e.preventDefault();
              assign(item.key, bin.id);
              setFocusIndex((f) => Math.min(view.items.length - 1, f + 1));
            }
          }
        }}
      >
        {view.items.map((it, i) => (
          <button
            key={it.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="option"
            aria-selected={Boolean(assignments[it.key])}
            disabled={disabled}
            onFocus={() => setFocusIndex(i)}
            onClick={() => setFocusIndex(i)}
            className="rounded-lg border-2 px-3 py-2 text-left"
            style={{
              fontSize: 16,
              borderColor: focusIndex === i ? "currentColor" : "color-mix(in oklab, currentColor 30%, transparent)",
              opacity: assignments[it.key] ? 0.6 : 1,
            }}
          >
            {it.text}
            {assignments[it.key] && (
              <span className="ml-2 text-sm opacity-70" style={{ fontSize: 13 }}>
                → {binLabel(assignments[it.key])}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Assign focused item to a bin">
        {view.bins.map((b, i) => (
          <Button
            key={b.id}
            variant="outline"
            disabled={disabled}
            onClick={() => {
              const item = view.items[focusIndex];
              if (item) assign(item.key, b.id);
            }}
          >
            {i + 1}. {b.label}
          </Button>
        ))}
      </div>
      <div>
        <Button
          size="lg"
          disabled={disabled || !allPlaced}
          onClick={() => onSubmit(assignmentsToInput(assignments))}
          data-testid="widget-submit"
        >
          Lock in sort
        </Button>
      </div>
    </div>
  );
}

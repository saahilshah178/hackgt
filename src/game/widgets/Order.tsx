"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { WidgetProps } from "./Dial";

/**
 * Matches mode linear's View (src/mechanics/families/sequencer/linear.ts), extended with the optional
 * fields cycle (`circular: true`) and rank (`property`/`direction`) add.
 */
export interface OrderView {
  slots: number;
  planks: { key: string; text: string }[];
  /** sequencer.cycle: a ring; any rotation that matches direction is correct. */
  circular?: boolean;
  /** sequencer.rank: what's being ranked and which way. */
  property?: string;
  direction?: "ascending" | "descending";
}
export interface OrderInput {
  keys: string[];
}

/** Pure: the placed-slot keys, in slot order -> the input linear/cycle/rank's grade() expects. */
export function placedToInput(placed: string[]): OrderInput {
  return { keys: placed };
}

/**
 * order: arrange planks into slots (linear, or a ring for `circular`). Keyboard: arrows move focus
 * among the pool + placed slots, Enter places the focused pool plank into the next open slot (or
 * removes a placed one), Backspace clears the last slot.
 */
export function Order({ view, onSubmit, disabled }: WidgetProps<OrderView, OrderInput>) {
  const [placed, setPlaced] = useState<string[]>([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const pool = view.planks.filter((p) => !placed.includes(p.key));
  const items = [...placed.map((key) => ({ key, placed: true })), ...pool.map((p) => ({ key: p.key, placed: false }))];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const textFor = (key: string) => view.planks.find((p) => p.key === key)?.text ?? key;

  useEffect(() => {
    refs.current[Math.min(focusIndex, items.length - 1)]?.focus();
  }, [focusIndex, items.length]);

  const place = (key: string) => {
    if (placed.length >= view.slots) return;
    setPlaced((p) => [...p, key]);
    setFocusIndex(0);
  };
  const remove = (key: string) => {
    setPlaced((p) => p.filter((k) => k !== key));
  };

  return (
    <div className="flex flex-col gap-4">
      {view.property ? (
        <p className="text-lg" style={{ fontSize: 18 }}>
          Rank by <strong>{view.property}</strong>, {view.direction === "ascending" ? "smallest first" : "largest first"}. Enter
          places or removes; Backspace clears the last slot.
        </p>
      ) : (
        <p className="text-lg" style={{ fontSize: 18 }}>
          {view.circular
            ? `Arrange the ${view.slots} stages around the ring; any starting point is fine as long as the order holds.`
            : `Arrange the ${view.slots} steps in order.`}{" "}
          Enter places or removes; Backspace clears the last slot.
        </p>
      )}
      <div
        className={view.circular ? "flex flex-wrap justify-center gap-2 rounded-full border-2 border-dashed p-4" : "flex flex-wrap gap-2"}
        aria-label="Slots"
        data-testid="order-slots"
      >
        {Array.from({ length: view.slots }, (_, i) => (
          <div
            key={i}
            className="flex h-14 min-w-32 items-center justify-center rounded-lg border-2 border-dashed px-2 text-center"
            style={{ fontSize: 16, borderRadius: view.circular ? 9999 : undefined }}
          >
            {placed[i] ? textFor(placed[i]) : view.circular ? "○" : `Slot ${i + 1}`}
          </div>
        ))}
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="listbox"
        aria-label="Available planks and placed planks"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            setFocusIndex((f) => Math.min(items.length - 1, f + 1));
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            setFocusIndex((f) => Math.max(0, f - 1));
          } else if (e.key === "Backspace") {
            e.preventDefault();
            setPlaced((p) => p.slice(0, -1));
          }
        }}
      >
        {items.map((it, i) => (
          <button
            key={it.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="option"
            aria-selected={it.placed}
            disabled={disabled}
            onFocus={() => setFocusIndex(i)}
            onClick={() => (it.placed ? remove(it.key) : place(it.key))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (it.placed) remove(it.key);
                else place(it.key);
              }
            }}
            className="rounded-lg border-2 px-3 py-2 text-left"
            style={{
              fontSize: 16,
              opacity: it.placed ? 0.5 : 1,
              borderColor: focusIndex === i ? "currentColor" : "color-mix(in oklab, currentColor 30%, transparent)",
            }}
          >
            {textFor(it.key)}
          </button>
        ))}
      </div>
      <div>
        <Button
          size="lg"
          disabled={disabled || placed.length !== view.slots}
          onClick={() => onSubmit(placedToInput(placed))}
          data-testid="widget-submit"
        >
          Lock in order
        </Button>
      </div>
    </div>
  );
}

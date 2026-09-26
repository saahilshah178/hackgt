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

/** Matches mode hierarchy's View (src/mechanics/families/sorter/hierarchy.ts): levels are bare strings,
 * not `{id,label}` bins, and the Input field is `placements`. */
export interface SortHierarchyView {
  levels: string[];
  items: { key: string; text: string }[];
}
export interface SortHierarchyInput {
  placements: { itemKey: string; level: string }[];
}

/** Matches mode venn's View (src/mechanics/families/sorter/venn.ts): items may belong to 0-N sets, so the
 * Input carries `setIds: string[]` per item rather than a single `binId`. */
export interface SortVennView {
  sets: { id: string; label: string }[];
  items: { key: string; text: string }[];
}
export interface SortVennInput {
  assignments: { itemKey: string; setIds: string[] }[];
}

export type AnySortView = SortView | SortHierarchyView | SortVennView;
export type AnySortInput = SortInput | SortHierarchyInput | SortVennInput;

export function isHierarchyView(view: AnySortView): view is SortHierarchyView {
  return "levels" in view;
}
export function isVennView(view: AnySortView): view is SortVennView {
  return "sets" in view;
}

export function supports(view: unknown): boolean {
  if (typeof view !== "object" || view === null) return false;
  const v = view as AnySortView;
  return isHierarchyView(v) || isVennView(v) || "bins" in v;
}

/** Pure: the item -> bin map the player has built -> the input grade() expects. */
export function assignmentsToInput(assignments: Record<string, string>): SortInput {
  return { assignments: Object.entries(assignments).map(([itemKey, binId]) => ({ itemKey, binId })) };
}
/** Pure: the item -> level map the player has built -> the input hierarchy's grade() expects. */
export function placementsToInput(placements: Record<string, string>): SortHierarchyInput {
  return { placements: Object.entries(placements).map(([itemKey, level]) => ({ itemKey, level })) };
}
/** Pure: the item -> set-membership map the player has built -> the input venn's grade() expects. */
export function vennToInput(assignments: Record<string, string[]>): SortVennInput {
  return { assignments: Object.entries(assignments).map(([itemKey, setIds]) => ({ itemKey, setIds })) };
}

/**
 * sort: 2-4 labeled bins and an item list. Keyboard: focus an item (arrows), press 1-4 to place it in
 * that bin, Backspace to unplace. Clicking a bin also assigns the focused item. Submits only once every
 * item is placed.
 */
export function Sort({ view, onSubmit, onDraft, disabled }: WidgetProps<AnySortView, AnySortInput>) {
  const allPlaced = (a: Record<string, string>) => view.items.every((i) => a[i.key] !== undefined);
  if (isHierarchyView(view))
    return (
      <BinsSort
        view={{ bins: view.levels.map((lvl) => ({ id: lvl, label: lvl })), items: view.items }}
        onSubmit={(assignments) => onSubmit(placementsToInput(assignments))}
        onDraft={onDraft ? (a) => onDraft({ input: placementsToInput(a), complete: allPlaced(a), focus: null }) : undefined}
        disabled={disabled}
      />
    );
  if (isVennView(view))
    return <VennSort view={view} onSubmit={(assignments) => onSubmit(vennToInput(assignments))} disabled={disabled} />;
  return (
    <BinsSort
      view={view}
      onSubmit={(assignments) => onSubmit(assignmentsToInput(assignments))}
      onDraft={onDraft ? (a) => onDraft({ input: assignmentsToInput(a), complete: allPlaced(a), focus: null }) : undefined}
      disabled={disabled}
    />
  );
}

function BinsSort({
  view,
  onSubmit,
  onDraft,
  disabled,
}: {
  view: SortView;
  onSubmit: (assignments: Record<string, string>) => void;
  onDraft?: (assignments: Record<string, string>) => void;
  disabled?: boolean;
}) {
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  useEffect(() => {
    onDraft?.(assignments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments]);
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
          onClick={() => onSubmit(assignments)}
          data-testid="widget-submit"
        >
          Lock in sort
        </Button>
      </div>
    </div>
  );
}

/** sorter.venn: region chips per item (toggle membership in each set; 0-N sets is valid, including
 * "neither"). Keyboard: focus an item, press 1-N to toggle that set's membership, 0 to clear. */
function VennSort({ view, onSubmit, disabled }: { view: SortVennView; onSubmit: (assignments: Record<string, string[]>) => void; disabled?: boolean }) {
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [focusIndex, setFocusIndex] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    refs.current[focusIndex]?.focus();
  }, [focusIndex]);

  const toggle = (itemKey: string, setId: string) => {
    setAssignments((a) => {
      const cur = a[itemKey] ?? [];
      const next = cur.includes(setId) ? cur.filter((id) => id !== setId) : [...cur, setId];
      return { ...a, [itemKey]: next };
    });
  };

  const allPlaced = view.items.every((it) => it.key in assignments);
  const regionLabel = (ids: string[]) => (ids.length === 0 ? "neither" : ids.map((id) => view.sets.find((s) => s.id === id)?.label ?? id).join(" + "));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Place every item in its region. Press 1-{view.sets.length} to toggle a set for the focused item, 0 for
        &quot;neither&quot;.
      </p>
      <div
        role="listbox"
        aria-label="Items to place"
        className="flex flex-wrap gap-2"
        onKeyDown={(e) => {
          const item = view.items[focusIndex];
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            setFocusIndex((f) => Math.min(view.items.length - 1, f + 1));
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            setFocusIndex((f) => Math.max(0, f - 1));
          } else if (item && e.key === "0") {
            e.preventDefault();
            setAssignments((a) => ({ ...a, [item.key]: [] }));
          } else if (item && /^[1-9]$/.test(e.key)) {
            const set = view.sets[Number(e.key) - 1];
            if (set) {
              e.preventDefault();
              toggle(item.key, set.id);
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
            aria-selected={it.key in assignments}
            disabled={disabled}
            onFocus={() => setFocusIndex(i)}
            onClick={() => setFocusIndex(i)}
            className="rounded-lg border-2 px-3 py-2 text-left"
            style={{
              fontSize: 16,
              borderColor: focusIndex === i ? "currentColor" : "color-mix(in oklab, currentColor 30%, transparent)",
              opacity: it.key in assignments ? 0.7 : 1,
            }}
          >
            {it.text}
            {it.key in assignments && (
              <span className="ml-2 text-sm opacity-70" style={{ fontSize: 13 }}>
                → {regionLabel(assignments[it.key])}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Toggle a set for the focused item" data-testid="venn-set-chips">
        {view.sets.map((s, i) => {
          const item = view.items[focusIndex];
          const active = item ? (assignments[item.key] ?? []).includes(s.id) : false;
          return (
            <Button
              key={s.id}
              variant={active ? "default" : "outline"}
              disabled={disabled}
              onClick={() => item && toggle(item.key, s.id)}
            >
              {i + 1}. {s.label}
            </Button>
          );
        })}
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => {
            const item = view.items[focusIndex];
            if (item) setAssignments((a) => ({ ...a, [item.key]: [] }));
          }}
        >
          0. Neither
        </Button>
      </div>
      <div>
        <Button size="lg" disabled={disabled || !allPlaced} onClick={() => onSubmit(assignments)} data-testid="widget-submit">
          Lock in sort
        </Button>
      </div>
    </div>
  );
}

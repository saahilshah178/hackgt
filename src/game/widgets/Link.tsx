"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import type { WidgetProps } from "./Dial";

/** Matches mode pairs' View (src/mechanics/families/linker/pairs.ts). */
export interface LinkPairsView {
  lefts: { key: string; text: string }[];
  rights: { key: string; text: string }[];
}
export interface LinkPairsInput {
  links: { leftKey: string; rightKey: string }[];
}

/** Matches mode chain's View (src/mechanics/families/linker/chain.ts). */
export interface LinkChainView {
  nodes: { key: string; text: string }[];
  edgeCount: number;
}
export interface LinkChainInput {
  edges: { fromKey: string; toKey: string }[];
}

/** Matches mode elimination's View (src/mechanics/families/investigator/elimination.ts). */
export interface LinkEliminationView {
  question: string;
  hypotheses: { id: string; text: string }[];
  clues: { index: number; text: string }[];
}
export interface LinkEliminationInput {
  hypothesisId: string;
}

export type LinkView = LinkPairsView | LinkChainView | LinkEliminationView;
export type LinkInput = LinkPairsInput | LinkChainInput | LinkEliminationInput;

export function isPairsView(view: LinkView): view is LinkPairsView {
  return "lefts" in view && "rights" in view;
}
export function isChainView(view: LinkView): view is LinkChainView {
  return "nodes" in view && "edgeCount" in view;
}
export function isEliminationView(view: LinkView): view is LinkEliminationView {
  return "hypotheses" in view;
}

/** Pure: the completed left->right map -> the input pairs' grade() expects. */
export function pairsToInput(links: Record<string, string>): LinkPairsInput {
  return { links: Object.entries(links).map(([leftKey, rightKey]) => ({ leftKey, rightKey })) };
}
/** Pure: the completed from->to map -> the input chain's grade() expects. */
export function chainToInput(edges: Record<string, string>): LinkChainInput {
  return { edges: Object.entries(edges).map(([fromKey, toKey]) => ({ fromKey, toKey })) };
}
/** Pure: the chosen hypothesis id -> the input elimination's grade() expects. */
export function eliminationToInput(hypothesisId: string): LinkEliminationInput {
  return { hypothesisId };
}

/**
 * link: connects pairs or edges in a graph, or (for investigator.elimination) picks a surviving
 * hypothesis. The variant is read from the view's shape.
 */
export function Link({ view, onSubmit, disabled }: WidgetProps<LinkView, LinkInput>) {
  if (isPairsView(view)) return <PairsLink view={view} onSubmit={onSubmit as (i: LinkPairsInput) => void} disabled={disabled} />;
  if (isChainView(view)) return <ChainLink view={view} onSubmit={onSubmit as (i: LinkChainInput) => void} disabled={disabled} />;
  return <EliminationLink view={view} onSubmit={onSubmit as (i: LinkEliminationInput) => void} disabled={disabled} />;
}

function useConnectors(containerRef: RefObject<HTMLDivElement | null>, keys: string[]) {
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([]);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const next: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const pairKey of keys) {
      const [a, b] = pairKey.split("|");
      const elA = container.querySelector<HTMLElement>(`[data-node="${a}"]`);
      const elB = container.querySelector<HTMLElement>(`[data-node="${b}"]`);
      if (!elA || !elB) continue;
      const ra = elA.getBoundingClientRect();
      const rb = elB.getBoundingClientRect();
      next.push({
        x1: ra.right - rect.left,
        y1: ra.top + ra.height / 2 - rect.top,
        x2: rb.left - rect.left,
        y2: rb.top + rb.height / 2 - rect.top,
      });
    }
    setLines(next);
  }, [containerRef, keys]);
  return lines;
}

function PairsLink({ view, onSubmit, disabled }: { view: LinkPairsView; onSubmit: (i: LinkPairsInput) => void; disabled?: boolean }) {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const usedRights = new Set(Object.values(links));
  const lineKeys = Object.entries(links).map(([l, r]) => `${l}|${r}`);
  const lines = useConnectors(containerRef, lineKeys);

  useEffect(() => {
    if (selectedLeft && selectedRight) {
      setLinks((l) => ({ ...l, [selectedLeft]: selectedRight }));
      setSelectedLeft(null);
      setSelectedRight(null);
    }
  }, [selectedLeft, selectedRight]);

  const allLinked = view.lefts.every((l) => links[l.key]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Pick a left item, then its match on the right. Enter links them.
      </p>
      <div ref={containerRef} className="relative flex justify-between gap-8" data-testid="link-columns">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          {lines.map((ln, i) => (
            <line key={i} x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2} stroke="currentColor" strokeWidth={2} opacity={0.6} />
          ))}
        </svg>
        <div className="z-10 flex flex-1 flex-col gap-2" role="listbox" aria-label="Left items">
          {view.lefts.map((l) => (
            <button
              key={l.key}
              data-node={l.key}
              role="option"
              aria-selected={selectedLeft === l.key}
              disabled={disabled || Boolean(links[l.key])}
              onClick={() => setSelectedLeft(l.key)}
              onKeyDown={(e) => e.key === "Enter" && setSelectedLeft(l.key)}
              className="rounded-lg border-2 px-3 py-2 text-left"
              style={{
                fontSize: 16,
                opacity: links[l.key] ? 0.5 : 1,
                borderColor: selectedLeft === l.key ? "currentColor" : "color-mix(in oklab, currentColor 30%, transparent)",
              }}
            >
              {l.text}
              {links[l.key] && (
                <span className="ml-2 text-sm opacity-70" style={{ fontSize: 13 }}>
                  → {view.rights.find((r) => r.key === links[l.key])?.text}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="z-10 flex flex-1 flex-col gap-2" role="listbox" aria-label="Right items">
          {view.rights.map((r) => (
            <button
              key={r.key}
              data-node={r.key}
              role="option"
              aria-selected={selectedRight === r.key}
              disabled={disabled || usedRights.has(r.key)}
              onClick={() => setSelectedRight(r.key)}
              onKeyDown={(e) => e.key === "Enter" && setSelectedRight(r.key)}
              className="rounded-lg border-2 px-3 py-2 text-left"
              style={{
                fontSize: 16,
                opacity: usedRights.has(r.key) ? 0.5 : 1,
                borderColor: selectedRight === r.key ? "currentColor" : "color-mix(in oklab, currentColor 30%, transparent)",
              }}
            >
              {r.text}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Button size="lg" disabled={disabled || !allLinked} onClick={() => onSubmit(pairsToInput(links))} data-testid="widget-submit">
          Lock in links
        </Button>
      </div>
    </div>
  );
}

function ChainLink({ view, onSubmit, disabled }: { view: LinkChainView; onSubmit: (i: LinkChainInput) => void; disabled?: boolean }) {
  const [edges, setEdges] = useState<Record<string, string>>({});
  const [from, setFrom] = useState<string | null>(null);

  const edgeList = Object.entries(edges);
  const textFor = (key: string) => view.nodes.find((n) => n.key === key)?.text ?? key;

  const pick = (key: string) => {
    if (!from) {
      setFrom(key);
      return;
    }
    if (from === key) {
      setFrom(null);
      return;
    }
    setEdges((e) => ({ ...e, [from]: key }));
    setFrom(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Pick a from-node, then the node it leads to. {view.edgeCount} links needed.
      </p>
      <div className="flex flex-wrap gap-2" role="listbox" aria-label="Nodes">
        {view.nodes.map((n) => (
          <button
            key={n.key}
            role="option"
            aria-selected={from === n.key}
            disabled={disabled}
            onClick={() => pick(n.key)}
            onKeyDown={(e) => e.key === "Enter" && pick(n.key)}
            className="rounded-lg border-2 px-3 py-2 text-left"
            style={{
              fontSize: 16,
              borderColor: from === n.key ? "currentColor" : "color-mix(in oklab, currentColor 30%, transparent)",
            }}
          >
            {n.text}
          </button>
        ))}
      </div>
      <ul className="flex flex-col gap-1" aria-label="Links so far" data-testid="chain-edges">
        {edgeList.map(([f, t]) => (
          <li key={f} style={{ fontSize: 16 }}>
            {textFor(f)} → {textFor(t)}
          </li>
        ))}
      </ul>
      <div>
        <Button
          size="lg"
          disabled={disabled || edgeList.length !== view.edgeCount}
          onClick={() => onSubmit(chainToInput(edges))}
          data-testid="widget-submit"
        >
          Lock in chain
        </Button>
      </div>
    </div>
  );
}

function EliminationLink({
  view,
  onSubmit,
  disabled,
}: {
  view: LinkEliminationView;
  onSubmit: (i: LinkEliminationInput) => void;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    refs.current[focused]?.focus();
  }, [focused]);

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex flex-1 flex-col gap-3">
        <p className="text-lg" style={{ fontSize: 18 }}>
          {view.question}
        </p>
        <div
          role="radiogroup"
          aria-label="Hypotheses"
          className="flex flex-col gap-2"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setFocused((f) => Math.min(view.hypotheses.length - 1, f + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setFocused((f) => Math.max(0, f - 1));
            }
          }}
        >
          {view.hypotheses.map((h, i) => (
            <button
              key={h.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="radio"
              aria-checked={focused === i}
              disabled={disabled}
              onFocus={() => setFocused(i)}
              onClick={() => onSubmit(eliminationToInput(h.id))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSubmit(eliminationToInput(h.id));
                }
              }}
              className="rounded-lg border-2 px-4 py-3 text-left text-lg"
              style={{
                fontSize: 18,
                borderColor: focused === i ? "currentColor" : "color-mix(in oklab, currentColor 30%, transparent)",
              }}
            >
              {h.text}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 rounded-lg border p-3" data-testid="elimination-clues">
        <h3 className="mb-2 font-semibold" style={{ fontSize: 16 }}>
          Clues
        </h3>
        <ul className="flex flex-col gap-2">
          {view.clues.map((c) => (
            <li key={c.index} style={{ fontSize: 16 }}>
              {c.index + 1}. {c.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

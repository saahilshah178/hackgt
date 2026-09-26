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

/** Matches mode argument's View (src/mechanics/families/investigator/argument.ts). */
export interface LinkArgumentView {
  claim: string;
  cards: { key: string; text: string }[];
}
export interface LinkArgumentInput {
  supports: string[];
  counters: string[];
}

/** Matches mode perspective's View (src/mechanics/families/investigator/perspective.ts). */
export interface LinkPerspectiveView {
  actors: { id: string; name: string; motive: string }[];
  accounts: { key: string; text: string }[];
}
export interface LinkPerspectiveInput {
  links: { accountKey: string; actorId: string }[];
}

/** Matches mode network's View (src/mechanics/families/linker/network.ts). The player draws the edges;
 * none are shown. */
export interface LinkNetworkView {
  relation: string;
  directed: boolean;
  nodes: { id: string; label: string }[];
  edgeCount: number;
}
export interface LinkNetworkInput {
  edges: { fromId: string; toId: string }[];
}

/** Matches mode path's View (src/mechanics/families/linker/path.ts). The edges (and weights) are shown;
 * the player traces a walk from start to goal. */
export interface LinkPathView {
  nodes: { id: string; label: string }[];
  edges: { from: string; to: string; weight: number }[];
  directed: boolean;
  start: string;
  goal: string;
  ask: "shortest" | "any";
  costName: string;
}
export interface LinkPathInput {
  path: string[];
}

export type LinkView =
  | LinkPairsView
  | LinkChainView
  | LinkEliminationView
  | LinkArgumentView
  | LinkPerspectiveView
  | LinkNetworkView
  | LinkPathView;
export type LinkInput =
  | LinkPairsInput
  | LinkChainInput
  | LinkEliminationInput
  | LinkArgumentInput
  | LinkPerspectiveInput
  | LinkNetworkInput
  | LinkPathInput;

export function isPairsView(view: LinkView): view is LinkPairsView {
  return "lefts" in view && "rights" in view;
}
export function isChainView(view: LinkView): view is LinkChainView {
  return "nodes" in view && "edgeCount" in view && !("relation" in view);
}
export function isEliminationView(view: LinkView): view is LinkEliminationView {
  return "hypotheses" in view;
}
export function isArgumentView(view: LinkView): view is LinkArgumentView {
  return "claim" in view && "cards" in view;
}
export function isPerspectiveView(view: LinkView): view is LinkPerspectiveView {
  return "actors" in view && "accounts" in view;
}
export function isNetworkView(view: LinkView): view is LinkNetworkView {
  return "relation" in view && "directed" in view && "edgeCount" in view;
}
export function isPathView(view: LinkView): view is LinkPathView {
  return "start" in view && "goal" in view;
}

export function supports(view: unknown): boolean {
  if (typeof view !== "object" || view === null) return false;
  const v = view as LinkView;
  return (
    isPairsView(v) ||
    isEliminationView(v) ||
    isArgumentView(v) ||
    isPerspectiveView(v) ||
    isNetworkView(v) ||
    isPathView(v) ||
    isChainView(v)
  );
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
/** Pure: the pinned support/counter card keys -> the input argument's grade() expects. */
export function argumentToInput(supports: string[], counters: string[]): LinkArgumentInput {
  return { supports, counters };
}
/** Pure: the account -> actor map the player has built -> the input perspective's grade() expects. */
export function perspectiveToInput(links: Record<string, string>): LinkPerspectiveInput {
  return { links: Object.entries(links).map(([accountKey, actorId]) => ({ accountKey, actorId })) };
}
/** Pure: the drawn edges -> the input network's grade() expects. */
export function networkToInput(edges: { fromId: string; toId: string }[]): LinkNetworkInput {
  return { edges };
}
/** Pure: the traced node sequence -> the input path's grade() expects. */
export function pathToInput(path: string[]): LinkPathInput {
  return { path };
}

/**
 * link: connects pairs or edges in a graph, or (for investigator.elimination) picks a surviving
 * hypothesis. The variant is read from the view's shape.
 */
export function Link({ view, onSubmit, disabled }: WidgetProps<LinkView, LinkInput>) {
  if (isPairsView(view)) return <PairsLink view={view} onSubmit={onSubmit as (i: LinkPairsInput) => void} disabled={disabled} />;
  if (isArgumentView(view)) return <ArgumentLink view={view} onSubmit={onSubmit as (i: LinkArgumentInput) => void} disabled={disabled} />;
  if (isPerspectiveView(view)) return <PerspectiveLink view={view} onSubmit={onSubmit as (i: LinkPerspectiveInput) => void} disabled={disabled} />;
  if (isNetworkView(view)) return <NetworkLink view={view} onSubmit={onSubmit as (i: LinkNetworkInput) => void} disabled={disabled} />;
  if (isPathView(view)) return <PathLink view={view} onSubmit={onSubmit as (i: LinkPathInput) => void} disabled={disabled} />;
  if (isChainView(view)) return <ChainLink view={view} onSubmit={onSubmit as (i: LinkChainInput) => void} disabled={disabled} />;
  return <EliminationLink view={view} onSubmit={onSubmit as (i: LinkEliminationInput) => void} disabled={disabled} />;
}

/** investigator.argument: pin each card as a support, a counter, or leave it unused. Keyboard: focus a
 * card (arrows), S pins it as a support, C as a counter, X clears it. */
function ArgumentLink({ view, onSubmit, disabled }: { view: LinkArgumentView; onSubmit: (i: LinkArgumentInput) => void; disabled?: boolean }) {
  const [pins, setPins] = useState<Record<string, "support" | "counter">>({});
  const [focusIndex, setFocusIndex] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    refs.current[focusIndex]?.focus();
  }, [focusIndex]);

  const setPin = (key: string, kind: "support" | "counter" | null) => {
    setPins((p) => {
      const next = { ...p };
      if (kind === null) delete next[key];
      else next[key] = kind;
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Claim: <strong>{view.claim}</strong>
      </p>
      <p className="text-base opacity-80" style={{ fontSize: 15 }}>
        Focus a card, then S to pin it as a support, C as a counter, X to clear it.
      </p>
      <div
        role="listbox"
        aria-label="Evidence cards"
        className="flex flex-col gap-2"
        onKeyDown={(e) => {
          const card = view.cards[focusIndex];
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setFocusIndex((f) => Math.min(view.cards.length - 1, f + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setFocusIndex((f) => Math.max(0, f - 1));
          } else if (card && (e.key === "s" || e.key === "S")) {
            e.preventDefault();
            setPin(card.key, "support");
          } else if (card && (e.key === "c" || e.key === "C")) {
            e.preventDefault();
            setPin(card.key, "counter");
          } else if (card && (e.key === "x" || e.key === "X" || e.key === "Backspace")) {
            e.preventDefault();
            setPin(card.key, null);
          }
        }}
      >
        {view.cards.map((c, i) => (
          <button
            key={c.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="option"
            aria-selected={focusIndex === i}
            disabled={disabled}
            onFocus={() => setFocusIndex(i)}
            onClick={() => setFocusIndex(i)}
            className="flex items-center justify-between gap-3 rounded-lg border-2 px-3 py-2 text-left"
            style={{
              fontSize: 16,
              borderColor: focusIndex === i ? "currentColor" : "color-mix(in oklab, currentColor 30%, transparent)",
            }}
          >
            <span>{c.text}</span>
            <span className="text-sm font-semibold uppercase opacity-80" style={{ fontSize: 13 }}>
              {pins[c.key] ?? ""}
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {view.cards[focusIndex] && (
          <>
            <Button variant="outline" disabled={disabled} onClick={() => setPin(view.cards[focusIndex].key, "support")}>
              Pin as support
            </Button>
            <Button variant="outline" disabled={disabled} onClick={() => setPin(view.cards[focusIndex].key, "counter")}>
              Pin as counter
            </Button>
            <Button variant="outline" disabled={disabled} onClick={() => setPin(view.cards[focusIndex].key, null)}>
              Clear
            </Button>
          </>
        )}
      </div>
      <div>
        <Button
          size="lg"
          disabled={disabled}
          onClick={() =>
            onSubmit(
              argumentToInput(
                Object.entries(pins).filter(([, k]) => k === "support").map(([key]) => key),
                Object.entries(pins).filter(([, k]) => k === "counter").map(([key]) => key),
              ),
            )
          }
          data-testid="widget-submit"
        >
          Lock in argument
        </Button>
      </div>
    </div>
  );
}

/** investigator.perspective: for each first-person account, pick which actor gave it. */
function PerspectiveLink({ view, onSubmit, disabled }: { view: LinkPerspectiveView; onSubmit: (i: LinkPerspectiveInput) => void; disabled?: boolean }) {
  const [links, setLinks] = useState<Record<string, string>>({});
  const allLinked = view.accounts.every((a) => links[a.key]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Match each account to who most likely gave it.
      </p>
      {view.accounts.map((a) => (
        <div key={a.key} className="flex flex-col gap-2 rounded-lg border p-3">
          <p style={{ fontSize: 16 }}>{a.text}</p>
          <div role="radiogroup" aria-label={`Speaker for: ${a.text}`} className="flex flex-wrap gap-2">
            {view.actors.map((actor) => (
              <Button
                key={actor.id}
                variant={links[a.key] === actor.id ? "default" : "outline"}
                disabled={disabled}
                onClick={() => setLinks((l) => ({ ...l, [a.key]: actor.id }))}
                title={actor.motive}
              >
                {actor.name}
              </Button>
            ))}
          </div>
        </div>
      ))}
      <div>
        <Button size="lg" disabled={disabled || !allLinked} onClick={() => onSubmit(perspectiveToInput(links))} data-testid="widget-submit">
          Lock in links
        </Button>
      </div>
    </div>
  );
}

/** linker.network: click two nodes in turn to add an edge between them (an arrow when directed);
 * click a listed edge to remove it. */
function NetworkLink({ view, onSubmit, disabled }: { view: LinkNetworkView; onSubmit: (i: LinkNetworkInput) => void; disabled?: boolean }) {
  const [edges, setEdges] = useState<{ fromId: string; toId: string }[]>([]);
  const [from, setFrom] = useState<string | null>(null);
  const labelFor = (id: string) => view.nodes.find((n) => n.id === id)?.label ?? id;

  const pick = (id: string) => {
    if (!from) {
      setFrom(id);
      return;
    }
    if (from === id) {
      setFrom(null);
      return;
    }
    setEdges((es) => [...es, { fromId: from, toId: id }]);
    setFrom(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Draw every pair where &quot;{view.relation}&quot; holds{view.directed ? " (order matters: pick the source first)" : ""}.
      </p>
      <div className="flex flex-wrap gap-2" role="listbox" aria-label="Nodes">
        {view.nodes.map((n) => (
          <button
            key={n.id}
            role="option"
            aria-selected={from === n.id}
            disabled={disabled}
            onClick={() => pick(n.id)}
            onKeyDown={(e) => e.key === "Enter" && pick(n.id)}
            className="rounded-lg border-2 px-3 py-2 text-left"
            style={{
              fontSize: 16,
              borderColor: from === n.id ? "currentColor" : "color-mix(in oklab, currentColor 30%, transparent)",
            }}
          >
            {n.label}
          </button>
        ))}
      </div>
      <ul className="flex flex-col gap-1" aria-label="Edges drawn so far" data-testid="network-edges">
        {edges.map((e, i) => (
          <li key={i}>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => setEdges((es) => es.filter((_, j) => j !== i))}
              style={{ fontSize: 15 }}
            >
              {labelFor(e.fromId)} {view.directed ? "→" : "—"} {labelFor(e.toId)} &times;
            </Button>
          </li>
        ))}
      </ul>
      <div>
        <Button size="lg" disabled={disabled} onClick={() => onSubmit(networkToInput(edges))} data-testid="widget-submit">
          Lock in network
        </Button>
      </div>
    </div>
  );
}

/** linker.path: the graph's edges are shown (with weights); click nodes in sequence starting at `start`
 * to trace a walk. Undo removes the last step; submits once the walk reaches `goal`. */
function PathLink({ view, onSubmit, disabled }: { view: LinkPathView; onSubmit: (i: LinkPathInput) => void; disabled?: boolean }) {
  const [path, setPath] = useState<string[]>([view.start]);
  const labelFor = (id: string) => view.nodes.find((n) => n.id === id)?.label ?? id;
  const current = path[path.length - 1];
  const neighbors = view.edges
    .filter((e) => e.from === current || (!view.directed && e.to === current))
    .map((e) => (e.from === current ? e.to : e.from));

  const step = (id: string) => setPath((p) => [...p, id]);
  const undo = () => setPath((p) => (p.length > 1 ? p.slice(0, -1) : p));
  const atGoal = current === view.goal && path.length > 1;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Trace {view.ask === "shortest" ? `the shortest path (by ${view.costName})` : "a path"} from{" "}
        <strong>{labelFor(view.start)}</strong> to <strong>{labelFor(view.goal)}</strong>.
      </p>
      <div className="flex flex-col gap-1 rounded-lg border p-3 text-sm" style={{ fontSize: 14 }} data-testid="path-edges">
        {view.edges.map((e, i) => (
          <span key={i}>
            {labelFor(e.from)} {view.directed ? "→" : "—"} {labelFor(e.to)} ({view.costName}: {e.weight})
          </span>
        ))}
      </div>
      <p style={{ fontSize: 16 }} data-testid="path-trace">
        Path: {path.map(labelFor).join(" → ")}
      </p>
      <div className="flex flex-wrap gap-2" role="listbox" aria-label="Next node">
        {neighbors.map((id) => (
          <Button key={id} variant="outline" disabled={disabled} onClick={() => step(id)}>
            {labelFor(id)}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" disabled={disabled || path.length <= 1} onClick={undo}>
          Undo step
        </Button>
        <Button size="lg" disabled={disabled || !atGoal} onClick={() => onSubmit(pathToInput(path))} data-testid="widget-submit">
          Lock in path
        </Button>
      </div>
    </div>
  );
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

  // Selecting the second side of a pair completes the link right in the handler (no state sync in an effect).
  const pickLeft = (key: string) => {
    if (selectedRight) {
      setLinks((l) => ({ ...l, [key]: selectedRight }));
      setSelectedLeft(null);
      setSelectedRight(null);
    } else setSelectedLeft(key);
  };
  const pickRight = (key: string) => {
    if (selectedLeft) {
      setLinks((l) => ({ ...l, [selectedLeft]: key }));
      setSelectedLeft(null);
      setSelectedRight(null);
    } else setSelectedRight(key);
  };

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
              onClick={() => pickLeft(l.key)}
              onKeyDown={(e) => e.key === "Enter" && pickLeft(l.key)}
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
              onClick={() => pickRight(r.key)}
              onKeyDown={(e) => e.key === "Enter" && pickRight(r.key)}
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

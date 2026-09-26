/**
 * controls/tubes.logic.ts — TubeControl (linker.chain → {edges}; cause_tubes; docs/design/20 §3.3). Pure.
 * Edges are keyed by their source like the ChainLink widget's Record (one outgoing tube per housing; re-routing
 * replaces it in place). `complete` once `edgeCount` tubes are laid.
 */
import type { CardModel } from "../../../../world/types";

export interface Node {
  key: string;
  text: string;
}
export interface TubesState {
  edges: readonly { fromKey: string; toKey: string }[];
  /** the housing a tube is being drawn from */
  from: string | null;
}
type CauseGraph = Extract<CardModel, { kind: "cause_graph" }>;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function nodesOf(view: unknown): Node[] {
  const v = isObj(view) ? view : {};
  return Array.isArray(v.nodes) ? (v.nodes as unknown[]).filter(isObj).map((n) => ({ key: String(n.key), text: String(n.text ?? "") })) : [];
}
export function edgeCountOf(view: unknown): number {
  const v = isObj(view) ? view : {};
  return typeof v.edgeCount === "number" ? v.edgeCount : 0;
}

export function fromDraftInput(d: unknown, view: unknown): TubesState {
  const known = new Set(nodesOf(view).map((n) => n.key));
  let s: TubesState = { edges: [], from: null };
  const rows = isObj(d) && Array.isArray(d.edges) ? (d.edges as unknown[]).filter(isObj) : [];
  for (const r of rows) if (known.has(String(r.fromKey)) && known.has(String(r.toKey))) s = addEdge(s, String(r.fromKey), String(r.toKey));
  return s;
}
export function toDraftInput(s: TubesState): { edges: readonly { fromKey: string; toKey: string }[] } {
  return { edges: s.edges.map((e) => ({ ...e })) };
}
export function complete(s: TubesState, view: unknown): boolean {
  const n = edgeCountOf(view);
  return n > 0 && s.edges.length >= n;
}

export function addEdge(s: TubesState, fromKey: string, toKey: string): TubesState {
  if (fromKey === toKey) return { ...s, from: null };
  const i = s.edges.findIndex((e) => e.fromKey === fromKey);
  const edges = [...s.edges];
  if (i >= 0) edges[i] = { fromKey, toKey };
  else edges.push({ fromKey, toKey });
  return { edges, from: null };
}
export function removeEdge(s: TubesState, fromKey: string): TubesState {
  return { ...s, edges: s.edges.filter((e) => e.fromKey !== fromKey) };
}
/** Pick a housing: the first pick starts a tube, the second lays it; picking the same housing cancels. */
export function pickNode(s: TubesState, key: string): TubesState {
  if (s.from === null) return { ...s, from: key };
  if (s.from === key) return { ...s, from: null };
  return addEdge(s, s.from, key);
}

/** Default housing positions (fractions of the board): a two-row zig-zag in display order. */
export function defaultLayout(count: number): { x: number; y: number }[] {
  const perRow = Math.max(1, Math.ceil(count / 2));
  return Array.from({ length: count }, (_, i) => {
    const row = i < perRow ? 0 : 1;
    const col = row === 0 ? i : i - perRow;
    const inRow = row === 0 ? perRow : count - perRow;
    return { x: (col + 0.5) / Math.max(1, inRow), y: row === 0 ? 0.27 : 0.73 };
  });
}

/** The cause board (the control's surface). Node positions come from the meta's card when it has one. */
export function causeGraphCardOf(view: unknown, s: TubesState, surface: CardModel | null, focus: string | null): CauseGraph {
  const base = surface && surface.kind === "cause_graph" ? surface : null;
  const nodes = nodesOf(view);
  const pos = new Map((base?.nodes ?? []).map((n) => [n.key, { x: n.x, y: n.y }]));
  const layout = defaultLayout(nodes.length);
  return {
    kind: "cause_graph",
    slot: base?.slot ?? 0,
    title: base?.title ?? "BOARD",
    nodes: nodes.map((n, i) => ({ key: n.key, label: n.text, ...(pos.get(n.key) ?? layout[i]) })),
    edges: s.edges.map((e) => ({ ...e, state: e.fromKey === focus || e.toKey === focus ? "focus" : "draft" })),
    sr: `${s.edges.length} of ${edgeCountOf(view)} tubes laid.`,
  };
}

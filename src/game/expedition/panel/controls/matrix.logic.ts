/**
 * controls/matrix.logic.ts — MatrixControl (investigator.elimination → {hypothesisId}; tumbler_vault;
 * docs/design/20 §3.3). Pure. Strike marks are the player's own notation: they live only in `Draft.marks`, never in
 * `input`, never reach grade() and are never checked against the eliminations.
 */
import type { CardModel } from "../../../../world/types";

export interface Hypothesis {
  id: string;
  text: string;
}
export interface Clue {
  index: number;
  text: string;
}
export interface MatrixState {
  marks: readonly { clueIndex: number; hypothesisId: string }[];
  accused: string | null;
}
type MatrixCard = Extract<CardModel, { kind: "matrix" }>;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function hypothesesOf(view: unknown): Hypothesis[] {
  const v = isObj(view) ? view : {};
  return Array.isArray(v.hypotheses) ? (v.hypotheses as unknown[]).filter(isObj).map((h) => ({ id: String(h.id), text: String(h.text ?? "") })) : [];
}
export function cluesOf(view: unknown): Clue[] {
  const v = isObj(view) ? view : {};
  return Array.isArray(v.clues) ? (v.clues as unknown[]).filter(isObj).map((c) => ({ index: Number(c.index), text: String(c.text ?? "") })) : [];
}

export function fromDraftInput(d: unknown, view: unknown, marks: readonly { clueIndex: number; hypothesisId: string }[] | null = null): MatrixState {
  const ids = new Set(hypothesesOf(view).map((h) => h.id));
  const raw = isObj(d) ? d.hypothesisId : null;
  return { accused: typeof raw === "string" && ids.has(raw) ? raw : null, marks: (marks ?? []).filter((m) => ids.has(m.hypothesisId)) };
}
/** The mode's draft input: the accused hypothesis ONLY (marks are UI-only). */
export function toDraftInput(s: MatrixState): { hypothesisId: string | null } {
  return { hypothesisId: s.accused };
}
export function marksOf(s: MatrixState): readonly { clueIndex: number; hypothesisId: string }[] {
  return s.marks.map((m) => ({ ...m }));
}
export function complete(s: MatrixState): boolean {
  return s.accused !== null;
}

export function toggleMark(s: MatrixState, clueIndex: number, hypothesisId: string): MatrixState {
  const on = s.marks.some((m) => m.clueIndex === clueIndex && m.hypothesisId === hypothesisId);
  return {
    ...s,
    marks: on ? s.marks.filter((m) => !(m.clueIndex === clueIndex && m.hypothesisId === hypothesisId)) : [...s.marks, { clueIndex, hypothesisId }],
  };
}
export function isMarked(s: MatrixState, clueIndex: number, hypothesisId: string): boolean {
  return s.marks.some((m) => m.clueIndex === clueIndex && m.hypothesisId === hypothesisId);
}
export function accuse(s: MatrixState, hypothesisId: string | null): MatrixState {
  return { ...s, accused: s.accused === hypothesisId ? null : hypothesisId };
}
export function struckCount(s: MatrixState, hypothesisId: string): number {
  return s.marks.filter((m) => m.hypothesisId === hypothesisId).length;
}

/** The matrix card (the control's surface): clue columns × hypothesis rows with the player's own marks. */
export function matrixCardOf(view: unknown, s: MatrixState, surface: CardModel | null, shadeCounts = false): MatrixCard {
  const base = surface && surface.kind === "matrix" ? surface : null;
  const dateOf = new Map((base?.clues ?? []).map((c) => [c.index, c.date]));
  return {
    kind: "matrix",
    slot: base?.slot ?? 0,
    title: base?.title ?? "TUMBLERS",
    clues: cluesOf(view).map((c) => ({ index: c.index, text: c.text, date: dateOf.get(c.index) ?? null })),
    hypotheses: hypothesesOf(view),
    marks: marksOf(s),
    accused: s.accused,
    shadeCounts: base?.shadeCounts ?? shadeCounts,
    sr: `${hypothesesOf(view).length} explanations, ${s.marks.length} strikes; ${s.accused ? "one accused" : "none accused yet"}.`,
  };
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { WidgetProps } from "./Dial";

/*
 * explain: the player writes an explanation in their own words for a listener character (explainer.teach_back).
 * Grading is entirely on the mode side (src/mechanics/families/explainer/rubric.ts); the view carries no keywords
 * and no exemplars, so this widget cannot and does not judge correctness. Its meter shows effort signals only
 * (length, sentences, connecting words) and is labelled that way.
 */

/** Matches explainer.teach_back's View (src/mechanics/families/explainer/teach_back.ts). */
export interface ExplainView {
  listener: string;
  question: string;
  ideaCount: number;
  required: number;
  wordBank: string[];
  maxChars?: number;
}
export interface ExplainInput {
  text: string;
}

export const DEFAULT_MAX_CHARS = 1200;

export function supports(view: unknown): boolean {
  if (typeof view !== "object" || view === null) return false;
  const v = view as Partial<ExplainView>;
  return typeof v.listener === "string" && typeof v.question === "string" && typeof v.required === "number" && Array.isArray(v.wordBank);
}

/** Pure: the typed text -> the input explainer.teach_back's grade() expects (capped at the grader's limit). */
export function explainToInput(text: string, maxChars: number = DEFAULT_MAX_CHARS): ExplainInput {
  return { text: text.slice(0, maxChars) };
}

// ---------------------------------------------------------------- structure meter (effort, not correctness)

/** Connecting words that signal reasoning. Matched as whole words/phrases, case-insensitive. */
export const CONNECTORS = ["because", "so", "therefore", "since", "which means", "this means", "that means", "as a result", "that's why", "which is why", "thus", "leads to", "so that"] as const;

export interface ExplanationStats {
  words: number;
  sentences: number;
  /** distinct connectors used, in CONNECTORS order */
  connectors: string[];
}

export function explanationStats(text: string): ExplanationStats {
  const flat = text.toLowerCase().replace(/[‘’]/g, "'");
  const words = flat.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const sentences = flat
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => /[\p{L}\p{N}]/u.test(s)).length;
  const connectors = CONNECTORS.filter((c) => new RegExp(`(^|[^\\p{L}\\p{N}'])${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}'])`, "u").test(flat));
  return { words, sentences, connectors };
}

export const METER_TARGETS = { words: 15, sentences: 2, connectors: 1 } as const;

export interface MeterCheck {
  id: "words" | "sentences" | "connectors";
  label: string;
  done: boolean;
  detail: string;
}

/** The three effort checks the meter shows. None of them says anything about whether the explanation is right. */
export function meterChecks(stats: ExplanationStats): MeterCheck[] {
  return [
    { id: "words", label: `At least ${METER_TARGETS.words} words`, done: stats.words >= METER_TARGETS.words, detail: `${stats.words} word${stats.words === 1 ? "" : "s"}` },
    {
      id: "sentences",
      label: `${METER_TARGETS.sentences}+ sentences`,
      done: stats.sentences >= METER_TARGETS.sentences,
      detail: `${stats.sentences} sentence${stats.sentences === 1 ? "" : "s"}`,
    },
    {
      id: "connectors",
      label: "Links ideas (because, so, therefore...)",
      done: stats.connectors.length >= METER_TARGETS.connectors,
      detail: stats.connectors.length > 0 ? stats.connectors.join(", ") : "none yet",
    },
  ];
}

/** 0-3: how many effort checks are met. */
export function structureLevel(stats: ExplanationStats): number {
  return meterChecks(stats).filter((c) => c.done).length;
}

/** Pure: insert `term` at the selection [start, end), padding with spaces so it doesn't glue onto neighbours. */
export function insertAtCursor(text: string, term: string, start: number, end: number): { text: string; cursor: number } {
  const s = Math.max(0, Math.min(start, text.length));
  const e = Math.max(s, Math.min(end, text.length));
  const before = text.slice(0, s);
  const after = text.slice(e);
  const lead = before.length > 0 && !/\s$/.test(before) ? " " : "";
  const trail = after.length > 0 && !/^[\s.,;:!?)]/.test(after) ? " " : after.length === 0 ? " " : "";
  const inserted = `${lead}${term}${trail}`;
  return { text: before + inserted + after, cursor: before.length + inserted.length };
}

/** Ctrl+Enter or Cmd+Enter submits; plain Enter (and Shift+Enter) make a newline. */
export function isSubmitShortcut(e: { key: string; ctrlKey: boolean; metaKey: boolean }): boolean {
  return e.key === "Enter" && (e.ctrlKey || e.metaKey);
}

// ---------------------------------------------------------------- component

export function Explain({ view, onSubmit, onDraft, disabled }: WidgetProps<ExplainView, ExplainInput>) {
  const maxChars = view.maxChars ?? DEFAULT_MAX_CHARS;
  const [text, setText] = useState("");
  const [bankOpen, setBankOpen] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCursor = useRef<number | null>(null);
  const ids = useId();
  const questionId = `${ids}-question`;
  const meterId = `${ids}-meter`;
  const bankId = `${ids}-bank`;

  useEffect(() => {
    onDraft?.({ input: explainToInput(text, maxChars), complete: text.trim().length > 0, focus: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  useEffect(() => {
    const el = areaRef.current;
    if (el && pendingCursor.current !== null) {
      el.focus();
      el.setSelectionRange(pendingCursor.current, pendingCursor.current);
      pendingCursor.current = null;
    }
  }, [text]);

  const stats = explanationStats(text);
  const checks = meterChecks(stats);
  const level = structureLevel(stats);
  const canSubmit = !disabled && text.trim().length > 0;

  const submit = () => {
    if (canSubmit) onSubmit(explainToInput(text, maxChars));
  };

  const insert = (term: string) => {
    const el = areaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = insertAtCursor(text, term, start, end);
    if (next.text.length > maxChars) return;
    pendingCursor.current = next.cursor;
    setText(next.text);
  };

  return (
    <div className="flex flex-col gap-4" data-testid="explain-widget">
      {/* the listener's question, as a speech bubble */}
      <figure className="m-0 rounded-2xl border-2 px-4 py-3" style={{ borderColor: "currentColor", borderBottomLeftRadius: 4 }} data-testid="explain-question">
        <figcaption className="text-sm font-semibold uppercase tracking-wide opacity-80" style={{ fontSize: 14 }}>
          {view.listener} asks
        </figcaption>
        <p id={questionId} className="mt-1 text-xl font-semibold" style={{ fontSize: 22, lineHeight: 1.3 }}>
          &ldquo;{view.question}&rdquo;
        </p>
      </figure>

      <p className="text-base opacity-80" style={{ fontSize: 16 }}>
        Explain it in your own words. {view.required} of the {view.ideaCount} key ideas need to land.
      </p>

      <textarea
        ref={areaRef}
        aria-label="Your explanation"
        aria-describedby={`${questionId} ${meterId}`}
        value={text}
        disabled={disabled}
        maxLength={maxChars}
        rows={6}
        spellCheck
        placeholder="Because..."
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (isSubmitShortcut(e)) {
            e.preventDefault();
            submit();
          }
        }}
        className="w-full rounded-lg border-2 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-4"
        style={{ fontSize: 20, lineHeight: 1.45, minHeight: 190, resize: "none", borderColor: "currentColor", color: "inherit" }}
        data-testid="explain-input"
      />

      {/* effort meter: fixed three rows, so typing never shifts the layout */}
      <section id={meterId} aria-label="Explanation length/structure (not correctness)" className="flex flex-col gap-2" data-testid="explain-meter">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold uppercase tracking-wide opacity-80" style={{ fontSize: 14 }}>
            Explanation length/structure
          </span>
          <span className="text-sm tabular-nums opacity-80" style={{ fontSize: 14 }}>
            {text.length}/{maxChars}
          </span>
        </div>
        <div className="flex gap-1" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2 flex-1 rounded-full" style={{ background: "currentColor", opacity: i < level ? 0.9 : 0.2 }} />
          ))}
        </div>
        <ul className="m-0 grid list-none gap-1 p-0 sm:grid-cols-3" style={{ fontSize: 16 }}>
          {checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2" data-testid={`explain-meter-${c.id}`} data-done={c.done}>
              <span aria-hidden="true" className="inline-block w-5 text-center font-bold">
                {c.done ? "✓" : "○"}
              </span>
              <span>
                <span className="sr-only">{c.done ? "Done: " : "Not yet: "}</span>
                {c.label}
                <span className="block truncate opacity-70" style={{ fontSize: 14 }}>
                  {c.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="m-0 opacity-70" style={{ fontSize: 14 }}>
          This meter only measures length and structure. Your listener judges the ideas.
        </p>
      </section>

      {view.wordBank.length > 0 && (
        <div className="flex flex-col gap-2">
          <div>
            <Button variant="outline" disabled={disabled} aria-expanded={bankOpen} aria-controls={bankId} onClick={() => setBankOpen((o) => !o)} data-testid="explain-bank-toggle">
              {bankOpen ? "Hide word bank" : "Show word bank"}
            </Button>
          </div>
          {bankOpen && (
            <div id={bankId} role="group" aria-label="Word bank: click a term to insert it at the cursor" className="flex flex-wrap gap-2" data-testid="explain-bank">
              {view.wordBank.map((w) => (
                <Button key={w} variant="outline" disabled={disabled} onClick={() => insert(w)} aria-label={`Insert "${w}"`}>
                  {w}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" disabled={!canSubmit} onClick={submit} data-testid="widget-submit">
          Explain it
        </Button>
        <span className="opacity-70" style={{ fontSize: 14 }}>
          Ctrl/⌘ + Enter to submit · Enter for a new line
        </span>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { WidgetProps } from "./Dial";

/*
 * type: free text; the mode fuzzy-matches. Two variants (LIBRARY §4): recall.rapid (timed flashcards,
 * one at a time, missed items re-queued) and recall.cloze (fill the blank in a sentence, optional word
 * bank). Grading is entirely on the mode side (recall/fuzzy.ts); this widget only collects text.
 */

// ---------------------------------------------------------------- recall.rapid

export interface RapidPromptView {
  itemIndex: number;
  prompt: string;
}
export interface RapidView {
  direction: string;
  secondsPerItem: number;
  /** shuffled order of item indices for the first pass; repeats are scheduled by the widget */
  order: number[];
  prompts: RapidPromptView[];
}
export interface RapidAnswer {
  itemIndex: number;
  text: string;
}
export interface RapidInput {
  answers: RapidAnswer[];
}

// ---------------------------------------------------------------- recall.cloze

export interface ClozeView {
  before: string;
  after: string;
  /** the word bank (answer + wrong fillers) shuffled, or [] for free typing */
  bank: string[];
}
export interface ClozeInput {
  text: string;
}

export type TypeView = RapidView | ClozeView;
export type TypeInput = RapidInput | ClozeInput;

export function isRapidView(view: TypeView): view is RapidView {
  return "order" in view && "prompts" in view;
}
export function isClozeView(view: TypeView): view is ClozeView {
  return "before" in view && "after" in view;
}

export function supports(view: unknown): boolean {
  if (typeof view !== "object" || view === null) return false;
  const v = view as TypeView;
  return isRapidView(v) || isClozeView(v);
}

/** Pure: the last-attempt-per-item map -> the input recall.rapid's grade() expects. */
export function rapidAnswersToInput(last: Map<number, string>): RapidInput {
  return { answers: Array.from(last.entries()).map(([itemIndex, text]) => ({ itemIndex, text })) };
}
/** Pure: the typed filler -> the input recall.cloze's grade() expects. */
export function clozeTextToInput(text: string): ClozeInput {
  return { text };
}

/** Builds the queue of item indices to show: `order` first, then each miss re-queued 3 items later,
 * at most twice per item. Pure so it's independently testable. */
export function buildRapidQueue(order: number[]): number[] {
  return [...order];
}

/**
 * type: free text. Variant read from the view's shape: `order`/`prompts` (recall.rapid, timed sequence
 * with re-queued misses) or `before`/`after` (recall.cloze, one blank).
 */
export function Type({ view, onSubmit, disabled }: WidgetProps<TypeView, TypeInput>) {
  if (isRapidView(view)) return <RapidType view={view} onSubmit={onSubmit as (i: RapidInput) => void} disabled={disabled} />;
  return <ClozeType view={view as ClozeView} onSubmit={onSubmit as (i: ClozeInput) => void} disabled={disabled} />;
}

// ---------------------------------------------------------------- recall.rapid UI

const MAX_REQUEUES = 2;
const REQUEUE_DELAY = 3;

function RapidType({ view, onSubmit, disabled }: { view: RapidView; onSubmit: (i: RapidInput) => void; disabled?: boolean }) {
  const [queue, setQueue] = useState<number[]>(() => buildRapidQueue(view.order));
  const [pos, setPos] = useState(0);
  const [requeueCount, setRequeueCount] = useState<Record<number, number>>({});
  const [last, setLast] = useState<Map<number, string>>(new Map());
  const [text, setText] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(view.secondsPerItem);
  const inputRef = useRef<HTMLInputElement>(null);

  const itemIndex = queue[pos];
  const prompt = view.prompts.find((p) => p.itemIndex === itemIndex);
  const done = pos >= queue.length;

  useEffect(() => {
    inputRef.current?.focus();
  }, [pos]);

  const advance = (answerText: string | null) => {
    const nextLast = new Map(last);
    if (answerText !== null) nextLast.set(itemIndex, answerText);
    setLast(nextLast);

    // Re-queue: if this is a miss (empty/timeout counts as attempted-but-not-graded here; the mode
    // grades correctness), give it up to MAX_REQUEUES more looks, spaced REQUEUE_DELAY items later.
    // Since correctness is fuzzy-matched by the mode, the widget can't know whether an answer is right;
    // it re-queues purely by attempt count so the player gets more looks at cards without needing the
    // mode's matcher client-side.
    const count = requeueCount[itemIndex] ?? 0;
    let nextQueue = queue;
    if (count < MAX_REQUEUES) {
      const insertAt = Math.min(nextQueue.length, pos + 1 + REQUEUE_DELAY);
      nextQueue = [...queue.slice(0, insertAt), itemIndex, ...queue.slice(insertAt)];
      setRequeueCount((r) => ({ ...r, [itemIndex]: count + 1 }));
      setQueue(nextQueue);
    }

    if (pos + 1 >= nextQueue.length) {
      onSubmit(rapidAnswersToInput(nextLast));
    } else {
      setPos((p) => p + 1);
      setSecondsLeft(view.secondsPerItem);
      setText("");
    }
  };

  useEffect(() => {
    if (disabled || done) return;
    if (secondsLeft <= 0) {
      advance(text.trim() || null);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, pos, disabled, done]);

  if (done || !prompt) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-lg" style={{ fontSize: 18 }}>
          {view.direction}: <strong data-testid="rapid-prompt">{prompt.prompt}</strong>
        </p>
        <output className="text-xl font-semibold tabular-nums" style={{ fontSize: 20 }} data-testid="rapid-timer">
          {secondsLeft}s
        </output>
      </div>
      <input
        ref={inputRef}
        aria-label="Your answer"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") advance(text.trim());
        }}
        className="rounded-lg border-2 px-3 py-2 text-lg"
        style={{ fontSize: 18 }}
        data-testid="rapid-input"
      />
      <div>
        <Button size="lg" disabled={disabled} onClick={() => advance(text.trim())} data-testid="widget-submit">
          Submit ({pos + 1}/{queue.length})
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- recall.cloze UI

function ClozeType({ view, onSubmit, disabled }: { view: ClozeView; onSubmit: (i: ClozeInput) => void; disabled?: boolean }) {
  const [text, setText] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }} data-testid="cloze-sentence">
        {view.before}{" "}
        <input
          aria-label="Fill in the blank"
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit(clozeTextToInput(text));
          }}
          className="mx-1 inline-block rounded-md border-2 px-2 py-1 text-lg"
          style={{ fontSize: 18, minWidth: 100 }}
          data-testid="cloze-input"
        />{" "}
        {view.after}
      </p>
      {view.bank.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Word bank" data-testid="cloze-bank">
          {view.bank.map((w) => (
            <Button key={w} variant="outline" disabled={disabled} onClick={() => setText(w)}>
              {w}
            </Button>
          ))}
        </div>
      )}
      <div>
        <Button size="lg" disabled={disabled} onClick={() => onSubmit(clozeTextToInput(text))} data-testid="widget-submit">
          Fill the blank
        </Button>
      </div>
    </div>
  );
}

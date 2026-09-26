"use client";

import { useEffect, useRef, useState } from "react";
import type { WidgetProps } from "./Dial";

/** Matches mode mimic's View (src/mechanics/families/truth_finder/mimic.ts). */
export interface PickChestsView {
  chests: { statementIndex: number; text: string }[];
}
export interface PickChestsInput {
  statementIndex: number;
}

/** Matches mode type_match's View (src/mechanics/families/sorter/type_match.ts). */
export interface PickWavesView {
  categories: { id: string; label: string }[];
  waves: { waveIndex: number; text: string }[];
  secondsPerWave: number;
}
export interface PickWavesInput {
  answers: { waveIndex: number; categoryId: string }[];
}

/** Matches mode predict_reveal's View (src/mechanics/families/truth_finder/predict_reveal.ts). */
export interface PickOptionsView {
  scenario: string;
  options: { optionIndex: number; text: string }[];
}
export interface PickOptionsInput {
  optionIndex: number;
}

export type PickView = PickChestsView | PickWavesView | PickOptionsView;
export type PickInput = PickChestsInput | PickWavesInput | PickOptionsInput;

export function isWavesView(view: PickView): view is PickWavesView {
  return "waves" in view;
}
export function isOptionsView(view: PickView): view is PickOptionsView {
  return "options" in view;
}

/** Pure: the picked chest -> the input mimic's grade() expects. */
export function chestsToInput(statementIndex: number): PickChestsInput {
  return { statementIndex };
}
/** Pure: the picked option -> the input predict_reveal's grade() expects. */
export function optionsToInput(optionIndex: number): PickOptionsInput {
  return { optionIndex };
}
/** Pure: the per-wave answers gathered so far -> the input type_match's grade() expects. A wave with no
 * recorded answer (timed out) is simply left out. */
export function wavesToInput(answers: { waveIndex: number; categoryId: string }[]): PickWavesInput {
  return { answers };
}

/**
 * pick: choose one of N. Variant is read from the view's shape: `chests` (mimic, one-shot pick),
 * `waves` (type_match, timed sequence), or `options` (predict_reveal, one-shot pick).
 */
export function Pick({ view, onSubmit, disabled }: WidgetProps<PickView, PickInput>) {
  if (isWavesView(view)) return <WavesPick view={view} onSubmit={onSubmit as (i: PickWavesInput) => void} disabled={disabled} />;
  if (isOptionsView(view)) return <OneShotPick label="Predict what happens." items={view.options} onSubmit={(i) => onSubmit(optionsToInput(i))} disabled={disabled} />;
  return (
    <OneShotPick
      label="Choose the one that's false."
      items={view.chests.map((c) => ({ optionIndex: c.statementIndex, text: c.text }))}
      onSubmit={(i) => onSubmit(chestsToInput(i))}
      disabled={disabled}
    />
  );
}

function OneShotPick({
  label,
  items,
  onSubmit,
  disabled,
}: {
  label: string;
  items: { optionIndex: number; text: string }[];
  onSubmit: (optionIndex: number) => void;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    refs.current[focused]?.focus();
  }, [focused]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        {label}
      </p>
      <div
        role="radiogroup"
        aria-label="Pick one"
        className="grid gap-3"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            setFocused((f) => Math.min(items.length - 1, f + 1));
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            setFocused((f) => Math.max(0, f - 1));
          }
        }}
      >
        {items.map((c, i) => (
          <button
            key={c.optionIndex}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="radio"
            aria-checked={focused === i}
            disabled={disabled}
            data-testid={i === 0 ? "widget-first-option" : undefined}
            onFocus={() => setFocused(i)}
            onClick={() => onSubmit(c.optionIndex)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSubmit(c.optionIndex);
              }
            }}
            className="rounded-lg border-2 px-4 py-3 text-left text-lg transition-colors focus-visible:outline-none focus-visible:ring-4"
            style={{
              fontSize: 18,
              borderColor: focused === i ? "currentColor" : "color-mix(in oklab, currentColor 30%, transparent)",
              background: focused === i ? "color-mix(in oklab, currentColor 12%, transparent)" : "transparent",
            }}
          >
            {c.text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Timed waves: one wave at a time with a countdown; an unanswered wave (timeout) is skipped. */
function WavesPick({ view, onSubmit, disabled }: { view: PickWavesView; onSubmit: (i: PickWavesInput) => void; disabled?: boolean }) {
  const [waveIndex, setWaveIndex] = useState(0);
  const [answers, setAnswers] = useState<{ waveIndex: number; categoryId: string }[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(view.secondsPerWave);
  const [focused, setFocused] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const wave = view.waves[waveIndex];
  const isLast = waveIndex >= view.waves.length - 1;

  const advance = (answered: { waveIndex: number; categoryId: string } | null) => {
    const next = answered ? [...answers, answered] : answers;
    setAnswers(next);
    if (isLast) {
      onSubmit(wavesToInput(next));
    } else {
      setWaveIndex((w) => w + 1);
      setSecondsLeft(view.secondsPerWave);
      setFocused(0);
    }
  };

  useEffect(() => {
    if (disabled) return;
    if (secondsLeft <= 0) {
      advance(null);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, waveIndex, disabled]);

  useEffect(() => {
    refs.current[focused]?.focus();
  }, [focused, waveIndex]);

  if (!wave) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-lg" style={{ fontSize: 18 }}>
          Wave {waveIndex + 1} of {view.waves.length}: <strong>{wave.text}</strong>
        </p>
        <output className="text-xl font-semibold tabular-nums" style={{ fontSize: 20 }} data-testid="wave-timer">
          {secondsLeft}s
        </output>
      </div>
      <div
        role="radiogroup"
        aria-label="Category"
        className="grid gap-3"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            setFocused((f) => Math.min(view.categories.length - 1, f + 1));
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            setFocused((f) => Math.max(0, f - 1));
          }
        }}
      >
        {view.categories.map((c, i) => (
          <button
            key={c.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="radio"
            aria-checked={focused === i}
            disabled={disabled}
            onFocus={() => setFocused(i)}
            onClick={() => advance({ waveIndex: wave.waveIndex, categoryId: c.id })}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                advance({ waveIndex: wave.waveIndex, categoryId: c.id });
              }
            }}
            className="rounded-lg border-2 px-4 py-3 text-left text-lg"
            style={{
              fontSize: 18,
              borderColor: focused === i ? "currentColor" : "color-mix(in oklab, currentColor 30%, transparent)",
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
      {isLast && (
        <p className="text-sm opacity-70" style={{ fontSize: 14 }}>
          Last wave: answering locks in your run.
        </p>
      )}
    </div>
  );
}

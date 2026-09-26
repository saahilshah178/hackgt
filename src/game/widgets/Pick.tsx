"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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

/** Matches mode function_machine's View (src/mechanics/families/transformer/function_machine.ts). */
export interface PickFunctionMachineView {
  ask: "output" | "rule";
  examples: { x: number; y: number }[];
  query: number | null;
  ruleOptions: { ruleIndex: number; text: string }[];
  inputLabel: string;
  outputLabel: string;
}
export interface PickFunctionMachineInput {
  value: number | null;
  ruleIndex: number | null;
}

/** Matches mode trace's View (src/mechanics/families/transformer/trace.ts). */
export interface PickTraceView {
  program: string[];
  ask: "final_value" | "output";
  variable: string;
  options: { optionIndex: number; text: string }[];
}
export interface PickTraceInput {
  optionIndex: number;
}

/** Matches mode sample's View (src/mechanics/families/simulator/sample.ts). */
export interface PickSampleView {
  watch: string;
  trials: number;
  statistic: string;
  question: string;
  variables: string[];
  initial: Record<string, number>;
  options: { optionIndex: number; text: string }[];
}
export interface PickSampleInput {
  optionIndex: number;
}

/** Matches mode ratio's View (src/mechanics/families/balance/ratio.ts). */
export interface PickRatioView {
  ask: "limiting" | "product" | "both";
  recipe: { name: string; amount: number; unit: string }[];
  available: { name: string; amount: number }[];
  product: { name: string; perBatch: number; unit: string };
}
export interface PickRatioInput {
  limiting: string | null;
  product: number | null;
}

/** Matches mode counterexample's View (src/mechanics/families/truth_finder/counterexample.ts). */
export interface PickCasesView {
  rule: string;
  cases: { caseIndex: number; text: string }[];
}
export interface PickCasesInput {
  caseIndex: number;
}

/** Matches mode error_hunt's View (src/mechanics/families/truth_finder/error_hunt.ts). */
export interface PickLinesView {
  title: string;
  lines: { lineIndex: number; text: string }[];
}
export interface PickLinesInput {
  lineIndex: number;
}

export type PickView =
  | PickChestsView
  | PickWavesView
  | PickOptionsView
  | PickFunctionMachineView
  | PickTraceView
  | PickSampleView
  | PickRatioView
  | PickCasesView
  | PickLinesView;
export type PickInput =
  | PickChestsInput
  | PickWavesInput
  | PickOptionsInput
  | PickFunctionMachineInput
  | PickTraceInput
  | PickSampleInput
  | PickRatioInput
  | PickCasesInput
  | PickLinesInput;

export function isWavesView(view: PickView): view is PickWavesView {
  return "waves" in view;
}
export function isOptionsView(view: PickView): view is PickOptionsView {
  return "options" in view && "scenario" in view;
}
export function isFunctionMachineView(view: PickView): view is PickFunctionMachineView {
  return "examples" in view;
}
export function isTraceView(view: PickView): view is PickTraceView {
  return "program" in view;
}
export function isSampleView(view: PickView): view is PickSampleView {
  return "options" in view && "trials" in view;
}
export function isRatioView(view: PickView): view is PickRatioView {
  return "recipe" in view;
}
export function isCasesView(view: PickView): view is PickCasesView {
  return "cases" in view && "rule" in view;
}
export function isLinesView(view: PickView): view is PickLinesView {
  return "lines" in view && "title" in view;
}
export function isChestsView(view: PickView): view is PickChestsView {
  return "chests" in view;
}

/** Every PickView shape this component actually knows how to render. */
export function supports(view: unknown): boolean {
  if (typeof view !== "object" || view === null) return false;
  const v = view as PickView;
  return (
    isWavesView(v) ||
    isOptionsView(v) ||
    isFunctionMachineView(v) ||
    isTraceView(v) ||
    isSampleView(v) ||
    isRatioView(v) ||
    isCasesView(v) ||
    isLinesView(v) ||
    isChestsView(v)
  );
}

/** Pure: the picked chest -> the input mimic's grade() expects. */
export function chestsToInput(statementIndex: number): PickChestsInput {
  return { statementIndex };
}
/** Pure: the picked option -> the input predict_reveal's grade() expects. */
export function optionsToInput(optionIndex: number): PickOptionsInput {
  return { optionIndex };
}
/** Pure: the predicted numeric output -> the input function_machine (ask=output) grade() expects. */
export function functionMachineOutputToInput(value: number): PickFunctionMachineInput {
  return { value, ruleIndex: null };
}
/** Pure: the chosen rule's original index -> the input function_machine (ask=rule) grade() expects. */
export function functionMachineRuleToInput(ruleIndex: number): PickFunctionMachineInput {
  return { value: null, ruleIndex };
}
/** Pure: the picked option's index -> the input trace's grade() expects. */
export function traceToInput(optionIndex: number): PickTraceInput {
  return { optionIndex };
}
/** Pure: the picked option's index -> the input simulator.sample's grade() expects. */
export function sampleToInput(optionIndex: number): PickSampleInput {
  return { optionIndex };
}
/** Pure: the picked limiting ingredient and/or entered product amount -> the input balance.ratio's grade() expects. */
export function ratioToInput(limiting: string | null, product: number | null): PickRatioInput {
  return { limiting, product };
}
/** Pure: the picked case's index -> the input truth_finder.counterexample's grade() expects. */
export function caseToInput(caseIndex: number): PickCasesInput {
  return { caseIndex };
}
/** Pure: the picked line's index -> the input truth_finder.error_hunt's grade() expects. */
export function lineToInput(lineIndex: number): PickLinesInput {
  return { lineIndex };
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
  if (isFunctionMachineView(view))
    return <FunctionMachinePick view={view} onSubmit={onSubmit as (i: PickFunctionMachineInput) => void} disabled={disabled} />;
  if (isTraceView(view)) return <TracePick view={view} onSubmit={onSubmit as (i: PickTraceInput) => void} disabled={disabled} />;
  if (isRatioView(view)) return <RatioPick view={view} onSubmit={onSubmit as (i: PickRatioInput) => void} disabled={disabled} />;
  if (isSampleView(view))
    return (
      <OneShotPick
        label={view.question}
        items={view.options}
        onSubmit={(i) => onSubmit(sampleToInput(i))}
        disabled={disabled}
      />
    );
  if (isCasesView(view))
    return (
      <OneShotPick
        label={`Which case breaks the rule "${view.rule}"?`}
        items={view.cases.map((c) => ({ optionIndex: c.caseIndex, text: c.text }))}
        onSubmit={(i) => onSubmit(caseToInput(i))}
        disabled={disabled}
      />
    );
  if (isLinesView(view))
    return (
      <OneShotPick
        label={`Which numbered line in "${view.title}" is wrong?`}
        items={view.lines.map((l) => ({ optionIndex: l.lineIndex, text: `${l.lineIndex + 1}. ${l.text}` }))}
        onSubmit={(i) => onSubmit(lineToInput(i))}
        disabled={disabled}
      />
    );
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

/** balance.ratio: pick the limiting ingredient (ask includes "limiting") and/or type the product amount
 * (ask includes "product"). Submits once every field the mode asks for is filled. */
function RatioPick({ view, onSubmit, disabled }: { view: PickRatioView; onSubmit: (i: PickRatioInput) => void; disabled?: boolean }) {
  const [limiting, setLimiting] = useState<string | null>(null);
  const [productText, setProductText] = useState("");
  const needsLimiting = view.ask === "limiting" || view.ask === "both";
  const needsProduct = view.ask === "product" || view.ask === "both";
  const product = productText.trim() === "" ? null : Number(productText);
  const ready = (!needsLimiting || limiting !== null) && (!needsProduct || (product !== null && Number.isFinite(product)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 rounded-lg border p-3" data-testid="ratio-recipe">
        <span className="text-sm font-semibold uppercase tracking-wide opacity-80" style={{ fontSize: 14 }}>
          Recipe (per batch)
        </span>
        {view.recipe.map((r) => (
          <span key={r.name} style={{ fontSize: 16 }}>
            {r.name}: {r.amount} {r.unit}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-1 rounded-lg border p-3" data-testid="ratio-available">
        <span className="text-sm font-semibold uppercase tracking-wide opacity-80" style={{ fontSize: 14 }}>
          Available
        </span>
        {view.available.map((a) => (
          <span key={a.name} style={{ fontSize: 16 }}>
            {a.name}: {a.amount}
          </span>
        ))}
      </div>
      {needsLimiting && (
        <>
          <p className="text-lg" style={{ fontSize: 18 }}>
            Which ingredient limits the batch?
          </p>
          <div role="radiogroup" aria-label="Limiting ingredient" className="grid gap-2">
            {view.recipe.map((r) => (
              <button
                key={r.name}
                role="radio"
                aria-checked={limiting === r.name}
                disabled={disabled}
                onClick={() => setLimiting(r.name)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setLimiting(r.name);
                  }
                }}
                className="rounded-lg border-2 px-4 py-3 text-left text-lg"
                style={{
                  fontSize: 18,
                  borderColor: limiting === r.name ? "currentColor" : "color-mix(in oklab, currentColor 30%, transparent)",
                  background: limiting === r.name ? "color-mix(in oklab, currentColor 12%, transparent)" : "transparent",
                }}
              >
                {r.name}
              </button>
            ))}
          </div>
        </>
      )}
      {needsProduct && (
        <>
          <p className="text-lg" style={{ fontSize: 18 }}>
            How much {view.product.name} ({view.product.unit}) can be made?
          </p>
          <input
            type="number"
            aria-label={`${view.product.name} produced`}
            value={productText}
            disabled={disabled}
            onChange={(e) => setProductText(e.target.value)}
            className="rounded-lg border-2 px-3 py-2 text-lg tabular-nums"
            style={{ fontSize: 18, width: 160 }}
            data-testid="ratio-product-input"
          />
        </>
      )}
      <div>
        <Button size="lg" disabled={disabled || !ready} onClick={() => onSubmit(ratioToInput(limiting, product))} data-testid="widget-submit">
          Lock in answer
        </Button>
      </div>
    </div>
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

/** transformer.function_machine: the examples table, then either a numeric guess (ask=output) or the
 * shuffled rule options (ask=rule). */
function FunctionMachinePick({
  view,
  onSubmit,
  disabled,
}: {
  view: PickFunctionMachineView;
  onSubmit: (i: PickFunctionMachineInput) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <table className="border-collapse text-left" data-testid="function-machine-examples" style={{ fontSize: 16 }}>
        <thead>
          <tr>
            <th className="border-b p-1">{view.inputLabel}</th>
            <th className="border-b p-1">{view.outputLabel}</th>
          </tr>
        </thead>
        <tbody>
          {view.examples.map((e, i) => (
            <tr key={i}>
              <td className="p-1 tabular-nums">{e.x}</td>
              <td className="p-1 tabular-nums">{e.y}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {view.ask === "output" ? (
        <>
          <p className="text-lg" style={{ fontSize: 18 }}>
            What {view.outputLabel} does the machine produce for {view.query}?
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              aria-label={`Predicted ${view.outputLabel}`}
              value={value}
              disabled={disabled}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && value.trim()) onSubmit(functionMachineOutputToInput(Number(value)));
              }}
              className="rounded-lg border-2 px-3 py-2 text-lg tabular-nums"
              style={{ fontSize: 18, width: 140 }}
              data-testid="function-machine-value"
            />
            <Button
              size="lg"
              disabled={disabled || value.trim() === ""}
              onClick={() => onSubmit(functionMachineOutputToInput(Number(value)))}
              data-testid="widget-submit"
            >
              Submit
            </Button>
          </div>
        </>
      ) : (
        <OneShotPick
          label="Which rule is the machine using?"
          items={view.ruleOptions.map((o) => ({ optionIndex: o.ruleIndex, text: o.text }))}
          onSubmit={(i) => onSubmit(functionMachineRuleToInput(i))}
          disabled={disabled}
        />
      )}
    </div>
  );
}

/** transformer.trace: the program in a monospace panel, then the shuffled candidate answers. */
function TracePick({ view, onSubmit, disabled }: { view: PickTraceView; onSubmit: (i: PickTraceInput) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <pre
        className="overflow-x-auto rounded-lg border-2 p-3 font-mono"
        style={{ fontSize: 15 }}
        data-testid="trace-program"
      >
        {view.program.join("\n")}
      </pre>
      <OneShotPick
        label={view.ask === "output" ? "What does the program print?" : `What is the final value of ${view.variable}?`}
        items={view.options}
        onSubmit={(i) => onSubmit(traceToInput(i))}
        disabled={disabled}
      />
    </div>
  );
}

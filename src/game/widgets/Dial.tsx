"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { evaluate } from "mathjs";
import { Button } from "@/components/ui/button";

/** Matches mode oscillator's View (src/mechanics/families/tuner/oscillator.ts). */
export interface OscillatorDialView {
  equation: string;
  ask: string;
  askLabel: string;
  wave: "sin" | "cos";
  amplitude: number;
  b: number;
  c: number;
  d: number;
  dial: { min: number; max: number; step: number; ticks: { value: number; label: string }[]; unit: string };
}

/** Matches mode formula's View (src/mechanics/families/tuner/formula.ts). */
export interface FormulaDialView {
  expression: string;
  outputName: string;
  outputUnit: string;
  fixed: { name: string; value: number; unit: string }[];
  dial: { name: string; unit: string; min: number; max: number; step: number; ticks: { value: number; label: string }[] };
  target: number;
  targetLabel: string;
}

export type DialView = OscillatorDialView | FormulaDialView;

export interface DialInput {
  value: number;
}

/** Pure: the slider's current numeric value -> the input grade() expects. Shared by both dial variants. */
export function dialToInput(value: number): DialInput {
  return { value };
}

function isFormulaView(view: DialView): view is FormulaDialView {
  return "fixed" in view && "expression" in view;
}

export interface WidgetProps<View, Input> {
  view: View;
  /** Called on submit (Enter or the Lock in button). */
  onSubmit: (input: Input) => void;
  /** Called on every change, before submit, so the host can animate the in-world object live. */
  onLive?: (value: number) => void;
  disabled?: boolean;
}

function trim(x: number): string {
  if (!Number.isFinite(x)) return String(x);
  const r = Math.round(x * 1000) / 1000;
  return String(r);
}

/** dial: slider + numeric readout with tick labels. Drives the in-world object live via onLive. */
export function Dial({ view, onSubmit, onLive, disabled }: WidgetProps<DialView, DialInput>) {
  const id = useId();
  const { dial } = view;
  const [value, setValue] = useState(() => (dial.min + dial.max) / 2);
  const formula = isFormulaView(view);

  useEffect(() => {
    onLive?.(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const liveOutput = useMemo(() => {
    if (!formula) return null;
    try {
      const scope: Record<string, number> = { [(view as FormulaDialView).dial.name]: value };
      for (const f of (view as FormulaDialView).fixed) scope[f.name] = f.value;
      const out = evaluate((view as FormulaDialView).expression, scope);
      return typeof out === "number" && Number.isFinite(out) ? out : null;
    } catch {
      return null;
    }
  }, [formula, view, value]);

  return (
    <div className="flex flex-col gap-4">
      {formula ? (
        <>
          <p className="text-lg font-medium" style={{ fontSize: 20 }}>
            {(view as FormulaDialView).outputName} = {(view as FormulaDialView).expression}
          </p>
          <div className="flex flex-wrap gap-3 text-base" style={{ fontSize: 16 }}>
            {(view as FormulaDialView).fixed.map((f) => (
              <span key={f.name} className="rounded-md border px-2 py-1">
                {f.name} = {trim(f.value)} {f.unit}
              </span>
            ))}
          </div>
          <p className="text-base" style={{ fontSize: 18 }}>
            Target <strong>{(view as FormulaDialView).outputName}</strong>: {(view as FormulaDialView).targetLabel}
          </p>
        </>
      ) : (
        <>
          <p className="text-lg font-medium" style={{ fontSize: 20 }}>
            {(view as OscillatorDialView).equation}
          </p>
          <p className="text-base" style={{ fontSize: 18 }}>
            Dial in the <strong>{(view as OscillatorDialView).askLabel}</strong>.
          </p>
        </>
      )}
      <label htmlFor={id} className="sr-only">
        {formula ? (view as FormulaDialView).dial.name : (view as OscillatorDialView).askLabel}
      </label>
      <input
        id={id}
        type="range"
        min={dial.min}
        max={dial.max}
        step={dial.step}
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(Number(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit(dialToInput(value));
        }}
        className="w-full accent-current"
        style={{ height: 32 }}
        aria-valuetext={`${value.toFixed(2)} ${dial.unit}`}
      />
      <div className="flex justify-between text-sm opacity-80" style={{ fontSize: 15 }}>
        {dial.ticks.map((t) => (
          <span key={t.value}>{t.label}</span>
        ))}
      </div>
      <div className="flex items-center justify-between gap-4">
        <output htmlFor={id} className="text-2xl font-semibold tabular-nums" style={{ fontSize: 24 }}>
          {value.toFixed(2)} {dial.unit}
        </output>
        {formula && (
          <output className="text-lg tabular-nums opacity-80" style={{ fontSize: 18 }} data-testid="dial-live-output">
            {(view as FormulaDialView).outputName} ={" "}
            {liveOutput === null ? "—" : `${trim(liveOutput)} ${(view as FormulaDialView).outputUnit}`}
          </output>
        )}
        <Button size="lg" disabled={disabled} onClick={() => onSubmit(dialToInput(value))} data-testid="widget-submit">
          Lock in
        </Button>
      </div>
    </div>
  );
}

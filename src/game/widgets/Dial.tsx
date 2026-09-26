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

/** Matches mode area's View (src/mechanics/families/accumulator/area.ts): dial the upper bound b. */
export interface AreaDialView {
  expr: string;
  a: number;
  bMin: number;
  bMax: number;
  target: number;
  samples: { x: number; y: number | null }[];
}
export interface AreaDialInput {
  value: number;
}

/** Matches mode signed's View (src/mechanics/families/accumulator/signed.ts): report the net signed area,
 * or its sign. */
export interface SignedDialView {
  expr: string;
  a: number;
  b: number;
  ask: "net" | "sign";
  samples: { x: number; y: number | null }[];
}
export interface SignedDialInput {
  value: number | null;
  sign: "positive" | "negative" | "zero" | null;
}

/** Matches mode rate_total's View (src/mechanics/families/accumulator/rate_total.ts): dial the resulting
 * total quantity after integrating the rate. */
export interface RateTotalDialView {
  rateExpr: string;
  t0: number;
  t1: number;
  initial: number;
  quantityName: string;
  unit: string;
  samples: { x: number; y: number | null }[];
}
export interface RateTotalDialInput {
  value: number;
}

/** Matches mode average_value's View (src/mechanics/families/accumulator/average_value.ts): dial the
 * mean value of f over [a,b]. */
export interface AverageValueDialView {
  expr: string;
  a: number;
  b: number;
  samples: { x: number; y: number | null }[];
}
export interface AverageValueDialInput {
  value: number;
}

/** Matches mode secant's View (src/mechanics/families/function_world/secant.ts): dial the instantaneous
 * rate of change at a, informed by the secant slopes shown for each window. */
export interface SecantDialView {
  a: number;
  xMin: number;
  xMax: number;
  samples: { x: number; y: number | null }[];
  windows: number[];
  quantity: string;
}
export interface SecantDialInput {
  value: number;
}

/** Matches mode weigh's View (src/mechanics/families/investigator/weigh.ts): one slider per cause; only
 * the resulting rank order is graded. */
export interface WeighDialView {
  question: string;
  causes: { key: string; text: string }[];
  total: number;
}
export interface WeighDialInput {
  weights: { causeKey: string; value: number }[];
}

/** Matches mode reach_state's View (src/mechanics/families/simulator/reach_state.ts): dial one initial
 * value so the system reaches the target at a given tick. */
export interface ReachStateDialView {
  variables: string[];
  initial: Record<string, number>;
  control: { variable: string; min: number; max: number; step: number };
  target: { variable: string; value: number; tolerance: number };
  atTick: number;
  ticks: number;
}
export interface ReachStateDialInput {
  value: number;
}

/** Matches mode optimize's View (src/mechanics/families/tuner/optimize.ts): dial the input to max/min the
 * objective. */
export interface OptimizeDialView {
  objective: string;
  goal: "max" | "min";
  xMin: number;
  xMax: number;
  inputName: string;
  outputName: string;
  samples: { x: number; y: number }[];
}
export interface OptimizeDialInput {
  x: number;
}

/** Matches mode curve's View (src/mechanics/families/tuner/curve.ts): one slider per template parameter,
 * live-checked against the checkpoints. */
export interface CurveDialView {
  template: string;
  formula: string;
  params: { name: string; min: number; max: number; step: number }[];
  checkpoints: { x: number; y: number }[];
  xMin: number;
  xMax: number;
}
export interface CurveDialInput {
  values: { name: string; value: number }[];
}

/** Matches mode intervene's View (src/mechanics/families/simulator/intervene.ts): a per-tick schedule of
 * control changes, bounded by `budget` entries. */
export interface IntervenceDialView {
  variables: string[];
  initial: Record<string, number>;
  control: { variable: string; min: number; max: number; step: number };
  target: { variable: string; low: number; high: number };
  ticks: number;
  budget: number;
}
export interface IntervenceDialInput {
  schedule: { tick: number; value: number }[];
}

export type DialView =
  | OscillatorDialView
  | FormulaDialView
  | AreaDialView
  | SignedDialView
  | RateTotalDialView
  | AverageValueDialView
  | SecantDialView
  | WeighDialView
  | ReachStateDialView
  | OptimizeDialView
  | CurveDialView
  | IntervenceDialView;

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
export function isAreaView(view: DialView): view is AreaDialView {
  return "bMin" in view && "bMax" in view;
}
export function isSignedView(view: DialView): view is SignedDialView {
  return "ask" in view && "expr" in view && !("bMin" in view);
}
export function isRateTotalView(view: DialView): view is RateTotalDialView {
  return "rateExpr" in view;
}
export function isAverageValueView(view: DialView): view is AverageValueDialView {
  return "expr" in view && "a" in view && "b" in view && !("ask" in view) && !("bMin" in view);
}
export function isSecantView(view: DialView): view is SecantDialView {
  return "windows" in view;
}
export function isWeighView(view: DialView): view is WeighDialView {
  return "causes" in view;
}
export function isReachStateView(view: DialView): view is ReachStateDialView {
  return "atTick" in view;
}
export function isOptimizeView(view: DialView): view is OptimizeDialView {
  return "objective" in view;
}
export function isCurveView(view: DialView): view is CurveDialView {
  return "template" in view;
}
export function isIntervenceView(view: DialView): view is IntervenceDialView {
  return "budget" in view;
}

export function supports(view: unknown): boolean {
  if (typeof view !== "object" || view === null) return false;
  const v = view as DialView;
  return (
    "dial" in v ||
    isAreaView(v) ||
    isSignedView(v) ||
    isRateTotalView(v) ||
    isAverageValueView(v) ||
    isSecantView(v) ||
    isWeighView(v) ||
    isReachStateView(v) ||
    isOptimizeView(v) ||
    isCurveView(v) ||
    isIntervenceView(v)
  );
}

/** A widget's live, possibly partial input for the Expedition panel (docs/design/20 §3.3, WidgetControl). */
export interface WidgetDraft {
  input: unknown;
  complete: boolean;
  focus: string | null;
}

export interface WidgetProps<View, Input> {
  view: View;
  /** Called on submit (Enter or the Lock in button). */
  onSubmit: (input: Input) => void;
  /** @deprecated Legacy hosts only (number-only live value); the Expedition panel uses `onDraft`. */
  onLive?: (value: number) => void;
  /** Called from the same effects that hold the widget's local state, so the world mirrors the draft (§3.3). */
  onDraft?: (d: WidgetDraft) => void;
  disabled?: boolean;
}

function trim(x: number): string {
  if (!Number.isFinite(x)) return String(x);
  const r = Math.round(x * 1000) / 1000;
  return String(r);
}

/** dial: slider + numeric readout with tick labels. Drives the in-world object live via onLive. */
export function Dial({ view, onSubmit, onLive, onDraft, disabled }: WidgetProps<DialView, unknown>) {
  if (isAreaView(view)) return <AreaDial view={view} onSubmit={onSubmit as (i: AreaDialInput) => void} disabled={disabled} />;
  if (isSignedView(view)) return <SignedDial view={view} onSubmit={onSubmit as (i: SignedDialInput) => void} disabled={disabled} />;
  if (isRateTotalView(view)) return <RateTotalDial view={view} onSubmit={onSubmit as (i: RateTotalDialInput) => void} disabled={disabled} />;
  if (isAverageValueView(view)) return <AverageValueDial view={view} onSubmit={onSubmit as (i: AverageValueDialInput) => void} disabled={disabled} />;
  if (isSecantView(view)) return <SecantDial view={view} onSubmit={onSubmit as (i: SecantDialInput) => void} disabled={disabled} />;
  if (isWeighView(view)) return <WeighDial view={view} onSubmit={onSubmit as (i: WeighDialInput) => void} disabled={disabled} />;
  if (isReachStateView(view)) return <ReachStateDial view={view} onSubmit={onSubmit as (i: ReachStateDialInput) => void} disabled={disabled} />;
  if (isOptimizeView(view)) return <OptimizeDial view={view} onSubmit={onSubmit as (i: OptimizeDialInput) => void} disabled={disabled} />;
  if (isCurveView(view)) return <CurveDial view={view} onSubmit={onSubmit as (i: CurveDialInput) => void} disabled={disabled} />;
  if (isIntervenceView(view)) return <IntervenceDial view={view} onSubmit={onSubmit as (i: IntervenceDialInput) => void} disabled={disabled} />;
  return <BaseDial view={view} onSubmit={onSubmit as (i: DialInput) => void} onLive={onLive} onDraft={onDraft} disabled={disabled} />;
}

/** A single labeled slider + numeric readout, shared by several dial variants below. */
function SingleSlider({
  label,
  min,
  max,
  step,
  unit,
  initial,
  onChange,
  disabled,
  testId,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  initial: number;
  onChange?: (v: number) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const id = useId();
  const [value, setValue] = useState(initial);
  useEffect(() => {
    onChange?.(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} style={{ fontSize: 16 }}>
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full accent-current"
        style={{ height: 32 }}
        data-testid={testId}
      />
      <output htmlFor={id} className="text-xl font-semibold tabular-nums" style={{ fontSize: 20 }}>
        {value.toFixed(2)} {unit}
      </output>
    </div>
  );
}

function AreaDial({ view, onSubmit, disabled }: { view: AreaDialView; onSubmit: (i: AreaDialInput) => void; disabled?: boolean }) {
  const [value, setValue] = useState((view.bMin + view.bMax) / 2);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Dial the upper bound b so the area under {view.expr} from {view.a} to b hits the target {view.target}.
      </p>
      <SingleSlider label="Upper bound b" min={view.bMin} max={view.bMax} step={(view.bMax - view.bMin) / 400} initial={value} onChange={setValue} disabled={disabled} testId="area-slider" />
      <div>
        <Button size="lg" disabled={disabled} onClick={() => onSubmit({ value })} data-testid="widget-submit">
          Lock in
        </Button>
      </div>
    </div>
  );
}

function SignedDial({ view, onSubmit, disabled }: { view: SignedDialView; onSubmit: (i: SignedDialInput) => void; disabled?: boolean }) {
  const [value, setValue] = useState("0");
  const [sign, setSign] = useState<"positive" | "negative" | "zero">("positive");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        {view.ask === "net" ? `What is the net signed area of ${view.expr} from ${view.a} to ${view.b}?` : `What is the sign of the net signed area of ${view.expr} from ${view.a} to ${view.b}?`}
      </p>
      {view.ask === "net" ? (
        <input
          type="number"
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-lg border-2 px-3 py-2 text-lg tabular-nums"
          style={{ fontSize: 18, width: 160 }}
          data-testid="signed-value"
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant={sign === "positive" ? "default" : "outline"} disabled={disabled} onClick={() => setSign("positive")}>Positive</Button>
          <Button variant={sign === "negative" ? "default" : "outline"} disabled={disabled} onClick={() => setSign("negative")}>Negative</Button>
          <Button variant={sign === "zero" ? "default" : "outline"} disabled={disabled} onClick={() => setSign("zero")}>Zero</Button>
        </div>
      )}
      <div>
        <Button
          size="lg"
          disabled={disabled}
          onClick={() => onSubmit({ value: view.ask === "net" ? Number(value) : null, sign: view.ask === "sign" ? sign : null })}
          data-testid="widget-submit"
        >
          Lock in answer
        </Button>
      </div>
    </div>
  );
}

function RateTotalDial({ view, onSubmit, disabled }: { view: RateTotalDialView; onSubmit: (i: RateTotalDialInput) => void; disabled?: boolean }) {
  const [value, setValue] = useState(view.initial);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        {view.quantityName} starts at {view.initial}{view.unit} and changes at rate {view.rateExpr} from t={view.t0} to t={view.t1}. Dial the
        resulting total.
      </p>
      <SingleSlider
        label={`Total ${view.quantityName}`}
        min={view.initial - Math.abs(view.initial) - 100}
        max={view.initial + Math.abs(view.initial) + 100}
        step={0.1}
        unit={view.unit}
        initial={value}
        onChange={setValue}
        disabled={disabled}
        testId="rate-total-slider"
      />
      <div>
        <Button size="lg" disabled={disabled} onClick={() => onSubmit({ value })} data-testid="widget-submit">
          Lock in
        </Button>
      </div>
    </div>
  );
}

function AverageValueDial({ view, onSubmit, disabled }: { view: AverageValueDialView; onSubmit: (i: AverageValueDialInput) => void; disabled?: boolean }) {
  const ys = view.samples.map((s) => s.y).filter((y): y is number => y !== null);
  const lo = Math.min(...ys, 0);
  const hi = Math.max(...ys, 1);
  const [value, setValue] = useState((lo + hi) / 2);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Dial the average value of {view.expr} on [{view.a}, {view.b}].
      </p>
      <SingleSlider label="Average value" min={lo} max={hi} step={(hi - lo) / 400 || 0.01} initial={value} onChange={setValue} disabled={disabled} testId="average-value-slider" />
      <div>
        <Button size="lg" disabled={disabled} onClick={() => onSubmit({ value })} data-testid="widget-submit">
          Lock in
        </Button>
      </div>
    </div>
  );
}

function SecantDial({ view, onSubmit, disabled }: { view: SecantDialView; onSubmit: (i: SecantDialInput) => void; disabled?: boolean }) {
  const [value, setValue] = useState(0);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Dial the instantaneous rate of change of {view.quantity} at x = {view.a}.
      </p>
      <table className="text-sm" style={{ fontSize: 14 }} data-testid="secant-windows">
        <thead>
          <tr>
            <th className="pr-3 text-left">window dx</th>
          </tr>
        </thead>
        <tbody>
          {view.windows.map((w, i) => (
            <tr key={i}>
              <td className="pr-3 tabular-nums">{w}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <SingleSlider label="Instantaneous rate" min={-50} max={50} step={0.05} initial={value} onChange={setValue} disabled={disabled} testId="secant-slider" />
      <div>
        <Button size="lg" disabled={disabled} onClick={() => onSubmit({ value })} data-testid="widget-submit">
          Lock in
        </Button>
      </div>
    </div>
  );
}

function WeighDial({ view, onSubmit, disabled }: { view: WeighDialView; onSubmit: (i: WeighDialInput) => void; disabled?: boolean }) {
  const [weights, setWeights] = useState<Record<string, number>>(() => Object.fromEntries(view.causes.map((c, i) => [c.key, view.total - i])));
  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        {view.question}
      </p>
      {view.causes.map((c) => (
        <SingleSlider
          key={c.key}
          label={c.text}
          min={0}
          max={view.total}
          step={1}
          initial={weights[c.key]}
          onChange={(v) => setWeights((w) => ({ ...w, [c.key]: v }))}
          disabled={disabled}
        />
      ))}
      <div>
        <Button
          size="lg"
          disabled={disabled}
          onClick={() => onSubmit({ weights: Object.entries(weights).map(([causeKey, value]) => ({ causeKey, value })) })}
          data-testid="widget-submit"
        >
          Lock in weights
        </Button>
      </div>
    </div>
  );
}

function ReachStateDial({ view, onSubmit, disabled }: { view: ReachStateDialView; onSubmit: (i: ReachStateDialInput) => void; disabled?: boolean }) {
  const [value, setValue] = useState(view.initial[view.control.variable] ?? view.control.min);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Dial the initial {view.control.variable} so {view.target.variable} reaches {view.target.value} (±{view.target.tolerance}) by tick {view.atTick}.
      </p>
      <SingleSlider label={`Initial ${view.control.variable}`} min={view.control.min} max={view.control.max} step={view.control.step} initial={value} onChange={setValue} disabled={disabled} testId="reach-state-slider" />
      <div>
        <Button size="lg" disabled={disabled} onClick={() => onSubmit({ value })} data-testid="widget-submit">
          Lock in
        </Button>
      </div>
    </div>
  );
}

function OptimizeDial({ view, onSubmit, disabled }: { view: OptimizeDialView; onSubmit: (i: OptimizeDialInput) => void; disabled?: boolean }) {
  const [x, setX] = useState((view.xMin + view.xMax) / 2);
  const liveY = useMemo(() => {
    let best: number | null = null;
    let bestDist = Infinity;
    for (const s of view.samples) {
      const d = Math.abs(s.x - x);
      if (d < bestDist) {
        bestDist = d;
        best = s.y;
      }
    }
    return best;
  }, [view.samples, x]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        {view.goal === "max" ? "Maximize" : "Minimize"} {view.outputName} = {view.objective} by dialing {view.inputName}.
      </p>
      <SingleSlider label={view.inputName} min={view.xMin} max={view.xMax} step={(view.xMax - view.xMin) / 400} initial={x} onChange={setX} disabled={disabled} testId="optimize-slider" />
      <output className="tabular-nums" style={{ fontSize: 18 }} data-testid="optimize-live-output">
        {view.outputName} = {liveY === null ? "—" : liveY.toFixed(3)}
      </output>
      <div>
        <Button size="lg" disabled={disabled} onClick={() => onSubmit({ x })} data-testid="widget-submit">
          Lock in
        </Button>
      </div>
    </div>
  );
}

function CurveDial({ view, onSubmit, disabled }: { view: CurveDialView; onSubmit: (i: CurveDialInput) => void; disabled?: boolean }) {
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(view.params.map((p) => [p.name, (p.min + p.max) / 2])));
  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        {view.formula}
      </p>
      <p className="text-sm opacity-80" style={{ fontSize: 14 }}>
        Match the checkpoints: {view.checkpoints.map((c) => `(${c.x}, ${c.y})`).join(", ")}
      </p>
      {view.params.map((p) => (
        <SingleSlider
          key={p.name}
          label={p.name}
          min={p.min}
          max={p.max}
          step={p.step}
          initial={values[p.name]}
          onChange={(v) => setValues((vs) => ({ ...vs, [p.name]: v }))}
          disabled={disabled}
        />
      ))}
      <div>
        <Button
          size="lg"
          disabled={disabled}
          onClick={() => onSubmit({ values: Object.entries(values).map(([name, value]) => ({ name, value })) })}
          data-testid="widget-submit"
        >
          Lock in curve
        </Button>
      </div>
    </div>
  );
}

function IntervenceDial({ view, onSubmit, disabled }: { view: IntervenceDialView; onSubmit: (i: IntervenceDialInput) => void; disabled?: boolean }) {
  const [schedule, setSchedule] = useState<{ tick: number; value: number }[]>([{ tick: 0, value: view.initial[view.control.variable] ?? view.control.min }]);
  const [tick, setTick] = useState(0);
  const [value, setValue] = useState(view.control.min);

  const addEntry = () => {
    if (schedule.length >= view.budget) return;
    setSchedule((s) => [...s.filter((e) => e.tick !== tick), { tick, value }].sort((a, b) => a.tick - b.tick));
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Keep {view.target.variable} between {view.target.low} and {view.target.high} over {view.ticks} ticks by scheduling up to{" "}
        {view.budget} changes to {view.control.variable}.
      </p>
      <ul className="flex flex-col gap-1" aria-label="Schedule so far" data-testid="intervene-schedule">
        {schedule.map((e, i) => (
          <li key={i} style={{ fontSize: 15 }}>
            <Button variant="outline" size="sm" disabled={disabled} onClick={() => setSchedule((s) => s.filter((_, j) => j !== i))}>
              tick {e.tick}: {view.control.variable} = {e.value} &times;
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1" style={{ fontSize: 15 }}>
          Tick
          <input
            type="number"
            min={0}
            max={view.ticks - 1}
            value={tick}
            disabled={disabled}
            onChange={(e) => setTick(Number(e.target.value))}
            className="rounded-lg border-2 px-2 py-1 tabular-nums"
            style={{ width: 90 }}
          />
        </label>
        <label className="flex flex-col gap-1" style={{ fontSize: 15 }}>
          {view.control.variable}
          <input
            type="range"
            min={view.control.min}
            max={view.control.max}
            step={view.control.step}
            value={value}
            disabled={disabled}
            onChange={(e) => setValue(Number(e.target.value))}
          />
        </label>
        <output className="tabular-nums" style={{ fontSize: 16 }}>
          {value.toFixed(2)}
        </output>
        <Button variant="outline" disabled={disabled || schedule.length >= view.budget} onClick={addEntry}>
          Add change
        </Button>
      </div>
      <div>
        <Button size="lg" disabled={disabled || schedule.length === 0} onClick={() => onSubmit({ schedule })} data-testid="widget-submit">
          Lock in schedule
        </Button>
      </div>
    </div>
  );
}

function BaseDial({
  view,
  onSubmit,
  onLive,
  onDraft,
  disabled,
}: {
  view: OscillatorDialView | FormulaDialView;
  onSubmit: (i: DialInput) => void;
  onLive?: (value: number) => void;
  onDraft?: (d: WidgetDraft) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const { dial } = view;
  const [value, setValue] = useState(() => (dial.min + dial.max) / 2);
  const formula = isFormulaView(view);

  useEffect(() => {
    onLive?.(value);
    onDraft?.({ input: dialToInput(value), complete: true, focus: null });
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

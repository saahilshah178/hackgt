"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { evaluate } from "mathjs";
import { Button } from "@/components/ui/button";
import type { WidgetProps } from "./Dial";

/*
 * build: tokens/pieces placed into slots under rules. Four variants, detected from the view's shape
 * (LIBRARY §2/§4): balance.equation (two pans + operations), balance.chem_equation (coefficient boxes +
 * live atom counts), balance.ledger (flow diagram with blank flows), transformer.encode (input tokens ->
 * output slots from a palette). Each mirrors its mode's View/Input exactly (src/mechanics/families/...),
 * the way every other widget does; nothing here is imported from src/mechanics.
 */

// ---------------------------------------------------------------- balance.equation

export type BuildOp = "add" | "subtract" | "multiply" | "divide";
export interface EquationView {
  left: string;
  right: string;
  ops: readonly BuildOp[];
}
export interface EquationOpStep {
  op: BuildOp;
  value: string;
}
export interface EquationInput {
  ops: EquationOpStep[];
}

// ---------------------------------------------------------------- balance.chem_equation

export interface ChemEquationView {
  reactants: string[];
  products: string[];
}
export interface ChemEquationInput {
  coefficients: number[];
}

// ---------------------------------------------------------------- balance.ledger

export interface LedgerFlowView {
  flowKey: string;
  from: string | null;
  to: string | null;
  label: string;
  value: number | null;
}
export interface LedgerView {
  nodes: { id: string; label: string }[];
  flows: LedgerFlowView[];
}
export interface LedgerInput {
  values: { flowKey: string; value: number }[];
}

// ---------------------------------------------------------------- transformer.encode

export interface EncodeView {
  tableName: string;
  table: { from: string; to: string }[];
  input: string[];
  direction: "forward" | "reverse";
  tokenLabel: string;
  outputLabel: string;
  /** every possible output token (the palette), shuffled */
  palette: string[];
}
export interface EncodeInput {
  output: string[];
}

// ---------------------------------------------------------------- builder.circuit

export interface NetlistGate {
  id: string;
  type: string;
  inputs: string[];
}
export interface CircuitView {
  inputs: string[];
  target: { inputs: boolean[]; output: boolean }[];
  gates: string[];
  maxGates: number;
}
export interface CircuitInput {
  gates: NetlistGate[];
  output: string;
}

// ---------------------------------------------------------------- builder.electron_config

export interface ElectronConfigView {
  element: string;
  atomicNumber: number;
}
export interface ElectronConfigInput {
  config: string;
}

// ---------------------------------------------------------------- builder.genetics

export interface GeneticsView {
  trait: string;
  dominantAllele: string;
  recessiveAllele: string;
  dominantPhenotype: string;
  recessivePhenotype: string;
  parent1: string;
  parent2: string;
  ask: "square" | "ratio";
}
export interface GeneticsInput {
  cells: string[] | null;
  dominantFraction: string | null;
}

// ---------------------------------------------------------------- builder.molecule

export interface MoleculeView {
  atoms: { element: string; count: number }[];
  target: string;
}
export interface MoleculeInput {
  atoms: { id: string; element: string }[];
  bonds: { a: string; b: string; order: number }[];
}

// ---------------------------------------------------------------- builder.program

export interface ProgramView {
  grid: string[];
  commands: string[];
  maxBlocks: number;
  mustCollectGems: boolean;
}
export interface ProgramInput {
  program: string[];
}

// ---------------------------------------------------------------- builder.sentence

export interface SentenceView {
  tiles: string[];
  rules: string[];
}
export interface SentenceInput {
  order: string[];
}

// ---------------------------------------------------------------- builder.tiles

export interface TilesView {
  rows: number;
  cols: number;
  pieces: { id: string; label: string }[];
  rules: { kind: string; value: string }[];
}
export interface TilesInput {
  grid: string[];
}

export type BuildView =
  | EquationView
  | ChemEquationView
  | LedgerView
  | EncodeView
  | CircuitView
  | ElectronConfigView
  | GeneticsView
  | MoleculeView
  | ProgramView
  | SentenceView
  | TilesView;
export type BuildInput =
  | EquationInput
  | ChemEquationInput
  | LedgerInput
  | EncodeInput
  | CircuitInput
  | ElectronConfigInput
  | GeneticsInput
  | MoleculeInput
  | ProgramInput
  | SentenceInput
  | TilesInput;

export function isChemEquationView(view: BuildView): view is ChemEquationView {
  return "reactants" in view && "products" in view;
}
export function isLedgerView(view: BuildView): view is LedgerView {
  return "nodes" in view && "flows" in view;
}
export function isEncodeView(view: BuildView): view is EncodeView {
  return "palette" in view;
}
export function isCircuitView(view: BuildView): view is CircuitView {
  return "gates" in view && "maxGates" in view;
}
export function isElectronConfigView(view: BuildView): view is ElectronConfigView {
  return "atomicNumber" in view;
}
export function isGeneticsView(view: BuildView): view is GeneticsView {
  return "dominantAllele" in view;
}
export function isMoleculeView(view: BuildView): view is MoleculeView {
  return "atoms" in view && "target" in view;
}
export function isProgramView(view: BuildView): view is ProgramView {
  return "grid" in view && "mustCollectGems" in view;
}
export function isSentenceView(view: BuildView): view is SentenceView {
  return "tiles" in view && "rules" in view;
}
export function isTilesView(view: BuildView): view is TilesView {
  return "rows" in view && "cols" in view;
}

export function supports(view: unknown): boolean {
  if (typeof view !== "object" || view === null) return false;
  const v = view as BuildView;
  return (
    isEncodeView(v) ||
    isLedgerView(v) ||
    isChemEquationView(v) ||
    isCircuitView(v) ||
    isElectronConfigView(v) ||
    isGeneticsView(v) ||
    isMoleculeView(v) ||
    isProgramView(v) ||
    isSentenceView(v) ||
    isTilesView(v) ||
    ("left" in v && "right" in v && "ops" in v)
  );
}

/** Pure: the applied operations, in order -> the input balance.equation's grade() expects. */
export function equationOpsToInput(ops: EquationOpStep[]): EquationInput {
  return { ops };
}
/** Pure: the coefficient boxes, reactants then products -> the input balance.chem_equation's grade() expects. */
export function chemCoefficientsToInput(coefficients: number[]): ChemEquationInput {
  return { coefficients };
}
/** Pure: the filled-in blank flows -> the input balance.ledger's grade() expects. */
export function ledgerValuesToInput(values: { flowKey: string; value: number }[]): LedgerInput {
  return { values };
}
/** Pure: the built output tokens, in order -> the input transformer.encode's grade() expects. */
export function encodeOutputToInput(output: string[]): EncodeInput {
  return { output };
}

// ---------------------------------------------------------------- chemical formula parsing (live table)
// Mirrors balance/chem_equation.ts's parseFormula, duplicated here for the live atom-count display, the
// same way every other widget mirrors its mode's shapes rather than importing from src/mechanics.

export function parseFormula(f: string): Record<string, number> | null {
  let i = 0;
  function parseNumber(): number | null {
    let s = "";
    while (i < f.length && /[0-9]/.test(f[i])) {
      s += f[i];
      i++;
    }
    return s === "" ? null : parseInt(s, 10);
  }
  function parseGroup(): Record<string, number> | null {
    const counts: Record<string, number> = {};
    while (i < f.length && f[i] !== ")") {
      if (f[i] === "(") {
        i++;
        const inner = parseGroup();
        if (inner === null) return null;
        if (f[i] !== ")") return null;
        i++;
        const mult = parseNumber() ?? 1;
        for (const [el, c] of Object.entries(inner)) counts[el] = (counts[el] ?? 0) + c * mult;
      } else if (/[A-Z]/.test(f[i])) {
        let el = f[i];
        i++;
        while (i < f.length && /[a-z]/.test(f[i])) {
          el += f[i];
          i++;
        }
        const c = parseNumber() ?? 1;
        counts[el] = (counts[el] ?? 0) + c;
      } else {
        return null;
      }
    }
    return counts;
  }
  if (f.trim().length === 0) return null;
  const result = parseGroup();
  if (result === null || i !== f.length) return null;
  return result;
}

/** Pure: every species' parsed formula and the coefficients so far -> per-side element totals. */
export function atomCounts(
  formulas: string[],
  coefficients: number[],
): { elements: string[]; perFormula: Record<string, number>[] } {
  const parsed = formulas.map((f) => parseFormula(f));
  const elements = Array.from(new Set(parsed.flatMap((m) => (m ? Object.keys(m) : []))));
  const perFormula = parsed.map((m, i) => {
    const out: Record<string, number> = {};
    for (const el of elements) out[el] = (m?.[el] ?? 0) * (coefficients[i] ?? 0);
    return out;
  });
  return { elements, perFormula };
}

// ---------------------------------------------------------------- equation linear tracking (live pans)

interface Coeffs {
  a: number; // coefficient of x
  b: number; // constant term
}

function evalLinear(expr: string, x: number): number | null {
  try {
    const v = evaluate(expr, { x, pi: Math.PI, π: Math.PI }) as unknown;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** Reads expr as a*x + b by sampling at x = 0, 1; null when it doesn't evaluate. Display-only, so no
 * drift check (grading itself lives in the mode). */
export function exprCoeffs(expr: string): Coeffs | null {
  const f0 = evalLinear(expr, 0);
  const f1 = evalLinear(expr, 1);
  if (f0 === null || f1 === null) return null;
  return { a: f1 - f0, b: f0 };
}

function trim(x: number): string {
  if (!Number.isFinite(x)) return String(x);
  const r = Math.round(x * 1000) / 1000;
  return String(r);
}

export function describeCoeffs(c: Coeffs): string {
  const TOL = 1e-6;
  if (Math.abs(c.a) < TOL) return trim(c.b);
  const aStr = Math.abs(c.a - 1) < TOL ? "x" : Math.abs(c.a + 1) < TOL ? "-x" : `${trim(c.a)}x`;
  if (Math.abs(c.b) < TOL) return aStr;
  return `${aStr} ${c.b >= 0 ? "+" : "-"} ${trim(Math.abs(c.b))}`;
}

/** Applies one op to a linear state for the live-pan display; null when the op can't be applied
 * (multiply/divide by an expression containing x, or divide by zero). */
export function applyOpToCoeffs(state: Coeffs, op: BuildOp, value: Coeffs): Coeffs | null {
  if ((op === "multiply" || op === "divide") && Math.abs(value.a) > 1e-9) return null;
  switch (op) {
    case "add":
      return { a: state.a + value.a, b: state.b + value.b };
    case "subtract":
      return { a: state.a - value.a, b: state.b - value.b };
    case "multiply":
      return { a: state.a * value.b, b: state.b * value.b };
    case "divide":
      if (Math.abs(value.b) < 1e-12) return null;
      return { a: state.a / value.b, b: state.b / value.b };
  }
}

const OP_SYMBOL: Record<BuildOp, string> = { add: "+", subtract: "−", multiply: "×", divide: "÷" };

// ---------------------------------------------------------------- top-level dispatch

/**
 * build: tokens/pieces under rules. Variant read from the view's shape: balance.equation (default),
 * balance.chem_equation (`reactants`/`products`), balance.ledger (`nodes`/`flows`), transformer.encode
 * (`palette`).
 */
export function Build({ view, onSubmit, disabled }: WidgetProps<BuildView, BuildInput>) {
  if (isEncodeView(view)) return <EncodeBuild view={view} onSubmit={onSubmit as (i: EncodeInput) => void} disabled={disabled} />;
  if (isLedgerView(view)) return <LedgerBuild view={view} onSubmit={onSubmit as (i: LedgerInput) => void} disabled={disabled} />;
  if (isChemEquationView(view)) return <ChemBuild view={view} onSubmit={onSubmit as (i: ChemEquationInput) => void} disabled={disabled} />;
  if (isCircuitView(view)) return <CircuitBuild view={view} onSubmit={onSubmit as (i: CircuitInput) => void} disabled={disabled} />;
  if (isElectronConfigView(view)) return <ElectronConfigBuild view={view} onSubmit={onSubmit as (i: ElectronConfigInput) => void} disabled={disabled} />;
  if (isGeneticsView(view)) return <GeneticsBuild view={view} onSubmit={onSubmit as (i: GeneticsInput) => void} disabled={disabled} />;
  if (isMoleculeView(view)) return <MoleculeBuild view={view} onSubmit={onSubmit as (i: MoleculeInput) => void} disabled={disabled} />;
  if (isProgramView(view)) return <ProgramBuild view={view} onSubmit={onSubmit as (i: ProgramInput) => void} disabled={disabled} />;
  if (isSentenceView(view)) return <SentenceBuild view={view} onSubmit={onSubmit as (i: SentenceInput) => void} disabled={disabled} />;
  if (isTilesView(view)) return <TilesBuild view={view} onSubmit={onSubmit as (i: TilesInput) => void} disabled={disabled} />;
  return <EquationBuild view={view as EquationView} onSubmit={onSubmit as (i: EquationInput) => void} disabled={disabled} />;
}

/** builder.circuit: add logic gates one at a time (type + input wires, from the primary inputs or an
 * earlier gate's id), then pick which wire is the circuit's output. */
function CircuitBuild({ view, onSubmit, disabled }: { view: CircuitView; onSubmit: (i: CircuitInput) => void; disabled?: boolean }) {
  const [gates, setGates] = useState<NetlistGate[]>([]);
  const [type, setType] = useState(view.gates[0] ?? "AND");
  const [inA, setInA] = useState(view.inputs[0] ?? "");
  const [inB, setInB] = useState(view.inputs[1] ?? view.inputs[0] ?? "");
  const [output, setOutput] = useState("");
  const wires = [...view.inputs, ...gates.map((g) => g.id)];
  const isUnary = type === "NOT";

  const addGate = () => {
    if (gates.length >= view.maxGates) return;
    const id = `g${gates.length}`;
    setGates((gs) => [...gs, { id, type, inputs: isUnary ? [inA] : [inA, inB] }]);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Wire up to {view.maxGates} gates from inputs {view.inputs.join(", ")} to match the truth table, then pick the output wire.
      </p>
      <table className="text-sm" style={{ fontSize: 14 }} data-testid="circuit-truth-table">
        <thead>
          <tr>
            {view.inputs.map((i) => (
              <th key={i} className="pr-3">
                {i}
              </th>
            ))}
            <th>out</th>
          </tr>
        </thead>
        <tbody>
          {view.target.map((row, i) => (
            <tr key={i}>
              {row.inputs.map((b, j) => (
                <td key={j} className="pr-3 tabular-nums">
                  {b ? 1 : 0}
                </td>
              ))}
              <td className="tabular-nums">{row.output ? 1 : 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="flex flex-col gap-1" aria-label="Gates so far" data-testid="circuit-gates">
        {gates.map((g, i) => (
          <li key={g.id} style={{ fontSize: 15 }}>
            <Button variant="outline" size="sm" disabled={disabled} onClick={() => setGates((gs) => gs.filter((_, j) => j !== i))}>
              {g.id} = {g.type}({g.inputs.join(", ")}) &times;
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1" style={{ fontSize: 15 }}>
          Gate
          <select value={type} disabled={disabled} onChange={(e) => setType(e.target.value)} className="rounded-lg border-2 px-2 py-1">
            {view.gates.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1" style={{ fontSize: 15 }}>
          Input A
          <select value={inA} disabled={disabled} onChange={(e) => setInA(e.target.value)} className="rounded-lg border-2 px-2 py-1">
            {wires.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
        {!isUnary && (
          <label className="flex flex-col gap-1" style={{ fontSize: 15 }}>
            Input B
            <select value={inB} disabled={disabled} onChange={(e) => setInB(e.target.value)} className="rounded-lg border-2 px-2 py-1">
              {wires.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>
        )}
        <Button variant="outline" disabled={disabled || gates.length >= view.maxGates} onClick={addGate}>
          Add gate
        </Button>
      </div>
      <label className="flex flex-col gap-1" style={{ fontSize: 15 }}>
        Output wire
        <select value={output} disabled={disabled} onChange={(e) => setOutput(e.target.value)} className="rounded-lg border-2 px-2 py-1">
          <option value="">choose…</option>
          {wires.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </label>
      <div>
        <Button size="lg" disabled={disabled || !output} onClick={() => onSubmit({ gates, output })} data-testid="widget-submit">
          Lock in circuit
        </Button>
      </div>
    </div>
  );
}

/** builder.electron_config: type the full electron configuration, e.g. "1s2 2s2 2p6". */
function ElectronConfigBuild({ view, onSubmit, disabled }: { view: ElectronConfigView; onSubmit: (i: ElectronConfigInput) => void; disabled?: boolean }) {
  const [config, setConfig] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Write the electron configuration for {view.element} (atomic number {view.atomicNumber}).
      </p>
      <input
        type="text"
        value={config}
        disabled={disabled}
        onChange={(e) => setConfig(e.target.value)}
        placeholder="1s2 2s2 2p6 ..."
        className="rounded-lg border-2 px-3 py-2 font-mono text-lg"
        style={{ fontSize: 18 }}
        data-testid="electron-config-input"
      />
      <div>
        <Button size="lg" disabled={disabled || config.trim() === ""} onClick={() => onSubmit({ config })} data-testid="widget-submit">
          Lock in configuration
        </Button>
      </div>
    </div>
  );
}

/** builder.genetics: a 4-box Punnett square (ask="square") or a typed dominant-phenotype fraction
 * (ask="ratio"). */
function GeneticsBuild({ view, onSubmit, disabled }: { view: GeneticsView; onSubmit: (i: GeneticsInput) => void; disabled?: boolean }) {
  const rowGametes = view.parent1.split("");
  const colGametes = view.parent2.split("");
  const [cells, setCells] = useState<string[]>(["", "", "", ""]);
  const [fraction, setFraction] = useState("");
  const ready = view.ask === "square" ? cells.every((c) => c.trim() !== "") : fraction.trim() !== "";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Cross {view.parent1} × {view.parent2} for {view.trait} ({view.dominantAllele} = {view.dominantPhenotype}, {view.recessiveAllele} = {view.recessivePhenotype}).
      </p>
      {view.ask === "square" ? (
        <table className="border-collapse text-center" data-testid="punnett-square">
          <thead>
            <tr>
              <th />
              {colGametes.map((g, j) => (
                <th key={j} className="border p-2" style={{ fontSize: 18 }}>
                  {g}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowGametes.map((g, i) => (
              <tr key={i}>
                <th className="border p-2" style={{ fontSize: 18 }}>
                  {g}
                </th>
                {colGametes.map((_, j) => {
                  const idx = i * 2 + j;
                  return (
                    <td key={j} className="border p-1">
                      <input
                        aria-label={`Cell row ${i + 1} col ${j + 1}`}
                        value={cells[idx]}
                        disabled={disabled}
                        onChange={(e) => setCells((c) => c.map((v, k) => (k === idx ? e.target.value : v)))}
                        className="w-16 rounded border px-1 py-1 text-center"
                        style={{ fontSize: 16 }}
                        maxLength={2}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <label className="flex flex-col gap-1">
          <span style={{ fontSize: 16 }}>Fraction with {view.dominantPhenotype} (e.g. "3/4")</span>
          <input
            value={fraction}
            disabled={disabled}
            onChange={(e) => setFraction(e.target.value)}
            className="rounded-lg border-2 px-3 py-2 text-lg"
            style={{ fontSize: 18, width: 160 }}
            data-testid="genetics-fraction-input"
          />
        </label>
      )}
      <div>
        <Button
          size="lg"
          disabled={disabled || !ready}
          onClick={() => onSubmit({ cells: view.ask === "square" ? cells : null, dominantFraction: view.ask === "ratio" ? fraction : null })}
          data-testid="widget-submit"
        >
          Lock in answer
        </Button>
      </div>
    </div>
  );
}

/** builder.molecule: add atoms (choose an element, get an auto id) then bonds between two atom ids. The
 * target composition is shown as a build guide. */
function MoleculeBuild({ view, onSubmit, disabled }: { view: MoleculeView; onSubmit: (i: MoleculeInput) => void; disabled?: boolean }) {
  const [atoms, setAtoms] = useState<{ id: string; element: string }[]>([]);
  const [bonds, setBonds] = useState<{ a: string; b: string; order: number }[]>([]);
  const [element, setElement] = useState(view.atoms[0]?.element ?? "");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [order, setOrder] = useState(1);

  const addAtom = () => {
    if (!element) return;
    setAtoms((as) => [...as, { id: `a${as.length}`, element }]);
  };
  const addBond = () => {
    if (!a || !b || a === b) return;
    setBonds((bs) => [...bs, { a, b, order }]);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Build {view.target}. Target composition: {view.atoms.map((a2) => `${a2.element}×${a2.count}`).join(", ")}.
      </p>
      <ul className="flex flex-wrap gap-2" aria-label="Atoms so far" data-testid="molecule-atoms">
        {atoms.map((atom, i) => (
          <li key={atom.id}>
            <Button variant="outline" size="sm" disabled={disabled} onClick={() => setAtoms((as) => as.filter((_, j) => j !== i))}>
              {atom.id}:{atom.element} &times;
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1" style={{ fontSize: 15 }}>
          Element
          <select value={element} disabled={disabled} onChange={(e) => setElement(e.target.value)} className="rounded-lg border-2 px-2 py-1">
            {view.atoms.map((a2) => (
              <option key={a2.element} value={a2.element}>
                {a2.element}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" disabled={disabled} onClick={addAtom}>
          Add atom
        </Button>
      </div>
      <ul className="flex flex-wrap gap-2" aria-label="Bonds so far" data-testid="molecule-bonds">
        {bonds.map((bond, i) => (
          <li key={i}>
            <Button variant="outline" size="sm" disabled={disabled} onClick={() => setBonds((bs) => bs.filter((_, j) => j !== i))}>
              {bond.a}-{bond.b} (×{bond.order}) &times;
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1" style={{ fontSize: 15 }}>
          Atom A
          <select value={a} disabled={disabled} onChange={(e) => setA(e.target.value)} className="rounded-lg border-2 px-2 py-1">
            <option value="">choose…</option>
            {atoms.map((atom) => (
              <option key={atom.id} value={atom.id}>
                {atom.id}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1" style={{ fontSize: 15 }}>
          Atom B
          <select value={b} disabled={disabled} onChange={(e) => setB(e.target.value)} className="rounded-lg border-2 px-2 py-1">
            <option value="">choose…</option>
            {atoms.map((atom) => (
              <option key={atom.id} value={atom.id}>
                {atom.id}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1" style={{ fontSize: 15 }}>
          Bond order
          <input
            type="number"
            min={1}
            max={3}
            value={order}
            disabled={disabled}
            onChange={(e) => setOrder(Number(e.target.value))}
            className="w-16 rounded-lg border-2 px-2 py-1 tabular-nums"
          />
        </label>
        <Button variant="outline" disabled={disabled} onClick={addBond}>
          Add bond
        </Button>
      </div>
      <div>
        <Button size="lg" disabled={disabled || atoms.length === 0} onClick={() => onSubmit({ atoms, bonds })} data-testid="widget-submit">
          Lock in molecule
        </Button>
      </div>
    </div>
  );
}

/** builder.program: a text area for the mini block language, with a palette that inserts a command line
 * at the cursor. */
function ProgramBuild({ view, onSubmit, disabled }: { view: ProgramView; onSubmit: (i: ProgramInput) => void; disabled?: boolean }) {
  const [text, setText] = useState("");
  const lines = text.split("\n").filter((l) => l.trim() !== "");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Program the robot to reach the goal{view.mustCollectGems ? ", collecting every gem first" : ""}, in at most {view.maxBlocks} blocks.
      </p>
      <pre className="overflow-x-auto rounded-lg border-2 p-3 font-mono" style={{ fontSize: 15 }} data-testid="program-grid">
        {view.grid.join("\n")}
      </pre>
      <div className="flex flex-wrap gap-2" aria-label="Command palette">
        {view.commands.map((c) => (
          <Button key={c} variant="outline" disabled={disabled} onClick={() => setText((t) => (t.trim() ? `${t}\n${c}` : c))}>
            {c}
          </Button>
        ))}
      </div>
      <textarea
        aria-label="Program"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        className="rounded-lg border-2 p-3 font-mono"
        style={{ fontSize: 16 }}
        data-testid="program-textarea"
      />
      <p className="text-sm opacity-70" style={{ fontSize: 14 }}>
        {lines.length}/{view.maxBlocks} lines
      </p>
      <div>
        <Button size="lg" disabled={disabled || lines.length === 0} onClick={() => onSubmit({ program: lines })} data-testid="widget-submit">
          Lock in program
        </Button>
      </div>
    </div>
  );
}

/** builder.sentence: click word tiles in order to build the sentence. */
function SentenceBuild({ view, onSubmit, disabled }: { view: SentenceView; onSubmit: (i: SentenceInput) => void; disabled?: boolean }) {
  const [order, setOrder] = useState<number[]>([]);
  const used = new Set(order);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Arrange the tiles into a correct sentence.
      </p>
      {view.rules.length > 0 && (
        <ul className="text-sm opacity-80" style={{ fontSize: 14 }}>
          {view.rules.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
      <div className="flex min-h-14 flex-wrap gap-2 rounded-lg border-2 border-dashed p-2" data-testid="sentence-built">
        {order.map((i, pos) => (
          <Button key={pos} variant="outline" disabled={disabled} onClick={() => setOrder((o) => o.filter((_, j) => j !== pos))}>
            {view.tiles[i]}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" role="listbox" aria-label="Available tiles">
        {view.tiles.map((t, i) =>
          used.has(i) ? null : (
            <button
              key={i}
              role="option"
              disabled={disabled}
              onClick={() => setOrder((o) => [...o, i])}
              className="rounded-lg border-2 px-3 py-2"
              style={{ fontSize: 16 }}
            >
              {t}
            </button>
          ),
        )}
      </div>
      <div>
        <Button
          size="lg"
          disabled={disabled || order.length !== view.tiles.length}
          onClick={() => onSubmit({ order: order.map((i) => view.tiles[i]) })}
          data-testid="widget-submit"
        >
          Lock in sentence
        </Button>
      </div>
    </div>
  );
}

/** builder.tiles: a grid where each cell cycles through the piece palette (including empty, "."). */
function TilesBuild({ view, onSubmit, disabled }: { view: TilesView; onSubmit: (i: TilesInput) => void; disabled?: boolean }) {
  const pieceIds = [".", ...view.pieces.map((p) => p.id)];
  const [grid, setGrid] = useState<string[][]>(() => Array.from({ length: view.rows }, () => Array.from({ length: view.cols }, () => ".")));

  const cycle = (r: number, c: number) => {
    setGrid((g) => {
      const next = g.map((row) => [...row]);
      const idx = pieceIds.indexOf(next[r][c]);
      next[r][c] = pieceIds[(idx + 1) % pieceIds.length];
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Click a cell to cycle through pieces: {pieceIds.join(", ")}.
      </p>
      {view.rules.length > 0 && (
        <ul className="text-sm opacity-80" style={{ fontSize: 14 }}>
          {view.rules.map((r, i) => (
            <li key={i}>
              {r.kind}: {r.value}
            </li>
          ))}
        </ul>
      )}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${view.cols}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="Tile grid"
        data-testid="tiles-grid"
      >
        {grid.map((row, r) =>
          row.map((cell, c) => (
            <button
              key={`${r}-${c}`}
              role="gridcell"
              disabled={disabled}
              onClick={() => cycle(r, c)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  cycle(r, c);
                }
              }}
              className="flex h-12 w-12 items-center justify-center rounded border-2"
              style={{ fontSize: 16 }}
            >
              {cell === "." ? "" : cell}
            </button>
          )),
        )}
      </div>
      <div>
        <Button size="lg" disabled={disabled} onClick={() => onSubmit({ grid: grid.map((row) => row.join(" ")) })} data-testid="widget-submit">
          Lock in grid
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- balance.equation UI

function EquationBuild({ view, onSubmit, disabled }: { view: EquationView; onSubmit: (i: EquationInput) => void; disabled?: boolean }) {
  const [ops, setOps] = useState<EquationOpStep[]>([]);
  const [op, setOp] = useState<BuildOp>(view.ops[0] ?? "add");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const initialLeft = useMemo(() => exprCoeffs(view.left) ?? { a: 0, b: 0 }, [view.left]);
  const initialRight = useMemo(() => exprCoeffs(view.right) ?? { a: 0, b: 0 }, [view.right]);

  const { left: currentLeft, right: currentRight } = useMemo(() => {
    let l = initialLeft;
    let r = initialRight;
    for (const step of ops) {
      const v = exprCoeffs(step.value);
      if (v === null) continue;
      l = applyOpToCoeffs(l, step.op, v) ?? l;
      r = applyOpToCoeffs(r, step.op, v) ?? r;
    }
    return { left: l, right: r };
  }, [ops, initialLeft, initialRight]);

  const apply = () => {
    if (!value.trim()) {
      setError("Enter a value or an x-term first.");
      return;
    }
    const v = exprCoeffs(value);
    if (v === null) {
      setError(`"${value}" doesn't evaluate to a number or a simple expression in x.`);
      return;
    }
    setError(null);
    setOps((o) => [...o, { op, value }]);
    setValue("");
  };

  const undo = () => setOps((o) => o.slice(0, -1));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Apply the same operation to both pans until <strong>x</strong> stands alone.
      </p>
      <div className="grid grid-cols-2 gap-3" data-testid="equation-pans">
        <div className="flex flex-col items-center gap-1 rounded-lg border-2 p-4" data-testid="equation-pan-left">
          <span className="text-sm opacity-70" style={{ fontSize: 14 }}>
            Left pan
          </span>
          <span className="text-2xl font-semibold" style={{ fontSize: 24 }}>
            {describeCoeffs(currentLeft)}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-lg border-2 p-4" data-testid="equation-pan-right">
          <span className="text-sm opacity-70" style={{ fontSize: 14 }}>
            Right pan
          </span>
          <span className="text-2xl font-semibold" style={{ fontSize: 24 }}>
            {describeCoeffs(currentRight)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Choose an operation">
        {view.ops.map((o) => (
          <Button key={o} variant={op === o ? "default" : "outline"} disabled={disabled} onClick={() => setOp(o)}>
            {OP_SYMBOL[o]} {o}
          </Button>
        ))}
        <input
          aria-label="Value or x-term"
          value={value}
          disabled={disabled}
          placeholder="e.g. 5 or 2*x"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply();
          }}
          className="rounded-lg border-2 px-3 py-2"
          style={{ fontSize: 16, width: 140 }}
        />
        <Button disabled={disabled} onClick={apply} data-testid="equation-apply">
          Apply to both pans
        </Button>
        <Button variant="outline" disabled={disabled || ops.length === 0} onClick={undo} data-testid="equation-undo">
          Undo
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm" style={{ fontSize: 14, color: "#c0392b" }}>
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-1 text-sm opacity-80" style={{ fontSize: 15 }} data-testid="equation-steps" aria-label="Steps so far">
        {ops.map((s, i) => (
          <li key={i}>
            {i + 1}. {OP_SYMBOL[s.op]} {s.value}
          </li>
        ))}
      </ul>

      <div>
        <Button size="lg" disabled={disabled} onClick={() => onSubmit(equationOpsToInput(ops))} data-testid="widget-submit">
          Check the balance
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- balance.chem_equation UI

function ChemBuild({ view, onSubmit, disabled }: { view: ChemEquationView; onSubmit: (i: ChemEquationInput) => void; disabled?: boolean }) {
  const species = useMemo(() => [...view.reactants, ...view.products], [view.reactants, view.products]);
  const [coeffs, setCoeffs] = useState<number[]>(() => species.map(() => 1));

  const setCoeff = (i: number, v: number) => {
    const clamped = Math.max(1, Math.min(12, Math.round(v)));
    setCoeffs((c) => c.map((x, j) => (j === i ? clamped : x)));
  };

  const { elements, perFormula } = useMemo(() => atomCounts(species, coeffs), [species, coeffs]);
  const nR = view.reactants.length;

  const totalFor = (el: string, side: "reactants" | "products") => {
    const range = side === "reactants" ? perFormula.slice(0, nR) : perFormula.slice(nR);
    return range.reduce((sum, m) => sum + (m[el] ?? 0), 0);
  };

  const CoeffBox = ({ i, formula }: { i: number; formula: string }) => (
    <div key={i} className="flex items-center gap-1 rounded-lg border-2 px-2 py-1" data-testid={`coeff-${i}`}>
      <input
        type="number"
        min={1}
        max={12}
        value={coeffs[i]}
        disabled={disabled}
        aria-label={`Coefficient for ${formula}`}
        onChange={(e) => setCoeff(i, Number(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setCoeff(i, coeffs[i] + 1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setCoeff(i, coeffs[i] - 1);
          }
        }}
        className="w-12 text-center"
        style={{ fontSize: 18 }}
      />
      <span style={{ fontSize: 18 }}>{formula}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Set whole-number coefficients (1-12) so every element balances.
      </p>
      <div className="flex flex-wrap items-center gap-2" data-testid="chem-reactants">
        {view.reactants.map((f, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden>+</span>}
            <CoeffBox i={i} formula={f} />
          </span>
        ))}
        <span aria-hidden style={{ fontSize: 20 }}>
          &rarr;
        </span>
        {view.products.map((f, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden>+</span>}
            <CoeffBox i={nR + i} formula={f} />
          </span>
        ))}
      </div>

      <table className="w-full border-collapse text-left" data-testid="atom-table" style={{ fontSize: 15 }}>
        <thead>
          <tr>
            <th className="border-b p-1">Element</th>
            <th className="border-b p-1">Reactants</th>
            <th className="border-b p-1">Products</th>
            <th className="border-b p-1">Balanced?</th>
          </tr>
        </thead>
        <tbody>
          {elements.map((el) => {
            const r = totalFor(el, "reactants");
            const p = totalFor(el, "products");
            return (
              <tr key={el}>
                <td className="p-1 font-semibold">{el}</td>
                <td className="p-1 tabular-nums">{r}</td>
                <td className="p-1 tabular-nums">{p}</td>
                <td className="p-1" style={{ color: r === p ? "#2e7d32" : "#c0392b" }}>
                  {r === p ? "✓" : "✗"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div>
        <Button size="lg" disabled={disabled} onClick={() => onSubmit(chemCoefficientsToInput(coeffs))} data-testid="widget-submit">
          Balance the equation
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- balance.ledger UI

function LedgerBuild({ view, onSubmit, disabled }: { view: LedgerView; onSubmit: (i: LedgerInput) => void; disabled?: boolean }) {
  const blanks = useMemo(() => view.flows.filter((f) => f.value === null), [view.flows]);
  const [values, setValues] = useState<Record<string, string>>({});
  const nodeLabel = (id: string | null) => (id === null ? "outside" : (view.nodes.find((n) => n.id === id)?.label ?? id));

  const allFilled = blanks.every((f) => values[f.flowKey]?.trim() && Number.isFinite(Number(values[f.flowKey])));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Fill in every blank flow so inflow equals outflow at each node.
      </p>
      <table className="w-full border-collapse text-left" data-testid="ledger-flows" style={{ fontSize: 16 }}>
        <thead>
          <tr>
            <th className="border-b p-1">Flow</th>
            <th className="border-b p-1">From</th>
            <th className="border-b p-1">To</th>
            <th className="border-b p-1">Value</th>
          </tr>
        </thead>
        <tbody>
          {view.flows.map((f) => (
            <tr key={f.flowKey}>
              <td className="p-1">{f.label}</td>
              <td className="p-1">{nodeLabel(f.from)}</td>
              <td className="p-1">{nodeLabel(f.to)}</td>
              <td className="p-1">
                {f.value !== null ? (
                  <span className="tabular-nums">{f.value}</span>
                ) : (
                  <input
                    type="number"
                    aria-label={`Value for ${f.label}`}
                    disabled={disabled}
                    value={values[f.flowKey] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.flowKey]: e.target.value }))}
                    data-testid={`ledger-blank-${f.flowKey}`}
                    className="w-24 rounded-md border-2 px-2 py-1 tabular-nums"
                    style={{ fontSize: 16 }}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <Button
          size="lg"
          disabled={disabled || !allFilled}
          onClick={() =>
            onSubmit(
              ledgerValuesToInput(blanks.map((f) => ({ flowKey: f.flowKey, value: Number(values[f.flowKey]) }))),
            )
          }
          data-testid="widget-submit"
        >
          Check the ledger
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- transformer.encode UI

function EncodeBuild({ view, onSubmit, disabled }: { view: EncodeView; onSubmit: (i: EncodeInput) => void; disabled?: boolean }) {
  const [slots, setSlots] = useState<(string | null)[]>(() => view.input.map(() => null));
  const [focusedSlot, setFocusedSlot] = useState(0);
  const [focusedPaletteIndex, setFocusedPaletteIndex] = useState(0);
  const paletteRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    paletteRefs.current[focusedPaletteIndex]?.focus();
  }, [focusedPaletteIndex]);

  const place = (token: string) => {
    setSlots((s) => s.map((v, i) => (i === focusedSlot ? token : v)));
    setFocusedSlot((i) => Math.min(view.input.length - 1, i + 1));
  };
  const clear = (i: number) => setSlots((s) => s.map((v, j) => (j === i ? null : v)));

  const allFilled = slots.every((s) => s !== null);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg" style={{ fontSize: 18 }}>
        Build the {view.outputLabel} sequence for each {view.tokenLabel}. Pick a slot, then a{" "}
        {view.outputLabel} from the palette below.
      </p>

      {view.table.length > 0 && (
        <table className="w-full max-w-md border-collapse text-left" data-testid="encode-table" style={{ fontSize: 14 }}>
          <caption className="text-left text-sm opacity-70" style={{ fontSize: 14 }}>
            {view.tableName}
          </caption>
          <tbody>
            {view.table.map((row, i) => (
              <tr key={i}>
                <td className="border-b p-1">{view.direction === "forward" ? row.from : row.to}</td>
                <td className="border-b p-1">&rarr;</td>
                <td className="border-b p-1">{view.direction === "forward" ? row.to : row.from}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2" aria-label={`Input ${view.tokenLabel}s`} data-testid="encode-input">
          {view.input.map((tok, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-sm opacity-70" style={{ fontSize: 13 }}>
                {tok}
              </span>
              <button
                type="button"
                role="button"
                aria-label={`Slot ${i + 1}`}
                disabled={disabled}
                onClick={() => setFocusedSlot(i)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace") {
                    e.preventDefault();
                    clear(i);
                  } else if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setFocusedSlot(i);
                  }
                }}
                data-testid={`encode-slot-${i}`}
                className="flex h-12 min-w-16 items-center justify-center rounded-lg border-2 border-dashed px-2"
                style={{
                  fontSize: 16,
                  borderColor: focusedSlot === i ? "currentColor" : "color-mix(in oklab, currentColor 30%, transparent)",
                }}
              >
                {slots[i] ?? "—"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div
        role="listbox"
        aria-label={`${view.outputLabel} palette`}
        className="flex flex-wrap gap-2"
        data-testid="encode-palette"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            setFocusedPaletteIndex((f) => Math.min(view.palette.length - 1, f + 1));
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            setFocusedPaletteIndex((f) => Math.max(0, f - 1));
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            place(view.palette[focusedPaletteIndex]);
          }
        }}
      >
        {view.palette.map((tok, i) => (
          <button
            key={tok}
            ref={(el) => {
              paletteRefs.current[i] = el;
            }}
            role="option"
            aria-selected={focusedPaletteIndex === i}
            disabled={disabled}
            onFocus={() => setFocusedPaletteIndex(i)}
            onClick={() => place(tok)}
            className="rounded-lg border-2 px-3 py-2"
            style={{
              fontSize: 16,
              borderColor: focusedPaletteIndex === i ? "currentColor" : "color-mix(in oklab, currentColor 30%, transparent)",
            }}
          >
            {tok}
          </button>
        ))}
      </div>

      <div>
        <Button
          size="lg"
          disabled={disabled || !allFilled}
          onClick={() => onSubmit(encodeOutputToInput(slots as string[]))}
          data-testid="widget-submit"
        >
          Lock in translation
        </Button>
      </div>
    </div>
  );
}

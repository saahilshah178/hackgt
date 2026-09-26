/**
 * src/world/draft-inputs.ts — control state → the mode's exact Input (docs/design/20 §2.5.1, §3.3).
 *
 * Every panel control holds a DraftInputs[modeKey] shape while the player works. On Verify the client calls
 * toSubmitInput(modeKey, draft.input) and hands the result to runner.submit(). The conversions below are PURE MIRRORS
 * of the existing widget converters (src/game/widgets/*.tsx: dialToInput, numberLineToInput, chestsToInput,
 * optionsToInput, placedToInput, assignmentsToInput, wavesToInput, pairsToInput, chainToInput, eliminationToInput),
 * so the instrument panel and the legacy widgets grade through identical inputs. They are mirrored rather than
 * imported because the widget files are React modules and src/world must stay free of React (ESLint);
 * tests/draft-inputs.test.ts pins the parity for every draft mode and round-trips every showcase solution
 * through grade().
 *
 * Modes without a native DraftInputs shape (the other implemented modes) draft through WidgetControl: the widget
 * already emits the mode's exact Input, so toSubmitInput passes it through (as a JSON copy) once it is non-null.
 */
import type { FamilyId } from "../contracts/common";
import type { Draft, DraftInputs, DraftModeKey, ModeKey } from "./types";

export const DRAFT_MODE_KEYS: readonly DraftModeKey[] = [
  "tuner.oscillator",
  "tuner.formula",
  "mapper.number_line",
  "truth_finder.mimic",
  "truth_finder.predict_reveal",
  "sequencer.linear",
  "sorter.bins",
  "sorter.type_match",
  "linker.pairs",
  "linker.chain",
  "investigator.elimination",
];
const DRAFT_MODE_SET: ReadonlySet<string> = new Set(DRAFT_MODE_KEYS);

export function isDraftMode(modeKey: string): modeKey is DraftModeKey {
  return DRAFT_MODE_SET.has(modeKey);
}

/** "tuner.oscillator" from an encounter's familyId and mode. */
export function modeKeyOf(e: { familyId: FamilyId; mode: string }): ModeKey {
  return `${e.familyId}.${e.mode}`;
}

/** Thrown by toSubmitInput when the draft cannot yet be graded (Verify must stay disabled). */
export class DraftIncompleteError extends Error {
  constructor(
    readonly modeKey: string,
    reason: string,
  ) {
    super(`${modeKey}: draft is not complete (${reason})`);
    this.name = "DraftIncompleteError";
  }
}

// ---------------------------------------------------------------- widget-converter mirrors (keep byte-equal)

/** = Dial.dialToInput */
export function dialToInput(value: number): { value: number } {
  return { value };
}
/** = Place.numberLineToInput */
export function numberLineToInput(value: number): { value: number } {
  return { value };
}
/** = Pick.chestsToInput */
export function chestsToInput(statementIndex: number): { statementIndex: number } {
  return { statementIndex };
}
/** = Pick.optionsToInput */
export function optionsToInput(optionIndex: number): { optionIndex: number } {
  return { optionIndex };
}
/** = Order.placedToInput */
export function placedToInput(placed: string[]): { keys: string[] } {
  return { keys: placed };
}
/** = Sort.assignmentsToInput (item → bin map, insertion order) */
export function assignmentsToInput(assignments: Record<string, string>): { assignments: { itemKey: string; binId: string }[] } {
  return { assignments: Object.entries(assignments).map(([itemKey, binId]) => ({ itemKey, binId })) };
}
/** = Pick.wavesToInput (a wave with no answer is simply left out) */
export function wavesToInput(answers: { waveIndex: number; categoryId: string }[]): { answers: { waveIndex: number; categoryId: string }[] } {
  return { answers };
}
/** = Link.pairsToInput (left → right map, insertion order) */
export function pairsToInput(links: Record<string, string>): { links: { leftKey: string; rightKey: string }[] } {
  return { links: Object.entries(links).map(([leftKey, rightKey]) => ({ leftKey, rightKey })) };
}
/** = Link.chainToInput (from → to map, insertion order) */
export function chainToInput(edges: Record<string, string>): { edges: { fromKey: string; toKey: string }[] } {
  return { edges: Object.entries(edges).map(([fromKey, toKey]) => ({ fromKey, toKey })) };
}
/** = Link.eliminationToInput */
export function eliminationToInput(hypothesisId: string): { hypothesisId: string } {
  return { hypothesisId };
}

// ---------------------------------------------------------------- helpers

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function asArray(v: unknown): readonly unknown[] {
  return Array.isArray(v) ? v : [];
}
/** Last write wins, first-insertion order kept (the widgets build the same Record). */
function toRecord<T>(rows: readonly T[], key: (r: T) => string, value: (r: T) => string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) out[key(r)] = value(r);
  return out;
}

// ---------------------------------------------------------------- draft → Input

/**
 * The mode's exact Input from a control's draft input. Throws DraftIncompleteError unless the draft is structurally
 * complete (a finite value, a chosen index/hypothesis, every rail slot filled). View-dependent completeness (every
 * item assigned, every left linked) is `isDraftComplete`; grade() itself answers "Place all …" for a partial board.
 */
export function toSubmitInput(modeKey: ModeKey, input: unknown): unknown {
  if (!isDraftMode(modeKey)) {
    if (input === null || input === undefined || typeof input !== "object") {
      throw new DraftIncompleteError(modeKey, "the widget has not emitted an input yet");
    }
    return JSON.parse(JSON.stringify(input)) as unknown;
  }
  if (!isObj(input)) throw new DraftIncompleteError(modeKey, "no draft input");
  switch (modeKey) {
    case "tuner.oscillator":
    case "tuner.formula": {
      const v = input.value;
      if (typeof v !== "number" || !Number.isFinite(v)) throw new DraftIncompleteError(modeKey, "value is not a finite number");
      return dialToInput(v);
    }
    case "mapper.number_line": {
      const v = input.value;
      if (typeof v !== "number" || !Number.isFinite(v)) throw new DraftIncompleteError(modeKey, "value is not a finite number");
      return numberLineToInput(v);
    }
    case "truth_finder.mimic": {
      const i = input.statementIndex;
      if (typeof i !== "number" || !Number.isInteger(i)) throw new DraftIncompleteError(modeKey, "no statement aimed");
      return chestsToInput(i);
    }
    case "truth_finder.predict_reveal": {
      const i = input.optionIndex;
      if (typeof i !== "number" || !Number.isInteger(i)) throw new DraftIncompleteError(modeKey, "no option chosen");
      return optionsToInput(i);
    }
    case "sequencer.linear": {
      const slots = asArray(input.slots);
      if (slots.length === 0 || slots.some((s) => typeof s !== "string")) throw new DraftIncompleteError(modeKey, "a slot is empty");
      return placedToInput(slots as string[]);
    }
    case "sorter.bins": {
      const rows = asArray(input.assignments).filter(isObj) as { itemKey: string; binId: string }[];
      return assignmentsToInput(toRecord(rows, (r) => String(r.itemKey), (r) => String(r.binId)));
    }
    case "sorter.type_match": {
      const rows = asArray(input.answers).filter(isObj) as { waveIndex: number; categoryId: string }[];
      return wavesToInput(rows.map((r) => ({ waveIndex: Number(r.waveIndex), categoryId: String(r.categoryId) })));
    }
    case "linker.pairs": {
      const rows = asArray(input.links).filter(isObj) as { leftKey: string; rightKey: string }[];
      return pairsToInput(toRecord(rows, (r) => String(r.leftKey), (r) => String(r.rightKey)));
    }
    case "linker.chain": {
      const rows = asArray(input.edges).filter(isObj) as { fromKey: string; toKey: string }[];
      return chainToInput(toRecord(rows, (r) => String(r.fromKey), (r) => String(r.toKey)));
    }
    case "investigator.elimination": {
      const id = input.hypothesisId;
      if (typeof id !== "string" || id.length === 0) throw new DraftIncompleteError(modeKey, "no hypothesis accused");
      return eliminationToInput(id);
    }
  }
}

/**
 * View-aware completeness for the draft modes (what enables Verify). Other modes: complete once the widget emitted
 * an input. sorter.type_match counts complete when every wave has an answer; WaveControl also marks the draft
 * complete after the last wave times out (a missing answer then grades wrong, as WavesPick does).
 */
export function isDraftComplete(modeKey: ModeKey, input: unknown, view: unknown): boolean {
  if (!isDraftMode(modeKey)) return input !== null && input !== undefined && typeof input === "object";
  try {
    toSubmitInput(modeKey, input);
  } catch {
    return false;
  }
  const v = isObj(view) ? view : {};
  const inp = input as Record<string, unknown>;
  switch (modeKey) {
    case "sequencer.linear":
      return typeof v.slots !== "number" || asArray(inp.slots).length === v.slots;
    case "sorter.bins": {
      const placed = new Set(asArray(inp.assignments).filter(isObj).map((a) => String(a.itemKey)));
      return asArray(v.items).filter(isObj).every((it) => placed.has(String(it.key)));
    }
    case "sorter.type_match": {
      const answered = new Set(asArray(inp.answers).filter(isObj).map((a) => Number(a.waveIndex)));
      return asArray(v.waves).filter(isObj).every((w) => answered.has(Number(w.waveIndex)));
    }
    case "linker.pairs": {
      const linked = new Set(asArray(inp.links).filter(isObj).map((l) => String(l.leftKey)));
      return asArray(v.lefts).filter(isObj).every((l) => linked.has(String(l.key)));
    }
    case "linker.chain":
      return typeof v.edgeCount !== "number" || asArray(inp.edges).length >= v.edgeCount;
    default:
      return true;
  }
}

// ---------------------------------------------------------------- Input → draft (solution drafts, cached restore)

/**
 * The inverse of toSubmitInput for the draft modes: a mode Input (e.g. mode.solutionInput(params, solution)) → the
 * control's DraftInputs shape. Used by the client to build the solution draft for successPlan and by controls to
 * restore cached drafts. `view` pads sequencer slots to the view's slot count. Other modes return the input as is.
 */
export function fromSubmitInput(modeKey: ModeKey, input: unknown, view?: unknown): unknown {
  if (!isDraftMode(modeKey) || !isObj(input)) return input;
  const v = isObj(view) ? view : {};
  switch (modeKey) {
    case "tuner.oscillator":
    case "tuner.formula":
    case "mapper.number_line":
      return { value: Number(input.value) } satisfies DraftInputs["tuner.oscillator"];
    case "truth_finder.mimic":
      return { statementIndex: typeof input.statementIndex === "number" ? input.statementIndex : null } satisfies DraftInputs["truth_finder.mimic"];
    case "truth_finder.predict_reveal":
      return { optionIndex: typeof input.optionIndex === "number" ? input.optionIndex : null } satisfies DraftInputs["truth_finder.predict_reveal"];
    case "sequencer.linear": {
      const keys = asArray(input.keys).map((k) => (typeof k === "string" ? k : null));
      const n = typeof v.slots === "number" ? Math.max(v.slots, keys.length) : keys.length;
      return { slots: Array.from({ length: n }, (_, i) => keys[i] ?? null) } satisfies DraftInputs["sequencer.linear"];
    }
    case "sorter.bins":
      return {
        assignments: asArray(input.assignments).filter(isObj).map((a) => ({ itemKey: String(a.itemKey), binId: String(a.binId) })),
      } satisfies DraftInputs["sorter.bins"];
    case "sorter.type_match":
      return {
        answers: asArray(input.answers).filter(isObj).map((a) => ({ waveIndex: Number(a.waveIndex), categoryId: String(a.categoryId) })),
      } satisfies DraftInputs["sorter.type_match"];
    case "linker.pairs":
      return {
        links: asArray(input.links).filter(isObj).map((l) => ({ leftKey: String(l.leftKey), rightKey: String(l.rightKey) })),
      } satisfies DraftInputs["linker.pairs"];
    case "linker.chain":
      return {
        edges: asArray(input.edges).filter(isObj).map((e) => ({ fromKey: String(e.fromKey), toKey: String(e.toKey) })),
      } satisfies DraftInputs["linker.chain"];
    case "investigator.elimination":
      return { hypothesisId: typeof input.hypothesisId === "string" ? input.hypothesisId : null } satisfies DraftInputs["investigator.elimination"];
  }
}

/** The untouched control state for a draft mode (scalar modes start at the dial/line minimum from the view). */
export function emptyDraftInput(modeKey: ModeKey, view: unknown): unknown {
  const v = isObj(view) ? view : {};
  switch (modeKey) {
    case "tuner.oscillator":
    case "tuner.formula": {
      const dial = isObj(v.dial) ? v.dial : {};
      return { value: typeof dial.min === "number" ? dial.min : 0 };
    }
    case "mapper.number_line":
      return { value: typeof v.min === "number" ? v.min : 0 };
    case "truth_finder.mimic":
      return { statementIndex: null };
    case "truth_finder.predict_reveal":
      return { optionIndex: null };
    case "sequencer.linear":
      return { slots: Array.from({ length: typeof v.slots === "number" ? v.slots : 0 }, () => null) };
    case "sorter.bins":
      return { assignments: [] };
    case "sorter.type_match":
      return { answers: [] };
    case "linker.pairs":
      return { links: [] };
    case "linker.chain":
      return { edges: [] };
    case "investigator.elimination":
      return { hypothesisId: null };
    default:
      return null;
  }
}

/** A Draft with every UI channel at rest; controls and tests spread their changes over it. */
export function makeDraft<D>(encounterId: string, modeKey: ModeKey, input: D, patch: Partial<Omit<Draft<D>, "encounterId" | "modeKey" | "input">> = {}): Draft<D> {
  return {
    encounterId,
    modeKey,
    input,
    complete: false,
    focus: null,
    hover: null,
    probe: null,
    settled: true,
    wave: null,
    marks: null,
    seq: 0,
    ...patch,
  };
}

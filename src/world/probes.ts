/**
 * src/world/probes.ts (V1) — misconception probes (docs/design/20 §2.5.4, amendment 11, A9).
 *
 * Evaluated only on failed Verifies, against the submitted Input. Every predicate × mode pair a showcase station
 * uses is defined here; R5 (validate-world.ts) checks the probe keys against the view with `probeRefIssues`.
 * Pure: reads the view, the input and (for number_line's tolerance and "any decoy") the solution.
 */
import type { MisconceptionProbe } from "../contracts/world";
import { evalExact } from "../mechanics/util";
import { dialSpan, OSCILLATOR_TOLERANCE } from "./diagnose/oscillator";
import { arr, field, num, str } from "./diagnose/shared";

export interface ProbeCtx {
  modeKey: string;
  view: unknown;
  solution: unknown;
  input: unknown;
}

/** The predicates each mode supports (R5 rejects a probe whose predicate the mode does not define). */
export const PROBE_PREDICATES_BY_MODE: Readonly<Record<string, readonly MisconceptionProbe["predicate"][]>> = {
  "mapper.number_line": ["nearValue"],
  "tuner.oscillator": ["nearValue"],
  "tuner.formula": ["nearValue"],
  "truth_finder.mimic": ["aimedIndex"],
  "truth_finder.predict_reveal": ["aimedIndex"],
  "sequencer.linear": ["keyInSlot", "decoyPresent"],
  "linker.chain": ["decoyPresent", "linkedTo"],
  "linker.pairs": ["decoyPresent", "linkedTo"],
  "sorter.bins": ["assignedTo"],
  "sorter.type_match": ["assignedTo"],
};
export function predicatesFor(modeKey: string): readonly MisconceptionProbe["predicate"][] {
  return PROBE_PREDICATES_BY_MODE[modeKey] ?? [];
}

/** The scalar mode's own tolerance in input units (× 1): number_line tolerance × (max − min); tuners 3 % of the dial. */
export function scalarTolerance(modeKey: string, view: unknown, solution: unknown): number {
  if (modeKey === "mapper.number_line") {
    const min = num(view, "min") ?? 0;
    const max = num(view, "max") ?? 0;
    return (num(solution, "tolerance") ?? 0) * (max - min);
  }
  if (modeKey.startsWith("tuner.")) return OSCILLATOR_TOLERANCE * dialSpan(view);
  return 0;
}

/** Keys the solution uses (any key outside them is a decoy): linear order, chain edge ends, pairs rights. */
export function solutionKeys(modeKey: string, solution: unknown): Set<string> {
  switch (modeKey) {
    case "sequencer.linear":
      return new Set(arr(solution, "order").map(String));
    case "linker.chain":
      return new Set(arr(solution, "edges").flatMap((e) => [String(field(e, "from")), String(field(e, "to"))]));
    case "linker.pairs": {
      const links = field(solution, "links");
      return new Set(links && typeof links === "object" ? Object.values(links as Record<string, unknown>).map(String) : []);
    }
    default:
      return new Set();
  }
}

/** Every item key the submission uses, per mode (decoyPresent). */
function usedKeys(modeKey: string, input: unknown): string[] {
  switch (modeKey) {
    case "sequencer.linear":
      return arr(input, "keys").map(String);
    case "linker.chain":
      return arr(input, "edges").flatMap((e) => [String(field(e, "fromKey")), String(field(e, "toKey"))]);
    case "linker.pairs":
      return arr(input, "links").map((l) => String(field(l, "rightKey")));
    default:
      return [];
  }
}

/** True when the probe's predicate holds for the submitted input. Unknown predicate × mode pairs never match. */
export function probeMatches(probe: MisconceptionProbe, ctx: ProbeCtx): boolean {
  if (!predicatesFor(ctx.modeKey).includes(probe.predicate)) return false;
  const { modeKey, input } = ctx;
  switch (probe.predicate) {
    case "nearValue": {
      const v = num(input, "value");
      const target = evalExact(probe.value);
      if (v === null || target === null) return false;
      return Math.abs(v - target) <= scalarTolerance(modeKey, ctx.view, ctx.solution) * probe.tolFactor;
    }
    case "aimedIndex":
      return num(input, modeKey === "truth_finder.mimic" ? "statementIndex" : "optionIndex") === probe.index;
    case "keyInSlot": {
      const keys = arr(input, "keys").map(String);
      return probe.slot === null ? keys.includes(probe.itemKey) : keys[probe.slot] === probe.itemKey;
    }
    case "decoyPresent": {
      const used = usedKeys(modeKey, input);
      if (probe.itemKey !== null) return used.includes(probe.itemKey);
      const sol = solutionKeys(modeKey, ctx.solution);
      return used.some((k) => !sol.has(k));
    }
    case "linkedTo":
      if (modeKey === "linker.pairs") return arr(input, "links").some((l) => field(l, "leftKey") === probe.fromKey && field(l, "rightKey") === probe.toKey);
      return arr(input, "edges").some((e) => field(e, "fromKey") === probe.fromKey && field(e, "toKey") === probe.toKey);
    case "assignedTo": {
      if (modeKey === "sorter.bins") return arr(input, "assignments").some((a) => field(a, "itemKey") === probe.itemKey && field(a, "binId") === probe.binId);
      const w = /^w(\d+)$/.exec(probe.itemKey);
      if (!w) return false;
      const i = Number(w[1]);
      return arr(input, "answers").some((a) => field(a, "waveIndex") === i && str(a, "categoryId") === probe.binId);
    }
  }
}

/** Keys of the probes matched by the submitted input, in station order (fail lines use the first). */
export function matchProbes(probes: readonly MisconceptionProbe[], ctx: ProbeCtx): string[] {
  return probes.filter((p) => probeMatches(p, ctx)).map((p) => p.key);
}

// ---------------------------------------------------------------- R5: probe references resolve against the view (A9)

function rows(view: unknown, k: string): unknown[] {
  return arr(view, k);
}
/** Problems with a probe's references for this mode and view (sentences; [] = fine). */
export function probeRefIssues(probe: MisconceptionProbe, modeKey: string, view: unknown): string[] {
  const out: string[] = [];
  if (!predicatesFor(modeKey).includes(probe.predicate)) return [`predicate ${probe.predicate} is not defined for ${modeKey}`];
  const keysOf = (k: string, f = "key") => rows(view, k).map((r) => String(field(r, f)));
  switch (probe.predicate) {
    case "nearValue":
      if (evalExact(probe.value) === null) out.push(`nearValue "${probe.value}" does not evaluate`);
      break;
    case "aimedIndex": {
      const n = modeKey === "truth_finder.mimic" ? rows(view, "chests").length : rows(view, "options").length;
      if (probe.index >= n) out.push(`aimedIndex ${probe.index} ≥ the ${n} ${modeKey === "truth_finder.mimic" ? "statements" : "options"}`);
      break;
    }
    case "keyInSlot": {
      if (!keysOf("planks").includes(probe.itemKey)) out.push(`keyInSlot item "${probe.itemKey}" is not a plank of the view`);
      const slots = num(view, "slots") ?? 0;
      if (probe.slot !== null && probe.slot >= slots) out.push(`keyInSlot slot ${probe.slot} ≥ the ${slots} slots`);
      break;
    }
    case "decoyPresent": {
      if (probe.itemKey === null) break;
      const keys = modeKey === "sequencer.linear" ? keysOf("planks") : modeKey === "linker.chain" ? keysOf("nodes") : keysOf("rights");
      if (!keys.includes(probe.itemKey)) out.push(`decoyPresent item "${probe.itemKey}" is not an item of the view`);
      break;
    }
    case "linkedTo": {
      const [from, to] = modeKey === "linker.pairs" ? [keysOf("lefts"), keysOf("rights")] : [keysOf("nodes"), keysOf("nodes")];
      if (!from.includes(probe.fromKey)) out.push(`linkedTo fromKey "${probe.fromKey}" is not in the view`);
      if (!to.includes(probe.toKey)) out.push(`linkedTo toKey "${probe.toKey}" is not in the view`);
      break;
    }
    case "assignedTo": {
      if (modeKey === "sorter.bins") {
        if (!keysOf("items").includes(probe.itemKey)) out.push(`assignedTo item "${probe.itemKey}" is not an item of the view`);
        if (!keysOf("bins", "id").includes(probe.binId)) out.push(`assignedTo bin "${probe.binId}" is not a bin of the view`);
      } else {
        const n = rows(view, "waves").length;
        const w = /^w(\d+)$/.exec(probe.itemKey);
        if (!w || Number(w[1]) >= n) out.push(`assignedTo item "${probe.itemKey}" is not w0…w${n - 1} (${n} waves)`);
        if (!keysOf("categories", "id").includes(probe.binId)) out.push(`assignedTo category "${probe.binId}" is not a category of the view`);
      }
      break;
    }
  }
  return out;
}

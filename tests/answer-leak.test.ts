import { describe, expect, it } from "vitest";
import { WAVE1A } from "../fixtures/wave1a.encounters";
import { WAVE1B } from "../fixtures/wave1b.encounters";
import { WAVE2A } from "../fixtures/wave2a.encounters";
import { WAVE2B } from "../fixtures/wave2b.encounters";
import { WAVE2C } from "../fixtures/wave2c.encounters";
import { WAVE2D } from "../fixtures/wave2d.encounters";
import type { ChallengeSlice } from "../src/contracts/slices";
import { getCard } from "../src/library";
import { answerVarsFor, type AnyFamilyMode } from "../src/mechanics/types";
import { implementedModes, modeKey } from "../src/mechanics/registry";
import { mergeLockedParams } from "../src/pipeline/validate/checks";

/*
 * Generic "does grade() ever hand over the answer?" sweep (reviewer item "Generic leak test"). For every
 * implemented mode, pull one realistic encounter from a fixtures/wave*.encounters.ts file (preferring the
 * earliest wave that has one; wave2d exists specifically to cover the modes none of the others reach),
 * merge the card's lockedParams the same way the pipeline does, and check:
 *  1. params pass check() cleanly,
 *  2. grade(solutionInput(resolve())) is correct,
 *  3. at least one WRONG input (derived generically by mutating the solution input) is graded incorrect,
 *     and its feedback never contains a template answer-var value (skipping values under 3 characters,
 *     which are too short to be a meaningful leak and too likely to appear by coincidence).
 */

type Fixture = { cardId: string; slice: ChallengeSlice };
const ALL_FIXTURES: Fixture[] = [...WAVE1A, ...WAVE1B, ...WAVE2A, ...WAVE2B, ...WAVE2C, ...WAVE2D];

/** One fixture per family.mode key, preferring whichever wave file listed it first (WAVE2D last). */
const byModeKey = new Map<string, Fixture>();
for (const fx of ALL_FIXTURES) {
  const card = getCard(fx.cardId);
  if (!card) continue;
  const key = modeKey(card.family, card.mode);
  if (!byModeKey.has(key)) byModeKey.set(key, fx);
}

// ---------------------------------------------------------------- generic input mutation

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function isPlainObject(v: unknown): v is Record<string, Json> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function mutateLeaf(v: Json): Json {
  // A golden-ratio-ish irrational offset (then rounded) avoids reproducing the original digit sequence,
  // which a round offset like +1000 can do (e.g. 1.5 -> 1001.5 still contains "1.5") and would otherwise
  // make this generic mutator produce false-positive "leaks" that are really just coincidental substrings.
  if (typeof v === "number") return Math.round((v + 1000.6180339887) * 1000) / 1000;
  if (typeof v === "boolean") return !v;
  if (typeof v === "string") return v.length > 0 ? `${[...v].reverse().join("")}__mutated` : "mutated_value";
  return v;
}

/** Every path to a primitive leaf (number/string/boolean), depth-first. */
function leafPaths(v: Json, path: (string | number)[] = []): (string | number)[][] {
  if (Array.isArray(v)) return v.flatMap((item, i) => leafPaths(item, [...path, i]));
  if (isPlainObject(v)) return Object.entries(v).flatMap(([k, val]) => leafPaths(val, [...path, k]));
  return [path];
}

function setAtPath(root: Json, path: (string | number)[], value: Json): Json {
  if (path.length === 0) return value;
  const clone: Json = Array.isArray(root) ? [...root] : { ...(root as Record<string, Json>) };
  const [head, ...rest] = path;
  (clone as Record<string | number, Json>)[head as never] =
    rest.length === 0 ? value : setAtPath((clone as Record<string | number, Json>)[head as never] ?? null, rest, value);
  return clone;
}

/** Every array path (used to also try reversing whole arrays, which single-leaf mutation can't do for
 * order-independent structures like {links: [...]} keyed by object identity rather than position). */
function arrayPaths(v: Json, path: (string | number)[] = []): (string | number)[][] {
  const here = Array.isArray(v) ? [path] : [];
  if (Array.isArray(v)) return [...here, ...v.flatMap((item, i) => arrayPaths(item, [...path, i]))];
  if (isPlainObject(v)) return Object.entries(v).flatMap(([k, val]) => arrayPaths(val, [...path, k]));
  return [];
}

function getAtPath(root: Json, path: (string | number)[]): Json {
  let cur = root;
  for (const k of path) cur = (cur as Record<string | number, Json>)[k as never] ?? null;
  return cur;
}

/** Every string leaf found anywhere inside a value (used to collect the writer's own authored text —
 * item/option/statement labels — from `params`). */
function stringLeaves(v: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof v === "string") out.add(v);
  else if (Array.isArray(v)) v.forEach((item) => stringLeaves(item, out));
  else if (isPlainObject(v)) Object.values(v).forEach((item) => stringLeaves(item, out));
  return out;
}

/** Candidate "wrong" mutations of a solutionInput: one per primitive leaf changed, plus one per array
 * reversed. Generic across every mode's Input shape (no per-mode knowledge required). */
function mutationCandidates(input: unknown): unknown[] {
  const root = input as Json;
  const candidates: Json[] = [];
  for (const path of leafPaths(root)) {
    const leaf = getAtPath(root, path);
    candidates.push(setAtPath(root, path, mutateLeaf(leaf)));
    // A large multiplicative jump too: an additive offset can land back within tolerance on a log/exp
    // scale (e.g. a number-line mode whose tolerance is a fraction of the log-transformed range).
    if (typeof leaf === "number") candidates.push(setAtPath(root, path, leaf * 1000 + 7));
  }
  for (const path of arrayPaths(root)) {
    const arr = getAtPath(root, path);
    if (Array.isArray(arr) && arr.length > 1) candidates.push(setAtPath(root, path, [...arr].reverse()));
    if (Array.isArray(arr) && arr.length > 0) candidates.push(setAtPath(root, path, []));
  }
  return candidates;
}

// ---------------------------------------------------------------- the sweep

describe("answer-leak sweep (every implemented mode)", () => {
  const modes = implementedModes();
  let checked = 0;

  for (const { family, mode } of modes) {
    const key = modeKey(family.id, mode.id);
    const fx = byModeKey.get(key);

    it(`${key}: has a fixture encounter`, () => {
      expect(fx, `no fixture found for ${key} in any fixtures/wave*.encounters.ts`).toBeDefined();
    });
    if (!fx) continue;

    const card = getCard(fx.cardId)!;
    const m = mode as AnyFamilyMode;

    it(`${key} (${fx.cardId}): check() is clean and the solution grades correct`, () => {
      const params = mergeLockedParams(fx.slice.params, card.lockedParams);
      expect(m.check(params)).toEqual([]);
      const solution = m.resolve(params);
      const solutionInput = m.solutionInput(params, solution);
      expect(m.grade(params, solutionInput).correct).toBe(true);
      checked++;
    });

    it(`${key} (${fx.cardId}): a wrong input's feedback never leaks an answer var`, () => {
      const params = mergeLockedParams(fx.slice.params, card.lockedParams);
      const solution = m.resolve(params);
      const solutionInput = m.solutionInput(params, solution);
      const known = m.templateVars(params, solution);
      const answerVars = answerVarsFor(m, params);
      // Item/option/statement labels the writer authored (e.g. a plank's own text) are already visible to
      // the player before grading — not a secret — so an answer var whose value merely repeats one of
      // those authored strings isn't a genuine leak; a DERIVED value (a computed number, an outcome
      // description) that grade() weren't supposed to reveal on a miss is the thing this test looks for.
      const authoredText = stringLeaves(params);
      const leakValues = answerVars
        .map((v) => known[v])
        .filter((v): v is string => typeof v === "string" && v.length >= 3 && !authoredText.has(v));

      const candidates = mutationCandidates(solutionInput);
      let foundWrong = false;
      for (const candidate of candidates) {
        let grade: { correct: boolean; feedback: string };
        try {
          grade = m.grade(params, candidate);
        } catch {
          continue; // a malformed mutation crashing the grader isn't a leak; skip it
        }
        if (grade.correct) continue;
        foundWrong = true;
        for (const value of leakValues) {
          expect(grade.feedback, `${key}: miss feedback leaks answer var value "${value}" (input: ${JSON.stringify(candidate)})`).not.toContain(
            value,
          );
        }
      }
      expect(foundWrong, `${key}: no mutation of the solution input produced an incorrect grade (grader may be too permissive to test generically)`).toBe(
        true,
      );
    });
  }

  it("checked every implemented mode", () => {
    expect(checked).toBe(modes.length);
  });
});

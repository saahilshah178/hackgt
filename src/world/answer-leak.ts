/**
 * src/world/answer-leak.ts (V1) — R8's token-boundary answer matcher (docs/design/20 §1.5 R8, amendment 34).
 *
 * Normalize (NFKC, lower case, `π` and the word `pi` → `π`, `−` → `-`, whitespace collapsed), then tokenize: a
 * *math run* `(?:\d+(?:\.\d+)?|π)(?:[/*^×]?(?:\d+(?:\.\d+)?|π))*` is ONE token (`2π`, `5π/6`, `π/2`, `4.00`), words are
 * `[a-z]+`, anything else (not whitespace) is a single-character token. A banned value leaks when its token sequence
 * appears contiguously in the text; two pure decimals match by numeric value (`4.00` = `4`). So `spin` never
 * matches `π`, `2π/|b|` never matches `π`, `40` never matches `4`. Pure.
 */
import type { AnyFamilyMode } from "../mechanics/types";
import { answerVarsFor } from "../mechanics/types";

const MATH_RUN = "(?:\\d+(?:\\.\\d+)?|π)(?:[/*^×]?(?:\\d+(?:\\.\\d+)?|π))*";
const TOKEN = new RegExp(`${MATH_RUN}|[a-z]+|\\S`, "gu");
const PURE_DECIMAL = /^\d+(?:\.\d+)?$/;

export function normalizeForLeak(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[−–]/g, "-")
    .replace(/(?<![a-z])pi(?![a-z])/g, "π")
    .replace(/\s+/g, " ")
    .trim();
}

export function leakTokens(text: string): string[] {
  return normalizeForLeak(text).match(TOKEN) ?? [];
}

function tokenEq(a: string, b: string): boolean {
  if (a === b) return true;
  return PURE_DECIMAL.test(a) && PURE_DECIMAL.test(b) && Number(a) === Number(b);
}

const WORDISH = new RegExp(`^(?:${MATH_RUN}|[a-z]+)$`, "u");
/** Drops leading/trailing punctuation tokens ("Doubling … period." matches "… period!"). */
function trimPunct(tokens: string[]): string[] {
  let a = 0;
  let b = tokens.length;
  while (a < b && !WORDISH.test(tokens[a] as string)) a++;
  while (b > a && !WORDISH.test(tokens[b - 1] as string)) b--;
  return tokens.slice(a, b);
}

/** True when `banned`'s token sequence appears contiguously in `text` (empty banned values never leak). */
export function leaks(text: string, banned: string): boolean {
  const needle = trimPunct(leakTokens(banned));
  if (needle.length === 0) return false;
  const hay = leakTokens(text);
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (!tokenEq(hay[i + j] as string, needle[j] as string)) continue outer;
    return true;
  }
  return false;
}

/** The banned values that leak in `text`. */
export function leakedValues(text: string, banned: readonly string[]): string[] {
  return banned.filter((b) => leaks(text, b));
}

/** R8: bannedValues = answerVarsFor(mode, params).map(k => mode.templateVars(params, solution)[k]) (non-empty, distinct). */
export function bannedValuesFor(mode: AnyFamilyMode, params: unknown, solution: unknown): string[] {
  let vars: Record<string, string>;
  try {
    vars = mode.templateVars(params, solution);
  } catch {
    return [];
  }
  const out = answerVarsFor(mode, params)
    .map((k) => vars[k])
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  return [...new Set(out)];
}

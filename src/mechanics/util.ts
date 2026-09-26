import { all, create } from "mathjs";

// ---------- exact math: the model writes expressions, code computes numbers ----------

/*
 * Every expression evaluated here was written by a language model (formula.mathjs, challenge params), so the
 * evaluator is a sandboxed mathjs instance per the mathjs security guide: no `import`/`createUnit` (they mutate
 * the instance), no nested `evaluate`/`parse`/`compile`/`simplify`/`derivative`/`resolve` (they turn a value into
 * code), and a hard length cap so a pathological string cannot stall a verifier run.
 */
const math = create(all);
const limitedEvaluate = math.evaluate;
const disabled = () => {
  throw new Error("disabled in Quest Forge expressions");
};
math.import(
  {
    import: disabled,
    createUnit: disabled,
    reviver: disabled,
    evaluate: disabled,
    parse: disabled,
    compile: disabled,
    simplify: disabled,
    derivative: disabled,
    resolve: disabled,
    rationalize: disabled,
    help: disabled,
  },
  { override: true },
);

export const MAX_EXPRESSION_LENGTH = 400;

/** Evaluates a mathjs expression like "5*pi/6" in the sandbox. Returns null unless it is a finite real number. */
export function evalExact(expr: string): number | null {
  if (typeof expr !== "string" || expr.length > MAX_EXPRESSION_LENGTH) return null;
  try {
    const v: unknown = limitedEvaluate(expr);
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** True when the string looks like a rounded decimal (1.5708) instead of an exact expression (pi/2). */
export function looksApproximated(expr: string): boolean {
  return /\d\.\d{3,}/.test(expr);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function trimNumber(x: number): string {
  return Number(x.toFixed(3)).toString();
}

/** Returns "5π/6" if x is a small rational multiple of π, else null. */
export function asPiMultiple(x: number, maxDenominator = 12): string | null {
  if (Math.abs(x) < 1e-12) return "0";
  const k = x / Math.PI;
  for (let d = 1; d <= maxDenominator; d++) {
    const n = Math.round(k * d);
    if (n !== 0 && Math.abs(k - n / d) < 1e-9) {
      const g = gcd(Math.abs(n), d);
      const nn = n / g;
      const dd = d / g;
      const num = nn === 1 ? "π" : nn === -1 ? "-π" : `${nn}π`;
      return dd === 1 ? num : `${num}/${dd}`;
    }
  }
  return null;
}

export function formatNumber(x: number): string {
  return asPiMultiple(x) ?? trimNumber(x);
}

/** Pretty-prints a mathjs expression for players: "5*pi/6" -> "5π/6". */
export function prettyExpr(expr: string): string {
  return expr.replace(/\s+/g, "").replace(/\bpi\b/g, "π").replace(/\*/g, "");
}

// ---------- seeded randomness: identical shuffles on every replay and in tests ----------

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffle that never returns the original order (so an Order puzzle is never pre-solved). */
export function shuffleNotIdentity<T>(items: readonly T[], seed: number): T[] {
  if (items.length < 2) return [...items];
  for (let k = 0; k < 16; k++) {
    const s = seededShuffle(items, seed + k);
    if (s.some((x, i) => x !== items[i])) return s;
  }
  return [...items].reverse();
}

/** FNV-1a string hash, used to derive a spec's seed from its id. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------- {{placeholder}} templates: model text references computed values ----------

const PLACEHOLDER = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export function placeholders(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[1]);
}

export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(PLACEHOLDER, (whole, name: string) => (name in vars ? vars[name] : whole));
}

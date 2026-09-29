/*
 * Small text helpers for the world3d pipeline: ids the stored schema accepts (lowercase snake_case, ≤ 48 characters),
 * strings clamped to a length at a word or sentence boundary, and short display names for concepts. Pure.
 */

const RESERVED = new Set(["spawn", "narrator", "you"]);

/** A stored-schema id from any string: lowercase snake_case, starting with a letter, at most 48 characters. */
export function toId(raw: string, fallback = "item"): string {
  let id = raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (id.length === 0) id = fallback;
  if (!/^[a-z]/.test(id)) id = `x_${id}`;
  return id.slice(0, 48).replace(/_+$/, "");
}

/** Like toId, but keeps the reserved words ("spawn", "narrator", "you") as they are. */
export function toRef(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  return RESERVED.has(trimmed) ? trimmed : toId(raw);
}

/** `text` cut to at most `max` characters at a word boundary, with an ellipsis when cut. */
export function clampText(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[\s,;:.–—-]+$/, "")}…`;
}

/** Whole sentences of `text` that fit in `max` characters (at least the first, clamped). */
export function clampSentences(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const sentences = t.match(/[^.!?]+[.!?]+["'”’)]*\s*/g) ?? [t];
  let out = "";
  for (const s of sentences) {
    if ((out + s).trim().length > max) break;
    out += s;
  }
  return out.trim().length > 0 ? out.trim() : clampText(t, max);
}

/** A concept's name without its parenthetical ("Brown v. Board of Education (1954)" → "Brown v. Board of Education"). */
export function shortName(name: string, max = 32): string {
  const bare = name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim() || name;
  return clampText(bare, max);
}

/** "a, b and c" */
export function listWords(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * src/game/art/kit/tokens.ts — palette token resolution (02 §3a.1, 20 §5.2 step 3). Pure: `art:build` and the
 * server-side assembler for PDF games (02 §6) both call it.
 *
 * `{{token.path}}` inside a paint attribute (fill, stroke, stop-color, flood-color, color) becomes `#rrggbb`; a token
 * with alpha (rgba tokens, `|alpha:a`) also writes `fill-opacity` / `stroke-opacity` / `stop-opacity` /
 * `flood-opacity`, multiplied into any opacity the element already carries. Never `rgba()` in SVG paint.
 * Modifiers: `|haze:t` (mix toward `haze`), `|mix:<token>:t`, `|dim:t` (toward `shadow`), `|light:t` (toward white),
 * `|alpha:a`.
 */

export type PaletteTokens = Readonly<Record<string, string>>;
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseColor(s: string): Rgba | null {
  const t = s.trim();
  let m = t.match(/^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/);
  if (m) {
    const v = parseInt(m[1], 16);
    return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255, a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  }
  m = t.match(/^#([0-9a-fA-F]{3})$/);
  if (m) {
    const [r, g, b] = m[1].split("").map((c) => parseInt(c + c, 16));
    return { r, g, b, a: 1 };
  }
  m = t.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  return null;
}
export function toHex(c: Rgba): string {
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`.toUpperCase();
}
export function mix(a: Rgba, b: Rgba, t: number): Rgba {
  const k = Math.max(0, Math.min(1, t));
  return { r: a.r + (b.r - a.r) * k, g: a.g + (b.g - a.g) * k, b: a.b + (b.b - a.b) * k, a: a.a };
}
/** Numeric 0xRRGGBB for Phaser tints. */
export function toNumber(c: Rgba): number {
  return (Math.round(c.r) << 16) | (Math.round(c.g) << 8) | Math.round(c.b);
}

export class TokenError extends Error {}

/** Resolve one token expression (without braces) against a palette. Throws TokenError on unknown tokens. */
export function resolveTokenExpr(expr: string, palette: PaletteTokens): Rgba {
  const [name, ...mods] = expr.split("|");
  const lookup = (tok: string): Rgba => {
    const raw = palette[tok];
    if (raw === undefined) throw new TokenError(`unknown token "${tok}"`);
    const c = parseColor(raw);
    if (!c) throw new TokenError(`token "${tok}" is not a colour: ${raw}`);
    return c;
  };
  let c = lookup(name);
  for (const mod of mods) {
    const [op, ...args] = mod.split(":");
    const num = (s: string | undefined) => {
      const v = Number(s);
      if (!Number.isFinite(v)) throw new TokenError(`bad modifier "${mod}" in "${expr}"`);
      return v;
    };
    if (op === "haze") c = mix(c, lookup("haze"), num(args[0]));
    else if (op === "mix") c = mix(c, lookup(args[0] ?? ""), num(args[1]));
    else if (op === "dim") c = mix(c, lookup("shadow"), num(args[0]));
    else if (op === "light") c = mix(c, { r: 255, g: 255, b: 255, a: 1 }, num(args[0]));
    else if (op === "alpha") c = { ...c, a: c.a * num(args[0]) };
    else throw new TokenError(`unknown modifier "${op}" in "${expr}"`);
  }
  return c;
}

const PAINT_OPACITY: Readonly<Record<string, string>> = {
  fill: "fill-opacity",
  stroke: "stroke-opacity",
  "stop-color": "stop-opacity",
  "flood-color": "flood-opacity",
  color: "opacity",
};

const fmtAlpha = (a: number): string => {
  const r = Math.round(a * 1000) / 1000;
  return r.toString();
};

/**
 * Resolve every {{token}} in an SVG string. Returns the new SVG and the list of problems (unknown tokens, tokens
 * outside a paint attribute). Callers fail the build on any problem.
 */
export function resolveTokens(svg: string, palette: PaletteTokens): { svg: string; problems: string[] } {
  const problems: string[] = [];
  const out = svg.replace(/<([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g, (tag, name: string, attrs: string, selfClose: string) => {
    if (!attrs.includes("{{")) return tag;
    const list: Array<[string, string]> = [];
    for (const m of attrs.matchAll(/([\w:-]+)="([^"]*)"/g)) list.push([m[1], m[2]]);
    const alphaMul = new Map<string, number>();
    const mapped = list.map(([k, v]): [string, string] => {
      if (!v.includes("{{")) return [k, v];
      const m = v.match(/^\{\{([^}]+)\}\}$/);
      if (!m || !(k in PAINT_OPACITY)) {
        problems.push(`token outside a paint attribute: <${name} ${k}="${v}">`);
        return [k, v];
      }
      try {
        const c = resolveTokenExpr(m[1], palette);
        if (c.a < 0.999) alphaMul.set(PAINT_OPACITY[k], (alphaMul.get(PAINT_OPACITY[k]) ?? 1) * c.a);
        return [k, toHex(c)];
      } catch (e) {
        problems.push((e as Error).message);
        return [k, v];
      }
    });
    for (const [opAttr, mul] of alphaMul) {
      const i = mapped.findIndex(([k]) => k === opAttr);
      if (i >= 0) mapped[i] = [opAttr, fmtAlpha(Number(mapped[i][1]) * mul)];
      else mapped.push([opAttr, fmtAlpha(mul)]);
    }
    return `<${name}${mapped.map(([k, v]) => ` ${k}="${v}"`).join("")}${selfClose ? "/" : ""}>`;
  });
  const leftover = out.match(/\{\{[^}]*\}\}/g);
  if (leftover) for (const l of new Set(leftover)) if (!problems.some((p) => p.includes(l))) problems.push(`unresolved token ${l}`);
  return { svg: out, problems };
}

/** Every distinct token name (before modifiers) an SVG references. */
export function tokensIn(svg: string): string[] {
  const out = new Set<string>();
  for (const m of svg.matchAll(/\{\{([^}]+)\}\}/g)) {
    const [name, ...mods] = m[1].split("|");
    out.add(name);
    for (const mod of mods) {
      const [op, arg] = mod.split(":");
      if (op === "mix" && arg) out.add(arg);
      if (op === "haze") out.add("haze");
      if (op === "dim") out.add("shadow");
    }
  }
  return [...out].sort();
}

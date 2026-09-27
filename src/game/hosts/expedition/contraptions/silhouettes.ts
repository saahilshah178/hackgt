/**
 * contraptions/silhouettes.ts (pure, H3) — the reduced DOM fallback's code-drawn stand-in for a station whose skin parts
 * have no manifest entry yet (w1a fix 5; §2.5.5, amendment 31). Instead of one placeholder disc per part, the DOM host
 * draws ONE labelled silhouette per archetype: a few SVG primitives that read as the machine (a dial and its rail, a
 * ring gate, three claim pillars, floating steps, a vault door...) inside the station's `frameBounds`, in biome tones,
 * with the station's noun beneath it. Coordinates are world units relative to `station.anchor`, like `frameBounds`.
 * No DOM, no React: Snapshot.tsx renders the result as SVG.
 */

export interface SilBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Biome tone slots; Snapshot.tsx maps them to palette tokens. */
export type SilTone = "body" | "light" | "shade" | "trim" | "dark" | "glow";
export type SilPrim =
  | { p: "rect"; x: number; y: number; w: number; h: number; r: number; fill: SilTone | null; stroke: SilTone | null; sw: number }
  | { p: "circle"; cx: number; cy: number; r: number; fill: SilTone | null; stroke: SilTone | null; sw: number }
  | { p: "line"; x1: number; y1: number; x2: number; y2: number; stroke: SilTone; sw: number; dash: number | null }
  | { p: "path"; d: string; fill: SilTone | null; stroke: SilTone | null; sw: number };
export interface Silhouette {
  archetype: string;
  /** the machine's box (world units, anchor-relative): the frame bounds inset so the framing margin stays empty */
  box: SilBounds;
  prims: SilPrim[];
  /** the noun label under the machine (world units; font size ≥ 34 so it stays ≥ 20 px at the panel zooms) */
  label: { x: number; y: number; text: string; size: number };
}

/** Archetypes with a dedicated drawing; anything else gets the generic machine. */
export const SILHOUETTE_ARCHETYPES = [
  "emitter_rail",
  "ring_gate",
  "pendulum_sync",
  "claim_holders",
  "step_bridge",
  "router_lanes",
  "sluice_waves",
  "stage_machine",
  "oracle_ticker",
  "tumbler_vault",
  "switchboard",
  "cause_tubes",
  "console_slate",
] as const;

const r1 = (v: number) => Math.round(v * 10) / 10;

class Pen {
  readonly prims: SilPrim[] = [];
  constructor(private readonly b: SilBounds) {}
  /** box fraction → world units */
  x(u: number): number {
    return r1(this.b.x + u * this.b.w);
  }
  y(v: number): number {
    return r1(this.b.y + v * this.b.h);
  }
  /** a length as a fraction of the box's smaller side */
  s(f: number): number {
    return r1(f * Math.min(this.b.w, this.b.h));
  }
  rect(u0: number, v0: number, u1: number, v1: number, fill: SilTone | null, stroke: SilTone | null = "dark", sw = 6, r = 10): this {
    const x = this.x(Math.min(u0, u1));
    const y = this.y(Math.min(v0, v1));
    this.prims.push({ p: "rect", x, y, w: r1(Math.abs(this.x(u1) - this.x(u0))), h: r1(Math.abs(this.y(v1) - this.y(v0))), r, fill, stroke, sw });
    return this;
  }
  circle(cx: number, cy: number, r: number, fill: SilTone | null, stroke: SilTone | null = "dark", sw = 6): this {
    this.prims.push({ p: "circle", cx: r1(cx), cy: r1(cy), r: r1(r), fill, stroke, sw });
    return this;
  }
  line(x1: number, y1: number, x2: number, y2: number, stroke: SilTone, sw = 6, dash: number | null = null): this {
    this.prims.push({ p: "line", x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), stroke, sw, dash });
    return this;
  }
  path(d: string, fill: SilTone | null, stroke: SilTone | null = "dark", sw = 6): this {
    this.prims.push({ p: "path", d, fill, stroke, sw });
    return this;
  }
  /** the plinth every machine stands on */
  plinth(u0 = 0.08, u1 = 0.92): this {
    return this.rect(u0, 0.94, u1, 1, "shade", "dark", 6, 6);
  }
}

function ringStuds(pen: Pen, cx: number, cy: number, r: number, n: number, size: number, tone: SilTone): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pen.circle(cx + r * Math.cos(a), cy - r * Math.sin(a), size, tone, null, 0);
  }
}

/** One drawing per archetype, in the machine box. */
function draw(archetype: string, pen: Pen, box: SilBounds): void {
  const minSide = Math.min(box.w, box.h);
  switch (archetype) {
    case "emitter_rail": {
      // the dial sits ON the anchor: disc, rail ring with studs, the carriage, a plumb gauge and a slide gauge
      const R = Math.min(minSide * 0.36, Math.abs(box.x) * 0.9 || minSide * 0.36);
      pen.circle(0, 0, R * 1.18, null, "trim", 14);
      ringStuds(pen, 0, 0, R * 1.18, 24, R * 0.03, "light");
      pen.circle(0, 0, R, "body", "dark", 8).circle(0, 0, R * 0.62, "light", "trim", 6).circle(0, 0, R * 0.12, "dark", "trim", 6);
      pen.line(-R, 0, R, 0, "dark", 4).line(0, -R, 0, R, "dark", 4);
      const a = Math.PI / 6;
      pen.prims.push({ p: "rect", x: r1(R * 1.18 * Math.cos(a) - R * 0.1), y: r1(-R * 1.18 * Math.sin(a) - R * 0.1), w: r1(R * 0.2), h: r1(R * 0.2), r: 6, fill: "trim", stroke: "dark", sw: 6 });
      pen.line(0, 0, R * 1.18 * Math.cos(a), -R * 1.18 * Math.sin(a), "glow", 8);
      pen.rect(0.9, 0.2, 0.95, 0.62, "shade").rect(0.3, 0.86, 0.7, 0.9, "shade");
      break;
    }
    case "ring_gate": {
      const R = Math.min(minSide * 0.32, Math.abs(box.y) * 0.4 || minSide * 0.32);
      pen.path(`M ${pen.x(0.06)} ${pen.y(1)} L ${pen.x(0.06)} ${r1(-R * 1.3)} Q 0 ${r1(-R * 2)} ${pen.x(0.94)} ${r1(-R * 1.3)} L ${pen.x(0.94)} ${pen.y(1)} Z`, "shade", "dark", 8);
      pen.circle(0, 0, R * 1.2, "body", "trim", 16).circle(0, 0, R * 0.78, "light", "dark", 8).circle(0, 0, R * 0.28, "dark", "trim", 6);
      pen.line(0, -R * 0.78, 0, R * 0.78, "dark", 6);
      pen.path(`M ${r1(-R * 0.35)} ${r1(-R * 1.2)} L ${r1(-R * 0.2)} ${r1(-R * 1.75)} L ${r1(-R * 0.05)} ${r1(-R * 1.2)} Z`, "trim");
      pen.path(`M ${r1(R * 0.05)} ${r1(-R * 1.2)} L ${r1(R * 0.2)} ${r1(-R * 1.75)} L ${r1(R * 0.35)} ${r1(-R * 1.2)} Z`, "trim");
      pen.circle(0, -R * 2.05, R * 0.2, "body", "trim", 6);
      pen.rect(0.02, 0.9, 0.98, 1, "glow", "dark", 4, 4);
      break;
    }
    case "pendulum_sync": {
      pen.plinth();
      pen.rect(0.62, 0.3, 0.84, 0.94, "body").circle(pen.x(0.73), pen.y(0.2), pen.s(0.1), "light", "dark", 6);
      pen.rect(0.66, 0.16, 0.8, 0.22, "glow", "dark", 4, 4);
      pen.circle(pen.x(0.5), pen.y(0.55), pen.s(0.2), "trim", "dark", 8).circle(pen.x(0.5), pen.y(0.55), pen.s(0.08), "dark", "light", 6);
      pen.line(pen.x(0.22), pen.y(0.08), pen.x(0.22), pen.y(0.7), "dark", 8).circle(pen.x(0.22), pen.y(0.08), pen.s(0.03), "trim", "dark", 4);
      pen.circle(pen.x(0.22), pen.y(0.72), pen.s(0.08), "trim", "dark", 6);
      pen.line(pen.x(0.22), pen.y(0.72), pen.x(0.5), pen.y(0.55), "glow", 4, 16);
      break;
    }
    case "claim_holders": {
      pen.plinth();
      for (const [i, u] of [0.2, 0.5, 0.8].entries()) {
        pen.rect(u - 0.07, 0.34, u + 0.07, 0.94, "body").rect(u - 0.09, 0.3, u + 0.09, 0.36, "light");
        pen.circle(pen.x(u), pen.y(0.22), pen.s(0.07), i === 1 ? "glow" : "trim", "dark", 6);
      }
      pen.rect(0.44, 0.78, 0.56, 0.94, "shade").circle(pen.x(0.5), pen.y(0.74), pen.s(0.05), "light", "trim", 6);
      break;
    }
    case "step_bridge": {
      pen.rect(0, 0.62, 0.16, 1, "shade", "dark", 6, 4).rect(0.84, 0.62, 1, 1, "shade", "dark", 6, 4);
      const n = 5;
      for (let i = 0; i < n; i++) {
        const u = 0.2 + (i / (n - 1)) * 0.6;
        const v = 0.58 - Math.sin((i / (n - 1)) * Math.PI) * 0.18;
        pen.rect(u - 0.055, v, u + 0.055, v + 0.07, i % 2 ? "light" : "body", "dark", 6, 6);
        pen.circle(pen.x(u), pen.y(v - 0.08), pen.s(0.025), "glow", null, 0);
      }
      pen.line(pen.x(0.16), pen.y(0.62), pen.x(0.84), pen.y(0.62), "trim", 4, 20);
      break;
    }
    case "router_lanes": {
      pen.rect(0.04, 0.42, 0.96, 0.58, "body", "dark", 6, 30);
      for (const u of [0.28, 0.5, 0.72]) pen.rect(u - 0.05, 0.38, u + 0.05, 0.62, "dark", "trim", 6, 8);
      pen.line(pen.x(0.28), pen.y(0.7), pen.x(0.28), pen.y(0.95), "glow", 6, 18).line(pen.x(0.72), pen.y(0.7), pen.x(0.72), pen.y(0.95), "glow", 6, 18);
      pen.circle(pen.x(0.5), pen.y(0.18), pen.s(0.1), "light", "dark", 8).circle(pen.x(0.5), pen.y(0.18), pen.s(0.045), "dark", "glow", 4);
      pen.plinth(0.02, 0.98);
      break;
    }
    case "sluice_waves": {
      pen.plinth(0.02, 0.98);
      for (const u of [0.32, 0.56, 0.8]) {
        pen.path(`M ${pen.x(u - 0.1)} ${pen.y(0.45)} L ${pen.x(u - 0.1)} ${pen.y(0.9)} L ${pen.x(u + 0.1)} ${pen.y(0.9)} L ${pen.x(u + 0.1)} ${pen.y(0.45)}`, "glow", "dark", 8);
        pen.circle(pen.x(u), pen.y(0.7), pen.s(0.07), "light", "dark", 6);
      }
      pen.circle(pen.x(0.1), pen.y(0.55), pen.s(0.12), null, "trim", 12);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        pen.line(pen.x(0.1), pen.y(0.55), pen.x(0.1) + pen.s(0.12) * Math.cos(a), pen.y(0.55) + pen.s(0.12) * Math.sin(a), "trim", 6);
      }
      break;
    }
    case "stage_machine": {
      pen.plinth();
      pen.rect(0.14, 0.2, 0.86, 0.94, "shade", "dark", 8, 30);
      const R = pen.s(0.26);
      pen.circle(pen.x(0.5), pen.y(0.58), R, "body", "trim", 10);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        pen.line(pen.x(0.5), pen.y(0.58), pen.x(0.5) + R * Math.cos(a), pen.y(0.58) + R * Math.sin(a), "dark", 6);
      }
      pen.circle(pen.x(0.5), pen.y(0.58), R * 0.25, "glow", "dark", 6);
      pen.path(`M ${pen.x(0.3)} ${pen.y(0.2)} L ${pen.x(0.5)} ${pen.y(0.06)} L ${pen.x(0.7)} ${pen.y(0.2)} Z`, "trim");
      break;
    }
    case "oracle_ticker": {
      pen.plinth(0.02, 0.5);
      pen.rect(0.04, 0.46, 0.46, 0.94, "body", "dark", 8, 14).rect(0.08, 0.52, 0.42, 0.66, "light", "dark", 4, 6);
      pen.path(`M ${pen.x(0.25)} ${pen.y(0.46)} C ${pen.x(0.3)} ${pen.y(0.2)} ${pen.x(0.46)} ${pen.y(0.3)} ${pen.x(0.52)} ${pen.y(0.18)}`, null, "light", 18);
      pen.circle(pen.x(0.25), pen.y(0.8), pen.s(0.07), "trim", "dark", 6);
      pen.line(pen.x(0.46), pen.y(0.6), pen.x(0.98), pen.y(0.5), "dark", 6).line(pen.x(0.46), pen.y(0.6), pen.x(0.98), pen.y(0.5), "glow", 2, 14);
      break;
    }
    case "tumbler_vault": {
      const cx = pen.x(0.5);
      const cy = pen.y(0.52);
      const R = pen.s(0.36);
      pen.rect(0.06, 0.1, 0.94, 1, "shade", "dark", 8, 14);
      pen.circle(cx, cy, R, "body", "trim", 14).circle(cx, cy, R * 0.72, "light", "dark", 6);
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
        pen.circle(cx + R * 0.5 * Math.cos(a), cy + R * 0.5 * Math.sin(a), R * 0.13, "trim", "dark", 6);
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        pen.line(cx, cy, cx + R * 0.28 * Math.cos(a), cy + R * 0.28 * Math.sin(a), "dark", 8);
      }
      pen.circle(cx, cy, R * 0.08, "glow", "dark", 4);
      break;
    }
    case "switchboard": {
      pen.plinth();
      pen.rect(0.14, 0.12, 0.86, 0.94, "body", "dark", 8, 12).rect(0.2, 0.18, 0.8, 0.7, "shade", "dark", 4, 6);
      for (let row = 0; row < 4; row++) for (let col = 0; col < 6; col++) pen.circle(pen.x(0.26 + col * 0.096), pen.y(0.26 + row * 0.12), pen.s(0.02), row === 1 && col === 2 ? "glow" : "dark", "light", 3);
      pen.path(`M ${pen.x(0.36)} ${pen.y(0.38)} Q ${pen.x(0.42)} ${pen.y(0.86)} ${pen.x(0.55)} ${pen.y(0.5)}`, null, "trim", 6);
      pen.path(`M ${pen.x(0.46)} ${pen.y(0.26)} Q ${pen.x(0.6)} ${pen.y(0.8)} ${pen.x(0.74)} ${pen.y(0.62)}`, null, "light", 6);
      break;
    }
    case "cause_tubes": {
      const n = 5;
      const us = Array.from({ length: n }, (_, i) => 0.1 + (i / (n - 1)) * 0.8);
      for (let i = 0; i < n - 1; i++) {
        const u0 = us[i];
        const u1 = us[i + 1];
        pen.path(`M ${pen.x(u0)} ${pen.y(0.42)} Q ${pen.x((u0 + u1) / 2)} ${pen.y(0.62)} ${pen.x(u1)} ${pen.y(0.42)}`, null, "trim", 6);
      }
      for (const u of us) {
        pen.rect(u - 0.06, 0.4, u + 0.06, 0.88, "body", "dark", 6, 18).rect(u - 0.035, 0.5, u + 0.035, 0.78, "glow", null, 0, 10);
      }
      pen.plinth(0.02, 0.98);
      break;
    }
    case "console_slate": {
      pen.line(pen.x(0.5), pen.y(0.55), pen.x(0.5), pen.y(0.94), "shade", pen.s(0.06));
      pen.path(`M ${pen.x(0.22)} ${pen.y(0.58)} L ${pen.x(0.78)} ${pen.y(0.58)} L ${pen.x(0.7)} ${pen.y(0.24)} L ${pen.x(0.3)} ${pen.y(0.24)} Z`, "body", "trim", 8);
      pen.rect(0.34, 0.3, 0.66, 0.52, "dark", "glow", 4, 6);
      pen.plinth(0.3, 0.7);
      break;
    }
    default: {
      pen.plinth();
      pen.rect(0.2, 0.3, 0.8, 0.94, "body", "dark", 8, 16).circle(pen.x(0.5), pen.y(0.55), pen.s(0.14), "light", "trim", 8);
      pen.circle(pen.x(0.5), pen.y(0.55), pen.s(0.05), "glow", "dark", 4);
    }
  }
}

/**
 * The silhouette for a station. `frame` is the meta's `frameBounds(config, view)` (anchor-relative); an empty or
 * degenerate frame falls back to a 600 × 500 box above the anchor.
 */
export function silhouetteFor(archetype: string, frame: SilBounds | null, noun: string): Silhouette {
  const f = frame && frame.w > 40 && frame.h > 40 ? frame : { x: -300, y: -500, w: 600, h: 520 };
  const box: SilBounds = { x: r1(f.x + f.w * 0.1), y: r1(f.y + f.h * 0.12), w: r1(f.w * 0.8), h: r1(f.h * 0.76) };
  const pen = new Pen(box);
  draw(archetype, pen, box);
  const size = Math.max(34, Math.round(Math.min(box.w, box.h) * 0.06));
  // under the lowest stroke (the dial's rail ring can reach below the box), never over the machine
  const low = pen.prims.reduce((m, p) => {
    const e = primExtent(p);
    const sw = p.p === "path" || p.p === "line" || p.stroke ? p.sw / 2 : 0;
    return Math.max(m, e.y + e.h + sw);
  }, box.y + box.h);
  return { archetype, box, prims: pen.prims, label: { x: r1(box.x + box.w / 2), y: r1(low + size * 1.3), text: noun, size } };
}

/**
 * True when a DOM snapshot should draw the silhouette: the host knows which keys have built art and some machine part
 * (console parts aside; the stage draws the console on its own) has none yet. Without `hasArt`, the parts draw as-is.
 */
export function needsSilhouette(parts: readonly { asset: string }[], hasArt: ((key: string) => boolean) | undefined): boolean {
  if (!hasArt) return false;
  const machine = parts.filter((p) => !p.asset.endsWith("_console"));
  return machine.length === 0 || machine.some((p) => !hasArt(p.asset));
}

/** Palette tokens per tone slot, first found wins (the three biomes name their metals differently). */
export const SIL_TONE_TOKENS: Readonly<Record<SilTone, readonly string[]>> = {
  body: ["orrery.brass", "protein.stone", "brass.base", "bronze.ring"],
  light: ["stone.lit", "paper", "rock.light"],
  shade: ["stone.shade", "protein.stone.shade", "stone.deep"],
  trim: ["gold.base", "brass.hi", "gold.hi"],
  dark: ["inlay.navy", "inlay.navy.dark", "ink"],
  glow: ["glow.cyan", "recordlight", "cyto.glow"],
};
const SIL_FALLBACK: Readonly<Record<SilTone, string>> = { body: "#C69A6B", light: "#F2E6D4", shade: "#8C7B6B", trim: "#E8B658", dark: "#1B3150", glow: "#8FE0EA" };

/** "#rrggbb" per tone from a biome palette (tokens → hex). */
export function silhouetteTones(palette: Readonly<Record<string, string>>): Record<SilTone, string> {
  const out = { ...SIL_FALLBACK };
  for (const tone of Object.keys(SIL_TONE_TOKENS) as SilTone[]) {
    const hit = SIL_TONE_TOKENS[tone].map((t) => palette[t]).find((c) => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c));
    if (hit) out[tone] = hit;
  }
  return out;
}

/** Every point a primitive touches (tests: the drawing stays near its box). */
export function primExtent(p: SilPrim): SilBounds {
  switch (p.p) {
    case "rect":
      return { x: p.x, y: p.y, w: p.w, h: p.h };
    case "circle":
      return { x: p.cx - p.r, y: p.cy - p.r, w: 2 * p.r, h: 2 * p.r };
    case "line":
      return { x: Math.min(p.x1, p.x2), y: Math.min(p.y1, p.y2), w: Math.abs(p.x2 - p.x1), h: Math.abs(p.y2 - p.y1) };
    case "path": {
      const nums = (p.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      const xs = nums.filter((_, i) => i % 2 === 0);
      const ys = nums.filter((_, i) => i % 2 === 1);
      const x0 = Math.min(...xs);
      const y0 = Math.min(...ys);
      return { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 };
    }
  }
}

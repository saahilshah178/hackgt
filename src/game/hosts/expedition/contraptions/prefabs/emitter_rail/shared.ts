/**
 * emitter_rail prefab shared helpers (docs/design/20 §2.5.5, §7). Owned by KA (L6) with the prefab core; skin files
 * import it read-only. Palette-token colours, a frame-driven animation list (success/failure beats advance in the
 * view's `update`, which the controller calls even while it is busy playing a plan), cancellable waits, and the
 * primitive drawing the Vesper Dial (and ring_gate's shared.ts) reuse: dashed lines, arcs, chevrons, soft bands.
 *
 * World text is DOM (describe() chips, WorldLabelLayer, §5.3): nothing here draws Phaser text.
 */
import type Phaser from "phaser";
import type { BiomePalette, XY } from "../../types";

/** W0 seam (tests/world-contract.test.ts checks every prefab shared.ts keeps it); the skins here no longer use it. */
export { stubBox, type StubBoxOptions } from "../_stub";

export const ARCHETYPE_ID = "emitter_rail";
/** Kept for the W0 seam's callers. */
export const STUB_COLOR = 0x2f5a5e;

// ---------------------------------------------------------------- colours

/** "#rrggbb" palette token → 0xrrggbb, or the fallback. */
export function hexOf(palette: BiomePalette, token: string, fallback: number): number {
  const v = palette[token];
  if (typeof v !== "string") return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(v.trim());
  return m ? parseInt(m[1], 16) : fallback;
}

/** Mixes two 0xrrggbb colours (t = 0 → a, 1 → b). */
export function mix(a: number, b: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const ch = (c: number, s: number) => (c >> s) & 0xff;
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * k) << s;
  return m(16) | m(8) | m(0);
}

export interface OrreryColors {
  stoneLit: number;
  stoneBase: number;
  stoneShade: number;
  stoneDeep: number;
  goldHi: number;
  gold: number;
  goldDeep: number;
  navy: number;
  navyDark: number;
  bronze: number;
  brass: number;
  brassHi: number;
  brassDeep: number;
  engrave: number;
  beam: number;
  fog: number;
  star: number;
  starGlow: number;
  waterShallow: number;
  waterDeep: number;
  shadow: number;
  ink: number;
  fnF: number;
  fnG: number;
  fnH: number;
  amber: number;
}

/** The trig (orrery_terraces) tokens with bible §2 fallbacks, so the stand-ins render in any biome. */
export function orreryColors(palette: BiomePalette): OrreryColors {
  return {
    stoneLit: hexOf(palette, "stone.lit", 0xfbf1de),
    stoneBase: hexOf(palette, "stone.base", 0xf2e3c6),
    stoneShade: hexOf(palette, "stone.shade", 0xd9c3a0),
    stoneDeep: hexOf(palette, "stone.deep", 0xb89c78),
    goldHi: hexOf(palette, "gold.hi", 0xf6d27a),
    gold: hexOf(palette, "gold.base", 0xd9a441),
    goldDeep: hexOf(palette, "gold.deep", 0xa8782e),
    navy: hexOf(palette, "inlay.navy", 0x27466a),
    navyDark: hexOf(palette, "inlay.navy.dark", 0x1b3150),
    bronze: hexOf(palette, "bronze.ring", 0x6e4a2e),
    brass: hexOf(palette, "orrery.brass", 0xc99a4a),
    brassHi: hexOf(palette, "orrery.brass.hi", 0xebc57a),
    brassDeep: hexOf(palette, "orrery.brass.deep", 0x8e6428),
    engrave: hexOf(palette, "orrery.engrave", 0xb89c78),
    beam: hexOf(palette, "orrery.beam", 0x6ed2f2),
    fog: hexOf(palette, "orrery.fog", 0xede6f2),
    star: hexOf(palette, "vesper.star", 0xfff4d6),
    starGlow: hexOf(palette, "vesper.star.glow", 0xf6d27a),
    waterShallow: hexOf(palette, "water.shallow", 0x8fe0ea),
    waterDeep: hexOf(palette, "water.deep", 0x4cb6d0),
    shadow: hexOf(palette, "shadow", 0x6e7f9a),
    ink: hexOf(palette, "canal.slate", 0x2b3a44),
    fnF: 0xf5f8f8,
    fnG: 0x6fd98e,
    fnH: 0x4f92e6,
    amber: hexOf(palette, "foliage.salmon", 0xe48c5e),
  };
}

// ---------------------------------------------------------------- frame-driven animations and waits

export type EaseFn = (t: number) => number;
export const easeOutCubic: EaseFn = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutSine: EaseFn = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const linear: EaseFn = (t) => t;

interface AnimEntry {
  t: number;
  delay: number;
  dur: number;
  ease: EaseFn;
  fn: (p: number) => void;
  done: (() => void) | null;
}

/**
 * A tiny frame-driven animation list: `add(delay, duration, fn)` calls fn(eased progress 0 → 1) from `update(dt)`.
 * Reduced motion jumps every animation to its end on the next frame.
 */
export class Anims {
  private list: AnimEntry[] = [];
  constructor(private readonly reducedMotion: boolean) {}
  add(delayMs: number, durMs: number, fn: (p: number) => void, ease: EaseFn = easeOutCubic, done: (() => void) | null = null): void {
    this.list.push({ t: 0, delay: Math.max(0, delayMs), dur: Math.max(1, durMs), ease, fn, done });
  }
  update(dtMs: number): void {
    if (this.list.length === 0) return;
    const current = this.list;
    this.list = []; // `done` callbacks may add follow-ups; they land here and run from the next frame
    for (const a of current) {
      a.t += Math.max(0, dtMs);
      if (a.t < a.delay && !this.reducedMotion) {
        this.list.push(a);
        continue;
      }
      const p = this.reducedMotion ? 1 : Math.min(1, (a.t - a.delay) / a.dur);
      a.fn(a.ease(p));
      if (p >= 1) a.done?.();
      else this.list.push(a);
    }
  }
  get busy(): boolean {
    return this.list.length > 0;
  }
  clear(): void {
    this.list = [];
  }
}

/** Resolves after `ms` on the scene clock (or at once when destroyed; never rejects). */
export function waitMs(scene: Phaser.Scene, ms: number, isDead: () => boolean): Promise<void> {
  return new Promise<void>((resolve) => {
    if (ms <= 0 || isDead()) {
      resolve();
      return;
    }
    try {
      scene.time.delayedCall(ms, () => resolve());
    } catch {
      setTimeout(resolve, ms);
    }
  });
}

// ---------------------------------------------------------------- drawing primitives (Graphics, container-local)

/** Fills a closed polygon (plain {x, y} points; Graphics.fillPoints is typed for Vector2). */
export function fillPoly(g: Phaser.GameObjects.Graphics, pts: readonly XY[]): void {
  if (pts.length < 3) return;
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath();
  g.fillPath();
}

/** A dashed straight line. */
export function dashedLine(g: Phaser.GameObjects.Graphics, a: XY, b: XY, dash: number, gap: number): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1e-6) return;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  g.beginPath();
  for (let s = 0; s < len; s += dash + gap) {
    const e = Math.min(len, s + dash);
    g.moveTo(a.x + ux * s, a.y + uy * s);
    g.lineTo(a.x + ux * e, a.y + uy * e);
  }
  g.strokePath();
}

/**
 * An arc in MATH angles (counter-clockwise, y up) from a0 to a1 around c, as a polyline (Graphics.arc uses screen
 * angles; this keeps every caller in the metas' convention).
 */
export function mathArc(g: Phaser.GameObjects.Graphics, c: XY, r: number, a0: number, a1: number, stroke = true): void {
  const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) / (2 * Math.PI)) * 96));
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const x = c.x + r * Math.cos(a);
    const y = c.y - r * Math.sin(a);
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  if (stroke) g.strokePath();
}

/** A filled ring band between r0 and r1 over math angles [a0, a1] (a thick arc with square ends). */
export function bandArc(g: Phaser.GameObjects.Graphics, c: XY, r0: number, r1: number, a0: number, a1: number): void {
  const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) / (2 * Math.PI)) * 96));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push({ x: c.x + r1 * Math.cos(a), y: c.y - r1 * Math.sin(a) });
  }
  for (let i = n; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push({ x: c.x + r0 * Math.cos(a), y: c.y - r0 * Math.sin(a) });
  }
  fillPoly(g, pts);
}

/** A chevron (">" shape) at p pointing along the unit direction d, size s. */
export function chevron(g: Phaser.GameObjects.Graphics, p: XY, d: XY, s: number): void {
  const nx = -d.y;
  const ny = d.x;
  const tip = { x: p.x + d.x * s * 0.6, y: p.y + d.y * s * 0.6 };
  const a = { x: p.x - d.x * s * 0.4 + nx * s * 0.6, y: p.y - d.y * s * 0.4 + ny * s * 0.6 };
  const b = { x: p.x - d.x * s * 0.4 - nx * s * 0.6, y: p.y - d.y * s * 0.4 - ny * s * 0.6 };
  const ia = { x: a.x + d.x * s * 0.35, y: a.y + d.y * s * 0.35 };
  const ib = { x: b.x + d.x * s * 0.35, y: b.y + d.y * s * 0.35 };
  const itip = { x: tip.x - d.x * s * 0.35, y: tip.y - d.y * s * 0.35 };
  fillPoly(g, [a, tip, b, ib, itip, ia]);
}

/** Soft-edged horizontal-ish band: stacked strokes of falling alpha (a stand-in for a blurred cloud band). */
export function softStroke(g: Phaser.GameObjects.Graphics, draw: () => void, color: number, width: number, alpha: number, layers = 4): void {
  for (let i = layers; i >= 1; i--) {
    g.lineStyle(width * (1 + (i - 1) * 0.45), color, (alpha / layers) * (1.25 - i / (layers * 1.6)));
    draw();
  }
}

/** Sets a named anchor point in place (chips read anchors every frame, so moving parts keep their labels). */
export function setAnchor(anchors: Record<string, XY>, name: string, x: number, y: number): void {
  const a = anchors[name];
  if (a) {
    a.x = x;
    a.y = y;
  } else anchors[name] = { x, y };
}

// ---------------------------------------------------------------- the console lectern (bible §3: 0.7 H, lit slate, gold rim)

/** Draws the station's lectern (kit `lectern` stand-in) with its base on `at`; `lit` 0…1 brightens the slate. */
export function drawLectern(g: Phaser.GameObjects.Graphics, at: XY, c: OrreryColors, lit: number): XY {
  const h = 128;
  g.fillStyle(c.shadow, 0.25);
  g.fillEllipse(at.x + 18, at.y - 2, 110, 16);
  g.fillStyle(c.stoneShade, 1);
  g.fillRect(at.x - 16, at.y - h + 30, 32, h - 30);
  g.fillStyle(c.stoneBase, 1);
  g.fillRect(at.x - 16, at.y - h + 30, 18, h - 30);
  g.fillStyle(c.stoneDeep, 1);
  g.fillRoundedRect(at.x - 36, at.y - 14, 72, 14, 4);
  // the slanted slate with its gold rim
  const top = at.y - h;
  const slate = [
    { x: at.x - 48, y: top + 22 },
    { x: at.x + 48, y: top + 6 },
    { x: at.x + 50, y: top + 34 },
    { x: at.x - 46, y: top + 46 },
  ];
  g.fillStyle(c.gold, 1);
  fillPoly(g, slate.map((p, i) => ({ x: p.x + (i === 0 || i === 3 ? -5 : 5), y: p.y + (i < 2 ? -5 : 5) })));
  g.fillStyle(mix(0x0f2a33, 0x3b7682, lit), 1);
  fillPoly(g, slate);
  if (lit > 0) {
    g.fillStyle(c.beam, 0.25 * lit);
    g.fillEllipse(at.x, top + 26, 130, 60);
  }
  return { x: at.x, y: top + 26 };
}

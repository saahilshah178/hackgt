/**
 * FX, texture and UI generators (02 §3a.2): glowSprite, grainTile, hexGridPanel.
 */
import { z } from "zod";
import { rng } from "./rng";
import { blur, linear, radial } from "./shade";
import { circleD, el, Ids, n, poly, rectD, result, tk, type Pt } from "./svg";
import { TokZ, type KitGenerator, type KitResult } from "./types";

// ── glowSprite ─────────────────────────────────────────────────────────────────────────────────────────────
export const GlowSpriteZ = z.strictObject({
  size: z.number().int().min(4).max(1024),
  shape: z.enum(["radial", "shaft", "spark4", "puff", "mote", "ring_pop", "cone"]),
  core: TokZ,
  edge: TokZ,
  falloff: z.number().min(0.05).max(1),
  frames: z.number().int().min(1).max(12), // > 1 ⇒ horizontal sheet
});
export type GlowSpriteP = z.infer<typeof GlowSpriteZ>;

export const glowSprite: KitGenerator<GlowSpriteP> = {
  name: "glowSprite",
  schema: GlowSpriteZ,
  defaults: { size: 128, shape: "radial", core: "haze", edge: "glow.cyan", falloff: 0.5, frames: 1 },
  generate(p, seed): KitResult {
    const r = rng(seed);
    const ids = new Ids("gl");
    const S = p.size;
    let defs = "";
    let body = "";
    const glow = radial(ids, [[0, p.core], [p.falloff, p.edge, 0.55], [1, p.edge, 0]]);
    defs += glow.def;
    for (let f = 0; f < p.frames; f++) {
      const ox = f * S;
      const t = p.frames === 1 ? 1 : (f + 1) / p.frames;
      const c = S / 2;
      if (p.shape === "radial" || p.shape === "mote") {
        const rr = p.shape === "mote" ? S * 0.28 : (S / 2) * (p.frames > 1 ? 0.6 + 0.4 * t : 1);
        body += el("path", { d: circleD(ox + c, c, rr), fill: glow.ref });
      } else if (p.shape === "spark4") {
        const L = (S / 2) * (0.7 + 0.3 * t);
        const w = S * 0.07;
        const rot = f * 12;
        body += el("path", { d: poly([[c, c - L], [c + w, c - w], [c + L, c], [c + w, c + w], [c, c + L], [c - w, c + w], [c - L, c], [c - w, c - w]]), fill: tk(p.core), transform: `translate(${n(ox)} 0) rotate(${rot} ${n(c)} ${n(c)})` });
        body += el("path", { d: circleD(ox + c, c, S * 0.22), fill: glow.ref });
      } else if (p.shape === "ring_pop") {
        const rr = (S / 2 - 4) * (p.frames > 1 ? 0.3 + 0.7 * t : 0.8);
        body += el("path", { d: circleD(ox + c, c, rr), fill: "none", stroke: tk(p.core), "stroke-width": Math.max(1.5, S * 0.06 * (1.2 - t)), "stroke-opacity": p.frames > 1 ? 1 - t * 0.7 : 1 });
      } else if (p.shape === "puff") {
        const bl = blur(ids, S * 0.03);
        if (f === 0) defs += bl.def;
        let d = "";
        for (let i = 0; i < 5; i++) {
          const a = r.range(0, Math.PI * 2);
          const dist = S * 0.14 * t;
          d += circleD(ox + c + Math.cos(a) * dist, c + Math.sin(a) * dist, S * (0.14 + 0.14 * t));
        }
        body += el("path", { d, fill: tk(p.edge), "fill-opacity": p.frames > 1 ? 0.9 - t * 0.6 : 0.8, filter: bl.ref });
      } else if (p.shape === "shaft" || p.shape === "cone") {
        const mid = ids.next("mk");
        const vg = linear(ids, [[0, "haze"], [1, "haze", 0]], 0, 0, 0, 1);
        defs += vg.def;
        defs += el("mask", { id: mid, maskUnits: "userSpaceOnUse", x: ox, y: 0, width: S, height: S }, el("path", { d: rectD(ox, 0, S, S), fill: vg.ref }));
        const hg = linear(ids, [[0, p.edge, 0], [0.5, p.core, 0.9], [1, p.edge, 0]], 0, 0, 1, 0);
        defs += hg.def;
        const shape: Pt[] = p.shape === "shaft" ? [[ox + S * 0.3, 0], [ox + S * 0.7, 0], [ox + S * 0.95, S], [ox + S * 0.05, S]] : [[ox + S * 0.46, 0], [ox + S * 0.54, 0], [ox + S, S], [ox, S]];
        body += el("path", { d: poly(shape), fill: hg.ref, mask: `url(#${mid})` });
      }
    }
    const pivot: [number, number] = p.shape === "shaft" || p.shape === "cone" ? [0.5, 0] : [0.5, 0.5];
    return result(S * p.frames, S, defs, body, { pivot });
  },
};

// ── grainTile ──────────────────────────────────────────────────────────────────────────────────────────────
export const GrainTileZ = z.strictObject({
  size: z.union([z.literal(128), z.literal(256), z.literal(512)]),
  style: z.enum(["grain", "dither", "caustics", "scanlines", "leaf_dapple", "blinds"]),
  density: z.number().min(0).max(1),
  tok: TokZ,
});
export type GrainTileP = z.infer<typeof GrainTileZ>;

export const grainTile: KitGenerator<GrainTileP> = {
  name: "grainTile",
  schema: GrainTileZ,
  defaults: { size: 256, style: "grain", density: 0.35, tok: "shadow" },
  generate(p, seed): KitResult {
    const r = rng(seed);
    const ids = new Ids("gt");
    const S = p.size;
    let defs = "";
    let body = "";
    const wrapXY = (x: number, y: number, rr: number, fn: (x: number, y: number) => string) => {
      let d = "";
      for (const dx of [0, ...(x - rr < 0 ? [S] : []), ...(x + rr > S ? [-S] : [])])
        for (const dy of [0, ...(y - rr < 0 ? [S] : []), ...(y + rr > S ? [-S] : [])]) d += fn(x + dx, y + dy);
      return d;
    };
    if (p.style === "grain" || p.style === "dither") {
      const count = Math.round(((S * S) / 16) * p.density);
      let a = "";
      let b = "";
      for (let i = 0; i < count; i++) {
        const x = p.style === "dither" ? Math.floor(r.range(0, S / 2)) * 2 : Math.floor(r.range(0, S));
        const y = p.style === "dither" ? Math.floor(r.range(0, S / 2)) * 2 : Math.floor(r.range(0, S));
        const d = `M${x} ${y}h1v1h-1Z`;
        if (i % 2) a += d;
        else b += d;
      }
      body += el("path", { d: a, fill: tk(p.tok), "fill-opacity": 0.5 });
      body += el("path", { d: b, fill: tk(p.tok), "fill-opacity": 0.25 });
    } else if (p.style === "scanlines") {
      let d = "";
      for (let y = 0; y < S; y += 3) d += rectD(0, y, S, 1);
      body += el("path", { d, fill: tk(p.tok), "fill-opacity": Math.max(0.05, p.density) });
    } else if (p.style === "blinds") {
      const slat = S / 8;
      const g = linear(ids, [[0, p.tok, 0], [0.6, p.tok, 0.6 * p.density + 0.2], [1, p.tok, 0]], 0, 0, 0, 1);
      defs += g.def;
      for (let y = 0; y < S; y += slat) body += el("path", { d: rectD(0, y, S, slat * 0.55), fill: g.ref });
    } else if (p.style === "leaf_dapple") {
      const bl = blur(ids, S / 40);
      defs += bl.def;
      let d = "";
      const count = Math.round(6 + 18 * p.density);
      for (let i = 0; i < count; i++) {
        const x = r.range(0, S);
        const y = r.range(0, S);
        const rx = r.range(S * 0.04, S * 0.12);
        d += wrapXY(x, y, rx + S / 20, (cx, cy) => circleD(cx, cy, rx));
      }
      body += el("path", { d, fill: tk(p.tok), "fill-opacity": 0.55, filter: bl.ref });
    } else {
      // caustics: periodic light network (sums of integer-frequency waves wrap in both axes)
      let d = "";
      const lines = Math.round(4 + 8 * p.density);
      for (let i = 0; i < lines; i++) {
        const ph = r.range(0, Math.PI * 2);
        const k = r.int(1, 3);
        const y0 = (i / lines) * S;
        const pts: Pt[] = [];
        for (let x = 0; x <= S; x += S / 32) pts.push([x, y0 + Math.sin((2 * Math.PI * k * x) / S + ph) * S * 0.05]);
        const pts2: Pt[] = [];
        for (let y = 0; y <= S; y += S / 32) pts2.push([y0 + Math.sin((2 * Math.PI * k * y) / S + ph * 1.3) * S * 0.05, y]);
        // lines near an edge get a copy one tile over, so the texture wraps in X and Y
        for (const [line, axis] of [[pts, 1], [pts2, 0]] as const) {
          d += poly(line, false);
          const vals = line.map((q) => q[axis]);
          const shifts = [...(Math.min(...vals) < 0 ? [S] : []), ...(Math.max(...vals) > S ? [-S] : [])];
          for (const sh of shifts) d += poly(line.map(([qx, qy]) => (axis === 0 ? [qx + sh, qy] : [qx, qy + sh]) as Pt), false);
        }
      }
      const bl = blur(ids, 1.2);
      defs += bl.def;
      body += el("path", { d, stroke: tk(p.tok), "stroke-width": 2, "stroke-opacity": 0.5, fill: "none", filter: bl.ref });
    }
    return result(S, S, defs, body, { pivot: [0, 0], tileWidth: S });
  },
};

// ── hexGridPanel ───────────────────────────────────────────────────────────────────────────────────────────
export const HexGridPanelZ = z.strictObject({
  cell: z.number().min(4).max(96), // hex edge, default 18
  cols: z.number().int().min(2).max(64), // even
  rows: z.number().int().min(1).max(64),
  stroke: TokZ, // ui.hex
  strokeW: z.number().min(0.25).max(8),
  wash: z.strictObject({ from: TokZ, to: TokZ, angle: z.number() }).nullable(),
});
export type HexGridPanelP = z.infer<typeof HexGridPanelZ>;

export const hexGridPanel: KitGenerator<HexGridPanelP> = {
  name: "hexGridPanel",
  schema: HexGridPanelZ.refine((p) => p.cols % 2 === 0, "cols must be even so the grid tiles"),
  defaults: { cell: 18, cols: 8, rows: 4, stroke: "ui.hex", strokeW: 1, wash: null },
  generate(p): KitResult {
    const ids = new Ids("hx");
    const c = p.cell;
    const W = 1.5 * c * p.cols;
    const H = Math.sqrt(3) * c * p.rows;
    const rh = (Math.sqrt(3) / 2) * c;
    let defs = "";
    let body = "";
    if (p.wash) {
      const a = (p.wash.angle * Math.PI) / 180;
      const g = linear(ids, [[0, p.wash.from], [1, p.wash.to]], 0.5 - Math.cos(a) / 2, 0.5 - Math.sin(a) / 2, 0.5 + Math.cos(a) / 2, 0.5 + Math.sin(a) / 2);
      defs += g.def;
      body += el("path", { d: rectD(0, 0, W, H), fill: g.ref });
    }
    let d = "";
    for (let col = -1; col <= p.cols; col++) {
      for (let row = -1; row <= p.rows; row++) {
        const cx = col * 1.5 * c;
        const cy = row * 2 * rh + (col % 2 !== 0 ? rh : 0);
        const pts: Pt[] = [];
        for (let k = 0; k < 6; k++) pts.push([cx + Math.cos((k * Math.PI) / 3) * c, cy + Math.sin((k * Math.PI) / 3) * c]);
        d += poly(pts);
      }
    }
    body += el("path", { d, fill: "none", stroke: tk(p.stroke), "stroke-width": p.strokeW });
    return result(W, H, defs, body, { pivot: [0, 0], tileWidth: Math.round(W) === W ? W : null });
  },
};

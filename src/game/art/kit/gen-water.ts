/**
 * Water, cell and molecule generators (02 §3a.2): waterBand, bilayerTile, lipidColonnade, molecule.
 */
import { z } from "zod";
import { rng } from "./rng";
import { linear, radial } from "./shade";
import { blobD, circleD, el, Ids, n, poly, rectD, result, roundRectD, tk, type Pt } from "./svg";
import { TokZ, type KitGenerator, type KitResult } from "./types";

// ── waterBand ──────────────────────────────────────────────────────────────────────────────────────────────
export const WaterBandZ = z.strictObject({
  w: z.number().int().min(16).max(4096),
  h: z.number().int().min(8).max(2048),
  style: z.enum(["canal", "falls", "flood", "pool", "tide", "trench"]),
  deep: TokZ,
  shallow: TokZ,
  highlight: TokZ,
  flecks: z.strictObject({ tok: TokZ, count: z.number().int().min(0).max(400) }).nullable(),
  debris: z.enum(["paper", "none"]),
  waveAmp: z.number().min(0).max(64),
  waveCycles: z.number().int().min(1).max(64), // integer, so the tile wraps
});
export type WaterBandP = z.infer<typeof WaterBandZ>;

function waterLayer(p: WaterBandP, seed: number, streaksOnly: boolean): KitResult {
  const r = rng(seed);
  const ids = new Ids("wb");
  const { w, h } = p;
  let defs = "";
  let body = "";
  const falls = p.style === "falls";
  if (!streaksOnly) {
    const g = falls
      ? linear(ids, [[0, p.shallow], [0.6, p.deep], [1, `${p.deep}|dim:0.2`]], 0, 0, 1, 0)
      : linear(ids, [[0, p.shallow], [0.45, p.deep], [1, `${p.deep}|dim:${p.style === "trench" ? 0.4 : 0.2}`]], 0, 0, 0, 1);
    defs += g.def;
    if (falls) body += el("path", { d: rectD(0, 0, w, h), fill: g.ref });
    else {
      const top: Pt[] = [];
      const steps = p.waveCycles * 8;
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * w;
        top.push([x, p.waveAmp + Math.sin((i / 8) * Math.PI * 2) * p.waveAmp]);
      }
      body += el("path", { d: poly([...top, [w, h], [0, h]]), fill: g.ref });
      body += el("path", { d: poly(top, false), stroke: tk(p.highlight), "stroke-width": 2.5, "stroke-opacity": 0.85, fill: "none" });
    }
  }
  // highlight streaks, wrapped in X (and in Y for falls)
  let streaks = "";
  const count = Math.round((w * h) / (falls ? 1800 : 2600));
  for (let i = 0; i < count; i++) {
    const x = r.range(0, w);
    const y = falls ? r.range(0, h) : r.range(p.waveAmp * 2 + 4, h - 4);
    const len = falls ? r.range(30, 110) : r.range(14, 60) * (1 - y / h + 0.3);
    const xs = [x, ...(x + len > w ? [x - w] : [])];
    for (const sx of xs) {
      if (falls) {
        streaks += `M${n(sx)} ${n(y)}v${n(Math.min(len, h - y))}`;
        if (y + len > h) streaks += `M${n(sx)} 0v${n(y + len - h)}`;
      } else streaks += `M${n(sx)} ${n(y)}h${n(len)}`;
    }
  }
  body += el("path", { d: streaks, stroke: tk(p.highlight), "stroke-opacity": streaksOnly ? 0.5 : 0.32, "stroke-width": falls ? 2.5 : 2, "stroke-linecap": "round", fill: "none" });
  if (!streaksOnly && p.flecks && p.flecks.count > 0) {
    let fl = "";
    for (let i = 0; i < p.flecks.count; i++) fl += circleD(r.range(3, w - 3), r.range(p.waveAmp * 2 + 3, h - 3), r.range(0.8, 2.2));
    body += el("path", { d: fl, fill: tk(p.flecks.tok), "fill-opacity": 0.7 });
  }
  if (!streaksOnly && p.debris === "paper") {
    let paper = "";
    for (let i = 0; i < Math.max(2, Math.round(w / 240)); i++) {
      const x = r.range(10, w - 30);
      const y = r.range(p.waveAmp * 2 + 2, Math.min(h - 8, p.waveAmp * 2 + 30));
      paper += poly([[x, y], [x + 18, y - 3], [x + 20, y + 6], [x + 2, y + 9]]);
    }
    body += el("path", { d: paper, fill: tk("stone.lit"), "fill-opacity": 0.85 });
  }
  return result(w, h, defs, body, { pivot: [0, 0], tileWidth: w });
}

export const waterBand: KitGenerator<WaterBandP> = {
  name: "waterBand",
  schema: WaterBandZ,
  defaults: { w: 1024, h: 120, style: "canal", deep: "water.deep", shallow: "water.shallow", highlight: "haze", flecks: null, debris: "none", waveAmp: 3, waveCycles: 8 },
  generate(p, seed): KitResult {
    const main = waterLayer(p, seed, false);
    // "<key>.b": a transparent streak layer the host scrolls at a different rate over the body (offset UV scroll)
    return { ...main, extras: { b: waterLayer(p, seed ^ 0x9e3779b9, true) } };
  },
};

// ── bilayerTile ────────────────────────────────────────────────────────────────────────────────────────────
const BilayerTokens = z.strictObject({ head: TokZ, headLit: TokZ, headShade: TokZ, tail: TokZ, core: TokZ, frost: TokZ, inlay: TokZ, stud: TokZ });
export const BilayerTileZ = z.strictObject({
  w: z.number().min(8).max(4096), // multiple of pitch
  headR: z.number().min(2).max(64),
  pitch: z.number().min(4).max(160),
  tailLen: z.number().min(2).max(200),
  variant: z.enum(["fluid", "gel", "hall_deck", "ceiling", "ring", "strip_vertical"]),
  ringR: z.number().min(8).max(1024),
  gaps: z.array(z.number().int().min(0)).max(64), // head indices removed (tank windows)
  tokens: BilayerTokens,
});
export type BilayerTileP = z.infer<typeof BilayerTileZ>;
const LIPID_TOKENS: BilayerTileP["tokens"] = {
  head: "stone.base",
  headLit: "stone.lit",
  headShade: "stone.shade",
  tail: "gold.base",
  core: "gold.deep",
  frost: "haze",
  inlay: "inlay.navy",
  stud: "gold.hi",
};

export const bilayerTile: KitGenerator<BilayerTileP> = {
  name: "bilayerTile",
  schema: BilayerTileZ,
  defaults: { w: 512, headR: 14, pitch: 32, tailLen: 34, variant: "fluid", ringR: 120, gaps: [], tokens: LIPID_TOKENS },
  generate(p, seed): KitResult {
    const r = rng(seed);
    const ids = new Ids("bl");
    const t = p.tokens;
    const R = p.headR;
    const L = p.tailLen;
    const H = 2 * (2 * R + L);
    let defs = "";
    const headG = radial(ids, [[0, t.headLit], [0.6, t.head], [1, t.headShade]], 0.5, 0.5, 0.55, false, 0.35, 0.3);
    defs += headG.def;
    const gel = p.variant === "gel";
    const tailPath = (x: number, y0: number, y1: number) => {
      const dir = y1 > y0 ? 1 : -1;
      let d = "";
      for (const off of [-R * 0.35, R * 0.35]) {
        if (gel) d += `M${n(x + off)} ${n(y0)}V${n(y1)}`;
        else {
          const a = r.range(2, R * 0.35);
          d += `M${n(x + off)} ${n(y0)}c${n(a)} ${n(dir * L * 0.3)} ${n(-a)} ${n(dir * L * 0.6)} ${n(r.range(-a, a))} ${n(y1 - y0)}`;
        }
      }
      return d;
    };
    if (p.variant === "ring") {
      const S = 2 * (p.ringR + R + 2);
      const c = S / 2;
      const circ = 2 * Math.PI * p.ringR;
      const count = Math.max(6, Math.round(circ / p.pitch));
      const innerR = p.ringR - H + 2 * R;
      let heads = "";
      let tails = "";
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const [cx, cy] = [Math.cos(a), Math.sin(a)];
        heads += circleD(c + cx * p.ringR, c + cy * p.ringR, R);
        tails += `M${n(c + cx * (p.ringR - R))} ${n(c + cy * (p.ringR - R))}L${n(c + cx * (p.ringR - R - L))} ${n(c + cy * (p.ringR - R - L))}`;
      }
      const inCount = Math.max(4, Math.round((2 * Math.PI * Math.max(innerR, R * 2)) / p.pitch));
      for (let i = 0; i < inCount && innerR > R; i++) {
        const a = (i / inCount) * Math.PI * 2;
        heads += circleD(c + Math.cos(a) * innerR, c + Math.sin(a) * innerR, R * 0.9);
      }
      let body = el("path", { d: circleD(c, c, p.ringR - R) + (innerR > R ? circleD(c, c, innerR + R) : ""), fill: tk(t.core), "fill-opacity": 0.55, "fill-rule": "evenodd" });
      body += el("path", { d: tails, stroke: tk(t.tail), "stroke-width": Math.max(1.5, R * 0.3), fill: "none" });
      body += el("path", { d: heads, fill: headG.ref });
      return result(S, S, defs, body, { pivot: [0.5, 0.5], anchors: { surface: [Math.round(c), Math.round(c - p.ringR - R)] } });
    }
    const W = p.w;
    const count = Math.max(1, Math.round(W / p.pitch));
    const pitch = W / count;
    const gaps = new Set(p.gaps);
    let heads = "";
    let tails = "";
    for (let i = 0; i < count; i++) {
      const x = i * pitch + pitch / 2;
      if (!gaps.has(i)) {
        heads += circleD(x, R, R);
        tails += tailPath(x, 2 * R, 2 * R + L);
      }
      const xb = x + (p.variant === "hall_deck" ? 0 : pitch / 2);
      const xbs = xb > W ? [xb - W] : [xb];
      for (const bx of xbs) {
        heads += circleD(bx, H - R, R);
        tails += tailPath(bx, H - 2 * R, H - 2 * R - L);
      }
    }
    let body = el("path", { d: rectD(0, 2 * R, W, H - 4 * R), fill: tk(t.core), "fill-opacity": 0.5 });
    body += el("path", { d: tails, stroke: tk(t.tail), "stroke-width": Math.max(1.5, R * 0.28), "stroke-linecap": "round", fill: "none" });
    body += el("path", { d: heads, fill: headG.ref });
    if (gel) body += el("path", { d: rectD(0, 0, W, H), fill: tk(t.frost), "fill-opacity": 0.28 });
    if (p.variant === "hall_deck") {
      body += el("path", { d: rectD(0, H / 2 - 3, W, 6), fill: tk(t.inlay) });
      let studs = "";
      for (let i = 0; i < count; i += 2) studs += circleD(i * pitch + pitch / 2, H / 2, 2.5);
      body += el("path", { d: studs, fill: tk(t.stud) });
    }
    if (p.variant === "ceiling") body = el("g", { transform: `translate(0 ${n(H)}) scale(1 -1)` }, body);
    if (p.variant === "strip_vertical") {
      return result(H, W, defs, el("g", { transform: `translate(${n(H)} 0) rotate(90)` }, body), { pivot: [0, 0], anchors: { surface: [0, Math.round(W / 2)] } });
    }
    return result(W, H, defs, body, { pivot: [0, 0], tileWidth: W, anchors: { surface: [Math.round(W / 2), 0] } });
  },
};

// ── lipidColonnade ─────────────────────────────────────────────────────────────────────────────────────────
export const LipidColonnadeZ = z.strictObject({
  w: z.number().int().min(64).max(4096),
  h: z.number().int().min(32).max(2048),
  swell: z.number().min(0).max(1), // 0 flat .. 1 hill
  rows: z.union([z.literal(1), z.literal(2)]),
  saplings: z.number().int().min(0).max(40),
  scale: z.number().min(0.2).max(2), // 0.6 on L3
  tokens: BilayerTokens.extend({ sapling: TokZ }),
});
export type LipidColonnadeP = z.infer<typeof LipidColonnadeZ>;

export const lipidColonnade: KitGenerator<LipidColonnadeP> = {
  name: "lipidColonnade",
  schema: LipidColonnadeZ,
  defaults: { w: 2048, h: 520, swell: 0.5, rows: 2, saplings: 8, scale: 1, tokens: { ...LIPID_TOKENS, sapling: "foliage.salmon" } },
  generate(p, seed): KitResult {
    const r = rng(seed);
    const ids = new Ids("lc");
    const t = p.tokens;
    const { w, h } = p;
    let defs = "";
    let body = "";
    const ground = (x: number) => h - h * 0.12 - h * 0.22 * p.swell * (0.5 - 0.5 * Math.cos((2 * Math.PI * x) / w));
    const headG = radial(ids, [[0, t.headLit], [0.6, t.head], [1, t.headShade]], 0.5, 0.5, 0.55, false, 0.35, 0.3);
    defs += headG.def;
    const shaftG = linear(ids, [[0, `${t.tail}|light:0.25`], [0.5, t.tail], [1, t.core]], 0, 0, 1, 0);
    defs += shaftG.def;
    for (let row = p.rows - 1; row >= 0; row--) {
      const s = p.scale * (row === 1 ? 0.7 : 1);
      const R = 26 * s;
      const spacing = R * 4.2;
      const count = Math.max(1, Math.round(w / spacing));
      const sp = w / count;
      let heads = "";
      let shafts = "";
      for (let i = 0; i < count; i++) {
        const x = i * sp + sp / 2 + (row === 1 ? sp / 2 : 0);
        const gx = ground(x % w) - (row === 1 ? h * 0.04 : 0);
        const ht = r.range(h * 0.45, h * 0.7) * s;
        for (const cx of x - R > w ? [x - w] : x + R > w ? [x, x - w] : [x]) {
          shafts += roundRectD(cx - R * 0.55, gx - ht, R * 0.45, ht, R * 0.2) + roundRectD(cx + R * 0.1, gx - ht, R * 0.45, ht, R * 0.2);
          heads += circleD(cx, gx - ht - R * 0.7, R);
        }
      }
      const g = el("path", { d: shafts, fill: shaftG.ref }) + el("path", { d: heads, fill: headG.ref });
      body += row === 1 ? el("g", { opacity: 0.75 }, g) : g;
    }
    const hill: Pt[] = [];
    for (let i = 0; i <= 64; i++) hill.push([(i / 64) * w, ground((i / 64) * w)]);
    const hg = linear(ids, [[0, t.head], [1, t.headShade]], 0, 0, 0, 1);
    defs += hg.def;
    body += el("path", { d: poly([...hill, [w, h], [0, h]]), fill: hg.ref });
    body += el("path", { d: poly(hill, false), stroke: tk(t.headLit), "stroke-width": 3, fill: "none" });
    let sap = "";
    for (let i = 0; i < p.saplings; i++) {
      const x = r.range(8, w - 8);
      const gy = ground(x);
      const k = r.int(2, 4);
      sap += `M${n(x)} ${n(gy)}v${n(-k * 9)}`;
      for (let j = 1; j <= k; j++) sap += circleD(x + (j % 2 ? 4 : -4), gy - j * 9, 3.5);
    }
    body += el("path", { d: sap, fill: tk(t.sapling), stroke: tk(t.sapling), "stroke-width": 1.5 });
    return result(w, h, defs, body, { pivot: [0, 1], tileWidth: w });
  },
};

// ── molecule ───────────────────────────────────────────────────────────────────────────────────────────────
export const MoleculeZ = z.strictObject({
  shape: z.enum(["spheres", "hex_ring", "fused_rings", "drop", "cube", "dot", "cell"]),
  atoms: z.array(z.strictObject({ dx: z.number(), dy: z.number(), r: z.number().min(0.5).max(400), tok: TokZ })).min(1).max(24),
  charge: z.enum(["+", "−"]).nullable(), // drawn as paths
  outline: TokZ.nullable(),
  lit: z.boolean(),
  cell: z.strictObject({ wall: TokZ.nullable(), fill: TokZ, nucleus: TokZ.nullable() }).nullable(),
});
export type MoleculeP = z.infer<typeof MoleculeZ>;

export const molecule: KitGenerator<MoleculeP> = {
  name: "molecule",
  schema: MoleculeZ,
  defaults: {
    shape: "spheres",
    atoms: [
      { dx: -9, dy: 0, r: 11, tok: "crystal.base" },
      { dx: 9, dy: 0, r: 11, tok: "crystal.base" },
    ],
    charge: null,
    outline: "inlay.navy",
    lit: true,
    cell: null,
  },
  generate(p): KitResult {
    const ids = new Ids("mo");
    const pad = 2 + (p.outline ? 1.5 : 0);
    const minX = Math.min(...p.atoms.map((a) => a.dx - a.r)) - pad;
    const minY = Math.min(...p.atoms.map((a) => a.dy - a.r)) - pad;
    const maxX = Math.max(...p.atoms.map((a) => a.dx + a.r)) + pad + (p.charge ? 8 : 0);
    const maxY = Math.max(...p.atoms.map((a) => a.dy + a.r)) + pad;
    const W = maxX - minX;
    const H = maxY - minY;
    const at = p.atoms.map((a) => ({ ...a, x: a.dx - minX, y: a.dy - minY }));
    let defs = "";
    let body = "";
    const sw = Math.max(1, Math.min(...p.atoms.map((a) => a.r)) * 0.14);
    const outline = p.outline ? { stroke: tk(p.outline), "stroke-width": sw } : {};
    if (p.shape === "hex_ring" || p.shape === "fused_rings") {
      body += el("path", { d: poly(at.map((a) => [a.x, a.y] as const), p.shape === "hex_ring"), fill: "none", stroke: tk(p.outline ?? at[0].tok), "stroke-width": Math.max(2, at[0].r * 0.5), "stroke-linejoin": "round" });
    }
    if (p.shape === "cell" && p.cell) {
      const a = at[0];
      if (p.cell.wall) body += el("path", { d: roundRectD(a.x - a.r, a.y - a.r * 0.8, a.r * 2, a.r * 1.6, a.r * 0.35), fill: tk(p.cell.wall) });
      const g = radial(ids, [[0, `${p.cell.fill}|light:0.3`], [0.7, p.cell.fill], [1, `${p.cell.fill}|dim:0.25`]], 0.5, 0.5, 0.6, false, 0.35, 0.3);
      defs += g.def;
      body += el("path", { d: blobD([[a.x - a.r * 0.85, a.y], [a.x - a.r * 0.5, a.y - a.r * 0.62], [a.x + a.r * 0.4, a.y - a.r * 0.66], [a.x + a.r * 0.88, a.y - a.r * 0.05], [a.x + a.r * 0.5, a.y + a.r * 0.6], [a.x - a.r * 0.45, a.y + a.r * 0.64]]), fill: g.ref, ...outline });
      if (p.cell.nucleus) body += el("path", { d: circleD(a.x + a.r * 0.15, a.y - a.r * 0.05, a.r * 0.28), fill: tk(p.cell.nucleus) });
    } else if (p.shape === "drop") {
      const a = at[0];
      body += el("path", { d: `M${n(a.x)} ${n(a.y - a.r)}C${n(a.x + a.r * 0.4)} ${n(a.y - a.r * 0.3)} ${n(a.x + a.r * 0.8)} ${n(a.y + a.r * 0.1)} ${n(a.x + a.r * 0.8)} ${n(a.y + a.r * 0.35)}A${n(a.r * 0.8)} ${n(a.r * 0.62)} 0 0 1 ${n(a.x - a.r * 0.8)} ${n(a.y + a.r * 0.35)}C${n(a.x - a.r * 0.8)} ${n(a.y + a.r * 0.1)} ${n(a.x - a.r * 0.4)} ${n(a.y - a.r * 0.3)} ${n(a.x)} ${n(a.y - a.r)}Z`, fill: tk(a.tok), ...outline });
    } else if (p.shape === "cube") {
      const a = at[0];
      const s = a.r * 0.8;
      body += el("path", { d: poly([[a.x - s, a.y - s * 0.4], [a.x, a.y - s], [a.x + s, a.y - s * 0.4], [a.x, a.y + s * 0.2]]), fill: tk(`${a.tok}|light:0.3`), ...outline });
      body += el("path", { d: poly([[a.x - s, a.y - s * 0.4], [a.x, a.y + s * 0.2], [a.x, a.y + s], [a.x - s, a.y + s * 0.4]]), fill: tk(a.tok), ...outline });
      body += el("path", { d: poly([[a.x + s, a.y - s * 0.4], [a.x, a.y + s * 0.2], [a.x, a.y + s], [a.x + s, a.y + s * 0.4]]), fill: tk(`${a.tok}|dim:0.3`), ...outline });
    } else {
      for (const a of at) {
        const rr = a.r;
        if (p.lit) {
          const g = radial(ids, [[0, `${a.tok}|light:0.45`], [0.6, a.tok], [1, `${a.tok}|dim:0.3`]], 0.5, 0.5, 0.6, false, 0.33, 0.3);
          defs += g.def;
          body += el("path", { d: circleD(a.x, a.y, rr), fill: g.ref, ...outline });
        } else body += el("path", { d: circleD(a.x, a.y, rr), fill: tk(a.tok), ...outline });
      }
    }
    if (p.charge) {
      const a = at[0];
      const cx = Math.min(W - 5, a.x + a.r * 0.8 + 3);
      const cy = Math.max(5, a.y - a.r * 0.8);
      const d = p.charge === "+" ? rectD(cx - 4, cy - 1, 8, 2) + rectD(cx - 1, cy - 4, 2, 8) : rectD(cx - 4, cy - 1, 8, 2);
      body += el("path", { d, fill: tk(p.outline ?? "inlay.navy") });
    }
    return result(W, H, defs, body, { pivot: [0.5, 0.5], anchors: { center: [Math.round(-minX), Math.round(-minY)] } });
  },
};

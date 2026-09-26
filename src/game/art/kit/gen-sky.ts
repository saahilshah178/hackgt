/**
 * Sky and atmosphere generators (02 §3a.2): skyWash, cloudBand.
 */
import { z } from "zod";
import { rng, type Rng } from "./rng";
import { blur, linear } from "./shade";
import { blobD, el, Ids, n, rectD, result, roundRectD, tk, type Pt } from "./svg";
import { TokZ, type KitGenerator, type KitResult } from "./types";

// ── skyWash ────────────────────────────────────────────────────────────────────────────────────────────────
export const SkyWashZ = z.strictObject({
  h: z.number().int().min(64).max(4320),
  stops: z.array(TokZ).min(3).max(4), // top → horizon
  at: z.array(z.number().min(0).max(1)).min(3).max(4), // stop offsets
  dither: z.number().min(0).max(0.05), // seeded 16×16 dot pattern, not a filter
});
export type SkyWashP = z.infer<typeof SkyWashZ>;

export const skyWash: KitGenerator<SkyWashP> = {
  name: "skyWash",
  schema: SkyWashZ.refine((p) => p.at.length === p.stops.length, "at[] must match stops[]"),
  defaults: { h: 1080, stops: ["sky.day.top", "sky.day.mid", "sky.day.horizon"], at: [0, 0.55, 1], dither: 0.02 },
  generate(p, seed): KitResult {
    const ids = new Ids("sw");
    const W = 64;
    let defs = "";
    let body = "";
    const ys = p.at.map((a) => a * p.h);
    // above the first stop and below the last: solid bands
    if (ys[0] > 0) body += el("path", { d: rectD(0, 0, W, ys[0] + 0.5), fill: tk(p.stops[0]) });
    for (let i = 0; i < p.stops.length - 1; i++) {
      const y0 = ys[i];
      const y1 = ys[i + 1];
      if (y1 <= y0) continue;
      const g = linear(ids, [[0, p.stops[i]], [1, p.stops[i + 1]]], 0, y0, 0, y1, true);
      defs += g.def;
      body += el("path", { d: rectD(0, y0 - 0.5, W, y1 - y0 + 1), fill: g.ref });
    }
    const last = ys[ys.length - 1];
    if (last < p.h) body += el("path", { d: rectD(0, last - 0.5, W, p.h - last + 0.5), fill: tk(p.stops[p.stops.length - 1]) });
    if (p.dither > 0) {
      const r = rng(seed);
      let lite = "";
      let dark = "";
      for (let i = 0; i < 14; i++) {
        const x = r.int(0, 15);
        const y = r.int(0, 15);
        if (i % 2 === 0) lite += rectD(x, y, 1, 1);
        else dark += rectD(x, y, 1, 1);
      }
      const pid = ids.next("pt");
      defs += el(
        "pattern",
        { id: pid, patternUnits: "userSpaceOnUse", width: 16, height: 16 },
        el("path", { d: lite, fill: tk("haze"), "fill-opacity": p.dither * 4 }) + el("path", { d: dark, fill: tk("shadow"), "fill-opacity": p.dither * 3 }),
      );
      body += el("path", { d: rectD(0, 0, W, p.h), fill: `url(#${pid})` });
    }
    return result(W, p.h, defs, body, { pivot: [0, 0], tileWidth: W });
  },
};

// ── cloudBand ──────────────────────────────────────────────────────────────────────────────────────────────
export const CloudBandZ = z.strictObject({
  w: z.number().int().min(128).max(4096),
  h: z.number().int().min(32).max(1080),
  style: z.enum(["lozenge", "puff", "fog", "swirl"]),
  count: z.number().int().min(1).max(40),
  lobe: z.tuple([z.number().min(2).max(400), z.number().min(2).max(400)]), // radius range
  fill: TokZ,
  under: TokZ.nullable(), // lavender underside
  alpha: z.number().min(0).max(1),
  blur: z.number().min(0).max(8),
});
export type CloudBandP = z.infer<typeof CloudBandZ>;

/** Draw a shape at x and at x ± w when it crosses an edge, so the strip wraps seamlessly. */
function wrapCopies(x: number, halfW: number, w: number): number[] {
  const xs = [x];
  if (x - halfW < 0) xs.push(x + w);
  if (x + halfW > w) xs.push(x - w);
  return xs;
}

function puffOutline(r: Rng, cx: number, base: number, lobe: [number, number]): Pt[] {
  const k = r.int(4, 7);
  const lobes: Array<{ x: number; y: number; r: number }> = [];
  let x = cx - (k * lobe[1]) / 2;
  for (let i = 0; i < k; i++) {
    const rr = r.range(lobe[0], lobe[1]) * (i === 0 || i === k - 1 ? 0.7 : 1);
    lobes.push({ x: x + rr, y: base - rr * r.range(0.55, 0.95), r: rr });
    x += rr * r.range(1.1, 1.5);
  }
  const pts: Pt[] = [];
  const left = lobes[0].x - lobes[0].r;
  const right = lobes[k - 1].x + lobes[k - 1].r;
  pts.push([left, base]);
  for (const l of lobes) {
    for (let a = 200; a <= 340; a += 35) {
      const rad = (a * Math.PI) / 180;
      pts.push([l.x + Math.cos(rad) * l.r, Math.min(base, l.y + Math.sin(rad) * l.r)]);
    }
  }
  pts.push([right, base]);
  return pts;
}

export const cloudBand: KitGenerator<CloudBandP> = {
  name: "cloudBand",
  schema: CloudBandZ,
  defaults: { w: 2048, h: 240, style: "lozenge", count: 7, lobe: [18, 34], fill: "stone.lit", under: null, alpha: 0.85, blur: 1.5 },
  generate(p, seed): KitResult {
    const r = rng(seed);
    const ids = new Ids("cb");
    let defs = "";
    let under = "";
    let top = "";
    const tile = p.style !== "fog";
    const lobeMax = Math.max(p.lobe[0], p.lobe[1]);
    const lobeMin = Math.min(p.lobe[0], p.lobe[1]);
    const lobe: [number, number] = [lobeMin, lobeMax];
    if (p.style === "lozenge") {
      for (let i = 0; i < p.count; i++) {
        const t = lobe[0] + r.next() * (lobe[1] - lobe[0]);
        const len = t * r.range(4, 9);
        const cx = ((i + r.range(0.1, 0.9)) / p.count) * p.w;
        const cy = r.range(t * 1.2, Math.max(t * 1.3, p.h - t * 1.4));
        // a lozenge = one long capsule + (usually) a shorter capsule stacked above it; offsets are relative to cx so
        // every wrap copy is an exact translation
        const parts: Array<[number, number, number, number]> = [[-len / 2, cy, len, t]];
        if (r.chance(0.7)) parts.push([-len * 0.3 + r.jitter(0, len * 0.1), cy - t * 0.62, len * r.range(0.45, 0.7), t * 0.9]);
        for (const x of wrapCopies(cx, len / 2 + t, p.w)) {
          for (const [dx, py, pw, ph] of parts) {
            const px = x + dx;
            under += el("path", { d: roundRectD(px, py - ph / 2 + ph * 0.22, pw, ph, ph / 2) });
            top += el("path", { d: roundRectD(px, py - ph / 2, pw, ph * 0.86, ph / 2) });
          }
        }
      }
    } else if (p.style === "puff") {
      for (let i = 0; i < p.count; i++) {
        const cx = ((i + r.range(0.15, 0.85)) / p.count) * p.w;
        const base = r.range(p.h * 0.55, p.h * 0.92);
        const outline = puffOutline(r, cx, base, lobe);
        const halfW = Math.max(...outline.map((q) => Math.abs(q[0] - cx)));
        for (const x of wrapCopies(cx, halfW, p.w)) {
          const shifted = outline.map(([qx, qy]) => [qx + (x - cx), qy] as const);
          under += el("path", { d: blobD(shifted.map(([qx, qy]) => [qx, qy + lobe[0] * 0.28] as const)) });
          top += el("path", { d: blobD(shifted) });
        }
      }
    } else if (p.style === "fog") {
      const g = linear(ids, [[0, p.fill, 0], [0.5, p.fill, 1], [1, p.fill, 0]], 0, 0, 1, 0);
      defs += g.def;
      const pts: Pt[] = [];
      const steps = Math.max(6, p.count * 2);
      for (let i = 0; i <= steps; i++) pts.push([(i / steps) * p.w, p.h * 0.5 - r.range(0.15, 0.42) * p.h]);
      for (let i = steps; i >= 0; i--) pts.push([(i / steps) * p.w, p.h * 0.5 + r.range(0.12, 0.35) * p.h]);
      top += el("path", { d: blobD(pts), fill: g.ref });
    } else {
      // swirl: curled strokes (cell fluid currents)
      for (let i = 0; i < p.count; i++) {
        const cx = ((i + r.range(0.1, 0.9)) / p.count) * p.w;
        const cy = r.range(p.h * 0.25, p.h * 0.75);
        const rad = r.range(lobe[0], lobe[1]);
        for (const x of wrapCopies(cx, rad * 3, p.w)) {
          let d = `M${n(x - rad * 3)} ${n(cy + rad * 0.2)}`;
          d += `C${n(x - rad * 1.5)} ${n(cy - rad * 0.4)} ${n(x - rad * 0.2)} ${n(cy - rad * 0.9)} ${n(x + rad * 0.6)} ${n(cy - rad * 0.5)}`;
          d += `C${n(x + rad * 1.2)} ${n(cy - rad * 0.2)} ${n(x + rad * 0.9)} ${n(cy + rad * 0.6)} ${n(x + rad * 0.2)} ${n(cy + rad * 0.4)}`;
          d += `C${n(x - rad * 0.2)} ${n(cy + rad * 0.3)} ${n(x - rad * 0.1)} ${n(cy)} ${n(x + rad * 0.25)} ${n(cy + rad * 0.02)}`;
          top += el("path", { d, fill: "none", stroke: "CUR", "stroke-width": Math.max(2, rad * 0.22), "stroke-linecap": "round" });
          if (p.under) under += el("path", { d, fill: "none", stroke: "CUR", "stroke-width": Math.max(2, rad * 0.22), "stroke-linecap": "round", transform: `translate(0 ${n(rad * 0.18)})` });
        }
      }
    }
    const f = p.blur > 0 ? blur(ids, p.blur) : null;
    if (f) defs += f.def;
    const paint = (s: string, tok: string) => s.replace(/stroke="CUR"/g, `stroke="${tk(tok)}"`);
    let body = "";
    if (p.under && under) body += el("g", { fill: p.style === "swirl" ? null : tk(p.under) }, paint(under, p.under));
    if (top) body += el("g", { fill: p.style === "swirl" || p.style === "fog" ? null : tk(p.fill) }, paint(top, p.fill));
    body = el("g", { opacity: p.alpha < 1 ? p.alpha : null, filter: f?.ref ?? null }, body);
    return result(p.w, p.h, defs, body, { pivot: [0, 0], tileWidth: tile ? p.w : null });
  },
};

/**
 * Composition generators (02 §3a.2): compose (hand-placed children) and scatter (seeded placement of variants).
 * Both nest other generators' output: children's ids are re-prefixed, anchors re-exported as `i<n>_<anchor>`,
 * engraving requests transformed, and a finish haze is applied to every child token.
 */
import { z } from "zod";
import { runKit } from "./registry";
import { rng, subSeed } from "./rng";
import { el, hazeTokens, n, reprefixIds, result, splitDoc } from "./svg";
import { FinishZ, KitNameZ, type EngraveReq, type KitGenerator, type KitResult } from "./types";

const ID_OK = /^[a-z][a-z0-9_]{0,47}$/;

export const ComposeItemZ = z.strictObject({
  gen: KitNameZ,
  params: z.unknown(),
  seed: z.number().int().min(0).max(4_294_967_295).nullable(),
  x: z.number(), // where the child's pivot lands
  y: z.number(),
  scale: z.number().min(0.01).max(16),
  flip: z.boolean(),
  alpha: z.number().min(0).max(1),
});
export type ComposeItem = z.infer<typeof ComposeItemZ>;
export const ComposeZ = z.strictObject({
  w: z.number().min(1).max(8192),
  h: z.number().min(1).max(4096),
  tileWidth: z.number().min(16).max(8192).nullable(),
  items: z.array(ComposeItemZ).max(64),
  finish: FinishZ,
});
export type ComposeP = z.infer<typeof ComposeZ>;

interface Placed {
  child: KitResult;
  x: number;
  y: number;
  s: number;
  flip: boolean;
}
function transformOf(pl: Placed): string {
  const { child: c, x, y, s, flip } = pl;
  const ty = y - c.pivot[1] * c.h * s;
  return flip ? `translate(${n(x + c.pivot[0] * c.w * s)} ${n(ty)}) scale(${-s} ${s})` : `translate(${n(x - c.pivot[0] * c.w * s)} ${n(ty)}) scale(${s})`;
}
function mapPoint(pl: Placed, [ax, ay]: readonly [number, number]): [number, number] {
  const { child: c, x, y, s, flip } = pl;
  const lx = flip ? x + (c.pivot[0] * c.w - ax) * s : x + (ax - c.pivot[0] * c.w) * s;
  return [lx, y + (ay - c.pivot[1] * c.h) * s];
}
/** x positions an instance must be drawn at so a strip of width `tile` wraps seamlessly. */
function wrapXs(pl: Placed, tile: number | null): number[] {
  if (tile === null) return [pl.x];
  const left = pl.x - pl.child.pivot[0] * pl.child.w * pl.s;
  const right = left + pl.child.w * pl.s;
  const xs = [pl.x];
  if (left < 0) xs.push(pl.x + tile);
  if (right > tile) xs.push(pl.x - tile);
  return xs;
}

export const compose: KitGenerator<ComposeP> = {
  name: "compose",
  schema: ComposeZ,
  defaults: { w: 2048, h: 600, tileWidth: 2048, items: [], finish: { ao: false, rim: false, haze: 0 } },
  generate(p, seed): KitResult {
    let defs = "";
    let body = "";
    const anchors: Record<string, [number, number]> = {};
    const engrave: EngraveReq[] = [];
    p.items.forEach((it, i) => {
      const child = runKit(it.gen, it.params, it.seed ?? subSeed(seed, i));
      const svg = reprefixIds(hazeTokens(child.svg, p.finish.haze), `c${i}_`);
      const { defs: cd, body: cb } = splitDoc(svg);
      defs += cd;
      const base: Placed = { child, x: it.x, y: it.y, s: it.scale, flip: it.flip };
      for (const x of wrapXs(base, p.tileWidth)) {
        body += el("g", { transform: transformOf({ ...base, x }), opacity: it.alpha < 1 ? it.alpha : null }, cb);
      }
      for (const [name, pt] of Object.entries(child.anchors)) {
        const key = `i${i}_${name}`;
        if (ID_OK.test(key)) anchors[key] = mapPoint(base, pt).map((v) => Math.round(v)) as [number, number];
      }
      for (const e of child.engrave) {
        const [ex, ey] = mapPoint(base, [e.x, e.y]);
        engrave.push({ ...e, id: `i${i}_${e.id}`, x: ex, y: ey, size: e.size * it.scale });
      }
    });
    return result(p.w, p.h, defs, body, { pivot: [0, 1], anchors, tileWidth: p.tileWidth, engrave });
  },
};

// ── scatter ────────────────────────────────────────────────────────────────────────────────────────────────
export const ScatterZ = z.strictObject({
  w: z.number().min(1).max(8192),
  h: z.number().min(1).max(4096),
  tileWidth: z.number().min(16).max(8192),
  item: z.strictObject({ gen: KitNameZ, params: z.unknown() }),
  count: z.number().int().min(1).max(200),
  variants: z.number().int().min(1).max(12), // distinct seeds
  band: z.tuple([z.number(), z.number()]), // y of bases
  minGap: z.number().min(0),
  scale: z.tuple([z.number().min(0.01), z.number().min(0.01)]),
  flipChance: z.number().min(0).max(1),
  finish: FinishZ,
});
export type ScatterP = z.infer<typeof ScatterZ>;

export const scatter: KitGenerator<ScatterP> = {
  name: "scatter",
  schema: ScatterZ,
  defaults: {
    w: 2048,
    h: 640,
    tileWidth: 2048,
    item: { gen: "crystalCluster", params: {} },
    count: 9,
    variants: 3,
    band: [560, 640],
    minGap: 120,
    scale: [0.7, 1.2],
    flipChance: 0.5,
    finish: { ao: false, rim: false, haze: 0.2 },
  },
  generate(p, seed): KitResult {
    const r = rng(seed);
    let defs = "";
    let body = "";
    const variants: KitResult[] = [];
    for (let v = 0; v < p.variants; v++) {
      const child = runKit(p.item.gen, p.item.params, subSeed(seed, `v${v}`));
      const svg = reprefixIds(hazeTokens(child.svg, p.finish.haze), `v${v}_`);
      const { defs: cd, body: cb } = splitDoc(svg);
      defs += cd + el("g", { id: `v${v}_g` }, cb);
      variants.push(child);
    }
    // place bases with a cyclic minimum gap (rejection sampling, bounded tries)
    const xs: number[] = [];
    for (let tries = 0; xs.length < p.count && tries < p.count * 40; tries++) {
      const x = r.range(0, p.tileWidth);
      const ok = xs.every((o) => {
        const d = Math.abs(o - x);
        return Math.min(d, p.tileWidth - d) >= p.minGap;
      });
      if (ok) xs.push(x);
    }
    const placed = xs.map((x, i) => ({
      v: i % p.variants,
      x,
      y: r.range(Math.min(...p.band), Math.max(...p.band)),
      s: r.range(Math.min(...p.scale), Math.max(...p.scale)),
      flip: r.chance(p.flipChance),
    }));
    placed.sort((a, b) => a.y - b.y); // further back (higher up) first
    for (const pl of placed) {
      const child = variants[pl.v];
      const base: Placed = { child, x: pl.x, y: pl.y, s: pl.s, flip: pl.flip };
      for (const x of wrapXs(base, p.tileWidth)) body += el("use", { href: `#v${pl.v}_g`, transform: transformOf({ ...base, x }) });
    }
    return result(p.w, p.h, defs, body, { pivot: [0, 1], tileWidth: p.tileWidth });
  },
};

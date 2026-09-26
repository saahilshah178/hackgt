/**
 * Architecture generators (02 §3a.2): column, arch, ringStack, brickWall, ashlarWall, stairs, railing, awning,
 * facade, truss, shelving.
 */
import { z } from "zod";
import { rng } from "./rng";
import { aoFoot, contactShadow, linear, radial, rampCyl, rampDiag, rampV, rimStroke } from "./shade";
import { circleD, el, hz, Ids, n, poly, rectD, result, roundRectD, splitDoc, tk, type Pt } from "./svg";
import { FinishZ, RampZ, TokZ, type EngraveReq, type Finish, type KitGenerator, type KitResult, type Ramp } from "./types";

const STONE: Ramp = { lit: "stone.lit", base: "stone.base", shade: "stone.shade" };
const T = (tok: string, f: Finish) => tk(hz(tok, f.haze));

// ── column ─────────────────────────────────────────────────────────────────────────────────────────────────
export const ColumnZ = z.strictObject({
  w: z.number().min(4).max(1024),
  h: z.number().min(8).max(2048),
  style: z.enum(["stone", "cast_iron", "pole", "lamp_post", "pylon"]),
  flutes: z.union([z.literal(0), z.literal(3), z.literal(5), z.literal(7)]),
  capital: z.enum(["band", "scroll", "lotus", "crossarm", "none"]),
  base: z.enum(["plinth", "step", "buried"]),
  bands: z.number().int().min(0).max(8),
  broken: z.number().min(0).max(0.6), // 0..0.6 of the top missing
  socket: z.boolean(),
  ramp: RampZ,
  trim: TokZ,
  inlay: TokZ,
  finish: FinishZ,
});
export type ColumnP = z.infer<typeof ColumnZ>;

export const column: KitGenerator<ColumnP> = {
  name: "column",
  schema: ColumnZ,
  defaults: {
    w: 120,
    h: 540,
    style: "stone",
    flutes: 5,
    capital: "band",
    base: "plinth",
    bands: 2,
    broken: 0,
    socket: false,
    ramp: STONE,
    trim: "gold.base",
    inlay: "inlay.navy",
    finish: { ao: true, rim: true, haze: 0 },
  },
  generate(p, seed): KitResult {
    const r = rng(seed);
    const ids = new Ids("co");
    const f = p.finish;
    const { w, h } = p;
    let defs = "";
    let body = "";
    const anchors: Record<string, [number, number]> = {};
    const thin = p.style === "pole" || p.style === "lamp_post" || p.style === "cast_iron";
    const sw = thin ? w * 0.28 : p.style === "pylon" ? w * 0.62 : w * 0.72;
    const cx = w / 2;
    const baseH = p.base === "plinth" ? h * 0.07 : p.base === "step" ? h * 0.1 : 0;
    const capH = p.capital === "none" || p.broken > 0 ? 0 : p.capital === "crossarm" ? h * 0.03 : h * 0.08;
    const topY = h * p.broken;
    const shaftTop = topY + capH;
    const shaftBot = h - baseH;
    const cyl = rampCyl(ids, p.ramp, f.haze);
    defs += cyl.def;
    // shaft (pylon tapers, broken columns get a jagged top)
    let shaft: Pt[];
    if (p.style === "pylon") shaft = [[cx - sw * 0.35, shaftTop], [cx + sw * 0.35, shaftTop], [cx + sw / 2, shaftBot], [cx - sw / 2, shaftBot]];
    else if (p.broken > 0) {
      shaft = [[cx - sw / 2, shaftBot], [cx - sw / 2, topY + r.range(10, 30)]];
      for (let i = 1; i < 6; i++) shaft.push([cx - sw / 2 + (i / 6) * sw, topY + r.range(0, 40)]);
      shaft.push([cx + sw / 2, topY + r.range(10, 30)], [cx + sw / 2, shaftBot]);
    } else shaft = [[cx - sw / 2, shaftTop], [cx + sw / 2, shaftTop], [cx + sw / 2, shaftBot], [cx - sw / 2, shaftBot]];
    body += el("path", { d: poly(shaft), fill: cyl.ref });
    if (p.flutes > 0 && !thin) {
      let d = "";
      for (let i = 0; i < p.flutes; i++) {
        const fx = cx - sw / 2 + ((i + 1) / (p.flutes + 1)) * sw;
        d += `M${n(fx)} ${n(shaftTop + (p.broken > 0 ? 40 : 6))}V${n(shaftBot - 4)}`;
      }
      body += el("path", { d, stroke: T(p.ramp.shade, f), "stroke-width": Math.max(1.5, sw / 28), "stroke-opacity": 0.55, fill: "none" });
      let lit = "";
      for (let i = 0; i < p.flutes; i++) {
        const fx = cx - sw / 2 + ((i + 1) / (p.flutes + 1)) * sw - Math.max(1.5, sw / 28);
        lit += `M${n(fx)} ${n(shaftTop + (p.broken > 0 ? 44 : 8))}V${n(shaftBot - 6)}`;
      }
      body += el("path", { d: lit, stroke: T(p.ramp.lit, f), "stroke-width": 1, "stroke-opacity": 0.5, fill: "none" });
    }
    if (p.style === "cast_iron" || p.style === "lamp_post") {
      let rings = "";
      for (let i = 1; i <= 3; i++) rings += rectD(cx - sw * 0.7, shaftBot - (i * (shaftBot - shaftTop)) / 4, sw * 1.4, Math.max(2, h * 0.008));
      body += el("path", { d: rings, fill: T(p.trim, f) });
    }
    // inlay bands with trim lines
    for (let i = 0; i < p.bands; i++) {
      const by = shaftTop + ((i + 1) / (p.bands + 1)) * (shaftBot - shaftTop) * 0.5 + (shaftBot - shaftTop) * 0.05;
      const bh = Math.max(4, h * 0.018);
      body += el("path", { d: rectD(cx - sw / 2, by, sw, bh), fill: T(p.inlay, f) });
      body += el("path", { d: rectD(cx - sw / 2, by - 1.5, sw, 1.5) + rectD(cx - sw / 2, by + bh, sw, 1.5), fill: T(p.trim, f) });
      anchors[`band_${i}`] = [Math.round(cx), Math.round(by + bh / 2)];
    }
    if (p.socket) {
      const sy = shaftTop + (shaftBot - shaftTop) * 0.12;
      const sr = Math.min(sw * 0.3, 22);
      const g = radial(ids, [[0, p.trim], [0.7, hz(p.trim, 0)], [1, `${p.trim}|dim:0.4`]], 0.35, 0.35, 0.7);
      defs += g.def;
      body += el("path", { d: circleD(cx, sy, sr), fill: g.ref });
      body += el("path", { d: circleD(cx, sy, sr * 0.55), fill: T(p.inlay, f) });
      anchors.socket = [Math.round(cx), Math.round(sy)];
    }
    // capital
    if (capH > 0) {
      if (p.capital === "band") {
        body += el("path", { d: rectD(0, topY, w, capH * 0.45), fill: T(p.ramp.lit, f) });
        body += el("path", { d: rectD(w * 0.06, topY + capH * 0.45, w * 0.88, capH * 0.2), fill: T(p.inlay, f) });
        body += el("path", { d: rectD(w * 0.04, topY + capH * 0.65, w * 0.92, capH * 0.35), fill: T(p.ramp.base, f) });
        body += el("path", { d: rectD(0, topY + capH * 0.43, w, 2) + rectD(w * 0.04, topY + capH * 0.63, w * 0.92, 2), fill: T(p.trim, f) });
      } else if (p.capital === "scroll") {
        body += el("path", { d: rectD(w * 0.1, topY, w * 0.8, capH * 0.35), fill: T(p.ramp.lit, f) });
        const vr = capH * 0.32;
        body += el("path", { d: circleD(w * 0.16, topY + capH * 0.6, vr) + circleD(w * 0.84, topY + capH * 0.6, vr), fill: T(p.ramp.base, f) });
        body += el("path", { d: circleD(w * 0.16, topY + capH * 0.6, vr * 0.45) + circleD(w * 0.84, topY + capH * 0.6, vr * 0.45), fill: T(p.trim, f) });
      } else if (p.capital === "lotus") {
        body += el("path", { d: poly([[cx - sw / 2, topY + capH], [0, topY], [w, topY], [cx + sw / 2, topY + capH]]), fill: T(p.ramp.lit, f) });
        body += el("path", { d: rectD(0, topY, w, 3), fill: T(p.trim, f) });
      } else if (p.capital === "crossarm") {
        body += el("path", { d: rectD(0, topY + capH * 0.2, w, capH * 0.6), fill: T(p.ramp.shade, f) });
        let ins = "";
        for (const fx of [0.1, 0.3, 0.7, 0.9]) ins += circleD(w * fx, topY + capH * 0.1, Math.max(1.5, capH * 0.35));
        body += el("path", { d: ins, fill: T(p.trim, f) });
      }
    }
    if (p.style === "lamp_post") {
      const lw = Math.min(w * 0.9, 40);
      const ly = shaftTop - lw * 1.3;
      body += el("path", { d: poly([[cx - lw * 0.35, ly + lw * 1.2], [cx - lw / 2, ly + lw * 0.3], [cx, ly], [cx + lw / 2, ly + lw * 0.3], [cx + lw * 0.35, ly + lw * 1.2]]), fill: T(p.trim, f) });
      body += el("path", { d: rectD(cx - lw * 0.28, ly + lw * 0.4, lw * 0.56, lw * 0.65), fill: tk("gold.hi"), "fill-opacity": 0.9 });
      anchors.lamp = [Math.round(cx), Math.round(ly + lw * 0.7)];
    }
    // base
    if (p.base === "plinth") {
      const g = rampDiag(ids, p.ramp, f.haze);
      defs += g.def;
      body += el("path", { d: rectD(w * 0.02, shaftBot, w * 0.96, baseH), fill: g.ref });
      body += el("path", { d: rectD(w * 0.02, shaftBot, w * 0.96, 2), fill: T(p.trim, f) });
    } else if (p.base === "step") {
      body += el("path", { d: rectD(w * 0.08, shaftBot, w * 0.84, baseH * 0.5), fill: T(p.ramp.base, f) });
      body += el("path", { d: rectD(0, shaftBot + baseH * 0.5, w, baseH * 0.5), fill: T(p.ramp.shade, f) });
      body += el("path", { d: rectD(w * 0.08, shaftBot, w * 0.84, 2) + rectD(0, shaftBot + baseH * 0.5, w, 2), fill: T(p.ramp.lit, f) });
    }
    body += rimStroke(shaft, p.ramp.lit, f, Math.max(1.2, sw / 50), 0.8);
    const ao = aoFoot(ids, rectD(0, h - h * 0.12, w, h * 0.12), h, h * 0.12, f);
    defs += ao.defs;
    body += ao.body;
    anchors.top = [Math.round(cx), Math.round(topY)];
    return result(w, h, defs, body, { anchors });
  },
};

// ── arch ───────────────────────────────────────────────────────────────────────────────────────────────────
export const ArchZ = z.strictObject({
  w: z.number().min(16).max(4096),
  h: z.number().min(16).max(2048),
  shape: z.enum(["round", "pointed", "flat", "arcade"]),
  bays: z.number().int().min(1).max(16),
  thickness: z.number().min(4).max(400),
  keystone: z.boolean(),
  recess: TokZ.nullable(), // dark doorway fill
  buried: z.number().min(0).max(0.8),
  ramp: RampZ,
  trim: TokZ,
  finish: FinishZ,
});
export type ArchP = z.infer<typeof ArchZ>;

function openingD(shape: "round" | "pointed" | "flat", x: number, y: number, w: number, h: number): string {
  const spring = shape === "flat" ? y : y + (shape === "round" ? w / 2 : w * 0.7);
  if (shape === "flat") return rectD(x, y, w, h);
  if (shape === "round") return `M${n(x)} ${n(y + h)}V${n(spring)}A${n(w / 2)} ${n(w / 2)} 0 0 1 ${n(x + w)} ${n(spring)}V${n(y + h)}Z`;
  return `M${n(x)} ${n(y + h)}V${n(spring)}Q${n(x)} ${n(y + w * 0.2)} ${n(x + w / 2)} ${n(y)}Q${n(x + w)} ${n(y + w * 0.2)} ${n(x + w)} ${n(spring)}V${n(y + h)}Z`;
}

export const arch: KitGenerator<ArchP> = {
  name: "arch",
  schema: ArchZ,
  defaults: { w: 360, h: 420, shape: "round", bays: 1, thickness: 44, keystone: true, recess: "inlay.navy.dark", buried: 0, ramp: STONE, trim: "gold.base", finish: { ao: true, rim: true, haze: 0 } },
  generate(p): KitResult {
    const ids = new Ids("ar");
    const f = p.finish;
    const { w, h } = p;
    let defs = "";
    let body = "";
    const anchors: Record<string, [number, number]> = {};
    const shape = p.shape === "arcade" ? "round" : p.shape;
    const bays = p.shape === "arcade" ? Math.max(2, p.bays) : p.bays;
    const t = p.thickness;
    const drop = h * p.buried;
    const bayW = (w - t) / bays;
    const ow = bayW - t;
    const oy = t + (shape === "flat" ? t * 0.4 : 0);
    const oh = h - oy + drop;
    const wall = rectD(0, 0, w, h);
    let holes = "";
    let recesses = "";
    for (let i = 0; i < bays; i++) {
      const ox = t + i * bayW;
      holes += openingD(shape, ox, oy + drop, ow, oh);
      recesses += openingD(shape, ox, oy + drop, ow, oh);
      anchors[`bay_${i}`] = [Math.round(ox + ow / 2), Math.round(h)];
    }
    const g = rampDiag(ids, p.ramp, f.haze);
    defs += g.def;
    if (p.recess) {
      const rg = linear(ids, [[0, hz(p.recess, f.haze)], [1, hz(`${p.recess}|light:0.2`, f.haze)]], 0, 0, 0, 1);
      defs += rg.def;
      body += el("path", { d: recesses, fill: rg.ref });
    }
    body += el("path", { d: wall + holes, fill: g.ref, "fill-rule": "evenodd" });
    // voussoirs: radial joints around each arch head
    if (shape !== "flat") {
      let joints = "";
      for (let i = 0; i < bays; i++) {
        const ox = t + i * bayW;
        const cx = ox + ow / 2;
        const cy = oy + drop + ow / 2;
        for (let k = 1; k < 9; k++) {
          const a = Math.PI + (k / 9) * Math.PI;
          joints += `M${n(cx + Math.cos(a) * (ow / 2))} ${n(cy + Math.sin(a) * (ow / 2))}L${n(cx + Math.cos(a) * (ow / 2 + t * 0.8))} ${n(cy + Math.sin(a) * (ow / 2 + t * 0.8))}`;
        }
      }
      body += el("path", { d: joints, stroke: T(p.ramp.shade, f), "stroke-width": 2, "stroke-opacity": 0.7, fill: "none" });
    }
    // inner reveal shadow on the right of each opening (light from the upper left)
    let reveal = "";
    for (let i = 0; i < bays; i++) {
      const ox = t + i * bayW;
      reveal += rectD(ox + ow - t * 0.25, oy + drop + (shape === "flat" ? 0 : ow / 2), t * 0.25, oh);
    }
    body += el("path", { d: reveal, fill: tk("shadow"), "fill-opacity": 0.3 });
    if (p.keystone && shape !== "flat") {
      for (let i = 0; i < bays; i++) {
        const cx = t + i * bayW + ow / 2;
        const ky = oy + drop - t * 0.05;
        const kw = t * 0.55;
        body += el("path", { d: poly([[cx - kw * 0.35, ky + t * 0.6], [cx - kw * 0.55, ky - t * 0.55], [cx + kw * 0.55, ky - t * 0.55], [cx + kw * 0.35, ky + t * 0.6]]), fill: T(p.trim, f) });
        if (i === 0) anchors.keystone = [Math.round(cx), Math.round(ky)];
      }
    }
    body += el("path", { d: rectD(0, 0, w, Math.max(3, t * 0.12)), fill: T(p.trim, f) });
    body += rimStroke([[0, h], [0, 0], [w, 0], [w, h]], p.ramp.lit, f, 2);
    const ao = aoFoot(ids, rectD(0, h * 0.88, w, h * 0.12), h, h * 0.12, f);
    defs += ao.defs;
    body += ao.body;
    anchors.door = [Math.round(t + ((bays - 1) / 2) * bayW + ow / 2), Math.round(h)];
    return result(w, h, defs, body, { anchors });
  },
};

// ── ringStack ──────────────────────────────────────────────────────────────────────────────────────────────
const RingLabel = z.strictObject({ at: z.number(), text: z.string().min(1).max(24), face: z.enum(["caps", "serif"]), size: z.number().min(4).max(96) });
export const RingSpecZ = z.strictObject({
  r: z.number().min(1),
  width: z.number().min(0.5),
  tok: TokZ,
  edge: TokZ.nullable(),
  gaps: z.array(z.tuple([z.number(), z.number()])).max(12), // broken rings (emblems), degrees clockwise from 12 o'clock
  notches: z.array(z.strictObject({ at: z.number(), width: z.number().min(0), depth: z.number().min(0) })).max(12), // the doorway notch at 6 o'clock = 180
  studs: z.strictObject({ n: z.number().int().min(1).max(64), r: z.number().min(0.5), tok: TokZ }).nullable(),
  teeth: z.strictObject({ n: z.number().int().min(3).max(96), depth: z.number().min(0.5) }).nullable(),
  grooves: z.strictObject({ n: z.number().int().min(1).max(8), tok: TokZ }).nullable(),
  spokes: z.strictObject({ n: z.number().int().min(1).max(24), width: z.number().min(0.5) }).nullable(),
  wave: z.strictObject({ cycles: z.number().int().min(1).max(24), amp: z.number().min(0), tok: TokZ }).nullable(), // engraved sine band
  sockets: z.strictObject({ n: z.number().int().min(1).max(24), r: z.number().min(0.5), tok: TokZ }).nullable(),
  ticks: z.strictObject({ n: z.number().int().min(1).max(180), len: z.number().min(0.5), tok: TokZ }).nullable(),
  labels: z.array(RingLabel).max(12), // spec-independent only
});
export type RingSpec = z.infer<typeof RingSpecZ>;
export const RingStackZ = z.strictObject({
  size: z.number().min(8).max(2048),
  ellipse: z.number().min(0.2).max(1), // 1 = circle, < 1 = tilted
  rings: z.array(RingSpecZ).max(8),
  hub: z.strictObject({ r: z.number().min(1), ramp: RampZ }).nullable(),
  cutout: z.strictObject({ w: z.number().min(1), h: z.number().min(1), arch: z.boolean() }).nullable(),
  knurl: z.boolean(),
});
export type RingStackP = z.infer<typeof RingStackZ>;

/** Point at `deg` clockwise from 12 o'clock. */
function polar(cx: number, cy: number, rad: number, deg: number): Pt {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
}
/** Annulus sector path between radii r0 < r1 over [a0, a1] degrees (clockwise from 12). */
function sectorD(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  if (a1 - a0 >= 359.99) return circleD(cx, cy, r1) + (r0 > 0 ? circleD(cx, cy, r0) : "");
  const large = a1 - a0 > 180 ? 1 : 0;
  const [x1, y1] = polar(cx, cy, r1, a0);
  const [x2, y2] = polar(cx, cy, r1, a1);
  const [x3, y3] = polar(cx, cy, r0, a1);
  const [x4, y4] = polar(cx, cy, r0, a0);
  return `M${n(x1)} ${n(y1)}A${n(r1)} ${n(r1)} 0 ${large} 1 ${n(x2)} ${n(y2)}L${n(x3)} ${n(y3)}A${n(r0)} ${n(r0)} 0 ${large} 0 ${n(x4)} ${n(y4)}Z`;
}
/** [0, 360) minus the given intervals. */
function subtractIntervals(cuts: Array<[number, number]>): Array<[number, number]> {
  const norm = cuts
    .flatMap(([a, b]): Array<[number, number]> => {
      const a0 = ((a % 360) + 360) % 360;
      const len = Math.max(0, b - a);
      return a0 + len > 360 ? [[a0, 360], [0, a0 + len - 360]] : [[a0, a0 + len]];
    })
    .sort((x, y) => x[0] - y[0]);
  const out: Array<[number, number]> = [];
  let cur = 0;
  for (const [a, b] of norm) {
    if (a > cur) out.push([cur, a]);
    cur = Math.max(cur, b);
  }
  if (cur < 360) out.push([cur, 360]);
  if (out.length > 1 && out[0][0] === 0 && out[out.length - 1][1] === 360 && cuts.length > 0) {
    // merge the wrap-around piece so a gap-free arc spans 12 o'clock
    const last = out.pop()!;
    out[0] = [last[0] - 360, out[0][1]];
  }
  return out;
}

export const ringStack: KitGenerator<RingStackP> = {
  name: "ringStack",
  schema: RingStackZ,
  defaults: {
    size: 340,
    ellipse: 1,
    rings: [
      { r: 170, width: 26, tok: "gold.base", edge: "gold.deep", gaps: [], notches: [], studs: { n: 12, r: 4, tok: "gold.hi" }, teeth: null, grooves: null, spokes: null, wave: null, sockets: null, ticks: null, labels: [] },
      { r: 138, width: 18, tok: "inlay.navy", edge: null, gaps: [], notches: [], studs: null, teeth: null, grooves: null, spokes: null, wave: null, sockets: null, ticks: { n: 24, len: 8, tok: "gold.hi" }, labels: [] },
    ],
    hub: { r: 40, ramp: { lit: "gold.hi", base: "gold.base", shade: "gold.deep" } },
    cutout: null,
    knurl: false,
  },
  generate(p): KitResult {
    const ids = new Ids("rs");
    const S = p.size;
    const H = Math.round(S * p.ellipse);
    const cx = S / 2;
    const cy = S / 2;
    let defs = "";
    let body = "";
    const anchors: Record<string, [number, number]> = {};
    const engrave: EngraveReq[] = [];
    const bevel = linear(ids, [[0, "haze", 0.35], [0.5, "haze", 0], [1, "shadow", 0.35]], 0, 0, 1, 1);
    defs += bevel.def;
    const sy = (y: number) => y * p.ellipse; // anchors after the ellipse squash
    let notchN = 0;
    let socketN = 0;
    let studN = 0;
    let labelN = 0;
    for (const ring of p.rings) {
      const r1 = Math.min(ring.r, S / 2);
      const r0 = Math.max(0, r1 - ring.width);
      const cuts: Array<[number, number]> = [...ring.gaps.map(([a, b]) => [a, b] as [number, number]), ...ring.notches.map((nt) => [nt.at - nt.width / 2, nt.at + nt.width / 2] as [number, number])];
      const arcs = subtractIntervals(cuts);
      let d = "";
      for (const [a0, a1] of arcs) d += sectorD(cx, cy, r0, r1, a0, a1);
      // notch floors: the ring continues below the notch depth
      for (const nt of ring.notches) {
        const inner = Math.max(r0, r1 - nt.depth);
        if (inner > r0) d += sectorD(cx, cy, r0, inner, nt.at - nt.width / 2, nt.at + nt.width / 2);
        const [ax, ay] = polar(cx, cy, r1 - nt.depth / 2, nt.at);
        anchors[`notch_${notchN++}`] = [Math.round(ax), Math.round(sy(ay))];
      }
      if (ring.teeth) {
        for (let i = 0; i < ring.teeth.n; i++) {
          const a = (i / ring.teeth.n) * 360;
          const half = 360 / ring.teeth.n / 4;
          d += poly([polar(cx, cy, r1 - 0.5, a - half * 1.2), polar(cx, cy, r1 + ring.teeth.depth, a - half * 0.7), polar(cx, cy, r1 + ring.teeth.depth, a + half * 0.7), polar(cx, cy, r1 - 0.5, a + half * 1.2)]);
        }
      }
      if (ring.spokes) {
        const hubR = p.hub ? p.hub.r : 0;
        for (let i = 0; i < ring.spokes.n; i++) {
          const a = (i / ring.spokes.n) * 360;
          const sw = ring.spokes.width / 2;
          const [ox, oy] = polar(0, 0, 1, a + 90);
          const [ix, iy] = polar(cx, cy, hubR * 0.9, a);
          const [ex, ey] = polar(cx, cy, r0 + 1, a);
          d += poly([[ix + ox * sw, iy + oy * sw], [ex + ox * sw, ey + oy * sw], [ex - ox * sw, ey - oy * sw], [ix - ox * sw, iy - oy * sw]]);
        }
      }
      body += el("path", { d, fill: tk(ring.tok), "fill-rule": "evenodd" });
      body += el("path", { d, fill: bevel.ref, "fill-rule": "evenodd" });
      if (ring.edge) {
        let e = "";
        for (const [a0, a1] of arcs) e += sectorD(cx, cy, r0, r1, a0, a1);
        body += el("path", { d: e, fill: "none", stroke: tk(ring.edge), "stroke-width": Math.max(1, ring.width * 0.07) });
      }
      const mid = (r0 + r1) / 2;
      if (ring.grooves) {
        let g = "";
        for (let i = 1; i <= ring.grooves.n; i++) {
          const gr = r0 + (i / (ring.grooves.n + 1)) * (r1 - r0);
          for (const [a0, a1] of arcs) {
            if (a1 - a0 >= 359.99) g += circleD(cx, cy, gr);
            else {
              const [x1, y1] = polar(cx, cy, gr, a0);
              const [x2, y2] = polar(cx, cy, gr, a1);
              g += `M${n(x1)} ${n(y1)}A${n(gr)} ${n(gr)} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${n(x2)} ${n(y2)}`;
            }
          }
        }
        body += el("path", { d: g, fill: "none", stroke: tk(ring.grooves.tok), "stroke-width": Math.max(0.8, ring.width * 0.06) });
      }
      if (ring.wave) {
        const pts: Pt[] = [];
        for (let i = 0; i <= 240; i++) {
          const a = (i / 240) * 360;
          pts.push(polar(cx, cy, mid + ring.wave.amp * Math.sin(((ring.wave.cycles * a) / 360) * Math.PI * 2), a));
        }
        body += el("path", { d: poly(pts, false), fill: "none", stroke: tk(ring.wave.tok), "stroke-width": Math.max(1, ring.width * 0.1), "stroke-linejoin": "round" });
      }
      if (ring.ticks) {
        let t = "";
        for (let i = 0; i < ring.ticks.n; i++) {
          const a = (i / ring.ticks.n) * 360;
          const [x1, y1] = polar(cx, cy, r1 - 1, a);
          const [x2, y2] = polar(cx, cy, r1 - 1 - ring.ticks.len * (i % 2 === 0 ? 1 : 0.6), a);
          t += `M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}`;
        }
        body += el("path", { d: t, stroke: tk(ring.ticks.tok), "stroke-width": Math.max(1, ring.width * 0.07), fill: "none" });
      }
      if (ring.studs) {
        let s = "";
        let hi = "";
        for (let i = 0; i < ring.studs.n; i++) {
          const [x, y] = polar(cx, cy, mid, (i / ring.studs.n) * 360);
          s += circleD(x, y, ring.studs.r);
          hi += circleD(x - ring.studs.r * 0.3, y - ring.studs.r * 0.3, ring.studs.r * 0.4);
          anchors[`stud_${studN++}`] = [Math.round(x), Math.round(sy(y))];
        }
        body += el("path", { d: s, fill: tk(ring.studs.tok) });
        body += el("path", { d: hi, fill: tk("haze"), "fill-opacity": 0.55 });
      }
      if (ring.sockets) {
        let s = "";
        let inner = "";
        for (let i = 0; i < ring.sockets.n; i++) {
          const [x, y] = polar(cx, cy, mid, (i / ring.sockets.n) * 360);
          s += circleD(x, y, ring.sockets.r);
          inner += circleD(x + ring.sockets.r * 0.12, y + ring.sockets.r * 0.12, ring.sockets.r * 0.65);
          anchors[`socket_${socketN++}`] = [Math.round(x), Math.round(sy(y))];
        }
        body += el("path", { d: s, fill: tk(ring.sockets.tok) });
        body += el("path", { d: inner, fill: tk("shadow"), "fill-opacity": 0.45 });
      }
      for (const lb of ring.labels) {
        const [x, y] = polar(cx, cy, mid, lb.at);
        engrave.push({ id: `label_${labelN}`, text: lb.text, face: lb.face, size: lb.size, x, y: y + lb.size * 0.35, anchor: "middle", fill: ring.edge ?? "inlay.navy.dark", rotate: 0 });
        anchors[`label_${labelN++}`] = [Math.round(x), Math.round(sy(y))];
      }
    }
    if (p.knurl && p.rings.length > 0) {
      const r1 = Math.min(p.rings[0].r, S / 2);
      let k = "";
      for (let i = 0; i < 72; i++) {
        const [x1, y1] = polar(cx, cy, r1 - 0.5, i * 5);
        const [x2, y2] = polar(cx, cy, r1 - 4, i * 5);
        k += `M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}`;
      }
      body += el("path", { d: k, stroke: tk("shadow"), "stroke-opacity": 0.5, "stroke-width": 1, fill: "none" });
    }
    if (p.hub) {
      const g = radial(ids, [[0, p.hub.ramp.lit], [0.55, p.hub.ramp.base], [1, p.hub.ramp.shade]], 0.5, 0.5, 0.6, false, 0.32, 0.3);
      defs += g.def;
      body += el("path", { d: circleD(cx, cy, p.hub.r), fill: g.ref });
      body += el("path", { d: circleD(cx, cy, p.hub.r), fill: "none", stroke: tk(p.hub.ramp.shade), "stroke-width": Math.max(1, p.hub.r * 0.06) });
    }
    if (p.cutout) {
      const mid = ids.next("mk");
      const cw = p.cutout.w;
      const ch = p.cutout.h;
      const hole = p.cutout.arch ? openingD("round", cx - cw / 2, S - ch, cw, ch) : rectD(cx - cw / 2, S - ch, cw, ch);
      defs += el("mask", { id: mid, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: S, height: S }, el("path", { d: rectD(0, 0, S, S), fill: "white" }) + el("path", { d: hole, fill: "black" }));
      body = el("g", { mask: `url(#${mid})` }, body);
    }
    if (p.ellipse < 1) body = el("g", { transform: `scale(1 ${p.ellipse})` }, body);
    anchors.hub = [Math.round(cx), Math.round(sy(cy))];
    return result(S, H, defs, body, { pivot: [0.5, 0.5], anchors, engrave: engrave.map((e) => ({ ...e, y: sy(e.y) })) });
  },
};

// ── masonry: brickWall / ashlarWall ────────────────────────────────────────────────────────────────────────
export const MasonryZ = z.strictObject({
  w: z.number().min(16).max(4096),
  h: z.number().min(8).max(2048),
  unit: z.tuple([z.number().min(4), z.number().min(4)]),
  mortar: TokZ,
  ramp: RampZ,
  jitter: z.number().min(0).max(1),
  rounded: z.number().min(0).max(64), // corner radius; > 0 gives the stacked-block cliff
  bands: z.array(z.strictObject({ y: z.number(), h: z.number().min(1), tok: TokZ })).max(8),
  cap: z.strictObject({ h: z.number().min(1), tok: TokZ }).nullable(),
  medallions: z.strictObject({ every: z.number().min(16), y: z.number(), r: z.number().min(2) }).nullable(),
  openings: z.array(z.strictObject({ x: z.number(), y: z.number(), w: z.number().min(1), h: z.number().min(1), arch: z.boolean() })).max(12),
  tileable: z.boolean(),
  finish: FinishZ,
});
export type MasonryP = z.infer<typeof MasonryZ>;

function masonry(p: MasonryP, seed: number, kind: "brick" | "ashlar"): KitResult {
  const r = rng(seed);
  const ids = new Ids(kind === "brick" ? "bw" : "aw");
  const f = p.finish;
  const { w, h } = p;
  let defs = "";
  let body = el("path", { d: rectD(0, 0, w, h), fill: T(p.mortar, f) });
  const gap = kind === "brick" ? 2 : 3;
  const tones = { lit: "", base: "", shade: "" } as Record<"lit" | "base" | "shade", string>;
  let hiEdges = "";
  let loEdges = "";
  const capH = p.cap ? p.cap.h : 0;
  let y = capH;
  let row = 0;
  while (y < h) {
    const ch = kind === "brick" ? p.unit[1] : Math.round(p.unit[1] * r.range(0.65, 1.3));
    let x = kind === "brick" ? (row % 2 === 0 ? 0 : -p.unit[0] / 2) : -r.range(0, p.unit[0]);
    while (x < w) {
      const bw = kind === "brick" ? p.unit[0] : p.unit[0] * r.range(0.6, 1.6);
      const roll = r.next() + (r.next() - 0.5) * p.jitter;
      const tone: "lit" | "base" | "shade" = roll < 0.22 ? "lit" : roll > 0.8 ? "shade" : "base";
      const xs = [x];
      if (p.tileable && x + bw > w) xs.push(x - w);
      if (p.tileable && x < 0) xs.push(x + w);
      for (const bx of xs) {
        const d = p.rounded > 0 ? roundRectD(bx + gap / 2, y + gap / 2, bw - gap, ch - gap, p.rounded) : rectD(bx + gap / 2, y + gap / 2, bw - gap, ch - gap);
        tones[tone] += d;
        hiEdges += `M${n(bx + gap / 2 + 1)} ${n(y + ch - gap)}V${n(y + gap / 2 + 1)}H${n(bx + bw - gap / 2 - 1)}`;
        loEdges += `M${n(bx + gap / 2 + 1)} ${n(y + ch - gap / 2 - 1)}H${n(bx + bw - gap / 2 - 1)}V${n(y + gap / 2 + 2)}`;
      }
      x += bw;
    }
    y += ch;
    row++;
  }
  body += el("path", { d: tones.base, fill: T(p.ramp.base, f) });
  body += el("path", { d: tones.lit, fill: T(p.ramp.lit, f) });
  body += el("path", { d: tones.shade, fill: T(p.ramp.shade, f) });
  body += el("path", { d: loEdges, fill: "none", stroke: T(p.ramp.shade, f), "stroke-width": kind === "brick" ? 1 : 1.6, "stroke-opacity": 0.8 });
  body += el("path", { d: hiEdges, fill: "none", stroke: T(p.ramp.lit, f), "stroke-width": kind === "brick" ? 1 : 1.6, "stroke-opacity": 0.8 });
  for (const b of p.bands) {
    body += el("path", { d: rectD(0, b.y, w, b.h), fill: T(b.tok, f) });
    body += el("path", { d: rectD(0, b.y - 1.5, w, 1.5), fill: T(p.ramp.lit, f), "fill-opacity": 0.8 });
    body += el("path", { d: rectD(0, b.y + b.h, w, 2), fill: tk("shadow"), "fill-opacity": 0.3 });
  }
  if (p.cap) {
    body += el("path", { d: rectD(0, 0, w, p.cap.h), fill: T(p.cap.tok, f) });
    body += el("path", { d: rectD(0, 0, w, 2), fill: T(p.ramp.lit, f) });
    body += el("path", { d: rectD(0, p.cap.h, w, 3), fill: tk("shadow"), "fill-opacity": 0.3 });
  }
  const anchors: Record<string, [number, number]> = {};
  if (p.medallions) {
    let m = "";
    let inner = "";
    let i = 0;
    for (let mx = p.medallions.every / 2; mx < w; mx += p.medallions.every) {
      m += circleD(mx, p.medallions.y, p.medallions.r);
      inner += circleD(mx, p.medallions.y, p.medallions.r * 0.62);
      anchors[`medallion_${i++}`] = [Math.round(mx), Math.round(p.medallions.y)];
    }
    body += el("path", { d: m, fill: T("gold.base", f) });
    body += el("path", { d: inner, fill: T("inlay.navy", f) });
  }
  p.openings.forEach((o, i) => {
    const d = o.arch ? openingD("round", o.x, o.y, o.w, o.h) : rectD(o.x, o.y, o.w, o.h);
    const g = linear(ids, [[0, "inlay.navy.dark"], [1, `${p.ramp.shade}|dim:0.5`]], 0, 0, 1, 1);
    defs += g.def;
    body += el("path", { d, fill: g.ref });
    body += el("path", { d, fill: "none", stroke: T(p.ramp.lit, f), "stroke-width": 3 });
    anchors[`opening_${i}`] = [Math.round(o.x + o.w / 2), Math.round(o.y + o.h)];
  });
  const ao = aoFoot(ids, rectD(0, h - h * 0.12, w, h * 0.12), h, h * 0.12, f);
  defs += ao.defs;
  body += ao.body;
  return result(w, h, defs, body, { anchors, tileWidth: p.tileable ? w : null });
}

export const brickWall: KitGenerator<MasonryP> = {
  name: "brickWall",
  schema: MasonryZ,
  defaults: { w: 1024, h: 360, unit: [48, 20], mortar: "stone.shade", ramp: { lit: "stone.lit", base: "stone.base", shade: "stone.shade|dim:0.15" }, jitter: 0.3, rounded: 0, bands: [], cap: null, medallions: null, openings: [], tileable: true, finish: { ao: true, rim: false, haze: 0 } },
  generate: (p, seed) => masonry(p, seed, "brick"),
};
export const ashlarWall: KitGenerator<MasonryP> = {
  name: "ashlarWall",
  schema: MasonryZ,
  defaults: { w: 1024, h: 420, unit: [120, 60], mortar: "stone.deep", ramp: STONE, jitter: 0.3, rounded: 0, bands: [], cap: null, medallions: null, openings: [], tileable: true, finish: { ao: true, rim: false, haze: 0 } },
  generate: (p, seed) => masonry(p, seed, "ashlar"),
};

// ── stairs ─────────────────────────────────────────────────────────────────────────────────────────────────
export const StairsZ = z.strictObject({
  steps: z.number().int().min(1).max(40),
  rise: z.number().min(2).max(200),
  tread: z.number().min(2).max(400),
  depth: z.number().min(0).max(200),
  style: z.enum(["stone", "spoke_ledge", "iron", "marble_landing", "ladder", "carved_wet", "stepped_plinth"]),
  dir: z.enum(["up_right", "up_left", "straight"]),
  nosing: TokZ.nullable(),
  cheekWalls: z.boolean(),
  ramp: RampZ,
  finish: FinishZ,
});
export type StairsP = z.infer<typeof StairsZ>;

export const stairs: KitGenerator<StairsP> = {
  name: "stairs",
  schema: StairsZ,
  defaults: { steps: 5, rise: 34, tread: 60, depth: 40, style: "stone", dir: "up_right", nosing: "gold.base", cheekWalls: false, ramp: STONE, finish: { ao: true, rim: true, haze: 0 } },
  generate(p, seed): KitResult {
    const r = rng(seed);
    const ids = new Ids("st");
    const f = p.finish;
    const W = p.steps * p.tread;
    const lip = 0.4 * p.depth;
    const H = p.steps * p.rise + lip;
    let defs = "";
    let body = "";
    const anchors: Record<string, [number, number]> = {};
    const flip = p.dir === "up_left";
    const X = (x: number) => (flip ? W - x : x);
    const face = Math.min(lip, p.rise * 0.35);
    const g = rampDiag(ids, p.ramp, f.haze);
    defs += g.def;
    if (p.style === "ladder") {
      const rail = Math.max(3, p.tread * 0.08);
      body += el("path", { d: rectD(p.tread * 0.15, 0, rail, H) + rectD(W - p.tread * 0.15 - rail, 0, rail, H), fill: T(p.ramp.base, f) });
      let rungs = "";
      for (let i = 0; i < p.steps; i++) {
        const y = H - (i + 0.5) * p.rise;
        rungs += rectD(p.tread * 0.15, y, W - p.tread * 0.3, Math.max(2, rail * 0.7));
        anchors[`step_${i}`] = [Math.round(W / 2), Math.round(y)];
      }
      body += el("path", { d: rungs, fill: T(p.ramp.lit, f) });
      return result(W, H, defs, body, { pivot: [0, 1], anchors });
    }
    if (p.style === "stepped_plinth" || p.dir === "straight") {
      // symmetric tiers, widest at the bottom
      for (let i = 0; i < p.steps; i++) {
        const inset = p.style === "stepped_plinth" ? (i * W) / (2 * p.steps + 1) : 0;
        const y = H - (i + 1) * p.rise;
        body += el("path", { d: rectD(inset, y, W - inset * 2, p.rise), fill: g.ref });
        body += el("path", { d: rectD(inset, y, W - inset * 2, Math.max(2, face * 0.5)), fill: T(p.ramp.lit, f) });
        if (p.nosing) body += el("path", { d: rectD(inset, y + Math.max(2, face * 0.5), W - inset * 2, 2), fill: T(p.nosing, f) });
        body += el("path", { d: rectD(W - inset - p.tread * 0.12, y, p.tread * 0.12, p.rise), fill: tk("shadow"), "fill-opacity": 0.25 });
        anchors[`step_${i}`] = [Math.round(W / 2), Math.round(y)];
      }
      const ao = aoFoot(ids, rectD(0, H - p.rise, W, p.rise), H, p.rise, f);
      return result(W, H, defs + ao.defs, body + ao.body, { pivot: [0, 1], anchors });
    }
    // side-view stair: a solid profile (stone) or floating ledges (spoke_ledge) or open treads (iron)
    const profile: Pt[] = [[X(0), H]];
    for (let i = 0; i < p.steps; i++) {
      const y = H - (i + 1) * p.rise;
      profile.push([X(i * p.tread), y], [X((i + 1) * p.tread), y]);
    }
    profile.push([X(W), H]);
    if (p.style === "stone" || p.style === "marble_landing" || p.style === "carved_wet") {
      body += el("path", { d: poly(profile), fill: g.ref });
      let risers = "";
      for (let i = 0; i < p.steps; i++) {
        const y = H - (i + 1) * p.rise;
        risers += rectD(Math.min(X(i * p.tread), X(i * p.tread + 3)), y, 3, p.rise);
      }
      body += el("path", { d: risers, fill: tk("shadow"), "fill-opacity": 0.25 });
    } else if (p.style === "iron") {
      const s = Math.max(3, p.rise * 0.12);
      body += el("path", { d: poly([[X(0), H], [X(0), H - s * 2], [X(W - p.tread), 0 + lip], [X(W), lip], [X(W), lip + s * 2], [X(p.tread * 0.5), H]]), fill: T(p.ramp.shade, f) });
    }
    let treads = "";
    let noses = "";
    for (let i = 0; i < p.steps; i++) {
      const y = H - (i + 1) * p.rise;
      const x0 = Math.min(X(i * p.tread), X((i + 1) * p.tread));
      if (p.style === "spoke_ledge") {
        const ly = y;
        body += el("path", { d: rectD(x0 + p.tread * 0.1, ly, p.tread * 0.8, p.rise * 0.45), fill: g.ref });
        body += el("path", { d: rectD(x0 + p.tread * 0.45, ly + p.rise * 0.45, p.tread * 0.1, p.rise * 0.6), fill: T(p.ramp.shade, f) });
        treads += rectD(x0 + p.tread * 0.1, ly - face * 0.4, p.tread * 0.8, face * 0.4 + 1.5);
      } else if (p.style === "iron") {
        treads += rectD(x0, y - 2, p.tread, Math.max(4, p.rise * 0.18));
      } else {
        treads += rectD(x0, y - face * 0.5, p.tread, face * 0.5 + 1.5);
      }
      if (p.nosing && p.style !== "iron") noses += rectD(flip ? x0 : x0 + p.tread - 4, y - face * 0.5, 4, face * 0.5 + 3);
      anchors[`step_${i}`] = [Math.round(x0 + p.tread / 2), Math.round(y)];
    }
    body += el("path", { d: treads, fill: T(p.style === "iron" ? p.ramp.base : p.ramp.lit, f) });
    if (noses) body += el("path", { d: noses, fill: T(p.nosing ?? p.ramp.shade, f) });
    if (p.style === "carved_wet" || p.style === "marble_landing") {
      let sheen = "";
      for (let i = 0; i < p.steps; i++) {
        const y = H - (i + 1) * p.rise;
        const x0 = Math.min(X(i * p.tread), X((i + 1) * p.tread));
        sheen += `M${n(x0 + p.tread * r.range(0.1, 0.3))} ${n(y + p.rise * 0.3)}l${n(p.tread * 0.3)} ${n(p.rise * 0.2)}`;
      }
      body += el("path", { d: sheen, stroke: tk("haze"), "stroke-opacity": 0.5, "stroke-width": 2, fill: "none", "stroke-linecap": "round" });
    }
    if (p.cheekWalls) {
      const cw = Math.max(6, p.rise * 0.3);
      body += el("path", { d: poly([[X(0), H], [X(0), H - p.rise - cw], [X(W), lip - cw], [X(W), lip]]), fill: T(p.ramp.base, f), "fill-opacity": 0.95 });
      body += el("path", { d: poly([[X(0), H - p.rise - cw], [X(W), lip - cw]], false), stroke: T(p.ramp.lit, f), "stroke-width": 2, fill: "none" });
    }
    if (p.style !== "spoke_ledge") body += rimStroke(profile, p.ramp.lit, f, 1.5, 0.7);
    const ao = aoFoot(ids, rectD(0, H - p.rise, W, p.rise), H, p.rise, f);
    return result(W, H, defs + ao.defs, body + (p.style === "spoke_ledge" ? "" : ao.body), { pivot: [0, 1], anchors });
  },
};

// ── railing ────────────────────────────────────────────────────────────────────────────────────────────────
export const RailingZ = z.strictObject({
  w: z.number().min(16).max(4096),
  h: z.number().min(8).max(1024),
  style: z.enum(["balustrade", "wrought_iron", "brass_rail", "rope_stanchion", "navy_cap_wave"]),
  spacing: z.number().min(4).max(400),
  posts: z.strictObject({ every: z.number().int().min(1).max(64), emblem: z.boolean() }).nullable(),
  wet: z.boolean(),
  ramp: RampZ,
  cap: TokZ,
});
export type RailingP = z.infer<typeof RailingZ>;

export const railing: KitGenerator<RailingP> = {
  name: "railing",
  schema: RailingZ,
  defaults: { w: 1024, h: 120, style: "balustrade", spacing: 32, posts: { every: 6, emblem: true }, wet: false, ramp: STONE, cap: "stone.lit" },
  generate(p): KitResult {
    const ids = new Ids("rl");
    const f: Finish = { ao: false, rim: false, haze: 0 };
    const { w, h } = p;
    const count = Math.max(1, Math.round(w / p.spacing));
    const sp = w / count;
    let defs = "";
    let body = "";
    const cyl = rampCyl(ids, p.ramp, 0);
    defs += cyl.def;
    const topH = h * 0.14;
    const botH = h * 0.1;
    const bars = (fn: (x: number, i: number) => string) => {
      let d = "";
      for (let i = 0; i < count; i++) d += fn(i * sp + sp / 2, i);
      return d;
    };
    const postEvery = p.posts?.every ?? 0;
    if (p.style === "balustrade" || p.style === "navy_cap_wave") {
      const bw = sp * 0.42;
      const vase = (x: number) => {
        const y0 = topH;
        const y1 = h - botH;
        const m = (y1 - y0) / 6;
        return `M${n(x - bw * 0.25)} ${n(y0)}H${n(x + bw * 0.25)}C${n(x + bw * 0.2)} ${n(y0 + m)} ${n(x + bw * 0.5)} ${n(y0 + m * 2.5)} ${n(x + bw * 0.5)} ${n(y0 + m * 3.6)}C${n(x + bw * 0.5)} ${n(y0 + m * 4.8)} ${n(x + bw * 0.25)} ${n(y1 - m * 0.5)} ${n(x + bw * 0.35)} ${n(y1)}H${n(x - bw * 0.35)}C${n(x - bw * 0.25)} ${n(y1 - m * 0.5)} ${n(x - bw * 0.5)} ${n(y0 + m * 4.8)} ${n(x - bw * 0.5)} ${n(y0 + m * 3.6)}C${n(x - bw * 0.5)} ${n(y0 + m * 2.5)} ${n(x - bw * 0.2)} ${n(y0 + m)} ${n(x - bw * 0.25)} ${n(y0)}Z`;
      };
      body += el("path", { d: bars((x, i) => (postEvery && i % postEvery === 0 ? "" : vase(x))), fill: cyl.ref });
      body += el("path", { d: bars((x, i) => (postEvery && i % postEvery === 0 ? "" : `M${n(x + sp * 0.12)} ${n(topH + 4)}V${n(h - botH - 4)}`)), stroke: tk("shadow"), "stroke-opacity": 0.25, "stroke-width": sp * 0.08, fill: "none" });
    } else if (p.style === "wrought_iron") {
      body += el("path", { d: bars((x) => rectD(x - 1.5, topH, 3, h - topH - botH)), fill: T(p.ramp.shade, f) });
      body += el("path", { d: bars((x) => poly([[x - 4, topH], [x, topH - 9], [x + 4, topH]])), fill: T(p.ramp.base, f) });
      body += el("path", { d: bars((x) => `M${n(x)} ${n(h * 0.62)}c${n(sp * 0.25)} ${n(-h * 0.08)} ${n(sp * 0.45)} ${n(h * 0.02)} ${n(sp * 0.5)} ${n(h * 0.08)}`), stroke: T(p.ramp.shade, f), "stroke-width": 2, fill: "none" });
    } else if (p.style === "brass_rail") {
      body += el("path", { d: rectD(0, h * 0.45, w, Math.max(3, h * 0.05)), fill: cyl.ref });
    } else {
      let rope = "";
      for (let i = 0; i < count; i++) {
        const x0 = i * sp + sp / 2;
        rope += `M${n(x0)} ${n(topH + 6)}Q${n(x0 + sp / 2)} ${n(h * 0.55)} ${n(x0 + sp)} ${n(topH + 6)}`;
      }
      body += el("path", { d: rope, stroke: T("foliage.rust", f), "stroke-width": Math.max(3, h * 0.06), fill: "none", "stroke-linecap": "round" });
    }
    // posts
    if (p.style === "brass_rail" || p.style === "rope_stanchion" || postEvery) {
      const every = p.style === "brass_rail" || p.style === "rope_stanchion" ? 1 : postEvery;
      const pw = p.style === "rope_stanchion" ? sp * 0.08 : p.style === "brass_rail" ? sp * 0.1 : sp * 0.7;
      let posts = "";
      let em = "";
      for (let i = 0; i < count; i += every) {
        const x = i * sp + sp / 2;
        posts += rectD(x - pw / 2, topH * 0.4, pw, h - topH * 0.4);
        if (p.posts?.emblem && pw > 10) em += circleD(x, h * 0.5, pw * 0.22);
      }
      body += el("path", { d: posts, fill: cyl.ref });
      if (em) body += el("path", { d: em, fill: T("gold.base", f), stroke: T("inlay.navy", f), "stroke-width": 1.5 });
    }
    // rails
    if (p.style !== "rope_stanchion") {
      const capTok = p.style === "navy_cap_wave" ? "inlay.navy" : p.cap;
      body += el("path", { d: rectD(0, 0, w, topH), fill: T(capTok, f) });
      body += el("path", { d: rectD(0, 0, w, Math.max(1.5, topH * 0.2)), fill: T(p.style === "navy_cap_wave" ? "gold.base" : p.ramp.lit, f) });
      body += el("path", { d: rectD(0, topH, w, 2), fill: tk("shadow"), "fill-opacity": 0.35 });
      if (p.style !== "brass_rail") body += el("path", { d: rectD(0, h - botH, w, botH), fill: T(p.ramp.base, f) });
      if (p.style === "navy_cap_wave") {
        let wave = "";
        const cyc = count;
        for (let i = 0; i <= cyc * 8; i++) {
          const x = (i / (cyc * 8)) * w;
          wave += `${i === 0 ? "M" : "L"}${n(x)} ${n(h - botH / 2 + Math.sin((i / 8) * Math.PI * 2) * botH * 0.25)}`;
        }
        body += el("path", { d: wave, stroke: T("gold.base", f), "stroke-width": 1.5, fill: "none" });
      }
    }
    if (p.wet) body += el("path", { d: rectD(0, topH * 0.35, w, 1.5), fill: tk("haze"), "fill-opacity": 0.6 });
    return result(w, h, defs, body, { tileWidth: w });
  },
};

// ── awning ─────────────────────────────────────────────────────────────────────────────────────────────────
export const AwningZ = z.strictObject({
  w: z.number().min(16).max(2048),
  drop: z.number().min(8).max(600),
  stripes: z.tuple([TokZ, TokZ]),
  stripeW: z.number().min(2).max(200),
  valance: z.enum(["scallop", "straight", "wave"]),
  frame: TokZ,
  sag: z.number().min(0).max(60),
});
export type AwningP = z.infer<typeof AwningZ>;

export const awning: KitGenerator<AwningP> = {
  name: "awning",
  schema: AwningZ,
  defaults: { w: 320, drop: 90, stripes: ["foliage.salmon", "stone.lit"], stripeW: 24, valance: "scallop", frame: "bronze.ring", sag: 6 },
  generate(p): KitResult {
    const ids = new Ids("aw");
    const { w, drop } = p;
    const H = drop + 16;
    let defs = "";
    let body = "";
    const top = 6;
    const sagY = (x: number) => drop + Math.sin((x / w) * Math.PI) * p.sag;
    // fabric outline with the valance
    const edge: Pt[] = [];
    const k = Math.max(1, Math.round(w / p.stripeW));
    const sw = w / k;
    for (let i = 0; i <= k * 4; i++) {
      const x = (i / (k * 4)) * w;
      let y = sagY(x);
      if (p.valance === "scallop") y += Math.abs(Math.sin(((i % 4) / 4) * Math.PI)) * 10;
      if (p.valance === "wave") y += Math.sin((i / 4) * Math.PI * 2) * 4 + 4;
      edge.push([x, y]);
    }
    const outline: Pt[] = [[0, top], [w, top], ...edge.reverse()];
    const cid = ids.next("cp");
    defs += el("clipPath", { id: cid }, el("path", { d: poly(outline) }));
    let a = "";
    let b = "";
    for (let i = 0; i < k; i++) {
      const d = rectD(i * sw, top, sw, H - top);
      if (i % 2 === 0) a += d;
      else b += d;
    }
    const shadeG = linear(ids, [[0, "haze", 0.3], [0.5, "haze", 0], [1, "shadow", 0.35]], 0, 0, 0, 1);
    defs += shadeG.def;
    body += el("g", { "clip-path": `url(#${cid})` }, el("path", { d: a, fill: tk(p.stripes[0]) }) + el("path", { d: b, fill: tk(p.stripes[1]) }) + el("path", { d: rectD(0, top, w, H - top), fill: shadeG.ref }));
    body += el("path", { d: poly(edge, false), fill: "none", stroke: tk("shadow"), "stroke-opacity": 0.3, "stroke-width": 1.5 });
    body += el("path", { d: rectD(0, 0, w, top + 1), fill: tk(p.frame) });
    return result(w, H, defs, body, { pivot: [0.5, 0], anchors: { sway: [Math.round(w / 2), 0] } });
  },
};

// ── facade ─────────────────────────────────────────────────────────────────────────────────────────────────
export const FacadeZ = z.strictObject({
  w: z.number().min(32).max(4096),
  h: z.number().min(32).max(2048),
  style: z.enum(["brick_row", "commercial", "storefront", "moderne", "collegiate", "hall_ring_windows", "kiosk"]),
  floors: z.number().int().min(1).max(12),
  bays: z.number().int().min(1).max(16),
  ramp: RampZ,
  trim: TokZ,
  window: z.strictObject({ w: z.number().min(2), h: z.number().min(2), tok: TokZ, arch: z.boolean() }),
  door: z.strictObject({ bay: z.number().int().min(0), recessed: z.boolean() }).nullable(),
  awning: AwningZ.partial().nullable(),
  fireEscape: z.boolean(),
  sign: z.strictObject({ text: z.string().min(1).max(40), tok: TokZ }).nullable(), // wordmarks, 02 §3e
  finish: FinishZ,
});
export type FacadeP = z.infer<typeof FacadeZ>;

export const facade: KitGenerator<FacadeP> = {
  name: "facade",
  schema: FacadeZ,
  defaults: {
    w: 420,
    h: 520,
    style: "brick_row",
    floors: 3,
    bays: 3,
    ramp: { lit: "stone.lit", base: "stone.base", shade: "stone.shade" },
    trim: "stone.lit",
    window: { w: 54, h: 80, tok: "inlay.navy", arch: false },
    door: { bay: 1, recessed: true },
    awning: null,
    fireEscape: false,
    sign: null,
    finish: { ao: true, rim: true, haze: 0 },
  },
  generate(p, seed): KitResult {
    const r = rng(seed);
    const ids = new Ids("fa");
    const f = p.finish;
    const { w, h } = p;
    let defs = "";
    let body = "";
    const anchors: Record<string, [number, number]> = {};
    const engrave: EngraveReq[] = [];
    const corniceH = h * 0.06;
    const floorH = (h - corniceH) / p.floors;
    const bayW = w / p.bays;
    const wall = rampV(ids, p.ramp, f.haze);
    defs += wall.def;
    body += el("path", { d: rectD(0, corniceH * 0.5, w, h - corniceH * 0.5), fill: wall.ref });
    // wall texture
    if (p.style === "brick_row" || p.style === "commercial") {
      let courses = "";
      for (let y = corniceH + 8; y < h; y += 9) courses += `M0 ${n(y)}H${n(w)}`;
      body += el("path", { d: courses, stroke: T(p.ramp.shade, f), "stroke-opacity": 0.35, "stroke-width": 1, fill: "none" });
      let hi = "";
      for (let i = 0; i < (w * h) / 900; i++) hi += rectD(r.range(0, w - 20), corniceH + Math.floor(r.range(0, (h - corniceH) / 9)) * 9 + 1, r.range(10, 22), 7);
      body += el("path", { d: hi, fill: T(p.ramp.lit, f), "fill-opacity": 0.35 });
    } else if (p.style === "moderne") {
      let lines = "";
      for (let i = 0; i < 3; i++) lines += rectD(0, h * 0.18 + i * 10, w, 3);
      body += el("path", { d: lines, fill: T(p.trim, f), "fill-opacity": 0.8 });
    } else if (p.style === "collegiate") {
      let q = "";
      for (let y = corniceH; y < h; y += 36) q += rectD(0, y, (y / 36) % 2 < 1 ? 26 : 18, 32) + rectD(w - ((y / 36) % 2 < 1 ? 26 : 18), y, (y / 36) % 2 < 1 ? 26 : 18, 32);
      body += el("path", { d: q, fill: T(p.ramp.lit, f) });
    }
    // floor bands
    let bands = "";
    for (let fl = 1; fl < p.floors; fl++) bands += rectD(0, h - fl * floorH - 3, w, 5);
    body += el("path", { d: bands, fill: T(p.trim, f), "fill-opacity": 0.9 });
    // windows
    const ww = Math.min(p.window.w, bayW * 0.7);
    const wh = Math.min(p.window.h, floorH * 0.7);
    let frames = "";
    let glass = "";
    let sills = "";
    let refl = "";
    for (let fl = 0; fl < p.floors; fl++) {
      for (let b = 0; b < p.bays; b++) {
        const groundDoor = fl === 0 && p.door && p.door.bay === b;
        const storefront = fl === 0 && (p.style === "storefront" || p.style === "commercial");
        const cx = b * bayW + bayW / 2;
        const y1 = h - fl * floorH - floorH * 0.18;
        if (groundDoor) continue;
        if (storefront) {
          const sw = bayW * 0.84;
          const sh = floorH * 0.62;
          frames += rectD(cx - sw / 2 - 4, y1 - sh - 4, sw + 8, sh + 8);
          glass += rectD(cx - sw / 2, y1 - sh, sw, sh);
          refl += poly([[cx - sw / 2 + 6, y1 - sh], [cx - sw / 2 + sw * 0.3, y1 - sh], [cx - sw / 2 + 6, y1 - sh * 0.3]]);
          anchors[`window_${fl}_${b}`] = [Math.round(cx), Math.round(y1 - sh / 2)];
          continue;
        }
        if (p.style === "hall_ring_windows") {
          const rr = Math.min(ww, wh) / 2;
          frames += circleD(cx, y1 - wh / 2, rr + 5);
          glass += circleD(cx, y1 - wh / 2, rr);
          anchors[`window_${fl}_${b}`] = [Math.round(cx), Math.round(y1 - wh / 2)];
          continue;
        }
        const wd = p.window.arch ? openingD("round", cx - ww / 2, y1 - wh, ww, wh) : rectD(cx - ww / 2, y1 - wh, ww, wh);
        frames += p.window.arch ? openingD("round", cx - ww / 2 - 5, y1 - wh - 5, ww + 10, wh + 5) : rectD(cx - ww / 2 - 5, y1 - wh - 5, ww + 10, wh + 5);
        glass += wd;
        sills += rectD(cx - ww / 2 - 8, y1, ww + 16, 5);
        refl += poly([[cx - ww / 2 + 4, y1 - wh + 4], [cx - ww / 2 + ww * 0.35, y1 - wh + 4], [cx - ww / 2 + 4, y1 - wh * 0.45]]);
        anchors[`window_${fl}_${b}`] = [Math.round(cx), Math.round(y1 - wh / 2)];
      }
    }
    body += el("path", { d: frames, fill: T(p.trim, f) });
    body += el("path", { d: glass, fill: T(p.window.tok, f) });
    body += el("path", { d: refl, fill: tk("haze"), "fill-opacity": 0.22 });
    body += el("path", { d: sills, fill: T(p.ramp.lit, f) });
    if (p.door) {
      const cx = Math.min(p.bays - 1, p.door.bay) * bayW + bayW / 2;
      const dw = Math.min(bayW * 0.6, 90);
      const dh = floorH * 0.78;
      body += el("path", { d: rectD(cx - dw / 2 - 6, h - dh - 6, dw + 12, dh + 6), fill: T(p.trim, f) });
      const dg = linear(ids, [[0, "inlay.navy.dark"], [1, "inlay.navy"]], 0, 0, 1, 1);
      defs += dg.def;
      body += el("path", { d: rectD(cx - dw / 2, h - dh, dw, dh), fill: dg.ref });
      if (p.door.recessed) body += el("path", { d: rectD(cx + dw / 2 - dw * 0.18, h - dh, dw * 0.18, dh), fill: tk("shadow"), "fill-opacity": 0.4 });
      anchors.door = [Math.round(cx), Math.round(h)];
    } else anchors.door = [Math.round(w / 2), Math.round(h)];
    if (p.awning) {
      const aw = awning.generate(AwningZ.parse({ ...awning.defaults, w: Math.round(w * 0.92), drop: Math.round(floorH * 0.22), ...p.awning }), seed);
      const { defs: ad, body: ab } = splitDoc(aw.svg);
      defs += ad;
      body += el("g", { transform: `translate(${n((w - aw.w) / 2)} ${n(h - floorH * 0.98)})` }, ab);
    }
    if (p.fireEscape) {
      let fe = "";
      const x0 = w * 0.62;
      const fw = w * 0.3;
      for (let fl = 1; fl < p.floors; fl++) {
        const y = h - fl * floorH;
        fe += rectD(x0, y, fw, 4) + `M${n(x0)} ${n(y)}V${n(y - 26)}H${n(x0 + fw)}V${n(y)}`;
        fe += `M${n(x0 + (fl % 2 ? 6 : fw - 6))} ${n(y)}L${n(x0 + (fl % 2 ? fw - 6 : 6))} ${n(y + floorH - 4)}`;
      }
      body += el("path", { d: fe, stroke: T("inlay.navy.dark", f), "stroke-width": 2.5, fill: "none" });
    }
    // cornice
    body += el("path", { d: rectD(-2, 0, w + 4, corniceH), fill: T(p.trim, f) });
    let dent = "";
    for (let x = 4; x < w - 4; x += 14) dent += rectD(x, corniceH * 0.55, 7, corniceH * 0.3);
    body += el("path", { d: dent, fill: tk("shadow"), "fill-opacity": 0.35 });
    body += el("path", { d: rectD(0, corniceH, w, 4), fill: tk("shadow"), "fill-opacity": 0.3 });
    if (p.sign) {
      const sh = Math.max(22, floorH * 0.16);
      const sy = h - floorH - sh * 0.2;
      body += el("path", { d: rectD(w * 0.12, sy - sh, w * 0.76, sh), fill: T(p.trim, f) });
      engrave.push({ id: "sign", text: p.sign.text, face: "caps", size: sh * 0.62, x: w / 2, y: sy - sh * 0.26, anchor: "middle", fill: p.sign.tok, rotate: 0 });
      anchors.sign = [Math.round(w / 2), Math.round(sy - sh / 2)];
    }
    // light: lit left edge, shade right edge
    body += el("path", { d: rectD(0, corniceH, w * 0.035, h - corniceH), fill: T(p.ramp.lit, f), "fill-opacity": 0.6 });
    body += el("path", { d: rectD(w * 0.95, corniceH, w * 0.05, h - corniceH), fill: tk("shadow"), "fill-opacity": 0.25 });
    body += rimStroke([[0, h], [0, 0], [w, 0], [w, h]], p.ramp.lit, f, 2);
    const ao = aoFoot(ids, rectD(0, h * 0.88, w, h * 0.12), h, h * 0.12, f);
    defs += ao.defs;
    body += ao.body;
    return result(w, h, defs, body, { anchors, engrave });
  },
};

// ── truss ──────────────────────────────────────────────────────────────────────────────────────────────────
export const TrussZ = z.strictObject({
  w: z.number().min(16).max(4096),
  h: z.number().min(16).max(2048),
  shape: z.enum(["through_arch", "lattice_mast", "gantry", "cage"]),
  bays: z.number().int().min(1).max(40),
  member: z.number().min(1).max(40),
  tok: TokZ,
  edge: TokZ,
  rivets: z.boolean(),
  platforms: z.array(z.number().min(0).max(1)).max(8), // heights as fractions of h from the bottom
  deckGaps: z.array(z.strictObject({ x: z.number(), w: z.number().min(1) })).max(8),
});
export type TrussP = z.infer<typeof TrussZ>;

export const truss: KitGenerator<TrussP> = {
  name: "truss",
  schema: TrussZ,
  defaults: { w: 900, h: 320, shape: "through_arch", bays: 10, member: 8, tok: "inlay.navy.dark", edge: "stone.shade", rivets: true, platforms: [], deckGaps: [] },
  generate(p): KitResult {
    const { w, h } = p;
    const m = p.member;
    let lines = "";
    let hi = "";
    const joints: Pt[] = [];
    const anchors: Record<string, [number, number]> = {};
    const seg = (a: Pt, b: Pt) => {
      lines += `M${n(a[0])} ${n(a[1])}L${n(b[0])} ${n(b[1])}`;
      hi += `M${n(a[0] - m * 0.2)} ${n(a[1] - m * 0.25)}L${n(b[0] - m * 0.2)} ${n(b[1] - m * 0.25)}`;
      joints.push(a, b);
    };
    let deck = "";
    if (p.shape === "through_arch") {
      const deckY = h - m * 2;
      const topAt = (x: number) => deckY - (deckY - m) * Math.sin((x / w) * Math.PI);
      for (let i = 0; i < p.bays; i++) {
        const x0 = (i / p.bays) * w;
        const x1 = ((i + 1) / p.bays) * w;
        seg([x0, topAt(x0)], [x1, topAt(x1)]);
        seg([x0, deckY], [x1, deckY]);
        seg([x1, deckY], [x1, topAt(x1)]);
        seg(i < p.bays / 2 ? [x0, deckY] : [x0, topAt(x0)], i < p.bays / 2 ? [x1, topAt(x1)] : [x1, deckY]);
      }
      const gaps = [...p.deckGaps].sort((a, b) => a.x - b.x);
      let x = 0;
      for (const g of gaps) {
        if (g.x > x) deck += rectD(x, deckY, g.x - x, m * 2);
        x = g.x + g.w;
      }
      if (x < w) deck += rectD(x, deckY, w - x, m * 2);
      gaps.forEach((g, i) => (anchors[`gap_${i}`] = [Math.round(g.x + g.w / 2), Math.round(deckY)]));
      anchors.top = [Math.round(w / 2), Math.round(m)];
    } else if (p.shape === "lattice_mast") {
      const topW = w * 0.18;
      for (let i = 0; i < p.bays; i++) {
        const y0 = h - (i / p.bays) * h;
        const y1 = h - ((i + 1) / p.bays) * h;
        const hw0 = (w - (w - topW) * ((h - y0) / h)) / 2;
        const hw1 = (w - (w - topW) * ((h - y1) / h)) / 2;
        seg([w / 2 - hw0, y0], [w / 2 - hw1, y1]);
        seg([w / 2 + hw0, y0], [w / 2 + hw1, y1]);
        seg([w / 2 - hw0, y0], [w / 2 + hw1, y1]);
        seg([w / 2 + hw0, y0], [w / 2 - hw1, y1]);
        seg([w / 2 - hw1, y1], [w / 2 + hw1, y1]);
      }
      anchors.top = [Math.round(w / 2), 0];
    } else if (p.shape === "gantry") {
      const beamH = Math.min(h * 0.28, m * 8);
      for (let i = 0; i < p.bays; i++) {
        const x0 = (i / p.bays) * w;
        const x1 = ((i + 1) / p.bays) * w;
        seg([x0, m], [x1, m]);
        seg([x0, beamH], [x1, beamH]);
        seg([x0, i % 2 ? m : beamH], [x1, i % 2 ? beamH : m]);
        seg([x1, m], [x1, beamH]);
      }
      seg([m, beamH], [m, h]);
      seg([w - m, beamH], [w - m, h]);
      seg([m, beamH + (h - beamH) * 0.3], [m + w * 0.06, beamH]);
      seg([w - m, beamH + (h - beamH) * 0.3], [w - m - w * 0.06, beamH]);
      anchors.top = [Math.round(w / 2), 0];
    } else {
      seg([m, m], [w - m, m]);
      seg([m, h - m], [w - m, h - m]);
      seg([m, m], [m, h - m]);
      seg([w - m, m], [w - m, h - m]);
      for (let i = 0; i < p.bays; i++) {
        const y0 = m + (i / p.bays) * (h - 2 * m);
        const y1 = m + ((i + 1) / p.bays) * (h - 2 * m);
        seg([m, y1], [w - m, y1]);
        seg([m, y0], [w - m, y1]);
      }
      anchors.top = [Math.round(w / 2), 0];
    }
    let plats = "";
    p.platforms.forEach((fr, i) => {
      const y = h - fr * h;
      plats += rectD(0, y - m, w, m * 1.6);
      anchors[`platform_${i}`] = [Math.round(w / 2), Math.round(y - m)];
    });
    let body = el("path", { d: lines, stroke: tk(p.tok), "stroke-width": m, "stroke-linecap": "square", fill: "none" });
    body += el("path", { d: hi, stroke: tk(p.edge), "stroke-width": Math.max(1, m * 0.25), "stroke-opacity": 0.7, fill: "none" });
    if (deck) body += el("path", { d: deck, fill: tk(p.tok) }) + el("path", { d: deck.replace(/v([\d.]+)/g, "v2"), fill: tk(p.edge) });
    if (plats) body += el("path", { d: plats, fill: tk(p.tok) });
    if (p.rivets) {
      const seen = new Set<string>();
      let rv = "";
      for (const [x, y] of joints) {
        const k = `${Math.round(x)}:${Math.round(y)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        rv += circleD(x, y, Math.max(1, m * 0.3));
      }
      body += el("path", { d: rv, fill: tk(p.edge) });
    }
    return result(w, h, "", body, { anchors });
  },
};

// ── shelving ───────────────────────────────────────────────────────────────────────────────────────────────
export const ShelvingZ = z.strictObject({
  w: z.number().min(16).max(4096),
  h: z.number().min(16).max(2048),
  style: z.enum(["compact_stack", "bookcase", "type_case", "rack_bays", "cork_frames", "filing_drawers"]),
  shelves: z.number().int().min(1).max(24),
  bays: z.number().int().min(1).max(24),
  fill: z.array(z.enum(["box", "film_can", "book", "cartridge", "frame", "empty"])).min(1).max(6),
  endPanel: TokZ.nullable(),
  crank: z.boolean(),
  ramp: RampZ,
  finish: FinishZ,
});
export type ShelvingP = z.infer<typeof ShelvingZ>;

export const shelving: KitGenerator<ShelvingP> = {
  name: "shelving",
  schema: ShelvingZ,
  defaults: { w: 360, h: 420, style: "bookcase", shelves: 5, bays: 3, fill: ["book", "box"], endPanel: null, crank: false, ramp: { lit: "gold.hi", base: "bronze.ring", shade: "bronze.ring|dim:0.35" }, finish: { ao: true, rim: true, haze: 0 } },
  generate(p, seed): KitResult {
    const r = rng(seed);
    const ids = new Ids("sh");
    const f = p.finish;
    const { w, h } = p;
    let defs = "";
    let body = "";
    const anchors: Record<string, [number, number]> = {};
    const frameT = Math.max(4, Math.min(w, h) * 0.035);
    const end = p.endPanel ? Math.max(18, w * 0.12) : 0;
    const x0 = end;
    const iw = w - end;
    const bayW = iw / p.bays;
    const shelfH = (h - frameT) / p.shelves;
    const g = rampDiag(ids, p.ramp, f.haze);
    defs += g.def;
    body += el("path", { d: rectD(x0, 0, iw, h), fill: g.ref });
    body += el("path", { d: rectD(x0 + frameT, frameT, iw - frameT * 2, h - frameT * 2), fill: T(`${p.ramp.shade}|dim:0.3`, f) });
    if (p.style === "cork_frames") {
      body += el("path", { d: rectD(x0 + frameT, frameT, iw - frameT * 2, h - frameT * 2), fill: T("sand.path", f) });
      let frames = "";
      let paper = "";
      for (let s = 0; s < p.shelves; s++)
        for (let b = 0; b < p.bays; b++) {
          const fw = bayW * r.range(0.55, 0.8);
          const fh = shelfH * r.range(0.55, 0.8);
          const fx = x0 + b * bayW + (bayW - fw) / 2 + r.range(-4, 4);
          const fy = frameT + s * shelfH + (shelfH - fh) / 2 + r.range(-4, 4);
          frames += rectD(fx, fy, fw, fh);
          paper += rectD(fx + 4, fy + 4, fw - 8, fh - 8);
          anchors[`bay_${s * p.bays + b}`] = [Math.round(fx + fw / 2), Math.round(fy + fh / 2)];
        }
      body += el("path", { d: frames, fill: T(p.ramp.base, f) });
      body += el("path", { d: paper, fill: T("stone.lit", f) });
      return result(w, h, defs, body, { anchors });
    }
    let boards = "";
    let posts = "";
    const items = { a: "", b: "", c: "" };
    let handles = "";
    for (let s = 0; s < p.shelves; s++) {
      const sy = frameT + (s + 1) * shelfH;
      boards += rectD(x0, sy - frameT * 0.6, iw, frameT * 0.6);
      for (let b = 0; b < p.bays; b++) {
        const bx = x0 + b * bayW;
        const inner = { x: bx + frameT * 0.8, y: sy - shelfH + frameT * 0.4, w: bayW - frameT * 1.6, h: shelfH - frameT * 1.2 };
        if (s === 0) anchors[`bay_${b}`] = [Math.round(bx + bayW / 2), Math.round(sy - frameT * 0.6)];
        if (p.style === "filing_drawers" || p.style === "type_case") {
          const dh = inner.h;
          const dd = rectD(inner.x, inner.y, inner.w, dh);
          items.a += dd;
          const hw = Math.min(inner.w * 0.3, 40);
          handles += rectD(inner.x + inner.w / 2 - hw / 2, inner.y + dh * (p.style === "type_case" ? 0.4 : 0.55), hw, Math.max(3, dh * 0.08));
          if (p.style === "filing_drawers") {
            handles += rectD(inner.x + inner.w / 2 - hw * 0.4, inner.y + dh * 0.2, hw * 0.8, Math.max(6, dh * 0.18));
            anchors[`drawer_${s * p.bays + b}`] = [Math.round(inner.x + inner.w / 2), Math.round(inner.y + dh * 0.29)];
          }
          continue;
        }
        let x = inner.x;
        while (x < inner.x + inner.w - 4) {
          const kind = r.pick(p.fill);
          if (kind === "empty") {
            x += inner.w * 0.3;
            continue;
          }
          const slot = kind === "book" ? r.range(6, 12) : kind === "film_can" ? inner.h * 0.5 : r.range(inner.w * 0.2, inner.w * 0.4);
          if (x + slot > inner.x + inner.w) break;
          const ih = kind === "book" ? inner.h * r.range(0.7, 0.98) : kind === "film_can" ? inner.h * 0.3 : inner.h * r.range(0.5, 0.85);
          const d = kind === "film_can" ? circleD(x + slot / 2, inner.y + inner.h - slot / 2, slot / 2) : roundRectD(x, inner.y + inner.h - ih, slot - 1.5, ih, kind === "cartridge" ? 4 : 0.5);
          const pickT = r.next();
          if (pickT < 0.4) items.a += d;
          else if (pickT < 0.75) items.b += d;
          else items.c += d;
          x += slot;
        }
      }
    }
    for (let b = 0; b <= p.bays; b++) posts += rectD(x0 + b * bayW - frameT / 2, 0, frameT, h);
    if (p.style === "filing_drawers" || p.style === "type_case") {
      body += el("path", { d: items.a, fill: T(p.ramp.base, f) });
      body += el("path", { d: items.a, fill: "none", stroke: T(p.ramp.lit, f), "stroke-width": 1.2, "stroke-opacity": 0.8 });
      body += el("path", { d: handles, fill: T("gold.base", f) });
    } else {
      body += el("path", { d: items.a, fill: T("stone.base", f) });
      body += el("path", { d: items.b, fill: T("inlay.navy", f) });
      body += el("path", { d: items.c, fill: T("foliage.rust", f) });
    }
    body += el("path", { d: boards, fill: T(p.ramp.base, f) });
    body += el("path", { d: boards.replace(/v[\d.]+/g, "v1.5"), fill: T(p.ramp.lit, f) });
    body += el("path", { d: posts, fill: g.ref });
    if (p.endPanel) {
      const ep = rampCyl(ids, { lit: `${p.endPanel}|light:0.2`, base: p.endPanel, shade: `${p.endPanel}|dim:0.3` }, f.haze);
      defs += ep.def;
      body += el("path", { d: rectD(0, 0, end, h), fill: ep.ref });
      if (p.crank) {
        const cr = end * 0.36;
        const cy = h * 0.45;
        body += el("path", { d: circleD(end / 2, cy, cr), fill: "none", stroke: T("gold.base", f), "stroke-width": Math.max(2, cr * 0.25) });
        body += el("path", { d: `M${n(end / 2 - cr)} ${n(cy)}H${n(end / 2 + cr)}M${n(end / 2)} ${n(cy - cr)}V${n(cy + cr)}`, stroke: T("gold.base", f), "stroke-width": 2 });
        anchors.crank = [Math.round(end / 2), Math.round(cy)];
      }
    }
    const cs = contactShadow(ids, w / 2, h - 2, w * 0.5, 5, 3);
    defs += cs.defs;
    body = cs.body + body;
    body += rimStroke([[x0, h], [x0, 0], [w, 0], [w, h]], p.ramp.lit, f, 1.5);
    return result(w, h, defs, body, { anchors });
  },
};

export { openingD };

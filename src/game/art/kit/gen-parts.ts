/**
 * Ground, plates, linear parts, gauges and consoles (02 §3a.2): groundStrip, plate, linkStrip, gauge, lectern.
 */
import { z } from "zod";
import { rng } from "./rng";
import { blur, contactShadow, linear, radial, rampCyl, rampDiag, rampV, rimStroke } from "./shade";
import { circleD, el, Ids, n, poly, rectD, result, roundRectD, tk, type Pt } from "./svg";
import { RampZ, TokZ, type EngraveReq, type KitGenerator, type KitResult, type Ramp } from "./types";

const STONE: Ramp = { lit: "stone.lit", base: "stone.base", shade: "stone.shade" };
const GOLD: Ramp = { lit: "gold.hi", base: "gold.base", shade: "gold.deep" };

// ── groundStrip ────────────────────────────────────────────────────────────────────────────────────────────
export const GroundStripZ = z.strictObject({
  w: z.number().int().min(16).max(4096),
  h: z.number().int().min(8).max(1024),
  style: z.enum(["polygon_paving", "sidewalk", "brick_plaza", "marble", "wood_floor", "grate", "causeway", "sand", "ledge_cap"]),
  ramp: RampZ,
  lip: TokZ.nullable(),
  grassEdge: RampZ.nullable(),
  wet: z.boolean(),
});
export type GroundStripP = z.infer<typeof GroundStripZ>;

export const groundStrip: KitGenerator<GroundStripP> = {
  name: "groundStrip",
  schema: GroundStripZ,
  defaults: { w: 512, h: 208, style: "polygon_paving", ramp: STONE, lip: "gold.base", grassEdge: null, wet: false },
  generate(p, seed): KitResult {
    const r = rng(seed);
    const ids = new Ids("gs");
    const { w, h } = p;
    let defs = "";
    let body = "";
    const band = Math.min(h * 0.28, 56); // the walkable top surface band
    const face = rampV(ids, { lit: p.ramp.base, base: p.ramp.shade, shade: `${p.ramp.shade}|dim:0.35` });
    defs += face.def;
    body += el("path", { d: rectD(0, 0, w, h), fill: face.ref });
    const wrap = (x: number, bw: number, fn: (x: number) => string) => fn(x) + (x + bw > w ? fn(x - w) : "") + (x < 0 ? fn(x + w) : "");
    let lit = "";
    let base = "";
    let joints = "";
    if (p.style === "polygon_paving" || p.style === "causeway") {
      let x = 0;
      while (x < w) {
        const sw = r.range(34, 70);
        const j = r.range(-5, 5);
        const stone = (sx: number): string =>
          p.style === "causeway"
            ? roundRectD(sx + 2, 3, sw - 4, band - 6, (band - 6) / 2)
            : poly([[sx + 2, 3], [sx + sw - 2 + j, 2], [sx + sw + j * 0.5, band * 0.55], [sx + sw - 4, band - 3], [sx + 3, band - 2], [sx, band * 0.45]]);
        if (r.chance(0.35)) lit += wrap(x, sw, stone);
        else base += wrap(x, sw, stone);
        x += sw;
      }
    } else if (p.style === "sidewalk" || p.style === "marble" || p.style === "sand") {
      base += rectD(0, 0, w, band);
      if (p.style !== "sand") for (let x = 0; x < w; x += p.style === "sidewalk" ? 64 : 128) joints += `M${n(x)} 2v${n(band - 4)}`;
      if (p.style === "marble") {
        for (let i = 0; i < w / 90; i++) {
          const x = r.range(0, w - 60);
          joints += `M${n(x)} ${n(r.range(4, band - 4))}q${n(20)} ${n(r.range(-6, 6))} ${n(r.range(40, 70))} ${n(r.range(-4, 4))}`;
        }
      }
      if (p.style === "sand") {
        let specks = "";
        for (let i = 0; i < w / 6; i++) specks += rectD(r.range(0, w - 2), r.range(2, h - 2), 1.5, 1.5);
        body += el("path", { d: specks, fill: tk(p.ramp.lit), "fill-opacity": 0.6 });
      }
    } else if (p.style === "brick_plaza") {
      for (let row = 0; row * 10 < band; row++) {
        for (let x = row % 2 ? -12 : 0; x < w; x += 24) {
          const d = wrap(x, 24, (sx) => rectD(sx + 1, row * 10 + 1, 22, 8));
          if (r.chance(0.3)) lit += d;
          else base += d;
        }
      }
    } else if (p.style === "wood_floor") {
      for (let row = 0; row * 9 < band; row++) {
        let x = -r.range(0, 120);
        while (x < w) {
          const pl = r.range(90, 180);
          const d = wrap(x, pl, (sx) => rectD(sx + 0.5, row * 9 + 0.5, pl - 1, 8));
          if (r.chance(0.35)) lit += d;
          else base += d;
          x += pl;
        }
      }
    } else if (p.style === "grate") {
      base += rectD(0, 0, w, band);
      for (let x = 0; x < w; x += 16) joints += `M${n(x)} 0v${n(band)}`;
      joints += `M0 ${n(band / 2)}H${n(w)}`;
    } else {
      // ledge_cap: a thick stone cap with a rounded nose and a shadow under it
      base += rectD(0, 0, w, band);
      for (let x = 0; x < w; x += 128) joints += `M${n(x)} 0v${n(band)}`;
      body += el("path", { d: rectD(0, band, w, 10), fill: tk("shadow"), "fill-opacity": 0.35 });
    }
    body += el("path", { d: base, fill: tk(p.ramp.base) });
    if (lit) body += el("path", { d: lit, fill: tk(p.ramp.lit) });
    if (joints) body += el("path", { d: joints, stroke: tk(p.ramp.shade), "stroke-width": 1.5, "stroke-opacity": 0.8, fill: "none" });
    // front face: a few embedded stones and strata
    let face2 = "";
    for (let i = 0; i < w / 70; i++) {
      const x = r.range(0, w - 40);
      const y = r.range(band + 12, h - 12);
      face2 += roundRectD(x, y, r.range(20, 44), r.range(8, 16), 5);
    }
    body += el("path", { d: face2, fill: tk(p.ramp.base), "fill-opacity": 0.45 });
    body += el("path", { d: rectD(0, band, w, 3), fill: tk("shadow"), "fill-opacity": 0.35 });
    if (p.lip) {
      body += el("path", { d: rectD(0, 0, w, 4), fill: tk(p.lip) });
      body += el("path", { d: rectD(0, 0, w, 1.5), fill: tk("haze"), "fill-opacity": 0.5 });
    } else body += el("path", { d: rectD(0, 0, w, 2), fill: tk(p.ramp.lit) });
    if (p.grassEdge) {
      let dark = "";
      let light = "";
      let x = 0;
      while (x < w) {
        const bw = r.range(8, 16);
        const bh = r.range(8, 22);
        const tuft = (sx: number) => poly([[sx, 2], [sx + bw * 0.3, -bh], [sx + bw * 0.55, 1], [sx + bw * 0.75, -bh * 0.7], [sx + bw, 2], [sx + bw, 7], [sx, 7]]);
        const d = wrap(x, bw, tuft);
        if (r.chance(0.5)) dark += d;
        else light += d;
        x += bw * 0.8;
      }
      // tufts rise above y = 0: shift the whole strip down so they stay in the viewBox
      body += el("path", { d: dark, fill: tk(p.grassEdge.shade) }) + el("path", { d: light, fill: tk(p.grassEdge.base) });
    }
    if (p.wet) {
      let sheen = "";
      for (let i = 0; i < w / 60; i++) sheen += `M${n(r.range(0, w - 50))} ${n(r.range(4, band - 4))}h${n(r.range(20, 50))}`;
      body += el("path", { d: sheen, stroke: tk("haze"), "stroke-opacity": 0.45, "stroke-width": 2, "stroke-linecap": "round", fill: "none" });
    }
    if (p.grassEdge) {
      // the grass pokes up to 22 px above the walk line: grow the viewBox upward and keep the walk line at pivot y
      const top = 24;
      return {
        ...result(w, h + top, defs, el("g", { transform: `translate(0 ${top})` }, body), { pivot: [0, top / (h + top)], tileWidth: w, anchors: { walk: [0, top] } }),
      };
    }
    return result(w, h, defs, body, { pivot: [0, 0], tileWidth: w, anchors: { walk: [0, 0] } });
  },
};

// ── plate ──────────────────────────────────────────────────────────────────────────────────────────────────
export const PlateZ = z.strictObject({
  w: z.number().min(4).max(2048),
  h: z.number().min(4).max(2048),
  style: z.enum(["brass_plaque", "slate", "paper_card", "slide_mat", "flip_cell", "cartridge", "raft", "sign_blade", "front_page", "slab", "junction_box"]),
  bevel: z.number().min(0).max(64),
  rivets: z.union([z.literal(0), z.literal(2), z.literal(4)]),
  screen: z.boolean(), // ui.card face with a cyan edge
  ramp: RampZ,
  face: TokZ,
  engraved: z.strictObject({ text: z.string().min(1).max(40), face: z.enum(["caps", "serif"]), size: z.number().min(4).max(120) }).nullable(), // fixed wordmark only, 02 §3e
});
export type PlateP = z.infer<typeof PlateZ>;

export const plate: KitGenerator<PlateP> = {
  name: "plate",
  schema: PlateZ,
  defaults: { w: 200, h: 120, style: "brass_plaque", bevel: 8, rivets: 4, screen: false, ramp: GOLD, face: "gold.base", engraved: null },
  generate(p): KitResult {
    const ids = new Ids("pl");
    const { w, h } = p;
    let defs = "";
    let body = "";
    const engrave: EngraveReq[] = [];
    const b = Math.min(p.bevel, w / 4, h / 4);
    const rad = p.style === "cartridge" ? Math.min(w, h) * 0.18 : p.style === "paper_card" || p.style === "front_page" ? 1 : Math.min(6, b);
    let top = 0;
    const anchors: Record<string, [number, number]> = {};
    if (p.style === "sign_blade") {
      top = h * 0.18;
      body += el("path", { d: circleD(w * 0.25, top * 0.45, top * 0.35) + circleD(w * 0.75, top * 0.45, top * 0.35), fill: "none", stroke: tk(p.ramp.shade), "stroke-width": 2 });
    }
    const outer = roundRectD(0, top, w, h - top, rad);
    if (p.style === "paper_card" || p.style === "front_page") {
      const bl = blur(ids, 2);
      defs += bl.def;
      body += el("path", { d: roundRectD(3, top + 4, w - 3, h - top - 4, rad), fill: tk("shadow"), "fill-opacity": 0.3, filter: bl.ref });
    }
    const g = rampDiag(ids, p.ramp);
    defs += g.def;
    body += el("path", { d: outer, fill: g.ref });
    const fx = b;
    const fy = top + b;
    const fw = w - 2 * b;
    const fh = h - top - 2 * b;
    const faceTok = p.screen ? "ui.card" : p.face;
    if (p.style === "raft") {
      let planks = "";
      for (let x = 0; x < w; x += 22) planks += `M${n(x)} ${n(top)}v${n(h - top)}`;
      body += el("path", { d: planks, stroke: tk(p.ramp.shade), "stroke-width": 2, fill: "none" });
    } else if (p.style === "slide_mat") {
      body += el("path", { d: rectD(fx, fy, fw, fh), fill: tk(p.face) });
      body += el("path", { d: rectD(fx + fw * 0.15, fy + fh * 0.15, fw * 0.7, fh * 0.7), fill: tk("inlay.navy.dark"), "fill-opacity": 0.85 });
    } else if (b > 0 || p.screen) {
      body += el("path", { d: roundRectD(fx, fy, fw, fh, Math.max(0, rad - b / 2)), fill: tk(faceTok) });
      // inner bevel: shade on the top-left inner edge, light on the bottom-right (recessed face)
      body += el("path", { d: `M${n(fx)} ${n(fy + fh)}V${n(fy)}H${n(fx + fw)}`, stroke: tk("shadow"), "stroke-opacity": 0.35, "stroke-width": 1.5, fill: "none" });
      body += el("path", { d: `M${n(fx)} ${n(fy + fh)}H${n(fx + fw)}V${n(fy)}`, stroke: tk(p.ramp.lit), "stroke-opacity": 0.8, "stroke-width": 1.5, fill: "none" });
    }
    if (p.screen) body += el("path", { d: roundRectD(fx, fy, fw, fh, Math.max(0, rad - b / 2)), fill: "none", stroke: tk("glow.cyan"), "stroke-width": 1.5, "stroke-opacity": 0.9 });
    if (p.style === "flip_cell") body += el("path", { d: rectD(fx, fy + fh / 2 - 1, fw, 2), fill: tk("shadow"), "fill-opacity": 0.6 });
    if (p.style === "cartridge") body += el("path", { d: roundRectD(fx + fw * 0.12, fy + fh * 0.2, fw * 0.76, fh * 0.45, 3), fill: tk("stone.lit"), "fill-opacity": 0.9 });
    if (p.style === "front_page") {
      let cols = "";
      const mast = fh * 0.16;
      for (let c = 0; c < 4; c++) for (let y = fy + mast + 10; y < fy + fh - 4; y += 6) cols += rectD(fx + 4 + (c * (fw - 8)) / 4, y, (fw - 8) / 4 - 6, 2);
      body += el("path", { d: cols, fill: tk("inlay.navy.dark"), "fill-opacity": 0.35 });
      body += el("path", { d: rectD(fx + 4, fy + mast + 4, fw - 8, 1.5), fill: tk("inlay.navy.dark"), "fill-opacity": 0.6 });
    }
    if (p.style === "junction_box") {
      let vents = "";
      for (let y = fy + fh * 0.55; y < fy + fh - 6; y += 7) vents += rectD(fx + fw * 0.2, y, fw * 0.6, 2.5);
      body += el("path", { d: vents, fill: tk("shadow"), "fill-opacity": 0.45 });
      if (p.screen) {
        const lg = radial(ids, [[0, "glow.cyan"], [1, "glow.cyan", 0]]);
        defs += lg.def;
        body += el("path", { d: circleD(w / 2, fy + fh * 0.3, Math.min(fw, fh) * 0.16), fill: lg.ref });
      }
    }
    if (p.style === "slab") body += el("path", { d: rectD(0, h - h * 0.18, w, h * 0.18), fill: tk("shadow"), "fill-opacity": 0.25 });
    if (p.rivets > 0) {
      const rr = Math.max(1.5, Math.min(w, h) * 0.03);
      const off = Math.max(rr * 1.8, b * 0.5);
      const pts: Pt[] = p.rivets === 2 ? [[off, top + (h - top) / 2], [w - off, top + (h - top) / 2]] : [[off, top + off], [w - off, top + off], [off, h - off], [w - off, h - off]];
      body += el("path", { d: pts.map(([x, y]) => circleD(x, y, rr)).join(""), fill: tk(p.ramp.lit), stroke: tk(p.ramp.shade), "stroke-width": 0.8 });
    }
    body += rimStroke([[0, h], [0, top], [w, top], [w, h]], p.ramp.lit, { ao: false, rim: p.style !== "paper_card", haze: 0 }, 1.5, 0.7);
    anchors.label = [Math.round(w / 2), Math.round(top + (h - top) / 2)];
    if (p.engraved) {
      const ty = p.style === "front_page" ? fy + fh * 0.13 : top + (h - top) / 2 + p.engraved.size * 0.35;
      engrave.push({ id: "engraved", text: p.engraved.text, face: p.engraved.face, size: p.engraved.size, x: w / 2, y: ty, anchor: "middle", fill: p.screen ? "ui.line" : p.style === "front_page" ? "inlay.navy.dark" : p.ramp.shade, rotate: 0 });
    }
    return result(w, h, defs, body, { pivot: [0.5, 0.5], anchors, engrave });
  },
};

// ── linkStrip ──────────────────────────────────────────────────────────────────────────────────────────────
export const LinkStripZ = z.strictObject({
  len: z.number().min(4).max(4096),
  axis: z.enum(["x", "y"]),
  style: z.enum(["chain", "cable", "pipe", "tube_window", "rail", "ladder", "microtubule", "rod"]),
  thick: z.number().min(1).max(200),
  bandEvery: z.number().min(4).nullable(),
  band: TokZ.nullable(),
  ramp: RampZ,
});
export type LinkStripP = z.infer<typeof LinkStripZ>;

export const linkStrip: KitGenerator<LinkStripP> = {
  name: "linkStrip",
  schema: LinkStripZ,
  defaults: { len: 256, axis: "y", style: "chain", thick: 14, bandEvery: null, band: null, ramp: { lit: "gold.hi", base: "bronze.ring", shade: "bronze.ring|dim:0.3" } },
  generate(p): KitResult {
    const ids = new Ids("ls");
    const L = p.len;
    const t = p.thick;
    let defs = "";
    let body = "";
    const cyl = rampCyl(ids, p.ramp, 0, false); // lit at the top of a horizontal strip
    defs += cyl.def;
    const period = (target: number) => L / Math.max(1, Math.round(L / target));
    if (p.style === "chain") {
      const pl = period(t * 1.7);
      let face = "";
      let side = "";
      for (let x = 0, i = 0; x < L - 0.01; x += pl, i++) {
        if (i % 2 === 0) face += roundRectD(x - t * 0.15, 0, pl * 1.3, t, t / 2) + roundRectD(x + t * 0.2, t * 0.3, pl * 1.3 - t * 0.7, t * 0.4, t * 0.2);
        else side += roundRectD(x - t * 0.1, t * 0.32, pl * 1.2, t * 0.36, t * 0.18);
      }
      body += el("path", { d: face, fill: cyl.ref, "fill-rule": "evenodd" });
      body += el("path", { d: side, fill: tk(p.ramp.shade) });
    } else if (p.style === "cable") {
      const pl = period(t * 2);
      let a = "";
      let b = "";
      for (let x = 0; x < L - 0.01; x += pl) {
        a += `M${n(x)} ${n(t * 0.3)}C${n(x + pl * 0.35)} ${n(t * 0.05)} ${n(x + pl * 0.65)} ${n(t * 0.95)} ${n(x + pl)} ${n(t * 0.7)}`;
        b += `M${n(x)} ${n(t * 0.7)}C${n(x + pl * 0.35)} ${n(t * 0.95)} ${n(x + pl * 0.65)} ${n(t * 0.05)} ${n(x + pl)} ${n(t * 0.3)}`;
      }
      body += el("path", { d: b, stroke: tk(p.ramp.shade), "stroke-width": t * 0.45, fill: "none" });
      body += el("path", { d: a, stroke: tk(p.ramp.base), "stroke-width": t * 0.45, fill: "none" });
      body += el("path", { d: a, stroke: tk(p.ramp.lit), "stroke-width": t * 0.12, "stroke-opacity": 0.7, fill: "none", transform: `translate(0 ${n(-t * 0.08)})` });
    } else if (p.style === "tube_window") {
      const g = linear(ids, [[0, p.ramp.lit, 0.55], [0.5, p.ramp.base, 0.25], [1, p.ramp.shade, 0.55]], 0, 0, 0, 1);
      defs += g.def;
      body += el("path", { d: rectD(0, 0, L, t), fill: g.ref });
      body += el("path", { d: rectD(0, 0, L, 2) + rectD(0, t - 2, L, 2), fill: tk(p.ramp.shade) });
      body += el("path", { d: rectD(0, t * 0.22, L, t * 0.08), fill: tk("haze"), "fill-opacity": 0.7 });
    } else if (p.style === "rail") {
      body += el("path", { d: rectD(0, 0, L, t * 0.28) + rectD(0, t * 0.72, L, t * 0.28), fill: cyl.ref });
      body += el("path", { d: rectD(0, t * 0.28, L, t * 0.44), fill: tk(p.ramp.shade) });
    } else if (p.style === "ladder") {
      body += el("path", { d: rectD(0, 0, L, t * 0.14) + rectD(0, t * 0.86, L, t * 0.14), fill: cyl.ref });
      const pl = period(t * 0.8);
      let rungs = "";
      for (let x = pl / 2; x < L; x += pl) rungs += rectD(x - t * 0.05, t * 0.14, t * 0.1, t * 0.72);
      body += el("path", { d: rungs, fill: tk(p.ramp.base) });
    } else if (p.style === "microtubule") {
      const pl = period(t * 0.5);
      let a = "";
      let b = "";
      for (let x = pl / 2, i = 0; x < L; x += pl, i++) {
        for (let row = 0; row < 3; row++) {
          const d = circleD(x + (row % 2 ? pl / 2 : 0), t * (0.2 + row * 0.3), t * 0.16);
          if ((i + row) % 3 === 0) b += d;
          else a += d;
        }
      }
      body += el("path", { d: a, fill: tk(p.ramp.base) });
      body += el("path", { d: b, fill: tk(p.ramp.lit) });
    } else {
      body += el("path", { d: rectD(0, 0, L, t), fill: cyl.ref });
      if (p.style === "pipe") body += el("path", { d: rectD(0, t * 0.18, L, t * 0.1), fill: tk("haze"), "fill-opacity": 0.35 });
    }
    if (p.bandEvery && p.band) {
      const pl = period(p.bandEvery);
      let bands = "";
      for (let x = pl / 2; x < L; x += pl) bands += rectD(x - t * 0.18, -t * 0.08, t * 0.36, t * 1.16);
      body += el("path", { d: bands, fill: tk(p.band) });
    }
    if (p.axis === "y") {
      return result(t, L, defs, el("g", { transform: `translate(${n(t)} 0) rotate(90)` }, body), { pivot: [0.5, 0], tileWidth: null });
    }
    return result(L, t, defs, body, { pivot: [0, 0.5], tileWidth: Math.round(L) === L && L >= 64 && L <= 2048 ? L : null });
  },
};

// ── gauge ──────────────────────────────────────────────────────────────────────────────────────────────────
export const GaugeZ = z.strictObject({
  kind: z.enum(["ruler_v", "ruler_h", "arc_meter", "height_rod"]),
  len: z.number().min(16).max(2048),
  ticks: z.array(z.strictObject({ at: z.number().min(0).max(1), major: z.boolean(), label: z.string().min(1).max(12).nullable() })).max(64),
  ramp: RampZ,
  tickTok: TokZ,
  backing: TokZ.nullable(),
  legend: z.string().min(1).max(24).nullable(), // e.g. "SIGNAL"
});
export type GaugeP = z.infer<typeof GaugeZ>;

export const gauge: KitGenerator<GaugeP> = {
  name: "gauge",
  schema: GaugeZ,
  defaults: {
    kind: "ruler_v",
    len: 320,
    ticks: [
      { at: 0, major: true, label: null },
      { at: 0.25, major: false, label: null },
      { at: 0.5, major: true, label: null },
      { at: 0.75, major: false, label: null },
      { at: 1, major: true, label: null },
    ],
    ramp: GOLD,
    tickTok: "inlay.navy",
    backing: "stone.lit",
    legend: null,
  },
  generate(p): KitResult {
    const ids = new Ids("ga");
    let defs = "";
    let body = "";
    const anchors: Record<string, [number, number]> = {};
    const engrave: EngraveReq[] = [];
    const L = p.len;
    if (p.kind === "arc_meter") {
      const R = L / 2;
      const W = L + 16;
      const H = R + 40;
      const cx = W / 2;
      const cy = R + 8;
      const g = rampDiag(ids, p.ramp);
      defs += g.def;
      body += el("path", { d: `M${n(cx - R - 6)} ${n(cy + 8)}A${n(R + 6)} ${n(R + 6)} 0 0 1 ${n(cx + R + 6)} ${n(cy + 8)}Z`, fill: g.ref });
      if (p.backing) body += el("path", { d: `M${n(cx - R)} ${n(cy)}A${n(R)} ${n(R)} 0 0 1 ${n(cx + R)} ${n(cy)}Z`, fill: tk(p.backing) });
      let ticks = "";
      p.ticks.forEach((t, i) => {
        const a = Math.PI + t.at * Math.PI;
        const len = t.major ? R * 0.16 : R * 0.09;
        ticks += `M${n(cx + Math.cos(a) * (R - 4))} ${n(cy + Math.sin(a) * (R - 4))}L${n(cx + Math.cos(a) * (R - 4 - len))} ${n(cy + Math.sin(a) * (R - 4 - len))}`;
        anchors[`t_${i}`] = [Math.round(cx + Math.cos(a) * (R - 4)), Math.round(cy + Math.sin(a) * (R - 4))];
        if (t.label) engrave.push({ id: `t_${i}`, text: t.label, face: "serif", size: R * 0.12, x: cx + Math.cos(a) * R * 0.66, y: cy + Math.sin(a) * R * 0.66 + R * 0.04, anchor: "middle", fill: p.tickTok, rotate: 0 });
      });
      body += el("path", { d: ticks, stroke: tk(p.tickTok), "stroke-width": Math.max(1.5, R * 0.025), fill: "none" });
      body += el("path", { d: circleD(cx, cy, R * 0.07), fill: tk(p.ramp.shade) });
      if (p.legend) engrave.push({ id: "legend", text: p.legend, face: "caps", size: Math.max(8, R * 0.13), x: cx, y: cy + 28, anchor: "middle", fill: p.tickTok, rotate: 0 });
      anchors.hub = [Math.round(cx), Math.round(cy)];
      const nl = R * 0.85;
      const needle = result(12, nl + 6, "", el("path", { d: poly([[6, 0], [9, nl], [6, nl + 6], [3, nl]]), fill: tk("ui.accent.deep") }), { pivot: [0.5, nl / (nl + 6)], anchors: { tip: [6, 0] } });
      return { ...result(W, H, defs, body, { pivot: [0.5, 1], anchors, engrave }), extras: { needle } };
    }
    const vertical = p.kind !== "ruler_h";
    const thick = p.kind === "height_rod" ? 16 : 44;
    const W = vertical ? thick : L;
    const H = vertical ? L : thick;
    const g = rampCyl(ids, p.ramp, 0, vertical);
    defs += g.def;
    body += el("path", { d: roundRectD(0, 0, W, H, 4), fill: g.ref });
    if (p.backing && p.kind !== "height_rod") body += el("path", { d: rectD(vertical ? 6 : 4, vertical ? 4 : 6, vertical ? W - 12 : W - 8, vertical ? H - 8 : H - 12), fill: tk(p.backing) });
    let ticks = "";
    p.ticks.forEach((t, i) => {
      const len = t.major ? thick * 0.45 : thick * 0.25;
      if (vertical) {
        const y = H - 6 - t.at * (H - 12);
        ticks += `M${n(p.kind === "height_rod" ? 0 : 6)} ${n(y)}h${n(p.kind === "height_rod" ? W : len)}`;
        anchors[`t_${i}`] = [Math.round(W / 2), Math.round(y)];
        if (t.label) engrave.push({ id: `t_${i}`, text: t.label, face: "serif", size: thick * 0.32, x: W - 6, y: y + thick * 0.11, anchor: "end", fill: p.tickTok, rotate: 0 });
      } else {
        const x = 6 + t.at * (W - 12);
        ticks += `M${n(x)} 6v${n(len)}`;
        anchors[`t_${i}`] = [Math.round(x), Math.round(H / 2)];
        if (t.label) engrave.push({ id: `t_${i}`, text: t.label, face: "serif", size: thick * 0.32, x, y: H - 6, anchor: "middle", fill: p.tickTok, rotate: 0 });
      }
    });
    body += el("path", { d: ticks, stroke: tk(p.tickTok), "stroke-width": 2, fill: "none" });
    if (p.legend) engrave.push({ id: "legend", text: p.legend, face: "caps", size: thick * 0.3, x: W / 2, y: vertical ? 16 : H / 2 + 4, anchor: "middle", fill: p.tickTok, rotate: 0 });
    return result(W, H, defs, body, { pivot: vertical ? [0.5, 1] : [0, 0.5], anchors, engrave });
  },
};

// ── lectern ────────────────────────────────────────────────────────────────────────────────────────────────
export const LecternZ = z.strictObject({
  h: z.number().min(24).max(1024),
  style: z.enum(["lectern", "kiosk", "transit", "microfilm"]),
  ramp: RampZ,
  trim: TokZ,
  screen: TokZ,
  emblem: z.boolean(),
});
export type LecternP = z.infer<typeof LecternZ>;

export const lectern: KitGenerator<LecternP> = {
  name: "lectern",
  schema: LecternZ,
  defaults: { h: 120, style: "lectern", ramp: STONE, trim: "gold.base", screen: "ui.card", emblem: true },
  generate(p): KitResult {
    const ids = new Ids("le");
    const h = p.h;
    const w = 0.9 * h;
    let defs = "";
    let body = "";
    const anchors: Record<string, [number, number]> = {};
    const g = rampCyl(ids, p.ramp);
    defs += g.def;
    const cs = contactShadow(ids, w / 2, h - 2, w * 0.4, 4, 2.5);
    defs += cs.defs;
    body += cs.body;
    const glow = radial(ids, [[0, "glow.cyan", 0.6], [1, "glow.cyan", 0]]);
    defs += glow.def;
    if (p.style === "lectern") {
      const stem: Pt[] = [[w * 0.36, h * 0.3], [w * 0.64, h * 0.3], [w * 0.7, h * 0.88], [w * 0.3, h * 0.88]];
      body += el("path", { d: poly(stem), fill: g.ref });
      body += el("path", { d: roundRectD(w * 0.12, h * 0.86, w * 0.76, h * 0.14, 3), fill: tk(p.ramp.base) });
      body += el("path", { d: rectD(w * 0.12, h * 0.86, w * 0.76, 2.5), fill: tk(p.trim) });
      const top: Pt[] = [[w * 0.02, h * 0.3], [w * 0.1, h * 0.12], [w * 0.98, h * 0.02], [w * 0.98, h * 0.2]];
      body += el("path", { d: poly(top), fill: tk(p.ramp.lit) });
      body += el("path", { d: poly([[w * 0.02, h * 0.3], [w * 0.98, h * 0.2], [w * 0.98, h * 0.26], [w * 0.04, h * 0.36]]), fill: tk(p.ramp.shade) });
      const scr: Pt[] = [[w * 0.14, h * 0.24], [w * 0.2, h * 0.14], [w * 0.88, h * 0.07], [w * 0.88, h * 0.17]];
      body += el("path", { d: poly(scr), fill: tk(p.screen) });
      body += el("path", { d: poly(scr), fill: "none", stroke: tk("glow.cyan"), "stroke-width": 1.2, "stroke-opacity": 0.9 });
      body += el("ellipse", { cx: w * 0.52, cy: h * 0.12, rx: w * 0.42, ry: h * 0.1, fill: glow.ref });
      body += el("path", { d: poly([[w * 0.02, h * 0.3], [w * 0.98, h * 0.2]], false), stroke: tk(p.trim), "stroke-width": 2, fill: "none" });
      if (p.emblem) {
        body += el("path", { d: circleD(w / 2, h * 0.55, w * 0.1), fill: "none", stroke: tk(p.trim), "stroke-width": 2.5 });
        body += el("path", { d: circleD(w / 2, h * 0.55, w * 0.045), fill: tk("inlay.navy") });
      }
      anchors.screen = [Math.round(w * 0.52), Math.round(h * 0.13)];
      anchors.console = [Math.round(w * 0.5), Math.round(h * 0.3)];
    } else {
      const boxTop = p.style === "transit" ? h * 0.08 : h * 0.18;
      const boxH = p.style === "kiosk" ? h * 0.82 : p.style === "microfilm" ? h * 0.5 : h * 0.62;
      const bx = p.style === "transit" ? w * 0.28 : w * 0.06;
      const bw = p.style === "transit" ? w * 0.44 : w * 0.88;
      body += el("path", { d: roundRectD(bx, boxTop, bw, boxH, 6), fill: g.ref });
      if (p.style !== "kiosk") body += el("path", { d: rectD(w / 2 - w * 0.08, boxTop + boxH, w * 0.16, h - boxTop - boxH), fill: tk(p.ramp.shade) });
      if (p.style === "microfilm") body += el("path", { d: poly([[bx, boxTop], [bx + bw * 0.1, boxTop - h * 0.14], [bx + bw * 0.9, boxTop - h * 0.14], [bx + bw, boxTop]]), fill: tk(p.ramp.shade) });
      const sx = bx + bw * 0.14;
      const sy = boxTop + boxH * 0.12;
      const sw = bw * 0.72;
      const sh = boxH * (p.style === "kiosk" ? 0.34 : 0.46);
      body += el("path", { d: roundRectD(sx, sy, sw, sh, 3), fill: tk(p.screen), stroke: tk("glow.cyan"), "stroke-width": 1.2 });
      body += el("ellipse", { cx: sx + sw / 2, cy: sy + sh / 2, rx: sw * 0.6, ry: sh * 0.7, fill: glow.ref });
      body += el("path", { d: rectD(bx, boxTop, bw, 3), fill: tk(p.trim) });
      if (p.emblem) body += el("path", { d: circleD(bx + bw / 2, boxTop + boxH * 0.8, Math.min(bw, boxH) * 0.08), fill: "none", stroke: tk(p.trim), "stroke-width": 2 });
      anchors.screen = [Math.round(sx + sw / 2), Math.round(sy + sh / 2)];
      anchors.console = [Math.round(bx + bw / 2), Math.round(sy + sh)];
      body += el("path", { d: rectD(0, h - 4, w, 4), fill: tk(p.ramp.base) });
    }
    return result(w, h, defs, body, { anchors });
  },
};


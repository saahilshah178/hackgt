/**
 * Far and mid silhouette generators (02 §3a.2): ridgeBand, skyline, canopy, crystalCluster.
 */
import { z } from "zod";
import { rng, type Rng } from "./rng";
import { aoFoot, blur, contactShadow, radial, rampCyl, rimStroke } from "./shade";
import { blobD, clamp, curveD, el, hz, Ids, n, poly, rectD, result, tk, type Pt } from "./svg";
import { FinishZ, RampZ, TokZ, type KitGenerator, type KitResult } from "./types";

// ── ridgeBand ──────────────────────────────────────────────────────────────────────────────────────────────
export const RidgeBandZ = z.strictObject({
  w: z.number().int().min(128).max(4096),
  h: z.number().int().min(32).max(2048),
  style: z.enum(["butte_fluted", "mesa", "dome", "bluff", "cell_dome", "chasm_edge"]),
  peaks: z.number().int().min(1).max(16),
  height: z.tuple([z.number().min(0), z.number().min(0)]),
  flutes: z.number().int().min(0).max(24),
  ramp: RampZ,
  rimLine: TokZ.nullable(), // double membrane rim for cell_dome
  finish: FinishZ,
});
export type RidgeBandP = z.infer<typeof RidgeBandZ>;

/** A periodic low-frequency profile (integer harmonics over w), so the strip wraps exactly. */
function periodicNoise(r: Rng, w: number, amp: number, harmonics = 4): (x: number) => number {
  const terms = Array.from({ length: harmonics }, (_, i) => ({ k: i + 1, a: amp / (i + 1.4), ph: r.range(0, Math.PI * 2) }));
  return (x) => terms.reduce((s, t) => s + t.a * Math.sin((2 * Math.PI * t.k * x) / w + t.ph), 0);
}

interface Butte {
  c: number; // centre x
  top: number; // flat top half-width
  side: number; // side run (talus)
  ht: number; // height above the band floor
  round: boolean;
}

export const ridgeBand: KitGenerator<RidgeBandP> = {
  name: "ridgeBand",
  schema: RidgeBandZ,
  defaults: {
    w: 2048,
    h: 620,
    style: "butte_fluted",
    peaks: 5,
    height: [360, 560],
    flutes: 6,
    ramp: { lit: "rock.light", base: "rock.base", shade: "rock.shade" },
    rimLine: null,
    finish: { ao: false, rim: true, haze: 0.4 },
  },
  generate(p, seed): KitResult {
    const r = rng(seed);
    const ids = new Ids("rb");
    const hzv = p.finish.haze;
    const [hmin, hmax] = [Math.min(...p.height), Math.min(p.h, Math.max(...p.height))];
    let defs = "";
    let body = "";
    const anchors: Record<string, [number, number]> = {};

    if (p.style === "chasm_edge") {
      // ground on the left, a cliff lip at ~70 % of the width, falling to the bottom edge
      const lipX = p.w * r.range(0.62, 0.74);
      const lipY = p.h - hmax;
      const pts: Pt[] = [[0, p.h]];
      for (let x = 0; x <= lipX; x += p.w / 24) pts.push([x, lipY + r.range(-8, 8)]);
      pts.push([lipX, lipY]);
      let y = lipY;
      let x = lipX;
      while (y < p.h) {
        x += r.range(4, 22);
        y += r.range(30, 70);
        pts.push([x, Math.min(p.h, y)]);
      }
      pts.push([x, p.h]);
      const g = rampCyl(ids, p.ramp, hzv);
      defs += g.def;
      body += el("path", { d: poly(pts), fill: g.ref });
      // strata lines
      let strata = "";
      for (let i = 1; i < 6; i++) {
        const sy = lipY + (i * (p.h - lipY)) / 6;
        strata += `M0 ${n(sy)}L${n(lipX + i * 8)} ${n(sy + r.range(-4, 4))}`;
      }
      body += el("path", { d: strata, fill: "none", stroke: tk(hz(p.ramp.shade, hzv)), "stroke-width": 3, "stroke-opacity": 0.35 });
      body += rimStroke(pts, p.ramp.lit, p.finish, 2.5, 0.9);
      anchors.lip = [Math.round(lipX), Math.round(lipY)];
      return result(p.w, p.h, defs, body, { pivot: [0, 1], anchors, tileWidth: null });
    }

    // a low periodic floor behind the peaks
    const floor = periodicNoise(r, p.w, Math.max(6, hmin * 0.08));
    const floorH = hmin * 0.35;
    const floorPts: Pt[] = [[0, p.h]];
    for (let i = 0; i <= 64; i++) {
      const x = (i / 64) * p.w;
      floorPts.push([x, p.h - floorH - floor(x)]);
    }
    floorPts.push([p.w, p.h]);
    body += el("path", { d: poly(floorPts), fill: tk(hz(p.ramp.shade, Math.min(1, hzv + 0.1))) });

    const buttes: Butte[] = [];
    for (let i = 0; i < p.peaks; i++) {
      const ht = r.range(hmin, hmax);
      const width = (p.w / p.peaks) * r.range(0.7, 1.05);
      const top =
        p.style === "mesa" ? width * r.range(0.34, 0.44) : p.style === "butte_fluted" ? width * r.range(0.22, 0.32) : width * 0.05;
      buttes.push({
        c: ((i + r.range(0.2, 0.8)) / p.peaks) * p.w,
        top,
        side: width / 2 - top,
        ht,
        round: p.style === "dome" || p.style === "cell_dome",
      });
    }
    // draw back to front: shorter first
    buttes.sort((a, b) => a.ht - b.ht);
    for (const b of buttes) {
      const half = b.top + b.side;
      // build the butte once around x = 0 (random draws happen once), then place exact translated copies so the
      // strip wraps seamlessly
      const copies = [b.c, ...(b.c - half < 0 ? [b.c + p.w] : []), ...(b.c + half > p.w ? [b.c - p.w] : [])];
      const cx = 0;
      let gb = "";
      {
        const pts: Pt[] = [];
        const topY = p.h - b.ht;
        if (b.round) {
          const steps = 24;
          for (let i = 0; i <= steps; i++) {
            const a = Math.PI - (i / steps) * Math.PI;
            pts.push([cx + Math.cos(a) * half, p.h - floorH * 0.5 - Math.sin(a) * (b.ht - floorH * 0.5)]);
          }
          pts.push([cx + half, p.h], [cx - half, p.h]);
        } else if (p.style === "bluff") {
          pts.push([cx - half, p.h]);
          const steps = 10;
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const env = Math.sin(t * Math.PI);
            pts.push([cx - half + t * half * 2, p.h - floorH - env * (b.ht - floorH) * r.range(0.8, 1.05)]);
          }
          pts.push([cx + half, p.h]);
        } else {
          // butte / mesa: talus foot → lower tier → ledge → upper wall → cap (and mirrored)
          const capJ = () => r.range(-4, 4);
          const ledgeY = p.h - b.ht * r.range(0.48, 0.6);
          const ledgeOut = b.top + b.side * r.range(0.42, 0.55);
          const ledgeIn = b.top * r.range(1.02, 1.12);
          pts.push([cx - half, p.h]);
          pts.push([cx - half + b.side * 0.35, p.h - b.ht * 0.18]);
          pts.push([cx - ledgeOut, ledgeY + b.ht * 0.04]);
          pts.push([cx - ledgeOut + 6, ledgeY]);
          pts.push([cx - ledgeIn, ledgeY - 2]);
          pts.push([cx - b.top, topY + capJ()]);
          const capSteps = 4;
          for (let i = 1; i < capSteps; i++) pts.push([cx - b.top + (i / capSteps) * b.top * 2, topY + capJ()]);
          pts.push([cx + b.top, topY + capJ()]);
          pts.push([cx + ledgeIn, ledgeY - 2]);
          pts.push([cx + ledgeOut - 6, ledgeY]);
          pts.push([cx + ledgeOut, ledgeY + b.ht * 0.04]);
          pts.push([cx + half - b.side * 0.35, p.h - b.ht * 0.18]);
          pts.push([cx + half, p.h]);
        }
        const g = rampCyl(ids, p.ramp, hzv);
        defs += g.def;
        const d = b.round ? blobD(pts.slice(0, -2).concat([[cx + half, p.h], [cx - half, p.h]])) : poly(pts);
        gb += el("path", { d: b.round ? poly(pts) : d, fill: g.ref });
        if (p.flutes > 0 && !b.round) {
          // vertical flutes: darker grooves with a lit lip on their left
          let grooves = "";
          let lips = "";
          const x0 = cx - b.top * 0.95;
          const span = b.top * 1.9;
          for (let i = 0; i < p.flutes; i++) {
            const fx = x0 + ((i + 0.5) / p.flutes) * span + r.range(-3, 3);
            const y0 = topY + r.range(8, 22);
            const y1 = p.h - b.ht * r.range(0.25, 0.4);
            grooves += `M${n(fx)} ${n(y0)}L${n(fx + r.range(-6, 6))} ${n(y1)}`;
            lips += `M${n(fx - 3)} ${n(y0 + 4)}L${n(fx - 3 + r.range(-5, 5))} ${n(y1 - 10)}`;
          }
          // lower tier flutes (wider spacing)
          const lx0 = cx - (b.top + b.side * 0.4);
          const lspan = (b.top + b.side * 0.4) * 2;
          const lower = Math.max(2, Math.round(p.flutes * 1.3));
          for (let i = 0; i < lower; i++) {
            const fx = lx0 + ((i + 0.5) / lower) * lspan + r.range(-4, 4);
            const y0 = p.h - b.ht * r.range(0.44, 0.5);
            const y1 = p.h - b.ht * r.range(0.12, 0.2);
            grooves += `M${n(fx)} ${n(y0)}L${n(fx + r.range(-5, 5))} ${n(y1)}`;
          }
          const fw = Math.max(2, (b.top * 1.9) / p.flutes / 4);
          gb += el("path", { d: grooves, fill: "none", stroke: tk(hz(p.ramp.shade, hzv)), "stroke-width": fw, "stroke-linecap": "round", "stroke-opacity": 0.55 });
          gb += el("path", { d: lips, fill: "none", stroke: tk(hz(p.ramp.lit, hzv)), "stroke-width": Math.max(1, fw * 0.4), "stroke-linecap": "round", "stroke-opacity": 0.5 });
        }
        gb += rimStroke(pts, p.ramp.lit, p.finish, 2, 0.8);
        if (p.style === "cell_dome" && p.rimLine) {
          const arc = pts.slice(0, 25);
          gb += el("path", { d: curveD(arc), fill: "none", stroke: tk(hz(p.rimLine, hzv)), "stroke-width": 3, "stroke-opacity": 0.9 });
          gb += el("path", { d: curveD(arc.map(([x, y]) => [x, y + 9] as const)), fill: "none", stroke: tk(hz(p.rimLine, hzv)), "stroke-width": 2, "stroke-opacity": 0.6 });
        }
      }
      for (const ox of copies) body += el("g", { transform: `translate(${n(ox)} 0)` }, gb);
    }
    const ao = aoFoot(ids, rectD(0, p.h * 0.8, p.w, p.h * 0.2), p.h, p.h * 0.12, p.finish);
    defs += ao.defs;
    body += ao.body;
    return result(p.w, p.h, defs, body, { pivot: [0, 1], tileWidth: p.w });
  },
};

// ── skyline ────────────────────────────────────────────────────────────────────────────────────────────────
export const SkylineFeature = z.enum(["steeple", "water_tower", "dome_cupola", "setback_tower", "obelisk", "pine_line", "aqueduct", "capitol_dome"]);
export const SkylineZ = z.strictObject({
  w: z.number().int().min(128).max(4096),
  h: z.number().int().min(32).max(2048),
  blocks: z.number().int().min(1).max(80),
  height: z.tuple([z.number().min(0), z.number().min(0)]),
  features: z.array(SkylineFeature).max(8),
  fill: TokZ,
  windowTok: TokZ,
  windowDensity: z.number().min(0).max(1),
  finish: FinishZ,
});
export type SkylineP = z.infer<typeof SkylineZ>;

function featureShape(kind: z.infer<typeof SkylineFeature>, x: number, base: number, s: number, r: Rng): { d: string; top: Pt } {
  switch (kind) {
    case "steeple": {
      const w = 26 * s;
      const tower = 90 * s;
      const spire = 110 * s;
      return {
        d: rectD(x - w / 2, base - tower, w, tower) + poly([[x - w / 2 - 2, base - tower], [x, base - tower - spire], [x + w / 2 + 2, base - tower]]),
        top: [x, base - tower - spire],
      };
    }
    case "water_tower": {
      const tank = 34 * s;
      const legs = 70 * s;
      let d = "";
      for (const dx of [-0.35, -0.1, 0.1, 0.35]) d += rectD(x + dx * tank * 1.6 - 1.5, base - legs, 3, legs);
      d += `M${n(x - tank * 0.6)} ${n(base - legs)}h${n(tank * 1.2)}v${n(-tank * 0.8)}q${n(-tank * 0.6)} ${n(-tank * 0.5)} ${n(-tank * 1.2)} 0Z`;
      return { d, top: [x, base - legs - tank * 1.2] };
    }
    case "dome_cupola":
    case "capitol_dome": {
      const big = kind === "capitol_dome" ? 1.6 : 1;
      const w = 90 * s * big;
      const drum = 50 * s * big;
      const dome = w * 0.45;
      const d =
        rectD(x - w * 0.6, base - drum * 0.6, w * 1.2, drum * 0.6) +
        rectD(x - w * 0.4, base - drum * 1.3, w * 0.8, drum * 0.75) +
        `M${n(x - w * 0.42)} ${n(base - drum * 1.3)}A${n(w * 0.42)} ${n(dome)} 0 0 1 ${n(x + w * 0.42)} ${n(base - drum * 1.3)}Z` +
        rectD(x - 3 * s, base - drum * 1.3 - dome - 24 * s, 6 * s, 24 * s);
      return { d, top: [x, base - drum * 1.3 - dome - 24 * s] };
    }
    case "setback_tower": {
      const w = 70 * s;
      const h1 = 160 * s;
      const d = rectD(x - w / 2, base - h1, w, h1) + rectD(x - w * 0.36, base - h1 * 1.25, w * 0.72, h1 * 0.25) + rectD(x - w * 0.22, base - h1 * 1.45, w * 0.44, h1 * 0.2) + rectD(x - 2, base - h1 * 1.45 - 40 * s, 4, 40 * s);
      return { d, top: [x, base - h1 * 1.45 - 40 * s] };
    }
    case "obelisk": {
      const w = 22 * s;
      const h1 = 230 * s;
      return { d: poly([[x - w / 2, base], [x - w * 0.35, base - h1], [x, base - h1 - w * 0.8], [x + w * 0.35, base - h1], [x + w / 2, base]]), top: [x, base - h1 - w * 0.8] };
    }
    case "pine_line": {
      let d = "";
      let top: Pt = [x, base];
      for (let i = 0; i < 6; i++) {
        const px = x - 90 * s + i * 36 * s + r.range(-6, 6) * s;
        const ph = r.range(60, 110) * s;
        d += poly([[px - ph * 0.28, base], [px, base - ph], [px + ph * 0.28, base]]);
        if (base - ph < top[1]) top = [px, base - ph];
      }
      return { d, top };
    }
    case "aqueduct": {
      const w = 220 * s;
      const hh = 70 * s;
      let d = rectD(x - w / 2, base - hh, w, hh * 0.25);
      for (let i = 0; i < 5; i++) d += rectD(x - w / 2 + (i * w) / 4 - 5 * s, base - hh, 10 * s, hh);
      return { d, top: [x, base - hh] };
    }
  }
}

export const skyline: KitGenerator<SkylineP> = {
  name: "skyline",
  schema: SkylineZ,
  defaults: {
    w: 2048,
    h: 520,
    blocks: 22,
    height: [90, 260],
    features: ["steeple", "water_tower"],
    fill: "inlay.navy.dark",
    windowTok: "gold.hi",
    windowDensity: 0.15,
    finish: { ao: false, rim: false, haze: 0.4 },
  },
  generate(p, seed): KitResult {
    const r = rng(seed);
    const hzv = p.finish.haze;
    const [hmin, hmax] = [Math.min(...p.height), Math.min(p.h - 10, Math.max(...p.height))];
    let d = "";
    let win = "";
    const anchors: Record<string, [number, number]> = {};
    const bw = p.w / p.blocks;
    for (let i = 0; i < p.blocks; i++) {
      const x = i * bw;
      const wdt = bw * r.range(0.8, 1.15);
      const ht = r.range(hmin, hmax) * (r.chance(0.2) ? 0.6 : 1);
      const xs = [x, ...(x + wdt > p.w ? [x - p.w] : [])];
      for (const bx of xs) {
        d += rectD(bx, p.h - ht, wdt, ht);
        if (r.chance(0.3)) d += rectD(bx + wdt * 0.2, p.h - ht - 10, wdt * 0.12, 10); // roof box
      }
      if (p.windowDensity > 0) {
        for (let wy = p.h - ht + 12; wy < p.h - 14; wy += 18) {
          for (let wx = x + 6; wx < x + wdt - 8; wx += 12) {
            if (r.chance(p.windowDensity)) for (const ox of xs) win += rectD(ox + (wx - x), wy, 5, 8);
          }
        }
      }
    }
    p.features.forEach((f, i) => {
      const fx = ((i + 0.5) / Math.max(1, p.features.length)) * p.w + r.range(-bw, bw);
      const shape = featureShape(f, clamp(fx, 60, p.w - 60), p.h - hmin * 0.5, clamp(p.h / 520, 0.5, 2), r);
      d += shape.d;
      anchors[`feature_${i}`] = [Math.round(shape.top[0]), Math.round(Math.max(0, shape.top[1]))];
    });
    let body = el("path", { d, fill: tk(hz(p.fill, hzv)) });
    if (win) body += el("path", { d: win, fill: tk(p.windowTok), "fill-opacity": 0.75 });
    return result(p.w, p.h, "", body, { pivot: [0, 1], anchors, tileWidth: p.w });
  },
};

// ── canopy ─────────────────────────────────────────────────────────────────────────────────────────────────
export const CanopyZ = z.strictObject({
  w: z.number().int().min(16).max(2048),
  h: z.number().int().min(16).max(2048),
  style: z.enum(["blob_tree", "bush", "bead_tree", "magnolia", "vine_drape", "frond"]),
  lobes: z.tuple([z.number().int().min(1).max(60), z.number().int().min(1).max(60)]),
  ramp: RampZ,
  trunk: TokZ.nullable(),
  finish: FinishZ,
});
export type CanopyP = z.infer<typeof CanopyZ>;

function lobeBlob(r: Rng, cx: number, cy: number, rad: number, k = 8): string {
  const pts: Pt[] = [];
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2 + r.range(-0.15, 0.15);
    const rr = rad * r.range(0.82, 1.08);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92]);
  }
  return blobD(pts);
}

export const canopy: KitGenerator<CanopyP> = {
  name: "canopy",
  schema: CanopyZ,
  defaults: {
    w: 260,
    h: 340,
    style: "blob_tree",
    lobes: [7, 11],
    ramp: { lit: "foliage.blue.hi", base: "foliage.blue", shade: "foliage.blue|dim:0.35" },
    trunk: "bronze.ring",
    finish: { ao: true, rim: true, haze: 0 },
  },
  generate(p, seed): KitResult {
    const r = rng(seed);
    const ids = new Ids("cn");
    const hzv = p.finish.haze;
    const T = (t: string) => tk(hz(t, hzv));
    let defs = "";
    let body = "";
    const { w, h } = p;
    const nLobes = r.int(Math.min(...p.lobes), Math.max(...p.lobes));
    const soft = blur(ids, Math.max(0.6, Math.min(w, h) / 260));
    defs += soft.def;
    let pivot: [number, number] = [0.5, 1];
    let sway: [number, number] = [w / 2, h * 0.35];

    const crown = (cx: number, cy: number, rx: number, ry: number, rad: [number, number]) => {
      const lobes: Array<[number, number, number]> = [];
      for (let i = 0; i < nLobes; i++) {
        const a = r.range(0, Math.PI * 2);
        const dist = Math.sqrt(r.next());
        lobes.push([cx + Math.cos(a) * rx * dist, cy + Math.sin(a) * ry * dist, r.range(rad[0], rad[1])]);
      }
      lobes.sort((a, b) => a[1] - b[1]);
      let shade = "";
      let base = "";
      let lit = "";
      for (const [x, y, rr] of lobes) {
        shade += lobeBlob(r, x + rr * 0.18, y + rr * 0.24, rr);
        base += lobeBlob(r, x, y, rr * 0.92);
        if (x - cx < rx * 0.4 && y - cy < ry * 0.35) {
          lit += lobeBlob(r, x - rr * 0.28, y - rr * 0.3, rr * 0.42);
          if (r.chance(0.5)) lit += lobeBlob(r, x + rr * 0.05, y - rr * 0.45, rr * 0.25);
        }
      }
      body += el("path", { d: shade, fill: T(p.ramp.shade) });
      body += el("path", { d: base, fill: T(p.ramp.base) });
      body += el("path", { d: lit, fill: T(p.ramp.lit), "fill-opacity": 0.85, filter: soft.ref });
    };

    if (p.style === "blob_tree" || p.style === "bush") {
      const tree = p.style === "blob_tree";
      if (tree && p.trunk) {
        const tw = w * 0.07;
        const ty = h * 0.42;
        const d =
          `M${n(w / 2 - tw)} ${n(h)}C${n(w / 2 - tw * 0.6)} ${n(h * 0.75)} ${n(w / 2 - tw * 0.4)} ${n(ty + 30)} ${n(w / 2 - tw * 1.8)} ${n(ty)}` +
          `L${n(w / 2 - tw * 0.2)} ${n(ty + 18)}L${n(w / 2 + tw * 1.6)} ${n(ty - 6)}C${n(w / 2 + tw * 0.4)} ${n(ty + 40)} ${n(w / 2 + tw * 0.6)} ${n(h * 0.75)} ${n(w / 2 + tw)} ${n(h)}Z`;
        const g = rampCyl(ids, { lit: `${p.trunk}|light:0.25`, base: p.trunk, shade: `${p.trunk}|dim:0.3` }, hzv);
        defs += g.def;
        body += el("path", { d, fill: g.ref });
      }
      const cy = tree ? h * 0.36 : h * 0.6;
      const ry = tree ? h * 0.26 : h * 0.3;
      const rad: [number, number] = tree ? [w * 0.13, w * 0.22] : [w * 0.12, w * 0.2];
      crown(w / 2, cy, w * 0.32, ry, rad);
      sway = [Math.round(w / 2), Math.round(cy)];
    } else if (p.style === "bead_tree") {
      // glycan chains: a thin stalk with branching strings of beads
      const stalk = p.trunk ?? p.ramp.shade;
      const pts: Pt[] = [[w / 2, h]];
      for (let y = h - h * 0.12; y > h * 0.1; y -= h * 0.12) pts.push([w / 2 + r.range(-w * 0.06, w * 0.06), y]);
      body += el("path", { d: curveD(pts), fill: "none", stroke: T(stalk), "stroke-width": Math.max(2, w * 0.03), "stroke-linecap": "round" });
      const beadR = Math.max(3, w * 0.055);
      let beads = "";
      let beadLit = "";
      const branches = r.int(3, 6);
      for (let b = 0; b < branches; b++) {
        const from = pts[Math.min(pts.length - 1, 1 + Math.floor((b / branches) * (pts.length - 1)))];
        const dir = b % 2 === 0 ? -1 : 1;
        const len = r.int(3, 6);
        let [x, y] = from;
        const chain: Pt[] = [[x, y]];
        for (let i = 0; i < len; i++) {
          x += dir * beadR * 1.7 * r.range(0.8, 1.1);
          y -= beadR * r.range(0.6, 1.4);
          chain.push([x, y]);
        }
        body += el("path", { d: curveD(chain), fill: "none", stroke: T(stalk), "stroke-width": Math.max(1.5, beadR * 0.35) });
        for (const [bx, by] of chain.slice(1)) {
          beads += `M${n(bx - beadR)} ${n(by)}a${n(beadR)} ${n(beadR)} 0 1 0 ${n(beadR * 2)} 0a${n(beadR)} ${n(beadR)} 0 1 0 ${n(-beadR * 2)} 0Z`;
          beadLit += `M${n(bx - beadR * 0.75)} ${n(by - beadR * 0.2)}a${n(beadR * 0.4)} ${n(beadR * 0.4)} 0 1 0 ${n(beadR * 0.8)} 0a${n(beadR * 0.4)} ${n(beadR * 0.4)} 0 1 0 ${n(-beadR * 0.8)} 0Z`;
        }
      }
      body += el("path", { d: beads, fill: T(p.ramp.base) });
      body += el("path", { d: beadLit, fill: T(p.ramp.lit), "fill-opacity": 0.85 });
      sway = [Math.round(w / 2), Math.round(h * 0.3)];
    } else if (p.style === "magnolia") {
      if (p.trunk) body += el("path", { d: rectD(w / 2 - w * 0.04, h * 0.55, w * 0.08, h * 0.45), fill: T(p.trunk) });
      crown(w / 2, h * 0.42, w * 0.34, h * 0.3, [w * 0.14, w * 0.2]);
      // glossy oval leaves on the rim
      let leaves = "";
      for (let i = 0; i < nLobes * 2; i++) {
        const a = r.range(Math.PI * 0.9, Math.PI * 2.1);
        const lx = w / 2 + Math.cos(a) * w * 0.38;
        const ly = h * 0.42 + Math.sin(a) * h * 0.32;
        const L = w * 0.09;
        leaves += `M${n(lx)} ${n(ly)}q${n(Math.cos(a + 0.6) * L)} ${n(Math.sin(a + 0.6) * L)} ${n(Math.cos(a) * L * 1.8)} ${n(Math.sin(a) * L * 1.8)}q${n(Math.cos(a - 0.6) * -L)} ${n(Math.sin(a - 0.6) * -L)} ${n(-Math.cos(a) * L * 1.8)} ${n(-Math.sin(a) * L * 1.8)}Z`;
      }
      body += el("path", { d: leaves, fill: T(p.ramp.lit), "fill-opacity": 0.7 });
    } else if (p.style === "vine_drape") {
      pivot = [0.5, 0];
      const strands = r.int(Math.min(...p.lobes), Math.max(...p.lobes));
      let stems = "";
      let leafShade = "";
      let leafBase = "";
      for (let i = 0; i < strands; i++) {
        const x0 = ((i + r.range(0.2, 0.8)) / strands) * w;
        const len = r.range(h * 0.4, h);
        const pts: Pt[] = [];
        for (let y = 0; y <= len; y += len / 6) pts.push([x0 + Math.sin(y / 40 + i) * w * 0.03, y]);
        stems += curveD(pts);
        for (const [lx, ly] of pts.slice(1)) {
          const lr = r.range(w * 0.02, w * 0.045) + 3;
          leafShade += lobeBlob(r, lx + 2, ly + 3, lr, 6);
          leafBase += lobeBlob(r, lx, ly, lr * 0.9, 6);
        }
      }
      body += el("path", { d: stems, fill: "none", stroke: T(p.ramp.shade), "stroke-width": 2 });
      body += el("path", { d: leafShade, fill: T(p.ramp.shade) });
      body += el("path", { d: leafBase, fill: T(p.ramp.base) });
      sway = [Math.round(w / 2), 0];
    } else {
      // frond: curved tapered leaves from the base
      const k = r.int(Math.min(...p.lobes, 7), Math.min(9, Math.max(...p.lobes)));
      let shade = "";
      let base = "";
      for (let i = 0; i < k; i++) {
        const a = -Math.PI / 2 + ((i / Math.max(1, k - 1)) - 0.5) * 2.2 + r.range(-0.1, 0.1);
        const L = h * r.range(0.6, 0.95);
        const bx = w / 2;
        const by = h;
        const tx = bx + Math.cos(a) * L * 0.7 + (a > -Math.PI / 2 ? 1 : -1) * w * 0.12;
        const ty = by + Math.sin(a) * L;
        const mx = bx + Math.cos(a) * L * 0.5;
        const my = by + Math.sin(a) * L * 0.6;
        const wd = w * 0.07;
        const leaf = `M${n(bx - wd * 0.3)} ${n(by)}Q${n(mx - wd)} ${n(my)} ${n(tx)} ${n(ty)}Q${n(mx + wd)} ${n(my + wd)} ${n(bx + wd * 0.3)} ${n(by)}Z`;
        if (i % 2 === 0) base += leaf;
        else shade += leaf;
      }
      body += el("path", { d: shade, fill: T(p.ramp.shade) });
      body += el("path", { d: base, fill: T(p.ramp.base) });
    }
    if (p.finish.ao && pivot[1] === 1 && p.style !== "vine_drape") {
      const cs = contactShadow(ids, w / 2, h - Math.max(3, h * 0.02), w * (p.style === "bush" ? 0.42 : 0.3), Math.max(3, h * 0.025), Math.max(2, w / 80));
      defs += cs.defs;
      body = cs.body + body;
    }
    return result(w, h, defs, body, { pivot, anchors: { sway } });
  },
};

// ── crystalCluster ─────────────────────────────────────────────────────────────────────────────────────────
export const CrystalClusterZ = z.strictObject({
  w: z.number().int().min(8).max(2048),
  h: z.number().int().min(8).max(2048),
  form: z.enum(["spire", "cluster", "fan", "hanging_roots", "stud"]),
  shards: z.number().int().min(1).max(24),
  lean: z.number().min(-45).max(45), // deg
  ramp: RampZ, // crystal.hi/base/shade
  glow: TokZ.nullable(),
});
export type CrystalClusterP = z.infer<typeof CrystalClusterZ>;

export const crystalCluster: KitGenerator<CrystalClusterP> = {
  name: "crystalCluster",
  schema: CrystalClusterZ,
  defaults: {
    w: 180,
    h: 260,
    form: "cluster",
    shards: 6,
    lean: 0,
    ramp: { lit: "crystal.hi", base: "crystal.base", shade: "crystal.shade" },
    glow: "crystal.hi",
  },
  generate(p, seed): KitResult {
    const r = rng(seed);
    const ids = new Ids("cc");
    const { w, h } = p;
    const hanging = p.form === "hanging_roots";
    let defs = "";
    let body = "";
    let tip: Pt = [w / 2, hanging ? h : 0];
    if (p.glow) {
      const g = radial(ids, [[0, p.glow, 0.55], [1, p.glow, 0]], 0.5, hanging ? 0.3 : 0.7, 0.5);
      defs += g.def;
      body += el("ellipse", { cx: w / 2, cy: hanging ? h * 0.3 : h * 0.7, rx: w * 0.5, ry: h * 0.35, fill: g.ref });
    }
    const shards: Array<{ x: number; bw: number; sh: number; ang: number }> = [];
    for (let i = 0; i < p.shards; i++) {
      const main = i === 0 && (p.form === "spire" || p.form === "cluster");
      const t = p.shards === 1 ? 0.5 : i / (p.shards - 1);
      let ang = p.lean + r.range(-12, 12);
      let sh = h * (main ? 0.95 : r.range(0.35, 0.8));
      let bw = w * (main ? 0.26 : r.range(0.12, 0.22));
      let x = w / 2 + (main ? 0 : r.range(-0.32, 0.32) * w);
      if (p.form === "fan") {
        ang = p.lean + (t - 0.5) * 70;
        x = w / 2 + (t - 0.5) * w * 0.3;
        sh = h * (0.95 - Math.abs(t - 0.5) * 0.7);
      } else if (p.form === "stud") {
        sh = h * r.range(0.5, 0.95);
        bw = w * r.range(0.25, 0.4);
        x = w / 2 + (t - 0.5) * w * 0.55;
        ang = p.lean + (t - 0.5) * 30;
      } else if (hanging) {
        sh = h * r.range(0.4, 1);
        x = ((i + 0.5) / p.shards) * w + r.range(-5, 5);
        bw = w * r.range(0.06, 0.12);
      }
      shards.push({ x, bw, sh, ang });
    }
    // back (short) first, tallest last so it reads in front
    shards.sort((a, b) => a.sh - b.sh);
    for (const s of shards) {
      const dir = hanging ? 1 : -1;
      const rad = (s.ang * Math.PI) / 180;
      const ux = Math.sin(rad);
      const uy = dir * Math.cos(rad);
      const base: Pt = [s.x, hanging ? 0 : h];
      const px = Math.cos(rad) * (s.bw / 2);
      const py = Math.sin(rad) * (s.bw / 2) * -dir;
      const bl: Pt = [base[0] - px, base[1] - py];
      const br: Pt = [base[0] + px, base[1] + py];
      const shoulder = p.form === "stud" ? 0.55 : 0.78;
      const sl: Pt = [bl[0] + ux * s.sh * shoulder, bl[1] + uy * s.sh * shoulder];
      const sr: Pt = [br[0] + ux * s.sh * shoulder, br[1] + uy * s.sh * shoulder];
      const t: Pt = [base[0] + ux * s.sh, base[1] + uy * s.sh];
      const mid: Pt = [base[0] + ux * s.sh * 0.05, base[1] + uy * s.sh * 0.05];
      const clampPt = ([x, y]: Pt): Pt => [clamp(x, 0, w), clamp(y, 0, h)];
      const [BL, BR, SL, SR, TT, MID] = [bl, br, sl, sr, t, mid].map(clampPt);
      body += el("path", { d: poly([BL, SL, TT, MID]), fill: tk(p.ramp.lit) });
      body += el("path", { d: poly([MID, TT, SR, BR]), fill: tk(p.ramp.base) });
      body += el("path", { d: poly([MID, TT, SR, BR].map(([x, y]) => [x + (SR[0] - MID[0]) * 0.45, y] as const).map(clampPt)), fill: tk(p.ramp.shade), "fill-opacity": 0.8 });
      body += el("path", { d: poly([SL, TT], false), stroke: tk("haze"), "stroke-width": 1.2, "stroke-opacity": 0.6, fill: "none" });
      if ((!hanging && TT[1] < tip[1]) || (hanging && TT[1] > tip[1])) tip = TT;
    }
    return result(w, h, defs, body, { pivot: hanging ? [0.5, 0] : [0.5, 1], anchors: { tip: [Math.round(tip[0]), Math.round(tip[1])] } });
  },
};


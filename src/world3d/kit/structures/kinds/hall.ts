import type { ArchStyle } from "../../../../contracts/world3d";
import { classicalCorniceProfile, xform, type GeoBuilder, type Slot } from "../geom";
import type { Ctx } from "../model";
import { cavettoAround, column, columnKindFor, doorway, gableRoof, hipRoof, merlons, pagodaRoof, steppedBase, thatchRoof, windowOn } from "../parts";

/*
 * The "hall" archetype: a rectangular building in any architectural style, the workhorse behind houses, temples,
 * libraries, palaces and workshops outside their bespoke Egyptian forms. A hall is a podium, walls with a plinth band,
 * windows and a front door, an optional columned porch, and a roof in the style: terracotta gable with pediment
 * (classical), steep slate with dormers (medieval), sweeping tiled hip (east Asian), turf or thatch (nordic, rustic),
 * sawtooth metal (industrial), flat parapet with glazing (modern) or a shell (futuristic).
 */

export interface HallSpec {
  /** half extents of the walls */
  hx: number;
  hz: number;
  wallH: number;
  /** podium height (steps) under everything */
  podium?: number;
  /** a columned porch in front of the door: depth in metres and column count */
  porch?: { depth: number; cols: number };
  /** window rows (storeys) */
  storeys?: number;
  door?: { w: number; h: number };
  /** roof rise as a fraction of the half-width */
  roofRise?: number;
  /** the front door as a swing mover (two leaves) */
  doorMover?: boolean;
  /** frames of timber (medieval half-timbering) */
  timbered?: boolean;
  /** force a roof kind */
  roof?: RoofStyle;
}

export type RoofStyle = "classical" | "hipTile" | "slate" | "pagoda" | "turf" | "thatch" | "metal" | "flat" | "shell" | "tile_flat";

export function roofFor(style: ArchStyle): RoofStyle {
  switch (style) {
    case "classical":
      return "classical";
    case "medieval":
      return "slate";
    case "east_asian":
      return "pagoda";
    case "nordic":
      return "turf";
    case "rustic":
      return "thatch";
    case "industrial":
      return "metal";
    case "modern":
      return "flat";
    case "futuristic":
      return "shell";
    case "ancient_egypt":
    case "mesoamerican":
      return "tile_flat";
  }
}

/** Returns the total height reached. */
export function hall(c: Ctx, spec: HallSpec): number {
  const { b, style, s } = c;
  const { hx, hz, wallH } = spec;
  const podium = spec.podium ?? 0;
  let y0 = 0;
  if (podium > 0) {
    const steps = Math.max(1, Math.round(podium / (0.3 * s)));
    const tread = 0.35 * s;
    const extra = steps * tread;
    const porchD = spec.porch ? spec.porch.depth : 0;
    y0 = steppedBase(b, "trim", 0, porchD / 2, hx + extra, hz + porchD / 2 + extra, steps, podium / steps, tread, 0);
  } else {
    b.rectLoft("main2", 0, 0, hx + 0.12 * s, hz + 0.12 * s, [
      { o: 0, y: -0.4 },
      { o: 0, y: 0.35 * s },
      { o: -0.12 * s, y: 0.45 * s },
    ]);
  }
  const wallSlot: Slot = style === "futuristic" ? "trim" : "main";
  const top = y0 + wallH;
  // walls
  if (style === "modern") {
    // a concrete frame with a glazed band
    b.blk("trim", -hx, y0, -hz, hx, y0 + 0.4 * s, hz);
    b.blk("glass", -hx + 0.2 * s, y0 + 0.4 * s, -hz + 0.2 * s, hx - 0.2 * s, top - 0.6 * s, hz - 0.2 * s);
    for (let i = 0; i <= 6; i++) {
      const x = -hx + (2 * hx * i) / 6;
      b.blk("metal", x - 0.06 * s, y0 + 0.4 * s, hz - 0.22 * s, x + 0.06 * s, top - 0.6 * s, hz - 0.12 * s);
      b.blk("metal", x - 0.06 * s, y0 + 0.4 * s, -hz + 0.12 * s, x + 0.06 * s, top - 0.6 * s, -hz + 0.22 * s);
    }
    b.blk("main", -hx - 0.3 * s, top - 0.6 * s, -hz - 0.3 * s, hx + 0.3 * s, top, hz + 0.3 * s);
    for (const sx of [-1, 1]) b.blk("main", sx * hx - 0.3 * s, y0, -hz, sx * hx + 0.3 * s, top, -hz + hz * 0.8);
  } else if (style === "futuristic") {
    b.polyLoft("trim", roundedRect(hx, hz, Math.min(hx, hz) * 0.45), [
      { o: -0.3 * s, y: y0 },
      { o: 0, y: y0 + wallH * 0.2 },
      { o: 0, y: top },
    ], { smooth: true, capTop: false });
    b.polyLoft("glow", roundedRect(hx, hz, Math.min(hx, hz) * 0.45), [
      { o: 0.02, y: y0 + wallH * 0.55 },
      { o: 0.02, y: y0 + wallH * 0.58 },
    ], { capTop: false });
  } else {
    b.blk(wallSlot, -hx, y0, -hz, hx, top, hz);
    b.rectLoft("main2", 0, 0, hx + 0.06 * s, hz + 0.06 * s, [
      { o: 0, y: y0 },
      { o: 0, y: y0 + 0.55 * s },
      { o: -0.06 * s, y: y0 + 0.62 * s },
    ], { capTop: false });
  }
  if (spec.timbered) timberFrame(b, hx, hz, y0, top, s);
  if (style === "nordic" || style === "rustic") logCorners(b, hx, hz, y0, top, s);
  // windows
  const storeys = spec.storeys ?? 1;
  if (style !== "modern" && style !== "futuristic") {
    for (let st = 0; st < storeys; st++) {
      const wy = y0 + (wallH / storeys) * st + (wallH / storeys) * 0.35;
      const wh = Math.min(1.5 * s, (wallH / storeys) * 0.42);
      const ww = wh * 0.6;
      const nx = Math.max(1, Math.floor((hx * 2) / (3 * s)));
      const nz = Math.max(1, Math.floor((hz * 2) / (3 * s)));
      for (let i = 0; i < nz; i++) {
        const z = -hz + ((i + 0.5) * 2 * hz) / nz;
        for (const sx of [-1, 1]) b.at(sx * hx, 0, z, sx * Math.PI / 2, () => windowOn(b, style, 0, wy, 0, ww, wh));
      }
      for (let i = 0; i < nx; i++) {
        const x = -hx + ((i + 0.5) * 2 * hx) / nx;
        if (st === 0 && Math.abs(x) < (spec.door?.w ?? 1.2 * s)) continue;
        b.at(x, 0, hz, 0, () => windowOn(b, style, 0, wy, 0, ww, wh));
        b.at(x, 0, -hz, Math.PI, () => windowOn(b, style, 0, wy, 0, ww, wh));
      }
    }
  }
  // door
  const dw = spec.door?.w ?? 1.3 * s;
  const dh = spec.door?.h ?? Math.min(2.6 * s, wallH * 0.7);
  if (style === "futuristic") {
    b.quad("dark", 0, y0 + dh / 2, hz + 0.05, dw * 1.2, dh);
    b.box("glow", 0, y0 + dh + 0.1 * s, hz + 0.06, dw * 1.3, 0.06 * s, 0.04);
  } else doorway(b, style, 0, y0, hz, dw, dh);
  if (spec.doorMover) doorLeaves(c, 0, y0, hz - 0.05, dw, dh, true);
  // porch
  if (spec.porch) porch(c, hx, hz, y0, top, spec.porch.depth, spec.porch.cols);
  // roof
  return roofOver(c, spec.roof ?? roofFor(style), hx, hz, top, spec.roofRise, spec.porch?.depth ?? 0);
}

export function roundedRect(hx: number, hz: number, rr: number, n = 4) {
  const pts: [number, number][] = [];
  const corners: [number, number, number][] = [
    [hx - rr, hz - rr, 0],
    [hx - rr, -hz + rr, -Math.PI / 2],
    [-hx + rr, -hz + rr, -Math.PI],
    [-hx + rr, hz - rr, Math.PI / 2],
  ];
  // CCW from above (matches rectLoop): start at the south-west, go east along +z edge
  const order = [3, 0, 1, 2];
  for (const k of order) {
    const [cx, cz, a0] = corners[k];
    for (let i = 0; i <= n; i++) {
      const a = a0 + Math.PI / 2 - (i / n) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]);
    }
  }
  return pts;
}

function timberFrame(b: GeoBuilder, hx: number, hz: number, y0: number, top: number, s: number) {
  const t = 0.16 * s;
  const faces: [number, number, number, number][] = [
    [0, hz, hx, 0],
    [Math.PI, hz, hx, 0],
    [Math.PI / 2, hx, hz, 0],
    [-Math.PI / 2, hx, hz, 0],
  ];
  for (const [yaw, off, half] of faces) {
    b.at(0, 0, 0, yaw, () => {
      const z = off + 0.02;
      b.blk("woodDark", -half, top - t, z - 0.04, half, top, z + 0.06);
      b.blk("woodDark", -half, y0 + 0.6 * s, z - 0.04, half, y0 + 0.6 * s + t, z + 0.06);
      const mid = (y0 + top) / 2 + 0.3 * s;
      b.blk("woodDark", -half, mid - t / 2, z - 0.04, half, mid + t / 2, z + 0.06);
      const n = Math.max(2, Math.round((half * 2) / (1.6 * s)));
      for (let i = 0; i <= n; i++) {
        const x = -half + (2 * half * i) / n;
        b.blk("woodDark", x - t / 2, y0 + 0.6 * s, z - 0.04, x + t / 2, top, z + 0.06);
        if (i < n && i % 2 === 0) b.beam("woodDark", [x, mid, z + 0.01], [x + (2 * half) / n, top - t, z + 0.01], t * 0.8, 0.1 * s);
      }
    });
  }
}

function logCorners(b: GeoBuilder, hx: number, hz: number, y0: number, top: number, s: number) {
  const n = Math.max(3, Math.round((top - y0) / (0.32 * s)));
  for (let i = 0; i < n; i++) {
    const y = y0 + ((top - y0) * (i + 0.5)) / n;
    const r = 0.15 * s;
    if (i % 2) {
      for (const sz of [-1, 1]) b.cyl("wood", -hx - 0.35 * s, y, sz * (hz + 0.02), r, r, hx * 2 + 0.7 * s, 6, 0, 0, -Math.PI / 2);
    } else {
      for (const sx of [-1, 1]) b.cyl("wood", sx * (hx + 0.02), y, -hz - 0.35 * s, r, r, hz * 2 + 0.7 * s, 6, 0, Math.PI / 2);
    }
  }
}

/** Two door leaves hinged at the jambs of a doorway (swing movers), opening inward (toward -z). */
export function doorLeaves(c: Ctx, x: number, y0: number, z: number, w: number, h: number, defaultOpen: boolean, slot: Slot = "woodDark") {
  const lw = w / 2;
  for (const sx of [-1, 1]) {
    const hingeX = x + sx * lw;
    c.mover("swing", [hingeX, y0, z], [0, sx < 0 ? 1.75 : -1.75, 0], defaultOpen, (mb) => {
      const x0 = sx < 0 ? hingeX : hingeX - lw;
      mb.blk(slot, x0 + 0.01, y0, z - 0.08, x0 + lw - 0.01, y0 + h - 0.02, z);
      // battens and studs
      for (let i = 0; i < 3; i++) mb.blk("wood", x0 + 0.05, y0 + h * (0.18 + i * 0.32), z, x0 + lw - 0.05, y0 + h * (0.18 + i * 0.32) + 0.12 * c.s, z + 0.03);
      for (let i = 0; i < 4; i++) mb.sphere("metal", x0 + lw * (sx < 0 ? 0.85 : 0.15), y0 + h * (0.2 + i * 0.2), z + 0.03, 0.035 * c.s, 0.035 * c.s, 0.02 * c.s, 6, 4);
    });
  }
}

function porch(c: Ctx, hx: number, hz: number, y0: number, top: number, depth: number, cols: number) {
  const { b, style, s } = c;
  const zf = hz + depth;
  const colH = top - y0 - 0.9 * s;
  const kind = columnKindFor(style, c.variant);
  const r = Math.min(0.45 * s, (hx * 2) / cols / 5);
  for (let i = 0; i < cols; i++) {
    const x = -hx + r * 1.4 + ((hx - r * 1.4) * 2 * i) / (cols - 1);
    column(b, kind, x, y0, zf - r * 1.4, colH, r, style === "classical" ? "trim" : "main");
  }
  // entablature / lintel beam over the columns and the porch ceiling
  const beamSlot: Slot = style === "east_asian" ? "paint" : style === "nordic" || style === "rustic" ? "wood" : style === "industrial" ? "metal" : "trim";
  b.blk(beamSlot, -hx - 0.1 * s, y0 + colH, hz - 0.1, hx + 0.1 * s, top, zf);
  if (style === "classical") {
    // triglyphs
    const n = cols * 2 - 1;
    for (let i = 0; i <= n; i++) {
      const x = -hx + (2 * hx * i) / n;
      b.blk("main2", x - 0.18 * s, y0 + colH + 0.45 * s, zf, x + 0.18 * s, top - 0.05 * s, zf + 0.05);
    }
  }
}

/** The roof over a hall; returns the top height. With a porch the roof extends over it. */
export function roofOver(c: Ctx, roof: RoofStyle, hx: number, hz0: number, top: number, riseFrac?: number, porchDepth = 0): number {
  const { b, s } = c;
  const hz = hz0 + porchDepth / 2;
  const cz = porchDepth / 2;
  switch (roof) {
    case "classical": {
      b.rectLoft("trim", 0, cz, hx, hz, classicalCorniceProfile(top, 0.7 * s), { capTop: true });
      const y = top + 0.63 * s;
      const pitch = 0.24;
      const rise = gableRoofZ(b, "roof", 0, cz, hx + 0.35 * s, hz + 0.35 * s, y, pitch, 0.25 * s);
      // pediment raking cornices
      for (const sz of [-1, 1]) {
        for (const sx of [-1, 1]) {
          const len = Math.hypot(hx + 0.5 * s, rise);
          b.box("trim", sx * (hx + 0.5 * s) * 0.5, y + rise * 0.5 + 0.12 * s, cz + sz * (hz + 0.3 * s), len, 0.26 * s, 0.4 * s, 0, 0, -sx * Math.atan2(rise, hx + 0.5 * s));
        }
        // acroteria
        b.box("trim", 0, y + rise + 0.35 * s, cz + sz * (hz + 0.3 * s), 0.5 * s, 0.6 * s, 0.3 * s);
      }
      return y + rise + 0.6 * s;
    }
    case "hipTile": {
      const rise = Math.min(hx, hz) * (riseFrac ?? 0.55);
      b.rectLoft("trim", 0, cz, hx, hz, [
        { o: 0, y: top - 0.25 * s },
        { o: 0.12 * s, y: top - 0.1 * s },
        { o: 0.12 * s, y: top },
      ], { capTop: false });
      hipRoof(b, "roof", 0, cz, hx, hz, top, rise, 0.55 * s);
      return top + rise + 0.15 * s;
    }
    case "slate": {
      const rise = hx * (riseFrac ?? 1.05);
      const pitch = Math.atan2(rise, hx);
      const r2 = gableRoofZ(b, "roof", 0, cz, hx, hz, top, pitch, 0.45 * s, "main");
      // ridge, chimneys, dormer
      b.box("trim", 0, top + r2 + 0.1 * s, cz, 0.3 * s, 0.25 * s, hz * 2 + 0.9 * s);
      b.blk("main2", hx * 0.35, top + r2 * 0.3, -hz * 0.6, hx * 0.35 + 0.8 * s, top + r2 + 1.1 * s, -hz * 0.6 + 0.8 * s);
      return top + r2 + 1.1 * s;
    }
    case "pagoda": {
      const rise = Math.max(2.2 * s, hx * (riseFrac ?? 0.55));
      b.blk("paint", -hx - 0.05, top - 0.5 * s, -hz - 0.05 + cz, hx + 0.05, top, hz + 0.05 + cz);
      pagodaRoof(b, "roof", 0, cz, hx, hz, top, rise, Math.max(0.9 * s, Math.min(hx, hz) * 0.3));
      return top + rise + 0.4 * s;
    }
    case "turf": {
      const rise = hx * (riseFrac ?? 0.9);
      const pitch = Math.atan2(rise, hx);
      const r2 = gableRoofZ(b, "wood", 0, cz, hx, hz, top, pitch, 0.5 * s, "wood", 0.16 * s);
      // turf layer on the planks, and crossed gable finials
      gableRoofZ(b, "foliage", 0, cz, hx, hz, top + 0.14 * s, pitch, 0.4 * s, null, 0.22 * s);
      for (const sz of [-1, 1]) {
        for (const sx of [-1, 1]) b.beam("woodDark", [0, top + r2 - 0.2 * s, cz + sz * (hz + 0.5 * s)], [sx * 0.9 * s, top + r2 + 1.0 * s, cz + sz * (hz + 0.5 * s)], 0.14 * s);
      }
      return top + r2 + 1.0 * s;
    }
    case "thatch": {
      const rise = hx * (riseFrac ?? 1.0);
      thatchRoof(b, 0, cz, hx, hz, top, rise, 0.55 * s);
      return top + rise;
    }
    case "metal": {
      // a sawtooth north-light roof
      const n = Math.max(2, Math.round((hz * 2) / (4 * s)));
      const d = (hz * 2) / n;
      for (let i = 0; i < n; i++) {
        const z0 = cz - hz + i * d;
        b.prism("roof", [[z0, 0], [z0 + d, 0], [z0 + d, 1.8 * s]].map(([z, y]) => [z, y] as [number, number]), hx * 2, xform(hx, top, 0, -Math.PI / 2));
        b.quad("glass", 0, top + 0.9 * s, z0 + d + 0.01, hx * 2 - 0.2 * s, 1.6 * s);
      }
      b.blk("trim", -hx - 0.1 * s, top - 0.3 * s, cz - hz - 0.1 * s, hx + 0.1 * s, top, cz + hz + 0.1 * s);
      b.cyl("main2", hx * 0.6, top, cz - hz * 0.5, 0.45 * s, 0.4 * s, 4.5 * s, 10);
      return top + 4.5 * s;
    }
    case "flat": {
      b.blk("trim", -hx - 0.1 * s, top, cz - hz - 0.1 * s, hx + 0.1 * s, top + 0.5 * s, cz + hz + 0.1 * s);
      b.blk("metal", -hx * 0.3, top + 0.5 * s, cz - hz * 0.4, hx * 0.1, top + 1.3 * s, cz - hz * 0.1);
      return top + 1.3 * s;
    }
    case "shell": {
      const rise = Math.min(hx, hz) * 0.7;
      b.polyLoft("trim", roundedRect(hx, hz, Math.min(hx, hz) * 0.45), [
        { o: 0, y: top },
        { o: -Math.min(hx, hz) * 0.25, y: top + rise * 0.6 },
        { o: -Math.min(hx, hz) * 0.6, y: top + rise * 0.95 },
        { o: -Math.min(hx, hz) * 0.72, y: top + rise },
      ], { smooth: true });
      b.cyl("glow", 0, top + rise, cz, Math.min(hx, hz) * 0.18, Math.min(hx, hz) * 0.18, 0.1 * s, 16);
      return top + rise;
    }
    case "tile_flat": {
      if (c.style === "ancient_egypt") cavettoAround(b, -hx, cz - hz, hx, cz + hz, top, 0.6 * s);
      else {
        b.rectLoft("trim", 0, cz, hx, hz, [
          { o: 0, y: top },
          { o: 0.25 * s, y: top + 0.1 * s },
          { o: 0.25 * s, y: top + 0.5 * s },
          { o: -0.1, y: top + 0.5 * s },
        ]);
        const rise = Math.min(hx, hz) * (riseFrac ?? 0.9);
        hipRoof(b, "thatch", 0, cz, hx * 0.95, hz * 0.95, top + 0.5 * s, rise, 0.7 * s);
        return top + 0.5 * s + rise;
      }
      return top + 0.75 * s;
    }
  }
}

/** Gable roof with the ridge along z (gables facing ±z). Returns the rise. */
export function gableRoofZ(b: GeoBuilder, slot: Slot, cx: number, cz: number, hx: number, hz: number, y: number, pitch: number, ov: number, gableSlot: Slot | null = "main", thick = 0.2) {
  const rise = gableRoof(b, slot, cx, cz, hx, hz, y, pitch, ov, thick, gableSlot) - y;
  return rise;
}

/** Crenellated parapet around a rectangle. */
export function battlements(b: GeoBuilder, slot: Slot, hx: number, hz: number, y: number, s: number, thick = 0.6) {
  b.blk(slot, -hx - 0.2 * s, y - 0.4 * s, -hz - 0.2 * s, hx + 0.2 * s, y, hz + 0.2 * s);
  const mh = 1.0 * s;
  const mw = 0.9 * s;
  const gap = 0.7 * s;
  merlons(b, slot, -hx, hz, hx, hz, y, thick * s, mh, mw, gap);
  merlons(b, slot, -hx, -hz, hx, -hz, y, thick * s, mh, mw, gap);
  merlons(b, slot, hx, -hz, hx, hz, y, thick * s, mh, mw, gap);
  merlons(b, slot, -hx, -hz, -hx, hz, y, thick * s, mh, mw, gap);
}


import * as THREE from "three";
import type { ArchStyle } from "../../../contracts/world3d";
import type { Rng } from "../../core/prng";
import { cavettoProfile, classicalCorniceProfile, rectLoop, xform, type GeoBuilder, type LoftRing, type Slot, type V2 } from "./geom";

/*
 * Architectural parts shared by the structure builders: style-aware columns, cornices, doors, windows, roofs and the
 * small props (jars, baskets, crates, benches) that give buildings scale. Everything is authored in metres in the
 * current builder frame, front = +z, and emits into named slots (see ./palette.ts).
 */

// ------------------------------------------------------------------------------------------------ columns

export type ColumnKind = "papyrus" | "papyrus_open" | "doric" | "ionic" | "romanesque" | "lacquer" | "square" | "timber" | "steel" | "slim" | "pylon";

export function columnKindFor(style: ArchStyle, variant = 0): ColumnKind {
  switch (style) {
    case "ancient_egypt":
      return variant % 2 === 0 ? "papyrus" : "papyrus_open";
    case "classical":
      return variant % 2 === 0 ? "doric" : "ionic";
    case "medieval":
      return "romanesque";
    case "east_asian":
      return "lacquer";
    case "mesoamerican":
      return "square";
    case "nordic":
    case "rustic":
      return "timber";
    case "industrial":
      return "steel";
    case "modern":
      return "slim";
    case "futuristic":
      return "pylon";
  }
}

/** A column standing at (x, y0, z), `h` tall with shaft radius `r` (the capital may be wider). */
export function column(b: GeoBuilder, kind: ColumnKind, x: number, y0: number, z: number, h: number, r: number, slot: Slot = "main") {
  b.at(x, y0, z, 0, () => {
    switch (kind) {
      case "papyrus":
      case "papyrus_open": {
        const open = kind === "papyrus_open";
        // round drum base
        b.lathe("trim", 0, 0, 0, [[0, 0], [r * 1.32, 0], [r * 1.32, h * 0.03], [r * 1.22, h * 0.04], [0, h * 0.04]], 20);
        const rows = [
          { r: r * 0.92, y: h * 0.04, lobe: 1 },
          { r: r * 1.06, y: h * 0.07, lobe: 1 },
          { r: r * 1.04, y: h * 0.11, lobe: 1 },
          { r: r * 0.97, y: h * 0.3, lobe: 1 },
          { r: r * 0.88, y: h * 0.55, lobe: 1 },
          { r: r * 0.82, y: h * 0.7, lobe: 1 },
          { r: r * 0.84, y: h * 0.705, lobe: 0 },
          { r: r * 0.84, y: h * 0.775, lobe: 0 },
          { r: r * 0.8, y: h * 0.78, lobe: 1 },
        ];
        if (open) rows.push({ r: r * 1.05, y: h * 0.85, lobe: 0.6 }, { r: r * 1.45, y: h * 0.92, lobe: 0.35 }, { r: r * 1.62, y: h * 0.955, lobe: 0.2 }, { r: r * 1.6, y: h * 0.96, lobe: 0 });
        else rows.push({ r: r * 0.98, y: h * 0.83, lobe: 1 }, { r: r * 1.02, y: h * 0.87, lobe: 1 }, { r: r * 0.88, y: h * 0.925, lobe: 1 }, { r: r * 0.66, y: h * 0.96, lobe: 0.6 });
        b.lobedLathe(slot, 0, 0, 0, rows, { segments: 32, lobes: 8, depth: 0.16, mode: "bundle" });
        // painted bands (the tied stems) and the abacus
        for (let i = 0; i < 3; i++) b.cyl(i === 1 ? "paint2" : "paint", 0, h * (0.708 + i * 0.022), 0, r * 0.86, r * 0.86, h * 0.016, 20);
        const ab = open ? r * 1.05 : r * 0.8;
        b.blk("trim", -ab, h * 0.96, -ab, ab, h, ab);
        break;
      }
      case "doric": {
        b.blk("trim", -r * 1.25, 0, -r * 1.25, r * 1.25, h * 0.02, r * 1.25);
        const rows = [];
        for (let i = 0; i <= 6; i++) {
          const t = i / 6;
          // entasis: a gentle swelling in the lower third
          rows.push({ r: r * (1 - 0.2 * t + 0.035 * Math.sin(Math.PI * t)), y: h * (0.02 + t * 0.86), lobe: 1 });
        }
        b.lobedLathe(slot, 0, 0, 0, rows, { segments: 40, lobes: 20, depth: 0.06, mode: "flute", capTop: false });
        // echinus + abacus
        b.lathe(slot, 0, 0, 0, [[r * 0.8, h * 0.88], [r * 0.82, h * 0.9], [r * 1.12, h * 0.94], [r * 1.18, h * 0.95], [0, h * 0.95]], 24);
        b.blk("trim", -r * 1.25, h * 0.95, -r * 1.25, r * 1.25, h, r * 1.25);
        break;
      }
      case "ionic": {
        b.blk("trim", -r * 1.3, 0, -r * 1.3, r * 1.3, h * 0.015, r * 1.3);
        b.lathe("trim", 0, 0, 0, [[r * 1.25, h * 0.015], [r * 1.25, h * 0.03], [r * 1.1, h * 0.04], [r * 1.18, h * 0.055], [r * 1.0, h * 0.07], [0, h * 0.07]], 24);
        const rows = [];
        for (let i = 0; i <= 5; i++) rows.push({ r: r * (0.98 - 0.14 * (i / 5)), y: h * (0.07 + (i / 5) * 0.84), lobe: 1 });
        b.lobedLathe(slot, 0, 0, 0, rows, { segments: 48, lobes: 24, depth: 0.05, mode: "flute", capTop: false });
        b.lathe(slot, 0, 0, 0, [[r * 0.84, h * 0.91], [r * 0.95, h * 0.93], [0, h * 0.93]], 20);
        // volutes: two scrolls on the front/back faces, seen as spirals from the side
        for (const sx of [-1, 1]) b.cyl("trim", sx * r * 1.0, h * 0.905, -r * 0.55, r * 0.3, r * 0.3, r * 1.1, 14, 0, Math.PI / 2);
        b.blk("trim", -r * 1.35, h * 0.93, -r * 0.62, r * 1.35, h * 0.955, r * 0.62);
        b.blk("trim", -r * 1.15, h * 0.955, -r * 1.15, r * 1.15, h, r * 1.15);
        break;
      }
      case "romanesque": {
        b.lathe("trim", 0, 0, 0, [[r * 1.3, 0], [r * 1.3, h * 0.04], [r * 1.1, h * 0.06], [r, h * 0.07], [0, h * 0.07]], 16);
        b.cyl(slot, 0, h * 0.07, 0, r, r * 0.95, h * 0.8, 16);
        // cushion capital: a cube with the lower corners rounded off
        b.lathe("trim", 0, 0, 0, [[r * 0.95, h * 0.87], [r * 1.25, h * 0.93], [r * 1.35, h * 0.95], [0, h * 0.95]], 4, Math.PI / 4);
        b.blk("trim", -r * 1.4, h * 0.95, -r * 1.4, r * 1.4, h, r * 1.4);
        break;
      }
      case "lacquer": {
        b.lathe("trim", 0, 0, 0, [[r * 1.5, 0], [r * 1.5, h * 0.03], [r * 1.25, h * 0.06], [0, h * 0.06]], 12);
        b.cyl("paint", 0, h * 0.06, 0, r, r * 0.94, h * 0.86, 14);
        // bracket block (dou-gong, simplified)
        b.blk("wood", -r * 1.3, h * 0.92, -r * 1.3, r * 1.3, h * 0.96, r * 1.3);
        b.blk("paint2", -r * 2.2, h * 0.96, -r * 0.6, r * 2.2, h, r * 0.6);
        b.blk("paint2", -r * 0.6, h * 0.96, -r * 2.2, r * 0.6, h, r * 2.2);
        break;
      }
      case "square": {
        b.blk("trim", -r * 1.25, 0, -r * 1.25, r * 1.25, h * 0.05, r * 1.25);
        b.blk(slot, -r, h * 0.05, -r, r, h * 0.9, r);
        b.blk("paint", -r * 1.02, h * 0.62, -r * 1.02, r * 1.02, h * 0.7, r * 1.02);
        b.blk("trim", -r * 1.3, h * 0.9, -r * 1.3, r * 1.3, h, r * 1.3);
        break;
      }
      case "timber": {
        b.blk("trim", -r * 1.4, 0, -r * 1.4, r * 1.4, h * 0.05, r * 1.4);
        b.cyl("wood", 0, h * 0.05, 0, r, r * 0.9, h * 0.87, 8);
        // knee braces
        for (const sx of [-1, 1]) b.beam("wood", [0, h * 0.78, 0], [sx * r * 4, h * 0.98, 0], r * 0.5);
        b.blk("woodDark", -r * 1.3, h * 0.92, -r * 1.3, r * 1.3, h, r * 1.3);
        break;
      }
      case "steel": {
        b.blk("metal", -r * 1.4, 0, -r * 1.4, r * 1.4, h * 0.02, r * 1.4);
        const f = r * 0.18;
        b.blk("metal", -r, h * 0.02, -r, r, h * 0.98, -r + f);
        b.blk("metal", -r, h * 0.02, r - f, r, h * 0.98, r);
        b.blk("metal", -f * 0.6, h * 0.02, -r, f * 0.6, h * 0.98, r);
        b.blk("metal", -r * 1.3, h * 0.98, -r * 1.3, r * 1.3, h, r * 1.3);
        break;
      }
      case "slim": {
        b.cyl(slot === "main" ? "trim" : slot, 0, 0, 0, r * 0.7, r * 0.7, h, 16);
        break;
      }
      case "pylon": {
        b.cyl("trim", 0, 0, 0, r * 1.1, r * 0.65, h * 0.94, 6);
        b.cyl("glow", 0, h * 0.2, 0, r * 0.95, r * 0.95, h * 0.02, 12);
        b.cyl("metal", 0, h * 0.94, 0, r * 0.65, r * 1.2, h * 0.06, 6);
        break;
      }
    }
  });
}

// ------------------------------------------------------------------------------------------------ mouldings

/** Egyptian cavetto cornice with torus roll around the rectangle (x0..x1, z0..z1) starting at height y. */
export function cavettoAround(b: GeoBuilder, x0: number, z0: number, x1: number, z1: number, y: number, size: number, slot: Slot = "trim") {
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  b.rectLoft(slot, cx, cz, Math.abs(x1 - x0) / 2, Math.abs(z1 - z0) / 2, cavettoProfile(y, size, -Math.min(Math.abs(x1 - x0), Math.abs(z1 - z0)) / 2 + 0.01), { smooth: true });
}

export function classicalCorniceAround(b: GeoBuilder, x0: number, z0: number, x1: number, z1: number, y: number, size: number, slot: Slot = "trim") {
  b.rectLoft(slot, (x0 + x1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0) / 2, Math.abs(z1 - z0) / 2, classicalCorniceProfile(y, size));
}

/** A battered (inward-leaning) block: base half extents hx, hz; each face leans in by `batter` metres per metre. */
export function batteredBlock(b: GeoBuilder, slot: Slot, cx: number, cz: number, hx: number, hz: number, y0: number, y1: number, batter: number) {
  b.rectLoft(slot, cx, cz, hx, hz, [
    { o: 0, y: y0 },
    { o: -batter * (y1 - y0), y: y1 },
  ]);
}

/** A stepped platform (crepidoma, podium): `steps` courses, each `rise` high and `tread` deep. Returns the top height. */
export function steppedBase(b: GeoBuilder, slot: Slot, cx: number, cz: number, hx: number, hz: number, steps: number, rise: number, tread: number, y0 = 0): number {
  for (let i = 0; i < steps; i++) {
    const o = -i * tread;
    b.rectLoft(slot, cx, cz, hx + o, hz + o, [
      { o: 0, y: y0 + i * rise },
      { o: 0, y: y0 + (i + 1) * rise - 0.04 },
      { o: -0.04, y: y0 + (i + 1) * rise },
    ]);
  }
  return y0 + steps * rise;
}

/** Crenellations (merlons) along a straight parapet from (x0, z0) to (x1, z1) at height y. */
export function merlons(b: GeoBuilder, slot: Slot, x0: number, z0: number, x1: number, z1: number, y: number, thick: number, mh: number, mw: number, gap: number) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.floor((len + gap) / (mw + gap)));
  const used = n * mw + (n - 1) * gap;
  const yaw = Math.atan2(x1 - x0, z1 - z0);
  const dx = (x1 - x0) / len;
  const dz = (z1 - z0) / len;
  for (let i = 0; i < n; i++) {
    const t = (len - used) / 2 + i * (mw + gap) + mw / 2;
    b.box(slot, x0 + dx * t, y + mh / 2, z0 + dz * t, thick, mh, mw, yaw);
  }
}

// ------------------------------------------------------------------------------------------------ openings

/**
 * A doorway on a wall face: a dark opening flush with the face at z = `face` (the wall's outer plane, facing +z in the
 * current frame), a frame/lintel in the style, and optionally door leaves as swing movers (returned by the caller).
 */
export function doorway(b: GeoBuilder, style: ArchStyle, x: number, y0: number, face: number, w: number, h: number, opts: { frame?: Slot; arch?: boolean } = {}) {
  const frame = opts.frame ?? "trim";
  const arch = opts.arch ?? (style === "medieval" || style === "nordic" || style === "classical");
  if (arch) {
    // dark rectangle below the springing + a half-disc of dark above it
    const sp = h - w / 2;
    b.quad("dark", x, y0 + sp / 2, face + 0.02, w, sp);
    b.add("dark", circleSegment(w / 2, 0, Math.PI, 12), xform(x, y0 + sp, face + 0.02));
    // voussoirs (arch ring) and jambs
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI - (i / 8) * Math.PI;
      const rr = w / 2 + 0.16;
      b.box(frame, x + Math.cos(a) * rr, y0 + sp + Math.sin(a) * rr, face + 0.06, 0.34, 0.2, 0.16, 0, 0, a - Math.PI / 2);
    }
    b.blk(frame, x - w / 2 - 0.3, y0, face - 0.02, x - w / 2, y0 + sp, face + 0.12);
    b.blk(frame, x + w / 2, y0, face - 0.02, x + w / 2 + 0.3, y0 + sp, face + 0.12);
    return;
  }
  b.quad("dark", x, y0 + h / 2, face + 0.02, w, h);
  const t = style === "ancient_egypt" ? 0.28 : 0.18;
  b.blk(frame, x - w / 2 - t, y0, face - 0.02, x - w / 2, y0 + h, face + 0.1);
  b.blk(frame, x + w / 2, y0, face - 0.02, x + w / 2 + t, y0 + h, face + 0.1);
  b.blk(frame, x - w / 2 - t * 1.6, y0 + h, face - 0.02, x + w / 2 + t * 1.6, y0 + h + t * 1.3, face + 0.14);
  if (style === "ancient_egypt") {
    // a small cavetto over the lintel and the winged sun disc
    b.rectLoft(frame, x, face + 0.05, w / 2 + t * 1.7, 0.12, cavettoProfile(y0 + h + t * 1.3, t * 1.2, -0.1), { smooth: true });
    wingedDisc(b, x, y0 + h + t * 0.62, face + 0.15, w * 0.9);
  }
  b.blk("main2", x - w / 2 - t, y0 - 0.001, face - 0.02, x + w / 2 + t, y0 + 0.12, face + 0.3);
}

/** A window: dark pane with sill and lintel, on the face at z = `face`. */
export function windowOn(b: GeoBuilder, style: ArchStyle, x: number, y: number, face: number, w: number, h: number) {
  const modern = style === "modern" || style === "futuristic";
  if (modern) {
    b.quad("glass", x, y + h / 2, face + 0.03, w, h);
    b.blk("metal", x - w / 2 - 0.05, y - 0.05, face, x + w / 2 + 0.05, y, face + 0.08);
    return;
  }
  if (style === "medieval" || style === "classical") {
    const sp = h - w / 2;
    b.quad("dark", x, y + sp / 2, face + 0.02, w, sp);
    b.add("dark", circleSegment(w / 2, 0, Math.PI, 8), xform(x, y + sp, face + 0.02));
  } else b.quad("dark", x, y + h / 2, face + 0.02, w, h);
  b.blk("trim", x - w / 2 - 0.1, y - 0.1, face - 0.02, x + w / 2 + 0.1, y, face + 0.14);
  if (style !== "medieval" && style !== "classical") b.blk("trim", x - w / 2 - 0.1, y + h, face - 0.02, x + w / 2 + 0.1, y + h + 0.1, face + 0.08);
  if (style === "ancient_egypt" || style === "mesoamerican") {
    // wooden grille bars
    for (let i = 1; i < 3; i++) b.blk("wood", x - w / 2 + (w * i) / 3 - 0.025, y, face + 0.02, x - w / 2 + (w * i) / 3 + 0.025, y + h, face + 0.06);
  }
  if (style === "east_asian" || style === "nordic" || style === "rustic") {
    // lattice / shutters
    b.blk("woodDark", x - w / 2 - 0.3, y, face, x - w / 2 - 0.02, y + h, face + 0.05);
    b.blk("woodDark", x + w / 2 + 0.02, y, face, x + w / 2 + 0.3, y + h, face + 0.05);
  }
}

/** A flat half/partial disc in the x/y plane (arched openings). */
function circleSegment(r: number, a0: number, a1: number, n: number) {
  const pts: V2[] = [[0, 0]];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return fanGeometry(pts);
}

function fanGeometry(pts: readonly V2[]) {
  const pos: number[] = [];
  for (let i = 1; i < pts.length - 1; i++) pos.push(pts[0][0], pts[0][1], 0, pts[i][0], pts[i][1], 0, pts[i + 1][0], pts[i + 1][1], 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** The Egyptian winged sun disc: a gold disc with two painted wings, on a face at z. */
export function wingedDisc(b: GeoBuilder, x: number, y: number, z: number, span: number) {
  const d = span * 0.11;
  b.cyl("gold", x, y, z - 0.02, d, d, 0.06, 16, 0, Math.PI / 2);
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const len = span * (0.42 - i * 0.07);
      const yy = y + d * 0.35 - i * d * 0.42;
      b.box(i === 1 ? "paint2" : "paint", x + sx * (d + len / 2), yy, z, len, d * 0.36, 0.05, 0, 0, sx * -0.08);
    }
  }
}

/**
 * A column of incised hieroglyphs on a face: dark glyph marks inside a frame, top to bottom, deterministic from rng.
 * The face is the local z = 0 plane (use b.with to place it), glyphs go from y0 to y1 within width w.
 */
export function glyphColumn(b: GeoBuilder, rng: Rng, y0: number, y1: number, w: number, slot: Slot = "dark") {
  const lw = 0.035 * w * 4;
  b.quad(slot, -w / 2, (y0 + y1) / 2, 0.012, lw * 0.5, y1 - y0);
  b.quad(slot, w / 2, (y0 + y1) / 2, 0.012, lw * 0.5, y1 - y0);
  let y = y1 - w * 0.2;
  const gw = w * 0.72;
  while (y > y0 + w * 0.3) {
    const r = rng();
    if (r < 0.25) {
      // a full-width sign (bird, reclining animal)
      const hh = gw * 0.5;
      b.quad(slot, 0, y - hh / 2, 0.012, gw * 0.85, hh * 0.35);
      b.quad(slot, -gw * 0.25, y - hh * 0.15, 0.012, gw * 0.25, hh * 0.5);
      y -= hh + w * 0.12;
    } else if (r < 0.5) {
      // two tall signs side by side
      const hh = gw * 0.7;
      b.quad(slot, -gw * 0.22, y - hh / 2, 0.012, gw * 0.16, hh);
      b.quad(slot, gw * 0.22, y - hh / 2, 0.012, gw * 0.16, hh * 0.8);
      y -= hh + w * 0.12;
    } else if (r < 0.7) {
      // a disc (sun, placenta sign) as an octagon
      const rr = gw * 0.2;
      b.add(slot, circleSegment(rr, 0, Math.PI * 2, 8), xform(0, y - rr, 0.012));
      y -= rr * 2 + w * 0.12;
    } else if (r < 0.85) {
      // flat signs stacked (water ripples, loaf)
      for (let k = 0; k < 2; k++) b.quad(slot, 0, y - k * gw * 0.18, 0.012, gw * 0.9, gw * 0.08);
      y -= gw * 0.36 + w * 0.12;
    } else {
      // a cartouche: rounded frame
      const hh = gw * 1.5;
      b.quad(slot, -gw * 0.42, y - hh / 2, 0.012, gw * 0.06, hh);
      b.quad(slot, gw * 0.42, y - hh / 2, 0.012, gw * 0.06, hh);
      b.quad(slot, 0, y, 0.012, gw * 0.9, gw * 0.06);
      b.quad(slot, 0, y - hh, 0.012, gw * 0.9, gw * 0.06);
      b.quad(slot, 0, y - hh * 0.35, 0.012, gw * 0.4, gw * 0.12);
      b.quad(slot, 0, y - hh * 0.7, 0.012, gw * 0.3, gw * 0.3);
      y -= hh + w * 0.18;
    }
  }
}

// ------------------------------------------------------------------------------------------------ roofs

export type RoofKind = "flat" | "gable" | "hip" | "pagoda" | "turf" | "thatch" | "shed" | "dome" | "vault";

/** Gable roof over the rectangle, ridge along z (the gable ends face ±z), eaves overhang `ov`. Returns the ridge y. */
export function gableRoof(b: GeoBuilder, slot: Slot, cx: number, cz: number, hx: number, hz: number, y: number, pitch: number, ov = 0.4, thick = 0.18, gableSlot: Slot | null = "main") {
  const rise = (hx + ov) * Math.tan(pitch);
  const len = hz * 2 + ov * 2;
  // two slabs
  for (const sx of [-1, 1]) {
    const run = Math.hypot(hx + ov, rise);
    b.box(slot, cx + (sx * (hx + ov)) / 2, y + rise / 2 + thick / 2, cz, run, thick, len, 0, 0, sx * -pitch);
  }
  // gable triangles (walls) at both ends
  if (gableSlot) {
    for (const sz of [-1, 1]) {
      b.prism(gableSlot, [[-hx, 0], [hx, 0], [0, hx * Math.tan(pitch)]], 0.2, xform(cx, y, cz + sz * hz - (sz > 0 ? 0.2 : 0)));
    }
  }
  return y + rise;
}

/** Hip roof (all four sides slope) via a polyLoft to a ridge. */
export function hipRoof(b: GeoBuilder, slot: Slot, cx: number, cz: number, hx: number, hz: number, y: number, rise: number, ov = 0.5) {
  const m = Math.min(hx, hz) + ov;
  b.rectLoft(slot, cx, cz, hx + ov, hz + ov, [
    { o: 0, y },
    { o: 0, y: y + 0.15 },
    { o: -m, y: y + 0.15 + rise },
  ]);
}

/**
 * East Asian sweeping roof: a hip roof whose eaves curve up at the corners. Built as rings of a polyLoft with a concave
 * profile; `tiers` > 1 stacks smaller roofs.
 */
export function pagodaRoof(b: GeoBuilder, slot: Slot, cx: number, cz: number, hx: number, hz: number, y: number, rise: number, ov = 1.4) {
  const rings: LoftRing[] = [];
  const m = Math.min(hx, hz) + ov;
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // concave curve: steep near the ridge, flat near the eaves
    const o = -m * t;
    const yy = y + rise * Math.pow(t, 1.8);
    rings.push({ o, y: yy });
  }
  const loop = rectLoop(cx, cz, hx + ov, hz + ov);
  b.polyLoft(slot, loop, [{ o: 0, y: y - 0.25 }, ...rings], { smooth: true });
  // ridge and hip crests
  b.box("trim", cx, y + rise + 0.2, cz, Math.max(0.3, (hx - hz) * 2 + 0.6), 0.4, 0.4);
  // upswept eave tips: a curved horn at each corner, rising outward along the diagonal
  const tip = Math.max(0.6, ov * 0.9);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const ex = cx + sx * (hx + ov);
      const ez = cz + sz * (hz + ov);
      b.tube(slot, [
        [ex - sx * tip * 0.9, y - 0.12, ez - sz * tip * 0.9],
        [ex - sx * tip * 0.2, y - 0.05, ez - sz * tip * 0.2],
        [ex + sx * tip * 0.1, y + tip * 0.35, ez + sz * tip * 0.1],
        [ex + sx * tip * 0.14, y + tip * 0.7, ez + sz * tip * 0.14],
      ], Math.max(0.12, tip * 0.18), 6, 12);
      // hip crest from the corner up toward the ridge
      b.rod("trim", [ex - sx * tip * 0.5, y + 0.05, ez - sz * tip * 0.5], [cx + sx * Math.max(0, hx - hz), y + rise + 0.1, cz], Math.max(0.1, tip * 0.12), Math.max(0.1, tip * 0.12), 5);
    }
}

/** Thatched hip roof: a thick, soft-edged hip roof with a ridge roll. */
export function thatchRoof(b: GeoBuilder, cx: number, cz: number, hx: number, hz: number, y: number, rise: number, ov = 0.6) {
  const m = Math.min(hx, hz) + ov;
  b.rectLoft("thatch", cx, cz, hx + ov, hz + ov, [
    { o: -0.05, y: y - 0.35 },
    { o: 0, y: y - 0.1 },
    { o: -m * 0.5, y: y + rise * 0.56 },
    { o: -m * 0.9, y: y + rise * 0.97 },
    { o: -m, y: y + rise },
  ], { smooth: true });
}

// ------------------------------------------------------------------------------------------------ props

/** A lathe-turned storage jar (amphora-like), `h` tall. */
export function jar(b: GeoBuilder, slot: Slot, x: number, y: number, z: number, h: number) {
  b.lathe(slot, x, y, z, [[0, 0], [h * 0.12, 0.02 * h], [h * 0.3, h * 0.35], [h * 0.28, h * 0.62], [h * 0.12, h * 0.85], [h * 0.1, h * 0.95], [h * 0.14, h], [0.001, h]], 10);
}

export function basket(b: GeoBuilder, x: number, y: number, z: number, r: number, fill: Slot | null = "foliage") {
  b.lathe("thatch", x, y, z, [[0, 0], [r * 0.8, 0], [r, r * 0.7], [r * 1.02, r * 0.75], [r * 0.9, r * 0.75]], 12);
  if (fill) b.sphere(fill, x, y + r * 0.62, z, r * 0.88, r * 0.3, r * 0.88, 10, 5);
}

export function crate(b: GeoBuilder, x: number, y: number, z: number, s: number, yaw = 0) {
  b.box("wood", x, y + s / 2, z, s, s, s, yaw);
  b.box("woodDark", x, y + s / 2, z, s * 1.02, s * 0.14, s * 1.02, yaw);
}

export function sack(b: GeoBuilder, x: number, y: number, z: number, s: number) {
  b.sphere("rope", x, y + s * 0.45, z, s * 0.42, s * 0.5, s * 0.38, 8, 6);
  b.cyl("rope", x, y + s * 0.85, z, s * 0.12, s * 0.2, s * 0.2, 6);
}

export function bench(b: GeoBuilder, slot: Slot, x: number, z: number, len: number, yaw = 0) {
  b.at(x, 0, z, yaw, () => {
    b.blk(slot, -len / 2, 0.35, -0.22, len / 2, 0.45, 0.22);
    b.blk(slot, -len / 2 + 0.1, 0, -0.18, -len / 2 + 0.3, 0.35, 0.18);
    b.blk(slot, len / 2 - 0.3, 0, -0.18, len / 2 - 0.1, 0.35, 0.18);
  });
}

/** A flagpole with a pennant (the pennant is a separate sway mover authored by the caller). */
export function flagpole(b: GeoBuilder, x: number, y0: number, z: number, h: number, r = 0.12) {
  b.cyl("wood", x, y0, z, r, r * 0.6, h, 8);
}

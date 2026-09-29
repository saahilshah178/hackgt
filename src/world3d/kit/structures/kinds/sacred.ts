import * as THREE from "three";
import { cavettoProfile, xform, type GeoBuilder } from "../geom";
import type { Ctx } from "../model";
import { batteredBlock, bench, cavettoAround, column, columnKindFor, doorway, glyphColumn, jar, steppedBase, windowOn, wingedDisc } from "../parts";
import { battlements, doorLeaves, hall, roofOver } from "./hall";
import { archedSlab, mesoPyramid, roughStone } from "./monuments";

/*
 * Temples, libraries, tombs, shrines, palaces, colonnades, ruins, observatories and amphitheatres. The Egyptian forms
 * are bespoke (pylon gateway with battered towers, flagstaffs and a winged-disc portal; a court with papyrus columns;
 * the House of Life with its porch of scroll niches; a mastaba with palace-facade niching and a sealed false door);
 * the other styles build on the shared hall archetype (./hall.ts).
 */

const scaled = (b: GeoBuilder, s: number, fn: () => void) => b.with(new THREE.Matrix4().makeScale(s, s, s), fn);

// ------------------------------------------------------------------------------------------------ Egyptian pieces

/** A pylon tower: battered block with torus corner beads, cavetto crown, flagstaff niches and glyph registers. */
function pylonTower(b: GeoBuilder, c: Ctx, cx: number, cz: number, hx: number, hz: number, h: number, flags: number) {
  const bat = 0.085;
  const inset = bat * h;
  b.rectLoft("main", cx, cz, hx, hz, [
    { o: 0, y: 0 },
    { o: -inset, y: h },
  ], { capTop: false });
  // torus beads up the four corners
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) b.rod("trim", [cx + sx * hx, 0, cz + sz * hz], [cx + sx * (hx - inset), h, cz + sz * (hz - inset)], 0.2, 0.2, 6);
  b.rectLoft("trim", cx, cz, hx - inset, hz - inset, cavettoProfile(h, 1.25, -(hz - inset) + 0.05), { smooth: true });
  // a painted band under the cornice
  b.rectLoft("paint", cx, cz, hx - inset + 0.02, hz - inset + 0.02, [
    { o: 0.02, y: h - 0.75 },
    { o: 0.02, y: h - 0.45 },
  ], { capTop: false });
  // front face: flagstaff niches with poles and glyph registers between them
  const lean = Math.atan(bat);
  b.with(xform(cx, 0, cz + hz, 0, -lean), () => {
    for (let i = 0; i < flags; i++) {
      const fx = (i - (flags - 1) / 2) * hx * 0.9;
      b.quad("dark", fx, h * 0.5, 0.015, 0.7, h * 0.98);
      b.with(xform(fx + (i === 0 ? 1.6 : -1.6) * (flags > 1 ? 1 : 0), 0, 0), () => {
        if (flags > 1 && i === 0) glyphColumn(b, c.rng, h * 0.1, h * 0.8, 1.1);
      });
    }
    // two tall registers of text beside the portal side
    glyphColumn(b, c.rng, h * 0.08, h * 0.72, 1.0);
    for (let k = 0; k < 3; k++) b.quad("main2", 0, h * (0.2 + k * 0.22), 0.01, hx * 1.7, 0.09);
  });
  // flagstaffs standing in the niches, taller than the pylon, with pennants
  for (let i = 0; i < flags; i++) {
    const fx = cx + (i - (flags - 1) / 2) * hx * 0.9;
    const fz = cz + hz + 0.5;
    b.cyl("wood", fx, 0, fz, 0.2, 0.12, h + 3.2, 8);
    b.blk("wood", fx - 0.25, h * 0.55, fz - 0.9, fx + 0.25, h * 0.55 + 0.3, fz + 0.1);
    // pylonTower runs inside a scaled frame; movers are built in model space, so scale their pivot and geometry
    const k = c.s;
    c.mover("sway", [fx * k, (h + 2.6) * k, fz * k], [0, 0.25, 0], true, (mb) => {
      scaled(mb, k, () =>
        mb.sheet(
          i % 2 ? "paint2" : "sail",
          [0, 1, 2, 3].map((q) => [0, 1, 2, 3, 4].map((j) => [fx + 0.04 + j * 0.9 + Math.sin(j + q) * 0.05, h + 2.6 - q * 0.35 - j * 0.12, fz + Math.sin(j * 1.3) * 0.25] as const)),
          true,
        ),
      );
    });
  }
}

function egyptTemple(c: Ctx) {
  const { b, s } = c;
  scaled(b, s, () => {
    // pylon: two towers and the portal between them
    const pz = 18.5;
    for (const sx of [-1, 1]) pylonTower(b, c, sx * 8.6, pz, 6.2, 2.9, 13.2, 2);
    archedSlab(b, "main", 5.8, 10.2, 2.7, 6.6, 4.4, pz - 2.1, "flat");
    b.blk("main2", -2.9, 0, pz - 2.1, 2.9, 0.18, pz + 2.3);
    b.rectLoft("trim", 0, pz + 0.1, 2.9, 2.2, cavettoProfile(10.2, 0.9, -2.1), { smooth: true });
    wingedDisc(b, 0, 8.4, pz + 2.33, 4.6);
    // ramp and forecourt paving in front
    b.blk("trim", -6, -0.3, pz + 2.3, 6, 0.22, 21.8);
    // the court: enclosure walls, paving, side porticoes
    const cz0 = 2.5;
    const cz1 = pz - 2.9;
    b.blk("trim", -11.3, -0.2, cz0, 11.3, 0.14, cz1);
    for (const sx of [-1, 1]) {
      batteredBlock(b, "main", sx * 11.3, (cz0 + cz1) / 2, 0.55, (cz1 - cz0) / 2, 0, 7.2, 0.03);
      cavettoAround(b, sx * 11.3 - 0.35, cz0, sx * 11.3 + 0.35, cz1, 7.0, 0.55);
      for (let i = 0; i < 4; i++) {
        const z = 6.2 + i * 2.75;
        column(b, "papyrus", sx * 8.7, 0.14, z, 6.4, 0.46);
      }
      b.blk("trim", sx * 8.7 - 0.55, 6.54, 5.5, sx * 8.7 + 0.55, 7.1, 15.2);
      b.blk("main", Math.min(sx * 8.1, sx * 11.0), 7.1, 5.3, Math.max(sx * 8.1, sx * 11.0), 7.35, 15.4);
    }
    // the hypostyle hall with a raised clerestory nave
    const hz0 = -21;
    batteredBlock(b, "main", 0, (hz0 + cz0) / 2, 12.5, (cz0 - hz0) / 2, 0, 9.4, 0.04);
    cavettoAround(b, -12.1, hz0 + 0.4, 12.1, cz0 - 0.4, 9.4, 0.8);
    b.blk("main", -4.6, 9.4, hz0 + 3, 4.6, 11.4, cz0 - 1.2);
    cavettoAround(b, -4.6, hz0 + 3, 4.6, cz0 - 1.2, 11.4, 0.6);
    for (let i = -3; i <= 3; i++) b.quad("dark", i * 1.25, 10.4, cz0 - 1.18, 0.5, 1.1);
    for (let i = 0; i < 6; i++) b.at(12.5 - 0.35, 0, -17 + i * 3.4, Math.PI / 2, () => b.quad("dark", 0, 7.4, 0.02, 0.45, 1.2));
    for (let i = 0; i < 6; i++) b.at(-12.5 + 0.35, 0, -17 + i * 3.4, -Math.PI / 2, () => b.quad("dark", 0, 7.4, 0.02, 0.45, 1.2));
    // the hall's portico: open papyrus columns with screen walls between the outer ones
    const colZ = cz0 + 1.6;
    const xs = [-10.2, -6.1, -2.1, 2.1, 6.1, 10.2];
    for (const x of xs) column(b, "papyrus_open", x, 0.14, colZ, 8.6, 0.72);
    for (let i = 0; i < xs.length - 1; i++) {
      if (i === 2) continue;
      const x0 = xs[i] + 0.75;
      const x1 = xs[i + 1] - 0.75;
      b.blk("main", x0, 0.14, colZ - 0.35, x1, 3.1, colZ + 0.35);
      cavettoAround(b, x0, colZ - 0.35, x1, colZ + 0.35, 3.1, 0.35);
      b.with(xform((x0 + x1) / 2, 0.3, colZ + 0.36), () => {
        for (let k = 0; k < 2; k++) b.quad("main2", 0, 1.1 + k * 1.2, 0.01, x1 - x0 - 0.4, 0.07);
      });
    }
    b.blk("trim", -11.2, 8.74, cz0 - 0.2, 11.2, 9.4, colZ + 1.0);
    cavettoAround(b, -11.2, cz0, 11.2, colZ + 1.0, 9.4, 0.55);
    b.blk("paint", -11.22, 8.74, colZ + 0.99, 11.22, 9.0, colZ + 1.02);
    // the hall door behind the central bay
    doorway(b, "ancient_egypt", 0, 0.14, cz0, 2.2, 4.8);
    // offering tables and jars in the court
    b.blk("trim", -0.8, 0.14, 9.5, 0.8, 1.0, 10.3);
    for (const sx of [-1, 1]) {
      jar(b, "paint2", sx * 1.5, 0.14, 9.9, 0.9);
      jar(b, "paint2", sx * 1.9, 0.14, 10.4, 0.7);
    }
  });
  // portal doors (open unless this temple is sealed)
  const ds = s;
  doorLeaves(c, 0, 0.18 * ds, (18.5 + 2.3 - 0.4) * ds, 2.7 * ds, 6.55 * ds, true);
}

function egyptLibrary(c: Ctx) {
  const { b, s } = c;
  scaled(b, s, () => {
    // body of the House of Life: battered limestone walls with cavetto, raised on a low terrace
    b.rectLoft("trim", 0, 0.5, 11.2, 11.0, [
      { o: 0, y: -0.3 },
      { o: 0, y: 0.45 },
      { o: -0.08, y: 0.52 },
    ]);
    batteredBlock(b, "main", 0, -3.5, 10.4, 6.8, 0.52, 7.8, 0.035);
    cavettoAround(b, -10.14, -10.04, 10.14, 3.04, 7.8, 0.75);
    b.rectLoft("paint", 0, -3.5, 10.16, 6.56, [
      { o: 0.03, y: 7.3 },
      { o: 0.03, y: 7.6 },
    ], { capTop: false });
    // clerestory kiosk on the roof
    b.blk("main", -4, 8.9, -8, 4, 10.3, -2);
    cavettoAround(b, -4, -8, 4, -2, 10.3, 0.4);
    for (let i = -2; i <= 2; i++) b.quad("dark", i * 1.4, 9.6, -1.98, 0.5, 0.9);
    // porch: four papyrus columns, a roof slab, screen walls at the ends
    const pz = 8.2;
    const xs = [-6.3, -2.1, 2.1, 6.3];
    for (const x of xs) column(b, "papyrus", x, 0.52, pz, 6.6, 0.5);
    b.blk("trim", -10.2, 7.12, 3.2, 10.2, 7.8, pz + 0.9);
    cavettoAround(b, -10.2, 3.2, 10.2, pz + 0.9, 7.8, 0.6);
    b.blk("paint", -10.22, 7.12, pz + 0.89, 10.22, 7.35, pz + 0.92);
    wingedDisc(b, 0, 7.45, pz + 0.95, 4.2);
    for (const sx of [-1, 1]) {
      b.blk("main", sx * 10.2 - (sx > 0 ? 1.1 : 0), 0.52, 3.2, sx * 10.2 + (sx < 0 ? 1.1 : 0), 7.12, pz + 0.5);
      b.blk("main", sx * 8.3 - 0.9, 0.52, pz - 0.35, sx * 8.3 + 0.9, 2.6, pz + 0.35);
    }
    // back wall of the porch: scroll niches (pigeonholes) either side of the door
    const wz = 3.06;
    for (const sx of [-1, 1]) {
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 6; col++) {
          const x = sx * (2.4 + col * 0.95);
          const y = 1.3 + row * 0.95;
          b.quad("dark", x, y, wz + 0.02, 0.72, 0.62);
          // scroll ends peeking out of the niche
          const n = 2 + ((row * 7 + col * 3) % 3);
          for (let k = 0; k < n; k++) b.cyl("sail", x - 0.22 + k * 0.17, y - 0.24 + (k % 2) * 0.14, wz + 0.02, 0.07, 0.07, 0.12, 8, 0, Math.PI / 2);
        }
      }
      b.blk("trim", sx * 2.0 - (sx > 0 ? 0 : 5.6), 0.7, wz, sx * 2.0 + (sx > 0 ? 5.6 : 0), 0.85, wz + 0.4);
    }
    doorway(b, "ancient_egypt", 0, 0.52, wz, 2.0, 4.2);
    // benches and a scribe's desk in the porch
    bench(b, "trim", -4.6, 5.8, 3.2);
    bench(b, "trim", 4.6, 5.8, 3.2);
    b.blk("wood", -0.9, 0.52, 6.0, 0.9, 1.25, 6.8);
    b.cyl("sail", -0.3, 1.25, 6.4, 0.08, 0.08, 0.9, 8, Math.PI / 2, Math.PI / 2);
    // steps up to the terrace
    for (let i = 0; i < 2; i++) b.blk("trim", -3.5, 0, 11.5 - i * 0.3, 3.5, 0.26 * (i + 1), 11.8 - i * 0.3);
  });
}

function mastaba(c: Ctx) {
  const { b, s } = c;
  scaled(b, s, () => {
    const hx = 7.2;
    const hz = 4.7;
    const H = 4.4;
    const bat = 0.16;
    b.rectLoft("trim", 0, 0, hx + 0.3, hz + 0.3, [
      { o: 0, y: -0.3 },
      { o: 0, y: 0.25 },
    ]);
    batteredBlock(b, "main", 0, 0, hx, hz, 0.25, H, bat);
    // roof slab edge
    b.rectLoft("trim", 0, 0, hx - bat * (H - 0.25), hz - bat * (H - 0.25), [
      { o: 0.08, y: H },
      { o: 0.08, y: H + 0.3 },
      { o: -0.2, y: H + 0.3 },
    ]);
    // palace-facade niching on all four faces: shallow recessed panels (dark lines) between pilasters
    const lean = Math.atan(bat);
    const faces: [number, number, number][] = [
      [0, hz, hx],
      [Math.PI, hz, hx],
      [Math.PI / 2, hx, hz],
      [-Math.PI / 2, hx, hz],
    ];
    for (const [yaw, off, half] of faces) {
      b.at(0, 0, 0, yaw, () => {
        b.with(xform(0, 0.25, off, 0, -lean), () => {
          const n = Math.floor((half * 2) / 1.2);
          for (let i = 0; i < n; i++) {
            const x = -half + 0.6 + ((half * 2 - 1.2) * i) / (n - 1);
            if (yaw === 0 && Math.abs(x) < 2.2) continue;
            b.quad("main2", x, (H - 0.25) * 0.47, 0.01, 0.42, (H - 0.25) * 0.86);
            b.quad("dark", x - 0.24, (H - 0.25) * 0.47, 0.012, 0.05, (H - 0.25) * 0.86);
          }
        });
      });
    }
    // the false door, recessed in steps, with a drum roll and a sealed stone
    const fz = hz - bat * 1.5;
    b.blk("main2", -2.1, 0.25, fz - 0.4, 2.1, 3.9, fz + 0.12);
    b.blk("main", -1.6, 0.25, fz - 0.3, 1.6, 3.4, fz + 0.22);
    b.blk("trim", -2.3, 3.4, fz - 0.4, 2.3, 3.75, fz + 0.3);
    b.cyl("trim", -1.0, 2.8, fz + 0.22, 0.14, 0.14, 2.0, 10, 0, 0, -Math.PI / 2);
    b.with(xform(0, 0, fz + 0.3), () => {
      for (let i = 0; i < 4; i++) b.quad("dark", 0, 3.56 - i * 0.07, 0.01, 3.4 - i * 0.3, 0.03);
      glyphColumn(b, c.rng, 0.5, 3.2, 0.55);
    });
    b.quad("dark", 0, 1.35, fz + 0.23, 1.3, 2.2);
    // offering table and two stelae
    b.blk("trim", -0.7, 0, hz + 1.1, 0.7, 0.55, hz + 1.9);
    b.sphere("main2", 0, 0.6, hz + 1.5, 0.35, 0.1, 0.25, 8, 4);
    for (const sx of [-1, 1]) {
      b.blk("main2", sx * 3.1 - 0.4, 0.25, hz + 0.15, sx * 3.1 + 0.4, 2.2, hz + 0.45);
      b.lathe("main2", sx * 3.1, 2.2, hz + 0.3, [[0.4, 0], [0.3, 0.2], [0, 0.3]], 8);
    }
  });
  // the seal: a stone slab across the doorway that slides aside when opened
  c.mover("slide", [0, 0.25 * s, (4.7 - 0.24 + 0.32) * s], [1.6 * s, 0, 0], false, (mb) => {
    mb.blk("main2", -0.8 * s, 0.25 * s, (4.7 - 0.24 + 0.24) * s, 0.8 * s, 2.55 * s, (4.7 - 0.24 + 0.42) * s);
    mb.with(xform(0, 0, (4.7 - 0.24 + 0.425) * s), () => {
      mb.cyl("paint2", 0, 1.35 * s, 0, 0.22 * s, 0.22 * s, 0.05 * s, 12, 0, Math.PI / 2);
    });
  });
}

// ------------------------------------------------------------------------------------------------ temple

export function temple(c: Ctx) {
  const { style, r, h, s } = c;
  switch (style) {
    case "ancient_egypt":
      egyptTemple(c);
      return;
    case "mesoamerican":
      mesoPyramid(c, r * 0.72, r * 0.62, h * 1.2, 4);
      return;
    case "classical":
      classicalTemple(c);
      return;
    case "medieval":
      church(c);
      return;
    default: {
      hall(c, { hx: r * 0.55, hz: r * 0.62, wallH: h * (style === "modern" ? 0.62 : style === "futuristic" ? 0.45 : 0.42), podium: 1.4 * s, porch: { depth: r * 0.22, cols: 6 }, doorMover: true, door: { w: 2.2 * s, h: 3.6 * s }, roofRise: style === "nordic" || style === "rustic" ? 0.5 : 0.45 });
    }
  }
}

function classicalTemple(c: Ctx) {
  const { b, r, h, s } = c;
  const hx = r * 0.55;
  const hz = r * 0.9;
  const y0 = steppedBase(b, "trim", 0, 0, hx, hz, 3, 0.5 * s, 0.5 * s);
  const colH = h * 0.6;
  const cr = colH / 11;
  const nx = 6;
  const nz = 13;
  const ix = hx - 1.5 * s - cr;
  const iz = hz - 1.5 * s - cr;
  const kind = columnKindFor("classical", c.variant);
  for (let i = 0; i < nx; i++) {
    const x = -ix + (2 * ix * i) / (nx - 1);
    column(b, kind, x, y0, iz, colH, cr, "trim");
    column(b, kind, x, y0, -iz, colH, cr, "trim");
  }
  for (let i = 1; i < nz - 1; i++) {
    const z = -iz + (2 * iz * i) / (nz - 1);
    column(b, kind, ix, y0, z, colH, cr, "trim");
    column(b, kind, -ix, y0, z, colH, cr, "trim");
  }
  // cella
  const chx = ix - cr * 3.2;
  const chz = iz - cr * 5.5;
  b.blk("main", -chx, y0, -chz, chx, y0 + colH, chz);
  doorway(b, "classical", 0, y0, chz, 2.6 * s, colH * 0.62, { arch: false });
  doorLeaves(c, 0, y0, chz - 0.05, 2.6 * s, colH * 0.62, true);
  // entablature: architrave, triglyph frieze, then the cornice and roof via roofOver
  const ex = ix + cr * 1.3;
  const ez = iz + cr * 1.3;
  const ya = y0 + colH;
  b.rectLoft("trim", 0, 0, ex, ez, [
    { o: 0, y: ya },
    { o: 0, y: ya + 0.45 * s },
    { o: 0.05 * s, y: ya + 0.5 * s },
    { o: 0.05 * s, y: ya + 0.9 * s },
    { o: 0, y: ya + 0.95 * s },
  ], { capTop: false });
  b.rectLoft("main", 0, 0, ex, ez, [
    { o: 0, y: ya + 0.95 * s },
    { o: 0, y: ya + 1.85 * s },
  ], { capTop: false });
  const tw = 0.35 * s;
  for (const [yaw, off, half] of [
    [0, ez, ex],
    [Math.PI, ez, ex],
    [Math.PI / 2, ex, ez],
    [-Math.PI / 2, ex, ez],
  ] as [number, number, number][]) {
    b.at(0, 0, 0, yaw, () => {
      const n = Math.round((half * 2) / (1.1 * s));
      for (let i = 0; i <= n; i++) {
        const x = -half + (2 * half * i) / n;
        b.blk("main2", x - tw / 2, ya + 0.95 * s, off - 0.02, x + tw / 2, ya + 1.85 * s, off + 0.06);
        for (let k = 0; k < 2; k++) b.quad("dark", x - tw / 6 + (k * tw) / 3, ya + 1.4 * s, off + 0.065, 0.04 * s, 0.75 * s);
      }
    });
  }
  roofOver(c, "classical", ex, ez, ya + 1.85 * s);
}

function church(c: Ctx) {
  const { b, r, h, s } = c;
  const hx = r * 0.36;
  const hz = r * 0.78;
  const wallH = h * 0.45;
  b.rectLoft("main2", 0, 0, hx + 0.25 * s, hz + 0.25 * s, [
    { o: 0, y: -0.3 },
    { o: 0, y: 0.6 * s },
    { o: -0.25 * s, y: 0.9 * s },
  ]);
  b.blk("main", -hx, 0, -hz, hx, wallH, hz);
  // buttresses and lancet windows
  const n = 5;
  for (let i = 0; i < n; i++) {
    const z = -hz + ((i + 0.5) * 2 * hz) / n;
    for (const sx of [-1, 1]) {
      b.rectLoft("trim", sx * (hx + 0.45 * s), z, 0.45 * s, 0.4 * s, [
        { o: 0, y: 0 },
        { o: 0, y: wallH * 0.6 },
        { o: -0.25 * s, y: wallH * 0.85 },
      ]);
      const zz = z + hz / n;
      if (i < n - 1) b.at(sx * hx, 0, zz, (sx * Math.PI) / 2, () => windowOn(b, "medieval", 0, wallH * 0.3, 0, 0.9 * s, wallH * 0.5));
    }
  }
  // west front with a rose window and a pointed door
  b.add("dark", new THREE.CircleGeometry(1.2 * s, 16), xform(0, wallH * 0.75, hz + 0.03));
  b.add("trim", new THREE.TorusGeometry(1.25 * s, 0.14 * s, 6, 20), xform(0, wallH * 0.75, hz + 0.05));
  archedSlab(b, "trim", 3.2 * s, 4.4 * s, 2.0 * s, 3.8 * s, 0.4 * s, hz - 0.1, "pointed");
  b.quad("dark", 0, 1.5 * s, hz, 2.0 * s, 3.0 * s);
  doorLeaves(c, 0, 0, hz + 0.05, 2.0 * s, 2.8 * s, false);
  roofOver(c, "slate", hx, hz, wallH, 1.0);
  // bell tower at the front left corner with a spire
  const tx = -hx - 1.5 * s;
  const tz = hz - 2.2 * s;
  const tw = 2.2 * s;
  const th = h * 0.72;
  b.blk("main", tx - tw, 0, tz - tw, tx + tw, th, tz + tw);
  for (const [yaw, off] of [
    [0, tw],
    [Math.PI, tw],
    [Math.PI / 2, tw],
    [-Math.PI / 2, tw],
  ] as [number, number][]) b.at(tx, 0, tz, yaw, () => windowOn(b, "medieval", 0, th - 3.2 * s, off, 1.0 * s, 2.2 * s));
  b.rectLoft("roof", tx, tz, tw + 0.3 * s, tw + 0.3 * s, [
    { o: 0, y: th },
    { o: -tw - 0.3 * s, y: th + h * 0.5 },
  ]);
  b.rod("metal", [tx, th + h * 0.5, tz], [tx, th + h * 0.5 + 1.0 * s, tz], 0.05 * s);
}

// ------------------------------------------------------------------------------------------------ library

export function library(c: Ctx) {
  const { style, r, h, s } = c;
  if (style === "ancient_egypt") return egyptLibrary(c);
  if (style === "mesoamerican") {
    hall(c, { hx: r * 0.75, hz: r * 0.5, wallH: h * 0.5, podium: 1.8 * s, porch: { depth: r * 0.28, cols: 5 }, door: { w: 2 * s, h: 3 * s }, roofRise: 0.45 });
    return;
  }
  hall(c, {
    hx: r * 0.72,
    hz: r * 0.52,
    wallH: h * (style === "classical" ? 0.55 : 0.6),
    podium: style === "classical" || style === "east_asian" ? 1.2 * s : 0,
    porch: style === "classical" || style === "east_asian" || style === "modern" ? { depth: r * 0.3, cols: style === "classical" ? 6 : 4 } : undefined,
    storeys: style === "medieval" || style === "industrial" ? 2 : 1,
    timbered: false,
    door: { w: 2.2 * s, h: 3.2 * s },
    doorMover: true,
    roofRise: style === "medieval" || style === "nordic" || style === "rustic" ? 0.55 : style === "industrial" ? 0.4 : undefined,
  });
}

// ------------------------------------------------------------------------------------------------ tomb

export function tomb(c: Ctx) {
  const { b, style, r, h, s } = c;
  if (style === "ancient_egypt") return mastaba(c);
  if (style === "classical") {
    // a mausoleum: podium, cella, pediment porch with columns, sealed bronze door
    hall(c, { hx: r * 0.45, hz: r * 0.42, wallH: h * 0.5, podium: 1.2 * s, porch: { depth: r * 0.3, cols: 4 }, roof: "classical", door: { w: 1.6 * s, h: 2.4 * s } });
    tombSeal(c, 0, 1.2 * s, r * 0.42 + 0.05, 1.6 * s, 2.4 * s);
    return;
  }
  if (style === "nordic" || style === "rustic") {
    // a barrow: a turf mound with a stone passage entrance
    b.lathe("foliage", 0, 0, 0, [[0, h * 0.95], [r * 0.4, h * 0.85], [r * 0.7, h * 0.55], [r * 0.9, h * 0.2], [r * 0.98, 0], [r * 0.98, -0.5]], 20);
    b.blk("main", -1.6 * s, 0, r * 0.6, 1.6 * s, 2.6 * s, r * 0.86);
    b.blk("main2", -1.9 * s, 2.6 * s, r * 0.58, 1.9 * s, 3.1 * s, r * 0.9);
    b.quad("dark", 0, 1.1 * s, r * 0.861, 1.6 * s, 2.2 * s);
    tombSeal(c, 0, 0, r * 0.87, 1.7 * s, 2.3 * s);
    return;
  }
  if (style === "mesoamerican") {
    mesoPyramid(c, r * 0.8, r * 0.7, h, 3);
    tombSeal(c, 0, 0, r * 0.72, 1.4 * s, 2 * s);
    return;
  }
  // medieval crypt / generic: a stone block with a gabled roof and an iron-bound door
  const hx = r * 0.55;
  const hz = r * 0.7;
  b.rectLoft("main2", 0, 0, hx + 0.3 * s, hz + 0.3 * s, [
    { o: 0, y: -0.3 },
    { o: 0, y: 0.5 * s },
  ]);
  b.blk("main", -hx, 0.5 * s, -hz, hx, h * 0.6, hz);
  roofOver(c, style === "modern" || style === "futuristic" ? "flat" : "classical", hx, hz, h * 0.6);
  doorway(b, style, 0, 0.5 * s, hz, 1.6 * s, 2.5 * s);
  tombSeal(c, 0, 0.5 * s, hz + 0.08, 1.6 * s, 2.5 * s);
}

/** A sealing slab in front of a doorway (slides aside when opened). */
function tombSeal(c: Ctx, x: number, y0: number, z: number, w: number, h: number) {
  c.mover("slide", [x, y0, z], [w * 1.05, 0, 0], false, (mb) => {
    mb.blk("main2", x - w / 2 - 0.05, y0, z, x + w / 2 + 0.05, y0 + h + 0.05, z + 0.2 * c.s);
    mb.cyl("paint2", x, y0 + h * 0.55, z + 0.2 * c.s, 0.2 * c.s, 0.2 * c.s, 0.04 * c.s, 12, 0, Math.PI / 2);
  });
}

// ------------------------------------------------------------------------------------------------ shrine

export function shrine(c: Ctx) {
  const { b, style, r, h, s } = c;
  switch (style) {
    case "ancient_egypt": {
      // a naos: a small battered chapel with cavetto, on a base, with offerings
      b.rectLoft("trim", 0, 0, r * 0.75, r * 0.75, [
        { o: 0, y: -0.2 },
        { o: 0, y: 0.35 * s },
      ]);
      batteredBlock(b, "main", 0, -r * 0.1, r * 0.5, r * 0.45, 0.35 * s, h * 0.78, 0.06);
      cavettoAround(b, -r * 0.46, -r * 0.52, r * 0.46, r * 0.32, h * 0.78, 0.35 * s);
      doorway(b, style, 0, 0.35 * s, r * 0.33, 0.8 * s, 1.5 * s);
      b.blk("trim", -0.45 * s, 0.35 * s, r * 0.5, 0.45 * s, 0.9 * s, r * 0.72);
      jar(b, "paint2", -0.25 * s, 0.9 * s, r * 0.6, 0.35 * s);
      b.sphere("foliage", 0.2 * s, 1.0 * s, r * 0.6, 0.18 * s, 0.1 * s, 0.14 * s, 8, 4);
      return;
    }
    case "east_asian": {
      b.blk("trim", -r * 0.6, 0, -r * 0.6, r * 0.6, 0.5 * s, r * 0.6);
      b.blk("paint", -r * 0.42, 0.5 * s, -r * 0.42, r * 0.42, h * 0.55, r * 0.42);
      b.quad("dark", 0, h * 0.35, r * 0.43, r * 0.5, h * 0.3);
      roofOver(c, "pagoda", r * 0.42, r * 0.42, h * 0.55, 0.9);
      return;
    }
    case "nordic":
    case "rustic": {
      // a carved post shrine with a little gabled roof over an offering shelf
      b.cyl("wood", 0, 0, 0, 0.22 * s, 0.2 * s, h * 0.8, 8);
      b.blk("wood", -0.6 * s, h * 0.5, -0.4 * s, 0.6 * s, h * 0.55, 0.4 * s);
      b.blk("woodDark", -0.45 * s, h * 0.55, -0.3 * s, 0.45 * s, h * 0.75, 0.3 * s);
      b.quad("dark", 0, h * 0.65, 0.31 * s, 0.5 * s, 0.3 * s);
      roofOver(c, style === "nordic" ? "turf" : "thatch", 0.55 * s, 0.45 * s, h * 0.75, 0.9);
      for (let i = 0; i < 3; i++) jar(b, "paint2", -0.9 * s + i * 0.9 * s, 0, r * 0.7, 0.35 * s);
      return;
    }
    default: {
      // an aedicula / altar with a pediment
      b.rectLoft("trim", 0, 0, r * 0.6, r * 0.5, [
        { o: 0, y: -0.2 },
        { o: 0, y: 0.5 * s },
      ]);
      b.blk("main", -r * 0.45, 0.5 * s, -r * 0.35, r * 0.45, h * 0.65, r * 0.2);
      for (const sx of [-1, 1]) column(b, columnKindFor(style, 1), sx * r * 0.36, 0.5 * s, r * 0.32, h * 0.65 - 0.5 * s, 0.14 * s, "trim");
      b.blk("trim", -r * 0.52, h * 0.65, -r * 0.4, r * 0.52, h * 0.72, r * 0.45);
      b.prism("trim", [[-r * 0.52, 0], [r * 0.52, 0], [0, h * 0.25]], r * 0.85, xform(0, h * 0.72, -r * 0.4));
      b.quad("dark", 0, h * 0.4, r * 0.21, r * 0.45, h * 0.35);
      b.lathe("glow", 0, 0.5 * s, r * 0.1, [[0.12 * s, 0], [0.12 * s, 0.1 * s], [0, 0.1 * s]], 8);
    }
  }
}

// ------------------------------------------------------------------------------------------------ palace

export function palace(c: Ctx) {
  const { b, style, r, h, s } = c;
  if (style === "ancient_egypt") {
    scaled(b, s, () => {
      // a walled palace: pylon-fronted gate, a hall with a window of appearances, courtyards and garden pool
      for (const sx of [-1, 1]) pylonTower(b, c, sx * 9.5, 24.5, 5.6, 2.6, 12.5, 1);
      archedSlab(b, "main", 7.6, 9.6, 3.2, 6.2, 4, 22.3, "flat");
      b.rectLoft("trim", 0, 24.3, 3.8, 2.0, cavettoProfile(9.6, 0.8, -1.9), { smooth: true });
      wingedDisc(b, 0, 7.8, 26.35, 5);
      for (const [x0, z0, x1, z1] of [
        [-26.5, -26.5, -25.5, 22],
        [25.5, -26.5, 26.5, 22],
        [-26.5, -26.5, 26.5, -25.5],
        [-26.5, 22, -15, 23],
        [15, 22, 26.5, 23],
      ] as [number, number, number, number][]) {
        b.blk("main", x0, 0, z0, x1, 6, z1);
        cavettoAround(b, x0, z0, x1, z1, 6, 0.45);
      }
      b.blk("trim", -25.5, -0.2, -25.5, 25.5, 0.12, 22);
      // the main hall with a columned front
      batteredBlock(b, "main", 0, -12, 17, 10, 0.12, 11, 0.03);
      cavettoAround(b, -16.7, -21.7, 16.7, -2.3, 11, 0.9);
      for (let i = 0; i < 8; i++) column(b, "papyrus_open", -14 + i * 4, 0.12, 0.2, 9.4, 0.6);
      b.blk("trim", -16.5, 9.5, -2.3, 16.5, 10.3, 1.4);
      cavettoAround(b, -16.5, -2.3, 16.5, 1.4, 10.3, 0.55);
      b.blk("paint", -16.52, 9.5, 1.38, 16.52, 9.8, 1.42);
      doorway(b, "ancient_egypt", 0, 0.12, -2, 3, 5.5);
      // window of appearances with a balcony
      b.quad("dark", 0, 8.0, -1.98, 3.2, 1.6);
      b.blk("trim", -2.2, 6.9, -2, 2.2, 7.2, -0.9);
      // side wings and the garden pool with palms of stone columns
      for (const sx of [-1, 1]) {
        batteredBlock(b, "main", sx * 18.5, 8, 6, 9, 0.12, 7, 0.03);
        cavettoAround(b, sx * 18.5 - 5.8, -0.8, sx * 18.5 + 5.8, 16.8, 7, 0.5);
        for (let i = 0; i < 3; i++) b.at(sx * 12.5, 0, 3 + i * 5, sx * -Math.PI / 2 + Math.PI, () => doorway(b, "ancient_egypt", 0, 0.12, 0, 1.4, 2.6));
      }
      b.blk("trim", -6, 0, 6, 6, 0.3, 16);
      b.blk("water", -5.4, 0.05, 6.6, 5.4, 0.32, 15.4);
      for (const [x, z] of [
        [-7.5, 7],
        [7.5, 7],
        [-7.5, 15],
        [7.5, 15],
      ] as [number, number][]) {
        b.cyl("wood", x, 0, z, 0.2, 0.15, 6, 6);
        b.sphere("foliage", x, 6.3, z, 1.6, 0.6, 1.6, 8, 5);
      }
    });
    return;
  }
  if (style === "mesoamerican") {
    mesoPyramid(c, r * 0.9, r * 0.55, h * 0.8, 3);
    return;
  }
  if (style === "medieval" || style === "nordic") {
    // a castle-palace: a great hall with a crenellated keep at each end
    hall(c, { hx: r * 0.45, hz: r * 0.28, wallH: h * 0.42, storeys: 2, roofRise: 0.55, door: { w: 2.6 * s, h: 3.6 * s }, doorMover: true, timbered: style === "nordic" });
    for (const sx of [-1, 1]) {
      const cx = sx * r * 0.68;
      b.at(cx, 0, 0, 0, () => {
        b.blk("main", -r * 0.2, 0, -r * 0.2, r * 0.2, h * 0.9, r * 0.2);
        battlements(b, "main", r * 0.2, r * 0.2, h * 0.9, s);
        for (let i = 0; i < 3; i++) b.quad("dark", 0, h * (0.3 + i * 0.2), r * 0.201, 0.5 * s, 1.1 * s);
      });
    }
    return;
  }
  // a grand hall with a porch and two side pavilions
  hall(c, { hx: r * 0.5, hz: r * 0.36, wallH: h * 0.52, podium: 1.6 * s, porch: { depth: r * 0.2, cols: 8 }, door: { w: 3 * s, h: 4.2 * s }, doorMover: true, storeys: 2, roofRise: 0.4 });
  for (const sx of [-1, 1]) {
    b.at(sx * r * 0.76, 0, -r * 0.08, 0, () => {
      hall({ ...c, b }, { hx: r * 0.2, hz: r * 0.26, wallH: h * 0.45, door: { w: 1.4 * s, h: 2.6 * s } });
    });
  }
}

// ------------------------------------------------------------------------------------------------ colonnade

export function colonnade(c: Ctx) {
  const { b, style, r, h, s } = c;
  const len = r * 0.95;
  const gap = r * 0.28;
  const kind = columnKindFor(style, c.variant);
  const colH = h * 0.8;
  const cr = style === "ancient_egypt" ? 0.62 * s : colH / 11;
  const n = 7;
  b.blk("trim", -gap - 1.2 * s, -0.2, -len, gap + 1.2 * s, 0.25 * s, len);
  for (const sx of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const z = -len + cr * 1.6 + ((len - cr * 1.6) * 2 * i) / (n - 1);
      column(b, kind, sx * gap, 0.25 * s, z, colH, cr, style === "classical" ? "trim" : "main");
    }
    // architrave along each row
    b.blk(style === "east_asian" ? "paint" : "trim", sx * gap - cr * 1.3, 0.25 * s + colH, -len, sx * gap + cr * 1.3, 0.25 * s + colH + 0.8 * s, len);
    if (style === "ancient_egypt") cavettoAround(b, sx * gap - cr * 1.3, -len, sx * gap + cr * 1.3, len, 0.25 * s + colH + 0.8 * s, 0.45 * s);
  }
  // cross lintels
  for (let i = 0; i < n; i += 2) {
    const z = -len + cr * 1.6 + ((len - cr * 1.6) * 2 * i) / (n - 1);
    b.blk(style === "east_asian" ? "paint" : "trim", -gap, 0.25 * s + colH + 0.35 * s, z - cr * 0.6, gap, 0.25 * s + colH + 0.8 * s, z + cr * 0.6);
  }
}

// ------------------------------------------------------------------------------------------------ ruins

export function ruins(c: Ctx) {
  const { b, style, r, h, s, rng } = c;
  const kind = columnKindFor(style, c.variant);
  // a broken floor, stubs of walls, standing and fallen columns and rubble
  b.blk("trim", -r * 0.7, -0.3, -r * 0.55, r * 0.7, 0.2 * s, r * 0.55);
  const wall = (x0: number, z0: number, x1: number, z1: number, hh: number) => {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const top = hh * (0.35 + rng() * 0.65);
      const xa = x0 + (x1 - x0) * t0;
      const za = z0 + (z1 - z0) * t0;
      const xb = x0 + (x1 - x0) * t1;
      const zb = z0 + (z1 - z0) * t1;
      b.blk(i % 2 ? "main" : "main2", Math.min(xa, xb) - 0.35 * s, 0, Math.min(za, zb) - 0.35 * s, Math.max(xa, xb) + 0.35 * s, top, Math.max(za, zb) + 0.35 * s);
    }
  };
  wall(-r * 0.65, -r * 0.5, r * 0.4, -r * 0.5, h * 0.95);
  wall(-r * 0.65, -r * 0.5, -r * 0.65, r * 0.3, h * 0.7);
  for (let i = 0; i < 4; i++) {
    const x = -r * 0.3 + i * r * 0.28;
    const hh = h * (i === 1 ? 1.0 : 0.3 + rng() * 0.5);
    column(b, kind, x, 0.2 * s, r * 0.35, hh, 0.45 * s, "main");
  }
  // fallen column drums
  for (let i = 0; i < 4; i++) {
    const x = r * 0.35 + (rng() - 0.5) * r * 0.2;
    const z = -r * 0.1 + i * 1.1 * s;
    b.cyl("main", x, 0.45 * s, z, 0.45 * s, 0.45 * s, 1.0 * s, 12, rng() * 0.6, Math.PI / 2, 0);
  }
  for (let i = 0; i < 14; i++) {
    const a = rng() * Math.PI * 2;
    const d = r * (0.2 + rng() * 0.6);
    roughStone(b, "main2", Math.cos(a) * d, Math.sin(a) * d, (0.4 + rng() * 0.8) * s, (0.4 + rng() * 0.6) * s, (0.3 + rng() * 0.5) * s, rng, 0, rng() * 3);
  }
}

// ------------------------------------------------------------------------------------------------ observatory

export function observatory(c: Ctx) {
  const { b, style, r, h, s } = c;
  if (style === "east_asian") {
    // a platform with an armillary sphere
    b.blk("main", -r * 0.8, 0, -r * 0.8, r * 0.8, h * 0.45, r * 0.8);
    for (let i = 0; i < 6; i++) b.blk("trim", -1.8 * s, (i * h * 0.45) / 6, r * 0.8 + (6 - i) * 0.4 * s - 0.4 * s, 1.8 * s, ((i + 1) * h * 0.45) / 6, r * 0.8 + (6 - i) * 0.4 * s);
    battlements(b, "main", r * 0.8, r * 0.8, h * 0.45 + 0.9 * s, s, 0.4);
    const cy = h * 0.45 + 3.2 * s;
    for (let i = 0; i < 3; i++) b.add("metal", new THREE.TorusGeometry(2.2 * s, 0.07 * s, 6, 32), xform(0, cy, 0, i * 0.9, i === 1 ? Math.PI / 2 : 0.4));
    b.cyl("metal", 0, h * 0.45, 0, 0.15 * s, 0.15 * s, 1.2 * s, 8);
    return;
  }
  // a round tower (Caracol-like on a platform for mesoamerican) with a dome, slit and telescope
  const baseR = r * 0.7;
  const drumH = h * 0.55;
  if (style === "mesoamerican") steppedBase(b, "main", 0, 0, r * 0.9, r * 0.9, 2, 1.2 * s, 1.2 * s);
  const y0 = style === "mesoamerican" ? 2.4 * s : 0;
  b.lathe(style === "futuristic" ? "trim" : "main", 0, y0, 0, [[baseR + 0.3 * s, -0.4], [baseR + 0.3 * s, 0.6 * s], [baseR, 0.7 * s], [baseR, drumH], [baseR + 0.2 * s, drumH + 0.2 * s], [baseR + 0.2 * s, drumH + 0.45 * s], [0, drumH + 0.45 * s]], 28);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.at(Math.sin(a) * baseR, y0, Math.cos(a) * baseR, a, () => windowOn(b, style, 0, drumH * 0.45, 0.01, 0.8 * s, 1.5 * s));
  }
  doorway(b, style, 0, y0, baseR - 0.1, 1.4 * s, 2.4 * s, { arch: style !== "modern" });
  const domeR = baseR * 0.95;
  const dy = y0 + drumH + 0.45 * s;
  const domeSlot = style === "futuristic" || style === "modern" || style === "industrial" ? "metal" : style === "classical" ? "trim" : "roof";
  b.add(domeSlot, new THREE.SphereGeometry(domeR, 28, 12, 0.35, Math.PI * 2 - 0.7, 0, Math.PI / 2), xform(0, dy, 0));
  // the slit and the telescope poking out
  b.add("dark", new THREE.SphereGeometry(domeR * 0.99, 4, 10, -0.35, 0.7, 0, Math.PI / 2), xform(0, dy, 0));
  b.rod("metal", [0, dy + domeR * 0.2, 0], [0, dy + domeR * 1.05, domeR * 0.75], 0.35 * s, 0.25 * s, 12);
}

// ------------------------------------------------------------------------------------------------ amphitheater

export function amphitheater(c: Ctx) {
  const { b, style, r, h, s } = c;
  // the cavea: concentric stepped rows in a half ring behind the centre (-z), open toward the front (+z)
  const rows = 14;
  const r0 = r * 0.3;
  const r1 = r * 0.96;
  const seatSlot = style === "futuristic" ? "trim" : "main";
  const top = h * 0.9;
  for (let i = 0; i < rows; i++) {
    const ra = r0 + ((r1 - r0) * i) / rows;
    const rb = r0 + ((r1 - r0) * (i + 1)) / rows;
    const y = (top * (i + 1)) / rows;
    b.add(i % 2 ? seatSlot : "main2", new THREE.RingGeometry(ra, rb, 40, 1, 0, Math.PI), xform(0, y, 0, 0, -Math.PI / 2));
    b.add("main2", new THREE.CylinderGeometry(ra, ra, top / rows, 40, 1, true, Math.PI / 2, Math.PI), xform(0, y - top / rows / 2, 0));
  }
  // the outer wall with arcades, and the side walls closing the half ring
  b.add("main", new THREE.CylinderGeometry(r1, r1, top + 0.8, 40, 1, true, Math.PI / 2, Math.PI), xform(0, top / 2 - 0.4 + 0.4, 0));
  b.add("main", new THREE.CylinderGeometry(r1 + 0.6 * s, r1 + 0.6 * s, top + 0.8, 40, 1, true, Math.PI / 2, Math.PI), xform(0, top / 2, 0));
  for (let i = 0; i < 13; i++) {
    const a = Math.PI / 2 + ((i + 0.5) / 13) * Math.PI;
    b.at(Math.sin(a) * (r1 + 0.62 * s), 0, Math.cos(a) * (r1 + 0.62 * s), a, () => windowOn(b, style === "ancient_egypt" ? "classical" : style, 0, top * 0.25, 0, 1.4 * s, top * 0.45));
  }
  for (const sx of [-1, 1]) b.prism("main", [[0, 0], [r1 + 0.6 * s - r0, 0], [r1 + 0.6 * s - r0, top + 0.4], [0, 0.6]], 0.8 * s, xform(sx * r0 + (sx > 0 ? 0 : 0), 0, 0.4 * s, sx > 0 ? Math.PI / 2 : -Math.PI / 2).multiply(xform(0, 0, 0)));
  // aisles: stair strips radiating through the rows
  for (let k = -2; k <= 2; k++) {
    const a = (k / 5) * Math.PI;
    for (let i = 0; i < rows; i++) {
      const ra = r0 + ((r1 - r0) * (i + 0.5)) / rows;
      b.box("trim", -Math.sin(a) * ra, (top * (i + 1)) / rows + 0.02, -Math.cos(a) * ra, 1.0 * s, 0.05, (r1 - r0) / rows, -a);
    }
  }
  // orchestra floor, a low stage and its column screen facing the seats
  b.add("trim", new THREE.CircleGeometry(r0, 32), xform(0, 0.1, 0, 0, -Math.PI / 2));
  b.blk("trim", -r * 0.55, 0, r * 0.12, r * 0.55, 1.2 * s, r * 0.34);
  b.blk("main", -r * 0.58, 0, r * 0.34, r * 0.58, h * 0.42, r * 0.42);
  const colStyle = style === "ancient_egypt" ? "classical" : style;
  for (let i = 0; i < 6; i++) column(b, columnKindFor(colStyle, 1), -r * 0.5 + i * r * 0.2, 1.2 * s, r * 0.3, h * 0.42 - 1.2 * s, 0.22 * s, "trim");
  b.blk("trim", -r * 0.58, h * 0.42, r * 0.26, r * 0.58, h * 0.46, r * 0.42);
}


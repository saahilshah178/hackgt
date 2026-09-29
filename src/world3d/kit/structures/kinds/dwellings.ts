import * as THREE from "three";
import { xform, type GeoBuilder, type V3 } from "../geom";
import type { Ctx } from "../model";
import { basket, batteredBlock, crate, jar, sack, windowOn } from "../parts";
import { hall, roofOver, type RoofStyle } from "./hall";
import { roughStone } from "./monuments";

/*
 * Where people live and work: house, hut, tent, market_stall, workshop, well, campfire. The Egyptian house is a
 * flat-roofed mudbrick block with a parapet, palm-log rafter ends, a reed shelter on the roof and an outside stair; the
 * stall has a sagging linen awning over a counter of baskets, jars and bread; the well is a shaduf. Other styles build on
 * the hall archetype with their own roofs (thatch, turf, timber framing, glass and concrete).
 */

const scaled = (b: GeoBuilder, s: number, fn: () => void) => b.with(new THREE.Matrix4().makeScale(s, s, s), fn);

// ------------------------------------------------------------------------------------------------ house

function simpleDoor(b: GeoBuilder, x: number, face: number, w: number, h: number, curtain: boolean) {
  b.quad("dark", x, h / 2, face + 0.02, w, h);
  b.cyl("wood", x - w / 2 - 0.25, h + 0.1, face + 0.05, 0.1, 0.1, w + 0.5, 6, 0, 0, -Math.PI / 2);
  b.blk("main2", x - w / 2 - 0.15, 0, face - 0.05, x + w / 2 + 0.15, 0.12, face + 0.35);
  if (curtain) {
    const rows: V3[][] = [];
    for (let i = 0; i <= 4; i++) {
      const y = h - (i / 4) * h * 0.72;
      rows.push([0, 1, 2, 3].map((j) => [x - w / 2 + 0.05 + (j / 3) * w * 0.55, y, face + 0.05 + Math.sin(j * 1.7 + i) * 0.03] as V3));
    }
    b.sheet("cloth", rows, true);
  }
}

function egyptHouse(c: Ctx) {
  const { b, s, variant: v } = c;
  scaled(b, s, () => {
    const hx = 3.5;
    const hz = 2.85;
    const cz = v === 1 ? -0.9 : -0.3;
    const H = 3.2;
    batteredBlock(b, "main", 0, cz, hx, hz, 0, H, 0.03);
    b.rectLoft("main2", 0, cz, hx + 0.03, hz + 0.03, [
      { o: 0, y: 0 },
      { o: 0, y: 0.4 },
      { o: -0.03, y: 0.45 },
    ], { capTop: false });
    const ti = 0.03 * H;
    // parapet (the roof is the inner cap)
    b.rectLoft("main", 0, cz, hx - ti, hz - ti, [
      { o: 0, y: H },
      { o: 0, y: H + 0.55 },
      { o: -0.22, y: H + 0.55 },
      { o: -0.22, y: H + 0.12 },
    ]);
    // palm-log rafter ends along the front and back
    for (let x = -hx + 0.5; x <= hx - 0.4; x += 0.55) {
      for (const sz of [-1, 1]) b.rod("wood", [x, H - 0.18, cz + sz * (hz - 0.3)], [x, H - 0.18, cz + sz * (hz + 0.18)], 0.075, 0.075, 6);
    }
    const doorX = v % 2 ? -1.3 : 1.1;
    const face = cz + hz - ti * 0.3;
    simpleDoor(b, doorX, face, 0.95, 1.95, v !== 2);
    b.at(-doorX * 0.9, 0, face, 0, () => windowOn(b, "ancient_egypt", 0, 2.1, 0, 0.5, 0.4));
    for (const sx of [-1, 1]) b.at(sx * (hx - ti * 0.3), 0, cz + 0.6, (sx * Math.PI) / 2, () => windowOn(b, "ancient_egypt", 0, 2.2, 0, 0.45, 0.35));
    // water jars on a stand by the door
    b.blk("wood", doorX + 0.9, 0, face + 0.25, doorX + 1.6, 0.35, face + 0.7);
    jar(b, "paint2", doorX + 1.08, 0.35, face + 0.48, 0.75);
    jar(b, "paint2", doorX + 1.42, 0.35, face + 0.48, 0.62);
    if (v === 2) {
      // an upper room on the back half
      batteredBlock(b, "main", 0.6, cz - 1.2, 2.3, 1.5, H + 0.12, H + 2.5, 0.02);
      b.rectLoft("main", 0.6, cz - 1.2, 2.25, 1.45, [
        { o: 0, y: H + 2.5 },
        { o: 0, y: H + 2.85 },
        { o: -0.18, y: H + 2.85 },
        { o: -0.18, y: H + 2.6 },
      ]);
      b.quad("dark", 0.6, H + 1.0, cz + 0.32, 0.8, 1.6);
      b.at(0.6, 0, cz - 1.2 + 1.5, 0, () => windowOn(b, "ancient_egypt", 1.3, H + 1.5, 0.02, 0.4, 0.35));
    } else {
      // a reed-and-palm shelter on the roof
      const sx0 = -hx + 0.45;
      const sx1 = v === 3 ? 0.2 : 0.9;
      const sz0 = cz - hz + 0.45;
      const sz1 = cz + 0.2;
      for (const [x, z] of [
        [sx0, sz0],
        [sx1, sz0],
        [sx0, sz1],
        [sx1, sz1],
      ] as [number, number][])
        b.cyl("wood", x, H + 0.12, z, 0.07, 0.06, 2.05, 6);
      b.box("thatch", (sx0 + sx1) / 2, H + 2.18, (sz0 + sz1) / 2, sx1 - sx0 + 0.6, 0.12, sz1 - sz0 + 0.6, 0, -0.05);
      for (let k = 0; k < 4; k++) b.rod("wood", [sx0 - 0.3, H + 2.1, sz0 + (k * (sz1 - sz0)) / 3], [sx1 + 0.3, H + 2.1, sz0 + (k * (sz1 - sz0)) / 3], 0.05, 0.05, 5);
      // things drying on the roof
      basket(b, sx1 + 0.8, H + 0.12, cz + 0.8, 0.3, "paint2");
      sack(b, sx1 + 1.5, H + 0.12, cz - 0.4, 0.6);
    }
    if (v === 0 || v === 2) {
      // an outside stair up the left wall
      const n = 9;
      for (let i = 0; i < n; i++) {
        const y = ((i + 1) * H) / n;
        const z = cz + hz - 0.5 - (i * (hz * 2 - 1.2)) / n;
        b.blk("main", -hx - 0.95, 0, z - (hz * 2 - 1.2) / n, -hx + 0.02, y, z);
      }
    }
    if (v === 3) {
      // a dome oven and a wind catcher
      b.add("main2", new THREE.SphereGeometry(0.75, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), xform(hx + 0.35, 0, cz - 1.6));
      b.quad("dark", hx + 0.35, 0.25, cz - 0.86, 0.35, 0.3);
      b.blk("main", 1.8, H + 0.12, cz - hz + 0.25, 2.8, H + 1.9, cz - hz + 1.0);
      b.rectLoft("main", 2.3, cz - hz + 0.62, 0.52, 0.4, [
        { o: 0, y: H + 1.9 },
        { o: -0.05, y: H + 2.3 },
      ]);
      b.quad("dark", 2.3, H + 1.5, cz - hz + 1.02, 0.6, 0.6);
    }
    if (v === 1) {
      // a walled front yard with a gate gap
      const yz = cz + hz + 1.9;
      b.blk("main", -hx, 0, yz - 0.18, doorX - 0.8, 1.35, yz + 0.1);
      b.blk("main", doorX + 0.8, 0, yz - 0.18, hx, 1.35, yz + 0.1);
      for (const sx of [-1, 1]) b.blk("main", sx * hx - 0.14, 0, cz + hz, sx * hx + 0.14, 1.35, yz + 0.1);
      jar(b, "paint2", -hx + 0.6, 0, yz - 0.6, 0.7);
      basket(b, -hx + 1.3, 0, yz - 0.7, 0.32, "foliage");
    }
  });
}

export function house(c: Ctx) {
  const { b, style, r, h, s, variant: v } = c;
  if (style === "ancient_egypt") return egyptHouse(c);
  switch (style) {
    case "nordic": {
      // a longhouse: low log walls under a deep turf roof
      hall(c, { hx: r * 0.42, hz: r * 0.82, wallH: h * 0.35, roof: "turf", roofRise: 1.05, door: { w: 1.1 * s, h: 1.8 * s } });
      b.cyl("main2", r * 0.1, h * 0.35, -r * 0.3, 0.3 * s, 0.25 * s, h * 0.72, 8);
      return;
    }
    case "medieval": {
      const top = hall(c, { hx: r * 0.62, hz: r * 0.5, wallH: h * 0.48, storeys: 2, timbered: true, roof: v % 2 ? "thatch" : "slate", roofRise: 0.95, door: { w: 1.1 * s, h: 2 * s } });
      b.blk("main2", r * 0.3, h * 0.3, -r * 0.3, r * 0.3 + 0.7 * s, top + 0.4 * s, -r * 0.3 + 0.7 * s);
      return;
    }
    case "classical":
    case "mesoamerican": {
      const roof: RoofStyle = style === "classical" ? "hipTile" : "tile_flat";
      hall(c, { hx: r * 0.66, hz: r * 0.52, wallH: h * 0.5, roof, door: { w: 1.2 * s, h: 2.2 * s } });
      return;
    }
    case "east_asian": {
      hall(c, { hx: r * 0.6, hz: r * 0.45, wallH: h * 0.42, podium: 0.5 * s, roof: "pagoda", roofRise: 0.6, door: { w: 1.4 * s, h: 2.1 * s } });
      return;
    }
    case "rustic": {
      const top = hall(c, { hx: r * 0.6, hz: r * 0.48, wallH: h * 0.42, roof: "thatch", roofRise: 0.95, door: { w: 1.0 * s, h: 1.9 * s } });
      b.blk("main2", -r * 0.6 - 0.2 * s, 0, -r * 0.1, -r * 0.6 + 0.6 * s, top - 0.2 * s, r * 0.3);
      return;
    }
    case "industrial": {
      const top = hall(c, { hx: r * 0.55, hz: r * 0.62, wallH: h * 0.62, storeys: 2, roof: "slate", roofRise: 0.6, door: { w: 1.1 * s, h: 2.2 * s } });
      for (const sx of [-1, 1]) b.blk("main", sx * r * 0.3 - 0.4 * s, h * 0.6, -0.4 * s, sx * r * 0.3 + 0.4 * s, top + 0.9 * s, 0.4 * s);
      return;
    }
    case "modern":
      hall(c, { hx: r * 0.7, hz: r * 0.55, wallH: h * 0.55, roof: "flat", door: { w: 1.2 * s, h: 2.3 * s } });
      return;
    case "futuristic":
      hall(c, { hx: r * 0.65, hz: r * 0.55, wallH: h * 0.45, roof: "shell", door: { w: 1.3 * s, h: 2.2 * s } });
      return;
  }
}

// ------------------------------------------------------------------------------------------------ hut

export function hut(c: Ctx) {
  const { b, style, r, h, s } = c;
  if (style === "futuristic" || style === "modern" || style === "industrial") {
    b.add(style === "industrial" ? "metal" : "trim", new THREE.SphereGeometry(r * 0.85, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), xform(0, 0, 0, 0, 0, 0, 1, (h * 0.9) / (r * 0.85), 1));
    b.quad("dark", 0, 0.95 * s, r * 0.84, 1.0 * s, 1.9 * s);
    if (style === "futuristic") b.add("glow", new THREE.TorusGeometry(r * 0.86, 0.05 * s, 4, 32), xform(0, 0.4 * s, 0, 0, Math.PI / 2));
    return;
  }
  const wr = r * 0.74;
  const wallH = h * 0.45;
  const wallSlot = style === "ancient_egypt" || style === "mesoamerican" ? "main" : "main";
  b.lathe(wallSlot, 0, 0, 0, [[wr + 0.08 * s, -0.3], [wr + 0.08 * s, 0.3 * s], [wr, 0.35 * s], [wr * 0.98, wallH], [0, wallH]], 18);
  b.lathe("main2", 0, 0, 0, [[wr + 0.1 * s, -0.2], [wr + 0.1 * s, 0.3 * s], [wr * 0.9, 0.35 * s]], 18);
  // conical thatch roof with a deep overhang and a topknot
  const roofR = r * 0.98;
  b.lathe("thatch", 0, 0, 0, [[0.001, h], [0.25 * s, h - 0.15 * s], [roofR * 0.55, wallH + (h - wallH) * 0.45], [roofR, wallH - 0.25 * s], [roofR - 0.12 * s, wallH - 0.4 * s], [wr * 0.9, wallH - 0.1 * s]], 18);
  b.lathe("rope", 0, h - 0.4 * s, 0, [[0.28 * s, 0], [0.34 * s, 0.15 * s], [0.2 * s, 0.4 * s], [0, 0.5 * s]], 8);
  // a doorway with a timber frame and a mat
  b.quad("dark", 0, 0.85 * s, wr + 0.02, 0.9 * s, 1.6 * s);
  b.blk("wood", -0.55 * s, 0, wr - 0.05, -0.45 * s, 1.7 * s, wr + 0.1);
  b.blk("wood", 0.45 * s, 0, wr - 0.05, 0.55 * s, 1.7 * s, wr + 0.1);
  b.blk("wood", -0.6 * s, 1.65 * s, wr - 0.05, 0.6 * s, 1.78 * s, wr + 0.12);
  b.blk("thatch", -0.5 * s, 0, wr + 0.12, 0.5 * s, 0.03, wr + 0.9 * s);
  jar(b, "paint2", wr * 0.62, 0, wr * 0.72, 0.6 * s);
  // a few poles and a hide drying frame
  b.rod("wood", [-wr - 0.3 * s, 0, 0.5 * s], [-wr - 0.3 * s, 1.5 * s, 0.5 * s], 0.04 * s);
  b.rod("wood", [-wr - 0.3 * s, 0, -0.5 * s], [-wr - 0.3 * s, 1.5 * s, -0.5 * s], 0.04 * s);
  b.box("cloth", -wr - 0.3 * s, 1.0 * s, 0, 0.03, 0.9 * s, 0.9 * s);
}

// ------------------------------------------------------------------------------------------------ tent

export function tent(c: Ctx) {
  const { b, style, r, h, s } = c;
  if (style === "nordic" || style === "rustic") {
    // an A-frame tent on crossed poles
    const L = r * 0.85;
    const W = r * 0.7;
    for (const sx of [-1, 1]) {
      const rows: V3[][] = [];
      for (let i = 0; i <= 3; i++) {
        const t = i / 3;
        rows.push([0, 1, 2, 3, 4].map((j) => [sx * (W * (1 - t)), h * t * 0.95 - (j % 4 ? Math.sin(t * Math.PI) * 0.08 : 0), -L + (j / 4) * 2 * L] as V3));
      }
      b.sheet("cloth", rows, true);
    }
    for (const sz of [-1, 1]) {
      b.rod("wood", [-W * 0.8, 0, sz * L], [0.25 * s, h * 1.05, sz * L], 0.06 * s);
      b.rod("wood", [W * 0.8, 0, sz * L], [-0.25 * s, h * 1.05, sz * L], 0.06 * s);
    }
    b.rod("wood", [0, h * 0.97, -L - 0.2 * s], [0, h * 0.97, L + 0.2 * s], 0.06 * s);
    b.prism("cloth", [[-W, 0], [W, 0], [0, h * 0.95]], 0.02, xform(0, 0, -L));
    return;
  }
  if (style === "modern" || style === "futuristic") {
    b.add("cloth", new THREE.SphereGeometry(r * 0.8, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), xform(0, 0, 0, 0, 0, 0, 1, h / (r * 0.8), 1));
    for (let k = 0; k < 2; k++) b.add("metal", new THREE.TorusGeometry(r * 0.8, 0.03 * s, 4, 24, Math.PI), xform(0, 0, 0, Math.PI / 4 + (k * Math.PI) / 2, 0, 0, 1, h / (r * 0.8), 1));
    b.quad("dark", 0, 0.7 * s, r * 0.78, 0.9 * s, 1.3 * s);
    return;
  }
  // a pavilion: poles, a sagging cloth roof peaked on a centre pole, side curtains, open at the front
  const hx = r * 0.78;
  const hz = r * 0.68;
  const eave = h * 0.62;
  const n = 6;
  const rows: V3[][] = [];
  for (let i = 0; i <= n; i++) {
    const row: V3[] = [];
    for (let j = 0; j <= n; j++) {
      const u = (i / n) * 2 - 1;
      const w = (j / n) * 2 - 1;
      const d = Math.max(Math.abs(u), Math.abs(w));
      const sag = Math.sin(d * Math.PI) * 0.12 * s;
      row.push([u * hx, eave + (h - eave) * (1 - d) - sag, w * hz]);
    }
    rows.push(row);
  }
  b.sheet("cloth", rows, true);
  b.cyl("wood", 0, 0, 0, 0.07 * s, 0.06 * s, h + 0.2 * s, 6);
  b.sphere("gold", 0, h + 0.25 * s, 0, 0.1 * s);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      b.cyl("wood", sx * hx * 0.98, 0, sz * hz * 0.98, 0.05 * s, 0.05 * s, eave, 6);
      b.rod("rope", [sx * hx, eave, sz * hz], [sx * (hx + 0.9 * s), 0, sz * (hz + 0.3 * s)], 0.012 * s, 0.012 * s, 3);
    }
  // valance and side/back walls
  for (const sz of [-1, 1]) b.box("cloth2", 0, eave - 0.15 * s, sz * hz, hx * 2, 0.3 * s, 0.02);
  for (const sx of [-1, 1]) b.box("cloth2", sx * hx, eave - 0.15 * s, 0, 0.02, 0.3 * s, hz * 2);
  b.box("cloth", 0, eave / 2, -hz, hx * 2, eave, 0.02);
  for (const sx of [-1, 1]) {
    const cr: V3[][] = [];
    for (let i = 0; i <= 3; i++) cr.push([0, 1, 2, 3].map((j) => [sx * hx + Math.sin(j * 2 + i) * 0.05, eave - (eave * i) / 3, -hz + (j / 3) * hz * 1.4] as V3));
    b.sheet("cloth", cr, true);
  }
  // carpets, cushions and a chest inside
  b.blk("paint2", -hx * 0.8, 0.01, -hz * 0.8, hx * 0.8, 0.04, hz * 0.7);
  for (let i = 0; i < 3; i++) b.sphere(i % 2 ? "cloth2" : "cloth", -hx * 0.5 + i * hx * 0.5, 0.18 * s, -hz * 0.6, 0.35 * s, 0.16 * s, 0.3 * s, 8, 5);
  crate(b, hx * 0.6, 0.04, -hz * 0.5, 0.6 * s, 0.2);
}

// ------------------------------------------------------------------------------------------------ market stall

export function marketStall(c: Ctx) {
  const { b, s, variant: v, style } = c;
  scaled(b, s, () => {
    // woven mat under the stall
    b.blk("thatch", -1.6, 0, -1.2, 1.6, 0.03, 1.25);
    // counter
    b.blk("wood", -1.25, 0.82, 0.1, 1.25, 0.92, 0.95);
    b.blk("woodDark", -1.2, 0, 0.14, 1.2, 0.82, 0.9);
    for (let i = 0; i < 4; i++) b.blk("wood", -1.2 + i * 0.8, 0.1, 0.9, -1.1 + i * 0.8, 0.8, 0.94);
    // poles and the awning (stripes alternate the two cloths)
    const ph = [2.75, 2.75, 2.3, 2.3];
    const pts: [number, number][] = [
      [-1.4, -0.95],
      [1.4, -0.95],
      [-1.4, 1.15],
      [1.4, 1.15],
    ];
    pts.forEach(([x, z], i) => b.cyl("wood", x, 0, z, 0.05, 0.045, ph[i], 6));
    const stripes = 6;
    for (let k = 0; k < stripes; k++) {
      const x0 = -1.55 + (k * 3.1) / stripes;
      const x1 = x0 + 3.1 / stripes;
      const rows: V3[][] = [];
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        const z = -1.1 + t * 2.4;
        const y = 2.82 - t * 0.5 - Math.sin(t * Math.PI) * 0.12;
        rows.push([x0, (x0 + x1) / 2, x1].map((x) => [x, y - Math.sin(((x + 1.55) / 3.1) * Math.PI) * 0.04, z] as V3));
      }
      b.sheet(k % 2 ? "cloth2" : "cloth", rows, true);
      // scalloped valance at the front
      b.sheet(k % 2 ? "cloth2" : "cloth", [
        [
          [x0, 2.3, 1.3],
          [x1, 2.3, 1.3],
        ],
        [
          [x0 + 0.05, 2.02, 1.32],
          [x1 - 0.05, 2.02, 1.32],
        ],
      ], true);
    }
    // goods on the counter
    const goods = v % 4;
    if (goods === 0 || style !== "ancient_egypt") {
      basket(b, -0.8, 0.92, 0.5, 0.26, "paint2");
      basket(b, -0.2, 0.92, 0.55, 0.24, "foliage");
      basket(b, 0.4, 0.92, 0.5, 0.26, "gold");
    } else if (goods === 1) {
      // bread loaves and figs
      for (let i = 0; i < 6; i++) b.sphere("thatch", -0.9 + (i % 3) * 0.3, 0.98, 0.35 + Math.floor(i / 3) * 0.3, 0.14, 0.08, 0.12, 8, 5);
      basket(b, 0.5, 0.92, 0.5, 0.28, "paint2");
    } else if (goods === 2) {
      // linen bolts
      for (let i = 0; i < 4; i++) b.cyl(i % 2 ? "sail" : "cloth", -0.9 + i * 0.35, 0.92 + 0.1, 0.55, 0.1, 0.1, 0.7, 10, 0, Math.PI / 2);
    } else {
      for (let i = 0; i < 4; i++) jar(b, "paint2", -0.9 + i * 0.45, 0.92, 0.55, 0.35 + (i % 2) * 0.1);
    }
    jar(b, "paint2", 1.0, 0.92, 0.6, 0.42);
    // stock below and behind
    jar(b, "paint2", -1.3, 0.03, 1.45, 0.7);
    sack(b, 1.0, 0.03, -0.6, 0.7);
    sack(b, 0.45, 0.03, -0.75, 0.6);
    basket(b, -0.9, 0.03, -0.55, 0.35, "paint2");
    crate(b, -0.2, 0.03, -0.7, 0.5, 0.3);
    // a stool for the merchant
    b.cyl("wood", 0.4, 0, -0.2, 0.2, 0.2, 0.45, 8);
  });
}

// ------------------------------------------------------------------------------------------------ workshop

export function workshop(c: Ctx) {
  const { b, style, r, h, s } = c;
  if (style === "ancient_egypt") {
    scaled(b, s, () => {
      const k = r / (6 * s);
      b.with(new THREE.Matrix4().makeScale(k, 1, k), () => {
        // a mudbrick room at the back, an open court under a reed awning in front
        batteredBlock(b, "main", 0, -2.6, 4.6, 2.4, 0, 3.6, 0.03);
        b.rectLoft("main", 0, -2.6, 4.5, 2.3, [
          { o: 0, y: 3.6 },
          { o: 0, y: 4.1 },
          { o: -0.2, y: 4.1 },
          { o: -0.2, y: 3.7 },
        ]);
        b.quad("dark", -1.6, 1.05, -0.18, 1.1, 2.1);
        b.quad("dark", 1.6, 1.05, -0.18, 1.1, 2.1);
        b.blk("wood", -2.4, 2.1, -0.24, 2.4, 2.3, -0.08);
        for (const sx of [-1, 1]) b.blk("main", sx * 4.6 - 0.2, 0, -0.2, sx * 4.6 + 0.2, 1.4, 4.2);
        // awning over the court
        for (const [x, z] of [
          [-4.2, 4.0],
          [0, 4.0],
          [4.2, 4.0],
        ] as [number, number][])
          b.cyl("wood", x, 0, z, 0.09, 0.08, 3.1, 6);
        b.box("thatch", 0, 3.25, 1.9, 9.2, 0.12, 4.6, 0, 0.1);
        for (let i = 0; i < 9; i++) b.rod("wood", [-4.5 + i * 1.12, 3.15, -0.2], [-4.5 + i * 1.12, 3.0, 4.3], 0.045, 0.045, 5);
        // a stone table, a workbench with tools and jars, a kiln
        b.blk("trim", -2.6, 0, 1.2, -0.4, 0.95, 2.2);
        b.blk("wood", 1.0, 0.8, 1.1, 3.4, 0.9, 1.9);
        for (const x of [1.1, 3.2]) for (const z of [1.2, 1.8]) b.blk("wood", x, 0, z - 0.04, x + 0.08, 0.8, z + 0.04);
        b.box("metal", 1.6, 0.93, 1.5, 0.35, 0.04, 0.06, 0.4);
        b.box("wood", 2.2, 0.93, 1.4, 0.5, 0.06, 0.12, -0.2);
        for (let i = 0; i < 5; i++) jar(b, "paint2", -4.0 + (i % 3) * 0.45, 0, 0.6 + Math.floor(i / 3) * 0.5, 0.6 + (i % 2) * 0.2);
        b.lathe("main2", 3.6, 0, 3.4, [[0.95, 0], [0.95, 0.9], [0.7, 1.5], [0.25, 1.75], [0.25, 1.95], [0, 1.95]], 12);
        b.quad("dark", 3.6, 0.45, 4.36, 0.5, 0.5);
        basket(b, -1.2, 0, 3.6, 0.35, "sail");
        sack(b, -3.4, 0, 3.4, 0.7);
      });
    });
    c.fire(3.6 * r / 6, 0.5 * s, (3.4 + 0.95) * r / 6, 0.35 * s, { light: false });
    return;
  }
  // a timber/stone workshop with an open forge side and a chimney
  const top = hall(c, { hx: r * 0.58, hz: r * 0.5, wallH: h * 0.48, roof: style === "modern" || style === "futuristic" ? undefined : style === "industrial" ? "metal" : style === "classical" ? "hipTile" : style === "east_asian" ? "pagoda" : style === "nordic" ? "turf" : "thatch", door: { w: 1.8 * s, h: 2.4 * s }, timbered: style === "medieval" });
  // lean-to over the forge
  b.blk("main2", r * 0.58, 0, -r * 0.1, r * 0.58 + 1.5 * s, 1.0 * s, r * 0.4);
  b.box("wood", r * 0.58 + 0.9 * s, h * 0.44, r * 0.15, 2.0 * s, 0.12 * s, r * 0.9, 0, 0, -0.3);
  b.cyl("wood", r * 0.58 + 1.7 * s, 0, r * 0.55, 0.08 * s, 0.08 * s, h * 0.38, 6);
  b.cyl("wood", r * 0.58 + 1.7 * s, 0, -r * 0.2, 0.08 * s, 0.08 * s, h * 0.38, 6);
  b.blk("main2", r * 0.42, 0, -r * 0.4, r * 0.42 + 0.9 * s, top + 0.6 * s, -r * 0.4 + 0.9 * s);
  // anvil and quench barrel
  b.blk("metal", r * 0.3, 0.6 * s, r * 0.62, r * 0.3 + 0.5 * s, 0.8 * s, r * 0.62 + 0.25 * s);
  b.cyl("wood", r * 0.4, 0, r * 0.7, 0.18 * s, 0.18 * s, 0.6 * s, 8);
  b.cyl("wood", -r * 0.4, 0, r * 0.72, 0.3 * s, 0.28 * s, 0.8 * s, 10);
  crate(b, -r * 0.2, 0, r * 0.75, 0.6 * s, 0.4);
  c.fire(r * 0.58 + 0.75 * s, 1.05 * s, r * 0.15, 0.4 * s, { light: false });
}

// ------------------------------------------------------------------------------------------------ well

export function well(c: Ctx) {
  const { b, style, r, h, s } = c;
  const cr = r * 0.52;
  // curb: a stone ring with dark water inside
  const curbSlot = style === "modern" || style === "futuristic" ? "trim" : "main";
  b.lathe(curbSlot, 0, 0, 0, [[cr * 0.72, 0.62 * s], [cr * 0.72, 0.8 * s], [cr, 0.8 * s], [cr + 0.05 * s, 0.7 * s], [cr, 0.1 * s], [cr + 0.12 * s, 0], [cr + 0.12 * s, -0.3]], 16);
  b.add("water", new THREE.CircleGeometry(cr * 0.73, 16), xform(0, 0.45 * s, 0, 0, -Math.PI / 2));
  if (style === "ancient_egypt") {
    // shaduf: an upright frame, a counterweighted sweep pole, a rope and a bucket
    const px = -r * 0.5;
    for (const sz of [-1, 1]) b.cyl("wood", px, 0, sz * 0.3 * s, 0.07 * s, 0.06 * s, 1.85 * s, 6);
    b.rod("wood", [px, 1.8 * s, -0.36 * s], [px, 1.8 * s, 0.36 * s], 0.05 * s);
    const a: V3 = [px - 0.85 * s, 1.15 * s, 0];
    const p: V3 = [px + 1.75 * s, 2.45 * s, 0];
    b.rod("wood", a, p, 0.06 * s, 0.045 * s, 6);
    b.sphere("soil", a[0] + 0.1 * s, a[1] - 0.05 * s, 0, 0.3 * s, 0.26 * s, 0.28 * s, 8, 6);
    b.rod("rope", p, [p[0], 1.05 * s, 0], 0.012 * s, 0.012 * s, 3);
    b.lathe("paint2", p[0], 0.8 * s, 0, [[0.001, 0], [0.12 * s, 0.02 * s], [0.16 * s, 0.18 * s], [0.13 * s, 0.26 * s]], 8);
    // a stone trough and jars
    b.blk("trim", r * 0.35, 0, -r * 0.7, r * 0.95, 0.45 * s, -r * 0.35);
    b.add("water", new THREE.PlaneGeometry(r * 0.5, r * 0.25), xform(r * 0.65, 0.4 * s, -r * 0.525, 0, -Math.PI / 2));
    jar(b, "paint2", r * 0.55, 0, r * 0.62, 0.55 * s);
    jar(b, "paint2", r * 0.85, 0, r * 0.35, 0.45 * s);
    return;
  }
  if (style === "modern" || style === "industrial" || style === "futuristic") {
    // a pump
    b.cyl("metal", cr * 0.3, 0.8 * s, 0, 0.1 * s, 0.1 * s, 1.2 * s, 8);
    b.rod("metal", [cr * 0.3, 1.9 * s, 0], [cr * 0.3 - 0.6 * s, 1.6 * s, 0], 0.03 * s);
    b.rod("metal", [cr * 0.3, 1.6 * s, 0], [cr * 0.3, 1.5 * s, 0.35 * s], 0.035 * s);
    return;
  }
  // a winch well: two posts, a roller with a crank, a little roof, a bucket
  for (const sx of [-1, 1]) b.blk("wood", sx * cr - 0.08 * s, 0.6 * s, -0.08 * s, sx * cr + 0.08 * s, h * 0.72, 0.08 * s);
  b.cyl("wood", -cr, 1.3 * s, 0, 0.1 * s, 0.1 * s, cr * 2, 8, 0, 0, -Math.PI / 2);
  b.rod("metal", [cr + 0.05 * s, 1.3 * s, 0], [cr + 0.25 * s, 1.3 * s, 0], 0.025 * s);
  b.rod("metal", [cr + 0.25 * s, 1.3 * s, 0], [cr + 0.25 * s, 1.0 * s, 0], 0.025 * s);
  b.rod("rope", [0, 1.25 * s, 0], [0, 0.95 * s, 0], 0.012 * s);
  b.lathe("wood", 0, 0.65 * s, 0, [[0.001, 0], [0.14 * s, 0], [0.16 * s, 0.28 * s]], 8);
  roofOver(c, style === "east_asian" ? "hipTile" : style === "nordic" ? "thatch" : style === "classical" ? "hipTile" : "thatch", cr * 0.8, cr * 0.95, h * 0.72, 0.5);
}

// ------------------------------------------------------------------------------------------------ campfire

export function campfire(c: Ctx) {
  const { b, r, s, rng } = c;
  // ring of stones, ash bed, crossed logs, log seats and a cooking tripod
  b.add("soil", new THREE.CircleGeometry(r * 0.5, 14), xform(0, 0.02, 0, 0, -Math.PI / 2));
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    roughStone(b, i % 2 ? "main" : "main2", Math.sin(a) * r * 0.42, Math.cos(a) * r * 0.42, 0.26 * s, 0.2 * s, 0.22 * s, rng, 0, a);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    b.rod("woodDark", [Math.sin(a) * r * 0.3, 0.05 * s, Math.cos(a) * r * 0.3], [Math.sin(a) * 0.05 * s, 0.32 * s, Math.cos(a) * 0.05 * s], 0.055 * s, 0.045 * s, 6);
  }
  // log seats laid tangentially around the ring
  for (const a of [0.5, 2.6, 4.4]) b.at(Math.sin(a) * r * 0.78, 0, Math.cos(a) * r * 0.78, a, () => b.cyl("wood", -0.45 * s, 0.17 * s, 0, 0.17 * s, 0.17 * s, 0.9 * s, 8, 0, 0, -Math.PI / 2));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.rod("wood", [Math.sin(a) * r * 0.5, 0, Math.cos(a) * r * 0.5], [0, 1.0 * s, 0], 0.025 * s);
  }
  b.rod("metal", [0, 1.0 * s, 0], [0, 0.62 * s, 0], 0.008 * s);
  b.lathe("metal", 0, 0.42 * s, 0, [[0.001, 0], [0.16 * s, 0.03 * s], [0.18 * s, 0.2 * s]], 10);
  c.fire(0, 0.08 * s, 0, 0.75 * s, { light: true, defaultLit: true });
}

import * as THREE from "three";
import { cavettoProfile, xform, type GeoBuilder } from "../geom";
import type { Ctx } from "../model";
import { batteredBlock, cavettoAround, doorway, glyphColumn, merlons, windowOn, wingedDisc } from "../parts";
import { battlements, doorLeaves, roofOver } from "./hall";
import { archedSlab, mesoPyramid } from "./monuments";

/*
 * Towers and walls: tower, lighthouse, keep, wall, gate, beacon. Round towers are lathed with a plinth and string
 * courses and crowned with merlons set around the circle; the east Asian tower is a five-storey pagoda; the gate's door
 * leaves are swing movers (open unless the gate is a seal target that has not been solved); beacons and lighthouses
 * carry fire spots the renderer lights.
 */

/** Merlons around a circle of radius r at height y. */
function ringMerlons(b: GeoBuilder, slot: "main" | "trim", r: number, y: number, s: number, n?: number) {
  const count = n ?? Math.max(8, Math.round((2 * Math.PI * r) / (1.5 * s)));
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    b.box(slot, Math.sin(a) * r, y + 0.5 * s, Math.cos(a) * r, 0.8 * s, 1.0 * s, 0.55 * s, a);
  }
}

function roundTower(b: GeoBuilder, style: Ctx["style"], x: number, z: number, r: number, h: number, s: number, crown: "merlons" | "cone" | "none") {
  b.at(x, 0, z, 0, () => {
    b.lathe("main", 0, 0, 0, [[r + 0.5 * s, -0.4], [r + 0.5 * s, 0.4 * s], [r, 1.4 * s], [r, h], [0, h]], 24);
    for (let i = 1; i < 4; i++) b.lathe("trim", 0, (h * i) / 4, 0, [[r + 0.02, 0], [r + 0.12 * s, 0.1 * s], [r + 0.12 * s, 0.22 * s], [r + 0.02, 0.3 * s]], 24);
    // corbelled parapet
    b.lathe("trim", 0, h, 0, [[r, 0], [r + 0.5 * s, 0.6 * s], [r + 0.5 * s, 1.0 * s], [0, 1.0 * s]], 24);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      b.at(Math.sin(a) * r, 0, Math.cos(a) * r, a, () => b.quad("dark", 0, h * (0.3 + (i % 3) * 0.2), 0.03, 0.18 * s, 1.1 * s));
    }
    if (crown === "merlons") ringMerlons(b, "main", r + 0.3 * s, h + 1.0 * s, s);
    else if (crown === "cone") {
      b.lathe("roof", 0, h + 1.0 * s, 0, [[r + 0.7 * s, 0], [r * 0.45, r * 0.9], [0.001, r * 1.9]], 20);
      b.rod("metal", [0, h + 1.0 * s + r * 1.9, 0], [0, h + 1.0 * s + r * 1.9 + 1.2 * s, 0], 0.05 * s);
    }
    void style;
  });
}

// ------------------------------------------------------------------------------------------------ tower

export function tower(c: Ctx) {
  const { b, style, r, h, s, variant: v } = c;
  switch (style) {
    case "east_asian": {
      // a five-storey pagoda
      const tiers = 5;
      let y = 0;
      b.blk("trim", -r * 0.85, 0, -r * 0.85, r * 0.85, 0.8 * s, r * 0.85);
      y = 0.8 * s;
      for (let i = 0; i < tiers; i++) {
        const w = r * (0.58 - i * 0.07);
        const th = (h * 0.72) / tiers;
        b.blk("paint", -w, y, -w, w, y + th * 0.55, w);
        for (let k = 0; k < 4; k++) b.at(0, 0, 0, (k * Math.PI) / 2, () => b.quad("dark", 0, y + th * 0.3, w + 0.02, w * 0.6, th * 0.35));
        roofOver(c, "pagoda", w, w, y + th * 0.55, 0.4);
        y += th;
      }
      b.cyl("gold", 0, y + 0.8 * s, 0, 0.12 * s, 0.05 * s, h - y - 0.8 * s, 8);
      for (let i = 0; i < 5; i++) b.add("gold", new THREE.TorusGeometry(0.35 * s, 0.05 * s, 4, 12), xform(0, y + 1.5 * s + i * 0.6 * s, 0, 0, Math.PI / 2));
      return;
    }
    case "ancient_egypt":
    case "mesoamerican": {
      // a battered watchtower with a lookout pavilion
      const w = r * 0.62;
      batteredBlock(b, "main", 0, 0, w, w, 0, h * 0.78, 0.05);
      const tw = w - 0.05 * h * 0.78;
      if (style === "ancient_egypt") cavettoAround(b, -tw, -tw, tw, tw, h * 0.78, 0.6 * s);
      else b.blk("trim", -tw - 0.3 * s, h * 0.78, -tw - 0.3 * s, tw + 0.3 * s, h * 0.8, tw + 0.3 * s);
      for (let i = 0; i < 3; i++) b.at(0, 0, 0, 0, () => windowOn(b, style, 0, h * (0.25 + i * 0.18), w - 0.05 * h * (0.25 + i * 0.18) + 0.02, 0.5 * s, 0.8 * s));
      doorway(b, style, 0, 0, w, 1.2 * s, 2.2 * s);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl("wood", sx * tw * 0.8, h * 0.8, sz * tw * 0.8, 0.1 * s, 0.1 * s, h * 0.14, 6);
      b.box(style === "ancient_egypt" ? "thatch" : "thatch", 0, h * 0.95, 0, tw * 2, 0.2 * s, tw * 2);
      return;
    }
    case "nordic":
    case "rustic": {
      // a timber watchtower: four splayed legs, bracing, a platform and a steep roof
      const base = r * 0.7;
      const top = r * 0.42;
      const ph = h * 0.7;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.rod("wood", [sx * base, 0, sz * base], [sx * top, ph + 1.4 * s, sz * top], 0.22 * s, 0.18 * s, 8);
      for (let lv = 1; lv <= 3; lv++) {
        const y = (ph * lv) / 4;
        const w = base + ((top - base) * y) / ph;
        for (const [a, bb] of [
          [
            [-w, y, w],
            [w, y, w],
          ],
          [
            [-w, y, -w],
            [w, y, -w],
          ],
          [
            [w, y, -w],
            [w, y, w],
          ],
          [
            [-w, y, -w],
            [-w, y, w],
          ],
        ] as [number, number, number][][])
          b.beam("woodDark", a as [number, number, number], bb as [number, number, number], 0.14 * s);
      }
      b.blk("wood", -top - 0.6 * s, ph, -top - 0.6 * s, top + 0.6 * s, ph + 0.25 * s, top + 0.6 * s);
      for (const sx of [-1, 1]) b.blk("wood", sx * (top + 0.55 * s) - 0.08, ph + 0.25 * s, -top - 0.6 * s, sx * (top + 0.55 * s) + 0.08, ph + 1.3 * s, top + 0.6 * s);
      b.blk("wood", -top - 0.6 * s, ph + 0.25 * s, -top - 0.65 * s, top + 0.6 * s, ph + 1.3 * s, -top - 0.5 * s);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl("wood", sx * top, ph, sz * top, 0.1 * s, 0.1 * s, h * 0.2, 6);
      roofOver(c, style === "nordic" ? "turf" : "thatch", top + 0.4 * s, top + 0.4 * s, ph + h * 0.2, 1.1);
      // ladder
      b.rod("wood", [-0.35 * s, 0, base + 0.4 * s], [-0.35 * s, ph, top + 0.7 * s], 0.05 * s);
      b.rod("wood", [0.35 * s, 0, base + 0.4 * s], [0.35 * s, ph, top + 0.7 * s], 0.05 * s);
      return;
    }
    case "industrial": {
      // a water tower: a riveted tank on a braced steel frame
      const leg = r * 0.62;
      const ty = h * 0.6;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.rod("metal", [sx * leg, 0, sz * leg], [sx * leg * 0.7, ty, sz * leg * 0.7], 0.18 * s, 0.14 * s, 8);
      for (let lv = 1; lv < 4; lv++) {
        const y = (ty * lv) / 4;
        const w = leg - (leg * 0.3 * y) / ty;
        for (let k = 0; k < 4; k++) b.at(0, 0, 0, (k * Math.PI) / 2, () => b.beam("metal", [-w, y, w], [w, y + ty / 4, w], 0.08 * s));
      }
      b.lathe("roof", 0, ty, 0, [[0.001, 0], [r * 0.7, 0.4 * s], [r * 0.75, 0.8 * s], [r * 0.75, h * 0.3], [r * 0.4, h * 0.36], [0.001, h * 0.4]], 20);
      b.rod("metal", [r * 0.75, ty + 0.5 * s, 0], [r * 0.75, h * 0.9, 0], 0.04 * s);
      return;
    }
    case "modern":
    case "futuristic": {
      b.lathe("trim", 0, 0, 0, [[r * 0.7, -0.3], [r * 0.7, 1 * s], [r * 0.45, h * 0.3], [r * 0.38, h * 0.82], [0.001, h * 0.82]], 20);
      b.lathe("glass", 0, h * 0.82, 0, [[r * 0.75, 0], [r * 0.8, h * 0.06], [r * 0.6, h * 0.12], [0.001, h * 0.12]], 20);
      b.rod("metal", [0, h * 0.94, 0], [0, h * 1.1, 0], 0.06 * s);
      if (style === "futuristic") for (let i = 0; i < 3; i++) b.add("glow", new THREE.TorusGeometry(r * (0.5 - i * 0.03), 0.06 * s, 4, 24), xform(0, h * (0.35 + i * 0.15), 0, 0, Math.PI / 2));
      return;
    }
    case "classical": {
      const w = r * 0.55;
      b.rectLoft("main2", 0, 0, w + 0.3 * s, w + 0.3 * s, [
        { o: 0, y: -0.3 },
        { o: 0, y: 1.2 * s },
        { o: -0.3 * s, y: 1.4 * s },
      ]);
      b.blk("main", -w, 1.4 * s, -w, w, h * 0.86, w);
      for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) b.at(0, 0, 0, (k * Math.PI) / 2, () => windowOn(b, "classical", 0, h * (0.2 + i * 0.17), w, 0.8 * s, 1.6 * s));
      roofOver(c, "hipTile", w, w, h * 0.86, 0.9);
      return;
    }
    default: {
      // medieval: a round tower, crenellated or capped by a cone
      roundTower(b, style, 0, 0, r * 0.7, h * (v % 2 ? 0.7 : 0.82), s, v % 2 ? "cone" : "merlons");
      doorway(b, style, 0, 0, r * 0.7 - 0.05, 1.3 * s, 2.4 * s, { arch: true });
    }
  }
}

// ------------------------------------------------------------------------------------------------ lighthouse

export function lighthouse(c: Ctx) {
  const { b, style, r, h, s } = c;
  if (style === "ancient_egypt" || style === "classical") {
    // Pharos: square base, octagonal middle, round top, and the fire
    const w = r * 0.8;
    b.rectLoft("main2", 0, 0, w + 0.4 * s, w + 0.4 * s, [
      { o: 0, y: -0.3 },
      { o: 0, y: 1.2 * s },
    ]);
    batteredBlock(b, "main", 0, 0, w, w, 1.2 * s, h * 0.5, 0.03);
    const w2 = w - 0.03 * (h * 0.5 - 1.2 * s);
    b.rectLoft("trim", 0, 0, w2, w2, [
      { o: 0, y: h * 0.5 },
      { o: 0.4 * s, y: h * 0.5 + 0.3 * s },
      { o: -0.2 * s, y: h * 0.5 + 0.5 * s },
    ]);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) b.at(0, 0, 0, (k * Math.PI) / 2, () => windowOn(b, style, 0, h * (0.1 + i * 0.1), w - 0.03 * h * (0.1 + i * 0.1) + 0.01, 0.5 * s, 0.9 * s));
    b.lathe("main", 0, h * 0.5 + 0.5 * s, 0, [[w * 0.62, 0], [w * 0.55, h * 0.28]], 8, Math.PI / 8);
    b.lathe("trim", 0, h * 0.78 + 0.5 * s, 0, [[w * 0.58, 0], [w * 0.62, 0.3 * s], [0.001, 0.3 * s]], 8, Math.PI / 8);
    const ty = h * 0.78 + 0.8 * s;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.cyl("trim", Math.sin(a) * w * 0.35, ty, Math.cos(a) * w * 0.35, 0.18 * s, 0.18 * s, h * 0.12, 8);
    }
    b.cyl("trim", 0, ty + h * 0.12, 0, w * 0.42, w * 0.3, h * 0.08, 16);
    b.lathe("metal", 0, ty, 0, [[0.001, 0], [w * 0.25, 0.1 * s], [w * 0.3, 0.8 * s]], 12);
    c.fire(0, ty + 0.6 * s, 0, 1.8 * s, { light: true, defaultLit: true });
    return;
  }
  // a tapering round tower with bands, a gallery and a glazed lantern room
  const r0 = r * 0.62;
  const r1 = r * 0.4;
  const th = h * 0.8;
  b.lathe("main", 0, 0, 0, [[r0 + 0.4 * s, -0.3], [r0 + 0.4 * s, 1 * s], [r0, 1.2 * s], [r1, th], [0.001, th]], 24);
  for (let i = 0; i < 3; i++) {
    const y0 = th * (0.2 + i * 0.27);
    const y1 = y0 + th * 0.12;
    const ra = r0 + (r1 - r0) * (y0 / th) + 0.03;
    const rb = r0 + (r1 - r0) * (y1 / th) + 0.03;
    b.lathe("paint2", 0, 0, 0, [[ra, y0], [rb, y1]], 24);
  }
  for (let i = 0; i < 4; i++) b.at(0, 0, 0, i * 1.7, () => windowOn(b, style, 0, th * (0.15 + i * 0.2), r0 + (r1 - r0) * (0.15 + i * 0.2) + 0.03, 0.5 * s, 0.9 * s));
  doorway(b, style, 0, 0, r0 + 0.05, 1.2 * s, 2.2 * s, { arch: true });
  b.lathe("trim", 0, th, 0, [[r1, 0], [r1 + 1.0 * s, 0.4 * s], [r1 + 1.0 * s, 0.6 * s], [0.001, 0.6 * s]], 24);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    b.rod("metal", [Math.sin(a) * (r1 + 0.9 * s), th + 0.6 * s, Math.cos(a) * (r1 + 0.9 * s)], [Math.sin(a) * (r1 + 0.9 * s), th + 1.6 * s, Math.cos(a) * (r1 + 0.9 * s)], 0.03 * s);
  }
  b.add("metal", new THREE.TorusGeometry(r1 + 0.9 * s, 0.05 * s, 4, 32), xform(0, th + 1.6 * s, 0, 0, Math.PI / 2));
  const lr = r1 * 0.7;
  b.cyl("glass", 0, th + 0.6 * s, 0, lr, lr, h * 0.1, 16, 0, 0, 0, true);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.rod("metal", [Math.sin(a) * lr, th + 0.6 * s, Math.cos(a) * lr], [Math.sin(a) * lr, th + 0.6 * s + h * 0.1, Math.cos(a) * lr], 0.05 * s);
  }
  b.lathe(style === "futuristic" ? "trim" : "paint2", 0, th + 0.6 * s + h * 0.1, 0, [[lr + 0.3 * s, 0], [lr * 0.6, h * 0.06], [0.001, h * 0.08]], 16);
  c.fire(0, th + 0.9 * s, 0, h * 0.06, { light: true, defaultLit: true, lamp: true });
}

// ------------------------------------------------------------------------------------------------ keep

export function keep(c: Ctx) {
  const { b, style, r, h, s } = c;
  if (style === "east_asian") {
    // a castle tenshu on a sloped stone base
    const bw = r * 0.78;
    const bh = h * 0.3;
    b.rectLoft("main", 0, 0, bw, bw, [
      { o: 0, y: 0 },
      { o: -bh * 0.25, y: bh * 0.5 },
      { o: -bh * 0.33, y: bh },
    ]);
    let y = bh;
    let w = bw - bh * 0.4;
    for (let i = 0; i < 3; i++) {
      const th = (h - bh) * 0.25;
      b.blk("trim", -w, y, -w, w, y + th, w);
      for (let k = 0; k < 4; k++) b.at(0, 0, 0, (k * Math.PI) / 2, () => {
        for (let j = -1; j <= 1; j++) b.quad("dark", j * w * 0.5, y + th * 0.55, w + 0.02, w * 0.22, th * 0.3);
      });
      roofOver(c, "pagoda", w, w, y + th, 0.35);
      y += th + 0.6 * s;
      w *= 0.72;
    }
    return;
  }
  if (style === "ancient_egypt") {
    // a mudbrick fortress: battered walls, corner towers, rounded merlons
    const w = r * 0.72;
    const H = h * 0.55;
    batteredBlock(b, "main", 0, 0, w, w, 0, H, 0.06);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      batteredBlock(b, "main", sx * w, sz * w, w * 0.28, w * 0.28, 0, H * 1.3, 0.05);
      const tt = w * 0.28 - 0.05 * H * 1.3;
      cavettoAround(b, sx * w - tt, sz * w - tt, sx * w + tt, sz * w + tt, H * 1.3, 0.5 * s);
    }
    const tw = w - 0.06 * H;
    for (const [x0, z0, x1, z1] of [
      [-tw, tw, tw, tw],
      [-tw, -tw, tw, -tw],
      [tw, -tw, tw, tw],
      [-tw, -tw, -tw, tw],
    ] as [number, number, number, number][])
      merlons(b, "main", x0, z0, x1, z1, H, 0.5 * s, 0.8 * s, 0.8 * s, 0.6 * s);
    b.blk("main", -tw, H - 0.2 * s, -tw, tw, H, tw);
    doorway(b, "ancient_egypt", 0, 0, w, 2.4 * s, 4 * s);
    b.blk("main", -w * 0.4, 0, -w * 0.4, w * 0.4, h, w * 0.4);
    cavettoAround(b, -w * 0.4, -w * 0.4, w * 0.4, w * 0.4, h, 0.5 * s);
    return;
  }
  if (style === "mesoamerican") {
    // an acropolis: a broad terraced platform crowned by a palace shrine
    mesoPyramid(c, r * 0.85, r * 0.72, h * 1.05, 5);
    return;
  }
  if (style === "nordic" || style === "rustic") {
    // a timber hall-fort: a palisade ring with a gate tower around a turf-roofed great hall
    const pr = r * 0.9;
    const n = Math.round((2 * Math.PI * pr) / (0.45 * s));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.12) continue;
      const hh = h * 0.28 + ((i * 7) % 5) * 0.08 * s;
      b.cyl("wood", Math.sin(a) * pr, -0.3, Math.cos(a) * pr, 0.22 * s, 0.2 * s, hh, 6);
      b.add("wood", new THREE.ConeGeometry(0.22 * s, 0.6 * s, 6), xform(Math.sin(a) * pr, hh - 0.3 + 0.3 * s, Math.cos(a) * pr));
    }
    b.at(0, 0, 0, 0, () => {
      b.blk("wood", -r * 0.45, 0, -r * 0.35, r * 0.45, h * 0.3, r * 0.35);
      roofOver(c, "turf", r * 0.45, r * 0.35, h * 0.3, 1.1);
    });
    for (const sx of [-1, 1]) b.blk("woodDark", sx * 1.6 * s - 0.4 * s, 0, pr - 0.8 * s, sx * 1.6 * s + 0.4 * s, h * 0.55, pr + 0.4 * s);
    b.blk("wood", -2.2 * s, h * 0.5, pr - 1.0 * s, 2.2 * s, h * 0.56, pr + 0.6 * s);
    roofOver(c, style === "nordic" ? "turf" : "thatch", 2.2 * s, 0.9 * s, h * 0.56, 0.8);
    return;
  }
  if (style === "modern" || style === "industrial" || style === "futuristic") {
    // a citadel: a tall core with glazed bands, flanked by lower wings
    const w = r * 0.42;
    b.rectLoft("trim", 0, 0, w + 0.6 * s, w + 0.6 * s, [
      { o: 0, y: -0.3 },
      { o: 0, y: 0.8 * s },
    ]);
    b.blk("main", -w, 0.8 * s, -w, w, h, w);
    for (let i = 0; i < 6; i++) b.rectLoft(style === "futuristic" ? "glow" : "glass", 0, 0, w + 0.02, w + 0.02, [
      { o: 0, y: h * (0.2 + i * 0.13) },
      { o: 0, y: h * (0.2 + i * 0.13) + 0.9 * s },
    ], { capTop: false });
    for (const sx of [-1, 1]) {
      b.blk("main", sx * w, 0, -w * 0.8, sx * (w + r * 0.45), h * 0.4, w * 0.8);
      b.blk("glass", sx * w, h * 0.12, w * 0.8 + 0.01, sx * (w + r * 0.45), h * 0.3, w * 0.8 + 0.05);
    }
    b.blk("trim", -w - 0.2 * s, h, -w - 0.2 * s, w + 0.2 * s, h + 0.4 * s, w + 0.2 * s);
    b.rod("metal", [w * 0.5, h + 0.4 * s, 0], [w * 0.5, h * 1.18, 0], 0.08 * s);
    doorway(b, style, 0, 0.8 * s, w, 2.4 * s, 3 * s);
    return;
  }
  // medieval square keep with four corner turrets
  const w = r * 0.58;
  const H = h * 0.82;
  b.rectLoft("main2", 0, 0, w + 0.6 * s, w + 0.6 * s, [
    { o: 0, y: -0.4 },
    { o: 0, y: 1.2 * s },
    { o: -0.6 * s, y: 2.4 * s },
  ]);
  b.blk("main", -w, 0, -w, w, H, w);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    roundTower(b, style, sx * w, sz * w, r * 0.17, h * 0.95, s, style === "classical" ? "cone" : "merlons");
  }
  battlements(b, "main", w, w, H, s);
  for (let st = 0; st < 3; st++) for (let k = 0; k < 4; k++) b.at(0, 0, 0, (k * Math.PI) / 2, () => {
    for (let j = -1; j <= 1; j += 2) windowOn(b, "medieval", j * w * 0.4, H * (0.3 + st * 0.22), w, 0.6 * s, 1.3 * s);
  });
  // forebuilding stair to a raised door
  b.blk("main", -2.2 * s, 0, w, 2.2 * s, H * 0.25, w + 3.2 * s);
  for (let i = 0; i < 8; i++) b.blk("trim", 2.2 * s, (i * H * 0.25) / 8, w + 3.2 * s - (i + 1) * 0.4 * s, 3.4 * s, ((i + 1) * H * 0.25) / 8, w + 3.2 * s - i * 0.4 * s);
  doorway(b, "medieval", 0, H * 0.25, w + 3.2 * s, 1.5 * s, 2.6 * s, { arch: true });
  doorway(b, "medieval", 0, 0, w + 3.2 * s, 1.8 * s, 2.4 * s, { arch: true });
}

// ------------------------------------------------------------------------------------------------ wall

export function wall(c: Ctx) {
  const { b, style, r, h, s } = c;
  const L = r * 0.98;
  const T = 1.4 * s;
  switch (style) {
    case "nordic":
    case "rustic": {
      // a palisade of sharpened logs with a walkway behind
      const n = Math.round((2 * L) / (0.42 * s));
      for (let i = 0; i < n; i++) {
        const x = -L + ((i + 0.5) * 2 * L) / n;
        const hh = h * (0.9 + ((i * 7) % 5) * 0.03);
        b.cyl("wood", x, -0.4, 0, 0.2 * s, 0.19 * s, hh + 0.4 - 0.5 * s, 6);
        b.add("wood", new THREE.ConeGeometry(0.2 * s, 0.6 * s, 6), xform(x, hh - 0.2 * s, 0));
      }
      b.blk("woodDark", -L, h * 0.55, -1.2 * s, L, h * 0.6, -0.2 * s);
      for (let i = 0; i <= 8; i++) b.cyl("woodDark", -L + (i * 2 * L) / 8, 0, -1.0 * s, 0.12 * s, 0.12 * s, h * 0.55, 6);
      return;
    }
    case "east_asian": {
      b.blk("trim", -L, -0.3, -T / 2 - 0.2 * s, L, 0.8 * s, T / 2 + 0.2 * s);
      b.blk("paint", -L, 0.8 * s, -T / 2, L, h * 0.72, T / 2);
      // a tiled coping roof along the top
      b.rectLoft("roof", 0, 0, L + 0.2 * s, T / 2 + 0.6 * s, [
        { o: 0, y: h * 0.72 },
        { o: 0, y: h * 0.75 },
        { o: -(T / 2 + 0.5 * s), y: h * 0.98 },
      ], { smooth: true });
      return;
    }
    case "modern":
    case "industrial":
    case "futuristic": {
      const n = 8;
      for (let i = 0; i <= n; i++) {
        const x = -L + (i * 2 * L) / n;
        b.blk("trim", x - 0.3 * s, -0.3, -0.35 * s, x + 0.3 * s, h, 0.35 * s);
        if (i < n) {
          if (style === "futuristic") {
            b.blk("glass", x + 0.3 * s, 0.4 * s, -0.05, x + (2 * L) / n - 0.3 * s, h * 0.9, 0.05);
            b.blk("glow", x + 0.3 * s, h * 0.9, -0.08, x + (2 * L) / n - 0.3 * s, h * 0.92, 0.08);
          } else b.blk(style === "industrial" ? "main" : "main", x + 0.3 * s, -0.3, -0.2 * s, x + (2 * L) / n - 0.3 * s, h * 0.85, 0.2 * s);
        }
      }
      return;
    }
    default: {
      // stone or mudbrick curtain wall: plinth, wall walk, crenellations, buttresses/bastions
      const egypt = style === "ancient_egypt";
      const H = h * 0.8;
      b.rectLoft("main2", 0, 0, L, T / 2 + 0.3 * s, [
        { o: 0, y: -0.4 },
        { o: 0, y: 0.8 * s },
        { o: -0.3 * s, y: 1.1 * s },
      ]);
      b.rectLoft("main", 0, 0, L, T / 2, [
        { o: 0, y: 0 },
        { o: egypt ? -0.25 * s : 0, y: H },
      ]);
      merlons(b, "main", -L + 0.3 * s, T / 2 - 0.25 * s - (egypt ? 0.25 * s : 0), L - 0.3 * s, T / 2 - 0.25 * s - (egypt ? 0.25 * s : 0), H, 0.5 * s, h - H, 0.9 * s, 0.7 * s);
      const nb = 4;
      for (let i = 0; i <= nb; i++) {
        const x = -L + 1.5 * s + (i * (2 * L - 3 * s)) / nb;
        b.rectLoft("main", x, T / 2 + 0.5 * s, 1.5 * s, 0.9 * s, [
          { o: 0, y: 0 },
          { o: egypt ? -0.2 * s : -0.1 * s, y: H * (egypt ? 1.08 : 0.9) },
        ]);
        if (egypt) b.quad("dark", x, H * 0.7, T / 2 + 1.25 * s, 0.2 * s, 0.8 * s);
      }
      if (style === "classical") b.rectLoft("trim", 0, 0, L, T / 2, [
        { o: 0, y: H - 0.3 * s },
        { o: 0.2 * s, y: H - 0.1 * s },
        { o: 0.2 * s, y: H },
        { o: -0.01, y: H },
      ], { capTop: false });
    }
  }
}

// ------------------------------------------------------------------------------------------------ gate

export function gate(c: Ctx) {
  const { b, style, r, h, s } = c;
  switch (style) {
    case "ancient_egypt": {
      // a pylon gate: two battered towers, a portal with cavetto and winged disc, cedar doors
      const tw = r * 0.34;
      const td = r * 0.28;
      for (const sx of [-1, 1]) {
        const cx = sx * (r * 0.6);
        const inset = 0.085 * h;
        b.rectLoft("main", cx, 0, tw, td, [
          { o: 0, y: 0 },
          { o: -inset, y: h * 0.86 },
        ], { capTop: false });
        b.rectLoft("trim", cx, 0, tw - inset, td - inset, cavettoProfile(h * 0.86, 0.7 * s, -(td - inset) + 0.05), { smooth: true });
        b.with(xform(cx, 0.4 * s, td, 0, -Math.atan(0.085)), () => glyphColumn(b, c.rng, 0, h * 0.6, tw * 0.5));
      }
      const pw = r * 0.33;
      archedSlab(b, "main", pw * 2, h * 0.7, pw * 1.05, h * 0.5, td * 1.4, -td * 0.7, "flat");
      b.rectLoft("trim", 0, 0, pw, td * 0.7, cavettoProfile(h * 0.7, 0.55 * s, -td * 0.6), { smooth: true });
      wingedDisc(b, 0, h * 0.6, td * 0.7 + 0.03, pw * 1.3);
      doorLeaves(c, 0, 0, td * 0.3, pw * 1.05, h * 0.5 - 0.05, true, "woodDark");
      return;
    }
    case "east_asian": {
      for (const sx of [-1, 1]) {
        b.blk("trim", sx * r * 0.62 - r * 0.3, 0, -r * 0.35, sx * r * 0.62 + r * 0.3, h * 0.35, r * 0.35);
        for (const sz of [-1, 1]) b.cyl("paint", sx * r * 0.3, 0, sz * r * 0.28, 0.3 * s, 0.28 * s, h * 0.6, 12);
      }
      b.blk("paint", -r * 0.95, h * 0.55, -r * 0.35, r * 0.95, h * 0.62, r * 0.35);
      roofOver(c, "pagoda", r * 0.8, r * 0.3, h * 0.62, 0.5);
      doorLeaves(c, 0, 0, r * 0.1, r * 0.55, h * 0.5, true, "paint");
      return;
    }
    case "nordic":
    case "rustic": {
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 5; i++) b.cyl("wood", sx * (r * 0.4 + i * 0.45 * s), -0.3, 0, 0.22 * s, 0.2 * s, h * 0.8 + ((i * 3) % 4) * 0.1 * s, 6);
        b.cyl("woodDark", sx * r * 0.36, -0.3, 0, 0.3 * s, 0.3 * s, h + 0.3, 8);
      }
      b.blk("woodDark", -r * 0.5, h * 0.8, -0.8 * s, r * 0.5, h * 0.85, 0.8 * s);
      roofOver(c, style === "nordic" ? "turf" : "thatch", r * 0.45, 1.0 * s, h * 0.85, 0.6);
      doorLeaves(c, 0, 0, 0.1, r * 0.66, h * 0.65, true, "wood");
      return;
    }
    case "industrial":
    case "modern":
    case "futuristic": {
      for (const sx of [-1, 1]) b.blk("trim", sx * r * 0.62 - 0.6 * s, 0, -0.6 * s, sx * r * 0.62 + 0.6 * s, h, 0.6 * s);
      b.blk("trim", -r * 0.62, h * 0.85, -0.5 * s, r * 0.62, h, 0.5 * s);
      if (style === "futuristic") b.blk("glow", -r * 0.62, h * 0.83, -0.52 * s, r * 0.62, h * 0.85, 0.52 * s);
      // sliding gate leaves (slide sideways into the pillars when open)
      for (const sx of [-1, 1]) {
        c.mover("slide", [0, 0, 0], [sx * r * 0.55, 0, 0], true, (mb) => {
          const x0 = sx < 0 ? -r * 0.58 : 0.02;
          const x1 = sx < 0 ? -0.02 : r * 0.58;
          if (style === "futuristic") mb.blk("glow", x0, 0.1, -0.05, x1, h * 0.78, 0.05);
          else {
            mb.blk("metal", x0, 0.1, -0.06, x1, 0.25 * s, 0.06);
            mb.blk("metal", x0, h * 0.7, -0.06, x1, h * 0.78, 0.06);
            const n = 8;
            for (let i = 0; i <= n; i++) mb.cyl("metal", x0 + ((x1 - x0) * i) / n, 0.1, 0, 0.04 * s, 0.04 * s, h * 0.68, 6);
          }
        });
      }
      return;
    }
    default: {
      // a gatehouse: two towers flanking an arched passage, crenellated, with oak doors
      const tr = r * 0.3;
      for (const sx of [-1, 1]) roundTower(b, style, sx * r * 0.62, 0, tr, h * 0.9, s, style === "classical" ? "none" : "merlons");
      archedSlab(b, "main", r * 1.1, h * 0.8, r * 0.44, h * 0.55, r * 0.7, -r * 0.35, style === "medieval" ? "pointed" : "round");
      battlements(b, "main", r * 0.55, r * 0.35, h * 0.8, s, 0.5);
      doorLeaves(c, 0, 0, r * 0.05, r * 0.44, h * 0.44, true, "woodDark");
      if (style === "classical") {
        b.blk("trim", -r * 0.56, h * 0.8, -r * 0.36, r * 0.56, h * 0.9, r * 0.36);
      }
    }
  }
}

// ------------------------------------------------------------------------------------------------ beacon

export function beacon(c: Ctx) {
  const { b, style, r, h, s } = c;
  switch (style) {
    case "nordic":
    case "rustic": {
      // a timber tripod with an iron fire basket
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        b.rod("wood", [Math.sin(a) * r * 0.85, 0, Math.cos(a) * r * 0.85], [0, h * 0.85, 0], 0.14 * s, 0.1 * s, 6);
      }
      b.lathe("metal", 0, h * 0.8, 0, [[0.001, 0], [0.5 * s, 0.1 * s], [0.75 * s, 0.7 * s]], 10);
      c.fire(0, h * 0.85, 0, 1.6 * s, { light: true, defaultLit: true });
      return;
    }
    case "modern":
    case "industrial":
    case "futuristic": {
      // a lattice signal mast with a lamp
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        b.rod("metal", [Math.sin(a) * r * 0.7, 0, Math.cos(a) * r * 0.7], [Math.sin(a) * 0.25 * s, h * 0.9, Math.cos(a) * 0.25 * s], 0.06 * s);
      }
      for (let k = 1; k < 8; k++) {
        const y = (h * 0.9 * k) / 8;
        const rr = r * 0.7 + ((0.25 * s - r * 0.7) * k) / 8;
        b.add("metal", new THREE.TorusGeometry(rr, 0.03 * s, 3, 3), xform(0, y, 0, 0, Math.PI / 2));
      }
      b.cyl(style === "futuristic" ? "trim" : "paint2", 0, h * 0.9, 0, 0.35 * s, 0.35 * s, 0.6 * s, 12);
      c.fire(0, h * 0.97, 0, 0.9 * s, { light: true, defaultLit: true, lamp: true });
      return;
    }
    default: {
      // a stone pillar with a bronze brazier bowl
      const w = r * 0.45;
      b.rectLoft("trim", 0, 0, r * 0.8, r * 0.8, [
        { o: 0, y: -0.3 },
        { o: 0, y: 0.6 * s },
        { o: -0.1 * s, y: 0.7 * s },
      ]);
      b.rectLoft("main", 0, 0, w, w, [
        { o: 0, y: 0.7 * s },
        { o: -0.1 * s, y: h * 0.82 },
      ]);
      if (style === "ancient_egypt") {
        cavettoAround(b, -w + 0.1 * s, -w + 0.1 * s, w - 0.1 * s, w - 0.1 * s, h * 0.82, 0.3 * s);
        b.with(xform(0, 0.7 * s, w, 0, -0.01), () => glyphColumn(b, c.rng, 0.3 * s, h * 0.7, w * 0.8));
      } else b.rectLoft("trim", 0, 0, w - 0.1 * s, w - 0.1 * s, [
        { o: 0, y: h * 0.82 },
        { o: 0.25 * s, y: h * 0.84 },
        { o: 0.25 * s, y: h * 0.86 },
        { o: -w, y: h * 0.86 },
      ]);
      b.lathe("gold", 0, h * 0.86, 0, [[0.15 * s, 0], [0.2 * s, 0.4 * s], [r * 0.7, 0.9 * s], [r * 0.78, 1.0 * s], [r * 0.6, 1.0 * s], [0.001, 0.85 * s]], 16);
      c.fire(0, h * 0.86 + 0.8 * s, 0, 1.8 * s, { light: true, defaultLit: true });
    }
  }
}


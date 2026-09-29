import * as THREE from "three";
import { chamferLoop, TriSoup, xform, type GeoBuilder, type LoftSection, type V2, type V3 } from "../geom";
import { statueFigure } from "../../characters/statue";
import type { Ctx } from "../model";
import { cavettoAround, column, columnKindFor, glyphColumn, wingedDisc } from "../parts";

/*
 * Monuments: pyramid, step_pyramid, obelisk, sphinx, statue, monolith, stone_circle, arch. The Egyptian forms are the
 * demo's set pieces (Giza, 2560 BCE) and get the most sculpting: the cased pyramid with its gilded pyramidion (a "glow"
 * mover the renderer lights for the goal), obelisks with incised glyph columns, and a sphinx lofted from superellipse
 * sections so its silhouette (haunches, forepaws, nemes lappets) reads from the plateau.
 */

const scaled = (b: GeoBuilder, s: number, fn: () => void) => b.with(new THREE.Matrix4().makeScale(s, s, s), fn);

// ------------------------------------------------------------------------------------------------ pyramid

export function pyramid(c: Ctx) {
  const { b, r, h, style, s } = c;
  if (style === "mesoamerican") {
    mesoPyramid(c, r * 0.8, r * 0.8, h, 9);
    return;
  }
  if (style === "modern" || style === "futuristic" || c.matClass === "metal") {
    glassPyramid(c);
    return;
  }
  const a = r * 0.965;
  // a limestone apron sinking into the sand
  b.rectLoft("trim", 0, 0, r, r, [
    { o: 0, y: -0.8 },
    { o: 0, y: 0.22 * s },
    { o: -0.2 * s, y: 0.34 * s },
  ]);
  const capH = h * 0.05;
  const top = h - capH;
  const hw = (y: number) => a * (1 - y / h);
  const dent = 0.0055;
  const band = Math.min(3.5 * s, top * 0.08);
  const face = (y0: number, y1: number) => {
    const t = new TriSoup();
    const w0 = hw(y0);
    const w1 = hw(y1);
    const L0: V3 = [-w0, y0, w0];
    const M0: V3 = [0, y0, w0 * (1 - dent)];
    const R0: V3 = [w0, y0, w0];
    const L1: V3 = [-w1, y1, w1];
    const M1: V3 = [0, y1, w1 * (1 - dent)];
    const R1: V3 = [w1, y1, w1];
    t.quad(L0, M0, M1, L1);
    t.quad(M0, R0, R1, M1);
    return t.geometry();
  };
  for (let k = 0; k < 4; k++) {
    b.at(0, 0, 0, (k * Math.PI) / 2, () => {
      b.add("main2", face(0, band));
      b.add("main", face(band, top));
    });
  }
  // the entrance: a small dark doorway under a chevron of gable stones, on the front face
  const phi = Math.atan(a / h);
  const ye = h * 0.11;
  const ew = 2.1 * Math.max(1, s * 0.8);
  b.with(xform(0, ye, hw(ye) - 0.05, 0, -phi), () => {
    b.quad("dark", 0, ew * 0.62, 0.06, ew, ew * 1.24);
    b.blk("trim", -ew * 0.75, -0.1, -0.2, -ew * 0.5, ew * 1.3, 0.22);
    b.blk("trim", ew * 0.5, -0.1, -0.2, ew * 0.75, ew * 1.3, 0.22);
    b.blk("trim", -ew * 0.8, ew * 1.24, -0.2, ew * 0.8, ew * 1.5, 0.26);
    for (const sx of [-1, 1]) b.box("trim", sx * ew * 0.42, ew * 1.95, 0.05, ew * 1.1, ew * 0.34, 0.5, 0, 0, -sx * 0.62);
  });
  // gilded pyramidion (glows when the pyramid is the goal or has been opened)
  const at = hw(top) + 0.03;
  c.mover("glow", [0, top, 0], [0, 0, 0], false, (mb) => {
    mb.rectLoft("gold", 0, 0, at, at, [
      { o: 0, y: top - 0.05 },
      { o: -at, y: h },
    ]);
  });
}

function glassPyramid(c: Ctx) {
  const { b, r, h, s } = c;
  const a = r * 0.95;
  b.rectLoft("trim", 0, 0, r, r, [
    { o: 0, y: -0.5 },
    { o: 0, y: 0.6 * s },
  ]);
  const y0 = 0.6 * s;
  const t = new TriSoup();
  for (let k = 0; k < 4; k++) {
    const q = (k * Math.PI) / 2;
    const rot = (x: number, z: number): [number, number] => [x * Math.cos(q) + z * Math.sin(q), -x * Math.sin(q) + z * Math.cos(q)];
    const [ax, az] = rot(-a, a);
    const [bx, bz] = rot(a, a);
    t.tri([ax, y0, az], [bx, y0, bz], [0, h, 0]);
  }
  b.add("glass", t.geometry());
  // the structural grid: edges, horizontal ribs, mullions
  const rod = 0.08 * Math.max(1, s * 2);
  for (const [x, z] of [
    [-a, -a],
    [a, -a],
    [a, a],
    [-a, a],
  ] as V2[])
    b.rod("metal", [x, y0, z], [0, h, 0], rod * 1.6);
  for (let i = 1; i < 8; i++) {
    const y = y0 + ((h - y0) * i) / 8;
    const w = a * (1 - (y - y0) / (h - y0));
    for (let k = 0; k < 4; k++) {
      b.at(0, 0, 0, (k * Math.PI) / 2, () => b.rod("metal", [-w, y, w + 0.02], [w, y, w + 0.02], rod));
    }
  }
  for (let k = 0; k < 4; k++) {
    b.at(0, 0, 0, (k * Math.PI) / 2, () => {
      for (let i = -3; i <= 3; i++) b.rod("metal", [(a * i) / 4, y0, a + 0.02], [0, h, 0.02], rod * 0.7);
    });
  }
  if (c.style === "futuristic") c.mover("glow", [0, h * 0.94, 0], [0, 0, 0], false, (mb) => mb.sphere("glow", 0, h * 0.96, 0, 0.9 * s));
}

/** A Mesoamerican temple-pyramid: talud-tablero tiers, a front stair with balustrades, a shrine with a roof comb. */
export function mesoPyramid(c: Ctx, hx0: number, hz0: number, hTotal: number, tiers: number) {
  const { b, s } = c;
  const platformH = hTotal * 0.74;
  const th = platformH / tiers;
  const topHx = hx0 * 0.34;
  const step = (hx0 - topHx) / tiers;
  let y = 0;
  for (let i = 0; i < tiers; i++) {
    const hx = hx0 - i * step;
    const hz = hz0 - i * step;
    const talud = th * 0.62;
    // talud (sloped) then a vertical tablero panel with a projecting frame
    b.rectLoft(i % 2 ? "main" : "main2", 0, 0, hx, hz, [
      { o: 0, y },
      { o: -step * 0.45, y: y + talud },
    ], { capTop: false });
    b.rectLoft("trim", 0, 0, hx - step * 0.45, hz - step * 0.45, [
      { o: 0.12 * s, y: y + talud },
      { o: 0.12 * s, y: y + th },
      { o: -step * 0.55, y: y + th },
    ]);
    y += th;
  }
  // stair: a stepped prism running up the front, with balustrades
  const sw = hx0 * 0.3;
  const zFoot = hz0 + hx0 * 0.12;
  const zTop = hz0 - tiers * step + step * 0.2;
  const n = Math.max(12, Math.round(platformH / (0.45 * s)));
  const prof: V2[] = [[zFoot, 0]];
  for (let i = 0; i < n; i++) {
    const z = zFoot - ((zFoot - zTop) * i) / n;
    const yy = (platformH * (i + 1)) / n;
    prof.push([z, yy], [z - (zFoot - zTop) / n, yy]);
  }
  prof.push([zTop - 1 * s, platformH], [zTop - 1 * s, 0]);
  // prism profile is in (z, y); extrude along x
  // profile points are (z, y); a -90° yaw maps local x → world z and extrudes toward -x
  b.prism("trim", prof, sw * 2, xform(sw, 0, 0, -Math.PI / 2));
  for (const sx of [-1, 1]) {
    b.prism("main", [[zFoot + 0.4 * s, 0], [zFoot + 0.4 * s, 1.2 * s], [zTop - 0.4 * s, platformH + 0.6 * s], [zTop - 1 * s, platformH + 0.6 * s], [zTop - 1 * s, 0]], 1.2 * s, xform(sx * (sw + (sx > 0 ? 1.2 * s : 0)), 0, 0, -Math.PI / 2));
  }
  // the shrine on top
  const tHx = topHx * 0.8;
  const tHz = topHx * 0.62;
  const ty = platformH;
  const wallH = (hTotal - platformH) * 0.55;
  b.blk("paint", -tHx, ty, -tHz, tHx, ty + wallH, tHz);
  b.quad("dark", 0, ty + wallH * 0.4, tHz + 0.02, tHx * 0.5, wallH * 0.8);
  b.blk("trim", -tHx - 0.3 * s, ty + wallH, -tHz - 0.3 * s, tHx + 0.3 * s, ty + wallH + 0.5 * s, tHz + 0.3 * s);
  b.rectLoft("main", 0, 0, tHx, tHz, [
    { o: 0.2 * s, y: ty + wallH + 0.5 * s },
    { o: -tHz * 0.6, y: ty + wallH + (hTotal - platformH) * 0.2 },
  ]);
  // roof comb: a perforated crest
  const combY = ty + wallH + (hTotal - platformH) * 0.2;
  const combH = hTotal - combY;
  const cw = tHx * 0.7;
  for (let i = 0; i < 5; i++) {
    const x = -cw + (i * 2 * cw) / 4;
    b.blk("paint", x - 0.35 * s, combY, -0.3 * s, x + 0.35 * s, combY + combH, 0.3 * s);
  }
  for (let j = 0; j < 3; j++) b.blk("paint", -cw - 0.35 * s, combY + combH * (0.3 + j * 0.33), -0.3 * s, cw + 0.35 * s, combY + combH * (0.3 + j * 0.33) + 0.35 * s, 0.3 * s);
}

// ------------------------------------------------------------------------------------------------ step pyramid

export function stepPyramid(c: Ctx) {
  const { b, r, h, style, s } = c;
  if (style === "mesoamerican") {
    mesoPyramid(c, r * 0.8, r * 0.78, h, 9);
    return;
  }
  const egypt = style === "ancient_egypt";
  const tiers = egypt ? 6 : 4;
  const hx0 = r * 0.96;
  const hz0 = egypt ? r * 0.84 : r * 0.9;
  const th = h / tiers;
  const batter = egypt ? 0.24 : 0.08;
  const step = (hx0 - r * (egypt ? 0.36 : 0.32)) / (tiers - 1);
  const course = 1.05 * s;
  for (let i = 0; i < tiers; i++) {
    const y0 = i * th;
    const hx = hx0 - i * step;
    const hz = hz0 - i * step;
    const n = Math.max(2, Math.round(th / course));
    for (let k = 0; k < n; k++) {
      const ya = y0 + (th * k) / n;
      const yb = y0 + (th * (k + 1)) / n;
      b.rectLoft((k + i) % 2 ? "main" : "main2", 0, 0, hx, hz, [
        { o: -batter * (ya - y0), y: ya },
        { o: -batter * (yb - y0), y: yb },
      ], { capTop: k === n - 1 });
    }
  }
  if (!egypt) {
    // a ziggurat stair up the front and a small shrine on top
    const sw = hx0 * 0.18;
    const n = Math.round(h / (0.4 * s));
    for (let i = 0; i < n; i++) {
      const yy = (h * i) / n;
      const z = hz0 + r * 0.06 - (i / n) * (hz0 - (hz0 - (tiers - 1) * step)) - 0.2;
      b.blk("trim", -sw, yy, z - 1.2 * s, sw, yy + h / n, z);
    }
    const topHx = hx0 - (tiers - 1) * step;
    b.blk("paint", -topHx * 0.5, h, -topHx * 0.4, topHx * 0.5, h + 3 * s, topHx * 0.4);
    b.quad("dark", 0, h + 1.2 * s, topHx * 0.4 + 0.02, 1.4 * s, 2.2 * s);
  } else {
    // a small doorway at the foot of the south face
    b.quad("dark", 0, 1.2 * s, hz0 + 0.02, 1.6 * s, 2.4 * s);
    b.blk("trim", -1.3 * s, 2.4 * s, hz0 - 0.1, 1.3 * s, 2.9 * s, hz0 + 0.25 * s);
  }
}

// ------------------------------------------------------------------------------------------------ obelisk

export function obelisk(c: Ctx) {
  const { b, r, h, style, s, rng } = c;
  if (style === "futuristic") {
    // a faceted dark crystal needle with glowing seams
    b.rectLoft("trim", 0, 0, r * 0.75, r * 0.75, [
      { o: 0, y: -0.3 },
      { o: 0, y: 0.8 * s },
      { o: -0.2 * s, y: 1 * s },
    ]);
    b.polyLoft("main", chamferLoop(0, 0, r * 0.35, r * 0.35, r * 0.12), [
      { o: 0, y: 1 * s },
      { o: -r * 0.12, y: h * 0.86 },
      { o: -r * 0.34, y: h },
    ]);
    for (let k = 0; k < 4; k++) b.at(0, 0, 0, (k * Math.PI) / 2 + Math.PI / 4, () => b.box("glow", 0, h * 0.45, r * 0.34, 0.06 * s, h * 0.7, 0.04, 0, -0.02));
    return;
  }
  const modern = style === "modern" || style === "industrial";
  const base = r * 0.8;
  // plinth: two courses with chamfers
  b.rectLoft("trim", 0, 0, base, base, [
    { o: 0, y: -0.4 },
    { o: 0, y: 0.5 * s },
    { o: -0.08 * s, y: 0.58 * s },
  ]);
  b.rectLoft("main2", 0, 0, base * 0.8, base * 0.8, [
    { o: 0, y: 0.58 * s },
    { o: 0, y: 1.3 * s },
    { o: -0.06 * s, y: 1.36 * s },
  ]);
  const y0 = 1.36 * s;
  const w0 = modern ? h * 0.04 : h * 0.052;
  const w1 = w0 * (modern ? 0.72 : 0.66);
  const capH = w1 * (modern ? 2.2 : 1.15);
  const yTop = h - capH;
  b.rectLoft("main", 0, 0, w0, w0, [
    { o: 0, y: y0 },
    { o: -(w0 - w1), y: yTop },
  ], { capTop: false });
  const egypt = style === "ancient_egypt";
  b.rectLoft(egypt || style === "classical" ? "gold" : "main", 0, 0, w1 + 0.015, w1 + 0.015, [
    { o: 0, y: yTop },
    { o: -(w1 + 0.015), y: h },
  ]);
  if (egypt) {
    const lean = Math.atan((w0 - w1) / (yTop - y0));
    for (let k = 0; k < 4; k++) {
      b.at(0, 0, 0, (k * Math.PI) / 2, () => {
        b.with(xform(0, y0, w0, 0, -lean), () => glyphColumn(b, rng, 1.4 * s, yTop - y0 - 1.2 * s, w0 * 0.8));
      });
    }
  } else if (style === "classical") {
    // a bronze-lettered panel on the pedestal
    for (let i = 0; i < 4; i++) b.quad("dark", 0, 0.8 * s + i * 0.12 * s, base * 0.8 + 0.01, base * 1.1 - (i % 2) * 0.3 * s, 0.05 * s);
  }
}

// ------------------------------------------------------------------------------------------------ sphinx

export function sphinx(c: Ctx) {
  const { b, s } = c;
  scaled(b, s, () => sphinxUnit(b));
}

/** The sphinx at scale 1: 36 m long, 12 m high, facing +z. */
function sphinxUnit(b: GeoBuilder) {
  // bedrock plinth, cut from the same stone
  b.rectLoft("main2", 0, 0, 6.6, 17.6, [
    { o: 0, y: -0.5 },
    { o: 0, y: 0.95 },
    { o: -0.14, y: 1.1 },
  ]);
  const floor = 1.02;
  const sec = (z: number, top: number, w: number, x = 0, n = 3.2, fb = 0.75): LoftSection => {
    const hh = (top - floor) / (2 - fb);
    return { c: [x, floor + hh * (1 - fb), z], w, h: hh, n, flatBottom: fb };
  };
  // lion body: a long, level back from the rounded rump to high shoulders and a flat, upright chest
  b.loft("main", [
    sec(-16.9, 4.6, 2.2, 0, 2.6),
    sec(-16.5, 6.1, 3.3, 0, 3),
    sec(-15.2, 6.95, 3.9),
    sec(-12.5, 7.1, 4.0),
    sec(-9.0, 6.75, 3.6),
    sec(-4.5, 6.8, 3.55),
    sec(-0.5, 7.35, 3.8),
    sec(2.2, 7.9, 3.9),
    sec(3.9, 7.7, 3.6),
    sec(4.7, 6.9, 3.2, 0, 3.6),
    sec(5.0, 5.6, 2.9, 0, 3.8),
  ], { radial: 24, subdivide: 2, capStart: true, capEnd: true });
  // spine ridge and shoulder blades
  b.loft("main", [sec(-13, 7.2, 0.6, 0, 2), sec(-4, 6.95, 0.7, 0, 2), sec(2.0, 8.05, 0.9, 0, 2), sec(3.5, 7.8, 0.5, 0, 2)], { radial: 10, subdivide: 2, capStart: true, capEnd: true });
  for (const sx of [-1, 1]) {
    // haunch: the folded hind leg bulging from the flank, and the hind paw lying forward along the plinth
    b.loft("main", [
      sec(-16.0, 4.6, 0.5, sx * 3.35, 2.4, 0.6),
      sec(-14.6, 5.9, 1.05, sx * 3.55, 2.4, 0.6),
      sec(-12.2, 6.1, 1.15, sx * 3.6, 2.4, 0.6),
      sec(-9.8, 5.2, 0.95, sx * 3.45, 2.4, 0.6),
      sec(-8.6, 3.8, 0.5, sx * 3.3, 2.4, 0.6),
    ], { radial: 14, subdivide: 2, capStart: true, capEnd: true });
    b.loft("main", [sec(-15.2, 2.55, 0.85, sx * 4.25, 3.2), sec(-12.0, 2.35, 0.85, sx * 4.4, 3.2), sec(-8.7, 2.25, 0.9, sx * 4.35, 3.2), sec(-7.7, 1.95, 0.75, sx * 4.25, 3.2), sec(-7.3, 1.5, 0.45, sx * 4.2, 3.2)], { radial: 12, subdivide: 2, capStart: true, capEnd: true });
    // shoulder and foreleg: massive, lying straight forward, ending in a broad paw
    b.loft("main", [
      sec(0.8, 6.4, 1.55, sx * 2.55, 3.0),
      sec(3.4, 5.0, 1.5, sx * 2.6, 3.2),
      sec(5.6, 3.2, 1.45, sx * 2.6, 3.6),
      sec(8.5, 2.95, 1.4, sx * 2.6, 3.8),
      sec(12.5, 2.9, 1.42, sx * 2.6, 3.8),
      sec(14.8, 2.85, 1.55, sx * 2.6, 3.6),
      sec(16.0, 2.5, 1.55, sx * 2.6, 3.2),
      sec(16.7, 1.95, 1.3, sx * 2.6, 2.8),
      sec(17.0, 1.4, 0.8, sx * 2.6, 2.6),
    ], { radial: 16, subdivide: 2, capStart: true, capEnd: true });
    for (let t = 0; t < 4; t++) {
      const tx = sx * 2.6 + (t - 1.5) * 0.72;
      b.sphere("main2", tx, 1.55, 16.7 - Math.abs(t - 1.5) * 0.12, 0.33, 0.45, 0.4, 8, 6);
    }
  }
  // tail curled along the right flank
  b.tube("main", [
    [1.4, 4.6, -16.7],
    [2.9, 2.6, -17.0],
    [4.1, 1.7, -16.0],
    [4.9, 1.55, -13.6],
    [5.0, 1.55, -10.9],
    [4.75, 1.7, -9.6],
  ], 0.3, 8, 30);
  b.sphere("main", 4.7, 1.75, -9.4, 0.4, 0.34, 0.55, 8, 6);
  // neck and head
  b.loft("main", [
    { c: [0, 6.8, 3.9], w: 1.5, h: 1.3, n: 2.6 },
    { c: [0, 8.2, 4.4], w: 1.4, h: 1.25, n: 2.6 },
    { c: [0, 9.0, 4.7], w: 1.35, h: 1.2, n: 2.6 },
  ], { radial: 16, capEnd: true, up: [0, 0, 1] });
  // the head is authored around (0, 8.6, 5.3); scale it up a touch about that point and seat it on the neck
  b.with(xform(0, 8.75, 4.5).multiply(new THREE.Matrix4().makeScale(1.14, 1.14, 1.14)).multiply(xform(0, -8.6, -5.3)), () => sphinxHead(b));
  // the dream stele and an offering altar between the paws
  b.blk("main2", -1.45, 1.0, 8.6, 1.45, 1.3, 9.4);
  b.add("main2", new THREE.CylinderGeometry(1.2, 1.2, 0.4, 20, 1, false, -Math.PI / 2, Math.PI), xform(0, 3.9, 9.0, 0, -Math.PI / 2));
  b.blk("main2", -1.2, 1.3, 8.8, 1.2, 3.9, 9.2);
  b.with(xform(0, 1.3, 9.21), () => {
    for (let i = 0; i < 6; i++) b.quad("dark", 0, 1.9 - i * 0.26, 0.001, 1.8 - (i % 2) * 0.3, 0.06);
    wingedDisc(b, 0, 2.55, 0.02, 1.8);
  });
  b.blk("main2", -0.8, 1.0, 11.8, 0.8, 1.95, 12.8);
}

/** The king's head in the nemes headcloth (authored around y ≈ 9.7, z ≈ 5.6, face toward +z). */
function sphinxHead(b: GeoBuilder) {
  // skull and face
  b.sphere("main", 0, 9.72, 5.62, 1.24, 1.5, 1.34, 20, 14);
  // jaw and cheeks give the face a squarer, royal set
  b.sphere("main", 0, 9.2, 5.95, 1.0, 0.85, 1.0, 16, 10);
  // nemes: crown, brow band, the flaring wings behind the ears, the striped lappets on the chest, the queue at the back
  b.sphere("main", 0, 10.3, 5.15, 1.6, 1.3, 1.65, 20, 12);
  b.tube("main", [
    [-1.4, 10.25, 5.3],
    [-1.0, 10.42, 6.45],
    [0, 10.48, 6.85],
    [1.0, 10.42, 6.45],
    [1.4, 10.25, 5.3],
  ], 0.15, 6, 24);
  const wing = (sx: number): LoftSection[] => [
    { c: [sx * 1.25, 10.95, 5.05], w: 0.28, h: 0.95, n: 4 },
    { c: [sx * 1.75, 9.9, 5.15], w: 0.32, h: 1.1, n: 4 },
    { c: [sx * 2.2, 8.55, 5.1], w: 0.34, h: 1.2, n: 4 },
    { c: [sx * 2.3, 7.2, 5.25], w: 0.34, h: 1.05, n: 4 },
  ];
  const lappet = (sx: number): LoftSection[] => [
    { c: [sx * 1.2, 9.2, 6.0], w: 0.45, h: 0.17, n: 4 },
    { c: [sx * 1.32, 8.0, 6.5], w: 0.5, h: 0.18, n: 4 },
    { c: [sx * 1.4, 6.6, 6.85], w: 0.54, h: 0.18, n: 4 },
  ];
  b.loft("main", [
    { c: [0, 10.2, 3.9], w: 0.9, h: 0.5, n: 3 },
    { c: [0, 9.0, 3.75], w: 0.55, h: 0.4, n: 3 },
    { c: [0, 7.8, 3.9], w: 0.35, h: 0.35, n: 3 },
  ], { radial: 10, capEnd: true, up: [0, 0, 1] });
  for (const sx of [-1, 1]) {
    const w = wing(sx);
    b.loft("main", w, { radial: 12, capStart: true, capEnd: true, up: [0, 0, 1] });
    b.loft("main", lappet(sx), { radial: 10, capStart: true, capEnd: true, up: [0, 0, 1] });
    // stripes: bands a touch proud of the wings and lappets
    for (let y = 10.75; y > 7.3; y -= 0.34) {
      const t = (10.95 - y) / (10.95 - 7.2);
      const k = Math.min(2, Math.floor(t * 3));
      const f = t * 3 - k;
      const a = w[k].c;
      const bb = w[Math.min(3, k + 1)].c;
      const x = a[0] + (bb[0] - a[0]) * f;
      const z = a[2] + (bb[2] - a[2]) * f;
      const hh = w[k].h + (w[Math.min(3, k + 1)].h - w[k].h) * f;
      b.box("main2", x, y, z, 0.74, 0.14, hh * 2 + 0.06);
    }
    for (let y = 9.0; y > 6.75; y -= 0.3) {
      const t = (9.2 - y) / 2.6;
      b.box("main2", sx * (1.2 + 0.2 * t), y, 6.0 + 0.85 * t, 1.04, 0.13, 0.44);
    }
    // crown stripes over the top of the headcloth
    b.add("main2", new THREE.TorusGeometry(1.2 + sx * 0.001, 0.07, 4, 16, Math.PI), xform(sx * 0.55, 10.3, 5.1, Math.PI / 2, 0, 0, 1, 1.05, 1.25));
    // ear, eye, brow, cheek
    b.sphere("main", sx * 1.3, 9.78, 5.95, 0.14, 0.44, 0.3, 8, 6);
    b.sphere("dark", sx * 0.46, 9.9, 6.8, 0.28, 0.11, 0.1, 10, 6);
    b.sphere("main", sx * 0.46, 9.97, 6.84, 0.3, 0.07, 0.08, 10, 6);
    b.box("main", sx * 0.47, 10.1, 6.8, 0.74, 0.16, 0.34, 0, 0, sx * 0.12);
  }
  // nose, lips, mouth line, false beard, uraeus
  b.sphere("main", 0, 9.46, 6.9, 0.22, 0.48, 0.36, 10, 8);
  b.sphere("main", 0, 9.06, 6.88, 0.38, 0.13, 0.15, 10, 6);
  b.box("dark", 0, 8.99, 6.99, 0.5, 0.045, 0.04);
  b.loft("main", [
    { c: [0, 8.45, 6.4], w: 0.32, h: 0.3, n: 3 },
    { c: [0, 7.8, 6.55], w: 0.34, h: 0.32, n: 3 },
    { c: [0, 7.2, 6.75], w: 0.32, h: 0.32, n: 3 },
  ], { radial: 10, capStart: true, capEnd: true, up: [0, 0, 1] });
  for (let y = 8.3; y > 7.3; y -= 0.2) b.box("main2", 0, y, 6.55 + (8.3 - y) * 0.18, 0.7, 0.06, 0.68);
  b.tube("main", [
    [0, 10.42, 6.9],
    [0, 10.75, 7.0],
    [0, 11.0, 6.86],
  ], 0.11, 6, 10);
}

// ------------------------------------------------------------------------------------------------ monolith

/** A rough standing stone: a jittered octagonal loft that tapers, deterministic from rng. */
export function roughStone(b: GeoBuilder, slot: "main" | "main2" | "trim", x: number, z: number, w: number, d: number, h: number, rng: () => number, lean = 0, yaw = 0) {
  const jit = () => 1 + (rng() - 0.5) * 0.28;
  const loop: V2[] = chamferLoop(0, 0, w / 2, d / 2, Math.min(w, d) * 0.22).map(([px, pz]) => [px * jit(), pz * jit()] as V2);
  b.with(xform(x, 0, z, yaw, 0, lean), () => {
    b.polyLoft(slot, loop, [
      { o: -0.04 * w, y: -0.4 },
      { o: 0, y: h * 0.08 },
      { o: -0.03 * w * jit(), y: h * 0.55 },
      { o: -0.1 * w * jit(), y: h * 0.9 },
      { o: -0.3 * w, y: h },
    ]);
  });
}

export function monolith(c: Ctx) {
  const { b, r, h, style, s, rng } = c;
  switch (style) {
    case "ancient_egypt": {
      // a round-topped stele with a winged disc and registers of text
      b.rectLoft("trim", 0, 0, r * 0.9, r * 0.55, [
        { o: 0, y: -0.3 },
        { o: 0, y: 0.5 * s },
        { o: -0.06 * s, y: 0.56 * s },
      ]);
      const w = r * 0.62;
      const t = 0.5 * s;
      const top = h - w;
      b.blk("main", -w, 0.56 * s, -t, w, top, t);
      b.add("main", new THREE.CylinderGeometry(w, w, t * 2, 20, 1, false, -Math.PI / 2, Math.PI), xform(0, top, 0, 0, -Math.PI / 2));
      b.with(xform(0, 0, t), () => {
        wingedDisc(b, 0, top + w * 0.35, 0.02, w * 1.6);
        glyphColumn(b, rng, 0.9 * s, top - 0.2 * s, w * 0.55);
        for (let i = 0; i < 5; i++) b.quad("dark", 0, top - 0.3 * s - i * 0.5 * s, 0.012, w * 1.7, 0.035 * s);
      });
      return;
    }
    case "classical": {
      b.rectLoft("trim", 0, 0, r * 0.8, r * 0.5, [
        { o: 0, y: -0.3 },
        { o: 0, y: 0.6 * s },
      ]);
      const w = r * 0.55;
      b.blk("main", -w, 0.6 * s, -0.3 * s, w, h * 0.86, 0.3 * s);
      b.prism("trim", [[-w - 0.1 * s, 0], [w + 0.1 * s, 0], [0, h * 0.14]], 0.7 * s, xform(0, h * 0.86, -0.35 * s));
      for (let i = 0; i < 7; i++) b.quad("dark", 0, h * 0.75 - i * 0.35 * s, 0.31 * s, w * 1.5 - (i % 3) * 0.2 * s, 0.05 * s);
      return;
    }
    case "nordic": {
      // runestone with a carved serpent band
      roughStone(b, "main", 0, 0, r * 1.2, r * 0.45, h, rng, 0.02);
      const pts: V3[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        pts.push([Math.sin(t * Math.PI * 1.1 - 0.5) * r * 0.42, h * (0.12 + 0.72 * Math.sin(t * Math.PI * 0.95)), r * 0.24 + 0.04]);
      }
      b.tube("paint", pts, 0.07 * s, 5, 48);
      return;
    }
    case "modern":
    case "futuristic": {
      b.blk("trim", -r * 0.9, -0.3, -r * 0.5, r * 0.9, 0.2 * s, r * 0.5);
      b.blk("main", -r * 0.45, 0.2 * s, -0.12 * h, r * 0.45, h, 0.12 * h * 0.5);
      if (style === "futuristic") {
        b.box("glow", 0, h * 0.5, 0.06 * h + 0.01, 0.08 * s, h * 0.8, 0.02);
        b.box("glow", 0, h * 0.5, -0.12 * h - 0.01, 0.08 * s, h * 0.8, 0.02);
      }
      return;
    }
    case "mesoamerican": {
      // a carved stela: a tall slab with stacked relief blocks and an altar stone
      b.blk("main", -r * 0.5, 0, -0.35 * s, r * 0.5, h, 0.35 * s);
      for (let i = 0; i < 6; i++) b.blk(i % 2 ? "main2" : "trim", -r * 0.42 + (i % 3) * 0.1 * s, 0.6 * s + i * h * 0.14, 0.33 * s, r * 0.42 - (i % 2) * 0.15 * s, 0.6 * s + i * h * 0.14 + h * 0.1, 0.42 * s);
      b.cyl("trim", 0, 0, r * 0.75, 0.6 * s, 0.6 * s, 0.6 * s, 12);
      return;
    }
    default:
      // a standing stone with a fallen companion and a ring of packing stones at its foot
      roughStone(b, "main", 0, 0, r * 0.8, r * 0.55, h, rng, (rng() - 0.5) * 0.08);
      roughStone(b, "main2", r * 0.45, r * 0.55, r * 0.5, r * 0.35, r * 0.28, rng, 0, 0.8);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        roughStone(b, "main2", Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72, 0.3 * s, 0.25 * s, 0.22 * s, rng, 0, a);
      }
      return;
  }
}

// ------------------------------------------------------------------------------------------------ stone circle

export function stoneCircle(c: Ctx) {
  const { b, r, h, style, s, rng } = c;
  if (style === "futuristic") {
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      b.at(Math.sin(a) * r * 0.85, 0, Math.cos(a) * r * 0.85, a, () => {
        b.cyl("trim", 0, 0, 0, 0.7 * s, 0.35 * s, h, 6);
        b.box("glow", 0, h * 0.55, 0.36 * s, 0.1 * s, h * 0.6, 0.04);
      });
    }
    b.cyl("glow", 0, 0, 0, r * 0.2, r * 0.2, 0.08 * s, 24);
    return;
  }
  const ringR = r * 0.86;
  const n = 16;
  const lintel = style !== "nordic" && style !== "rustic";
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.1;
    // a gap in the ring at the front so it reads as an entrance
    if (i === 0) continue;
    const x = Math.sin(a) * ringR;
    const z = Math.cos(a) * ringR;
    const hh = h * (0.92 + rng() * 0.12);
    roughStone(b, i % 3 ? "main" : "main2", x, z, 1.9 * s, 1.0 * s, hh, rng, (rng() - 0.5) * 0.05, a);
    if (lintel && i % 2 === 1 && i < n - 1) {
      const a2 = ((i + 1) / n) * Math.PI * 2 + 0.1;
      const x2 = Math.sin(a2) * ringR;
      const z2 = Math.cos(a2) * ringR;
      b.beam("main2", [x, h * 0.95, z], [x2, h * 0.95, z2], 0.8 * s, 0.7 * s);
    }
  }
  // inner horseshoe of trilithons and an altar stone
  for (let i = -2; i <= 2; i++) {
    const a = Math.PI + i * 0.5;
    const x = Math.sin(a) * ringR * 0.55;
    const z = Math.cos(a) * ringR * 0.55;
    const hh = h * (1.05 + (2 - Math.abs(i)) * 0.08);
    const tx = Math.cos(a) * 1.3 * s;
    const tz = -Math.sin(a) * 1.3 * s;
    roughStone(b, "main", x - tx, z - tz, 1.6 * s, 1.0 * s, hh, rng, 0, a);
    roughStone(b, "main", x + tx, z + tz, 1.6 * s, 1.0 * s, hh, rng, 0, a);
    if (lintel) b.beam("main2", [x - tx * 1.4, hh * 0.97, z - tz * 1.4], [x + tx * 1.4, hh * 0.97, z + tz * 1.4], 0.9 * s, 0.7 * s);
  }
  b.blk("main2", -1.8 * s, 0, -0.6 * s, 1.8 * s, 0.55 * s, 0.6 * s);
}

// ------------------------------------------------------------------------------------------------ arch

/** A wall slab with an arched (or flat, or pointed) opening cut through it, extruded along z. */
export function archedSlab(b: GeoBuilder, slot: "main" | "main2" | "trim", w: number, h: number, ow: number, oh: number, depth: number, z0: number, shape: "round" | "pointed" | "flat" | "corbel" = "round") {
  const outer = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(w / 2, h), new THREE.Vector2(-w / 2, h)]);
  const hole = new THREE.Path();
  const spring = shape === "flat" ? oh : shape === "corbel" ? oh * 0.45 : oh - ow / 2;
  hole.moveTo(-ow / 2, 0.001);
  hole.lineTo(ow / 2, 0.001);
  hole.lineTo(ow / 2, spring);
  if (shape === "round") hole.absarc(0, spring, ow / 2, 0, Math.PI, false);
  else if (shape === "pointed") {
    hole.quadraticCurveTo(ow / 2, oh * 0.92, 0, oh + ow * 0.1);
    hole.quadraticCurveTo(-ow / 2, oh * 0.92, -ow / 2, spring);
  } else if (shape === "corbel") {
    hole.lineTo(ow * 0.08, oh);
    hole.lineTo(-ow * 0.08, oh);
    hole.lineTo(-ow / 2, spring);
  } else {
    hole.lineTo(-ow / 2, oh);
  }
  hole.lineTo(-ow / 2, 0.001);
  outer.holes.push(hole);
  b.extrude(slot, outer, depth, xform(0, 0, z0), 10);
}

export function arch(c: Ctx) {
  const { b, r, h, style, s } = c;
  const w = r * 1.85;
  const d = r * 0.55;
  switch (style) {
    case "ancient_egypt": {
      // a free-standing gateway: battered jambs, lintel with cavetto and the winged disc
      const jw = w * 0.26;
      for (const sx of [-1, 1]) {
        b.rectLoft("main", sx * (w / 2 - jw / 2), 0, jw / 2, d / 2, [
          { o: 0, y: 0 },
          { o: -0.02 * h, y: h * 0.8 },
        ]);
      }
      b.blk("main", -w / 2 + 0.02 * h, h * 0.8, -d / 2 + 0.02 * h, w / 2 - 0.02 * h, h * 0.86, d / 2 - 0.02 * h);
      cavettoAround(b, -w / 2 + 0.02 * h, -d / 2 + 0.02 * h, w / 2 - 0.02 * h, d / 2 - 0.02 * h, h * 0.86, h * 0.13);
      wingedDisc(b, 0, h * 0.83, d / 2 - 0.02 * h + 0.02, w * 0.5);
      for (const sx of [-1, 1]) b.with(xform(sx * (w / 2 - jw / 2), 0.4 * s, d / 2 + 0.005, 0, -0.02), () => glyphColumn(b, c.rng, 0, h * 0.72, jw * 0.6));
      return;
    }
    case "east_asian": {
      // paifang: lacquered posts, tie beams and a small tiled roof
      for (const sx of [-1, 1]) {
        b.cyl("trim", sx * w * 0.4, 0, 0, 0.9 * s, 0.9 * s, 0.6 * s, 10);
        b.cyl("paint", sx * w * 0.4, 0, 0, 0.4 * s, 0.36 * s, h * 0.84, 12);
      }
      b.blk("paint", -w * 0.5, h * 0.62, -0.3 * s, w * 0.5, h * 0.68, 0.3 * s);
      b.blk("paint2", -w * 0.2, h * 0.68, -0.2 * s, w * 0.2, h * 0.76, 0.2 * s);
      b.blk("paint", -w * 0.52, h * 0.76, -0.35 * s, w * 0.52, h * 0.82, 0.35 * s);
      b.rectLoft("roof", 0, 0, w * 0.56, 0.9 * s, [
        { o: 0, y: h * 0.82 },
        { o: 0, y: h * 0.86 },
        { o: -0.9 * s, y: h },
      ], { smooth: true });
      return;
    }
    case "mesoamerican": {
      archedSlab(b, "main", w, h * 0.72, w * 0.36, h * 0.52, d, -d / 2, "corbel");
      b.blk("trim", -w / 2 - 0.2 * s, h * 0.72, -d / 2 - 0.2 * s, w / 2 + 0.2 * s, h * 0.8, d / 2 + 0.2 * s);
      // stepped-fret frieze and a crest
      for (let i = -3; i <= 3; i++) b.blk(i % 2 ? "paint" : "main2", i * w * 0.13 - w * 0.05, h * 0.8, -d / 2, i * w * 0.13 + w * 0.05, h * (0.88 + (i % 2 ? 0.04 : 0)), d / 2);
      b.blk("main", -w * 0.3, h * 0.88, -0.3 * s, w * 0.3, h, 0.3 * s);
      return;
    }
    case "nordic":
    case "rustic": {
      for (const sx of [-1, 1]) {
        b.cyl("wood", sx * w * 0.38, 0, 0, 0.32 * s, 0.28 * s, h * 0.86, 8);
        b.beam("wood", [sx * w * 0.38, h * 0.55, 0], [sx * w * 0.2, h * 0.8, 0], 0.18 * s);
      }
      b.beam("woodDark", [-w * 0.5, h * 0.82, 0], [w * 0.5, h * 0.82, 0], 0.4 * s, 0.35 * s);
      if (style === "nordic") {
        for (const sx of [-1, 1]) b.tube("wood", [[sx * w * 0.5, h * 0.82, 0], [sx * w * 0.56, h * 0.92, 0], [sx * w * 0.5, h, 0], [sx * w * 0.44, h * 0.96, 0]], 0.12 * s, 6, 16);
      }
      gableRootlet(b, w * 0.5, h * 0.84, h * 0.14, s);
      return;
    }
    case "modern":
    case "industrial": {
      const pts: V3[] = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const x = (t - 0.5) * w * 0.9;
        pts.push([x, h * (1 - Math.pow((2 * x) / (w * 0.9), 2)), 0]);
      }
      b.tube("metal", pts, 0.35 * s, 10, 60);
      return;
    }
    case "futuristic": {
      const ring = new THREE.TorusGeometry(h * 0.44, 0.45 * s, 10, 40);
      b.add("trim", ring, xform(0, h * 0.5, 0));
      b.add("glow", new THREE.TorusGeometry(h * 0.44, 0.12 * s, 6, 40), xform(0, h * 0.5, 0.42 * s));
      b.blk("trim", -w * 0.35, 0, -d * 0.4, w * 0.35, 0.3 * s, d * 0.4);
      return;
    }
    default: {
      // classical / medieval triumphal arch: arched slab, engaged columns, entablature and attic
      const ow = w * 0.42;
      archedSlab(b, "main", w, h * 0.74, ow, h * 0.6, d, -d / 2, style === "medieval" ? "pointed" : "round");
      b.blk("trim", -w / 2 - 0.1 * s, 0, -d / 2 - 0.1 * s, w / 2 + 0.1 * s, 0.5 * s, d / 2 + 0.1 * s);
      if (style === "classical") {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) column(b, columnKindFor("classical", 1), sx * (ow / 2 + w * 0.13), 0.5 * s, sz * (d / 2 + 0.35 * s), h * 0.68, 0.32 * s, "trim");
      }
      b.rectLoft("trim", 0, 0, w / 2, d / 2, [
        { o: 0, y: h * 0.74 },
        { o: 0.15 * s, y: h * 0.76 },
        { o: 0.35 * s, y: h * 0.8 },
        { o: 0, y: h * 0.8 },
      ], { capTop: false });
      b.blk("main", -w * 0.46, h * 0.8, -d * 0.44, w * 0.46, h, d * 0.44);
      for (let i = 0; i < 3; i++) b.quad("dark", 0, h * 0.94 - i * 0.07 * h, d * 0.44 + 0.01, w * 0.6 - i * 0.1 * w, 0.03 * h);
      return;
    }
  }
}

function gableRootlet(b: GeoBuilder, hw: number, y: number, rise: number, s: number) {
  b.prism("thatch", [[-hw - 0.3 * s, 0], [hw + 0.3 * s, 0], [0, rise]], 1.0 * s, xform(0, y, -0.5 * s));
}

// ------------------------------------------------------------------------------------------------ statue

export function statue(c: Ctx) {
  const { b, r, h, style, s } = c;
  // pedestal: plinth, die and cornice
  const pw = r * 0.62;
  const ph = h * 0.3;
  b.rectLoft("trim", 0, 0, pw, pw, [
    { o: 0.12 * s, y: -0.3 },
    { o: 0.12 * s, y: 0.25 * s },
    { o: 0, y: 0.35 * s },
    { o: 0, y: ph - 0.35 * s },
    { o: 0.12 * s, y: ph - 0.2 * s },
    { o: 0.12 * s, y: ph },
  ]);
  if (style === "ancient_egypt") {
    b.with(xform(0, 0, pw + 0.12 * s + 0.005), () => glyphColumn(b, c.rng, 0.4 * s, ph - 0.4 * s, pw * 0.5));
  } else for (let i = 0; i < 3; i++) b.quad("dark", 0, ph * 0.6 - i * 0.18 * s, pw + 0.005, pw * 1.2 - i * 0.2 * s, 0.05 * s);
  const figH = h - ph;
  const slot = style === "futuristic" || c.matClass === "metal" ? "trim" : c.material === "gold" ? "gold" : "main";
  b.at(0, ph, 0, 0, () => statueFigure(b, style, figH, slot));
}

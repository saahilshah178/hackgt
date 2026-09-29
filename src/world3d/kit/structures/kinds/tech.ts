import * as THREE from "three";
import { chamferLoop, xform, type V2 } from "../geom";
import type { Ctx } from "../model";
import { crate, doorway, windowOn } from "../parts";
import { roughStone } from "./monuments";

/*
 * Machines, labs and the natural set piece: windmill (sails are a spin mover), research_station, greenhouse and
 * cave_mouth. The windmill is a tower mill (or a Mediterranean mill with cloth sails in warm styles, a three-bladed turbine
 * in modern ones); the research station is a cluster of pressurised modules on legs with antennas and a dish; the cave is
 * a jittered rock mass with a dark mouth and teeth of rock.
 */

// ------------------------------------------------------------------------------------------------ windmill

export function windmill(c: Ctx) {
  const { b, style, r, h, s } = c;
  if (style === "modern" || style === "industrial" || style === "futuristic") {
    // a three-bladed wind turbine
    const hubY = h * 0.78;
    b.blk("trim", -r * 0.5, -0.3, -r * 0.5, r * 0.5, 0.4 * s, r * 0.5);
    b.cyl("trim", 0, 0.4 * s, 0, 0.9 * s, 0.45 * s, hubY - 0.4 * s, 16);
    b.box("trim", 0, hubY, -0.3 * s, 1.1 * s, 1.1 * s, 2.8 * s);
    c.mover("spin", [0, hubY, 1.2 * s], [0, 0, 1], true, (mb) => {
      mb.sphere("trim", 0, hubY, 1.3 * s, 0.6 * s, 0.6 * s, 0.9 * s, 12, 8);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        const L = h * 0.3;
        mb.with(xform(0, hubY, 1.4 * s, 0, 0, a), () => {
          mb.loft("trim", [
            { c: [0, 0.5 * s, 0], w: 0.35 * s, h: 0.12 * s, n: 2 },
            { c: [0, L * 0.25, 0], w: 0.55 * s, h: 0.1 * s, n: 2 },
            { c: [0, L, 0], w: 0.12 * s, h: 0.04 * s, n: 2 },
          ], { radial: 8, capEnd: true, up: [0, 0, 1] });
        });
      }
    }, 0.9);
    if (style === "futuristic") b.add("glow", new THREE.TorusGeometry(0.62 * s, 0.05 * s, 4, 16), xform(0, hubY * 0.5, 0, 0, Math.PI / 2));
    return;
  }
  const warm = style === "ancient_egypt" || style === "classical" || style === "mesoamerican";
  // tower body: a tapering round stone (or timber-clad) mill
  const r0 = r * 0.62;
  const r1 = r * 0.45;
  const bodyH = h * 0.62;
  const timber = style === "nordic" || style === "rustic" || c.matClass === "timber";
  if (timber) {
    b.polyLoft("wood", chamferLoop(0, 0, r0, r0, r0 * 0.42), [
      { o: 0.2 * s, y: -0.3 },
      { o: 0.2 * s, y: 0.8 * s },
      { o: 0, y: 0.9 * s },
      { o: -(r0 - r1), y: bodyH },
    ]);
    for (let i = 1; i < 6; i++) b.polyLoft("woodDark", chamferLoop(0, 0, r0, r0, r0 * 0.42), [
      { o: -(r0 - r1) * ((i * bodyH) / 6 / bodyH) + 0.04, y: (i * bodyH) / 6 - 0.08 * s },
      { o: -(r0 - r1) * ((i * bodyH) / 6 / bodyH) + 0.04, y: (i * bodyH) / 6 },
    ], { capTop: false });
  } else b.lathe(warm ? "trim" : "main", 0, 0, 0, [[r0 + 0.2 * s, -0.3], [r0 + 0.2 * s, 0.5 * s], [r0, 0.6 * s], [r1, bodyH], [0.001, bodyH]], 22);
  doorway(b, style === "ancient_egypt" ? "rustic" : style, 0, 0, r0 - 0.08, 1.1 * s, 2.1 * s, { arch: !warm });
  for (let i = 0; i < 3; i++) b.at(0, 0, 0, 1.2 + i * 1.9, () => windowOn(b, warm ? "rustic" : style, 0, bodyH * (0.35 + i * 0.18), r0 - (r0 - r1) * (0.35 + i * 0.18) + 0.03, 0.45 * s, 0.7 * s));
  // cap
  const capY = bodyH;
  if (warm) b.lathe("thatch", 0, capY, 0, [[r1 + 0.35 * s, 0], [r1 * 0.6, r1 * 0.9], [0.001, r1 * 1.3]], 18);
  else {
    b.lathe("roof", 0, capY, 0, [[r1 + 0.3 * s, 0], [r1 + 0.3 * s, 0.4 * s], [r1 * 0.75, r1 * 0.8], [0.001, r1 * 1.05]], 18);
    b.box("wood", 0, capY + 0.8 * s, -r1 - 1.0 * s, 0.2 * s, 0.2 * s, 2.6 * s, 0, 0.5);
  }
  // sails (spin mover about local z at the windshaft)
  const hubY = capY + r1 * 0.35;
  const hubZ = r1 + 0.5 * s;
  b.rod("wood", [0, hubY, 0], [0, hubY, hubZ + 0.1 * s], 0.18 * s, 0.18 * s, 8);
  const sailLen = Math.min(h * 0.4, r * 0.98);
  c.mover("spin", [0, hubY, hubZ], [0, 0, 1], true, (mb) => {
    mb.cyl("woodDark", 0, hubY, hubZ - 0.1 * s, 0.3 * s, 0.3 * s, 0.4 * s, 10, 0, Math.PI / 2);
    const n = warm ? 6 : 4;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + 0.3;
      mb.with(xform(0, hubY, hubZ + 0.25 * s, 0, 0, a), () => {
        mb.beam("wood", [0, 0, 0], [0, sailLen, 0], 0.16 * s, 0.12 * s);
        if (warm) {
          // triangular cloth sail between this spar and a rope
          mb.sheet("sail", [
            [
              [0.02, sailLen * 0.15, 0.02],
              [0.02, sailLen * 0.55, 0.02],
              [0.02, sailLen, 0.02],
            ],
            [
              [sailLen * 0.3, sailLen * 0.2, 0.15 * s],
              [sailLen * 0.28, sailLen * 0.55, 0.12 * s],
              [0.04, sailLen * 0.98, 0.02],
            ],
          ], true);
        } else {
          // lattice sail frame with cloth
          const w = sailLen * 0.22;
          for (let i = 1; i <= 7; i++) mb.beam("wood", [-0.05 * s, sailLen * (0.2 + i * 0.1), 0.05], [w, sailLen * (0.2 + i * 0.1), 0.05], 0.05 * s);
          mb.beam("wood", [w, sailLen * 0.28, 0.05], [w, sailLen * 0.98, 0.05], 0.06 * s);
          mb.box("sail", w / 2, sailLen * 0.62, 0.1, w * 0.95, sailLen * 0.66, 0.02);
        }
      });
    }
  }, 0.55);
}

// ------------------------------------------------------------------------------------------------ research station

export function researchStation(c: Ctx) {
  const { b, r, h, s, style } = c;
  const futur = style === "futuristic";
  const hullSlot = futur ? "trim" : "trim";
  // modules: horizontal cylinders on legs
  const mods: [number, number, number, number][] = [
    [0, 0, r * 0.9, 1.6 * s],
    [-r * 0.45, -r * 0.55, r * 0.5, 1.4 * s],
    [r * 0.5, -r * 0.5, r * 0.55, 1.4 * s],
  ];
  mods.forEach(([x, z, len, rad], i) => {
    const yaw = i === 0 ? 0 : Math.PI / 2;
    const y = 1.2 * s + rad;
    b.at(x, 0, z, yaw, () => {
      b.cyl(hullSlot, -len / 2, y, 0, rad, rad, len, 20, 0, 0, -Math.PI / 2);
      for (const sx of [-1, 1]) b.sphere(hullSlot, sx * len / 2, y, 0, 0.35 * rad, rad, rad, 12, 10);
      for (let k = 0; k < 3; k++) b.add("metal", new THREE.TorusGeometry(rad + 0.02, 0.05 * s, 4, 20), xform(-len / 2 + (len * (k + 1)) / 4, y, 0, Math.PI / 2));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.rod("metal", [sx * len * 0.35, 0, sz * rad * 0.8], [sx * len * 0.3, y - rad * 0.6, sz * rad * 0.4], 0.07 * s);
      for (let k = -2; k <= 2; k++) b.at(k * len * 0.18, y + rad * 0.15, rad * 0.98, 0, () => b.quad(futur ? "glow" : "glass", 0, 0, 0.02, 0.5 * s, 0.35 * s));
      b.quad("dark", len / 2 + 0.36 * rad, y - rad * 0.2, 0, 0.8 * s, 1.5 * s, Math.PI / 2);
    });
  });
  // connecting tunnel, antennas, a dish, solar panels and a beacon
  b.cyl("metal", 0, 1.2 * s + 1.4 * s, -r * 0.5, 0.6 * s, 0.6 * s, r * 0.5, 10, 0, Math.PI / 2);
  b.rod("metal", [r * 0.3, 1.2 * s + 3.2 * s, 0], [r * 0.3, h * 1.1, 0], 0.05 * s);
  b.rod("metal", [-r * 0.2, 1.2 * s + 3.2 * s, 0], [-r * 0.2, h * 0.9, 0], 0.04 * s);
  b.sphere("glow", r * 0.3, h * 1.1, 0, 0.12 * s);
  b.at(-r * 0.75, 0, r * 0.35, 0.6, () => {
    b.rod("metal", [0, 0, 0], [0, 2.4 * s, 0], 0.12 * s);
    b.add("metal", new THREE.SphereGeometry(1.4 * s, 16, 6, 0, Math.PI * 2, 0, 0.9), xform(0, 3.4 * s, 0, 0, -0.8, 0));
  });
  for (let i = 0; i < 3; i++) {
    b.at(r * 0.72, 0, r * (0.1 + i * 0.28) - r * 0.1, 0, () => {
      b.rod("metal", [0, 0, 0], [0, 1.2 * s, 0], 0.06 * s);
      b.box("glass", 0, 1.4 * s, 0, 2.0 * s, 0.05 * s, 1.2 * s, 0, 0, -0.5);
      b.box("dark", 0, 1.37 * s, 0, 1.95 * s, 0.04 * s, 1.15 * s, 0, 0, -0.5);
    });
  }
  crate(b, -r * 0.2, 0, r * 0.6, 0.9 * s, 0.3);
  crate(b, r * 0.1, 0, r * 0.7, 0.7 * s, -0.2);
  c.fire(r * 0.3, h * 1.1, 0, 0.3 * s, { light: false, lamp: true });
}

// ------------------------------------------------------------------------------------------------ greenhouse

export function greenhouse(c: Ctx) {
  const { b, r, h, s, style } = c;
  const hx = r * 0.55;
  const hz = r * 0.9;
  const wallH = h * 0.5;
  const frame = style === "rustic" || style === "nordic" || style === "medieval" ? "wood" : "metal";
  b.blk("main2", -hx - 0.1, -0.3, -hz - 0.1, hx + 0.1, 0.5 * s, hz + 0.1);
  b.blk("glass", -hx, 0.5 * s, -hz, hx, wallH, hz);
  // gable glass roof
  const rise = h - wallH;
  for (const sx of [-1, 1]) {
    const len = Math.hypot(hx, rise);
    b.box("glass", (sx * hx) / 2, wallH + rise / 2, 0, len, 0.04, hz * 2, 0, 0, -sx * Math.atan2(rise, hx));
  }
  for (const sz of [-1, 1]) b.prism("glass", [[-hx, 0], [hx, 0], [0, rise]], 0.04, xform(0, wallH, sz * hz - (sz > 0 ? 0.04 : 0)));
  // frame: posts, rafters, ridge, sills
  const n = Math.round((hz * 2) / (1.5 * s));
  for (let i = 0; i <= n; i++) {
    const z = -hz + (i * 2 * hz) / n;
    for (const sx of [-1, 1]) {
      b.blk(frame, sx * hx - 0.06, 0.5 * s, z - 0.05, sx * hx + 0.06, wallH, z + 0.05);
      b.beam(frame, [sx * hx, wallH, z], [0, h, z], 0.08 * s);
    }
  }
  b.beam(frame, [0, h, -hz], [0, h, hz], 0.12 * s);
  for (const sx of [-1, 1]) b.beam(frame, [sx * hx, wallH, -hz], [sx * hx, wallH, hz], 0.1 * s);
  for (let i = 0; i <= 4; i++) for (const sz of [-1, 1]) b.blk(frame, -hx + (i * 2 * hx) / 4 - 0.05, 0.5 * s, sz * hz - 0.05, -hx + (i * 2 * hx) / 4 + 0.05, wallH, sz * hz + 0.05);
  // planters with plants inside
  for (const sx of [-1, 1]) {
    b.blk("woodDark", sx * hx * 0.55 - 0.5 * s, 0.5 * s, -hz * 0.85, sx * hx * 0.55 + 0.5 * s, 1.1 * s, hz * 0.7);
    for (let i = 0; i < 8; i++) {
      const z = -hz * 0.8 + (i * hz * 1.45) / 7;
      b.sphere("foliage", sx * hx * 0.55, 1.4 * s + (i % 3) * 0.15 * s, z, 0.5 * s, 0.45 * s + (i % 2) * 0.2 * s, 0.5 * s, 8, 6);
    }
  }
  b.quad("dark", 0, 0.5 * s + 1.1 * s, hz + 0.03, 1.2 * s, 2.2 * s);
}

// ------------------------------------------------------------------------------------------------ cave mouth

export function caveMouth(c: Ctx) {
  const { b, r, h, s, rng } = c;
  // a rock mass: a jittered dome lathe, open at the front where the dark mouth sits
  const loop: V2[] = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = -(i / n) * Math.PI * 2;
    const k = 0.85 + rng() * 0.25;
    loop.push([Math.cos(a) * r * 0.95 * k, Math.sin(a) * r * 0.8 * k - r * 0.1]);
  }
  b.polyLoft("main", loop, [
    { o: 0, y: -0.6 },
    { o: -r * 0.08, y: h * 0.35 },
    { o: -r * 0.3, y: h * 0.75 },
    { o: -r * 0.6, y: h * 0.95 },
    { o: -r * 0.72, y: h },
  ], { smooth: false });
  // the mouth: a dark arch set into the front face, framed by jutting rocks
  const mw = r * 0.55;
  const mh = h * 0.62;
  const mz = r * 0.52;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI;
    const k = 1 + (rng() - 0.5) * 0.12;
    pts.push(new THREE.Vector2(Math.cos(a) * mw * k, Math.sin(a) * mh * k));
  }
  b.add("dark", new THREE.ShapeGeometry(new THREE.Shape(pts)), xform(0, 0, mz + 0.2 * s, 0, -0.12));
  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * Math.PI;
    const x = Math.cos(a) * (mw + 0.5 * s);
    const y = Math.sin(a) * (mh + 0.3 * s);
    roughStone(b, i % 2 ? "main" : "main2", x, mz + 0.4 * s - y * 0.1, (1.2 + rng()) * s, (1.4 + rng()) * s, Math.max(1.2 * s, y + (0.6 + rng() * 0.8) * s), rng, (rng() - 0.5) * 0.2, a);
  }
  // rock teeth hanging from the lip
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * mw * 0.32;
    b.add("main2", new THREE.ConeGeometry(0.25 * s, (0.6 + rng() * 0.6) * s, 5), xform(x, mh * (0.92 - Math.abs(i - 2) * 0.08), mz + 0.25 * s, 0, 0, Math.PI));
  }
  // boulders around the foot
  for (let i = 0; i < 7; i++) {
    const a = rng() * Math.PI * 2;
    const d = r * (0.75 + rng() * 0.2);
    roughStone(b, "main2", Math.cos(a) * d, Math.sin(a) * d, (0.8 + rng() * 1.2) * s, (0.8 + rng()) * s, (0.5 + rng() * 0.9) * s, rng, 0, rng() * 3);
  }
}

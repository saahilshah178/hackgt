/**
 * tests/art-kit.test.ts — the procedural kit, the lint, the rig and puppets (docs/design/02 §3a.4 "Tests", 20 §7.4).
 *
 * Generators × 3 seeds: well-formed, lint-clean after tokens + engraving, deterministic, anchors inside the viewBox,
 * tileable strips seamless (path crossings at x = 0 equal those at x = w); kit sources free of Math.random/Date; the
 * lint rejects plain <text>, raw hex and external refs; the rig's 7 anchors on every packed pose (hand_r = the hand
 * painted in front); puppet packing and PuppetAnim validation; the stand-in companion plays idle/talk/cue.
 */
import fs from "node:fs";
import path from "node:path";
import { XMLValidator } from "fast-xml-parser";
import { describe, expect, it } from "vitest";
import { AssetManifest, PuppetAnim } from "../src/contracts/world";
import { KIT, KIT_NAMES, runKit, type KitName, type KitResult } from "../src/game/art/kit/index";
import { expandRecipe, RECIPES } from "../src/game/art/kit/recipes";
import { reprefixIds, splitDoc } from "../src/game/art/kit/svg";
import { resolveTokens } from "../src/game/art/kit/tokens";
import { BIOME_PALETTES, paletteTokensFor, tokenNumber, UI_TOKENS } from "../src/game/art/palette";
import { sampleAnim } from "../src/game/expedition/puppets/anim";
import { engraveSvg, injectRequests } from "../scripts/art/engrave";
import { defaultRasterScale, outputPathOf } from "../scripts/art/fragments";
import { lintOutput, lintSource } from "../scripts/art/lint";
import { packPuppet, validateAnims, type PartSpec } from "../scripts/art/puppet";
import { analyseRig, BodiesFile, CharactersFile, frameAnchors, loadBody, parseSheetXml, PROTAGONIST_POSES, RIG_ANCHORS } from "../scripts/art/rig";
import { apply, attrsOf, childrenOf, IDENTITY, multiply, parseTransform, parseXml, tagOf, type Matrix, type XNode } from "../scripts/art/svgx";

const ROOT = path.resolve(import.meta.dirname, "..");
const PALETTE = BIOME_PALETTES.orrery_terraces;
const SEEDS = [1, 2025, 4_000_000_001];

/** Tokens → engraving → lint: what `art:build` does to a generator's output (minus minify). */
function finish(res: KitResult, key: string): { svg: string; issues: string[] } {
  const src = lintSource(res.svg).map((i) => i.message);
  const { svg: resolved, problems } = resolveTokens(injectRequests(res.svg, res.engrave), PALETTE);
  const { svg } = engraveSvg(resolved, key);
  return { svg, issues: [...src, ...problems, ...lintOutput(svg, { layer: true }).map((i) => `[${i.rule}] ${i.message}`)] };
}

// ── a tiny SVG flattener: every drawn segment in document space (for the seamless-edge check) ──────────────
type Seg = [number, number, number, number];
function arcPoints(x0: number, y0: number, rx: number, ry: number, rotDeg: number, large: boolean, sweep: boolean, x: number, y: number): Array<[number, number]> {
  if (rx === 0 || ry === 0) return [[x, y]];
  const phi = (rotDeg * Math.PI) / 180;
  const [cp, sp] = [Math.cos(phi), Math.sin(phi)];
  const dx = (x0 - x) / 2;
  const dy = (y0 - y) / 2;
  const x1 = cp * dx + sp * dy;
  const y1 = -sp * dx + cp * dy;
  let [a, b] = [Math.abs(rx), Math.abs(ry)];
  const lam = (x1 * x1) / (a * a) + (y1 * y1) / (b * b);
  if (lam > 1) [a, b] = [a * Math.sqrt(lam), b * Math.sqrt(lam)];
  const sign = large === sweep ? -1 : 1;
  const num = a * a * b * b - a * a * y1 * y1 - b * b * x1 * x1;
  const co = sign * Math.sqrt(Math.max(0, num / (a * a * y1 * y1 + b * b * x1 * x1)));
  const cx1 = (co * a * y1) / b;
  const cy1 = (-co * b * x1) / a;
  const cx = cp * cx1 - sp * cy1 + (x0 + x) / 2;
  const cy = sp * cx1 + cp * cy1 + (y0 + y) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1 - cx1) / a, (y1 - cy1) / b);
  let dt = ang((x1 - cx1) / a, (y1 - cy1) / b, (-x1 - cx1) / a, (-y1 - cy1) / b);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const pts: Array<[number, number]> = [];
  for (let i = 1; i <= 16; i++) {
    const t = t1 + (dt * i) / 16;
    pts.push([cx + a * Math.cos(t) * cp - b * Math.sin(t) * sp, cy + a * Math.cos(t) * sp + b * Math.sin(t) * cp]);
  }
  return pts;
}
function flattenPath(d: string): Array<Array<[number, number]>> {
  const toks = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const polys: Array<Array<[number, number]>> = [];
  let cur: Array<[number, number]> = [];
  let [x, y, sx, sy] = [0, 0, 0, 0];
  let cmd = "";
  let i = 0;
  let lastC: [number, number] | null = null;
  const num = () => Number(toks[i++]);
  const cubic = (x1: number, y1: number, x2: number, y2: number, ex: number, ey: number) => {
    for (let k = 1; k <= 8; k++) {
      const t = k / 8;
      const m = 1 - t;
      cur.push([m * m * m * x + 3 * m * m * t * x1 + 3 * m * t * t * x2 + t * t * t * ex, m * m * m * y + 3 * m * m * t * y1 + 3 * m * t * t * y2 + t * t * t * ey]);
    }
    lastC = [x2, y2];
    [x, y] = [ex, ey];
  };
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    if (C === "Z") {
      cur.push([sx, sy]);
      [x, y] = [sx, sy];
      polys.push(cur);
      cur = [];
      continue;
    }
    if (C === "M") {
      if (cur.length) polys.push(cur);
      [x, y] = [ox + num(), oy + num()];
      [sx, sy] = [x, y];
      cur = [[x, y]];
      cmd = rel ? "l" : "L";
      lastC = null;
    } else if (C === "L") {
      [x, y] = [ox + num(), oy + num()];
      cur.push([x, y]);
    } else if (C === "H") {
      x = (rel ? x : 0) + num();
      cur.push([x, y]);
    } else if (C === "V") {
      y = (rel ? y : 0) + num();
      cur.push([x, y]);
    } else if (C === "C") cubic(ox + num(), oy + num(), ox + num(), oy + num(), ox + num(), oy + num());
    else if (C === "S") {
      const [rx1, ry1]: [number, number] = lastC ? [2 * x - lastC[0], 2 * y - lastC[1]] : [x, y];
      cubic(rx1, ry1, ox + num(), oy + num(), ox + num(), oy + num());
    } else if (C === "Q") {
      const [qx, qy, ex, ey] = [ox + num(), oy + num(), ox + num(), oy + num()];
      cubic(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey);
    } else if (C === "T") {
      [x, y] = [ox + num(), oy + num()];
      cur.push([x, y]);
    } else if (C === "A") {
      const [rx, ry, rot, la, sw, ex, ey] = [num(), num(), num(), num(), num(), ox + num(), oy + num()];
      cur.push(...arcPoints(x, y, rx, ry, rot, la === 1, sw === 1, ex, ey));
      [x, y] = [ex, ey];
    } else i++;
  }
  if (cur.length) polys.push(cur);
  return polys;
}
function segmentsOf(svg: string): Array<{ paint: string; seg: Seg }> {
  const doc = parseXml(svg);
  const byId = new Map<string, XNode>();
  const index = (nodes: XNode[]) => {
    for (const n of nodes) {
      const id = attrsOf(n).id;
      if (id) byId.set(id, n);
      index(childrenOf(n));
    }
  };
  index(doc);
  const out: Array<{ paint: string; seg: Seg }> = [];
  const SKIP = new Set(["defs", "clipPath", "mask", "pattern", "linearGradient", "radialGradient", "filter"]);
  const visit = (nodes: XNode[], m: Matrix, paint: string) => {
    for (const n of nodes) {
      const tag = tagOf(n);
      if (!tag || SKIP.has(tag)) continue;
      const a = attrsOf(n);
      const mm = a.transform ? multiply(m, parseTransform(a.transform)) : m;
      const p = `${a.fill ?? paint.split("|")[0]}|${a.stroke ?? paint.split("|")[1] ?? ""}`;
      if (tag === "use") {
        const ref = byId.get((a.href ?? a["xlink:href"] ?? "").slice(1));
        if (ref) visit([ref], mm, p);
        continue;
      }
      let polys: Array<Array<[number, number]>> = [];
      if (tag === "path" && a.d) polys = flattenPath(a.d);
      else if (tag === "rect") {
        const [rx, ry, rw, rh] = [+(a.x ?? 0), +(a.y ?? 0), +a.width, +a.height];
        polys = [[[rx, ry], [rx + rw, ry], [rx + rw, ry + rh], [rx, ry + rh], [rx, ry]]];
      } else if (tag === "ellipse" || tag === "circle") {
        const [cx, cy, rx, ry] = [+(a.cx ?? 0), +(a.cy ?? 0), +(a.rx ?? a.r), +(a.ry ?? a.r)];
        polys = [Array.from({ length: 33 }, (_, k) => [cx + rx * Math.cos((k / 32) * 2 * Math.PI), cy + ry * Math.sin((k / 32) * 2 * Math.PI)] as [number, number])];
      }
      for (const poly of polys)
        for (let k = 1; k < poly.length; k++) {
          const [x1, y1] = apply(mm, poly[k - 1][0], poly[k - 1][1]);
          const [x2, y2] = apply(mm, poly[k][0], poly[k][1]);
          out.push({ paint: p, seg: [x1, y1, x2, y2] });
        }
      visit(childrenOf(n), mm, p);
    }
  };
  const root = doc.find((n) => tagOf(n) === "svg")!;
  visit(childrenOf(root), IDENTITY, "|");
  return out;
}
function crossings(segs: Array<{ paint: string; seg: Seg }>, X: number): string[] {
  const out: string[] = [];
  for (const { paint, seg } of segs) {
    const [x1, y1, x2, y2] = seg;
    const [a, b] = [x1 - X, x2 - X];
    if (Math.abs(a) > 1e-6 && Math.abs(b) > 1e-6 && a * b < 0) {
      const t = (X - x1) / (x2 - x1);
      out.push(`${paint}@${Math.round((y1 + t * (y2 - y1)) * 2) / 2}`);
    }
  }
  return out.sort();
}

describe("the procedural kit", () => {
  it("registers exactly the 31 generators of 02 §3a.2", () => {
    expect(KIT_NAMES).toHaveLength(31);
    expect(Object.keys(KIT).sort()).toEqual([...KIT_NAMES].sort());
    for (const [name, g] of Object.entries(KIT)) {
      expect(g.name).toBe(name);
      expect(() => g.schema.parse(g.defaults), name).not.toThrow();
    }
  });

  it.each(KIT_NAMES.map((n) => [n]))("%s × 3 seeds: well-formed, lint-clean, deterministic, anchors inside", (name) => {
    for (const seed of SEEDS) {
      const a = runKit(name as KitName, {}, seed);
      const b = runKit(name as KitName, {}, seed);
      expect(a.svg, `${name}@${seed} determinism`).toBe(b.svg);
      expect(XMLValidator.validate(a.svg), `${name}@${seed} xml`).toBe(true);
      expect(a.svg).toMatch(new RegExp(`^<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 [\\d.]+ [\\d.]+" width="[\\d.]+" height="[\\d.]+">`));
      const { issues } = finish(a, `test.kit.${name.toLowerCase()}`);
      expect(issues, `${name}@${seed}`).toEqual([]);
      for (const [anchor, [x, y]] of Object.entries(a.anchors)) {
        expect(anchor).toMatch(/^[a-z][a-z0-9_]{0,47}$/);
        expect(x, `${name} anchor ${anchor}.x`).toBeGreaterThanOrEqual(-1);
        expect(x, `${name} anchor ${anchor}.x`).toBeLessThanOrEqual(a.w + 1);
        expect(y, `${name} anchor ${anchor}.y`).toBeGreaterThanOrEqual(-1);
        expect(y, `${name} anchor ${anchor}.y`).toBeLessThanOrEqual(a.h + 1);
      }
      expect(a.pivot[0]).toBeGreaterThanOrEqual(0);
      expect(a.pivot[1]).toBeLessThanOrEqual(1);
    }
  });

  it("different seeds give different art where the generator is randomised", () => {
    for (const name of ["ridgeBand", "cloudBand", "canopy", "crystalCluster", "ashlarWall", "grainTile", "scatter"] as const) {
      expect(runKit(name, {}, 1).svg, name).not.toBe(runKit(name, {}, 2).svg);
    }
  });

  it("tileable strips are seamless: shapes crossing x = 0 match those crossing x = w", () => {
    const cases: Array<[KitName, unknown]> = [
      ["skyWash", {}],
      ["cloudBand", {}],
      ["cloudBand", { style: "puff" }],
      ["ridgeBand", {}],
      ["ridgeBand", { style: "dome" }],
      ["skyline", {}],
      ["brickWall", {}],
      ["ashlarWall", {}],
      ["railing", {}],
      ["waterBand", {}],
      ["bilayerTile", {}],
      ["lipidColonnade", { w: 1024 }],
      ["groundStrip", {}],
      ["groundStrip", { style: "brick_plaza", grassEdge: { lit: "grass.light", base: "grass.base", shade: "grass.shade" } }],
      ["groundStrip", { style: "wood_floor" }],
      ["groundStrip", { style: "causeway" }],
      ["groundStrip", { style: "marble", wet: true }],
      ["cloudBand", { style: "swirl", under: "sky.dusk.mid" }],
      ["ridgeBand", { style: "mesa" }],
      ["ridgeBand", { style: "bluff" }],
      ["ridgeBand", { style: "cell_dome", rimLine: "gold.base" }],
      ["railing", { style: "wrought_iron" }],
      ["railing", { style: "rope_stanchion" }],
      ["waterBand", { style: "falls", w: 256, h: 512 }],
      ["bilayerTile", { variant: "gel" }],
      ["bilayerTile", { variant: "hall_deck" }],
      ["grainTile", { style: "grain" }],
      ["grainTile", { style: "caustics" }],
      ["grainTile", { style: "leaf_dapple" }],
      ["hexGridPanel", {}],
      ["scatter", { w: 1024, tileWidth: 1024, h: 300, band: [280, 300], minGap: 90, item: { gen: "crystalCluster", params: { w: 120, h: 180 } } }],
      ["compose", { w: 800, h: 300, tileWidth: 800, items: [{ gen: "column", params: { h: 280 }, seed: 3, x: 780, y: 300, scale: 1, flip: false, alpha: 1 }, { gen: "canopy", params: {}, seed: 4, x: 20, y: 300, scale: 0.8, flip: true, alpha: 1 }] }],
    ];
    for (const [name, params] of cases) {
      for (const seed of SEEDS.slice(0, 2)) {
        const res = runKit(name, params, seed);
        expect(res.tileWidth, `${name} tileWidth`).not.toBeNull();
        const W = res.tileWidth!;
        const segs = segmentsOf(res.svg);
        expect(crossings(segs, 0), `${name}@${seed} left edge vs right edge`).toEqual(crossings(segs, W));
      }
    }
  });

  it("kit sources are pure: no Math.random, Date, fs or DOM", () => {
    const dir = path.join(ROOT, "src/game/art/kit");
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
      const src = fs.readFileSync(path.join(dir, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(src, f).not.toMatch(/Math\.random|\bDate\b|from "node:|from "fs"|(?<![.\w])document\.|(?<![.\w])window\./);
    }
  });

  it("recipes expand: glass_tank, the default zone preset per biome and layer, the stand-in companion", () => {
    expect(Object.keys(RECIPES).sort()).toEqual(["companion_standin", "default_zone", "glass_tank"]);
    const tank = expandRecipe("glass_tank", {});
    expect(tank.kind).toBe("svg");
    if (tank.kind === "svg") {
      const res = runKit(tank.gen, tank.params, 7);
      const { svg, problems } = resolveTokens(res.svg, BIOME_PALETTES.living_gate);
      expect(problems).toEqual([]);
      expect(lintOutput(svg)).toEqual([]);
    }
    for (const biome of ["orrery_terraces", "living_gate", "archive_of_voices"] as const) {
      for (const layer of ["sky", "clouds", "far", "midfar", "mid", "fore", "surface", "underside"] as const) {
        const r = expandRecipe("default_zone", { biome, layer });
        expect(r.kind).toBe("svg");
        if (r.kind !== "svg") continue;
        const res = runKit(r.gen, r.params, 11);
        const { svg, problems } = resolveTokens(injectRequests(res.svg, res.engrave), BIOME_PALETTES[biome]);
        expect(problems, `${biome}/${layer}`).toEqual([]);
        expect(lintOutput(engraveSvg(svg).svg, { layer: true }), `${biome}/${layer}`).toEqual([]);
      }
    }
    expect(() => expandRecipe("nope", {})).toThrow(/unknown recipe/);
  });

  it("re-prefixes ids and their references so compositions never collide", () => {
    const s = '<svg><defs><linearGradient id="a"/><filter id="b"/></defs><path fill="url(#a)" filter="url(#b)"/><use href="#a"/></svg>';
    const r = reprefixIds(s, "k1_");
    expect(r).toContain('id="k1_0"');
    expect(r).toContain('fill="url(#k1_0)"');
    expect(r).toContain('filter="url(#k1_1)"');
    expect(r).toContain('href="#k1_0"');
  });
});

describe("tokens and palette", () => {
  it("resolves tokens, modifiers and rgba tokens to hex + opacity (never rgba() in paint)", () => {
    const { svg, problems } = resolveTokens('<svg><path fill="{{ui.panel}}" fill-opacity="0.5" stroke="{{stone.lit|haze:0.5}}"/><stop stop-color="{{shadow|alpha:0.3}}"/></svg>', PALETTE);
    expect(problems).toEqual([]);
    expect(svg).toContain('fill="#265C6A"');
    expect(svg).toContain('fill-opacity="0.43"');
    expect(svg).toMatch(/stroke="#FDF8EF"/);
    expect(svg).toContain('stop-opacity="0.3"');
    expect(svg).not.toMatch(/rgba\(/);
    expect(resolveTokens('<svg><path fill="{{no.such}}"/></svg>', PALETTE).problems[0]).toMatch(/unknown token "no.such"/);
    expect(resolveTokens('<svg><text>{{stone.lit}}</text></svg>', PALETTE).problems.length).toBeGreaterThan(0);
  });
  it("assembles palettes: shared under each biome, UI tokens identical everywhere", () => {
    expect(UI_TOKENS["ui.accent"]).toBe("#E2892C");
    for (const ns of ["orrery_terraces", "living_gate", "archive_of_voices"] as const) {
      for (const [k, v] of Object.entries(UI_TOKENS)) expect(BIOME_PALETTES[ns][k], `${ns} ${k}`).toBe(v);
      expect(BIOME_PALETTES[ns]["char.key_light"]).toBeDefined();
    }
    expect(paletteTokensFor("gen_abc")).toBe(paletteTokensFor("shared"));
    expect(tokenNumber("orrery_terraces", "gold.base")).toBe(0xd9a441);
    expect(tokenNumber("orrery_terraces", "no.such", 0x123456)).toBe(0x123456);
  });
});

describe("the lint", () => {
  it("rejects plain <text>, raw hex and external refs; accepts clean output", () => {
    expect(lintOutput('<svg xmlns="http://www.w3.org/2000/svg"><text x="1">π</text></svg>').map((i) => i.rule)).toContain("text");
    expect(lintSource('<svg><path fill="#FF0000"/></svg>').map((i) => i.rule)).toEqual(["raw-hex"]);
    expect(lintSource('<svg><!-- raw-ok --><path fill="#FF0000"/><!-- /raw-ok --><path fill="url(#abc)"/><use href="#fade"/></svg>')).toEqual([]);
    const ext = lintOutput('<svg xmlns="http://www.w3.org/2000/svg"><image href="x.png"/><use href="other.svg#a"/><path fill="url(http://x/y)"/></svg>').map((i) => i.rule);
    expect(ext).toEqual(expect.arrayContaining(["image", "external-ref"]));
    expect(lintOutput('<svg xmlns="http://www.w3.org/2000/svg"><style>a{}</style><path class="x" onclick="a()"/></svg>').map((i) => i.rule)).toEqual(expect.arrayContaining(["style", "event"]));
    expect(lintOutput('<svg xmlns="http://www.w3.org/2000/svg"><filter id="f"><feOffset dx="1"/></filter></svg>').map((i) => i.rule)).toContain("filter");
    expect(lintOutput('<svg xmlns="http://www.w3.org/2000/svg"><filter id="f"><feGaussianBlur stdDeviation="2"/></filter><path d="M0 0L1 1" fill="#FFFFFF"/></svg>')).toEqual([]);
    expect(lintOutput(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${"M0 0".repeat(20000)}"/></svg>`).map((i) => i.rule)).toContain("size");
    expect(lintOutput("<svg><path></svg>").map((i) => i.rule)).toContain("xml");
  });
  it("maps keys to output paths and group raster defaults (20 §5.1)", () => {
    expect(outputPathOf("orrery_terraces.part.ring_gate_outer_ring")).toBe("orrery_terraces/part/ring_gate_outer_ring.svg");
    expect(outputPathOf("living_gate.layer.tide.b")).toBe("living_gate/layer/tide.b.svg");
    expect(outputPathOf("shared.companion.cog", ".rest.svg")).toBe("shared/companion/cog.rest.svg");
    expect(defaultRasterScale("x.layer.far", "ridgeBand", "svg", 2048, 600)).toBe(0.75);
    expect(defaultRasterScale("x.layer.clouds", "cloudBand", "svg", 2048, 200)).toBe(0.5);
    expect(defaultRasterScale("x.part.fin", "plate", "svg", 200, 300)).toBe(1.5);
    expect(defaultRasterScale("x.part.wall", "ashlarWall", "svg", 900, 760)).toBe(1);
    expect(defaultRasterScale("x.prop.tower", "column", "svg", 500, 900)).toBe(1);
    expect(defaultRasterScale("x.companion.cog", null, "puppet", 64, 60)).toBe(1.5);
  });
});

describe("puppets", () => {
  const standin = expandRecipe("companion_standin", {});
  it("the stand-in companion packs: ≤ 8 parts, boxes on the 4-unit grid, pivots inside boxes", () => {
    expect(standin.kind).toBe("puppet");
    if (standin.kind !== "puppet") return;
    const parts: PartSpec[] = standin.parts.map((p, i) => {
      const res = runKit(p.from[0].gen, p.from[0].params, 100 + i);
      const { defs, body } = splitDoc(reprefixIds(resolveTokens(res.svg, PALETTE).svg, `p${i}_`));
      return { name: p.name, z: p.z, frames: [{ defs, inner: body, vb: [-2, -2, res.w + 4, res.h + 4] }], pivotLocal: [p.pivot[0] * res.w, p.pivot[1] * res.h], rest: p.rest };
    });
    const packed = packPuppet(parts);
    expect(packed.parts).toHaveLength(8);
    for (const p of packed.parts) {
      for (const v of p.box) expect(v % 4, `${p.name} box`).toBe(0);
      expect(p.pivot[0]).toBeGreaterThanOrEqual(0);
      expect(p.pivot[0]).toBeLessThanOrEqual(1);
    }
    expect(XMLValidator.validate(packed.sheet)).toBe(true);
    expect(lintOutput(packed.sheet)).toEqual([]);
    const anims = validateAnims(standin.anims, packed.parts, "companion", "shared.companion.guide_standin");
    expect(anims.map((a) => a.id)).toEqual(["idle", "talk", "cue"]);
    // idle bobs the body; cue flares the eye glow
    const names = packed.parts.map((p) => ({ name: p.name, frames: p.frames }));
    const a = sampleAnim(anims[0], 0, names).body.y;
    const b = sampleAnim(anims[0], 300, names).body.y;
    expect(a).not.toBe(b);
    expect(sampleAnim(anims[2], 300, names).eye_glow.scaleX).toBeCloseTo(1.4, 5);
  });
  it("validates anims: known parts, frame indices, required ids per group", () => {
    const parts = [{ name: "body", frames: 1 }, { name: "prop", frames: 2 }];
    const ok = [
      { id: "idle", loop: true, ms: 1000, tracks: [{ part: "body", prop: "y", wave: { amp: 2, hz: 1, phase: 0 }, keys: [] }] },
      { id: "talk", loop: true, ms: 500, tracks: [{ part: "prop", prop: "frame", wave: null, keys: [[0, 0], [250, 1]] }] },
      { id: "cue", loop: false, ms: 600, tracks: [{ part: "body", prop: "alpha", wave: null, keys: [[0, 0.5], [600, 1]] }] },
    ];
    expect(validateAnims(ok, parts, "companion", "k")).toHaveLength(3);
    expect(() => validateAnims(ok.slice(0, 2), parts, "companion", "k")).toThrow(/needs anim "cue"/);
    expect(validateAnims(ok.slice(0, 2), parts, "npc", "k")).toHaveLength(2);
    expect(() => validateAnims([{ ...ok[0], tracks: [{ part: "wing", prop: "rot", wave: { amp: 1, hz: 1, phase: 0 }, keys: [] }] }], parts, "prop", "k")).toThrow(/unknown part "wing"/);
    expect(() => validateAnims([{ ...ok[1], id: "idle", tracks: [{ part: "prop", prop: "frame", wave: null, keys: [[0, 2]] }] }], parts, "prop", "k")).toThrow(/frame 2/);
    expect(() => validateAnims([{ id: "Idle", loop: true, ms: 10, tracks: [] }], parts, "prop", "k")).toThrow();
    expect(PuppetAnim.safeParse(ok[0]).success).toBe(true);
  });
});

// ── the committed rig ────────────────────────────────────────────────────────────────────────────────────────
const sharedManifest = AssetManifest.parse(JSON.parse(fs.readFileSync(path.join(ROOT, "public/assets/expedition/shared/manifest.json"), "utf8")));
const atlases = sharedManifest.entries.filter((e) => e.kind === "atlas");

describe("the rig atlases", () => {
  it("ships 5 atlases (wren, diver, nell, ida, otis) with 7 anchors on every packed pose", () => {
    expect(atlases.map((a) => a.key).sort()).toEqual(["shared.char.diver", "shared.char.ida", "shared.char.nell", "shared.char.otis", "shared.char.wren"]);
    for (const a of atlases) {
      if (a.kind !== "atlas") continue;
      expect(a.poses.length, a.key).toBe(a.key === "shared.char.ida" || a.key === "shared.char.otis" ? 12 : 28);
      expect(a.anchors.map((x) => x.pose)).toEqual(a.poses);
      for (const f of a.anchors) {
        expect(f.points.map((p) => p.name)).toEqual([...RIG_ANCHORS]);
        for (const p of f.points) {
          expect(p.x, `${a.key}/${f.pose}/${p.name}`).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(a.displayWidth);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeLessThanOrEqual(a.displayHeight);
        }
        const feet = f.points.find((p) => p.name === "feet")!;
        expect(Math.abs(feet.y - 127 * 1.75)).toBeLessThan(0.06);
      }
      expect(a.anchors.find((x) => x.pose === "back")?.facing ?? "back").toBe("back");
      expect(a.anchors.find((x) => x.pose === "idle")?.facing).toBe("front");
      const png = fs.readFileSync(path.join(ROOT, "public/assets/expedition", a.image));
      expect(png.readUInt32BE(16), `${a.key} png width`).toBe(a.poses.length === 28 ? 1344 : 1152);
      expect(png.readUInt32BE(20), `${a.key} png height`).toBe(a.poses.length === 28 ? 1024 : 512);
      const json = JSON.parse(fs.readFileSync(path.join(ROOT, "public/assets/expedition", a.frames), "utf8")) as { frames: Record<string, { frame: { w: number; h: number } }> };
      expect(Object.keys(json.frames)).toEqual(a.poses);
      expect(json.frames.idle.frame).toMatchObject({ w: 192, h: 256 });
    }
  });

  it("the untinted Kenney fallback (load.atlasXML) exists and names every pose", () => {
    for (const a of atlases) {
      if (a.kind !== "atlas") continue;
      const xml = fs.readFileSync(path.join(ROOT, "public/assets/expedition", a.fallback.xml), "utf8");
      const names = new Set([...xml.matchAll(/<SubTexture name="([^"]+)"/g)].map((m) => m[1]));
      for (const pose of a.poses) expect(names.has(a.fallback.frameNames[pose]), `${a.key} ${pose}`).toBe(true);
      expect(fs.existsSync(path.join(ROOT, "public/assets/expedition", a.fallback.image))).toBe(true);
    }
  });

  const bodies = BodiesFile.parse(JSON.parse(fs.readFileSync(path.join(ROOT, "art/shared/characters/bodies.json"), "utf8")));
  const zipThere = fs.existsSync(path.join(ROOT, bodies.zip));
  it.skipIf(!zipThere)("anchors are the vector's own transforms: hand_r = the hand painted later (handF), hand_l = handB", () => {
    const src = loadBody(ROOT, bodies, "female_adventurer");
    const rig = analyseRig(src.vector);
    const sheet = parseSheetXml(src.sheetXml);
    const idle = frameAnchors(rig, "idle", sheet.get("idle")!);
    const p = Object.fromEntries(idle.points.map((x) => [x.name, x]));
    // 02 §3b.3 idle: head origin (49.9, 74.2), torso (48.0, 102.0), hands (74.3, 107.9, 0°) then (21.6, 107.9, 180°)
    expect(p.head.x).toBeCloseTo(49.85 * 1.75, 0);
    expect(p.head.y).toBeCloseTo(74.2 * 1.75, 0);
    expect(p.torso.y).toBeCloseTo(102 * 1.75, 0);
    expect(p.hand_r.x).toBeCloseTo(21.6 * 1.75, 0); // painted later = in front
    expect(p.hand_r.rot).toBe(180);
    expect(p.hand_l.x).toBeCloseTo(74.3 * 1.75, 0);
    expect(p.face.y).toBeCloseTo(p.head.y - 20 * 1.75, 1);
    expect(p.back.y).toBeCloseTo(p.torso.y - 18 * 1.75, 1);
    const climb = frameAnchors(rig, "climb0", sheet.get("climb0")!);
    expect(climb.facing).toBe("back");
    // the committed manifest matches a fresh walk
    const wren = atlases.find((a) => a.key === "shared.char.wren");
    if (wren?.kind === "atlas") for (const pose of PROTAGONIST_POSES) expect(wren.anchors.find((x) => x.pose === pose)).toEqual(frameAnchors(rig, pose, sheet.get(pose)!));
    const chars = CharactersFile.parse(JSON.parse(fs.readFileSync(path.join(ROOT, "art/shared/characters/characters.json"), "utf8")));
    expect(chars.characters.map((c) => c.id)).toEqual(["wren", "diver", "nell", "ida", "otis"]);
  });
});

// ── the build, end to end on a temporary art root ────────────────────────────────────────────────────────────
import os from "node:os";
import { buildNamespace, indexSource } from "../scripts/art/build";
import { collectNamespace, FragmentError } from "../scripts/art/fragments";

describe("art:build on a temporary namespace", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "art-build-"));
  const ns = "gen_test";
  const dir = path.join(tmp, "art", ns);
  fs.mkdirSync(path.join(dir, "cast"), { recursive: true });
  fs.writeFileSync(path.join(dir, "biome.json"), JSON.stringify({ paletteId: "living_gate", heroCap: 40, zones: ["z1", "z2"] }));
  // a hero prop with pivot, anchors (inside a transformed group) and engraving
  fs.writeFileSync(
    path.join(dir, "cast", "plaque.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80" data-pivot="0.5,1">
      <rect x="0" y="0" width="120" height="80" fill="{{gold.base}}"/>
      <g transform="translate(10 5)"><circle id="anchor-label" cx="50" cy="30" r="0"/></g>
      <text data-engrave="serif" x="60" y="50" font-size="22" text-anchor="middle" fill="{{inlay.navy}}">π/2</text>
    </svg>`,
  );
  // a hero puppet: two parts (one with 2 frames), boxes given, anims beside it
  fs.writeFileSync(
    path.join(dir, "cast", "bot.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60" data-pivot="0.5,1">
      <defs><linearGradient id="g"><stop offset="0" stop-color="{{gold.hi}}"/><stop offset="1" stop-color="{{gold.deep}}"/></linearGradient></defs>
      <g id="part-body" data-pivot="30,40" data-z="0" data-box="10 20 40 40"><rect x="10" y="20" width="40" height="40" fill="url(#g)"/></g>
      <g id="part-eye" data-pivot="30,30" data-z="1" data-box="24 24 12 12"><g id="f0"><circle cx="30" cy="30" r="6" fill="{{glow.cyan}}"/></g><g id="f1"><circle cx="30" cy="30" r="2" fill="{{glow.cyan}}"/></g></g>
      <circle id="anchor-hat" cx="30" cy="18" r="0"/>
    </svg>`,
  );
  fs.writeFileSync(
    path.join(dir, "cast", "bot.anims.json"),
    JSON.stringify([
      { id: "idle", loop: true, ms: 1000, tracks: [{ part: "body", prop: "y", wave: { amp: 2, hz: 1, phase: 0 }, keys: [] }] },
      { id: "talk", loop: true, ms: 400, tracks: [{ part: "eye", prop: "frame", wave: null, keys: [[0, 0], [200, 1]] }] },
    ]),
  );
  fs.writeFileSync(path.join(dir, "cast", "bad.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="10" height="10"><path d="M0 0H10V10Z" fill="#FF0000"/></svg>`);
  fs.writeFileSync(
    path.join(dir, "cast", "cast.hero.json"),
    JSON.stringify({
      entries: [
        { key: `${ns}.doc.plaque`, file: "plaque.svg", zone: "z1", legacyId: "A1" },
        { key: `${ns}.npc.bot`, kind: "puppet", file: "bot.svg", zone: "z2" },
        { key: `${ns}.prop.bad`, file: "bad.svg", zone: "z1" },
      ],
    }),
  );
  fs.writeFileSync(
    path.join(dir, "cast", "cast.kit.json"),
    JSON.stringify({
      entries: [
        { key: `${ns}.doc.plaque`, gen: "plate", params: { w: 120, h: 80 }, zone: "z1" },
        { key: `${ns}.npc.bot`, kind: "puppet", recipe: "companion_standin", zone: "z2", anims: [{ id: "idle", loop: true, ms: 800, tracks: [{ part: "body", prop: "y", wave: { amp: 2, hz: 1, phase: 0 }, keys: [] }] }, { id: "talk", loop: true, ms: 800, tracks: [{ part: "head", prop: "rot", wave: { amp: 3, hz: 2, phase: 0 }, keys: [] }] }] },
        { key: `${ns}.prop.bad`, gen: "column", params: { h: 200 }, zone: "z1" },
        { key: `${ns}.layer.water`, gen: "waterBand", params: { w: 512, h: 100 }, zone: "z2", scroll: 0.6 },
        { key: `${ns}.prop.tank`, recipe: "glass_tank", args: { w: 200, h: 260 }, zone: "all" },
      ],
    }),
  );
  const log = () => undefined;

  it("builds heroes (pivot, transformed anchors, engraving), hero puppets, kit entries with extras, recipes; falls back on a bad hero", async () => {
    const res = await buildNamespace(ns, { root: tmp, kitOnly: false, log });
    const m = res.manifest;
    const byKey = new Map(m.entries.map((e) => [e.key, e]));
    expect([...byKey.keys()].sort()).toEqual([`${ns}.doc.plaque`, `${ns}.layer.water`, `${ns}.layer.water.b`, `${ns}.npc.bot`, `${ns}.prop.bad`, `${ns}.prop.tank`].sort());
    const plaque = byKey.get(`${ns}.doc.plaque`)!;
    expect(plaque).toMatchObject({ kind: "svg", source: "hero", pivot: [0.5, 1], width: 120, height: 80, zone: "z1", legacyId: "A1", engraved: ["π/2"] });
    if (plaque.kind === "svg") expect(plaque.anchors).toEqual([{ name: "label", x: 60, y: 35 }]);
    const plaqueSvg = res.files.find((f) => f.rel.endsWith(`${ns}/doc/plaque.svg`))!.data.toString("utf8");
    expect(plaqueSvg).not.toMatch(/<text|anchor-|data-|\{\{/);
    expect(plaqueSvg).toMatch(/fill="#D9A441"/);
    const bad = byKey.get(`${ns}.prop.bad`)!;
    expect(bad.source).toBe("kit:column");
    expect(res.warnings.some((w) => w.includes(`${ns}.prop.bad`) && w.includes("raw"))).toBe(true);
    const bot = byKey.get(`${ns}.npc.bot`)!;
    expect(res.warnings.filter((w) => w.includes("npc.bot"))).toEqual([]);
    expect(bot.kind).toBe("puppet");
    if (bot.kind === "puppet") {
      expect(bot.source).toBe("hero");
      expect(bot.parts.map((p) => [p.name, p.frames, p.z])).toEqual([["body", 1, 0], ["eye", 2, 1]]);
      const eye = bot.parts[1];
      expect(eye.rest).toEqual([30, 30]);
      expect(eye.box[2] % 4).toBe(0);
      expect(eye.pivot[0]).toBeCloseTo((30 - 22) / eye.box[2], 3);
      expect(bot.anims.map((a) => a.id)).toEqual(["idle", "talk"]);
      expect(bot.anchors).toEqual([{ name: "hat", x: 30, y: 18 }]);
      expect(bot.restFile).toBe(`${ns}/npc/bot.rest.svg`);
    }
    const rest = res.files.find((f) => f.rel.endsWith(`${ns}/npc/bot.rest.svg`))!.data.toString("utf8");
    expect(rest).not.toMatch(/id="f1"|data-/);
    const water = byKey.get(`${ns}.layer.water`)!;
    expect(water).toMatchObject({ source: "kit:waterBand", scroll: 0.6, tileWidth: 512, rasterScale: 0.75 });
    expect(byKey.get(`${ns}.prop.tank`)!.source).toBe("kit:glassTank");
    expect(m.heroCount).toBe(2);
    expect(m.vram.map((v) => v.zone)).toEqual(["all", "z1", "z2"]);
    expect(m.swapPeakMb).toBeGreaterThanOrEqual(m.vram[1].mb);
    expect(res.files.some((f) => f.rel === `src/world/asset-index/${ns}.generated.ts`)).toBe(true);
    expect(indexSource(ns, m.entries)).toContain(`"${ns}.npc.bot": { ns: "${ns}", kind: "puppet"`);
    // deterministic: a second build is byte-identical
    const again = await buildNamespace(ns, { root: tmp, kitOnly: false, log });
    expect(again.files.map((f) => [f.rel, f.data.toString("base64")])).toEqual(res.files.map((f) => [f.rel, f.data.toString("base64")]));
  });

  it("--kit-only builds every hero key from its kit entry", async () => {
    const res = await buildNamespace(ns, { root: tmp, kitOnly: true, log });
    const src = Object.fromEntries(res.manifest.entries.map((e) => [e.key, e.source]));
    expect(src[`${ns}.doc.plaque`]).toBe("kit:plate");
    expect(src[`${ns}.npc.bot`]).toBe("kit:companionStandin");
    expect(res.manifest.heroCount).toBe(0);
  });

  it("the fragment merge rule: a hero needs a kit entry; a key lives in one kit fragment", () => {
    const other = path.join(tmp, "art", "gen_bad");
    fs.mkdirSync(other, { recursive: true });
    fs.writeFileSync(path.join(other, "biome.json"), JSON.stringify({ paletteId: "gen_bad", heroCap: 40, zones: [] }));
    fs.writeFileSync(path.join(other, "a.hero.json"), JSON.stringify({ entries: [{ key: "gen_bad.prop.x", file: "x.svg" }] }));
    expect(() => collectNamespace(tmp, "gen_bad")).toThrow(/has no kit entry/);
    fs.writeFileSync(path.join(other, "a.kit.json"), JSON.stringify({ entries: [{ key: "gen_bad.prop.x", gen: "plate" }] }));
    fs.writeFileSync(path.join(other, "b.kit.json"), JSON.stringify({ entries: [{ key: "gen_bad.prop.x", gen: "plate" }] }));
    expect(() => collectNamespace(tmp, "gen_bad")).toThrow(FragmentError);
    fs.writeFileSync(path.join(other, "b.kit.json"), JSON.stringify({ entries: [{ key: "gen_bad.prop.y", gen: "plate", file: "y.svg" }] }));
    expect(() => collectNamespace(tmp, "gen_bad")).toThrow(/exactly one source/);
  });

  it("fails with the key when a generator's params are invalid", async () => {
    const bad = path.join(tmp, "art", "gen_params");
    fs.mkdirSync(bad, { recursive: true });
    fs.writeFileSync(path.join(bad, "biome.json"), JSON.stringify({ paletteId: "gen_params", heroCap: 40, zones: [] }));
    fs.writeFileSync(path.join(bad, "a.kit.json"), JSON.stringify({ entries: [{ key: "gen_params.prop.x", gen: "crystalCluster", params: { lean: 90 } }] }));
    await expect(buildNamespace("gen_params", { root: tmp, kitOnly: false, log })).rejects.toThrow(/gen_params\.prop\.x: lean/);
  });
});
